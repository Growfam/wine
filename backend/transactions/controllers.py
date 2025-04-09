from flask import jsonify, request
import logging
import os
import sys
import uuid
import json
from datetime import datetime, timezone
from typing import Dict, Any, Tuple, List, Optional, Union
import functools

# Додаємо кореневу папку бекенду до шляху Python для імпортів
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
if parent_dir not in sys.path:
    sys.path.append(parent_dir)

# Імпортуємо з supabase_client без використання importlib
from supabase_client import get_user, update_user, update_balance, supabase, retry_supabase, cached

# Налаштування логування
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Константи для транзакцій
MIN_TRANSFER_AMOUNT = 500  # Мінімальна сума переказу


def api_response(status: str, data: Optional[Dict[str, Any]] = None,
                 message: Optional[str] = None, status_code: int = 200) -> Tuple[Dict[str, Any], int]:
    """Єдина функція для формування відповіді API"""
    response = {"status": status}

    if data is not None:
        response["data"] = data

    if message is not None:
        response["message"] = message

    return jsonify(response), status_code


def validate_transaction_amount(amount: Union[str, float, int], min_amount: float = 0) -> Tuple[
    bool, float, Optional[str]]:
    """Валідація суми транзакції з перетворенням типів"""
    try:
        # Перетворюємо до float
        amount_float = float(amount)

        # Перевірка на позитивне значення
        if amount_float <= 0:
            return False, 0, "Сума транзакції повинна бути більше нуля"

        # Перевірка на мінімальну суму, якщо потрібно
        if min_amount > 0 and amount_float < min_amount:
            return False, amount_float, f"Мінімальна сума транзакції: {min_amount} WINIX"

        return True, amount_float, None
    except (ValueError, TypeError):
        return False, 0, "Некоректний формат суми транзакції"


@cached()
def get_user_transactions(telegram_id: str, transaction_type: Optional[str] = None) -> Tuple[Dict[str, Any], int]:
    """
    Отримання транзакцій користувача з можливістю фільтрації за типом

    Args:
        telegram_id (str): ID користувача
        transaction_type (str, optional): Тип транзакцій для фільтрації

    Returns:
        tuple: (json_response, status_code)
    """
    try:
        # Отримуємо користувача з Supabase
        user = get_user(telegram_id)

        if not user:
            logger.warning(f"get_user_transactions: Користувача {telegram_id} не знайдено")
            return api_response("error", message="Користувача не знайдено", status_code=404)

        # Отримуємо транзакції з таблиці transactions
        try:
            transactions = []
            if supabase:
                # Створюємо базовий запит
                query = supabase.table("transactions").select("*").or_(
                    f"telegram_id.eq.{telegram_id},to_address.eq.{telegram_id}"
                )

                # Додаємо фільтр за типом, якщо він вказаний
                if transaction_type and transaction_type != 'all':
                    query = query.eq("type", transaction_type)

                # Додаємо сортування за часом створення (від найновіших до найстаріших)
                transaction_res = query.order("created_at", desc=True).execute()

                transactions = transaction_res.data if transaction_res.data else []
        except Exception as e:
            logger.error(f"get_user_transactions: Помилка отримання транзакцій: {str(e)}")
            transactions = []

        return api_response("success", data=transactions)
    except Exception as e:
        logger.error(f"get_user_transactions: Помилка отримання транзакцій користувача {telegram_id}: {str(e)}")
        return api_response("error", message=str(e), status_code=500)


