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


logger = logging.getLogger(__name__)

# Токен бота з .env
TELEGRAM_BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN')


def verify_telegram_webhook(data):
    """Перевіряє, що webhook прийшов від Telegram"""
    # Додайте перевірку signature якщо потрібно
    return True


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

                # Отримуємо start параметр (реферальний код)
                start_param = None
                if len(text.split()) > 1:
                    start_param = text.split()[1]

                logger.info(f"handle_telegram_update: Обробляємо /start для {user_id}, реферальний код: {start_param}")

                # Перевіряємо чи користувач існує
                existing_user = get_user(user_id)

                if not existing_user:
                    # Створюємо нового користувача з автоматичною реєстрацією реферального зв'язку
                    new_user = create_user(user_id, username, referrer_id=start_param)

                    if new_user:
                        logger.info(f"handle_telegram_update: Новий користувач створений: {user_id}")

                        # Якщо був реферальний код, відправляємо сповіщення рефереру
                        if start_param:
                            try:
                                # Можна додати відправку сповіщення через Telegram API
                                logger.info(f"handle_telegram_update: Користувач {user_id} приєднався за запрошенням {start_param}")

                                # Опціонально: Відправка push сповіщення рефереру
                                # await send_referral_notification(start_param, user_id)

                            except Exception as e:
                                logger.error(f"handle_telegram_update: Помилка відправки сповіщення: {str(e)}")

                        return {
                            'status': 'user_created',
                            'user_id': user_id,
                            'referred_by': start_param,
                            'referral_registered': bool(start_param)
                        }
                    else:
                        logger.error(f"handle_telegram_update: Помилка створення користувача {user_id}")
                        return {
                            'status': 'error',
                            'message': 'Failed to create user'
                        }
                else:
                    # Для існуючого користувача оновлюємо останній вхід
                    update_user(user_id, {
                        'last_login': datetime.now(timezone.utc).isoformat()
                    })

                    # Якщо це існуючий користувач з новим реферальним кодом
                    if start_param:
                        logger.info(f"handle_telegram_update: Існуючий користувач {user_id} з реферальним кодом {start_param}")

                        # Перевіряємо, чи немає вже реферального зв'язку
                        try:
                            # Імпортуємо тут щоб уникнути циклічних залежностей
                            from models.referral import Referral

                            # Перевіряємо наявність існуючого реферального зв'язку
                            existing_referral = Referral.query.filter_by(referee_id=user_id).first()

                            if not existing_referral:
                                logger.info(f"handle_telegram_update: Спроба створити реферальний зв'язок для існуючого користувача")

                                # Зазвичай реферальні зв'язки дозволяють створювати тільки при першій реєстрації
                                # Але якщо потрібно дозволити це для існуючих користувачів, розкоментуйте код нижче:

                                # from referrals.controllers.referral_controller import ReferralController
                                # from referrals.controllers.bonus_controller import BonusController

                                # referral_result = ReferralController.register_referral(
                                #     referrer_id=start_param,
                                #     referee_id=user_id
                                # )

                                # if referral_result['success']:
                                #     BonusController.award_direct_bonus(start_param, user_id)
                                #     logger.info(f"handle_telegram_update: Реферальний зв'язок створено для існуючого користувача")

                            else:
                                logger.info(f"handle_telegram_update: Користувач {user_id} вже має реферальний зв'язок")

                        except ImportError as e:
                            logger.error(f"handle_telegram_update: Помилка імпорту моделей: {str(e)}")
                        except Exception as e:
                            logger.error(f"handle_telegram_update: Помилка перевірки реферального зв'язку: {str(e)}")

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

            logger.info(f"handle_telegram_update: Callback від {user_id}: {callback_data}")

            # Можна додати обробку конкретних callback'ів тут
            # Наприклад, кнопки для перевірки балансу, рефералів тощо

            return {
                'status': 'callback_processed',
                'callback_data': callback_data
            }

        # Обробляємо web_app_data (дані з міні-апп)
        elif 'web_app_data' in data.get('message', {}):
            web_app_data = data['message']['web_app_data']
            user = data['message']['from']
            user_id = str(user['id'])

            logger.info(f"handle_telegram_update: Web App дані від {user_id}: {web_app_data}")

            # Можна додати обробку даних з міні-апп тут
            # Наприклад, результати ігор, транзакції тощо

            return {
                'status': 'web_app_processed',
                'user_id': user_id
            }

        # Обробляємо inline query (для реферальних посилань)
        elif 'inline_query' in data:
            inline_query = data['inline_query']
            user = inline_query['from']
            user_id = str(user['id'])
            query = inline_query.get('query', '')

            logger.info(f"handle_telegram_update: Inline query від {user_id}: {query}")

            # Можна додати генерацію відповідей для inline запитів
            return {
                'status': 'inline_query_processed',
                'user_id': user_id,
                'query': query
            }

    except Exception as e:
        logger.error(f"handle_telegram_update: Помилка обробки Telegram update: {str(e)}", exc_info=True)
        return {'status': 'error', 'message': str(e)}

    return {'status': 'unknown_update', 'data': data}


