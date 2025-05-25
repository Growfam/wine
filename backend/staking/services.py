"""
Сервіс для управління стейкінгом.
Містить логіку створення, зміни та скасування стейкінгу.
Використовує таблицю staking_sessions для збереження даних стейкінгу.
"""
import logging
from datetime import datetime, timezone
import uuid
from typing import Tuple, Dict, Union, Any, Optional, List
import traceback

# Налаштування логування
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Імпорт суппабейс клієнта (ВИПРАВЛЕНИЙ)
from supabase_client import (
    get_user, update_user, update_balance, supabase,
    get_user_staking_sessions, get_staking_session,  # ✅ Тепер ця функція існує!
    update_staking_session, complete_staking_session,
    delete_staking_session, verify_staking_consistency,
    create_staking_session, get_all_active_staking_sessions,
    check_and_complete_expired_staking_sessions, cached
)

# Імпорт моделі стейкінгу для констант
try:
    from backend.models.staking_session import StakingSession

    # Використовуємо константи з моделі
    STAKING_REWARD_RATES = StakingSession.STAKING_REWARD_RATES
    STAKING_CANCELLATION_FEE = StakingSession.STAKING_CANCELLATION_FEE
    MIN_STAKING_AMOUNT = StakingSession.MIN_STAKING_AMOUNT
    MAX_STAKING_PERCENTAGE = StakingSession.MAX_STAKING_PERCENTAGE
except ImportError:
    logger.warning("Не вдалося імпортувати StakingSession, використовуються стандартні значення")
    # Відсотки винагороди за різні періоди стейкінгу
    STAKING_REWARD_RATES = {
        7: 5.0,    # 5% за 7 днів
        14: 9.0,   # 9% за 14 днів
        28: 15.0   # 15% за 28 днів
    }
    # Штраф при скасуванні стейкінгу (20%)
    STAKING_CANCELLATION_FEE = 0.2
    # Мінімальна сума стейкінгу
    MIN_STAKING_AMOUNT = 50
    # Максимальний відсоток від балансу для стейкінгу
    MAX_STAKING_PERCENTAGE = 0.9


def api_result(success: bool, data: Optional[Dict[str, Any]] = None,
              message: str = "") -> Tuple[bool, Optional[Dict[str, Any]], str]:
    """Стандартний формат відповіді від сервісних функцій"""
    return success, data, message


