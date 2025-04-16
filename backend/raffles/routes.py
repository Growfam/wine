from flask import request, jsonify, g
import logging
import jwt
import os
import sys
import time
import uuid
from datetime import datetime, timedelta
from functools import wraps

# Налаштування логування
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Импортуємо контролери
try:
    from . import controllers
except ImportError:
    import controllers

# Імпортуємо змінні конфігурації
try:
    from backend.settings.config import JWT_SECRET, JWT_ALGORITHM
except ImportError:
    from settings.config import JWT_SECRET, JWT_ALGORITHM

# Часові обмеження для маршрутів (мінімальні, але не нульові)
RATE_LIMITS = {
    "get_active_raffles": 2,    # 2 секунди між запитами
    "get_raffles_history": 3,   # 3 секунди між запитами
    "get_user_raffles": 2,      # 2 секунди між запитами
    "participate_in_raffle": 2, # 2 секунди між запитами
}

# Відстеження останніх запитів користувачів
last_requests = {}


# Додаємо власну розширену функцію для перевірки валідності UUID
def is_valid_uuid(uuid_string):
    """
    Розширена перевірка валідності UUID з детальною обробкою помилок

    Args:
        uuid_string: Рядок для перевірки

    Returns:
        bool: True якщо UUID валідний, False в іншому випадку
    """
    # Перевірка на None та порожні рядки
    if not uuid_string:
        logger.warning(f"UUID пустий або None")
        return False

    # Перевірка на мінімальну довжину (повний UUID має 36 символів)
    if len(uuid_string) < 32:  # Навіть без дефісів UUID повинен мати 32 символи
        logger.warning(f"UUID занадто короткий ({len(uuid_string)} символів): {uuid_string}")
        return False

    try:
        # Спроба перетворити рядок в UUID об'єкт
        uuid_obj = uuid.UUID(uuid_string)
        # Перевіряємо рядкове представлення - повинно співпадати з оригіналом
        return str(uuid_obj) == uuid_string
    except (ValueError, AttributeError, TypeError) as e:
        logger.warning(f"Некоректний UUID {uuid_string}: {str(e)}")
        return False


def require_authentication(f):
    """Декоратор для захисту API ендпоінтів"""

    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Перевіряємо наявність токена в заголовках
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return jsonify({
                "status": "error",
                "message": "Необхідна аутентифікація",
                "code": "auth_required"
            }), 401

        # Отримуємо токен
        token = auth_header.split(" ")[1]

        try:
            # Декодуємо JWT токен
            payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
            # Додаємо дані користувача до контексту запиту
            g.user = payload.get("user_id")
        except jwt.ExpiredSignatureError:
            return jsonify({
                "status": "error",
                "message": "Термін дії токена минув",
                "code": "token_expired"
            }), 401
        except jwt.InvalidTokenError:
            return jsonify({
                "status": "error",
                "message": "Недійсний токен",
                "code": "invalid_token"
            }), 401

        return f(*args, **kwargs)

    return decorated_function


def require_admin(f):
    """Декоратор для захисту адміністративних API ендпоінтів"""

    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Перевіряємо наявність токена в заголовках
        admin_id = request.headers.get('X-Admin-Id')

        if not admin_id:
            return jsonify({
                "status": "error",
                "message": "Необхідний заголовок X-Admin-Id",
                "code": "admin_id_required"
            }), 401

        # Отримуємо список адміністраторів з середовища
        admin_ids = os.getenv("ADMIN_IDS", "").split(",")

        if str(admin_id) not in admin_ids:
            logger.warning(f"Спроба неавторизованого доступу з ID {admin_id}")
            return jsonify({
                "status": "error",
                "message": "Доступ заборонено. Ви не є адміністратором.",
                "code": "admin_access_denied"
            }), 403

        return f(*args, **kwargs)

    return decorated_function


