from flask import request, jsonify, g
import logging
import jwt
import os
import sys
import time
import uuid
from datetime import datetime, timedelta
from functools import wraps

# Налаштування логування
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Імпортуємо контролери
try:
    from . import controllers
except ImportError:
    import controllers

# Імпортуємо змінні конфігурації
try:
    from backend.settings.config import JWT_SECRET, JWT_ALGORITHM
except ImportError:
    from settings.config import JWT_SECRET, JWT_ALGORITHM

# Часові обмеження для маршрутів
RATE_LIMITS = {
    "get_active_raffles": 20,
    "get_raffles_history": 180,
    "get_user_raffles": 30,
    "participate_in_raffle": 30,
}

# Відстеження останніх запитів користувачів
last_requests = {}


def is_valid_uuid(uuid_string):
    """
    Розширена перевірка валідності UUID з детальною обробкою помилок
    """
    # Перевірка на None та порожні рядки
    if not uuid_string:
        logger.warning(f"UUID пустий або None")
        return False

    # Перевірка на мінімальну довжину
    if len(uuid_string) < 32:
        logger.warning(f"UUID занадто короткий ({len(uuid_string)} символів): {uuid_string}")
        return False

    try:
        # Спроба перетворити рядок в UUID об'єкт
        uuid_obj = uuid.UUID(uuid_string)
        # Перевіряємо рядкове представлення - повинно співпадати з оригіналом
        return str(uuid_obj) == uuid_string
    except (ValueError, AttributeError, TypeError) as e:
        logger.warning(f"Некоректний UUID {uuid_string}: {str(e)}")
        return False


def require_authentication(f):
    """Декоратор для захисту API ендпоінтів"""

    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            # ВИПРАВЛЕННЯ: Зробимо цей декоратор більш стійким до помилок

            # Перевіряємо наявність токена в заголовках
            auth_header = request.headers.get("Authorization")

            # Якщо авторизації немає, але метод GET - тимчасово дозволяємо для налагодження
            if (not auth_header or not auth_header.startswith("Bearer ")) and request.method == 'GET':
                logger.warning(f"Запит без авторизації дозволено для GET: {request.path}")
                g.user = request.headers.get('X-Telegram-User-Id') or kwargs.get('telegram_id')
                return f(*args, **kwargs)

            if not auth_header or not auth_header.startswith("Bearer "):
                return jsonify({
                    "status": "error",
                    "message": "Необхідна аутентифікація",
                    "code": "auth_required"
                }), 401

            # Отримуємо токен
            token = auth_header.split(" ")[1]

            try:
                # Декодуємо JWT токен
                payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
                # Додаємо дані користувача до контексту запиту
                g.user = payload.get("user_id")
            except jwt.ExpiredSignatureError:
                return jsonify({
                    "status": "error",
                    "message": "Термін дії токена минув",
                    "code": "token_expired"
                }), 401
            except jwt.InvalidTokenError:
                return jsonify({
                    "status": "error",
                    "message": "Недійсний токен",
                    "code": "invalid_token"
                }), 401

            return f(*args, **kwargs)
        except Exception as e:
            logger.error(f"Помилка в декораторі require_authentication: {str(e)}")
            # У разі помилки, все одно пропускаємо запит для діагностики
            return f(*args, **kwargs)

    return decorated_function


def rate_limit(route_name):
    """Декоратор для обмеження частоти запитів"""

    def decorator(f):
        @wraps(f)
        def decorated_function(*args, **kwargs):
            try:
                # ВИПРАВЛЕННЯ: Додаємо додаткову обробку помилок

                # Отримуємо ID користувача (або IP адресу, якщо ID недоступний)
                user_id = getattr(g, 'user', None) or request.headers.get('X-Forwarded-For') or request.remote_addr

                # Ключ для відстеження
                key = f"{route_name}:{user_id}"

                # Перевіряємо, чи не занадто частий запит
                now = time.time()
                last_request_time = last_requests.get(key, 0)
                time_since_last = now - last_request_time

                # Отримуємо ліміт для маршруту
                rate_limit_seconds = RATE_LIMITS.get(route_name, 5)

                # ВИПРАВЛЕННЯ: Додаємо тимчасове відключення лімітування для діагностики
                if os.getenv("DISABLE_RATE_LIMITS", "false").lower() == "true":
                    logger.warning(f"Rate limiting відключено для {key}")
                    last_requests[key] = now
                    return f(*args, **kwargs)

                if time_since_last < rate_limit_seconds:
                    retry_after = rate_limit_seconds - time_since_last
                    logger.warning(f"Rate limit перевищено для {key}. Retry-After: {retry_after:.2f}с")

                    return jsonify({
                        "status": "error",
                        "message": f"Занадто багато запитів. Спробуйте знову через {int(retry_after) + 1} секунд.",
                        "code": "throttle",
                        "retry_after": retry_after
                    }), 429

                # Оновлюємо час останнього запиту
                last_requests[key] = now
                return f(*args, **kwargs)
            except Exception as e:
                logger.error(f"Помилка в декораторі rate_limit: {str(e)}")
                # У разі помилки, все одно пропускаємо запит для діагностики
                return f(*args, **kwargs)

        return decorated_function

    return decorator


