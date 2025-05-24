"""
Контролер користувачів для системи завдань WINIX
Управління профілями, балансами та статистикою користувачів
"""

import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List

from ..models.user_quest import UserQuest, UserBalance, Reward
from ..utils.decorators import ValidationError
from ..utils.validators import validate_telegram_id, validate_reward_amount

# Імпорт функцій роботи з БД
try:
    from supabase_client import get_user, update_user, update_balance, update_coins
except ImportError:
    try:
        from backend.supabase_client import get_user, update_user, update_balance, update_coins
    except ImportError:
        # Fallback для тестування
        def get_user(telegram_id):
            return None


        def update_user(telegram_id, data):
            return None


        def update_balance(telegram_id, amount):
            return None


        def update_coins(telegram_id, amount):
            return None

logger = logging.getLogger(__name__)


class UserController:
    """Контролер для управління користувачами"""

    @staticmethod
    def get_user_profile(telegram_id: str) -> Dict[str, Any]:
        """
        Отримання повного профілю користувача

        Args:
            telegram_id: Telegram ID користувача

        Returns:
            Dict з даними користувача
        """
        try:
            logger.info(f"=== ОТРИМАННЯ ПРОФІЛЮ КОРИСТУВАЧА {telegram_id} ===")

            # Валідація telegram_id
            validated_id = validate_telegram_id(telegram_id)
            if not validated_id:
                logger.error(f"Невірний telegram_id: {telegram_id}")
                raise ValidationError("Невірний Telegram ID")

            # Отримуємо користувача з БД
            user_data = get_user(str(validated_id))
            if not user_data:
                logger.error(f"Користувач {validated_id} не знайдений")
                raise ValidationError("Користувач не знайдений")

            logger.info(f"Користувач {validated_id} знайдений в БД")

            # Створюємо об'єкт UserQuest для роботи з даними
            try:
                user_quest = UserQuest.from_supabase_user(user_data)
            except Exception as e:
                logger.error(f"Помилка створення UserQuest: {e}")
                # Fallback - використовуємо базові дані
                user_quest = UserQuest(
                    telegram_id=validated_id,
                    username=user_data.get('username', ''),
                    first_name=user_data.get('first_name', ''),
                    last_name=user_data.get('last_name', ''),
                    balance=UserBalance(
                        winix=int(user_data.get('balance', 0)),
                        tickets=int(user_data.get('coins', 0)),
                        flex=0
                    )
                )

            # Формуємо відповідь
            profile_data = {
                "id": user_data.get('id', validated_id),
                "telegram_id": validated_id,
                "username": user_quest.username,
                "first_name": user_quest.first_name,
                "last_name": user_quest.last_name,
                "language_code": user_quest.language_code,
                "balance": user_quest.balance.to_dict(),
                "level": user_quest.level,
                "experience": user_quest.experience,
                "level_progress": user_quest.get_level_progress(),
                "stats": user_quest.get_stats(),
                "created_at": user_data.get('created_at'),
                "updated_at": user_data.get('updated_at'),
                "last_activity": user_quest.last_activity.isoformat() if user_quest.last_activity else None
            }

            logger.info(f"Профіль користувача {validated_id} успішно сформовано")

            return {
                "status": "success",
                "data": profile_data
            }

        except ValidationError:
            raise
        except Exception as e:
            logger.error(f"Помилка отримання профілю користувача {telegram_id}: {e}", exc_info=True)
            raise ValidationError("Помилка отримання профілю")

    @staticmethod
    def get_user_balance(telegram_id: str) -> Dict[str, Any]:
        """
        Отримання балансів користувача

        Args:
            telegram_id: Telegram ID користувача

        Returns:
            Dict з балансами
        """
        try:
            logger.info(f"=== ОТРИМАННЯ БАЛАНСУ КОРИСТУВАЧА {telegram_id} ===")

            # Валідація telegram_id
            validated_id = validate_telegram_id(telegram_id)
            if not validated_id:
                raise ValidationError("Невірний Telegram ID")

            # Отримуємо користувача
            user_data = get_user(str(validated_id))
            if not user_data:
                raise ValidationError("Користувач не знайдений")

            # Формуємо баланс
            balance = {
                "winix": float(user_data.get('balance', 0)),
                "tickets": int(user_data.get('coins', 0)),
                "flex": 0  # FLEX баланс рахується окремо через wallet API
            }

            logger.info(f"Баланс користувача {validated_id}: {balance}")

            return {
                "status": "success",
                "balance": balance,
                "last_updated": user_data.get('updated_at')
            }

        except ValidationError:
            raise
        except Exception as e:
            logger.error(f"Помилка отримання балансу користувача {telegram_id}: {e}", exc_info=True)
            raise ValidationError("Помилка отримання балансу")

    @staticmethod
    def update_user_balance(telegram_id: str, balance_updates: Dict[str, Any]) -> Dict[str, Any]:
        """
        Оновлення балансу користувача

        Args:
            telegram_id: Telegram ID користувача
            balance_updates: Dict з оновленнями балансу

        Returns:
            Dict з результатом операції
        """
        try:
            logger.info(f"=== ОНОВЛЕННЯ БАЛАНСУ КОРИСТУВАЧА {telegram_id} ===")
            logger.info(f"Оновлення: {balance_updates}")

            # Валідація telegram_id
            validated_id = validate_telegram_id(telegram_id)
            if not validated_id:
                raise ValidationError("Невірний Telegram ID")

            # Валідація оновлень
            if not balance_updates or not isinstance(balance_updates, dict):
                raise ValidationError("Невірні дані для оновлення балансу")

            # Отримуємо поточного користувача
            user_data = get_user(str(validated_id))
            if not user_data:
                raise ValidationError("Користувач не знайдений")

            current_balance = UserBalance(
                winix=float(user_data.get('balance', 0)),
                tickets=int(user_data.get('coins', 0)),
                flex=0
            )

            logger.info(f"Поточний баланс: {current_balance.to_dict()}")

            # Обробляємо оновлення балансу
            result_operations = []

            # Оновлення WINIX
            if 'winix' in balance_updates:
                new_winix = balance_updates['winix']
                if not isinstance(new_winix, (int, float)) or new_winix < 0:
                    raise ValidationError("Невірне значення WINIX балансу")

                winix_diff = float(new_winix) - current_balance.winix
                if winix_diff != 0:
                    updated_user = update_balance(str(validated_id), winix_diff)
                    if updated_user:
                        result_operations.append(f"WINIX: {current_balance.winix} -> {new_winix}")
                        current_balance.winix = float(new_winix)
                    else:
                        raise ValidationError("Помилка оновлення WINIX балансу")

            # Оновлення Tickets
            if 'tickets' in balance_updates:
                new_tickets = balance_updates['tickets']
                if not isinstance(new_tickets, int) or new_tickets < 0:
                    raise ValidationError("Невірне значення tickets балансу")

                tickets_diff = int(new_tickets) - current_balance.tickets
                if tickets_diff != 0:
                    updated_user = update_coins(str(validated_id), tickets_diff)
                    if updated_user:
                        result_operations.append(f"Tickets: {current_balance.tickets} -> {new_tickets}")
                        current_balance.tickets = int(new_tickets)
                    else:
                        raise ValidationError("Помилка оновлення tickets балансу")

            # FLEX не оновлюємо через цей API (він рахується через wallet)

            logger.info(f"Операції виконано: {result_operations}")

            return {
                "status": "success",
                "message": "Баланс успішно оновлено",
                "operations": result_operations,
                "new_balance": current_balance.to_dict(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }

        except ValidationError:
            raise
        except Exception as e:
            logger.error(f"Помилка оновлення балансу користувача {telegram_id}: {e}", exc_info=True)
            raise ValidationError("Помилка оновлення балансу")

    @staticmethod
    def get_user_stats(telegram_id: str) -> Dict[str, Any]:
        """
        Отримання статистики користувача

        Args:
            telegram_id: Telegram ID користувача

        Returns:
            Dict зі статистикою
        """
        try:
            logger.info(f"=== ОТРИМАННЯ СТАТИСТИКИ КОРИСТУВАЧА {telegram_id} ===")

            # Валідація telegram_id
            validated_id = validate_telegram_id(telegram_id)
            if not validated_id:
                raise ValidationError("Невірний Telegram ID")

            # Отримуємо користувача
            user_data = get_user(str(validated_id))
            if not user_data:
                raise ValidationError("Користувач не знайдений")

            # Створюємо UserQuest для статистики
            try:
                user_quest = UserQuest.from_supabase_user(user_data)
                stats = user_quest.get_stats()
            except Exception as e:
                logger.warning(f"Помилка створення UserQuest для статистики: {e}")
                # Fallback статистика
                stats = {
                    "level": 1,
                    "experience": 0,
                    "level_progress": {"current_level": 1, "current_exp": 0, "exp_for_next": 100,
                                       "progress_percent": 0},
                    "balance": {
                        "winix": float(user_data.get('balance', 0)),
                        "tickets": int(user_data.get('coins', 0)),
                        "flex": 0
                    },
                    "tasks_completed": int(user_data.get('participations_count', 0)),
                    "rewards_claimed": 0,
                    "daily_streak": 0,
                    "last_activity": user_data.get('updated_at'),
                    "member_since": user_data.get('created_at')
                }

            # Додаємо додаткову статистику з Supabase
            additional_stats = {
                "badges": {
                    "winner": user_data.get('badge_winner', False),
                    "beginner": user_data.get('badge_beginner', False),
                    "rich": user_data.get('badge_rich', False)
                },
                "wins_count": int(user_data.get('wins_count', 0)),
                "participations_count": int(user_data.get('participations_count', 0)),
                "newbie_bonus_claimed": user_data.get('newbie_bonus_claimed', False)
            }

            stats.update(additional_stats)

            logger.info(f"Статистика користувача {validated_id} успішно сформована")

            return {
                "status": "success",
                "stats": stats
            }

        except ValidationError:
            raise
        except Exception as e:
            logger.error(f"Помилка отримання статистики користувача {telegram_id}: {e}", exc_info=True)
            raise ValidationError("Помилка отримання статистики")

    @staticmethod
    def update_user_settings(telegram_id: str, settings: Dict[str, Any]) -> Dict[str, Any]:
        """
        Оновлення налаштувань користувача

        Args:
            telegram_id: Telegram ID користувача
            settings: Dict з налаштуваннями

        Returns:
            Dict з результатом операції
        """
        try:
            logger.info(f"=== ОНОВЛЕННЯ НАЛАШТУВАНЬ КОРИСТУВАЧА {telegram_id} ===")
            logger.info(f"Налаштування: {settings}")

            # Валідація telegram_id
            validated_id = validate_telegram_id(telegram_id)
            if not validated_id:
                raise ValidationError("Невірний Telegram ID")

            # Валідація налаштувань
            if not settings or not isinstance(settings, dict):
                raise ValidationError("Невірні налаштування")

            # Отримуємо користувача
            user_data = get_user(str(validated_id))
            if not user_data:
                raise ValidationError("Користувач не знайдений")

            # Дозволені поля для оновлення
            allowed_fields = {
                'notifications_enabled', 'language_preference', 'username',
                'first_name', 'last_name'
            }

            # Фільтруємо та валідуємо налаштування
            update_data = {}

            for field, value in settings.items():
                if field in allowed_fields:
                    if field == 'notifications_enabled':
                        update_data[field] = bool(value)
                    elif field == 'language_preference':
                        if isinstance(value, str) and len(value) <= 10:
                            update_data[field] = value
                    elif field in ['username', 'first_name', 'last_name']:
                        if isinstance(value, str) and len(value) <= 64:
                            update_data[field] = value.strip()

            if not update_data:
                raise ValidationError("Немає валідних полів для оновлення")

            # Оновлюємо користувача
            update_data['updated_at'] = datetime.now(timezone.utc).isoformat()
            updated_user = update_user(str(validated_id), update_data)

            if not updated_user:
                raise ValidationError("Помилка оновлення налаштувань")

            logger.info(f"Налаштування користувача {validated_id} успішно оновлено: {list(update_data.keys())}")

            return {
                "status": "success",
                "message": "Налаштування успішно оновлено",
                "updated_fields": list(update_data.keys()),
                "updated_at": update_data['updated_at']
            }

        except ValidationError:
            raise
        except Exception as e:
            logger.error(f"Помилка оновлення налаштувань користувача {telegram_id}: {e}", exc_info=True)
            raise ValidationError("Помилка оновлення налаштувань")

    @staticmethod
    def add_user_reward(telegram_id: str, reward: Dict[str, Any], source: str = "manual") -> Dict[str, Any]:
        """
        Додавання винагороди користувачу

        Args:
            telegram_id: Telegram ID користувача
            reward: Dict з винагородою
            source: Джерело винагороди

        Returns:
            Dict з результатом операції
        """
        try:
            logger.info(f"=== ДОДАВАННЯ ВИНАГОРОДИ КОРИСТУВАЧУ {telegram_id} ===")
            logger.info(f"Винагорода: {reward}, джерело: {source}")

            # Валідація telegram_id
            validated_id = validate_telegram_id(telegram_id)
            if not validated_id:
                raise ValidationError("Невірний Telegram ID")

            # Валідація винагороди
            if not reward or not isinstance(reward, dict):
                raise ValidationError("Невірна винагорода")

            # Створюємо об'єкт Reward
            try:
                reward_obj = Reward(
                    winix=int(reward.get('winix', 0)),
                    tickets=int(reward.get('tickets', 0)),
                    flex=int(reward.get('flex', 0))
                )
            except (ValueError, TypeError):
                raise ValidationError("Невірний формат винагороди")

            if reward_obj.is_empty():
                raise ValidationError("Винагорода не може бути пустою")

            # Отримуємо користувача
            user_data = get_user(str(validated_id))
            if not user_data:
                raise ValidationError("Користувач не знайдений")

            # Додаємо винагороду
            operations = []

            if reward_obj.winix > 0:
                updated_user = update_balance(str(validated_id), reward_obj.winix)
                if updated_user:
                    operations.append(f"WINIX +{reward_obj.winix}")
                else:
                    raise ValidationError("Помилка додавання WINIX")

            if reward_obj.tickets > 0:
                updated_user = update_coins(str(validated_id), reward_obj.tickets)
                if updated_user:
                    operations.append(f"Tickets +{reward_obj.tickets}")
                else:
                    raise ValidationError("Помилка додавання tickets")

            # FLEX не додаємо через цей API

            logger.info(f"Винагорода додана користувачу {validated_id}: {operations}")

            return {
                "status": "success",
                "message": "Винагорода успішно додана",
                "reward": reward_obj.to_dict(),
                "operations": operations,
                "source": source,
                "added_at": datetime.now(timezone.utc).isoformat()
            }

        except ValidationError:
            raise
        except Exception as e:
            logger.error(f"Помилка додавання винагороди користувачу {telegram_id}: {e}", exc_info=True)
            raise ValidationError("Помилка додавання винагороди")


# Функції-обгортки для роутів
def get_profile_route(telegram_id: str):
    """Роут для отримання профілю"""
    return UserController.get_user_profile(telegram_id)


def get_balance_route(telegram_id: str):
    """Роут для отримання балансу"""
    return UserController.get_user_balance(telegram_id)


def update_balance_route(telegram_id: str, balance_data: Dict[str, Any]):
    """Роут для оновлення балансу"""
    return UserController.update_user_balance(telegram_id, balance_data)


def get_stats_route(telegram_id: str):
    """Роут для отримання статистики"""
    return UserController.get_user_stats(telegram_id)


def update_settings_route(telegram_id: str, settings_data: Dict[str, Any]):
    """Роут для оновлення налаштувань"""
    return UserController.update_user_settings(telegram_id, settings_data)


def add_reward_route(telegram_id: str, reward_data: Dict[str, Any]):
    """Роут для додавання винагороди"""
    source = reward_data.pop('source', 'manual')
    return UserController.add_user_reward(telegram_id, reward_data, source)


# Експорт
__all__ = [
    'UserController',
    'get_profile_route',
    'get_balance_route',
    'update_balance_route',
    'get_stats_route',
    'update_settings_route',
    'add_reward_route'
]