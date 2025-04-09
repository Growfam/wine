from flask import jsonify, request
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


# -------------------------------------------------------------------------------------
# Основні функції для транзакцій
# -------------------------------------------------------------------------------------

def get_user_transactions(telegram_id, transaction_type=None):
    """Отримання транзакцій користувача з можливістю фільтрації за типом"""
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


def create_send_transaction(telegram_id, to_address, amount, note=None):
    """Створення транзакції надсилання коштів"""
    try:
        # Перевіряємо мінімальну суму
        amount = float(amount)
        if amount < 500:
            return jsonify({
                "status": "error",
                "message": "Мінімальна сума переказу 500 WINIX"
            }), 400

        # Перевіряємо, чи користувач існує
        user = get_user(telegram_id)
        if not user:
            logger.warning(f"create_send_transaction: Користувача {telegram_id} не знайдено")
            return jsonify({"status": "error", "message": "Користувача не знайдено"}), 404

        # Перевіряємо достатність коштів
        current_balance = float(user.get("balance", 0))

        if current_balance < amount:
            return jsonify({"status": "error", "message": "Недостатньо коштів для здійснення транзакції"}), 400

        # Оновлюємо баланс
        new_balance = current_balance - amount
        update_user(telegram_id, {"balance": new_balance})

        # Створюємо опис транзакції
        description = note if note else f"Надсилання {amount} WINIX на адресу {to_address}"

        # Створюємо запис транзакції
        transaction_data = {
            "id": str(uuid.uuid4()),
            "telegram_id": telegram_id,
            "type": "send",
            "amount": amount,  # збережемо позитивне значення для простоти аналізу
            "to_address": to_address,
            "description": description,
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
        }), 200
    except Exception as e:
        logger.error(f"create_send_transaction: Помилка створення транзакції відправлення для {telegram_id}: {str(e)}",
                     exc_info=True)
        return jsonify({"status": "error", "message": str(e)}), 500


def create_receive_transaction(telegram_id, from_address, amount, note=None):
    """Створення транзакції отримання коштів"""
    try:
        # Перевіряємо мінімальну суму
        amount = float(amount)
        if amount < 500:
            return jsonify({
                "status": "error",
                "message": "Мінімальна сума отримання 500 WINIX"
            }), 400

        # Перевіряємо, чи користувач існує
        user = get_user(telegram_id)
        if not user:
            logger.warning(f"create_receive_transaction: Користувача {telegram_id} не знайдено")
            return jsonify({"status": "error", "message": "Користувача не знайдено"}), 404

        # Оновлюємо баланс
        current_balance = float(user.get("balance", 0))
        new_balance = current_balance + amount
        update_user(telegram_id, {"balance": new_balance})

        # Створюємо опис транзакції
        description = note if note else f"Отримання {amount} WINIX від {from_address}"

        # Створюємо запис транзакції
        transaction_data = {
            "id": str(uuid.uuid4()),
            "telegram_id": telegram_id,
            "type": "receive",
            "amount": amount,
            "from_address": from_address,
            "description": description,
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
        }), 200
    except Exception as e:
        logger.error(f"create_receive_transaction: Помилка створення транзакції отримання для {telegram_id}: {str(e)}",
                     exc_info=True)
        return jsonify({"status": "error", "message": str(e)}), 500


# -------------------------------------------------------------------------------------
# Нова функція для транзакцій між користувачами
# -------------------------------------------------------------------------------------

