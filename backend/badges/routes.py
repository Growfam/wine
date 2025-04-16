from flask import request, jsonify
from . import controllers


def register_badges_routes(app):
    @app.route('/api/user/<telegram_id>/badges', methods=['GET'])
    def api_get_available_badges(telegram_id):
        """Отримання інформації про доступні бейджі користувача"""
        return controllers.get_available_badges(telegram_id)

    @app.route('/api/user/<telegram_id>/claim-badge-reward', methods=['POST'])
    def api_claim_badge_reward(telegram_id):
        """Отримання нагороди за бейдж"""
        data = request.json
        if not data or "badge_id" not in data:
            return jsonify({
                "status": "error",
                "message": "Необхідно вказати ID бейджу (badge_id)"
            }), 400

        badge_id = data["badge_id"]
        return controllers.claim_badge_reward_handler(telegram_id, badge_id)