def add_user_transaction(telegram_id: str, data: Dict[str, Any]) -> Tuple[Dict[str, Any], int]:
    """
    Додавання нової транзакції

    Args:
        telegram_id (str): ID користувача
        data (dict): Дані транзакції (тип, сума, опис)

    Returns:
        tuple: (json_response, status_code)
    """
    try:
        if not data or 'type' not in data or 'amount' not in data:
            return api_response("error", message="Відсутні необхідні дані транзакції", status_code=400)

        # Перевіряємо, чи користувач існує
        user = get_user(telegram_id)
        if not user:
            logger.warning(f"add_user_transaction: Користувача {telegram_id} не знайдено")
            return api_response("error", message="Користувача не знайдено", status_code=404)

        # Валідуємо суму транзакції
        is_valid, amount, error_message = validate_transaction_amount(data['amount'])
        if not is_valid:
            return api_response("error", message=error_message, status_code=400)

        # Додаємо id та дату створення, якщо їх немає
        transaction_data = data.copy()
        if 'id' not in transaction_data:
            transaction_data['id'] = str(uuid.uuid4())

        if 'created_at' not in transaction_data:
            transaction_data['created_at'] = datetime.now(timezone.utc).isoformat()

        # Додаємо telegram_id
        transaction_data['telegram_id'] = telegram_id
        transaction_data['amount'] = amount

        # Перевіряємо тип транзакції і оновлюємо баланс, якщо потрібно
        transaction_type = transaction_data['type']

        if transaction_type in ['receive', 'reward', 'unstake']:
            # Додаємо кошти на баланс
            current_balance = float(user.get("balance", 0))
            new_balance = current_balance + amount
            update_result = update_user(telegram_id, {"balance": new_balance})

            if not update_result:
                return api_response("error", message="Помилка оновлення балансу", status_code=500)

        elif transaction_type in ['send', 'stake', 'fee']:
            # Знімаємо кошти з балансу
            current_balance = float(user.get("balance", 0))
            if current_balance < amount:
                return api_response("error", message="Недостатньо коштів", status_code=400)

            new_balance = current_balance - amount
            update_result = update_user(telegram_id, {"balance": new_balance})

            if not update_result:
                return api_response("error", message="Помилка оновлення балансу", status_code=500)

        # Зберігаємо транзакцію в базі даних
        transaction_result = None
        if supabase:
            transaction_res = supabase.table("transactions").insert(transaction_data).execute()
            transaction_result = transaction_res.data[0] if transaction_res.data else None

        return api_response(
            "success",
            message="Транзакцію успішно додано",
            data={"transaction": transaction_result or transaction_data}
        )
    except Exception as e:
        logger.error(f"add_user_transaction: Помилка додавання транзакції користувача {telegram_id}: {str(e)}")
        return api_response("error", message=str(e), status_code=500)


def create_send_transaction(telegram_id: str, to_address: str, amount: Union[float, int, str],
                            note: Optional[str] = None) -> Tuple[Dict[str, Any], int]:
    """
    Створення транзакції надсилання коштів

    Args:
        telegram_id (str): ID відправника
        to_address (str): ID отримувача
        amount (float): Сума для відправлення
        note (str, optional): Примітка до транзакції

    Returns:
        tuple: (json_response, status_code)
    """
    try:
        # Валідуємо суму
        is_valid, amount_float, error_message = validate_transaction_amount(amount, MIN_TRANSFER_AMOUNT)
        if not is_valid:
            return api_response("error", message=error_message, status_code=400)

        # Перевіряємо, чи користувач існує
        user = get_user(telegram_id)
        if not user:
            logger.warning(f"create_send_transaction: Користувача {telegram_id} не знайдено")
            return api_response("error", message="Користувача не знайдено", status_code=404)

        # Перевіряємо достатність коштів
        current_balance = float(user.get("balance", 0))

        if current_balance < amount_float:
            return api_response(
                "error",
                message=f"Недостатньо коштів для здійснення транзакції. Баланс: {current_balance}, потрібно: {amount_float}",
                status_code=400
            )

        # Оновлюємо баланс атомарно
        new_balance = current_balance - amount_float
        update_result = update_user(telegram_id, {"balance": new_balance})

        if not update_result:
            return api_response("error", message="Помилка оновлення балансу", status_code=500)

        # Створюємо опис транзакції
        description = note if note else f"Надсилання {amount_float} WINIX на адресу {to_address}"

        # Створюємо запис транзакції
        transaction_data = {
            "id": str(uuid.uuid4()),
            "telegram_id": telegram_id,
            "type": "send",
            "amount": -amount_float,  # від'ємне значення для відправлення
            "to_address": to_address,
            "description": description,
            "status": "completed",
            "created_at": datetime.now(timezone.utc).isoformat()
        }

        transaction_res = supabase.table("transactions").insert(transaction_data).execute()
        transaction_result = transaction_res.data[0] if transaction_res.data else transaction_data

        return api_response(
            "success",
            message=f"Успішно надіслано {amount_float} WINIX",
            data={
                "transaction": transaction_result,
                "newBalance": new_balance
            }
        )
    except Exception as e:
        logger.error(f"create_send_transaction: Помилка створення транзакції відправлення для {telegram_id}: {str(e)}")
        # Спроба відновити баланс у випадку помилки
        try:
            if 'current_balance' in locals() and 'amount_float' in locals():
                update_user(telegram_id, {"balance": current_balance})
        except:
            pass
        return api_response("error", message=str(e), status_code=500)


