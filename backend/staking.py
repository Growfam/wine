from flask import jsonify
from supabase_client import supabase, get_user, update_user
import logging
import uuid
import time
from datetime import datetime, timedelta

# Налаштування логування
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


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

        # Розраховуємо відсоток винагороди, якщо не передано
        if "rewardPercent" not in data:
            # Визначаємо відсоток на основі періоду та суми
            period = int(data.get("period", 14))
            # Наприклад: 14 днів = 7%, 30 днів = 15%
            if period <= 14:
                reward_percent = 7
            elif period <= 30:
                reward_percent = 15
            else:
                reward_percent = 20

            # Додаємо розрахований відсоток
            data["rewardPercent"] = reward_percent
            logger.info(f"create_user_staking: Розраховано rewardPercent: {reward_percent}%")

        # Розраховуємо очікувану винагороду, якщо не передано
        if "expectedReward" not in data:
            reward_percent = float(data.get("rewardPercent"))
            expected_reward = staking_amount * (reward_percent / 100)
            data["expectedReward"] = expected_reward
            logger.info(f"create_user_staking: Розраховано expectedReward: {expected_reward}")

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
                    "description": f"Стейкінг на {data.get('period')} днів (ID: {data.get('stakingId')})",
                    "status": "completed"
                    # Прибрано staking_id, додано ID в опис
                }

                if supabase:
                    transaction_res = supabase.table("transactions").insert(transaction).execute()
                    logger.info(f"create_user_staking: Транзакцію створено")
            except Exception as e:
                # Не зупиняємо процес, якщо помилка при створенні транзакції
                logger.error(f"create_user_staking: Помилка при створенні транзакції: {str(e)}")
                # Транзакція важлива, але не критична для стейкінгу

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
                # Не зупиняємо процес, якщо помилка при перевірці

            return jsonify({"status": "success", "data": {"staking": data, "balance": new_balance}})
        except Exception as e:
            logger.error(f"create_user_staking: Помилка при створенні стейкінгу: {str(e)}")
            return jsonify({"status": "error", "message": str(e)}), 500
    except Exception as e:
        logger.error(f"create_user_staking: Помилка створення стейкінгу користувача {telegram_id}: {str(e)}",
                     exc_info=True)
        return jsonify({"status": "error", "message": str(e)}), 500


