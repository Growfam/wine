"""
Сервіс для управління стейкінгом.
Містить логіку створення, зміни та скасування стейкінгу.
Використовує таблицю staking_sessions для збереження даних стейкінгу.
"""
import logging
from datetime import datetime, timedelta
import uuid
from typing import Tuple, Dict, Union, Any, Optional, List

# Перевіряємо доступність функцій у supabase_client
try:
    from supabase_client import (
        get_user, update_user, update_balance, supabase,
        create_staking_session, get_user_staking_sessions,
        get_staking_session, update_staking_session,
        complete_staking_session, check_and_complete_expired_staking_sessions,
        delete_staking_session
    )
except ImportError as e:
    logging.error(f"Помилка імпорту з supabase_client: {str(e)}")
    # Створюємо заглушки для функцій, яких немає
    def dummy_function(*args, **kwargs):
        logging.error("Функція недоступна: не вдалося імпортувати з supabase_client")
        return None

    # Визначаємо відсутні функції як заглушки
    locals_dict = locals()
    for func_name in ['get_user', 'update_user', 'update_balance', 'supabase',
                      'create_staking_session', 'get_user_staking_sessions',
                      'get_staking_session', 'update_staking_session',
                      'complete_staking_session', 'check_and_complete_expired_staking_sessions',
                      'delete_staking_session']:
        if func_name not in locals_dict:
            locals_dict[func_name] = dummy_function

# Налаштування логування
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Імпортуємо константи з моделі StakingSession
try:
    from models.staking_session import StakingSession
    STAKING_REWARD_RATES = StakingSession.STAKING_REWARD_RATES
    STAKING_CANCELLATION_FEE = StakingSession.STAKING_CANCELLATION_FEE
except ImportError:
    # Якщо модель недоступна, використовуємо стандартні значення
    logger.warning("Не вдалося імпортувати StakingSession, використовуються стандартні значення")
    # Відсотки винагороди за різні періоди стейкінгу
    STAKING_REWARD_RATES = {
        7: 5.0,    # 5% за 7 днів
        14: 9.0,   # 9% за 14 днів
        28: 15.0   # 15% за 28 днів
    }
    # Штраф при скасуванні стейкінгу (20%)
    STAKING_CANCELLATION_FEE = 0.2


def check_active_staking(telegram_id: str) -> Tuple[bool, Optional[Dict[str, Any]]]:
    """
    Перевіряє наявність активного стейкінгу у користувача.

    Args:
        telegram_id (str): ID користувача в Telegram

    Returns:
        tuple: (has_staking: bool, staking_data: dict або None)
    """
    try:
        # Отримуємо активні сесії стейкінгу користувача
        active_sessions = get_user_staking_sessions(telegram_id, active_only=True)

        if not active_sessions or len(active_sessions) == 0:
            logger.info(f"Користувач {telegram_id} не має активного стейкінгу")
            return False, None

        # Беремо найновішу активну сесію
        session = active_sessions[0]  # Сесії відсортовані за датою початку (спочатку найновіші)

        # Перевіряємо, чи не закінчився термін стейкінгу
        started_at = datetime.fromisoformat(session["started_at"].replace('Z', '+00:00')) if isinstance(session["started_at"], str) else session["started_at"]
        ends_at = datetime.fromisoformat(session["ends_at"].replace('Z', '+00:00')) if isinstance(session["ends_at"], str) else session["ends_at"]
        now = datetime.now()

        # Розраховуємо залишок днів
        remaining_days = max(0, (ends_at - now).days)

        # Якщо стейкінг закінчився, але ще активний, автоматично завершуємо його
        if remaining_days == 0 and session["is_active"]:
            logger.info(f"Стейкінг {session['id']} закінчився, автоматичне завершення")
            check_and_complete_expired_staking_sessions()
            # Перевіряємо знову після завершення
            return check_active_staking(telegram_id)

        # Формуємо дані стейкінгу в форматі для клієнта
        staking_data = {
            "hasActiveStaking": True,
            "stakingId": session["id"],
            "stakingAmount": float(session["amount_staked"]),
            "period": int(session["staking_days"]),
            "rewardPercent": float(session["reward_percent"]),
            "expectedReward": calculate_staking_reward(float(session["amount_staked"]), int(session["staking_days"])),
            "remainingDays": remaining_days,
            "startDate": session["started_at"],
            "endDate": session["ends_at"]
        }

        logger.info(f"Користувач {telegram_id} має активний стейкінг, залишилось {remaining_days} днів")
        return True, staking_data

    except Exception as e:
        logger.error(f"Помилка перевірки активного стейкінгу: {str(e)}")
        return False, None

