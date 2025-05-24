"""
Модель щоденних бонусів для системи завдань WINIX
Управління серіями днів та винагородами
"""

import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional, List
from dataclasses import dataclass, field

from . import (
    BaseModel, Reward, get_current_utc_time,
    parse_datetime, format_datetime, validate_telegram_id
)

logger = logging.getLogger(__name__)


@dataclass
class DailyBonusEntry(BaseModel):
    """Запис про отримання щоденного бонусу"""

    # Основні дані
    telegram_id: int
    day_number: int  # День в серії (1, 2, 3, ...)
    claim_date: datetime

    # Винагорода
    reward: Reward

    # Метадані
    streak_at_claim: int = 0  # Серія на момент отримання
    bonus_multiplier: float = 1.0  # Множник бонусу
    is_special_day: bool = False  # Спеціальний день (7, 14, 21, 28)

    def __post_init__(self):
        """Ініціалізація після створення"""
        super().__init__()

        # Валідація telegram_id
        if not validate_telegram_id(self.telegram_id):
            raise ValueError(f"Невірний telegram_id: {self.telegram_id}")

        # Валідація day_number
        if self.day_number < 1 or self.day_number > 30:
            raise ValueError(f"day_number має бути між 1 і 30: {self.day_number}")

        # Перевірка чи це спеціальний день
        self.is_special_day = (self.day_number % 7 == 0)

        # Валідація дати
        if isinstance(self.claim_date, str):
            self.claim_date = parse_datetime(self.claim_date)

        if not isinstance(self.claim_date, datetime):
            self.claim_date = get_current_utc_time()

        # Валідація винагороди
        if isinstance(self.reward, dict):
            self.reward = Reward(**self.reward)
        elif not isinstance(self.reward, Reward):
            self.reward = Reward()

    def validate(self) -> List[str]:
        """Валідація запису"""
        errors = []

        if not validate_telegram_id(self.telegram_id):
            errors.append("Невірний telegram_id")

        if self.day_number < 1 or self.day_number > 30:
            errors.append("day_number має бути між 1 і 30")

        if self.reward.is_empty():
            errors.append("Винагорода не може бути пустою")

        if self.streak_at_claim < 0:
            errors.append("streak_at_claim не може бути від'ємним")

        if self.bonus_multiplier <= 0:
            errors.append("bonus_multiplier має бути додатним")

        return errors

    def to_dict(self) -> Dict[str, Any]:
        """Серіалізація в словник"""
        return {
            "telegram_id": self.telegram_id,
            "day_number": self.day_number,
            "claim_date": format_datetime(self.claim_date),
            "reward": self.reward.to_dict(),
            "streak_at_claim": self.streak_at_claim,
            "bonus_multiplier": self.bonus_multiplier,
            "is_special_day": self.is_special_day,
            "created_at": format_datetime(self.created_at),
            "updated_at": format_datetime(self.updated_at)
        }


