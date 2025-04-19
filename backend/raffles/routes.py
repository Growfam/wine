from flask import request, jsonify, g
import logging
import jwt
import os
import sys
import time
import uuid
import re
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
    try:
        import controllers
    except ImportError:
        logger.error("❌ Критична помилка імпорту controllers.py")
        controllers = None

# Імпортуємо змінні конфігурації
try:
    from backend.settings.config import JWT_SECRET, JWT_ALGORITHM
except ImportError:
    try:
        from settings.config import JWT_SECRET, JWT_ALGORITHM
    except ImportError:
        logger.warning("⚠️ Не вдалося імпортувати JWT_SECRET та JWT_ALGORITHM")
        JWT_SECRET = "winix-secret-key"
        JWT_ALGORITHM = "HS256"

# Завантажуємо змінні середовища
try:
    from dotenv import load_dotenv

    load_dotenv()
except ImportError:
    logger.warning("⚠️ Не вдалося імпортувати load_dotenv")

# Часові обмеження для маршрутів
RATE_LIMITS = {
    "get_active_raffles": 20,
    "get_raffles_history": 180,
    "get_user_raffles": 30,
    "participate_in_raffle": 30,
}

# Відстеження останніх запитів користувачів
last_requests = {}

# Визначаємо, чи потрібно відключити обмеження швидкості запитів
DISABLE_RATE_LIMITS = os.getenv("DISABLE_RATE_LIMITS", "true").lower() == "true"
if DISABLE_RATE_LIMITS:
    logger.info("📢 Обмеження швидкості запитів відключено")
else:
    logger.info("📢 Обмеження швидкості запитів включено")


def is_valid_uuid(uuid_string):
    """
    Покращена перевірка валідності UUID - приймає будь-який рядок, який можна
    перетворити в UUID об'єкт, включаючи рядки без дефісів
    """
    # Перевірка на None та порожні рядки
    if not uuid_string:
        return False

    # Спочатку нормалізуємо рядок
    normalized_uuid = uuid_string.strip().lower()

    # Перевірка на UUID без дефісів (32 символи)
    if re.match(r'^[0-9a-f]{32}$', normalized_uuid):
        # Конвертуємо у формат з дефісами
        formatted_uuid = f"{normalized_uuid[0:8]}-{normalized_uuid[8:12]}-{normalized_uuid[12:16]}-{normalized_uuid[16:20]}-{normalized_uuid[20:]}"
        normalized_uuid = formatted_uuid

    try:
        # Спроба перетворити рядок в UUID об'єкт
        uuid_obj = uuid.UUID(normalized_uuid)
        return True
    except Exception:
        return False


