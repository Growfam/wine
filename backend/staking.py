from flask import jsonify, request
from supabase_client import supabase, get_user, update_user
import logging
import uuid
import time
from datetime import datetime, timedelta
import json
import math

# Налаштування логування
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Константи для відсотків стейкінгу за різні періоди
STAKING_REWARD_RATES = {
    7: 4,  # 4% за 7 днів
    14: 9,  # 9% за 14 днів
    28: 15  # 15% за 28 днів
}

# Мінімальна сума стейкінгу
MIN_STAKING_AMOUNT = 50


def validate_staking_amount(telegram_id, amount):
    """
    Валідація суми стейкінгу
    """
    try:
        # Перетворимо на float і переконаємось, що це число
        try:
            amount = float(amount)
        except (ValueError, TypeError):
            return {'success': False, 'message': 'Некоректна сума стейкінгу'}

        # Перевірка на позитивне число
        if amount <= 0:
            return {'success': False, 'message': 'Сума стейкінгу має бути більше нуля'}

        # Перевірка на ціле число
        if amount != int(amount):
            return {'success': False, 'message': 'Сума стейкінгу має бути цілим числом'}

        amount = int(amount)  # Переконаємось, що використовуємо int

        # Отримуємо користувача для перевірки балансу
        user = get_user(telegram_id)
        if not user:
            return {'success': False, 'message': 'Користувача не знайдено'}

        # Отримуємо поточний баланс і конвертуємо в int
        current_balance = int(float(user.get('balance', 0)))

        # Перевірка на мінімальну суму
        if amount < MIN_STAKING_AMOUNT:
            return {'success': False, 'message': f'Мінімальна сума стейкінгу: {MIN_STAKING_AMOUNT} WINIX'}

        # Перевірка на достатність коштів
        if amount > current_balance:
            return {'success': False, 'message': f'Недостатньо коштів. Ваш баланс: {current_balance} WINIX'}

        return {'success': True, 'message': ''}
    except Exception as e:
        logger.error(f"validate_staking_amount: Помилка валідації: {str(e)}")
        return {'success': False, 'message': 'Помилка валідації суми стейкінгу'}


def calculate_staking_reward(amount, period):
    """Розрахунок очікуваної винагороди за стейкінг"""
    try:
        # Перевірка параметрів і перетворення на числа
        amount = float(amount)
        period = int(period)

        if amount <= 0 or period <= 0:
            return 0

        # Перевірка, що сума є цілим числом
        if amount != int(amount):
            amount = int(amount)  # Округляємо до цілого
            logger.warning("calculate_staking_reward: Сума не була цілим числом, округлено")

        # Визначаємо відсоток на основі періоду
        reward_percent = STAKING_REWARD_RATES.get(period, 9)  # За замовчуванням 9%

        # Розраховуємо винагороду
        reward = amount * (reward_percent / 100)

        return round(reward, 2)
    except Exception as e:
        logger.error(f"calculate_staking_reward: Помилка розрахунку: {str(e)}")
        return 0


def parse_date(date_str):
    """Універсальний парсер дати, який обробляє різні формати"""
    try:
        # Спочатку пробуємо ISO формат з обробкою часової зони
        return datetime.fromisoformat(date_str.replace('Z', '+00:00'))
    except ValueError:
        try:
            # Пробуємо формат з мілісекундами
            return datetime.strptime(date_str, "%Y-%m-%dT%H:%M:%S.%f")
        except ValueError:
            try:
                # Пробуємо формат без мілісекунд
                return datetime.strptime(date_str, "%Y-%m-%dT%H:%M:%S")
            except ValueError:
                # Якщо нічого не допомогло, повертаємо поточну дату
                logger.error(f"parse_date: Неможливо розпарсити дату: {date_str}")
                return datetime.now()