@dataclass
class DailyBonusStatus(BaseModel):
    """Статус щоденних бонусів користувача"""

    # Основні дані
    telegram_id: int
    current_streak: int = 0
    longest_streak: int = 0
    total_days_claimed: int = 0

    # Дати
    last_claim_date: Optional[datetime] = None
    next_available_date: Optional[datetime] = None
    streak_start_date: Optional[datetime] = None

    # Статистика винагород
    total_winix_earned: int = 0
    total_tickets_earned: int = 0

    # Поточний статус
    can_claim_today: bool = False
    current_day_number: int = 1
    today_reward: Optional[Reward] = None

    def __post_init__(self):
        """Ініціалізація після створення"""
        super().__init__()

        # Валідація telegram_id
        if not validate_telegram_id(self.telegram_id):
            raise ValueError(f"Невірний telegram_id: {self.telegram_id}")

        # Парсинг дат
        datetime_fields = ['last_claim_date', 'next_available_date', 'streak_start_date']
        for field in datetime_fields:
            value = getattr(self, field)
            if isinstance(value, str):
                setattr(self, field, parse_datetime(value))

        # Валідація значень
        self.current_streak = max(0, self.current_streak)
        self.longest_streak = max(0, self.longest_streak)
        self.total_days_claimed = max(0, self.total_days_claimed)
        self.total_winix_earned = max(0, self.total_winix_earned)
        self.total_tickets_earned = max(0, self.total_tickets_earned)

        # Обчислення поточного статусу
        self._update_current_status()

    def _update_current_status(self):
        """Оновлення поточного статусу"""
        now = get_current_utc_time()

        # Визначаємо чи можна отримати бонус сьогодні
        if not self.last_claim_date:
            # Перший раз
            self.can_claim_today = True
            self.current_day_number = 1
            self.next_available_date = now + timedelta(days=1)
        else:
            # Перевіряємо скільки часу минуло
            time_since_last = now - self.last_claim_date
            hours_since_last = time_since_last.total_seconds() / 3600

            if hours_since_last >= 20:  # Мінімум 20 годин між бонусами
                days_since_last = time_since_last.days

                if days_since_last == 0:
                    # Сьогодні вже отримували
                    self.can_claim_today = False
                elif days_since_last == 1:
                    # Вчора отримували - продовжуємо серію
                    self.can_claim_today = True
                    self.current_day_number = self.current_streak + 1
                else:
                    # Пропустили дні - серія перервана
                    self.can_claim_today = True
                    self.current_day_number = 1
                    # Серія буде скинута при отриманні

                # Розрахунок наступної доступної дати
                if self.can_claim_today:
                    self.next_available_date = now + timedelta(days=1)
                else:
                    # Наступний день після останнього отримання + 20 годин
                    next_claim = self.last_claim_date + timedelta(hours=20)
                    if next_claim.date() == now.date():
                        # Завтра
                        self.next_available_date = now.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(
                            days=1)
                    else:
                        self.next_available_date = next_claim
            else:
                # Ще не пройшло 20 годин
                self.can_claim_today = False
                self.next_available_date = self.last_claim_date + timedelta(hours=20)

        # Обмежуємо день до 30
        if self.current_day_number > 30:
            self.current_day_number = 30

    def claim_bonus(self, reward: Reward) -> DailyBonusEntry:
        """
        Отримання щоденного бонусу

        Args:
            reward: Винагорода для нарахування

        Returns:
            DailyBonusEntry запис про отримання
        """
        if not self.can_claim_today:
            raise ValueError("Неможливо отримати бонус сьогодні")

        now = get_current_utc_time()

        # Оновлюємо серію
        if self.last_claim_date:
            time_since_last = now - self.last_claim_date
            days_since_last = time_since_last.days

            if days_since_last == 1:
                # Продовжуємо серію
                self.current_streak += 1
            else:
                # Серія перервана - починаємо заново
                self.current_streak = 1
                self.streak_start_date = now
        else:
            # Перший бонус
            self.current_streak = 1
            self.streak_start_date = now

        # Оновлюємо найдовшу серію
        self.longest_streak = max(self.longest_streak, self.current_streak)

        # Оновлюємо статистику
        self.last_claim_date = now
        self.total_days_claimed += 1
        self.total_winix_earned += reward.winix
        self.total_tickets_earned += reward.tickets

        # Створюємо запис про отримання
        entry = DailyBonusEntry(
            telegram_id=self.telegram_id,
            day_number=self.current_day_number,
            claim_date=now,
            reward=reward,
            streak_at_claim=self.current_streak,
            bonus_multiplier=1.0,
            is_special_day=(self.current_day_number % 7 == 0)
        )

        # Оновлюємо поточний статус
        self._update_current_status()
        self.update_timestamp()

        logger.info(f"User {self.telegram_id} claimed day {self.current_day_number} bonus: {reward.to_dict()}")

        return entry

    def get_streak_info(self) -> Dict[str, Any]:
        """Отримання інформації про серію"""
        return {
            "current_streak": self.current_streak,
            "longest_streak": self.longest_streak,
            "streak_start_date": format_datetime(self.streak_start_date),
            "can_claim_today": self.can_claim_today,
            "current_day_number": self.current_day_number,
            "next_available_date": format_datetime(self.next_available_date)
        }

    def get_statistics(self) -> Dict[str, Any]:
        """Отримання статистики"""
        total_value = self.total_winix_earned + (self.total_tickets_earned * 100)

        return {
            "total_days_claimed": self.total_days_claimed,
            "total_winix_earned": self.total_winix_earned,
            "total_tickets_earned": self.total_tickets_earned,
            "total_value_winix_equivalent": total_value,
            "current_streak": self.current_streak,
            "longest_streak": self.longest_streak,
            "average_daily_winix": self.total_winix_earned // max(1, self.total_days_claimed),
            "completion_rate": f"{(self.total_days_claimed / 30 * 100):.1f}%"
        }

    def reset_streak(self, reason: str = "manual"):
        """Скидання серії"""
        logger.info(f"Resetting streak for user {self.telegram_id}: {reason}")

        self.current_streak = 0
        self.streak_start_date = None
        self._update_current_status()
        self.update_timestamp()

    def to_dict(self) -> Dict[str, Any]:
        """Серіалізація в словник"""
        return {
            "telegram_id": self.telegram_id,
            "current_streak": self.current_streak,
            "longest_streak": self.longest_streak,
            "total_days_claimed": self.total_days_claimed,
            "last_claim_date": format_datetime(self.last_claim_date),
            "next_available_date": format_datetime(self.next_available_date),
            "streak_start_date": format_datetime(self.streak_start_date),
            "total_winix_earned": self.total_winix_earned,
            "total_tickets_earned": self.total_tickets_earned,
            "can_claim_today": self.can_claim_today,
            "current_day_number": self.current_day_number,
            "today_reward": self.today_reward.to_dict() if self.today_reward else None,
            "created_at": format_datetime(self.created_at),
            "updated_at": format_datetime(self.updated_at)
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'DailyBonusStatus':
        """Створення об'єкта з словника"""
        # Парсинг datetime полів
        datetime_fields = ['last_claim_date', 'next_available_date', 'streak_start_date', 'created_at', 'updated_at']
        for field in datetime_fields:
            if data.get(field):
                data[field] = parse_datetime(data[field])

        # Парсинг винагороди
        if data.get('today_reward') and isinstance(data['today_reward'], dict):
            data['today_reward'] = Reward(**data['today_reward'])

        return cls(**data)


class DailyBonusManager:
    """Менеджер щоденних бонусів"""

    def __init__(self):
        # Кеш статусів
        self._status_cache: Dict[int, DailyBonusStatus] = {}
        self._cache_ttl = 300  # 5 хвилин
        self._last_cache_clear = get_current_utc_time()

    def _clear_old_cache(self):
        """Очищення застарілого кешу"""
        now = get_current_utc_time()
        if (now - self._last_cache_clear).total_seconds() > self._cache_ttl:
            self._status_cache.clear()
            self._last_cache_clear = now

    def get_user_status(self, telegram_id: int, force_refresh: bool = False) -> DailyBonusStatus:
        """
        Отримання статусу щоденних бонусів користувача

        Args:
            telegram_id: Telegram ID користувача
            force_refresh: Примусове оновлення з БД

        Returns:
            DailyBonusStatus об'єкт
        """
        self._clear_old_cache()

        if not force_refresh and telegram_id in self._status_cache:
            return self._status_cache[telegram_id]

        # Завантажуємо з БД
        status = self._load_status_from_db(telegram_id)
        self._status_cache[telegram_id] = status

        return status

    def _load_status_from_db(self, telegram_id: int) -> DailyBonusStatus:
        """Завантаження статусу з БД"""
        try:
            # TODO: Реалізувати завантаження з БД
            # Поки що створюємо новий статус
            return DailyBonusStatus(telegram_id=telegram_id)
        except Exception as e:
            logger.error(f"Error loading daily bonus status for {telegram_id}: {e}")
            return DailyBonusStatus(telegram_id=telegram_id)

    def save_status_to_db(self, status: DailyBonusStatus) -> bool:
        """Збереження статусу в БД"""
        try:
            # TODO: Реалізувати збереження в БД
            logger.info(f"Saving daily bonus status for {status.telegram_id}")

            # Оновлюємо кеш
            self._status_cache[status.telegram_id] = status

            return True
        except Exception as e:
            logger.error(f"Error saving daily bonus status for {status.telegram_id}: {e}")
            return False

    def save_entry_to_db(self, entry: DailyBonusEntry) -> bool:
        """Збереження запису про отримання в БД"""
        try:
            # TODO: Реалізувати збереження в БД
            logger.info(f"Saving daily bonus entry for {entry.telegram_id}, day {entry.day_number}")
            return True
        except Exception as e:
            logger.error(f"Error saving daily bonus entry: {e}")
            return False


# Глобальний менеджер
daily_bonus_manager = DailyBonusManager()


def create_new_daily_status(telegram_id: int) -> DailyBonusStatus:
    """Створення нового статусу щоденних бонусів"""
    return DailyBonusStatus(telegram_id=telegram_id)


def get_daily_bonus_constants() -> Dict[str, Any]:
    """Отримання констант щоденних бонусів"""
    return {
        "MAX_DAYS": 30,
        "MIN_HOURS_BETWEEN_CLAIMS": 20,
        "SPECIAL_DAYS": [7, 14, 21, 28],
        "BASE_WINIX_REWARD": 20,
        "TICKETS_DAYS": [7, 14, 21, 28],  # Дні коли дають tickets
        "PROGRESSIVE_MULTIPLIER": True
    }


# Експорт
__all__ = [
    'DailyBonusEntry',
    'DailyBonusStatus',
    'DailyBonusManager',
    'daily_bonus_manager',
    'create_new_daily_status',
    'get_daily_bonus_constants'
]