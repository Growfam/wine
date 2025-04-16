"""
Модуль маршрутів для API користувачів WINIX.
Покращена версія з оптимізованою структурою та додатковими ендпоінтами.
"""

from flask import request, jsonify
from . import controllers


def register_user_routes(app):
    """
    Реєстрація всіх маршрутів, пов'язаних з користувачами.

    Args:
        app: Екземпляр Flask-додатку
    """

    # ====== ОСНОВНІ МАРШРУТИ КОРИСТУВАЧА ======

    @app.route('/api/user/<telegram_id>', methods=['GET'])
    def api_get_user_profile(telegram_id):
        """Отримання повного профілю користувача"""
        return controllers.get_user_profile(telegram_id)

    @app.route('/api/user/<telegram_id>/init_data', methods=['GET'])
    def api_get_user_init_data(telegram_id):
        """Отримання всіх початкових даних користувача одним запитом"""
        return controllers.get_user_init_data(telegram_id)

    @app.route('/api/user/<telegram_id>/balance', methods=['GET'])
    def api_get_user_balance(telegram_id):
        """Отримання балансу користувача"""
        return controllers.get_user_balance(telegram_id)

    @app.route('/api/user/<telegram_id>/balance', methods=['POST'])
    def api_update_user_balance(telegram_id):
        """Оновлення балансу користувача"""
        return controllers.update_user_balance(telegram_id, request.json)

    # ====== МАРШРУТИ НАЛАШТУВАНЬ ======

    @app.route('/api/user/<telegram_id>/settings', methods=['GET'])
    def api_get_user_settings(telegram_id):
        """Отримання налаштувань користувача"""
        return controllers.get_user_settings(telegram_id)

    @app.route('/api/user/<telegram_id>/settings', methods=['POST'])
    def api_update_user_settings(telegram_id):
        """Оновлення налаштувань користувача"""
        return controllers.update_user_settings(telegram_id, request.json)

    @app.route('/api/user/<telegram_id>/password', methods=['POST'])
    def api_update_user_password(telegram_id):
        """Оновлення пароля користувача"""
        return controllers.update_user_password(telegram_id, request.json)

    # ====== МАРШРУТИ ВИНАГОРОД ======

    @app.route('/api/user/<telegram_id>/claim-badge-reward', methods=['POST'])
    def api_claim_badge_reward(telegram_id):
        """Отримання нагороди за бейдж"""
        return controllers.claim_badge_reward(telegram_id, request.json)

    @app.route('/api/user/<telegram_id>/claim-newbie-bonus', methods=['POST'])
    def api_claim_newbie_bonus(telegram_id):
        """Отримання бонусу новачка"""
        return controllers.claim_newbie_bonus(telegram_id)

    # ====== МАРШРУТИ ЖЕТОНІВ ======

    @app.route('/api/user/<telegram_id>/coins', methods=['POST'])
    def api_update_user_coins(telegram_id):
        """Оновлення кількості жетонів користувача"""
        return controllers.update_user_coins(telegram_id, request.json)

    @app.route('/api/user/<telegram_id>/add-coins', methods=['POST'])
    def api_add_user_coins(telegram_id):
        """Додавання жетонів користувачу"""
        return controllers.add_user_coins(telegram_id, request.json)

    # ====== МАРШРУТИ ТРАНЗАКЦІЙ ======

    @app.route('/api/user/<telegram_id>/transactions', methods=['GET'])
    def api_get_user_transactions(telegram_id):
        """Отримання історії транзакцій користувача"""
        limit = request.args.get('limit', 50)
        offset = request.args.get('offset', 0)
        return controllers.get_user_transactions(telegram_id, limit, offset)

    # ====== ІНШІ МАРШРУТИ ======

    @app.route('/api/user/<telegram_id>/seed-phrase', methods=['GET'])
    def api_get_user_seed_phrase(telegram_id):
        """Отримання seed-фрази користувача"""
        return controllers.get_user_seed_phrase(telegram_id)