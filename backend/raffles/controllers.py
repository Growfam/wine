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
import uuid
import re
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
    current_dir = os.path.dirname(os.path.abspath(__file__))
    parent_dir = os.path.dirname(current_dir)
    if parent_dir not in sys.path:
        sys.path.append(parent_dir)

    from supabase_client import (
        supabase, get_user, update_user, update_balance, update_coins,
        check_and_update_badges, execute_transaction, cache_get, cache_set, clear_cache
    )
    from utils.transaction_helpers import create_transaction_record, update_transaction_status


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


# Функція для перевірки валідності UUID (покращена версія)
def is_valid_uuid(raffle_id):
    """Перевіряє, чи ID розіграшу є валідним UUID"""
    if not raffle_id:
        return False

    # Якщо довжина ID менше 36 символів (стандартна довжина UUID), одразу повертаємо False
    if isinstance(raffle_id, str) and len(raffle_id) < 36:
        logger.warning(f"UUID занадто короткий: {raffle_id}, довжина: {len(raffle_id)}")
        return False

    # Якщо ID короткий (менше 10 символів), це явно не UUID
    if isinstance(raffle_id, str) and len(raffle_id) < 10:
        logger.error(f"Критична помилка: Некоректний UUID (занадто короткий): {raffle_id}")
        return False

    try:
        # Спроба конвертації в UUID - якщо успішно, значить формат вірний
        uuid_obj = uuid.UUID(str(raffle_id))

        # Додаткова перевірка: переконуємося, що строкове представлення співпадає з вхідним ID
        # Це допоможе відсіяти випадки, коли UUID був пошкоджений, але залишився валідним
        generated_uuid_str = str(uuid_obj)
        if raffle_id != generated_uuid_str:
            logger.warning(f"UUID не співпадає з оригіналом: {raffle_id} != {generated_uuid_str}")
            return False

        return True
    except (ValueError, AttributeError, TypeError) as e:
        logger.error(f"Помилка перевірки UUID {raffle_id}: {str(e)}")
        return False


