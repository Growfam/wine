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
    # ДІАГНОСТИКА: Логуємо весь запит
    logger.info("=" * 50)
    logger.info("🔍 AUTH TELEGRAM REQUEST")
    logger.info(f"Headers: {dict(request.headers)}")
    logger.info(f"Method: {request.method}")
    logger.info(f"Content-Type: {request.content_type}")

    try:
        data = request.get_json() or {}
        logger.info(f"Body keys: {list(data.keys())}")
        logger.info(f"Has initData: {bool(data.get('initData'))}")
        logger.info(f"Telegram ID: {data.get('telegram_id') or data.get('id')}")

        # ===== ПОКРАЩЕНА ОБРОБКА TELEGRAM ID =====
        # Пріоритет джерел telegram_id:
        # 1. Заголовок X-Telegram-User-Id
        # 2. Поле telegram_id в body
        # 3. Поле id в body

        telegram_id = None

        # 1. Перевіряємо заголовок
        header_id = request.headers.get('X-Telegram-User-Id')
        if header_id:
            telegram_id = str(header_id).strip()
            logger.info(f"Telegram ID з заголовка: {telegram_id}")

        # 2. Перевіряємо telegram_id в body
        if not telegram_id and data.get('telegram_id'):
            telegram_id = str(data.get('telegram_id')).strip()
            logger.info(f"Telegram ID з body (telegram_id): {telegram_id}")

        # 3. Перевіряємо id в body
        if not telegram_id and data.get('id'):
            telegram_id = str(data.get('id')).strip()
            logger.info(f"Telegram ID з body (id): {telegram_id}")

        # Валідація telegram_id
        if not telegram_id or telegram_id == 'None' or telegram_id == 'null':
            logger.error(f"Невалідний telegram_id: {telegram_id}")
            return jsonify({
                'status': 'error',
                'message': 'Telegram ID не вказано або невалідний',
                'code': 'missing_telegram_id'
            }), 400

        # Перевіряємо що це числовий ID
        if not telegram_id.isdigit():
            logger.error(f"Telegram ID не є числом: {telegram_id}")
            return jsonify({
                'status': 'error',
                'message': 'Telegram ID має бути числом',
                'code': 'invalid_telegram_id_format'
            }), 400

        # Переконуємося що в data є обидва поля для сумісності
        if not data.get('telegram_id') and data.get('id'):
            data['telegram_id'] = data['id']

        if not data.get('id') and data.get('telegram_id'):
            data['id'] = data['telegram_id']

        # Оновлюємо дані з нормалізованим telegram_id
        data['telegram_id'] = telegram_id
        data['id'] = telegram_id  # Для сумісності

        # ===== НОВЕ: ТИМЧАСОВЕ РІШЕННЯ ДЛЯ ТЕСТУВАННЯ =====
        ALLOW_AUTH_WITHOUT_INITDATA = os.getenv('ALLOW_AUTH_WITHOUT_INITDATA', 'false').lower() == 'true'

        # Для продакшену ОБОВ'ЯЗКОВО перевіряємо initData
        if not data.get('initData'):
            logger.error(f"❌ Авторизація без initData заборонена для користувача {telegram_id}")
            return jsonify({
                'status': 'error',
                'message': 'Додаток доступний тільки через Telegram',
                'code': 'missing_init_data'
            }), 401

        # Детальне логування для діагностики
        logger.info(f"=== АВТОРИЗАЦІЯ TELEGRAM ===")
        logger.info(f"Telegram ID: {telegram_id}")
        logger.info(f"Username: {data.get('username', 'не вказано')}")
        logger.info(f"First name: {data.get('first_name', 'не вказано')}")
        logger.info(f"Has initData: {'так' if data.get('initData') else 'ні'}")
        logger.info(f"Referrer ID: {data.get('referrer_id', 'немає')}")

        # Викликаємо контролер авторизації
        result = TelegramAuthController.authenticate_telegram_user(data)

        if result.get('success'):
            logger.info(f"✅ Успішна авторизація користувача {telegram_id}")

            # Переконуємося що в відповіді є всі необхідні поля
            response_data = {
                'status': 'success',
                'token': result.get('token'),
                'expires_in': result.get('expires_in', 86400),  # 24 години за замовчуванням
                'user': {
                    'telegram_id': telegram_id,  # Завжди повертаємо telegram_id
                    'id': result['user'].get('id'),  # UUID з БД якщо є
                    'username': result['user'].get('username', ''),
                    'balance': result['user'].get('balance', 0),
                    'coins': result['user'].get('coins', 0),
                    'level': result['user'].get('level', 1),
                    'is_new_user': result['user'].get('is_new_user', False)
                }
            }

            # Додаємо інші поля користувача якщо вони є
            for key in ['first_name', 'last_name', 'language_code', 'referral_code']:
                if key in result['user']:
                    response_data['user'][key] = result['user'][key]

            return jsonify(response_data), 200
        else:
            error_message = result.get('error', 'Помилка авторизації')
            error_code = result.get('code', 'auth_failed')

            logger.error(f"❌ Помилка авторизації для {telegram_id}: {error_message} ({error_code})")

            return jsonify({
                'status': 'error',
                'message': error_message,
                'code': error_code,
                'telegram_id': telegram_id  # Для діагностики
            }), 401

    except ValueError as e:
        logger.error(f"ValueError в authenticate_telegram: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': 'Невірний формат даних',
            'code': 'invalid_data_format'
        }), 400

    except Exception as e:
        logger.error(f"Критична помилка авторизації: {str(e)}", exc_info=True)

        # Визначаємо чи ми в debug режимі
        # Варіант 1: через змінну середовища
        is_debug = os.getenv('FLASK_ENV') == 'development' or os.getenv('DEBUG', 'False').lower() == 'true'

        # Варіант 2: через Flask current_app (якщо доступний)
        # from flask import current_app
        # is_debug = current_app.debug if current_app else False

        return jsonify({
            'status': 'error',
            'message': 'Внутрішня помилка сервера',
            'code': 'internal_error',
            'details': str(e) if is_debug else None  # Деталі тільки в debug режимі
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

