"""
Модуль маршрутів для API користувачів WINIX.
ВИПРАВЛЕНА версія з правильною валідацією та обробкою помилок.
"""

from flask import request, jsonify
import logging
from . import controllers

# Налаштування логування
logger = logging.getLogger(__name__)


def validate_telegram_id_param(telegram_id):
    """
    Валідація telegram_id з URL параметра

    Args:
        telegram_id: ID з URL

    Returns:
        str: Валідний telegram_id

    Raises:
        ValueError: При невалідному ID
    """
    try:
        return controllers.validate_telegram_id(telegram_id)
    except ValueError as e:
        logger.warning(f"Невалідний telegram_id в URL: {telegram_id}")
        raise ValueError(f"Невалідний параметр telegram_id: {e}")


def handle_controller_error(error, telegram_id=None):
    """
    Централізована обробка помилок контролерів

    Args:
        error: Помилка з контролера
        telegram_id: ID користувача (опціонально)

    Returns:
        tuple: (response, status_code)
    """
    error_msg = str(error)

    if isinstance(error, ValueError):
        logger.warning(f"Валідаційна помилка для {telegram_id}: {error_msg}")
        return jsonify({
            "status": "error",
            "message": error_msg,
            "code": "validation_error"
        }), 400

    elif isinstance(error, ConnectionError):
        logger.error(f"Помилка підключення для {telegram_id}: {error_msg}")
        return jsonify({
            "status": "error",
            "message": "Тимчасові проблеми з сервером. Спробуйте пізніше.",
            "code": "connection_error"
        }), 503

    else:
        logger.error(f"Непередбачена помилка для {telegram_id}: {error_msg}", exc_info=True)
        return jsonify({
            "status": "error",
            "message": "Внутрішня помилка сервера",
            "code": "internal_error"
        }), 500