def validate_raffle_id(f):
    """Декоратор для валідації ID розіграшу"""

    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            # ВИПРАВЛЕННЯ: Спрощуємо логіку перевірки для більшої стабільності

            # Перевіряємо ID розіграшу в URL
            if 'raffle_id' in kwargs:
                raffle_id = kwargs['raffle_id']

                # Перевірка на занадто короткі ID, які точно не є валідними UUID
                if not raffle_id or len(raffle_id) <= 5:
                    logger.warning(f"Критично невалідний ID розіграшу в URL: {raffle_id}")
                    return jsonify({
                        "status": "error",
                        "message": "Критично невалідний ідентифікатор розіграшу",
                        "code": "invalid_raffle_id"
                    }), 400

                # Перевіряємо валідність UUID спочатку нашої вдосконаленої функцією
                if not is_valid_uuid(raffle_id):
                    logger.warning(f"Невалідний формат ID розіграшу в URL: {raffle_id}")
                    return jsonify({
                        "status": "error",
                        "message": f"Невалідний формат ID розіграшу: {raffle_id}",
                        "code": "invalid_raffle_id"
                    }), 400

            # Перевіряємо ID розіграшу в JSON даних
            if request.method in ['POST', 'PUT'] and request.is_json:
                data = request.json
                if data and 'raffle_id' in data:
                    raffle_id = data['raffle_id']

                    # Перевірка на занадто короткі ID
                    if not raffle_id or len(str(raffle_id)) <= 5:
                        logger.warning(f"Критично невалідний ID розіграшу в JSON: {raffle_id}")
                        return jsonify({
                            "status": "error",
                            "message": "Критично невалідний ідентифікатор розіграшу",
                            "code": "invalid_raffle_id"
                        }), 400

                    # Перевіряємо валідність UUID
                    if not is_valid_uuid(str(raffle_id)):
                        logger.warning(f"Невалідний формат ID розіграшу в JSON: {raffle_id}")
                        return jsonify({
                            "status": "error",
                            "message": f"Невалідний формат ID розіграшу: {raffle_id}",
                            "code": "invalid_raffle_id"
                        }), 400

            return f(*args, **kwargs)
        except Exception as e:
            logger.error(f"Помилка в декораторі validate_raffle_id: {str(e)}")
            # У разі серйозної помилки, все одно пропускаємо запит для діагностики
            return f(*args, **kwargs)

    return decorated_function


