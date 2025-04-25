"""
Сервіс для управління щоденними бонусами в системі WINIX.
Відповідає за логіку нарахування та перевірки щоденних бонусів.
"""
import logging
import sys
import os
from datetime import datetime, timedelta
from typing import Dict, Any, Optional, Tuple

# Додаємо кореневу папку проекту до шляху
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
if parent_dir not in sys.path:
    sys.path.append(parent_dir)

# Імпорт моделей та інших залежностей
from models.daily_bonus import DailyBonus, BONUS_TYPE_DAILY, BONUS_TYPE_STREAK, DEFAULT_CYCLE_DAYS
from utils.transaction_helpers import execute_balance_transaction
from supabase_client import supabase

# Налаштування логування
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class DailyBonusService:
    """
    Сервіс для управління щоденними бонусами.
    Надає методи для отримання, перевірки та видачі щоденних бонусів.
    """

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
                    "next_reward": 10,
                    "error": "Користувача не знайдено"
                }

            # Отримуємо дані щоденних бонусів
            daily_bonuses = user_response.data[0].get("daily_bonuses", {})

            # Якщо немає даних про щоденні бонуси, створюємо базову структуру
            if not daily_bonuses:
                daily_bonuses = {
                    "last_claimed_date": None,
                    "claimed_days": [],
                    "current_day": 1,
                    "streak_days": 0
                }

            # Перевіряємо, чи можна отримати бонус сьогодні
            can_claim = True
            last_claimed_date = daily_bonuses.get("last_claimed_date")

            if last_claimed_date:
                try:
                    # Перетворюємо рядкову дату в об'єкт datetime
                    if isinstance(last_claimed_date, str):
                        last_date = datetime.fromisoformat(last_claimed_date.replace("Z", "+00:00"))
                    else:
                        last_date = last_claimed_date

                    # Отримуємо лише дату (без часу)
                    last_date_day = last_date.date()
                    today = datetime.now().date()

                    # Бонус можна отримати, якщо остання дата отримання не сьогодні
                    can_claim = last_date_day < today
                except Exception as e:
                    logger.error(f"Помилка при перевірці дати останнього бонусу: {str(e)}")

            # Отримуємо поточний день у циклі
            current_day = daily_bonuses.get("current_day", 1)

            # Перевіряємо, чи треба скинути стрік
            if last_claimed_date:
                try:
                    # Перетворюємо рядкову дату в об'єкт datetime
                    if isinstance(last_claimed_date, str):
                        last_date = datetime.fromisoformat(last_claimed_date.replace("Z", "+00:00"))
                    else:
                        last_date = last_claimed_date

                    now = datetime.now()

                    # Визначаємо різницю в днях
                    delta = now - last_date

                    # Якщо пропущено більше одного дня, стрік скидається
                    if delta.days > 1:
                        current_day = 1
                except Exception as e:
                    logger.error(f"Помилка при перевірці скидання стріку: {str(e)}")

            # Розраховуємо суму винагороди для поточного дня
            reward_amount = DailyBonus.calculate_daily_bonus_amount(current_day)

            # Отримуємо загальну кількість днів у стріку
            streak_days = daily_bonuses.get("streak_days", 0)

            # Формуємо результат
            result = {
                "can_claim": can_claim,
                "current_day": current_day,
                "claimed_days": daily_bonuses.get("claimed_days", []),
                "streak_days": streak_days,
                "next_reward": reward_amount,
                "last_claimed_date": last_claimed_date
            }

            logger.info(
                f"Отримано статус щоденного бонусу для користувача {telegram_id}: поточний день {current_day}, можна отримати: {can_claim}")
            return result
        except Exception as e:
            logger.error(f"Помилка при отриманні статусу щоденного бонусу для користувача {telegram_id}: {str(e)}")
            return {
                "can_claim": False,
                "current_day": 1,
                "claimed_days": [],
                "streak_days": 0,
                "next_reward": 10,
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
        try:
            # Отримуємо статус щоденного бонусу
            bonus_status = DailyBonusService.get_daily_bonus_status(telegram_id)

            # Перевіряємо, чи можна отримати бонус
            if not bonus_status.get("can_claim", False):
                return False, "Бонус вже отримано сьогодні", bonus_status

            # Отримуємо поточний день у циклі
            current_day = bonus_status.get("current_day", 1)

            # Перевіряємо, чи день співпадає з вказаним клієнтом (якщо вказано)
            if day is not None and day != current_day:
                return False, f"Неправильний день! Очікувався день {current_day}, отримано {day}", bonus_status

            # Отримуємо користувача для оновлення
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
                daily_bonuses = {
                    "last_claimed_date": None,
                    "claimed_days": [],
                    "current_day": 1,
                    "streak_days": 0
                }

            # Розраховуємо суму винагороди
            reward_amount = DailyBonus.calculate_daily_bonus_amount(current_day)

            # Визначаємо новий баланс
            new_balance = current_balance + reward_amount

            # Оновлюємо дані щоденних бонусів
            claimed_days = daily_bonuses.get("claimed_days", [])
            claimed_days.append(current_day)

            # Визначаємо наступний день у циклі
            next_day = DailyBonus.get_next_day_in_cycle(current_day)

            # Оновлюємо кількість днів у стріку
            streak_days = daily_bonuses.get("streak_days", 0) + 1

            # Створюємо оновлений об'єкт щоденних бонусів
            updated_bonuses = {
                "last_claimed_date": datetime.now().isoformat(),
                "claimed_days": claimed_days,
                "current_day": next_day,
                "streak_days": streak_days
            }

            # Виконуємо транзакцію для нарахування винагороди
            transaction_result = execute_balance_transaction(
                telegram_id=telegram_id,
                amount=reward_amount,
                type_name="daily_bonus",
                description=f"Щоденний бонус (День {current_day})"
            )

            if transaction_result.get("status") != "success":
                logger.error(f"Помилка виконання транзакції: {transaction_result.get('message', 'Невідома помилка')}")
                return False, f"Помилка нарахування бонусу: {transaction_result.get('message', 'Невідома помилка')}", transaction_result

            # Оновлюємо дані в базі
            update_response = supabase.table("winix").update({
                "balance": new_balance,
                "daily_bonuses": updated_bonuses
            }).eq("telegram_id", str(telegram_id)).execute()

            if not update_response.data or len(update_response.data) == 0:
                logger.error(f"Не вдалося оновити дані користувача {telegram_id}")
                return False, "Не вдалося оновити дані користувача", transaction_result

            # Створюємо запис у таблиці daily_bonuses для історії та статистики
            bonus = DailyBonus(
                telegram_id=telegram_id,
                bonus_type=BONUS_TYPE_DAILY,
                amount=reward_amount,
                day_in_cycle=current_day
            )

            bonus_response = supabase.table("daily_bonuses").insert(bonus.to_dict()).execute()

            # Формуємо результат
            result = {
                "success": True,
                "reward": reward_amount,
                "new_balance": new_balance,
                "previous_balance": current_balance,
                "current_day": current_day,
                "next_day": next_day,
                "streak_days": streak_days
            }

            logger.info(f"Видано щоденний бонус користувачу {telegram_id}: {reward_amount} WINIX, день {current_day}")
            return True, None, result
        except Exception as e:
            logger.error(f"Помилка при видачі щоденного бонусу користувачу {telegram_id}: {str(e)}")
            return False, f"Внутрішня помилка: {str(e)}", {}

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
        try:
            # Отримуємо статус щоденних бонусів
            bonus_status = DailyBonusService.get_daily_bonus_status(telegram_id)

            # Отримуємо кількість днів у стріку
            streak_days = bonus_status.get("streak_days", 0)

            # Перевіряємо, чи достатньо днів для бонусу
            # Наприклад, бонус видається за кожні 7 днів у стріку
            if streak_days < 7 or streak_days % 7 != 0:
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

            # Перевіряємо, чи не було вже отримано бонус за поточний стрік
            last_streak_bonus = daily_bonuses.get("last_streak_bonus", 0)

            if last_streak_bonus >= streak_days:
                return False, f"Бонус за стрік {streak_days} днів вже отримано", bonus_status

            # Розраховуємо суму бонусу за стрік
            # Формула: 50 * (кількість тижнів у стріку)
            streak_weeks = streak_days // 7
            bonus_amount = 50.0 * streak_weeks

            # Визначаємо новий баланс
            new_balance = current_balance + bonus_amount

            # Оновлюємо інформацію про останній отриманий бонус за стрік
            daily_bonuses["last_streak_bonus"] = streak_days

            # Виконуємо транзакцію для нарахування винагороди
            transaction_result = execute_balance_transaction(
                telegram_id=telegram_id,
                amount=bonus_amount,
                type_name="streak_bonus",
                description=f"Бонус за стрік {streak_days} днів"
            )

            if transaction_result.get("status") != "success":
                logger.error(f"Помилка виконання транзакції: {transaction_result.get('message', 'Невідома помилка')}")
                return False, f"Помилка нарахування бонусу: {transaction_result.get('message', 'Невідома помилка')}", transaction_result

            # Оновлюємо дані в базі
            update_response = supabase.table("winix").update({
                "balance": new_balance,
                "daily_bonuses": daily_bonuses
            }).eq("telegram_id", str(telegram_id)).execute()

            if not update_response.data or len(update_response.data) == 0:
                logger.error(f"Не вдалося оновити дані користувача {telegram_id}")
                return False, "Не вдалося оновити дані користувача", transaction_result

            # Створюємо запис у таблиці daily_bonuses для історії та статистики
            bonus = DailyBonus(
                telegram_id=telegram_id,
                bonus_type=BONUS_TYPE_STREAK,
                amount=bonus_amount,
                day_in_cycle=0  # Для бонусів за стрік встановлюємо 0
            )

            bonus_response = supabase.table("daily_bonuses").insert(bonus.to_dict()).execute()

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
                    bonus = DailyBonus.from_dict(bonus_data)
                    bonuses.append(bonus.to_dict())
                except Exception as e:
                    logger.error(f"Помилка при обробці запису бонусу: {str(e)}")

            result["items"] = bonuses

            # Отримуємо загальну кількість записів
            count_response = supabase.table("daily_bonuses").select("count").eq("telegram_id",
                                                                                str(telegram_id)).execute()

            total_count = count_response.count if hasattr(count_response, 'count') else len(bonuses)
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