def rate_limit(route_name):
    """Декоратор для обмеження частоти запитів (мінімальне обмеження)"""

    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            # Отримуємо ID користувача (або IP адресу, якщо ID недоступний)
            user_id = getattr(g, 'user', None) or request.headers.get('X-Forwarded-For') or request.remote_addr

            # Ключ для відстеження
            key = f"{route_name}:{user_id}"

            # Перевіряємо, чи не занадто частий запит
            now = time.time()
            last_request_time = last_requests.get(key, 0)
            time_since_last = now - last_request_time

            # Отримуємо ліміт для маршруту
            rate_limit_seconds = RATE_LIMITS.get(route_name, 2)  # За замовчуванням 2 секунди

            if time_since_last < rate_limit_seconds:
                retry_after = rate_limit_seconds - time_since_last
                logger.warning(f"Rate limit перевищено для {key}. Retry-After: {retry_after:.2f}с")

                return jsonify({
                    "status": "error",
                    "message": f"Занадто багато запитів. Повторіть через {int(retry_after) + 1} секунд.",
                    "code": "throttle",
                    "retry_after": retry_after
                }), 429

            # Оновлюємо час останнього запиту
            last_requests[key] = now

            # Очищаємо старі записи (старші за 10 хвилин)
            clean_old_requests()

            return f(*args, **kwargs)

        return decorated_function

    return decorator


def clean_old_requests():
    """Очищення застарілих записів про запити"""
    now = time.time()
    # Видаляємо записи, старші за 10 хвилин
    old_keys = [k for k, v in last_requests.items() if now - v > 600]
    for k in old_keys:
        last_requests.pop(k, None)


def parallel_request_handler(f):
    """Спрощений декоратор для обробки паралельних запитів"""

    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Оскільки ми прибрали детальну перевірку паралельних запитів,
        # просто виконуємо функцію безпосередньо
        return f(*args, **kwargs)

    return decorated_function


def validate_raffle_id(f):
    """Декоратор для валідації ID розіграшу"""

    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Перевіряємо ID розіграшу в URL
        if 'raffle_id' in kwargs:
            raffle_id = kwargs['raffle_id']

            # Перевірка на занадто короткі ID, які точно не є валідними UUID
            if len(raffle_id) <= 5:
                logger.warning(f"Критично невалідний ID розіграшу в URL (занадто короткий): {raffle_id}")
                return jsonify({
                    "status": "error",
                    "message": "Критично невалідний ідентифікатор розіграшу",
                    "code": "invalid_raffle_id"
                }), 400

            # Перевіряємо валідність UUID спочатку нашої вдосконаленої функцією
            if not is_valid_uuid(raffle_id):
                # Потім перевіряємо з функцією контролера для сумісності
                if not controllers.is_valid_uuid(raffle_id):
                    logger.warning(f"Невалідний формат ID розіграшу в URL: {raffle_id}")
                    return jsonify({
                        "status": "error",
                        "message": f"Невалідний формат ID розіграшу: {raffle_id}",
                        "code": "invalid_raffle_id"
                    }), 400

        # Перевіряємо ID розіграшу в JSON даних
        if request.method in ['POST', 'PUT'] and request.is_json:
            data = request.json
            if data and 'raffle_id' in data:
                raffle_id = data['raffle_id']

                # Перевірка на занадто короткі ID, які точно не є валідними UUID
                if len(str(raffle_id)) <= 5:
                    logger.warning(f"Критично невалідний ID розіграшу в JSON (занадто короткий): {raffle_id}")
                    return jsonify({
                        "status": "error",
                        "message": "Критично невалідний ідентифікатор розіграшу",
                        "code": "invalid_raffle_id"
                    }), 400

                # Перевіряємо валідність UUID спочатку нашою функцією
                if not is_valid_uuid(str(raffle_id)):
                    # Потім перевіряємо з функцією контролера для сумісності
                    if not controllers.is_valid_uuid(str(raffle_id)):
                        logger.warning(f"Невалідний формат ID розіграшу в JSON: {raffle_id}")
                        return jsonify({
                            "status": "error",
                            "message": f"Невалідний формат ID розіграшу: {raffle_id}",
                            "code": "invalid_raffle_id"
                        }), 400

        return f(*args, **kwargs)

    return decorated_function


