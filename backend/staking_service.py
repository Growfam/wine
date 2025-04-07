import logging
from datetime import datetime
from models.staking_session import StakingSession
import staking_utils as utils
from supabase_client import get_user, update_user, supabase

# Налаштування логування
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


def check_active_staking(telegram_id):
    """
    Перевіряє наявність активного стейкінгу у користувача

    Повертає: (has_staking: bool, staking_data: dict або None)
    """
    try:
        # Отримуємо користувача
        user = get_user(telegram_id)
        if not user:
            logger.warning(f"Користувача {telegram_id} не знайдено")
            return False, None

        # Отримуємо дані стейкінгу
        staking_data = user.get("staking_data", {})

        # Перевіряємо, чи є активний стейкінг
        has_active_staking = staking_data and staking_data.get("hasActiveStaking", False)

        if has_active_staking:
            # Оновлюємо залишок днів перед поверненням
            end_date = staking_data.get("endDate")
            if end_date:
                remaining_days = utils.calculate_remaining_days(end_date)
                staking_data["remainingDays"] = remaining_days

                # Якщо стейкінг завершився, автоматично фіналізуємо його
                if remaining_days == 0:
                    logger.info(
                        f"Виявлено завершений стейкінг {staking_data.get('stakingId')}, автоматична фіналізація")
                    return has_active_staking, staking_data

        return has_active_staking, staking_data
    except Exception as e:
        logger.error(f"Помилка перевірки активного стейкінгу: {str(e)}")
        return False, None


def create_staking(telegram_id, amount, period):
    """
    Створює новий стейкінг для користувача

    Повертає: (success: bool, result: dict, message: str)
    """
    try:
        # Отримуємо користувача
        user = get_user(telegram_id)
        if not user:
            logger.warning(f"Користувача {telegram_id} не знайдено")
            return False, None, "Користувача не знайдено"

        # Перевіряємо, чи є активний стейкінг
        has_active_staking, staking_data = check_active_staking(telegram_id)
        if has_active_staking:
            return False, None, "У вас вже є активний стейкінг"

        # Отримуємо поточний баланс
        current_balance = float(user.get("balance", 0))

        # Валідуємо суму стейкінгу
        is_valid, message = utils.validate_staking_amount(current_balance, amount)
        if not is_valid:
            return False, None, message

        # Перевіряємо період стейкінгу
        if period not in utils.STAKING_REWARD_RATES:
            return False, None, f"Некоректний період стейкінгу. Доступні періоди: {', '.join(map(str, utils.STAKING_REWARD_RATES.keys()))}"

        # Створюємо об'єкт сесії стейкінгу
        staking_session = StakingSession(
            telegram_id=telegram_id,
            amount=int(amount),
            period=period
        )

        # Розраховуємо новий баланс
        new_balance = current_balance - amount

        # Конвертуємо об'єкт стейкінгу до формату бази даних (для збереження у поточній структурі)
        staking_data = {
            "hasActiveStaking": True,
            "status": "active",
            "stakingId": staking_session.staking_id,
            "stakingAmount": staking_session.amount,
            "period": staking_session.period,
            "rewardPercent": staking_session.reward_percent,
            "expectedReward": staking_session.expected_reward,
            "remainingDays": staking_session.remaining_days,
            "startDate": staking_session.start_date,
            "endDate": staking_session.end_date,
            "creationTimestamp": staking_session.creation_timestamp
        }

        # Оновлюємо баланс користувача та створюємо стейкінг
        result = update_user(telegram_id, {
            "balance": new_balance,
            "staking_data": staking_data
        })

        if not result:
            logger.error(f"Помилка оновлення даних користувача {telegram_id}")
            return False, None, "Помилка створення стейкінгу"

        # Додаємо транзакцію
        try:
            transaction = {
                "telegram_id": telegram_id,
                "type": "stake",
                "amount": -staking_session.amount,
                "description": f"Стейкінг на {staking_session.period} днів ({staking_session.reward_percent}% прибутку) (ID: {staking_session.staking_id})",
                "status": "completed"
            }

            if supabase:
                supabase.table("transactions").insert(transaction).execute()
                logger.info(f"Транзакцію про стейкінг створено")
        except Exception as e:
            logger.error(f"Помилка при створенні транзакції: {str(e)}")

        return True, {"staking": staking_data, "balance": new_balance}, "Стейкінг успішно створено"
    except Exception as e:
        logger.error(f"Помилка створення стейкінгу для користувача {telegram_id}: {str(e)}")
        return False, None, f"Помилка: {str(e)}"