# Функція для перевірки існування розіграшу в базі даних
def check_raffle_exists(raffle_id):
    """Перевіряє існування розіграшу в базі даних"""
    if not raffle_id:
        raise InvalidRaffleIDError("ID розіграшу не вказано")

    # Перевірка на дуже короткий ID (явна помилка)
    if isinstance(raffle_id, str) and len(raffle_id) < 10:
        logger.error(f"Критично короткий ID розіграшу: {raffle_id}")
        raise InvalidRaffleIDError(f"Критично невалідний ID розіграшу: {raffle_id}")

    if not is_valid_uuid(raffle_id):
        logger.warning(f"Невалідний формат ID розіграшу: {raffle_id}")
        raise InvalidRaffleIDError(f"Невалідний формат ID розіграшу: {raffle_id}")

    try:
        # Спочатку перевіряємо кеш
        cache_key = f"raffle_exists_{raffle_id}"
        exists_in_cache = cache_get(cache_key)

        if exists_in_cache is not None:
            return exists_in_cache

        # Якщо немає в кеші, перевіряємо в базі даних
        response = supabase.table("raffles").select("id").eq("id", raffle_id).execute()

        if not response.data or len(response.data) == 0:
            logger.warning(f"Розіграш з ID {raffle_id} не знайдено в базі даних")

            # Кешуємо негативний результат на коротший час
            cache_set(cache_key, False, 60)  # 1 хвилина для негативного результату

            raise RaffleNotFoundException(f"Розіграш з ID {raffle_id} не знайдено в базі даних")

        # Кешуємо позитивний результат
        cache_set(cache_key, True, 300)  # 5 хвилин для позитивного результату

        return True
    except RaffleNotFoundException:
        # Пробрасуємо цей виняток далі
        raise
    except Exception as e:
        logger.error(f"Помилка перевірки існування розіграшу {raffle_id}: {str(e)}")
        raise


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
        # Перевіряємо валідність UUID
        raffle_id = raffle.get("id")
        if not is_valid_uuid(raffle_id):
            logger.warning(f"Пропускаємо розіграш з невалідним UUID: {raffle_id}")
            continue

        # Безпечно конвертуємо час
        try:
            start_time_ms = int(
                datetime.fromisoformat(raffle.get("start_time").replace('Z', '+00:00')).timestamp() * 1000)
            end_time_ms = int(datetime.fromisoformat(raffle.get("end_time").replace('Z', '+00:00')).timestamp() * 1000)
        except (ValueError, AttributeError):
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
        raise ValueError("Не вказано ID розіграшу")

    # Розширена перевірка валідності UUID
    if not is_valid_uuid(raffle_id):
        logger.warning(f"Невалідний формат ID розіграшу: {raffle_id}")
        raise InvalidRaffleIDError(f"Невалідний формат ID розіграшу: {raffle_id}")

    # Якщо ID всього 2 символи - явно неправильний
    if isinstance(raffle_id, str) and len(raffle_id) <= 5:
        logger.warning(f"Критично невалідний ID розіграшу: {raffle_id}")
        raise InvalidRaffleIDError(f"Критично невалідний ID розіграшу")

    # Перевіряємо кеш
    cache_key = f"raffle_details_{raffle_id}"
    cached_data = cache_get(cache_key)
    if cached_data:
        logger.info(f"get_raffle_details: Повернення кешованих даних для розіграшу {raffle_id}")
        return jsonify({"status": "success", "data": cached_data, "source": "cache"})

    # Отримуємо дані розіграшу з таймаутом
    try:
        response = supabase.table("raffles").select("*").eq("id", raffle_id).execute()
    except Exception as e:
        logger.error(f"Помилка запиту деталей розіграшу {raffle_id}: {str(e)}")
        return jsonify({"status": "error", "message": f"Помилка запиту: {str(e)}"}), 500

    if not hasattr(response, 'data') or not response.data:
        logger.warning(f"Розіграш з ID {raffle_id} не знайдено в базі даних")
        raise RaffleNotFoundException(f"Розіграш з ID {raffle_id} не знайдено")

    raffle = response.data[0]

    # Безпечно конвертуємо час
    try:
        start_time_ms = int(datetime.fromisoformat(raffle.get("start_time").replace('Z', '+00:00')).timestamp() * 1000)
        end_time_ms = int(datetime.fromisoformat(raffle.get("end_time").replace('Z', '+00:00')).timestamp() * 1000)
        current_time_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
        time_left_ms = max(0, end_time_ms - current_time_ms)
    except (ValueError, AttributeError):
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

    # Розширена перевірка валідності UUID
    if not is_valid_uuid(raffle_id):
        logger.warning(f"Невалідний формат ID розіграшу: {raffle_id}")
        raise InvalidRaffleIDError(f"Невалідний формат ID розіграшу: {raffle_id}")

    # Додаткова перевірка довжини ID
    if isinstance(raffle_id, str) and len(raffle_id) < 36:
        logger.warning(f"ID розіграшу занадто короткий: {raffle_id}, довжина {len(raffle_id)}")
        raise InvalidRaffleIDError(f"ID розіграшу занадто короткий: {raffle_id}")

    # Додаткова перевірка існування розіграшу в базі даних
    try:
        check_raffle_exists(raffle_id)
    except RaffleNotFoundException:
        logger.error(f"Розіграш {raffle_id} не знайдено при спробі участі користувача {telegram_id}")
        raise

    entry_count = min(int(data.get("entry_count", 1)), MAX_ENTRY_COUNT)

    # Перевіряємо кількість жетонів
    if entry_count <= 0:
        raise ValueError("Кількість жетонів має бути більше нуля")

    # Отримуємо користувача
    user = get_user(telegram_id)
    if not user:
        raise ValueError("Користувача не знайдено")

    # Отримуємо розіграш
    try:
        raffle_response = supabase.table("raffles").select("*").eq("id", raffle_id).execute()
    except Exception as e:
        logger.error(f"Помилка запиту розіграшу {raffle_id}: {str(e)}")
        raise ValueError(f"Помилка запиту розіграшу: {str(e)}")

    if not raffle_response.data:
        raise RaffleNotFoundException(f"Розіграш з ID {raffle_id} не знайдено")

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

    # Перевіряємо чи користувач вже бере участь у розіграші
    try:
        participation_response = supabase.table("raffle_participants").select("*") \
            .eq("raffle_id", raffle_id) \
            .eq("telegram_id", telegram_id) \
            .execute()
    except Exception as e:
        logger.error(f"Помилка запиту участі користувача {telegram_id} в розіграші {raffle_id}: {str(e)}")
        raise ValueError(f"Помилка запиту участі: {str(e)}")

    existing_entry_count = 0
    participation_id = None

    if participation_response.data:
        # Користувач вже бере участь, отримуємо його поточну участь
        existing_entry = participation_response.data[0]
        existing_entry_count = existing_entry.get("entry_count", 0)
        participation_id = existing_entry.get("id")

    # Оновлюємо кількість учасників у розіграші
    updated_participants_count = raffle.get("participants_count", 0)
    if not participation_response.data:
        updated_participants_count += 1

    try:
        # Виконуємо атомарну транзакцію
        with execute_transaction() as txn:
            # 1. Списуємо жетони з балансу користувача
            transaction_data = {
                "telegram_id": telegram_id,
                "type": "fee",
                "amount": -required_coins,
                "description": f"Участь у розіграші '{raffle.get('title')}'",
                "status": "pending",
                "raffle_id": raffle_id,
                "created_at": now.isoformat()
            }

            # Створюємо транзакцію
            transaction_res = txn.table("transactions").insert(transaction_data).execute()
            transaction_id = transaction_res.data[0]["id"] if transaction_res.data else None

            # 2. Оновлюємо баланс користувача
            user_coins = int(user.get("coins", 0))
            if user_coins < required_coins:
                raise InsufficientTokensError(f"Недостатньо жетонів. Потрібно: {required_coins}, наявно: {user_coins}")

            new_coins_balance = user_coins - required_coins
            txn.table("winix").update({"coins": new_coins_balance}).eq("telegram_id", telegram_id).execute()

            # 3. Оновлюємо або створюємо запис участі
            if participation_response.data:
                # Оновлюємо існуючу участь
                new_entry_count = existing_entry_count + entry_count
                txn.table("raffle_participants").update({"entry_count": new_entry_count}).eq("id",
                                                                                             participation_id).execute()
            else:
                # Створюємо нову участь
                participation_data = {
                    "raffle_id": raffle_id,
                    "telegram_id": telegram_id,
                    "entry_time": now.isoformat(),
                    "entry_count": entry_count,
                    "status": "active"
                }
                txn.table("raffle_participants").insert(participation_data).execute()

            # 4. Оновлюємо кількість учасників у розіграші
            txn.table("raffles").update({"participants_count": updated_participants_count}).eq("id",
                                                                                               raffle_id).execute()

            # 5. Оновлюємо статус транзакції на "completed"
            txn.table("transactions").update({"status": "completed"}).eq("id", transaction_id).execute()

            # 6. Оновлюємо лічильник участей користувача
            participations_count = user.get("participations_count", 0) + 1
            txn.table("winix").update({"participations_count": participations_count}).eq("telegram_id",
                                                                                         telegram_id).execute()

        # Інвалідуємо кеш активних розіграшів
        clear_cache("active_raffles")
        clear_cache(f"raffle_details_{raffle_id}")

        # Перевіряємо, чи користувач досяг 5 участей для бейджа початківця
        if participations_count >= 5:
            check_and_update_badges(telegram_id)

        # Формуємо відповідь
        total_entries = existing_entry_count + entry_count
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
                response_data["new_balance"] = float(user.get("balance", 0)) + bonus_amount
            except Exception as e:
                logger.error(f"Помилка нарахування бонусу для {telegram_id}: {str(e)}")
                # Продовжуємо виконання навіть якщо бонус не зарахувався

        return jsonify({"status": "success", "data": response_data})

    except (ValueError, InsufficientTokensError, RaffleAlreadyEndedError) as e:
        # Перехоплюємо спеціальні типи винятків для надання користувацького повідомлення
        raise

    except Exception as e:
        # Логуємо інші помилки і повертаємо загальне повідомлення
        logger.error(f"Помилка участі в розіграші для {telegram_id}: {str(e)}", exc_info=True)
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

    # Фільтруємо невалідні UUID перед запитом
    valid_raffle_ids = [raffle_id for raffle_id in raffle_ids if is_valid_uuid(raffle_id)]

    if not valid_raffle_ids:
        logger.warning(f"get_user_raffles: Всі ID розіграшів для користувача {telegram_id} невалідні")
        return jsonify({"status": "success", "data": []})

    # Отримуємо дані цих розіграшів
    try:
        # Використовуємо запит in_ для вибірки кількох розіграшів одночасно
        raffles_response = supabase.table("raffles").select("*").in_("id", valid_raffle_ids).execute()
    except Exception as e:
        logger.error(f"Помилка запиту розіграшів {valid_raffle_ids}: {str(e)}")
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

        # Фільтруємо невалідні UUID
        valid_raffle_ids = [raffle_id for raffle_id in raffle_ids if is_valid_uuid(raffle_id)]

        if not valid_raffle_ids:
            logger.warning(f"get_raffles_history: Всі ID розіграшів для користувача {telegram_id} невалідні")
            return jsonify({"status": "success", "data": []})

        # Отримуємо розіграші з обмеженням необхідних полів
        try:
            raffles_response = supabase.table("raffles") \
                .select("id,title,prize_amount,prize_currency,end_time,status,is_daily") \
                .in_("id", valid_raffle_ids) \
                .execute()

        except Exception as e:
            logger.error(f"Помилка запиту розіграшів {valid_raffle_ids}: {str(e)}")
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

            winners_by_raffle = {w.get("raffle_id"): w for w in winners_response.data if w.get("raffle_id") and is_valid_uuid(w.get("raffle_id"))}
        except Exception as e:
            logger.error(f"Помилка запиту переможців для користувача {telegram_id}: {str(e)}")
            winners_by_raffle = {}

        # Формуємо історію
        history = []

        for participation in participants_response.data:
            raffle_id = participation.get("raffle_id")
            if not raffle_id or raffle_id not in raffles_by_id or not is_valid_uuid(raffle_id):
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

            # Додаємо інформацію про переможців для завершених розіграшів (але обмежуємо до 5)
            if raffle.get("status") == "completed":
                try:
                    all_winners_response = supabase.table("raffle_winners").select("*") \
                        .eq("raffle_id", raffle_id) \
                        .order("place") \
                        .limit(5) \
                        .execute()

                    if all_winners_response.data:
                        # Отримуємо інформацію про всіх переможців оптимізованим запитом
                        winner_ids = [w.get("telegram_id") for w in all_winners_response.data if w.get("telegram_id")]
                        users_response = supabase.table("winix").select("telegram_id,username").in_("telegram_id",
                                                                                                    winner_ids).execute()


                        # Створюємо словник користувачів за id
                        users_by_id = {u.get("telegram_id"): u for u in users_response.data if u.get("telegram_id")}

                        winners = []
                        for winner in all_winners_response.data:
                            winner_id = winner.get("telegram_id")
                            user_data = users_by_id.get(winner_id, {})
                            username = user_data.get("username", "User")

                            winners.append({
                                "userId": winner_id,
                                "username": username,
                                "place": winner.get("place"),
                                "prize": f"{winner.get('prize_amount', 0)} {winner.get('prize_currency', 'WINIX')}",
                                "isCurrentUser": winner_id == telegram_id
                            })

                        history_entry["winners"] = winners
                except Exception as e:
                    logger.error(f"Помилка отримання переможців для розіграшу {raffle_id}: {str(e)}")
                    # Продовжуємо без інформації про переможців

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


