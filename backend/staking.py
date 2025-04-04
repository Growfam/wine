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

    Args:
        telegram_id (str): ID користувача в Telegram
        amount (float): Сума для стейкінгу

    Returns:
        dict: Результат валідації {success: bool, message: str}
    """
    try:
        # Перевіряємо тип даних
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

        # Отримуємо користувача для перевірки балансу
        user = get_user(telegram_id)
        if not user:
            return {'success': False, 'message': 'Користувача не знайдено'}

        # Отримуємо поточний баланс
        current_balance = float(user.get('balance', 0))

        # Перевірка на мінімальну суму
        if amount < MIN_STAKING_AMOUNT:
            return {'success': False, 'message': f'Мінімальна сума стейкінгу: {MIN_STAKING_AMOUNT} WINIX'}

        # Перевірка на максимально дозволений відсоток від балансу
        max_allowed_amount = current_balance * MAX_STAKING_PERCENTAGE
        if amount > max_allowed_amount:
            return {'success': False,
                    'message': f'Максимальна сума: {int(max_allowed_amount)} WINIX ({int(MAX_STAKING_PERCENTAGE * 100)}% від балансу)'}

        # Перевірка на достатність коштів
        if amount > current_balance:
            return {'success': False, 'message': f'Недостатньо коштів. Ваш баланс: {current_balance} WINIX'}

        return {'success': True, 'message': ''}
    except Exception as e:
        logger.error(f"validate_staking_amount: Помилка валідації суми стейкінгу: {str(e)}")
        return {'success': False, 'message': 'Помилка валідації суми стейкінгу'}


def calculate_staking_reward(amount, period):
    """Розрахунок очікуваної винагороди за стейкінг"""
    try:
        # Перевірка параметрів
        amount = float(amount)
        period = int(period)

        if amount <= 0 or period <= 0:
            return 0

        # Перевірка, що сума є цілим числом
        if amount != int(amount):
            raise ValueError("Сума стейкінгу має бути цілим числом")

        # Визначаємо відсоток на основі періоду
        reward_percent = STAKING_REWARD_RATES.get(period, 9)  # За замовчуванням 9%

        # Розраховуємо винагороду
        reward = amount * (reward_percent / 100)

        return round(reward, 2)
    except Exception as e:
        logger.error(f"calculate_staking_reward: Помилка розрахунку винагороди: {str(e)}")
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
    """Оновлення стейкінгу користувача (додавання коштів)"""
    try:
        # Базова валідація вхідних даних
        if not data:
            logger.error(f"update_user_staking: Відсутні дані для користувача {telegram_id}")
            return jsonify({"status": "error", "message": "Відсутні дані стейкінгу"}), 400

        # Перевіримо, чи є additionalAmount в даних
        if "additionalAmount" not in data:
            logger.error(f"update_user_staking: Відсутнє поле additionalAmount в даних")
            return jsonify({"status": "error", "message": "Відсутнє поле additionalAmount"}), 400

        # Логування початку транзакції
        logger.info(f"update_user_staking: Початок транзакції для користувача {telegram_id}, стейкінгу {staking_id}")
        logger.info(f"update_user_staking: Отримані дані: {json.dumps(data, ensure_ascii=False)}")

        # Обробляємо додаткову суму - ВАЖЛИВО ПЕРЕТВОРИТИ У FLOAT
        try:
            additional_amount = float(data.get("additionalAmount", 0))
            # Перевірка, що сума є цілим числом
            if additional_amount != int(additional_amount):
                return jsonify({"status": "error", "message": "Сума додавання має бути цілим числом"}), 400
            # Конвертуємо до цілого числа
            additional_amount = int(additional_amount)

            if additional_amount <= 0:
                logger.warning(f"update_user_staking: Додаткова сума повинна бути більше 0: {additional_amount}")
                return jsonify({"status": "error", "message": "Сума додавання має бути більше 0"}), 400
        except (ValueError, TypeError):
            logger.error(f"update_user_staking: Неправильний формат additionalAmount: {data.get('additionalAmount')}")
            return jsonify({"status": "error", "message": "Неправильний формат суми"}), 400

        # Отримуємо дані користувача
        user = get_user(telegram_id)
        if not user:
            logger.warning(f"update_user_staking: Користувача {telegram_id} не знайдено")
            return jsonify({"status": "error", "message": "Користувача не знайдено"}), 404

        # Логуємо поточний баланс та тип даних
        current_balance = float(user.get("balance", 0))
        logger.info(f"update_user_staking: Поточний баланс: {current_balance}")

        # Отримуємо поточні дані стейкінгу
        staking_data = user.get("staking_data", {})
        if not staking_data:
            logger.warning(f"update_user_staking: Дані стейкінгу не знайдено для користувача {telegram_id}")
            return jsonify({"status": "error", "message": "Дані стейкінгу не знайдено"}), 404

        logger.info(f"update_user_staking: Поточні дані стейкінгу: {json.dumps(staking_data, ensure_ascii=False)}")

        # Перевіряємо активність стейкінгу
        if not staking_data.get("hasActiveStaking", False):
            logger.warning(f"update_user_staking: Стейкінг неактивний для користувача {telegram_id}")
            return jsonify({"status": "error", "message": "Активний стейкінг не знайдено"}), 404

        # Перевіряємо статус стейкінгу
        if staking_data.get("status") != "active":
            logger.warning(
                f"update_user_staking: Стейкінг має статус '{staking_data.get('status')}', очікувалося 'active'")
            return jsonify({"status": "error", "message": "Стейкінг не активний для оновлення"}), 400

        # Перевіряємо ID стейкінгу
        if staking_data.get("stakingId") != staking_id:
            logger.warning(
                f"update_user_staking: Невідповідність ID стейкінгу: {staking_id} != {staking_data.get('stakingId')}")
            return jsonify({"status": "error", "message": "Вказаний ID стейкінгу не відповідає активному"}), 400

        # Валідація суми додавання
        validation_result = validate_staking_amount(telegram_id, additional_amount)
        if not validation_result['success']:
            return jsonify({"status": "error", "message": validation_result['message']}), 400

        # Обробка даних стейкінгу з кількома спробами
        max_attempts = 3
        for attempt in range(1, max_attempts + 1):
            try:
                logger.info(f"update_user_staking: Спроба {attempt}/{max_attempts}")

                # Отримуємо свіжі дані користувача перед кожною спробою
                if attempt > 1:
                    user = get_user(telegram_id)
                    if not user:
                        logger.warning(f"update_user_staking: Спроба {attempt} - не вдалося отримати користувача")
                        if attempt == max_attempts:
                            return jsonify({"status": "error", "message": "Не вдалося отримати дані користувача"}), 500
                        time.sleep(0.5)
                        continue

                    current_balance = float(user.get("balance", 0))
                    staking_data = user.get("staking_data", {})

                    # Перевірка актуальності даних стейкінгу
                    if not staking_data or not staking_data.get("hasActiveStaking"):
                        logger.warning(f"update_user_staking: Спроба {attempt} - стейкінг більше неактивний")
                        return jsonify({"status": "error", "message": "Стейкінг більше неактивний"}), 400

                # Обов'язково конвертуємо в float
                current_staking_amount = float(staking_data.get("stakingAmount", 0))
                logger.info(f"update_user_staking: Спроба {attempt} - поточна сума стейкінгу: {current_staking_amount}")

                # Обчислюємо нову суму стейкінгу
                new_staking_amount = current_staking_amount + additional_amount
                logger.info(f"update_user_staking: Спроба {attempt} - нова сума стейкінгу: {new_staking_amount}")

                # Створюємо новий об'єкт стейкінгу з усіма полями
                new_staking_data = {
                    "stakingId": staking_id,
                    "hasActiveStaking": True,
                    "status": "active",
                    "stakingAmount": int(new_staking_amount),  # Переконуємось, що сума ціла
                    "period": int(staking_data.get("period", 14)),
                    "startDate": staking_data.get("startDate"),
                    "endDate": staking_data.get("endDate"),
                    "remainingDays": int(staking_data.get("remainingDays", 0)),
                    "rewardPercent": float(staking_data.get("rewardPercent", 0))
                }

                # Обчислюємо нову очікувану винагороду
                new_reward = calculate_staking_reward(new_staking_amount, new_staking_data["period"])
                new_staking_data["expectedReward"] = new_reward
                logger.info(f"update_user_staking: Спроба {attempt} - нова очікувана винагорода: {new_reward}")

                # Обчислюємо новий баланс користувача
                new_balance = current_balance - additional_amount
                logger.info(f"update_user_staking: Спроба {attempt} - новий баланс: {new_balance}")

                # Зберігаємо всі зміни в одній транзакції
                update_result = update_user(telegram_id, {
                    "staking_data": new_staking_data,
                    "balance": new_balance
                })

                if not update_result:
                    logger.error(f"update_user_staking: Спроба {attempt} - помилка при оновленні даних користувача")
                    if attempt == max_attempts:
                        return jsonify({"status": "error", "message": "Помилка оновлення даних користувача"}), 500
                    time.sleep(0.5)
                    continue

                # Верифікація оновлення - ОБОВ'ЯЗКОВА
                updated_user = get_user(telegram_id)
                if not updated_user:
                    logger.warning(f"update_user_staking: Спроба {attempt} - не вдалося отримати оновлені дані")
                    if attempt == max_attempts:
                        return jsonify({"status": "error", "message": "Помилка перевірки оновлення"}), 500
                    time.sleep(0.5)
                    continue

                updated_staking = updated_user.get("staking_data", {})
                updated_balance = float(updated_user.get("balance", 0))

                # Переконуємось, що поля правильного типу
                try:
                    updated_amount = float(updated_staking.get("stakingAmount", 0))
                except (ValueError, TypeError):
                    logger.error(f"update_user_staking: Спроба {attempt} - помилка типів даних в оновлених даних")
                    updated_amount = 0

                # Перевіряємо, чи відбулося оновлення коректно
                staking_ok = abs(updated_amount - new_staking_amount) < 0.01
                balance_ok = abs(updated_balance - new_balance) < 0.01

                if staking_ok and balance_ok:
                    logger.info(f"update_user_staking: Спроба {attempt} - оновлення успішне")
                    break
                else:
                    logger.warning(f"update_user_staking: Спроба {attempt} - некоректне оновлення")
                    logger.warning(
                        f"Сума стейкінгу: {updated_amount} (очікувалося {new_staking_amount}), баланс: {updated_balance} (очікувався {new_balance})")

                    # Повторна спроба лише для неоновлених полів
                    update_fields = {}
                    if not staking_ok:
                        update_fields["staking_data"] = new_staking_data
                    if not balance_ok:
                        update_fields["balance"] = new_balance

                    if update_fields and attempt < max_attempts:
                        logger.info(
                            f"update_user_staking: Спроба {attempt} - спроба виправлення для: {list(update_fields.keys())}")
                        additional_update = update_user(telegram_id, update_fields)
                        logger.info(
                            f"update_user_staking: Результат додаткового оновлення: {additional_update is not None}")

                    if attempt == max_attempts:
                        logger.error("update_user_staking: Не вдалося повністю оновити дані після всіх спроб")
                        return jsonify({
                            "status": "warning",
                            "message": "Операцію виконано частково. Перезавантажте сторінку для синхронізації."
                        }), 200

                # Створюємо запис транзакції для успішного оновлення
                try:
                    transaction = {
                        "telegram_id": telegram_id,
                        "type": "stake",
                        "amount": -additional_amount,
                        "description": f"Додано до активного стейкінгу {additional_amount} WINIX (ID: {staking_id})",
                        "status": "completed"
                    }

                    if supabase:
                        transaction_res = supabase.table("transactions").insert(transaction).execute()
                        logger.info(f"update_user_staking: Спроба {attempt} - транзакцію успішно записано")
                except Exception as e:
                    logger.error(f"update_user_staking: Спроба {attempt} - помилка при створенні транзакції: {str(e)}")

                # Успішне завершення
                logger.info(f"update_user_staking: Транзакція успішно завершена на спробі {attempt}")

                return jsonify({
                    "status": "success",
                    "message": f"Додано {additional_amount} WINIX до стейкінгу",
                    "data": {
                        "staking": new_staking_data,
                        "balance": new_balance,
                        "addedAmount": additional_amount,
                        "previousAmount": current_staking_amount,
                        "newAmount": new_staking_amount,
                        "newReward": new_reward
                    }
                })
            except Exception as e:
                logger.error(f"update_user_staking: Спроба {attempt} - помилка: {str(e)}", exc_info=True)
                if attempt == max_attempts:
                    return jsonify(
                        {"status": "error", "message": f"Помилка при обробці даних стейкінгу: {str(e)}"}), 500
                time.sleep(0.5)

        # Якщо дійшли сюди після всіх спроб, повертаємо помилку
        return jsonify({"status": "error", "message": "Перевищено кількість спроб оновлення"}), 500
    except Exception as e:
        logger.error(f"update_user_staking: Критична помилка: {str(e)}", exc_info=True)
        return jsonify({"status": "error", "message": f"Критична помилка: {str(e)}"}), 500


def cancel_user_staking(telegram_id, staking_id, data):
    """Скасування стейкінгу користувача"""
    try:
        logger.info(f"cancel_user_staking: Запит на скасування стейкінгу {staking_id} для користувача {telegram_id}")

        # Отримуємо користувача
        user = get_user(telegram_id)
        if not user:
            logger.warning(f"cancel_user_staking: Користувача {telegram_id} не знайдено")
            return jsonify({"status": "error", "message": "Користувача не знайдено"}), 404

        # Отримуємо дані стейкінгу
        staking_data = user.get("staking_data", {})

        # Перевіряємо, чи стейкінг існує та активний
        if not staking_data or not staking_data.get("hasActiveStaking", False):
            logger.warning(f"cancel_user_staking: Активний стейкінг не знайдено для користувача {telegram_id}")
            return jsonify({"status": "error", "message": "Активний стейкінг не знайдено"}), 404

        if staking_data.get("stakingId") != staking_id:
            logger.warning(
                f"cancel_user_staking: Неправильний ID стейкінгу для користувача {telegram_id}: {staking_id} != {staking_data.get('stakingId')}")
            return jsonify({"status": "error", "message": "Вказаний ID стейкінгу не відповідає активному"}), 400

        # Отримуємо суму стейкінгу для повернення
        staking_amount = float(staking_data.get("stakingAmount", 0))
        logger.info(f"cancel_user_staking: Сума стейкінгу для повернення: {staking_amount}")

        # Отримуємо поточний баланс
        current_balance = float(user.get("balance", 0))

        # Розраховуємо штраф за скасування (20% від суми стейкінгу)
        cancellation_fee = staking_amount * STAKING_CANCELLATION_FEE
        returned_amount = staking_amount - cancellation_fee
        new_balance = current_balance + returned_amount

        # Оновлюємо дані стейкінгу для запису в історію
        staking_for_history = staking_data.copy()
        staking_for_history["status"] = "cancelled"
        staking_for_history["hasActiveStaking"] = False
        staking_for_history["cancelledDate"] = datetime.now().isoformat()
        staking_for_history["returnedAmount"] = returned_amount
        staking_for_history["feeAmount"] = cancellation_fee

        # Зберігаємо в історії стейкінгу
        staking_history = user.get("staking_history", [])
        staking_history.append(staking_for_history)

        # Створюємо пустий об'єкт для активного стейкінгу з ЯВНО встановленим статусом cancelled
        empty_staking = {
            "hasActiveStaking": False,
            "status": "cancelled",  # Важливо явно вказати статус cancelled
            "stakingAmount": 0,
            "period": 0,
            "rewardPercent": 0,
            "expectedReward": 0,
            "remainingDays": 0
        }

        # Виконуємо до 3 спроб оновлення даних користувача
        max_attempts = 3
        for attempt in range(1, max_attempts + 1):
            try:
                logger.info(f"cancel_user_staking: Спроба {attempt}/{max_attempts} оновлення даних користувача")

                # Оновлюємо дані користувача
                result = update_user(telegram_id, {
                    "balance": new_balance,
                    "staking_data": empty_staking,
                    "staking_history": staking_history
                })

                if not result:
                    logger.error(f"cancel_user_staking: Спроба {attempt} - Помилка оновлення даних користувача")
                    if attempt == max_attempts:
                        return jsonify({"status": "error", "message": "Помилка скасування стейкінгу"}), 500
                    time.sleep(0.5)  # Затримка перед наступною спробою
                    continue

                # Перевіряємо, чи оновлення відбулося коректно
                updated_user = get_user(telegram_id)
                if not updated_user:
                    logger.error(f"cancel_user_staking: Спроба {attempt} - Не вдалося отримати оновлені дані")
                    if attempt == max_attempts:
                        return jsonify({"status": "error", "message": "Помилка перевірки даних"}), 500
                    time.sleep(0.5)
                    continue

                updated_staking = updated_user.get("staking_data", {})
                updated_balance = float(updated_user.get("balance", 0))

                # Перевіряємо, що обидва поля оновились коректно
                staking_ok = updated_staking.get("hasActiveStaking") == False
                balance_ok = abs(updated_balance - new_balance) < 0.01

                if staking_ok and balance_ok:
                    logger.info(f"cancel_user_staking: Успішне оновлення на спробі {attempt}")
                    break
                else:
                    logger.warning(f"cancel_user_staking: Неповне оновлення на спробі {attempt}")

                    # Повторна спроба лише для неоновлених полів
                    update_fields = {}
                    if not staking_ok:
                        update_fields["staking_data"] = empty_staking
                    if not balance_ok:
                        update_fields["balance"] = new_balance

                    if update_fields and attempt < max_attempts:
                        update_user(telegram_id, update_fields)
                    elif attempt == max_attempts:
                        logger.error("cancel_user_staking: Не вдалося повністю оновити дані після всіх спроб")
                        return jsonify({"status": "error", "message": "Помилка повного оновлення даних"}), 500

            except Exception as e:
                logger.error(f"cancel_user_staking: Спроба {attempt} - Помилка: {str(e)}")
                if attempt == max_attempts:
                    return jsonify({"status": "error", "message": str(e)}), 500
                time.sleep(0.5)

        # Додаємо транзакцію
        try:
            transaction = {
                "telegram_id": telegram_id,
                "type": "unstake",
                "amount": returned_amount,
                "description": f"Скасування стейкінгу (повернено {returned_amount} WINIX, утримано {cancellation_fee} WINIX як штраф)",
                "status": "completed"
            }

            if supabase:
                transaction_res = supabase.table("transactions").insert(transaction).execute()
                logger.info(f"cancel_user_staking: Транзакцію успішно створено")
        except Exception as e:
            logger.error(f"cancel_user_staking: Помилка при створенні транзакції: {str(e)}")

        logger.info(f"cancel_user_staking: Стейкінг успішно скасовано для користувача {telegram_id}")
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
        logger.error(f"cancel_user_staking: Помилка скасування стейкінгу користувача {telegram_id}: {str(e)}",
                     exc_info=True)
        return jsonify({"status": "error", "message": str(e)}), 500


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