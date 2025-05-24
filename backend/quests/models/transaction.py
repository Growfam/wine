"""
Модель транзакцій для системи завдань WINIX
Обробка та зберігання всіх операцій з балансами
"""

import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List
from enum import Enum
from dataclasses import dataclass, asdict

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

logger = logging.getLogger(__name__)


class TransactionType(Enum):
    """Типи транзакцій"""
    # Заробіток
    DAILY_BONUS = "daily_bonus"
    FLEX_REWARD = "flex_reward"
    TASK_REWARD = "task_reward"
    REFERRAL_BONUS = "referral_bonus"
    NEWBIE_BONUS = "newbie_bonus"
    WALLET_CONNECTION_BONUS = "wallet_connection_bonus"

    # Витрати
    PURCHASE = "purchase"
    WITHDRAWAL = "withdrawal"
    PENALTY = "penalty"

    # Системні
    ADMIN_ADJUSTMENT = "admin_adjustment"
    MIGRATION = "migration"
    CORRECTION = "correction"


class TransactionStatus(Enum):
    """Статуси транзакцій"""
    PENDING = "pending"
    COMPLETED = "completed"
    FAILED = "failed"
    CANCELLED = "cancelled"
    REFUNDED = "refunded"


class CurrencyType(Enum):
    """Типи валют"""
    WINIX = "winix"
    TICKETS = "tickets"
    FLEX = "flex"


@dataclass
class TransactionAmount:
    """Сума транзакції по валютах"""
    winix: float = 0.0
    tickets: int = 0
    flex: int = 0

    def to_dict(self) -> Dict[str, Any]:
        return {
            'winix': float(self.winix),
            'tickets': int(self.tickets),
            'flex': int(self.flex)
        }

    def is_empty(self) -> bool:
        """Перевірка чи транзакція пуста"""
        return self.winix == 0 and self.tickets == 0 and self.flex == 0

    def is_positive(self) -> bool:
        """Перевірка чи всі суми позитивні"""
        return self.winix >= 0 and self.tickets >= 0 and self.flex >= 0

    def __add__(self, other):
        """Додавання сум транзакцій"""
        if isinstance(other, TransactionAmount):
            return TransactionAmount(
                winix=self.winix + other.winix,
                tickets=self.tickets + other.tickets,
                flex=self.flex + other.flex
            )
        return NotImplemented

    def __sub__(self, other):
        """Віднімання сум транзакцій"""
        if isinstance(other, TransactionAmount):
            return TransactionAmount(
                winix=self.winix - other.winix,
                tickets=self.tickets - other.tickets,
                flex=self.flex - other.flex
            )
        return NotImplemented


