from flask import request, jsonify
from . import controllers

def register_quests_routes(app):
    @app.route('/api/user/<telegram_id>/daily-bonus', methods=['GET'])
    def api_get_daily_bonus_status(telegram_id):
        """Отримання статусу щоденного бонусу"""
        return controllers.get_daily_bonus_status(telegram_id)


    @app.route('/api/user/<telegram_id>/claim-daily-bonus', methods=['POST'])
    def api_claim_daily_bonus(telegram_id):
        """Отримання щоденного бонусу"""
        return controllers.claim_daily_bonus(telegram_id, request.json)


    @app.route('/api/user/<telegram_id>/verify-subscription', methods=['POST'])
    def api_verify_subscription(telegram_id):
        """Перевірка підписки на соціальну мережу"""
        return controllers.verify_subscription(telegram_id, request.json)