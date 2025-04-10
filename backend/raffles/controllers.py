from flask import jsonify, request
import logging
import os
import sys
import uuid
from datetime import datetime, timezone, timedelta
import secrets  # Використовуємо криптографічно безпечний генератор
import json
from functools import wraps
from typing import Dict, List, Any, Tuple, Optional, Union

# Налаштування логування
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Імпортуємо з supabase_client
try:
    from ..supabase_client import (
        get_user, update_user, update_balance, update_coins,
        supabase, check_and_update_badges, execute_transaction
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
        get_user, update_user, update_balance, update_coins,
        supabase, check_and_update_badges, execute_transaction
    )
    from utils.transaction_helpers import create_transaction_record, update_transaction_status


# Користувацькі винятки для покращеної обробки помилок
class RaffleError(Exception):
    """Базовий клас для винятків, пов'язаних з розіграшами"""
    pass


class RaffleNotFoundException(RaffleError):
    """Виняток, який виникає, коли розіграш не знайдено"""
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


# Декоратор для обробки винятків
def handle_exceptions(f):
    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            return f(*args, **kwargs)
        except RaffleNotFoundException as e:
            logger.warning(f"Розіграш не знайдено у {f.__name__}: {str(e)}")
            return jsonify({"status": "error", "message": str(e)}), 404
        except InsufficientTokensError as e:
            logger.warning(f"Недостатньо жетонів у {f.__name__}: {str(e)}")
            return jsonify({"status": "error", "message": str(e)}), 400
        except RaffleAlreadyEndedError as e:
            logger.warning(f"Розіграш вже завершено у {f.__name__}: {str(e)}")
            return jsonify({"status": "error", "message": str(e)}), 400
        except ParticipationError as e:
            logger.warning(f"Помилка участі у {f.__name__}: {str(e)}")
            return jsonify({"status": "error", "message": str(e)}), 400
        except UnauthorizedAccessError as e:
            logger.warning(f"Неавторизований доступ у {f.__name__}: {str(e)}")
            return jsonify({"status": "error", "message": str(e)}), 403
        except ValueError as e:
            logger.warning(f"Помилка валідації у {f.__name__}: {str(e)}")
            return jsonify({"status": "error", "message": str(e)}), 400
        except Exception as e:
            logger.error(f"Помилка у {f.__name__}: {str(e)}", exc_info=True)
            return jsonify({
                "status": "error",
                "message": "Сталася помилка на сервері. Спробуйте пізніше.",
                "error_details": str(e) if os.getenv("DEBUG") == "true" else None
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


@handle_exceptions
def get_active_raffles():
    """Отримання списку активних розіграшів"""
    # Отримуємо параметри пагінації
    limit = min(int(request.args.get('limit', 20)), MAX_RESULTS_PER_PAGE)
    offset = int(request.args.get('offset', 0))

    # Отримуємо всі активні розіграші з бази даних з пагінацією
    response = supabase.table("raffles") \
        .select("*") \
        .eq("status", "active") \
        .order("is_daily", desc=True) \
        .order("end_time", asc=True) \
        .limit(limit) \
        .offset(offset) \
        .execute()

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
    count_response = supabase.table("raffles").select("count", count="exact").eq("status", "active").execute()
    total_count = count_response.count if hasattr(count_response, 'count') else len(raffles_data)

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

    # Отримуємо дані розіграшу
    response = supabase.table("raffles").select("*").eq("id", raffle_id).execute()

    if not response.data:
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
        winners_response = supabase.table("raffle_winners").select("*").eq("raffle_id", raffle_id).order("place",
                                                                                                         asc=True).execute()

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

    return jsonify({"status": "success", "data": raffle_details})


@handle_exceptions
def participate_in_raffle(telegram_id, data):
    """Участь у розіграші"""
    # Перевірка необхідних даних
    if not data or "raffle_id" not in data:
        raise ValueError("Не вказано ID розіграшу")

    raffle_id = data["raffle_id"]
    entry_count = min(int(data.get("entry_count", 1)), MAX_ENTRY_COUNT)

    # Перевіряємо кількість жетонів
    if entry_count <= 0:
        raise ValueError("Кількість жетонів має бути більше нуля")

    # Отримуємо користувача
    user = get_user(telegram_id)
    if not user:
        raise ValueError("Користувача не знайдено")

    # Отримуємо розіграш
    raffle_response = supabase.table("raffles").select("*").eq("id", raffle_id).execute()
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
    participation_response = supabase.table("raffle_participants").select("*") \
        .eq("raffle_id", raffle_id) \
        .eq("telegram_id", telegram_id) \
        .execute()

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
    # Перевіряємо, чи користувач існує
    user = get_user(telegram_id)
    if not user:
        raise ValueError("Користувача не знайдено")

    # Отримуємо всі активні участі користувача
    participants_response = supabase.table("raffle_participants").select("*").eq("telegram_id", telegram_id).execute()

    if not participants_response.data:
        return jsonify({"status": "success", "data": []})

    # Отримуємо ID розіграшів, у яких бере участь користувач
    raffle_ids = [p.get("raffle_id") for p in participants_response.data if p.get("raffle_id")]

    if not raffle_ids:
        return jsonify({"status": "success", "data": []})

    # Отримуємо дані цих розіграшів
    # Використовуємо запит in_ для вибірки кількох розіграшів одночасно
    raffles_response = supabase.table("raffles").select("*").in_("id", raffle_ids).execute()

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

    return jsonify({"status": "success", "data": user_raffles})


@handle_exceptions
def get_user_raffles_history(telegram_id):
    """Отримання історії участі користувача в розіграшах"""
    # Перевіряємо, чи користувач існує
    user = get_user(telegram_id)
    if not user:
        raise ValueError("Користувача не знайдено")

    # Отримуємо всі участі користувача
    participants_response = supabase.table("raffle_participants").select("*").eq("telegram_id", telegram_id).execute()

    if not participants_response.data:
        return jsonify({"status": "success", "data": []})

    # Отримуємо ID розіграшів, у яких брав участь користувач
    raffle_ids = [p.get("raffle_id") for p in participants_response.data if p.get("raffle_id")]

    if not raffle_ids:
        return jsonify({"status": "success", "data": []})

    # Отримуємо розіграші
    raffles_response = supabase.table("raffles").select("*").in_("id", raffle_ids).execute()

    if not raffles_response.data:
        return jsonify({"status": "success", "data": []})

    # Створюємо словник розіграшів за id для швидкого доступу
    raffles_by_id = {r.get("id"): r for r in raffles_response.data if r.get("id")}

    # Отримуємо дані про переможців
    winners_response = supabase.table("raffle_winners").select("*").eq("telegram_id", telegram_id).execute()
    winners_by_raffle = {w.get("raffle_id"): w for w in winners_response.data if w.get("raffle_id")}

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

        # Формуємо запис історії
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

        # Додаємо інформацію про переможців для завершених розіграшів
        if raffle.get("status") == "completed":
            all_winners_response = supabase.table("raffle_winners").select("*") \
                .eq("raffle_id", raffle_id) \
                .order("place", asc=True) \
                .limit(10) \
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

        history.append(history_entry)

    # Сортуємо за датою (від найновіших до найстаріших)
    history.sort(key=lambda x: x["date"], reverse=True)

    return jsonify({"status": "success", "data": history})


@handle_exceptions
def create_raffle(data, admin_id):
    """Створення нового розіграшу (для адміністраторів)"""
    # Перевірка адміністратора
    if not _is_admin(admin_id):
        raise UnauthorizedAccessError("Доступ заборонено. Ви не є адміністратором.")

    # Перевірка необхідних полів
    required_fields = ["title", "prize_amount", "prize_currency", "entry_fee", "start_time", "end_time",
                       "winners_count"]
    missing_fields = [field for field in required_fields if field not in data]

    if missing_fields:
        raise ValueError(f"Відсутні обов'язкові поля: {', '.join(missing_fields)}")

    # Перевіряємо часові мітки
    try:
        start_time = datetime.fromisoformat(data["start_time"].replace('Z', '+00:00'))
        end_time = datetime.fromisoformat(data["end_time"].replace('Z', '+00:00'))
    except (ValueError, AttributeError):
        raise ValueError("Некоректний формат часу. Використовуйте ISO 8601.")

    if start_time >= end_time:
        raise ValueError("Час початку має бути раніше часу завершення")

    # Перевіряємо, чи є це щоденний розіграш
    is_daily = data.get("is_daily", False)

    # Якщо це щоденний розіграш, перевіряємо, чи немає інших активних щоденних розіграшів
    if is_daily:
        daily_raffles_response = supabase.table("raffles") \
            .select("id") \
            .eq("is_daily", True) \
            .eq("status", "active") \
            .execute()

        if daily_raffles_response.data:
            raise ValueError("Вже існує активний щоденний розіграш. Завершіть його перед створенням нового.")

    # Створюємо дані для розіграшу
    raffle_data = {
        "title": data["title"],
        "description": data.get("description", ""),
        "prize_amount": float(data["prize_amount"]),
        "prize_currency": data["prize_currency"],
        "entry_fee": int(data["entry_fee"]),
        "start_time": start_time.isoformat(),
        "end_time": end_time.isoformat(),
        "max_entries": data.get("max_entries"),
        "winners_count": int(data["winners_count"]),
        "status": "active",
        "is_daily": is_daily,
        "image_url": data.get("image_url", ""),
        "prize_distribution": data.get("prize_distribution", {}),
        "created_by": admin_id,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "participants_count": 0
    }

    # Якщо не вказано розподіл призів, створюємо його автоматично
    if not raffle_data["prize_distribution"]:
        raffle_data["prize_distribution"] = calculate_prize_distribution({
            "winners_count": raffle_data["winners_count"],
            "prize_amount": raffle_data["prize_amount"],
            "prize_currency": raffle_data["prize_currency"]
        })

    # Створюємо розіграш
    response = supabase.table("raffles").insert(raffle_data).execute()

    if not response.data:
        raise Exception("Помилка створення розіграшу")

    # Отримуємо створений розіграш
    created_raffle = response.data[0]

    # Логуємо створення розіграшу
    logger.info(f"Адміністратор {admin_id} створив новий розіграш: {created_raffle.get('id')}")

    return jsonify({
        "status": "success",
        "message": "Розіграш успішно створено",
        "data": created_raffle
    })


@handle_exceptions
def update_raffle(raffle_id, data, admin_id):
    """Оновлення розіграшу (для адміністраторів)"""
    # Перевірка адміністратора
    if not _is_admin(admin_id):
        raise UnauthorizedAccessError("Доступ заборонено. Ви не є адміністратором.")

    # Перевіряємо валідність ID розіграшу
    if not raffle_id:
        raise ValueError("Не вказано ID розіграшу")

    # Отримуємо розіграш
    raffle_response = supabase.table("raffles").select("*").eq("id", raffle_id).execute()

    if not raffle_response.data:
        raise RaffleNotFoundException(f"Розіграш з ID {raffle_id} не знайдено")

    raffle = raffle_response.data[0]

    # Перевіряємо, чи розіграш активний
    if raffle.get("status") != "active":
        raise ValueError("Можна оновлювати лише активні розіграші")

    # Перевіряємо часові мітки, якщо вони оновлюються
    if "start_time" in data or "end_time" in data:
        try:
            start_time = datetime.fromisoformat(
                data.get("start_time", raffle.get("start_time")).replace('Z', '+00:00')
            )
            end_time = datetime.fromisoformat(
                data.get("end_time", raffle.get("end_time")).replace('Z', '+00:00')
            )

            if start_time >= end_time:
                raise ValueError("Час початку має бути раніше часу завершення")
        except (ValueError, AttributeError):
            raise ValueError("Некоректний формат часу")

    # Перевіряємо, чи оновлюється статус щоденного розіграшу
    if "is_daily" in data and data["is_daily"] and not raffle.get("is_daily"):
        daily_raffles_response = supabase.table("raffles") \
            .select("id") \
            .eq("is_daily", True) \
            .eq("status", "active") \
            .execute()

        if daily_raffles_response.data:
            raise ValueError("Вже існує активний щоденний розіграш. Завершіть його перед створенням нового.")

    # Формуємо дані для оновлення
    update_data = {}
    updatable_fields = [
        "title", "description", "prize_amount", "prize_currency", "entry_fee",
        "start_time", "end_time", "max_entries", "winners_count", "status",
        "is_daily", "image_url", "prize_distribution"
    ]

    for field in updatable_fields:
        if field in data:
            update_data[field] = data[field]

    # Якщо змінилась кількість переможців, але не змінився розподіл призів, оновлюємо його
    if "winners_count" in update_data and "prize_distribution" not in update_data:
        winners_count = update_data["winners_count"]
        prize_amount = update_data.get("prize_amount", raffle.get("prize_amount"))
        prize_currency = update_data.get("prize_currency", raffle.get("prize_currency"))

        update_data["prize_distribution"] = calculate_prize_distribution({
            "winners_count": winners_count,
            "prize_amount": prize_amount,
            "prize_currency": prize_currency
        })

    # Додаємо час оновлення
    update_data["updated_at"] = datetime.now(timezone.utc).isoformat()

    # Оновлюємо розіграш
    response = supabase.table("raffles").update(update_data).eq("id", raffle_id).execute()

    if not response.data:
        raise Exception("Помилка оновлення розіграшу")

    # Отримуємо оновлений розіграш
    updated_raffle = response.data[0]

    # Логуємо оновлення розіграшу
    logger.info(f"Адміністратор {admin_id} оновив розіграш {raffle_id}")

    return jsonify({
        "status": "success",
        "message": "Розіграш успішно оновлено",
        "data": updated_raffle
    })


@handle_exceptions
def delete_raffle(raffle_id, admin_id):
    """Видалення розіграшу (для адміністраторів)"""
    # Перевірка адміністратора
    if not _is_admin(admin_id):
        raise UnauthorizedAccessError("Доступ заборонено. Ви не є адміністратором.")

    # Перевіряємо валідність ID розіграшу
    if not raffle_id:
        raise ValueError("Не вказано ID розіграшу")

    # Отримуємо розіграш
    raffle_response = supabase.table("raffles").select("*").eq("id", raffle_id).execute()

    if not raffle_response.data:
        raise RaffleNotFoundException(f"Розіграш з ID {raffle_id} не знайдено")

    # Перевіряємо, чи розіграш активний
    raffle = raffle_response.data[0]
    if raffle.get("status") != "active":
        raise ValueError("Можна видаляти лише активні розіграші")

    # Перевіряємо, чи є учасники розіграшу
    participants_response = supabase.table("raffle_participants").select("*").eq("raffle_id", raffle_id).execute()

    if participants_response.data:
        # Якщо є учасники, переводимо розіграш в статус "cancelled"
        try:
            with execute_transaction() as txn:
                # 1. Змінюємо статус розіграшу на "cancelled"
                txn.table("raffles").update({
                    "status": "cancelled",
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }).eq("id", raffle_id).execute()

                # 2. Повертаємо жетони всім учасникам
                for participant in participants_response.data:
                    participant_id = participant.get("id")
                    if participant_id:
                        _refund_participant(participant_id, txn)
        except Exception as e:
            logger.error(f"Помилка скасування розіграшу {raffle_id}: {str(e)}")
            raise Exception("Помилка скасування розіграшу та повернення жетонів. Спробуйте пізніше.")

        logger.info(f"Адміністратор {admin_id} скасував розіграш {raffle_id} з поверненням жетонів учасникам")

        return jsonify({
            "status": "success",
            "message": "Розіграш скасовано. Жетони повернуто учасникам."
        })
    else:
        # Якщо учасників немає, видаляємо розіграш
        supabase.table("raffles").delete().eq("id", raffle_id).execute()

        logger.info(f"Адміністратор {admin_id} видалив розіграш {raffle_id}")

        return jsonify({
            "status": "success",
            "message": "Розіграш успішно видалено"
        })


def _refund_participant(participant_id, transaction=None):
    """Повернення жетонів учаснику при скасуванні розіграшу"""
    try:
        # Отримуємо дані учасника
        participant_response = supabase.table("raffle_participants").select("*").eq("id", participant_id).execute()

        if not participant_response.data:
            logger.error(f"_refund_participant: Учасника з ID {participant_id} не знайдено")
            return False

        participant = participant_response.data[0]
        telegram_id = participant.get("telegram_id")
        entry_count = participant.get("entry_count", 1)
        raffle_id = participant.get("raffle_id")

        # Отримуємо дані розіграшу
        raffle_response = supabase.table("raffles").select("entry_fee, title").eq("id", raffle_id).execute()

        if not raffle_response.data:
            logger.error(f"_refund_participant: Розіграш з ID {raffle_id} не знайдено")
            return False

        raffle = raffle_response.data[0]
        entry_fee = raffle.get("entry_fee", 1)
        raffle_title = raffle.get("title", "Розіграш")

        # Розраховуємо суму повернення
        refund_amount = entry_count * entry_fee

        # Отримуємо користувача
        user = get_user(telegram_id)
        if not user:
            logger.error(f"_refund_participant: Користувача {telegram_id} не знайдено")
            return False

        # Оновлюємо баланс жетонів з використанням транзакції
        if transaction:
            # Якщо передано об'єкт транзакції, використовуємо його
            current_coins = int(user.get("coins", 0))
            new_coins = current_coins + refund_amount

            # Оновлюємо баланс
            transaction.table("winix").update({"coins": new_coins}).eq("telegram_id", telegram_id).execute()

            # Створюємо транзакцію для повернення жетонів
            transaction_data = {
                "telegram_id": telegram_id,
                "type": "refund",
                "amount": refund_amount,
                "description": f"Повернення жетонів за скасований розіграш '{raffle_title}'",
                "status": "completed",
                "raffle_id": raffle_id,
                "created_at": datetime.now(timezone.utc).isoformat()
            }

            transaction.table("transactions").insert(transaction_data).execute()

            # Оновлюємо статус участі
            transaction.table("raffle_participants").update({
                "status": "refunded"
            }).eq("id", participant_id).execute()
        else:
            # Якщо транзакцію не передано, створюємо нову
            try:
                with execute_transaction() as txn:
                    current_coins = int(user.get("coins", 0))
                    new_coins = current_coins + refund_amount

                    # Оновлюємо баланс
                    txn.table("winix").update({"coins": new_coins}).eq("telegram_id", telegram_id).execute()

                    # Створюємо транзакцію для повернення жетонів
                    transaction_data = {
                        "telegram_id": telegram_id,
                        "type": "refund",
                        "amount": refund_amount,
                        "description": f"Повернення жетонів за скасований розіграш '{raffle_title}'",
                        "status": "completed",
                        "raffle_id": raffle_id,
                        "created_at": datetime.now(timezone.utc).isoformat()
                    }

                    txn.table("transactions").insert(transaction_data).execute()

                    # Оновлюємо статус участі
                    txn.table("raffle_participants").update({
                        "status": "refunded"
                    }).eq("id", participant_id).execute()
            except Exception as e:
                logger.error(f"_refund_participant: Помилка при поверненні жетонів: {str(e)}")
                return False

        return True
    except Exception as e:
        logger.error(f"_refund_participant: Критична помилка: {str(e)}")
        return False


@handle_exceptions
def finish_raffle(raffle_id, admin_id=None):
    """Завершення розіграшу і визначення переможців"""
    if admin_id and not _is_admin(admin_id):
        raise UnauthorizedAccessError("Доступ заборонено. Ви не є адміністратором.")

    # Перевіряємо валідність ID розіграшу
    if not raffle_id:
        raise ValueError("Не вказано ID розіграшу")

    # Отримуємо розіграш
    raffle_response = supabase.table("raffles").select("*").eq("id", raffle_id).execute()

    if not raffle_response.data:
        raise RaffleNotFoundException(f"Розіграш з ID {raffle_id} не знайдено")

    raffle = raffle_response.data[0]

    # Перевіряємо, чи розіграш активний
    if raffle.get("status") != "active":
        raise ValueError("Розіграш вже завершено або скасовано")

    # Отримуємо учасників розіграшу
    participants_response = supabase.table("raffle_participants").select("*").eq("raffle_id", raffle_id).execute()

    if not participants_response.data or len(participants_response.data) == 0:
        raise ValueError("Розіграш не має учасників")

    # Підготовка даних для визначення переможців
    participants = participants_response.data
    winners_count = min(raffle.get("winners_count", 1), len(participants))

    # Визначаємо переможців за допомогою алгоритму
    winners = determine_winners(participants, winners_count)

    # Виконуємо всі операції в одній транзакції
    try:
        with execute_transaction() as txn:
            # 1. Оновлюємо статус розіграшу
            txn.table("raffles").update({
                "status": "completed",
                "updated_at": datetime.now(timezone.utc).isoformat()
            }).eq("id", raffle_id).execute()

            # 2. Зберігаємо переможців і нараховуємо їм виграші
            saved_winners = save_winners_and_reward(winners, raffle, txn)

            # 3. Оновлюємо статус всіх учасників
            for participant in participants:
                participant_id = participant.get("id")
                telegram_id = participant.get("telegram_id")

                if not participant_id or not telegram_id:
                    continue

                is_winner = any(w.get("telegram_id") == telegram_id for w in winners)

                status = "won" if is_winner else "participated"

                txn.table("raffle_participants").update({
                    "status": status,
                    "is_winner": is_winner
                }).eq("id", participant_id).execute()
    except Exception as e:
        logger.error(f"finish_raffle: Помилка завершення розіграшу {raffle_id}: {str(e)}")
        raise Exception(f"Помилка завершення розіграшу. Спробуйте пізніше.")

    logger.info(f"Розіграш {raffle_id} успішно завершено, переможців: {len(winners)}")

    # Формуємо список переможців для відповіді
    winners_response = []
    for winner in winners:
        winners_response.append({
            "telegram_id": winner.get("telegram_id"),
            "place": winner.get("place"),
            "prize_amount": winner.get("prize_amount"),
            "prize_currency": winner.get("prize_currency", raffle.get("prize_currency"))
        })

    return jsonify({
        "status": "success",
        "message": f"Розіграш успішно завершено. Визначено {len(winners)} переможців.",
        "data": {
            "raffle_id": raffle_id,
            "winners_count": winners_count,
            "winners": winners_response
        }
    })


def determine_winners(participants, winners_count):
    """Криптографічно безпечний алгоритм визначення переможців розіграшу"""
    # Створюємо пули учасників з вагами, відповідно до кількості жетонів
    weighted_participants = []

    # Спершу створюємо карту учасників за ID
    participants_map = {p.get("id"): p for p in participants if p.get("id")}

    # Формуємо пул з вагами
    for participant in participants:
        participant_id = participant.get("id")
        if not participant_id:
            continue

        telegram_id = participant.get("telegram_id")
        if not telegram_id:
            continue

        entry_count = int(participant.get("entry_count", 1))

        # Додаємо учасника в пул стільки разів, скільки в нього жетонів
        for _ in range(entry_count):
            weighted_participants.append({
                "id": participant_id,
                "telegram_id": telegram_id
            })

    # Перемішуємо пул випадковим чином з криптографічною безпекою
    if not weighted_participants:
        return []

    # Визначаємо переможців
    winners = []
    winner_ids = set()  # Для уникнення дублікатів

    for place in range(1, winners_count + 1):
        if not weighted_participants:
            break

        # Вибираємо випадкового переможця криптографічно безпечно
        selected_index = secrets.randbelow(len(weighted_participants))
        winner = weighted_participants[selected_index]
        telegram_id = winner.get("telegram_id")

        # Перевіряємо, чи цей користувач вже є серед переможців
        if telegram_id not in winner_ids:
            winners.append({
                "telegram_id": telegram_id,
                "place": place,
                "participant_id": winner.get("id")
            })
            winner_ids.add(telegram_id)

        # Видаляємо всі входження цього користувача з пулу
        weighted_participants = [p for p in weighted_participants if p.get("telegram_id") != telegram_id]

    return winners


def calculate_prize_distribution(raffle):
    """Розрахунок розподілу призового фонду між переможцями"""
    winners_count = raffle.get("winners_count", 1)
    prize_amount = float(raffle.get("prize_amount", 0))
    prize_currency = raffle.get("prize_currency", "WINIX")

    # Перевіряємо наявність вказаного розподілу призів
    if raffle.get("prize_distribution") and isinstance(raffle.get("prize_distribution"), dict):
        distribution = raffle.get("prize_distribution")
    else:
        # Створюємо стандартний розподіл призів
        distribution = {}

        if winners_count == 1:
            # Якщо переможець один, він отримує весь приз
            distribution["1"] = prize_amount
        elif winners_count <= 3:
            # Для 2-3 переможців робимо розподіл 60/30/10
            percentages = [0.6, 0.3, 0.1]
            for place in range(1, winners_count + 1):
                distribution[str(place)] = round(prize_amount * percentages[place - 1], 2)
        else:
            # Для більшої кількості переможців робимо геометричний розподіл
            # Перший отримує 50% призу, наступні - все менші частки
            first_prize = prize_amount * 0.5
            remaining = prize_amount - first_prize
            distribution["1"] = round(first_prize, 2)

            for place in range(2, winners_count + 1):
                if place <= 3:
                    # 2-3 місця отримують більші частки
                    factor = 0.3 if place == 2 else 0.15
                    prize = prize_amount * factor
                else:
                    # Решта місць ділять залишок порівну
                    prize = (remaining * 0.05) / (winners_count - 3)

                distribution[str(place)] = round(prize, 2)

    # Переконуємося, що сума всіх призів дорівнює загальній сумі призу
    total_distributed = sum(distribution.values())

    if abs(total_distributed - prize_amount) > 0.01:
        # Корегуємо першу позицію для точного розподілу
        difference = prize_amount - total_distributed
        distribution["1"] = round(distribution["1"] + difference, 2)

    # Повертаємо розподіл призів з валютою
    result = {}
    for place, amount in distribution.items():
        result[place] = {
            "amount": amount,
            "currency": prize_currency
        }

    return result


def save_winners_and_reward(winners, raffle, transaction=None):
    """Збереження переможців і нарахування їм виграшів"""
    raffle_id = raffle.get("id")
    prize_distribution = raffle.get("prize_distribution", {})

    if not prize_distribution:
        prize_distribution = calculate_prize_distribution(raffle)

    prize_currency = raffle.get("prize_currency", "WINIX")
    now = datetime.now(timezone.utc).isoformat()

    saved_winners = []

    # Функція для збереження одного переможця
    def save_winner(winner, txn):
        place = winner.get("place")
        telegram_id = winner.get("telegram_id")

        # Отримуємо суму призу для цього місця
        place_str = str(place)
        if place_str not in prize_distribution:
            logger.warning(f"Немає розподілу призу для місця {place}")
            return None

        prize_data = prize_distribution[place_str]
        prize_amount = float(prize_data.get("amount", 0))
        currency = prize_data.get("currency", prize_currency)

        # Зберігаємо дані переможця
        winner_data = {
            "raffle_id": raffle_id,
            "telegram_id": telegram_id,
            "place": place,
            "prize_amount": prize_amount,
            "prize_currency": currency,
            "win_time": now,
            "notification_sent": False,
            "reward_claimed": False
        }

        winner_response = txn.table("raffle_winners").insert(winner_data).execute()

        if not winner_response.data:
            logger.error(f"Помилка збереження переможця {telegram_id}")
            return None

        winner_record = winner_response.data[0]

        # Нараховуємо виграш користувачу
        if currency.upper() == "WINIX":
            # Оновлюємо баланс WINIX
            user = get_user(telegram_id)
            if user:
                current_balance = float(user.get("balance", 0))
                new_balance = current_balance + prize_amount

                # Оновлюємо баланс
                txn.table("winix").update({"balance": new_balance}).eq("telegram_id", telegram_id).execute()

                # Створюємо транзакцію
                transaction_data = {
                    "telegram_id": telegram_id,
                    "type": "reward",
                    "amount": prize_amount,
                    "description": f"Виграш у розіграші '{raffle.get('title')}' (місце {place})",
                    "status": "completed",
                    "raffle_id": raffle_id,
                    "created_at": now
                }

                txn.table("transactions").insert(transaction_data).execute()

                # Оновлюємо статус виграшу
                txn.table("raffle_winners").update({
                    "reward_claimed": True
                }).eq("id", winner_record.get("id")).execute()

                # Оновлюємо лічильник виграшів
                wins_count = user.get("wins_count", 0) + 1
                txn.table("winix").update({"wins_count": wins_count}).eq("telegram_id", telegram_id).execute()

                # Додаємо значення prize_amount до збереженого переможця
                saved_winner = {
                    "telegram_id": telegram_id,
                    "place": place,
                    "prize_amount": prize_amount,
                    "prize_currency": currency
                }

                return saved_winner

        return None

    # Обробляємо переможців у транзакції
    if transaction:
        # Якщо передано об'єкт транзакції, використовуємо його
        for winner in winners:
            saved_winner = save_winner(winner, transaction)
            if saved_winner:
                saved_winners.append(saved_winner)
    else:
        # Якщо транзакцію не передано, створюємо нову
        try:
            with execute_transaction() as txn:
                for winner in winners:
                    saved_winner = save_winner(winner, txn)
                    if saved_winner:
                        saved_winners.append(saved_winner)
        except Exception as e:
            logger.error(f"save_winners_and_reward: Помилка збереження переможців: {str(e)}")
            raise e

    # Після успішного збереження перевіряємо і оновлюємо бейджі переможців
    for winner in winners:
        try:
            check_and_update_badges(winner.get("telegram_id"))
        except Exception as e:
            logger.warning(f"Помилка оновлення бейджів для {winner.get('telegram_id')}: {str(e)}")

    return saved_winners


@handle_exceptions
def check_and_finish_expired_raffles():
    """Перевірка та автоматичне завершення прострочених розіграшів"""
    # Отримуємо всі активні розіграші
    response = supabase.table("raffles").select("id, end_time").eq("status", "active").execute()

    if not response.data:
        logger.info("check_and_finish_expired_raffles: Немає активних розіграшів")
        return {"status": "success", "message": "Немає активних розіграшів", "finished_count": 0}

    # Поточний час
    now = datetime.now(timezone.utc)
    finished_count = 0
    finished_raffles = []

    # Перевіряємо кожен розіграш
    for raffle in response.data:
        try:
            end_time = datetime.fromisoformat(raffle.get("end_time").replace('Z', '+00:00'))

            # Якщо розіграш завершився, завершуємо його
            if now >= end_time:
                raffle_id = raffle.get("id")
                logger.info(f"check_and_finish_expired_raffles: Автоматичне завершення розіграшу {raffle_id}")

                try:
                    result = finish_raffle(raffle_id)

                    if isinstance(result, tuple):
                        result_json, status_code = result
                        if status_code == 200:
                            finished_count += 1
                            finished_raffles.append(raffle_id)
                    else:
                        # Якщо результат не tuple, це означає, що функція повернула лише JSON
                        if result.get("status") == "success":
                            finished_count += 1
                            finished_raffles.append(raffle_id)
                except Exception as e:
                    logger.error(f"Помилка завершення розіграшу {raffle_id}: {str(e)}")
        except Exception as e:
            logger.error(f"check_and_finish_expired_raffles: Помилка обробки розіграшу: {str(e)}")
            continue

    # Логуємо результати
    if finished_count > 0:
        logger.info(f"check_and_finish_expired_raffles: Завершено {finished_count} розіграшів: {finished_raffles}")

    return {
        "status": "success",
        "message": f"Перевірено {len(response.data)} розіграшів, завершено {finished_count}",
        "finished_count": finished_count,
        "finished_raffles": finished_raffles
    }


@handle_exceptions
def get_all_raffles(status_filter=None, admin_id=None):
    """Отримання всіх розіграшів (для адміністраторів)"""
    # Перевірка адміністратора
    if admin_id and not _is_admin(admin_id):
        raise UnauthorizedAccessError("Доступ заборонено. Ви не є адміністратором.")

    # Отримуємо параметри пагінації
    limit = min(int(request.args.get('limit', 20)), MAX_RESULTS_PER_PAGE)
    offset = int(request.args.get('offset', 0))

    # Формуємо запит
    query = supabase.table("raffles").select("*")

    # Додаємо фільтр за статусом, якщо він вказаний
    if status_filter in ["active", "completed", "cancelled"]:
        query = query.eq("status", status_filter)

    # Сортуємо за часом створення (від найновіших до найстаріших)
    query = query.order("created_at", desc=True).limit(limit).offset(offset)

    # Виконуємо запит
    response = query.execute()

    if not response.data:
        return jsonify({"status": "success", "data": []})

    # Форматуємо дані для відповіді
    raffles_data = []
    for raffle in response.data:
        # Безпечно конвертуємо часові мітки
        try:
            start_time_ms = int(
                datetime.fromisoformat(raffle.get("start_time", "").replace('Z', '+00:00')).timestamp() * 1000)
            end_time_ms = int(
                datetime.fromisoformat(raffle.get("end_time", "").replace('Z', '+00:00')).timestamp() * 1000)
            created_at_ms = int(
                datetime.fromisoformat(raffle.get("created_at", "").replace('Z', '+00:00')).timestamp() * 1000)
        except (ValueError, AttributeError):
            logger.warning(f"Помилка конвертації часу для розіграшу {raffle.get('id')}")
            start_time_ms = 0
            end_time_ms = 0
            created_at_ms = 0

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
            "prize_distribution": raffle.get("prize_distribution", {}),
            "created_at": created_at_ms,
            "created_by": raffle.get("created_by", "")
        }

        raffles_data.append(raffle_info)

    # Отримуємо загальну кількість розіграшів для пагінації
    count_query = supabase.table("raffles").select("count", count="exact")
    if status_filter in ["active", "completed", "cancelled"]:
        count_query = count_query.eq("status", status_filter)

    count_response = count_query.execute()
    total_count = count_response.count if hasattr(count_response, 'count') else len(raffles_data)

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
def get_raffle_participants(raffle_id, admin_id=None):
    """Отримання списку учасників розіграшу (для адміністраторів)"""
    # Перевірка адміністратора
    if admin_id and not _is_admin(admin_id):
        raise UnauthorizedAccessError("Доступ заборонено. Ви не є адміністратором.")

    # Перевіряємо валідність ID розіграшу
    if not raffle_id:
        raise ValueError("Не вказано ID розіграшу")

    # Отримуємо розіграш
    raffle_response = supabase.table("raffles").select("*").eq("id", raffle_id).execute()

    if not raffle_response.data:
        raise RaffleNotFoundException(f"Розіграш з ID {raffle_id} не знайдено")

    # Отримуємо параметри пагінації
    limit = min(int(request.args.get('limit', 50)), MAX_RESULTS_PER_PAGE)
    offset = int(request.args.get('offset', 0))

    # Отримуємо учасників розіграшу з пагінацією
    participants_response = supabase.table("raffle_participants").select("*").eq("raffle_id", raffle_id).limit(
        limit).offset(offset).execute()

    if not participants_response.data:
        return jsonify({
            "status": "success",
            "data": {
                "raffle": raffle_response.data[0],
                "participants": []
            },
            "pagination": {
                "total": 0,
                "limit": limit,
                "offset": offset
            }
        })

    # Отримуємо ID користувачів для оптимізованого запиту
    user_ids = [p.get("telegram_id") for p in participants_response.data if p.get("telegram_id")]

    # Отримуємо дані користувачів одним запитом
    users_response = supabase.table("winix").select("telegram_id,username").in_("telegram_id", user_ids).execute()

    # Створюємо словник користувачів за id для швидкого доступу
    users_by_id = {u.get("telegram_id"): u for u in users_response.data if u.get("telegram_id")}

    # Форматуємо дані для відповіді
    participants_data = []
    for participant in participants_response.data:
        telegram_id = participant.get("telegram_id")

        # Отримуємо дані користувача з кешу
        user_data = users_by_id.get(telegram_id, {})
        username = user_data.get("username", "Unknown User")

        # Форматуємо дані учасника
        participant_info = {
            "id": participant.get("id"),
            "telegram_id": telegram_id,
            "username": username,
            "entry_time": participant.get("entry_time"),
            "entry_count": participant.get("entry_count", 1),
            "is_winner": participant.get("is_winner", False),
            "status": participant.get("status", "active")
        }

        participants_data.append(participant_info)

    # Сортуємо учасників за кількістю жетонів (від більшої до меншої)
    participants_data.sort(key=lambda x: x["entry_count"], reverse=True)

    # Отримуємо загальну кількість учасників для пагінації
    count_response = supabase.table("raffle_participants").select("count", count="exact").eq("raffle_id",
                                                                                             raffle_id).execute()
    total_count = count_response.count if hasattr(count_response, 'count') else len(participants_data)

    return jsonify({
        "status": "success",
        "data": {
            "raffle": raffle_response.data[0],
            "participants": participants_data
        },
        "pagination": {
            "total": total_count,
            "limit": limit,
            "offset": offset
        }
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


def _is_admin(admin_id):
    """Перевірка, чи користувач є адміністратором"""
    if not admin_id:
        return False

    # Отримуємо список адміністраторів з середовища
    admin_ids = os.getenv("ADMIN_IDS", "").split(",")
    return str(admin_id) in admin_ids