@cached()
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
            # Парсимо дати, забезпечуючи коректну обробку часового поясу
            started_at = parse_date_with_timezone(session.get("started_at"))
            ends_at = parse_date_with_timezone(session.get("ends_at"))

            # Поточний час з часовим поясом
            now = datetime.now(timezone.utc)

            # Розраховуємо залишок днів
            remaining_days = max(0, (ends_at - now).days)

            # Якщо стейкінг закінчився, але ще активний, автоматично завершуємо його
            if remaining_days == 0 and session.get("is_active", False):
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
            logger.error(f"Помилка обробки дат стейкінгу: {str(e)}")
            logger.error(traceback.format_exc())

            # Спробуємо простіший підхід, якщо була помилка з датами
            try:
                # Отримуємо сесію стейкінгу ще раз для оновлених даних
                session_detailed = get_staking_session(session["id"])
                if not session_detailed:
                    return False, None

                # Формуємо базові дані без залежності від коректної обробки дат
                staking_data = {
                    "hasActiveStaking": True,
                    "stakingId": session_detailed["id"],
                    "stakingAmount": float(session_detailed["amount_staked"]),
                    "period": int(session_detailed["staking_days"]),
                    "rewardPercent": float(session_detailed["reward_percent"]),
                    "expectedReward": calculate_staking_reward(float(session_detailed["amount_staked"]), int(session_detailed["staking_days"])),
                    "remainingDays": 0,  # За замовчуванням вважаємо що залишилося 0 днів
                    "startDate": session_detailed["started_at"],
                    "endDate": session_detailed["ends_at"]
                }

                return True, staking_data
            except Exception as inner_e:
                logger.error(f"Помилка обробки даних стейкінгу (запасний варіант): {str(inner_e)}")
                return False, None

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

        # Перевіряємо, чи є активний стейкінг
        has_active_staking, active_staking_data = check_active_staking(telegram_id)
        if has_active_staking:
            return api_result(False, None, "У вас вже є активний стейкінг")

        # Отримуємо користувача для перевірки балансу
        user = get_user(telegram_id)
        if not user:
            return api_result(False, None, "Користувача не знайдено")

        # Перевіряємо баланс (завжди як float для уникнення проблем з порівнянням)
        current_balance = float(user.get("balance", 0))
        if current_balance < amount:
            return api_result(False, None, f"Недостатньо коштів. Ваш баланс: {current_balance}, необхідно: {amount}")

        # Перевіряємо валідність періоду
        if period not in STAKING_REWARD_RATES:
            period_str = ", ".join(map(str, STAKING_REWARD_RATES.keys()))
            return api_result(False, None, f"Некоректний період стейкінгу. Доступні періоди: {period_str}")

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
                return api_result(False, None, "Помилка створення стейкінгу")

            # 2. Якщо сесія створена успішно, віднімаємо кошти з балансу
            new_balance = current_balance - amount
            balance_update = update_balance(telegram_id, -amount)

            if not balance_update:
                # Якщо оновлення балансу не вдалося, видаляємо створену сесію
                delete_staking_session(staking_session["id"])
                return api_result(False, None, "Помилка оновлення балансу")

            # 3. Додаємо запис транзакції
            transaction = {
                "telegram_id": telegram_id,
                "type": "stake",
                "amount": -amount,
                "description": f"Стейкінг на {period} днів ({reward_percent}% прибутку) (ID: {staking_session['id']})",
                "status": "completed",
                "staking_id": staking_session['id'],
                "created_at": datetime.now(timezone.utc).isoformat()
            }

            if supabase:
                transaction_res = supabase.table("transactions").insert(transaction).execute()
                if not transaction_res.data:
                    logger.warning(
                        f"create_staking: Не вдалося створити транзакцію для стейкінгу {staking_session['id']}")

            # Розраховуємо очікувану винагороду
            expected_reward = calculate_staking_reward(amount, period)

            # Формуємо дані для відповіді
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

            return api_result(
                True,
                {"staking": staking_data, "balance": new_balance},
                "Стейкінг успішно створено"
            )
        except Exception as e:
            logger.error(f"create_staking: Помилка в транзакційному блоці: {str(e)}")
            logger.error(traceback.format_exc())

            # Спроба відкату змін
            try:
                if 'staking_session' in locals() and staking_session:
                    delete_staking_session(staking_session["id"])

                if 'balance_update' in locals() and balance_update:
                    update_balance(telegram_id, amount)  # Повертаємо кошти
            except Exception as rollback_error:
                logger.error(f"create_staking: Помилка відкату змін: {str(rollback_error)}")

            return api_result(False, None, f"Помилка при створенні стейкінгу: {str(e)}")

    except Exception as e:
        logger.error(f"Помилка створення стейкінгу для користувача {telegram_id}: {str(e)}")
        logger.error(traceback.format_exc())
        return api_result(False, None, f"Помилка: {str(e)}")


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

        # Отримуємо сесію стейкінгу
        staking_session = get_staking_session(staking_id)
        if not staking_session:
            return api_result(False, None, f"Стейкінг з ID {staking_id} не знайдено")

        # Перевіряємо, чи стейкінг належить користувачу (перевіряємо обидва поля)
        if str(staking_session.get("user_id", "")) != telegram_id and str(
                staking_session.get("telegram_id", "")) != telegram_id:
            logger.error(
                f"add_to_staking: Стейкінг {staking_id} не належить користувачу {telegram_id}. user_id={staking_session.get('user_id')}, telegram_id={staking_session.get('telegram_id')}")
            return api_result(False, None, "Ви не маєте прав на цей стейкінг")

        # Перевіряємо, чи стейкінг активний
        if not staking_session.get("is_active", True):
            return api_result(False, None, "Стейкінг вже завершено")

        # Отримуємо користувача для перевірки балансу
        user = get_user(telegram_id)
        if not user:
            return api_result(False, None, "Користувача не знайдено")

        # Перевіряємо баланс
        current_balance = float(user.get("balance", 0))
        if current_balance < additional_amount:
            return api_result(False, None, f"Недостатньо коштів. Ваш баланс: {current_balance}, необхідно: {additional_amount}")

        # Транзакційний блок для атомарних операцій
        try:
            # 1. Спочатку оновлюємо сесію стейкінгу
            current_amount = float(staking_session.get("amount_staked", 0))
            new_amount = current_amount + additional_amount

            updated_session = update_staking_session(staking_id, {"amount_staked": new_amount})
            if not updated_session:
                return api_result(False, None, "Помилка оновлення стейкінгу")

            # 2. Оновлюємо баланс користувача
            new_balance = current_balance - additional_amount
            balance_update = update_balance(telegram_id, -additional_amount)

            if not balance_update:
                # Якщо оновлення балансу не вдалося, відкатуємо зміни в стейкінгу
                update_staking_session(staking_id, {"amount_staked": current_amount})
                return api_result(False, None, "Помилка оновлення балансу")

            # 3. Додаємо запис транзакції
            transaction = {
                "telegram_id": telegram_id,
                "type": "stake",
                "amount": -additional_amount,
                "description": f"Додано до активного стейкінгу {additional_amount} WINIX (ID: {staking_id})",
                "status": "completed",
                "staking_id": staking_id,
                "created_at": datetime.now(timezone.utc).isoformat()
            }

            if supabase:
                transaction_res = supabase.table("transactions").insert(transaction).execute()
                if not transaction_res.data:
                    logger.warning(f"add_to_staking: Не вдалося створити транзакцію для стейкінгу {staking_id}")

            # Розраховуємо нову очікувану винагороду
            period = int(updated_session.get("staking_days", 14))
            reward_percent = float(updated_session.get("reward_percent", 9.0))
            expected_reward = calculate_staking_reward(new_amount, period)

            # Формуємо дані для відповіді
            try:
                # Отримуємо дати, забезпечуючи правильну обробку часового поясу
                started_at = parse_date_with_timezone(updated_session.get("started_at"))
                ends_at = parse_date_with_timezone(updated_session.get("ends_at"))

                # Поточний час
                now = datetime.now(timezone.utc)

                # Розраховуємо залишок днів
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

                return api_result(
                    True,
                    {
                        "staking": staking_data,
                        "balance": new_balance,
                        "addedAmount": additional_amount,
                        "previousAmount": current_amount,
                        "newAmount": new_amount,
                        "newReward": expected_reward
                    },
                    f"Додано {additional_amount} WINIX до стейкінгу"
                )
            except Exception as date_error:
                logger.error(f"add_to_staking: Помилка обробки дат: {str(date_error)}")

                # Запасний варіант, якщо виникла помилка з датами
                staking_data = {
                    "hasActiveStaking": True,
                    "stakingId": updated_session["id"],
                    "stakingAmount": new_amount,
                    "period": period,
                    "rewardPercent": reward_percent,
                    "expectedReward": expected_reward,
                    "remainingDays": 0,  # За замовчуванням
                    "startDate": updated_session["started_at"],
                    "endDate": updated_session["ends_at"]
                }

                return api_result(
                    True,
                    {
                        "staking": staking_data,
                        "balance": new_balance,
                        "addedAmount": additional_amount,
                        "previousAmount": current_amount,
                        "newAmount": new_amount,
                        "newReward": expected_reward
                    },
                    f"Додано {additional_amount} WINIX до стейкінгу"
                )
        except Exception as e:
            logger.error(f"add_to_staking: Помилка в транзакційному блоці: {str(e)}")
            logger.error(traceback.format_exc())

            # Спроба відкату змін
            try:
                if 'updated_session' in locals() and updated_session:
                    update_staking_session(staking_id, {"amount_staked": current_amount})

                if 'balance_update' in locals() and balance_update:
                    update_balance(telegram_id, additional_amount)  # Повертаємо кошти
            except Exception as rollback_error:
                logger.error(f"add_to_staking: Помилка відкату змін: {str(rollback_error)}")

            return api_result(False, None, f"Помилка додавання до стейкінгу: {str(e)}")

    except Exception as e:
        logger.error(f"Помилка додавання до стейкінгу: {str(e)}")
        logger.error(traceback.format_exc())
        return api_result(False, None, f"Помилка: {str(e)}")


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
            return api_result(False, None, f"Стейкінг з ID {staking_id} не знайдено")

        # Перевіряємо, чи стейкінг належить користувачу (перевіряємо обидва поля)
        if str(staking_session.get("user_id", "")) != telegram_id and str(staking_session.get("telegram_id", "")) != telegram_id:
            return api_result(False, None, "Ви не маєте прав на цей стейкінг")

        # Перевіряємо, чи стейкінг активний
        if not staking_session.get("is_active", False):
            return api_result(False, None, "Стейкінг вже завершено")

        # Отримуємо користувача
        user = get_user(telegram_id)
        if not user:
            return api_result(False, None, "Користувача не знайдено")

        # Розраховуємо штраф (20% від суми стейкінгу)
        staking_amount = float(staking_session.get("amount_staked", 0))
        fee_amount = staking_amount * STAKING_CANCELLATION_FEE
        returned_amount = staking_amount - fee_amount

        # Транзакційний блок
        try:
            # 1. Завершуємо сесію стейкінгу як скасовану достроково
            completed_session = complete_staking_session(
                session_id=staking_id,
                final_amount=returned_amount,
                cancelled_early=True
            )

            if not completed_session:
                return api_result(False, None, "Помилка скасування стейкінгу")

            # 2. Оновлюємо баланс користувача
            current_balance = float(user.get("balance", 0))
            new_balance = current_balance + returned_amount
            balance_update = update_balance(telegram_id, returned_amount)

            if not balance_update:
                # Якщо оновлення балансу не вдалося, відкатуємо завершення сесії
                update_staking_session(staking_id, {"is_active": True, "cancelled_early": False})
                return api_result(False, None, "Помилка оновлення балансу")

            # 3. Додаємо транзакцію
            try:
                transaction = {
                    "telegram_id": telegram_id,
                    "type": "unstake",
                    "amount": returned_amount,
                    "description": f"Скасування стейкінгу (повернено {returned_amount} WINIX, утримано {fee_amount} WINIX як штраф)",
                    "status": "completed",
                    "staking_id": staking_id,
                    "created_at": datetime.now(timezone.utc).isoformat()
                }

                if supabase:
                    supabase.table("transactions").insert(transaction).execute()
                    logger.info(f"Транзакцію про скасування стейкінгу створено")
            except Exception as e:
                logger.error(f"Помилка при створенні транзакції: {str(e)}")

            # Формуємо пустий об'єкт стейкінгу для відповіді
            empty_staking = {
                "hasActiveStaking": False,
                "stakingAmount": 0,
                "period": 0,
                "rewardPercent": 0,
                "expectedReward": 0,
                "remainingDays": 0
            }

            return api_result(
                True,
                {
                    "staking": empty_staking,
                    "returnedAmount": returned_amount,
                    "feeAmount": fee_amount,
                    "newBalance": new_balance
                },
                "Стейкінг успішно скасовано"
            )
        except Exception as e:
            logger.error(f"cancel_staking: Помилка в транзакційному блоці: {str(e)}")
            logger.error(traceback.format_exc())

            # Спроба відкату змін
            try:
                if 'completed_session' in locals() and completed_session:
                    update_staking_session(staking_id, {"is_active": True, "cancelled_early": False})

                if 'balance_update' in locals() and balance_update:
                    update_balance(telegram_id, -returned_amount)  # Повертаємо баланс
            except Exception as rollback_error:
                logger.error(f"cancel_staking: Помилка відкату змін: {str(rollback_error)}")

            return api_result(False, None, f"Помилка скасування стейкінгу: {str(e)}")

    except Exception as e:
        logger.error(f"Помилка скасування стейкінгу: {str(e)}")
        logger.error(traceback.format_exc())
        return api_result(False, None, f"Помилка: {str(e)}")


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
            return api_result(False, None, f"Стейкінг з ID {staking_id} не знайдено")

        # Перевіряємо, чи стейкінг належить користувачу (перевіряємо обидва поля)
        if str(staking_session.get("user_id", "")) != telegram_id and str(
                staking_session.get("telegram_id", "")) != telegram_id:
            return api_result(False, None, "Ви не маєте прав на цей стейкінг")

        # Перевіряємо, чи стейкінг активний
        if not staking_session.get("is_active", False):
            return api_result(False, None, "Стейкінг вже завершено")

        # Перевіряємо, чи можна завершити стейкінг (якщо не force)
        if not force:
            try:
                ends_at = parse_date_with_timezone(staking_session.get("ends_at"))
                now = datetime.now(timezone.utc)

                if now < ends_at:
                    remaining_days = (ends_at - now).days
                    return api_result(False, None, f"Стейкінг ще не завершено. Залишилось {remaining_days} днів.")
            except Exception as e:
                logger.error(f"finalize_staking: Помилка перевірки дати завершення: {str(e)}")
                # У випадку помилки з датами, дозволяємо завершити

        # Отримуємо користувача
        user = get_user(telegram_id)
        if not user:
            return api_result(False, None, "Користувача не знайдено")

        # Розраховуємо винагороду
        staking_amount = float(staking_session.get("amount_staked", 0))
        reward_percent = float(staking_session.get("reward_percent", 0))
        expected_reward = (staking_amount * reward_percent) / 100
        total_amount = staking_amount + expected_reward

        # Транзакційний блок
        try:
            # 1. Завершуємо сесію стейкінгу (без скасування)
            completed_session = complete_staking_session(
                session_id=staking_id,
                final_amount=total_amount,
                cancelled_early=False
            )

            if not completed_session:
                return api_result(False, None, "Помилка завершення стейкінгу")

            # 2. Оновлюємо баланс користувача
            current_balance = float(user.get("balance", 0))
            new_balance = current_balance + total_amount
            balance_update = update_balance(telegram_id, total_amount)

            if not balance_update:
                # Якщо оновлення балансу не вдалося, відкатуємо завершення сесії
                update_staking_session(staking_id, {"is_active": True})
                return api_result(False, None, "Помилка оновлення балансу")

            # 3. Додаємо транзакцію
            try:
                transaction = {
                    "telegram_id": telegram_id,
                    "type": "unstake",
                    "amount": total_amount,
                    "description": f"Стейкінг завершено: {staking_amount} + {expected_reward} винагорода (ID: {staking_id})",
                    "status": "completed",
                    "staking_id": staking_id,
                    "created_at": datetime.now(timezone.utc).isoformat()
                }

                if supabase:
                    supabase.table("transactions").insert(transaction).execute()
                    logger.info(f"Транзакцію про завершення стейкінгу створено")
            except Exception as e:
                logger.error(f"Помилка при створенні транзакції: {str(e)}")

            # Формуємо пустий об'єкт стейкінгу для відповіді
            empty_staking = {
                "hasActiveStaking": False,
                "stakingAmount": 0,
                "period": 0,
                "rewardPercent": 0,
                "expectedReward": 0,
                "remainingDays": 0
            }

            return api_result(
                True,
                {
                    "staking": empty_staking,
                    "balance": new_balance,
                    "reward": expected_reward,
                    "total": total_amount
                },
                "Стейкінг успішно завершено"
            )
        except Exception as e:
            logger.error(f"finalize_staking: Помилка в транзакційному блоці: {str(e)}")
            logger.error(traceback.format_exc())

            # Спроба відкату змін
            try:
                if 'completed_session' in locals() and completed_session:
                    update_staking_session(staking_id, {"is_active": True})

                if 'balance_update' in locals() and balance_update:
                    update_balance(telegram_id, -total_amount)  # Повертаємо баланс
            except Exception as rollback_error:
                logger.error(f"finalize_staking: Помилка відкату змін: {str(rollback_error)}")

            return api_result(False, None, f"Помилка завершення стейкінгу: {str(e)}")

    except Exception as e:
        logger.error(f"Помилка завершення стейкінгу: {str(e)}")
        logger.error(traceback.format_exc())
        return api_result(False, None, f"Помилка: {str(e)}")


