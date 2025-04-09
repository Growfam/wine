"""
Сервіс для управління стейкінгом.
Містить логіку створення, зміни та скасування стейкінгу.
Використовує таблицю staking_sessions для збереження даних стейкінгу.
"""
import logging
from datetime import datetime, timedelta, timezone
import uuid
from typing import Tuple, Dict, Union, Any, Optional, List
import sys
import os
import importlib.util
import traceback

# Налаштування логування
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Імпортуємо supabase_client.py напряму із заданого шляху
current_dir = os.path.dirname(os.path.abspath(__file__))  # папка staking
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
create_staking_session = supabase_client.create_staking_session
get_user_staking_sessions = supabase_client.get_user_staking_sessions
get_staking_session = supabase_client.get_staking_session
update_staking_session = supabase_client.update_staking_session
complete_staking_session = supabase_client.complete_staking_session
check_and_complete_expired_staking_sessions = supabase_client.check_and_complete_expired_staking_sessions
delete_staking_session = supabase_client.delete_staking_session
verify_staking_consistency = supabase_client.verify_staking_consistency
repair_staking_session = supabase_client.repair_staking_session

# Імпортуємо константи з моделі StakingSession
try:
    # Спочатку спробуємо імпортувати відносно
    try:
        from ..models.staking_session import StakingSession
    except ImportError:
        # Якщо не вдалося, спробуємо абсолютний імпорт
        spec = importlib.util.spec_from_file_location("StakingSession", os.path.join(parent_dir, "models", "staking_session.py"))
        staking_session_module = importlib.util.module_from_spec(spec)
        spec.loader.exec_module(staking_session_module)
        StakingSession = staking_session_module.StakingSession

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
        # Перетворюємо ID в рядок
        telegram_id = str(telegram_id)

        logger.info(f"check_active_staking: Перевірка активного стейкінгу для користувача {telegram_id}")

        # Перевірка цілісності даних стейкінгу
        verify_staking_consistency(telegram_id)

        # Отримуємо активні сесії стейкінгу користувача
        active_sessions = get_user_staking_sessions(telegram_id, active_only=True)

        if not active_sessions or len(active_sessions) == 0:
            logger.info(f"Користувач {telegram_id} не має активного стейкінгу")
            return False, None

        # Беремо найновішу активну сесію
        session = active_sessions[0]  # Сесії відсортовані за датою початку (спочатку найновіші)

        # Перевіряємо, чи не закінчився термін стейкінгу з урахуванням часових поясів
        try:
            started_at = datetime.fromisoformat(session["started_at"].replace('Z', '+00:00')) if isinstance(session["started_at"], str) else session["started_at"]
            ends_at = datetime.fromisoformat(session["ends_at"].replace('Z', '+00:00')) if isinstance(session["ends_at"], str) else session["ends_at"]

            # Забезпечуємо, що дати мають часовий пояс
            if started_at.tzinfo is None:
                started_at = started_at.replace(tzinfo=timezone.utc)
            if ends_at.tzinfo is None:
                ends_at = ends_at.replace(tzinfo=timezone.utc)

            # Поточний час з часовим поясом
            now = datetime.now(timezone.utc)
        except Exception as e:
            logger.error(f"Помилка обробки дат: {str(e)}")
            # Використовуємо "naive" дати як запасний варіант
            started_at = datetime.fromisoformat(session["started_at"].replace('Z', '')) if isinstance(session["started_at"], str) else session["started_at"]
            ends_at = datetime.fromisoformat(session["ends_at"].replace('Z', '')) if isinstance(session["ends_at"], str) else session["ends_at"]
            # Видаляємо часовий пояс, якщо він є
            if hasattr(started_at, 'tzinfo') and started_at.tzinfo is not None:
                started_at = started_at.replace(tzinfo=None)
            if hasattr(ends_at, 'tzinfo') and ends_at.tzinfo is not None:
                ends_at = ends_at.replace(tzinfo=None)
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
        logger.error(traceback.format_exc())
        return False, None


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
        # Перетворюємо ID в рядок
        telegram_id = str(telegram_id)

        # Перетворюємо параметри на числа
        try:
            amount = float(amount)
            period = int(period)
        except (ValueError, TypeError) as e:
            return False, None, f"Некоректний формат параметрів: {str(e)}"

        # Перевіряємо, чи сума є цілим числом (щоб уникнути проблем з округленням)
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

        # Перевіряємо баланс (завжди як float для уникнення проблем з порівнянням)
        current_balance = float(user.get("balance", 0))
        if current_balance < amount:
            return False, None, f"Недостатньо коштів. Ваш баланс: {current_balance}, необхідно: {amount}"

        # Перевіряємо валідність періоду
        if period not in STAKING_REWARD_RATES:
            period_str = ", ".join(map(str, STAKING_REWARD_RATES.keys()))
            return False, None, f"Некоректний період стейкінгу. Доступні періоди: {period_str}"

        # Визначаємо відсоток винагороди для періоду
        reward_percent = STAKING_REWARD_RATES[period]

        # Створюємо транзакційний блок для атомарних операцій
        try:
            # 1. Спочатку створюємо сесію стейкінгу
            staking_session = create_staking_session(
                user_id=telegram_id,
                amount_staked=amount,
                staking_days=period,
                reward_percent=reward_percent
            )

            if not staking_session:
                return False, None, "Помилка створення стейкінгу"

            # 2. Якщо сесія створена успішно, віднімаємо кошти з балансу
            new_balance = current_balance - amount
            balance_update = update_balance(telegram_id, -amount)

            if not balance_update:
                # Якщо оновлення балансу не вдалося, видаляємо створену сесію
                delete_staking_session(staking_session["id"])
                return False, None, "Помилка оновлення балансу"

            # 3. Додаємо запис транзакції
            transaction = {
                "telegram_id": telegram_id,
                "type": "stake",
                "amount": -amount,
                "description": f"Стейкінг на {period} днів ({reward_percent}% прибутку) (ID: {staking_session['id']})",
                "status": "completed",
                "staking_id": staking_session['id']
            }

            if supabase:
                transaction_res = supabase.table("transactions").insert(transaction).execute()
                if not transaction_res.data:
                    logger.warning(
                        f"create_staking: Не вдалося створити транзакцію для стейкінгу {staking_session['id']}")
                    # Тут можна було б відкатити зміни, але це ускладнить код
                    # Просто логуємо проблему, оскільки основні операції вже виконано

            # Розраховуємо очікувану винагороду
            expected_reward = calculate_staking_reward(amount, period)

            # Формуємо дані для відповіді з коректною обробкою дат
            try:
                started_at = datetime.fromisoformat(staking_session["started_at"].replace('Z', '+00:00')) if isinstance(
                    staking_session["started_at"], str) else staking_session["started_at"]
                ends_at = datetime.fromisoformat(staking_session["ends_at"].replace('Z', '+00:00')) if isinstance(
                    staking_session["ends_at"], str) else staking_session["ends_at"]

                # Забезпечуємо наявність часового поясу
                if started_at.tzinfo is None:
                    started_at = started_at.replace(tzinfo=timezone.utc)
                if ends_at.tzinfo is None:
                    ends_at = ends_at.replace(tzinfo=timezone.utc)
            except Exception as e:
                logger.error(f"Помилка парсингу дат: {str(e)}")
                # Використовуємо дати як є
                started_at = staking_session["started_at"]
                ends_at = staking_session["ends_at"]

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

            return True, {"staking": staking_data, "balance": new_balance}, "Стейкінг успішно створено"
        except Exception as e:
            logger.error(f"create_staking: Помилка в транзакційному блоці: {str(e)}")
            # Тут можна було б спробувати відкатити зміни, але це потребує більш складної логіки
            return False, None, f"Помилка при створенні стейкінгу: {str(e)}"

    except Exception as e:
        logger.error(f"Помилка створення стейкінгу для користувача {telegram_id}: {str(e)}")
        logger.error(traceback.format_exc())
        return False, None, f"Помилка: {str(e)}"