# Перевірка існування всіх розіграшів у базі даних
def validate_all_active_raffle_ids():
    """Перевіряє всі активні розіграші на валідність ID та наявність у базі даних"""
    try:
        # Отримуємо всі активні розіграші
        response = supabase.table("raffles").select("id").eq("status", "active").execute()

        if not response.data:
            logger.info("validate_all_active_raffle_ids: Активні розіграші не знайдено")
            return {
                "status": "success",
                "message": "Активні розіграші не знайдено",
                "count": 0
            }

        # Перевіряємо ID кожного розіграшу
        valid_ids = []
        invalid_ids = []

        for raffle in response.data:
            raffle_id = raffle.get("id")
            if is_valid_uuid(raffle_id):
                valid_ids.append(raffle_id)
            else:
                invalid_ids.append(raffle_id)

        return {
            "status": "success",
            "message": f"Перевірено {len(response.data)} активних розіграшів",
            "valid_count": len(valid_ids),
            "invalid_count": len(invalid_ids),
            "invalid_ids": invalid_ids
        }
    except Exception as e:
        logger.error(f"validate_all_active_raffle_ids: Помилка: {str(e)}")
        return {
            "status": "error",
            "message": f"Помилка перевірки активних розіграшів: {str(e)}"
        }


def _is_admin(admin_id):
    """Перевірка, чи користувач є адміністратором"""
    if not admin_id:
        return False

    # Отримуємо список адміністраторів з середовища
    admin_ids = os.getenv("ADMIN_IDS", "").split(",")
    return str(admin_id) in admin_ids


