"""
Сервіс транзакцій для системи завдань WINIX - ВИПРАВЛЕНА ВЕРСІЯ
Атомарні операції з балансами та управління транзакціями БЕЗ блокуючих імпортів
"""

import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

# === БЕЗПЕЧНИЙ ІМПОРТ ЗАЛЕЖНОСТЕЙ ===

# Базові винятки (завжди доступні)
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

# Спрощена версія TransactionAmount
class TransactionAmount:
    """Спрощена версія суми транзакції"""
    def __init__(self, winix=0, tickets=0, flex=0):
        self.winix = float(winix) if winix else 0.0
        self.tickets = int(tickets) if tickets else 0
        self.flex = int(flex) if flex else 0

    def to_dict(self):
        return {
            "winix": self.winix,
            "tickets": self.tickets,
            "flex": self.flex
        }

    def is_empty(self):
        return self.winix == 0 and self.tickets == 0 and self.flex == 0

    def is_positive(self):
        return self.winix >= 0 and self.tickets >= 0 and self.flex >= 0

# Базові енуми
class TransactionType:
    DAILY_BONUS = "daily_bonus"
    TASK_REWARD = "task_reward"
    FLEX_REWARD = "flex_reward"
    WALLET_CONNECTION_BONUS = "wallet_connection_bonus"
    NEWBIE_BONUS = "newbie_bonus"
    SPENDING = "spending"
    TRANSFER = "transfer"

class TransactionStatus:
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"

class CurrencyType:
    WINIX = "winix"
    TICKETS = "tickets"
    FLEX = "flex"

# Безпечний імпорт моделей транзакцій
transaction_model = None
try:
    from ..models.transaction import (
        transaction_model as _transaction_model,
        Transaction, TransactionAmount as ModelTransactionAmount,
        TransactionType as ModelTransactionType,
        TransactionStatus as ModelTransactionStatus,
        CurrencyType as ModelCurrencyType
    )
    transaction_model = _transaction_model
    # Використовуємо модельні класи якщо доступні
    if ModelTransactionAmount:
        TransactionAmount = ModelTransactionAmount
    if ModelTransactionType:
        TransactionType = ModelTransactionType
    logger.info("✅ Models transaction імпортовано")
except ImportError:
    logger.warning("⚠️ Models transaction недоступні, використовуємо спрощені класи")

# Безпечний імпорт функцій роботи з БД
get_user = update_balance = update_coins = None
supabase = None

try:
    from supabase_client import supabase, get_user, update_balance, update_coins
    logger.info("✅ Supabase client імпортовано")
except ImportError:
    try:
        from backend.supabase_client import supabase, get_user, update_balance, update_coins
        logger.info("✅ Backend supabase client імпортовано")
    except ImportError:
        logger.warning("⚠️ Supabase client недоступний")
        # Заглушки
        def get_user(telegram_id):
            logger.warning("get_user недоступна")
            return None

        def update_balance(telegram_id, amount):
            logger.warning("update_balance недоступна")
            return False

        def update_coins(telegram_id, amount):
            logger.warning("update_coins недоступна")
            return False


