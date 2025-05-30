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

# JWT налаштування - СИНХРОНІЗОВАНІ
JWT_SECRET = os.getenv('JWT_SECRET', 'winix-secure-jwt-secret-key-2025')
JWT_ALGORITHM = os.getenv('JWT_ALGORITHM', 'HS256')

# Перевірка наявності секретного ключа
if JWT_SECRET == 'your-secret-key':
    logger.warning("⚠️ JWT_SECRET використовує дефолтне значення! Встановіть JWT_SECRET в .env")

logger.info(f"Middleware JWT Config: Algorithm={JWT_ALGORITHM}")


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
    """Допоміжна функція для витягування telegram_id з різних джерел - ВИПРАВЛЕНА ВЕРСІЯ"""
    # 1. З JWT токена (найвищий пріоритет)
    if hasattr(g, 'current_user') and g.current_user:
        telegram_id = g.current_user.get('telegram_id') or g.current_user.get('user_id')
        if telegram_id:
            logger.debug(f"extract_telegram_id: Found in g.current_user: {telegram_id}")
            return str(telegram_id).strip()

    # 2. Спробуємо декодувати токен без перевірки терміну
    auth_header = request.headers.get('Authorization')
    if auth_header and auth_header.startswith('Bearer '):
        try:
            token = auth_header[7:]
            # Декодуємо без перевірки терміну для refresh endpoint
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM], options={"verify_exp": False})
            telegram_id = payload.get('telegram_id') or payload.get('user_id')
            if telegram_id:
                logger.debug(f"extract_telegram_id: Found in decoded token: {telegram_id}")
                return str(telegram_id).strip()
        except Exception as e:
            logger.debug(f"extract_telegram_id: Token decode failed: {e}")

    # 3. З заголовка X-Telegram-User-Id
    header_id = request.headers.get('X-Telegram-User-Id')
    if header_id:
        logger.debug(f"extract_telegram_id: Found in header: {header_id}")
        return str(header_id).strip()

    # 4. З body запиту
    if request.is_json:
        try:
            data = request.get_json() or {}
            telegram_id = data.get('telegram_id') or data.get('id') or data.get('user_id')
            if telegram_id:
                logger.debug(f"extract_telegram_id: Found in body: {telegram_id}")
                return str(telegram_id).strip()
        except Exception as e:
            logger.debug(f"extract_telegram_id: JSON parse error: {e}")

    # 5. З URL параметрів
    if request.view_args:
        telegram_id = (request.view_args.get('telegram_id') or
                      request.view_args.get('user_id'))
        if telegram_id:
            logger.debug(f"extract_telegram_id: Found in URL args: {telegram_id}")
            return str(telegram_id).strip()

    # 6. З query параметрів
    telegram_id = request.args.get('telegram_id') or request.args.get('user_id')
    if telegram_id:
        logger.debug(f"extract_telegram_id: Found in query params: {telegram_id}")
        return str(telegram_id).strip()

    logger.debug("extract_telegram_id: Not found in any source")
    return None


# Експорт усіх необхідних об'єктів
__all__ = [
    'get_current_user',
    'auth_required',
    'auth_optional',
    'extract_telegram_id',
    'JWT_SECRET',
    'JWT_ALGORITHM'
]