@handle_exceptions
def get_all_raffles(status_filter=None, admin_id=None):
    """Отримання всіх розіграшів для адміністратора"""
    # Перевірка, чи admin_id є адміністратором
    if not _is_admin(admin_id):
        raise UnauthorizedAccessError("Доступ заборонено. Ви не є адміністратором.")

    # Формуємо запит залежно від фільтра статусу
    query = supabase.table("raffles").select("*")

    if status_filter:
        query = query.eq("status", status_filter)

    # Сортуємо за часом створення (спочатку найновіші)
    query = query.order("created_at", desc=True)

    # Виконуємо запит
    try:
        response = query.execute()
    except Exception as e:
        logger.error(f"Помилка отримання розіграшів: {str(e)}")
        return jsonify({"status": "error", "message": f"Помилка запиту: {str(e)}"}), 500

    # Повертаємо результат
    return jsonify({
        "status": "success",
        "data": response.data,
        "count": len(response.data) if response.data else 0
    })


@handle_exceptions
def create_raffle(data, admin_id=None):
    """Створення нового розіграшу адміністратором"""
    # Перевірка, чи admin_id є адміністратором
    if not _is_admin(admin_id):
        raise UnauthorizedAccessError("Доступ заборонено. Ви не є адміністратором.")

    # Перевірка необхідних даних
    required_fields = ["title", "description", "prize_amount", "prize_currency", "entry_fee", "winners_count", "start_time", "end_time"]
    for field in required_fields:
        if field not in data:
            return jsonify({"status": "error", "message": f"Поле {field} є обов'язковим"}), 400

    # Генеруємо унікальний ID
    raffle_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)

    # Підготовка даних для створення
    raffle_data = {
        "id": raffle_id,
        "title": data.get("title"),
        "description": data.get("description"),
        "prize_amount": float(data.get("prize_amount")),
        "prize_currency": data.get("prize_currency", "WINIX"),
        "entry_fee": int(data.get("entry_fee")),
        "start_time": data.get("start_time"),
        "end_time": data.get("end_time"),
        "winners_count": int(data.get("winners_count")),
        "status": "active",
        "is_daily": data.get("is_daily", False),
        "image_url": data.get("image_url", ""),
        "prize_distribution": data.get("prize_distribution", {}),
        "created_by": str(admin_id),
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
        "participants_count": 0
    }

    # Виконуємо запит
    try:
        response = supabase.table("raffles").insert(raffle_data).execute()
    except Exception as e:
        logger.error(f"Помилка створення розіграшу: {str(e)}")
        return jsonify({"status": "error", "message": f"Помилка запиту: {str(e)}"}), 500

    # Очищуємо кеш активних розіграшів
    clear_cache("active_raffles")

    # Повертаємо результат
    return jsonify({
        "status": "success",
        "message": "Розіграш успішно створено",
        "data": response.data[0] if response.data else raffle_data
    })


