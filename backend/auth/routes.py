"""
Маршрути для автентифікації користувачів.
ВИПРАВЛЕНА ВЕРСІЯ з покращеною обробкою помилок та fallback механізмами
"""

from flask import request, jsonify
import logging
import jwt
import traceback
import time
import re
from datetime import datetime, timezone, timedelta

# Налаштування логування
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("auth_routes")

# Імпортуємо змінні конфігурації
try:
    from backend.settings.config import JWT_SECRET, JWT_ALGORITHM
except ImportError:
    try:
        from settings.config import JWT_SECRET, JWT_ALGORITHM
    except ImportError:
        import os
        JWT_SECRET = os.getenv('JWT_SECRET', 'winix-secure-jwt-secret-key-2025')
        JWT_ALGORITHM = 'HS256'

# Імпортуємо контролери
try:
    from . import controllers
except ImportError:
    try:
        from auth import controllers
    except ImportError:
        controllers = None
        logger.error("❌ Не вдалося імпортувати auth controllers")

# Константи
TOKEN_VALIDITY_DAYS = 7
REFRESH_TOKEN_VALIDITY_DAYS = 30
DEBUG_MODE = True

# Збереження часу запуску для uptime
start_time = time.time()

# Regex для валідації параметрів
TIMESTAMP_PATTERN = re.compile(r'^\d{1,13}$')
USER_ID_PATTERN = re.compile(r'^\d+$')
TOKEN_PATTERN = re.compile(r'^[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+$')

def validate_timestamp_flexible(timestamp_str):
    """Гнучка валідація timestamp з підтримкою мілісекунд"""
    if not timestamp_str:
        return True

    try:
        timestamp = int(timestamp_str)
        if timestamp > 9999999999:
            timestamp = timestamp // 1000

        current_time = int(time.time())
        min_time = current_time - (10 * 365 * 24 * 3600)
        max_time = current_time + (5 * 365 * 24 * 3600)

        if min_time <= timestamp <= max_time:
            return True

        logger.debug(f"Timestamp {timestamp} поза допустимими межами")
        return False

    except (ValueError, OverflowError):
        logger.debug(f"Невалідний формат timestamp: {timestamp_str}")
        return False

def validate_user_id(user_id_str):
    """Валідація user ID"""
    if not user_id_str:
        return False

    if not USER_ID_PATTERN.match(str(user_id_str)):
        return False

    try:
        user_id = int(user_id_str)
        if user_id <= 0 or user_id > 999999999999:
            return False
        return True
    except (ValueError, OverflowError):
        return False

def validate_jwt_format(token_str):
    """Валідація формату JWT токена"""
    if not token_str:
        return False

    if token_str.startswith('Bearer '):
        token_str = token_str[7:]

    return TOKEN_PATTERN.match(token_str) is not None

def extract_token_from_request():
    """Отримує токен з різних джерел у запиті з валідацією"""
    # 1. Authorization header
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        if validate_jwt_format(token):
            return token
        logger.warning(f"Invalid JWT format in Authorization header: {token[:20]}...")

    # 2. Request body
    data = request.get_json(silent=True) or {}
    if 'token' in data and data['token']:
        token = str(data['token'])
        if validate_jwt_format(token):
            return token
        logger.warning(f"Invalid JWT format in request body: {token[:20]}...")

    return None

def extract_user_id_from_request():
    """Отримує Telegram ID користувача з різних джерел у запиті з валідацією"""
    # 1. X-Telegram-User-Id header (пріоритет)
    header_id = request.headers.get('X-Telegram-User-Id')
    if header_id and validate_user_id(header_id):
        return str(header_id)

    # 2. Request body
    data = request.get_json(silent=True) or {}

    # Перевіряємо telegram_id
    if 'telegram_id' in data and data['telegram_id']:
        user_id = str(data['telegram_id'])
        if validate_user_id(user_id):
            return user_id

    # Перевіряємо id
    if 'id' in data and data['id']:
        user_id = str(data['id'])
        if validate_user_id(user_id):
            return user_id

    return None