@dataclass
class Transaction:
    """Модель транзакції"""
    id: Optional[str] = None
    telegram_id: str = ""
    type: TransactionType = TransactionType.ADMIN_ADJUSTMENT
    status: TransactionStatus = TransactionStatus.PENDING
    amount: TransactionAmount = None
    description: str = ""
    metadata: Dict[str, Any] = None
    reference_id: Optional[str] = None  # ID пов'язаного об'єкта (завдання, бонусу тощо)
    reference_type: Optional[str] = None  # Тип пов'язаного об'єкта
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    processed_at: Optional[datetime] = None
    error_message: Optional[str] = None

    def __post_init__(self):
        if self.amount is None:
            self.amount = TransactionAmount()
        if self.metadata is None:
            self.metadata = {}
        if self.created_at is None:
            self.created_at = datetime.now(timezone.utc)

    def to_dict(self) -> Dict[str, Any]:
        """Конвертація в словник для JSON"""
        return {
            'id': self.id,
            'telegram_id': self.telegram_id,
            'type': self.type.value if isinstance(self.type, TransactionType) else self.type,
            'status': self.status.value if isinstance(self.status, TransactionStatus) else self.status,
            'amount': self.amount.to_dict() if self.amount else {},
            'description': self.description,
            'metadata': self.metadata or {},
            'reference_id': self.reference_id,
            'reference_type': self.reference_type,
            'created_at': self.created_at.isoformat() if self.created_at else None,
            'updated_at': self.updated_at.isoformat() if self.updated_at else None,
            'processed_at': self.processed_at.isoformat() if self.processed_at else None,
            'error_message': self.error_message
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'Transaction':
        """Створення транзакції з словника"""
        # Парсинг енумів
        transaction_type = TransactionType(data.get('type', 'admin_adjustment'))
        transaction_status = TransactionStatus(data.get('status', 'pending'))

        # Парсинг сум
        amount_data = data.get('amount', {})
        amount = TransactionAmount(
            winix=float(amount_data.get('winix', 0)),
            tickets=int(amount_data.get('tickets', 0)),
            flex=int(amount_data.get('flex', 0))
        )

        # Парсинг дат
        created_at = None
        if data.get('created_at'):
            try:
                created_at = datetime.fromisoformat(data['created_at'].replace('Z', '+00:00'))
            except:
                created_at = datetime.now(timezone.utc)

        updated_at = None
        if data.get('updated_at'):
            try:
                updated_at = datetime.fromisoformat(data['updated_at'].replace('Z', '+00:00'))
            except:
                pass

        processed_at = None
        if data.get('processed_at'):
            try:
                processed_at = datetime.fromisoformat(data['processed_at'].replace('Z', '+00:00'))
            except:
                pass

        return cls(
            id=data.get('id'),
            telegram_id=str(data.get('telegram_id', '')),
            type=transaction_type,
            status=transaction_status,
            amount=amount,
            description=data.get('description', ''),
            metadata=data.get('metadata', {}),
            reference_id=data.get('reference_id'),
            reference_type=data.get('reference_type'),
            created_at=created_at,
            updated_at=updated_at,
            processed_at=processed_at,
            error_message=data.get('error_message')
        )


class TransactionModel:
    """Модель для роботи з транзакціями"""

    TABLE_NAME = 'transactions'

    def __init__(self):
        self.supabase = supabase
        logger.info("TransactionModel ініціалізовано")

    def create_transaction(self, transaction: Transaction) -> Optional[Transaction]:
        """
        Створення нової транзакції

        Args:
            transaction: Об'єкт транзакції

        Returns:
            Створена транзакція або None
        """
        try:
            logger.info(f"Створення транзакції для користувача {transaction.telegram_id}")

            if not self.supabase:
                logger.error("Supabase не ініціалізовано")
                return None

            # Генеруємо ID якщо немає
            if not transaction.id:
                transaction.id = self._generate_transaction_id()

            # Встановлюємо час створення
            transaction.created_at = datetime.now(timezone.utc)

            # Підготовка даних для вставки
            insert_data = {
                'id': transaction.id,
                'telegram_id': transaction.telegram_id,
                'type': transaction.type.value,
                'status': transaction.status.value,
                'amount_winix': float(transaction.amount.winix),
                'amount_tickets': int(transaction.amount.tickets),
                'amount_flex': int(transaction.amount.flex),
                'description': transaction.description,
                'metadata': transaction.metadata,
                'reference_id': transaction.reference_id,
                'reference_type': transaction.reference_type,
                'created_at': transaction.created_at.isoformat(),
                'error_message': transaction.error_message
            }

            # Вставка в БД
            result = self.supabase.table(self.TABLE_NAME).insert(insert_data).execute()

            if result.data:
                logger.info(f"Транзакція {transaction.id} створена успішно")
                return transaction
            else:
                logger.error("Помилка створення транзакції в БД")
                return None

        except Exception as e:
            logger.error(f"Помилка створення транзакції: {e}", exc_info=True)
            return None

    def get_transaction(self, transaction_id: str) -> Optional[Transaction]:
        """
        Отримання транзакції за ID

        Args:
            transaction_id: ID транзакції

        Returns:
            Транзакція або None
        """
        try:
            logger.info(f"Отримання транзакції {transaction_id}")

            if not self.supabase:
                return None

            result = self.supabase.table(self.TABLE_NAME).select('*').eq('id', transaction_id).execute()

            if result.data:
                transaction_data = result.data[0]
                return self._parse_transaction_from_db(transaction_data)

            return None

        except Exception as e:
            logger.error(f"Помилка отримання транзакції {transaction_id}: {e}")
            return None

    def get_user_transactions(self, telegram_id: str, limit: int = 50,
                              transaction_type: Optional[TransactionType] = None,
                              status: Optional[TransactionStatus] = None) -> List[Transaction]:
        """
        Отримання транзакцій користувача

        Args:
            telegram_id: Telegram ID користувача
            limit: Максимальна кількість записів
            transaction_type: Фільтр по типу транзакції
            status: Фільтр по статусу

        Returns:
            Список транзакцій
        """
        try:
            logger.info(f"Отримання транзакцій користувача {telegram_id}")

            if not self.supabase:
                return []

            query = self.supabase.table(self.TABLE_NAME).select('*').eq('telegram_id', telegram_id)

            if transaction_type:
                query = query.eq('type', transaction_type.value)

            if status:
                query = query.eq('status', status.value)

            result = query.order('created_at', desc=True).limit(limit).execute()

            transactions = []
            if result.data:
                for transaction_data in result.data:
                    transaction = self._parse_transaction_from_db(transaction_data)
                    if transaction:
                        transactions.append(transaction)

            logger.info(f"Знайдено {len(transactions)} транзакцій для користувача {telegram_id}")
            return transactions

        except Exception as e:
            logger.error(f"Помилка отримання транзакцій користувача {telegram_id}: {e}")
            return []

    def update_transaction_status(self, transaction_id: str, status: TransactionStatus,
                                  error_message: Optional[str] = None) -> bool:
        """
        Оновлення статусу транзакції

        Args:
            transaction_id: ID транзакції
            status: Новий статус
            error_message: Повідомлення про помилку (якщо є)

        Returns:
            True якщо оновлено успішно
        """
        try:
            logger.info(f"Оновлення статусу транзакції {transaction_id} на {status.value}")

            if not self.supabase:
                return False

            update_data = {
                'status': status.value,
                'updated_at': datetime.now(timezone.utc).isoformat()
            }

            if status == TransactionStatus.COMPLETED:
                update_data['processed_at'] = datetime.now(timezone.utc).isoformat()

            if error_message:
                update_data['error_message'] = error_message

            result = self.supabase.table(self.TABLE_NAME).update(update_data).eq('id', transaction_id).execute()

            if result.data:
                logger.info(f"Статус транзакції {transaction_id} оновлено успішно")
                return True

            return False

        except Exception as e:
            logger.error(f"Помилка оновлення статусу транзакції {transaction_id}: {e}")
            return False

    def get_user_balance_history(self, telegram_id: str, limit: int = 30) -> Dict[str, Any]:
        """
        Отримання історії балансу користувача

        Args:
            telegram_id: Telegram ID користувача
            limit: Максимальна кількість записів

        Returns:
            Статистика балансу
        """
        try:
            logger.info(f"Отримання історії балансу користувача {telegram_id}")

            transactions = self.get_user_transactions(
                telegram_id,
                limit=limit,
                status=TransactionStatus.COMPLETED
            )

            # Рахуємо статистику
            total_earned = TransactionAmount()
            total_spent = TransactionAmount()
            by_type = {}

            for transaction in transactions:
                # Розділяємо на заробіток та витрати
                if transaction.type in [
                    TransactionType.DAILY_BONUS,
                    TransactionType.FLEX_REWARD,
                    TransactionType.TASK_REWARD,
                    TransactionType.REFERRAL_BONUS,
                    TransactionType.NEWBIE_BONUS,
                    TransactionType.WALLET_CONNECTION_BONUS
                ]:
                    total_earned += transaction.amount
                elif transaction.type in [
                    TransactionType.PURCHASE,
                    TransactionType.WITHDRAWAL,
                    TransactionType.PENALTY
                ]:
                    total_spent += transaction.amount

                # Статистика по типах
                type_key = transaction.type.value
                if type_key not in by_type:
                    by_type[type_key] = {
                        'count': 0,
                        'amount': TransactionAmount()
                    }

                by_type[type_key]['count'] += 1
                by_type[type_key]['amount'] += transaction.amount

            # Конвертуємо в JSON-серіалізовний формат
            by_type_serializable = {}
            for type_key, data in by_type.items():
                by_type_serializable[type_key] = {
                    'count': data['count'],
                    'amount': data['amount'].to_dict()
                }

            return {
                'total_transactions': len(transactions),
                'total_earned': total_earned.to_dict(),
                'total_spent': total_spent.to_dict(),
                'net_change': (total_earned - total_spent).to_dict(),
                'by_type': by_type_serializable,
                'recent_transactions': [t.to_dict() for t in transactions[:10]]
            }

        except Exception as e:
            logger.error(f"Помилка отримання історії балансу користувача {telegram_id}: {e}")
            return {}

    def get_transaction_statistics(self) -> Dict[str, Any]:
        """
        Отримання загальної статистики транзакцій

        Returns:
            Словник зі статистикою
        """
        try:
            logger.info("Отримання статистики транзакцій")

            if not self.supabase:
                return {}

            # Загальна кількість транзакцій
            total_result = self.supabase.table(self.TABLE_NAME).select('id', count='exact').execute()
            total_transactions = total_result.count or 0

            # Статистика по статусах
            status_stats = {}
            for status in TransactionStatus:
                result = self.supabase.table(self.TABLE_NAME).select('id', count='exact').eq('status',
                                                                                             status.value).execute()
                status_stats[status.value] = result.count or 0

            # Статистика по типах
            type_stats = {}
            for trans_type in TransactionType:
                result = self.supabase.table(self.TABLE_NAME).select('id', count='exact').eq('type',
                                                                                             trans_type.value).execute()
                type_stats[trans_type.value] = result.count or 0

            # Сума по валютах (тільки completed транзакції)
            completed_result = self.supabase.table(self.TABLE_NAME) \
                .select('amount_winix,amount_tickets,amount_flex') \
                .eq('status', TransactionStatus.COMPLETED.value) \
                .execute()

            total_amounts = TransactionAmount()
            if completed_result.data:
                for row in completed_result.data:
                    total_amounts.winix += float(row.get('amount_winix', 0))
                    total_amounts.tickets += int(row.get('amount_tickets', 0))
                    total_amounts.flex += int(row.get('amount_flex', 0))

            return {
                'total_transactions': total_transactions,
                'status_breakdown': status_stats,
                'type_breakdown': type_stats,
                'total_amounts': total_amounts.to_dict(),
                'last_updated': datetime.now(timezone.utc).isoformat()
            }

        except Exception as e:
            logger.error(f"Помилка отримання статистики транзакцій: {e}")
            return {}

    def _parse_transaction_from_db(self, data: Dict[str, Any]) -> Optional[Transaction]:
        """Парсинг транзакції з даних БД"""
        try:
            # Збираємо amount з окремих полів
            amount = TransactionAmount(
                winix=float(data.get('amount_winix', 0)),
                tickets=int(data.get('amount_tickets', 0)),
                flex=int(data.get('amount_flex', 0))
            )

            return Transaction(
                id=data.get('id'),
                telegram_id=str(data.get('telegram_id')),
                type=TransactionType(data.get('type')),
                status=TransactionStatus(data.get('status')),
                amount=amount,
                description=data.get('description', ''),
                metadata=data.get('metadata', {}),
                reference_id=data.get('reference_id'),
                reference_type=data.get('reference_type'),
                created_at=datetime.fromisoformat(data['created_at'].replace('Z', '+00:00')) if data.get(
                    'created_at') else None,
                updated_at=datetime.fromisoformat(data['updated_at'].replace('Z', '+00:00')) if data.get(
                    'updated_at') else None,
                processed_at=datetime.fromisoformat(data['processed_at'].replace('Z', '+00:00')) if data.get(
                    'processed_at') else None,
                error_message=data.get('error_message')
            )

        except Exception as e:
            logger.error(f"Помилка парсинга транзакції з БД: {e}")
            return None

    def _generate_transaction_id(self) -> str:
        """Генерація унікального ID транзакції"""
        import uuid
        return f"tx_{int(datetime.now().timestamp())}_{uuid.uuid4().hex[:8]}"


# Глобальна інстанція моделі
transaction_model = TransactionModel()

# Експорт
__all__ = [
    'Transaction',
    'TransactionAmount',
    'TransactionType',
    'TransactionStatus',
    'CurrencyType',
    'TransactionModel',
    'transaction_model'
]