@handle_exceptions
def update_raffle(raffle_id, data, admin_id=None):
    """Оновлення даних розіграшу адміністратором"""
    # Перевірка, чи admin_id є адміністратором
    if not _is_admin(admin_id):
        raise UnauthorizedAccessError("Доступ заборонено. Ви не є адміністратором.")

    # Перевірка валідності ID розіграшу
    if not is_valid_uuid(raffle_id):
        raise InvalidRaffleIDError(f"Невалідний формат ID розіграшу: {raffle_id}")

    # Перевірка, чи розіграш існує
    try:
        raffle_response = supabase.table("raffles").select("*").eq("id", raffle_id).execute()
    except Exception as e:
        logger.error(f"Помилка запиту розіграшу {raffle_id}: {str(e)}")
        return jsonify({"status": "error", "message": f"Помилка запиту: {str(e)}"}), 500

    if not raffle_response.data:
        raise RaffleNotFoundException(f"Розіграш з ID {raffle_id} не знайдено")

    # Підготовка даних для оновлення
    update_data = {}
    allowed_fields = ["title", "description", "prize_amount", "prize_currency", "entry_fee",
                      "winners_count", "start_time", "end_time", "status", "is_daily",
                      "image_url", "prize_distribution"]

    for field in allowed_fields:
        if field in data:
            update_data[field] = data[field]

    # Додаємо дату оновлення
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()
    update_data["updated_by"] = str(admin_id)

    # Виконуємо запит
    try:
        response = supabase.table("raffles").update(update_data).eq("id", raffle_id).execute()
    except Exception as e:
        logger.error(f"Помилка оновлення розіграшу {raffle_id}: {str(e)}")
        return jsonify({"status": "error", "message": f"Помилка запиту: {str(e)}"}), 500

    # Якщо змінено статус на "completed", викликаємо функцію завершення розіграшу
    if data.get("status") == "completed" and raffle_response.data[0].get("status") != "completed":
        logger.info(f"Статус розіграшу {raffle_id} змінено на 'completed', запускаємо процес завершення")
        finish_raffle(raffle_id, admin_id)

    # Оновлюємо кеш
    clear_cache(f"raffle_details_{raffle_id}")
    clear_cache("active_raffles")

    # Повертаємо результат
    return jsonify({
        "status": "success",
        "message": "Розіграш успішно оновлено",
        "data": response.data[0] if response.data else update_data
    })


@handle_exceptions
def delete_raffle(raffle_id, admin_id=None):
    """Видалення розіграшу адміністратором"""
    # Перевірка, чи admin_id є адміністратором
    if not _is_admin(admin_id):
        raise UnauthorizedAccessError("Доступ заборонено. Ви не є адміністратором.")

    # Перевірка валідності ID розіграшу
    if not is_valid_uuid(raffle_id):
        raise InvalidRaffleIDError(f"Невалідний формат ID розіграшу: {raffle_id}")

    # Перевірка, чи розіграш існує
    try:
        raffle_response = supabase.table("raffles").select("*").eq("id", raffle_id).execute()
    except Exception as e:
        logger.error(f"Помилка запиту розіграшу {raffle_id}: {str(e)}")
        return jsonify({"status": "error", "message": f"Помилка запиту: {str(e)}"}), 500

    if not raffle_response.data:
        raise RaffleNotFoundException(f"Розіграш з ID {raffle_id} не знайдено")

    # Перевіряємо, чи розіграш має учасників
    try:
        participants_response = supabase.table("raffle_participants").select("count", count="exact").eq("raffle_id", raffle_id).execute()
        participants_count = participants_response.count if hasattr(participants_response, 'count') else 0
    except Exception as e:
        logger.error(f"Помилка підрахунку учасників розіграшу {raffle_id}: {str(e)}")
        participants_count = 0

    # Якщо розіграш має учасників, повертаємо помилку
    if participants_count > 0:
        return jsonify({
            "status": "error",
            "message": f"Неможливо видалити розіграш з учасниками. Кількість учасників: {participants_count}",
            "participants_count": participants_count
        }), 400

    # Виконуємо запит на видалення
    try:
        response = supabase.table("raffles").delete().eq("id", raffle_id).execute()
    except Exception as e:
        logger.error(f"Помилка видалення розіграшу {raffle_id}: {str(e)}")
        return jsonify({"status": "error", "message": f"Помилка запиту: {str(e)}"}), 500

    # Оновлюємо кеш
    clear_cache(f"raffle_details_{raffle_id}")
    clear_cache("active_raffles")

    # Повертаємо результат
    return jsonify({
        "status": "success",
        "message": "Розіграш успішно видалено",
        "data": response.data[0] if response.data else {"id": raffle_id}
    })


