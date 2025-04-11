"""
Допоміжні функції для роботи з транзакціями в системі розіграшів з виправленнями:
- Додані таймаути для запитів
- Покращена обробка помилок
"""

import logging
import uuid
from datetime import datetime, timezone
from typing import Dict, Any, Optional

# Налаштування логування
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Імпортуємо supabase_client з використанням абсолютного шляху
import sys
import os

current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
if parent_dir not in sys.path:
    sys.path.append(parent_dir)

from supabase_client import supabase, execute_transaction


def create_transaction_record(telegram_id: str, transaction_type: str, amount: float,
                              description: str, status: str = "pending",
                              raffle_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
    """
    Створює запис транзакції в базі даних

    Args:
        telegram_id: Ідентифікатор користувача
        transaction_type: Тип транзакції (fee/reward/refund/etc)
        amount: Сума транзакції
        description: Опис транзакції
        status: Статус транзакції (pending/completed/failed)
        raffle_id: ID пов'язаного розіграшу (якщо є)

    Returns:
        Дані створеної транзакції або None у випадку помилки
    """
    try:
        # Генеруємо унікальний ID транзакції
        transaction_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()

        # Створюємо дані транзакції
        transaction_data = {
            "id": transaction_id,
            "telegram_id": str(telegram_id),
            "type": transaction_type,
            "amount": float(amount),
            "description": description,
            "status": status,
            "created_at": now,
            "updated_at": now
        }

        # Додаємо raffle_id, якщо він є
        if raffle_id:
            transaction_data["raffle_id"] = raffle_id

        # Виконуємо запит до бази даних з таймаутом
        try:
            response = supabase.table("transactions").insert(transaction_data).execute(timeout=5)
        except Exception as e:
            logger.error(f"create_transaction_record: Помилка запиту до БД - {str(e)}")
            raise

        if not response.data:
            logger.error(f"create_transaction_record: Помилка створення транзакції для користувача {telegram_id}")
            return None

        # Повертаємо дані транзакції
        return response.data[0]
    except Exception as e:
        logger.error(f"create_transaction_record: Помилка - {str(e)}")
        return None


def update_transaction_status(transaction_id: str, status: str,
                              additional_data: Optional[Dict[str, Any]] = None) -> Optional[Dict[str, Any]]:
    """
    Оновлює статус транзакції

    Args:
        transaction_id: Ідентифікатор транзакції
        status: Новий статус (completed/failed)
        additional_data: Додаткові дані для оновлення

    Returns:
        Оновлені дані транзакції або None у випадку помилки
    """
    try:
        # Підготовка даних для оновлення
        update_data = {
            "status": status,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }

        # Додаємо додаткові дані, якщо вони є
        if additional_data and isinstance(additional_data, dict):
            update_data.update(additional_data)

        # Виконуємо запит до бази даних з таймаутом
        try:
            response = supabase.table("transactions").update(update_data).eq("id", transaction_id).execute(timeout=5)
        except Exception as e:
            logger.error(f"update_transaction_status: Помилка запиту до БД - {str(e)}")
            raise

        if not response.data:
            logger.error(f"update_transaction_status: Помилка оновлення статусу транзакції {transaction_id}")
            return None

        # Повертаємо оновлені дані транзакції
        return response.data[0]
    except Exception as e:
        logger.error(f"update_transaction_status: Помилка - {str(e)}")
        return None


def execute_balance_transaction(telegram_id: str, amount: float, transaction_type: str,
                                description: str, raffle_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Виконує транзакцію з балансом користувача з атомарністю

    Args:
        telegram_id: Ідентифікатор користувача
        amount: Сума транзакції (від'ємна для списання)
        transaction_type: Тип транзакції (fee/reward/refund/etc)
        description: Опис транзакції
        raffle_id: ID пов'язаного розіграшу (якщо є)

    Returns:
        Дані про результат транзакції або словник з помилкою
    """
    try:
        # Отримуємо поточні дані користувача
        try:
            user_response = supabase.table("winix").select("*").eq("telegram_id", str(telegram_id)).execute(timeout=5)
        except Exception as e:
            logger.error(f"execute_balance_transaction: Помилка запиту даних користувача - {str(e)}")
            return {
                "status": "error",
                "message": f"Помилка отримання даних користувача: {str(e)}"
            }

        if not user_response.data:
            logger.error(f"execute_balance_transaction: Користувача {telegram_id} не знайдено")
            return {
                "status": "error",
                "message": "Користувача не знайдено"
            }

        user = user_response.data[0]

        # Отримуємо поточний баланс
        current_balance = float(user.get("balance", 0))

        # Перевіряємо, чи достатньо коштів (для від'ємної суми)
        if amount < 0 and current_balance + amount < 0:
            return {
                "status": "error",
                "message": "Недостатньо коштів"
            }

        # Розраховуємо новий баланс
        new_balance = current_balance + amount

        # Створюємо ID транзакції
        transaction_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()

        try:
            # Виконуємо транзакцію в базі даних
            with execute_transaction() as txn:
                # 1. Створюємо запис транзакції
                transaction_data = {
                    "id": transaction_id,
                    "telegram_id": str(telegram_id),
                    "type": transaction_type,
                    "amount": float(amount),
                    "description": description,
                    "status": "pending",
                    "raffle_id": raffle_id,
                    "created_at": now,
                    "updated_at": now,
                    "previous_balance": current_balance
                }

                txn.table("transactions").insert(transaction_data).execute(timeout=5)

                # 2. Оновлюємо баланс користувача
                txn.table("winix").update({"balance": new_balance}).eq("telegram_id", str(telegram_id)).execute(timeout=5)

                # 3. Оновлюємо статус транзакції
                txn.table("transactions").update({"status": "completed", "updated_at": now}).eq("id",
                                                                                                transaction_id).execute(timeout=5)

            return {
                "status": "success",
                "transaction_id": transaction_id,
                "previous_balance": current_balance,
                "new_balance": new_balance,
                "amount": amount
            }
        except Exception as e:
            logger.error(f"execute_balance_transaction: Помилка виконання транзакції - {str(e)}")

            # Спроба позначити транзакцію як невдалу
            try:
                supabase.table("transactions").update({
                    "status": "failed",
                    "error_message": str(e),
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }).eq("id", transaction_id).execute(timeout=5)
            except:
                pass

            # Повертаємо помилку
            return {
                "status": "error",
                "message": f"Помилка виконання транзакції: {str(e)}"
            }
    except Exception as e:
        logger.error(f"execute_balance_transaction: Критична помилка - {str(e)}")
        return {
            "status": "error",
            "message": f"Критична помилка: {str(e)}"
        }


def execute_coin_transaction(telegram_id: str, amount: int, transaction_type: str,
                             description: str, raffle_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Виконує транзакцію з жетонами користувача з атомарністю

    Args:
        telegram_id: Ідентифікатор користувача
        amount: Кількість жетонів (від'ємна для списання)
        transaction_type: Тип транзакції (fee/reward/refund/etc)
        description: Опис транзакції
        raffle_id: ID пов'язаного розіграшу (якщо є)

    Returns:
        Дані про результат транзакції або словник з помилкою
    """
    try:
        # Отримуємо поточні дані користувача
        try:
            user_response = supabase.table("winix").select("*").eq("telegram_id", str(telegram_id)).execute(timeout=5)
        except Exception as e:
            logger.error(f"execute_coin_transaction: Помилка запиту даних користувача - {str(e)}")
            return {
                "status": "error",
                "message": f"Помилка отримання даних користувача: {str(e)}"
            }

        if not user_response.data:
            logger.error(f"execute_coin_transaction: Користувача {telegram_id} не знайдено")
            return {
                "status": "error",
                "message": "Користувача не знайдено"
            }

        user = user_response.data[0]

        # Отримуємо поточну кількість жетонів
        current_coins = int(user.get("coins", 0))

        # Перевіряємо, чи достатньо жетонів (для від'ємної кількості)
        if amount < 0 and current_coins + amount < 0:
            return {
                "status": "error",
                "message": "Недостатньо жетонів"
            }

        # Розраховуємо нову кількість жетонів
        new_coins = current_coins + amount

        # Створюємо ID транзакції
        transaction_id = str(uuid.uuid4())
        now = datetime.now(timezone.utc).isoformat()

        try:
            # Виконуємо транзакцію в базі даних
            with execute_transaction() as txn:
                # 1. Створюємо запис транзакції
                transaction_data = {
                    "id": transaction_id,
                    "telegram_id": str(telegram_id),
                    "type": transaction_type,
                    "amount": amount,
                    "description": description,
                    "status": "pending",
                    "raffle_id": raffle_id,
                    "created_at": now,
                    "updated_at": now,
                    "previous_coins": current_coins
                }

                txn.table("transactions").insert(transaction_data).execute(timeout=5)

                # 2. Оновлюємо кількість жетонів користувача
                txn.table("winix").update({"coins": new_coins}).eq("telegram_id", str(telegram_id)).execute(timeout=5)

                # 3. Оновлюємо статус транзакції
                txn.table("transactions").update({"status": "completed", "updated_at": now}).eq("id",
                                                                                                transaction_id).execute(timeout=5)

            return {
                "status": "success",
                "transaction_id": transaction_id,
                "previous_coins": current_coins,
                "new_coins": new_coins,
                "amount": amount
            }
        except Exception as e:
            logger.error(f"execute_coin_transaction: Помилка виконання транзакції - {str(e)}")

            # Спроба позначити транзакцію як невдалу
            try:
                supabase.table("transactions").update({
                    "status": "failed",
                    "error_message": str(e),
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }).eq("id", transaction_id).execute(timeout=5)
            except:
                pass

            # Повертаємо помилку
            return {
                "status": "error",
                "message": f"Помилка виконання транзакції: {str(e)}"
            }
    except Exception as e:
        logger.error(f"execute_coin_transaction: Критична помилка - {str(e)}")
        return {
            "status": "error",
            "message": f"Критична помилка: {str(e)}"
        }


def get_user_transactions(telegram_id: str, limit: int = 20, offset: int = 0,
                          transaction_type: Optional[str] = None) -> Dict[str, Any]:
    """
    Отримує список транзакцій користувача

    Args:
        telegram_id: Ідентифікатор користувача
        limit: Максимальна кількість транзакцій
        offset: Зміщення для пагінації
        transaction_type: Фільтр за типом транзакції

    Returns:
        Список транзакцій
    """
    try:
        # Обмежуємо limit максимальним значенням
        max_limit = 100
        if limit > max_limit:
            limit = max_limit

        # Формуємо запит
        query = supabase.table("transactions").select("*").eq("telegram_id", str(telegram_id))

        # Додаємо фільтр за типом транзакції, якщо він вказаний
        if transaction_type:
            query = query.eq("type", transaction_type)

        # Додаємо сортування та пагінацію
        query = query.order("created_at", desc=True).limit(limit).offset(offset)

        # Виконуємо запит з таймаутом
        try:
            response = query.execute(timeout=8)
        except Exception as e:
            logger.error(f"get_user_transactions: Помилка запиту транзакцій - {str(e)}")
            return {
                "status": "error",
                "message": f"Помилка отримання транзакцій: {str(e)}"
            }

        # Отримуємо загальну кількість транзакцій
        try:
            count_query = supabase.table("transactions").select("count", count="exact").eq("telegram_id", str(telegram_id))
            if transaction_type:
                count_query = count_query.eq("type", transaction_type)

            count_response = count_query.execute(timeout=5)
            total_count = count_response.count if hasattr(count_response, 'count') else 0
        except Exception as e:
            logger.error(f"get_user_transactions: Помилка підрахунку транзакцій - {str(e)}")
            total_count = len(response.data) if response.data else 0

        return {
            "status": "success",
            "data": response.data,
            "pagination": {
                "total": total_count,
                "limit": limit,
                "offset": offset
            }
        }
    except Exception as e:
        logger.error(f"get_user_transactions: Помилка - {str(e)}")
        return {
            "status": "error",
            "message": f"Помилка отримання транзакцій: {str(e)}"
        }