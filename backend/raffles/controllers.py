"""
Контролери для системи розіграшів WINIX з виправленнями для вирішення проблем:
- Покращена перевірка існування розіграшів і валідація UUID
- Покращена обробка помилок, особливо при пошуку неіснуючих розіграшів
- Покращене кешування та логування
"""

from flask import jsonify, request
import logging
import os
import sys
import time
import uuid
from datetime import datetime, timezone, timedelta
from functools import wraps

# Налаштування логування
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Імпортуємо з supabase_client
try:
    from ..supabase_client import (
        supabase, get_user, update_user, update_balance, update_coins,
        check_and_update_badges, execute_transaction, cache_get, cache_set, clear_cache
    )
    # Імпортуємо допоміжні функції для транзакцій
    from ..utils.transaction_helpers import create_transaction_record, update_transaction_status
except ImportError:
    # Альтернативний шлях для прямих імпортів
    try:
        current_dir = os.path.dirname(os.path.abspath(__file__))
        parent_dir = os.path.dirname(current_dir)
        if parent_dir not in sys.path:
            sys.path.append(parent_dir)

        from supabase_client import (
            supabase, get_user, update_user, update_balance, update_coins,
            check_and_update_badges, execute_transaction, cache_get, cache_set, clear_cache
        )
        from utils.transaction_helpers import create_transaction_record, update_transaction_status
    except ImportError as e:
        logger.error(f"Критична помилка імпорту: {str(e)}")
        supabase = None
        get_user = None
        update_user = None
        update_balance = None
        update_coins = None
        check_and_update_badges = None
        execute_transaction = None
        cache_get = None
        cache_set = None
        clear_cache = None
        create_transaction_record = None
        update_transaction_status = None


# Користувацькі винятки для покращеної обробки помилок
class RaffleError(Exception):
    """Базовий клас для винятків, пов'язаних з розіграшами"""
    pass


class RaffleNotFoundException(RaffleError):
    """Виняток, який виникає, коли розіграш не знайдено"""
    pass


class InvalidRaffleIDError(RaffleError):
    """Виняток, який виникає при невалідному форматі ID розіграшу"""
    pass


class ParticipationError(RaffleError):
    """Виняток, який виникає при проблемах з участю в розіграші"""
    pass


class InsufficientTokensError(ParticipationError):
    """Виняток, який виникає при недостатній кількості жетонів"""
    pass


class RaffleAlreadyEndedError(RaffleError):
    """Виняток, який виникає, коли розіграш вже завершено"""
    pass


class UnauthorizedAccessError(Exception):
    """Виняток, який виникає при спробі неавторизованого доступу"""
    pass


# Обмеження для запобігання зловживанням
MAX_ENTRY_COUNT = 100  # Максимальна кількість жетонів на одну участь
MAX_RESULTS_PER_PAGE = 100  # Максимальна кількість результатів на сторінку

# Константи для кешування (збільшені для покращення продуктивності)
HISTORY_CACHE_TTL = 900  # 15 хвилин для історії розіграшів (збільшено з 600)
ACTIVE_RAFFLES_CACHE_TTL = 120  # 2 хвилини для активних розіграшів (збільшено з 60)
RAFFLE_DETAILS_CACHE_TTL = 300  # 5 хвилин для деталей розіграшу


