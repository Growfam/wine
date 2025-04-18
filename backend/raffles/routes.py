"""
Route handlers для системи розіграшів WINIX
Виправлена версія з оптимізованою реєстрацією маршрутів та обробкою помилок
"""

import logging
import time
import traceback
from datetime import datetime, timezone
from flask import jsonify, request, g

# Налаштування логування
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Імпортуємо контролери - виправлений блок імпорту
try:
    # Спроба відносного імпорту
    from . import controllers
except ImportError:
    logger.error("Помилка імпорту контролерів через відносний шлях")
    try:
        # Спроба абсолютного імпорту (для різних середовищ)
        from backend.raffles import controllers
    except ImportError:
        try:
            # Спроба прямого імпорту
            import controllers
        except ImportError:
            # Останній рятівний варіант
            logger.critical("Критична помилка: не вдалося імпортувати контролери")
            controllers = None

# Спроба імпорту Supabase з правильною обробкою помилок
try:
    from supabase_client import supabase
except ImportError:
    logger.warning("Не вдалося імпортувати supabase_client. Деякі функції будуть недоступні")
    supabase = None

# Часові обмеження для маршрутів
RATE_LIMITS = {
    "get_active_raffles": 20,
    "get_raffles_history": 180,
    "get_user_raffles": 30,
    "participate_in_raffle": 30,
}

# Відстеження останніх запитів користувачів
last_requests = {}

# Спрощений декоратор для авторизації
def light_authentication(f):
    """Спрощений декоратор, який не блокує запити без авторизації"""
    def decorated_function(*args, **kwargs):
        try:
            # Отримуємо токен з заголовків
            auth_header = request.headers.get("Authorization", "")
            if auth_header and auth_header.startswith("Bearer "):
                token = auth_header.split(" ")[1]
                g.token = token

            # Отримуємо ID користувача з різних джерел
            user_id = (
                request.headers.get('X-Telegram-User-Id') or
                kwargs.get('telegram_id') or
                request.args.get('id')
            )
            if user_id:
                g.user = user_id

            return f(*args, **kwargs)
        except Exception as e:
            logger.error(f"Помилка в декораторі light_authentication: {str(e)}")
            # Все одно пропускаємо запит
            return f(*args, **kwargs)

    return decorated_function

# Перевірка валідності UUID
def is_valid_uuid(uuid_string):
    """Перевірка валідності UUID з детальною обробкою помилок"""
    # Перевірка на None та порожні рядки
    if not uuid_string:
        logger.warning("UUID пустий або None")
        return False

    # Перевірка на мінімальну довжину
    if len(str(uuid_string)) < 32:
        logger.warning(f"UUID занадто короткий ({len(str(uuid_string))} символів): {uuid_string}")
        return False

    try:
        # Спроба перетворити рядок в UUID об'єкт
        import uuid as uuid_module
        uuid_obj = uuid_module.UUID(str(uuid_string))
        # Перевіряємо рядкове представлення
        return str(uuid_obj) == str(uuid_string)
    except (ValueError, AttributeError, TypeError) as e:
        logger.warning(f"Некоректний UUID {uuid_string}: {str(e)}")
        return False

