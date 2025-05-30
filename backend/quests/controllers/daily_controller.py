"""
Контролер щоденних бонусів для системи завдань WINIX
Обробка отримання, статусу та історії щоденних винагород
З повною підтримкою Supabase БД
"""
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional, List
import random
import hashlib

logger = logging.getLogger(__name__)

from ..models.daily_bonus import (
    DailyBonusStatus, daily_bonus_manager, Reward
)
from ..models.user_quest import UserQuest
from ..services.reward_calculator import reward_calculator, calculate_daily_reward
from ..utils.decorators import ValidationError
from ..utils.validators import validate_telegram_id

# Імпорт Transaction Service
try:
    from ..services.transaction_service import transaction_service
except ImportError:
    try:
        from backend.quests.services.transaction_service import transaction_service
    except ImportError:
        logger.error("Transaction service недоступний, використовуємо старий метод")
        transaction_service = None

# Імпорт функцій роботи з БД (fallback)
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


class DailyController:
    """Контролер щоденних бонусів з підтримкою транзакцій та БД"""

    @staticmethod
    def _convert_telegram_id_to_user_id(telegram_id: str) -> str:
        """
        Конвертація telegram_id в user_id для БД
        В БД використовується user_id як рядок
        """
        # Перевіряємо чи це вже user_id формат
        if isinstance(telegram_id, str) and telegram_id:
            return telegram_id
        # Конвертуємо число в рядок
        return str(telegram_id)

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

            # Конвертуємо в user_id для БД
            user_id = DailyController._convert_telegram_id_to_user_id(validated_id)
            logger.info(f"Converted telegram_id {validated_id} to user_id {user_id}")

            # Перевіряємо чи користувач існує
            user_data = get_user(str(validated_id))
            if not user_data:
                raise ValidationError("Користувач не знайдений")

            # Отримуємо статус щоденних бонусів з БД
            daily_status = daily_bonus_manager.get_user_status(user_id)

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
                    user_id=validated_id,
                    day_number=daily_status.current_day_number,
                    current_streak=daily_status.current_streak,
                    user_level=user_level
                )
                daily_status.today_reward = today_reward

            # Формуємо відповідь
            status_data = daily_status.to_dict()

            # Додаємо додаткову інформацію
            status_data.update({
                "telegram_id": validated_id,  # Повертаємо оригінальний telegram_id
                "streak_info": daily_status.get_streak_info(),
                "statistics": daily_status.get_statistics(),
                "next_claim_in_hours": DailyController._calculate_hours_until_next_claim(daily_status),
                "month_progress": (daily_status.total_days_claimed / 30 * 100),
                "is_special_day": False,  # Видаляємо логіку спеціальних днів
                "calendar_rewards": DailyController._get_calendar_rewards(validated_id),  # Додаємо календар
                "claimed_days": DailyController._get_claimed_days(user_id)  # Додаємо список отриманих днів
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
        Отримання щоденного бонусу через Transaction Service

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

            # Конвертуємо в user_id для БД
            user_id = DailyController._convert_telegram_id_to_user_id(validated_id)

            # Перевіряємо користувача
            user_data = get_user(str(validated_id))
            if not user_data:
                raise ValidationError("Користувач не знайдений")

            # Отримуємо поточний статус
            daily_status = daily_bonus_manager.get_user_status(user_id, force_refresh=True)

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
                user_id=validated_id,
                day_number=daily_status.current_day_number,
                current_streak=daily_status.current_streak,
                user_level=user_level
            )

            logger.info(f"Розрахована винагорода: {reward.to_dict()}")

            # Нараховуємо винагороду через Transaction Service
            if transaction_service:
                # Використовуємо атомарну транзакцію
                transaction_result = transaction_service.process_daily_bonus(
                    telegram_id=str(validated_id),
                    winix_amount=reward.winix,
                    tickets_amount=reward.tickets,
                    day_number=daily_status.current_day_number,
                    streak=daily_status.current_streak
                )

                if transaction_result['success']:
                    success_operations = transaction_result['operations']
                    transaction_id = transaction_result['transaction_id']
                    logger.info(f"Щоденний бонус нарахований через transaction service: {success_operations}")
                else:
                    logger.error(f"Помилка transaction service: {transaction_result['error']}")
                    raise ValidationError(f"Помилка нарахування: {transaction_result['error']}")
            else:
                # Fallback до старого методу
                success_operations = []
                transaction_id = None

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

            # Отримуємо бонус (оновлює статус)
            entry = daily_status.claim_bonus(reward)

            # Зберігаємо оновлений статус в БД
            if not daily_bonus_manager.save_status_to_db(daily_status):
                logger.error("Помилка збереження статусу щоденних бонусів")
                # Не викидаємо помилку, оскільки винагорода вже нарахована

            # Зберігаємо запис про отримання в БД
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
                "is_special_day": False,
                "streak_bonus_applied": daily_status.current_streak > 1,
                "claimed_at": entry.claim_date.isoformat(),
                "next_available": daily_status.next_available_date.isoformat() if daily_status.next_available_date else None,
                "total_days_claimed": daily_status.total_days_claimed
            }

            # Додаємо transaction_id якщо є
            if transaction_id:
                response_data["transaction_id"] = transaction_id

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
        Отримання історії щоденних бонусів з БД

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

            # Конвертуємо в user_id для БД
            user_id = DailyController._convert_telegram_id_to_user_id(validated_id)

            # Отримуємо історію з БД
            history_entries = daily_bonus_manager.get_user_history(user_id, limit)

            # Конвертуємо в формат для API
            history_data = []
            for entry in history_entries:
                history_data.append({
                    'claim_date': entry.claim_date.isoformat(),
                    'day_number': entry.day_number,
                    'streak': entry.streak_at_claim,
                    'reward': {
                        'winix': entry.reward.winix,
                        'tickets': entry.reward.tickets
                    },
                    'is_special_day': entry.is_special_day
                })

            # Отримуємо поточний статус для статистики
            daily_status = daily_bonus_manager.get_user_status(user_id)

            # Додатково отримуємо транзакції якщо доступно
            transaction_history = []
            if transaction_service:
                try:
                    history_result = transaction_service.get_user_transaction_history(
                        telegram_id=str(validated_id),
                        limit=limit
                    )

                    if history_result['success']:
                        # Фільтруємо тільки daily_bonus транзакції
                        all_transactions = history_result.get('transactions', [])
                        transaction_history = [
                            t for t in all_transactions
                            if t.get('type') == 'daily_bonus'
                        ]
                except Exception as e:
                    logger.warning(f"Помилка отримання історії з transaction service: {e}")

            return {
                "status": "success",
                "data": {
                    "history": history_data,
                    "total_entries": len(history_data),
                    "statistics": daily_status.get_statistics(),
                    "current_streak": daily_status.current_streak,
                    "longest_streak": daily_status.longest_streak,
                    "has_transaction_history": len(transaction_history) > 0,
                    "transactions": transaction_history[:10]  # Перші 10 транзакцій
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
                user_id=validated_id,
                day_number=day_number,
                current_streak=day_number,  # Припускаємо ідеальну серію для розрахунку
                user_level=user_level
            )

            # Додаткова інформація
            is_special = False  # Більше немає спеціальних днів
            multiplier = 1.0

            return {
                "status": "success",
                "data": {
                    "day_number": day_number,
                    "reward": reward.to_dict(),
                    "is_special_day": is_special,
                    "multiplier": multiplier,
                    "calculated_for_level": user_level,
                    "assuming_perfect_streak": True,
                    "transaction_service_available": transaction_service is not None
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
            preview = reward_calculator.get_reward_preview(validated_id, user_level=user_level)

            # Загальна статистика
            total_stats = reward_calculator.get_total_month_reward(validated_id, user_level=user_level)

            return {
                "status": "success",
                "data": {
                    "preview": preview,
                    "total_statistics": total_stats,
                    "calculated_for_level": user_level,
                    "month_duration": 30,
                    "special_days_count": 0,  # Більше немає спеціальних днів
                    "calculator_info": reward_calculator.get_calculator_stats(),
                    "transaction_service_info": {
                        "available": transaction_service is not None,
                        "atomic_operations": transaction_service is not None
                    }
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

            # Конвертуємо в user_id для БД
            user_id = DailyController._convert_telegram_id_to_user_id(validated_id)

            # Отримуємо статус
            daily_status = daily_bonus_manager.get_user_status(user_id, force_refresh=True)
            old_streak = daily_status.current_streak

            # Скидаємо серію
            daily_status.reset_streak(reason)

            # Зберігаємо оновлений статус в БД
            if not daily_bonus_manager.save_status_to_db(daily_status):
                raise ValidationError("Помилка збереження статусу")

            # Логуємо операцію через transaction service якщо доступний
            if transaction_service:
                try:
                    # Створюємо запис про адміністративну операцію
                    from ..models.transaction import TransactionAmount, TransactionType

                    admin_result = transaction_service.process_reward(
                        telegram_id=str(validated_id),
                        reward_amount=TransactionAmount(winix=0, tickets=0, flex=0),  # Нульова винагорода
                        transaction_type=TransactionType.ADMIN_ADJUSTMENT,
                        description=f"Скидання серії щоденних бонусів: {reason}",
                        reference_id=f"streak_reset_{validated_id}_{int(datetime.now(timezone.utc).timestamp())}",
                        reference_type="streak_reset",
                        metadata={
                            'operation': 'streak_reset',
                            'old_streak': old_streak,
                            'new_streak': daily_status.current_streak,
                            'reason': reason,
                            'admin_action': True
                        }
                    )

                    logger.info(f"Адміністративна операція зареєстрована: {admin_result.get('transaction_id')}")

                except Exception as e:
                    logger.warning(f"Не вдалося зареєструвати адміністративну операцію: {e}")

            logger.info(f"Серія користувача {validated_id} скинута: {old_streak} -> {daily_status.current_streak}")

            return {
                "status": "success",
                "message": "Серія успішно скинута",
                "old_streak": old_streak,
                "new_streak": daily_status.current_streak,
                "reason": reason,
                "reset_at": datetime.now(timezone.utc).isoformat(),
                "transaction_service_used": transaction_service is not None
            }

        except ValidationError:
            raise
        except Exception as e:
            logger.error(f"Помилка скидання серії {telegram_id}: {e}", exc_info=True)
            raise ValidationError("Помилка скидання серії")

    @staticmethod
    def get_user_daily_statistics(telegram_id: str) -> Dict[str, Any]:
        """
        Отримання детальної статистики щоденних бонусів користувача

        Args:
            telegram_id: Telegram ID користувача

        Returns:
            Dict зі статистикою
        """
        try:
            logger.info(f"=== СТАТИСТИКА ЩОДЕННИХ БОНУСІВ {telegram_id} ===")

            # Валідація telegram_id
            validated_id = validate_telegram_id(telegram_id)
            if not validated_id:
                raise ValidationError("Невірний Telegram ID")

            # Конвертуємо в user_id для БД
            user_id = DailyController._convert_telegram_id_to_user_id(validated_id)

            # Отримуємо базову статистику
            daily_status = daily_bonus_manager.get_user_status(user_id)
            base_stats = daily_status.get_statistics()

            # Додаємо статистику з транзакцій якщо доступно
            transaction_stats = {}
            if transaction_service:
                try:
                    history_result = transaction_service.get_user_transaction_history(
                        telegram_id=str(validated_id),
                        limit=100
                    )

                    if history_result['success']:
                        daily_transactions = [
                            t for t in history_result.get('transactions', [])
                            if t.get('type') == 'daily_bonus' and t.get('status') == 'completed'
                        ]

                        total_winix = sum(t.get('amount', {}).get('winix', 0) for t in daily_transactions)
                        total_tickets = sum(t.get('amount', {}).get('tickets', 0) for t in daily_transactions)

                        transaction_stats = {
                            'total_claims_from_transactions': len(daily_transactions),
                            'total_winix_earned': total_winix,
                            'total_tickets_earned': total_tickets,
                            'average_winix_per_day': total_winix / len(daily_transactions) if daily_transactions else 0,
                            'last_claim_transaction': daily_transactions[0] if daily_transactions else None
                        }

                except Exception as e:
                    logger.warning(f"Помилка отримання статистики з транзакцій: {e}")

            # Об'єднуємо статистику
            combined_stats = {
                **base_stats,
                'transaction_statistics': transaction_stats,
                'service_info': {
                    'transaction_service_available': transaction_service is not None,
                    'atomic_operations_enabled': transaction_service is not None,
                    'database_connected': True  # Тепер завжди true
                }
            }

            return {
                "status": "success",
                "data": combined_stats
            }

        except ValidationError:
            raise
        except Exception as e:
            logger.error(f"Помилка отримання статистики {telegram_id}: {e}", exc_info=True)
            raise ValidationError("Помилка отримання статистики")

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

    @staticmethod
    def _get_calendar_rewards(user_id: int) -> List[Dict[str, Any]]:
        """
        Отримує календар винагород для користувача на весь місяць

        Args:
            user_id: ID користувача

        Returns:
            List з інформацією про винагороди кожного дня
        """
        calendar = []

        for day in range(1, 31):
            reward = calculate_daily_reward(
                user_id=user_id,
                day_number=day,
                current_streak=day,  # Припускаємо ідеальну серію
                user_level=1
            )

            calendar.append({
                "day": day,
                "winix": reward.winix,
                "tickets": reward.tickets,
                "hasTickets": reward.tickets > 0
            })

        return calendar

    @staticmethod
    def _get_claimed_days(user_id: str) -> List[int]:
        """
        Отримує список днів які вже були отримані

        Args:
            user_id: User ID для БД

        Returns:
            List з номерами днів
        """
        try:
            # Отримуємо історію з БД
            history = daily_bonus_manager.get_user_history(user_id, limit=30)

            # Витягуємо номери днів
            claimed_days = [entry.day_number for entry in history]

            return sorted(set(claimed_days))  # Унікальні та відсортовані

        except Exception as e:
            logger.error(f"Помилка отримання claimed days: {e}")
            return []


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


def get_daily_statistics_route(telegram_id: str):
    """Роут для отримання статистики"""
    return DailyController.get_user_daily_statistics(telegram_id)


# Експорт
__all__ = [
    'DailyController',
    'get_daily_status_route',
    'claim_daily_bonus_route',
    'get_daily_history_route',
    'calculate_reward_route',
    'get_reward_preview_route',
    'reset_streak_route',
    'get_daily_statistics_route'
]