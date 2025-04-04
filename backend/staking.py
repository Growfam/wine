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

# Штраф при скасуванні стейкінгу (20%)
STAKING_CANCELLATION_FEE = 0.2

# Константи для валідації стейкінгу
MIN_STAKING_AMOUNT = 50  # Мінімальна сума стейкінгу
MAX_STAKING_PERCENTAGE = 0.9  # Максимально дозволений відсоток балансу для стейкінгу


def validate_staking_amount(telegram_id, amount):
    """
    Валідація суми стейкінгу з усіма необхідними перевірками
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

        # Перевірка на максимально дозволений відсоток від балансу
        max_allowed_amount = int(current_balance * MAX_STAKING_PERCENTAGE)
        if amount > max_allowed_amount:
            return {'success': False,
                    'message': f'Максимальна сума: {max_allowed_amount} WINIX ({int(MAX_STAKING_PERCENTAGE * 100)}% від балансу)'}

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


def calculate_staking_reward_api(telegram_id):
    """API-ендпоінт для розрахунку очікуваної винагороди за стейкінг"""
    try:
        # Отримуємо параметри з запиту
        amount = request.args.get('amount', type=float)
        period = request.args.get('period', type=int)

        if amount is None or period is None:
            return jsonify({"status": "error", "message": "Відсутні параметри amount або period"}), 400

        # Перевірка, що сума є цілим числом
        if amount != int(amount):
            return jsonify({"status": "error", "message": "Сума стейкінгу має бути цілим числом"}), 400

        if amount <= 0:
            return jsonify({"status": "error", "message": "Сума стейкінгу повинна бути більше 0"}), 400

        if period not in STAKING_REWARD_RATES:
            return jsonify({"status": "error",
                            "message": f"Некоректний період стейкінгу. Доступні періоди: {', '.join(map(str, STAKING_REWARD_RATES.keys()))}"}), 400

        # Розраховуємо винагороду
        reward = calculate_staking_reward(amount, period)

        # Визначаємо відсоток для вказаного періоду
        reward_percent = STAKING_REWARD_RATES.get(period, 9)

        return jsonify({
            "status": "success",
            "data": {
                "reward": reward,
                "rewardPercent": reward_percent,
                "amount": int(amount),
                "period": period
            }
        })
    except Exception as e:
        logger.error(f"calculate_staking_reward_api: Помилка розрахунку винагороди для {telegram_id}: {str(e)}",
                     exc_info=True)
        return jsonify({"status": "error", "message": str(e)}), 500


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

        # Логуємо отримані дані для діагностики
        logger.info(f"get_user_staking: Отримані дані стейкінгу: {staking_data}")

        # Перевіряємо суперечності в даних стейкінгу
        if staking_data and staking_data.get("status") == "cancelled" and staking_data.get("hasActiveStaking") == True:
            logger.warning(f"get_user_staking: Виявлено суперечність: status='cancelled', але hasActiveStaking=True")
            # Виправляємо суперечність
            staking_data["hasActiveStaking"] = False
            # Оновлюємо дані користувача
            update_user(telegram_id, {"staking_data": staking_data})
            logger.info(f"get_user_staking: Суперечність виправлено, встановлено hasActiveStaking=False")

        # Якщо є активний стейкінг, перевіряємо завершення терміну
        if staking_data and staking_data.get("hasActiveStaking"):
            # Перевіряємо і оновлюємо remainingDays
            try:
                end_date_str = staking_data.get("endDate")
                if end_date_str:
                    end_date = parse_date(end_date_str)
                    now = datetime.now()

                    # Оновлюємо залишок днів
                    remaining_days = max(0, (end_date - now).days)
                    staking_data["remainingDays"] = remaining_days

                    # Якщо стейкінг закінчився, автоматично фіналізуємо його
                    if now >= end_date:
                        logger.info(
                            f"get_user_staking: Автоматичне завершення стейкінгу {staking_data.get('stakingId')}")
                        return finalize_user_staking(telegram_id, staking_data.get("stakingId"), {"autoFinalize": True})

                    # Інакше просто оновлюємо дані
                    update_user(telegram_id, {"staking_data": staking_data})
            except Exception as e:
                logger.error(f"get_user_staking: Помилка перевірки закінчення стейкінгу: {str(e)}")

        # Якщо немає даних стейкінгу або немає активного стейкінгу, повертаємо порожній об'єкт
        if not staking_data or staking_data.get("hasActiveStaking") == False:
            staking_data = {
                "hasActiveStaking": False,
                "stakingAmount": 0,
                "period": 0,
                "rewardPercent": 0,
                "expectedReward": 0,
                "remainingDays": 0
            }

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

        # Логуємо отримані дані для діагностики
        logger.info(f"create_user_staking: Отримані дані: {data}")

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
        logger.info(f"create_user_staking: Визначено відсоток: {reward_percent}%")

        # Розраховуємо очікувану винагороду
        expected_reward = calculate_staking_reward(staking_amount, period)
        data["expectedReward"] = expected_reward
        logger.info(f"create_user_staking: Розраховано винагороду: {expected_reward}")

        # Встановлюємо обов'язкові значення
        data["hasActiveStaking"] = True
        data["status"] = "active"
        data["creationTimestamp"] = int(time.time() * 1000)
        data["stakingAmount"] = staking_amount

        # Якщо це новий стейкінг, генеруємо унікальний ID
        if "stakingId" not in data:
            data["stakingId"] = f"st-{uuid.uuid4().hex[:12]}"

        # Встановлюємо дати
        now = datetime.now().isoformat()
        if "startDate" not in data:
            data["startDate"] = now

        # Розраховуємо дату закінчення на основі періоду, якщо не вказана
        if "endDate" not in data:
            period_days = int(data.get("period", 14))
            end_date = datetime.now() + timedelta(days=period_days)
            data["endDate"] = end_date.isoformat()

        # Розраховуємо залишок днів
        if "remainingDays" not in data:
            data["remainingDays"] = int(data.get("period", 14))

        # Знімаємо кошти з рахунку користувача
        new_balance = current_balance - staking_amount

        # Оновлюємо баланс користувача та створюємо стейкінг
        try:
            logger.info(f"create_user_staking: Створення стейкінгу для {telegram_id}: {data}")

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

            # Перевіряємо, чи стейкінг успішно створено
            try:
                check_user = get_user(telegram_id)
                if check_user:
                    check_staking = check_user.get("staking_data", {})
                    logger.info(f"create_user_staking: Перевірка створеного стейкінгу: {check_staking}")
                else:
                    logger.warning(f"create_user_staking: Не вдалося отримати користувача для перевірки стейкінгу")
            except Exception as e:
                logger.error(f"create_user_staking: Помилка при перевірці створеного стейкінгу: {str(e)}")

            return jsonify({"status": "success", "data": {"staking": data, "balance": new_balance}})
        except Exception as e:
            logger.error(f"create_user_staking: Помилка при створенні стейкінгу: {str(e)}")
            return jsonify({"status": "error", "message": str(e)}), 500
    except Exception as e:
        logger.error(f"create_user_staking: Помилка створення стейкінгу користувача {telegram_id}: {str(e)}",
                     exc_info=True)
        return jsonify({"status": "error", "message": str(e)}), 500


def update_user_staking(telegram_id, staking_id, data):
    """Поліпшена функція додавання до стейкінгу"""

    try:
        # Перетворюємо telegram_id на рядок для надійності
        telegram_id = str(telegram_id)
        logger.info(f"update_user_staking: Запит на оновлення стейкінгу {staking_id} для користувача {telegram_id}")

        if not data or "additionalAmount" not in data:
            logger.error(f"update_user_staking: Відсутні необхідні параметри для користувача {telegram_id}")
            return jsonify({"status": "error", "message": "Відсутні необхідні параметри"}), 400

        # Чітко конвертуємо додаткову суму в ціле число
        try:
            additional_amount = float(data.get("additionalAmount", 0))
            # Перевіряємо, що сума є цілим числом
            if additional_amount != int(additional_amount):
                logger.warning(f"update_user_staking: Сума додавання не була цілим числом, округлено")
                additional_amount = int(additional_amount)

            if additional_amount <= 0:
                logger.error(f"update_user_staking: Спроба додати нульову або від'ємну суму")
                return jsonify({"status": "error", "message": "Сума має бути більше нуля"}), 400
        except (ValueError, TypeError):
            logger.error(f"update_user_staking: Некоректний формат суми: {data.get('additionalAmount')}")
            return jsonify({"status": "error", "message": "Некоректний формат суми"}), 400

        # Отримуємо дані користувача
        user = get_user(telegram_id)
        if not user:
            logger.error(f"update_user_staking: Користувача {telegram_id} не знайдено")
            return jsonify({"status": "error", "message": "Користувача не знайдено"}), 404

        # Отримуємо баланс та конвертуємо до цілого числа
        try:
            current_balance = float(user.get("balance", 0))
        except (ValueError, TypeError):
            logger.error(f"update_user_staking: Помилка конвертації балансу")
            current_balance = 0

        # Перевіряємо, чи достатньо коштів
        if additional_amount > current_balance:
            logger.error(
                f"update_user_staking: Недостатньо коштів. Баланс: {current_balance}, запит: {additional_amount}")
            return jsonify(
                {"status": "error", "message": f"Недостатньо коштів. Ваш баланс: {current_balance} WINIX"}), 400

        # Отримуємо дані стейкінгу
        staking_data = user.get("staking_data", {})
        if not staking_data or not staking_data.get("hasActiveStaking"):
            logger.error(f"update_user_staking: Немає активного стейкінгу для користувача {telegram_id}")
            return jsonify({"status": "error", "message": "Немає активного стейкінгу"}), 404

        # Перевіряємо ID стейкінгу
        if staking_data.get("stakingId") != staking_id:
            logger.error(
                f"update_user_staking: Неправильний ID стейкінгу: очікувалось {staking_data.get('stakingId')}, отримано {staking_id}")
            return jsonify({"status": "error", "message": "Неправильний ID стейкінгу"}), 400

        # Отримуємо поточну суму стейкінгу та конвертуємо до цілого числа
        try:
            current_staking_amount = float(staking_data.get("stakingAmount", 0))
            # Перевіряємо, що сума є цілим числом
            if current_staking_amount != int(current_staking_amount):
                current_staking_amount = int(current_staking_amount)
                logger.warning(f"update_user_staking: Поточна сума стейкінгу не була цілим числом, округлено")
        except (ValueError, TypeError):
            logger.error(f"update_user_staking: Помилка конвертації суми стейкінгу")
            current_staking_amount = 0

        # Розраховуємо нову суму стейкінгу
        new_staking_amount = current_staking_amount + additional_amount

        # Створюємо новий об'єкт стейкінгу з усіма полями
        new_staking_data = staking_data.copy()
        new_staking_data["stakingAmount"] = new_staking_amount

        # Розраховуємо нову очікувану винагороду
        period = int(new_staking_data.get("period", 14))
        reward_percent = STAKING_REWARD_RATES.get(period, 9)
        new_reward = (new_staking_amount * reward_percent) / 100
        new_staking_data["expectedReward"] = round(new_reward, 2)
        new_staking_data["rewardPercent"] = reward_percent

        # Розраховуємо новий баланс
        new_balance = current_balance - additional_amount

        # Логування для відлагодження
        logger.info(f"""update_user_staking: Додавання до стейкінгу:
            Поточна сума стейкінгу: {current_staking_amount}
            Сума додавання: {additional_amount}
            Нова сума стейкінгу: {new_staking_amount}
            Відсоток винагороди: {reward_percent}%
            Нова очікувана винагорода: {new_staking_data["expectedReward"]}
            Поточний баланс: {current_balance}
            Новий баланс: {new_balance}
        """)

        # Атомарно оновлюємо обидва значення
        result = update_user(telegram_id, {
            "balance": new_balance,
            "staking_data": new_staking_data
        })

        if not result:
            logger.error(f"update_user_staking: Помилка оновлення даних користувача {telegram_id}")
            return jsonify({"status": "error", "message": "Помилка оновлення даних"}), 500

        # Додаємо транзакцію
        try:
            transaction = {
                "telegram_id": telegram_id,
                "type": "stake",
                "amount": -additional_amount,
                "description": f"Додано до активного стейкінгу {additional_amount} WINIX (ID: {staking_id})",
                "status": "completed",
                "staking_id": staking_id
            }

            if supabase:
                supabase.table("transactions").insert(transaction).execute()
                logger.info(f"update_user_staking: Транзакцію про додавання до стейкінгу створено")
        except Exception as e:
            logger.error(f"update_user_staking: Помилка при створенні транзакції: {str(e)}")
            # Не зупиняємо процес, якщо помилка при створенні транзакції

        logger.info(f"update_user_staking: Успішно додано {additional_amount} WINIX до стейкінгу {staking_id}")
        return jsonify({
            "status": "success",
            "message": f"Додано {additional_amount} WINIX до стейкінгу",
            "data": {
                "staking": new_staking_data,
                "balance": new_balance,
                "addedAmount": additional_amount,
                "previousAmount": current_staking_amount,
                "newAmount": new_staking_amount,
                "newReward": new_staking_data["expectedReward"]
            }
        })
    except Exception as e:
        logger.error(f"update_user_staking: Критична помилка: {str(e)}", exc_info=True)
        return jsonify({"status": "error", "message": "Сталася технічна помилка при додаванні до стейкінгу"}), 500


def cancel_user_staking(telegram_id, staking_id, data):
    """Поліпшена функція скасування стейкінгу"""

    try:
        # Перетворюємо telegram_id на рядок для надійності
        telegram_id = str(telegram_id)
        logger.info(f"cancel_user_staking: Запит на скасування стейкінгу {staking_id} для користувача {telegram_id}")

        # Отримуємо поточні дані користувача
        user = get_user(telegram_id)
        if not user:
            logger.error(f"cancel_user_staking: Користувача {telegram_id} не знайдено")
            return jsonify({"status": "error", "message": "Користувача не знайдено"}), 404

        # Перевіряємо наявність активного стейкінгу
        staking_data = user.get("staking_data", {})
        if not staking_data or not staking_data.get("hasActiveStaking"):
            logger.error(f"cancel_user_staking: Активний стейкінг не знайдено для користувача {telegram_id}")
            return jsonify({"status": "error", "message": "Активний стейкінг не знайдено"}), 404

        # Перевіряємо ID стейкінгу
        if staking_data.get("stakingId") != staking_id:
            logger.error(f"cancel_user_staking: Неправильний ID стейкінгу для користувача {telegram_id}")
            return jsonify({"status": "error", "message": "Неправильний ID стейкінгу"}), 400

        # Зберігаємо копію для історії
        staking_for_history = staking_data.copy()

        # Конвертуємо значення для надійності
        try:
            staking_amount = float(staking_data.get("stakingAmount", 0))
            # Переконуємось, що стейкінг має цілу суму
            if staking_amount != int(staking_amount):
                staking_amount = int(staking_amount)
                logger.warning(
                    f"cancel_user_staking: Сума стейкінгу не була цілим числом, округлено до {staking_amount}")
        except (ValueError, TypeError):
            logger.error(f"cancel_user_staking: Помилка конвертації суми стейкінгу")
            staking_amount = 0

        current_balance = float(user.get("balance", 0))

        # Розраховуємо штраф та повернення
        cancellation_fee = int(staking_amount * STAKING_CANCELLATION_FEE)
        returned_amount = staking_amount - cancellation_fee

        # Перевірка, що сума повернення не від'ємна
        if returned_amount < 0:
            returned_amount = 0
            logger.warning(f"cancel_user_staking: Сума повернення від'ємна, встановлено 0")

        new_balance = current_balance + returned_amount

        # Логування для відлагодження
        logger.info(f"""cancel_user_staking: Розрахунок скасування:
            Сума стейкінгу: {staking_amount}
            Штраф (20%): {cancellation_fee}
            Сума повернення: {returned_amount}
            Поточний баланс: {current_balance}
            Новий баланс: {new_balance}
        """)

        # Оновлюємо історичні дані
        staking_for_history["status"] = "cancelled"
        staking_for_history["hasActiveStaking"] = False
        staking_for_history["cancelledDate"] = datetime.now().isoformat()
        staking_for_history["returnedAmount"] = returned_amount
        staking_for_history["feeAmount"] = cancellation_fee

        # Додаємо до історії
        staking_history = user.get("staking_history", [])

        # Перевіряємо, що staking_history є списком
        if not isinstance(staking_history, list):
            logger.warning(f"cancel_user_staking: staking_history не є списком, створюємо новий")
            staking_history = []

        staking_history.append(staking_for_history)

        # Створюємо пустий об'єкт стейкінгу
        empty_staking = {
            "hasActiveStaking": False,
            "status": "cancelled",
            "stakingAmount": 0,
            "period": 0,
            "rewardPercent": 0,
            "expectedReward": 0,
            "remainingDays": 0
        }

        # Оновлюємо дані користувача (атомарно)
        result = update_user(telegram_id, {
            "balance": new_balance,
            "staking_data": empty_staking,
            "staking_history": staking_history
        })

        if not result:
            logger.error(f"cancel_user_staking: Помилка оновлення даних користувача {telegram_id}")
            return jsonify({"status": "error", "message": "Помилка оновлення даних користувача"}), 500

        # Додаємо транзакцію
        try:
            transaction = {
                "telegram_id": telegram_id,
                "type": "unstake",
                "amount": returned_amount,
                "description": f"Скасування стейкінгу (повернено {returned_amount} WINIX, утримано {cancellation_fee} WINIX як штраф)",
                "status": "completed",
                "staking_id": staking_id
            }

            # Запис транзакції
            if supabase:
                supabase.table("transactions").insert(transaction).execute()
                logger.info(f"cancel_user_staking: Транзакцію про скасування стейкінгу створено")
        except Exception as e:
            logger.error(f"cancel_user_staking: Помилка при створенні транзакції: {str(e)}")
            # Не зупиняємо процес, якщо помилка при створенні транзакції

        logger.info(f"cancel_user_staking: Стейкінг {staking_id} успішно скасовано для користувача {telegram_id}")
        return jsonify({
            "status": "success",
            "message": "Стейкінг успішно скасовано",
            "data": {
                "staking": empty_staking,
                "returnedAmount": returned_amount,
                "feeAmount": cancellation_fee,
                "newBalance": new_balance
            }
        })
    except Exception as e:
        logger.error(f"cancel_user_staking: Критична помилка: {str(e)}", exc_info=True)
        return jsonify({"status": "error", "message": "Сталася технічна помилка при скасуванні стейкінгу"}), 500


def finalize_user_staking(telegram_id, staking_id, data):
    """Завершення стейкінгу і нарахування винагороди"""
    try:
        logger.info(f"finalize_user_staking: Запит на завершення стейкінгу {staking_id} для користувача {telegram_id}")

        # Логуємо отримані дані для діагностики
        logger.info(f"finalize_user_staking: Отримані дані: {data}")

        # Отримуємо користувача
        user = get_user(telegram_id)
        if not user:
            logger.warning(f"finalize_user_staking: Користувача {telegram_id} не знайдено")
            return jsonify({"status": "error", "message": "Користувача не знайдено"}), 404

        # Отримуємо дані стейкінгу
        staking_data = user.get("staking_data", {})

        # Перевіряємо, чи стейкінг існує
        if not staking_data or not staking_data.get("hasActiveStaking"):
            return jsonify({"status": "error", "message": "Активний стейкінг не знайдено"}), 400

        # Перевіряємо ID стейкінгу
        if staking_data.get("stakingId") != staking_id:
            return jsonify({"status": "error", "message": "Вказаний ID стейкінгу не відповідає активному"}), 400

        # Перевіряємо, чи закінчився період стейкінгу
        now = datetime.now()
        end_date_str = staking_data.get("endDate")

        if not end_date_str:
            logger.warning(f"finalize_user_staking: Дата закінчення не знайдена в стейкінгу {staking_data}")
            return jsonify({"status": "error", "message": "Неможливо визначити дату закінчення стейкінгу"}), 400

        # Обробляємо дату закінчення
        try:
            end_date = parse_date(end_date_str)
        except Exception as e:
            logger.error(f"finalize_user_staking: Помилка при обробці дати закінчення: {str(e)}")
            return jsonify({"status": "error", "message": "Неправильний формат дати закінчення стейкінгу"}), 400

        # Можемо примусово завершити стейкінг, навіть якщо термін не закінчився
        if now < end_date and not data.get('autoFinalize') and not data.get('forceFinalize'):
            remaining_days = (end_date - now).days
            return jsonify({
                "status": "error",
                "message": f"Стейкінг ще не завершено. Залишилось {remaining_days} днів."
            }), 400

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
        staking_history.append(staking_data.copy())  # Копіюємо дані, щоб уникнути проблем з посиланнями

        # Скасовуємо стейкінг (встановлюємо пустий об'єкт з hasActiveStaking=false)
        empty_staking = {
            "hasActiveStaking": False,
            "stakingAmount": 0,
            "period": 0,
            "rewardPercent": 0,
            "expectedReward": 0,
            "remainingDays": 0
        }

        try:
            # Оновлюємо дані користувача
            result = update_user(telegram_id, {
                "balance": new_balance,
                "staking_data": empty_staking,
                "staking_history": staking_history
            })

            if not result:
                return jsonify({"status": "error", "message": "Помилка завершення стейкінгу"}), 500

            # Додаємо транзакцію
            try:
                transaction = {
                    "telegram_id": telegram_id,
                    "type": "unstake",
                    "amount": total_amount,
                    "description": f"Стейкінг завершено: {staking_amount} + {expected_reward} винагорода (ID: {staking_id})",
                    "status": "completed"
                }

                if supabase:
                    supabase.table("transactions").insert(transaction).execute()
            except Exception as e:
                logger.error(f"finalize_user_staking: Помилка при створенні транзакції: {str(e)}")

            logger.info(f"finalize_user_staking: Стейкінг успішно завершено для користувача {telegram_id}")
            return jsonify({
                "status": "success",
                "message": "Стейкінг успішно завершено",
                "data": {
                    "staking": empty_staking,
                    "balance": new_balance,
                    "reward": expected_reward,
                    "total": total_amount
                }
            })
        except Exception as e:
            logger.error(f"finalize_user_staking: Помилка при завершенні стейкінгу: {str(e)}")
            return jsonify({"status": "error", "message": str(e)}), 500
    except Exception as e:
        logger.error(f"finalize_user_staking: Помилка завершення стейкінгу користувача {telegram_id}: {str(e)}",
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

        return jsonify({"status": "success", "data": staking_history})
    except Exception as e:
        logger.error(
            f"get_user_staking_history: Помилка отримання історії стейкінгу користувача {telegram_id}: {str(e)}",
            exc_info=True)
        return jsonify({"status": "error", "message": str(e)}), 500


def check_staking_status(telegram_id):
    """Перевірка та оновлення статусу стейкінгу - автоматичне завершення стейкінгу, якщо термін вийшов"""
    try:
        # Отримуємо користувача
        user = get_user(telegram_id)
        if not user:
            logger.warning(f"check_staking_status: Користувача {telegram_id} не знайдено")
            return jsonify({"status": "error", "message": "Користувача не знайдено"}), 404

        # Отримуємо дані стейкінгу
        staking_data = user.get("staking_data", {})

        # Якщо немає активного стейкінгу, повертаємо поточний статус
        if not staking_data or not staking_data.get("hasActiveStaking"):
            return jsonify({"status": "success", "data": {"hasActiveStaking": False}})

        # Перевіряємо, чи закінчився період стейкінгу
        now = datetime.now()
        end_date_str = staking_data.get("endDate")

        if not end_date_str:
            logger.warning(f"check_staking_status: Дата закінчення не знайдена в стейкінгу {staking_data}")
            return jsonify({"status": "success", "data": staking_data})

        # Обробляємо дату закінчення
        try:
            end_date = parse_date(end_date_str)
        except Exception as e:
            logger.error(f"check_staking_status: Помилка при обробці дати закінчення: {str(e)}")
            return jsonify({"status": "error", "message": "Неправильний формат дати закінчення стейкінгу"}), 400

        # Оновлюємо remainingDays
        remaining_days = max(0, (end_date - now).days)
        staking_data["remainingDays"] = remaining_days

        # Якщо стейкінг закінчився, автоматично завершуємо його
        if now >= end_date:
            logger.info(
                f"check_staking_status: Стейкінг {staking_data.get('stakingId')} закінчився, автоматичне завершення")

            # Викликаємо функцію завершення стейкінгу
            return finalize_user_staking(telegram_id, staking_data.get("stakingId"), {"autoFinalize": True})

        # Інакше оновлюємо дані стейкінгу з актуальним remainingDays
        update_result = update_user(telegram_id, {"staking_data": staking_data})
        if not update_result:
            logger.warning(f"check_staking_status: Не вдалося оновити залишок днів для стейкінгу")

        return jsonify({"status": "success", "data": staking_data})

    except Exception as e:
        logger.error(f"check_staking_status: Помилка перевірки статусу стейкінгу: {str(e)}", exc_info=True)
        return jsonify({"status": "error", "message": str(e)}), 500