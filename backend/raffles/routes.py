from flask import request, jsonify
import logging
from . import controllers

# Налаштування логування
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


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
    def api_participate_in_raffle(telegram_id):
        """Участь у розіграші"""
        return controllers.participate_in_raffle(telegram_id, request.json)

    @app.route('/api/user/<telegram_id>/raffles', methods=['GET'])
    def api_get_user_raffles(telegram_id):
        """Отримання розіграшів, у яких бере участь користувач"""
        return controllers.get_user_raffles(telegram_id)

    @app.route('/api/user/<telegram_id>/raffles-history', methods=['GET'])
    def api_get_user_raffles_history(telegram_id):
        """Отримання історії участі користувача в розіграшах"""
        return controllers.get_user_raffles_history(telegram_id)

    @app.route('/api/user/<telegram_id>/claim-newbie-bonus', methods=['POST'])
    def api_claim_newbie_bonus(telegram_id):
        """Отримання бонусу новачка"""
        return controllers.claim_newbie_bonus(telegram_id)

    # Адміністраторські маршрути

    @app.route('/api/admin/raffles', methods=['GET'])
    def api_get_all_raffles():
        """Отримання всіх розіграшів (для адміністраторів)"""
        admin_id = request.headers.get('X-Admin-User-Id')
        status_filter = request.args.get('status')
        return controllers.get_all_raffles(status_filter, admin_id)

    @app.route('/api/admin/raffles', methods=['POST'])
    def api_create_raffle():
        """Створення нового розіграшу (для адміністраторів)"""
        admin_id = request.headers.get('X-Admin-User-Id')
        return controllers.create_raffle(request.json, admin_id)

    @app.route('/api/admin/raffles/<raffle_id>', methods=['PUT'])
    def api_update_raffle(raffle_id):
        """Оновлення розіграшу (для адміністраторів)"""
        admin_id = request.headers.get('X-Admin-User-Id')
        return controllers.update_raffle(raffle_id, request.json, admin_id)

    @app.route('/api/admin/raffles/<raffle_id>', methods=['DELETE'])
    def api_delete_raffle(raffle_id):
        """Видалення розіграшу (для адміністраторів)"""
        admin_id = request.headers.get('X-Admin-User-Id')
        return controllers.delete_raffle(raffle_id, admin_id)

    @app.route('/api/admin/raffles/<raffle_id>/finish', methods=['POST'])
    def api_finish_raffle(raffle_id):
        """Примусове завершення розіграшу (для адміністраторів)"""
        admin_id = request.headers.get('X-Admin-User-Id')
        return controllers.finish_raffle(raffle_id, admin_id)

    @app.route('/api/admin/raffles/<raffle_id>/participants', methods=['GET'])
    def api_get_raffle_participants(raffle_id):
        """Отримання списку учасників розіграшу (для адміністраторів)"""
        admin_id = request.headers.get('X-Admin-User-Id')
        return controllers.get_raffle_participants(raffle_id, admin_id)

    @app.route('/api/admin/raffles/check-expired', methods=['POST'])
    def api_check_expired_raffles():
        """Перевірка та автоматичне завершення прострочених розіграшів"""
        admin_id = request.headers.get('X-Admin-User-Id')
        result = controllers.check_and_finish_expired_raffles()
        return jsonify(result)