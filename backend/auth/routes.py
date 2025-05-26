"""
Маршрути для автентифікації користувачів.
ВИПРАВЛЕНА ВЕРСІЯ з покращеною синхронізацією з frontend API
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
        logger.error("❌ КРИТИЧНА ПОМИЛКА: Не вдалося імпортувати auth controllers")
        raise ImportError("Auth controllers є обов'язковими для роботи системи")

# Константи
TOKEN_VALIDITY_DAYS = 7
REFRESH_TOKEN_VALIDITY_DAYS = 30
DEBUG_MODE = False  # Вимкнено для продакшн

# Збереження часу запуску для uptime
start_time = time.time()

# Regex для валідації параметрів
USER_ID_PATTERN = re.compile(r'^\d{1,12}$')
TOKEN_PATTERN = re.compile(r'^[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+\.[A-Za-z0-9\-_]+$')


def validate_user_id(user_id_str: str) -> bool:
    """
    Строга валідація user ID

    Args:
        user_id_str: ID для валідації

    Returns:
        bool: True якщо ID валідний
    """
    if not user_id_str:
        return False

    # Конвертуємо в строку та очищуємо
    user_id_str = str(user_id_str).strip()

    # Перевіряємо на заборонені значення
    forbidden_values = {'undefined', 'null', 'none', '0', ''}
    if user_id_str.lower() in forbidden_values:
        return False

    # Перевіряємо формат
    if not USER_ID_PATTERN.match(user_id_str):
        return False

    try:
        user_id = int(user_id_str)
        if user_id <= 0 or user_id > 999999999999:
            return False
        return True
    except (ValueError, OverflowError):
        return False


def validate_jwt_format(token_str: str) -> bool:
    """
    Валідація формату JWT токена

    Args:
        token_str: Токен для валідації

    Returns:
        bool: True якщо формат правильний
    """
    if not token_str:
        return False

    if token_str.startswith('Bearer '):
        token_str = token_str[7:]

    return TOKEN_PATTERN.match(token_str) is not None


def extract_token_from_request() -> str:
    """
    Отримує токен з різних джерел у запиті з валідацією

    Returns:
        str: Валідний токен або None
    """
    # 1. Authorization header
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        token = auth_header.split(" ")[1]
        if validate_jwt_format(token):
            return token
        logger.warning("Invalid JWT format in Authorization header")

    # 2. Request body
    data = request.get_json(silent=True) or {}
    if 'token' in data and data['token']:
        token = str(data['token'])
        if validate_jwt_format(token):
            return token
        logger.warning("Invalid JWT format in request body")

    return None


def extract_user_id_from_request() -> str:
    """
    Отримує Telegram ID користувача з різних джерел у запиті з СТРОГОЮ валідацією

    Returns:
        str: Валідний Telegram ID або None

    Raises:
        ValueError: Якщо ID невалідний
    """
    # 1. X-Telegram-User-Id header (пріоритет)
    header_id = request.headers.get('X-Telegram-User-Id')
    if header_id:
        if validate_user_id(header_id):
            return str(header_id).strip()
        else:
            raise ValueError(f"Невалідний Telegram ID в заголовку: {header_id}")

    # 2. Request body
    data = request.get_json(silent=True) or {}

    # Перевіряємо telegram_id
    if 'telegram_id' in data and data['telegram_id']:
        user_id = str(data['telegram_id']).strip()
        if validate_user_id(user_id):
            return user_id
        else:
            raise ValueError(f"Невалідний telegram_id в тілі запиту: {user_id}")

    # Перевіряємо id
    if 'id' in data and data['id']:
        user_id = str(data['id']).strip()
        if validate_user_id(user_id):
            return user_id
        else:
            raise ValueError(f"Невалідний id в тілі запиту: {user_id}")

    return None


def create_jwt_token(user_id: str, expiration_days: int = TOKEN_VALIDITY_DAYS, token_type: str = "access") -> dict:
    """
    Створює новий JWT токен з валідацією

    Args:
        user_id: ID користувача
        expiration_days: Кількість днів до закінчення терміну дії
        token_type: Тип токена

    Returns:
        dict: Словник з токеном та часом закінчення

    Raises:
        ValueError: При невалідному user_id
    """
    if not validate_user_id(user_id):
        raise ValueError(f"Невалідний user_id для створення токена: {user_id}")

    try:
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
        raise ValueError(f"Не вдалося створити токен: {e}")


def is_request_from_telegram(request_data: dict, headers: dict) -> bool:
    """
    ВИПРАВЛЕНА функція визначення чи запит прийшов від Telegram Mini App

    Args:
        request_data: Дані запиту
        headers: Заголовки запиту

    Returns:
        bool: True якщо запит від Telegram
    """
    # Перевіряємо initData
    if request_data.get('initData'):
        return True

    # Перевіряємо заголовок
    header_user_id = headers.get('X-Telegram-User-Id')
    if header_user_id and validate_user_id(header_user_id):
        return True

    # Перевіряємо User-Agent
    user_agent = headers.get('User-Agent', '')
    if 'Telegram' in user_agent or 'TelegramBot' in user_agent:
        return True

    # Перевіряємо прапорець
    if request_data.get('from_telegram'):
        return True

    # Перевіряємо комбінацію id + username/first_name (типово для Telegram)
    if (request_data.get('id') and validate_user_id(request_data.get('id')) and
        (request_data.get('username') or request_data.get('first_name'))):
        return True

    return False


def handle_error(message: str, error_code: str = 'general_error', status_code: int = 400, request_id: str = None) -> tuple:
    """
    Централізована обробка помилок

    Args:
        message: Повідомлення про помилку
        error_code: Код помилки
        status_code: HTTP статус код
        request_id: ID запиту

    Returns:
        tuple: (response, status_code)
    """
    error_response = {
        'status': 'error',
        'message': message,
        'code': error_code
    }

    if request_id:
        error_response['request_id'] = request_id

    return jsonify(error_response), status_code


def register_auth_routes(app):
    """Реєстрація маршрутів автентифікації"""

    # ========== PING ENDPOINTS ==========

    @app.route('/ping', methods=['GET'])
    def ultra_simple_ping():
        """Ультра простий ping без JSON"""
        return "pong"

    @app.route('/api/health', methods=['GET'])
    def enhanced_health():
        """Розширений health check"""
        try:
            health_data = {
                "status": "ok",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "service": "WINIX Backend",
                "version": "2.0.0",
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

    # ========== ОСНОВНІ AUTH ENDPOINTS ==========

    @app.route('/api/auth', methods=['POST'])
    def auth_user():
        """ВИПРАВЛЕНА автентифікація користувача через Telegram дані"""
        start_time_req = datetime.now()
        request_id = f"auth_{int(start_time_req.timestamp())}"

        try:
            data = request.json or {}
            client_ip = request.remote_addr

            logger.info(f"[{request_id}] Запит автентифікації від {client_ip}")

            # ВИПРАВЛЕНО: Встановлюємо прапорець Telegram якщо запит від Mini App
            if is_request_from_telegram(data, request.headers):
                data['from_telegram'] = True
                logger.info(f"[{request_id}] Запит ідентифіковано як Telegram Mini App")

            # ВИПРАВЛЕНО: Отримуємо user_id з СТРОГОЮ валідацією
            try:
                user_id = extract_user_id_from_request()
            except ValueError as e:
                logger.warning(f"[{request_id}] Валідаційна помилка: {str(e)}")
                return handle_error(str(e), 'validation_error', 400, request_id)

            if not user_id:
                logger.warning(f"[{request_id}] Відсутній Telegram ID у запиті")
                return handle_error(
                    'Telegram ID не надано. Додаток доступний тільки через Telegram.',
                    'missing_telegram_id',
                    400,
                    request_id
                )

            # Додаємо user_id до data
            data['id'] = user_id
            data['telegram_id'] = user_id

            # ВИПРАВЛЕНО: Отримуємо/верифікуємо користувача через controllers
            try:
                user = controllers.verify_user(data)
                logger.info(f"[{request_id}] Користувач верифікований")
            except ValueError as e:
                logger.error(f"[{request_id}] Валідаційна помилка: {str(e)}")
                return handle_error(str(e), 'validation_error', 400, request_id)
            except PermissionError as e:
                logger.error(f"[{request_id}] Помилка доступу: {str(e)}")
                return handle_error(str(e), 'permission_denied', 403, request_id)
            except ConnectionError as e:
                logger.error(f"[{request_id}] Помилка підключення: {str(e)}")
                return handle_error(
                    'Тимчасові проблеми з сервером. Спробуйте пізніше.',
                    'connection_error',
                    503,
                    request_id
                )

            # Створюємо JWT токен
            try:
                token_result = create_jwt_token(user.get('telegram_id'))
            except ValueError as e:
                logger.error(f"[{request_id}] Помилка створення токена: {str(e)}")
                return handle_error(
                    'Помилка створення токена автентифікації',
                    'token_creation_error',
                    500,
                    request_id
                )

            is_new_user = user.get('is_new_user', False)

            # ВИПРАВЛЕНО: Повертаємо формат очікуваний frontend
            response = {
                'status': 'success',
                'token': token_result['token'],
                'expires_at': token_result['expires_at'],
                'data': {
                    'telegram_id': user.get('telegram_id'),
                    'username': user.get('username'),
                    'balance': float(user.get('balance', 0)),
                    'coins': int(user.get('coins', 0)),
                    'is_new_user': is_new_user,
                    'is_active': user.get('is_active', True),
                    'created_at': user.get('created_at'),
                    'last_login': user.get('last_login')
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

            return handle_error(
                f"Внутрішня помилка сервера: {str(e) if DEBUG_MODE else 'Зверніться до адміністратора'}",
                'internal_error',
                500,
                request_id
            )

    @app.route('/api/auth/refresh-token', methods=['POST'])
    def refresh_token():
        """ВИПРАВЛЕНА функція оновлення JWT токену автентифікації"""
        start_time_req = datetime.now()
        request_id = f"refresh_{int(start_time_req.timestamp())}"

        try:
            client_ip = request.remote_addr
            logger.info(f"[{request_id}] Запит оновлення токена від {client_ip}")

            # ВИПРАВЛЕНО: М'якша валідація для refresh token
            user_id = None

            # Спочатку пробуємо отримати з заголовка
            header_id = request.headers.get('X-Telegram-User-Id')
            if header_id and validate_user_id(header_id):
                user_id = str(header_id).strip()
                logger.info(f"[{request_id}] ID отримано з заголовка: {user_id}")

            # Якщо немає в заголовку, пробуємо з тіла запиту
            if not user_id:
                try:
                    data = request.get_json(silent=True) or {}

                    if 'telegram_id' in data and validate_user_id(data['telegram_id']):
                        user_id = str(data['telegram_id']).strip()
                        logger.info(f"[{request_id}] ID отримано з тіла запиту: {user_id}")
                    elif 'id' in data and validate_user_id(data['id']):
                        user_id = str(data['id']).strip()
                        logger.info(f"[{request_id}] ID отримано з поля id: {user_id}")

                except Exception as e:
                    logger.warning(f"[{request_id}] Помилка парсингу JSON: {str(e)}")

            if not user_id:
                logger.warning(f"[{request_id}] ID користувача не знайдено у запиті")
                return handle_error(
                    "ID користувача не знайдено. Потрібна повторна авторизація.",
                    'missing_user_id',
                    400,
                    request_id
                )

            logger.info(f"[{request_id}] Обробка оновлення токена для користувача {user_id}")

            # ВИПРАВЛЕНО: Перевіряємо існування користувача з м'якшою обробкою помилок
            try:
                user = controllers.get_user_data(user_id)
                if not user:
                    logger.warning(f"[{request_id}] Користувач {user_id} не знайдений в БД")
                    return handle_error(
                        "Користувач не знайдений. Потрібна повторна авторизація.",
                        'user_not_found',
                        400,  # 400 замість 404 для trigger повної авторизації
                        request_id
                    )
                else:
                    logger.info(f"[{request_id}] Користувач {user_id} підтверджений")

            except (ValueError, ConnectionError) as e:
                logger.error(f"[{request_id}] Помилка перевірки користувача: {str(e)}")
                return handle_error(
                    'Помилка перевірки користувача. Потрібна повторна авторизація.',
                    'user_verification_error',
                    400,  # 400 для trigger повної авторизації
                    request_id
                )

            # ВИПРАВЛЕНО: Перевіряємо поточний токен з кращою обробкою
            current_token = extract_token_from_request()
            token_valid = False

            if current_token:
                try:
                    payload = jwt.decode(current_token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
                    token_user_id = payload.get("user_id")

                    if token_user_id == user_id:
                        token_valid = True
                        logger.info(f"[{request_id}] Поточний токен валідний для користувача {user_id}")
                    else:
                        logger.warning(f"[{request_id}] ID в токені ({token_user_id}) не відповідає запитаному ID ({user_id})")

                except jwt.ExpiredSignatureError:
                    logger.info(f"[{request_id}] Токен протерміновано для {user_id}, створюємо новий")
                except jwt.InvalidTokenError as e:
                    logger.info(f"[{request_id}] Невалідний токен для {user_id}: {str(e)}")
                except Exception as e:
                    logger.warning(f"[{request_id}] Помилка декодування токену: {str(e)}")
            else:
                logger.info(f"[{request_id}] Токен відсутній, створюємо новий для {user_id}")

            # ВИПРАВЛЕНО: Створюємо новий токен незалежно від валідності старого
            try:
                token_result = create_jwt_token(user_id)

                # Оновлюємо last_login
                try:
                    controllers.update_user_data(user_id, {
                        "last_login": datetime.now(timezone.utc).isoformat()
                    })
                except Exception as e:
                    logger.warning(f"[{request_id}] Не вдалося оновити last_login: {str(e)}")

            except ValueError as e:
                logger.error(f"[{request_id}] Не вдалося створити токен для {user_id}: {str(e)}")
                return handle_error(
                    "Помилка створення токена. Спробуйте перезапустити додаток.",
                    'token_creation_error',
                    500,
                    request_id
                )

            execution_time = (datetime.now() - start_time_req).total_seconds()
            logger.info(f"[{request_id}] Успішно створено новий токен для {user_id} за {execution_time:.4f}с")

            return jsonify({
                "status": "success",
                "token": token_result["token"],
                "expires_at": token_result["expires_at"],
                "user_id": user_id,
                "message": "Токен успішно оновлено",
                "request_id": request_id
            })

        except Exception as e:
            logger.error(f"[{request_id}] Критична помилка в refresh_token: {str(e)}")
            if DEBUG_MODE:
                logger.error(traceback.format_exc())

            return handle_error(
                "Внутрішня помилка сервера. Спробуйте перезапустити додаток.",
                'internal_error',
                500,
                request_id
            )

    @app.route('/api/auth/validate', methods=['POST'])
    def validate_auth():
        """ВИПРАВЛЕНА валідація токена автентифікації"""
        try:
            token = extract_token_from_request()
            if not token:
                return handle_error("Токен не надано", 'missing_token', 400)

            try:
                payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            except jwt.ExpiredSignatureError:
                return handle_error("Токен протерміновано", 'token_expired', 401)
            except jwt.InvalidTokenError:
                return handle_error("Невалідний токен", 'invalid_token', 401)

            user_id = payload.get("user_id")
            if not validate_user_id(user_id):
                return handle_error("Невалідний user_id в токені", 'invalid_user_id', 400)

            return jsonify({
                "status": "success",
                "valid": True,
                "user_id": user_id,
                "expires_at": payload.get("exp"),
                "token_type": payload.get("type", "access")
            })

        except Exception as e:
            logger.error(f"Token validation error: {str(e)}")
            return handle_error(
                "Помилка валідації токена",
                'validation_error',
                500
            )

    # ========== ТЕСТОВІ ENDPOINTS ==========

    @app.route('/api/auth/test', methods=['GET'])
    def auth_test():
        """Тестовий ендпоінт для перевірки роботи автентифікації"""
        token = extract_token_from_request()

        try:
            user_id = extract_user_id_from_request()
        except ValueError as e:
            user_id = f"VALIDATION_ERROR: {str(e)}"

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