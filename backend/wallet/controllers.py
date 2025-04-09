from flask import jsonify, request
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
from supabase_client import get_user, update_user, update_balance, update_coins, supabase

# Налаштування логування
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Імпортуємо допоміжні функції для транзакцій
try:
    from utils.transaction_helpers import create_transaction_record, update_transaction_status
except ImportError:
    # Тимчасова функція для створення транзакції
    def create_transaction_record(telegram_id, type_name, amount, description,
                                  status="pending", extra_data=None):
        try:
            transaction_data = {
                "id": str(uuid.uuid4()),
                "telegram_id": telegram_id,
                "type": type_name,
                "amount": amount,
                "description": description,
                "status": status,
                "created_at": datetime.now().isoformat()
            }
            if extra_data:
                transaction_data.update(extra_data)

            transaction_res = supabase.table("transactions").insert(transaction_data).execute()

            if transaction_res.data:
                return transaction_res.data[0], transaction_res.data[0].get("id")
            else:
                return transaction_data, transaction_data.get("id")

        except Exception as e:
            logger.error(f"create_transaction_record: Помилка створення запису транзакції: {str(e)}")
            return None, None


    # Тимчасова функція для оновлення статусу транзакції
    def update_transaction_status(transaction_id, status):
        try:
            if not transaction_id:
                return False

            result = supabase.table("transactions").update({"status": status}).eq("id", transaction_id).execute()
            return bool(result and result.data)
        except Exception as e:
            logger.error(f"update_transaction_status: Помилка оновлення статусу транзакції {transaction_id}: {str(e)}")
            return False


def get_user_complete_balance(telegram_id):
    """Отримання повної інформації про баланс користувача"""
    try:
        user = get_user(telegram_id)

        if not user:
            return jsonify({
                "status": "error",
                "message": "Користувача не знайдено"
            }), 404

        # Формуємо розширені дані про баланс
        balance_data = {
            "balance": float(user.get("balance", 0)),
            "coins": int(user.get("coins", 0)),
            "in_staking": float(user.get("staking_amount", 0)),
            "expected_rewards": float(user.get("staking_expected_reward", 0)),
            "last_updated": datetime.now().isoformat()
        }

        return jsonify({
            "status": "success",
            "data": balance_data
        })
    except Exception as e:
        logger.error(f"get_user_complete_balance: Помилка отримання балансу користувача {telegram_id}: {str(e)}")
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500


def add_tokens(telegram_id, data):
    """Додавання токенів до балансу користувача"""
    try:
        if not data or 'amount' not in data:
            return jsonify({
                "status": "error",
                "message": "Відсутня кількість токенів"
            }), 400

        try:
            amount = float(data['amount'])
            if amount <= 0:
                return jsonify({
                    "status": "error",
                    "message": "Сума повинна бути більше нуля"
                }), 400
        except (ValueError, TypeError):
            return jsonify({
                "status": "error",
                "message": "Некоректний формат суми"
            }), 400

        description = data.get('description', 'Додавання токенів')

        user = get_user(telegram_id)
        if not user:
            return jsonify({
                "status": "error",
                "message": "Користувача не знайдено"
            }), 404

        current_balance = float(user.get("balance", 0))
        new_balance = current_balance + amount

        # Створюємо запис транзакції
        transaction_record, transaction_id = create_transaction_record(
            telegram_id=telegram_id,
            type_name="receive",
            amount=amount,
            description=description,
            status="pending"
        )

        if not transaction_record:
            return jsonify({
                "status": "error",
                "message": "Помилка створення транзакції"
            }), 500

        # Оновлюємо баланс
        update_result = update_user(telegram_id, {"balance": new_balance})

        if not update_result:
            # Якщо оновлення балансу не вдалося, позначаємо транзакцію як помилкову
            update_transaction_status(transaction_id, "failed")
            logger.error(f"add_tokens: Помилка оновлення балансу для {telegram_id}")
            return jsonify({
                "status": "error",
                "message": "Помилка оновлення балансу"
            }), 500

        # Оновлюємо статус транзакції на "завершено"
        update_transaction_status(transaction_id, "completed")

        return jsonify({
            "status": "success",
            "message": f"Додано {amount} WINIX",
            "data": {
                "previous_balance": current_balance,
                "new_balance": new_balance
            }
        })
    except Exception as e:
        logger.error(f"add_tokens: Помилка додавання токенів для {telegram_id}: {str(e)}")
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500