# Декоратор для обробки винятків
def handle_exceptions(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            return f(*args, **kwargs)
        except InvalidRaffleIDError as e:
            logger.warning(f"Невалідний формат ID розіграшу у {f.__name__}: {str(e)}")
            return jsonify({
                "status": "error",
                "message": str(e),
                "code": "invalid_raffle_id"
            }), 400
        except RaffleNotFoundException as e:
            logger.warning(f"Розіграш не знайдено у {f.__name__}: {str(e)}")
            return jsonify({
                "status": "error",
                "message": str(e),
                "code": "raffle_not_found"
            }), 404
        except InsufficientTokensError as e:
            logger.warning(f"Недостатньо жетонів у {f.__name__}: {str(e)}")
            return jsonify({
                "status": "error",
                "message": str(e),
                "code": "insufficient_tokens"
            }), 400
        except RaffleAlreadyEndedError as e:
            logger.warning(f"Розіграш вже завершено у {f.__name__}: {str(e)}")
            return jsonify({
                "status": "error",
                "message": str(e),
                "code": "raffle_ended"
            }), 400
        except ParticipationError as e:
            logger.warning(f"Помилка участі у {f.__name__}: {str(e)}")
            return jsonify({
                "status": "error",
                "message": str(e),
                "code": "participation_error"
            }), 400
        except UnauthorizedAccessError as e:
            logger.warning(f"Неавторизований доступ у {f.__name__}: {str(e)}")
            return jsonify({
                "status": "error",
                "message": str(e),
                "code": "unauthorized"
            }), 403
        except ValueError as e:
            logger.warning(f"Помилка валідації у {f.__name__}: {str(e)}")
            return jsonify({
                "status": "error",
                "message": str(e),
                "code": "validation_error"
            }), 400
        except Exception as e:
            logger.error(f"Помилка у {f.__name__}: {str(e)}", exc_info=True)

            # Для певних функцій повертаємо безпечну відповідь замість помилки
            if f.__name__ == "get_raffles_history":
                # Для історії розіграшів повертаємо порожній масив
                return jsonify({
                    "status": "success",
                    "data": [],
                    "error_fallback": True,
                    "error_details": str(e) if os.getenv("DEBUG") == "true" else None
                })
            elif f.__name__ == "get_active_raffles":
                # Для активних розіграшів повертаємо порожній масив
                return jsonify({
                    "status": "success",
                    "data": [],
                    "error_fallback": True,
                    "error_details": str(e) if os.getenv("DEBUG") == "true" else None
                })

            # Для інших функцій повертаємо звичайну помилку
            return jsonify({
                "status": "error",
                "message": "Сталася помилка на сервері. Спробуйте пізніше.",
                "error_details": str(e) if os.getenv("DEBUG") == "true" else None,
                "code": "server_error"
            }), 500

    return decorated_function


# Клас для транзакційних операцій
class RaffleTransaction:
    @staticmethod
    def create_transaction_context(user_id, transaction_type, amount, description, raffle_id=None):
        """Створює контекст транзакції для роботи з балансом користувача"""
        return {
            "telegram_id": user_id,
            "type": transaction_type,
            "amount": amount,
            "description": description,
            "status": "pending",  # Початковий статус - очікування
            "raffle_id": raffle_id,
            "created_at": datetime.now(timezone.utc).isoformat()
        }

    @staticmethod
    def execute_transaction(user_id, amount, transaction_data):
        """Виконує транзакцію з атомарним оновленням балансу"""
        try:
            # Отримуємо поточного користувача для актуального балансу
            user = get_user(user_id)
            if not user:
                raise ValueError(f"Користувача з ID {user_id} не знайдено")

            current_coins = int(user.get("coins", 0))

            # Перевіряємо, чи достатньо коштів (для від'ємної суми)
            if amount < 0 and current_coins + amount < 0:
                raise InsufficientTokensError(f"Недостатньо жетонів: потрібно {abs(amount)}, наявно {current_coins}")

            # Створюємо транзакцію
            transaction_id = str(uuid.uuid4())
            transaction_data["id"] = transaction_id
            transaction_data["previous_balance"] = current_coins

            # Виконуємо атомарне оновлення
            with execute_transaction() as txn:
                # 1. Створюємо запис транзакції зі статусом "pending"
                txn.table("transactions").insert(transaction_data).execute()

                # 2. Оновлюємо баланс користувача
                new_coins = current_coins + amount
                txn.table("winix").update({"coins": new_coins}).eq("telegram_id", user_id).execute()

                # 3. Оновлюємо статус транзакції на "completed"
                txn.table("transactions").update({"status": "completed"}).eq("id", transaction_id).execute()

            # Повертаємо оновлені дані
            return {
                "transaction_id": transaction_id,
                "previous_balance": current_coins,
                "new_balance": new_coins,
                "amount": amount
            }
        except Exception as e:
            logger.error(f"Помилка виконання транзакції для {user_id}: {str(e)}")
            raise


# Функція для перевірки валідності UUID
def is_valid_uuid(raffle_id):
    """
    Спрощена перевірка валідності UUID (більш гнучка)
    """
    if not raffle_id:
        return False

    try:
        # Перетворюємо в UUID об'єкт
        uuid_obj = uuid.UUID(str(raffle_id).strip())
        return True
    except Exception:
        # Будь-яка помилка означає, що це не валідний UUID
        return False


# Функція для перевірки існування розіграшу в базі даних
def check_raffle_exists(raffle_id):
    """Перевіряє існування розіграшу в базі даних"""
    # Перетворюємо ID у правильний формат
    try:
        raffle_id = str(raffle_id).strip()
    except Exception:
        logger.warning(f"Невалідний формат ID розіграшу: {raffle_id}")
        raise InvalidRaffleIDError(f"Невалідний формат ID розіграшу")

    try:
        response = supabase.table("raffles").select("id").eq("id", raffle_id).execute()

        if not response.data or len(response.data) == 0:
            logger.warning(f"Розіграш з ID {raffle_id} не знайдено в базі даних")
            return False

        return True
    except Exception as e:
        logger.error(f"Помилка перевірки існування розіграшу {raffle_id}: {str(e)}")
        # Не піднімаємо виняток, щоб не блокувати роботу
        return False


# Нова функція для виконання транзакції напряму
def execute_transaction_directly(telegram_id, raffle_id, required_coins):
    """Виконує транзакцію безпосередньо через SQL-запити замість RPC"""
    try:
        with execute_transaction() as txn:
            # 1. Перевірка наявності розіграшу та його статусу
            raffle_resp = txn.table("raffles").select("*").eq("id", raffle_id).execute()
            if not raffle_resp.data:
                return {"status": "error", "message": "Розіграш не знайдено"}

            raffle = raffle_resp.data[0]
            if raffle.get("status") != "active":
                return {"status": "error", "message": "Розіграш не є активним"}

            # 2. Перевірка наявності жетонів користувача
            user_resp = txn.table("winix").select("coins").eq("telegram_id", telegram_id).execute()
            if not user_resp.data:
                return {"status": "error", "message": "Користувача не знайдено"}

            user_coins = user_resp.data[0].get("coins", 0)
            if user_coins < required_coins:
                return {"status": "error", "message": f"Недостатньо жетонів: потрібно {required_coins}, наявно {user_coins}"}

            # 3. Перевірка поточної участі
            participant_resp = txn.table("raffle_participants").select("*").eq("telegram_id", telegram_id).eq("raffle_id", raffle_id).execute()

            # 4. Списання жетонів
            txn.table("winix").update({"coins": user_coins - required_coins}).eq("telegram_id", telegram_id).execute()

            # 5. Додавання або оновлення запису участі
            if participant_resp.data:
                # Оновлюємо існуючий запис
                participant = participant_resp.data[0]
                entry_count = participant.get("entry_count", 0) + 1
                txn.table("raffle_participants").update({
                    "entry_count": entry_count,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }).eq("id", participant.get("id")).execute()
            else:
                # Створюємо новий запис
                participant_id = str(uuid.uuid4())
                txn.table("raffle_participants").insert({
                    "id": participant_id,
                    "telegram_id": telegram_id,
                    "raffle_id": raffle_id,
                    "entry_count": 1,
                    "status": "active",
                    "entry_time": datetime.now(timezone.utc).isoformat()
                }).execute()
                entry_count = 1

            # 6. Оновлюємо кількість учасників у розіграші (безпечний спосіб)
            # Спочатку отримуємо кількість унікальних учасників
            count_resp = txn.table("raffle_participants") \
                           .select("telegram_id", count="exact") \
                           .eq("raffle_id", raffle_id) \
                           .execute()

            participants_count = count_resp.count if hasattr(count_resp, 'count') else 0

            # Потім явно оновлюємо поле participants_count
            txn.table("raffles").update({
                "participants_count": participants_count,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }).eq("id", raffle_id).execute()

            # 7. Отримуємо оновлені дані
            updated_user_resp = txn.table("winix").select("coins").eq("telegram_id", telegram_id).execute()
            new_coins_balance = updated_user_resp.data[0].get("coins", 0) if updated_user_resp.data else 0

            # 8. Отримуємо загальну кількість участей
            participations_resp = txn.table("raffle_participants").select("id", count="exact").eq("telegram_id", telegram_id).execute()
            participations_count = participations_resp.count if hasattr(participations_resp, 'count') else 0

            # 9. Повертаємо результат
            return {
                "status": "success",
                "new_coins_balance": new_coins_balance,
                "total_entries": entry_count,
                "participations_count": participations_count
            }
    except Exception as e:
        logger.error(f"Помилка прямого виконання транзакції: {str(e)}", exc_info=True)
        return {"status": "error", "message": f"Помилка обробки: {str(e)}"}


@handle_exceptions
def get_active_raffles():
    """Отримання списку активних розіграшів"""
    # Перевіряємо кеш
    cache_key = "active_raffles"
    cached_data = cache_get(cache_key)
    if cached_data:
        logger.info("get_active_raffles: Повернення кешованих даних")
        return jsonify({"status": "success", "data": cached_data, "source": "cache"})

    # Отримуємо параметри пагінації
    limit = min(int(request.args.get('limit', 20)), MAX_RESULTS_PER_PAGE)
    offset = int(request.args.get('offset', 0))

    # Додаємо таймаут для операції з базою даних
    try:
        # Отримуємо всі активні розіграші з бази даних з пагінацією
        response = supabase.table("raffles") \
            .select(
            "id,title,description,entry_fee,prize_amount,prize_currency,start_time,end_time,participants_count,winners_count,status,is_daily,image_url,prize_distribution") \
            .eq("status", "active") \
            .order("is_daily", desc=True) \
            .order("end_time") \
            .limit(limit) \
            .offset(offset) \
            .execute()

    except Exception as e:
        logger.error(f"Помилка запиту активних розіграшів: {str(e)}")
        return jsonify({"status": "success", "data": [], "error": str(e)})

    if not response.data:
        # Якщо даних немає, повертаємо порожній список
        return jsonify({"status": "success", "data": []})

    # Форматуємо дані для відповіді
    raffles_data = []
    for raffle in response.data:
        # Безпечно конвертуємо час
        try:
            start_time_ms = int(
                datetime.fromisoformat(raffle.get("start_time").replace('Z', '+00:00')).timestamp() * 1000)
            end_time_ms = int(datetime.fromisoformat(raffle.get("end_time").replace('Z', '+00:00')).timestamp() * 1000)
        except (ValueError, AttributeError, TypeError):
            logger.warning(f"Помилка конвертації часу для розіграшу {raffle.get('id')}")
            start_time_ms = 0
            end_time_ms = 0

        # Форматуємо дані розіграшу
        raffle_info = {
            "id": raffle.get("id"),
            "title": raffle.get("title", ""),
            "description": raffle.get("description", ""),
            "entry_fee": raffle.get("entry_fee", 1),
            "prize_amount": raffle.get("prize_amount", 0),
            "prize_currency": raffle.get("prize_currency", "WINIX"),
            "start_time": start_time_ms,
            "end_time": end_time_ms,
            "participants_count": raffle.get("participants_count", 0),
            "winners_count": raffle.get("winners_count", 1),
            "status": raffle.get("status", "active"),
            "is_daily": raffle.get("is_daily", False),
            "image_url": raffle.get("image_url", ""),
            "prize_distribution": raffle.get("prize_distribution", {})
        }

        raffles_data.append(raffle_info)

    # Отримуємо загальну кількість активних розіграшів для пагінації
    try:
        count_response = supabase.table("raffles").select("count", count="exact").eq("status", "active").execute()
        total_count = count_response.count if hasattr(count_response, 'count') else len(raffles_data)
    except Exception as e:
        logger.error(f"Помилка підрахунку активних розіграшів: {str(e)}")
        total_count = len(raffles_data)

    # Кешуємо результат
    cache_set(cache_key, raffles_data, ACTIVE_RAFFLES_CACHE_TTL)

    return jsonify({
        "status": "success",
        "data": raffles_data,
        "pagination": {
            "total": total_count,
            "limit": limit,
            "offset": offset
        }
    })


@handle_exceptions
def get_raffle_details(raffle_id):
    """Отримання деталей конкретного розіграшу"""
    if not raffle_id:
        return jsonify({"status": "error", "message": "Не вказано ID розіграшу"}), 400

    # Нормалізуємо ID
    try:
        raffle_id = str(raffle_id).strip()
    except Exception:
        return jsonify({"status": "error", "message": "Невалідний формат ID розіграшу"}), 400

    # Перевіряємо кеш
    cache_key = f"raffle_details_{raffle_id}"
    cached_data = cache_get(cache_key)
    if cached_data:
        logger.info(f"get_raffle_details: Повернення кешованих даних для розіграшу {raffle_id}")
        return jsonify({"status": "success", "data": cached_data, "source": "cache"})

    try:
        # Отримуємо дані розіграшу з таймаутом
        response = supabase.table("raffles").select("*").eq("id", raffle_id).execute()
    except Exception as e:
        logger.error(f"Помилка запиту деталей розіграшу {raffle_id}: {str(e)}")
        return jsonify({"status": "error", "message": f"Помилка запиту: {str(e)}"}), 500

    if not hasattr(response, 'data') or not response.data:
        logger.warning(f"Розіграш з ID {raffle_id} не знайдено в базі даних")
        return jsonify({"status": "error", "message": f"Розіграш з ID {raffle_id} не знайдено"}), 404

    raffle = response.data[0]

    # Безпечно конвертуємо час
    try:
        start_time_ms = int(datetime.fromisoformat(raffle.get("start_time", "").replace('Z', '+00:00')).timestamp() * 1000)
        end_time_ms = int(datetime.fromisoformat(raffle.get("end_time", "").replace('Z', '+00:00')).timestamp() * 1000)
        current_time_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
        time_left_ms = max(0, end_time_ms - current_time_ms)
    except (ValueError, AttributeError, TypeError):
        logger.warning(f"Помилка конвертації часу для розіграшу {raffle_id}")
        start_time_ms = 0
        end_time_ms = 0
        time_left_ms = 0

    # Форматуємо дані розіграшу
    raffle_details = {
        "id": raffle.get("id"),
        "title": raffle.get("title", ""),
        "description": raffle.get("description", ""),
        "entry_fee": raffle.get("entry_fee", 1),
        "prize_amount": raffle.get("prize_amount", 0),
        "prize_currency": raffle.get("prize_currency", "WINIX"),
        "start_time": start_time_ms,
        "end_time": end_time_ms,
        "participants_count": raffle.get("participants_count", 0),
        "winners_count": raffle.get("winners_count", 1),
        "status": raffle.get("status", "active"),
        "is_daily": raffle.get("is_daily", False),
        "image_url": raffle.get("image_url", ""),
        "prize_distribution": raffle.get("prize_distribution", {}),
        "time_left": time_left_ms
    }

    # Отримуємо переможців розіграшу, якщо він завершений
    if raffle.get("status") == "completed":
        try:
            winners_response = supabase.table("raffle_winners").select("*").eq("raffle_id", raffle_id).order(
                "place").execute()

            if winners_response.data:
                winners = []
                for winner in winners_response.data:
                    # Отримуємо дані користувача
                    user = get_user(winner.get("telegram_id", ""))
                    username = user.get("username", "User") if user else "Unknown User"

                    winners.append({
                        "telegram_id": winner.get("telegram_id", ""),
                        "username": username,
                        "place": winner.get("place", 0),
                        "prize_amount": winner.get("prize_amount", 0),
                        "prize_currency": winner.get("prize_currency", "WINIX")
                    })

                raffle_details["winners"] = winners
        except Exception as e:
            logger.error(f"Помилка отримання переможців для розіграшу {raffle_id}: {str(e)}")
            raffle_details["winners"] = []

    # Кешуємо результат
    cache_set(cache_key, raffle_details, RAFFLE_DETAILS_CACHE_TTL)

    return jsonify({"status": "success", "data": raffle_details})


@handle_exceptions
def participate_in_raffle(telegram_id, data):
    """Участь у розіграші"""
    # Перевірка необхідних даних
    if not data or "raffle_id" not in data:
        raise ValueError("Не вказано ID розіграшу")

    raffle_id = data["raffle_id"]

    # Нормалізуємо ID
    try:
        raffle_id = str(raffle_id).strip()
    except Exception:
        logger.warning(f"Невалідний формат ID розіграшу: {raffle_id}")
        raise ValueError("Невалідний формат ID розіграшу")

    entry_count = min(int(data.get("entry_count", 1)), MAX_ENTRY_COUNT)

    # Перевіряємо кількість жетонів
    if entry_count <= 0:
        raise ValueError("Кількість жетонів має бути більше нуля")

    # Отримуємо розіграш для перевірки статусу та entry_fee
    try:
        raffle_response = supabase.table("raffles").select("*").eq("id", raffle_id).execute()
    except Exception as e:
        logger.error(f"Помилка запиту розіграшу {raffle_id}: {str(e)}")
        raise ValueError(f"Помилка запиту розіграшу: {str(e)}")

    if not raffle_response.data:
        raise ValueError(f"Розіграш з ID {raffle_id} не знайдено")

    raffle = raffle_response.data[0]

    # Перевіряємо статус розіграшу
    if raffle.get("status") != "active":
        raise ValueError("Розіграш не є активним")

    # Перевіряємо час розіграшу
    now = datetime.now(timezone.utc)
    try:
        end_time = datetime.fromisoformat(raffle.get("end_time", "").replace('Z', '+00:00'))
        if now >= end_time:
            raise RaffleAlreadyEndedError("Розіграш вже завершено")
    except (ValueError, AttributeError):
        raise ValueError("Некоректний формат часу завершення розіграшу")

    # Розраховуємо необхідну кількість жетонів
    entry_fee = raffle.get("entry_fee", 1)
    required_coins = entry_count * entry_fee

    try:
        # Викликаємо SQL-функцію з обробкою потенційних помилок
        for attempt in range(3):  # Максимум 3 спроби для надійності
            try:
                # Виклик SQL-функції
                response = supabase.rpc('participate_in_raffle', {
                    'p_user_id': telegram_id,
                    'p_raffle_id': raffle_id,
                    'p_tokens_needed': required_coins
                }).execute()

                # Перевірка наявності відповіді
                if not response or not hasattr(response, 'data') or response.data is None:
                    logger.error(f"Null response from participate_in_raffle RPC: {response}")
                    raise Exception("Сервер не повернув відповідь")

                # Отримання даних (враховуємо, що дані можуть бути різних форматів)
                result_data = {}
                if isinstance(response.data, dict):
                    result_data = response.data
                elif isinstance(response.data, list) and len(response.data) > 0:
                    result_data = response.data[0]
                else:
                    logger.error(f"Unexpected response format: {response.data}")
                    raise Exception("Неочікуваний формат відповіді від сервера")

                # Перевірка на помилку у відповіді SQL-функції
                if result_data.get("status") == "error":
                    error_message = result_data.get("message", "Невідома помилка")
                    # Спеціальна обробка помилки неоднозначності колонки
                    if "column reference" in error_message and "ambiguous" in error_message:
                        logger.error(f"Виявлено помилку SQL неоднозначності: {error_message}")
                        if attempt < 2:  # Якщо це не остання спроба
                            logger.info(f"Спроба виправлення через альтернативний запит...")
                            # Спробуємо виконати альтернативний запит напряму
                            result = execute_transaction_directly(telegram_id, raffle_id, required_coins)
                            if result and result.get("status") == "success":
                                return jsonify({"status": "success", "data": result})
                        raise ValueError("Помилка у SQL-запиті. Спробуйте ще раз або зверніться до адміністратора.")
                    elif "Недостатньо жетонів" in error_message:
                        raise InsufficientTokensError(error_message)
                    else:
                        raise ValueError(error_message)

                # Отримуємо значення з результату
                participations_count = result_data.get("participations_count", 0)
                new_coins_balance = result_data.get("new_coins_balance", 0)
                total_entries = result_data.get("total_entries", entry_count)

                # Інвалідуємо кеш активних розіграшів
                clear_cache("active_raffles")
                clear_cache(f"raffle_details_{raffle_id}")

                # Перевіряємо, чи користувач досяг 5 участей для бейджа початківця
                if participations_count >= 5:
                    check_and_update_badges(telegram_id)

                # Формуємо відповідь на базі наших даних
                response_data = {
                    "message": "Ви успішно взяли участь у розіграші",
                    "entry_count": entry_count,
                    "total_entries": total_entries,
                    "new_coins_balance": new_coins_balance,
                    "participations_count": participations_count,
                    "raffle_type": "daily" if raffle.get("is_daily", False) else "main"
                }

                # Додаємо дані про бонус за першу участь
                if participations_count == 1:
                    bonus_amount = 50  # Бонус за першу участь
                    try:
                        # Створюємо транзакцію для бонусу і оновлюємо баланс
                        bonus_transaction = {
                            "telegram_id": telegram_id,
                            "type": "reward",
                            "amount": bonus_amount,
                            "description": "Бонус за першу участь у розіграші",
                            "status": "completed",
                            "created_at": now.isoformat()
                        }

                        supabase.table("transactions").insert(bonus_transaction).execute()
                        update_balance(telegram_id, bonus_amount)

                        response_data["bonus_amount"] = bonus_amount
                        response_data["new_balance"] = float(get_user(telegram_id).get("balance", 0))
                    except Exception as e:
                        logger.error(f"Помилка нарахування бонусу для {telegram_id}: {str(e)}")

                # Повертаємо результат
                return jsonify({"status": "success", "data": response_data})

            except Exception as e:
                # Логуємо помилку для діагностики
                logger.error(f"Спроба {attempt + 1}: Помилка виклику SQL-функції: {str(e)}")

                if attempt < 2:  # На останній спробі не чекаємо
                    time.sleep(0.5 * (attempt + 1))  # Прогресивна затримка
                else:
                    raise  # Остання спроба - піднімаємо помилку далі

    except (ValueError, InsufficientTokensError, RaffleAlreadyEndedError) as e:
        # Перехоплюємо спеціальні типи винятків
        raise
    except Exception as e:
        # Логуємо деталі помилки
        logger.error(f"Помилка участі в розіграші для {telegram_id}: {str(e)}", exc_info=True)
        # Загальне повідомлення для користувача
        raise ValueError("Сталася помилка при обробці запиту. Спробуйте пізніше.")


@handle_exceptions
def get_user_raffles(telegram_id):
    """Отримання розіграшів, у яких бере участь користувач"""
    # Перевіряємо кеш
    cache_key = f"user_raffles_{telegram_id}"
    cached_data = cache_get(cache_key)
    if cached_data:
        logger.info(f"get_user_raffles: Повернення кешованих даних для користувача {telegram_id}")
        return jsonify({"status": "success", "data": cached_data, "source": "cache"})

    # Перевіряємо, чи користувач існує
    user = get_user(telegram_id)
    if not user:
        logger.warning(f"get_user_raffles: Користувач {telegram_id} не знайдено")
        return jsonify({"status": "success", "data": []})

    # Отримуємо всі активні участі користувача
    try:
        participants_response = supabase.table("raffle_participants").select("*") \
            .eq("telegram_id", telegram_id) \
            .execute()
    except Exception as e:
        logger.error(f"Помилка запиту участі користувача {telegram_id}: {str(e)}")
        return jsonify({"status": "success", "data": []})

    if not participants_response.data:
        return jsonify({"status": "success", "data": []})

    # Отримуємо ID розіграшів, у яких бере участь користувач
    raffle_ids = [p.get("raffle_id") for p in participants_response.data if p.get("raffle_id")]

    if not raffle_ids:
        return jsonify({"status": "success", "data": []})

    # Отримуємо дані цих розіграшів
    try:
        # Використовуємо запит in_ для вибірки кількох розіграшів одночасно
        raffles_response = supabase.table("raffles").select("*").in_("id", raffle_ids).execute()
    except Exception as e:
        logger.error(f"Помилка запиту розіграшів {raffle_ids}: {str(e)}")
        return jsonify({"status": "success", "data": []})

    if not raffles_response.data:
        return jsonify({"status": "success", "data": []})

    # Створюємо словник участей за raffle_id для швидкого доступу
    participations_by_raffle = {p.get("raffle_id"): p for p in participants_response.data if p.get("raffle_id")}

    # Формуємо дані для відповіді
    user_raffles = []
    now = datetime.now(timezone.utc)

    for raffle in raffles_response.data:
        raffle_id = raffle.get("id")
        participation = participations_by_raffle.get(raffle_id)

        if not participation:
            continue

        # Безпечно перетворюємо часові мітки
        try:
            end_time = datetime.fromisoformat(raffle.get("end_time", "").replace('Z', '+00:00'))
            end_time_ms = int(end_time.timestamp() * 1000)

            entry_time = datetime.fromisoformat(participation.get("entry_time", "").replace('Z', '+00:00'))
            entry_time_ms = int(entry_time.timestamp() * 1000)
        except (ValueError, AttributeError):
            logger.warning(f"Помилка конвертації часу для розіграшу {raffle_id}")
            end_time_ms = 0
            entry_time_ms = 0

        # Формуємо дані про участь
        user_raffle = {
            "raffle_id": raffle_id,
            "title": raffle.get("title", ""),
            "entry_fee": raffle.get("entry_fee", 1),
            "prize_amount": raffle.get("prize_amount", 0),
            "prize_currency": raffle.get("prize_currency", "WINIX"),
            "participation_time": entry_time_ms,
            "entry_count": participation.get("entry_count", 1),
            "status": raffle.get("status", "active"),
            "end_time": end_time_ms,
            "is_daily": raffle.get("is_daily", False)
        }

        user_raffles.append(user_raffle)

    # Сортуємо за кінцевим часом (спочатку найближчі до завершення)
    user_raffles.sort(key=lambda x: x["end_time"])

    # Кешуємо результат
    cache_set(cache_key, user_raffles, 300)  # 5 хвилин

    return jsonify({"status": "success", "data": user_raffles})


@handle_exceptions
def get_raffles_history(telegram_id):
    """Отримання історії участі користувача в розіграшах"""
    # Перевіряємо кеш
    cache_key = f"raffles_history_{telegram_id}"
    cached_data = cache_get(cache_key)
    if cached_data:
        logger.info(f"get_raffles_history: Повернення кешованих даних для користувача {telegram_id}")
        return jsonify({"status": "success", "data": cached_data, "source": "cache"})

    try:
        # Перевіряємо, чи користувач існує
        user = get_user(telegram_id)
        if not user:
            logger.warning(f"get_raffles_history: Користувач {telegram_id} не знайдено")
            return jsonify({"status": "success", "data": []})

        # Отримуємо всі участі користувача з обмеженням кількості
        try:
            participants_response = supabase.table("raffle_participants") \
                .select("raffle_id,entry_count,status,entry_time") \
                .eq("telegram_id", telegram_id) \
                .order("entry_time", desc=True) \
                .limit(50) \
                .execute()
        except Exception as e:
            logger.error(f"Помилка запиту участі користувача {telegram_id}: {str(e)}")
            return jsonify({"status": "success", "data": []})

        if not participants_response.data:
            return jsonify({"status": "success", "data": []})

        # Отримуємо ID розіграшів, у яких брав участь користувач
        raffle_ids = [p.get("raffle_id") for p in participants_response.data if p.get("raffle_id")]

        if not raffle_ids:
            return jsonify({"status": "success", "data": []})

        # Отримуємо розіграші з обмеженням необхідних полів
        try:
            raffles_response = supabase.table("raffles") \
                .select("id,title,prize_amount,prize_currency,end_time,status,is_daily") \
                .in_("id", raffle_ids) \
                .execute()

        except Exception as e:
            logger.error(f"Помилка запиту розіграшів {raffle_ids}: {str(e)}")
            return jsonify({"status": "success", "data": []})

        if not raffles_response.data:
            return jsonify({"status": "success", "data": []})

        # Створюємо словник розіграшів за id для швидкого доступу
        raffles_by_id = {r.get("id"): r for r in raffles_response.data if r.get("id")}

        # Отримуємо дані про переможців
        try:
            winners_response = supabase.table("raffle_winners") \
                .select("*") \
                .eq("telegram_id", telegram_id) \
                .execute()

            winners_by_raffle = {w.get("raffle_id"): w for w in winners_response.data if w.get("raffle_id")}
        except Exception as e:
            logger.error(f"Помилка запиту переможців для користувача {telegram_id}: {str(e)}")
            winners_by_raffle = {}

        # Формуємо історію
        history = []

        for participation in participants_response.data:
            raffle_id = participation.get("raffle_id")
            if not raffle_id or raffle_id not in raffles_by_id:
                continue

            raffle = raffles_by_id[raffle_id]

            # Пропускаємо активні розіграші
            if raffle.get("status") == "active":
                continue

            # Визначаємо, чи користувач переміг
            is_winner = raffle_id in winners_by_raffle
            status = "won" if is_winner else "participated"

            # Форматуємо дату завершення
            try:
                end_time = datetime.fromisoformat(raffle.get("end_time", "").replace('Z', '+00:00'))
                formatted_date = end_time.strftime("%d.%m.%Y")
            except (ValueError, AttributeError):
                logger.warning(f"Помилка конвертації часу для розіграшу {raffle_id}")
                formatted_date = "Дата невідома"

            # Формуємо інформацію про результат
            if is_winner:
                winner_data = winners_by_raffle[raffle_id]
                prize_amount = winner_data.get("prize_amount", 0)
                prize_currency = winner_data.get("prize_currency", "WINIX")
                result = f"Ви виграли {prize_amount} {prize_currency}"
                place = winner_data.get("place")
            else:
                result = "Ви брали участь, але не виграли"
                place = None

            # Формуємо запис історії (тільки необхідні поля)
            history_entry = {
                "raffle_id": raffle_id,
                "date": formatted_date,
                "prize": f"{raffle.get('prize_amount', 0)} {raffle.get('prize_currency', 'WINIX')}",
                "result": result,
                "status": status,
                "entry_count": participation.get("entry_count", 1),
                "title": raffle.get("title", ""),
                "is_daily": raffle.get("is_daily", False)
            }

            history.append(history_entry)

        # Сортуємо за датою (від найновіших до найстаріших)
        history.sort(key=lambda x: x["date"], reverse=True)

        # Кешуємо результат
        cache_set(cache_key, history, HISTORY_CACHE_TTL)

        return jsonify({"status": "success", "data": history})
    except Exception as e:
        # Логуємо помилку, але повертаємо порожній масив замість помилки
        logger.error(f"Помилка отримання історії розіграшів для {telegram_id}: {str(e)}", exc_info=True)
        return jsonify({
            "status": "success",
            "data": [],
            "error_fallback": True,
            "error_details": str(e) if os.getenv("DEBUG") == "true" else None
        })


@handle_exceptions
def claim_newbie_bonus(telegram_id):
    """Отримання бонусу новачка"""
    # Отримуємо користувача
    user = get_user(telegram_id)

    if not user:
        raise ValueError("Користувача не знайдено")

    if user.get('newbie_bonus_claimed', False):
        return jsonify({
            'status': 'already_claimed',
            'message': 'Бонус новачка вже було отримано'
        })

    bonus_amount = 150
    current_balance = float(user.get('balance', 0))

    try:
        # Виконуємо атомарну транзакцію
        with execute_transaction() as txn:
            # 1. Оновлюємо статус отримання бонусу
            txn.table("winix").update({
                'balance': current_balance + bonus_amount,
                'newbie_bonus_claimed': True
            }).eq("telegram_id", telegram_id).execute()

            # 2. Створюємо транзакцію
            transaction_data = {
                "telegram_id": telegram_id,
                "type": "reward",
                "amount": bonus_amount,
                "description": "Бонус новачка",
                "status": "completed",
                "created_at": datetime.now(timezone.utc).isoformat()
            }

            txn.table("transactions").insert(transaction_data).execute()

        # Повертаємо успішний результат
        return jsonify({
            'status': 'success',
            'message': f'Ви отримали {bonus_amount} WINIX як бонус новачка!',
            'data': {
                'amount': bonus_amount,
                'newBalance': current_balance + bonus_amount
            }
        })
    except Exception as e:
        logger.error(f"claim_newbie_bonus: Помилка нарахування бонусу: {str(e)}")
        raise Exception("Помилка нарахування бонусу. Спробуйте пізніше.")