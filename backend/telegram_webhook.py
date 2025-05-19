"""
Модуль для обробки webhook від Telegram бота
Синхронізація міні-апп з ботом
"""

import logging
import json
import os
from flask import request, jsonify
from datetime import datetime, timezone

# Імпорт модулів проекту
from supabase_client import create_user, get_user, update_user
from referrals.controllers import ReferralController, BonusController
from auth.controllers import verify_user

logger = logging.getLogger(__name__)

# Токен бота з .env
TELEGRAM_BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN')


def verify_telegram_webhook(data):
    """Перевіряє, що webhook прийшов від Telegram"""
    # Додайте перевірку signature якщо потрібно
    return True


def process_referral_from_start_param(user_id, start_param):
    """Обробляє реферальне посилання з start параметра"""
    try:
        if start_param and start_param.isdigit():
            referrer_id = start_param
            logger.info(f"Обробка реферала: {user_id} запрошений {referrer_id}")

            # Реєструємо реферальний зв'язок
            result = ReferralController.register_referral(referrer_id, user_id)

            if result['success']:
                # Нараховуємо бонус рефереру
                bonus_result = BonusController.award_direct_bonus(referrer_id, user_id)
                logger.info(f"Реферальний бонус нарахований: {bonus_result}")

                return {
                    'status': 'success',
                    'referrer_id': referrer_id,
                    'bonus_awarded': bonus_result['success']
                }
    except Exception as e:
        logger.error(f"Помилка обробки реферала: {str(e)}")

    return {'status': 'no_referral'}


def handle_telegram_update(data):
    """Основна функція обробки updates від Telegram"""
    try:
        # Отримуємо тип update
        if 'message' in data:
            message = data['message']
            user = message['from']
            text = message.get('text', '')

            # Обробляємо команду /start
            if text.startswith('/start'):
                user_id = str(user['id'])
                username = user.get('username', user.get('first_name', 'WINIX User'))

                # Отримуємо start параметр
                start_param = None
                if len(text.split()) > 1:
                    start_param = text.split()[1]

                # Перевіряємо чи користувач існує
                existing_user = get_user(user_id)

                if not existing_user:
                    # Створюємо нового користувача
                    new_user = create_user(user_id, username)

                    if new_user:
                        # Обробляємо реферальне посилання
                        if start_param:
                            process_referral_from_start_param(user_id, start_param)

                        logger.info(f"Новий користувач створений: {user_id}")
                        return {
                            'status': 'user_created',
                            'user_id': user_id,
                            'referred_by': start_param
                        }
                else:
                    # Оновлюємо останній вхід
                    update_user(user_id, {
                        'last_login': datetime.now(timezone.utc).isoformat()
                    })

                    return {
                        'status': 'user_updated',
                        'user_id': user_id
                    }

        # Обробляємо callback query (кнопки)
        elif 'callback_query' in data:
            callback = data['callback_query']
            user = callback['from']
            user_id = str(user['id'])
            callback_data = callback['data']

            # Тут можна обробляти різні callback'и
            logger.info(f"Callback від {user_id}: {callback_data}")

            return {
                'status': 'callback_processed',
                'callback_data': callback_data
            }

        # Обробляємо web_app_data
        elif 'web_app_data' in data.get('message', {}):
            web_app_data = data['message']['web_app_data']
            user = data['message']['from']
            user_id = str(user['id'])

            # Обробляємо дані з міні-апп
            logger.info(f"Web App дані від {user_id}: {web_app_data}")

            return {
                'status': 'web_app_processed',
                'user_id': user_id
            }

    except Exception as e:
        logger.error(f"Помилка обробки Telegram update: {str(e)}")
        return {'status': 'error', 'message': str(e)}

    return {'status': 'unknown_update'}


def register_telegram_routes(app):
    """Реєструє маршрути для Telegram webhook"""

    @app.route('/telegram/webhook', methods=['POST'])
    def telegram_webhook():
        """Обробник webhook від Telegram"""
        try:
            data = request.get_json()

            if not data:
                return jsonify({'error': 'No data received'}), 400

            # Логуємо отримані дані
            logger.info(f"Telegram webhook: {json.dumps(data, indent=2)}")

            # Перевіряємо webhook
            if not verify_telegram_webhook(data):
                return jsonify({'error': 'Invalid webhook'}), 403

            # Обробляємо update
            result = handle_telegram_update(data)

            # Повертаємо успішну відповідь
            return jsonify({
                'ok': True,
                'result': result
            })

        except Exception as e:
            logger.error(f"Критична помилка webhook: {str(e)}")
            return jsonify({'error': str(e)}), 500

    @app.route('/telegram/set-webhook', methods=['POST'])
    def set_telegram_webhook():
        """Встановлює webhook URL для бота"""
        try:
            import requests

            webhook_url = request.json.get('webhook_url')
            if not webhook_url:
                return jsonify({'error': 'webhook_url required'}), 400

            # Встановлюємо webhook
            telegram_api_url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/setWebhook"

            response = requests.post(telegram_api_url, json={
                'url': webhook_url,
                'allowed_updates': ['message', 'callback_query']
            })

            if response.status_code == 200:
                result = response.json()
                logger.info(f"Webhook встановлено: {result}")
                return jsonify(result)
            else:
                return jsonify({'error': 'Failed to set webhook'}), 500

        except Exception as e:
            logger.error(f"Помилка встановлення webhook: {str(e)}")
            return jsonify({'error': str(e)}), 500

    @app.route('/telegram/webhook-info', methods=['GET'])
    def get_webhook_info():
        """Отримує інформацію про поточний webhook"""
        try:
            import requests

            telegram_api_url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/getWebhookInfo"

            response = requests.get(telegram_api_url)

            if response.status_code == 200:
                return jsonify(response.json())
            else:
                return jsonify({'error': 'Failed to get webhook info'}), 500

        except Exception as e:
            logger.error(f"Помилка отримання webhook info: {str(e)}")
            return jsonify({'error': str(e)}), 500