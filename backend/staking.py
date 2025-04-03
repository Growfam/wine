from flask import jsonify, request
from supabase_client import supabase, get_user, update_user
import logging
import uuid
import time
from datetime import datetime, timedelta

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


def calculate_staking_reward(amount, period):
    """Розрахунок очікуваної винагороди за стейкінг"""
    try:
        # Перевірка параметрів
        amount = float(amount)
        period = int(period)

        if amount <= 0 or period <= 0:
            return 0

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
                "amount": amount,
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

        # Отримуємо поточний баланс користувача для перевірки
        user = get_user(telegram_id)
        if not user:
            logger.warning(f"create_user_staking: Користувача {telegram_id} не знайдено")
            return jsonify({"status": "error", "message": "Користувача не знайдено"}), 404

        # Перевіряємо наявність активного стейкінгу
        current_staking = user.get("staking_data", {})
        if current_staking and current_staking.get("hasActiveStaking") == True:
            return jsonify({"status": "error", "message": "У вас вже є активний стейкінг"}), 400

        # Перевіряємо мінімальні необхідні поля
        if "stakingAmount" not in data or "period" not in data:
            return jsonify({"status": "error", "message": "Відсутні обов'язкові поля: stakingAmount та period"}), 400

        # Перевіряємо достатність коштів
        current_balance = float(user.get("balance", 0))
        staking_amount = float(data.get("stakingAmount", 0))

        if staking_amount <= 0:
            return jsonify({"status": "error", "message": "Сума стейкінгу повинна бути більше 0"}), 400

        if current_balance < staking_amount:
            return jsonify({"status": "error", "message": "Недостатньо коштів для стейкінгу"}), 400

        # Перевіряємо валідність періоду
        period = int(data.get("period", 14))
        if period not in STAKING_REWARD_RATES:
            return jsonify({"status": "error",
                            "message": f"Некоректний період стейкінгу. Доступні періоди: {', '.join(map(str, STAKING_REWARD_RATES.keys()))}"}), 400

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
        # Перевірка наявності даних
        if not data:
            return jsonify({"status": "error", "message": "Відсутні дані стейкінгу"}), 400

        # Логуємо отримані дані для діагностики
        logger.info(f"update_user_staking: Отримані дані: {data}")

        # Отримуємо інформацію про користувача
        user = get_user(telegram_id)
        if not user:
            logger.warning(f"update_user_staking: Користувача {telegram_id} не знайдено")
            return jsonify({"status": "error", "message": "Користувача не знайдено"}), 404

        # Отримуємо поточні дані стейкінгу
        staking_data = user.get("staking_data", {})

        # Перевіряємо, чи стейкінг існує та активний
        if not staking_data or not staking_data.get("hasActiveStaking", False):
            logger.warning(f"update_user_staking: Активний стейкінг не знайдено для користувача {telegram_id}")
            return jsonify({"status": "error", "message": "Активний стейкінг не знайдено"}), 404

        # Перевіряємо, чи стейкінг має статус "active"
        if staking_data.get("status") != "active":
            logger.warning(f"update_user_staking: Стейкінг не активний, поточний статус: {staking_data.get('status')}")
            return jsonify({"status": "error", "message": "Стейкінг не активний для оновлення"}), 400

        # Перевіряємо, чи правильний ID стейкінгу
        if staking_data.get("stakingId") != staking_id:
            logger.warning(
                f"update_user_staking: Невідповідність ID стейкінгу: {staking_id} != {staking_data.get('stakingId')}")
            return jsonify({"status": "error", "message": "Вказаний ID стейкінгу не відповідає активному"}), 400

        # Перевіряємо додаткову суму
        additional_amount = float(data.get("additionalAmount", 0))
        if additional_amount <= 0:
            logger.warning(f"update_user_staking: Додаткова сума має бути більше 0: {additional_amount}")
            return jsonify({"status": "error", "message": "Сума додавання має бути більше 0"}), 400

        # Перевіряємо, чи достатньо коштів на балансі
        current_balance = float(user.get("balance", 0))
        if current_balance < additional_amount:
            logger.warning(
                f"update_user_staking: Недостатньо коштів: баланс {current_balance}, потрібно {additional_amount}")
            return jsonify({"status": "error", "message": "Недостатньо коштів для додавання до стейкінгу"}), 400

        # Отримуємо поточну суму стейкінгу
        current_staking_amount = float(staking_data.get("stakingAmount", 0))
        logger.info(f"update_user_staking: Поточна сума стейкінгу: {current_staking_amount}")

        # Оновлюємо суму стейкінгу
        new_staking_amount = current_staking_amount + additional_amount
        staking_data["stakingAmount"] = new_staking_amount
        logger.info(f"update_user_staking: Нова сума стейкінгу: {new_staking_amount}")

        # Перераховуємо очікувану винагороду на основі нової суми
        period = int(staking_data.get("period", 14))
        reward_percent = STAKING_REWARD_RATES.get(period, 9)
        old_reward = float(staking_data.get("expectedReward", 0))

        # Оновлюємо відсоток і очікувану винагороду
        staking_data["rewardPercent"] = reward_percent
        new_reward = calculate_staking_reward(new_staking_amount, period)
        staking_data["expectedReward"] = new_reward

        logger.info(f"update_user_staking: Оновлюємо винагороду з {old_reward} на {new_reward}")

        # Знімаємо кошти з рахунку користувача
        new_balance = current_balance - additional_amount
        logger.info(f"update_user_staking: Оновлюємо баланс з {current_balance} на {new_balance}")

        try:
            # Підготовка даних для оновлення в Supabase
            update_data = {
                "balance": new_balance,
                "staking_data": staking_data
            }
            logger.info(f"update_user_staking: Відправляємо дані для оновлення: {update_data}")

            # Оновлюємо дані користувача в Supabase
            result = update_user(telegram_id, update_data)

            # Перевіряємо успішність оновлення
            if not result:
                logger.error(f"update_user_staking: Помилка оновлення даних користувача в Supabase")
                return jsonify({"status": "error", "message": "Помилка оновлення стейкінгу"}), 500

            # Додаткова перевірка, чи дані оновилися правильно
            updated_user = get_user(telegram_id)
            if updated_user:
                updated_staking = updated_user.get("staking_data", {})
                updated_amount = float(updated_staking.get("stakingAmount", 0))
                updated_reward = float(updated_staking.get("expectedReward", 0))
                updated_balance = float(updated_user.get("balance", 0))

                logger.info(f"update_user_staking: Перевірка після оновлення:")
                logger.info(
                    f"update_user_staking: stakingAmount: {updated_amount}, expectedReward: {updated_reward}, balance: {updated_balance}")

                # Перевірка, чи оновилася сума стейкінгу
                if abs(updated_amount - new_staking_amount) > 0.01:  # Невелика похибка для float
                    logger.error(
                        f"update_user_staking: Сума стейкінгу не оновилася правильно: {updated_amount} != {new_staking_amount}")
                    # Спробуємо оновити ще раз
                    logger.info(f"update_user_staking: Спроба повторного оновлення staking_data")
                    update_user(telegram_id, {"staking_data": staking_data})

            # Додаємо транзакцію в історію
            try:
                transaction = {
                    "telegram_id": telegram_id,
                    "type": "stake",
                    "amount": -additional_amount,
                    "description": f"Додано до активного стейкінгу {additional_amount} токенів (ID: {staking_id})",
                    "status": "completed"
                }

                if supabase:
                    transaction_res = supabase.table("transactions").insert(transaction).execute()
                    logger.info(f"update_user_staking: Транзакцію успішно записано")
            except Exception as e:
                logger.error(f"update_user_staking: Помилка при створенні транзакції: {str(e)}")

            # Повертаємо успішний результат з детальними даними
            return jsonify({
                "status": "success",
                "data": {
                    "staking": staking_data,
                    "balance": new_balance,
                    "addedAmount": additional_amount,
                    "previousAmount": current_staking_amount,
                    "newAmount": new_staking_amount,
                    "newReward": new_reward
                }
            })
        except Exception as e:
            logger.error(f"update_user_staking: Помилка оновлення стейкінгу: {str(e)}")
            return jsonify({"status": "error", "message": str(e)}), 500
    except Exception as e:
        logger.error(f"update_user_staking: Помилка оновлення стейкінгу користувача {telegram_id}: {str(e)}",
                     exc_info=True)
        return jsonify({"status": "error", "message": str(e)}), 500


