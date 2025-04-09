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

# Отримуємо список адміністраторів з середовища
ADMIN_IDS = []
ADMIN_IDS_STR = os.getenv("ADMIN_IDS", "")
if ADMIN_IDS_STR:
    ADMIN_IDS = ADMIN_IDS_STR.split(",")
    logger.info(f"Завантажено список адміністраторів: {ADMIN_IDS}")
else:
    logger.warning("УВАГА: Не налаштовано ADMIN_IDS у змінних середовища!")


def check_admin_auth(telegram_id):
    """Перевірка, чи користувач є адміністратором"""
    if not ADMIN_IDS:
        logger.error("Спроба перевірки адмін-прав при відсутності налаштованого ADMIN_IDS!")
        return False

    return str(telegram_id) in ADMIN_IDS


def admin_get_users():
    """Отримання списку користувачів (тільки для адміністраторів)"""
    try:
        # Отримуємо ID адміністратора з заголовка
        admin_id = request.headers.get('X-Admin-Id')

        if not admin_id or not check_admin_auth(admin_id):
            logger.warning(f"admin_get_users: Спроба неавторизованого доступу з ID {admin_id}")
            return jsonify({"status": "error", "message": "Доступ заборонено"}), 403

        # Отримуємо параметри з запиту
        limit = int(request.args.get('limit', 50))
        offset = int(request.args.get('offset', 0))
        sort_by = request.args.get('sort', 'balance')
        sort_order = request.args.get('order', 'desc')

        # Перевірка і обмеження параметрів
        if limit > 100:
            limit = 100

        if sort_by not in ['balance', 'username', 'created_at']:
            sort_by = 'balance'

        if sort_order not in ['asc', 'desc']:
            sort_order = 'desc'

        # Отримуємо користувачів з обмеженням кількості
        try:
            users_query = supabase.table("winix").select("*").order(sort_by, desc=(sort_order == 'desc')).limit(
                limit).offset(offset)
            users_res = users_query.execute()
            users = users_res.data if users_res.data else []
        except Exception as e:
            logger.error(f"admin_get_users: Помилка запиту до Supabase: {str(e)}")
            return jsonify({"status": "error", "message": f"Помилка бази даних: {str(e)}"}), 500

        # Підраховуємо загальну кількість для пагінації
        try:
            count_res = supabase.table("winix").select("count", count="exact").execute()
            total_count = count_res.count if hasattr(count_res, 'count') else len(users)
        except Exception as e:
            logger.error(f"admin_get_users: Помилка підрахунку користувачів: {str(e)}")
            total_count = len(users)

        return jsonify({
            "status": "success",
            "data": users,
            "pagination": {
                "total": total_count,
                "limit": limit,
                "offset": offset
            }
        })
    except Exception as e:
        logger.error(f"admin_get_users: Помилка отримання списку користувачів: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500


def admin_get_user(user_id):
    """Отримання даних конкретного користувача (тільки для адміністраторів)"""
    try:
        # Отримуємо ID адміністратора з заголовка
        admin_id = request.headers.get('X-Admin-Id')

        if not admin_id or not check_admin_auth(admin_id):
            logger.warning(f"admin_get_user: Спроба неавторизованого доступу з ID {admin_id}")
            return jsonify({"status": "error", "message": "Доступ заборонено"}), 403

        # Перетворюємо user_id в рядок для консистентності
        user_id = str(user_id)

        # Отримуємо дані користувача
        user = get_user(user_id)

        if not user:
            return jsonify({"status": "error", "message": "Користувача не знайдено"}), 404

        # Додаємо розширені дані для адміністратора
        try:
            # Отримуємо транзакції
            transactions_query = supabase.table("transactions").select("*").eq("telegram_id", user_id).order(
                "created_at", desc=True).limit(10).execute()
            recent_transactions = transactions_query.data if transactions_query.data else []

            # Отримуємо стейкінг
            staking_query = supabase.table("staking_sessions").select("*").eq("user_id", user_id).eq("is_active",
                                                                                                     True).execute()
            active_staking = staking_query.data[0] if staking_query.data else None

            # Додаємо статистику в дані користувача
            user["recent_transactions"] = recent_transactions
            user["active_staking"] = active_staking

            # Додаємо адміністративну інформацію
            user["is_admin"] = check_admin_auth(user_id)
            user["admin_note"] = user.get("admin_note", "")
        except Exception as e:
            logger.error(f"admin_get_user: Помилка отримання розширених даних: {str(e)}")
            # Продовжуємо без розширених даних

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
            logger.warning(f"admin_update_user: Спроба неавторизованого доступу з ID {admin_id}")
            return jsonify({"status": "error", "message": "Доступ заборонено"}), 403

        if not data:
            return jsonify({"status": "error", "message": "Відсутні дані для оновлення"}), 400

        # Перетворюємо user_id в рядок для консистентності
        user_id = str(user_id)

        # Отримуємо користувача для перевірки
        user = get_user(user_id)

        if not user:
            return jsonify({"status": "error", "message": "Користувача не знайдено"}), 404

        # Список дозволених полів для оновлення
        allowed_fields = [
            "username", "balance", "coins", "admin_note",
            "badge_beginner", "badge_winner", "badge_rich",
            "badge_beginner_reward_claimed", "badge_winner_reward_claimed", "badge_rich_reward_claimed",
            "referral_code", "referrer_id", "is_blocked", "blocked_reason", "language"
        ]

        # Фільтруємо недозволені поля
        filtered_data = {k: v for k, v in data.items() if k in allowed_fields}

        if not filtered_data:
            return jsonify({"status": "error", "message": "Немає дозволених полів для оновлення"}), 400

        # Перевіряємо, чи змінюється баланс
        if "balance" in filtered_data:
            try:
                new_balance = float(filtered_data["balance"])
                old_balance = float(user.get("balance", 0))
                difference = new_balance - old_balance

                if difference != 0:
                    # Створюємо детальний опис транзакції
                    transaction = {
                        "telegram_id": user_id,
                        "type": "admin_adjustment",
                        "amount": difference,
                        "description": f"Коригування балансу адміністратором (ID: {admin_id})",
                        "status": "completed",
                        "created_at": datetime.now().isoformat(),
                        "admin_id": admin_id,
                        "previous_balance": old_balance
                    }

                    # Створюємо транзакцію
                    transaction_res = supabase.table("transactions").insert(transaction).execute()

                    if not transaction_res.data:
                        logger.warning(
                            f"admin_update_user: Не вдалося створити транзакцію при зміні балансу для {user_id}")
            except Exception as e:
                logger.error(f"admin_update_user: Помилка обробки зміни балансу: {str(e)}")
                return jsonify({"status": "error", "message": f"Помилка обробки зміни балансу: {str(e)}"}), 500

        # Оновлюємо дані користувача
        try:
            updated_user = update_user(user_id, filtered_data)

            if not updated_user:
                return jsonify({"status": "error", "message": "Помилка оновлення даних користувача"}), 500
        except Exception as e:
            logger.error(f"admin_update_user: Помилка оновлення даних в Supabase: {str(e)}")
            return jsonify({"status": "error", "message": f"Помилка бази даних: {str(e)}"}), 500

        # Логуємо дію
        logger.info(f"admin_update_user: Адміністратор {admin_id} оновив дані користувача {user_id}: {filtered_data}")

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
            logger.warning(f"admin_create_transaction: Спроба неавторизованого доступу з ID {admin_id}")
            return jsonify({"status": "error", "message": "Доступ заборонено"}), 403

        if not data or "type" not in data or "amount" not in data:
            return jsonify({"status": "error", "message": "Відсутні необхідні дані транзакції"}), 400

        # Перетворюємо user_id в рядок для консистентності
        user_id = str(user_id)

        # Отримуємо користувача для перевірки
        user = get_user(user_id)

        if not user:
            return jsonify({"status": "error", "message": "Користувача не знайдено"}), 404

        # Валідація типу транзакції
        valid_types = ["reward", "fee", "send", "receive", "stake", "unstake", "admin_adjustment"]
        if data["type"] not in valid_types:
            return jsonify({"status": "error",
                            "message": f"Недопустимий тип транзакції. Дозволені типи: {', '.join(valid_types)}"}), 400

        # Валідація суми
        try:
            amount = float(data["amount"])
        except (ValueError, TypeError):
            return jsonify({"status": "error", "message": "Некоректний формат суми"}), 400

        # Тип транзакції впливає на знак суми
        if data["type"] in ["send", "fee", "stake"] and amount > 0:
            # Для видаткових операцій сума має бути від'ємною
            amount = -amount
        elif data["type"] in ["receive", "reward", "unstake"] and amount < 0:
            # Для прибуткових операцій сума має бути додатньою
            amount = -amount

        # Додаємо додаткові поля в транзакцію
        transaction_data = data.copy()
        transaction_data["telegram_id"] = user_id
        transaction_data["admin_id"] = admin_id
        transaction_data["created_at"] = datetime.now().isoformat()
        transaction_data["status"] = "completed"
        transaction_data["amount"] = amount  # Оновлена сума з правильним знаком

        if "description" not in transaction_data:
            transaction_data["description"] = f"Транзакція створена адміністратором (ID: {admin_id})"

        # Транзакційний блок
        try:
            # 1. Спочатку зберігаємо транзакцію
            transaction_res = supabase.table("transactions").insert(transaction_data).execute()
            if not transaction_res.data:
                return jsonify({"status": "error", "message": "Помилка створення транзакції"}), 500

            transaction = transaction_res.data[0]

            # 2. Оновлюємо баланс користувача, якщо потрібно
            current_balance = float(user.get("balance", 0))
            new_balance = current_balance + amount

            if new_balance < 0:
                # Скасовуємо транзакцію, якщо баланс стає від'ємним
                supabase.table("transactions").delete().eq("id", transaction["id"]).execute()
                return jsonify({"status": "error",
                                "message": f"Недостатньо коштів на балансі користувача. Поточний баланс: {current_balance}"}), 400

            balance_update = update_user(user_id, {"balance": new_balance})

            if not balance_update:
                # Скасовуємо транзакцію, якщо не вдалося оновити баланс
                supabase.table("transactions").delete().eq("id", transaction["id"]).execute()
                return jsonify({"status": "error", "message": "Помилка оновлення балансу користувача"}), 500
        except Exception as e:
            logger.error(f"admin_create_transaction: Помилка в транзакційному блоці: {str(e)}")
            return jsonify({"status": "error", "message": f"Помилка бази даних: {str(e)}"}), 500

        # Логуємо дію
        logger.info(
            f"admin_create_transaction: Адміністратор {admin_id} створив транзакцію для {user_id} на суму {amount}")

        return jsonify({
            "status": "success",
            "message": "Транзакцію успішно створено",
            "data": {
                "transaction": transaction,
                "newBalance": new_balance
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
            logger.warning(f"admin_get_transactions: Спроба неавторизованого доступу з ID {admin_id}")
            return jsonify({"status": "error", "message": "Доступ заборонено"}), 403

        # Отримуємо параметри фільтрації
        limit = int(request.args.get('limit', 50))
        offset = int(request.args.get('offset', 0))
        user_id = request.args.get('user_id')
        type_filter = request.args.get('type')

        # Обмеження на параметри
        if limit > 100:
            limit = 100

        # Конструюємо запит
        query = supabase.table("transactions").select("*").order("created_at", desc=True).limit(limit).offset(offset)

        # Додаємо фільтр по користувачу, якщо вказаний
        if user_id:
            query = query.eq("telegram_id", user_id)

        # Додаємо фільтр по типу транзакції, якщо вказаний
        if type_filter:
            query = query.eq("type", type_filter)

        # Виконуємо запит
        try:
            transactions_res = query.execute()
            transactions = transactions_res.data if transactions_res.data else []
        except Exception as e:
            logger.error(f"admin_get_transactions: Помилка запиту до Supabase: {str(e)}")
            return jsonify({"status": "error", "message": f"Помилка бази даних: {str(e)}"}), 500

        # Отримуємо загальну кількість для пагінації
        try:
            count_query = supabase.table("transactions").select("count", count="exact")

            if user_id:
                count_query = count_query.eq("telegram_id", user_id)

            if type_filter:
                count_query = count_query.eq("type", type_filter)

            count_res = count_query.execute()
            total_count = count_res.count if hasattr(count_res, 'count') else len(transactions)
        except Exception as e:
            logger.error(f"admin_get_transactions: Помилка підрахунку транзакцій: {str(e)}")
            total_count = len(transactions)

        return jsonify({
            "status": "success",
            "data": transactions,
            "pagination": {
                "limit": limit,
                "offset": offset,
                "total": total_count
            }
        })
    except Exception as e:
        logger.error(f"admin_get_transactions: Помилка отримання транзакцій: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500