def update_user_staking(telegram_id, staking_id, data):
    """Оновлення стейкінгу користувача"""
    try:
        if not data:
            return jsonify({"status": "error", "message": "Відсутні дані стейкінгу"}), 400

        # Логуємо отримані дані для діагностики
        logger.info(f"update_user_staking: Отримані дані: {data}")

        # Отримуємо користувача
        user = get_user(telegram_id)
        if not user:
            logger.warning(f"update_user_staking: Користувача {telegram_id} не знайдено")
            return jsonify({"status": "error", "message": "Користувача не знайдено"}), 404

        # Отримуємо поточні дані стейкінгу
        staking_data = user.get("staking_data", {})

        # Перевіряємо, чи стейкінг існує та активний
        if not staking_data or not staking_data.get("hasActiveStaking", False):
            return jsonify({"status": "error", "message": "Активний стейкінг не знайдено"}), 404

        if staking_data.get("stakingId") != staking_id:
            return jsonify({"status": "error", "message": "Вказаний ID стейкінгу не відповідає активному"}), 400

        # Перевіряємо додаткову суму, якщо вона є
        additional_amount = float(data.get("additionalAmount", 0))
        if additional_amount > 0:
            # Перевіряємо, чи достатньо коштів
            current_balance = float(user.get("balance", 0))
            if current_balance < additional_amount:
                return jsonify({"status": "error", "message": "Недостатньо коштів для додавання до стейкінгу"}), 400

            # Оновлюємо суму стейкінгу
            new_staking_amount = float(staking_data.get("stakingAmount", 0)) + additional_amount
            staking_data["stakingAmount"] = new_staking_amount

            # Перераховуємо очікувану винагороду
            reward_percent = float(staking_data.get("rewardPercent", 0))
            expected_reward = new_staking_amount * (reward_percent / 100)
            staking_data["expectedReward"] = expected_reward

            # Знімаємо кошти з рахунку
            new_balance = current_balance - additional_amount

            try:
                # Оновлюємо дані користувача
                result = update_user(telegram_id, {"balance": new_balance, "staking_data": staking_data})

                if not result:
                    return jsonify({"status": "error", "message": "Помилка оновлення стейкінгу"}), 500

                # Додаємо транзакцію
                try:
                    transaction = {
                        "telegram_id": telegram_id,
                        "type": "stake",
                        "amount": -additional_amount,
                        "description": f"Додатковий внесок до стейкінгу (ID: {staking_id})",
                        "status": "completed"
                    }

                    if supabase:
                        supabase.table("transactions").insert(transaction).execute()
                except Exception as e:
                    logger.error(f"update_user_staking: Помилка при створенні транзакції: {str(e)}")
                    # Не зупиняємо процес, якщо помилка при створенні транзакції

                return jsonify({
                    "status": "success",
                    "data": {
                        "staking": staking_data,
                        "balance": new_balance,
                        "addedAmount": additional_amount
                    }
                })
            except Exception as e:
                logger.error(f"update_user_staking: Помилка оновлення стейкінгу: {str(e)}")
                return jsonify({"status": "error", "message": str(e)}), 500
        else:
            # Якщо немає додаткової суми, просто оновлюємо дані стейкінгу
            try:
                # Переконуємось, що обов'язкові поля присутні
                staking_data.update(data)  # Оновлюємо тільки передані поля
                staking_data["hasActiveStaking"] = True
                staking_data["status"] = "active"

                result = update_user(telegram_id, {"staking_data": staking_data})

                if not result:
                    return jsonify({"status": "error", "message": "Помилка оновлення стейкінгу"}), 500

                return jsonify({"status": "success", "data": {"staking": staking_data}})
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

        # Повертаємо кошти на рахунок (можна додати комісію за скасування)
        # Комісія 0% для базової версії
        cancellation_fee = 0.0
        returned_amount = staking_amount * (1 - cancellation_fee)
        new_balance = current_balance + returned_amount

        # Оновлюємо дані стейкінгу для історії
        staking_data["status"] = "cancelled"
        staking_data["hasActiveStaking"] = False
        staking_data["cancelledDate"] = datetime.now().isoformat()
        staking_data["returnedAmount"] = returned_amount

        # Зберігаємо в історії стейкінгу
        staking_history = user.get("staking_history", [])
        staking_history.append(staking_data.copy())  # Копіюємо дані, щоб уникнути проблем з посиланнями

        # Створюємо пустий об'єкт для стейкінгу
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
                logger.error(f"cancel_user_staking: Помилка оновлення даних користувача {telegram_id}")
                return jsonify({"status": "error", "message": "Помилка скасування стейкінгу"}), 500

            # Додаємо транзакцію
            try:
                transaction = {
                    "telegram_id": telegram_id,
                    "type": "unstake",
                    "amount": returned_amount,
                    "description": f"Скасування стейкінгу (повернено {returned_amount} WINIX) (ID: {staking_id})",
                    "status": "completed"
                }

                if supabase:
                    supabase.table("transactions").insert(transaction).execute()
            except Exception as e:
                logger.error(f"cancel_user_staking: Помилка при створенні транзакції: {str(e)}")
                # Не зупиняємо процес, якщо помилка при створенні транзакції

            logger.info(f"cancel_user_staking: Стейкінг успішно скасовано для користувача {telegram_id}")
            return jsonify({
                "status": "success",
                "message": "Стейкінг успішно скасовано",
                "data": {
                    "staking": empty_staking,
                    "returnedAmount": returned_amount,
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
                # Не зупиняємо процес, якщо помилка при створенні транзакції

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