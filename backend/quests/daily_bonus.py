"""
Сервіс для управління щоденними бонусами в системі WINIX.
Відповідає за логіку нарахування та перевірки щоденних бонусів.
"""
import logging
import sys
import os
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, Optional, Tuple, List, Union
from contextlib import contextmanager
import threading
import json

# Додаємо кореневу папку проекту до шляху
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
if parent_dir not in sys.path:
    sys.path.append(parent_dir)

# Імпорт моделей та інших залежностей
from models.daily_bonus import DailyBonus, BONUS_TYPE_DAILY, BONUS_TYPE_STREAK, BONUS_TYPE_TOKEN, DEFAULT_CYCLE_DAYS, TOKEN_REWARD_DAYS
from utils.transaction_helpers import execute_balance_transaction
from supabase_client import supabase, execute_transaction

# Налаштування логування
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Семафор для блокування одночасних запитів на отримання бонусу
claim_lock = threading.Lock()

# Кеш для блокування повторних запитів від одного користувача
user_claim_locks = {}
user_claim_lock = threading.Lock()


class DailyBonusService:
    """
    Сервіс для управління щоденними бонусами.
    Надає методи для отримання, перевірки та видачі щоденних бонусів.
    """

    @staticmethod
    def normalize_date(date_obj: Optional[Union[datetime, str]]) -> Optional[datetime]:
        """
        Нормалізує дату, додаючи часовий пояс, якщо він відсутній

        Args:
            date_obj: Об'єкт datetime або рядок для нормалізації

        Returns:
            Об'єкт datetime з часовим поясом UTC або None
        """
        if date_obj is None:
            return None

        try:
            # Якщо дата передана як рядок, перетворюємо на datetime
            if isinstance(date_obj, str):
                return DailyBonus.parse_date(date_obj)

            # Якщо це вже datetime
            if isinstance(date_obj, datetime):
                # Додаємо часовий пояс, якщо його немає
                if not date_obj.tzinfo:
                    return date_obj.replace(tzinfo=timezone.utc)
                return date_obj

            # Інші випадки
            logger.warning(f"normalize_date: Неочікуваний тип даних: {type(date_obj)}")
            return None

        except Exception as e:
            logger.error(f"Помилка нормалізації дати: {str(e)}")
            return None

    @staticmethod
    def _acquire_user_claim_lock(telegram_id: str) -> bool:
        """
        Отримує блокування для користувача для запобігання одночасним запитам
        на отримання бонусу від одного користувача.

        Args:
            telegram_id (str): Telegram ID користувача

        Returns:
            bool: True, якщо блокування отримано, False якщо користувач вже має активне блокування
        """
        with user_claim_lock:
            if telegram_id in user_claim_locks:
                # Перевіряємо, чи не застаріле блокування (старше 5 хвилин)
                lock_time = user_claim_locks.get(telegram_id, 0)
                if datetime.now().timestamp() - lock_time < 300:  # 5 хвилин
                    # Блокування ще активне
                    logger.warning(f"Користувач {telegram_id} вже має активне блокування на отримання бонусу")
                    return False

            # Створюємо нове блокування
            user_claim_locks[telegram_id] = datetime.now().timestamp()
            logger.info(f"Створено блокування для користувача {telegram_id}")
            return True

    @staticmethod
    def _release_user_claim_lock(telegram_id: str) -> None:
        """
        Звільняє блокування користувача

        Args:
            telegram_id (str): Telegram ID користувача
        """
        with user_claim_lock:
            if telegram_id in user_claim_locks:
                del user_claim_locks[telegram_id]
                logger.info(f"Звільнено блокування для користувача {telegram_id}")

    @staticmethod
    def get_daily_bonus_status(telegram_id: str) -> Dict[str, Any]:
        """
        Отримує статус щоденного бонусу для користувача.

        Args:
            telegram_id (str): Telegram ID користувача

        Returns:
            Dict[str, Any]: Статус щоденного бонусу
        """
        try:
            # Перевіряємо валідність telegram_id
            if not telegram_id or not isinstance(telegram_id, str):
                logger.error(f"get_daily_bonus_status: Недійсний telegram_id: {telegram_id}")
                return {
                    "can_claim": False,
                    "current_day": 1,
                    "claimed_days": [],
                    "streak_days": 0,
                    "next_reward": 10,
                    "error": "Недійсний ID користувача"
                }

            # Логуємо початок операції
            logger.info(f"get_daily_bonus_status: Запит статусу бонусу для користувача {telegram_id}")

            # Отримуємо користувача
            user_response = supabase.table("winix").select("daily_bonuses").eq("telegram_id",
                                                                               str(telegram_id)).execute()

            if not user_response.data or len(user_response.data) == 0:
                logger.warning(f"Користувача {telegram_id} не знайдено")
                return {
                    "can_claim": False,
                    "current_day": 1,
                    "claimed_days": [],
                    "streak_days": 0,
                    "next_reward": 35,  # Перший день - 35 WINIX
                    "error": "Користувача не знайдено"
                }

            # Отримуємо дані щоденних бонусів
            user_data = user_response.data[0]
            daily_bonuses = user_data.get("daily_bonuses", {})

            # Якщо немає даних про щоденні бонуси, створюємо базову структуру
            if not daily_bonuses:
                daily_bonuses = {
                    "last_claimed_date": None,
                    "claimed_days": [],
                    "current_day": 1,
                    "streak_days": 0,
                    "token_rewards": {}  # Історія отриманих жетонів
                }

            # Перевіряємо наявність всіх необхідних полів
            daily_bonuses = {
                "last_claimed_date": daily_bonuses.get("last_claimed_date", None),
                "claimed_days": daily_bonuses.get("claimed_days", []),
                "current_day": daily_bonuses.get("current_day", 1),
                "streak_days": daily_bonuses.get("streak_days", 0),
                "token_rewards": daily_bonuses.get("token_rewards", {})
            }

            # Перевіряємо, чи можна отримати бонус сьогодні
            can_claim = True
            last_claimed_date = daily_bonuses.get("last_claimed_date")

            if last_claimed_date:
                try:
                    # Нормалізуємо дату останнього отримання бонусу
                    last_date = DailyBonusService.normalize_date(last_claimed_date)

                    if last_date:
                        # Отримуємо лише дату (без часу)
                        last_date_day = last_date.date()
                        today = datetime.now(timezone.utc).date()

                        # Бонус можна отримати, якщо остання дата отримання не сьогодні
                        can_claim = last_date_day < today

                        # Логуємо інформацію про перевірку можливості отримати бонус
                        logger.info(f"get_daily_bonus_status: Користувач {telegram_id}, остання дата бонусу: {last_date_day}, сьогодні: {today}, можна отримати: {can_claim}")
                except Exception as e:
                    logger.error(f"Помилка при перевірці дати останнього бонусу: {str(e)}")

            # Отримуємо поточний день у циклі
            current_day = daily_bonuses.get("current_day", 1)

            # Перевіряємо, чи треба скинути стрік
            if last_claimed_date:
                try:
                    # Нормалізуємо дату останнього отримання бонусу
                    last_date = DailyBonusService.normalize_date(last_claimed_date)

                    if last_date:
                        # Перевіряємо чи потрібно скинути стрік
                        if DailyBonus.check_streak_reset(last_date):
                            logger.info(f"get_daily_bonus_status: Скидання стріку для користувача {telegram_id}, останній бонус: {last_date}")
                            current_day = 1
                except Exception as e:
                    logger.error(f"Помилка при перевірці скидання стріку: {str(e)}")

            # Розраховуємо суму винагороди для поточного дня
            reward_amount = DailyBonus.calculate_daily_bonus_amount(current_day)

            # Перевіряємо чи буде жетон у цей день
            token_amount = DailyBonus.get_token_reward_amount(current_day)

            # Отримуємо загальну кількість днів у стріку
            streak_days = daily_bonuses.get("streak_days", 0)

            # Формуємо результат
            result = {
                "can_claim": can_claim,
                "current_day": current_day,
                "claimed_days": daily_bonuses.get("claimed_days", []),
                "streak_days": streak_days,
                "next_reward": reward_amount,
                "token_amount": token_amount,
                "last_claimed_date": last_claimed_date,
                "all_rewards": DailyBonus.DAILY_BONUS_REWARDS,  # Додаємо всю таблицю винагород
                "token_rewards": TOKEN_REWARD_DAYS,  # Додаємо інформацію про дні з жетонами
                "cycle_days": DEFAULT_CYCLE_DAYS  # Додаємо кількість днів у циклі
            }

            logger.info(
                f"Отримано статус щоденного бонусу для користувача {telegram_id}: поточний день {current_day}, можна отримати: {can_claim}, наступна винагорода: {reward_amount}, жетонів: {token_amount}")
            return result
        except Exception as e:
            logger.error(f"Помилка при отриманні статусу щоденного бонусу для користувача {telegram_id}: {str(e)}")
            return {
                "can_claim": False,
                "current_day": 1,
                "claimed_days": [],
                "streak_days": 0,
                "next_reward": 35,
                "error": str(e)
            }

    @staticmethod
    def claim_daily_bonus(telegram_id: str, day: Optional[int] = None) -> Tuple[bool, Optional[str], Dict[str, Any]]:
        """
        Видає щоденний бонус користувачу.

        Args:
            telegram_id (str): Telegram ID користувача
            day (int, optional): День у циклі, вказаний клієнтом

        Returns:
            Tuple[bool, Optional[str], Dict[str, Any]]:
                (успіх, повідомлення про помилку, дані бонусу)
        """
        if not DailyBonusService._acquire_user_claim_lock(telegram_id):
            return False, "Запит на отримання бонусу вже в обробці, спробуйте через кілька секунд", {}

        try:
            # Перевіряємо валідність telegram_id
            if not telegram_id or not isinstance(telegram_id, str):
                logger.error(f"claim_daily_bonus: Недійсний telegram_id: {telegram_id}")
                return False, "Недійсний ID користувача", {}

            # Перевіряємо валідність параметра day
            if day is not None and (not isinstance(day, int) or day < 1 or day > DEFAULT_CYCLE_DAYS):
                logger.error(f"claim_daily_bonus: Недійсний параметр day: {day}")
                return False, f"Недійсний день циклу. Повинен бути від 1 до {DEFAULT_CYCLE_DAYS}", {}

            # Глобальне блокування для запобігання race conditions
            with claim_lock:
                # Отримуємо статус щоденного бонусу
                bonus_status = DailyBonusService.get_daily_bonus_status(telegram_id)

                # Перевіряємо, чи можна отримати бонус
                if not bonus_status.get("can_claim", False):
                    logger.warning(f"claim_daily_bonus: Користувач {telegram_id} вже отримав бонус сьогодні")
                    return False, "Бонус вже отримано сьогодні", bonus_status

                # Отримуємо поточний день у циклі
                current_day = bonus_status.get("current_day", 1)

                # Перевіряємо, чи день співпадає з вказаним клієнтом (якщо вказано)
                if day is not None and day != current_day:
                    logger.warning(f"claim_daily_bonus: Неправильний день для користувача {telegram_id}. Очікувалось: {current_day}, отримано: {day}")
                    return False, f"Неправильний день! Очікувався день {current_day}, отримано {day}", bonus_status

                # Отримуємо користувача для оновлення
                user_response = supabase.table("winix").select("balance,coins,daily_bonuses").eq("telegram_id",
                                                                                        str(telegram_id)).execute()

                if not user_response.data or len(user_response.data) == 0:
                    logger.warning(f"Користувача {telegram_id} не знайдено")
                    return False, "Користувача не знайдено", bonus_status

                user_data = user_response.data[0]

                # Отримуємо поточний баланс та дані бонусів
                current_balance = float(user_data.get("balance", 0))
                current_coins = int(user_data.get("coins", 0))
                daily_bonuses = user_data.get("daily_bonuses", {})

                if not daily_bonuses:
                    daily_bonuses = {
                        "last_claimed_date": None,
                        "claimed_days": [],
                        "current_day": 1,
                        "streak_days": 0,
                        "token_rewards": {}
                    }

                # Розраховуємо суму винагороди
                reward_amount = DailyBonus.calculate_daily_bonus_amount(current_day)

                # Перевіряємо, чи потрібно видати жетони
                token_amount = DailyBonus.get_token_reward_amount(current_day)

                # Визначаємо новий баланс
                new_balance = current_balance + reward_amount
                new_coins = current_coins

                if token_amount > 0:
                    new_coins += token_amount

                # Оновлюємо дані щоденних бонусів
                claimed_days = daily_bonuses.get("claimed_days", [])
                claimed_days.append(current_day)

                # Зберігаємо інформацію про отримані жетони
                token_rewards = daily_bonuses.get("token_rewards", {})
                if token_amount > 0:
                    token_rewards[str(current_day)] = token_amount

                # Визначаємо наступний день у циклі
                next_day = DailyBonus.get_next_day_in_cycle(current_day)

                # Оновлюємо кількість днів у стріку
                streak_days = daily_bonuses.get("streak_days", 0) + 1

                # Перевіряємо, чи завершено цикл (30/30 днів)
                cycle_completed = False
                completion_bonus = None

                if next_day == 1 and current_day == DEFAULT_CYCLE_DAYS:
                    cycle_completed = True
                    completion_bonus = DailyBonus.get_cycle_completion_bonus()

                    # Додаємо бонус за завершення циклу
                    if completion_bonus:
                        new_balance += completion_bonus["amount"]
                        new_coins += completion_bonus["tokens"]

                # Створюємо оновлений об'єкт щоденних бонусів
                updated_bonuses = {
                    "last_claimed_date": datetime.now(timezone.utc).isoformat(),
                    "claimed_days": claimed_days,
                    "current_day": next_day,
                    "streak_days": streak_days,
                    "token_rewards": token_rewards,
                    "last_cycle_completed": cycle_completed
                }

                # Виконуємо транзакцію через транзакційний контекст
                logger.info(f"claim_daily_bonus: Початок транзакції для користувача {telegram_id}")
                try:
                    with execute_transaction() as txn:
                        # Оновлюємо дані в базі
                        update_response = txn.table("winix").update({
                            "balance": new_balance,
                            "coins": new_coins,
                            "daily_bonuses": updated_bonuses,
                            "updated_at": datetime.now(timezone.utc).isoformat()
                        }).eq("telegram_id", str(telegram_id)).execute()

                        if not update_response.data or len(update_response.data) == 0:
                            logger.error(f"Не вдалося оновити дані користувача {telegram_id}")
                            raise Exception("Не вдалося оновити дані користувача")

                        # Створюємо транзакцію для нарахування винагороди WINIX
                        transaction_data = {
                            "telegram_id": telegram_id,
                            "type": "daily_bonus",
                            "amount": reward_amount,
                            "description": f"Щоденний бонус (День {current_day})",
                            "status": "completed",
                            "created_at": datetime.now(timezone.utc).isoformat(),
                            "updated_at": datetime.now(timezone.utc).isoformat(),
                            "previous_balance": current_balance
                        }
                        txn.table("transactions").insert(transaction_data).execute()

                        # Створюємо запис у таблиці daily_bonuses для історії та статистики
                        bonus = DailyBonus(
                            telegram_id=telegram_id,
                            bonus_type=BONUS_TYPE_DAILY,
                            amount=reward_amount,
                            day_in_cycle=current_day,
                            token_amount=token_amount
                        )
                        txn.table("daily_bonuses").insert(bonus.to_dict()).execute()

                        # Якщо отримано жетони, також додаємо транзакцію для них
                        if token_amount > 0:
                            token_transaction_data = {
                                "telegram_id": telegram_id,
                                "type": "token_reward",
                                "amount": token_amount,
                                "description": f"Жетони за щоденний бонус (День {current_day})",
                                "status": "completed",
                                "created_at": datetime.now(timezone.utc).isoformat(),
                                "updated_at": datetime.now(timezone.utc).isoformat(),
                                "previous_coins": current_coins
                            }
                            txn.table("token_transactions").insert(token_transaction_data).execute()

                            # Додаємо запис про отримання жетонів
                            token_bonus = DailyBonus(
                                telegram_id=telegram_id,
                                bonus_type=BONUS_TYPE_TOKEN,
                                amount=0,  # Сума WINIX - 0
                                token_amount=token_amount,
                                day_in_cycle=current_day
                            )
                            txn.table("daily_bonuses").insert(token_bonus.to_dict()).execute()

                        # Якщо завершено цикл, додаємо транзакцію для бонусу за завершення
                        if cycle_completed and completion_bonus:
                            completion_transaction_data = {
                                "telegram_id": telegram_id,
                                "type": "cycle_completion_bonus",
                                "amount": completion_bonus["amount"],
                                "description": f"Бонус за завершення циклу 30/30 днів",
                                "status": "completed",
                                "created_at": datetime.now(timezone.utc).isoformat(),
                                "updated_at": datetime.now(timezone.utc).isoformat(),
                                "previous_balance": current_balance + reward_amount  # після отримання щоденного бонусу
                            }
                            txn.table("transactions").insert(completion_transaction_data).execute()

                            # Додаємо запис про транзакцію жетонів за завершення циклу
                            token_completion_data = {
                                "telegram_id": telegram_id,
                                "type": "cycle_completion_tokens",
                                "amount": completion_bonus["tokens"],
                                "description": f"Жетони за завершення циклу 30/30 днів",
                                "status": "completed",
                                "created_at": datetime.now(timezone.utc).isoformat(),
                                "updated_at": datetime.now(timezone.utc).isoformat(),
                                "previous_coins": current_coins + token_amount  # після отримання щоденних жетонів
                            }
                            txn.table("token_transactions").insert(token_completion_data).execute()

                            # Додаємо інформацію про бейдж до профілю користувача
                            if "badge" in completion_bonus:
                                badges = user_data.get("badges", [])
                                if completion_bonus["badge"] not in badges:
                                    badges.append(completion_bonus["badge"])
                                    txn.table("winix").update({
                                        "badges": badges
                                    }).eq("telegram_id", str(telegram_id)).execute()

                        logger.info(f"claim_daily_bonus: Транзакція успішно завершена для користувача {telegram_id}")
                except Exception as e:
                    logger.error(f"claim_daily_bonus: Помилка транзакції для користувача {telegram_id}: {str(e)}")
                    raise e

                # Формуємо результат
                result = {
                    "success": True,
                    "reward": reward_amount,
                    "token_amount": token_amount,
                    "new_balance": new_balance,
                    "new_coins": new_coins,
                    "previous_balance": current_balance,
                    "previous_coins": current_coins,
                    "current_day": current_day,
                    "next_day": next_day,
                    "streak_days": streak_days,
                    "cycle_completed": cycle_completed
                }

                # Додаємо інформацію про бонус завершення циклу, якщо він отриманий
                if cycle_completed and completion_bonus:
                    result["completion_bonus"] = completion_bonus

                logger.info(f"Видано щоденний бонус користувачу {telegram_id}: {reward_amount} WINIX, {token_amount} жетонів, день {current_day}")
                return True, None, result
        except Exception as e:
            logger.error(f"Помилка при видачі щоденного бонусу користувачу {telegram_id}: {str(e)}")
            return False, f"Внутрішня помилка: {str(e)}", {}
        finally:
            # Звільняємо блокування для цього користувача
            DailyBonusService._release_user_claim_lock(telegram_id)

    @staticmethod
    def get_streak_bonus(telegram_id: str) -> Tuple[bool, Optional[str], Dict[str, Any]]:
        """
        Видає бонус за стрік щоденних входів.

        Args:
            telegram_id (str): Telegram ID користувача

        Returns:
            Tuple[bool, Optional[str], Dict[str, Any]]:
                (успіх, повідомлення про помилку, дані бонусу)
        """
        if not DailyBonusService._acquire_user_claim_lock(telegram_id):
            return False, "Запит на отримання бонусу вже в обробці, спробуйте через кілька секунд", {}

        try:
            # Перевіряємо валідність telegram_id
            if not telegram_id or not isinstance(telegram_id, str):
                logger.error(f"get_streak_bonus: Недійсний telegram_id: {telegram_id}")
                return False, "Недійсний ID користувача", {}

            # Отримуємо статус щоденних бонусів
            bonus_status = DailyBonusService.get_daily_bonus_status(telegram_id)

            # Отримуємо кількість днів у стріку
            streak_days = bonus_status.get("streak_days", 0)

            # Перевіряємо, чи достатньо днів для бонусу
            # Наприклад, бонус видається за кожні 7 днів у стріку
            if streak_days < 7 or streak_days % 7 != 0:
                logger.warning(f"get_streak_bonus: Недостатньо днів у стріку для користувача {telegram_id}: {streak_days}/7")
                return False, f"Недостатньо днів у стріку для отримання бонусу: {streak_days}/7", bonus_status

            # Отримуємо користувача
            user_response = supabase.table("winix").select("balance,daily_bonuses").eq("telegram_id",
                                                                                    str(telegram_id)).execute()

            if not user_response.data or len(user_response.data) == 0:
                logger.warning(f"Користувача {telegram_id} не знайдено")
                return False, "Користувача не знайдено", bonus_status

            user_data = user_response.data[0]

            # Отримуємо поточний баланс та дані бонусів
            current_balance = float(user_data.get("balance", 0))
            daily_bonuses = user_data.get("daily_bonuses", {})

            if not daily_bonuses:
                logger.warning(f"get_streak_bonus: У користувача {telegram_id} відсутні дані щоденних бонусів")
                return False, "Дані щоденних бонусів відсутні", bonus_status

            # Перевіряємо, чи не було вже отримано бонус за поточний стрік
            last_streak_bonus = daily_bonuses.get("last_streak_bonus", 0)

            if last_streak_bonus >= streak_days:
                logger.warning(f"get_streak_bonus: Користувач {telegram_id} вже отримав бонус за стрік {streak_days} днів")
                return False, f"Бонус за стрік {streak_days} днів вже отримано", bonus_status

            # Розраховуємо суму бонусу за стрік
            # Формула: 50 * (кількість тижнів у стріку)
            streak_weeks = streak_days // 7
            bonus_amount = 50.0 * streak_weeks

            # Визначаємо новий баланс
            new_balance = current_balance + bonus_amount

            # Оновлюємо інформацію про останній отриманий бонус за стрік
            daily_bonuses["last_streak_bonus"] = streak_days

            # Виконуємо транзакцію через транзакційний контекст
            logger.info(f"get_streak_bonus: Початок транзакції для користувача {telegram_id}")
            try:
                with execute_transaction() as txn:
                    # Оновлюємо дані в базі
                    update_response = txn.table("winix").update({
                        "balance": new_balance,
                        "daily_bonuses": daily_bonuses,
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }).eq("telegram_id", str(telegram_id)).execute()

                    if not update_response.data or len(update_response.data) == 0:
                        logger.error(f"Не вдалося оновити дані користувача {telegram_id}")
                        raise Exception("Не вдалося оновити дані користувача")

                    # Створюємо транзакцію для нарахування винагороди
                    transaction_data = {
                        "telegram_id": telegram_id,
                        "type": "streak_bonus",
                        "amount": bonus_amount,
                        "description": f"Бонус за стрік {streak_days} днів",
                        "status": "completed",
                        "created_at": datetime.now(timezone.utc).isoformat(),
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                        "previous_balance": current_balance
                    }
                    txn.table("transactions").insert(transaction_data).execute()

                    # Створюємо запис у таблиці daily_bonuses для історії та статистики
                    bonus = DailyBonus(
                        telegram_id=telegram_id,
                        bonus_type=BONUS_TYPE_STREAK,
                        amount=bonus_amount,
                        day_in_cycle=0  # Для бонусів за стрік встановлюємо 0
                    )
                    txn.table("daily_bonuses").insert(bonus.to_dict()).execute()

                    logger.info(f"get_streak_bonus: Транзакція успішно завершена для користувача {telegram_id}")
            except Exception as e:
                logger.error(f"get_streak_bonus: Помилка транзакції для користувача {telegram_id}: {str(e)}")
                raise e

            # Формуємо результат
            result = {
                "success": True,
                "reward": bonus_amount,
                "new_balance": new_balance,
                "previous_balance": current_balance,
                "streak_days": streak_days,
                "streak_weeks": streak_weeks
            }

            logger.info(
                f"Видано бонус за стрік користувачу {telegram_id}: {bonus_amount} WINIX, стрік {streak_days} днів")
            return True, None, result
        except Exception as e:
            logger.error(f"Помилка при видачі бонусу за стрік користувачу {telegram_id}: {str(e)}")
            return False, f"Внутрішня помилка: {str(e)}", {}
        finally:
            # Звільняємо блокування для цього користувача
            DailyBonusService._release_user_claim_lock(telegram_id)

    @staticmethod
    def get_bonus_history(telegram_id: str, limit: int = 10, offset: int = 0) -> Dict[str, Any]:
        """
        Отримує історію щоденних бонусів для користувача.

        Args:
            telegram_id (str): Telegram ID користувача
            limit (int, optional): Максимальна кількість результатів
            offset (int, optional): Зміщення для пагінації

        Returns:
            Dict[str, Any]: Історія щоденних бонусів
        """
        try:
            # Перевіряємо валідність telegram_id
            if not telegram_id or not isinstance(telegram_id, str):
                logger.error(f"get_bonus_history: Недійсний telegram_id: {telegram_id}")
                return {
                    "items": [],
                    "pagination": {
                        "total": 0,
                        "limit": limit,
                        "offset": offset
                    },
                    "error": "Недійсний ID користувача"
                }

            # Перевіряємо ліміт і зміщення
            limit = max(1, min(100, limit))  # Обмежуємо ліміт від 1 до 100
            offset = max(0, offset)  # Зміщення повинно бути невід'ємним

            # Отримуємо записи бонусів
            response = supabase.table("daily_bonuses") \
                .select("*") \
                .eq("telegram_id", str(telegram_id)) \
                .order("claimed_date", desc=True) \
                .limit(limit) \
                .offset(offset) \
                .execute()

            # Ініціалізуємо результат
            result = {
                "items": [],
                "pagination": {
                    "total": 0,
                    "limit": limit,
                    "offset": offset
                }
            }

            if not response.data:
                logger.info(f"Історія бонусів не знайдена для користувача {telegram_id}")
                return result

            # Наповнюємо результат
            bonuses = []
            for bonus_data in response.data:
                try:
                    # Нормалізуємо дати
                    if 'claimed_date' in bonus_data and bonus_data['claimed_date']:
                        bonus_data['claimed_date'] = DailyBonusService.normalize_date(bonus_data['claimed_date'])

                    if 'created_at' in bonus_data and bonus_data['created_at']:
                        bonus_data['created_at'] = DailyBonusService.normalize_date(bonus_data['created_at'])

                    bonus = DailyBonus.from_dict(bonus_data)
                    bonuses.append(bonus.to_dict())
                except Exception as e:
                    logger.error(f"Помилка при обробці запису бонусу: {str(e)}")

            result["items"] = bonuses

            # Отримуємо загальну кількість записів
            count_response = supabase.table("daily_bonuses") \
                .select("id", count="exact") \
                .eq("telegram_id", str(telegram_id)) \
                .execute()

            # Правильно отримуємо загальну кількість записів
            total_count = 0
            if hasattr(count_response, 'count'):
                total_count = count_response.count
            elif hasattr(count_response, 'data'):
                total_count = len(bonuses) + offset

            result["pagination"]["total"] = total_count

            logger.info(f"Отримано {len(bonuses)} записів з історії бонусів для користувача {telegram_id}")
            return result
        except Exception as e:
            logger.error(f"Помилка при отриманні історії бонусів для користувача {telegram_id}: {str(e)}")
            return {
                "items": [],
                "pagination": {
                    "total": 0,
                    "limit": limit,
                    "offset": offset
                },
                "error": str(e)
            }