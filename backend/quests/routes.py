"""
Модуль для реєстрації маршрутів API для завдань та бонусів.
Визначає всі API ендпойнти для системи завдань WINIX.
"""
from flask import request, jsonify, make_response
import logging
from datetime import datetime
from common.helpers import safe_get_user_id

# Імпорт контролерів з розділених файлів
from quests.task_controllers import (
    create_new_task, update_existing_task, delete_task_by_id,
    get_all_tasks, get_tasks_by_type, get_referral_tasks,
    get_tasks_for_user, get_task_details, start_task,
    update_task_progress, verify_task, get_user_progress, get_task_status
)
from quests.leaderboard_controllers import (
    get_referrals_leaderboard, get_tasks_leaderboard, get_user_leaderboard_position
)
from quests.bonus_controllers import (
    get_daily_bonus_status, claim_daily_bonus, claim_streak_bonus,
    get_bonus_history, verify_subscription
)

# Налаштування логування
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


def register_quests_routes(app):
    """
    Реєстрація всіх маршрутів для API завдань та бонусів.

    Args:
        app: Екземпляр Flask-додатку
    """
    logger.info("Реєстрація маршрутів API для завдань та бонусів")

    # CORS middleware для всіх запитів
    @app.after_request
    def add_cors_headers(response):
        """Додає CORS заголовки до всіх відповідей"""
        # Дозволяємо всі домени (в продакшені може бути обмежено)
        response.headers.add('Access-Control-Allow-Origin', '*')
        # Дозволяємо всі методи
        response.headers.add('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        # Дозволяємо всі заголовки
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Telegram-User-Id')
        # Кешування preflight запитів
        response.headers.add('Access-Control-Max-Age', '3600')
        return response

    # Окремий обробник для OPTIONS запитів (preflight)
    @app.route('/', defaults={'path': ''}, methods=['OPTIONS'])
    @app.route('/<path:path>', methods=['OPTIONS'])
    def handle_options(path):
        """Обробляє OPTIONS запити для CORS preflight"""
        response = make_response()
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        response.headers.add('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Telegram-User-Id')
        response.headers.add('Access-Control-Max-Age', '3600')
        return response

    # Ендпоінт для перевірки доступності API
    @app.route('/api/ping', methods=['GET'])
    def api_ping():
        """Простий ендпоінт для перевірки доступності API"""
        return jsonify({
            "status": "success",
            "message": "API доступний",
            "timestamp": datetime.now().isoformat(),
            "server_time": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
        })

    # ============ МАРШРУТИ ДЛЯ ЗАВДАНЬ ============

    # Отримання завдань
    @app.route('/api/quests/tasks', methods=['GET'])
    def api_get_all_tasks():
        """Отримання всіх завдань"""
        return get_all_tasks()

    @app.route('/api/quests/tasks/<task_type>', methods=['GET'])
    def api_get_tasks_by_type(task_type):
        """Отримання завдань за типом"""
        return get_tasks_by_type(task_type)

    @app.route('/api/quests/tasks/social', methods=['GET'])
    def api_get_social_tasks():
        """Отримання соціальних завдань"""
        return get_tasks_by_type("social")

    @app.route('/api/quests/tasks/limited', methods=['GET'])
    def api_get_limited_tasks():
        """Отримання обмежених за часом завдань"""
        return get_tasks_by_type("limited")

    @app.route('/api/quests/tasks/partners', methods=['GET'])
    def api_get_partner_tasks():
        """Отримання партнерських завдань"""
        return get_tasks_by_type("partner")

    @app.route('/api/quests/tasks/referral', methods=['GET'])
    def api_get_referral_tasks():
        """Отримання реферальних завдань"""
        return get_referral_tasks()

    @app.route('/api/quests/tasks/<task_id>/details', methods=['GET'])
    def api_get_task_details(task_id):
        """Отримання детальної інформації про завдання"""
        return get_task_details(task_id)

    # Адміністративні маршрути для завдань
    @app.route('/api/quests/tasks/create', methods=['POST'])
    def api_create_task():
        """Створення нового завдання (тільки для адміністраторів)"""
        return create_new_task(request.json)

    @app.route('/api/quests/tasks/<task_id>/update', methods=['PUT'])
    def api_update_task(task_id):
        """Оновлення існуючого завдання (тільки для адміністраторів)"""
        return update_existing_task(task_id, request.json)

    @app.route('/api/quests/tasks/<task_id>/delete', methods=['DELETE'])
    def api_delete_task(task_id):
        """Видалення завдання (тільки для адміністраторів)"""
        return delete_task_by_id(task_id)

    # Маршрути для роботи з прогресом завдань
    @app.route('/api/user/<telegram_id>/tasks', methods=['GET'])
    def api_get_user_tasks(telegram_id):
        """Отримання завдань для користувача"""
        return get_tasks_for_user(telegram_id)

    @app.route('/api/user/<telegram_id>/tasks/<task_id>/status', methods=['GET'])
    def api_get_task_status(telegram_id, task_id):
        """Отримання статусу конкретного завдання для користувача"""
        return get_task_status(telegram_id, task_id)

    @app.route('/api/user/<telegram_id>/tasks/<task_id>/start', methods=['POST'])
    def api_start_task(telegram_id, task_id):
        """Початок виконання завдання"""
        return start_task(telegram_id, task_id)

    @app.route('/api/user/<telegram_id>/tasks/<task_id>/progress', methods=['POST'])
    def api_update_task_progress(telegram_id, task_id):
        """Оновлення прогресу виконання завдання"""
        return update_task_progress(telegram_id, task_id)

    @app.route('/api/user/<telegram_id>/tasks/<task_id>/verify', methods=['POST'])
    def api_verify_task(telegram_id, task_id):
        """Верифікація виконання завдання"""
        return verify_task(telegram_id, task_id)

    @app.route('/api/user/<telegram_id>/progress', methods=['GET'])
    def api_get_user_progress(telegram_id):
        """Отримання прогресу користувача для всіх завдань"""
        return get_user_progress(telegram_id)

    # ============ МАРШРУТИ ДЛЯ ЩОДЕННИХ БОНУСІВ ============

    @app.route('/api/user/<telegram_id>/daily-bonus', methods=['GET'])
    def api_get_daily_bonus_status(telegram_id):
        """Отримання статусу щоденного бонусу"""
        return get_daily_bonus_status(telegram_id)

    @app.route('/api/user/<telegram_id>/claim-daily-bonus', methods=['POST'])
    def api_claim_daily_bonus(telegram_id):
        """Отримання щоденного бонусу"""
        return claim_daily_bonus(telegram_id, request.json)

    @app.route('/api/user/<telegram_id>/claim-streak-bonus', methods=['POST'])
    def api_claim_streak_bonus(telegram_id):
        """Отримання бонусу за стрік щоденних входів"""
        return claim_streak_bonus(telegram_id)

    @app.route('/api/user/<telegram_id>/bonus-history', methods=['GET'])
    def api_get_bonus_history(telegram_id):
        """Отримання історії щоденних бонусів"""
        return get_bonus_history(telegram_id)

    # ВИПРАВЛЕНО: Додаткові маршрути для сумісності з фронтендом
    @app.route('/api/daily-bonus/status', methods=['POST'])
    def api_daily_bonus_status():
        """Отримання статусу щоденного бонусу (для сумісності)"""
        data = request.json
        user_id = data.get('user_id')
        if not user_id:
            return jsonify({
                "success": False,
                "error": "ID користувача не вказано"
            }), 400
        return get_daily_bonus_status(user_id)

    @app.route('/api/daily-bonus/claim', methods=['POST'])
    def api_daily_bonus_claim():
        """Отримання щоденного бонусу (для сумісності)"""
        data = request.json
        user_id = data.get('user_id')
        if not user_id:
            return jsonify({
                "success": False,
                "error": "ID користувача не вказано"
            }), 400
        return claim_daily_bonus(user_id, data)

    @app.route('/api/daily-bonus/history', methods=['POST'])
    def api_daily_bonus_history():
        """Отримання історії щоденних бонусів (для сумісності)"""
        data = request.json
        user_id = data.get('user_id')
        if not user_id:
            return jsonify({
                "success": False,
                "error": "ID користувача не вказано"
            }), 400
        return get_bonus_history(user_id)

    # ============ МАРШРУТИ ДЛЯ ВЕРИФІКАЦІЇ СОЦІАЛЬНИХ МЕРЕЖ ============

    @app.route('/api/user/<telegram_id>/verify-subscription', methods=['POST'])
    def api_verify_subscription(telegram_id):
        """Перевірка підписки на соціальну мережу"""
        return verify_subscription(telegram_id, request.json)

    # ============ МАРШРУТИ ДЛЯ ЛІДЕРБОРДУ ============

    @app.route('/api/leaderboard/referrals', methods=['GET'])
    def api_get_referrals_leaderboard():
        """Отримання лідерборду по рефералам"""
        return get_referrals_leaderboard()

    @app.route('/api/leaderboard/tasks', methods=['GET'])
    def api_get_tasks_leaderboard():
        """Отримання лідерборду по завданням"""
        return get_tasks_leaderboard()

    @app.route('/api/user/<telegram_id>/leaderboard-position', methods=['GET'])
    def api_get_user_leaderboard_position(telegram_id):
        """Отримання позиції користувача в лідерборді"""
        return get_user_leaderboard_position(telegram_id)

    logger.info("Маршрути API для завдань та бонусів успішно зареєстровано")
    return True