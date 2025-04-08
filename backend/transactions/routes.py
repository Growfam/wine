from flask import request, jsonify
from . import controllers

def register_transactions_routes(app):
    @app.route('/api/user/<telegram_id>/transactions', methods=['GET'])
    def api_get_user_transactions(telegram_id):
        """Отримання транзакцій користувача"""
        return controllers.get_user_transactions(telegram_id)


    @app.route('/api/user/<telegram_id>/transaction', methods=['POST'])
    def api_add_user_transaction(telegram_id):
        """Додавання нової транзакції"""
        return controllers.add_user_transaction(telegram_id, request.json)


    @app.route('/api/user/<telegram_id>/send', methods=['POST'])
    def api_send_transaction(telegram_id):
        """Створення транзакції надсилання коштів"""
        data = request.json
        if not data or 'to_address' not in data or 'amount' not in data:
            return jsonify({"status": "error", "message": "Відсутні необхідні дані"}), 400

        return controllers.create_send_transaction(telegram_id, data['to_address'], data['amount'])


    @app.route('/api/user/<telegram_id>/receive', methods=['POST'])
    def api_receive_transaction(telegram_id):
        """Створення транзакції отримання коштів"""
        data = request.json
        if not data or 'from_address' not in data or 'amount' not in data:
            return jsonify({"status": "error", "message": "Відсутні необхідні дані"}), 400

        return controllers.create_receive_transaction(telegram_id, data['from_address'], data['amount'])