@handle_exceptions
def get_raffle_participants(raffle_id, admin_id=None):
    """Отримання списку учасників розіграшу адміністратором"""
    # Перевірка, чи admin_id є адміністратором
    if not _is_admin(admin_id):
        raise UnauthorizedAccessError("Доступ заборонено. Ви не є адміністратором.")

    # Перевірка валідності ID розіграшу
    if not is_valid_uuid(raffle_id):
        raise InvalidRaffleIDError(f"Невалідний формат ID розіграшу: {raffle_id}")

    # Перевірка, чи розіграш існує
    try:
        raffle_response = supabase.table("raffles").select("*").eq("id", raffle_id).execute()
    except Exception as e:
        logger.error(f"Помилка запиту розіграшу {raffle_id}: {str(e)}")
        return jsonify({"status": "error", "message": f"Помилка запиту: {str(e)}"}), 500

    if not raffle_response.data:
        raise RaffleNotFoundException(f"Розіграш з ID {raffle_id} не знайдено")

    # Отримуємо список учасників
    try:
        participants_response = supabase.table("raffle_participants").select("*").eq("raffle_id", raffle_id).execute()
    except Exception as e:
        logger.error(f"Помилка запиту учасників розіграшу {raffle_id}: {str(e)}")
        return jsonify({"status": "error", "message": f"Помилка запиту: {str(e)}"}), 500

    if not participants_response.data:
        return jsonify({
            "status": "success",
            "message": "Учасників не знайдено",
            "data": [],
            "count": 0
        })

    # Формуємо список унікальних telegram_id учасників
    telegram_ids = list(set([p.get("telegram_id") for p in participants_response.data if p.get("telegram_id")]))

    # Отримуємо дані користувачів
    users_data = {}
    if telegram_ids:
        try:
            users_response = supabase.table("winix").select("telegram_id,username").in_("telegram_id", telegram_ids).execute()
            for user in users_response.data:
                users_data[user.get("telegram_id")] = user
        except Exception as e:
            logger.error(f"Помилка запиту даних користувачів: {str(e)}")

    # Формуємо список учасників з даними користувачів
    participants = []
    for participant in participants_response.data:
        telegram_id = participant.get("telegram_id")
        user_data = users_data.get(telegram_id, {})

        participant_data = {
            "id": participant.get("id"),
            "telegram_id": telegram_id,
            "username": user_data.get("username", "Unknown"),
            "entry_count": participant.get("entry_count", 0),
            "entry_time": participant.get("entry_time"),
            "status": participant.get("status")
        }

        participants.append(participant_data)

    # Повертаємо результат
    return jsonify({
        "status": "success",
        "data": participants,
        "count": len(participants),
        "raffle": raffle_response.data[0]
    })


