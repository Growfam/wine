from flask import request, jsonify
from . import balance

def register_wallet_routes(app):
    @app.route('/api/user/<telegram_id>/complete-balance', methods=['GET'])
    def api_get_user_complete_balance(telegram_id):
        """Отримання повної інформації про баланс користувача"""
        return balance.get_user_complete_balance(telegram_id)


    @app.route('/api/user/<telegram_id>/add-tokens', methods=['POST'])
    def api_add_tokens(telegram_id):
        """Додавання токенів до балансу користувача"""
        return balance.add_tokens(telegram_id, request.json)


    @app.route('/api/user/<telegram_id>/subtract-tokens', methods=['POST'])
    def api_subtract_tokens(telegram_id):
        """Віднімання токенів з балансу користувача"""
        return balance.subtract_tokens(telegram_id, request.json)


    @app.route('/api/user/<telegram_id>/add-coins', methods=['POST'])
    def api_add_coins(telegram_id):
        """Додавання жетонів до балансу користувача"""
        return balance.add_coins(telegram_id, request.json)


    @app.route('/api/user/<telegram_id>/subtract-coins', methods=['POST'])
    def api_subtract_coins(telegram_id):
        """Віднімання жетонів з балансу користувача"""
        return balance.subtract_coins(telegram_id, request.json)


    @app.route('/api/user/<telegram_id>/convert-coins', methods=['POST'])
    def api_convert_coins_to_tokens(telegram_id):
        """Конвертація жетонів у токени"""
        return balance.convert_coins_to_tokens(telegram_id, request.json)


    @app.route('/api/user/<telegram_id>/check-funds', methods=['POST'])
    def api_check_sufficient_funds(telegram_id):
        """Перевірка достатності коштів для транзакції"""
        return balance.check_sufficient_funds(telegram_id, request.json)