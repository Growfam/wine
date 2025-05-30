"""
Єдиний контролер авторизації для WINIX
Оптимізований для Telegram Mini App з повним функціоналом
"""

import logging
import os
import jwt
import hmac
import hashlib
import urllib.parse
import json
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional
from flask import request, jsonify

# Налаштування
logger = logging.getLogger(__name__)

# JWT конфігурація - СИНХРОНІЗОВАНА
JWT_SECRET = os.getenv('JWT_SECRET', 'winix-secure-jwt-secret-key-2025')
JWT_ALGORITHM = os.getenv('JWT_ALGORITHM', 'HS256')
JWT_EXPIRATION = int(os.getenv('JWT_EXPIRATION', '86400'))  # 24 години

# Перевірка наявності секретного ключа
if JWT_SECRET == 'your-secret-key':
    logger.warning("⚠️ JWT_SECRET використовує дефолтне значення! Встановіть JWT_SECRET в .env")

logger.info(f"JWT Config loaded: Algorithm={JWT_ALGORITHM}, Expiration={JWT_EXPIRATION}s")

# Імпорт функцій БД
try:
    from backend.supabase_client import get_user, create_user, update_user
except ImportError:
    from supabase_client import get_user, create_user, update_user


class TelegramAuthController:
    """Єдиний контролер авторизації для Telegram Mini App"""

    @staticmethod
    def verify_telegram_webapp_data(init_data: str, bot_token: str) -> bool:
        """Перевірка автентичності даних від Telegram WebApp"""
        try:
            logger.info(f"verify_telegram_webapp_data: Початок перевірки")

            # НОВЕ: Логуємо точний формат даних
            logger.info(f"init_data перші 100 символів: {init_data[:100]}")
            logger.info(f"Має %20: {'%20' in init_data}")
            logger.info(f"Має +: {'+' in init_data}")

            parsed_data = urllib.parse.parse_qs(init_data)
            logger.info(f"Parsed data keys: {list(parsed_data.keys())}")

            # НОВЕ: Логуємо точні значення
            for key in ['query_id', 'auth_date', 'hash']:
                if key in parsed_data:
                    value = parsed_data[key][0]
                    if key == 'hash':
                        logger.info(f"{key}: {value[:10]}...{value[-10:]}")
                    else:
                        logger.info(f"{key}: {value}")

            received_hash = parsed_data.get('hash', [None])[0]
            if not received_hash:
                logger.error("Hash відсутній")
                return False

            # Створюємо data-check-string
            data_check_items = []
            for key, values in sorted(parsed_data.items()):
                if key != 'hash':
                    value = values[0] if values else ''
                    data_check_items.append(f"{key}={value}")

            data_check_string = '\n'.join(data_check_items)

            # НОВЕ: Логуємо точну структуру data_check_string
            logger.info(f"Data check string має {len(data_check_items)} елементів")
            logger.info(f"Ключі в порядку: {[item.split('=')[0] for item in data_check_items]}")

            # Обчислюємо hash
            secret_key = hmac.new(
                "WebAppData".encode('utf-8'),
                bot_token.encode('utf-8'),
                hashlib.sha256
            ).digest()

            calculated_hash = hmac.new(
                secret_key,
                data_check_string.encode('utf-8'),
                hashlib.sha256
            ).hexdigest()

            # НОВЕ: Детальне порівняння
            logger.info(f"Received hash: {received_hash}")
            logger.info(f"Calculated hash: {calculated_hash}")

            is_valid = hmac.compare_digest(received_hash, calculated_hash)

            if not is_valid:
                # НОВЕ: Спробуємо альтернативний спосіб
                logger.info("Спроба альтернативного методу...")

                # Можливо signature замість hash?
                if 'signature' in parsed_data:
                    logger.info("Знайдено signature, але очікувався hash")

            return is_valid

        except Exception as e:
            logger.error(f"Помилка перевірки: {str(e)}", exc_info=True)
            return False

    @staticmethod
    def extract_user_from_webapp_data(init_data: str) -> Optional[Dict[str, Any]]:
        """Витягує дані користувача з init_data"""
        try:
            parsed_data = urllib.parse.parse_qs(init_data)
            user_data = parsed_data.get('user', [None])[0]

            if user_data:
                user_info = json.loads(user_data)
                return {
                    'id': user_info.get('id'),
                    'username': user_info.get('username'),
                    'first_name': user_info.get('first_name'),
                    'last_name': user_info.get('last_name'),
                    'language_code': user_info.get('language_code', 'uk')
                }

        except Exception as e:
            logger.error(f"Помилка витягування користувача: {str(e)}")

        return None

    @staticmethod
    def generate_jwt_token(user_data: Dict[str, Any]) -> str:
        """Генерація JWT токена"""
        try:
            # Отримуємо telegram_id
            telegram_id = str(user_data.get('telegram_id', user_data.get('id')))

            payload = {
                'telegram_id': telegram_id,  # ВАЖЛИВО: додаємо це поле
                'user_id': telegram_id,      # для сумісності
                'username': user_data.get('username', ''),
                'first_name': user_data.get('first_name', ''),
                'last_name': user_data.get('last_name', ''),
                'exp': datetime.now(timezone.utc) + timedelta(seconds=JWT_EXPIRATION),
                'iat': datetime.now(timezone.utc),
                'type': 'access'
            }

            token = jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)
            logger.info(f"Generated JWT token for user {telegram_id}")
            return token

        except Exception as e:
            logger.error(f"Помилка генерації токена: {str(e)}")
            return None

    @staticmethod
    def decode_jwt_token(token: str) -> Dict[str, Any]:
        """Декодування JWT токена"""
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            return payload
        except jwt.ExpiredSignatureError:
            raise AuthError("Токен протерміновано", "token_expired")
        except jwt.InvalidTokenError:
            raise AuthError("Невірний токен", "invalid_token")

    @staticmethod
    def authenticate_telegram_user(telegram_data: Dict[str, Any]) -> Dict[str, Any]:
        """Основна функція авторизації через Telegram"""
        try:
            logger.info("🔍 === ПОЧАТОК АВТОРИЗАЦІЇ ===")
            logger.info(f"Отримані дані: {list(telegram_data.keys())}")
            logger.info(f"ENV змінні:")
            logger.info(
                f"  SKIP_TELEGRAM_SIGNATURE_CHECK = {os.getenv('SKIP_TELEGRAM_SIGNATURE_CHECK', 'не встановлено')}")
            logger.info(f"  ALLOW_INVALID_SIGNATURE = {os.getenv('ALLOW_INVALID_SIGNATURE', 'не встановлено')}")
            logger.info(f"  ALLOW_AUTH_WITHOUT_INITDATA = {os.getenv('ALLOW_AUTH_WITHOUT_INITDATA', 'не встановлено')}")

            # Перевірка initData якщо є
            init_data = telegram_data.get('initData')
            bot_token = os.getenv('TELEGRAM_BOT_TOKEN')

            logger.info(f"=== ДІАГНОСТИКА АВТОРИЗАЦІЇ ===")
            logger.info(f"init_data присутній: {'Так' if init_data else 'Ні'}")
            logger.info(f"bot_token присутній: {'Так' if bot_token else 'Ні'}")
            if init_data:
                logger.info(f"Довжина init_data: {len(init_data)}")
                logger.info(f"init_data (перші 100 символів): {init_data[:100]}...")

            # КРИТИЧНО: Перевіряємо наявність initData для продакшену
            if not init_data:
                # Якщо є telegram_id без initData - дозволяємо для development
                if os.getenv('ENVIRONMENT', 'development') == 'development' and telegram_data.get('id'):
                    logger.warning(f"⚠️ Development mode: дозволяємо авторизацію без initData")
                else:
                    logger.error(f"❌ initData відсутній для користувача {telegram_data.get('id')}")
                    return {
                        'success': False,
                        'error': 'Відсутні дані авторизації Telegram',
                        'code': 'missing_init_data'
                    }

            if not bot_token:
                logger.error("❌ TELEGRAM_BOT_TOKEN не налаштований")
                return {
                    'success': False,
                    'error': 'Сервер неправильно налаштований',
                    'code': 'missing_bot_token'
                }

            # МОЖЛИВІСТЬ ПРОПУСТИТИ ПЕРЕВІРКУ ПІДПИСУ
            SKIP_SIGNATURE_CHECK = os.getenv('SKIP_TELEGRAM_SIGNATURE_CHECK', 'false').lower() == 'true'

            if init_data and bot_token and not SKIP_SIGNATURE_CHECK:
                # Валідація підпису
                if not TelegramAuthController.verify_telegram_webapp_data(init_data, bot_token):
                    logger.warning(f"⚠️ Невалідний підпис для користувача")

                    # МОЖЛИВІСТЬ ПРОДОВЖИТИ З НЕВАЛІДНИМ ПІДПИСОМ
                    if not os.getenv('ALLOW_INVALID_SIGNATURE', 'false').lower() == 'true':
                        return {
                            'success': False,
                            'error': 'Невалідний підпис Telegram',
                            'code': 'invalid_signature'
                        }
                    else:
                        logger.warning("⚠️ Продовжуємо з невалідним підписом (ALLOW_INVALID_SIGNATURE=true)")

                # Витягуємо дані користувача
                webapp_user = TelegramAuthController.extract_user_from_webapp_data(init_data)
                if webapp_user:
                    telegram_data.update(webapp_user)

            # Отримуємо ID користувача
            telegram_id = str(telegram_data.get('id', telegram_data.get('telegram_id', '')))
            if not telegram_id or not telegram_id.isdigit():
                return {
                    'success': False,
                    'error': 'Невалідний Telegram ID',
                    'code': 'invalid_telegram_id'
                }

            # Отримуємо або створюємо користувача
            user = get_user(telegram_id)
            is_new_user = False

            if not user:
                # Створюємо нового користувача
                username = telegram_data.get('username', '')
                first_name = telegram_data.get('first_name', '')
                display_name = username or first_name or f"User_{telegram_id[-4:]}"
                referrer_id = telegram_data.get('referrer_id')

                user = create_user(telegram_id, display_name, referrer_id)
                is_new_user = True

                if not user:
                    return {
                        'success': False,
                        'error': 'Не вдалося створити користувача',
                        'code': 'user_creation_failed'
                    }

            # Оновлюємо дані користувача
            updates = {
                'last_login': datetime.now(timezone.utc).isoformat(),
                'last_activity': datetime.now(timezone.utc).isoformat()
            }

            # Оновлюємо username якщо змінився
            if telegram_data.get('username') and telegram_data.get('username') != user.get('username'):
                updates['username'] = telegram_data.get('username')

            # Оновлюємо мову
            if telegram_data.get('language_code'):
                updates['language_preference'] = telegram_data.get('language_code')

            update_user(telegram_id, updates)

            # Генеруємо JWT токен
            token = TelegramAuthController.generate_jwt_token({
                'telegram_id': telegram_id,
                'username': user.get('username', ''),
                'first_name': user.get('first_name', ''),
                'last_name': user.get('last_name', '')
            })

            if not token:
                return {
                    'success': False,
                    'error': 'Помилка генерації токена',
                    'code': 'token_generation_failed'
                }

            return {
                'success': True,
                'token': token,
                'expires_in': JWT_EXPIRATION,
                'user': {
                    'telegram_id': telegram_id,
                    'username': user.get('username', ''),
                    'balance': float(user.get('balance', 0)),
                    'coins': int(user.get('coins', 0)),
                    'level': int(user.get('level', 1)),
                    'is_new_user': is_new_user
                }
            }

        except Exception as e:
            logger.error(f"Помилка авторизації: {str(e)}", exc_info=True)
            return {
                'success': False,
                'error': 'Внутрішня помилка сервера',
                'code': 'internal_error'
            }

    @staticmethod
    def refresh_token(telegram_id: str = None) -> Dict[str, Any]:
        """Оновлення JWT токена з підтримкою передачі telegram_id"""
        try:
            # Якщо telegram_id не переданий, спробуємо отримати з request
            if not telegram_id:
                from flask import request
                from middleware import extract_telegram_id

                telegram_id = extract_telegram_id()

            if not telegram_id:
                logger.error("refresh_token: telegram_id відсутній")
                return {
                    'success': False,
                    'error': 'User ID відсутній',
                    'code': 'missing_user_id'
                }

            # Нормалізуємо telegram_id
            telegram_id = str(telegram_id).strip()

            logger.info(f"refresh_token: Оновлення токену для користувача {telegram_id}")

            # Перевіряємо існування користувача
            user = get_user(telegram_id)
            if not user:
                logger.error(f"refresh_token: Користувач {telegram_id} не знайдений")
                return {
                    'success': False,
                    'error': 'Користувач не знайдений',
                    'code': 'user_not_found'
                }

            # Генеруємо новий токен
            new_token = TelegramAuthController.generate_jwt_token({
                'telegram_id': telegram_id,
                'username': user.get('username', ''),
                'first_name': user.get('first_name', ''),
                'last_name': user.get('last_name', '')
            })

            if not new_token:
                return {
                    'success': False,
                    'error': 'Помилка генерації токена',
                    'code': 'token_generation_failed'
                }

            # Оновлюємо last_activity
            update_user(telegram_id, {
                'last_activity': datetime.now(timezone.utc).isoformat()
            })

            return {
                'success': True,
                'status': 'success',
                'token': new_token,
                'expires_in': JWT_EXPIRATION,
                'user': {
                    'telegram_id': telegram_id,
                    'username': user.get('username', ''),
                    'balance': float(user.get('balance', 0)),
                    'coins': int(user.get('coins', 0))
                }
            }

        except Exception as e:
            logger.error(f"refresh_token: Критична помилка: {str(e)}", exc_info=True)
            return {
                'success': False,
                'status': 'error',
                'error': 'Помилка оновлення токена',
                'code': 'refresh_failed'
            }

    @staticmethod
    def validate_token(token: str) -> Dict[str, Any]:
        """Валідація JWT токена"""
        try:
            payload = TelegramAuthController.decode_jwt_token(token)
            user_id = payload.get('user_id') or payload.get('telegram_id')

            # Перевіряємо користувача
            user = get_user(user_id)
            if not user:
                return {
                    'valid': False,
                    'error': 'Користувач не знайдений',
                    'code': 'user_not_found'
                }

            return {
                'valid': True,
                'user': {
                    'telegram_id': user_id,
                    'username': payload.get('username'),
                    'exp': payload.get('exp'),
                    'iat': payload.get('iat')
                }
            }

        except AuthError as e:
            return {
                'valid': False,
                'error': e.message,
                'code': e.code
            }
        except Exception as e:
            logger.error(f"Помилка валідації токена: {str(e)}")
            return {
                'valid': False,
                'error': 'Помилка валідації',
                'code': 'validation_error'
            }


