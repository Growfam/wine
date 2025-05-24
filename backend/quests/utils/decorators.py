"""
Декоратори для системи завдань WINIX
JWT авторизація, валідація, rate limiting та інші утиліти
"""

import os
import jwt
import time
import logging
import functools
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional, Callable, TypeVar
from flask import request, jsonify, g
from collections import defaultdict, deque

logger = logging.getLogger(__name__)

# JWT налаштування
JWT_SECRET = os.getenv('JWT_SECRET', 'winix-secure-jwt-secret-key-2025')
JWT_ALGORITHM = os.getenv('JWT_ALGORITHM', 'HS256')
JWT_EXPIRATION = int(os.getenv('JWT_EXPIRATION', '86400'))  # 24 години

# Rate limiting
rate_limit_storage = defaultdict(lambda: deque())

F = TypeVar('F', bound=Callable[..., Any])


class AuthError(Exception):
    """Помилка авторизації"""

    def __init__(self, message: str, status_code: int = 401):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


class ValidationError(Exception):
    """Помилка валідації"""

    def __init__(self, message: str, status_code: int = 400):
        self.message = message
        self.status_code = status_code
        super().__init__(message)


def generate_jwt_token(user_data: Dict[str, Any]) -> str:
    """Генерація JWT токену"""
    try:
        payload = {
            'user_id': user_data.get('telegram_id'),
            'username': user_data.get('username'),
            'exp': datetime.utcnow() + timedelta(seconds=JWT_EXPIRATION),
            'iat': datetime.utcnow(),
            'type': 'access'
        }

        token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
        logger.info(f"Generated JWT token for user {user_data.get('telegram_id')}")
        return token
    except Exception as e:
        logger.error(f"Error generating JWT token: {e}")
        raise AuthError("Помилка генерації токену")


def decode_jwt_token(token: str) -> Dict[str, Any]:
    """Декодування JWT токену"""
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
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
    # Спробуємо отримати з заголовка Authorization
    auth_header = request.headers.get('Authorization')
    if auth_header and auth_header.startswith('Bearer '):
        return auth_header[7:]  # Видаляємо "Bearer "

    # Спробуємо отримати з заголовка X-Auth-Token
    token = request.headers.get('X-Auth-Token')
    if token:
        return token

    # Спробуємо отримати з параметрів запиту
    token = request.args.get('token')
    if token:
        return token

    return None


def require_auth(f: F) -> F:
    """Декоратор для обов'язкової авторизації"""

    @functools.wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            # Отримуємо токен
            token = get_auth_token_from_request()
            if not token:
                logger.warning("No auth token provided")
                return jsonify({
                    "status": "error",
                    "message": "Токен авторизації відсутній",
                    "code": "no_token"
                }), 401

            # Декодуємо токен
            payload = decode_jwt_token(token)

            # Зберігаємо дані користувача в g
            g.current_user = {
                'telegram_id': payload.get('user_id'),
                'username': payload.get('username'),
                'token_exp': payload.get('exp'),
                'token_iat': payload.get('iat')
            }

            logger.debug(f"Authenticated user: {g.current_user['telegram_id']}")

            return f(*args, **kwargs)

        except AuthError as e:
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


def optional_auth(f: F) -> F:
    """Декоратор для опціональної авторизації"""

    @functools.wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            token = get_auth_token_from_request()
            if token:
                try:
                    payload = decode_jwt_token(token)
                    g.current_user = {
                        'telegram_id': payload.get('user_id'),
                        'username': payload.get('username'),
                        'token_exp': payload.get('exp'),
                        'token_iat': payload.get('iat')
                    }
                    logger.debug(f"Optional auth: authenticated user {g.current_user['telegram_id']}")
                except AuthError:
                    # Ігноруємо помилки в опціональній авторизації
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

            # Отримуємо user_id з URL параметрів
            user_id = kwargs.get('user_id') or kwargs.get('telegram_id')
            if not user_id:
                user_id = request.view_args.get('user_id') or request.view_args.get('telegram_id')

            if not user_id:
                return jsonify({
                    "status": "error",
                    "message": "ID користувача не вказано",
                    "code": "user_id_missing"
                }), 400

            # Перевіряємо чи має користувач доступ до цього ресурсу
            current_user_id = str(g.current_user['telegram_id'])
            target_user_id = str(user_id)

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


