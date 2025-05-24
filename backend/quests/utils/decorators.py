"""
Декоратори для системи завдань WINIX
JWT авторизація, валідація, rate limiting, безпека та інші утиліти
Повна версія з покращеною безпекою та моніторингом
"""

import os
import jwt
import time
import logging
import functools
import secrets
import re
import ipaddress
from datetime import datetime, timezone
from typing import Dict, Any, Optional, Callable, TypeVar
from flask import request, jsonify, g
from collections import defaultdict, deque

logger = logging.getLogger(__name__)

# JWT налаштування
JWT_SECRET = os.getenv('JWT_SECRET', 'winix-secure-jwt-secret-key-2025')
JWT_ALGORITHM = os.getenv('JWT_ALGORITHM', 'HS256')
JWT_EXPIRATION = int(os.getenv('JWT_EXPIRATION', '86400'))  # 24 години

# Безпека
SECURITY_HEADERS_ENABLED = os.getenv('SECURITY_HEADERS_ENABLED', 'true').lower() == 'true'
RATE_LIMIT_ENABLED = os.getenv('RATE_LIMIT_ENABLED', 'true').lower() == 'true'
INPUT_VALIDATION_ENABLED = os.getenv('INPUT_VALIDATION_ENABLED', 'true').lower() == 'true'
SQL_INJECTION_PROTECTION = os.getenv('SQL_INJECTION_PROTECTION', 'true').lower() == 'true'
XSS_PROTECTION = os.getenv('XSS_PROTECTION', 'true').lower() == 'true'

# Списки для безпеки
BLOCKED_IPS = set(os.getenv('BLOCKED_IPS', '').split(',')) if os.getenv('BLOCKED_IPS') else set()
ALLOWED_ORIGINS = os.getenv('ALLOWED_ORIGINS', '*').split(',')
TRUSTED_PROXIES = set(os.getenv('TRUSTED_PROXIES', '').split(',')) if os.getenv('TRUSTED_PROXIES') else set()

# Rate limiting storage
rate_limit_storage = defaultdict(lambda: deque())

F = TypeVar('F', bound=Callable[..., Any])


# === ВИНЯТКИ ===

class AuthError(Exception):
    """Помилка авторизації"""
    def __init__(self, message: str, status_code: int = 401):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


class ValidationError(Exception):
    """Помилка валідації"""
    def __init__(self, message: str, status_code: int = 400, field: Optional[str] = None):
        self.message = message
        self.status_code = status_code
        self.field = field
        super().__init__(message)


class SecurityError(Exception):
    """Помилка безпеки"""
    def __init__(self, message: str, status_code: int = 403, threat_type: Optional[str] = None):
        self.message = message
        self.status_code = status_code
        self.threat_type = threat_type
        super().__init__(message)


class RateLimitError(Exception):
    """Помилка перевищення rate limit"""
    def __init__(self, message: str, retry_after: int, limit: int = None):
        self.message = message
        self.retry_after = retry_after
        self.limit = limit
        super().__init__(message)


# === ФУНКЦІЇ БЕЗПЕКИ ===

def sanitize_input(value: str, max_length: int = 255, allowed_chars: Optional[str] = None) -> str:
    """Очищення вхідних даних від небезпечних символів"""
    if not value or not isinstance(value, str):
        return ""

    # Видаляємо керуючі символи
    cleaned = re.sub(r'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]', '', value)

    # Якщо вказані дозволені символи
    if allowed_chars:
        pattern = f'[^{re.escape(allowed_chars)}]'
        cleaned = re.sub(pattern, '', cleaned)

    # Обрізаємо до максимальної довжини
    cleaned = cleaned[:max_length]
    return cleaned.strip()


def detect_sql_injection(value: str) -> bool:
    """Виявлення спроб SQL ін'єкції"""
    if not value or not SQL_INJECTION_PROTECTION:
        return False

    sql_patterns = [
        r"('\s*(or|and)\s*')",
        r"('\s*(or|and)\s*\d+\s*=\s*\d+)",
        r"(union\s+select)",
        r"(drop\s+table)",
        r"(insert\s+into)",
        r"(delete\s+from)",
        r"(update\s+.*\s+set)",
        r"(--\s*)",
        r"(/\*.*\*/)",
        r"(;\s*drop)",
        r"(;\s*delete)",
        r"(;\s*update)",
        r"(;\s*insert)"
    ]

    for pattern in sql_patterns:
        if re.search(pattern, value.lower()):
            return True
    return False


