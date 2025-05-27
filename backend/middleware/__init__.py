"""
Middleware для WINIX API
"""

from functools import wraps
from flask import request, jsonify, g
import jwt
import os
from datetime import datetime, timezone

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
                return None

        return payload
    except jwt.InvalidTokenError:
        return None
    except Exception:
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
        return f(*args, **kwargs)

    return decorated_function


def auth_optional(f):
    """Декоратор для endpoint'ів з опціональною авторизацією"""

    @wraps(f)
    def decorated_function(*args, **kwargs):
        user = get_current_user()
        g.current_user = user  # Може бути None
        return f(*args, **kwargs)

    return decorated_function