def cancel_user_staking(telegram_id, staking_id, data):
    """Скасування стейкінгу користувача"""
    try:
        logger.info(f"cancel_user_staking: Запит на скасування стейкінгу {staking_id} для користувача {telegram_id}")

        # Логуємо отримані дані для діагностики
        logger.info(f"cancel_user_staking: Отримані дані: {data}")

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
        staking_for_history = staking_data.copy()  # Створюємо копію, щоб не змінювати оригінальний об'єкт
        staking_for_history["status"] = "cancelled"
        staking_for_history["hasActiveStaking"] = False
        staking_for_history["cancelledDate"] = datetime.now().isoformat()
        staking_for_history["returnedAmount"] = returned_amount
        staking_for_history["feeAmount"] = cancellation_fee

        # Зберігаємо в історії стейкінгу
        staking_history = user.get("staking_history", [])
        staking_history.append(staking_for_history)
        logger.info(f"cancel_user_staking: Додано запис в історію стейкінгу: {staking_for_history}")

        # Створюємо пустий об'єкт для активного стейкінгу
        empty_staking = {
            "hasActiveStaking": False,
            "status": "cancelled",  # Явно встановлюємо статус "cancelled"
            "stakingAmount": 0,
            "period": 0,
            "rewardPercent": 0,
            "expectedReward": 0,
            "remainingDays": 0
        }
        logger.info(f"cancel_user_staking: Створено пустий об'єкт стейкінгу з статусом cancelled: {empty_staking}")

        try:
            # Оновлюємо дані користувача
            logger.info(f"cancel_user_staking: Оновлюємо баланс користувача на {new_balance} і очищаємо staking_data")
            result = update_user(telegram_id, {
                "balance": new_balance,
                "staking_data": empty_staking,  # Встановлюємо пустий об'єкт з явним статусом "cancelled"
                "staking_history": staking_history
            })

            if not result:
                logger.error(f"cancel_user_staking: Помилка оновлення даних користувача {telegram_id}")
                return jsonify({"status": "error", "message": "Помилка скасування стейкінгу"}), 500

            # Перевіряємо, чи оновлення відбулося коректно
            updated_user = get_user(telegram_id)
            if updated_user:
                updated_staking = updated_user.get("staking_data", {})
                logger.info(
                    f"cancel_user_staking: Перевірка оновлення - staking_data після оновлення: {updated_staking}")

                # Перевіряємо, що активний стейкінг дійсно скасовано
                if updated_staking.get("hasActiveStaking") == True:
                    logger.error(
                        f"cancel_user_staking: ПОМИЛКА! hasActiveStaking все ще True після скасування: {updated_staking}")
                    # Спробуємо виправити ще раз
                    update_user(telegram_id, {"staking_data": empty_staking})
                    logger.info(f"cancel_user_staking: Спроба повторного оновлення staking_data")

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
            logger.error(f"cancel_user_staking: Помилка при скасуванні стейкінгу: {str(e)}")
            return jsonify({"status": "error", "message": str(e)}), 500
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