def detect_xss_attempt(value: str) -> bool:
    """Виявлення спроб XSS атак"""
    if not value or not XSS_PROTECTION:
        return False

    xss_patterns = [
        r"<script[^>]*>.*?</script>",
        r"javascript:",
        r"onload\s*=",
        r"onerror\s*=",
        r"onclick\s*=",
        r"onmouseover\s*=",
        r"<iframe[^>]*>",
        r"<object[^>]*>",
        r"<embed[^>]*>",
        r"expression\s*\(",
        r"@import"
    ]

    for pattern in xss_patterns:
        if re.search(pattern, value.lower()):
            return True
    return False


def get_real_ip() -> str:
    """Отримання реального IP адреси з урахуванням проксі"""
    forwarded_ips = []

    # X-Forwarded-For
    xff = request.headers.get('X-Forwarded-For')
    if xff:
        forwarded_ips.extend([ip.strip() for ip in xff.split(',')])

    # X-Real-IP
    real_ip = request.headers.get('X-Real-IP')
    if real_ip:
        forwarded_ips.append(real_ip.strip())

    # CF-Connecting-IP (Cloudflare)
    cf_ip = request.headers.get('CF-Connecting-IP')
    if cf_ip:
        forwarded_ips.append(cf_ip.strip())

    # Фільтруємо IP адреси
    for ip in forwarded_ips:
        try:
            ip_obj = ipaddress.ip_address(ip)
            if not ip_obj.is_private or ip in TRUSTED_PROXIES:
                return ip
        except ValueError:
            continue

    return request.remote_addr or '127.0.0.1'


def check_ip_reputation(ip: str) -> bool:
    """Перевірка репутації IP адреси"""
    if ip in BLOCKED_IPS:
        return False

    try:
        ip_obj = ipaddress.ip_address(ip)
        if ip_obj.is_private and os.getenv('ENVIRONMENT') == 'production':
            return False
    except ValueError:
        return False

    return True


def validate_origin(origin: str) -> bool:
    """Валідація Origin заголовка"""
    if not origin:
        return False

    if '*' in ALLOWED_ORIGINS:
        return True

    if origin in ALLOWED_ORIGINS:
        return True

    for allowed in ALLOWED_ORIGINS:
        if allowed.startswith('*.'):
            domain = allowed[2:]
            if origin.endswith(domain):
                return True

    return False


def generate_csrf_token() -> str:
    """Генерація CSRF токену"""
    return secrets.token_urlsafe(32)


def validate_csrf_token(token: str, session_token: str) -> bool:
    """Валідація CSRF токену"""
    return secrets.compare_digest(token, session_token)


# === JWT ФУНКЦІЇ ===

def generate_jwt_token(user_data: Dict[str, Any], expires_in: Optional[int] = None) -> str:
    """Генерація JWT токену з покращеною безпекою"""
    try:
        from datetime import datetime, timezone, timedelta

        now = datetime.now(timezone.utc)  # ✅ Сучасний спосіб
        exp_time = expires_in or JWT_EXPIRATION

        payload = {
            'user_id': user_data.get('telegram_id'),
            'username': user_data.get('username'),
            'exp': now + timedelta(seconds=exp_time),
            'iat': now,
            'nbf': now,
            # ...
        }

        token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
        logger.info(f"Generated JWT token for user {user_data.get('telegram_id')}")
        return token
    except Exception as e:
        logger.error(f"Error generating JWT token: {e}")
        raise AuthError("Помилка генерації токену")


def decode_jwt_token(token: str, validate_ip: bool = True) -> Dict[str, Any]:
    """Декодування JWT токену з додатковими перевірками"""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])

        # Додаткові перевірки безпеки
        if validate_ip and payload.get('ip') != get_real_ip():
            logger.warning(f"JWT token IP mismatch: {payload.get('ip')} vs {get_real_ip()}")
            raise AuthError("Токен використовується з іншого IP", 401)

        if payload.get('aud') != 'winix-client':
            raise AuthError("Невірний audience токену", 401)

        if payload.get('iss') != 'winix-api':
            raise AuthError("Невірний issuer токену", 401)

        return payload
    except jwt.ExpiredSignatureError:
        logger.warning("JWT token expired")
        raise AuthError("Токен застарів", 401)
    except jwt.InvalidTokenError as e:
        logger.warning(f"Invalid JWT token: {e}")
        raise AuthError("Невірний токен", 401)
    except Exception as e:
        logger.error(f"Error decoding JWT token: {e}")
        raise AuthError("Помилка валідації токену", 401)


