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

# JWT конфігурація
JWT_SECRET = os.getenv('JWT_SECRET', 'your-secret-key')
JWT_ALGORITHM = os.getenv('JWT_ALGORITHM', 'HS256')
JWT_EXPIRATION = int(os.getenv('JWT_EXPIRATION', '86400'))  # 24 години

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
            parsed_data = urllib.parse.parse_qs(init_data)

            # Отримуємо hash
            received_hash = parsed_data.get('hash', [None])[0]
            if not received_hash:
                return False

            # Створюємо рядок для перевірки
            auth_items = []
            for key, value in parsed_data.items():
                if key != 'hash':
                    auth_items.append(f"{key}={value[0]}")

            auth_string = '\n'.join(sorted(auth_items))

            # Створюємо секретний ключ
            secret_key = hmac.new(
                "WebAppData".encode(),
                bot_token.encode(),
                hashlib.sha256
            ).digest()

            # Обчислюємо hash
            calculated_hash = hmac.new(
                secret_key,
                auth_string.encode(),
                hashlib.sha256
            ).hexdigest()

            return hmac.compare_digest(received_hash, calculated_hash)

        except Exception as e:
            logger.error(f"Помилка перевірки Telegram data: {str(e)}")
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
            payload = {
                'user_id': str(user_data.get('telegram_id', user_data.get('id'))),
                'username': user_data.get('username', ''),
                'first_name': user_data.get('first_name', ''),
                'last_name': user_data.get('last_name', ''),
                'exp': datetime.now(timezone.utc) + timedelta(seconds=JWT_EXPIRATION),
                'iat': datetime.now(timezone.utc),
                'type': 'access'
            }

            return jwt.encode(payload, JWT_SECRET, algorithm=JWT_ALGORITHM)

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
            # Перевірка initData якщо є
            init_data = telegram_data.get('initData')
            bot_token = os.getenv('TELEGRAM_BOT_TOKEN')

            if init_data and bot_token:
                # Валідація підпису
                if not TelegramAuthController.verify_telegram_webapp_data(init_data, bot_token):
                    return {
                        'success': False,
                        'error': 'Невалідний підпис Telegram',
                        'code': 'invalid_signature'
                    }

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
            user_id = payload.get('user_id')

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

# Оновити експорт
__all__ = [
    'TelegramAuthController',
    'AuthController',
    'AuthError',
    'require_auth',
    'validate_telegram_route',
    'refresh_token_route'  # Додати це
]
