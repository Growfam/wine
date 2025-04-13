from flask import request, jsonify, g
import logging
import jwt
import os
import time
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



# Часові обмеження для маршрутів
RATE_LIMITS = {
    "get_active_raffles": 5,  # 5 секунд між запитами
    "get_raffles_history": 60,  # 60 секунд між запитами
    "get_user_raffles": 10,  # 10 секунд між запитами
    "participate_in_raffle": 10,  # 10 секунди між запитами
}

# Відстеження останніх запитів користувачів
last_requests = {}



def require_authentication(f):
    """Декоратор для захисту API ендпоінтів"""

    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Перевіряємо наявність токена в заголовках
        auth_header = request.headers.get("Authorization")
        if not auth_header or not auth_header.startswith("Bearer "):
            return jsonify({
                "status": "error",
                "message": "Необхідна аутентифікація"
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
                "message": "Термін дії токена минув"
            }), 401
        except jwt.InvalidTokenError:
            return jsonify({
                "status": "error",
                "message": "Недійсний токен"
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
                "message": "Необхідний заголовок X-Admin-Id"
            }), 401

        # Отримуємо список адміністраторів з середовища
        admin_ids = os.getenv("ADMIN_IDS", "").split(",")

        if str(admin_id) not in admin_ids:
            logger.warning(f"Спроба неавторизованого доступу з ID {admin_id}")
            return jsonify({
                "status": "error",
                "message": "Доступ заборонено. Ви не є адміністратором."
            }), 403

        return f(*args, **kwargs)

    return decorated_function


def rate_limit(route_name):
    """Декоратор для обмеження частоти запитів"""

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
            rate_limit_seconds = RATE_LIMITS.get(route_name, 5)  # За замовчуванням 5 секунд

            if time_since_last < rate_limit_seconds:
                retry_after = rate_limit_seconds - time_since_last
                logger.warning(f"Rate limit перевищено для {key}. Retry-After: {retry_after:.2f}с")

                return jsonify({
                    "status": "error",
                    "message": f"Занадто багато запитів. Спробуйте знову через {int(retry_after) + 1} секунд.",
                    "code": "throttle",
                    "retry_after": retry_after
                }), 429

            # Оновлюємо час останнього запиту
            last_requests[key] = now

            # Очищаємо старі записи (старші за 1 годину)
            clean_old_requests()

            return f(*args, **kwargs)

        return decorated_function

    return decorator


def clean_old_requests():
    """Очищення застарілих записів про запити"""
    now = time.time()
    # Видаляємо записи, старші за 1 годину
    old_keys = [k for k, v in last_requests.items() if now - v > 3600]
    for k in old_keys:
        last_requests.pop(k, None)


def parallel_request_handler(f):
    """Декоратор для обробки паралельних запитів"""

    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Отримуємо ID користувача (або IP адресу, якщо ID недоступний)
        user_id = getattr(g, 'user', None) or request.headers.get('X-Forwarded-For') or request.remote_addr

        # Ключ для відстеження
        key = f"{f.__name__}:{user_id}"

        # Перевіряємо, чи не виконується вже такий запит
        now = time.time()
        last_request_time = last_requests.get(key, 0)
        time_since_last = now - last_request_time

        # Якщо запит виконується менше 1 секунди, вважаємо паралельним
        if time_since_last < 1:
            logger.warning(f"Виявлено паралельний запит для {key}")

            # Для деяких маршрутів повертаємо порожні масиви замість помилки
            if f.__name__ in ['api_get_user_raffles_history', 'api_get_active_raffles']:
                return jsonify({
                    "status": "success",
                    "data": [],
                    "message": "Запит вже виконується",
                    "parallel": True
                })

            return jsonify({
                "status": "error",
                "message": "Запит вже виконується. Спробуйте знову через кілька секунд.",
                "code": "parallel"
            }), 429

        # Оновлюємо час запиту
        last_requests[key] = now

        result = f(*args, **kwargs)

        # Видаляємо запис після завершення (щоб уникнути блокування нових запитів)
        time.sleep(0.5)  # Невелика затримка для запобігання миттєвим повторним запитам
        last_requests.pop(key, None)

        return result

    return decorated_function


