"""
Маршрути для автентифікації користувачів.
ПОВНА ВИПРАВЛЕНА ВЕРСІЯ з оптимальними ping endpoints та покращеною обробкою помилок.
"""

from flask import request, jsonify
import logging
import jwt
import traceback
import time
import re
from datetime import datetime, timezone, timedelta
from . import controllers

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

# Константи
TOKEN_VALIDITY_DAYS = 7
REFRESH_TOKEN_VALIDITY_DAYS = 30
DEBUG_MODE = True  # Встановіть False для продакшену

# Збереження часу запуску для uptime
start_time = time.time()

# Regex для валідації параметрів
TIMESTAMP_PATTERN = re.compile(r'^\d{1,13}$')  # Unix timestamp
USER_ID_PATTERN = re.compile(r'^\d+$')  # Numeric user ID
TOKEN_PATTERN = re.compile(r'^[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+$')  # JWT format


def validate_timestamp_flexible(timestamp_str):
    """ОПТИМАЛЬНА гнучка валідація timestamp з підтримкою мілісекунд"""
    if not timestamp_str:
        return True  # Опціональний параметр

    try:
        timestamp = int(timestamp_str)

        # Автоматично визначаємо формат (секунди vs мілісекунди)
        if timestamp > 9999999999:  # Це мілісекунди (більше ніж 2001 рік)
            timestamp = timestamp // 1000

        # Розширені але розумні межі
        current_time = int(time.time())
        min_time = current_time - (10 * 365 * 24 * 3600)  # 10 років назад
        max_time = current_time + (5 * 365 * 24 * 3600)   # 5 років вперед

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
        # Telegram user IDs мають розумні межі
        if user_id <= 0 or user_id > 999999999999:  # 12 цифр максимум
            return False
        return True
    except (ValueError, OverflowError):
        return False


def validate_jwt_format(token_str):
    """Валідація формату JWT токена"""
    if not token_str:
        return False

    # Видаляємо Bearer prefix якщо є
    if token_str.startswith('Bearer '):
        token_str = token_str[7:]

    return TOKEN_PATTERN.match(token_str) is not None


def extract_token_from_request():
    """Отримує токен з різних джерел у запиті з валідацією"""
    # Спочатку перевіряємо заголовок Authorization
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        if validate_jwt_format(token):
            return token
        logger.warning(f"Invalid JWT format in Authorization header: {token[:20]}...")

    # Перевіряємо тіло запиту
    data = request.get_json(silent=True) or {}
    if 'token' in data and data['token']:
        token = str(data['token'])
        if validate_jwt_format(token):
            return token
        logger.warning(f"Invalid JWT format in request body: {token[:20]}...")

    return None


def extract_user_id_from_request():
    """Отримує Telegram ID користувача з різних джерел у запиті з валідацією"""
    # Перевіряємо заголовок X-Telegram-User-Id
    header_id = request.headers.get('X-Telegram-User-Id')
    if header_id and validate_user_id(header_id):
        return str(header_id)

    # Перевіряємо тіло запиту
    data = request.get_json(silent=True) or {}
    if 'telegram_id' in data and data['telegram_id']:
        user_id = str(data['telegram_id'])
        if validate_user_id(user_id):
            return user_id

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
    """
    Визначає чи запит прийшов від Telegram Mini App

    Args:
        request_data: Дані запиту (JSON)
        headers: Заголовки запиту

    Returns:
        bool: True якщо запит від Telegram
    """
    # Перевіряємо наявність initData
    if request_data.get('initData'):
        return True

    # Перевіряємо заголовок X-Telegram-User-Id з валідацією
    header_user_id = headers.get('X-Telegram-User-Id')
    if header_user_id and validate_user_id(header_user_id):
        return True

    # Перевіряємо User-Agent на наявність Telegram
    user_agent = headers.get('User-Agent', '')
    if 'Telegram' in user_agent or 'TelegramBot' in user_agent:
        return True

    # Перевіряємо прапорець from_telegram
    if request_data.get('from_telegram'):
        return True

    # Перевіряємо наявність повних даних користувача з валідацією
    if request_data.get('id') and validate_user_id(request_data.get('id')):
        if request_data.get('first_name'):  # Базова перевірка Telegram даних
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