def register_telegram_routes(app):
    """Реєструє маршрути для Telegram webhook"""

    @app.route('/telegram/webhook', methods=['POST', 'GET'])  # ✅ Додано GET для перевірки
    def telegram_webhook():
        """Обробник webhook від Telegram"""

        # Обробка GET запиту для перевірки endpoint
        if request.method == 'GET':
            return jsonify({
                'status': 'ok',
                'endpoint': 'telegram webhook',
                'info': 'Use POST method to send updates'
            })
        """Обробник webhook від Telegram"""
        try:
            data = request.get_json()

            if not data:
                logger.warning("telegram_webhook: Отримано порожні дані")
                return jsonify({'error': 'No data received'}), 400

            # Логуємо отримані дані (обережно з чутливими даними)
            logger.info(f"telegram_webhook: Отримано update від Telegram")
            logger.debug(f"telegram_webhook: Дані update: {json.dumps(data, indent=2)}")

            # Перевіряємо webhook (можна додати перевірку підпису)
            if not verify_telegram_webhook(data):
                logger.warning("telegram_webhook: Невалідний webhook")
                return jsonify({'error': 'Invalid webhook'}), 403

            # Обробляємо update
            result = handle_telegram_update(data)

            logger.info(f"telegram_webhook: Результат обробки: {result}")

            # Повертаємо успішну відповідь
            return jsonify({
                'ok': True,
                'result': result
            })

        except Exception as e:
            logger.error(f"telegram_webhook: Критична помилка: {str(e)}", exc_info=True)
            return jsonify({'error': 'Internal server error'}), 500

    @app.route('/telegram/set-webhook', methods=['POST'])
    def set_telegram_webhook():
        """Встановлює webhook URL для бота"""
        try:
            import requests

            webhook_url = request.json.get('webhook_url')
            secret_token = request.json.get('secret_token')  # Опціонально для безпеки

            if not webhook_url:
                return jsonify({'error': 'webhook_url required'}), 400

            # Встановлюємо webhook
            telegram_api_url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/setWebhook"

            payload = {
                'url': webhook_url,
                'allowed_updates': ['message', 'callback_query', 'inline_query']
            }

            # Додаємо секретний токен якщо є
            if secret_token:
                payload['secret_token'] = secret_token

            response = requests.post(telegram_api_url, json=payload, timeout=10)

            if response.status_code == 200:
                result = response.json()
                logger.info(f"set_telegram_webhook: Webhook встановлено успішно: {result}")
                return jsonify({
                    'success': True,
                    'result': result,
                    'webhook_url': webhook_url
                })
            else:
                logger.error(f"set_telegram_webhook: Помилка встановлення webhook: {response.text}")
                return jsonify({
                    'success': False,
                    'error': f'Telegram API error: {response.text}'
                }), 500

        except requests.RequestException as e:
            logger.error(f"set_telegram_webhook: Помилка мережі: {str(e)}")
            return jsonify({
                'success': False,
                'error': f'Network error: {str(e)}'
            }), 500
        except Exception as e:
            logger.error(f"set_telegram_webhook: Неочікувана помилка: {str(e)}", exc_info=True)
            return jsonify({
                'success': False,
                'error': f'Unexpected error: {str(e)}'
            }), 500

    @app.route('/telegram/webhook-info', methods=['GET'])
    def get_webhook_info():
        """Отримує інформацію про поточний webhook"""
        try:
            import requests

            telegram_api_url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/getWebhookInfo"

            response = requests.get(telegram_api_url, timeout=10)

            if response.status_code == 200:
                result = response.json()
                logger.info("get_webhook_info: Інформація про webhook отримана успішно")
                return jsonify({
                    'success': True,
                    'result': result
                })
            else:
                logger.error(f"get_webhook_info: Помилка отримання webhook info: {response.text}")
                return jsonify({
                    'success': False,
                    'error': f'Telegram API error: {response.text}'
                }), 500

        except requests.RequestException as e:
            logger.error(f"get_webhook_info: Помилка мережі: {str(e)}")
            return jsonify({
                'success': False,
                'error': f'Network error: {str(e)}'
            }), 500
        except Exception as e:
            logger.error(f"get_webhook_info: Неочікувана помилка: {str(e)}", exc_info=True)
            return jsonify({
                'success': False,
                'error': f'Unexpected error: {str(e)}'
            }), 500

    @app.route('/telegram/delete-webhook', methods=['POST'])
    def delete_telegram_webhook():
        """Видаляє webhook"""
        try:
            import requests

            telegram_api_url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/deleteWebhook"

            response = requests.post(telegram_api_url, timeout=10)

            if response.status_code == 200:
                result = response.json()
                logger.info("delete_telegram_webhook: Webhook видалено успішно")
                return jsonify({
                    'success': True,
                    'result': result
                })
            else:
                logger.error(f"delete_telegram_webhook: Помилка видалення webhook: {response.text}")
                return jsonify({
                    'success': False,
                    'error': f'Telegram API error: {response.text}'
                }), 500

        except requests.RequestException as e:
            logger.error(f"delete_telegram_webhook: Помилка мережі: {str(e)}")
            return jsonify({
                'success': False,
                'error': f'Network error: {str(e)}'
            }), 500
        except Exception as e:
            logger.error(f"delete_telegram_webhook: Неочікувана помилка: {str(e)}", exc_info=True)
            return jsonify({
                'success': False,
                'error': f'Unexpected error: {str(e)}'
            }), 500

    @app.route('/telegram/send-message', methods=['POST'])
    def send_telegram_message():
        """Відправляє повідомлення через Telegram Bot API"""
        try:
            import requests

            data = request.get_json()
            chat_id = data.get('chat_id')
            text = data.get('text')
            reply_markup = data.get('reply_markup')

            if not chat_id or not text:
                return jsonify({
                    'success': False,
                    'error': 'chat_id and text are required'
                }), 400

            # Підготовлюємо дані для відправки
            telegram_api_url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/sendMessage"
            payload = {
                'chat_id': chat_id,
                'text': text,
                'parse_mode': 'HTML'
            }

            if reply_markup:
                payload['reply_markup'] = json.dumps(reply_markup)

            response = requests.post(telegram_api_url, json=payload, timeout=10)

            if response.status_code == 200:
                result = response.json()
                logger.info(f"send_telegram_message: Повідомлення відправлено до {chat_id}")
                return jsonify({
                    'success': True,
                    'result': result
                })
            else:
                logger.error(f"send_telegram_message: Помилка відправки повідомлення: {response.text}")
                return jsonify({
                    'success': False,
                    'error': f'Telegram API error: {response.text}'
                }), 500

        except requests.RequestException as e:
            logger.error(f"send_telegram_message: Помилка мережі: {str(e)}")
            return jsonify({
                'success': False,
                'error': f'Network error: {str(e)}'
            }), 500
        except Exception as e:
            logger.error(f"send_telegram_message: Неочікувана помилка: {str(e)}", exc_info=True)
            return jsonify({
                'success': False,
                'error': f'Unexpected error: {str(e)}'
            }), 500

    logger.info("Telegram webhook маршрути зареєстровано")