def register_raffles_routes(app):
    """Реєстрація маршрутів для системи розіграшів"""

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
                    "message": "Користувача не знайдено"
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
                "message": f"Помилка сервера: {str(e)}"
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
    def api_get_raffle_details(raffle_id):
        """Отримання деталей конкретного розіграшу"""
        return controllers.get_raffle_details(raffle_id)

    @app.route('/api/user/<telegram_id>/participate-raffle', methods=['POST'])
    @require_authentication
    @rate_limit('participate_in_raffle')
    def api_participate_in_raffle(telegram_id):
        """Участь у розіграші"""
        # Перевіряємо, чи ID користувача в URL відповідає ID в токені
        if g.user != telegram_id:
            return jsonify({
                "status": "error",
                "message": "Доступ заборонено. Ви можете використовувати лише власний ID."
            }), 403

        return controllers.participate_in_raffle(telegram_id, request.json)

    @app.route('/api/user/<telegram_id>/raffles', methods=['GET'])
    @require_authentication
    @rate_limit('get_user_raffles')
    @parallel_request_handler
    def api_get_user_raffles(telegram_id):
        """Отримання розіграшів, у яких бере участь користувач"""
        # Перевіряємо, чи ID користувача в URL відповідає ID в токені
        if g.user != telegram_id:
            return jsonify({
                "status": "error",
                "message": "Доступ заборонено. Ви можете переглядати лише власні розіграші."
            }), 403

        return controllers.get_user_raffles(telegram_id)

    @app.route('/api/user/<telegram_id>/raffles-history', methods=['GET'])
    @require_authentication
    @rate_limit('get_raffles_history')
    @parallel_request_handler
    def api_get_user_raffles_history(telegram_id):
        """Отримання історії участі користувача в розіграшах"""
        start_time = time.time()

        # Перевіряємо, чи ID користувача в URL відповідає ID в токені
        if g.user != telegram_id:
            return jsonify({
                "status": "error",
                "message": "Доступ заборонено. Ви можете переглядати лише власну історію."
            }), 403

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
                "error": str(e)
            })

    @app.route('/api/user/<telegram_id>/claim-newbie-bonus', methods=['POST'])
    @require_authentication
    def api_claim_newbie_bonus(telegram_id):
        """Отримання бонусу новачка"""
        # Перевіряємо, чи ID користувача в URL відповідає ID в токені
        if g.user != telegram_id:
            return jsonify({
                "status": "error",
                "message": "Доступ заборонено. Ви можете отримати бонус лише для себе."
            }), 403

        return controllers.claim_newbie_bonus(telegram_id)

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
    def api_update_raffle(raffle_id):
        """Оновлення розіграшу (для адміністраторів)"""
        admin_id = request.headers.get('X-Admin-Id')
        return controllers.update_raffle(raffle_id, request.json, admin_id)

    @app.route('/api/admin/raffles/<raffle_id>', methods=['DELETE'])
    @require_admin
    def api_delete_raffle(raffle_id):
        """Видалення розіграшу (для адміністраторів)"""
        admin_id = request.headers.get('X-Admin-Id')
        return controllers.delete_raffle(raffle_id, admin_id)

    @app.route('/api/admin/raffles/<raffle_id>/finish', methods=['POST'])
    @require_admin
    def api_finish_raffle(raffle_id):
        """Примусове завершення розіграшу (для адміністраторів)"""
        admin_id = request.headers.get('X-Admin-Id')
        return controllers.finish_raffle(raffle_id, admin_id)

    @app.route('/api/admin/raffles/<raffle_id>/participants', methods=['GET'])
    @require_admin
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
                "message": "Помилка отримання статистики розіграшів"
            }), 500