@cached()
def get_staking_history(telegram_id: str) -> Tuple[bool, List[Dict[str, Any]], str]:
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
            return api_result(True, [], "Історія стейкінгу порожня")

        # Перетворюємо сесії в формат для клієнта
        history_items = []

        for session in all_sessions:
            # Визначаємо статус
            status = "active" if session.get("is_active", False) else ("cancelled" if session.get("cancelled_early", False) else "completed")

            # Розраховуємо винагороду і штраф якщо потрібно
            amount_staked = float(session.get("amount_staked", 0))
            reward_percent = float(session.get("reward_percent", 0))

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
                "period": int(session.get("staking_days", 0)),
                "rewardPercent": reward_percent,
                "expectedReward": expected_reward,
                "startDate": session.get("started_at", ""),
                "endDate": session.get("ends_at", ""),
                "status": status,
                "hasActiveStaking": session.get("is_active", False),
                "returnedAmount": float(session.get("final_amount_paid", 0)) if session.get("final_amount_paid") else returned_amount,
                "feeAmount": fee_amount if status == "cancelled" else 0
            }

            # Додаємо дату завершення/скасування якщо є
            if not session.get("is_active", False):
                # Перевіряємо наявність поля completed_at
                if "completed_at" in session and session.get("completed_at"):
                    history_item["completedDate"] = session.get("completed_at")
                # Якщо немає completed_at, використовуємо updated_at
                elif "updated_at" in session:
                    history_item["completedDate"] = session.get("updated_at")
                    if session.get("cancelled_early", False):
                        history_item["cancelledDate"] = session.get("updated_at")

            history_items.append(history_item)

        return api_result(True, history_items, "Історія стейкінгу успішно отримана")

    except Exception as e:
        logger.error(f"Помилка отримання історії стейкінгу: {str(e)}")
        logger.error(traceback.format_exc())
        return api_result(False, None, f"Помилка: {str(e)}")


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

        # Перевіряємо наявність проблемних сесій
        all_sessions = get_user_staking_sessions(telegram_id, active_only=False)
        problem_sessions = []

        for session in all_sessions:
            # Перевіряємо проблемні сесії (відсутність дат, неузгоджений статус тощо)
            if session.get("is_active", False) and not session.get("started_at") or not session.get("ends_at"):
                problem_sessions.append(session)

            # Перевіряємо сесії з несумісним статусом
            if session.get("is_active", False) and session.get("cancelled_early", False):
                problem_sessions.append(session)

            # Перевіряємо прострочені сесії
            try:
                if session.get("is_active", False) and session.get("ends_at"):
                    ends_at = parse_date_with_timezone(session.get("ends_at"))
                    now = datetime.now(timezone.utc)

                    if now > ends_at:
                        problem_sessions.append(session)
            except:
                pass

        if problem_sessions:
            fixed_count = 0
            for session in problem_sessions:
                try:
                    # Виправляємо проблемні сесії
                    if session.get("is_active", False) and session.get("cancelled_early", False):
                        # Неузгоджений статус - скасовуємо сесію
                        update_staking_session(session["id"], {"is_active": False})
                        fixed_count += 1
                    elif session.get("is_active", False) and not session.get("started_at") or not session.get("ends_at"):
                        # Відсутність дат - видаляємо сесію
                        delete_staking_session(session["id"])
                        fixed_count += 1
                    elif session.get("is_active", False) and session.get("ends_at"):
                        try:
                            ends_at = parse_date_with_timezone(session.get("ends_at"))
                            now = datetime.now(timezone.utc)

                            if now > ends_at:
                                # Прострочена сесія - завершуємо її
                                finalize_staking(telegram_id, session["id"], force=True)
                                fixed_count += 1
                        except:
                            pass
                except Exception as e:
                    logger.error(f"Помилка виправлення сесії {session.get('id')}: {str(e)}")

            if fixed_count > 0:
                return {
                    "status": "success",
                    "message": f"Відновлення виконано. Виправлено {fixed_count} проблемних сесій."
                }, 200

        return {
            "status": "success",
            "message": "Перевірку стейкінгу виконано. Проблем не виявлено."
        }, 200
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
                    # Завершуємо сесію як скасовану
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
                    "status": "completed",
                    "created_at": datetime.now(timezone.utc).isoformat()
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


