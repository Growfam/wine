import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional, List
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

# Константи
MAX_USERNAME_LENGTH = 64

# Базові класи
@dataclass
class BaseModel:
    """Базова модель"""
    def __init__(self):
        pass

@dataclass
class UserBalance:
    """Баланс користувача"""
    winix: float = 0.0
    tickets: int = 0
    flex: float = 0.0

    def to_dict(self) -> Dict[str, Any]:
        return {
            "winix": self.winix,
            "tickets": self.tickets,
            "flex": self.flex
        }

    def add_reward(self, reward: 'Reward') -> 'UserBalance':
        return UserBalance(
            winix=self.winix + reward.winix,
            tickets=self.tickets + reward.tickets,
            flex=self.flex + reward.flex
        )

    def can_spend(self, reward: 'Reward') -> bool:
        return (self.winix >= reward.winix and
                self.tickets >= reward.tickets and
                self.flex >= reward.flex)

    def subtract_reward(self, reward: 'Reward') -> 'UserBalance':
        return UserBalance(
            winix=self.winix - reward.winix,
            tickets=self.tickets - reward.tickets,
            flex=self.flex - reward.flex
        )

@dataclass
class Reward:
    """Винагорода"""
    winix: int = 0
    tickets: int = 0
    flex: int = 0

    def is_empty(self) -> bool:
        return self.winix == 0 and self.tickets == 0 and self.flex == 0

    def total_value(self) -> int:
        return self.winix + self.tickets + self.flex

    def to_dict(self) -> Dict[str, Any]:
        return {
            "winix": self.winix,
            "tickets": self.tickets,
            "flex": self.flex
        }

class TaskStatus:
    """Статуси завдань"""
    PENDING = "pending"
    ACTIVE = "active"
    COMPLETED = "completed"
    FAILED = "failed"

def get_current_utc_time() -> datetime:
    """Отримання поточного UTC часу"""
    return datetime.now(timezone.utc)

def validate_telegram_id(telegram_id) -> Optional[int]:
    """Валідація Telegram ID"""
    try:
        tid = int(telegram_id)
        return tid if tid > 0 else None
    except (ValueError, TypeError):
        return None

