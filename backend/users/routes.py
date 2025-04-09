from flask import request, jsonify
from . import controllers

def register_user_routes(app):
    @app.route('/api/user/<telegram_id>', methods=['GET'])
    def api_get_user_profile(telegram_id):
        """Отримання даних користувача"""
        return controllers.get_user_profile(telegram_id)


    @app.route('/api/user/<telegram_id>/balance', methods=['GET'])
    def api_get_user_balance(telegram_id):
        """Отримання балансу користувача"""
        return controllers.get_user_balance(telegram_id)


    @app.route('/api/user/<telegram_id>/balance', methods=['POST'])
    def api_update_user_balance(telegram_id):
        """Оновлення балансу користувача"""
        return controllers.update_user_balance(telegram_id, request.json)


    @app.route('/api/user/<telegram_id>/claim-badge-reward', methods=['POST'])
    def api_claim_badge_reward(telegram_id):
        """Отримання нагороди за бейдж"""
        return controllers.claim_badge_reward(telegram_id, request.json)


    @app.route('/api/user/<telegram_id>/claim-newbie-bonus', methods=['POST'])
    def api_claim_newbie_bonus(telegram_id):
        """Отримання бонусу новачка"""
        return controllers.claim_newbie_bonus(telegram_id)


    @app.route('/api/user/<telegram_id>/settings', methods=['GET'])
    def api_get_user_settings(telegram_id):
        """Отримання налаштувань користувача"""
        return controllers.get_user_settings(telegram_id)


    @app.route('/api/user/<telegram_id>/settings', methods=['POST'])
    def api_update_user_settings(telegram_id):
        """Оновлення налаштувань користувача"""
        return controllers.update_user_settings(telegram_id, request.json)

    @app.route('/api/user/<telegram_id>/seed-phrase', methods=['GET'])
    def api_get_user_seed_phrase(telegram_id):
        """Отримання seed-фрази користувача"""
        return controllers.get_user_seed_phrase(telegram_id)