from flask import jsonify
import logging
import os
import sys
import uuid
from datetime import datetime

# Додаємо кореневу папку бекенду до шляху Python для імпортів
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
if parent_dir not in sys.path:
    sys.path.append(parent_dir)

# Імпортуємо з supabase_client без використання importlib
from supabase_client import get_user, update_user, update_balance, supabase, check_and_update_badges

# Налаштування логування
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


def get_active_raffles():
    """Отримання списку активних розіграшів"""
    try:
        # У реальному випадку дані будуть витягуватися з таблиці raffles
        # Зараз повертаємо заглушку з тестовими даними

        active_raffles = [
            {
                "id": "raffle-1",
                "title": "Щотижневий розіграш WINIX",
                "description": "Щотижневий розіграш 1000 WINIX серед учасників",
                "entry_fee": 10,
                "prize_amount": 1000,
                "start_time": (datetime.now().timestamp() - 86400) * 1000,  # 1 день тому
                "end_time": (datetime.now().timestamp() + 518400) * 1000,  # 6 днів у майбутньому
                "participants_count": 45,
                "status": "active"
            },
            {
                "id": "raffle-2",
                "title": "Щомісячний розіграш",
                "description": "Щомісячний розіграш 5000 WINIX серед учасників",
                "entry_fee": 50,
                "prize_amount": 5000,
                "start_time": (datetime.now().timestamp() - 604800) * 1000,  # 7 днів тому
                "end_time": (datetime.now().timestamp() + 1814400) * 1000,  # 21 день у майбутньому
                "participants_count": 23,
                "status": "active"
            }
        ]

        return jsonify({"status": "success", "data": active_raffles})
    except Exception as e:
        logger.error(f"get_active_raffles: Помилка отримання активних розіграшів: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500


def get_user_raffles(telegram_id):
    """Отримання розіграшів, у яких бере участь користувач"""
    try:
        user = get_user(telegram_id)

        if not user:
            return jsonify({"status": "error", "message": "Користувача не знайдено"}), 404

        # У реальному випадку дані будуть витягуватися з таблиці raffle_participants
        # Зараз повертаємо заглушку з тестовими даними

        user_raffles = [
            {
                "raffle_id": "raffle-1",
                "title": "Щотижневий розіграш WINIX",
                "entry_fee": 10,
                "prize_amount": 1000,
                "participation_time": (datetime.now().timestamp() - 43200) * 1000,  # 12 годин тому
                "status": "active",
                "entry_number": 42
            }
        ]

        return jsonify({"status": "success", "data": user_raffles})
    except Exception as e:
        logger.error(f"get_user_raffles: Помилка отримання розіграшів користувача {telegram_id}: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500


def participate_in_raffle(telegram_id, data):
    """Участь у розіграші"""
    try:
        if not data or "raffle_id" not in data:
            return jsonify({"status": "error", "message": "Не вказано ID розіграшу"}), 400

        raffle_id = data["raffle_id"]

        # Отримуємо користувача
        user = get_user(telegram_id)

        if not user:
            return jsonify({"status": "error", "message": "Користувача не знайдено"}), 404

        # У реальному випадку тут має бути перевірка існування розіграшу і можливості участі
        # Для прикладу візьмемо фіксовану плату за участь
        entry_fee = 10

        # Перевіряємо, чи достатньо коштів
        current_balance = float(user.get("balance", 0))

        if current_balance < entry_fee:
            return jsonify({"status": "error", "message": "Недостатньо коштів для участі в розіграші"}), 400

        # Списуємо кошти
        new_balance = current_balance - entry_fee

        # Оновлюємо лічильник участей
        participations_count = user.get("participations_count", 0) + 1

        # Оновлюємо дані користувача
        update_user(telegram_id, {
            "balance": new_balance,
            "participations_count": participations_count
        })

        # Додаємо транзакцію
        transaction = {
            "telegram_id": telegram_id,
            "type": "fee",
            "amount": -entry_fee,
            "description": f"Участь у розіграші {raffle_id}",
            "status": "completed",
            "raffle_id": raffle_id
        }

        supabase.table("transactions").insert(transaction).execute()

        # Перевіряємо, чи користувач заслуговує на бейдж початківця (за 5 участей)
        if participations_count >= 5:
            check_and_update_badges(telegram_id)

        # У реальному випадку тут має бути додавання запису в таблицю raffle_participants

        # Генеруємо номер учасника (випадковий для прикладу)
        entry_number = 42

        return jsonify({
            "status": "success",
            "message": f"Успішна участь у розіграші",
            "data": {
                "entry_number": entry_number,
                "new_balance": new_balance,
                "fee": entry_fee
            }
        })
    except Exception as e:
        logger.error(f"participate_in_raffle: Помилка участі у розіграші для {telegram_id}: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500