"""
Middleware для WINIX API
"""

from functools import wraps
from flask import request, jsonify, g
import jwt
import os
from datetime import datetime, timezone
import logging

logger = logging.getLogger(__name__)

JWT_SECRET = os.getenv('JWT_SECRET', 'your-secret-key')
JWT_ALGORITHM = os.getenv('JWT_ALGORITHM', 'HS256')


def get_current_user():
    """Отримати поточного користувача з токена"""
    auth_header = request.headers.get('Authorization')

    if not auth_header or not auth_header.startswith('Bearer '):
        return None

    try:
        token = auth_header[7:]  # Видаляємо 'Bearer '
        payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])

        # Перевіряємо термін дії
        if 'exp' in payload:
            exp_timestamp = payload['exp']
            if datetime.now(timezone.utc).timestamp() > exp_timestamp:
                logger.warning("Token expired")
                return None

        # ВАЖЛИВО: Додаємо telegram_id до payload для сумісності
        if 'user_id' in payload and 'telegram_id' not in payload:
            payload['telegram_id'] = payload['user_id']

        # Логування для діагностики
        logger.debug(f"Decoded JWT payload: user_id={payload.get('user_id')}, telegram_id={payload.get('telegram_id')}")

        return payload
    except jwt.ExpiredSignatureError:
        logger.warning("JWT token expired")
        return None
    except jwt.InvalidTokenError as e:
        logger.warning(f"Invalid JWT token: {str(e)}")
        return None
    except Exception as e:
        logger.error(f"Error decoding JWT: {str(e)}")
        return None


def auth_required(f):
    """Декоратор для захищених endpoint'ів"""

    @wraps(f)
    def decorated_function(*args, **kwargs):
        user = get_current_user()

        if not user:
            return jsonify({
                'status': 'error',
                'message': 'Авторизація обов\'язкова',
                'code': 'auth_required'
            }), 401

        # Зберігаємо користувача в g для використання в endpoint'і
        g.current_user = user

        # Додаємо telegram_id до g для зручності
        g.telegram_id = user.get('telegram_id') or user.get('user_id')

        logger.info(f"Authorized request from user: {g.telegram_id}")

        return f(*args, **kwargs)

    return decorated_function


def auth_optional(f):
    """Декоратор для endpoint'ів з опціональною авторизацією"""

    @wraps(f)
    def decorated_function(*args, **kwargs):
        user = get_current_user()
        g.current_user = user  # Може бути None

        if user:
            g.telegram_id = user.get('telegram_id') or user.get('user_id')
            logger.debug(f"Optional auth: user {g.telegram_id}")
        else:
            g.telegram_id = None
            logger.debug("Optional auth: no user")

        return f(*args, **kwargs)

    return decorated_function


def extract_telegram_id():
    """Допоміжна функція для витягування telegram_id з різних джерел"""
    # 1. З JWT токена
    if hasattr(g, 'current_user') and g.current_user:
        return g.current_user.get('telegram_id') or g.current_user.get('user_id')

    # 2. З заголовка X-Telegram-User-Id
    header_id = request.headers.get('X-Telegram-User-Id')
    if header_id:
        return str(header_id).strip()

    # 3. З body запиту
    if request.is_json:
        data = request.get_json() or {}
        if data.get('telegram_id'):
            return str(data.get('telegram_id')).strip()
        if data.get('id'):
            return str(data.get('id')).strip()

    # 4. З URL параметрів
    if request.view_args:
        if 'telegram_id' in request.view_args:
            return str(request.view_args['telegram_id']).strip()
        if 'user_id' in request.view_args:
            return str(request.view_args['user_id']).strip()

    return None