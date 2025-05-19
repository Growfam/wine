"""
API для взаємодії Telegram бота з міні-аппом
Синхронізація даних та функцій
"""

import logging
import os
import requests
from flask import request, jsonify
from datetime import datetime, timezone

from supabase_client import get_user, update_balance, update_coins
from users.controllers import get_user_profile, create_new_user
from referrals.controllers import ReferralController, EarningsController
from staking.controllers import get_user_staking

logger = logging.getLogger(__name__)

TELEGRAM_BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN')
TELEGRAM_API_URL = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}"


class TelegramBot:
    """Клас для роботи з Telegram Bot API"""

    @staticmethod
    def send_message(chat_id, text, reply_markup=None):
        """Відправляє повідомлення користувачу"""
        try:
            data = {
                'chat_id': chat_id,
                'text': text,
                'parse_mode': 'HTML'
            }

            if reply_markup:
                data['reply_markup'] = reply_markup

            response = requests.post(f"{TELEGRAM_API_URL}/sendMessage", json=data)
            return response.json()
        except Exception as e:
            logger.error(f"Помилка відправки повідомлення: {str(e)}")
            return None

    @staticmethod
    def send_referral_notification(referrer_id, referee_id, bonus_amount):
        """Відправляє сповіщення про нового реферала"""
        try:
            message = f"""
🎉 <b>Новий реферал!</b>

Користувач {referee_id} приєднався за вашим посиланням!
💰 Ви отримали <b>{bonus_amount} WINIX</b> як бонус.

🔗 Запрошуйте більше друзів та заробляйте разом!
            """

            keyboard = {
                'inline_keyboard': [[
                    {'text': '👥 Мої реферали', 'web_app': {'url': 'https://yourapp.com/referrals'}},
                    {'text': '🔗 Поділитися', 'switch_inline_query': f'Приєднуйся до WINIX та заробляй! {referrer_id}'}
                ]]
            }

            return TelegramBot.send_message(referrer_id, message, keyboard)
        except Exception as e:
            logger.error(f"Помилка відправки сповіщення: {str(e)}")
            return None