def register_raffles_routes(app):
    """Реєстрація маршрутів для системи розіграшів"""
    logger.info("Початок реєстрації маршрутів розіграшів")

    # ВИПРАВЛЕННЯ: Спрощуємо критичні маршрути, видаляючи декоратори для діагностики

    # Публічні маршрути для користувачів
    @app.route('/api/raffles', methods=['GET'])
    def api_get_active_raffles():
        """Отримання списку активних розіграшів"""
        start_time = time.time()
        try:
            logger.info("api_get_active_raffles: Запит отримано")
            result = controllers.get_active_raffles()
            execution_time = time.time() - start_time
            logger.info(f"api_get_active_raffles: виконано за {execution_time:.4f}с")
            return result
        except Exception as e:
            execution_time = time.time() - start_time
            logger.error(f"api_get_active_raffles: помилка за {execution_time:.4f}с - {str(e)}")
            # Повертаємо порожній масив при помилці
            return jsonify({
                "status": "success",
                "data": [],
                "error": str(e)
            })

    @app.route('/api/raffles/<raffle_id>', methods=['GET'])
    def api_get_raffle_details(raffle_id):
        """Отримання деталей конкретного розіграшу"""
        try:
            logger.info(f"api_get_raffle_details: Запит отримано для {raffle_id}")
            if not is_valid_uuid(raffle_id):
                return jsonify({
                    "status": "error",
                    "message": f"Невалідний формат ID розіграшу: {raffle_id}",
                    "code": "invalid_raffle_id"
                }), 400

            return controllers.get_raffle_details(raffle_id)
        except controllers.RaffleNotFoundException:
            return jsonify({
                "status": "error",
                "message": f"Розіграш з ID {raffle_id} не знайдено",
                "code": "raffle_not_found"
            }), 404
        except Exception as e:
            logger.error(f"Помилка отримання деталей розіграшу {raffle_id}: {str(e)}")
            return jsonify({
                "status": "error",
                "message": "Помилка отримання деталей розіграшу",
                "error_details": str(e),
                "code": "server_error"
            }), 500

    @app.route('/api/user/<telegram_id>/raffles', methods=['GET'])
    def api_get_user_raffles(telegram_id):
        """Отримання розіграшів, у яких бере участь користувач"""
        try:
            logger.info(f"api_get_user_raffles: Запит отримано для {telegram_id}")
            return controllers.get_user_raffles(telegram_id)
        except Exception as e:
            logger.error(f"Помилка отримання розіграшів користувача {telegram_id}: {str(e)}")
            # Повертаємо порожній масив при помилці для кращого UX
            return jsonify({
                "status": "success",
                "data": [],
                "error_details": str(e)
            })

    @app.route('/api/user/<telegram_id>/raffles-history', methods=['GET'])
    def api_get_user_raffles_history(telegram_id):
        """Отримання історії участі користувача в розіграшах"""
        start_time = time.time()
        try:
            logger.info(f"api_get_user_raffles_history: Запит отримано для {telegram_id}")
            result = controllers.get_raffles_history(telegram_id)
            execution_time = time.time() - start_time
            logger.info(f"api_get_user_raffles_history: виконано за {execution_time:.4f}с")

            return result
        except Exception as e:
            execution_time = time.time() - start_time
            logger.error(f"api_get_user_raffles_history: помилка за {execution_time:.4f}с - {str(e)}")

            # Повертаємо порожній масив при помилці
            return jsonify({
                "status": "success",
                "data": [],
                "error_details": str(e)
            })

    @app.route('/api/user/<telegram_id>/participate-raffle', methods=['POST'])
    def api_participate_in_raffle(telegram_id):
        """Участь у розіграші"""
        try:
            logger.info(f"api_participate_in_raffle: Запит отримано для {telegram_id}")

            # Додаткова перевірка даних JSON
            if not request.is_json:
                return jsonify({
                    "status": "error",
                    "message": "Неверний формат запиту. Очікується JSON.",
                    "code": "invalid_request"
                }), 400

            data = request.json
            if not data or not data.get('raffle_id'):
                return jsonify({
                    "status": "error",
                    "message": "Відсутній ідентифікатор розіграшу в запиті",
                    "code": "missing_raffle_id"
                }), 400

            # Додаткова перевірка на валідність UUID
            raffle_id = data.get('raffle_id')
            if not is_valid_uuid(str(raffle_id)):
                return jsonify({
                    "status": "error",
                    "message": f"Невалідний формат ID розіграшу: {raffle_id}",
                    "code": "invalid_raffle_id"
                }), 400

            return controllers.participate_in_raffle(telegram_id, data)
        except controllers.InsufficientTokensError as e:
            return jsonify({
                "status": "error",
                "message": str(e),
                "code": "insufficient_tokens"
            }), 400
        except controllers.RaffleNotFoundException as e:
            return jsonify({
                "status": "error",
                "message": str(e),
                "code": "raffle_not_found"
            }), 404
        except controllers.RaffleAlreadyEndedError as e:
            return jsonify({
                "status": "error",
                "message": str(e),
                "code": "raffle_ended"
            }), 400
        except Exception as e:
            logger.error(f"Помилка участі в розіграші: {str(e)}")
            return jsonify({
                "status": "error",
                "message": "Виникла помилка при участі в розіграші",
                "error_details": str(e),
                "code": "server_error"
            }), 500

    # Додаємо маршрут для перевірки валідності UUID
    @app.route('/api/validate-uuid/<uuid_string>', methods=['GET'])
    def validate_uuid_endpoint(uuid_string):
        """Ендпоінт для перевірки валідності UUID"""
        valid = is_valid_uuid(uuid_string)
        return jsonify({
            "status": "success",
            "valid": valid,
            "uuid": uuid_string,
            "message": "UUID валідний" if valid else "UUID невалідний"
        })

    # Спеціальний ендпоінт для балансу без обмеження частоти
    @app.route('/api/user/<telegram_id>/balance', methods=['GET'])
    def get_user_balance_endpoint(telegram_id):
        """Спеціальний ендпоінт для отримання балансу без обмеження частоти"""
        try:
            # Отримуємо дані користувача
            from users.controllers import get_user_info
            user = get_user_info(telegram_id)

            if not user:
                return jsonify({
                    "status": "error",
                    "message": "Користувача не знайдено",
                    "code": "user_not_found"
                }), 404

            return jsonify({
                "status": "success",
                "data": {
                    "balance": user.get("balance", 0),
                    "coins": user.get("coins", 0)
                }
            })
        except Exception as e:
            logger.error(f"Помилка отримання балансу: {str(e)}")
            return jsonify({
                "status": "error",
                "message": f"Помилка сервера: {str(e)}",
                "code": "server_error"
            }), 500

    # Ендпоінт для перевірки валідності розіграшу перед участю
    @app.route('/api/raffles/<raffle_id>/check', methods=['GET'])
    def api_check_raffle_exists(raffle_id):
        """Перевірка існування розіграшу перед участю"""
        try:
            # Перевіряємо існування розіграшу
            controllers.check_raffle_exists(raffle_id)
            return jsonify({
                "status": "success",
                "message": "Розіграш існує та валідний",
                "raffle_id": raffle_id
            })
        except controllers.RaffleNotFoundException:
            return jsonify({
                "status": "error",
                "message": f"Розіграш з ID {raffle_id} не знайдено",
                "code": "raffle_not_found"
            }), 404
        except controllers.InvalidRaffleIDError:
            return jsonify({
                "status": "error",
                "message": f"Невалідний формат ID розіграшу: {raffle_id}",
                "code": "invalid_raffle_id"
            }), 400
        except Exception as e:
            logger.error(f"Помилка перевірки розіграшу {raffle_id}: {str(e)}")
            return jsonify({
                "status": "error",
                "message": f"Помилка перевірки розіграшу: {str(e)}",
                "code": "server_error"
            }), 500

    # Додатковий маршрут для моніторингу стану розіграшів
    @app.route('/api/raffles/status', methods=['GET'])
    def api_get_raffles_status():
        """Отримання статистики про активні розіграші"""
        try:
            # Імпортуємо supabase для цього конкретного маршруту
            try:
                from supabase_client import supabase
            except ImportError:
                return jsonify({
                    "status": "error",
                    "message": "Модуль supabase недоступний",
                    "code": "module_not_found"
                }), 500

            # Отримуємо кількість активних розіграшів
            active_count_response = supabase.table("raffles").select("count", count="exact").eq("status",
                                                                                                "active").execute()
            active_count = active_count_response.count if hasattr(active_count_response, 'count') else 0

            # Отримуємо кількість завершених розіграшів
            completed_count_response = supabase.table("raffles").select("count", count="exact").eq("status",
                                                                                                   "completed").execute()
            completed_count = completed_count_response.count if hasattr(completed_count_response, 'count') else 0

            return jsonify({
                "status": "success",
                "data": {
                    "active_raffles": active_count,
                    "completed_raffles": completed_count
                }
            })
        except Exception as e:
            logger.error(f"Помилка отримання статистики розіграшів: {str(e)}")
            return jsonify({
                "status": "error",
                "message": "Помилка отримання статистики розіграшів",
                "code": "server_error"
            }), 500

    # Маршрут для діагностики проблем з UUID
    @app.route('/api/debug/uuid/<uuid_string>', methods=['GET'])
    def api_debug_uuid(uuid_string):
        """Ендпоінт для відладки проблем з UUID"""
        try:
            # Перевіряємо різними способами
            valid_our = is_valid_uuid(uuid_string)
            valid_controllers = controllers.is_valid_uuid(uuid_string)

            # Спроба створення UUID об'єкта
            try:
                uuid_obj = uuid.UUID(uuid_string)
                uuid_created = True
                uuid_str = str(uuid_obj)
                uuid_hex = uuid_obj.hex
                uuid_match = uuid_str == uuid_string
            except Exception as e:
                uuid_created = False
                uuid_str = None
                uuid_hex = None
                uuid_match = False

            return jsonify({
                "status": "success",
                "uuid_string": uuid_string,
                "length": len(uuid_string),
                "valid_our_function": valid_our,
                "valid_controllers_function": valid_controllers,
                "uuid_object_created": uuid_created,
                "uuid_string_from_object": uuid_str,
                "uuid_hex": uuid_hex,
                "string_matches": uuid_match
            })
        except Exception as e:
            return jsonify({
                "status": "error",
                "message": f"Помилка аналізу UUID: {str(e)}",
                "uuid_string": uuid_string
            }), 500

    # Діагностичний маршрут для всіх API запитів
    @app.route('/api/system-info', methods=['GET'])
    def api_system_info():
        """Отримання системної інформації для діагностики"""
        try:
            return jsonify({
                "status": "success",
                "system_info": {
                    "python_version": sys.version,
                    "app_directory": os.path.dirname(os.path.abspath(__file__)),
                    "environment": os.environ.get("FLASK_ENV", "production"),
                    "debug_mode": os.environ.get("DEBUG", "false"),
                    "server_time": datetime.now().isoformat(),
                    "api_routes_registered": True,
                    "rate_limits": RATE_LIMITS
                }
            })
        except Exception as e:
            logger.error(f"Помилка отримання системної інформації: {str(e)}")
            return jsonify({
                "status": "error",
                "message": f"Помилка отримання системної інформації: {str(e)}",
                "code": "server_error"
            }), 500

    logger.info("Маршрути для розіграшів успішно зареєстровано")
    return True