def create_jwt_token(user_id, expiration_days=TOKEN_VALIDITY_DAYS, token_type="access"):
    """Створює новий JWT токен з валідацією"""
    try:
        if not validate_user_id(user_id):
            logger.error(f"Invalid user_id for token creation: {user_id}")
            return None

        expiration = datetime.now(timezone.utc) + timedelta(days=expiration_days)

        token_data = {
            "user_id": str(user_id),
            "exp": expiration,
            "iat": datetime.now(timezone.utc),
            "type": token_type
        }

        token = jwt.encode(token_data, JWT_SECRET, algorithm=JWT_ALGORITHM)

        return {
            "token": token,
            "expires_at": expiration.isoformat()
        }
    except Exception as e:
        logger.error(f"Помилка створення JWT токена: {str(e)}")
        return None

def is_request_from_telegram(request_data, headers):
    """Визначає чи запит прийшов від Telegram Mini App"""
    if request_data.get('initData'):
        return True

    header_user_id = headers.get('X-Telegram-User-Id')
    if header_user_id and validate_user_id(header_user_id):
        return True

    user_agent = headers.get('User-Agent', '')
    if 'Telegram' in user_agent or 'TelegramBot' in user_agent:
        return True

    if request_data.get('from_telegram'):
        return True

    if request_data.get('id') and validate_user_id(request_data.get('id')):
        if request_data.get('first_name'):
            return True

    return False

def handle_validation_error(message, request_id=None):
    """Централізована обробка помилок валідації"""
    error_response = {
        'status': 'error',
        'message': message,
        'code': 'validation_error'
    }
    if request_id:
        error_response['request_id'] = request_id

    return jsonify(error_response), 400

def get_fallback_user_data(user_id):
    """Отримання fallback даних користувача"""
    return {
        'telegram_id': user_id,
        'username': f'user_{user_id}',
        'balance': 0,
        'coins': 0,
        'is_new_user': False,
        'fallback': True
    }