def subtract_tokens(telegram_id, data):
    """Віднімання токенів з балансу користувача"""
    try:
        if not data or 'amount' not in data:
            return jsonify({
                "status": "error",
                "message": "Відсутня кількість токенів"
            }), 400

        try:
            amount = float(data['amount'])
            if amount <= 0:
                return jsonify({
                    "status": "error",
                    "message": "Сума повинна бути більше нуля"
                }), 400
        except (ValueError, TypeError):
            return jsonify({
                "status": "error",
                "message": "Некоректний формат суми"
            }), 400

        description = data.get('description', 'Віднімання токенів')

        user = get_user(telegram_id)
        if not user:
            return jsonify({
                "status": "error",
                "message": "Користувача не знайдено"
            }), 404

        current_balance = float(user.get("balance", 0))

        # Перевірка достатності коштів
        if current_balance < amount:
            return jsonify({
                "status": "error",
                "message": f"Недостатньо коштів. Поточний баланс: {current_balance} WINIX"
            }), 400

        new_balance = current_balance - amount

        # Створюємо запис транзакції
        transaction_record, transaction_id = create_transaction_record(
            telegram_id=telegram_id,
            type_name="send",
            amount=-amount,  # Від'ємна сума для віднімання
            description=description,
            status="pending"
        )

        if not transaction_record:
            return jsonify({
                "status": "error",
                "message": "Помилка створення транзакції"
            }), 500

        # Оновлюємо баланс
        update_result = update_user(telegram_id, {"balance": new_balance})

        if not update_result:
            # Позначаємо транзакцію як помилкову
            update_transaction_status(transaction_id, "failed")
            logger.error(f"subtract_tokens: Помилка оновлення балансу для {telegram_id}")
            return jsonify({
                "status": "error",
                "message": "Помилка оновлення балансу"
            }), 500

        # Оновлюємо статус транзакції
        update_transaction_status(transaction_id, "completed")

        return jsonify({
            "status": "success",
            "message": f"Віднято {amount} WINIX",
            "data": {
                "previous_balance": current_balance,
                "new_balance": new_balance
            }
        })
    except Exception as e:
        logger.error(f"subtract_tokens: Помилка віднімання токенів для {telegram_id}: {str(e)}")
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500


def add_coins(telegram_id, data):
    """Додавання жетонів до балансу користувача"""
    try:
        if not data or 'amount' not in data:
            return jsonify({
                "status": "error",
                "message": "Відсутня кількість жетонів"
            }), 400

        try:
            amount = int(data['amount'])
            if amount <= 0:
                return jsonify({
                    "status": "error",
                    "message": "Кількість жетонів повинна бути більше нуля"
                }), 400
        except (ValueError, TypeError):
            return jsonify({
                "status": "error",
                "message": "Некоректний формат кількості жетонів"
            }), 400

        user = get_user(telegram_id)
        if not user:
            return jsonify({
                "status": "error",
                "message": "Користувача не знайдено"
            }), 404

        current_coins = int(user.get("coins", 0))
        new_coins = current_coins + amount

        # Оновлення жетонів в БД
        update_result = update_user(telegram_id, {"coins": new_coins})

        if not update_result:
            return jsonify({
                "status": "error",
                "message": "Помилка оновлення жетонів"
            }), 500

        return jsonify({
            "status": "success",
            "message": f"Додано {amount} жетонів",
            "data": {
                "previous_coins": current_coins,
                "new_coins": new_coins
            }
        })
    except Exception as e:
        logger.error(f"add_coins: Помилка додавання жетонів для {telegram_id}: {str(e)}")
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500


def subtract_coins(telegram_id, data):
    """Віднімання жетонів з балансу користувача"""
    try:
        if not data or 'amount' not in data:
            return jsonify({
                "status": "error",
                "message": "Відсутня кількість жетонів"
            }), 400

        try:
            amount = int(data['amount'])
            if amount <= 0:
                return jsonify({
                    "status": "error",
                    "message": "Кількість жетонів повинна бути більше нуля"
                }), 400
        except (ValueError, TypeError):
            return jsonify({
                "status": "error",
                "message": "Некоректний формат кількості жетонів"
            }), 400

        user = get_user(telegram_id)
        if not user:
            return jsonify({
                "status": "error",
                "message": "Користувача не знайдено"
            }), 404

        current_coins = int(user.get("coins", 0))

        # Перевірка достатності жетонів
        if current_coins < amount:
            return jsonify({
                "status": "error",
                "message": f"Недостатньо жетонів. Поточний баланс: {current_coins} жетонів"
            }), 400

        new_coins = current_coins - amount

        # Оновлення жетонів в БД
        update_result = update_user(telegram_id, {"coins": new_coins})

        if not update_result:
            return jsonify({
                "status": "error",
                "message": "Помилка оновлення жетонів"
            }), 500

        return jsonify({
            "status": "success",
            "message": f"Віднято {amount} жетонів",
            "data": {
                "previous_coins": current_coins,
                "new_coins": new_coins
            }
        })
    except Exception as e:
        logger.error(f"subtract_coins: Помилка віднімання жетонів для {telegram_id}: {str(e)}")
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500


