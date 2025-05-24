"""
Контролер користувачів для системи завдань WINIX
Управління профілями, балансами та статистикою користувачів
ОНОВЛЕНО: Інтеграція з Transaction Service для атомарних операцій
"""

import logging
from datetime import datetime, timezone
from typing import Dict, Any

logger = logging.getLogger(__name__)

from ..models.user_quest import UserQuest, UserBalance, Reward
from ..utils.decorators import ValidationError
from ..utils.validators import validate_telegram_id

# Імпорт Transaction Service
try:
    from ..services.transaction_service import transaction_service, TransactionAmount, TransactionType
except ImportError:
    try:
        from backend.quests.services.transaction_service import transaction_service, TransactionAmount, TransactionType
    except ImportError:
        logger.error("Transaction service недоступний, використовуємо старий метод")
        transaction_service = None
        TransactionAmount = None
        TransactionType = None

# Імпорт функцій роботи з БД (fallback)
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




class UserController:
    """Контролер для управління користувачами з підтримкою транзакцій"""

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

            # Додаємо інформацію про транзакції якщо доступний transaction service
            transaction_info = {}
            if transaction_service:
                try:
                    # Отримуємо останні транзакції
                    history_result = transaction_service.get_user_transaction_history(
                        telegram_id=str(validated_id),
                        limit=10
                    )

                    if history_result['success']:
                        recent_transactions = history_result.get('transactions', [])
                        balance_history = history_result.get('balance_history', {})

                        transaction_info = {
                            'recent_transactions_count': len(recent_transactions),
                            'last_transaction_date': recent_transactions[0].get('created_at') if recent_transactions else None,
                            'total_earned': balance_history.get('total_earned', {}),
                            'transaction_service_available': True
                        }

                except Exception as e:
                    logger.warning(f"Не вдалося отримати інформацію про транзакції: {e}")
                    transaction_info = {'transaction_service_available': False, 'error': str(e)}
            else:
                transaction_info = {'transaction_service_available': False}

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
                "last_activity": user_quest.last_activity.isoformat() if user_quest.last_activity else None,
                "transaction_info": transaction_info
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
        Отримання балансів користувача з інформацією про транзакції

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

            # Формуємо баланс з БД
            balance = {
                "winix": float(user_data.get('balance', 0)),
                "tickets": int(user_data.get('coins', 0)),
                "flex": 0  # FLEX баланс рахується окремо через wallet API
            }

            # Додаємо статистику з transaction service якщо доступний
            transaction_balance_info = {}
            if transaction_service:
                try:
                    # Отримуємо баланс з транзакцій для перевірки
                    balance_result = transaction_service.get_user_balance_summary(str(validated_id))

                    if balance_result['status'] == 'success':
                        transaction_data = balance_result['data']
                        current_from_transactions = transaction_data.get('current_balance', {})

                        transaction_balance_info = {
                            'balance_from_transactions': current_from_transactions,
                            'matches_db': (
                                abs(current_from_transactions.get('winix', 0) - balance['winix']) < 0.01 and
                                current_from_transactions.get('tickets', 0) == balance['tickets']
                            ),
                            'last_transaction_date': transaction_data.get('statistics', {}).get('last_transaction_date'),
                            'verification_available': True
                        }

                except Exception as e:
                    logger.warning(f"Не вдалося отримати баланс з транзакцій: {e}")
                    transaction_balance_info = {'verification_available': False, 'error': str(e)}
            else:
                transaction_balance_info = {'verification_available': False}

            logger.info(f"Баланс користувача {validated_id}: {balance}")

            return {
                "status": "success",
                "balance": balance,
                "transaction_verification": transaction_balance_info,
                "last_updated": user_data.get('updated_at'),
                "service_info": {
                    "transaction_service_available": transaction_service is not None
                }
            }

        except ValidationError:
            raise
        except Exception as e:
            logger.error(f"Помилка отримання балансу користувача {telegram_id}: {e}", exc_info=True)
            raise ValidationError("Помилка отримання балансу")

    @staticmethod
    def update_user_balance(telegram_id: str, balance_updates: Dict[str, Any]) -> Dict[str, Any]:
        """
        Оновлення балансу користувача через Transaction Service

        Args:
            telegram_id: Telegram ID користувача
            balance_updates: Dict з оновленнями балансу

        Returns:
            Dict з результатом операції
        """
        try:
            logger.info(f"=== ОНОВЛЕННЯ БАЛАНСУ КОРИСТУВАЧА {telegram_id} ===")
            logger.info(f"Оновлення: {balance_updates}")
            transaction_result = None

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

            # Визначаємо тип операції (додавання чи встановлення)
            operation_type = balance_updates.get('operation', 'set')  # 'set' або 'add'
            update_reason = balance_updates.get('reason', 'manual_update')

            # Розраховуємо різниці
            new_balances = {}
            balance_diffs = {}

            if 'winix' in balance_updates:
                new_winix = float(balance_updates['winix'])
                if new_winix < 0:
                    raise ValidationError("Баланс WINIX не може бути від'ємним")

                if operation_type == 'add':
                    balance_diffs['winix'] = new_winix
                    new_balances['winix'] = current_balance.winix + new_winix
                else:  # set
                    balance_diffs['winix'] = new_winix - current_balance.winix
                    new_balances['winix'] = new_winix

            if 'tickets' in balance_updates:
                new_tickets = int(balance_updates['tickets'])
                if new_tickets < 0:
                    raise ValidationError("Баланс tickets не може бути від'ємним")

                if operation_type == 'add':
                    balance_diffs['tickets'] = new_tickets
                    new_balances['tickets'] = current_balance.tickets + new_tickets
                else:  # set
                    balance_diffs['tickets'] = new_tickets - current_balance.tickets
                    new_balances['tickets'] = new_tickets

            if not balance_diffs:
                raise ValidationError("Не вказано жодного поля для оновлення")

            # Обробляємо через Transaction Service якщо доступний
            if transaction_service and TransactionAmount and TransactionType:
                try:
                    # Визначаємо тип транзакції
                    if any(diff > 0 for diff in balance_diffs.values()):
                        # Є додавання - використовуємо process_reward
                        reward_amount = TransactionAmount(
                            winix=max(balance_diffs.get('winix', 0), 0),
                            tickets=max(balance_diffs.get('tickets', 0), 0),
                            flex=0
                        )

                        if not reward_amount.is_empty():
                            transaction_result = transaction_service.process_reward(
                                telegram_id=str(validated_id),
                                reward_amount=reward_amount,
                                transaction_type=TransactionType.ADMIN_ADJUSTMENT,
                                description=f"Manual balance update: {update_reason}",
                                reference_id=f"manual_{validated_id}_{int(datetime.now(timezone.utc).timestamp())}",
                                reference_type="manual_update",
                                metadata={
                                    'operation_type': operation_type,
                                    'reason': update_reason,
                                    'manual': True,
                                    'previous_balance': current_balance.to_dict(),
                                    'new_balance': new_balances,
                                    'updated_by': 'system'
                                }
                            )

                            if not transaction_result['success']:
                                raise ValidationError(f"Помилка transaction service: {transaction_result['error']}")

                    # Якщо є зменшення і transaction service не підтримує від'ємні винагороди,
                    # використовуємо старий метод для зменшення
                    if any(diff < 0 for diff in balance_diffs.values()):
                        # Обробляємо зменшення через прямі виклики БД
                        if balance_diffs.get('winix', 0) < 0:
                            winix_result = update_balance(str(validated_id), balance_diffs['winix'])
                            if not winix_result:
                                raise ValidationError("Помилка зменшення WINIX балансу")

                        if balance_diffs.get('tickets', 0) < 0:
                            tickets_result = update_coins(str(validated_id), balance_diffs['tickets'])
                            if not tickets_result:
                                raise ValidationError("Помилка зменшення tickets балансу")

                    operations = []
                    for field, diff in balance_diffs.items():
                        if diff != 0:
                            operations.append(f"{field.upper()}: {current_balance.to_dict()[field]} -> {new_balances[field]} ({diff:+})")

                    transaction_id = None
                    if 'transaction_result' in locals() and transaction_result and isinstance(transaction_result, dict):
                        transaction_id = transaction_result.get('transaction_id')

                    logger.info(f"Баланс користувача {validated_id} оновлено через transaction service: {operations}")

                    return {
                        "status": "success",
                        "message": "Баланс успішно оновлено",
                        "operations": operations,
                        "new_balance": new_balances,
                        "transaction_id": transaction_id,
                        "updated_at": datetime.now(timezone.utc).isoformat(),
                        "service_used": "transaction_service"
                    }

                except Exception as e:
                    logger.error(f"Помилка використання transaction service: {e}")
                    # Fallback до старого методу
                    pass

            # Fallback до старого методу якщо transaction service недоступний
            result_operations = []

            # Оновлення WINIX
            if 'winix' in balance_diffs:
                winix_diff = balance_diffs['winix']
                if winix_diff != 0:
                    updated_user = update_balance(str(validated_id), winix_diff)
                    if updated_user:
                        result_operations.append(f"WINIX: {current_balance.winix} -> {new_balances['winix']}")
                        current_balance.winix = new_balances['winix']
                    else:
                        raise ValidationError("Помилка оновлення WINIX балансу")

            # Оновлення Tickets
            if 'tickets' in balance_diffs:
                tickets_diff = balance_diffs['tickets']
                if tickets_diff != 0:
                    updated_user = update_coins(str(validated_id), tickets_diff)
                    if updated_user:
                        result_operations.append(f"Tickets: {current_balance.tickets} -> {new_balances['tickets']}")
                        current_balance.tickets = new_balances['tickets']
                    else:
                        raise ValidationError("Помилка оновлення tickets балансу")

            logger.info(f"Операції виконано (старим методом): {result_operations}")

            return {
                "status": "success",
                "message": "Баланс успішно оновлено",
                "operations": result_operations,
                "new_balance": current_balance.to_dict(),
                "updated_at": datetime.now(timezone.utc).isoformat(),
                "service_used": "direct_db"
            }

        except ValidationError:
            raise
        except Exception as e:
            logger.error(f"Помилка оновлення балансу користувача {telegram_id}: {e}", exc_info=True)
            raise ValidationError("Помилка оновлення балансу")

    @staticmethod
    def get_user_stats(telegram_id: str) -> Dict[str, Any]:
        """
        Отримання статистики користувача з транзакціями

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

            # Додаємо статистику з Transaction Service якщо доступний
            transaction_stats = {}
            if transaction_service:
                try:
                    balance_result = transaction_service.get_user_balance_summary(str(validated_id))

                    if balance_result['status'] == 'success':
                        balance_data = balance_result['data']
                        balance_history = balance_data.get('balance_history', {})

                        transaction_stats = {
                            'total_transactions': balance_history.get('total_transactions', 0),
                            'total_earned_from_transactions': balance_history.get('total_earned', {}),
                            'total_spent_from_transactions': balance_history.get('total_spent', {}),
                            'recent_activity': balance_data.get('recent_activity', {}),
                            'transactions_by_type': balance_history.get('by_type', {}),
                            'last_transaction': balance_data.get('statistics', {}).get('last_transaction_date'),
                            'service_available': True
                        }

                except Exception as e:
                    logger.warning(f"Не вдалося отримати статистику з транзакцій: {e}")
                    transaction_stats = {'service_available': False, 'error': str(e)}
            else:
                transaction_stats = {'service_available': False}

            # Об'єднуємо всю статистику
            stats.update(additional_stats)
            stats['transaction_statistics'] = transaction_stats

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

            # Логуємо операцію через transaction service якщо доступний
            if transaction_service and TransactionAmount and TransactionType:
                try:
                    # Створюємо запис про зміну налаштувань (нульова винагорода)
                    settings_update_result = transaction_service.process_reward(
                        telegram_id=str(validated_id),
                        reward_amount=TransactionAmount(winix=0, tickets=0, flex=0),
                        transaction_type=TransactionType.ADMIN_ADJUSTMENT,
                        description=f"Settings update: {', '.join(update_data.keys())}",
                        reference_id=f"settings_{validated_id}_{int(datetime.now(timezone.utc).timestamp())}",
                        reference_type="settings_update",
                        metadata={
                            'operation': 'settings_update',
                            'updated_fields': list(update_data.keys()),
                            'settings_changes': update_data,
                            'admin_action': False
                        }
                    )

                    logger.info(f"Зміна налаштувань зареєстрована: {settings_update_result.get('transaction_id')}")

                except Exception as e:
                    logger.warning(f"Не вдалося зареєструвати зміну налаштувань: {e}")

            logger.info(f"Налаштування користувача {validated_id} успішно оновлено: {list(update_data.keys())}")

            return {
                "status": "success",
                "message": "Налаштування успішно оновлено",
                "updated_fields": list(update_data.keys()),
                "updated_at": update_data['updated_at'],
                "transaction_service_available": transaction_service is not None
            }

        except ValidationError:
            raise
        except Exception as e:
            logger.error(f"Помилка оновлення налаштувань користувача {telegram_id}: {e}", exc_info=True)
            raise ValidationError("Помилка оновлення налаштувань")

    @staticmethod
    def add_user_reward(telegram_id: str, reward: Dict[str, Any], source: str = "manual") -> Dict[str, Any]:
        """
        Додавання винагороди користувачу через Transaction Service

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

            # Обробляємо через Transaction Service якщо доступний
            if transaction_service and TransactionAmount and TransactionType:
                try:
                    reward_amount = TransactionAmount(
                        winix=reward_obj.winix,
                        tickets=reward_obj.tickets,
                        flex=reward_obj.flex
                    )

                    # Обробляємо через transaction service
                    transaction_result = transaction_service.process_reward(
                        telegram_id=str(validated_id),
                        reward_amount=reward_amount,
                        transaction_type=TransactionType.ADMIN_ADJUSTMENT,
                        description=f"Manual reward: {source}",
                        reference_id=f"manual_{validated_id}_{int(datetime.now(timezone.utc).timestamp())}",
                        reference_type="manual_reward",
                        metadata={
                            'source': source,
                            'manual': True,
                            'added_by': 'system',
                            'reward_details': reward
                        }
                    )

                    if transaction_result['success']:
                        operations = transaction_result['operations']
                        transaction_id = transaction_result['transaction_id']

                        logger.info(f"Винагорода додана користувачу {validated_id} через transaction service: {operations}")

                        return {
                            "status": "success",
                            "message": "Винагорода успішно додана",
                            "reward": reward_obj.to_dict(),
                            "operations": operations,
                            "source": source,
                            "transaction_id": transaction_id,
                            "added_at": transaction_result['processed_at'],
                            "service_used": "transaction_service"
                        }
                    else:
                        logger.error(f"Помилка transaction service: {transaction_result['error']}")
                        raise ValidationError(f"Помилка додавання винагороди: {transaction_result['error']}")

                except Exception as e:
                    logger.error(f"Помилка використання transaction service: {e}")
                    # Fallback до старого методу
                    pass

            # Fallback до старого методу якщо transaction service недоступний
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

            logger.info(f"Винагорода додана користувачу {validated_id} (старим методом): {operations}")

            return {
                "status": "success",
                "message": "Винагорода успішно додана",
                "reward": reward_obj.to_dict(),
                "operations": operations,
                "source": source,
                "added_at": datetime.now(timezone.utc).isoformat(),
                "service_used": "direct_db"
            }

        except ValidationError:
            raise
        except Exception as e:
            logger.error(f"Помилка додавання винагороди користувачу {telegram_id}: {e}", exc_info=True)
            raise ValidationError("Помилка додавання винагороди")

    @staticmethod
    def get_user_transaction_history(telegram_id: str, limit: int = 50) -> Dict[str, Any]:
        """
        Отримання історії транзакцій користувача

        Args:
            telegram_id: Telegram ID користувача
            limit: Максимальна кількість записів

        Returns:
            Dict з історією транзакцій
        """
        try:
            logger.info(f"=== ОТРИМАННЯ ІСТОРІЇ ТРАНЗАКЦІЙ {telegram_id} ===")

            # Валідація telegram_id
            validated_id = validate_telegram_id(telegram_id)
            if not validated_id:
                raise ValidationError("Невірний Telegram ID")

            # Перевіряємо користувача
            user_data = get_user(str(validated_id))
            if not user_data:
                raise ValidationError("Користувач не знайдений")

            # Отримуємо історію з Transaction Service якщо доступний
            if transaction_service:
                result = transaction_service.get_user_transaction_history(
                    telegram_id=str(validated_id),
                    limit=limit
                )

                if result['success']:
                    logger.info(f"Історія транзакцій для {validated_id} отримана з transaction service")

                    return {
                        "status": "success",
                        "data": {
                            **result,
                            "service_used": "transaction_service"
                        }
                    }
                else:
                    logger.error(f"Помилка отримання історії: {result['error']}")
                    raise ValidationError(f"Помилка отримання історії: {result['error']}")
            else:
                logger.warning("Transaction service недоступний")

                return {
                    "status": "success",
                    "data": {
                        "telegram_id": str(validated_id),
                        "transactions": [],
                        "total_count": 0,
                        "balance_history": {},
                        "last_updated": datetime.now(timezone.utc).isoformat(),
                        "service_used": "none",
                        "message": "Transaction service недоступний"
                    }
                }

        except ValidationError:
            raise
        except Exception as e:
            logger.error(f"Помилка отримання історії транзакцій {telegram_id}: {e}", exc_info=True)
            raise ValidationError("Помилка отримання історії транзакцій")


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


def get_transaction_history_route(telegram_id: str, limit: int = 50):
    """Роут для отримання історії транзакцій"""
    return UserController.get_user_transaction_history(telegram_id, limit)


# Експорт
__all__ = [
    'UserController',
    'get_profile_route',
    'get_balance_route',
    'update_balance_route',
    'get_stats_route',
    'update_settings_route',
    'add_reward_route',
    'get_transaction_history_route'
]