@dataclass
class UserQuest(BaseModel):
    """Розширена модель користувача для системи завдань"""

    # Основні дані
    telegram_id: int
    username: str = ""
    first_name: str = ""
    last_name: str = ""
    language_code: str = "uk"

    # Баланси
    balance: UserBalance = field(default_factory=UserBalance)

    # Статистика завдань
    total_tasks_completed: int = 0
    total_rewards_claimed: int = 0
    daily_streak: int = 0
    last_daily_claim: Optional[datetime] = None

    # Прогрес
    level: int = 1
    experience: int = 0

    # Налаштування
    notifications_enabled: bool = True
    language_preference: str = "uk"

    # Timestamps
    last_activity: Optional[datetime] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None

    def __post_init__(self):
        """Ініціалізація після створення"""
        super().__init__()

        # Валідація telegram_id
        if not validate_telegram_id(self.telegram_id):
            raise ValueError(f"Невірний telegram_id: {self.telegram_id}")

        # Ініціалізація балансу якщо це dict
        if isinstance(self.balance, dict):
            self.balance = UserBalance(**self.balance)
        elif not isinstance(self.balance, UserBalance):
            self.balance = UserBalance()

        # Обрізання username
        if len(self.username) > MAX_USERNAME_LENGTH:
            self.username = self.username[:MAX_USERNAME_LENGTH]

        # Валідація рівня
        self.level = max(1, self.level)
        self.experience = max(0, self.experience)

        # Встановлення timestamps
        now = get_current_utc_time()
        if not self.created_at:
            self.created_at = now
        if not self.updated_at:
            self.updated_at = now
        if not self.last_activity:
            self.last_activity = now

    def validate(self) -> List[str]:
        """Валідація моделі користувача"""
        errors = []

        # Перевірка telegram_id
        if not validate_telegram_id(self.telegram_id):
            errors.append("Невірний telegram_id")

        # Перевірка username
        if not self.username or len(self.username.strip()) == 0:
            errors.append("Username не може бути пустим")

        if len(self.username) > MAX_USERNAME_LENGTH:
            errors.append(f"Username занадто довгий (максимум {MAX_USERNAME_LENGTH} символів)")

        # Перевірка балансу
        if not isinstance(self.balance, UserBalance):
            errors.append("Невірний тип балансу")

        # Перевірка рівня
        if self.level < 1:
            errors.append("Рівень не може бути менше 1")

        if self.experience < 0:
            errors.append("Досвід не може бути від'ємним")

        return errors

    def add_experience(self, amount: int) -> bool:
        """Додавання досвіду та перевірка підвищення рівня"""
        if amount <= 0:
            return False

        old_level = self.level
        self.experience += amount

        # Розрахунок нового рівня (100 досвіду за рівень + попередній рівень * 50)
        new_level = 1
        total_exp_needed = 0

        while total_exp_needed <= self.experience:
            exp_for_level = 100 + (new_level - 1) * 50
            total_exp_needed += exp_for_level
            if total_exp_needed <= self.experience:
                new_level += 1

        self.level = new_level - 1 if new_level > 1 else 1
        self.update_activity()

        logger.info(f"User {self.telegram_id} gained {amount} XP. Level: {old_level} -> {self.level}")

        return self.level > old_level

    def add_reward(self, reward: Reward, source: str = "unknown") -> bool:
        """Додавання винагороди до балансу"""
        if reward.is_empty():
            return False

        try:
            old_balance = self.balance
            self.balance = self.balance.add_reward(reward)
            self.total_rewards_claimed += reward.total_value()
            self.update_activity()

            logger.info(f"User {self.telegram_id} received reward: {reward.to_dict()} from {source}")
            logger.info(f"Balance updated: {old_balance.to_dict()} -> {self.balance.to_dict()}")

            return True
        except Exception as e:
            logger.error(f"Error adding reward to user {self.telegram_id}: {e}")
            return False

    def can_spend(self, reward: Reward) -> bool:
        """Перевірка можливості витратити кошти"""
        return self.balance.can_spend(reward)

    def spend_reward(self, reward: Reward, reason: str = "unknown") -> bool:
        """Витрачання коштів з балансу"""
        if not self.can_spend(reward):
            logger.warning(f"User {self.telegram_id} cannot spend {reward.to_dict()}: insufficient balance")
            return False

        try:
            old_balance = self.balance
            self.balance = self.balance.subtract_reward(reward)
            self.update_activity()

            logger.info(f"User {self.telegram_id} spent: {reward.to_dict()} for {reason}")
            logger.info(f"Balance updated: {old_balance.to_dict()} -> {self.balance.to_dict()}")

            return True
        except Exception as e:
            logger.error(f"Error spending reward for user {self.telegram_id}: {e}")
            return False

    def complete_task(self, reward: Reward, task_id: str) -> bool:
        """Завершення завдання з нарахуванням винагороди"""
        try:
            # Додаємо винагороду
            if not self.add_reward(reward, f"task_{task_id}"):
                return False

            # Додаємо досвід (10% від WINIX винагороди)
            exp_gained = max(1, reward.winix // 10)
            level_up = self.add_experience(exp_gained)

            # Оновлюємо статистику
            self.total_tasks_completed += 1
            self.update_activity()

            logger.info(f"User {self.telegram_id} completed task {task_id}")
            if level_up:
                logger.info(f"User {self.telegram_id} leveled up to {self.level}!")

            return True
        except Exception as e:
            logger.error(f"Error completing task {task_id} for user {self.telegram_id}: {e}")
            return False

    def update_daily_streak(self) -> bool:
        """Оновлення щоденної серії"""
        now = get_current_utc_time()

        if not self.last_daily_claim:
            # Перший день
            self.daily_streak = 1
            self.last_daily_claim = now
            self.update_activity()
            return True

        # Перевіряємо чи минув день
        time_diff = now - self.last_daily_claim
        days_diff = time_diff.days

        if days_diff == 1:
            # Продовжуємо серію
            self.daily_streak += 1
            self.last_daily_claim = now
            self.update_activity()
            return True
        elif days_diff > 1:
            # Серія перервана
            self.daily_streak = 1
            self.last_daily_claim = now
            self.update_activity()
            return True
        else:
            # Сьогодні вже отримували
            return False

    def can_claim_daily_bonus(self) -> bool:
        """Перевірка можливості отримання щоденного бонусу"""
        if not self.last_daily_claim:
            return True

        now = get_current_utc_time()
        time_diff = now - self.last_daily_claim

        # Можна отримати якщо минуло більше 20 годин
        return time_diff.total_seconds() >= 20 * 3600

    def update_activity(self):
        """Оновлення часу останньої активності"""
        self.last_activity = get_current_utc_time()
        self.updated_at = self.last_activity

    def get_level_progress(self) -> Dict[str, int]:
        """Отримання прогресу рівня"""
        # Розрахунок досвіду для поточного рівня
        total_exp_for_current = 0
        for i in range(1, self.level):
            total_exp_for_current += 100 + (i - 1) * 50

        # Досвід для наступного рівня
        exp_for_next_level = 100 + (self.level - 1) * 50

        # Поточний прогрес
        current_level_exp = self.experience - total_exp_for_current

        return {
            "current_level": self.level,
            "current_exp": current_level_exp,
            "exp_for_next": exp_for_next_level,
            "progress_percent": int((current_level_exp / exp_for_next_level) * 100)
        }

    def get_stats(self) -> Dict[str, Any]:
        """Отримання статистики користувача"""
        return {
            "level": self.level,
            "experience": self.experience,
            "level_progress": self.get_level_progress(),
            "balance": self.balance.to_dict(),
            "tasks_completed": self.total_tasks_completed,
            "rewards_claimed": self.total_rewards_claimed,
            "daily_streak": self.daily_streak,
            "last_activity": self.last_activity.isoformat() if self.last_activity else None,
            "member_since": self.created_at.isoformat() if self.created_at else None
        }

    def to_dict(self) -> Dict[str, Any]:
        """Серіалізація в словник"""
        return {
            "telegram_id": self.telegram_id,
            "username": self.username,
            "first_name": self.first_name,
            "last_name": self.last_name,
            "language_code": self.language_code,
            "balance": self.balance.to_dict(),
            "level": self.level,
            "experience": self.experience,
            "total_tasks_completed": self.total_tasks_completed,
            "total_rewards_claimed": self.total_rewards_claimed,
            "daily_streak": self.daily_streak,
            "last_daily_claim": self.last_daily_claim.isoformat() if self.last_daily_claim else None,
            "notifications_enabled": self.notifications_enabled,
            "language_preference": self.language_preference,
            "last_activity": self.last_activity.isoformat() if self.last_activity else None,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "updated_at": self.updated_at.isoformat() if self.updated_at else None
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'UserQuest':
        """Створення об'єкта з словника"""
        # Парсинг datetime полів
        datetime_fields = ['last_daily_claim', 'last_activity', 'created_at', 'updated_at']
        for field in datetime_fields:
            if data.get(field):
                try:
                    data[field] = datetime.fromisoformat(data[field].replace('Z', '+00:00'))
                except:
                    data[field] = None

        # Парсинг балансу
        if 'balance' in data and isinstance(data['balance'], dict):
            data['balance'] = UserBalance(**data['balance'])

        return cls(**data)

    @classmethod
    def from_supabase_user(cls, supabase_user: Dict[str, Any]) -> 'UserQuest':
        """Створення об'єкта з даних Supabase користувача"""
        try:
            return cls(
                telegram_id=int(supabase_user.get('telegram_id', 0)),
                username=supabase_user.get('username', ''),
                first_name=supabase_user.get('first_name', ''),
                last_name=supabase_user.get('last_name', ''),
                language_code=supabase_user.get('language_code', 'uk'),
                balance=UserBalance(
                    winix=int(supabase_user.get('balance', 0)),
                    tickets=int(supabase_user.get('coins', 0)),  # coins = tickets
                    flex=0  # FLEX баланс рахується окремо
                ),
                total_tasks_completed=int(supabase_user.get('participations_count', 0)),
                daily_streak=0,  # Буде розраховано в daily_bonus
                level=1,  # Початковий рівень
                experience=0  # Початковий досвід
            )
        except Exception as e:
            logger.error(f"Error creating UserQuest from Supabase data: {e}")
            raise ValueError(f"Невірні дані користувача: {e}")


def create_new_user(telegram_id: int, username: str = "", first_name: str = "",
                    last_name: str = "", language_code: str = "uk") -> UserQuest:
    """Створення нового користувача з базовими параметрами"""
    try:
        return UserQuest(
            telegram_id=telegram_id,
            username=username or f"user_{telegram_id}",
            first_name=first_name,
            last_name=last_name,
            language_code=language_code,
            balance=UserBalance(winix=0, tickets=3, flex=0),  # Стартові 3 tickets
            level=1,
            experience=0
        )
    except Exception as e:
        logger.error(f"Error creating new user {telegram_id}: {e}")
        raise