def add_to_staking(telegram_id: str, staking_id: str, additional_amount: Union[int, float]) -> Tuple[
    bool, Optional[Dict[str, Any]], str]:
    """
    Додає кошти до існуючого активного стейкінгу.

    Args:
        telegram_id (str): ID користувача в Telegram
        staking_id (str): ID стейкінгу
        additional_amount (float): Сума для додавання

    Returns:
        tuple: (success: bool, result: dict, message: str)
    """
    try:
        # Перетворюємо ID в рядок
        telegram_id = str(telegram_id)

        # Додаткове логування
        logger.info(
            f"add_to_staking: Додавання {additional_amount} до стейкінгу {staking_id} користувача {telegram_id}")

        # Перетворюємо додаткову суму на число
        try:
            additional_amount = float(additional_amount)
        except (ValueError, TypeError) as e:
            return False, None, f"Некоректний формат суми: {str(e)}"

        # Перевіряємо, чи сума є цілим числом
        if additional_amount != int(additional_amount):
            return False, None, "Сума додавання має бути цілим числом"

        additional_amount = int(additional_amount)

        if additional_amount <= 0:
            return False, None, "Сума має бути більше нуля"

        # Отримуємо сесію стейкінгу
        staking_session = get_staking_session(staking_id)
        if not staking_session:
            return False, None, f"Стейкінг з ID {staking_id} не знайдено"

        # Перевіряємо, чи стейкінг належить користувачу (перевіряємо обидва поля)
        if str(staking_session.get("user_id", "")) != telegram_id and str(
                staking_session.get("telegram_id", "")) != telegram_id:
            logger.error(
                f"add_to_staking: Стейкінг {staking_id} не належить користувачу {telegram_id}. user_id={staking_session.get('user_id')}, telegram_id={staking_session.get('telegram_id')}")
            return False, None, "Ви не маєте прав на цей стейкінг"

        # Перевіряємо, чи стейкінг активний
        if not staking_session["is_active"]:
            return False, None, "Стейкінг вже завершено"

        # Отримуємо користувача для перевірки балансу
        user = get_user(telegram_id)
        if not user:
            return False, None, "Користувача не знайдено"

        # Перевіряємо баланс
        current_balance = float(user.get("balance", 0))
        if current_balance < additional_amount:
            return False, None, f"Недостатньо коштів. Ваш баланс: {current_balance}, необхідно: {additional_amount}"

        # Транзакційний блок для атомарних операцій
        try:
            # 1. Спочатку оновлюємо сесію стейкінгу
            current_amount = float(staking_session["amount_staked"])
            new_amount = current_amount + additional_amount

            updated_session = update_staking_session(staking_id, {"amount_staked": new_amount})
            if not updated_session:
                return False, None, "Помилка оновлення стейкінгу"

            # 2. Оновлюємо баланс користувача
            new_balance = current_balance - additional_amount
            balance_update = update_balance(telegram_id, -additional_amount)

            if not balance_update:
                # Якщо оновлення балансу не вдалося, відкатуємо зміни в стейкінгу
                update_staking_session(staking_id, {"amount_staked": current_amount})
                return False, None, "Помилка оновлення балансу"

            # 3. Додаємо запис транзакції
            transaction = {
                "telegram_id": telegram_id,
                "type": "stake",
                "amount": -additional_amount,
                "description": f"Додано до активного стейкінгу {additional_amount} WINIX (ID: {staking_id})",
                "status": "completed",
                "staking_id": staking_id
            }

            if supabase:
                transaction_res = supabase.table("transactions").insert(transaction).execute()
                if not transaction_res.data:
                    logger.warning(f"add_to_staking: Не вдалося створити транзакцію для стейкінгу {staking_id}")

            # Перевіряємо, чи відбулося оновлення
            check_session = get_staking_session(staking_id)
            if float(check_session["amount_staked"]) != new_amount:
                logger.error(
                    f"add_to_staking: Сума після оновлення не відповідає очікуваній: {check_session['amount_staked']} != {new_amount}")
                # Спроба повторного оновлення
                update_staking_session(staking_id, {"amount_staked": new_amount})

            # Розраховуємо нову очікувану винагороду
            period = int(updated_session["staking_days"])
            reward_percent = float(updated_session["reward_percent"])
            expected_reward = calculate_staking_reward(new_amount, period)

            # Формуємо дані для відповіді з коректною обробкою дат
            try:
                started_at = datetime.fromisoformat(updated_session["started_at"].replace('Z', '+00:00')) if isinstance(
                    updated_session["started_at"], str) else updated_session["started_at"]
                ends_at = datetime.fromisoformat(updated_session["ends_at"].replace('Z', '+00:00')) if isinstance(
                    updated_session["ends_at"], str) else updated_session["ends_at"]

                # Забезпечуємо наявність часового поясу
                if started_at.tzinfo is None:
                    started_at = started_at.replace(tzinfo=timezone.utc)
                if ends_at.tzinfo is None:
                    ends_at = ends_at.replace(tzinfo=timezone.utc)

                # Поточний час з часовим поясом
                now = datetime.now(timezone.utc)
            except Exception as e:
                logger.error(f"Помилка парсингу дат: {str(e)}")
                # Використовуємо "naive" дати
                started_at = datetime.fromisoformat(updated_session["started_at"].replace('Z', '')) if isinstance(
                    updated_session["started_at"], str) else updated_session["started_at"]
                ends_at = datetime.fromisoformat(updated_session["ends_at"].replace('Z', '')) if isinstance(
                    updated_session["ends_at"], str) else updated_session["ends_at"]
                # Видаляємо часовий пояс, якщо він є
                if hasattr(started_at, 'tzinfo') and started_at.tzinfo is not None:
                    started_at = started_at.replace(tzinfo=None)
                if hasattr(ends_at, 'tzinfo') and ends_at.tzinfo is not None:
                    ends_at = ends_at.replace(tzinfo=None)
                now = datetime.now()

            remaining_days = max(0, (ends_at - now).days)

            staking_data = {
                "hasActiveStaking": True,
                "stakingId": updated_session["id"],
                "stakingAmount": new_amount,
                "period": period,
                "rewardPercent": reward_percent,
                "expectedReward": expected_reward,
                "remainingDays": remaining_days,
                "startDate": updated_session["started_at"],
                "endDate": updated_session["ends_at"]
            }

            return True, {
                "staking": staking_data,
                "balance": new_balance,
                "addedAmount": additional_amount,
                "previousAmount": current_amount,
                "newAmount": new_amount,
                "newReward": expected_reward
            }, f"Додано {additional_amount} WINIX до стейкінгу"
        except Exception as e:
            logger.error(f"add_to_staking: Помилка в транзакційному блоці: {str(e)}")
            # Тут можна реалізувати логіку відкату змін
            return False, None, f"Помилка додавання до стейкінгу: {str(e)}"

    except Exception as e:
        logger.error(f"Помилка додавання до стейкінгу: {str(e)}")
        logger.error(traceback.format_exc())
        return False, None, f"Помилка: {str(e)}"