def create_receive_transaction(telegram_id: str, from_address: str, amount: Union[float, int, str],
                               note: Optional[str] = None) -> Tuple[Dict[str, Any], int]:
    """
    Створення транзакції отримання коштів

    Args:
        telegram_id (str): ID отримувача
        from_address (str): ID відправника
        amount (float): Сума для отримання
        note (str, optional): Примітка до транзакції

    Returns:
        tuple: (json_response, status_code)
    """
    try:
        # Валідуємо суму
        is_valid, amount_float, error_message = validate_transaction_amount(amount, MIN_TRANSFER_AMOUNT)
        if not is_valid:
            return api_response("error", message=error_message, status_code=400)

        # Перевіряємо, чи користувач існує
        user = get_user(telegram_id)
        if not user:
            logger.warning(f"create_receive_transaction: Користувача {telegram_id} не знайдено")
            return api_response("error", message="Користувача не знайдено", status_code=404)

        # Оновлюємо баланс атомарно
        current_balance = float(user.get("balance", 0))
        new_balance = current_balance + amount_float
        update_result = update_user(telegram_id, {"balance": new_balance})

        if not update_result:
            return api_response("error", message="Помилка оновлення балансу", status_code=500)

        # Створюємо опис транзакції
        description = note if note else f"Отримання {amount_float} WINIX від {from_address}"

        # Створюємо запис транзакції
        transaction_data = {
            "id": str(uuid.uuid4()),
            "telegram_id": telegram_id,
            "type": "receive",
            "amount": amount_float,
            "from_address": from_address,
            "description": description,
            "status": "completed",
            "created_at": datetime.now(timezone.utc).isoformat()
        }

        transaction_res = supabase.table("transactions").insert(transaction_data).execute()
        transaction_result = transaction_res.data[0] if transaction_res.data else transaction_data

        return api_response(
            "success",
            message=f"Успішно отримано {amount_float} WINIX",
            data={
                "transaction": transaction_result,
                "newBalance": new_balance
            }
        )
    except Exception as e:
        logger.error(f"create_receive_transaction: Помилка створення транзакції отримання для {telegram_id}: {str(e)}")
        # Спроба відновити баланс у випадку помилки
        try:
            if 'current_balance' in locals():
                update_user(telegram_id, {"balance": current_balance})
        except:
            pass
        return api_response("error", message=str(e), status_code=500)


