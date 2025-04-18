from flask import request, jsonify
from . import controllers

def register_badges_routes(app):
    @app.route('/api/user/<telegram_id>/badges', methods=['GET'])
    def api_get_available_badges(telegram_id):
        """Отримання інформації про доступні бейджі користувача"""
        return controllers.get_available_badges(telegram_id)