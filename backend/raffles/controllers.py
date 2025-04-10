from flask import jsonify, request
import logging
import os
import sys
import uuid
from datetime import datetime, timezone, timedelta
import random

# Додаємо кореневу папку бекенду до шляху Python для імпортів
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
if parent_dir not in sys.path:
    sys.path.append(parent_dir)

# Імпортуємо з supabase_client
from supabase_client import (
    get_user, update_user, update_balance, update_coins,
    supabase, check_and_update_badges
)

# Імпортуємо допоміжні функції для транзакцій
from utils.transaction_helpers import create_transaction_record, update_transaction_status

# Налаштування логування
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


def get_active_raffles():
    """Отримання списку активних розіграшів"""
    try:
        # Отримуємо всі активні розіграші з бази даних
        response = supabase.table("raffles").select("*").eq("status", "active").order("is_daily", desc=True).order(
            "end_time", asc=True).execute()

        if not response.data:
            # Якщо даних немає, повертаємо порожній список
            return jsonify({"status": "success", "data": []})

        # Форматуємо дані для відповіді
        raffles_data = []
        for raffle in response.data:
            # Перетворюємо час в мілісекунди для фронтенду
            start_time_ms = int(
                datetime.fromisoformat(raffle.get("start_time").replace('Z', '+00:00')).timestamp() * 1000)
            end_time_ms = int(datetime.fromisoformat(raffle.get("end_time").replace('Z', '+00:00')).timestamp() * 1000)

            # Форматуємо дані розіграшу
            raffle_info = {
                "id": raffle.get("id"),
                "title": raffle.get("title"),
                "description": raffle.get("description"),
                "entry_fee": raffle.get("entry_fee"),
                "prize_amount": raffle.get("prize_amount"),
                "prize_currency": raffle.get("prize_currency"),
                "start_time": start_time_ms,
                "end_time": end_time_ms,
                "participants_count": raffle.get("participants_count", 0),
                "winners_count": raffle.get("winners_count"),
                "status": raffle.get("status"),
                "is_daily": raffle.get("is_daily"),
                "image_url": raffle.get("image_url"),
                "prize_distribution": raffle.get("prize_distribution")
            }

            raffles_data.append(raffle_info)

        return jsonify({"status": "success", "data": raffles_data})
    except Exception as e:
        logger.error(f"get_active_raffles: Помилка отримання активних розіграшів: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500


def get_raffle_details(raffle_id):
    """Отримання деталей конкретного розіграшу"""
    try:
        # Перевіряємо валідність ID розіграшу
        if not raffle_id:
            return jsonify({"status": "error", "message": "Не вказано ID розіграшу"}), 400

        # Отримуємо дані розіграшу
        response = supabase.table("raffles").select("*").eq("id", raffle_id).execute()

        if not response.data:
            return jsonify({"status": "error", "message": f"Розіграш з ID {raffle_id} не знайдено"}), 404

        raffle = response.data[0]

        # Перетворюємо час в мілісекунди для фронтенду
        start_time_ms = int(datetime.fromisoformat(raffle.get("start_time").replace('Z', '+00:00')).timestamp() * 1000)
        end_time_ms = int(datetime.fromisoformat(raffle.get("end_time").replace('Z', '+00:00')).timestamp() * 1000)

        # Форматуємо дані розіграшу
        raffle_details = {
            "id": raffle.get("id"),
            "title": raffle.get("title"),
            "description": raffle.get("description"),
            "entry_fee": raffle.get("entry_fee"),
            "prize_amount": raffle.get("prize_amount"),
            "prize_currency": raffle.get("prize_currency"),
            "start_time": start_time_ms,
            "end_time": end_time_ms,
            "participants_count": raffle.get("participants_count", 0),
            "winners_count": raffle.get("winners_count"),
            "status": raffle.get("status"),
            "is_daily": raffle.get("is_daily"),
            "image_url": raffle.get("image_url"),
            "prize_distribution": raffle.get("prize_distribution"),
            "time_left": max(0, end_time_ms - int(datetime.now(timezone.utc).timestamp() * 1000))
        }

        # Отримуємо переможців розіграшу, якщо він завершений
        if raffle.get("status") == "completed":
            winners_response = supabase.table("raffle_winners").select("*").eq("raffle_id", raffle_id).order("place",
                                                                                                             asc=True).execute()

            if winners_response.data:
                winners = []
                for winner in winners_response.data:
                    # Отримуємо дані користувача
                    user = get_user(winner.get("telegram_id"))
                    username = user.get("username", "User") if user else "Unknown User"

                    winners.append({
                        "telegram_id": winner.get("telegram_id"),
                        "username": username,
                        "place": winner.get("place"),
                        "prize_amount": winner.get("prize_amount"),
                        "prize_currency": winner.get("prize_currency")
                    })

                raffle_details["winners"] = winners

        return jsonify({"status": "success", "data": raffle_details})
    except Exception as e:
        logger.error(f"get_raffle_details: Помилка отримання деталей розіграшу {raffle_id}: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500


def participate_in_raffle(telegram_id, data):
    """Участь у розіграші"""
    try:
        # Перевірка необхідних даних
        if not data or "raffle_id" not in data:
            return jsonify({"status": "error", "message": "Не вказано ID розіграшу"}), 400

        raffle_id = data["raffle_id"]
        entry_count = int(data.get("entry_count", 1))

        # Перевіряємо кількість жетонів
        if entry_count <= 0:
            return jsonify({"status": "error", "message": "Кількість жетонів має бути більше нуля"}), 400

        # Отримуємо користувача
        user = get_user(telegram_id)
        if not user:
            return jsonify({"status": "error", "message": "Користувача не знайдено"}), 404

        # Отримуємо розіграш
        raffle_response = supabase.table("raffles").select("*").eq("id", raffle_id).execute()
        if not raffle_response.data:
            return jsonify({"status": "error", "message": f"Розіграш з ID {raffle_id} не знайдено"}), 404

        raffle = raffle_response.data[0]

        # Перевіряємо статус розіграшу
        if raffle.get("status") != "active":
            return jsonify({"status": "error", "message": "Розіграш не є активним"}), 400

        # Перевіряємо час розіграшу
        now = datetime.now(timezone.utc)
        end_time = datetime.fromisoformat(raffle.get("end_time").replace('Z', '+00:00'))

        if now >= end_time:
            return jsonify({"status": "error", "message": "Розіграш вже завершено"}), 400

        # Розраховуємо необхідну кількість жетонів
        required_coins = entry_count * raffle.get("entry_fee", 1)

        # Перевіряємо, чи достатньо жетонів
        user_coins = int(user.get("coins", 0))
        if user_coins < required_coins:
            return jsonify({"status": "error",
                            "message": f"Недостатньо жетонів. Потрібно: {required_coins}, наявно: {user_coins}"}), 400

        # Перевіряємо, чи користувач вже бере участь у розіграші
        participation_response = supabase.table("raffle_participants").select("*").eq("raffle_id", raffle_id).eq(
            "telegram_id", telegram_id).execute()

        if participation_response.data:
            # Користувач вже бере участь, оновлюємо кількість жетонів
            existing_entry = participation_response.data[0]
            new_entry_count = existing_entry.get("entry_count", 0) + entry_count

            # Оновлюємо запис
            supabase.table("raffle_participants").update({"entry_count": new_entry_count}).eq("id", existing_entry.get(
                "id")).execute()
        else:
            # Додаємо нового учасника
            participation_data = {
                "raffle_id": raffle_id,
                "telegram_id": telegram_id,
                "entry_time": now.isoformat(),
                "entry_count": entry_count,
                "status": "pending"
            }

            supabase.table("raffle_participants").insert(participation_data).execute()

        # Оновлюємо баланс жетонів користувача
        new_coins_balance = user_coins - required_coins
        update_user(telegram_id, {"coins": new_coins_balance})

        # Оновлюємо лічильник участей користувача
        participations_count = user.get("participations_count", 0) + 1
        update_user(telegram_id, {"participations_count": participations_count})

        # Створюємо транзакцію для списання жетонів
        transaction_data = {
            "telegram_id": telegram_id,
            "type": "fee",
            "amount": -required_coins,
            "description": f"Участь у розіграші '{raffle.get('title')}'",
            "status": "completed",
            "raffle_id": raffle_id
        }

        supabase.table("transactions").insert(transaction_data).execute()

        # Перевіряємо, чи користувач досяг 5 участей для бейджа початківця
        if participations_count >= 5:
            check_and_update_badges(telegram_id)

        # Формуємо відповідь
        response_data = {
            "message": "Ви успішно взяли участь у розіграші",
            "entry_count": entry_count,
            "total_entries": participation_response.data[0].get("entry_count",
                                                                0) + entry_count if participation_response.data else entry_count,
            "new_coins_balance": new_coins_balance,
            "participations_count": participations_count,
            "raffle_type": "daily" if raffle.get("is_daily") else "main"
        }

        # Додаємо дані про бонус (якщо це перша участь)
        if participations_count == 1:
            bonus_amount = 50  # Бонус за першу участь
            update_balance(telegram_id, bonus_amount)

            # Додаємо транзакцію для бонусу
            bonus_transaction = {
                "telegram_id": telegram_id,
                "type": "reward",
                "amount": bonus_amount,
                "description": "Бонус за першу участь у розіграші",
                "status": "completed"
            }

            supabase.table("transactions").insert(bonus_transaction).execute()

            response_data["bonus_amount"] = bonus_amount
            response_data["new_balance"] = float(user.get("balance", 0)) + bonus_amount

        return jsonify({"status": "success", "data": response_data})
    except Exception as e:
        logger.error(f"participate_in_raffle: Помилка участі в розіграші для {telegram_id}: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500


def get_user_raffles(telegram_id):
    """Отримання розіграшів, у яких бере участь користувач"""
    try:
        # Перевіряємо, чи користувач існує
        user = get_user(telegram_id)
        if not user:
            return jsonify({"status": "error", "message": "Користувача не знайдено"}), 404

        # Отримуємо всі активні участі користувача
        participants_response = supabase.table("raffle_participants").select("*").eq("telegram_id",
                                                                                     telegram_id).execute()

        if not participants_response.data:
            return jsonify({"status": "success", "data": []})

        # Отримуємо ID розіграшів, у яких бере участь користувач
        raffle_ids = [p.get("raffle_id") for p in participants_response.data]

        # Отримуємо дані цих розіграшів
        raffles_response = supabase.table("raffles").select("*").in_("id", raffle_ids).execute()

        if not raffles_response.data:
            return jsonify({"status": "success", "data": []})

        # Формуємо дані для відповіді
        user_raffles = []
        for raffle in raffles_response.data:
            # Знаходимо відповідні участі
            participations = [p for p in participants_response.data if p.get("raffle_id") == raffle.get("id")]

            # Перетворюємо час в мілісекунди для фронтенду
            end_time_ms = int(datetime.fromisoformat(raffle.get("end_time").replace('Z', '+00:00')).timestamp() * 1000)

            # Формуємо інформацію про участь
            for participation in participations:
                entry_time_ms = int(
                    datetime.fromisoformat(participation.get("entry_time").replace('Z', '+00:00')).timestamp() * 1000)

                user_raffle = {
                    "raffle_id": raffle.get("id"),
                    "title": raffle.get("title"),
                    "entry_fee": raffle.get("entry_fee"),
                    "prize_amount": raffle.get("prize_amount"),
                    "prize_currency": raffle.get("prize_currency"),
                    "participation_time": entry_time_ms,
                    "entry_count": participation.get("entry_count", 1),
                    "status": raffle.get("status"),
                    "end_time": end_time_ms,
                    "is_daily": raffle.get("is_daily")
                }

                user_raffles.append(user_raffle)

        return jsonify({"status": "success", "data": user_raffles})
    except Exception as e:
        logger.error(f"get_user_raffles: Помилка отримання розіграшів користувача {telegram_id}: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500


def get_user_raffles_history(telegram_id):
    """Отримання історії участі користувача в розіграшах"""
    try:
        # Перевіряємо, чи користувач існує
        user = get_user(telegram_id)
        if not user:
            return jsonify({"status": "error", "message": "Користувача не знайдено"}), 404

        # Отримуємо всі участі користувача
        participants_response = supabase.table("raffle_participants").select("*").eq("telegram_id",
                                                                                     telegram_id).execute()

        if not participants_response.data:
            return jsonify({"status": "success", "data": []})

        # Отримуємо ID розіграшів, у яких брав участь користувач
        raffle_ids = [p.get("raffle_id") for p in participants_response.data]

        # Отримуємо дані цих розіграшів
        raffles_response = supabase.table("raffles").select("*").in_("id", raffle_ids).execute()

        if not raffles_response.data:
            return jsonify({"status": "success", "data": []})

        # Отримуємо дані про переможців
        winners_response = supabase.table("raffle_winners").select("*").eq("telegram_id", telegram_id).execute()
        winners_data = {w.get("raffle_id"): w for w in winners_response.data} if winners_response.data else {}

        # Формуємо дані для відповіді
        history = []
        for raffle in raffles_response.data:
            raffle_id = raffle.get("id")

            # Знаходимо відповідну участь
            participation = next((p for p in participants_response.data if p.get("raffle_id") == raffle_id), None)

            if not participation:
                continue

            # Визначаємо, чи користувач переміг
            is_winner = raffle_id in winners_data
            status = "won" if is_winner else "participated"

            # Отримуємо дату завершення розіграшу
            end_time = datetime.fromisoformat(raffle.get("end_time").replace('Z', '+00:00'))
            formatted_date = end_time.strftime("%d.%m.%Y")

            # Формуємо інформацію про результат
            if is_winner:
                winner_data = winners_data[raffle_id]
                result = f"Ви виграли {winner_data.get('prize_amount')} {winner_data.get('prize_currency', 'WINIX')}"
                place = winner_data.get("place")
            else:
                result = "Ви брали участь, але не виграли"
                place = None

            # Формуємо запис історії
            history_entry = {
                "raffle_id": raffle_id,
                "date": formatted_date,
                "prize": f"{raffle.get('prize_amount')} {raffle.get('prize_currency', 'WINIX')}",
                "result": result,
                "status": status,
                "entry_count": participation.get("entry_count", 1),
                "title": raffle.get("title"),
                "is_daily": raffle.get("is_daily")
            }

            # Додаємо дані про переможців, якщо розіграш завершено
            if raffle.get("status") == "completed":
                # Отримуємо всіх переможців
                all_winners_response = supabase.table("raffle_winners").select("*").eq("raffle_id", raffle_id).order(
                    "place", asc=True).execute()

                if all_winners_response.data:
                    winners = []
                    for winner in all_winners_response.data:
                        # Отримуємо дані користувача
                        winner_user = get_user(winner.get("telegram_id"))
                        username = winner_user.get("username", "User") if winner_user else "Unknown User"

                        winners.append({
                            "userId": winner.get("telegram_id"),
                            "username": username,
                            "place": winner.get("place"),
                            "prize": f"{winner.get('prize_amount')} {winner.get('prize_currency', 'WINIX')}",
                            "isCurrentUser": winner.get("telegram_id") == telegram_id
                        })

                    history_entry["winners"] = winners

            history.append(history_entry)

        # Сортуємо за датою (від найновіших до найстаріших)
        history.sort(key=lambda x: x["date"], reverse=True)

        return jsonify({"status": "success", "data": history})
    except Exception as e:
        logger.error(
            f"get_user_raffles_history: Помилка отримання історії розіграшів користувача {telegram_id}: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500


def create_raffle(data, admin_id):
    """Створення нового розіграшу (для адміністраторів)"""
    try:
        # Перевірка необхідних полів
        required_fields = ["title", "prize_amount", "prize_currency", "entry_fee", "start_time", "end_time",
                           "winners_count"]
        missing_fields = [field for field in required_fields if field not in data]

        if missing_fields:
            return jsonify({
                "status": "error",
                "message": f"Відсутні обов'язкові поля: {', '.join(missing_fields)}"
            }), 400

        # Перевіряємо часові мітки
        try:
            start_time = datetime.fromisoformat(data["start_time"].replace('Z', '+00:00'))
            end_time = datetime.fromisoformat(data["end_time"].replace('Z', '+00:00'))
        except (ValueError, TypeError):
            return jsonify({"status": "error", "message": "Некоректний формат часу. Використовуйте ISO 8601."}), 400

        if start_time >= end_time:
            return jsonify({"status": "error", "message": "Час початку має бути раніше часу завершення"}), 400

        # Перевіряємо, чи є це щоденний розіграш
        is_daily = data.get("is_daily", False)

        # Якщо це щоденний розіграш, перевіряємо, чи немає інших активних щоденних розіграшів
        if is_daily:
            daily_raffles_response = supabase.table("raffles").select("id").eq("is_daily", True).eq("status",
                                                                                                    "active").execute()

            if daily_raffles_response.data:
                return jsonify({
                    "status": "error",
                    "message": "Вже існує активний щоденний розіграш. Завершіть його перед створенням нового."
                }), 400

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
            "image_url": data.get("image_url"),
            "prize_distribution": data.get("prize_distribution"),
            "created_by": admin_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }

        # Створюємо розіграш
        response = supabase.table("raffles").insert(raffle_data).execute()

        if not response.data:
            return jsonify({"status": "error", "message": "Помилка створення розіграшу"}), 500

        # Отримуємо створений розіграш
        created_raffle = response.data[0]

        return jsonify({
            "status": "success",
            "message": "Розіграш успішно створено",
            "data": created_raffle
        })
    except Exception as e:
        logger.error(f"create_raffle: Помилка створення розіграшу: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500


def update_raffle(raffle_id, data, admin_id):
    """Оновлення розіграшу (для адміністраторів)"""
    try:
        # Перевіряємо валідність ID розіграшу
        if not raffle_id:
            return jsonify({"status": "error", "message": "Не вказано ID розіграшу"}), 400

        # Отримуємо розіграш
        raffle_response = supabase.table("raffles").select("*").eq("id", raffle_id).execute()

        if not raffle_response.data:
            return jsonify({"status": "error", "message": f"Розіграш з ID {raffle_id} не знайдено"}), 404

        raffle = raffle_response.data[0]

        # Перевіряємо, чи розіграш активний
        if raffle.get("status") != "active":
            return jsonify({
                "status": "error",
                "message": "Можна оновлювати лише активні розіграші"
            }), 400

        # Перевіряємо часові мітки, якщо вони оновлюються
        if "start_time" in data or "end_time" in data:
            start_time = datetime.fromisoformat(
                data.get("start_time", raffle.get("start_time")).replace('Z', '+00:00')
            )
            end_time = datetime.fromisoformat(
                data.get("end_time", raffle.get("end_time")).replace('Z', '+00:00')
            )

            if start_time >= end_time:
                return jsonify({
                    "status": "error",
                    "message": "Час початку має бути раніше часу завершення"
                }), 400

        # Перевіряємо, чи оновлюється статус щоденного розіграшу
        if "is_daily" in data and data["is_daily"] and not raffle.get("is_daily"):
            daily_raffles_response = supabase.table("raffles").select("id").eq("is_daily", True).eq("status",
                                                                                                    "active").execute()

            if daily_raffles_response.data:
                return jsonify({
                    "status": "error",
                    "message": "Вже існує активний щоденний розіграш. Завершіть його перед створенням нового."
                }), 400

        # Формуємо дані для оновлення
        update_data = {}
        updatable_fields = ["title", "description", "prize_amount", "prize_currency", "entry_fee",
                            "start_time", "end_time", "max_entries", "winners_count", "status",
                            "is_daily", "image_url", "prize_distribution"]

        for field in updatable_fields:
            if field in data:
                update_data[field] = data[field]

        # Додаємо час оновлення
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()

        # Оновлюємо розіграш
        response = supabase.table("raffles").update(update_data).eq("id", raffle_id).execute()

        if not response.data:
            return jsonify({"status": "error", "message": "Помилка оновлення розіграшу"}), 500

        # Отримуємо оновлений розіграш
        updated_raffle = response.data[0]

        return jsonify({
            "status": "success",
            "message": "Розіграш успішно оновлено",
            "data": updated_raffle
        })
    except Exception as e:
        logger.error(f"update_raffle: Помилка оновлення розіграшу {raffle_id}: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500


def delete_raffle(raffle_id, admin_id):
    """Видалення розіграшу (для адміністраторів)"""
    try:
        # Перевіряємо валідність ID розіграшу
        if not raffle_id:
            return jsonify({"status": "error", "message": "Не вказано ID розіграшу"}), 400

        # Отримуємо розіграш
        raffle_response = supabase.table("raffles").select("*").eq("id", raffle_id).execute()

        if not raffle_response.data:
            return jsonify({"status": "error", "message": f"Розіграш з ID {raffle_id} не знайдено"}), 404

        # Перевіряємо, чи розіграш активний
        raffle = raffle_response.data[0]
        if raffle.get("status") != "active":
            return jsonify({
                "status": "error",
                "message": "Можна видаляти лише активні розіграші"
            }), 400

        # Перевіряємо, чи є учасники розіграшу
        participants_response = supabase.table("raffle_participants").select("id").eq("raffle_id", raffle_id).execute()

        if participants_response.data:
            # Якщо є учасники, переводимо розіграш в статус "cancelled"
            update_response = supabase.table("raffles").update({
                "status": "cancelled",
                "updated_at": datetime.now(timezone.utc).isoformat()
            }).eq("id", raffle_id).execute()

            # Повертаємо жетони учасникам
            for participant in participants_response.data:
                refund_participant(participant.get("id"))

            return jsonify({
                "status": "success",
                "message": "Розіграш скасовано. Жетони повернуто учасникам."
            })
        else:
            # Якщо учасників немає, видаляємо розіграш
            delete_response = supabase.table("raffles").delete().eq("id", raffle_id).execute()

            return jsonify({
                "status": "success",
                "message": "Розіграш успішно видалено"
            })
    except Exception as e:
        logger.error(f"delete_raffle: Помилка видалення розіграшу {raffle_id}: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500


def refund_participant(participant_id):
    """Повернення жетонів учаснику при скасуванні розіграшу"""
    try:
        # Отримуємо дані учасника
        participant_response = supabase.table("raffle_participants").select("*").eq("id", participant_id).execute()

        if not participant_response.data:
            logger.error(f"refund_participant: Учасника з ID {participant_id} не знайдено")
            return False

        participant = participant_response.data[0]
        telegram_id = participant.get("telegram_id")
        entry_count = participant.get("entry_count", 1)
        raffle_id = participant.get("raffle_id")

        # Отримуємо дані розіграшу
        raffle_response = supabase.table("raffles").select("entry_fee, title").eq("id", raffle_id).execute()

        if not raffle_response.data:
            logger.error(f"refund_participant: Розіграш з ID {raffle_id} не знайдено")
            return False

        raffle = raffle_response.data[0]
        entry_fee = raffle.get("entry_fee", 1)
        raffle_title = raffle.get("title", "Розіграш")

        # Розраховуємо суму повернення
        refund_amount = entry_count * entry_fee

        # Отримуємо користувача
        user = get_user(telegram_id)
        if not user:
            logger.error(f"refund_participant: Користувача {telegram_id} не знайдено")
            return False

        # Оновлюємо баланс жетонів
        current_coins = int(user.get("coins", 0))
        new_coins = current_coins + refund_amount

        update_user(telegram_id, {"coins": new_coins})

        # Створюємо транзакцію для повернення жетонів
        transaction_data = {
            "telegram_id": telegram_id,
            "type": "refund",
            "amount": refund_amount,
            "description": f"Повернення жетонів за скасований розіграш '{raffle_title}'",
            "status": "completed",
            "raffle_id": raffle_id
        }

        supabase.table("transactions").insert(transaction_data).execute()

        # Оновлюємо статус участі
        supabase.table("raffle_participants").update({
            "status": "refunded"
        }).eq("id", participant_id).execute()

        return True
    except Exception as e:
        logger.error(f"refund_participant: Помилка повернення жетонів учаснику {participant_id}: {str(e)}")
        return False


def finish_raffle(raffle_id, admin_id=None):
    """Завершення розіграшу і визначення переможців"""
    try:
        # Перевіряємо валідність ID розіграшу
        if not raffle_id:
            return jsonify({"status": "error", "message": "Не вказано ID розіграшу"}), 400

        # Отримуємо розіграш
        raffle_response = supabase.table("raffles").select("*").eq("id", raffle_id).execute()

        if not raffle_response.data:
            return jsonify({"status": "error", "message": f"Розіграш з ID {raffle_id} не знайдено"}), 404

        raffle = raffle_response.data[0]

        # Перевіряємо, чи розіграш активний
        if raffle.get("status") != "active":
            return jsonify({
                "status": "error",
                "message": "Розіграш вже завершено або скасовано"
            }), 400

        # Отримуємо учасників розіграшу
        participants_response = supabase.table("raffle_participants").select("*").eq("raffle_id", raffle_id).execute()

        if not participants_response.data:
            return jsonify({
                "status": "error",
                "message": "Розіграш не має учасників"
            }), 400

        # Підготовка даних для визначення переможців
        participants = participants_response.data
        winners_count = min(raffle.get("winners_count", 1), len(participants))

        # Визначаємо переможців за допомогою алгоритму
        winners = determine_winners(participants, winners_count)

        # Оновлюємо статус розіграшу
        supabase.table("raffles").update({
            "status": "completed",
            "updated_at": datetime.now(timezone.utc).isoformat()
        }).eq("id", raffle_id).execute()

        # Зберігаємо переможців і нараховуємо їм виграші
        total_winners_saved = save_winners_and_reward(winners, raffle)

        # Оновлюємо статус всіх учасників
        for participant in participants:
            participant_id = participant.get("id")
            telegram_id = participant.get("telegram_id")
            is_winner = any(w.get("telegram_id") == telegram_id for w in winners)

            if is_winner:
                status = "completed"
            else:
                status = "completed"  # або можна використовувати "lost"

            supabase.table("raffle_participants").update({
                "status": status,
                "is_winner": is_winner
            }).eq("id", participant_id).execute()

        return jsonify({
            "status": "success",
            "message": f"Розіграш успішно завершено. Визначено {total_winners_saved} переможців.",
            "data": {
                "raffle_id": raffle_id,
                "winners_count": winners_count,
                "winners": [
                    {
                        "telegram_id": w.get("telegram_id"),
                        "place": w.get("place"),
                        "prize_amount": w.get("prize_amount"),
                        "prize_currency": w.get("prize_currency", raffle.get("prize_currency"))
                    } for w in winners
                ]
            }
        })
    except Exception as e:
        logger.error(f"finish_raffle: Помилка завершення розіграшу {raffle_id}: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500


def determine_winners(participants, winners_count):
    """Алгоритм визначення переможців розіграшу"""
    # Створюємо пули учасників з вагами, відповідно до кількості жетонів
    weighted_participants = []

    for participant in participants:
        telegram_id = participant.get("telegram_id")
        entry_count = participant.get("entry_count", 1)

        # Додаємо учасника в пул стільки разів, скільки в нього жетонів
        for _ in range(entry_count):
            weighted_participants.append(participant)

    # Перемішуємо пул для випадковості
    random.shuffle(weighted_participants)

    # Визначаємо переможців
    winners = []
    winner_ids = set()  # Для уникнення дублікатів

    if weighted_participants:
        # Створюємо копію щоб не змінювати оригінал під час ітерації
        pool = weighted_participants.copy()

        for place in range(1, winners_count + 1):
            if not pool:
                break

            # Вибираємо випадкового переможця з пулу
            winner = random.choice(pool)
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
            pool = [p for p in pool if p.get("telegram_id") != telegram_id]

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

    if total_distributed != prize_amount:
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


def save_winners_and_reward(winners, raffle):
    """Збереження переможців і нарахування їм виграшів"""
    raffle_id = raffle.get("id")
    winners_count = len(winners)
    prize_distribution = calculate_prize_distribution(raffle)
    prize_currency = raffle.get("prize_currency", "WINIX")

    total_winners_saved = 0

    for winner in winners:
        place = winner.get("place")
        telegram_id = winner.get("telegram_id")

        # Отримуємо суму призу для цього місця
        place_str = str(place)
        if place_str in prize_distribution:
            prize_data = prize_distribution[place_str]
            prize_amount = float(prize_data.get("amount", 0))
            currency = prize_data.get("currency", prize_currency)
        else:
            # Якщо розподіл не визначено для цього місця, пропускаємо
            continue

        # Зберігаємо дані переможця
        winner_data = {
            "raffle_id": raffle_id,
            "telegram_id": telegram_id,
            "place": place,
            "prize_amount": prize_amount,
            "prize_currency": currency,
            "win_time": datetime.now(timezone.utc).isoformat(),
            "notification_sent": False,
            "reward_claimed": False
        }

        winner_response = supabase.table("raffle_winners").insert(winner_data).execute()

        if winner_response.data:
            total_winners_saved += 1

            # Нараховуємо виграш користувачу
            if currency.upper() == "WINIX":
                # Оновлюємо баланс WINIX
                user = get_user(telegram_id)
                if user:
                    # Нараховуємо виграш
                    update_balance(telegram_id, prize_amount)

                    # Створюємо транзакцію
                    transaction_data = {
                        "telegram_id": telegram_id,
                        "type": "reward",
                        "amount": prize_amount,
                        "description": f"Виграш у розіграші '{raffle.get('title')}' (місце {place})",
                        "status": "completed",
                        "raffle_id": raffle_id
                    }

                    supabase.table("transactions").insert(transaction_data).execute()

                    # Оновлюємо статус виграшу
                    supabase.table("raffle_winners").update({
                        "reward_claimed": True
                    }).eq("raffle_id", raffle_id).eq("telegram_id", telegram_id).execute()

                    # Оновлюємо лічильник виграшів і перевіряємо бейдж переможця
                    wins_count = user.get("wins_count", 0) + 1
                    update_user(telegram_id, {"wins_count": wins_count})

                    # Перевіряємо бейдж переможця
                    check_and_update_badges(telegram_id)

    return total_winners_saved


def check_and_finish_expired_raffles():
    """Перевірка та автоматичне завершення прострочених розіграшів"""
    try:
        # Отримуємо всі активні розіграші
        response = supabase.table("raffles").select("id, end_time").eq("status", "active").execute()

        if not response.data:
            logger.info("check_and_finish_expired_raffles: Немає активних розіграшів")
            return {"status": "success", "message": "Немає активних розіграшів", "finished_count": 0}

        # Поточний час
        now = datetime.now(timezone.utc)
        finished_count = 0

        # Перевіряємо кожен розіграш
        for raffle in response.data:
            try:
                end_time = datetime.fromisoformat(raffle.get("end_time").replace('Z', '+00:00'))

                # Якщо розіграш завершився, завершуємо його
                if now >= end_time:
                    raffle_id = raffle.get("id")
                    logger.info(f"check_and_finish_expired_raffles: Автоматичне завершення розіграшу {raffle_id}")

                    result = finish_raffle(raffle_id)

                    if isinstance(result, tuple):
                        result_json, status_code = result
                        if status_code == 200:
                            finished_count += 1
                    else:
                        # Якщо результат не tuple, це означає, що функція повернула лише JSON
                        if result.get("status") == "success":
                            finished_count += 1
            except Exception as e:
                logger.error(f"check_and_finish_expired_raffles: Помилка обробки розіграшу: {str(e)}")
                continue

        return {
            "status": "success",
            "message": f"Перевірено {len(response.data)} розіграшів, завершено {finished_count}",
            "finished_count": finished_count
        }
    except Exception as e:
        logger.error(f"check_and_finish_expired_raffles: Помилка перевірки розіграшів: {str(e)}")
        return {
            "status": "error",
            "message": str(e)
        }


def get_all_raffles(status_filter=None, admin_id=None):
    """Отримання всіх розіграшів (для адміністраторів)"""
    try:
        # Формуємо запит
        query = supabase.table("raffles").select("*")

        # Додаємо фільтр за статусом, якщо він вказаний
        if status_filter:
            query = query.eq("status", status_filter)

        # Сортуємо за часом створення (від найновіших до найстаріших)
        query = query.order("created_at", desc=True)

        # Виконуємо запит
        response = query.execute()

        if not response.data:
            return jsonify({"status": "success", "data": []})

        # Форматуємо дані для відповіді
        raffles_data = []
        for raffle in response.data:
            # Перетворюємо час в мілісекунди для фронтенду
            start_time_ms = int(
                datetime.fromisoformat(raffle.get("start_time").replace('Z', '+00:00')).timestamp() * 1000)
            end_time_ms = int(datetime.fromisoformat(raffle.get("end_time").replace('Z', '+00:00')).timestamp() * 1000)
            created_at_ms = int(
                datetime.fromisoformat(raffle.get("created_at").replace('Z', '+00:00')).timestamp() * 1000)

            # Форматуємо дані розіграшу
            raffle_info = {
                "id": raffle.get("id"),
                "title": raffle.get("title"),
                "description": raffle.get("description"),
                "entry_fee": raffle.get("entry_fee"),
                "prize_amount": raffle.get("prize_amount"),
                "prize_currency": raffle.get("prize_currency"),
                "start_time": start_time_ms,
                "end_time": end_time_ms,
                "participants_count": raffle.get("participants_count", 0),
                "winners_count": raffle.get("winners_count"),
                "status": raffle.get("status"),
                "is_daily": raffle.get("is_daily"),
                "image_url": raffle.get("image_url"),
                "prize_distribution": raffle.get("prize_distribution"),
                "created_at": created_at_ms,
                "created_by": raffle.get("created_by")
            }

            raffles_data.append(raffle_info)

        return jsonify({"status": "success", "data": raffles_data})
    except Exception as e:
        logger.error(f"get_all_raffles: Помилка отримання розіграшів: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500


def get_raffle_participants(raffle_id, admin_id=None):
    """Отримання списку учасників розіграшу (для адміністраторів)"""
    try:
        # Перевіряємо валідність ID розіграшу
        if not raffle_id:
            return jsonify({"status": "error", "message": "Не вказано ID розіграшу"}), 400

        # Отримуємо розіграш
        raffle_response = supabase.table("raffles").select("*").eq("id", raffle_id).execute()

        if not raffle_response.data:
            return jsonify({"status": "error", "message": f"Розіграш з ID {raffle_id} не знайдено"}), 404

        # Отримуємо учасників розіграшу
        participants_response = supabase.table("raffle_participants").select("*").eq("raffle_id", raffle_id).execute()

        if not participants_response.data:
            return jsonify({"status": "success", "data": {"raffle": raffle_response.data[0], "participants": []}})

        # Форматуємо дані для відповіді
        participants_data = []
        for participant in participants_response.data:
            telegram_id = participant.get("telegram_id")

            # Отримуємо дані користувача
            user = get_user(telegram_id)
            username = user.get("username", "Unknown User") if user else "Unknown User"

            # Форматуємо дані учасника
            participant_info = {
                "id": participant.get("id"),
                "telegram_id": telegram_id,
                "username": username,
                "entry_time": participant.get("entry_time"),
                "entry_count": participant.get("entry_count", 1),
                "is_winner": participant.get("is_winner", False),
                "status": participant.get("status")
            }

            participants_data.append(participant_info)

        # Сортуємо учасників за кількістю жетонів (від більшої до меншої)
        participants_data.sort(key=lambda x: x["entry_count"], reverse=True)

        return jsonify({
            "status": "success",
            "data": {
                "raffle": raffle_response.data[0],
                "participants": participants_data
            }
        })
    except Exception as e:
        logger.error(f"get_raffle_participants: Помилка отримання учасників розіграшу {raffle_id}: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500


def claim_newbie_bonus(telegram_id):
    """Отримання бонусу новачка"""
    try:
        # Отримуємо користувача
        user = get_user(telegram_id)

        if not user:
            return jsonify({
                'status': 'error',
                'message': 'Користувача не знайдено'
            }), 404

        if user.get('newbie_bonus_claimed', False):
            return jsonify({
                'status': 'already_claimed',
                'message': 'Бонус новачка вже було отримано'
            })

        bonus_amount = 150
        current_balance = float(user.get('balance', 0))
        new_balance = current_balance + bonus_amount

        try:
            updated_user = update_user(telegram_id, {
                'balance': new_balance,
                'newbie_bonus_claimed': True
            })

            if updated_user:
                # Додаємо транзакцію
                transaction_data = {
                    "telegram_id": telegram_id,
                    "type": "reward",
                    "amount": bonus_amount,
                    "description": "Бонус новачка",
                    "status": "completed"
                }

                supabase.table("transactions").insert(transaction_data).execute()

                return jsonify({
                    'status': 'success',
                    'message': f'Ви отримали {bonus_amount} WINIX як бонус новачка!',
                    'data': {
                        'amount': bonus_amount,
                        'newBalance': new_balance
                    }
                })
            else:
                return jsonify({
                    'status': 'error',
                    'message': 'Помилка нарахування бонусу'
                }), 500
        except Exception as e:
            logger.error(f"claim_newbie_bonus: Помилка оновлення даних: {str(e)}")
            return jsonify({
                'status': 'error',
                'message': str(e)
            }), 500

    except Exception as e:
        logger.error(f"claim_newbie_bonus: Помилка в /api/user/{telegram_id}/claim-newbie-bonus: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500