def transfer_tokens(sender_id: str, receiver_id: str, amount: Union[float, int, str],
                    note: str = '') -> Tuple[Dict[str, Any], int]:
    """
    Переказ WINIX-токенів між користувачами з атомарною транзакцією

    Args:
        sender_id (str): ID відправника
        receiver_id (str): ID отримувача
        amount (float): Сума для переказу
        note (str): Примітка до транзакції

    Returns:
        tuple: (json_response, status_code)
    """
    try:
        # Валідуємо суму
        is_valid, amount_float, error_message = validate_transaction_amount(amount, MIN_TRANSFER_AMOUNT)
        if not is_valid:
            return api_response("error", message=error_message, status_code=400)

        # Перевірка на самонадсилання
        if str(sender_id) == str(receiver_id):
            return api_response("error", message="Не можна надсилати токени самому собі", status_code=400)

        # Перевіряємо, чи існує відправник
        sender = get_user(sender_id)
        if not sender:
            return api_response("error", message="Відправника не знайдено", status_code=404)

        # Перевіряємо, чи достатньо коштів
        sender_balance = float(sender.get("balance", 0))
        if sender_balance < amount_float:
            return api_response(
                "error",
                message=f"Недостатньо коштів для переказу. Баланс: {sender_balance}, потрібно: {amount_float}",
                status_code=400
            )

        # Перевіряємо, чи існує отримувач
        receiver = get_user(receiver_id)
        if not receiver:
            return api_response("error", message="Отримувача не знайдено", status_code=404)

        # Створюємо транзакцію
        transaction_id = str(uuid.uuid4())
        timestamp = datetime.now(timezone.utc).isoformat()

        # Атомарне виконання транзакції - спочатку оновлюємо баланси
        try:
            # 1. Знімаємо кошти з рахунку відправника
            sender_new_balance = sender_balance - amount_float
            update_sender = update_user(sender_id, {"balance": sender_new_balance})

            if not update_sender:
                raise Exception("Помилка оновлення балансу відправника")

            # 2. Додаємо кошти на рахунок отримувача
            receiver_balance = float(receiver.get("balance", 0))
            receiver_new_balance = receiver_balance + amount_float
            update_receiver = update_user(receiver_id, {"balance": receiver_new_balance})

            if not update_receiver:
                # Відкачуємо зміни - повертаємо баланс відправнику
                update_user(sender_id, {"balance": sender_balance})
                raise Exception("Помилка оновлення балансу отримувача")

            # Підготовка описів транзакцій
            send_description = note if note else f"Надсилання {amount_float} WINIX користувачу {receiver_id}"
            receive_description = note if note else f"Отримання {amount_float} WINIX від користувача {sender_id}"

            # 3. Створюємо записи транзакцій
            send_transaction = {
                "id": str(uuid.uuid4()),
                "telegram_id": sender_id,
                "type": "send",
                "amount": -amount_float,  # від'ємне значення для відправки
                "to_address": receiver_id,
                "description": send_description,
                "status": "completed",
                "created_at": timestamp,
                "transaction_group": transaction_id  # Для зв'язування транзакцій
            }

            receive_transaction = {
                "id": str(uuid.uuid4()),
                "telegram_id": receiver_id,
                "type": "receive",
                "amount": amount_float,
                "from_address": sender_id,
                "description": receive_description,
                "status": "completed",
                "created_at": timestamp,
                "transaction_group": transaction_id  # Для зв'язування транзакцій
            }

            # 4. Зберігаємо обидві транзакції в базі даних
            send_result = supabase.table("transactions").insert(send_transaction).execute()
            receive_result = supabase.table("transactions").insert(receive_transaction).execute()

            return api_response(
                "success",
                message=f"Успішно відправлено {amount_float} WINIX користувачу {receiver_id}",
                data={
                    "transaction_id": transaction_id,
                    "sender_balance": sender_new_balance,
                    "receiver_balance": receiver_new_balance,
                    "send_transaction": send_result.data[0] if send_result.data else send_transaction,
                    "receive_transaction": receive_result.data[0] if receive_result.data else receive_transaction
                }
            )

        except Exception as e:
            # Спроба відновити баланси у випадку помилки
            logger.error(f"transfer_tokens: Помилка при виконанні транзакції: {str(e)}")
            try:
                # Повертаємо баланс відправнику, якщо він був змінений
                if 'update_sender' in locals() and update_sender:
                    update_user(sender_id, {"balance": sender_balance})

                # Повертаємо баланс отримувачу, якщо він був змінений
                if 'update_receiver' in locals() and update_receiver:
                    update_user(receiver_id, {"balance": receiver_balance})
            except Exception as rollback_error:
                logger.error(f"transfer_tokens: Помилка при відкаті транзакції: {str(rollback_error)}")

            return api_response("error", message=f"Помилка виконання транзакції: {str(e)}", status_code=500)

    except Exception as e:
        logger.error(f"transfer_tokens: Помилка переказу токенів: {str(e)}")
        return api_response("error", message=str(e), status_code=500)


