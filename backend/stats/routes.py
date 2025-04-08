from flask import request, jsonify
from . import controllers

def register_stats_routes(app):
    @app.route('/api/user/<telegram_id>/stats', methods=['GET'])
    def api_get_user_stats(telegram_id):
        """Отримання статистики користувача"""
        return controllers.get_user_stats(telegram_id)


    @app.route('/api/leaderboard', methods=['GET'])
    def api_get_leaderboard():
        """Отримання списку лідерів за балансом"""
        return controllers.get_leaderboard()


    @app.route('/api/stats', methods=['GET'])
    def api_get_system_stats():
        """Отримання загальної статистики системи"""
        return controllers.get_system_stats()