def cancel_staking(telegram_id: str, staking_id: str) -> Tuple[bool, Optional[Dict[str, Any]], str]:
    """
    Скасовує активний стейкінг з урахуванням штрафу.

    Args:
        telegram_id (str): ID користувача в Telegram
        staking_id (str): ID стейкінгу

    Returns:
        tuple: (success: bool, result: dict, message: str)
    """
    try:
        # Перетворюємо ID в рядок
        telegram_id = str(telegram_id)

        # Отримуємо сесію стейкінгу
        staking_session = get_staking_session(staking_id)
        if not staking_session:
            return False, None, f"Стейкінг з ID {staking_id} не знайдено"

        # Перевіряємо, чи стейкінг належить користувачу (перевіряємо обидва поля)
        if str(staking_session.get("user_id", "")) != telegram_id and str(staking_session.get("telegram_id", "")) != telegram_id:
            return False, None, "Ви не маєте прав на цей стейкінг"

        # Перевіряємо, чи стейкінг активний
        if not staking_session["is_active"]:
            return False, None, "Стейкінг вже завершено"

        # Отримуємо користувача
        user = get_user(telegram_id)
        if not user:
            return False, None, "Користувача не знайдено"

        # Розраховуємо штраф (20% від суми стейкінгу)
        staking_amount = float(staking_session["amount_staked"])
        fee_amount = staking_amount * STAKING_CANCELLATION_FEE
        returned_amount = staking_amount - fee_amount

        # Оновлюємо баланс користувача
        current_balance = float(user.get("balance", 0))
        new_balance = current_balance + returned_amount
        balance_update = update_balance(telegram_id, returned_amount)
        if not balance_update:
            return False, None, "Помилка оновлення балансу"

        # Завершуємо сесію стейкінгу як скасовану достроково
        completed_session = complete_staking_session(
            session_id=staking_id,
            final_amount=returned_amount,
            cancelled_early=True
        )

        if not completed_session:
            # Повертаємо кошти у випадку помилки
            update_balance(telegram_id, -returned_amount)
            return False, None, "Помилка скасування стейкінгу"

        # Формуємо пустий об'єкт стейкінгу для відповіді
        empty_staking = {
            "hasActiveStaking": False,
            "stakingAmount": 0,
            "period": 0,
            "rewardPercent": 0,
            "expectedReward": 0,
            "remainingDays": 0
        }

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
        logger.error(traceback.format_exc())
        return False, None, f"Помилка: {str(e)}"