@cached(timeout=60)  # Короткий час кешування для останніх транзакцій
def get_recent_transactions(telegram_id: str, limit: int = 3) -> Tuple[Dict[str, Any], int]:
    """
    Отримання останніх транзакцій користувача

    Args:
        telegram_id (str): ID користувача
        limit (int): Кількість транзакцій для отримання

    Returns:
        tuple: (json_response, status_code)
    """
    try:
        # Отримуємо користувача
        user = get_user(telegram_id)

        if not user:
            logger.warning(f"get_recent_transactions: Користувача {telegram_id} не знайдено")
            return api_response("error", message="Користувача не знайдено", status_code=404)

        # Отримуємо всі транзакції користувача з обмеженням
        transactions = []
        if supabase:
            # Шукаємо всі транзакції, де користувач є відправником або отримувачем
            transaction_res = supabase.table("transactions").select("*").or_(
                f"telegram_id.eq.{telegram_id},to_address.eq.{telegram_id}"
            ).order("created_at", desc=True).limit(limit).execute()

            transactions = transaction_res.data if transaction_res.data else []

        return api_response("success", data=transactions)
    except Exception as e:
        logger.error(f"get_recent_transactions: Помилка отримання останніх транзакцій для {telegram_id}: {str(e)}")
        return api_response("error", message=str(e), status_code=500)


@cached(timeout=60)  # Короткий час кешування
def get_recent_transactions_by_type(telegram_id: str, limit: int = 3,
                                    transaction_type: Optional[str] = None) -> Tuple[Dict[str, Any], int]:
    """
    Отримання останніх транзакцій користувача за типом

    Args:
        telegram_id (str): ID користувача
        limit (int): Кількість транзакцій для отримання
        transaction_type (str, optional): Тип транзакцій для фільтрації

    Returns:
        tuple: (json_response, status_code)
    """
    try:
        # Отримуємо користувача
        user = get_user(telegram_id)

        if not user:
            logger.warning(f"get_recent_transactions_by_type: Користувача {telegram_id} не знайдено")
            return api_response("error", message="Користувача не знайдено", status_code=404)

        # Отримуємо транзакції з фільтрацією
        transactions = []
        if supabase:
            # Базовий запит
            query = supabase.table("transactions").select("*").or_(
                f"telegram_id.eq.{telegram_id},to_address.eq.{telegram_id}"
            )

            # Додаємо фільтр за типом, якщо він вказаний
            if transaction_type and transaction_type != 'all':
                query = query.eq("type", transaction_type)

            # Додаємо сортування за часом створення (від найновіших до найстаріших)
            transaction_res = query.order("created_at", desc=True).limit(limit).execute()

            transactions = transaction_res.data if transaction_res.data else []

        return api_response("success", data=transactions)
    except Exception as e:
        logger.error(f"get_recent_transactions_by_type: Помилка отримання транзакцій для {telegram_id}: {str(e)}")
        return api_response("error", message=str(e), status_code=500)


