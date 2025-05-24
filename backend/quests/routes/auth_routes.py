"""
Маршрути авторизації для системи завдань WINIX
"""

import logging
from flask import Blueprint, request, jsonify
from datetime import datetime, timezone

from ..controllers.auth_controller import (
    validate_telegram_route,
    refresh_token_route,
    validate_token_route
)
from ..utils.decorators import (
    public_endpoint,
    validate_json
)

logger = logging.getLogger(__name__)

# Створюємо Blueprint для auth маршрутів
auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')


@auth_bp.route('/validate-telegram', methods=['POST'])
@public_endpoint(max_requests=5, window_seconds=60)  # Обмежений rate limit для валідації
@validate_json(required_fields=['initData'])
def validate_telegram():
    """
    Валідація Telegram WebApp даних

    POST /api/auth/validate-telegram

    Body:
    {
        "initData": "string",  # обов'язково
        "timestamp": number    # опціонально
    }

    Response:
    {
        "valid": boolean,
        "user": {
            "id": number,
            "telegram_id": number,
            "username": string,
            "first_name": string,
            "last_name": string,
            "language_code": string,
            "balance": {
                "winix": number,
                "tickets": number,
                "flex": number
            }
        },
        "token": string,
        "expires_in": number
    }
    """
    logger.info("=== POST /api/auth/validate-telegram ===")
    return validate_telegram_route()


@auth_bp.route('/refresh-token', methods=['POST'])
@public_endpoint(max_requests=10, window_seconds=60)
def refresh_token():
    """
    Оновлення JWT токену

    POST /api/auth/refresh-token

    Headers:
        Authorization: Bearer <token>
    або
    Body:
    {
        "token": "string"
    }

    Response:
    {
        "success": boolean,
        "token": string,
        "expires_in": number,
        "user": {
            "telegram_id": number,
            "username": string
        }
    }
    """
    logger.info("=== POST /api/auth/refresh-token ===")
    return refresh_token_route()


@auth_bp.route('/validate-token', methods=['POST'])
@public_endpoint(max_requests=20, window_seconds=60)
def validate_token():
    """
    Валідація JWT токену

    POST /api/auth/validate-token

    Headers:
        Authorization: Bearer <token>
    або
    Body:
    {
        "token": "string"
    }

    Response:
    {
        "valid": boolean,
        "user": {
            "telegram_id": number,
            "username": string,
            "token_exp": number,
            "token_iat": number
        }
    }
    """
    logger.info("=== POST /api/auth/validate-token ===")
    return validate_token_route()


@auth_bp.route('/logout', methods=['POST'])
@public_endpoint(max_requests=10, window_seconds=60)
def logout():
    """
    Вихід користувача

    POST /api/auth/logout

    Headers:
        Authorization: Bearer <token>

    Response:
    {
        "success": boolean,
        "message": string
    }
    """
    logger.info("=== POST /api/auth/logout ===")

    try:
        from ..controllers.auth_controller import AuthController

        # Отримуємо токен
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header[7:]
        else:
            data = request.get_json() or {}
            token = data.get('token')

        if not token:
            return jsonify({
                "success": False,
                "error": "Токен відсутній",
                "code": "missing_token"
            }), 400

        result = AuthController.logout_user(token)

        if result.get('success'):
            return jsonify(result), 200
        else:
            return jsonify(result), 400

    except Exception as e:
        logger.error(f"Помилка в logout: {e}", exc_info=True)
        return jsonify({
            "success": False,
            "error": "Внутрішня помилка сервера",
            "code": "internal_error"
        }), 500


@auth_bp.route('/status', methods=['GET'])
@public_endpoint(max_requests=30, window_seconds=60)
def auth_status():
    """
    Перевірка статусу авторизації

    GET /api/auth/status

    Headers:
        Authorization: Bearer <token> (опціонально)

    Response:
    {
        "authenticated": boolean,
        "user": object | null,
        "token_expires_in": number | null
    }
    """
    logger.info("=== GET /api/auth/status ===")

    try:
        from ..controllers.auth_controller import AuthController

        # Отримуємо токен
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header[7:]

            # Валідуємо токен
            result = AuthController.validate_token(token)

            if result.get('valid'):
                user_data = result.get('user', {})
                token_exp = user_data.get('token_exp', 0)
                current_time = int(datetime.now(timezone.utc).timestamp())
                expires_in = max(0, token_exp - current_time)

                return jsonify({
                    "authenticated": True,
                    "user": user_data,
                    "token_expires_in": expires_in
                }), 200
            else:
                return jsonify({
                    "authenticated": False,
                    "user": None,
                    "token_expires_in": None,
                    "error": result.get('error')
                }), 200
        else:
            return jsonify({
                "authenticated": False,
                "user": None,
                "token_expires_in": None
            }), 200

    except Exception as e:
        logger.error(f"Помилка в auth_status: {e}", exc_info=True)
        return jsonify({
            "authenticated": False,
            "user": None,
            "token_expires_in": None,
            "error": "Помилка перевірки статусу"
        }), 200