def finalize_staking(telegram_id: str, staking_id: str, force: bool = False) -> Tuple[
    bool, Optional[Dict[str, Any]], str]:
    """
    Завершує стейкінг і нараховує винагороду.

    Args:
        telegram_id (str): ID користувача в Telegram
        staking_id (str): ID стейкінгу
        force (bool): Примусове завершення, незважаючи на дату

    Returns:
        tuple: (success: bool, result: dict, message: str)
    """
    try:
        # Перетворюємо ID в рядок
        telegram_id = str(telegram_id)

        # Отримуємо сесію стейкінгу
        staking_session = get_staking_session(staking_id)
        if not staking_session:
            return False, None, f"Стейкінг з ID {staking_id} не знайдено"

        # Перевіряємо, чи стейкінг належить користувачу (перевіряємо обидва поля)
        if str(staking_session.get("user_id", "")) != telegram_id and str(
                staking_session.get("telegram_id", "")) != telegram_id:
            return False, None, "Ви не маєте прав на цей стейкінг"

        # Перевіряємо, чи стейкінг активний
        if not staking_session["is_active"]:
            return False, None, "Стейкінг вже завершено"

        # Перевіряємо, чи можна завершити стейкінг (якщо не force)
        if not force:
            try:
                ends_at = datetime.fromisoformat(staking_session["ends_at"].replace('Z', '+00:00')) if isinstance(
                    staking_session["ends_at"], str) else staking_session["ends_at"]
                if ends_at.tzinfo is None:
                    ends_at = ends_at.replace(tzinfo=timezone.utc)
                now = datetime.now(timezone.utc)
            except Exception as e:
                logger.error(f"Помилка парсингу дат: {str(e)}")
                # Використовуємо "naive" дати у випадку помилки
                ends_at = datetime.fromisoformat(staking_session["ends_at"].replace('Z', '')) if isinstance(
                    staking_session["ends_at"], str) else staking_session["ends_at"]
                if hasattr(ends_at, 'tzinfo') and ends_at.tzinfo is not None:
                    ends_at = ends_at.replace(tzinfo=None)
                now = datetime.now()

            if now < ends_at:
                remaining_days = (ends_at - now).days
                return False, None, f"Стейкінг ще не завершено. Залишилось {remaining_days} днів."

        # Отримуємо користувача
        user = get_user(telegram_id)
        if not user:
            return False, None, "Користувача не знайдено"

        # Розраховуємо винагороду
        staking_amount = float(staking_session["amount_staked"])
        reward_percent = float(staking_session["reward_percent"])
        expected_reward = (staking_amount * reward_percent) / 100
        total_amount = staking_amount + expected_reward

        # Оновлюємо баланс користувача
        current_balance = float(user.get("balance", 0))
        new_balance = current_balance + total_amount
        balance_update = update_balance(telegram_id, total_amount)
        if not balance_update:
            return False, None, "Помилка оновлення балансу"

        # Завершуємо сесію стейкінгу (без скасування)
        completed_session = complete_staking_session(
            session_id=staking_id,
            final_amount=total_amount,
            cancelled_early=False
        )

        if not completed_session:
            # Повертаємо кошти у випадку помилки
            update_balance(telegram_id, -total_amount)
            return False, None, "Помилка завершення стейкінгу"

        # ДОДАНО: Перевірка зарахування коштів на баланс та повторна спроба
        # Перевіряємо баланс користувача після оновлення
        updated_user = get_user(telegram_id)
        if updated_user:
            updated_balance = float(updated_user.get("balance", 0))

            # Якщо баланс користувача не збільшився на очікувану суму,
            # можливо, що гроші не були зараховані правильно
            if abs(updated_balance - new_balance) > 0.01:  # Допускаємо невелику похибку
                logger.warning(f"finalize_staking: Виявлено розбіжність у балансі після завершення стейкінгу. "
                               f"Очікуваний: {new_balance}, Фактичний: {updated_balance}")

                # Розраховуємо різницю для коригування
                balance_diff = new_balance - updated_balance

                # Повторна спроба оновлення балансу
                retry_update = update_balance(telegram_id, balance_diff)
                if retry_update:
                    logger.info(f"finalize_staking: Успішно виконано коригування балансу на {balance_diff} WINIX")

                    # Додаємо транзакцію про коригування
                    try:
                        correction_transaction = {
                            "telegram_id": telegram_id,
                            "type": "correction",
                            "amount": balance_diff,
                            "description": f"Коригування балансу після завершення стейкінгу (ID: {staking_id})",
                            "status": "completed"
                        }

                        if supabase:
                            supabase.table("transactions").insert(correction_transaction).execute()
                            logger.info(f"Транзакцію про коригування балансу створено")
                    except Exception as e:
                        logger.error(f"Помилка при створенні транзакції коригування: {str(e)}")
        else:
            logger.warning(f"finalize_staking: Не вдалося отримати оновлені дані користувача для перевірки балансу")

        # Формуємо пустий об'єкт стейкінгу для відповіді
        empty_staking = {
            "hasActiveStaking": False,
            "stakingAmount": 0,
            "period": 0,
            "rewardPercent": 0,
            "expectedReward": 0,
            "remainingDays": 0
        }

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
                logger.info(f"Транзакцію про завершення стейкінгу створено")
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
        logger.error(traceback.format_exc())
        return False, None, f"Помилка: {str(e)}"

