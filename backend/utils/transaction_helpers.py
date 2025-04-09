from flask import jsonify
import logging
import uuid
from datetime import datetime, timezone

# Налаштування логування
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Імпортуємо supabase для роботи з базою даних
try:
    from backend.supabase_client import supabase
except ImportError:
    import os
    import sys

    current_dir = os.path.dirname(os.path.abspath(__file__))
    parent_dir = os.path.dirname(current_dir)
    if parent_dir not in sys.path:
        sys.path.append(parent_dir)
    from supabase_client import supabase


def create_transaction_record(telegram_id, type_name, amount, description,
                              status="pending", extra_data=None):
    """
    Створює запис транзакції в базі даних БЕЗ оновлення балансу.
    Використовуйте для спільної логіки створення транзакцій.

    Args:
        telegram_id: ID користувача
        type_name: Тип транзакції (receive, send, reward, fee, etc.)
        amount: Сума транзакції
        description: Опис транзакції
        status: Початковий статус транзакції
        extra_data: Додаткові дані для транзакції

    Returns:
        tuple: (transaction_data, transaction_id)
    """
    try:
        # Створюємо базову структуру транзакції
        transaction_data = {
            "id": str(uuid.uuid4()),
            "telegram_id": telegram_id,
            "type": type_name,
            "amount": amount,
            "description": description,
            "status": status,
            "created_at": datetime.now(timezone.utc).isoformat()
        }

        # Додаємо додаткові дані, якщо вони є
        if extra_data:
            transaction_data.update(extra_data)

        # Зберігаємо в базі даних
        transaction_res = supabase.table("transactions").insert(transaction_data).execute()

        # Повертаємо результат
        transaction_record = transaction_res.data[0] if transaction_res.data else transaction_data
        transaction_id = transaction_record.get("id")

        return transaction_record, transaction_id
    except Exception as e:
        logger.error(f"create_transaction_record: Помилка створення запису транзакції: {str(e)}")
        return None, None


def update_transaction_status(transaction_id, status):
    """
    Оновлює статус транзакції.

    Args:
        transaction_id: ID транзакції
        status: Новий статус (completed, failed, etc.)

    Returns:
        bool: True якщо успішно, False у випадку помилки
    """
    try:
        if not transaction_id:
            return False

        result = supabase.table("transactions").update({"status": status}).eq("id", transaction_id).execute()
        return bool(result and result.data)
    except Exception as e:
        logger.error(f"update_transaction_status: Помилка оновлення статусу транзакції {transaction_id}: {str(e)}")
        return False