"""
Моделі системи завдань WINIX
Базові класи та утиліти для роботи з базою даних
"""

import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List
from dataclasses import dataclass, asdict
from enum import Enum

logger = logging.getLogger(__name__)


class TaskStatus(Enum):
    """Статуси завдань"""
    AVAILABLE = "available"
    STARTED = "started"
    PENDING = "pending"
    COMPLETED = "completed"
    CLAIMED = "claimed"
    EXPIRED = "expired"


class TaskType(Enum):
    """Типи завдань"""
    SOCIAL = "social"
    LIMITED = "limited"
    PARTNER = "partner"
    DAILY = "daily"


class TransactionType(Enum):
    """Типи транзакцій"""
    REWARD = "reward"
    CLAIM = "claim"
    SPEND = "spend"
    BONUS = "bonus"
    PENALTY = "penalty"


@dataclass
class Reward:
    """Клас для опису винагороди"""
    winix: int = 0
    tickets: int = 0
    flex: int = 0

    def __post_init__(self):
        """Валідація після ініціалізації"""
        self.winix = max(0, int(self.winix))
        self.tickets = max(0, int(self.tickets))
        self.flex = max(0, int(self.flex))

    def total_value(self) -> int:
        """Загальна цінність винагороди в WINIX еквіваленті"""
        return self.winix + (self.tickets * 100) + (self.flex * 10)

    def is_empty(self) -> bool:
        """Перевірка чи винагорода пуста"""
        return self.winix == 0 and self.tickets == 0 and self.flex == 0

    def to_dict(self) -> Dict[str, int]:
        """Конвертація в словник"""
        return asdict(self)


@dataclass
class UserBalance:
    """Клас для опису балансу користувача"""
    winix: int = 0
    tickets: int = 0
    flex: int = 0

    def __post_init__(self):
        """Валідація після ініціалізації"""
        self.winix = max(0, int(self.winix))
        self.tickets = max(0, int(self.tickets))
        self.flex = max(0, int(self.flex))

    def can_spend(self, reward: Reward) -> bool:
        """Перевірка чи можна витратити задану суму"""
        return (self.winix >= reward.winix and
                self.tickets >= reward.tickets and
                self.flex >= reward.flex)

    def add_reward(self, reward: Reward) -> 'UserBalance':
        """Додання винагороди до балансу"""
        return UserBalance(
            winix=self.winix + reward.winix,
            tickets=self.tickets + reward.tickets,
            flex=self.flex + reward.flex
        )

    def subtract_reward(self, reward: Reward) -> 'UserBalance':
        """Віднімання винагороди від балансу"""
        return UserBalance(
            winix=max(0, self.winix - reward.winix),
            tickets=max(0, self.tickets - reward.tickets),
            flex=max(0, self.flex - reward.flex)
        )

    def to_dict(self) -> Dict[str, int]:
        """Конвертація в словник"""
        return asdict(self)


class BaseModel:
    """Базовий клас для всіх моделей"""

    def __init__(self):
        self.created_at = datetime.now(timezone.utc)
        self.updated_at = datetime.now(timezone.utc)

    def update_timestamp(self):
        """Оновлення часу модифікації"""
        self.updated_at = datetime.now(timezone.utc)

    def to_dict(self) -> Dict[str, Any]:
        """Базова серіалізація"""
        result = {}
        for key, value in self.__dict__.items():
            if isinstance(value, datetime):
                result[key] = value.isoformat()
            elif isinstance(value, Enum):
                result[key] = value.value
            elif hasattr(value, 'to_dict'):
                result[key] = value.to_dict()
            else:
                result[key] = value
        return result

    def validate(self) -> List[str]:
        """Валідація моделі - має бути перевизначена в дочірніх класах"""
        return []


def get_current_utc_time() -> datetime:
    """Отримати поточний час в UTC"""
    return datetime.now(timezone.utc)


def format_datetime(dt: datetime) -> str:
    """Форматування datetime для збереження в БД"""
    if dt is None:
        return None
    return dt.isoformat() if dt.tzinfo else dt.replace(tzinfo=timezone.utc).isoformat()


def parse_datetime(dt_str: str) -> Optional[datetime]:
    """Парсинг datetime з рядка"""
    if not dt_str:
        return None
    try:
        # Підтримка різних форматів
        for fmt in [
            "%Y-%m-%dT%H:%M:%S.%fZ",
            "%Y-%m-%dT%H:%M:%SZ",
            "%Y-%m-%dT%H:%M:%S.%f",
            "%Y-%m-%dT%H:%M:%S",
            "%Y-%m-%d %H:%M:%S"
        ]:
            try:
                dt = datetime.strptime(dt_str, fmt)
                if dt.tzinfo is None:
                    dt = dt.replace(tzinfo=timezone.utc)
                return dt
            except ValueError:
                continue

        # Якщо нічого не спрацювало, пробуємо ISO parse
        return datetime.fromisoformat(dt_str.replace('Z', '+00:00'))
    except Exception as e:
        logger.error(f"Помилка парсингу datetime '{dt_str}': {e}")
        return None


def validate_telegram_id(telegram_id: Any) -> Optional[int]:
    """Валідація Telegram ID"""
    try:
        tid = int(telegram_id)
        if tid <= 0:
            return None
        return tid
    except (ValueError, TypeError):
        return None


def generate_unique_id() -> str:
    """Генерація унікального ID"""
    import uuid
    return str(uuid.uuid4())


# Константи для валідації
MAX_USERNAME_LENGTH = 32
MAX_TASK_TITLE_LENGTH = 100
MAX_TASK_DESCRIPTION_LENGTH = 500
MAX_REWARD_AMOUNT = 1000000

# Експорт основних класів
__all__ = [
    'TaskStatus',
    'TaskType',
    'TransactionType',
    'Reward',
    'UserBalance',
    'BaseModel',
    'get_current_utc_time',
    'format_datetime',
    'parse_datetime',
    'validate_telegram_id',
    'generate_unique_id',
    'MAX_USERNAME_LENGTH',
    'MAX_TASK_TITLE_LENGTH',
    'MAX_TASK_DESCRIPTION_LENGTH',
    'MAX_REWARD_AMOUNT'
]