def get_auth_token_from_request() -> Optional[str]:
    """Отримання токену з запиту"""
    auth_header = request.headers.get('Authorization')
    if auth_header and auth_header.startswith('Bearer '):
        token = auth_header[7:]
        if len(token) > 10 and '.' in token:
            return token

    token = request.headers.get('X-Auth-Token')
    if token and len(token) > 10:
        return token

    if os.getenv('ENVIRONMENT') == 'development':
        token = request.args.get('token')
        if token and len(token) > 10:
            return token

    return None


# === ДЕКОРАТОРИ БЕЗПЕКИ ===

def security_headers(f: F) -> F:
    """Декоратор для додавання заголовків безпеки"""

    @functools.wraps(f)
    def decorated_function(*args, **kwargs):
        response = f(*args, **kwargs)

        if SECURITY_HEADERS_ENABLED and hasattr(response, 'headers'):
            response.headers['X-Content-Type-Options'] = 'nosniff'
            response.headers['X-XSS-Protection'] = '1; mode=block'
            response.headers['X-Frame-Options'] = 'DENY'
            response.headers['Referrer-Policy'] = 'strict-origin-when-cross-origin'
            response.headers['Permissions-Policy'] = 'geolocation=(), microphone=(), camera=()'

            if request.path.startswith('/api/'):
                response.headers['Content-Security-Policy'] = "default-src 'none'; frame-ancestors 'none'"

        return response

    return decorated_function


def block_suspicious_requests(f: F) -> F:
    """Декоратор для блокування підозрілих запитів"""

    @functools.wraps(f)
    def decorated_function(*args, **kwargs):
        client_ip = get_real_ip()
        if not check_ip_reputation(client_ip):
            logger.warning(f"Blocked request from suspicious IP: {client_ip}")
            raise SecurityError("Ваш IP заблоковано", 403, "ip_blocked")

        origin = request.headers.get('Origin')
        if origin and not validate_origin(origin):
            logger.warning(f"Blocked request with invalid origin: {origin}")
            raise SecurityError("Невірний origin", 403, "invalid_origin")

        user_agent = request.headers.get('User-Agent', '')
        if not user_agent or len(user_agent) < 10:
            logger.warning(f"Blocked request with suspicious User-Agent: {user_agent}")
            raise SecurityError("Підозрілий User-Agent", 403, "suspicious_user_agent")

        return f(*args, **kwargs)

    return decorated_function


def validate_input_data(f: F) -> F:
    """Декоратор для валідації вхідних даних"""

    @functools.wraps(f)
    def decorated_function(*args, **kwargs):
        if not INPUT_VALIDATION_ENABLED:
            return f(*args, **kwargs)

        if request.is_json:
            try:
                data = request.get_json()
                if data:
                    _validate_json_data(data)
            except Exception as e:
                logger.warning(f"Input validation failed: {str(e)}")
                raise ValidationError("Невірні вхідні дані", 400)

        for key, value in request.args.items():
            if detect_sql_injection(value) or detect_xss_attempt(value):
                logger.warning(f"Malicious input detected in parameter {key}: {value}")
                raise SecurityError("Виявлено підозрілі дані", 400, "malicious_input")

        return f(*args, **kwargs)

    return decorated_function


def _validate_json_data(data: Any, path: str = ""):
    """Рекурсивна валідація JSON даних"""
    if isinstance(data, dict):
        for key, value in data.items():
            current_path = f"{path}.{key}" if path else key
            _validate_json_data(value, current_path)
    elif isinstance(data, list):
        for i, item in enumerate(data):
            current_path = f"{path}[{i}]"
            _validate_json_data(item, current_path)
    elif isinstance(data, str):
        if detect_sql_injection(data):
            raise ValidationError(f"SQL injection detected in {path}")
        if detect_xss_attempt(data):
            raise ValidationError(f"XSS attempt detected in {path}")