def rate_limit(max_requests: int = 10, window_seconds: int = 60):
    """Декоратор для rate limiting"""

    def decorator(f: F) -> F:
        @functools.wraps(f)
        def decorated_function(*args, **kwargs):
            try:
                # Визначаємо ключ для rate limiting
                if hasattr(g, 'current_user') and g.current_user:
                    key = f"user_{g.current_user['telegram_id']}"
                else:
                    key = f"ip_{request.remote_addr}"

                current_time = time.time()
                window_start = current_time - window_seconds

                # Очищаємо старі записи
                user_requests = rate_limit_storage[key]
                while user_requests and user_requests[0] < window_start:
                    user_requests.popleft()

                # Перевіряємо ліміт
                if len(user_requests) >= max_requests:
                    logger.warning(f"Rate limit exceeded for {key}")
                    return jsonify({
                        "status": "error",
                        "message": "Забагато запитів. Спробуйте пізніше",
                        "code": "rate_limit_exceeded",
                        "retry_after": int(window_seconds - (current_time - user_requests[0]))
                    }), 429

                # Додаємо поточний запит
                user_requests.append(current_time)

                return f(*args, **kwargs)

            except Exception as e:
                logger.error(f"Error in rate limiting: {e}")
                # Продовжуємо виконання при помилці в rate limiting
                return f(*args, **kwargs)

        return decorated_function

    return decorator


def validate_json(required_fields: list = None, optional_fields: list = None):
    """Декоратор для валідації JSON"""

    def decorator(f: F) -> F:
        @functools.wraps(f)
        def decorated_function(*args, **kwargs):
            try:
                # Перевіряємо чи є JSON дані
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

                # Перевіряємо обов'язкові поля
                if required_fields:
                    missing_fields = [field for field in required_fields if field not in data]
                    if missing_fields:
                        return jsonify({
                            "status": "error",
                            "message": f"Відсутні обов'язкові поля: {', '.join(missing_fields)}",
                            "code": "missing_fields",
                            "missing_fields": missing_fields
                        }), 400

                # Зберігаємо валідовані дані
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
            # Отримуємо telegram_id з URL
            telegram_id = kwargs.get('telegram_id') or kwargs.get('user_id')
            if not telegram_id:
                telegram_id = request.view_args.get('telegram_id') or request.view_args.get('user_id')

            if not telegram_id:
                return jsonify({
                    "status": "error",
                    "message": "Telegram ID не вказано",
                    "code": "telegram_id_missing"
                }), 400

            # Валідуємо формат
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

            # Оновлюємо параметри
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
                "code": "validation_error"
            }), e.status_code
        except AuthError as e:
            logger.warning(f"Auth error in {f.__name__}: {e}")
            return jsonify({
                "status": "error",
                "message": e.message,
                "code": "auth_error"
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

        # Логуємо початок запиту
        user_info = "anonymous"
        if hasattr(g, 'current_user') and g.current_user:
            user_info = f"user_{g.current_user['telegram_id']}"

        logger.info(f"Request started: {request.method} {request.path} by {user_info}")

        try:
            result = f(*args, **kwargs)
            end_time = time.time()
            duration = (end_time - start_time) * 1000  # в мілісекундах

            # Визначаємо статус
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


# Комбіновані декоратори для зручності
def secure_endpoint(max_requests: int = 10, window_seconds: int = 60):
    """Комбінований декоратор для захищених endpoints"""

    def decorator(f: F) -> F:
        decorated = f
        decorated = handle_errors(decorated)
        decorated = log_requests(decorated)
        decorated = rate_limit(max_requests, window_seconds)(decorated)
        decorated = require_auth(decorated)
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
        decorated = rate_limit(max_requests, window_seconds)(decorated)
        decorated = optional_auth(decorated)
        return decorated

    return decorator


# Утиліти
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
    'clear_rate_limit_storage'
]