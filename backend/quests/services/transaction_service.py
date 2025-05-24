"""
Сервіс транзакцій для системи завдань WINIX
Атомарні операції з балансами та управління транзакціями
"""

import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional

from concurrent.futures import ThreadPoolExecutor

logger = logging.getLogger(__name__)

# Імпорт моделей
try:
    from ..models.transaction import (
        transaction_model, Transaction, TransactionAmount,
        TransactionType, TransactionStatus, CurrencyType
    )
except ImportError:
    logger.error("Не вдалося імпортувати модель транзакцій")
    # ✅ Fallback класи
    transaction_model = None


    class Transaction:
        pass


    class TransactionAmount:
        def __init__(self, winix=0, tickets=0, flex=0):
            self.winix = winix
            self.tickets = tickets
            self.flex = flex

        def to_dict(self):
            return {"winix": self.winix, "tickets": self.tickets, "flex": self.flex}


    class TransactionType:
        DAILY_BONUS = "daily_bonus"
        TASK_REWARD = "task_reward"
        # додай інші потрібні типи


    class TransactionStatus:
        PENDING = "pending"
        COMPLETED = "completed"
        FAILED = "failed"


    class CurrencyType:
        WINIX = "winix"
        TICKETS = "tickets"
        FLEX = "flex"


    try:
        from supabase_client import supabase, get_user, update_balance, update_coins
    except ImportError:
        # ✅ Fallback функції
        def get_user(telegram_id):
            logger.warning("get_user не доступна")
            return None


        def update_balance(telegram_id, amount):
            logger.warning("update_balance не доступна")
            return False


        def update_coins(telegram_id, amount):
            logger.warning("update_coins не доступна")
            return False


        supabase = None

# Імпорт функцій роботи з БД
try:
    from supabase_client import supabase, get_user, update_balance, update_coins
except ImportError:
    try:
        from backend.supabase_client import supabase, get_user, update_balance, update_coins
    except ImportError:
        # Fallback для тестування
        def get_user(telegram_id):
            return None


        def update_balance(telegram_id, amount):
            return None


        def update_coins(telegram_id, amount):
            return None


        supabase = None




class TransactionError(Exception):
    """Базова помилка транзакцій"""
    pass


class InsufficientFundsError(TransactionError):
    """Помилка недостатніх коштів"""
    pass


class TransactionValidationError(TransactionError):
    """Помилка валідації транзакції"""
    pass


class TransactionProcessingError(TransactionError):
    """Помилка обробки транзакції"""
    pass