def get_user_staking(telegram_id):
    """Отримання даних стейкінгу користувача"""
    try:
        # Отримуємо користувача з Supabase
        user = get_user(telegram_id)

        if not user:
            logger.warning(f"get_user_staking: Користувача {telegram_id} не знайдено")
            return jsonify({"status": "error", "message": "Користувача не знайдено"}), 404

        # Отримуємо дані стейкінгу
        staking_data = user.get("staking_data", {})

        # Якщо немає даних стейкінгу або немає активного стейкінгу, повертаємо порожній об'єкт
        if not staking_data or not staking_data.get("hasActiveStaking", False):
            staking_data = {
                "hasActiveStaking": False,
                "stakingAmount": 0,
                "period": 0,
                "rewardPercent": 0,
                "expectedReward": 0,
                "remainingDays": 0
            }
            return jsonify({"status": "success", "data": staking_data})

        # Якщо є активний стейкінг, оновлюємо remainingDays
        if staking_data.get("endDate"):
            end_date = parse_date(staking_data.get("endDate"))
            now = datetime.now()

            # Оновлюємо залишок днів
            remaining_days = max(0, (end_date - now).days)
            staking_data["remainingDays"] = remaining_days

            # Якщо стейкінг закінчився, автоматично фіналізуємо його
            if now >= end_date:
                logger.info(f"get_user_staking: Автоматичне завершення стейкінгу {staking_data.get('stakingId')}")

                # Отримуємо суму стейкінгу та очікувану винагороду
                staking_amount = float(staking_data.get("stakingAmount", 0))
                expected_reward = float(staking_data.get("expectedReward", 0))
                total_amount = staking_amount + expected_reward

                # Нараховуємо загальну суму на баланс
                current_balance = float(user.get("balance", 0))
                new_balance = current_balance + total_amount

                # Оновлюємо дані стейкінгу для історії
                staking_data["status"] = "completed"
                staking_data["hasActiveStaking"] = False
                staking_data["completedDate"] = datetime.now().isoformat()

                # Зберігаємо дані в історії стейкінгу
                staking_history = user.get("staking_history", [])
                staking_history.append(staking_data.copy())

                # Скасовуємо стейкінг
                empty_staking = {
                    "hasActiveStaking": False,
                    "stakingAmount": 0,
                    "period": 0,
                    "rewardPercent": 0,
                    "expectedReward": 0,
                    "remainingDays": 0
                }

                # Оновлюємо дані користувача
                result = update_user(telegram_id, {
                    "balance": new_balance,
                    "staking_data": empty_staking,
                    "staking_history": staking_history
                })

                # Додаємо транзакцію про завершення стейкінгу
                try:
                    transaction = {
                        "telegram_id": telegram_id,
                        "type": "unstake",
                        "amount": total_amount,
                        "description": f"Стейкінг завершено: {staking_amount} + {expected_reward} винагорода (ID: {staking_data.get('stakingId')})",
                        "status": "completed"
                    }

                    if supabase:
                        supabase.table("transactions").insert(transaction).execute()
                except Exception as e:
                    logger.error(f"get_user_staking: Помилка при створенні транзакції: {str(e)}")

                # Повертаємо порожній стейкінг з флагом автоматичного завершення
                empty_staking["autoCompleted"] = True
                empty_staking["reward"] = expected_reward
                empty_staking["stakingAmount"] = staking_amount

                return jsonify({"status": "success", "data": empty_staking})

            # Якщо стейкінг ще не закінчився, оновлюємо дані
            update_user(telegram_id, {"staking_data": staking_data})

        return jsonify({"status": "success", "data": staking_data})
    except Exception as e:
        logger.error(f"get_user_staking: Помилка отримання даних стейкінгу користувача {telegram_id}: {str(e)}",
                     exc_info=True)
        return jsonify({"status": "error", "message": str(e)}), 500