# Діагностичні маршрути (тільки для розробки)
@auth_bp.route('/debug/info', methods=['GET'])
@public_endpoint(max_requests=5, window_seconds=60)
def debug_auth_info():
    """
    Діагностична інформація про авторизацію (тільки для розробки)
    """
    import os

    # Тільки в режимі розробки
    if os.getenv('FLASK_ENV') != 'development':
        return jsonify({
            "error": "Доступно тільки в режимі розробки"
        }), 403

    try:
        from datetime import datetime, timezone

        return jsonify({
            "auth_system": "JWT + Telegram WebApp",
            "jwt_algorithm": os.getenv('JWT_ALGORITHM', 'HS256'),
            "jwt_expiration": os.getenv('JWT_EXPIRATION', '86400'),
            "telegram_bot_configured": bool(os.getenv('TELEGRAM_BOT_TOKEN')),
            "current_time": datetime.now(timezone.utc).isoformat(),
            "endpoints": {
                "validate_telegram": "/api/auth/validate-telegram",
                "refresh_token": "/api/auth/refresh-token",
                "validate_token": "/api/auth/validate-token",
                "logout": "/api/auth/logout",
                "status": "/api/auth/status"
            }
        }), 200

    except Exception as e:
        logger.error(f"Помилка в debug_auth_info: {e}")
        return jsonify({
            "error": "Помилка отримання діагностичної інформації"
        }), 500


# Обробник помилок для Blueprint
@auth_bp.errorhandler(400)
def handle_bad_request(error):
    """Обробка помилок 400"""
    return jsonify({
        "status": "error",
        "message": "Невірний запит",
        "code": "bad_request"
    }), 400


@auth_bp.errorhandler(401)
def handle_unauthorized(error):
    """Обробка помилок 401"""
    return jsonify({
        "status": "error",
        "message": "Не авторизовано",
        "code": "unauthorized"
    }), 401


@auth_bp.errorhandler(403)
def handle_forbidden(error):
    """Обробка помилок 403"""
    return jsonify({
        "status": "error",
        "message": "Доступ заборонено",
        "code": "forbidden"
    }), 403


@auth_bp.errorhandler(429)
def handle_rate_limit(error):
    """Обробка помилок rate limiting"""
    return jsonify({
        "status": "error",
        "message": "Забагато запитів",
        "code": "rate_limit_exceeded"
    }), 429


@auth_bp.errorhandler(500)
def handle_internal_error(error):
    """Обробка внутрішніх помилок"""
    logger.error(f"Внутрішня помилка в auth routes: {error}")
    return jsonify({
        "status": "error",
        "message": "Внутрішня помилка сервера",
        "code": "internal_error"
    }), 500


def register_auth_routes(app):
    """
    Реєстрація auth маршрутів в додатку

    Args:
        app: Flask додаток
    """
    try:
        app.register_blueprint(auth_bp)
        logger.info("✅ Auth маршрути зареєстровано успішно")

        # Логуємо зареєстровані маршрути
        auth_routes = []
        for rule in app.url_map.iter_rules():
            if rule.rule.startswith('/api/auth'):
                auth_routes.append({
                    "path": rule.rule,
                    "methods": list(rule.methods - {'HEAD', 'OPTIONS'}),
                    "endpoint": rule.endpoint
                })

        logger.info(f"Зареєстровано {len(auth_routes)} auth маршрутів:")
        for route in auth_routes:
            logger.info(f"  {route['methods']} {route['path']}")

        return True

    except Exception as e:
        logger.error(f"❌ Помилка реєстрації auth маршрутів: {e}", exc_info=True)
        return False


# Експорт
__all__ = [
    'auth_bp',
    'register_auth_routes'
]