def transfer_tokens(sender_id, receiver_id, amount, note=''):
    """Переказ WINIX-токенів між користувачами"""
    try:
        # Валідація суми
        amount = float(amount)
        if amount < 500:
            return jsonify({
                "status": "error",
                "message": "Мінімальна сума переказу 500 WINIX"
            }), 400

        # Перевіряємо, чи існує відправник
        sender = get_user(sender_id)
        if not sender:
            return jsonify({
                "status": "error",
                "message": "Відправника не знайдено"
            }), 404

        # Перевіряємо, чи достатньо коштів
        sender_balance = float(sender.get("balance", 0))
        if sender_balance < amount:
            return jsonify({
                "status": "error",
                "message": "Недостатньо коштів для переказу"
            }), 400

        # Перевіряємо, чи існує отримувач
        receiver = get_user(receiver_id)
        if not receiver:
            return jsonify({
                "status": "error",
                "message": "Отримувача не знайдено"
            }), 404

        # Створюємо транзакцію
        transaction_id = str(uuid.uuid4())
        timestamp = datetime.now().isoformat()

        # Створюємо запис транзакції відправлення для відправника з додатковою приміткою
        send_description = note if note else f"Надсилання {amount} WINIX користувачу {receiver_id}"
        send_transaction = {
            "id": str(uuid.uuid4()),
            "telegram_id": sender_id,
            "type": "send",
            "amount": amount,
            "to_address": receiver_id,
            "description": send_description,
            "status": "completed",
            "created_at": timestamp
        }

        # Створюємо запис транзакції отримання для отримувача з додатковою приміткою
        receive_description = note if note else f"Отримання {amount} WINIX від користувача {sender_id}"
        receive_transaction = {
            "id": str(uuid.uuid4()),
            "telegram_id": receiver_id,
            "type": "receive",
            "amount": amount,
            "from_address": sender_id,
            "description": receive_description,
            "status": "completed",
            "created_at": timestamp
        }

        # Оновлюємо баланси користувачів
        # 1. Знімаємо кошти з рахунку відправника
        sender_new_balance = sender_balance - amount
        update_user(sender_id, {"balance": sender_new_balance})

        # 2. Додаємо кошти на рахунок отримувача
        receiver_balance = float(receiver.get("balance", 0))
        receiver_new_balance = receiver_balance + amount
        update_user(receiver_id, {"balance": receiver_new_balance})

        # Зберігаємо обидві транзакції в базі даних
        supabase.table("transactions").insert(send_transaction).execute()
        supabase.table("transactions").insert(receive_transaction).execute()

        return jsonify({
            "status": "success",
            "message": f"Успішно відправлено {amount} WINIX користувачу {receiver_id}",
            "data": {
                "transaction_id": transaction_id,
                "sender_balance": sender_new_balance,
                "receiver_balance": receiver_new_balance,
                "send_transaction": send_transaction,
                "receive_transaction": receive_transaction
            }
        }), 200

    except Exception as e:
        logger.error(f"transfer_tokens: Помилка переказу токенів: {str(e)}", exc_info=True)
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500


def get_recent_transactions(telegram_id, limit=3):
    """Отримання останніх транзакцій користувача"""
    try:
        # Отримуємо користувача з Supabase
        user = get_user(telegram_id)

        if not user:
            logger.warning(f"get_recent_transactions: Користувача {telegram_id} не знайдено")
            return jsonify({"status": "error", "message": "Користувача не знайдено"}), 404

        # Отримуємо транзакції з таблиці transactions
        try:
            transactions = []
            if supabase:
                # Шукаємо всі транзакції, де користувач є відправником або отримувачем
                transaction_res = supabase.table("transactions").select("*").or_(
                    f"telegram_id.eq.{telegram_id},to_address.eq.{telegram_id}"
                ).order("created_at", desc=True).limit(limit).execute()

                transactions = transaction_res.data if transaction_res.data else []
        except Exception as e:
            logger.error(f"get_recent_transactions: Помилка отримання транзакцій: {str(e)}")
            transactions = []

        return jsonify({"status": "success", "data": transactions})
    except Exception as e:
        logger.error(
            f"get_recent_transactions: Помилка отримання останніх транзакцій користувача {telegram_id}: {str(e)}",
            exc_info=True)
        return jsonify({"status": "error", "message": str(e)}), 500