def get_staking_history(telegram_id: str) -> Tuple[bool, Optional[List[Dict[str, Any]]], str]:
    """
    Отримує історію стейкінгу користувача.

    Args:
        telegram_id (str): ID користувача в Telegram

    Returns:
        tuple: (success: bool, data: list, message: str)
    """
    try:
        # Перетворюємо ID в рядок
        telegram_id = str(telegram_id)

        # Отримуємо всі сесії стейкінгу користувача (включно з неактивними)
        all_sessions = get_user_staking_sessions(telegram_id, active_only=False)

        if not all_sessions:
            return True, [], "Історія стейкінгу порожня"

        # Перетворюємо сесії в формат для клієнта
        history_items = []

        for session in all_sessions:
            # Формуємо дані для кожної сесії з коректною обробкою дат
            try:
                started_at = datetime.fromisoformat(session["started_at"].replace('Z', '+00:00')) if isinstance(session["started_at"], str) else session["started_at"]
                ends_at = datetime.fromisoformat(session["ends_at"].replace('Z', '+00:00')) if isinstance(session["ends_at"], str) else session["ends_at"]

                # Забезпечуємо наявність часового поясу
                if started_at.tzinfo is None:
                    started_at = started_at.replace(tzinfo=timezone.utc)
                if ends_at.tzinfo is None:
                    ends_at = ends_at.replace(tzinfo=timezone.utc)
            except Exception as e:
                logger.error(f"Помилка парсингу дат: {str(e)}")
                # Використовуємо дати як є
                started_at = session["started_at"]
                ends_at = session["ends_at"]

            # Визначаємо статус
            status = "active" if session["is_active"] else ("cancelled" if session["cancelled_early"] else "completed")

            # Розраховуємо винагороду і штраф якщо потрібно
            amount_staked = float(session["amount_staked"])
            reward_percent = float(session["reward_percent"])

            if status == "completed":
                expected_reward = (amount_staked * reward_percent) / 100
                returned_amount = amount_staked + expected_reward
                fee_amount = 0
            elif status == "cancelled":
                fee_amount = amount_staked * STAKING_CANCELLATION_FEE
                returned_amount = amount_staked - fee_amount
                expected_reward = 0
            else:  # active
                expected_reward = (amount_staked * reward_percent) / 100
                returned_amount = 0
                fee_amount = 0

            history_item = {
                "stakingId": session["id"],
                "stakingAmount": amount_staked,
                "period": int(session["staking_days"]),
                "rewardPercent": reward_percent,
                "expectedReward": expected_reward,
                "startDate": session["started_at"],
                "endDate": session["ends_at"],
                "status": status,
                "hasActiveStaking": session["is_active"],
                "returnedAmount": float(session["final_amount_paid"]) if session["final_amount_paid"] else returned_amount,
                "feeAmount": fee_amount if status == "cancelled" else 0
            }

            # Додаємо дату завершення/скасування якщо є
            if not session["is_active"]:
                # Перевіряємо наявність поля completed_at
                if "completed_at" in session and session["completed_at"]:
                    history_item["completedDate"] = session["completed_at"]
                # Якщо немає completed_at, використовуємо updated_at
                elif "updated_at" in session:
                    history_item["completedDate"] = session["updated_at"]
                    if session["cancelled_early"]:
                        history_item["cancelledDate"] = session["updated_at"]

            history_items.append(history_item)

        return True, history_items, "Історія стейкінгу успішно отримана"

    except Exception as e:
        logger.error(f"Помилка отримання історії стейкінгу: {str(e)}")
        logger.error(traceback.format_exc())
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
        try:
            amount = float(amount)
            period = int(period)
        except (ValueError, TypeError) as e:
            logger.error(f"calculate_staking_reward: Некоректний формат параметрів: {str(e)}")
            return 0

        # Перевіряємо параметри
        if amount <= 0 or period <= 0:
            logger.warning(f"calculate_staking_reward: Некоректні параметри: amount={amount}, period={period}")
            return 0

        # Перевіряємо, чи сума є цілим числом
        if amount != int(amount):
            logger.warning(f"calculate_staking_reward: Сума {amount} не є цілим числом, буде округлена до {int(amount)}")
            amount = int(amount)

        # Отримуємо відсоток винагороди
        reward_percent = STAKING_REWARD_RATES.get(period, 9)

        # Розраховуємо винагороду
        reward = (amount * reward_percent) / 100

        # Округлюємо до 2 знаків після коми для уникнення проблем з точністю
        return round(reward, 2)
    except Exception as e:
        logger.error(f"Помилка розрахунку винагороди: {str(e)}")
        return 0