# === ДЕКОРАТОРИ АВТОРИЗАЦІЇ ===

def require_auth(validate_ip: bool = True, require_fresh_token: bool = False):
    """Декоратор для обов'язкової авторизації"""

    def decorator(f: F) -> F:
        @functools.wraps(f)
        def decorated_function(*args, **kwargs):
            try:
                token = get_auth_token_from_request()
                if not token:
                    logger.warning("No auth token provided")
                    return jsonify({
                        "status": "error",
                        "message": "Токен авторизації відсутній",
                        "code": "no_token"
                    }), 401

                payload = decode_jwt_token(token, validate_ip=validate_ip)

                if require_fresh_token:
                    token_age = datetime.now(timezone.utc).timestamp() - payload.get('iat', 0)
                    if token_age > 300:  # 5 хвилин
                        logger.warning("Token is not fresh enough")
                        return jsonify({
                            "status": "error",
                            "message": "Потрібен свіжий токен",
                            "code": "token_not_fresh"
                        }), 401

                g.current_user = {
                    'telegram_id': payload.get('user_id'),
                    'username': payload.get('username'),
                    'token_exp': payload.get('exp'),
                    'token_iat': payload.get('iat'),
                    'token_jti': payload.get('jti'),
                    'scope': payload.get('scope', 'user'),
                    'ip': payload.get('ip')
                }

                if not hasattr(g, 'csrf_token'):
                    g.csrf_token = generate_csrf_token()

                logger.debug(f"Authenticated user: {g.current_user['telegram_id']}")
                return f(*args, **kwargs)

            except (AuthError, SecurityError) as e:
                return jsonify({
                    "status": "error",
                    "message": e.message,
                    "code": "auth_error"
                }), e.status_code
            except Exception as e:
                logger.error(f"Unexpected auth error: {e}")
                return jsonify({
                    "status": "error",
                    "message": "Помилка авторизації",
                    "code": "auth_error"
                }), 401

        return decorated_function

    return decorator


def optional_auth(f: F) -> F:
    """Декоратор для опціональної авторизації"""

    @functools.wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            token = get_auth_token_from_request()
            if token:
                try:
                    payload = decode_jwt_token(token, validate_ip=False)
                    g.current_user = {
                        'telegram_id': payload.get('user_id'),
                        'username': payload.get('username'),
                        'token_exp': payload.get('exp'),
                        'token_iat': payload.get('iat'),
                        'scope': payload.get('scope', 'user')
                    }
                    logger.debug(f"Optional auth: authenticated user {g.current_user['telegram_id']}")
                except (AuthError, SecurityError):
                    g.current_user = None
            else:
                g.current_user = None

            return f(*args, **kwargs)

        except Exception as e:
            logger.error(f"Unexpected error in optional auth: {e}")
            g.current_user = None
            return f(*args, **kwargs)

    return decorated_function


def validate_user_access(f: F) -> F:
    """Декоратор для перевірки доступу до ресурсу користувача"""

    @functools.wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            if not hasattr(g, 'current_user') or not g.current_user:
                return jsonify({
                    "status": "error",
                    "message": "Авторизація обов'язкова",
                    "code": "auth_required"
                }), 401

            user_id = kwargs.get('user_id') or kwargs.get('telegram_id')
            if not user_id:
                user_id = request.view_args.get('user_id') or request.view_args.get('telegram_id')

            if not user_id:
                return jsonify({
                    "status": "error",
                    "message": "ID користувача не вказано",
                    "code": "user_id_missing"
                }), 400

            current_user_id = str(g.current_user['telegram_id'])
            target_user_id = str(user_id)

            if g.current_user.get('scope') == 'admin':
                return f(*args, **kwargs)

            if current_user_id != target_user_id:
                logger.warning(f"User {current_user_id} tried to access {target_user_id}'s resource")
                return jsonify({
                    "status": "error",
                    "message": "Доступ заборонено",
                    "code": "access_denied"
                }), 403

            return f(*args, **kwargs)

        except Exception as e:
            logger.error(f"Error in user access validation: {e}")
            return jsonify({
                "status": "error",
                "message": "Помилка перевірки доступу",
                "code": "access_error"
            }), 500

    return decorated_function


