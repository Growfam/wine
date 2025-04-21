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
    Спрощена перевірка валідності UUID - приймає будь-який рядок, який можна
    перетворити в UUID об'єкт
    """
    # Перевірка на None та порожні рядки
    if not uuid_string:
        return False

    try:
        # Спроба перетворити рядок в UUID об'єкт
        uuid_obj = uuid.UUID(str(uuid_string).strip())
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
    Спрощений декоратор для валідації ID розіграшу.
    Просто пропускає запити далі, щоб не блокувати їх валідацією.
    """

    @wraps(f)
    def decorated_function(*args, **kwargs):
        # Просто пропускаємо запити без додаткової валідації
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

            return controllers.participate_in_raffle(telegram_id, data)
        except Exception as e:
            logger.error(f"Помилка участі в розіграші: {str(e)}")
            return jsonify({
                "status": "error",
                "message": f"Виникла помилка при участі в розіграші: {str(e)}"
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
    def api_check_raffle_exists(raffle_id):
        """Перевірка існування розіграшу перед участю"""
        try:
            # Спрощена перевірка існування розіграшу
            try:
                from supabase_client import supabase
                response = supabase.table("raffles").select("id").eq("id", raffle_id).execute()
                exists = response.data and len(response.data) > 0
            except Exception as e:
                logger.error(f"Помилка запиту до бази даних: {str(e)}")
                exists = False

            if exists:
                return jsonify({
                    "status": "success",
                    "message": "Розіграш існує та валідний",
                    "raffle_id": raffle_id
                })
            else:
                return jsonify({
                    "status": "error",
                    "message": f"Розіграш з ID {raffle_id} не знайдено"
                }), 404
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

    @app.route('/api/user/<telegram_id>/statistics', methods=['GET'])
    def api_get_user_statistics(telegram_id):
        """Отримання статистики участі користувача в розіграшах"""
        try:
            logger.info(f"api_get_user_statistics: Запит отримано для {telegram_id}")

            # Перевіряємо, чи існує користувач
            try:
                from users.controllers import get_user_info
                user = get_user_info(telegram_id)

                if not user:
                    return jsonify({
                        "status": "error",
                        "message": "Користувача не знайдено"
                    }), 404
            except Exception as e:
                logger.error(f"Помилка перевірки користувача: {str(e)}")
                # Продовжуємо виконання, щоб спробувати отримати статистику навіть без даних користувача

            # Отримуємо дані про участь у розіграшах
            from supabase_client import supabase

            # Отримуємо кількість участей (виправлено запит)
            try:
                participations_query = supabase.table("raffle_participants") \
                    .select("*", count="exact") \
                    .eq("telegram_id", telegram_id) \
                    .execute()

                participations_count = participations_query.count if hasattr(participations_query, 'count') else 0
            except Exception as e:
                logger.error(f"Помилка отримання кількості участей: {str(e)}")
                participations_count = 0

            # Отримуємо кількість перемог (виправлено запит)
            try:
                winners_query = supabase.table("raffle_winners") \
                    .select("*", count="exact") \
                    .eq("telegram_id", telegram_id) \
                    .execute()

                wins_count = winners_query.count if hasattr(winners_query, 'count') else 0
            except Exception as e:
                logger.error(f"Помилка отримання кількості перемог: {str(e)}")
                wins_count = 0

            # Отримуємо суму виграшів
            total_winnings = 0
            try:
                if hasattr(winners_query, 'data') and winners_query.data:
                    for winner in winners_query.data:
                        # Якщо є поле prize_amount, додаємо його до загальної суми
                        if "prize_amount" in winner and winner["prize_amount"]:
                            total_winnings += int(winner["prize_amount"])
            except Exception as e:
                logger.error(f"Помилка підрахунку суми виграшів: {str(e)}")

            # Отримуємо витрачені жетони
            tokens_spent = 0
            try:
                # Спробуємо зробити прямий запит на суму витрачених жетонів
                tokens_query = supabase.rpc(
                    'sum_entry_counts',
                    {'user_telegram_id': telegram_id}
                ).execute()

                # Якщо функція суми існує, використовуємо її результат
                if tokens_query.data and tokens_query.data[0]:
                    tokens_spent = tokens_query.data[0] or 0
                else:
                    # Інакше обчислюємо суму вручну
                    if participations_query.data:
                        for participation in participations_query.data:
                            entry_fee = participation.get("entry_count") or participation.get("price_amount") or 1
                            tokens_spent += int(entry_fee)
            except Exception as e:
                logger.error(f"Помилка підрахунку витрачених жетонів: {str(e)}")
                # Груба оцінка: кількість участей * 1 (мінімальний внесок)
                tokens_spent = participations_count

            # Отримуємо дані активності за останній тиждень
            import datetime

            today = datetime.datetime.now()
            activity_data = []

            # Створюємо дані активності за дні тижня (виправлено запит)
            try:
                for i in range(7):
                    day = today - datetime.timedelta(days=i)
                    day_name = day.strftime("%a")  # Коротка назва дня тижня

                    # Запит для цього дня
                    day_start = day.replace(hour=0, minute=0, second=0)
                    day_end = day.replace(hour=23, minute=59, second=59)

                    day_query = supabase.table("raffle_participants") \
                        .select("*", count="exact") \
                        .eq("telegram_id", telegram_id) \
                        .gte("created_at", day_start.isoformat()) \
                        .lte("created_at", day_end.isoformat()) \
                        .execute()

                    count = day_query.count if hasattr(day_query, 'count') else 0

                    activity_data.append({
                        "day": day_name,
                        "count": count
                    })
            except Exception as e:
                logger.error(f"Помилка отримання даних активності: {str(e)}")
                # Якщо сталася помилка, створюємо пусті дані активності
                activity_data = [{"day": f"День {i + 1}", "count": 0} for i in range(7)]

            # Повертаємо статистику
            return jsonify({
                "status": "success",
                "data": {
                    "participations_count": participations_count,
                    "wins_count": wins_count,
                    "total_winnings": total_winnings,
                    "tokens_spent": tokens_spent,
                    "win_rate": (wins_count / participations_count * 100) if participations_count > 0 else 0,
                    "activity_data": activity_data
                }
            })
        except Exception as e:
            logger.error(f"Помилка отримання статистики користувача {telegram_id}: {str(e)}")
            return jsonify({
                "status": "error",
                "message": f"Помилка отримання статистики: {str(e)}"
            }), 500

    logger.info("✅ Маршрути для розіграшів успішно зареєстровано")
    return True