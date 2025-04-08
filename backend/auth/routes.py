from flask import request, jsonify
import logging
from . import controllers

# Налаштування логування
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def register_auth_routes(app):
    @app.route('/api/auth', methods=['POST'])
    def auth_user():
        """Авторизація користувача"""
        try:
            data = request.json
            logger.info(f"auth_user: Отримано запит на авторизацію: {data}")

            # Додаткова інформація для діагностики
            logger.info(f"auth_user: HTTP Headers: {dict(request.headers)}")

            user = controllers.verify_user(data)
            logger.info(f"auth_user: Результат verify_user: {user}")

            if user:
                # Визначаємо, чи це новий користувач (для відображення вітального повідомлення)
                from datetime import datetime
                is_new_user = user.get('created_at') and (datetime.now() - datetime.fromisoformat(
                    user['created_at'].replace('Z', '+00:00'))).total_seconds() < 60

                return jsonify({
                    'status': 'success',
                    'data': {
                        'telegram_id': user.get('telegram_id'),
                        'username': user.get('username'),
                        'balance': user.get('balance', 0),
                        'coins': user.get('coins', 0),
                        'is_new_user': is_new_user
                    }
                })
            else:
                logger.error("auth_user: Помилка авторизації - verify_user повернув None")
                return jsonify({
                    'status': 'error',
                    'message': 'Помилка авторизації користувача'
                }), 401
        except Exception as e:
            logger.error(f"auth_user: Помилка в /api/auth: {str(e)}", exc_info=True)
            return jsonify({
                'status': 'error',
                'message': str(e)
            }), 500