# === RATE LIMITING ===

def rate_limit(max_requests: int = 10, window_seconds: int = 60):
    """Декоратор для rate limiting"""

    def decorator(f: F) -> F:
        @functools.wraps(f)
        def decorated_function(*args, **kwargs):
            if not RATE_LIMIT_ENABLED:
                return f(*args, **kwargs)

            try:
                if hasattr(g, 'current_user') and g.current_user:
                    key = f"user_{g.current_user['telegram_id']}"
                else:
                    key = f"ip_{get_real_ip()}"

                current_time = time.time()
                window_start = current_time - window_seconds

                user_requests = rate_limit_storage[key]
                while user_requests and user_requests[0] < window_start:
                    user_requests.popleft()

                if len(user_requests) >= max_requests:
                    retry_after = int(window_seconds - (current_time - user_requests[0]))

                    logger.warning(f"Rate limit exceeded for {key}")

                    response = jsonify({
                        "status": "error",
                        "message": "Забагато запитів. Спробуйте пізніше",
                        "code": "rate_limit_exceeded",
                        "retry_after": retry_after
                    })
                    response.status_code = 429
                    response.headers['Retry-After'] = str(retry_after)
                    return response

                user_requests.append(current_time)
                return f(*args, **kwargs)

            except Exception as e:
                logger.error(f"Error in rate limiting: {e}")
                return f(*args, **kwargs)

        return decorated_function

    return decorator


# === ВАЛІДАЦІЯ ===

def validate_json(required_fields: list = None, optional_fields: list = None):
    """Декоратор для валідації JSON"""

    def decorator(f: F) -> F:
        @functools.wraps(f)
        def decorated_function(*args, **kwargs):
            try:
                if not request.is_json:
                    return jsonify({
                        "status": "error",
                        "message": "Очікується JSON",
                        "code": "json_required"
                    }), 400

                data = request.get_json()
                if data is None:
                    return jsonify({
                        "status": "error",
                        "message": "Невірний JSON",
                        "code": "invalid_json"
                    }), 400

                if required_fields:
                    missing_fields = [field for field in required_fields if field not in data]
                    if missing_fields:
                        return jsonify({
                            "status": "error",
                            "message": f"Відсутні обов'язкові поля: {', '.join(missing_fields)}",
                            "code": "missing_fields",
                            "missing_fields": missing_fields
                        }), 400

                g.json_data = data
                return f(*args, **kwargs)

            except Exception as e:
                logger.error(f"Error in JSON validation: {e}")
                return jsonify({
                    "status": "error",
                    "message": "Помилка валідації JSON",
                    "code": "validation_error"
                }), 400

        return decorated_function

    return decorator


def validate_telegram_id(f: F) -> F:
    """Декоратор для валідації Telegram ID в URL"""

    @functools.wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            telegram_id = kwargs.get('telegram_id') or kwargs.get('user_id')
            if not telegram_id:
                telegram_id = request.view_args.get('telegram_id') or request.view_args.get('user_id')

            if not telegram_id:
                return jsonify({
                    "status": "error",
                    "message": "Telegram ID не вказано",
                    "code": "telegram_id_missing"
                }), 400

            try:
                telegram_id = int(telegram_id)
                if telegram_id <= 0:
                    raise ValueError("ID має бути додатним")
            except (ValueError, TypeError):
                return jsonify({
                    "status": "error",
                    "message": "Невірний формат Telegram ID",
                    "code": "invalid_telegram_id"
                }), 400

            if 'telegram_id' in kwargs:
                kwargs['telegram_id'] = telegram_id
            if 'user_id' in kwargs:
                kwargs['user_id'] = telegram_id

            return f(*args, **kwargs)

        except Exception as e:
            logger.error(f"Error in Telegram ID validation: {e}")
            return jsonify({
                "status": "error",
                "message": "Помилка валідації Telegram ID",
                "code": "validation_error"
            }), 400

    return decorated_function


# === ОБРОБКА ПОМИЛОК ===

