from flask import jsonify, request
import logging
import os
import importlib.util
from datetime import datetime

# Налаштування логування
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Імпортуємо supabase_client.py напряму
current_dir = os.path.dirname(os.path.abspath(__file__))  # папка admin
parent_dir = os.path.dirname(current_dir)  # папка backend

# Використання importlib для імпорту модуля з абсолютного шляху
spec = importlib.util.spec_from_file_location("supabase_client", os.path.join(parent_dir, "supabase_client.py"))
supabase_client = importlib.util.module_from_spec(spec)
spec.loader.exec_module(supabase_client)

# Витягуємо необхідні функції з модуля
get_user = supabase_client.get_user
update_user = supabase_client.update_user
update_balance = supabase_client.update_balance
supabase = supabase_client.supabase

# Список адміністраторів (ID Telegram)
ADMIN_IDS = os.getenv("ADMIN_IDS", "").split(",")


def check_admin_auth(telegram_id):
    """Перевірка, чи користувач є адміністратором"""
    return str(telegram_id) in ADMIN_IDS


def admin_get_users():
    """Отримання списку користувачів (тільки для адміністраторів)"""
    try:
        # Отримуємо ID адміністратора з заголовка
        admin_id = request.headers.get('X-Admin-Id')

        if not admin_id or not check_admin_auth(admin_id):
            return jsonify({"status": "error", "message": "Доступ заборонено"}), 403

        # Отримуємо користувачів з обмеженням кількості
        users_res = supabase.table("winix").select("*").limit(50).execute()
        users = users_res.data if users_res.data else []

        return jsonify({"status": "success", "data": users})
    except Exception as e:
        logger.error(f"admin_get_users: Помилка отримання списку користувачів: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500


def admin_get_user(user_id):
    """Отримання даних конкретного користувача (тільки для адміністраторів)"""
    try:
        # Отримуємо ID адміністратора з заголовка
        admin_id = request.headers.get('X-Admin-Id')

        if not admin_id or not check_admin_auth(admin_id):
            return jsonify({"status": "error", "message": "Доступ заборонено"}), 403

        # Отримуємо дані користувача
        user = get_user(user_id)

        if not user:
            return jsonify({"status": "error", "message": "Користувача не знайдено"}), 404

        return jsonify({"status": "success", "data": user})
    except Exception as e:
        logger.error(f"admin_get_user: Помилка отримання даних користувача {user_id}: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500


def admin_update_user(user_id, data):
    """Оновлення даних конкретного користувача (тільки для адміністраторів)"""
    try:
        # Отримуємо ID адміністратора з заголовка
        admin_id = request.headers.get('X-Admin-Id')

        if not admin_id or not check_admin_auth(admin_id):
            return jsonify({"status": "error", "message": "Доступ заборонено"}), 403

        if not data:
            return jsonify({"status": "error", "message": "Відсутні дані для оновлення"}), 400

        # Отримуємо користувача для перевірки
        user = get_user(user_id)

        if not user:
            return jsonify({"status": "error", "message": "Користувача не знайдено"}), 404

        # Якщо пробуємо змінити баланс, додаємо запис у транзакції
        if "balance" in data:
            new_balance = float(data["balance"])
            old_balance = float(user.get("balance", 0))
            difference = new_balance - old_balance

            if difference != 0:
                transaction = {
                    "telegram_id": user_id,
                    "type": "admin_adjustment",
                    "amount": difference,
                    "description": f"Коригування балансу адміністратором (ID: {admin_id})",
                    "status": "completed",
                    "created_at": datetime.now().isoformat()
                }

                supabase.table("transactions").insert(transaction).execute()

        # Оновлюємо дані користувача
        updated_user = update_user(user_id, data)

        if not updated_user:
            return jsonify({"status": "error", "message": "Помилка оновлення даних користувача"}), 500

        # Логуємо дію
        logger.info(f"admin_update_user: Адміністратор {admin_id} оновив дані користувача {user_id}")

        return jsonify({
            "status": "success",
            "message": "Дані користувача успішно оновлено",
            "data": updated_user
        })
    except Exception as e:
        logger.error(f"admin_update_user: Помилка оновлення даних користувача {user_id}: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500


def admin_create_transaction(user_id, data):
    """Створення транзакції для користувача (тільки для адміністраторів)"""
    try:
        # Отримуємо ID адміністратора з заголовка
        admin_id = request.headers.get('X-Admin-Id')

        if not admin_id or not check_admin_auth(admin_id):
            return jsonify({"status": "error", "message": "Доступ заборонено"}), 403

        if not data or "type" not in data or "amount" not in data:
            return jsonify({"status": "error", "message": "Відсутні необхідні дані транзакції"}), 400

        # Отримуємо користувача для перевірки
        user = get_user(user_id)

        if not user:
            return jsonify({"status": "error", "message": "Користувача не знайдено"}), 404

        # Додаємо додаткові поля в транзакцію
        transaction_data = data.copy()
        transaction_data["telegram_id"] = user_id
        transaction_data["admin_id"] = admin_id
        transaction_data["created_at"] = datetime.now().isoformat()
        transaction_data["status"] = "completed"

        if "description" not in transaction_data:
            transaction_data["description"] = f"Транзакція створена адміністратором (ID: {admin_id})"

        # Зберігаємо транзакцію
        transaction_res = supabase.table("transactions").insert(transaction_data).execute()
        transaction = transaction_res.data[0] if transaction_res.data else None

        # Оновлюємо баланс користувача, якщо потрібно
        amount = float(data["amount"])
        if amount != 0:
            current_balance = float(user.get("balance", 0))
            new_balance = current_balance + amount
            update_user(user_id, {"balance": new_balance})

        # Логуємо дію
        logger.info(
            f"admin_create_transaction: Адміністратор {admin_id} створив транзакцію для {user_id} на суму {amount}")

        return jsonify({
            "status": "success",
            "message": "Транзакцію успішно створено",
            "data": {
                "transaction": transaction,
                "newBalance": new_balance if amount != 0 else current_balance
            }
        })
    except Exception as e:
        logger.error(f"admin_create_transaction: Помилка створення транзакції для {user_id}: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500


def admin_get_transactions():
    """Отримання останніх транзакцій (тільки для адміністраторів)"""
    try:
        # Отримуємо ID адміністратора з заголовка
        admin_id = request.headers.get('X-Admin-Id')

        if not admin_id or not check_admin_auth(admin_id):
            return jsonify({"status": "error", "message": "Доступ заборонено"}), 403

        # Отримуємо параметри фільтрації
        limit = int(request.args.get('limit', 50))
        offset = int(request.args.get('offset', 0))
        user_id = request.args.get('user_id')

        # Конструюємо запит
        query = supabase.table("transactions").select("*").order("created_at", desc=True).limit(limit).offset(offset)

        # Додаємо фільтр по користувачу, якщо вказаний
        if user_id:
            query = query.eq("telegram_id", user_id)

        # Виконуємо запит
        transactions_res = query.execute()
        transactions = transactions_res.data if transactions_res.data else []

        return jsonify({
            "status": "success",
            "data": transactions,
            "pagination": {
                "limit": limit,
                "offset": offset,
                "total": len(transactions)  # В ідеалі тут мав би бути загальний count з бази
            }
        })
    except Exception as e:
        logger.error(f"admin_get_transactions: Помилка отримання транзакцій: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500