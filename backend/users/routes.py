"""
Модуль маршрутів для API користувачів WINIX.
Повна версія з усіма ендпоінтами для роботи з Telegram ботом та веб-додатком.
"""

from flask import Blueprint, request, jsonify, current_app
from backend.users import controllers
import logging

# Налаштування логування
logger = logging.getLogger(__name__)

# Створення Blueprint для користувачів
users_bp = Blueprint('users', __name__)


def register_user_routes(app):
    """
    Реєстрація всіх маршрутів, пов'язаних з користувачами.

    Args:
        app: Екземпляр Flask-додатку
    """

    # ====== СТВОРЕННЯ ТА ОТРИМАННЯ КОРИСТУВАЧА ======

    @app.route('/api/user/create', methods=['POST'])
    def api_create_user():
        """Створення нового користувача (для Telegram бота)"""
        try:
            data = request.get_json()
            if not data:
                return jsonify({
                    'success': False,
                    'error': 'No data provided'
                }), 400

            telegram_id = data.get('telegram_id')
            username = data.get('username')
            referrer_id = data.get('referrer_id')

            if not telegram_id:
                return jsonify({
                    'success': False,
                    'error': 'telegram_id is required'
                }), 400

            logger.info(f"Creating user: {telegram_id}, username: {username}, referrer: {referrer_id}")

            # Створюємо користувача через контролер
            result = controllers.create_user_profile(telegram_id, username, referrer_id)

            if result and result.get('status') == 'success':
                return jsonify({
                    'success': True,
                    'message': 'User created successfully',
                    'data': result.get('data')
                })
            elif result and result.get('status') == 'exists':
                # Користувач вже існує
                return jsonify({
                    'success': True,
                    'message': 'User already exists',
                    'data': result.get('data')
                })
            else:
                return jsonify({
                    'success': False,
                    'error': 'Failed to create user'
                }), 500

        except Exception as e:
            logger.error(f"Error creating user: {str(e)}")
            return jsonify({
                'success': False,
                'error': 'Internal server error',
                'details': str(e)
            }), 500

    @app.route('/api/user/<telegram_id>', methods=['GET'])
    def api_get_user_profile(telegram_id):
        """Отримання повного профілю користувача"""
        try:
            logger.info(f"Getting user profile: {telegram_id}")
            result = controllers.get_user_profile(telegram_id)
            return result
        except Exception as e:
            logger.error(f"Error getting user {telegram_id}: {str(e)}")
            return jsonify({
                'success': False,
                'error': 'Internal server error',
                'details': str(e)
            }), 500

    @app.route('/api/user/<telegram_id>/init_data', methods=['GET'])
    def api_get_user_init_data(telegram_id):
        """Отримання всіх початкових даних користувача одним запитом"""
        try:
            logger.info(f"Getting user init data: {telegram_id}")
            return controllers.get_user_init_data(telegram_id)
        except Exception as e:
            logger.error(f"Error getting init data for {telegram_id}: {str(e)}")
            return jsonify({
                'success': False,
                'error': 'Internal server error'
            }), 500

    # ====== БАЛАНС ТА ЖЕТОНИ ======

    @app.route('/api/user/<telegram_id>/balance', methods=['GET'])
    def api_get_user_balance(telegram_id):
        """Отримання балансу користувача"""
        try:
            logger.info(f"Getting user balance: {telegram_id}")
            return controllers.get_user_balance(telegram_id)
        except Exception as e:
            logger.error(f"Error getting balance for {telegram_id}: {str(e)}")
            return jsonify({
                'success': False,
                'error': 'Internal server error'
            }), 500

    @app.route('/api/user/<telegram_id>/balance', methods=['POST', 'PUT'])
    def api_update_user_balance(telegram_id):
        """Оновлення балансу користувача"""
        try:
            data = request.get_json()
            if not data or 'balance' not in data:
                return jsonify({
                    'success': False,
                    'error': 'Balance is required'
                }), 400

            logger.info(f"Updating balance for user {telegram_id}: {data}")
            return controllers.update_user_balance(telegram_id, data)
        except Exception as e:
            logger.error(f"Error updating balance for user {telegram_id}: {str(e)}")
            return jsonify({
                'success': False,
                'error': 'Internal server error'
            }), 500

    @app.route('/api/user/<telegram_id>/coins', methods=['GET'])
    def api_get_user_coins(telegram_id):
        """Отримання кількості жетонів користувача"""
        try:
            balance_data = controllers.get_user_balance(telegram_id)
            if hasattr(balance_data, 'json'):
                data = balance_data.json
                if data.get('status') == 'success':
                    return jsonify({
                        'status': 'success',
                        'data': {'coins': data['data'].get('coins', 0)}
                    })
            return balance_data
        except Exception as e:
            logger.error(f"Error getting coins for {telegram_id}: {str(e)}")
            return jsonify({
                'success': False,
                'error': 'Internal server error'
            }), 500

    @app.route('/api/user/<telegram_id>/coins', methods=['POST', 'PUT'])
    def api_update_user_coins(telegram_id):
        """Оновлення кількості жетонів користувача"""
        try:
            data = request.get_json()
            logger.info(f"Updating coins for user {telegram_id}: {data}")
            return controllers.update_user_coins(telegram_id, data)
        except Exception as e:
            logger.error(f"Error updating coins for user {telegram_id}: {str(e)}")
            return jsonify({
                'success': False,
                'error': 'Internal server error'
            }), 500

    @app.route('/api/user/<telegram_id>/add-coins', methods=['POST'])
    def api_add_user_coins(telegram_id):
        """Додавання жетонів користувачу"""
        try:
            data = request.get_json()
            logger.info(f"Adding coins for user {telegram_id}: {data}")
            return controllers.add_user_coins(telegram_id, data)
        except Exception as e:
            logger.error(f"Error adding coins for user {telegram_id}: {str(e)}")
            return jsonify({
                'success': False,
                'error': 'Internal server error'
            }), 500

    # ====== НАЛАШТУВАННЯ ======

    @app.route('/api/user/<telegram_id>/settings', methods=['GET'])
    def api_get_user_settings(telegram_id):
        """Отримання налаштувань користувача"""
        try:
            logger.info(f"Getting user settings: {telegram_id}")
            return controllers.get_user_settings(telegram_id)
        except Exception as e:
            logger.error(f"Error getting settings for {telegram_id}: {str(e)}")
            return jsonify({
                'success': False,
                'error': 'Internal server error'
            }), 500

    @app.route('/api/user/<telegram_id>/settings', methods=['POST', 'PUT'])
    def api_update_user_settings(telegram_id):
        """Оновлення налаштувань користувача"""
        try:
            data = request.get_json()
            logger.info(f"Updating settings for user {telegram_id}: {data}")
            return controllers.update_user_settings(telegram_id, data)
        except Exception as e:
            logger.error(f"Error updating settings for user {telegram_id}: {str(e)}")
            return jsonify({
                'success': False,
                'error': 'Internal server error'
            }), 500

    @app.route('/api/user/<telegram_id>/password', methods=['POST', 'PUT'])
    def api_update_user_password(telegram_id):
        """Оновлення пароля користувача"""
        try:
            data = request.get_json()
            logger.info(f"Updating password for user {telegram_id}")
            return controllers.update_user_password(telegram_id, data)
        except Exception as e:
            logger.error(f"Error updating password for user {telegram_id}: {str(e)}")
            return jsonify({
                'success': False,
                'error': 'Internal server error'
            }), 500

    # ====== ВИНАГОРОДИ ТА БОНУСИ ======

    @app.route('/api/user/<telegram_id>/claim-badge-reward', methods=['POST'])
    def api_claim_badge_reward(telegram_id):
        """Отримання нагороди за бейдж"""
        try:
            data = request.get_json()
            logger.info(f"Claiming badge reward for user {telegram_id}: {data}")
            return controllers.claim_badge_reward(telegram_id, data)
        except Exception as e:
            logger.error(f"Error claiming badge reward for user {telegram_id}: {str(e)}")
            return jsonify({
                'success': False,
                'error': 'Internal server error'
            }), 500

    @app.route('/api/user/<telegram_id>/claim-newbie-bonus', methods=['POST'])
    def api_claim_newbie_bonus(telegram_id):
        """Отримання бонусу новачка"""
        try:
            logger.info(f"Claiming newbie bonus for user {telegram_id}")
            return controllers.claim_newbie_bonus(telegram_id)
        except Exception as e:
            logger.error(f"Error claiming newbie bonus for user {telegram_id}: {str(e)}")
            return jsonify({
                'success': False,
                'error': 'Internal server error'
            }), 500

    # ====== ТРАНЗАКЦІЇ ======

    @app.route('/api/user/<telegram_id>/transactions', methods=['GET'])
    def api_get_user_transactions(telegram_id):
        """Отримання історії транзакцій користувача"""
        try:
            limit = request.args.get('limit', 50)
            offset = request.args.get('offset', 0)
            logger.info(f"Getting transactions for user {telegram_id}, limit: {limit}, offset: {offset}")
            return controllers.get_user_transactions(telegram_id, limit, offset)
        except Exception as e:
            logger.error(f"Error getting transactions for user {telegram_id}: {str(e)}")
            return jsonify({
                'success': False,
                'error': 'Internal server error'
            }), 500

    # ====== БЕЗПЕКА ======

    @app.route('/api/user/<telegram_id>/seed-phrase', methods=['GET'])
    def api_get_user_seed_phrase(telegram_id):
        """Отримання seed-фрази користувача"""
        try:
            logger.info(f"Getting seed phrase for user {telegram_id}")
            return controllers.get_user_seed_phrase(telegram_id)
        except Exception as e:
            logger.error(f"Error getting seed phrase for user {telegram_id}: {str(e)}")
            return jsonify({
                'success': False,
                'error': 'Internal server error'
            }), 500

    # ====== ДОПОМІЖНІ ЕНДПОІНТИ ======

    @app.route('/api/user/<telegram_id>/info', methods=['GET'])
    def api_get_user_info(telegram_id):
        """Отримання базової інформації користувача"""
        try:
            logger.info(f"Getting user info: {telegram_id}")
            result = controllers.get_user_info(telegram_id)
            return jsonify({
                'status': 'success',
                'data': result
            })
        except ValueError as e:
            return jsonify({
                'status': 'error',
                'message': str(e)
            }), 404
        except Exception as e:
            logger.error(f"Error getting user info {telegram_id}: {str(e)}")
            return jsonify({
                'status': 'error',
                'message': 'Internal server error'
            }), 500

    @app.route('/api/user/<telegram_id>/exists', methods=['GET'])
    def api_check_user_exists(telegram_id):
        """Перевірка чи існує користувач"""
        try:
            logger.info(f"Checking if user exists: {telegram_id}")
            user = controllers.get_user_info(telegram_id)
            return jsonify({
                'status': 'success',
                'exists': True,
                'data': {
                    'telegram_id': user.get('telegram_id'),
                    'username': user.get('username')
                }
            })
        except ValueError:
            return jsonify({
                'status': 'success',
                'exists': False
            })
        except Exception as e:
            logger.error(f"Error checking user existence {telegram_id}: {str(e)}")
            return jsonify({
                'status': 'error',
                'message': 'Internal server error'
            }), 500

    # ====== БЕЙДЖІ ======

    @app.route('/api/user/<telegram_id>/badges', methods=['GET'])
    def api_get_user_badges(telegram_id):
        """Отримання бейджів користувача"""
        try:
            logger.info(f"Getting badges for user {telegram_id}")
            profile_data = controllers.get_user_profile(telegram_id)

            if hasattr(profile_data, 'json'):
                data = profile_data.json
                if data.get('status') == 'success':
                    badges = data['data'].get('badges', {})
                    return jsonify({
                        'status': 'success',
                        'data': badges
                    })

            return profile_data
        except Exception as e:
            logger.error(f"Error getting badges for user {telegram_id}: {str(e)}")
            return jsonify({
                'status': 'error',
                'message': 'Internal server error'
            }), 500

    # ====== СТАТИСТИКА ======

    @app.route('/api/user/<telegram_id>/stats', methods=['GET'])
    def api_get_user_stats(telegram_id):
        """Отримання статистики користувача"""
        try:
            logger.info(f"Getting stats for user {telegram_id}")
            profile_data = controllers.get_user_profile(telegram_id)

            if hasattr(profile_data, 'json'):
                data = profile_data.json
                if data.get('status') == 'success':
                    user_data = data['data']
                    stats = {
                        'balance': user_data.get('balance', 0),
                        'coins': user_data.get('coins', 0),
                        'participations_count': user_data.get('participations_count', 0),
                        'wins_count': user_data.get('wins_count', 0),
                        'badges': user_data.get('badges', {}),
                        'newbie_bonus_claimed': user_data.get('newbie_bonus_claimed', False),
                        'page1_completed': user_data.get('page1_completed', False)
                    }
                    return jsonify({
                        'status': 'success',
                        'data': stats
                    })

            return profile_data
        except Exception as e:
            logger.error(f"Error getting stats for user {telegram_id}: {str(e)}")
            return jsonify({
                'status': 'error',
                'message': 'Internal server error'
            }), 500

    # Логування успішної реєстрації
    logger.info("✅ Маршрути користувачів успішно зареєстровано")


# Реєстрація Blueprint (альтернативний метод)
def init_user_routes(app):
    """Альтернативний метод реєстрації маршрутів через Blueprint"""
    app.register_blueprint(users_bp)