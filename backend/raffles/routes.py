from flask import request, jsonify
from . import controllers

def register_raffles_routes(app):
    @app.route('/api/raffles', methods=['GET'])
    def api_get_active_raffles():
        """Отримання списку активних розіграшів"""
        return controllers.get_active_raffles()


    @app.route('/api/user/<telegram_id>/raffles', methods=['GET'])
    def api_get_user_raffles(telegram_id):
        """Отримання розіграшів, у яких бере участь користувач"""
        return controllers.get_user_raffles(telegram_id)


    @app.route('/api/user/<telegram_id>/participate-raffle', methods=['POST'])
    def api_participate_in_raffle(telegram_id):
        """Участь у розіграші"""
        return controllers.participate_in_raffle(telegram_id, request.json)