def register_user_routes(app):
    """
    Реєстрація всіх маршрутів, пов'язаних з користувачами.

    Args:
        app: Екземпляр Flask-додатку
    """

    # ====== ОСНОВНІ МАРШРУТИ КОРИСТУВАЧА ======

    @app.route('/api/user/<telegram_id>', methods=['GET'])
    def api_get_user_profile(telegram_id):
        """Отримання повного профілю користувача"""
        try:
            # Валідація telegram_id з URL
            telegram_id = validate_telegram_id_param(telegram_id)
            return controllers.get_user_profile(telegram_id)
        except ValueError as e:
            return handle_controller_error(e, telegram_id)
        except Exception as e:
            return handle_controller_error(e, telegram_id)

    @app.route('/api/user/<telegram_id>/balance', methods=['GET'])
    def api_get_user_balance(telegram_id):
        """Отримання балансу користувача"""
        try:
            # Валідація telegram_id з URL
            telegram_id = validate_telegram_id_param(telegram_id)
            return controllers.get_user_balance(telegram_id)
        except ValueError as e:
            return handle_controller_error(e, telegram_id)
        except Exception as e:
            return handle_controller_error(e, telegram_id)

    @app.route('/api/user/<telegram_id>/balance', methods=['POST'])
    def api_update_user_balance(telegram_id):
        """Оновлення балансу користувача"""
        try:
            # Валідація telegram_id з URL
            telegram_id = validate_telegram_id_param(telegram_id)

            # Валідація JSON даних
            data = request.get_json()
            if not data:
                return jsonify({
                    "status": "error",
                    "message": "Відсутні дані в запиті",
                    "code": "missing_data"
                }), 400

            return controllers.update_user_balance(telegram_id, data)
        except ValueError as e:
            return handle_controller_error(e, telegram_id)
        except Exception as e:
            return handle_controller_error(e, telegram_id)

    # ====== МАРШРУТИ ВИНАГОРОД ======

    @app.route('/api/user/<telegram_id>/claim-badge-reward', methods=['POST'])
    def api_claim_badge_reward(telegram_id):
        """Отримання нагороди за бейдж"""
        try:
            # Валідація telegram_id з URL
            telegram_id = validate_telegram_id_param(telegram_id)

            # Валідація JSON даних
            data = request.get_json()
            if not data:
                return jsonify({
                    "status": "error",
                    "message": "Відсутні дані в запиті",
                    "code": "missing_data"
                }), 400

            return controllers.claim_badge_reward(telegram_id, data)
        except ValueError as e:
            return handle_controller_error(e, telegram_id)
        except Exception as e:
            return handle_controller_error(e, telegram_id)

    @app.route('/api/user/<telegram_id>/claim-newbie-bonus', methods=['POST'])
    def api_claim_newbie_bonus(telegram_id):
        """Отримання бонусу новачка"""
        try:
            # Валідація telegram_id з URL
            telegram_id = validate_telegram_id_param(telegram_id)
            return controllers.claim_newbie_bonus(telegram_id)
        except ValueError as e:
            return handle_controller_error(e, telegram_id)
        except Exception as e:
            return handle_controller_error(e, telegram_id)

    # ====== МАРШРУТИ НАЛАШТУВАНЬ ======

    @app.route('/api/user/<telegram_id>/settings', methods=['GET'])
    def api_get_user_settings(telegram_id):
        """Отримання налаштувань користувача"""
        try:
            # Валідація telegram_id з URL
            telegram_id = validate_telegram_id_param(telegram_id)

            # Поки що повертаємо базові налаштування
            # TODO: Реалізувати get_user_settings в controllers
            return jsonify({
                "status": "success",
                "data": {
                    "notifications_enabled": True,
                    "language": "uk",
                    "theme": "dark"
                }
            })
        except ValueError as e:
            return handle_controller_error(e, telegram_id)
        except Exception as e:
            return handle_controller_error(e, telegram_id)

    @app.route('/api/user/<telegram_id>/settings', methods=['POST'])
    def api_update_user_settings(telegram_id):
        """Оновлення налаштувань користувача"""
        try:
            # Валідація telegram_id з URL
            telegram_id = validate_telegram_id_param(telegram_id)

            # Валідація JSON даних
            data = request.get_json()
            if not data:
                return jsonify({
                    "status": "error",
                    "message": "Відсутні дані в запиті",
                    "code": "missing_data"
                }), 400

            # TODO: Реалізувати update_user_settings в controllers
            return jsonify({
                "status": "success",
                "message": "Налаштування оновлено",
                "data": data
            })
        except ValueError as e:
            return handle_controller_error(e, telegram_id)
        except Exception as e:
            return handle_controller_error(e, telegram_id)

    # ====== МАРШРУТИ ЖЕТОНІВ ======

    @app.route('/api/user/<telegram_id>/coins', methods=['POST'])
    def api_update_user_coins(telegram_id):
        """Оновлення кількості жетонів користувача"""
        try:
            # Валідація telegram_id з URL
            telegram_id = validate_telegram_id_param(telegram_id)

            # Валідація JSON даних
            data = request.get_json()
            if not data or 'coins' not in data:
                return jsonify({
                    "status": "error",
                    "message": "Відсутні дані про жетони",
                    "code": "missing_coins_data"
                }), 400

            # Валідація кількості жетонів
            try:
                new_coins = controllers.validate_coins(data['coins'])
            except ValueError as e:
                return jsonify({
                    "status": "error",
                    "message": str(e),
                    "code": "invalid_coins"
                }), 400

            # TODO: Реалізувати update_user_coins в controllers
            return jsonify({
                "status": "success",
                "message": f"Кількість жетонів оновлено до {new_coins}",
                "data": {"coins": new_coins}
            })
        except ValueError as e:
            return handle_controller_error(e, telegram_id)
        except Exception as e:
            return handle_controller_error(e, telegram_id)

    @app.route('/api/user/<telegram_id>/add-coins', methods=['POST'])
    def api_add_user_coins(telegram_id):
        """Додавання жетонів користувачу"""
        try:
            # Валідація telegram_id з URL
            telegram_id = validate_telegram_id_param(telegram_id)

            # Валідація JSON даних
            data = request.get_json()
            if not data or 'amount' not in data:
                return jsonify({
                    "status": "error",
                    "message": "Відсутня сума для додавання",
                    "code": "missing_amount_data"
                }), 400

            # Валідація суми
            try:
                amount = controllers.validate_coins(data['amount'])
                if amount <= 0:
                    raise ValueError("Сума має бути додатною")
            except ValueError as e:
                return jsonify({
                    "status": "error",
                    "message": str(e),
                    "code": "invalid_amount"
                }), 400

            # TODO: Реалізувати add_user_coins в controllers
            return jsonify({
                "status": "success",
                "message": f"Додано {amount} жетонів",
                "data": {"added_coins": amount}
            })
        except ValueError as e:
            return handle_controller_error(e, telegram_id)
        except Exception as e:
            return handle_controller_error(e, telegram_id)

    # ====== МАРШРУТИ ТРАНЗАКЦІЙ ======

    @app.route('/api/user/<telegram_id>/transactions', methods=['GET'])
    def api_get_user_transactions(telegram_id):
        """Отримання історії транзакцій користувача"""
        try:
            # Валідація telegram_id з URL
            telegram_id = validate_telegram_id_param(telegram_id)

            # Валідація параметрів запиту
            try:
                limit = int(request.args.get('limit', 50))
                offset = int(request.args.get('offset', 0))

                if limit <= 0 or limit > 1000:
                    limit = 50
                if offset < 0:
                    offset = 0

            except (ValueError, TypeError):
                limit = 50
                offset = 0

            # TODO: Реалізувати get_user_transactions в controllers
            return jsonify({
                "status": "success",
                "data": [],
                "pagination": {
                    "limit": limit,
                    "offset": offset,
                    "total": 0
                },
                "message": "Історія транзакцій поки що недоступна"
            })
        except ValueError as e:
            return handle_controller_error(e, telegram_id)
        except Exception as e:
            return handle_controller_error(e, telegram_id)

    # ====== ІНШІ МАРШРУТИ ======

    @app.route('/api/user/<telegram_id>/seed-phrase', methods=['GET'])
    def api_get_user_seed_phrase(telegram_id):
        """Отримання seed-фрази користувача"""
        try:
            # Валідація telegram_id з URL
            telegram_id = validate_telegram_id_param(telegram_id)

            # TODO: Реалізувати get_user_seed_phrase в controllers
            return jsonify({
                "status": "success",
                "data": {
                    "seed_phrase": "Seed phrase функціонал поки що недоступний"
                },
                "message": "Функція в розробці"
            })
        except ValueError as e:
            return handle_controller_error(e, telegram_id)
        except Exception as e:
            return handle_controller_error(e, telegram_id)

    # ====== ДОДАТКОВІ МАРШРУТИ ДЛЯ СУМІСНОСТІ ======

    @app.route('/api/user/<telegram_id>/init_data', methods=['GET'])
    def api_get_user_init_data(telegram_id):
        """Отримання всіх початкових даних користувача одним запитом"""
        try:
            # Валідація telegram_id з URL
            telegram_id = validate_telegram_id_param(telegram_id)

            # Використовуємо існуючий метод отримання профілю
            # який містить всі необхідні дані
            return controllers.get_user_profile(telegram_id)
        except ValueError as e:
            return handle_controller_error(e, telegram_id)
        except Exception as e:
            return handle_controller_error(e, telegram_id)

    logger.info("✅ Маршрути користувачів зареєстровано успішно")