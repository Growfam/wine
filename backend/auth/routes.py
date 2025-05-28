"""
Єдині роути авторизації для WINIX
Об'єднує функціонал основної системи та системи завдань
Оптимізовано для Telegram Mini App
"""

from flask import Blueprint, request, jsonify, g
import os
import logging
from datetime import datetime
from .controllers import TelegramAuthController, require_auth
from middleware import JWT_SECRET, JWT_ALGORITHM, jwt
logger = logging.getLogger(__name__)

# Створюємо Blueprint
auth_bp = Blueprint('main_auth', __name__, url_prefix='/api/auth')


@auth_bp.route('/telegram', methods=['POST', 'OPTIONS'])
def authenticate_telegram():
    """Основний endpoint авторизації через Telegram"""

    # Обробка OPTIONS для CORS
    if request.method == 'OPTIONS':
        return '', 200

    # КРИТИЧНЕ ЛОГУВАННЯ
    logger.error("🚨🚨🚨 TELEGRAM AUTH REQUEST RECEIVED 🚨🚨🚨")
    logger.error(f"Origin: {request.headers.get('Origin')}")
    logger.error(f"Headers: {dict(request.headers)}")

    try:
        data = request.get_json() or {}
        logger.error(f"Body keys: {list(data.keys())}")
        logger.error(f"Has initData: {bool(data.get('initData'))}")

        # Отримуємо telegram_id
        telegram_id = data.get('telegram_id') or data.get('id')

        if not telegram_id:
            logger.error("❌ NO TELEGRAM ID")
            return jsonify({
                'status': 'error',
                'message': 'No telegram ID'
            }), 400

        # ТИМЧАСОВО - ПРОСТО ПОВЕРТАЄМО УСПІХ
        logger.error(f"✅ RETURNING SUCCESS FOR ID: {telegram_id}")

        return jsonify({
            'status': 'success',
            'token': 'test_token_' + str(telegram_id),
            'user': {
                'telegram_id': telegram_id,
                'username': data.get('username', 'Test User'),
                'balance': 100,
                'coins': 50
            }
        }), 200

    except Exception as e:
        logger.error(f"💥 CRITICAL ERROR: {str(e)}", exc_info=True)
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


@auth_bp.route('/refresh', methods=['POST', 'GET'])
def refresh_token():
    """
    Оновлення JWT токена
    """
    # Ігноруємо query параметри для визначення методу
    if request.method == 'GET' and request.args.get('t'):
        # Це насправді POST запит з timestamp параметром
        request.method = 'POST'
    try:

        logger.info("=== REFRESH TOKEN REQUEST ===")
        logger.info(f"Method: {request.method}")
        logger.info(f"Path: {request.path}")
        logger.info(f"Headers: {dict(request.headers)}")
        logger.info(f"Body: {request.get_json()}")

        # Використовуємо middleware для отримання telegram_id
        from middleware import extract_telegram_id

        telegram_id = extract_telegram_id()

        if not telegram_id:
            # Спроба отримати старий токен для декодування
            auth_header = request.headers.get('Authorization')
            if auth_header and auth_header.startswith('Bearer '):
                token = auth_header[7:]
            else:
                data = request.get_json() or {}
                token = data.get('token')

            if token:
                # Декодуємо без перевірки терміну дії
                try:
                    payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM], options={"verify_exp": False})
                    telegram_id = payload.get('user_id') or payload.get('telegram_id')
                except:
                    pass

        if not telegram_id:
            logger.error("refresh_token: telegram_id не знайдено")
            return jsonify({
                'status': 'error',
                'message': 'User ID не знайдено',
                'code': 'missing_user_id'
            }), 400

        # Логування для діагностики
        logger.info(f"refresh_token: Оновлення токену для {telegram_id}")

        # Викликаємо контролер з правильним telegram_id
        result = TelegramAuthController.refresh_token(telegram_id)

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


@auth_bp.route('/refresh-token', methods=['POST'])
def refresh_token_alt():
    """
    Альтернативний endpoint для refresh token (для сумісності з frontend)

    POST /api/auth/refresh-token
    """
    return refresh_token()


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


@auth_bp.route('/validate-telegram', methods=['POST'])
def validate_telegram():
    """
    Валідація Telegram даних (критичний endpoint для системи завдань)

    POST /api/auth/validate-telegram
    """
    try:
        data = request.get_json() or {}

        # Логуємо запит
        logger.info(f"Validate-telegram запит отримано")

        # Перевіряємо наявність даних
        if not data:
            return jsonify({
                'valid': False,
                'error': 'No data provided',
                'code': 'missing_data'
            }), 400

        # Викликаємо контролер
        result = TelegramAuthController.authenticate_telegram_user(data)

        if result.get('success'):
            return jsonify({
                'valid': True,
                'user': result.get('user'),
                'token': result.get('token')
            }), 200
        else:
            return jsonify({
                'valid': False,
                'error': result.get('error', 'Validation failed'),
                'code': result.get('code', 'validation_failed')
            }), 401

    except Exception as e:
        logger.error(f"Validate-telegram помилка: {str(e)}", exc_info=True)
        return jsonify({
            'valid': False,
            'error': 'Internal server error',
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
def validate_telegram_webapp():
    """
    Валідація Telegram WebApp даних (legacy endpoint)
    Підтримує GET та POST методи
    """
    if request.method == 'GET':
        # Для GET запитів повертаємо інформацію про endpoint
        return jsonify({
            'status': 'info',
            'message': 'Use POST method to validate Telegram data',
            'endpoint': '/api/auth/validate-telegram'
        }), 200

    # Для POST запитів перенаправляємо на основний endpoint
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
            'POST /api/auth/refresh-token',
            'POST /api/auth/validate',
            'GET /api/auth/status',
            'POST /api/auth/logout',
            'POST|GET /api/auth/validate-telegram'
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


@auth_bp.route('/debug/token', methods=['POST'])
def debug_token():
    """Діагностичний endpoint для перевірки токенів"""
    try:
        from middleware import get_current_user, extract_telegram_id

        # Отримуємо всі можливі джерела даних
        auth_header = request.headers.get('Authorization')
        body = request.get_json() or {}

        # Декодуємо токен якщо є
        token_data = None
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header[7:]
            try:
                # Декодуємо без перевірки терміну дії для діагностики
                token_data = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM], options={"verify_exp": False})
            except Exception as e:
                token_data = {"error": str(e)}

        return jsonify({
            'headers': {
                'Authorization': auth_header,
                'X-Telegram-User-Id': request.headers.get('X-Telegram-User-Id')
            },
            'body': body,
            'decoded_token': token_data,
            'current_user': get_current_user(),
            'extracted_telegram_id': extract_telegram_id(),
            'g.current_user': getattr(g, 'current_user', None),
            'g.telegram_id': getattr(g, 'telegram_id', None)
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


def register_auth_routes(app):
    """Реєструє auth blueprint з додатком"""
    app.register_blueprint(auth_bp)
    logger.info("✅ Auth routes registered successfully")
    return True