def get_recent_transactions_by_type(telegram_id, limit=3, transaction_type=None):
    """Отримання останніх транзакцій користувача за типом"""
    try:
        # Отримуємо користувача з Supabase
        user = get_user(telegram_id)

        if not user:
            logger.warning(f"get_recent_transactions_by_type: Користувача {telegram_id} не знайдено")
            return jsonify({"status": "error", "message": "Користувача не знайдено"}), 404

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

                # Додаємо сортування та ліміт
                transaction_res = query.order("created_at", desc=True).limit(limit).execute()

                transactions = transaction_res.data if transaction_res.data else []
        except Exception as e:
            logger.error(f"get_recent_transactions_by_type: Помилка отримання транзакцій: {str(e)}")
            transactions = []

        return jsonify({"status": "success", "data": transactions})
    except Exception as e:
        logger.error(
            f"get_recent_transactions_by_type: Помилка отримання останніх транзакцій користувача {telegram_id}: {str(e)}",
            exc_info=True)
        return jsonify({"status": "error", "message": str(e)}), 500

    def verify_user_password(telegram_id, data):
        """Перевірка пароля користувача"""
        try:
            if not data or "password" not in data:
                return jsonify({"status": "error", "message": "Відсутній пароль"}), 400

            user = get_user(telegram_id)

            if not user:
                return jsonify({"status": "error", "message": "Користувача не знайдено"}), 404

            # Імпортуємо модуль seed_phrases для роботи з паролями
            from . import seed_phrases

            # Перевіряємо пароль
            result = seed_phrases.verify_user_password(telegram_id, data["password"])

            if result["status"] == "error":
                return jsonify(result), 500

            if not result["data"]["verified"]:
                return jsonify({"status": "error", "message": "Невірний пароль"}), 401

            return jsonify({"status": "success", "message": "Пароль вірний"})

        except Exception as e:
            logger.error(f"verify_user_password: Помилка перевірки пароля користувача {telegram_id}: {str(e)}")
            return jsonify({"status": "error", "message": str(e)}), 500

    def update_user_password(telegram_id, data):
        """Оновлення пароля користувача з хешуванням"""
        try:
            if not data or "password" not in data:
                return jsonify({"status": "error", "message": "Відсутній пароль"}), 400

            password = data["password"]

            # Мінімальні вимоги до пароля
            if len(password) < 8:
                return jsonify({"status": "error", "message": "Пароль має містити не менше 8 символів"}), 400

            # Перевіряємо наявність літер у паролі
            letter_count = sum(1 for c in password if c.isalpha())
            if letter_count < 5:
                return jsonify({"status": "error", "message": "Пароль має містити не менше 5 літер"}), 400

            # Імпортуємо модуль seed_phrases для роботи з паролями
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
                return jsonify(result), 500

            return jsonify({"status": "success", "message": "Пароль успішно оновлено"})

        except Exception as e:
            logger.error(f"update_user_password: Помилка оновлення пароля користувача {telegram_id}: {str(e)}")
            return jsonify({"status": "error", "message": str(e)}), 500

    def get_user_seed_phrase(telegram_id, show_password_protected=True):
        """Отримання seed-фрази користувача з захистом паролем"""
        try:
            user = get_user(telegram_id)

            if not user:
                return jsonify({"status": "error", "message": "Користувача не знайдено"}), 404

            # Імпортуємо модуль seed_phrases
            from . import seed_phrases

            # Отримуємо seed-фразу
            result = seed_phrases.get_user_seed_phrase(telegram_id)

            if result["status"] == "error":
                return jsonify(result), 500

            # Якщо seed_phrase захищена паролем, перевіряємо наявність пароля
            password_hash = user.get("password_hash")
            if show_password_protected and password_hash:
                # Повертаємо статус потреби пароля
                return jsonify({
                    "status": "password_required",
                    "message": "Для перегляду seed-фрази потрібно ввести пароль"
                })

            return jsonify(result)

        except Exception as e:
            logger.error(f"get_user_seed_phrase: Помилка отримання seed-фрази користувача {telegram_id}: {str(e)}")
            return jsonify({"status": "error", "message": str(e)}), 500