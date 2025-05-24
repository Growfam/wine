"""
Контролер щоденних бонусів для системи завдань WINIX
Обробка отримання, статусу та історії щоденних винагород
"""

import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional

from ..models.daily_bonus import (
    DailyBonusStatus, DailyBonusEntry, daily_bonus_manager,
    create_new_daily_status
)
from ..models.user_quest import UserQuest
from ..services.reward_calculator import reward_calculator, calculate_daily_reward
from ..utils.decorators import ValidationError
from ..utils.validators import validate_telegram_id

# Імпорт функцій роботи з БД
try:
    from supabase_client import get_user, update_balance, update_coins
except ImportError:
    try:
        from backend.supabase_client import get_user, update_balance, update_coins
    except ImportError:
        # Fallback для тестування
        def get_user(telegram_id):
            return None


        def update_balance(telegram_id, amount):
            return None


        def update_coins(telegram_id, amount):
            return None

logger = logging.getLogger(__name__)


class DailyController:
    """Контролер щоденних бонусів"""

    @staticmethod
    def get_daily_status(telegram_id: str) -> Dict[str, Any]:
        """
        Отримання статусу щоденних бонусів користувача

        Args:
            telegram_id: Telegram ID користувача

        Returns:
            Dict зі статусом щоденних бонусів
        """
        try:
            logger.info(f"=== ОТРИМАННЯ СТАТУСУ ЩОДЕННИХ БОНУСІВ {telegram_id} ===")

            # Валідація telegram_id
            validated_id = validate_telegram_id(telegram_id)
            if not validated_id:
                raise ValidationError("Невірний Telegram ID")

            # Перевіряємо чи користувач існує
            user_data = get_user(str(validated_id))
            if not user_data:
                raise ValidationError("Користувач не знайдений")

            # Отримуємо статус щоденних бонусів
            daily_status = daily_bonus_manager.get_user_status(validated_id)

            # Розраховуємо сьогоднішню винагороду якщо користувач може отримати
            today_reward = None
            if daily_status.can_claim_today:
                # Отримуємо рівень користувача для розрахунку
                try:
                    user_quest = UserQuest.from_supabase_user(user_data)
                    user_level = user_quest.level
                except:
                    user_level = 1

                today_reward = calculate_daily_reward(
                    day_number=daily_status.current_day_number,
                    current_streak=daily_status.current_streak,
                    user_level=user_level
                )
                daily_status.today_reward = today_reward

            # Формуємо відповідь
            status_data = daily_status.to_dict()

            # Додаємо додаткову інформацію
            status_data.update({
                "streak_info": daily_status.get_streak_info(),
                "statistics": daily_status.get_statistics(),
                "next_claim_in_hours": DailyController._calculate_hours_until_next_claim(daily_status),
                "month_progress": (daily_status.total_days_claimed / 30 * 100),
                "is_special_day": (daily_status.current_day_number % 7 == 0) if daily_status.can_claim_today else False
            })

            logger.info(
                f"Статус щоденних бонусів для {validated_id}: можна отримати={daily_status.can_claim_today}, день={daily_status.current_day_number}")

            return {
                "status": "success",
                "data": status_data
            }

        except ValidationError:
            raise
        except Exception as e:
            logger.error(f"Помилка отримання статусу щоденних бонусів {telegram_id}: {e}", exc_info=True)
            raise ValidationError("Помилка отримання статусу")

    @staticmethod
    def claim_daily_bonus(telegram_id: str, timestamp: Optional[int] = None) -> Dict[str, Any]:
        """
        Отримання щоденного бонусу

        Args:
            telegram_id: Telegram ID користувача
            timestamp: Опціональний timestamp запиту

        Returns:
            Dict з результатом отримання
        """
        try:
            logger.info(f"=== ОТРИМАННЯ ЩОДЕННОГО БОНУСУ {telegram_id} ===")

            # Валідація telegram_id
            validated_id = validate_telegram_id(telegram_id)
            if not validated_id:
                raise ValidationError("Невірний Telegram ID")

            # Перевіряємо користувача
            user_data = get_user(str(validated_id))
            if not user_data:
                raise ValidationError("Користувач не знайдений")

            # Отримуємо поточний статус
            daily_status = daily_bonus_manager.get_user_status(validated_id, force_refresh=True)

            # Перевіряємо чи можна отримати бонус
            if not daily_status.can_claim_today:
                hours_remaining = DailyController._calculate_hours_until_next_claim(daily_status)
                raise ValidationError(f"Бонус вже отримано сьогодні. Наступний через {hours_remaining:.1f} годин")

            # Розраховуємо винагороду
            try:
                user_quest = UserQuest.from_supabase_user(user_data)
                user_level = user_quest.level
            except:
                user_level = 1

            reward = calculate_daily_reward(
                day_number=daily_status.current_day_number,
                current_streak=daily_status.current_streak,
                user_level=user_level
            )

            logger.info(f"Розрахована винагорода: {reward.to_dict()}")

            # Отримуємо бонус (оновлює статус)
            entry = daily_status.claim_bonus(reward)

            # Нараховуємо винагороду в БД
            success_operations = []

            if reward.winix > 0:
                winix_result = update_balance(str(validated_id), reward.winix)
                if winix_result:
                    success_operations.append(f"WINIX +{reward.winix}")
                else:
                    logger.error("Помилка нарахування WINIX")
                    raise ValidationError("Помилка нарахування WINIX")

            if reward.tickets > 0:
                tickets_result = update_coins(str(validated_id), reward.tickets)
                if tickets_result:
                    success_operations.append(f"Tickets +{reward.tickets}")
                else:
                    logger.error("Помилка нарахування tickets")
                    raise ValidationError("Помилка нарахування tickets")

            # Зберігаємо оновлений статус
            if not daily_bonus_manager.save_status_to_db(daily_status):
                logger.error("Помилка збереження статусу щоденних бонусів")
                # Не викидаємо помилку, оскільки винагорода вже нарахована

            # Зберігаємо запис про отримання
            if not daily_bonus_manager.save_entry_to_db(entry):
                logger.error("Помилка збереження запису про отримання")
                # Не викидаємо помилку, оскільки винагорода вже нарахована

            logger.info(f"Щоденний бонус успішно отримано користувачем {validated_id}: {success_operations}")

            # Формуємо відповідь
            response_data = {
                "success": True,
                "day_number": entry.day_number,
                "reward": reward.to_dict(),
                "operations": success_operations,
                "new_streak": daily_status.current_streak,
                "is_special_day": entry.is_special_day,
                "streak_bonus_applied": entry.streak_at_claim > 1,
                "claimed_at": entry.claim_date.isoformat(),
                "next_available": daily_status.next_available_date.isoformat() if daily_status.next_available_date else None,
                "total_days_claimed": daily_status.total_days_claimed
            }

            return {
                "status": "success",
                "data": response_data
            }

        except ValidationError:
            raise
        except Exception as e:
            logger.error(f"Помилка отримання щоденного бонусу {telegram_id}: {e}", exc_info=True)
            raise ValidationError("Помилка отримання бонусу")

    @staticmethod
    def get_daily_history(telegram_id: str, limit: int = 30) -> Dict[str, Any]:
        """
        Отримання історії щоденних бонусів

        Args:
            telegram_id: Telegram ID користувача
            limit: Максимальна кількість записів

        Returns:
            Dict з історією
        """
        try:
            logger.info(f"=== ОТРИМАННЯ ІСТОРІЇ ЩОДЕННИХ БОНУСІВ {telegram_id} ===")

            # Валідація telegram_id
            validated_id = validate_telegram_id(telegram_id)
            if not validated_id:
                raise ValidationError("Невірний Telegram ID")

            # TODO: Реалізувати завантаження з БД
            # Поки що повертаємо порожню історію
            history_entries = []

            # Отримуємо поточний статус для статистики
            daily_status = daily_bonus_manager.get_user_status(validated_id)

            return {
                "status": "success",
                "data": {
                    "history": history_entries,
                    "total_entries": len(history_entries),
                    "statistics": daily_status.get_statistics(),
                    "current_streak": daily_status.current_streak,
                    "longest_streak": daily_status.longest_streak
                }
            }

        except ValidationError:
            raise
        except Exception as e:
            logger.error(f"Помилка отримання історії щоденних бонусів {telegram_id}: {e}", exc_info=True)
            raise ValidationError("Помилка отримання історії")

    @staticmethod
    def calculate_reward_for_day(telegram_id: str, day_number: int) -> Dict[str, Any]:
        """
        Розрахунок винагороди для конкретного дня

        Args:
            telegram_id: Telegram ID користувача
            day_number: Номер дня (1-30)

        Returns:
            Dict з розрахованою винагородою
        """
        try:
            logger.info(f"=== РОЗРАХУНОК ВИНАГОРОДИ ДЛЯ ДНЯ {day_number} ===")

            # Валідація telegram_id
            validated_id = validate_telegram_id(telegram_id)
            if not validated_id:
                raise ValidationError("Невірний Telegram ID")

            # Валідація дня
            if day_number < 1 or day_number > 30:
                raise ValidationError("Номер дня має бути між 1 і 30")

            # Отримуємо дані користувача для рівня
            user_data = get_user(str(validated_id))
            user_level = 1
            if user_data:
                try:
                    user_quest = UserQuest.from_supabase_user(user_data)
                    user_level = user_quest.level
                except:
                    pass

            # Розраховуємо винагороду
            reward = calculate_daily_reward(
                day_number=day_number,
                current_streak=day_number,  # Припускаємо ідеальну серію для розрахунку
                user_level=user_level
            )

            # Додаткова інформація
            is_special = (day_number % 7 == 0)
            multiplier = reward_calculator.progressive_multipliers.get(day_number, 1.0)

            return {
                "status": "success",
                "data": {
                    "day_number": day_number,
                    "reward": reward.to_dict(),
                    "is_special_day": is_special,
                    "multiplier": multiplier,
                    "calculated_for_level": user_level,
                    "assuming_perfect_streak": True
                }
            }

        except ValidationError:
            raise
        except Exception as e:
            logger.error(f"Помилка розрахунку винагороди для дня {day_number}: {e}", exc_info=True)
            raise ValidationError("Помилка розрахунку винагороди")

    @staticmethod
    def get_reward_preview(telegram_id: str) -> Dict[str, Any]:
        """
        Отримання попереднього перегляду винагород на весь місяць

        Args:
            telegram_id: Telegram ID користувача

        Returns:
            Dict з попереднім переглядом
        """
        try:
            logger.info(f"=== ПОПЕРЕДНІЙ ПЕРЕГЛЯД ВИНАГОРОД {telegram_id} ===")

            # Валідація telegram_id
            validated_id = validate_telegram_id(telegram_id)
            if not validated_id:
                raise ValidationError("Невірний Telegram ID")

            # Отримуємо рівень користувача
            user_level = 1
            user_data = get_user(str(validated_id))
            if user_data:
                try:
                    user_quest = UserQuest.from_supabase_user(user_data)
                    user_level = user_quest.level
                except:
                    pass

            # Отримуємо попередній перегляд
            preview = reward_calculator.get_reward_preview(user_level=user_level)

            # Загальна статистика
            total_stats = reward_calculator.get_total_month_reward(user_level=user_level)

            return {
                "status": "success",
                "data": {
                    "preview": preview,
                    "total_statistics": total_stats,
                    "calculated_for_level": user_level,
                    "month_duration": 30,
                    "special_days_count": len([d for d in preview if d["is_special"]]),
                    "calculator_info": reward_calculator.get_calculator_stats()
                }
            }

        except ValidationError:
            raise
        except Exception as e:
            logger.error(f"Помилка отримання попереднього перегляду {telegram_id}: {e}", exc_info=True)
            raise ValidationError("Помилка отримання попереднього перегляду")

    @staticmethod
    def reset_user_streak(telegram_id: str, reason: str = "manual") -> Dict[str, Any]:
        """
        Скидання серії користувача (адміністративна функція)

        Args:
            telegram_id: Telegram ID користувача
            reason: Причина скидання

        Returns:
            Dict з результатом операції
        """
        try:
            logger.info(f"=== СКИДАННЯ СЕРІЇ КОРИСТУВАЧА {telegram_id} ===")
            logger.info(f"Причина: {reason}")

            # Валідація telegram_id
            validated_id = validate_telegram_id(telegram_id)
            if not validated_id:
                raise ValidationError("Невірний Telegram ID")

            # Отримуємо статус
            daily_status = daily_bonus_manager.get_user_status(validated_id, force_refresh=True)
            old_streak = daily_status.current_streak

            # Скидаємо серію
            daily_status.reset_streak(reason)

            # Зберігаємо оновлений статус
            if not daily_bonus_manager.save_status_to_db(daily_status):
                raise ValidationError("Помилка збереження статусу")

            logger.info(f"Серія користувача {validated_id} скинута: {old_streak} -> {daily_status.current_streak}")

            return {
                "status": "success",
                "message": "Серія успішно скинута",
                "old_streak": old_streak,
                "new_streak": daily_status.current_streak,
                "reason": reason,
                "reset_at": datetime.now(timezone.utc).isoformat()
            }

        except ValidationError:
            raise
        except Exception as e:
            logger.error(f"Помилка скидання серії {telegram_id}: {e}", exc_info=True)
            raise ValidationError("Помилка скидання серії")

    @staticmethod
    def _calculate_hours_until_next_claim(daily_status: DailyBonusStatus) -> float:
        """Розрахунок годин до наступного отримання"""
        if not daily_status.next_available_date:
            return 0.0

        now = datetime.now(timezone.utc)
        if daily_status.next_available_date <= now:
            return 0.0

        time_diff = daily_status.next_available_date - now
        return time_diff.total_seconds() / 3600


# Функції-обгортки для роутів
def get_daily_status_route(telegram_id: str):
    """Роут для отримання статусу"""
    return DailyController.get_daily_status(telegram_id)


def claim_daily_bonus_route(telegram_id: str, timestamp: Optional[int] = None):
    """Роут для отримання бонусу"""
    return DailyController.claim_daily_bonus(telegram_id, timestamp)


def get_daily_history_route(telegram_id: str, limit: int = 30):
    """Роут для отримання історії"""
    return DailyController.get_daily_history(telegram_id, limit)


def calculate_reward_route(telegram_id: str, day_number: int):
    """Роут для розрахунку винагороди"""
    return DailyController.calculate_reward_for_day(telegram_id, day_number)


def get_reward_preview_route(telegram_id: str):
    """Роут для попереднього перегляду"""
    return DailyController.get_reward_preview(telegram_id)


def reset_streak_route(telegram_id: str, reason: str = "manual"):
    """Роут для скидання серії"""
    return DailyController.reset_user_streak(telegram_id, reason)


# Експорт
__all__ = [
    'DailyController',
    'get_daily_status_route',
    'claim_daily_bonus_route',
    'get_daily_history_route',
    'calculate_reward_route',
    'get_reward_preview_route',
    'reset_streak_route'
]