@handle_exceptions
def finish_raffle(raffle_id, admin_id=None):
    """Завершення розіграшу та визначення переможців"""
    # Перевірка, чи admin_id є адміністратором (якщо вказано)
    if admin_id is not None and not _is_admin(admin_id):
        raise UnauthorizedAccessError("Доступ заборонено. Ви не є адміністратором.")

    # Перевірка валідності ID розіграшу
    if not is_valid_uuid(raffle_id):
        raise InvalidRaffleIDError(f"Невалідний формат ID розіграшу: {raffle_id}")

    # Перевірка, чи розіграш існує
    try:
        raffle_response = supabase.table("raffles").select("*").eq("id", raffle_id).execute()
    except Exception as e:
        logger.error(f"Помилка запиту розіграшу {raffle_id}: {str(e)}")
        return jsonify({"status": "error", "message": f"Помилка запиту: {str(e)}"}), 500

    if not raffle_response.data:
        raise RaffleNotFoundException(f"Розіграш з ID {raffle_id} не знайдено")

    raffle = raffle_response.data[0]

    # Перевіряємо, чи розіграш вже завершено
    if raffle.get("status") == "completed":
        return jsonify({
            "status": "warning",
            "message": "Цей розіграш вже завершено",
            "raffle_id": raffle_id
        })

    # Отримуємо всіх учасників розіграшу
    try:
        participants_response = supabase.table("raffle_participants").select("*").eq("raffle_id", raffle_id).execute()
    except Exception as e:
        logger.error(f"Помилка запиту учасників розіграшу {raffle_id}: {str(e)}")
        return jsonify({"status": "error", "message": f"Помилка запиту: {str(e)}"}), 500

    # Перевіряємо, чи є учасники
    if not participants_response.data:
        return jsonify({
            "status": "error",
            "message": "Неможливо завершити розіграш без учасників",
            "raffle_id": raffle_id
        }), 400

    # Формуємо пули для розіграшу з урахуванням кількості жетонів кожного учасника
    participants = participants_response.data
    total_entries = sum(p.get("entry_count", 0) for p in participants)

    if total_entries == 0:
        return jsonify({
            "status": "error",
            "message": "Неможливо завершити розіграш: загальна кількість жетонів дорівнює нулю",
            "raffle_id": raffle_id
        }), 400

    # Підготовка до розіграшу призів
    winners_count = raffle.get("winners_count", 1)
    prize_amount = raffle.get("prize_amount", 0)
    prize_currency = raffle.get("prize_currency", "WINIX")

    # Перевіряємо custom prize_distribution
    prize_distribution = raffle.get("prize_distribution", {})

    # Якщо немає розподілу призів, створюємо його
    if not prize_distribution and winners_count > 0:
        if winners_count == 1:
            prize_distribution = {"1": {"amount": prize_amount, "currency": prize_currency}}
        else:
            # Розподіляємо призи за дефолтною схемою (50% першому, 30% другому, решта порівну)
            first_prize = prize_amount * 0.5
            second_prize = prize_amount * 0.3 if winners_count > 1 else 0
            remaining = prize_amount - first_prize - second_prize

            # Розподіляємо залишок порівну серед інших переможців
            other_prizes = remaining / (winners_count - 2) if winners_count > 2 else 0

            prize_distribution = {
                "1": {"amount": first_prize, "currency": prize_currency}
            }

            if winners_count > 1:
                prize_distribution["2"] = {"amount": second_prize, "currency": prize_currency}

            for i in range(3, winners_count + 1):
                prize_distribution[str(i)] = {"amount": other_prizes, "currency": prize_currency}

    # Створюємо пул для жеребкування з урахуванням кількості жетонів
    draw_pool = []
    for participant in participants:
        telegram_id = participant.get("telegram_id")
        entry_count = participant.get("entry_count", 0)

        # Додаємо учасника в пул стільки разів, скільки у нього жетонів
        for _ in range(entry_count):
            draw_pool.append(telegram_id)

    # Перемішуємо пул і вибираємо переможців
    import random
    random.shuffle(draw_pool)

    # Вибираємо унікальних переможців
    winners = []
    selected_winners = set()

    # Обмежуємо кількість переможців кількістю унікальних учасників
    unique_participants = set(p.get("telegram_id") for p in participants)
    max_winners = min(winners_count, len(unique_participants))

    for place in range(1, max_winners + 1):
        # Вибираємо переможця для поточного місця
        if not draw_pool:
            break

        winner_id = None
        while draw_pool and winner_id is None:
            # Беремо випадковий елемент з пулу
            candidate = random.choice(draw_pool)

            # Якщо це новий переможець, обираємо його
            if candidate not in selected_winners:
                winner_id = candidate
                selected_winners.add(winner_id)

            # Видаляємо використані жетони з пулу
            while candidate in draw_pool:
                draw_pool.remove(candidate)

        if winner_id:
            # Отримуємо приз для цього місця
            place_str = str(place)
            prize_info = prize_distribution.get(place_str, {"amount": 0, "currency": prize_currency})

            winners.append({
                "telegram_id": winner_id,
                "place": place,
                "prize_amount": prize_info.get("amount", 0),
                "prize_currency": prize_info.get("currency", prize_currency)
            })

    # Проводимо транзакцію для збереження результатів
    try:
        now = datetime.now(timezone.utc)

        with execute_transaction() as txn:
            # 1. Оновлюємо статус розіграшу на "completed"
            txn.table("raffles").update({
                "status": "completed",
                "updated_at": now.isoformat(),
                "completed_at": now.isoformat()
            }).eq("id", raffle_id).execute()

            # 2. Зберігаємо переможців
            for winner in winners:
                winner_data = {
                    "id": str(uuid.uuid4()),
                    "raffle_id": raffle_id,
                    "telegram_id": winner["telegram_id"],
                    "place": winner["place"],
                    "prize_amount": winner["prize_amount"],
                    "prize_currency": winner["prize_currency"],
                    "created_at": now.isoformat(),
                    "notification_sent": False
                }

                txn.table("raffle_winners").insert(winner_data).execute()

                # 3. Нараховуємо виграш на баланс переможця
                user = get_user(winner["telegram_id"])
                if user:
                    # Збільшуємо лічильник перемог
                    wins_count = int(user.get("wins_count", 0)) + 1
                    txn.table("winix").update({"wins_count": wins_count}).eq("telegram_id", winner["telegram_id"]).execute()

                    # Нараховуємо приз
                    balance = float(user.get("balance", 0))
                    new_balance = balance + float(winner["prize_amount"])
                    txn.table("winix").update({"balance": new_balance}).eq("telegram_id", winner["telegram_id"]).execute()

                    # Створюємо транзакцію для призу
                    transaction_data = {
                        "id": str(uuid.uuid4()),
                        "telegram_id": winner["telegram_id"],
                        "type": "prize",
                        "amount": float(winner["prize_amount"]),
                        "description": f"Виграш у розіграші '{raffle.get('title')}' - {winner['place']} місце",
                        "status": "completed",
                        "created_at": now.isoformat(),
                        "raffle_id": raffle_id
                    }

                    txn.table("transactions").insert(transaction_data).execute()

                    # Перевіряємо, чи потрібно активувати бейдж переможця
                    if wins_count == 1 and not user.get("badge_winner", False):
                        txn.table("winix").update({"badge_winner": True}).eq("telegram_id", winner["telegram_id"]).execute()

        # Очищаємо кеш
        clear_cache(f"raffle_details_{raffle_id}")
        clear_cache("active_raffles")

        # Формуємо результат
        return jsonify({
            "status": "success",
            "message": f"Розіграш успішно завершено. Обрано {len(winners)} переможців.",
            "raffle_id": raffle_id,
            "winners": winners,
            "winners_count": len(winners)
        })

    except Exception as e:
        logger.error(f"Помилка завершення розіграшу {raffle_id}: {str(e)}")
        return jsonify({
            "status": "error",
            "message": f"Помилка завершення розіграшу: {str(e)}",
            "raffle_id": raffle_id
        }), 500


