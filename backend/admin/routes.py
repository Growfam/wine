from flask import request, jsonify
from . import controllers

def register_admin_routes(app):
    @app.route('/api/admin/users', methods=['GET'])
    def api_admin_get_users():
        """Отримання списку користувачів (тільки для адміністраторів)"""
        return controllers.admin_get_users()


    @app.route('/api/admin/users/<user_id>', methods=['GET'])
    def api_admin_get_user(user_id):
        """Отримання даних конкретного користувача (тільки для адміністраторів)"""
        return controllers.admin_get_user(user_id)


    @app.route('/api/admin/users/<user_id>', methods=['PUT'])
    def api_admin_update_user(user_id):
        """Оновлення даних конкретного користувача (тільки для адміністраторів)"""
        return controllers.admin_update_user(user_id, request.json)


    @app.route('/api/admin/users/<user_id>/transaction', methods=['POST'])
    def api_admin_create_transaction(user_id):
        """Створення транзакції для користувача (тільки для адміністраторів)"""
        return controllers.admin_create_transaction(user_id, request.json)


    @app.route('/api/admin/transactions', methods=['GET'])
    def api_admin_get_transactions():
        """Отримання останніх транзакцій (тільки для адміністраторів)"""
        return controllers.admin_get_transactions()