def convert_coins_to_tokens(telegram_id, data):
    """Конвертація жетонів у токени"""
    try:
        if not data or 'coins_amount' not in data:
            return jsonify({
                "status": "error",
                "message": "Відсутня кількість жетонів для конвертації"
            }), 400

        try:
            coins_amount = int(data['coins_amount'])
            if coins_amount <= 0:
                return jsonify({
                    "status": "error",
                    "message": "Кількість жетонів повинна бути більше нуля"
                }), 400
        except (ValueError, TypeError):
            return jsonify({
                "status": "error",
                "message": "Некоректний формат кількості жетонів"
            }), 400

        # Константа для конвертації жетонів у токени
        COIN_TO_TOKEN_RATIO = 10  # 1 жетон = 10 WINIX

        user = get_user(telegram_id)
        if not user:
            return jsonify({
                "status": "error",
                "message": "Користувача не знайдено"
            }), 404

        current_coins = int(user.get("coins", 0))
        current_balance = float(user.get("balance", 0))

        # Перевірка достатності жетонів
        if current_coins < coins_amount:
            return jsonify({
                "status": "error",
                "message": f"Недостатньо жетонів. Поточний баланс: {current_coins} жетонів"
            }), 400

        # Розрахунок токенів для нарахування
        tokens_to_add = coins_amount * COIN_TO_TOKEN_RATIO

        # Створюємо запис транзакції
        description = f'Конвертація {coins_amount} жетонів у {tokens_to_add} WINIX'
        transaction_record, transaction_id = create_transaction_record(
            telegram_id=telegram_id,
            type_name="receive",
            amount=tokens_to_add,
            description=description,
            status="pending"
        )

        if not transaction_record:
            return jsonify({
                "status": "error",
                "message": "Помилка створення транзакції"
            }), 500

        # Оновлення в БД через транзакцію
        try:
            # Створюємо і виконуємо пакетне оновлення
            new_coins = current_coins - coins_amount
            new_balance = current_balance + tokens_to_add

            update_result = update_user(telegram_id, {
                "coins": new_coins,
                "balance": new_balance
            })

            if not update_result:
                # Якщо оновлення не вдалося, позначаємо транзакцію як помилкову
                update_transaction_status(transaction_id, "failed")
                return jsonify({
                    "status": "error",
                    "message": "Помилка оновлення балансу та жетонів"
                }), 500

            # Оновлюємо статус транзакції на "завершено"
            update_transaction_status(transaction_id, "completed")

            return jsonify({
                "status": "success",
                "message": f"Конвертовано {coins_amount} жетонів у {tokens_to_add} WINIX",
                "data": {
                    "coins_converted": coins_amount,
                    "tokens_received": tokens_to_add,
                    "new_coins_balance": new_coins,
                    "new_tokens_balance": new_balance
                }
            })
        except Exception as e:
            logger.error(f"convert_coins_to_tokens: Помилка оновлення балансу: {str(e)}")
            # Тут можна додати логіку відкату транзакції
            return jsonify({
                "status": "error",
                "message": "Помилка конвертації: " + str(e)
            }), 500
    except Exception as e:
        logger.error(f"convert_coins_to_tokens: Помилка конвертації жетонів для {telegram_id}: {str(e)}")
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500


def check_sufficient_funds(telegram_id, data):
    """Перевірка достатності коштів для транзакції"""
    try:
        if not data or 'amount' not in data:
            return jsonify({
                "status": "error",
                "message": "Відсутня сума для перевірки"
            }), 400

        try:
            amount = float(data['amount'])
            if amount <= 0:
                return jsonify({
                    "status": "error",
                    "message": "Сума повинна бути більше нуля"
                }), 400
        except (ValueError, TypeError):
            return jsonify({
                "status": "error",
                "message": "Некоректний формат суми"
            }), 400

        type = data.get('type', 'tokens')  # 'tokens' або 'coins'

        user = get_user(telegram_id)
        if not user:
            return jsonify({
                "status": "error",
                "message": "Користувача не знайдено"
            }), 404

        if type == 'tokens':
            current_balance = float(user.get("balance", 0))
            has_sufficient_funds = current_balance >= amount

            return jsonify({
                "status": "success",
                "data": {
                    "has_sufficient_funds": has_sufficient_funds,
                    "current_balance": current_balance,
                    "required_amount": amount,
                    "missing_amount": max(0, amount - current_balance)
                }
            })
        elif type == 'coins':
            current_coins = int(user.get("coins", 0))
            has_sufficient_funds = current_coins >= amount

            return jsonify({
                "status": "success",
                "data": {
                    "has_sufficient_funds": has_sufficient_funds,
                    "current_balance": current_coins,
                    "required_amount": amount,
                    "missing_amount": max(0, amount - current_coins)
                }
            })
        else:
            return jsonify({
                "status": "error",
                "message": "Невідомий тип балансу для перевірки"
            }), 400
    except Exception as e:
        logger.error(f"check_sufficient_funds: Помилка перевірки коштів для {telegram_id}: {str(e)}")
        return jsonify({
            "status": "error",
            "message": str(e)
        }), 500