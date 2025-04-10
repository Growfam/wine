from flask import request, jsonify, g
import logging
import jwt
import os
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

# Секретний ключ для JWT
JWT_SECRET = os.getenv("JWT_SECRET", "your-secret-key-here")
JWT_ALGORITHM = "HS256"


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


def register_raffles_routes(app):
    """Реєстрація маршрутів для системи розіграшів"""

    # Публічні маршрути для користувачів
    @app.route('/api/raffles', methods=['GET'])
    def api_get_active_raffles():
        """Отримання списку активних розіграшів"""
        return controllers.get_active_raffles()

    @app.route('/api/raffles/<raffle_id>', methods=['GET'])
    def api_get_raffle_details(raffle_id):
        """Отримання деталей конкретного розіграшу"""
        return controllers.get_raffle_details(raffle_id)

    @app.route('/api/user/<telegram_id>/participate-raffle', methods=['POST'])
    @require_authentication
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
    def api_get_user_raffles_history(telegram_id):
        """Отримання історії участі користувача в розіграшах"""
        # Перевіряємо, чи ID користувача в URL відповідає ID в токені
        if g.user != telegram_id:
            return jsonify({
                "status": "error",
                "message": "Доступ заборонено. Ви можете переглядати лише власну історію."
            }), 403

        return controllers.get_user_raffles_history(telegram_id)

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