def register_raffles_routes(app):
    """Реєстрація маршрутів для системи розіграшів"""
    logger.info("Початок реєстрації маршрутів розіграшів")

    # Перевірка, чи контролери доступні
    if controllers is None:
        logger.error("Не вдалося зареєструвати маршрути розіграшів: контролери недоступні")
        return False

    # Діагностичний маршрут
    @app.route('/api/raffles/check', methods=['GET'])
    def api_raffles_check():
        """Перевірка доступності API розіграшів"""
        return jsonify({
            "status": "success",
            "message": "API розіграшів працює",
            "timestamp": datetime.now(timezone.utc).isoformat()
        })

    # Маршрути для розіграшів
    @app.route('/api/raffles', methods=['GET'])
    @light_authentication
    def api_get_active_raffles():
        """Отримання списку активних розіграшів"""
        start_time = time.time()
        try:
            logger.info("api_get_active_raffles: Запит отримано")
            result = controllers.get_active_raffles()
            execution_time = time.time() - start_time
            logger.info(f"api_get_active_raffles: виконано за {execution_time:.4f}с")
            return result
        except Exception as e:
            execution_time = time.time() - start_time
            logger.error(f"api_get_active_raffles: помилка за {execution_time:.4f}с - {str(e)}")
            traceback.print_exc()
            # Повертаємо порожній масив при помилці
            return jsonify({
                "status": "success",
                "data": [],
                "error": str(e)
            })

    @app.route('/api/raffles/<raffle_id>', methods=['GET'])
    @light_authentication
    def api_get_raffle_details(raffle_id):
        """Отримання деталей конкретного розіграшу"""
        try:
            logger.info(f"api_get_raffle_details: Запит отримано для {raffle_id}")
            if not is_valid_uuid(raffle_id):
                return jsonify({
                    "status": "error",
                    "message": f"Невалідний формат ID розіграшу: {raffle_id}",
                    "code": "invalid_raffle_id"
                }), 400

            return controllers.get_raffle_details(raffle_id)
        except Exception as e:
            logger.error(f"Помилка отримання деталей розіграшу {raffle_id}: {str(e)}")
            traceback.print_exc()
            return jsonify({
                "status": "error",
                "message": f"Помилка отримання деталей розіграшу: {str(e)}",
                "code": "server_error"
            }), 500

    @app.route('/api/user/<telegram_id>/raffles', methods=['GET'])
    @light_authentication
    def api_get_user_raffles(telegram_id):
        """Отримання розіграшів, у яких бере участь користувач"""
        try:
            logger.info(f"api_get_user_raffles: Запит отримано для {telegram_id}")
            return controllers.get_user_raffles(telegram_id)
        except Exception as e:
            logger.error(f"Помилка отримання розіграшів користувача {telegram_id}: {str(e)}")
            traceback.print_exc()
            # Повертаємо порожній масив при помилці
            return jsonify({
                "status": "success",
                "data": [],
                "error_details": str(e)
            })

    @app.route('/api/user/<telegram_id>/raffles-history', methods=['GET'])
    @light_authentication
    def api_get_user_raffles_history(telegram_id):
        """Отримання історії участі користувача в розіграшах"""
        start_time = time.time()
        try:
            logger.info(f"api_get_user_raffles_history: Запит отримано для {telegram_id}")
            result = controllers.get_raffles_history(telegram_id)
            execution_time = time.time() - start_time
            logger.info(f"api_get_user_raffles_history: виконано за {execution_time:.4f}с")
            return result
        except Exception as e:
            execution_time = time.time() - start_time
            logger.error(f"api_get_user_raffles_history: помилка за {execution_time:.4f}с - {str(e)}")
            traceback.print_exc()
            # Повертаємо порожній масив при помилці
            return jsonify({
                "status": "success",
                "data": [],
                "error_details": str(e)
            })

    @app.route('/api/user/<telegram_id>/participate-raffle', methods=['POST'])
    @light_authentication
    def api_participate_in_raffle(telegram_id):
        """Участь у розіграші"""
        try:
            logger.info(f"api_participate_in_raffle: Запит отримано для {telegram_id}")
            # Перевірка JSON
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

            # Перевірка валідності UUID
            raffle_id = data.get('raffle_id')
            if not is_valid_uuid(str(raffle_id)):
                return jsonify({
                    "status": "error",
                    "message": f"Невалідний формат ID розіграшу: {raffle_id}",
                    "code": "invalid_raffle_id"
                }), 400

            return controllers.participate_in_raffle(telegram_id, data)
        except Exception as e:
            logger.error(f"Помилка участі в розіграші: {str(e)}")
            traceback.print_exc()
            return jsonify({
                "status": "error",
                "message": f"Виникла помилка при участі в розіграші: {str(e)}",
                "code": "server_error"
            }), 500

    # Додаткові діагностичні маршрути
    @app.route('/api/debug/routes', methods=['GET'])
    def api_debug_routes():
        """Повертає список всіх зареєстрованих маршрутів"""
        routes = []
        for rule in app.url_map.iter_rules():
            routes.append({
                "endpoint": rule.endpoint,
                "methods": list(rule.methods),
                "path": str(rule)
            })

        raffle_routes = [r for r in routes if 'raffle' in r['path'].lower()]

        return jsonify({
            "status": "success",
            "total_routes": len(routes),
            "raffle_routes": len(raffle_routes),
            "routes": sorted(raffle_routes, key=lambda x: x["path"])
        })

    logger.info("Маршрути для розіграшів успішно зареєстровано")
    return True