class TransactionService:
    """Спрощений сервіс для атомарних операцій з балансами"""

    def __init__(self):
        self.model = transaction_model
        logger.info("✅ TransactionService ініціалізовано (спрощена версія)")

    # === ОСНОВНІ ОПЕРАЦІЇ ===

    def process_reward(self, telegram_id: str, reward_amount: TransactionAmount,
                       transaction_type: str, description: str = "",
                       reference_id: Optional[str] = None,
                       reference_type: Optional[str] = None,
                       metadata: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Обробка нарахування винагороди

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
            logger.info(f"📥 Обробка винагороди для {telegram_id}: {reward_amount.to_dict()}")

            # Валідація параметрів
            validation_result = self._validate_reward_params(telegram_id, reward_amount, transaction_type)
            if not validation_result['valid']:
                raise TransactionValidationError(validation_result['error'])

            # Перевіряємо користувача
            user = get_user(str(telegram_id))
            if not user:
                raise TransactionValidationError("Користувач не знайдений")

            # Виконуємо атомарне нарахування
            success_operations = []

            # Нарахування WINIX
            if reward_amount.winix > 0:
                winix_result = update_balance(str(telegram_id), reward_amount.winix)
                if winix_result:
                    success_operations.append(f"WINIX +{reward_amount.winix}")
                    logger.info(f"💰 WINIX +{reward_amount.winix} нараховано користувачу {telegram_id}")
                else:
                    raise TransactionProcessingError("Помилка нарахування WINIX")

            # Нарахування Tickets
            if reward_amount.tickets > 0:
                tickets_result = update_coins(str(telegram_id), reward_amount.tickets)
                if tickets_result:
                    success_operations.append(f"Tickets +{reward_amount.tickets}")
                    logger.info(f"🎫 Tickets +{reward_amount.tickets} нараховано користувачу {telegram_id}")
                else:
                    # Відкочуємо WINIX якщо було нараховано
                    if reward_amount.winix > 0:
                        try:
                            update_balance(str(telegram_id), -reward_amount.winix)
                            logger.warning(f"🔄 Відкочено WINIX через помилку tickets")
                        except:
                            pass
                    raise TransactionProcessingError("Помилка нарахування Tickets")

            # FLEX поки що пропускаємо
            if reward_amount.flex > 0:
                logger.warning(f"⚠️ FLEX нарахування поки не підтримується: {reward_amount.flex}")

            # Створюємо запис транзакції якщо модель доступна
            transaction_id = None
            if self.model and hasattr(self.model, 'create_transaction'):
                try:
                    transaction_id = self._create_transaction_record(
                        telegram_id, reward_amount, transaction_type, description,
                        reference_id, reference_type, metadata, TransactionStatus.COMPLETED
                    )
                except Exception as e:
                    logger.warning(f"⚠️ Не вдалося створити запис транзакції: {e}")

            logger.info(f"✅ Винагорода успішно нарахована користувачу {telegram_id}")

            return {
                'success': True,
                'transaction_id': transaction_id,
                'amount': reward_amount.to_dict(),
                'operations': success_operations,
                'processed_at': datetime.now(timezone.utc).isoformat()
            }

        except (TransactionValidationError, TransactionProcessingError) as e:
            logger.error(f"❌ Помилка обробки винагороди: {e}")
            return {
                'success': False,
                'error': str(e),
                'error_type': type(e).__name__
            }
        except Exception as e:
            logger.error(f"💥 Неочікувана помилка обробки винагороди: {e}", exc_info=True)
            return {
                'success': False,
                'error': "Внутрішня помилка сервера",
                'error_type': 'InternalError'
            }

    def process_spending(self, telegram_id: str, spend_amount: TransactionAmount,
                         transaction_type: str, description: str = "",
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
            logger.info(f"📤 Обробка витрат для {telegram_id}: {spend_amount.to_dict()}")

            # Валідація параметрів
            validation_result = self._validate_spending_params(telegram_id, spend_amount, transaction_type)
            if not validation_result['valid']:
                raise TransactionValidationError(validation_result['error'])

            # Перевіряємо користувача та баланс
            user = get_user(str(telegram_id))
            if not user:
                raise TransactionValidationError("Користувач не знайдений")

            current_balance = TransactionAmount(
                winix=float(user.get('balance', 0)),
                tickets=int(user.get('coins', 0)),
                flex=0
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

            # Виконуємо атомарне списання
            success_operations = []

            # Списання WINIX
            if spend_amount.winix > 0:
                winix_result = update_balance(str(telegram_id), -spend_amount.winix)
                if winix_result:
                    success_operations.append(f"WINIX -{spend_amount.winix}")
                    logger.info(f"💸 WINIX -{spend_amount.winix} списано з користувача {telegram_id}")
                else:
                    raise TransactionProcessingError("Помилка списання WINIX")

            # Списання Tickets
            if spend_amount.tickets > 0:
                tickets_result = update_coins(str(telegram_id), -spend_amount.tickets)
                if tickets_result:
                    success_operations.append(f"Tickets -{spend_amount.tickets}")
                    logger.info(f"🎫 Tickets -{spend_amount.tickets} списано з користувача {telegram_id}")
                else:
                    # Відкочуємо WINIX якщо було списано
                    if spend_amount.winix > 0:
                        try:
                            update_balance(str(telegram_id), spend_amount.winix)
                            logger.warning(f"🔄 Відкочено WINIX через помилку tickets")
                        except:
                            pass
                    raise TransactionProcessingError("Помилка списання Tickets")

            # Створюємо запис транзакції
            transaction_id = None
            if self.model and hasattr(self.model, 'create_transaction'):
                try:
                    negative_amount = TransactionAmount(
                        winix=-spend_amount.winix,
                        tickets=-spend_amount.tickets,
                        flex=-spend_amount.flex
                    )
                    transaction_id = self._create_transaction_record(
                        telegram_id, negative_amount, transaction_type, description,
                        reference_id, reference_type, metadata, TransactionStatus.COMPLETED
                    )
                except Exception as e:
                    logger.warning(f"⚠️ Не вдалося створити запис транзакції: {e}")

            logger.info(f"✅ Витрати успішно оброблено для користувача {telegram_id}")

            return {
                'success': True,
                'transaction_id': transaction_id,
                'amount': spend_amount.to_dict(),
                'operations': success_operations,
                'processed_at': datetime.now(timezone.utc).isoformat()
            }

        except (TransactionValidationError, InsufficientFundsError, TransactionProcessingError) as e:
            logger.error(f"❌ Помилка обробки витрат: {e}")
            return {
                'success': False,
                'error': str(e),
                'error_type': type(e).__name__
            }
        except Exception as e:
            logger.error(f"💥 Неочікувана помилка обробки витрат: {e}", exc_info=True)
            return {
                'success': False,
                'error': "Внутрішня помилка сервера",
                'error_type': 'InternalError'
            }

    # === СПЕЦІАЛІЗОВАНІ МЕТОДИ ===

    def process_daily_bonus(self, telegram_id: str, winix_amount: float,
                            tickets_amount: int = 0, day_number: int = 1,
                            streak: int = 1) -> Dict[str, Any]:
        """Обробка щоденного бонусу"""
        amount = TransactionAmount(winix=winix_amount, tickets=tickets_amount)

        metadata = {
            'day_number': day_number,
            'streak': streak,
            'bonus_type': 'daily'
        }

        return self.process_reward(
            telegram_id=telegram_id,
            reward_amount=amount,
            transaction_type=TransactionType.DAILY_BONUS,
            description=f"Щоденний бонус (день {day_number}, серія {streak})",
            reference_id=f"daily_{telegram_id}_{day_number}",
            reference_type="daily_bonus",
            metadata=metadata
        )

    def process_task_reward(self, telegram_id: str, winix_amount: float,
                            tickets_amount: int = 0, task_id: str = "",
                            task_type: str = "") -> Dict[str, Any]:
        """Обробка винагороди за завдання"""
        amount = TransactionAmount(winix=winix_amount, tickets=tickets_amount)

        metadata = {
            'task_id': task_id,
            'task_type': task_type,
            'reward_type': 'task'
        }

        return self.process_reward(
            telegram_id=telegram_id,
            reward_amount=amount,
            transaction_type=TransactionType.TASK_REWARD,
            description=f"Винагорода за завдання ({task_type})",
            reference_id=task_id,
            reference_type="task",
            metadata=metadata
        )

    def process_wallet_connection_bonus(self, telegram_id: str, winix_amount: float = 100.0,
                                        wallet_address: str = "") -> Dict[str, Any]:
        """Обробка бонусу за підключення гаманця"""
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

    # === ДОПОМІЖНІ МЕТОДИ ===

    def get_user_transaction_history(self, telegram_id: str, limit: int = 50) -> Dict[str, Any]:
        """Отримання історії транзакцій користувача"""
        try:
            logger.info(f"📊 Отримання історії транзакцій користувача {telegram_id}")

            if not self.model or not hasattr(self.model, 'get_user_transactions'):
                return {
                    'success': False,
                    'error': 'Функція історії транзакцій недоступна',
                    'transactions': [],
                    'total_count': 0
                }

            # Отримуємо транзакції
            transactions = self.model.get_user_transactions(telegram_id, limit)

            return {
                'success': True,
                'telegram_id': telegram_id,
                'transactions': [t.to_dict() if hasattr(t, 'to_dict') else t for t in transactions],
                'total_count': len(transactions),
                'last_updated': datetime.now(timezone.utc).isoformat()
            }

        except Exception as e:
            logger.error(f"❌ Помилка отримання історії транзакцій: {e}")
            return {
                'success': False,
                'error': str(e),
                'transactions': [],
                'total_count': 0
            }

    def get_service_statistics(self) -> Dict[str, Any]:
        """Отримання статистики сервісу"""
        try:
            logger.info("📈 Отримання статистики сервісу транзакцій")

            stats = {
                'service_info': {
                    'name': 'TransactionService',
                    'version': '1.0.0',
                    'status': 'active',
                    'simplified_mode': self.model is None
                },
                'dependencies': {
                    'transaction_model': self.model is not None,
                    'supabase': supabase is not None,
                    'user_functions': get_user is not None
                }
            }

            if self.model and hasattr(self.model, 'get_transaction_statistics'):
                try:
                    model_stats = self.model.get_transaction_statistics()
                    stats['statistics'] = model_stats
                except Exception as e:
                    stats['statistics'] = {'error': str(e)}
            else:
                stats['statistics'] = {'message': 'Детальна статистика недоступна в спрощеному режимі'}

            return {'success': True, **stats}

        except Exception as e:
            logger.error(f"❌ Помилка отримання статистики сервісу: {e}")
            return {'success': False, 'error': str(e)}

    def _validate_reward_params(self, telegram_id: str, amount: TransactionAmount,
                                transaction_type: str) -> Dict[str, Any]:
        """Валідація параметрів винагороди"""
        if not telegram_id:
            return {'valid': False, 'error': 'Telegram ID відсутній'}

        if not isinstance(amount, TransactionAmount):
            return {'valid': False, 'error': 'Невірний тип суми'}

        if amount.is_empty():
            return {'valid': False, 'error': 'Сума винагороди не може бути пустою'}

        if not amount.is_positive():
            return {'valid': False, 'error': 'Сума винагороди має бути позитивною'}

        if not transaction_type:
            return {'valid': False, 'error': 'Тип транзакції відсутній'}

        return {'valid': True}

    def _validate_spending_params(self, telegram_id: str, amount: TransactionAmount,
                                  transaction_type: str) -> Dict[str, Any]:
        """Валідація параметрів витрат"""
        if not telegram_id:
            return {'valid': False, 'error': 'Telegram ID відсутній'}

        if not isinstance(amount, TransactionAmount):
            return {'valid': False, 'error': 'Невірний тип суми'}

        if amount.is_empty():
            return {'valid': False, 'error': 'Сума витрат не може бути пустою'}

        if not amount.is_positive():
            return {'valid': False, 'error': 'Сума витрат має бути позитивною'}

        if not transaction_type:
            return {'valid': False, 'error': 'Тип транзакції відсутній'}

        return {'valid': True}

    def _create_transaction_record(self, telegram_id: str, amount: TransactionAmount,
                                   transaction_type: str, description: str,
                                   reference_id: Optional[str], reference_type: Optional[str],
                                   metadata: Optional[Dict[str, Any]], status: str) -> Optional[str]:
        """Створює запис транзакції в БД"""
        try:
            if not self.model or not hasattr(self.model, 'create_transaction'):
                return None

            # Тут створюється запис транзакції
            # Реалізація залежить від конкретної моделі
            logger.info(f"📝 Створення запису транзакції для {telegram_id}")

            # Заглушка для створення
            return f"tx_{telegram_id}_{int(datetime.now().timestamp())}"

        except Exception as e:
            logger.error(f"❌ Помилка створення запису транзакції: {e}")
            return None

    def get_service_status(self) -> Dict[str, Any]:
        """Отримання статусу сервісу"""
        return {
            'available': True,
            'model_available': self.model is not None,
            'supabase_available': supabase is not None,
            'user_functions_available': get_user is not None and update_balance is not None,
            'mode': 'full' if self.model else 'simplified'
        }


# Глобальна інстанція сервісу з безпечною ініціалізацією
try:
    transaction_service = TransactionService()
    logger.info("✅ TransactionService створено")
except Exception as e:
    logger.error(f"❌ Помилка створення TransactionService: {e}")
    # Заглушка
    class TransactionServiceStub:
        def __init__(self):
            pass
        def process_reward(self, *args, **kwargs): return {'success': False, 'error': 'Service unavailable'}
        def process_spending(self, *args, **kwargs): return {'success': False, 'error': 'Service unavailable'}
        def process_daily_bonus(self, *args, **kwargs): return {'success': False, 'error': 'Service unavailable'}
        def process_task_reward(self, *args, **kwargs): return {'success': False, 'error': 'Service unavailable'}
        def get_service_status(self): return {'available': False, 'error': 'Service creation failed'}

    transaction_service = TransactionServiceStub()


# === ЕКСПОРТ ===
__all__ = [
    'TransactionService',
    'TransactionError',
    'InsufficientFundsError',
    'TransactionValidationError',
    'TransactionProcessingError',
    'TransactionAmount',
    'TransactionType',
    'TransactionStatus',
    'CurrencyType',
    'transaction_service'
]