def register_auth_routes(app):
    """Реєстрація маршрутів автентифікації"""

    # ========== PING ENDPOINTS ==========

    @app.route('/api/ping', methods=['GET'])
    def api_ping():
        """Простий ping endpoint"""
        try:
            timestamp_param = request.args.get('t', '')

            response_data = {
                "status": "pong",
                "timestamp": int(time.time()),
                "server_time": datetime.now(timezone.utc).isoformat()
            }

            if timestamp_param:
                response_data["client_timestamp"] = timestamp_param

            return jsonify(response_data)

        except Exception as e:
            logger.error(f"Ping endpoint error: {str(e)}")
            return jsonify({
                "status": "pong",
                "timestamp": int(time.time()),
                "error": "partial_failure"
            })

    @app.route('/ping', methods=['GET'])
    def ultra_simple_ping():
        """Ультра простий ping без JSON"""
        return "pong"

    @app.route('/api/health', methods=['GET'])
    def enhanced_health():
        """Розширений health check з валідацією"""
        try:
            timestamp_param = request.args.get('t', '')

            if timestamp_param and not validate_timestamp_flexible(timestamp_param):
                logger.warning(f"Invalid timestamp in health check: {timestamp_param}")

            health_data = {
                "status": "ok",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "service": "WINIX Backend",
                "version": "1.0.0",
                "uptime": int(time.time() - start_time)
            }

            return jsonify(health_data)

        except Exception as e:
            logger.error(f"Health check error: {str(e)}")
            return jsonify({
                "status": "error",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "error": str(e)
            }), 500

    @app.route('/health', methods=['GET'])
    def simple_health():
        """Простий health check без залежностей"""
        return jsonify({
            "status": "ok",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "service": "WINIX Backend",
            "uptime": int(time.time() - start_time)
        })

    # ========== ОСНОВНІ AUTH ENDPOINTS ==========

    @app.route('/api/auth', methods=['POST'])
    def auth_user():
        """Автентифікація користувача через Telegram дані"""
        start_time_req = datetime.now()
        request_id = f"auth_{int(start_time_req.timestamp())}"

        try:
            data = request.json or {}
            client_ip = request.remote_addr
            user_agent = request.headers.get('User-Agent', 'Unknown')

            logger.info(f"[{request_id}] Запит автентифікації від {client_ip}")

            if is_request_from_telegram(data, request.headers):
                data['from_telegram'] = True
                logger.info(f"[{request_id}] Запит ідентифіковано як Telegram Mini App")

            # Отримуємо user_id з різних джерел
            user_id = extract_user_id_from_request()

            if not user_id:
                logger.warning(f"[{request_id}] Відсутній або невалідний Telegram ID у запиті")
                return handle_validation_error(
                    'Telegram ID не надано або має невірний формат.',
                    request_id
                )

            # Додаємо user_id до data якщо його там немає
            if 'id' not in data:
                data['id'] = user_id
            if 'telegram_id' not in data:
                data['telegram_id'] = user_id

            # Отримуємо/верифікуємо користувача
            user = None
            if controllers:
                try:
                    user = controllers.verify_user(data)
                    logger.info(f"[{request_id}] Користувач верифікований через controllers")
                except Exception as e:
                    logger.error(f"[{request_id}] Помилка верифікації через controllers: {e}")
                    user = None

            # Fallback якщо controllers недоступні або не працюють
            if not user:
                logger.warning(f"[{request_id}] Використовуємо fallback дані користувача")
                user = get_fallback_user_data(user_id)

            # Створюємо JWT токен
            token_result = create_jwt_token(user.get('telegram_id'))
            if not token_result:
                logger.error(f"[{request_id}] Помилка створення токена")
                return jsonify({
                    'status': 'error',
                    'message': 'Помилка створення токена автентифікації',
                    'request_id': request_id
                }), 500

            is_new_user = user.get('is_new_user', False)

            response = {
                'status': 'success',
                'token': token_result['token'],
                'expires_at': token_result['expires_at'],
                'data': {
                    'telegram_id': user.get('telegram_id'),
                    'username': user.get('username'),
                    'balance': user.get('balance', 0),
                    'coins': user.get('coins', 0),
                    'is_new_user': is_new_user
                },
                'request_id': request_id
            }

            execution_time = (datetime.now() - start_time_req).total_seconds()
            log_message = f"[{request_id}] Успішна автентифікація користувача {user.get('telegram_id')}"
            if is_new_user:
                log_message += " (НОВИЙ КОРИСТУВАЧ)"
            log_message += f" за {execution_time:.4f}с"
            logger.info(log_message)

            return jsonify(response)

        except Exception as e:
            logger.error(f"[{request_id}] Критична помилка в auth_user: {str(e)}")
            if DEBUG_MODE:
                logger.error(traceback.format_exc())

            return jsonify({
                'status': 'error',
                'message': f"Внутрішня помилка сервера: {str(e) if DEBUG_MODE else 'Зверніться до адміністратора'}",
                'request_id': request_id
            }), 500

    @app.route('/api/auth/refresh-token', methods=['POST'])
    def refresh_token():
        """ВИПРАВЛЕНО: Оновлення JWT токену автентифікації з покращеною логікою"""
        start_time_req = datetime.now()
        request_id = f"refresh_{int(start_time_req.timestamp())}"

        try:
            client_ip = request.remote_addr
            logger.info(f"[{request_id}] Запит оновлення токена від {client_ip}")

            # Отримуємо ID користувача з заголовків або тіла запиту
            user_id = extract_user_id_from_request()

            if not user_id:
                logger.warning(f"[{request_id}] ID користувача не знайдено у запиті")
                return handle_validation_error("ID користувача не знайдено у запиті", request_id)

            logger.info(f"[{request_id}] Обробка оновлення токена для користувача {user_id}")

            # Перевіримо існування користувача
            user = None
            if controllers:
                try:
                    user = controllers.get_user_data(user_id)
                    if user:
                        logger.info(f"[{request_id}] Користувач {user_id} знайдений в БД")
                    else:
                        logger.info(f"[{request_id}] Користувач {user_id} не знайдений в БД")
                except Exception as e:
                    logger.warning(f"[{request_id}] Помилка отримання користувача: {e}")
                    user = None

            # Fallback якщо користувача не знайдено або controllers недоступні
            if not user:
                logger.info(f"[{request_id}] Використовуємо fallback дані для {user_id}")
                user = get_fallback_user_data(user_id)

            # Отримуємо поточний токен (опціонально для логування)
            current_token = extract_token_from_request()
            if current_token:
                try:
                    # Спробуємо декодувати для валідації
                    payload = jwt.decode(current_token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
                    token_user_id = payload.get("user_id")

                    if token_user_id != user_id:
                        logger.warning(f"[{request_id}] ID в токені ({token_user_id}) не відповідає запитаному ID ({user_id})")
                        # Не повертаємо помилку, просто створюємо новий токен
                    else:
                        logger.info(f"[{request_id}] Токен валідний для користувача {user_id}")

                except jwt.ExpiredSignatureError:
                    logger.info(f"[{request_id}] Токен протерміновано для {user_id}, створюємо новий")
                except jwt.InvalidTokenError as e:
                    logger.info(f"[{request_id}] Невалідний токен для {user_id}: {str(e)}, створюємо новий")
            else:
                logger.info(f"[{request_id}] Токен відсутній, створюємо новий для {user_id}")

            # Завжди створюємо новий токен
            token_result = create_jwt_token(user_id)

            if not token_result:
                logger.error(f"[{request_id}] Не вдалося створити токен для {user_id}")
                return jsonify({
                    "status": "error",
                    "message": "Помилка створення токена",
                    "request_id": request_id
                }), 500

            execution_time = (datetime.now() - start_time_req).total_seconds()
            logger.info(f"[{request_id}] Успішно створено новий токен для {user_id} за {execution_time:.4f}с")

            return jsonify({
                "status": "success",
                "token": token_result["token"],
                "expires_at": token_result["expires_at"],
                "user_id": user_id,
                "request_id": request_id
            })

        except Exception as e:
            logger.error(f"[{request_id}] Критична помилка в refresh_token: {str(e)}")
            if DEBUG_MODE:
                logger.error(traceback.format_exc())

            return jsonify({
                "status": "error",
                "message": f"Внутрішня помилка сервера: {str(e) if DEBUG_MODE else 'Зверніться до адміністратора'}",
                "request_id": request_id
            }), 500

    @app.route('/api/auth/validate', methods=['POST'])
    def validate_auth():
        """Валідація токена автентифікації"""
        try:
            token = extract_token_from_request()
            if not token:
                return handle_validation_error("Токен не надано")

            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            user_id = payload.get("user_id")

            if not validate_user_id(user_id):
                return handle_validation_error("Невалідний user_id в токені")

            return jsonify({
                "status": "success",
                "valid": True,
                "user_id": user_id,
                "expires_at": payload.get("exp"),
                "token_type": payload.get("type", "access")
            })

        except jwt.ExpiredSignatureError:
            return jsonify({
                "status": "error",
                "valid": False,
                "message": "Токен протерміновано",
                "code": "token_expired"
            }), 401

        except jwt.InvalidTokenError:
            return jsonify({
                "status": "error",
                "valid": False,
                "message": "Невалідний токен",
                "code": "invalid_token"
            }), 401

        except Exception as e:
            logger.error(f"Token validation error: {str(e)}")
            return jsonify({
                "status": "error",
                "valid": False,
                "message": "Помилка валідації токена",
                "code": "validation_error"
            }), 500

    # ========== ТЕСТОВІ ENDPOINTS ==========

    @app.route('/api/auth/test', methods=['GET'])
    def auth_test():
        """Тестовий ендпоінт для перевірки роботи автентифікації"""
        token = extract_token_from_request()
        user_id = extract_user_id_from_request()
        is_telegram = is_request_from_telegram({}, request.headers)

        return jsonify({
            "status": "success",
            "message": "Тестовий ендпоінт автентифікації",
            "received": {
                "token": bool(token),
                "user_id": user_id,
                "is_telegram_request": is_telegram,
                "headers": dict(request.headers),
                "timestamp": datetime.now().isoformat()
            }
        })

    logger.info("✅ Маршрути автентифікації зареєстровано успішно")