def add_to_staking(telegram_id, staking_id, additional_amount):
    """
    Додає кошти до існуючого активного стейкінгу

    Повертає: (success: bool, result: dict, message: str)
    """
    try:
        # Перетворюємо додаткову суму на число
        try:
            additional_amount = float(additional_amount)
            if additional_amount != int(additional_amount):
                return False, None, "Сума додавання має бути цілим числом"
            additional_amount = int(additional_amount)
        except (ValueError, TypeError):
            return False, None, "Некоректний формат суми"

        if additional_amount <= 0:
            return False, None, "Сума має бути більше нуля"

        # Отримуємо користувача
        user = get_user(telegram_id)
        if not user:
            return False, None, "Користувача не знайдено"

        # Отримуємо баланс
        current_balance = float(user.get("balance", 0))

        # Перевіряємо, чи достатньо коштів
        if additional_amount > current_balance:
            return False, None, f"Недостатньо коштів. Ваш баланс: {current_balance} WINIX"

        # Отримуємо дані стейкінгу
        staking_data = user.get("staking_data", {})
        if not staking_data or not staking_data.get("hasActiveStaking"):
            return False, None, "Немає активного стейкінгу"

        # Перевіряємо ID стейкінгу
        if staking_data.get("stakingId") != staking_id:
            return False, None, "Неправильний ID стейкінгу"

        # Отримуємо поточну суму стейкінгу
        current_staking_amount = int(float(staking_data.get("stakingAmount", 0)))

        # Розраховуємо нову суму стейкінгу
        new_staking_amount = current_staking_amount + additional_amount

        # Створюємо новий об'єкт стейкінгу з оновленими даними
        new_staking_data = staking_data.copy()
        new_staking_data["stakingAmount"] = new_staking_amount

        # Розраховуємо нову очікувану винагороду
        period = int(new_staking_data.get("period", 14))
        reward_percent = utils.STAKING_REWARD_RATES.get(period, 9)
        new_reward = utils.calculate_staking_reward(new_staking_amount, period)
        new_staking_data["expectedReward"] = new_reward
        new_staking_data["rewardPercent"] = reward_percent

        # Розраховуємо новий баланс
        new_balance = current_balance - additional_amount

        # Оновлюємо дані користувача
        result = update_user(telegram_id, {
            "balance": new_balance,
            "staking_data": new_staking_data
        })

        if not result:
            return False, None, "Помилка оновлення даних"

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
                logger.info(f"Транзакцію про додавання до стейкінгу створено")
        except Exception as e:
            logger.error(f"Помилка при створенні транзакції: {str(e)}")

        return True, {
            "staking": new_staking_data,
            "balance": new_balance,
            "addedAmount": additional_amount,
            "previousAmount": current_staking_amount,
            "newAmount": new_staking_amount,
            "newReward": new_reward
        }, f"Додано {additional_amount} WINIX до стейкінгу"
    except Exception as e:
        logger.error(f"Помилка додавання до стейкінгу: {str(e)}")
        return False, None, f"Помилка: {str(e)}"