def register_auth_routes(app):
    """Реєстрація маршрутів автентифікації"""

    # ========== ОПТИМАЛЬНІ PING ENDPOINTS ==========

    @app.route('/api/ping', methods=['GET'])
    def api_ping():
        """ОПТИМАЛЬНИЙ ping endpoint для health check"""
        try:
            # Отримуємо timestamp але НЕ валідуємо його строго
            timestamp_param = request.args.get('t', '')

            response_data = {
                "status": "pong",
                "timestamp": int(time.time()),
                "server_time": datetime.now(timezone.utc).isoformat()
            }

            # Просто echo timestamp якщо він переданий (без строгої валідації)
            if timestamp_param:
                response_data["client_timestamp"] = timestamp_param

            return jsonify(response_data)

        except Exception as e:
            logger.error(f"Ping endpoint error: {str(e)}")
            # Навіть при помилці повертаємо базовий pong
            return jsonify({
                "status": "pong",
                "timestamp": int(time.time()),
                "error": "partial_failure"
            })

    @app.route('/ping', methods=['GET'])
    def ultra_simple_ping():
        """Ультра простий ping без жодної валідації для критичних ситуацій"""
        return "pong"

    @app.route('/api/health', methods=['GET'])
    def enhanced_health():
        """Розширений health check з валідацією"""
        try:
            # Тут можна використовувати строгу валідацію
            timestamp_param = request.args.get('t', '')

            if timestamp_param and not validate_timestamp_flexible(timestamp_param):
                logger.warning(f"Invalid timestamp in health check: {timestamp_param}")
                # Але не блокуємо запит

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

            logger.info(f"[{request_id}] Запит автентифікації від {client_ip} ({user_agent[:50]}...)")

            if DEBUG_MODE:
                logger.debug(f"[{request_id}] Заголовки: {dict(request.headers)}")
                # НЕ логуємо повне тіло запиту в продакшені для безпеки
                safe_data = {k: v for k, v in data.items() if k not in ['token', 'initData']}
                logger.debug(f"[{request_id}] Безпечні дані запиту: {safe_data}")

            # Перевіряємо чи це запит від Telegram
            if is_request_from_telegram(data, request.headers):
                data['from_telegram'] = True
                logger.info(f"[{request_id}] Запит ідентифіковано як Telegram Mini App")
            else:
                logger.warning(f"[{request_id}] Запит НЕ від Telegram Mini App")

            # Перевіряємо наявність ID з валідацією
            user_id = None
            if data.get('id'):
                if validate_user_id(data.get('id')):
                    user_id = str(data['id'])
                else:
                    return handle_validation_error('Invalid user ID format', request_id)
            elif data.get('telegram_id'):
                if validate_user_id(data.get('telegram_id')):
                    user_id = str(data['telegram_id'])
                else:
                    return handle_validation_error('Invalid telegram_id format', request_id)

            if not user_id:
                # Спробуємо отримати з заголовків
                header_id = request.headers.get('X-Telegram-User-Id')
                if header_id and validate_user_id(header_id):
                    user_id = str(header_id)
                    data['id'] = user_id
                    data['from_telegram'] = True
                else:
                    logger.warning(f"[{request_id}] Відсутній або невалідний Telegram ID у запиті")
                    return handle_validation_error(
                        'Telegram ID не надано або має невірний формат. Відкрийте додаток через Telegram.',
                        request_id
                    )

            # Отримуємо/верифікуємо користувача
            user = controllers.verify_user(data)

            if not user:
                logger.warning(f"[{request_id}] Користувач не знайдений або не може бути створений")

                # Різні повідомлення залежно від джерела запиту
                if data.get('from_telegram'):
                    error_message = 'Не вдалося створити користувача. Спробуйте ще раз.'
                else:
                    error_message = 'Доступ дозволено тільки через Telegram Mini App.'

                return jsonify({
                    'status': 'error',
                    'message': error_message,
                    'request_id': request_id
                }), 401

            # Створюємо JWT токен
            token_result = create_jwt_token(user.get('telegram_id'))
            if not token_result:
                logger.error(f"[{request_id}] Помилка створення токена")
                return jsonify({
                    'status': 'error',
                    'message': 'Помилка створення токена автентифікації',
                    'request_id': request_id
                }), 500

            # Визначаємо чи це новий користувач
            is_new_user = user.get('is_new_user', False)

            # Якщо прапорець не встановлено, перевіряємо за часом створення
            if not is_new_user and user.get('created_at'):
                try:
                    created_at = datetime.fromisoformat(user['created_at'].replace('Z', '+00:00'))
                    is_new_user = (datetime.now(timezone.utc) - created_at).total_seconds() < 60
                except (ValueError, TypeError):
                    logger.warning(f"[{request_id}] Помилка при визначенні часу створення користувача")

            # Формуємо відповідь
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

            # Логування часу виконання
            execution_time = (datetime.now() - start_time_req).total_seconds()
            log_message = f"[{request_id}] Успішна автентифікація користувача {user.get('telegram_id')}"
            if is_new_user:
                log_message += " (НОВИЙ КОРИСТУВАЧ)"
            log_message += f" за {execution_time:.4f}с"
            logger.info(log_message)

            return jsonify(response)

        except Exception as e:
            # Детальне логування помилки
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
        """Оновлення JWT токену автентифікації"""
        start_time_req = datetime.now()
        request_id = f"refresh_{int(start_time_req.timestamp())}"

        try:
            client_ip = request.remote_addr
            user_agent = request.headers.get('User-Agent', 'Unknown')

            logger.info(f"[{request_id}] Запит оновлення токена від {client_ip} ({user_agent[:50]}...)")

            # Отримуємо дані з різних джерел
            request_data = request.get_json(silent=True) or {}

            if DEBUG_MODE:
                logger.debug(f"[{request_id}] Заголовки: {dict(request.headers)}")
                # Безпечне логування без токенів
                safe_data = {k: v for k, v in request_data.items() if k not in ['token']}
                logger.debug(f"[{request_id}] Безпечні дані запиту: {safe_data}")

            # Отримуємо ID користувача з валідацією
            user_id = extract_user_id_from_request()

            if not user_id:
                logger.warning(f"[{request_id}] ID користувача не знайдено у запиті")
                return handle_validation_error("ID користувача не знайдено у запиті", request_id)

            # Перевіримо чи ID валідний (додаткова перевірка)
            if not validate_user_id(user_id):
                logger.warning(f"[{request_id}] Невалідний формат ID: {user_id}")
                return handle_validation_error("Невалідний формат ID користувача", request_id)

            # Перевіримо існування користувача
            user = controllers.get_user_data(user_id)

            if not user:
                logger.warning(f"[{request_id}] Користувача {user_id} не знайдено")

                # НЕ створюємо користувача автоматично при refresh токена
                return jsonify({
                    "status": "error",
                    "message": "Користувача не знайдено. Пройдіть авторизацію.",
                    "request_id": request_id
                }), 404

            # Отримуємо поточний токен з валідацією
            token = extract_token_from_request()

            # Якщо токен відсутній, створюємо новий
            if not token:
                logger.info(f"[{request_id}] Токен відсутній, створюємо новий для {user_id}")
                token_result = create_jwt_token(user_id)

                if not token_result:
                    return jsonify({
                        "status": "error",
                        "message": "Помилка створення нового токена",
                        "request_id": request_id
                    }), 500

                # Логування часу виконання
                execution_time = (datetime.now() - start_time_req).total_seconds()
                logger.info(f"[{request_id}] Створено новий токен для {user_id} за {execution_time:.4f}с")

                return jsonify({
                    "status": "success",
                    "token": token_result["token"],
                    "expires_at": token_result["expires_at"],
                    "message": "Новий токен створено",
                    "request_id": request_id
                })

            # Перевіряємо чи валідний токен
            try:
                logger.debug(f"[{request_id}] Спроба декодування токена для {user_id}")
                payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])

                token_user_id = payload.get("user_id")

                # Перевіряємо, чи ID в токені відповідає запитаному ID
                if token_user_id != user_id:
                    logger.warning(
                        f"[{request_id}] ID в токені ({token_user_id}) не відповідає запитаному ID ({user_id})")

                    # Для безпеки не дозволяємо оновлення токена з невідповідним ID
                    return jsonify({
                        "status": "error",
                        "message": "ID користувача не відповідає токену",
                        "request_id": request_id
                    }), 403

            except jwt.ExpiredSignatureError:
                logger.info(f"[{request_id}] Токен протерміновано для {user_id}")
                # Створюємо новий токен, оскільки ми вже перевірили існування користувача
                token_result = create_jwt_token(user_id)

                if not token_result:
                    return jsonify({
                        "status": "error",
                        "message": "Помилка створення нового токена після закінчення терміну дії",
                        "request_id": request_id
                    }), 500

                return jsonify({
                    "status": "success",
                    "token": token_result["token"],
                    "expires_at": token_result["expires_at"],
                    "message": "Термін дії токена минув, створено новий",
                    "request_id": request_id
                })

            except jwt.InvalidTokenError as e:
                logger.warning(f"[{request_id}] Невалідний токен для {user_id}: {str(e)}")
                # Створюємо новий токен, оскільки поточний недійсний
                token_result = create_jwt_token(user_id)

                if not token_result:
                    return jsonify({
                        "status": "error",
                        "message": "Помилка створення нового токена після виявлення недійсного",
                        "request_id": request_id
                    }), 500

                return jsonify({
                    "status": "success",
                    "token": token_result["token"],
                    "expires_at": token_result["expires_at"],
                    "message": "Недійсний токен, створено новий",
                    "request_id": request_id
                })

            # Якщо ми дійшли сюди, токен валідний, але ми все одно створюємо новий
            logger.info(f"[{request_id}] Оновлюємо дійсний токен для {user_id}")
            token_result = create_jwt_token(user_id)

            if not token_result:
                return jsonify({
                    "status": "error",
                    "message": "Помилка оновлення токена",
                    "request_id": request_id
                }), 500

            # Логування часу виконання
            execution_time = (datetime.now() - start_time_req).total_seconds()
            logger.info(f"[{request_id}] Успішно оновлено токен для {user_id} за {execution_time:.4f}с")

            return jsonify({
                "status": "success",
                "token": token_result["token"],
                "expires_at": token_result["expires_at"],
                "request_id": request_id
            })

        except Exception as e:
            # Детальне логування помилки
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

            # Декодуємо і валідуємо токен
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
        # Простий ендпоінт, який повертає інформацію про запит
        token = extract_token_from_request()
        user_id = extract_user_id_from_request()

        # Перевіряємо чи запит від Telegram
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