def register_raffles_routes(app):
    """Реєстрація маршрутів для системи розіграшів"""

    # API-ендпоінт для перевірки валідності UUID
    @app.route('/api/validate-uuid/<uuid_string>', methods=['GET'])
    def validate_uuid_endpoint(uuid_string):
        """Ендпоінт для перевірки валідності UUID"""
        valid = is_valid_uuid(uuid_string)
        return jsonify({
            "status": "success",
            "valid": valid,
            "uuid": uuid_string,
            "message": "UUID валідний" if valid else "UUID невалідний"
        })

    # Спочатку додайте новий маршрут для балансу
    @app.route('/api/user/<telegram_id>/balance', methods=['GET'])
    def get_user_balance_endpoint(telegram_id):
        """Спеціальний ендпоінт для отримання балансу без обмеження частоти"""
        try:
            # Отримуємо дані користувача
            from backend.users.controllers import get_user_info
            user = get_user_info(telegram_id)

            if not user:
                return jsonify({
                    "status": "error",
                    "message": "Користувача не знайдено",
                    "code": "user_not_found"
                }), 404

            return jsonify({
                "status": "success",
                "data": {
                    "balance": user.get("balance", 0),
                    "coins": user.get("coins", 0)
                }
            })
        except Exception as e:
            logger.error(f"Помилка отримання балансу: {str(e)}")
            return jsonify({
                "status": "error",
                "message": f"Помилка сервера: {str(e)}",
                "code": "server_error"
            }), 500

    # Ендпоінт для перевірки валідності розіграшу перед участю
    @app.route('/api/raffles/<raffle_id>/check', methods=['GET'])
    @validate_raffle_id
    def api_check_raffle_exists(raffle_id):
        """Перевірка існування розіграшу перед участю"""
        try:
            # Перевіряємо існування розіграшу
            controllers.check_raffle_exists(raffle_id)
            return jsonify({
                "status": "success",
                "message": "Розіграш існує та валідний",
                "raffle_id": raffle_id
            })
        except controllers.RaffleNotFoundException:
            return jsonify({
                "status": "error",
                "message": f"Розіграш з ID {raffle_id} не знайдено",
                "code": "raffle_not_found"
            }), 404
        except controllers.InvalidRaffleIDError:
            return jsonify({
                "status": "error",
                "message": f"Невалідний формат ID розіграшу: {raffle_id}",
                "code": "invalid_raffle_id"
            }), 400
        except Exception as e:
            logger.error(f"Помилка перевірки розіграшу {raffle_id}: {str(e)}")
            return jsonify({
                "status": "error",
                "message": f"Помилка перевірки розіграшу: {str(e)}",
                "code": "server_error"
            }), 500

    # Публічні маршрути для користувачів
    @app.route('/api/raffles', methods=['GET'])
    @rate_limit('get_active_raffles')
    @parallel_request_handler
    def api_get_active_raffles():
        """Отримання списку активних розіграшів"""
        start_time = time.time()
        try:
            result = controllers.get_active_raffles()
            execution_time = time.time() - start_time
            logger.info(f"api_get_active_raffles: виконано за {execution_time:.4f}с")
            return result
        except Exception as e:
            execution_time = time.time() - start_time
            logger.error(f"api_get_active_raffles: помилка за {execution_time:.4f}с - {str(e)}")
            # Повертаємо порожній масив при помилці
            return jsonify({
                "status": "success",
                "data": [],
                "error": str(e)
            })

    @app.route('/api/raffles/<raffle_id>', methods=['GET'])
    @validate_raffle_id
    def api_get_raffle_details(raffle_id):
        """Отримання деталей конкретного розіграшу"""
        try:
            return controllers.get_raffle_details(raffle_id)
        except controllers.InvalidRaffleIDError:
            return jsonify({
                "status": "error",
                "message": f"Невалідний формат ID розіграшу: {raffle_id}",
                "code": "invalid_raffle_id"
            }), 400
        except controllers.RaffleNotFoundException:
            return jsonify({
                "status": "error",
                "message": f"Розіграш з ID {raffle_id} не знайдено",
                "code": "raffle_not_found"
            }), 404
        except Exception as e:
            logger.error(f"Помилка отримання деталей розіграшу {raffle_id}: {str(e)}")
            return jsonify({
                "status": "error",
                "message": "Помилка отримання деталей розіграшу",
                "error_details": str(e),
                "code": "server_error"
            }), 500

    @app.route('/api/user/<telegram_id>/participate-raffle', methods=['POST'])
    @rate_limit('participate_in_raffle')
    @validate_raffle_id
    def api_participate_in_raffle(telegram_id):
        """Участь у розіграші"""
        try:
            # Додаткова перевірка даних JSON
            if not request.is_json:
                return jsonify({
                    "status": "error",
                    "message": "Неверний формат запиту. Очікується JSON.",
                    "code": "invalid_request"
                }), 400

            data = request.json
            if not data or not data.get('raffle_id'):
                return jsonify({
                    "status": "error",
                    "message": "Відсутній ідентифікатор розіграшу в запиті",
                    "code": "missing_raffle_id"
                }), 400

            # Додаткова перевірка на валідність UUID
            raffle_id = data.get('raffle_id')
            if not is_valid_uuid(str(raffle_id)):
                return jsonify({
                    "status": "error",
                    "message": f"Невалідний формат ID розіграшу: {raffle_id}",
                    "code": "invalid_raffle_id"
                }), 400

            return controllers.participate_in_raffle(telegram_id, data)
        except controllers.InsufficientTokensError as e:
            return jsonify({
                "status": "error",
                "message": str(e),
                "code": "insufficient_tokens"
            }), 400
        except controllers.RaffleNotFoundException as e:
            return jsonify({
                "status": "error",
                "message": str(e),
                "code": "raffle_not_found"
            }), 404
        except controllers.RaffleAlreadyEndedError as e:
            return jsonify({
                "status": "error",
                "message": str(e),
                "code": "raffle_ended"
            }), 400
        except Exception as e:
            logger.error(f"Помилка участі в розіграші: {str(e)}")
            return jsonify({
                "status": "error",
                "message": "Виникла помилка при участі в розіграші",
                "error_details": str(e),
                "code": "server_error"
            }), 500

    @app.route('/api/user/<telegram_id>/raffles', methods=['GET'])
    @rate_limit('get_user_raffles')
    @parallel_request_handler
    def api_get_user_raffles(telegram_id):
        """Отримання розіграшів, у яких бере участь користувач"""
        try:
            return controllers.get_user_raffles(telegram_id)
        except Exception as e:
            logger.error(f"Помилка отримання розіграшів користувача {telegram_id}: {str(e)}")
            # Повертаємо порожній масив при помилці для кращого UX
            return jsonify({
                "status": "success",
                "data": [],
                "error_details": str(e)
            })

    @app.route('/api/user/<telegram_id>/raffles-history', methods=['GET'])
    @rate_limit('get_raffles_history')
    @parallel_request_handler
    def api_get_user_raffles_history(telegram_id):
        """Отримання історії участі користувача в розіграшах"""
        start_time = time.time()

        try:
            # Встановлюємо таймаут для отримання історії
            result = controllers.get_raffles_history(telegram_id)
            execution_time = time.time() - start_time
            logger.info(f"api_get_user_raffles_history: виконано за {execution_time:.4f}с")

            # Додаємо час виконання до відповіді
            if hasattr(result, 'json'):
                response_data = result.json
                if isinstance(response_data, dict):
                    response_data['execution_time'] = execution_time
                    return jsonify(response_data)

            return result
        except Exception as e:
            execution_time = time.time() - start_time
            logger.error(f"api_get_user_raffles_history: помилка за {execution_time:.4f}с - {str(e)}")

            # Повертаємо порожній масив при помилці
            return jsonify({
                "status": "success",
                "data": [],
                "error_details": str(e)
            })

    # Утиліта для перевірки всіх активних розіграшів
    @app.route('/api/tools/validate-raffle-ids', methods=['GET'])
    def api_validate_raffle_ids():
        """Перевірка валідності ID всіх розіграшів"""
        # Перевіряємо наявність заголовка X-Admin-Id
        admin_id = request.headers.get('X-Admin-Id')
        if not admin_id or not controllers._is_admin(admin_id):
            return jsonify({
                "status": "error",
                "message": "Доступ заборонено. Потрібні права адміністратора.",
                "code": "forbidden"
            }), 403

        return jsonify(controllers.validate_all_active_raffle_ids())

    # Адміністраторські маршрути
    @app.route('/api/admin/raffles', methods=['GET'])
    @require_admin
    def api_get_all_raffles():
        """Отримання всіх розіграшів (для адміністраторів)"""
        admin_id = request.headers.get('X-Admin-Id')
        status_filter = request.args.get('status')
        return controllers.get_all_raffles(status_filter, admin_id)

    @app.route('/api/admin/raffles', methods=['POST'])
    @require_admin
    def api_create_raffle():
        """Створення нового розіграшу (для адміністраторів)"""
        admin_id = request.headers.get('X-Admin-Id')
        return controllers.create_raffle(request.json, admin_id)

    @app.route('/api/admin/raffles/<raffle_id>', methods=['PUT'])
    @require_admin
    @validate_raffle_id
    def api_update_raffle(raffle_id):
        """Оновлення розіграшу (для адміністраторів)"""
        admin_id = request.headers.get('X-Admin-Id')
        return controllers.update_raffle(raffle_id, request.json, admin_id)

    @app.route('/api/admin/raffles/<raffle_id>', methods=['DELETE'])
    @require_admin
    @validate_raffle_id
    def api_delete_raffle(raffle_id):
        """Видалення розіграшу (для адміністраторів)"""
        admin_id = request.headers.get('X-Admin-Id')
        return controllers.delete_raffle(raffle_id, admin_id)

    @app.route('/api/admin/raffles/<raffle_id>/finish', methods=['POST'])
    @require_admin
    @validate_raffle_id
    def api_finish_raffle(raffle_id):
        """Примусове завершення розіграшу (для адміністраторів)"""
        admin_id = request.headers.get('X-Admin-Id')
        return controllers.finish_raffle(raffle_id, admin_id)

    @app.route('/api/admin/raffles/<raffle_id>/participants', methods=['GET'])
    @require_admin
    @validate_raffle_id
    def api_get_raffle_participants(raffle_id):
        """Отримання списку учасників розіграшу (для адміністраторів)"""
        admin_id = request.headers.get('X-Admin-Id')
        return controllers.get_raffle_participants(raffle_id, admin_id)

    @app.route('/api/admin/raffles/check-expired', methods=['POST'])
    @require_admin
    def api_check_expired_raffles():
        """Перевірка та автоматичне завершення прострочених розіграшів"""
        result = controllers.check_and_finish_expired_raffles()
        return jsonify(result)

    # ВИДАЛЕНО api_claim_newbie_bonus - маршрут, який викликав конфлікти

    # Додатковий маршрут для моніторингу стану розіграшів
    @app.route('/api/raffles/status', methods=['GET'])
    def api_get_raffles_status():
        """Отримання статистики про активні розіграші"""
        try:
            # Імпортуємо supabase для цього конкретного маршруту
            try:
                from ..supabase_client import supabase
            except ImportError:
                from supabase_client import supabase

            # Отримуємо кількість активних розіграшів
            active_count_response = supabase.table("raffles").select("count", count="exact").eq("status",
                                                                                                "active").execute()
            active_count = active_count_response.count if hasattr(active_count_response, 'count') else 0

            # Отримуємо кількість завершених розіграшів
            completed_count_response = supabase.table("raffles").select("count", count="exact").eq("status",
                                                                                                   "completed").execute()
            completed_count = completed_count_response.count if hasattr(completed_count_response, 'count') else 0

            # Отримуємо найближчий до завершення розіграш
            now = datetime.now().isoformat()
            upcoming_response = supabase.table("raffles").select("id,title,end_time").eq("status", "active").gt(
                "end_time", now).order("end_time", asc=True).limit(1).execute()
            upcoming_raffle = upcoming_response.data[0] if upcoming_response.data else None

            return jsonify({
                "status": "success",
                "data": {
                    "active_raffles": active_count,
                    "completed_raffles": completed_count,
                    "upcoming_raffle": upcoming_raffle
                }
            })
        except Exception as e:
            logger.error(f"Помилка отримання статистики розіграшів: {str(e)}")
            return jsonify({
                "status": "error",
                "message": "Помилка отримання статистики розіграшів",
                "code": "server_error"
            }), 500