class AuthError(Exception):
    """Клас для помилок авторизації"""

    def __init__(self, message: str, code: str):
        self.message = message
        self.code = code
        super().__init__(self.message)


# Декоратор для перевірки авторизації
def require_auth(f):
    """Декоратор для захисту endpoints"""

    def decorated_function(*args, **kwargs):
        # Отримуємо токен
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header[7:]
        else:
            return jsonify({
                'status': 'error',
                'message': 'Авторизація обов\'язкова',
                'code': 'auth_required'
            }), 401

        # Валідуємо токен
        result = TelegramAuthController.validate_token(token)
        if not result.get('valid'):
            return jsonify({
                'status': 'error',
                'message': result.get('error', 'Невірний токен'),
                'code': result.get('code', 'invalid_token')
            }), 401

        # Додаємо дані користувача в request
        request.current_user = result.get('user')

        return f(*args, **kwargs)

    decorated_function.__name__ = f.__name__
    return decorated_function

# Alias для сумісності з системою завдань
AuthController = TelegramAuthController


def validate_telegram_route(telegram_data):
    """
    Функція валідації для сумісності з системою завдань
    """
    try:
        # Використовуємо існуючу логіку
        result = TelegramAuthController.authenticate_telegram_user(telegram_data)

        if result.get('success'):
            return {
                'valid': True,
                'user': result.get('user'),
                'token': result.get('token')
            }
        else:
            return {
                'valid': False,
                'error': result.get('error', 'Validation failed'),
                'code': result.get('code', 'validation_failed')
            }
    except Exception as e:
        logger.error(f"Validation error: {str(e)}")
        return {
            'valid': False,
            'error': str(e),
            'code': 'validation_error'
        }