def reset_and_repair_staking(telegram_id: str, force: bool = False) -> Tuple[Dict[str, Any], int]:
    """
    Відновлення стану стейкінгу після помилок.

    Args:
        telegram_id (str): ID користувача в Telegram
        force (bool): Примусове відновлення (скасування стейкінгу)

    Returns:
        tuple: (response_json: dict, status_code: int)
    """
    try:
        # Перетворюємо ID в рядок
        telegram_id = str(telegram_id)

        # Спочатку виконуємо перевірку цілісності даних стейкінгу
        verify_staking_consistency(telegram_id)

        # Викликаємо покращену функцію відновлення сесії стейкінгу
        repair_result = repair_staking_session(telegram_id)

        if repair_result.get("status") == "success":
            # Отримуємо активні сесії стейкінгу
            active_sessions = get_user_staking_sessions(telegram_id, active_only=True)

            # Примусове скасування всіх сесій, якщо вказано force=True
            if force and active_sessions and len(active_sessions) > 0:
                cancelled_count = 0

                for session in active_sessions:
                    try:
                        success, result, message = cancel_staking(
                            telegram_id=telegram_id,
                            staking_id=session["id"]
                        )

                        if success:
                            cancelled_count += 1
                    except Exception as e:
                        logger.error(f"Помилка скасування сесії {session['id']}: {str(e)}")

                if cancelled_count > 0:
                    return {
                        "status": "success",
                        "message": f"Примусове відновлення виконано. Скасовано {cancelled_count} активних сесій."
                    }, 200

            # Повертаємо результат ремонту
            return repair_result, 200
        else:
            # Якщо ремонт не вдався, повертаємо помилку
            return repair_result, 500

    except Exception as e:
        logger.error(f"Помилка відновлення стейкінгу: {str(e)}")
        logger.error(traceback.format_exc())
        return {"status": "error", "message": f"Помилка відновлення стейкінгу: {str(e)}"}, 500