@handle_exceptions
def check_and_finish_expired_raffles():
    """Перевірка та автоматичне завершення прострочених розіграшів"""
    logger.info("Запуск перевірки прострочених розіграшів")

    # Отримуємо поточний час
    now = datetime.now(timezone.utc)

    # Отримуємо активні розіграші, у яких минув час завершення
    try:
        expired_raffles_response = supabase.table("raffles").select("*") \
            .eq("status", "active") \
            .lt("end_time", now.isoformat()) \
            .execute()
    except Exception as e:
        logger.error(f"Помилка запиту прострочених розіграшів: {str(e)}")
        return {
            "status": "error",
            "message": f"Помилка запиту прострочених розіграшів: {str(e)}"
        }

    if not expired_raffles_response.data:
        logger.info("Прострочені розіграші не знайдено")
        return {
            "status": "success",
            "message": "Прострочені розіграші не знайдено",
            "finished_count": 0
        }

    # Завершуємо кожен прострочений розіграш
    finished_count = 0
    finished_raffles = []
    errors = []

    for raffle in expired_raffles_response.data:
        raffle_id = raffle.get("id")

        # Перевіряємо валідність UUID перед спробою завершення
        if not is_valid_uuid(raffle_id):
            logger.error(f"Пропускаємо розіграш з невалідним UUID: {raffle_id}")
            errors.append({
                "raffle_id": raffle_id,
                "error": "Невалідний UUID"
            })
            continue

        try:
            logger.info(f"Автоматичне завершення простроченого розіграшу {raffle_id}")

            # Викликаємо функцію завершення розіграшу
            result = finish_raffle(raffle_id)

            # Перевіряємо результат
            if isinstance(result, tuple):
                response_data = result[0].json
                status_code = result[1]

                if status_code >= 400:
                    logger.error(f"Помилка завершення розіграшу {raffle_id}: {response_data.get('message')}")
                    errors.append({
                        "raffle_id": raffle_id,
                        "error": response_data.get("message")
                    })
                    continue
            else:
                response_data = result.json

            if response_data.get("status") == "success":
                finished_count += 1
                finished_raffles.append({
                    "raffle_id": raffle_id,
                    "title": raffle.get("title"),
                    "winners_count": response_data.get("winners_count", 0)
                })
                logger.info(f"Розіграш {raffle_id} успішно завершено")
            else:
                logger.warning(f"Розіграш {raffle_id} не завершено: {response_data.get('message')}")
                errors.append({
                    "raffle_id": raffle_id,
                    "error": response_data.get("message")
                })

        except Exception as e:
            logger.error(f"Помилка завершення розіграшу {raffle_id}: {str(e)}")
            errors.append({
                "raffle_id": raffle_id,
                "error": str(e)
            })

    # Формуємо результат
    return {
        "status": "success",
        "message": f"Автоматично завершено {finished_count} розіграшів",
        "finished_count": finished_count,
        "finished_raffles": finished_raffles,
        "errors": errors,
        "total_expired": len(expired_raffles_response.data)
    }