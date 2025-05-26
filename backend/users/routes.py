"""
Модуль маршрутів для API користувачів WINIX.
ВИПРАВЛЕНА версія з правильною валідацією та синхронізацією з frontend API.
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
    ВИПРАВЛЕНА версія з покращеною синхронізацією з frontend API.

    Args:
        app: Екземпляр Flask-додатку
    """

    # ====== ОСНОВНІ МАРШРУТИ КОРИСТУВАЧА ======

    @app.route('/api/user/<telegram_id>', methods=['GET'])
    def api_get_user_profile(telegram_id):
        """
        Отримання повного профілю користувача
        ВИПРАВЛЕНО: Використовується controllers.get_user_profile
        """
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
        """
        Отримання балансу користувача
        ВИПРАВЛЕНО: Використовується controllers.get_user_balance
        """
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
        """
        Оновлення балансу користувача
        ВИПРАВЛЕНО: Підтримує різні формати даних від frontend
        """
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

    # ====== НОВІ API МАРШРУТИ ДЛЯ FRONTEND ======

    @app.route('/api/getUserData', methods=['GET'])
    def api_get_user_data_by_header():
        """
        НОВИЙ: Отримання даних користувача через заголовок X-Telegram-User-Id
        Використовується в WinixAPI.getUserData()
        """
        try:
            # Отримуємо telegram_id з заголовка
            telegram_id = request.headers.get('X-Telegram-User-Id')
            if not telegram_id:
                return jsonify({
                    "status": "error",
                    "message": "Відсутній заголовок X-Telegram-User-Id",
                    "code": "missing_user_id_header"
                }), 400

            # Валідація ID
            telegram_id = validate_telegram_id_param(telegram_id)

            # Отримуємо дані через спеціальну функцію для API
            user_data = controllers.get_user_data_for_api(telegram_id)

            if user_data:
                return jsonify({
                    "status": "success",
                    "data": user_data
                })
            else:
                return jsonify({
                    "status": "error",
                    "message": "Користувач не знайдений",
                    "code": "user_not_found"
                }), 404

        except ValueError as e:
            return handle_controller_error(e)
        except Exception as e:
            return handle_controller_error(e)

    @app.route('/api/refreshBalance', methods=['GET'])
    def api_refresh_balance_by_header():
        """
        НОВИЙ: Оновлення балансу через заголовок X-Telegram-User-Id
        Використовується в WinixAPI.refreshBalance()
        """
        try:
            # Отримуємо telegram_id з заголовка
            telegram_id = request.headers.get('X-Telegram-User-Id')
            if not telegram_id:
                return jsonify({
                    "status": "error",
                    "message": "Відсутній заголовок X-Telegram-User-Id",
                    "code": "missing_user_id_header"
                }), 400

            # Валідація ID
            telegram_id = validate_telegram_id_param(telegram_id)

            # Отримуємо свіжі дані балансу
            return controllers.get_user_balance(telegram_id)

        except ValueError as e:
            return handle_controller_error(e)
        except Exception as e:
            return handle_controller_error(e)

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

            # Отримуємо налаштування з бази даних
            user = controllers.get_user_info(telegram_id)
            if not user:
                return jsonify({
                    "status": "error",
                    "message": "Користувач не знайдений",
                    "code": "user_not_found"
                }), 404

            settings = {
                "notifications_enabled": user.get("notifications_enabled", True),
                "language": user.get("language", "uk"),
                "theme": user.get("theme", "dark"),
                "privacy_level": user.get("privacy_level", "normal")
            }

            return jsonify({
                "status": "success",
                "data": settings
            })

        except ValueError as e:
            return handle_controller_error(e, telegram_id)
        except Exception as e:
            return handle_controller_error(e, telegram_id)

    @app.route('/api/user/<telegram_id>/settings', methods=['POST'])
    def api_update_user_settings(telegram_id):
        """
        Оновлення налаштувань користувача
        ВИПРАВЛЕНО: Використовує controllers.update_user_settings
        """
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

            # Використовуємо спеціалізовану функцію
            result = controllers.update_user_settings(telegram_id, data)

            if result["status"] == "success":
                return jsonify(result)
            else:
                return jsonify(result), 400

        except ValueError as e:
            return handle_controller_error(e, telegram_id)
        except Exception as e:
            return handle_controller_error(e, telegram_id)

    @app.route('/api/updateSettings', methods=['POST'])
    def api_update_settings_by_header():
        """
        НОВИЙ: Оновлення налаштувань через заголовок
        Використовується в WinixAPI.updateSettings()
        """
        try:
            # Отримуємо telegram_id з заголовка
            telegram_id = request.headers.get('X-Telegram-User-Id')
            if not telegram_id:
                return jsonify({
                    "status": "error",
                    "message": "Відсутній заголовок X-Telegram-User-Id",
                    "code": "missing_user_id_header"
                }), 400

            # Валідація ID
            telegram_id = validate_telegram_id_param(telegram_id)

            # Валідація JSON даних
            data = request.get_json()
            if not data:
                return jsonify({
                    "status": "error",
                    "message": "Відсутні дані в запиті",
                    "code": "missing_data"
                }), 400

            # Використовуємо спеціалізовану функцію
            result = controllers.update_user_settings(telegram_id, data)

            if result["status"] == "success":
                return jsonify(result)
            else:
                return jsonify(result), 400

        except ValueError as e:
            return handle_controller_error(e)
        except Exception as e:
            return handle_controller_error(e)

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

            # Оновлюємо через update_user_balance з спеціальним параметром
            balance_data = {
                'coins': new_coins,
                'operation': 'set'
            }

            return controllers.update_user_balance(telegram_id, balance_data)

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

            # Додаємо жетони через update_user_balance
            balance_data = {
                'amount': amount,
                'operation': 'add',
                'type': 'coins'  # Позначаємо що це операція з жетонами
            }

            return controllers.update_user_balance(telegram_id, balance_data)

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

            # Отримуємо транзакції з Supabase
            try:
                from supabase_client import supabase

                response = supabase.table("transactions") \
                    .select("*") \
                    .eq("telegram_id", telegram_id) \
                    .order("created_at", desc=True) \
                    .range(offset, offset + limit - 1) \
                    .execute()

                transactions = response.data if response.data else []
                total_count = len(transactions)  # Approximation

                return jsonify({
                    "status": "success",
                    "data": transactions,
                    "pagination": {
                        "limit": limit,
                        "offset": offset,
                        "total": total_count,
                        "has_more": len(transactions) == limit
                    }
                })

            except Exception as e:
                logger.warning(f"Помилка отримання транзакцій: {str(e)}")
                return jsonify({
                    "status": "success",
                    "data": [],
                    "pagination": {
                        "limit": limit,
                        "offset": offset,
                        "total": 0,
                        "has_more": False
                    },
                    "message": "Історія транзакцій тимчасово недоступна"
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

            # Використовуємо функцію з seed_phrases.py
            try:
                from .seed_phrases import get_user_seed_phrase
                result = get_user_seed_phrase(telegram_id)

                if result["status"] == "success":
                    return jsonify(result)
                else:
                    return jsonify(result), 400

            except ImportError:
                return jsonify({
                    "status": "error",
                    "message": "Seed phrase функціонал недоступний",
                    "code": "feature_unavailable"
                }), 503

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

    # ====== СТЕЙКІНГ МАРШРУТИ ======

    @app.route('/api/user/<telegram_id>/staking', methods=['POST'])
    def api_create_user_staking(telegram_id):
        """
        НОВИЙ: Створення стейкінгу для користувача
        Використовується в WinixAPI.createStaking()
        """
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

            # Перевіряємо необхідні параметри
            staking_amount = data.get('stakingAmount')
            period = data.get('period')

            if not staking_amount or not period:
                return jsonify({
                    "status": "error",
                    "message": "Відсутні параметри stakingAmount або period",
                    "code": "missing_staking_params"
                }), 400

            # Валідація параметрів
            try:
                staking_amount = controllers.validate_coins(staking_amount)
                if staking_amount <= 0:
                    raise ValueError("Сума стейкінгу має бути додатною")
            except ValueError as e:
                return jsonify({
                    "status": "error",
                    "message": str(e),
                    "code": "invalid_staking_amount"
                }), 400

            # Перевіряємо баланс користувача
            user = controllers.get_user_info(telegram_id)
            if not user:
                return jsonify({
                    "status": "error",
                    "message": "Користувач не знайдений",
                    "code": "user_not_found"
                }), 404

            current_coins = int(user.get("coins", 0))
            if current_coins < staking_amount:
                return jsonify({
                    "status": "error",
                    "message": f"Недостатньо жетонів. Доступно: {current_coins}, потрібно: {staking_amount}",
                    "code": "insufficient_balance"
                }), 400

            # Створюємо запис стейкінгу (це може бути інтеграція з існуючою системою стейкінгу)
            try:
                from datetime import datetime, timezone
                import json

                # Створюємо запис стейкінгу
                staking_data = {
                    "telegram_id": telegram_id,
                    "amount": staking_amount,
                    "period": period,
                    "status": "active",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "type": "user_staking"
                }

                # Зберігаємо в транзакціях як запис стейкінгу
                from supabase_client import supabase

                transaction_data = {
                    "telegram_id": telegram_id,
                    "type": "staking_create",
                    "amount": -staking_amount,  # Віднімаємо з балансу
                    "description": f"Створення стейкінгу на {period} днів",
                    "status": "completed",
                    "metadata": json.dumps(staking_data),
                    "created_at": datetime.now(timezone.utc).isoformat()
                }

                # Виконуємо транзакцію
                supabase.table("transactions").insert(transaction_data).execute()

                # Оновлюємо баланс жетонів користувача
                new_coins = current_coins - staking_amount
                controllers.update_user(telegram_id, {"coins": new_coins})

                return jsonify({
                    "status": "success",
                    "message": f"Стейкінг на суму {staking_amount} жетонів створено успішно",
                    "data": {
                        "staking_amount": staking_amount,
                        "period": period,
                        "new_balance": new_coins,
                        "staking_id": transaction_data.get("id")
                    }
                })

            except Exception as e:
                logger.error(f"Помилка створення стейкінгу: {str(e)}")
                return jsonify({
                    "status": "error",
                    "message": "Помилка створення стейкінгу",
                    "code": "staking_creation_error"
                }), 500

        except ValueError as e:
            return handle_controller_error(e, telegram_id)
        except Exception as e:
            return handle_controller_error(e, telegram_id)

    logger.info("✅ Маршрути користувачів зареєстровано успішно")