def deep_repair_staking(telegram_id: str, balance_adjustment: float = 0) -> Tuple[Dict[str, Any], int]:
    """
    Глибоке відновлення стану стейкінгу з можливістю коригування балансу.

    Args:
        telegram_id (str): ID користувача в Telegram
        balance_adjustment (float): Сума для коригування балансу (може бути від'ємною)

    Returns:
        tuple: (response_json: dict, status_code: int)
    """
    try:
        # Перетворюємо ID в рядок
        telegram_id = str(telegram_id)

        # Отримуємо користувача
        user = get_user(telegram_id)
        if not user:
            return {"status": "error", "message": "Користувача не знайдено"}, 404

        # Отримуємо всі сесії стейкінгу користувача
        all_sessions = get_user_staking_sessions(telegram_id, active_only=False)

        # Зберігаємо поточний баланс
        current_balance = float(user.get("balance", 0))
        new_balance = current_balance + float(balance_adjustment)

        # Позначаємо всі активні сесії як скасовані
        cancelled_count = 0
        for session in all_sessions:
            if session["is_active"]:
                try:
                    # Безпосередньо завершуємо сесію як скасовану
                    completed_session = complete_staking_session(
                        session_id=session["id"],
                        final_amount=0,
                        cancelled_early=True
                    )

                    if completed_session:
                        cancelled_count += 1
                except Exception as e:
                    logger.error(f"Помилка скасування сесії {session['id']}: {str(e)}")

        # Оновлюємо баланс користувача
        if balance_adjustment != 0:
            result = update_balance(telegram_id, balance_adjustment)
            if not result:
                return {"status": "error", "message": "Помилка оновлення балансу"}, 500

            # Додаємо інформативну транзакцію
            try:
                transaction = {
                    "telegram_id": telegram_id,
                    "type": "system",
                    "amount": balance_adjustment,
                    "description": f"Системне коригування балансу при глибокому відновленні",
                    "status": "completed"
                }

                supabase.table("transactions").insert(transaction).execute()
            except Exception as e:
                logger.error(f"Помилка при створенні транзакції: {str(e)}")

        return {
            "status": "success",
            "message": "Глибоке відновлення стейкінгу успішно завершено",
            "data": {
                "previous_balance": current_balance,
                "newBalance": new_balance,
                "adjustment": balance_adjustment,
                "cancelledSessions": cancelled_count
            }
        }, 200

    except Exception as e:
        logger.error(f"Помилка глибокого відновлення стейкінгу: {str(e)}")
        logger.error(traceback.format_exc())
        return {"status": "error", "message": f"Помилка глибокого відновлення: {str(e)}"}, 500