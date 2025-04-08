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
current_dir = os.path.dirname(os.path.abspath(__file__))  # папка wallet
parent_dir = os.path.dirname(current_dir)  # папка backend

# Використання importlib для імпорту модуля з абсолютного шляху
spec = importlib.util.spec_from_file_location("supabase_client", os.path.join(parent_dir, "supabase_client.py"))
supabase_client = importlib.util.module_from_spec(spec)
spec.loader.exec_module(supabase_client)

# Витягуємо необхідні функції з модуля
get_user = supabase_client.get_user
update_user = supabase_client.update_user
update_balance = supabase_client.update_balance
update_coins = supabase_client.update_coins
supabase = supabase_client.supabase

# Константи для конвертації жетонів
COIN_TO_TOKEN_RATIO = 10  # 1 жетон = 10 WINIX


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

        amount = float(data['amount'])
        description = data.get('description', 'Додавання токенів')

        user = get_user(telegram_id)
        if not user:
            return jsonify({
                "status": "error",
                "message": "Користувача не знайдено"
            }), 404

        current_balance = float(user.get("balance", 0))
        new_balance = current_balance + amount

        # Створення транзакції в БД
        from transactions.controllers import add_user_transaction
        transaction_data = {
            'type': 'receive',
            'amount': amount,
            'description': description
        }

        transaction_response, status_code = add_user_transaction(telegram_id, transaction_data)

        # Оновлення балансу в БД
        update_user(telegram_id, {"balance": new_balance})

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

        amount = float(data['amount'])
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

        # Створення транзакції в БД
        from transactions.controllers import add_user_transaction
        transaction_data = {
            'type': 'send',
            'amount': -amount,  # від'ємне значення для віднімання
            'description': description
        }

        transaction_response, status_code = add_user_transaction(telegram_id, transaction_data)

        # Оновлення балансу в БД
        update_user(telegram_id, {"balance": new_balance})

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

        amount = int(data['amount'])

        user = get_user(telegram_id)
        if not user:
            return jsonify({
                "status": "error",
                "message": "Користувача не знайдено"
            }), 404

        current_coins = int(user.get("coins", 0))
        new_coins = current_coins + amount

        # Оновлення жетонів в БД
        update_user(telegram_id, {"coins": new_coins})

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

        amount = int(data['amount'])

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
        update_user(telegram_id, {"coins": new_coins})

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

        coins_amount = int(data['coins_amount'])

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

        # Оновлення балансів
        new_coins = current_coins - coins_amount
        new_balance = current_balance + tokens_to_add

        # Оновлення в БД
        update_user(telegram_id, {
            "coins": new_coins,
            "balance": new_balance
        })

        # Створення транзакції
        from transactions.controllers import add_user_transaction
        transaction_data = {
            'type': 'receive',
            'amount': tokens_to_add,
            'description': f'Конвертація {coins_amount} жетонів у {tokens_to_add} WINIX'
        }

        add_user_transaction(telegram_id, transaction_data)

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

        amount = float(data['amount'])
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