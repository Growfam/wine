from flask import request, jsonify
from . import controllers

def register_referrals_routes(app):
    @app.route('/api/user/<telegram_id>/referral-tasks', methods=['GET'])
    def api_get_referral_tasks(telegram_id):
        """Отримання статусу реферальних завдань"""
        return controllers.get_referral_tasks(telegram_id)


    @app.route('/api/user/<telegram_id>/claim-referral-reward', methods=['POST'])
    def api_claim_referral_reward(telegram_id):
        """Отримання винагороди за реферальне завдання"""
        return controllers.claim_referral_reward(telegram_id, request.json)


    @app.route('/api/user/<telegram_id>/invite-referral', methods=['POST'])
    def api_invite_referral(telegram_id):
        """Запросити нового реферала"""
        return controllers.invite_referral(telegram_id, request.json)