# Решта функцій залишається без змін
# Додайте решту функцій з моєї попередньої відповіді

def create_staking(telegram_id: str, amount: Union[int, float], period: int) -> Tuple[
    bool, Optional[Dict[str, Any]], str]:
    """
    Створює новий стейкінг для користувача.

    Args:
        telegram_id (str): ID користувача в Telegram
        amount (float): Сума стейкінгу
        period (int): Період стейкінгу в днях

    Returns:
        tuple: (success: bool, result: dict, message: str)
    """
    try:
        # Перетворюємо параметри на числа
        amount = float(amount)
        period = int(period)

        # Перевіряємо, чи сума є цілим числом
        if amount != int(amount):
            return False, None, "Сума стейкінгу має бути цілим числом"

        amount = int(amount)

        # Перевіряємо, чи є активний стейкінг
        has_active_staking, active_staking_data = check_active_staking(telegram_id)
        if has_active_staking:
            return False, None, "У вас вже є активний стейкінг"

        # Отримуємо користувача для перевірки балансу
        user = get_user(telegram_id)
        if not user:
            return False, None, "Користувача не знайдено"

        # Перевіряємо баланс
        current_balance = float(user.get("balance", 0))
        if current_balance < amount:
            return False, None, f"Недостатньо коштів. Ваш баланс: {current_balance}, необхідно: {amount}"

        # Перевіряємо валідність періоду
        if period not in STAKING_REWARD_RATES:
            period_str = ", ".join(map(str, STAKING_REWARD_RATES.keys()))
            return False, None, f"Некоректний період стейкінгу. Доступні періоди: {period_str}"

        # Визначаємо відсоток винагороди для періоду
        reward_percent = STAKING_REWARD_RATES[period]

        # Віднімаємо кошти з балансу користувача
        new_balance = current_balance - amount
        balance_update = update_balance(telegram_id, -amount)
        if not balance_update:
            return False, None, "Помилка оновлення балансу"

        # Створюємо сесію стейкінгу
        staking_session = create_staking_session(
            user_id=telegram_id,
            amount_staked=amount,
            staking_days=period,
            reward_percent=reward_percent
        )

        if not staking_session:
            # Повертаємо кошти, якщо сесія не створена
            update_balance(telegram_id, amount)
            return False, None, "Помилка створення стейкінгу"

        # Розраховуємо очікувану винагороду
        expected_reward = calculate_staking_reward(amount, period)

        # Формуємо дані для відповіді
        started_at = datetime.fromisoformat(staking_session["started_at"].replace('Z', '+00:00')) if isinstance(staking_session["started_at"], str) else staking_session["started_at"]
        ends_at = datetime.fromisoformat(staking_session["ends_at"].replace('Z', '+00:00')) if isinstance(staking_session["ends_at"], str) else staking_session["ends_at"]

        staking_data = {
            "hasActiveStaking": True,
            "stakingId": staking_session["id"],
            "stakingAmount": amount,
            "period": period,
            "rewardPercent": reward_percent,
            "expectedReward": expected_reward,
            "remainingDays": period,
            "startDate": staking_session["started_at"],
            "endDate": staking_session["ends_at"]
        }

        # Додаємо транзакцію
        try:
            transaction = {
                "telegram_id": telegram_id,
                "type": "stake",
                "amount": -amount,
                "description": f"Стейкінг на {period} днів ({reward_percent}% прибутку) (ID: {staking_session['id']})",
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


def calculate_staking_reward(amount: Union[int, float], period: int) -> float:
    """
    Розрахунок очікуваної винагороди за стейкінг.

    Args:
        amount (float): Сума стейкінгу
        period (int): Період стейкінгу в днях

    Returns:
        float: Очікувана винагорода
    """
    try:
        # Перетворюємо параметри на числа
        amount = float(amount)
        period = int(period)

        # Перевіряємо параметри
        if amount <= 0 or period <= 0:
            return 0

        # Отримуємо відсоток винагороди
        reward_percent = STAKING_REWARD_RATES.get(period, 9)

        # Розраховуємо винагороду
        reward = (amount * reward_percent) / 100

        return round(reward, 2)
    except Exception as e:
        logger.error(f"Помилка розрахунку винагороди: {str(e)}")
        return 0