def register_telegram_api_routes(app):
    """Реєструє API маршрути для взаємодії з ботом"""

    @app.route('/api/telegram/user/<telegram_id>/sync', methods=['POST'])
    def sync_user_with_bot(telegram_id):
        """Синхронізує дані користувача між ботом і міні-аппом"""
        try:
            # Отримуємо дані з міні-апп
            user_response, status_code = get_user_profile(telegram_id)

            if status_code != 200:
                return jsonify({'error': 'User not found'}), 404

            user_data = user_response.json['data']

            # Формуємо дані для бота
            sync_data = {
                'telegram_id': telegram_id,
                'balance': user_data.get('balance', 0),
                'coins': user_data.get('coins', 0),
                'participations_count': user_data.get('participations_count', 0),
                'wins_count': user_data.get('wins_count', 0),
                'last_sync': datetime.now(timezone.utc).isoformat()
            }

            return jsonify({
                'status': 'success',
                'data': sync_data
            })

        except Exception as e:
            logger.error(f"Помилка синхронізації користувача: {str(e)}")
            return jsonify({'error': str(e)}), 500

    @app.route('/api/telegram/user/<telegram_id>/referrals', methods=['GET'])
    def get_user_referrals_for_bot(telegram_id):
        """Отримує дані про рефералів для показу в боті"""
        try:
            # Отримуємо структуру рефералів
            referrals_result = ReferralController.get_referral_structure(telegram_id)

            if not referrals_result['success']:
                return jsonify({'error': 'Failed to get referrals'}), 500

            # Отримуємо заробітки від рефералів
            earnings_result = EarningsController.get_earnings_summary(telegram_id)

            # Формуємо відповідь для бота
            bot_data = {
                'total_referrals': referrals_result['statistics']['totalReferrals'],
                'level1_count': referrals_result['statistics']['level1Count'],
                'level2_count': referrals_result['statistics']['level2Count'],
                'active_referrals': referrals_result['statistics']['activeReferrals'],
                'total_earnings': earnings_result.get('total_earnings', {}).get('total', 0) if earnings_result.get(
                    'success') else 0,
                'referral_link': f"https://t.me/WINIX_Official_bot?start={telegram_id}"
            }

            return jsonify({
                'status': 'success',
                'data': bot_data
            })

        except Exception as e:
            logger.error(f"Помилка отримання рефералів: {str(e)}")
            return jsonify({'error': str(e)}), 500

    @app.route('/api/telegram/user/<telegram_id>/balance/update', methods=['POST'])
    def update_user_balance_from_bot(telegram_id):
        """Оновлює баланс користувача з бота"""
        try:
            data = request.get_json()
            amount = data.get('amount')
            description = data.get('description', 'Оновлення з бота')

            if not amount:
                return jsonify({'error': 'Amount required'}), 400

            # Оновлюємо баланс
            result = update_balance(telegram_id, float(amount))

            if result:
                return jsonify({
                    'status': 'success',
                    'new_balance': result.get('balance', 0),
                    'description': description
                })
            else:
                return jsonify({'error': 'Failed to update balance'}), 500

        except Exception as e:
            logger.error(f"Помилка оновлення балансу: {str(e)}")
            return jsonify({'error': str(e)}), 500

    @app.route('/api/telegram/user/<telegram_id>/coins/add', methods=['POST'])
    def add_user_coins_from_bot(telegram_id):
        """Додає жетони користувачу з бота"""
        try:
            data = request.get_json()
            amount = data.get('amount')
            description = data.get('description', 'Додавання жетонів з бота')

            if not amount:
                return jsonify({'error': 'Amount required'}), 400

            # Додаємо жетони
            result = update_coins(telegram_id, int(amount))

            if result:
                return jsonify({
                    'status': 'success',
                    'new_coins': result.get('coins', 0),
                    'added': amount,
                    'description': description
                })
            else:
                return jsonify({'error': 'Failed to add coins'}), 500

        except Exception as e:
            logger.error(f"Помилка додавання жетонів: {str(e)}")
            return jsonify({'error': str(e)}), 500

    @app.route('/api/telegram/user/<telegram_id>/staking', methods=['GET'])
    def get_user_staking_for_bot(telegram_id):
        """Отримує дані стейкінгу для показу в боті"""
        try:
            staking_result, status_code = get_user_staking(telegram_id)

            if status_code == 200:
                staking_data = staking_result.json.get('data', {})

                # Формуємо спрощені дані для бота
                bot_staking_data = {
                    'has_active_staking': staking_data.get('active_sessions_count', 0) > 0,
                    'total_staked': staking_data.get('total_staked', 0),
                    'total_sessions': staking_data.get('total_sessions', 0),
                    'active_sessions': staking_data.get('active_sessions_count', 0)
                }

                return jsonify({
                    'status': 'success',
                    'data': bot_staking_data
                })
            else:
                return jsonify({'error': 'Failed to get staking data'}), status_code

        except Exception as e:
            logger.error(f"Помилка отримання стейкінгу: {str(e)}")
            return jsonify({'error': str(e)}), 500

    @app.route('/api/telegram/notifications/send', methods=['POST'])
    def send_notification_to_user():
        """Відправляє сповіщення користувачу через бота"""
        try:
            data = request.get_json()
            telegram_id = data.get('telegram_id')
            message = data.get('message')
            keyboard = data.get('keyboard')

            if not telegram_id or not message:
                return jsonify({'error': 'telegram_id and message required'}), 400

            # Відправляємо повідомлення
            result = TelegramBot.send_message(telegram_id, message, keyboard)

            if result and result.get('ok'):
                return jsonify({
                    'status': 'success',
                    'message_id': result.get('result', {}).get('message_id')
                })
            else:
                return jsonify({'error': 'Failed to send message'}), 500

        except Exception as e:
            logger.error(f"Помилка відправки сповіщення: {str(e)}")
            return jsonify({'error': str(e)}), 500

    @app.route('/api/telegram/referral/notify', methods=['POST'])
    def notify_referral_bonus():
        """Сповіщає реферера про новий бонус"""
        try:
            data = request.get_json()
            referrer_id = data.get('referrer_id')
            referee_id = data.get('referee_id')
            bonus_amount = data.get('bonus_amount', 50)

            if not referrer_id or not referee_id:
                return jsonify({'error': 'referrer_id and referee_id required'}), 400

            # Відправляємо сповіщення
            result = TelegramBot.send_referral_notification(referrer_id, referee_id, bonus_amount)

            if result and result.get('ok'):
                return jsonify({
                    'status': 'success',
                    'notification_sent': True
                })
            else:
                return jsonify({'error': 'Failed to send notification'}), 500

        except Exception as e:
            logger.error(f"Помилка сповіщення: {str(e)}")
            return jsonify({'error': str(e)}), 500