def cancel_staking(telegram_id, staking_id):
    """
    Скасовує активний стейкінг з урахуванням штрафу

    Повертає: (success: bool, result: dict, message: str)
    """
    try:
        # Отримуємо користувача
        user = get_user(telegram_id)
        if not user:
            return False, None, "Користувача не знайдено"

        # Перевіряємо наявність активного стейкінгу
        staking_data = user.get("staking_data", {})
        if not staking_data or not staking_data.get("hasActiveStaking"):
            return False, None, "Активний стейкінг не знайдено"

        # Перевіряємо ID стейкінгу
        if staking_data.get("stakingId") != staking_id:
            return False, None, "Неправильний ID стейкінгу"

        # Зберігаємо копію для історії
        staking_for_history = staking_data.copy()

        # Отримуємо суму стейкінгу
        staking_amount = float(staking_data.get("stakingAmount", 0))
        if staking_amount != int(staking_amount):
            staking_amount = int(staking_amount)
            logger.warning(f"Сума стейкінгу не була цілим числом, округлено до {staking_amount}")

        current_balance = float(user.get("balance", 0))

        # Розраховуємо штраф та повернення
        returned_amount, fee_amount = utils.calculate_cancellation_returns(staking_amount)
        new_balance = current_balance + returned_amount

        # Оновлюємо історичні дані
        staking_for_history["status"] = "cancelled"
        staking_for_history["hasActiveStaking"] = False
        staking_for_history["cancelledDate"] = datetime.now().isoformat()
        staking_for_history["returnedAmount"] = returned_amount
        staking_for_history["feeAmount"] = fee_amount

        # Додаємо до історії
        staking_history = user.get("staking_history", [])
        if not isinstance(staking_history, list):
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

        # Оновлюємо дані користувача
        result = update_user(telegram_id, {
            "balance": new_balance,
            "staking_data": empty_staking,
            "staking_history": staking_history
        })

        if not result:
            return False, None, "Помилка оновлення даних користувача"

        # Додаємо транзакцію
        try:
            transaction = {
                "telegram_id": telegram_id,
                "type": "unstake",
                "amount": returned_amount,
                "description": f"Скасування стейкінгу (повернено {returned_amount} WINIX, утримано {fee_amount} WINIX як штраф)",
                "status": "completed",
                "staking_id": staking_id
            }

            if supabase:
                supabase.table("transactions").insert(transaction).execute()
                logger.info(f"Транзакцію про скасування стейкінгу створено")
        except Exception as e:
            logger.error(f"Помилка при створенні транзакції: {str(e)}")

        return True, {
            "staking": empty_staking,
            "returnedAmount": returned_amount,
            "feeAmount": fee_amount,
            "newBalance": new_balance
        }, "Стейкінг успішно скасовано"
    except Exception as e:
        logger.error(f"Помилка скасування стейкінгу: {str(e)}")
        return False, None, f"Помилка: {str(e)}"


def finalize_staking(telegram_id, staking_id, force=False):
    """
    Завершує стейкінг і нараховує винагороду

    Повертає: (success: bool, result: dict, message: str)
    """
    try:
        # Отримуємо користувача
        user = get_user(telegram_id)
        if not user:
            return False, None, "Користувача не знайдено"

        # Отримуємо дані стейкінгу
        staking_data = user.get("staking_data", {})

        # Перевіряємо, чи стейкінг існує
        if not staking_data or not staking_data.get("hasActiveStaking"):
            return False, None, "Активний стейкінг не знайдено"

        # Перевіряємо ID стейкінгу
        if staking_data.get("stakingId") != staking_id:
            return False, None, "Вказаний ID стейкінгу не відповідає активному"

        # Перевіряємо, чи закінчився період стейкінгу
        end_date = staking_data.get("endDate")

        if not end_date:
            logger.warning(f"Дата закінчення не знайдена в стейкінгу {staking_data}")
            return False, None, "Неможливо визначити дату закінчення стейкінгу"

        # Перевіряємо, чи можна завершити стейкінг
        if not force and not utils.check_staking_finished(end_date):
            remaining_days = utils.calculate_remaining_days(end_date)
            return False, None, f"Стейкінг ще не завершено. Залишилось {remaining_days} днів."

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

        # Пустий об'єкт стейкінгу
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

        if not result:
            return False, None, "Помилка завершення стейкінгу"

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
            logger.error(f"Помилка при створенні транзакції: {str(e)}")

        return True, {
            "staking": empty_staking,
            "balance": new_balance,
            "reward": expected_reward,
            "total": total_amount
        }, "Стейкінг успішно завершено"
    except Exception as e:
        logger.error(f"Помилка завершення стейкінгу: {str(e)}")
        return False, None, f"Помилка: {str(e)}"


def get_staking_history(telegram_id):
    """
    Отримує історію стейкінгу користувача

    Повертає: (success: bool, data: list, message: str)
    """
    try:
        # Отримуємо користувача
        user = get_user(telegram_id)
        if not user:
            return False, None, "Користувача не знайдено"

        # Отримуємо історію стейкінгу
        staking_history = user.get("staking_history", [])

        if not isinstance(staking_history, list):
            staking_history = []

        return True, staking_history, "Історія стейкінгу успішно отримана"
    except Exception as e:
        logger.error(f"Помилка отримання історії стейкінгу: {str(e)}")
        return False, None, f"Помилка: {str(e)}"