def create_user_staking(telegram_id, data):
    """Створення стейкінгу користувача"""
    try:
        if not data:
            return jsonify({"status": "error", "message": "Відсутні дані стейкінгу"}), 400

        # Перевіряємо мінімальні необхідні поля
        if "stakingAmount" not in data or "period" not in data:
            return jsonify({"status": "error", "message": "Відсутні обов'язкові поля: stakingAmount та period"}), 400

        # Сума стейкінгу як ціле число
        try:
            staking_amount = float(data.get("stakingAmount", 0))
            # Перевірка, що сума є цілим числом
            if staking_amount != int(staking_amount):
                return jsonify({"status": "error", "message": "Сума стейкінгу має бути цілим числом"}), 400
            # Конвертуємо до цілого числа
            staking_amount = int(staking_amount)
        except (ValueError, TypeError):
            return jsonify({"status": "error", "message": "Некоректна сума стейкінгу"}), 400

        # Період стейкінгу
        try:
            period = int(data.get("period", 14))
            if period not in STAKING_REWARD_RATES:
                return jsonify({"status": "error",
                                "message": f"Некоректний період стейкінгу. Доступні періоди: {', '.join(map(str, STAKING_REWARD_RATES.keys()))}"}), 400
        except (ValueError, TypeError):
            return jsonify({"status": "error", "message": "Некоректний період стейкінгу"}), 400

        # Отримуємо поточний баланс користувача для перевірки
        user = get_user(telegram_id)
        if not user:
            logger.warning(f"create_user_staking: Користувача {telegram_id} не знайдено")
            return jsonify({"status": "error", "message": "Користувача не знайдено"}), 404

        # Перевіряємо наявність активного стейкінгу
        current_staking = user.get("staking_data", {})
        if current_staking and current_staking.get("hasActiveStaking") == True:
            return jsonify({"status": "error", "message": "У вас вже є активний стейкінг"}), 400

        # Валідація суми стейкінгу
        validation_result = validate_staking_amount(telegram_id, staking_amount)
        if not validation_result['success']:
            return jsonify({"status": "error", "message": validation_result['message']}), 400

        # Отримуємо поточний баланс
        current_balance = float(user.get("balance", 0))

        # Визначаємо відсоток відповідно до періоду
        reward_percent = STAKING_REWARD_RATES[period]
        data["rewardPercent"] = reward_percent

        # Розраховуємо очікувану винагороду
        expected_reward = calculate_staking_reward(staking_amount, period)
        data["expectedReward"] = expected_reward

        # Встановлюємо обов'язкові значення
        data["hasActiveStaking"] = True
        data["status"] = "active"
        data["creationTimestamp"] = int(time.time() * 1000)
        data["stakingAmount"] = staking_amount

        # Якщо це новий стейкінг, генеруємо унікальний ID
        if "stakingId" not in data:
            data["stakingId"] = f"st-{uuid.uuid4().hex[:12]}"

        # Встановлюємо дати
        now = datetime.now()
        data["startDate"] = now.isoformat()

        # Розраховуємо дату закінчення на основі періоду
        end_date = now + timedelta(days=period)
        data["endDate"] = end_date.isoformat()

        # Розраховуємо залишок днів
        data["remainingDays"] = period

        # Знімаємо кошти з рахунку користувача
        new_balance = current_balance - staking_amount

        # Оновлюємо баланс користувача та створюємо стейкінг
        try:
            # Оновлюємо дані користувача (баланс і дані стейкінгу)
            result = update_user(telegram_id, {"balance": new_balance, "staking_data": data})

            if not result:
                logger.error(f"create_user_staking: Помилка оновлення даних користувача")
                return jsonify({"status": "error", "message": "Помилка створення стейкінгу"}), 500

            # Додаємо транзакцію
            try:
                transaction = {
                    "telegram_id": telegram_id,
                    "type": "stake",
                    "amount": -staking_amount,
                    "description": f"Стейкінг на {data.get('period')} днів ({data.get('rewardPercent')}% прибутку) (ID: {data.get('stakingId')})",
                    "status": "completed"
                }

                if supabase:
                    transaction_res = supabase.table("transactions").insert(transaction).execute()
                    logger.info(f"create_user_staking: Транзакцію створено")
            except Exception as e:
                logger.error(f"create_user_staking: Помилка при створенні транзакції: {str(e)}")

            return jsonify({"status": "success", "data": {"staking": data, "balance": new_balance}})
        except Exception as e:
            logger.error(f"create_user_staking: Помилка при створенні стейкінгу: {str(e)}")
            return jsonify({"status": "error", "message": str(e)}), 500
    except Exception as e:
        logger.error(f"create_user_staking: Помилка створення стейкінгу користувача {telegram_id}: {str(e)}",
                     exc_info=True)
        return jsonify({"status": "error", "message": str(e)}), 500


def get_user_staking_history(telegram_id):
    """Отримання історії стейкінгу"""
    try:
        # Отримуємо користувача з Supabase
        user = get_user(telegram_id)

        if not user:
            logger.warning(f"get_user_staking_history: Користувача {telegram_id} не знайдено")
            return jsonify({"status": "error", "message": "Користувача не знайдено"}), 404

        # Отримуємо історію стейкінгу
        staking_history = user.get("staking_history", [])

        # Якщо історії немає, повертаємо порожній масив
        if not staking_history:
            staking_history = []

        return jsonify({"status": "success", "data": staking_history})
    except Exception as e:
        logger.error(
            f"get_user_staking_history: Помилка отримання історії стейкінгу користувача {telegram_id}: {str(e)}",
            exc_info=True)
        return jsonify({"status": "error", "message": str(e)}), 500