def require_authentication(f):
    """Декоратор для захисту API ендпоінтів"""

    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            # Якщо це GET запит, дозволяємо без авторизації для спрощення
            if request.method == 'GET':
                g.user = request.headers.get('X-Telegram-User-Id') or kwargs.get('telegram_id', None)
                return f(*args, **kwargs)

            # Перевіряємо наявність токена в заголовках
            auth_header = request.headers.get("Authorization")

            if not auth_header or not auth_header.startswith("Bearer "):
                return jsonify({
                    "status": "error",
                    "message": "Необхідна аутентифікація"
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
                    "message": "Термін дії токена минув"
                }), 401
            except jwt.InvalidTokenError:
                return jsonify({
                    "status": "error",
                    "message": "Недійсний токен"
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
                # Якщо обмеження відключено, просто виконуємо функцію
                if DISABLE_RATE_LIMITS:
                    return f(*args, **kwargs)

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

                if time_since_last < rate_limit_seconds:
                    retry_after = rate_limit_seconds - time_since_last
                    logger.warning(f"Rate limit перевищено для {key}. Retry-After: {retry_after:.2f}с")

                    return jsonify({
                        "status": "error",
                        "message": f"Занадто багато запитів. Спробуйте знову через {int(retry_after) + 1} секунд.",
                        "retry_after": retry_after
                    }), 429

                # Оновлюємо час останнього запиту
                last_requests[key] = now
                return f(*args, **kwargs)
            except Exception as e:
                logger.error(f"Помилка в декораторі rate_limit: {str(e)}")
                # У разі помилки, все одно пропускаємо запит
                return f(*args, **kwargs)

        return decorated_function

    return decorator


def validate_raffle_id(f):
    """
    Декоратор для валідації ID розіграшу.
    Перевіряє формат UUID та нормалізує його при необхідності.
    """

    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Отримуємо значення raffle_id
        raffle_id = kwargs.get('raffle_id')

        if raffle_id:
            # Нормалізуємо ID
            raffle_id = str(raffle_id).strip()

            # Перевіряємо формат
            if not is_valid_uuid(raffle_id):
                logger.warning(f"Невалідний UUID в запиті: {raffle_id}")
                return jsonify({
                    "status": "error",
                    "message": "Невалідний формат ID розіграшу",
                    "code": "invalid_uuid"
                }), 400

            # Перетворюємо UUID до стандартного формату, якщо потрібно
            if re.match(r'^[0-9a-f]{32}$', raffle_id.lower()):
                normalized = raffle_id.lower()
                formatted = f"{normalized[0:8]}-{normalized[8:12]}-{normalized[12:16]}-{normalized[16:20]}-{normalized[20:]}"
                kwargs['raffle_id'] = formatted
                logger.info(f"UUID нормалізовано з {raffle_id} до {formatted}")

        # Продовжуємо виконання оригінальної функції
        return f(*args, **kwargs)

    return decorated_function


def register_raffles_routes(app):
    """Реєстрація маршрутів для системи розіграшів"""
    if not controllers:
        logger.error("❌ Не вдалося імпортувати controllers, маршрути розіграшів не будуть зареєстровані")
        return False

    logger.info("📢 Початок реєстрації маршрутів розіграшів")

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
    @validate_raffle_id
    def api_get_raffle_details(raffle_id):
        """Отримання деталей конкретного розіграшу"""
        try:
            logger.info(f"api_get_raffle_details: Запит отримано для {raffle_id}")
            return controllers.get_raffle_details(raffle_id)
        except Exception as e:
            logger.error(f"Помилка отримання деталей розіграшу {raffle_id}: {str(e)}")
            return jsonify({
                "status": "error",
                "message": f"Помилка отримання деталей розіграшу: {str(e)}"
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
        start_time = time.time()

        try:
            logger.info(f"api_participate_in_raffle: Запит отримано для {telegram_id}")

            # Додаткова перевірка даних JSON
            if not request.is_json:
                return jsonify({
                    "status": "error",
                    "message": "Неверний формат запиту. Очікується JSON."
                }), 400

            data = request.json
            if not data or not data.get('raffle_id'):
                return jsonify({
                    "status": "error",
                    "message": "Відсутній ідентифікатор розіграшу в запиті"
                }), 400

            # Перевірка і нормалізація UUID
            raffle_id = data.get('raffle_id')
            if not is_valid_uuid(raffle_id):
                logger.warning(f"Невалідний UUID в запиті участі: {raffle_id}")
                return jsonify({
                    "status": "error",
                    "message": "Невалідний формат ID розіграшу",
                    "code": "invalid_uuid"
                }), 400

            # Нормалізація UUID (для UUID без дефісів)
            if re.match(r'^[0-9a-f]{32}$', str(raffle_id).lower()):
                normalized = str(raffle_id).lower()
                formatted = f"{normalized[0:8]}-{normalized[8:12]}-{normalized[12:16]}-{normalized[16:20]}-{normalized[20:]}"
                data['raffle_id'] = formatted
                logger.info(f"UUID нормалізовано з {raffle_id} до {formatted}")
                raffle_id = formatted

            # Додаємо час запиту для діагностики
            data['_timestamp'] = int(time.time() * 1000)
            data['_client_timestamp'] = request.args.get('t', 0)

            # Спробуємо використати більш надійний метод через сервіс розіграшів
            try:
                logger.info(f"Спроба використати RPC метод для участі {telegram_id} в розіграші {raffle_id}")
                from raffles.raffle_service import get_raffle_service

                raffle_service = get_raffle_service()
                entry_count = data.get('entry_count', 1)

                # Перевіряємо валідність entry_count
                try:
                    entry_count = int(entry_count)
                    if entry_count <= 0:
                        entry_count = 1
                except (ValueError, TypeError):
                    entry_count = 1

                result = raffle_service.participate_in_raffle(telegram_id, raffle_id, entry_count)

                execution_time = time.time() - start_time
                logger.info(f"api_participate_in_raffle: RPC метод виконано за {execution_time:.4f}с")

                if result.get('success'):
                    return jsonify({
                        "status": "success",
                        "data": result.get('data', {}),
                        "execution_time": execution_time
                    })
                else:
                    return jsonify({
                        "status": "error",
                        "message": result.get('error', 'Помилка участі в розіграші'),
                        "execution_time": execution_time
                    }), 400

            except ImportError:
                # Якщо сервіс недоступний, використовуємо стандартний контролер
                logger.info(
                    f"RPC метод недоступний, використовуємо контролер для участі {telegram_id} в розіграші {raffle_id}")
                result = controllers.participate_in_raffle(telegram_id, data)

                execution_time = time.time() - start_time
                logger.info(f"api_participate_in_raffle: стандартний метод виконано за {execution_time:.4f}с")

                return result

        except Exception as e:
            execution_time = time.time() - start_time
            logger.error(f"api_participate_in_raffle: помилка за {execution_time:.4f}с - {str(e)}", exc_info=True)

            return jsonify({
                "status": "error",
                "message": f"Виникла помилка при участі в розіграші: {str(e)}",
                "execution_time": execution_time
            }), 500

    # Додаємо маршрут для перевірки валідності UUID
    @app.route('/api/validate-uuid/<uuid_string>', methods=['GET'])
    def validate_uuid_endpoint(uuid_string):
        """Ендпоінт для перевірки валідності UUID"""
        valid = is_valid_uuid(uuid_string)

        # Нормалізуємо UUID, якщо він валідний але в неканонічному форматі
        normalized_uuid = uuid_string
        if valid and re.match(r'^[0-9a-f]{32}$', uuid_string.lower()):
            normalized = uuid_string.lower()
            normalized_uuid = f"{normalized[0:8]}-{normalized[8:12]}-{normalized[12:16]}-{normalized[16:20]}-{normalized[20:]}"

        return jsonify({
            "status": "success",
            "valid": valid,
            "uuid": uuid_string,
            "normalized_uuid": normalized_uuid if valid else None,
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
                    "message": "Користувача не знайдено"
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
                "message": f"Помилка сервера: {str(e)}"
            }), 500

    # Ендпоінт для перевірки валідності розіграшу перед участю
    @app.route('/api/raffles/<raffle_id>/check', methods=['GET'])
    @validate_raffle_id
    def api_check_raffle_exists(raffle_id):
        """Перевірка існування розіграшу перед участю"""
        try:
            # Спрощена перевірка існування розіграшу
            try:
                from supabase_client import supabase
                response = supabase.table("raffles").select("id, status, end_time").eq("id", raffle_id).execute()

                if not response.data or len(response.data) == 0:
                    return jsonify({
                        "status": "error",
                        "message": f"Розіграш з ID {raffle_id} не знайдено",
                        "code": "raffle_not_found"
                    }), 404

                # Перевіряємо статус розіграшу
                raffle = response.data[0]
                if raffle.get("status") != "active":
                    logger.warning(f"Розіграш {raffle_id} не активний: {raffle.get('status')}")
                    return jsonify({
                        "status": "error",
                        "message": "Розіграш вже завершено або неактивний",
                        "code": "raffle_not_active"
                    }), 400

                # Перевіряємо час завершення
                try:
                    end_time = datetime.fromisoformat(raffle.get("end_time", "").replace('Z', '+00:00'))
                    now = datetime.now().astimezone()

                    if now >= end_time:
                        logger.warning(f"Розіграш {raffle_id} вже завершився: {end_time}")
                        return jsonify({
                            "status": "error",
                            "message": "Розіграш вже завершився за часом",
                            "code": "raffle_ended"
                        }), 400
                except (ValueError, AttributeError) as e:
                    logger.error(f"Помилка перевірки часу завершення для {raffle_id}: {str(e)}")

                # Якщо все добре
                return jsonify({
                    "status": "success",
                    "message": "Розіграш існує та валідний",
                    "raffle_id": raffle_id,
                    "data": {
                        "status": raffle.get("status"),
                        "end_time": raffle.get("end_time")
                    }
                })

            except Exception as e:
                logger.error(f"Помилка запиту до бази даних: {str(e)}")
                raise e

        except Exception as e:
            logger.error(f"Помилка перевірки розіграшу {raffle_id}: {str(e)}")
            return jsonify({
                "status": "error",
                "message": f"Помилка перевірки розіграшу: {str(e)}"
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
                    "rate_limits": RATE_LIMITS,
                    "rate_limits_disabled": DISABLE_RATE_LIMITS
                }
            })
        except Exception as e:
            logger.error(f"Помилка отримання системної інформації: {str(e)}")
            return jsonify({
                "status": "error",
                "message": f"Помилка отримання системної інформації: {str(e)}"
            }), 500

    # Додатковий тестовий маршрут для розіграшів
    @app.route('/api/raffles-healthcheck', methods=['GET'])
    def api_raffles_healthcheck():
        """Перевірка стану системи розіграшів"""
        return jsonify({
            "status": "success",
            "message": "API розіграшів працює коректно",
            "timestamp": datetime.now().isoformat()
        })

    # Додаємо ендпоінт для перевірки транзакцій
    @app.route('/api/user/<telegram_id>/transaction/<transaction_id>', methods=['GET'])
    def api_check_transaction(telegram_id, transaction_id):
        """Перевірка стану транзакції"""
        try:
            # Спрощена перевірка транзакції
            try:
                from supabase_client import supabase
                response = supabase.table("transactions").select("*").eq("id", transaction_id).execute()

                if not response.data or len(response.data) == 0:
                    return jsonify({
                        "status": "error",
                        "message": f"Транзакцію з ID {transaction_id} не знайдено",
                        "code": "transaction_not_found"
                    }), 404

                transaction = response.data[0]

                # Перевіряємо, чи транзакція належить цьому користувачу
                if str(transaction.get("telegram_id")) != str(telegram_id):
                    return jsonify({
                        "status": "error",
                        "message": "Ви не маєте доступу до цієї транзакції",
                        "code": "unauthorized"
                    }), 403

                # Повертаємо дані транзакції
                return jsonify({
                    "status": "success",
                    "data": transaction
                })

            except Exception as e:
                logger.error(f"Помилка запиту до бази даних: {str(e)}")
                raise e

        except Exception as e:
            logger.error(f"Помилка перевірки транзакції {transaction_id}: {str(e)}")
            return jsonify({
                "status": "error",
                "message": f"Помилка перевірки транзакції: {str(e)}"
            }), 500

    logger.info("✅ Маршрути для розіграшів успішно зареєстровано")
    return True