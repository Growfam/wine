"""
Єдині роути авторизації для WINIX
Об'єднує функціонал основної системи та системи завдань
Оптимізовано для Telegram Mini App
"""

from flask import Blueprint, request, jsonify
import logging
from datetime import datetime
from .controllers  import TelegramAuthController, require_auth

logger = logging.getLogger(__name__)

# Створюємо Blueprint
auth_bp = Blueprint('auth', __name__, url_prefix='/api/auth')


@auth_bp.route('/telegram', methods=['POST'])
def authenticate_telegram():
    """
    Основний endpoint авторизації через Telegram

    POST /api/auth/telegram
    Body: {
        "initData": "...",  // Telegram WebApp data
        "id": "123456",     // або telegram_id
        "username": "...",
        "first_name": "...",
        "referrer_id": "..." // опціонально
    }
    """
    try:
        data = request.get_json() or {}

        # Логуємо запит
        logger.info(f"Авторизація Telegram: {data.get('id', 'unknown')}")

        # Додаємо заголовки якщо є
        telegram_id = request.headers.get('X-Telegram-User-Id')
        if telegram_id:
            data['telegram_id'] = telegram_id

        result = TelegramAuthController.authenticate_telegram_user(data)

        if result.get('success'):
            return jsonify({
                'status': 'success',
                'token': result['token'],
                'expires_in': result['expires_in'],
                'user': result['user']
            }), 200
        else:
            return jsonify({
                'status': 'error',
                'message': result.get('error', 'Помилка авторизації'),
                'code': result.get('code', 'auth_failed')
            }), 401

    except Exception as e:
        logger.error(f"Помилка авторизації: {str(e)}", exc_info=True)
        return jsonify({
            'status': 'error',
            'message': 'Внутрішня помилка сервера',
            'code': 'internal_error'
        }), 500


@auth_bp.route('/refresh', methods=['POST'])
def refresh_token():
    """
    Оновлення JWT токена

    POST /api/auth/refresh
    Headers: Authorization: Bearer <token>
    Body: { "token": "..." } // альтернатива
    """
    try:
        # Отримуємо токен
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header[7:]
        else:
            data = request.get_json() or {}
            token = data.get('token')

        if not token:
            return jsonify({
                'status': 'error',
                'message': 'Токен відсутній',
                'code': 'missing_token'
            }), 400

        result = TelegramAuthController.refresh_token(token)

        if result.get('success'):
            return jsonify({
                'status': 'success',
                'token': result['token'],
                'expires_in': result['expires_in'],
                'user': result.get('user', {})
            }), 200
        else:
            return jsonify({
                'status': 'error',
                'message': result.get('error', 'Помилка оновлення токена'),
                'code': result.get('code', 'refresh_failed')
            }), 401

    except Exception as e:
        logger.error(f"Помилка оновлення токена: {str(e)}", exc_info=True)
        return jsonify({
            'status': 'error',
            'message': 'Внутрішня помилка сервера',
            'code': 'internal_error'
        }), 500


@auth_bp.route('/validate', methods=['POST'])
def validate_token():
    """
    Валідація JWT токена

    POST /api/auth/validate
    Headers: Authorization: Bearer <token>
    Body: { "token": "..." } // альтернатива
    """
    try:
        # Отримуємо токен
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header[7:]
        else:
            data = request.get_json() or {}
            token = data.get('token')

        if not token:
            return jsonify({
                'status': 'error',
                'valid': False,
                'message': 'Токен відсутній',
                'code': 'missing_token'
            }), 400

        result = TelegramAuthController.validate_token(token)

        return jsonify({
            'status': 'success' if result.get('valid') else 'error',
            'valid': result.get('valid', False),
            'user': result.get('user'),
            'error': result.get('error'),
            'code': result.get('code')
        }), 200 if result.get('valid') else 401

    except Exception as e:
        logger.error(f"Помилка валідації токена: {str(e)}", exc_info=True)
        return jsonify({
            'status': 'error',
            'valid': False,
            'message': 'Внутрішня помилка сервера',
            'code': 'internal_error'
        }), 500


@auth_bp.route('/status', methods=['GET'])
@require_auth
def auth_status():
    """
    Перевірка статусу авторизації (захищений endpoint)

    GET /api/auth/status
    Headers: Authorization: Bearer <token>
    """
    try:
        # Дані користувача вже в request.current_user
        user = request.current_user

        return jsonify({
            'status': 'success',
            'authenticated': True,
            'user': user
        }), 200

    except Exception as e:
        logger.error(f"Помилка перевірки статусу: {str(e)}")
        return jsonify({
            'status': 'error',
            'authenticated': False,
            'message': 'Помилка перевірки статусу'
        }), 500


@auth_bp.route('/logout', methods=['POST'])
@require_auth
def logout():
    """
    Вихід користувача

    POST /api/auth/logout
    Headers: Authorization: Bearer <token>
    """
    try:
        # В майбутньому можна додати токен в чорний список
        # Поки що просто повертаємо успіх

        logger.info(f"Користувач {request.current_user.get('telegram_id')} вийшов")

        return jsonify({
            'status': 'success',
            'message': 'Успішний вихід'
        }), 200

    except Exception as e:
        logger.error(f"Помилка виходу: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': 'Помилка виходу'
        }), 500


# Спеціальний endpoint для Telegram WebApp валідації (для сумісності)
@auth_bp.route('/validate-telegram', methods=['POST'])
def validate_telegram_webapp():
    """
    Валідація Telegram WebApp даних (legacy endpoint)
    Перенаправляє на основний endpoint
    """
    return authenticate_telegram()


# Тестові endpoints
@auth_bp.route('/ping', methods=['GET'])
def ping():
    """Простий ping для перевірки роботи"""
    return jsonify({
        'status': 'pong',
        'timestamp': datetime.now().isoformat()
    }), 200


@auth_bp.route('/test', methods=['GET'])
def test_auth():
    """Тестовий endpoint для debug"""
    return jsonify({
        'status': 'success',
        'message': 'Auth service is running',
        'endpoints': [
            'POST /api/auth/telegram',
            'POST /api/auth/refresh',
            'POST /api/auth/validate',
            'GET /api/auth/status',
            'POST /api/auth/logout'
        ]
    }), 200


# Обробники помилок
@auth_bp.errorhandler(400)
def bad_request(error):
    return jsonify({
        'status': 'error',
        'message': 'Невірний запит',
        'code': 'bad_request'
    }), 400


@auth_bp.errorhandler(401)
def unauthorized(error):
    return jsonify({
        'status': 'error',
        'message': 'Не авторизовано',
        'code': 'unauthorized'
    }), 401


@auth_bp.errorhandler(500)
def internal_error(error):
    return jsonify({
        'status': 'error',
        'message': 'Внутрішня помилка сервера',
        'code': 'internal_error'
    }), 500