from flask import request, jsonify
from . import controllers


def register_transactions_routes(app):
    # Перевіряємо, чи вже є ці ендпоінти
    existing_endpoints = [rule.endpoint for rule in app.url_map.iter_rules()]

    @app.route('/api/user/<telegram_id>/transactions', methods=['GET'], endpoint='transactions_get_user_transactions')
    def api_get_user_transactions(telegram_id):
        """Отримання транзакцій користувача"""
        # Перевіряємо, чи є обмеження по кількості та тип транзакцій
        limit = request.args.get('limit', None)
        transaction_type = request.args.get('type', None)

        if limit and limit.isdigit():
            if transaction_type and transaction_type != 'all':
                # Якщо вказано тип транзакції, використовуємо фільтрацію
                return controllers.get_recent_transactions_by_type(telegram_id, int(limit), transaction_type)
            else:
                # Якщо тип не вказано, отримуємо останні транзакції без фільтрації
                return controllers.get_recent_transactions(telegram_id, int(limit))
        else:
            # Якщо ліміт не вказано, отримуємо всі транзакції (можливо з фільтром)
            return controllers.get_user_transactions(telegram_id, transaction_type)

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

        note = data.get('note', None)
        return controllers.create_send_transaction(telegram_id, data['to_address'], data['amount'], note)

    @app.route('/api/user/<telegram_id>/receive', methods=['POST'])
    def api_receive_transaction(telegram_id):
        """Створення транзакції отримання коштів"""
        data = request.json
        if not data or 'from_address' not in data or 'amount' not in data:
            return jsonify({"status": "error", "message": "Відсутні необхідні дані"}), 400

        note = data.get('note', None)
        return controllers.create_receive_transaction(telegram_id, data['from_address'], data['amount'], note)

    @app.route('/api/send_tokens', methods=['POST'])
    def api_send_tokens():
        """API-endpoint для переказу токенів між користувачами"""
        try:
            data = request.json

            # Перевіряємо наявність необхідних даних
            if not data or 'sender_id' not in data or 'receiver_id' not in data or 'amount' not in data:
                return jsonify({
                    "status": "error",
                    "message": "Відсутні необхідні дані"
                }), 400

            sender_id = data['sender_id']
            receiver_id = data['receiver_id']
            amount = data['amount']
            note = data.get('note', '')

            # Викликаємо функцію контролера для обробки переказу
            return controllers.transfer_tokens(sender_id, receiver_id, amount, note)

        except Exception as e:
            return jsonify({
                "status": "error",
                "message": str(e)
            }), 500

    # Додаємо маршрути для seed phrase з перевіркою на існування
    if 'api_update_user_password' not in existing_endpoints:
        @app.route('/api/user/<telegram_id>/password', methods=['POST'], endpoint='transactions_update_user_password')
        def api_update_user_password(telegram_id):
            """Оновлення пароля користувача"""
            return controllers.update_user_password(telegram_id, request.json)
    else:
        print("Маршрут /api/user/<telegram_id>/password вже зареєстровано")

    @app.route('/api/user/<telegram_id>/verify-password', methods=['POST'])
    def api_verify_user_password(telegram_id):
        """Перевірка пароля користувача"""
        return controllers.verify_user_password(telegram_id, request.json)

    @app.route('/api/user/<telegram_id>/seed-phrase/protected', methods=['POST'])
    def api_get_protected_seed_phrase(telegram_id):
        """Отримання seed-фрази користувача після перевірки пароля"""
        # Перевіряємо, чи є пароль у запиті
        if not request.json or "password" not in request.json:
            return jsonify({"status": "error", "message": "Пароль обов'язковий"}), 400

        # Перевіряємо пароль
        verify_result = controllers.verify_user_password(telegram_id, request.json)

        # Якщо пароль невірний, повертаємо помилку
        if isinstance(verify_result, tuple) and verify_result[1] != 200:
            return verify_result

        # Якщо пароль вірний, повертаємо seed-фразу
        return controllers.get_user_seed_phrase(telegram_id, show_password_protected=False)

    return True