def handle_errors(f: F) -> F:
    """Декоратор для обробки помилок"""

    @functools.wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            return f(*args, **kwargs)
        except ValidationError as e:
            logger.warning(f"Validation error in {f.__name__}: {e}")
            return jsonify({
                "status": "error",
                "message": e.message,
                "code": "validation_error",
                "field": e.field
            }), e.status_code
        except AuthError as e:
            logger.warning(f"Auth error in {f.__name__}: {e}")
            return jsonify({
                "status": "error",
                "message": e.message,
                "code": "auth_error"
            }), e.status_code
        except SecurityError as e:
            logger.warning(f"Security error in {f.__name__}: {e}")
            return jsonify({
                "status": "error",
                "message": e.message,
                "code": "security_error"
            }), e.status_code
        except Exception as e:
            logger.error(f"Unexpected error in {f.__name__}: {e}", exc_info=True)
            return jsonify({
                "status": "error",
                "message": "Внутрішня помилка сервера",
                "code": "internal_error"
            }), 500

    return decorated_function


def log_requests(f: F) -> F:
    """Декоратор для логування запитів"""

    @functools.wraps(f)
    def decorated_function(*args, **kwargs):
        start_time = time.time()

        user_info = "anonymous"
        if hasattr(g, 'current_user') and g.current_user:
            user_info = f"user_{g.current_user['telegram_id']}"

        logger.info(f"Request started: {request.method} {request.path} by {user_info}")

        try:
            result = f(*args, **kwargs)
            end_time = time.time()
            duration = (end_time - start_time) * 1000

            status = "success"
            if hasattr(result, 'status_code'):
                status = f"status_{result.status_code}"

            logger.info(f"Request completed: {request.method} {request.path} "
                        f"by {user_info} in {duration:.2f}ms [{status}]")

            return result
        except Exception as e:
            end_time = time.time()
            duration = (end_time - start_time) * 1000
            logger.error(f"Request failed: {request.method} {request.path} "
                         f"by {user_info} in {duration:.2f}ms [error: {str(e)}]")
            raise

    return decorated_function


# === КОМБІНОВАНІ ДЕКОРАТОРИ ===

def secure_endpoint(max_requests: int = 10, window_seconds: int = 60,
                   require_fresh_token: bool = False):
    """Комбінований декоратор для захищених endpoints"""

    def decorator(f: F) -> F:
        decorated = f
        decorated = handle_errors(decorated)
        decorated = log_requests(decorated)
        decorated = validate_input_data(decorated)
        decorated = block_suspicious_requests(decorated)
        decorated = security_headers(decorated)
        decorated = rate_limit(max_requests, window_seconds)(decorated)
        decorated = require_auth(require_fresh_token=require_fresh_token)(decorated)
        decorated = validate_telegram_id(decorated)
        decorated = validate_user_access(decorated)
        return decorated

    return decorator


def public_endpoint(max_requests: int = 20, window_seconds: int = 60):
    """Комбінований декоратор для публічних endpoints"""

    def decorator(f: F) -> F:
        decorated = f
        decorated = handle_errors(decorated)
        decorated = log_requests(decorated)
        decorated = validate_input_data(decorated)
        decorated = block_suspicious_requests(decorated)
        decorated = security_headers(decorated)
        decorated = rate_limit(max_requests, window_seconds)(decorated)
        decorated = optional_auth(decorated)
        return decorated

    return decorator


# === УТИЛІТИ ===

def get_current_user() -> Optional[Dict[str, Any]]:
    """Отримання поточного користувача"""
    return getattr(g, 'current_user', None)


def get_json_data() -> Optional[Dict[str, Any]]:
    """Отримання валідованих JSON даних"""
    return getattr(g, 'json_data', None)


def clear_rate_limit_storage():
    """Очищення storage для rate limiting (для тестів)"""
    global rate_limit_storage
    rate_limit_storage.clear()


# Експорт
__all__ = [
    'require_auth',
    'optional_auth',
    'validate_user_access',
    'rate_limit',
    'validate_json',
    'validate_telegram_id',
    'handle_errors',
    'log_requests',
    'secure_endpoint',
    'public_endpoint',
    'generate_jwt_token',
    'decode_jwt_token',
    'get_current_user',
    'get_json_data',
    'AuthError',
    'ValidationError',
    'SecurityError',
    'clear_rate_limit_storage',
    'security_headers',
    'block_suspicious_requests',
    'validate_input_data'
]