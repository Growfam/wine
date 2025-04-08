from flask import jsonify
import logging
import os
import importlib.util
import uuid
from datetime import datetime

# Налаштування логування
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Імпортуємо supabase_client.py напряму
current_dir = os.path.dirname(os.path.abspath(__file__))  # папка transactions
parent_dir = os.path.dirname(current_dir)  # папка backend

# Використання importlib для імпорту модуля з абсолютного шляху
spec = importlib.util.spec_from_file_location("supabase_client", os.path.join(parent_dir, "supabase_client.py"))
supabase_client = importlib.util.module_from_spec(spec)
spec.loader.exec_module(supabase_client)

# Витягуємо необхідні функції з модуля
get_user = supabase_client.get_user
update_user = supabase_client.update_user
supabase = supabase_client.supabase


def get_user_transactions(telegram_id):
    """Отримання транзакцій користувача"""
    try:
        # Отримуємо користувача з Supabase
        user = get_user(telegram_id)

        if not user:
            logger.warning(f"get_user_transactions: Користувача {telegram_id} не знайдено")
            return jsonify({"status": "error", "message": "Користувача не знайдено"}), 404

        # Отримуємо транзакції з таблиці transactions
        try:
            transactions = []
            if supabase:
                transaction_res = supabase.table("transactions").select("*").eq("telegram_id", telegram_id).order(
                    "created_at", desc=True).execute()
                transactions = transaction_res.data if transaction_res.data else []
        except Exception as e:
            logger.error(f"get_user_transactions: Помилка отримання транзакцій: {str(e)}")
            transactions = []

        return jsonify({"status": "success", "data": transactions})
    except Exception as e:
        logger.error(f"get_user_transactions: Помилка отримання транзакцій користувача {telegram_id}: {str(e)}",
                     exc_info=True)
        return jsonify({"status": "error", "message": str(e)}), 500


def add_user_transaction(telegram_id, data):
    """Додавання нової транзакції"""
    try:
        if not data or 'type' not in data or 'amount' not in data:
            return jsonify({"status": "error", "message": "Відсутні необхідні дані транзакції"}), 400

        # Перевіряємо, чи користувач існує
        user = get_user(telegram_id)
        if not user:
            logger.warning(f"add_user_transaction: Користувача {telegram_id} не знайдено")
            return jsonify({"status": "error", "message": "Користувача не знайдено"}), 404

        # Додаємо id та дату створення, якщо їх немає
        if 'id' not in data:
            data['id'] = str(uuid.uuid4())

        if 'created_at' not in data:
            data['created_at'] = datetime.now().isoformat()

        # Додаємо telegram_id
        data['telegram_id'] = telegram_id

        # Перевіряємо тип транзакції і оновлюємо баланс, якщо потрібно
        transaction_type = data['type']
        amount = float(data['amount'])

        if transaction_type in ['receive', 'reward', 'unstake']:
            # Додаємо кошти на баланс
            current_balance = float(user.get("balance", 0))
            new_balance = current_balance + amount
            update_user(telegram_id, {"balance": new_balance})
        elif transaction_type in ['send', 'stake', 'fee']:
            # Знімаємо кошти з балансу
            current_balance = float(user.get("balance", 0))
            if current_balance < amount:
                return jsonify({"status": "error", "message": "Недостатньо коштів"}), 400

            new_balance = current_balance - amount
            update_user(telegram_id, {"balance": new_balance})

        # Зберігаємо транзакцію в базі даних
        transaction_result = None
        if supabase:
            transaction_res = supabase.table("transactions").insert(data).execute()
            transaction_result = transaction_res.data[0] if transaction_res.data else None

        return jsonify({
            "status": "success",
            "message": "Транзакцію успішно додано",
            "data": {
                "transaction": transaction_result or data
            }
        })
    except Exception as e:
        logger.error(f"add_user_transaction: Помилка додавання транзакції користувача {telegram_id}: {str(e)}",
                     exc_info=True)
        return jsonify({"status": "error", "message": str(e)}), 500


def create_send_transaction(telegram_id, to_address, amount):
    """Створення транзакції надсилання коштів"""
    try:
        # Перевіряємо, чи користувач існує
        user = get_user(telegram_id)
        if not user:
            logger.warning(f"create_send_transaction: Користувача {telegram_id} не знайдено")
            return jsonify({"status": "error", "message": "Користувача не знайдено"}), 404

        # Перевіряємо достатність коштів
        amount = float(amount)
        current_balance = float(user.get("balance", 0))

        if current_balance < amount:
            return jsonify({"status": "error", "message": "Недостатньо коштів для здійснення транзакції"}), 400

        # Оновлюємо баланс
        new_balance = current_balance - amount
        update_user(telegram_id, {"balance": new_balance})

        # Створюємо запис транзакції
        transaction_data = {
            "id": str(uuid.uuid4()),
            "telegram_id": telegram_id,
            "type": "send",
            "amount": -amount,  # негативне значення, оскільки кошти відправляються
            "to_address": to_address,
            "description": f"Надсилання {amount} WINIX на адресу {to_address}",
            "status": "completed",
            "created_at": datetime.now().isoformat()
        }

        supabase.table("transactions").insert(transaction_data).execute()

        return jsonify({
            "status": "success",
            "message": f"Успішно надіслано {amount} WINIX",
            "data": {
                "transaction": transaction_data,
                "newBalance": new_balance
            }
        })
    except Exception as e:
        logger.error(f"create_send_transaction: Помилка створення транзакції відправлення для {telegram_id}: {str(e)}",
                     exc_info=True)
        return jsonify({"status": "error", "message": str(e)}), 500


def create_receive_transaction(telegram_id, from_address, amount):
    """Створення транзакції отримання коштів"""
    try:
        # Перевіряємо, чи користувач існує
        user = get_user(telegram_id)
        if not user:
            logger.warning(f"create_receive_transaction: Користувача {telegram_id} не знайдено")
            return jsonify({"status": "error", "message": "Користувача не знайдено"}), 404

        # Оновлюємо баланс
        amount = float(amount)
        current_balance = float(user.get("balance", 0))
        new_balance = current_balance + amount
        update_user(telegram_id, {"balance": new_balance})

        # Створюємо запис транзакції
        transaction_data = {
            "id": str(uuid.uuid4()),
            "telegram_id": telegram_id,
            "type": "receive",
            "amount": amount,  # позитивне значення, оскільки кошти отримуються
            "from_address": from_address,
            "description": f"Отримання {amount} WINIX від {from_address}",
            "status": "completed",
            "created_at": datetime.now().isoformat()
        }

        supabase.table("transactions").insert(transaction_data).execute()

        return jsonify({
            "status": "success",
            "message": f"Успішно отримано {amount} WINIX",
            "data": {
                "transaction": transaction_data,
                "newBalance": new_balance
            }
        })
    except Exception as e:
        logger.error(f"create_receive_transaction: Помилка створення транзакції отримання для {telegram_id}: {str(e)}",
                     exc_info=True)
        return jsonify({"status": "error", "message": str(e)}), 500