def refresh_token_route(telegram_id=None):
    """
    Функція оновлення токену для сумісності з системою завдань
    """
    try:
        result = TelegramAuthController.refresh_token(telegram_id)
        return result
    except Exception as e:
        logger.error(f"Refresh token error: {str(e)}")
        return {
            'success': False,
            'error': str(e),
            'code': 'refresh_failed'
        }


def validate_token_route(token: str = None):
    """
    Функція валідації токену для сумісності з системою завдань
    """
    try:
        # Якщо токен не переданий, спробуємо отримати з request
        if not token:
            from flask import request

            # Отримуємо токен з заголовка
            auth_header = request.headers.get('Authorization')
            if auth_header and auth_header.startswith('Bearer '):
                token = auth_header[7:]
            else:
                # Або з body
                data = request.get_json() or {}
                token = data.get('token')

        if not token:
            return {
                'valid': False,
                'error': 'Token not provided',
                'code': 'missing_token'
            }

        # Використовуємо існуючий метод validate_token
        result = TelegramAuthController.validate_token(token)
        return result

    except Exception as e:
        logger.error(f"Validate token route error: {str(e)}")
        return {
            'valid': False,
            'error': str(e),
            'code': 'validation_error'
        }
# Оновити експорт
__all__ = [
    'TelegramAuthController',
    'AuthController',
    'AuthError',
    'require_auth',
    'validate_telegram_route',
    'refresh_token_route',
    'validate_token_route'
]