# Seed phrases related functions
def verify_user_password(telegram_id: str, password: str) -> Dict[str, Any]:
    """
    Перевірка пароля користувача

    Args:
        telegram_id (str): ID користувача
        password (str): Пароль для перевірки

    Returns:
        dict: Результат перевірки
    """
    try:
        user = get_user(telegram_id)

        if not user:
            return {"status": "error", "message": "Користувача не знайдено"}

        password_hash = user.get("password_hash")
        password_salt = user.get("password_salt")

        if not password_hash:
            return {"status": "error", "message": "Пароль не встановлено"}

        # Імпортуємо модуль seed_phrases
        from . import seed_phrases

        # Перевіряємо пароль
        verified = False

        # Перевірка з новим алгоритмом (PBKDF2)
        if password_salt:
            verified = seed_phrases.verify_password(password, {"hash": password_hash, "salt": password_salt})
        else:
            # Для сумісності зі старим алгоритмом
            import hashlib
            simple_hash = hashlib.sha256(password.encode()).hexdigest()
            verified = (simple_hash == password_hash)

            # Якщо пароль вірний, оновлюємо його до нового формату
            if verified:
                logger.info(f"Виявлено старий формат пароля для {telegram_id}, оновлення до нового формату...")
                new_password_data = seed_phrases.hash_password(password)
                update_user(telegram_id, {
                    "password_hash": new_password_data["hash"],
                    "password_salt": new_password_data["salt"]
                })

        return {"status": "success", "data": {"verified": verified}}

    except Exception as e:
        logger.error(f"verify_user_password: Помилка перевірки пароля користувача {telegram_id}: {str(e)}")
        return {"status": "error", "message": str(e)}


def update_user_password(telegram_id: str, data: Dict[str, Any]) -> Tuple[Dict[str, Any], int]:
    """
    Оновлення пароля користувача з хешуванням

    Args:
        telegram_id (str): ID користувача
        data (dict): Дані з паролем

    Returns:
        tuple: (json_response, status_code)
    """
    try:
        if not data or "password" not in data:
            return api_response("error", message="Відсутній пароль", status_code=400)

        password = data["password"]

        # Мінімальні вимоги до пароля
        if len(password) < 8:
            return api_response("error", message="Пароль має містити не менше 8 символів", status_code=400)

        # Перевіряємо наявність літер у паролі
        letter_count = sum(1 for c in password if c.isalpha())
        if letter_count < 5:
            return api_response("error", message="Пароль має містити не менше 5 літер", status_code=400)

        # Імпортуємо модуль seed_phrases
        from . import seed_phrases

        # Хешуємо пароль
        password_data = seed_phrases.hash_password(password)

        # Оновлюємо пароль у базі даних
        result = seed_phrases.update_user_password(
            telegram_id,
            password_data["hash"],
            password_data["salt"]
        )

        if result["status"] == "error":
            return api_response("error", message=result["message"], status_code=500)

        return api_response("success", message="Пароль успішно оновлено")

    except Exception as e:
        logger.error(f"update_user_password: Помилка оновлення пароля користувача {telegram_id}: {str(e)}")
        return api_response("error", message=str(e), status_code=500)


def get_user_seed_phrase(telegram_id: str, show_password_protected: bool = True) -> Tuple[Dict[str, Any], int]:
    """
    Отримання seed-фрази користувача з захистом паролем

    Args:
        telegram_id (str): ID користувача
        show_password_protected (bool): Чи показувати повідомлення про захист паролем

    Returns:
        tuple: (json_response, status_code)
    """
    try:
        user = get_user(telegram_id)

        if not user:
            return api_response("error", message="Користувача не знайдено", status_code=404)

        # Імпортуємо модуль seed_phrases
        from . import seed_phrases

        # Отримуємо seed-фразу
        result = seed_phrases.get_user_seed_phrase(telegram_id)

        if result["status"] == "error":
            return api_response("error", message=result["message"], status_code=500)

        # Якщо seed_phrase захищена паролем, перевіряємо наявність пароля
        password_hash = user.get("password_hash")
        if show_password_protected and password_hash:
            # Повертаємо статус потреби пароля
            return api_response(
                "password_required",
                message="Для перегляду seed-фрази потрібно ввести пароль"
            )

        return jsonify(result)

    except Exception as e:
        logger.error(f"get_user_seed_phrase: Помилка отримання seed-фрази користувача {telegram_id}: {str(e)}")
        return api_response("error", message=str(e), status_code=500)