def parse_date_with_timezone(date_str: Optional[str]) -> datetime:
    """
    Покращена функція для розбору дати з урахуванням часового поясу
    """
    if not date_str:
        # Якщо дата не вказана, повертаємо поточний час з UTC
        return datetime.now(timezone.utc)

    try:
        # Спробуємо розпарсити дату з часовим поясом
        if isinstance(date_str, str):
            if date_str.endswith('Z'):
                # Обробка формату ISO з 'Z' (UTC)
                dt = datetime.fromisoformat(date_str.replace('Z', '+00:00'))
                return dt
            elif '+' in date_str or '-' in date_str and 'T' in date_str:
                # Стандартний ISO формат з часовим поясом
                return datetime.fromisoformat(date_str)
            else:
                # ISO формат без часового поясу
                dt = datetime.fromisoformat(date_str)
                return dt.replace(tzinfo=timezone.utc)
        elif isinstance(date_str, (int, float)):
            # Timestamp
            dt = datetime.fromtimestamp(date_str)
            return dt.replace(tzinfo=timezone.utc)

        # За замовчуванням
        return datetime.now(timezone.utc)
    except (ValueError, TypeError, AttributeError) as e:
        logger.error(f"parse_date_with_timezone: Помилка при парсінгу дати '{date_str}': {str(e)}")
        return datetime.now(timezone.utc)