class TransactionService:
    """Сервіс для атомарних операцій з балансами"""

    def __init__(self):
        self.model = transaction_model
        self.executor = ThreadPoolExecutor(max_workers=5)
        logger.info("TransactionService ініціалізовано")

    # === ОСНОВНІ ОПЕРАЦІЇ ===

    def process_reward(self, telegram_id: str, reward_amount: TransactionAmount,
                       transaction_type: TransactionType, description: str = "",
                       reference_id: Optional[str] = None,
                       reference_type: Optional[str] = None,
                       metadata: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Обробка нарахування винагороди з створенням транзакції

        Args:
            telegram_id: Telegram ID користувача
            reward_amount: Сума винагороди
            transaction_type: Тип транзакції
            description: Опис транзакції
            reference_id: ID пов'язаного об'єкта
            reference_type: Тип пов'язаного об'єкта
            metadata: Додаткові дані

        Returns:
            Результат операції
        """
        try:
            logger.info(f"Обробка винагороди для користувача {telegram_id}: {reward_amount.to_dict()}")

            # Валідація параметрів
            validation_result = self._validate_reward_params(
                telegram_id, reward_amount, transaction_type
            )
            if not validation_result['valid']:
                raise TransactionValidationError(validation_result['error'])

            # Перевіряємо користувача
            user = get_user(str(telegram_id))
            if not user:
                raise TransactionValidationError("Користувач не знайдений")

            # Створюємо транзакцію
            transaction = Transaction(
                telegram_id=str(telegram_id),
                type=transaction_type,
                status=TransactionStatus.PENDING,# type: ignore
                amount=reward_amount,
                description=description,
                metadata=metadata or {},
                reference_id=reference_id,
                reference_type=reference_type
            )

            # Зберігаємо транзакцію в БД
            created_transaction = self.model.create_transaction(transaction)
            if not created_transaction:
                raise TransactionProcessingError("Не вдалося створити транзакцію")

            # Виконуємо атомарне нарахування
            success_operations = []

            # Нарахування WINIX
            if reward_amount.winix > 0:
                winix_result = update_balance(str(telegram_id), reward_amount.winix)
                if winix_result:
                    success_operations.append(f"WINIX +{reward_amount.winix}")
                    logger.info(f"WINIX +{reward_amount.winix} нараховано користувачу {telegram_id}")
                else:
                    # Відкочуємо транзакцію
                    self.model.update_transaction_status(
                        created_transaction.id,
                        TransactionStatus.FAILED,
                        "Помилка нарахування WINIX"
                    )
                    raise TransactionProcessingError("Помилка нарахування WINIX")

            # Нарахування Tickets
            if reward_amount.tickets > 0:
                tickets_result = update_coins(str(telegram_id), reward_amount.tickets)
                if tickets_result:
                    success_operations.append(f"Tickets +{reward_amount.tickets}")
                    logger.info(f"Tickets +{reward_amount.tickets} нараховано користувачу {telegram_id}")
                else:
                    # Відкочуємо WINIX якщо було нараховано
                    if reward_amount.winix > 0:
                        try:
                            update_balance(str(telegram_id), -reward_amount.winix)
                        except:
                            pass

                    # Відкочуємо транзакцію
                    self.model.update_transaction_status(
                        created_transaction.id,
                        TransactionStatus.FAILED,
                        "Помилка нарахування Tickets"
                    )
                    raise TransactionProcessingError("Помилка нарахування Tickets")

            # FLEX поки що не нараховуємо через цей сервіс
            if reward_amount.flex > 0:
                logger.warning(f"FLEX нарахування поки не підтримується: {reward_amount.flex}")

            # Оновлюємо статус транзакції на успішний
            self.model.update_transaction_status(
                created_transaction.id,
                TransactionStatus.COMPLETED
            )

            logger.info(f"Винагорода успішно нарахована користувачу {telegram_id}: {success_operations}")

            return {
                'success': True,
                'transaction_id': created_transaction.id,
                'amount': reward_amount.to_dict(),
                'operations': success_operations,
                'processed_at': datetime.now(timezone.utc).isoformat()
            }

        except (TransactionValidationError, TransactionProcessingError) as e:
            logger.error(f"Помилка обробки винагороди: {e}")
            return {
                'success': False,
                'error': str(e),
                'error_type': type(e).__name__
            }
        except Exception as e:
            logger.error(f"Неочікувана помилка обробки винагороди: {e}", exc_info=True)
            return {
                'success': False,
                'error': "Внутрішня помилка сервера",
                'error_type': 'InternalError'
            }

    def process_spending(self, telegram_id: str, spend_amount: TransactionAmount,
                         transaction_type: TransactionType, description: str = "",
                         reference_id: Optional[str] = None,
                         reference_type: Optional[str] = None,
                         metadata: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Обробка витрачання коштів з перевіркою балансу

        Args:
            telegram_id: Telegram ID користувача
            spend_amount: Сума витрат
            transaction_type: Тип транзакції
            description: Опис транзакції
            reference_id: ID пов'язаного об'єкта
            reference_type: Тип пов'язаного об'єкта
            metadata: Додаткові дані

        Returns:
            Результат операції
        """
        try:
            logger.info(f"Обробка витрат для користувача {telegram_id}: {spend_amount.to_dict()}")

            # Валідація параметрів
            validation_result = self._validate_spending_params(
                telegram_id, spend_amount, transaction_type
            )
            if not validation_result['valid']:
                raise TransactionValidationError(validation_result['error'])

            # Перевіряємо користувача та баланс
            user = get_user(str(telegram_id))
            if not user:
                raise TransactionValidationError("Користувач не знайдений")

            current_balance = TransactionAmount(
                winix=float(user.get('balance', 0)),
                tickets=int(user.get('coins', 0)),
                flex=0  # FLEX рахується окремо
            )

            # Перевіряємо достатність коштів
            if spend_amount.winix > current_balance.winix:
                raise InsufficientFundsError(
                    f"Недостатньо WINIX: потрібно {spend_amount.winix}, є {current_balance.winix}"
                )

            if spend_amount.tickets > current_balance.tickets:
                raise InsufficientFundsError(
                    f"Недостатньо tickets: потрібно {spend_amount.tickets}, є {current_balance.tickets}"
                )

            # Створюємо транзакцію зі знаком мінус
            negative_amount = TransactionAmount(
                winix=-spend_amount.winix,
                tickets=-spend_amount.tickets,
                flex=-spend_amount.flex
            )

            transaction = Transaction(
                telegram_id=str(telegram_id),
                type=transaction_type,
                status=TransactionStatus.PENDING,# type: ignore
                amount=negative_amount,
                description=description,
                metadata=metadata or {},
                reference_id=reference_id,
                reference_type=reference_type
            )

            # Зберігаємо транзакцію
            created_transaction = self.model.create_transaction(transaction)
            if not created_transaction:
                raise TransactionProcessingError("Не вдалося створити транзакцію")

            # Виконуємо атомарне списання
            success_operations = []

            # Списання WINIX
            if spend_amount.winix > 0:
                winix_result = update_balance(str(telegram_id), -spend_amount.winix)
                if winix_result:
                    success_operations.append(f"WINIX -{spend_amount.winix}")
                    logger.info(f"WINIX -{spend_amount.winix} списано з користувача {telegram_id}")
                else:
                    self.model.update_transaction_status(
                        created_transaction.id,
                        TransactionStatus.FAILED,
                        "Помилка списання WINIX"
                    )
                    raise TransactionProcessingError("Помилка списання WINIX")

            # Списання Tickets
            if spend_amount.tickets > 0:
                tickets_result = update_coins(str(telegram_id), -spend_amount.tickets)
                if tickets_result:
                    success_operations.append(f"Tickets -{spend_amount.tickets}")
                    logger.info(f"Tickets -{spend_amount.tickets} списано з користувача {telegram_id}")
                else:
                    # Відкочуємо WINIX якщо було списано
                    if spend_amount.winix > 0:
                        try:
                            update_balance(str(telegram_id), spend_amount.winix)
                        except:
                            pass

                    self.model.update_transaction_status(
                        created_transaction.id,
                        TransactionStatus.FAILED,
                        "Помилка списання Tickets"
                    )
                    raise TransactionProcessingError("Помилка списання Tickets")

            # Оновлюємо статус транзакції
            self.model.update_transaction_status(
                created_transaction.id,
                TransactionStatus.COMPLETED
            )

            logger.info(f"Витрати успішно оброблено для користувача {telegram_id}: {success_operations}")

            return {
                'success': True,
                'transaction_id': created_transaction.id,
                'amount': spend_amount.to_dict(),
                'operations': success_operations,
                'processed_at': datetime.now(timezone.utc).isoformat()
            }

        except (TransactionValidationError, InsufficientFundsError, TransactionProcessingError) as e:
            logger.error(f"Помилка обробки витрат: {e}")
            return {
                'success': False,
                'error': str(e),
                'error_type': type(e).__name__
            }
        except Exception as e:
            logger.error(f"Неочікувана помилка обробки витрат: {e}", exc_info=True)
            return {
                'success': False,
                'error': "Внутрішня помилка сервера",
                'error_type': 'InternalError'
            }

    # === СПЕЦІАЛІЗОВАНІ МЕТОДИ ===

    def process_daily_bonus(self, telegram_id: str, winix_amount: float,
                            tickets_amount: int = 0, day_number: int = 1,
                            streak: int = 1) -> Dict[str, Any]:
        """
        Обробка щоденного бонусу

        Args:
            telegram_id: Telegram ID користувача
            winix_amount: Кількість WINIX
            tickets_amount: Кількість tickets
            day_number: Номер дня в місяці
            streak: Поточна серія

        Returns:
            Результат операції
        """
        amount = TransactionAmount(winix=winix_amount, tickets=tickets_amount)

        metadata = {
            'day_number': day_number,
            'streak': streak,
            'bonus_type': 'daily'
        }

        return self.process_reward(
            telegram_id=telegram_id,
            reward_amount=amount,
            transaction_type=TransactionType.DAILY_BONUS,# type: ignore
            description=f"Щоденний бонус (день {day_number}, серія {streak})",
            reference_id=f"daily_{telegram_id}_{day_number}",
            reference_type="daily_bonus",
            metadata=metadata
        )

    def process_flex_reward(self, telegram_id: str, winix_amount: float,
                            tickets_amount: int = 0, flex_level: str = "",
                            flex_balance: int = 0) -> Dict[str, Any]:
        """
        Обробка FLEX винагороди

        Args:
            telegram_id: Telegram ID користувача
            winix_amount: Кількість WINIX
            tickets_amount: Кількість tickets
            flex_level: Рівень FLEX
            flex_balance: Баланс FLEX токенів

        Returns:
            Результат операції
        """
        amount = TransactionAmount(winix=winix_amount, tickets=tickets_amount)

        metadata = {
            'flex_level': flex_level,
            'flex_balance': flex_balance,
            'reward_type': 'flex'
        }

        return self.process_reward(
            telegram_id=telegram_id,
            reward_amount=amount,
            transaction_type=TransactionType.FLEX_REWARD,
            description=f"FLEX винагорода рівня {flex_level}",
            reference_id=f"flex_{telegram_id}_{flex_level}",
            reference_type="flex_reward",
            metadata=metadata
        )

    def process_task_reward(self, telegram_id: str, winix_amount: float,
                            tickets_amount: int = 0, task_id: str = "",
                            task_type: str = "") -> Dict[str, Any]:
        """
        Обробка винагороди за завдання

        Args:
            telegram_id: Telegram ID користувача
            winix_amount: Кількість WINIX
            tickets_amount: Кількість tickets
            task_id: ID завдання
            task_type: Тип завдання

        Returns:
            Результат операції
        """
        amount = TransactionAmount(winix=winix_amount, tickets=tickets_amount)

        metadata = {
            'task_id': task_id,
            'task_type': task_type,
            'reward_type': 'task'
        }

        return self.process_reward(
            telegram_id=telegram_id,
            reward_amount=amount,
            transaction_type=TransactionType.TASK_REWARD,# type: ignore
            description=f"Винагорода за завдання ({task_type})",
            reference_id=task_id,
            reference_type="task",
            metadata=metadata

        )

    def process_wallet_connection_bonus(self, telegram_id: str, winix_amount: float = 100.0,
                                        wallet_address: str = "") -> Dict[str, Any]:
        """
        Обробка бонусу за підключення гаманця

        Args:
            telegram_id: Telegram ID користувача
            winix_amount: Кількість WINIX (за замовчуванням 100)
            wallet_address: Адреса гаманця

        Returns:
            Результат операції
        """
        amount = TransactionAmount(winix=winix_amount)

        metadata = {
            'wallet_address': wallet_address,
            'bonus_type': 'wallet_connection',
            'first_connection': True
        }

        return self.process_reward(
            telegram_id=telegram_id,
            reward_amount=amount,
            transaction_type=TransactionType.WALLET_CONNECTION_BONUS,
            description="Бонус за підключення TON гаманця",
            reference_id=f"wallet_{telegram_id}",
            reference_type="wallet_connection",
            metadata=metadata
        )

    def process_newbie_bonus(self, telegram_id: str, winix_amount: float = 50.0) -> Dict[str, Any]:
        """
        Обробка бонусу для новачків

        Args:
            telegram_id: Telegram ID користувача
            winix_amount: Кількість WINIX (за замовчуванням 50)

        Returns:
            Результат операції
        """
        amount = TransactionAmount(winix=winix_amount)

        metadata = {
            'bonus_type': 'newbie',
            'first_time': True
        }

        return self.process_reward(
            telegram_id=telegram_id,
            reward_amount=amount,
            transaction_type=TransactionType.NEWBIE_BONUS,
            description="Бонус для новачків",
            reference_id=f"newbie_{telegram_id}",
            reference_type="newbie_bonus",
            metadata=metadata
        )

    # === ДОПОМІЖНІ МЕТОДИ ===

    def get_user_transaction_history(self, telegram_id: str, limit: int = 50) -> Dict[str, Any]:
        """
        Отримання історії транзакцій користувача

        Args:
            telegram_id: Telegram ID користувача
            limit: Максимальна кількість записів

        Returns:
            Історія транзакцій
        """
        try:
            logger.info(f"Отримання історії транзакцій користувача {telegram_id}")

            if not self.model:
                return {'success': False, 'error': 'Сервіс недоступний'}

            # Отримуємо транзакції
            transactions = self.model.get_user_transactions(telegram_id, limit)

            # Отримуємо статистику балансу
            balance_history = self.model.get_user_balance_history(telegram_id, limit)

            return {
                'success': True,
                'telegram_id': telegram_id,
                'transactions': [t.to_dict() for t in transactions],
                'total_count': len(transactions),
                'balance_history': balance_history,
                'last_updated': datetime.now(timezone.utc).isoformat()
            }

        except Exception as e:
            logger.error(f"Помилка отримання історії транзакцій: {e}")
            return {'success': False, 'error': str(e)}

    def get_transaction_details(self, transaction_id: str) -> Dict[str, Any]:
        """
        Отримання деталей транзакції

        Args:
            transaction_id: ID транзакції

        Returns:
            Деталі транзакції
        """
        try:
            logger.info(f"Отримання деталей транзакції {transaction_id}")

            if not self.model:
                return {'success': False, 'error': 'Сервіс недоступний'}

            transaction = self.model.get_transaction(transaction_id)

            if transaction:
                return {
                    'success': True,
                    'transaction': transaction.to_dict()
                }
            else:
                return {
                    'success': False,
                    'error': 'Транзакція не знайдена'
                }

        except Exception as e:
            logger.error(f"Помилка отримання деталей транзакції: {e}")
            return {'success': False, 'error': str(e)}

    def get_service_statistics(self) -> Dict[str, Any]:
        """
        Отримання статистики сервісу

        Returns:
            Статистика
        """
        try:
            logger.info("Отримання статистики сервісу транзакцій")

            if not self.model:
                return {'success': False, 'error': 'Сервіс недоступний'}

            stats = self.model.get_transaction_statistics()

            return {
                'success': True,
                'statistics': stats,
                'service_info': {
                    'name': 'TransactionService',
                    'version': '1.0.0',
                    'status': 'active'
                }
            }

        except Exception as e:
            logger.error(f"Помилка отримання статистики сервісу: {e}")
            return {'success': False, 'error': str(e)}

    def _validate_reward_params(self, telegram_id: str, amount: TransactionAmount,
                                transaction_type: TransactionType) -> Dict[str, Any]:
        """Валідація параметрів винагороди"""
        if not telegram_id:
            return {'valid': False, 'error': 'Telegram ID відсутній'}

        if not isinstance(amount, TransactionAmount):
            return {'valid': False, 'error': 'Невірний тип суми'}

        if amount.is_empty():
            return {'valid': False, 'error': 'Сума винагороди не може бути пустою'}

        if not amount.is_positive():
            return {'valid': False, 'error': 'Сума винагороди має бути позитивною'}

        if not isinstance(transaction_type, TransactionType):
            return {'valid': False, 'error': 'Невірний тип транзакції'}

        return {'valid': True}

    def _validate_spending_params(self, telegram_id: str, amount: TransactionAmount,
                                  transaction_type: TransactionType) -> Dict[str, Any]:
        """Валідація параметрів витрат"""
        if not telegram_id:
            return {'valid': False, 'error': 'Telegram ID відсутній'}

        if not isinstance(amount, TransactionAmount):
            return {'valid': False, 'error': 'Невірний тип суми'}

        if amount.is_empty():
            return {'valid': False, 'error': 'Сума витрат не може бути пустою'}

        if not amount.is_positive():
            return {'valid': False, 'error': 'Сума витрат має бути позитивною'}

        if not isinstance(transaction_type, TransactionType):
            return {'valid': False, 'error': 'Невірний тип транзакції'}

        return {'valid': True}


# Глобальна інстанція сервісу
transaction_service = TransactionService()

# Експорт
__all__ = [
    'TransactionService',
    'TransactionError',
    'InsufficientFundsError',
    'TransactionValidationError',
    'TransactionProcessingError',
    'transaction_service'
]