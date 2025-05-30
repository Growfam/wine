"""
Модель щоденних бонусів для системи завдань WINIX
Управління серіями днів та винагородами з автоматичним скиданням серії
З повною підтримкою Supabase БД
"""

import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional, List
from dataclasses import dataclass, field

logger = logging.getLogger(__name__)

# === БАЗОВІ КЛАСИ ТА ФУНКЦІЇ ===

class BaseModel:
    """Базова модель з timestamp'ами"""
    def __init__(self):
        now = datetime.now(timezone.utc)
        self.created_at = now
        self.updated_at = now

    def update_timestamp(self):
        """Оновити timestamp"""
        self.updated_at = datetime.now(timezone.utc)

@dataclass
class Reward:
    """Модель винагороди"""
    winix: int = 0
    tickets: int = 0

    def is_empty(self) -> bool:
        """Чи пуста винагорода"""
        return self.winix == 0 and self.tickets == 0

    def to_dict(self) -> Dict[str, int]:
        """Конвертація в словник"""
        return {
            "winix": self.winix,
            "tickets": self.tickets
        }

def get_current_utc_time() -> datetime:
    """Отримати поточний UTC час"""
    return datetime.now(timezone.utc)

def parse_datetime(dt_str: str) -> datetime:
    """Парсинг datetime з рядка"""
    if isinstance(dt_str, datetime):
        return dt_str
    if isinstance(dt_str, str):
        try:
            # Спробуємо різні формати
            for fmt in ['%Y-%m-%dT%H:%M:%S.%fZ', '%Y-%m-%dT%H:%M:%S%z', '%Y-%m-%d %H:%M:%S.%f', '%Y-%m-%d']:
                try:
                    return datetime.strptime(dt_str.replace('Z', '+00:00'), fmt)
                except:
                    continue
            # Якщо нічого не підійшло, спробуємо fromisoformat
            return datetime.fromisoformat(dt_str.replace('Z', '+00:00'))
        except:
            return datetime.now(timezone.utc)
    return datetime.now(timezone.utc)

def format_datetime(dt: Optional[datetime]) -> Optional[str]:
    """Форматування datetime в рядок"""
    if dt is None:
        return None
    return dt.isoformat()

def validate_user_id(user_id: str) -> bool:
    """Валідація User ID (тепер це рядок)"""
    return isinstance(user_id, str) and len(user_id) > 0

@dataclass
class DailyBonusEntry:
    """Запис про отримання щоденного бонусу"""

    # Основні дані (обов'язкові поля)
    user_id: str  # Змінено з telegram_id на user_id та з int на str
    day_number: int  # День в серії (1, 2, 3, ...)
    claim_date: datetime
    reward: Reward

    # Метадані (з значеннями за замовчуванням)
    streak_at_claim: int = 0  # Серія на момент отримання
    bonus_multiplier: float = 1.0  # Множник бонусу (multiplier_app в БД)
    is_special_day: bool = False  # Спеціальний день

    # ID з БД
    id: Optional[int] = None

    # Timestamp поля
    created_at: Optional[datetime] = field(default_factory=lambda: datetime.now(timezone.utc))

    def __post_init__(self):
        """Ініціалізація після створення"""
        # Валідація user_id
        if not validate_user_id(self.user_id):
            raise ValueError(f"Невірний user_id: {self.user_id}")

        # Валідація day_number
        if self.day_number < 1 or self.day_number > 30:
            raise ValueError(f"day_number має бути між 1 і 30: {self.day_number}")

        # Валідація дати
        if isinstance(self.claim_date, str):
            self.claim_date = parse_datetime(self.claim_date)

        # Валідація винагороди
        if isinstance(self.reward, dict):
            self.reward = Reward(**self.reward)
        elif not isinstance(self.reward, Reward):
            self.reward = Reward()

    def to_dict(self) -> Dict[str, Any]:
        """Серіалізація в словник для БД"""
        return {
            "user_id": self.user_id,
            "day_number": self.day_number,
            "claim_date": format_datetime(self.claim_date),
            "reward_winix": self.reward.winix,
            "reward_tickets": self.reward.tickets,
            "streak_at_claim": self.streak_at_claim,
            "multiplier_app": self.bonus_multiplier,
            "is_special_day": self.is_special_day,
            "created_at": format_datetime(self.created_at)
        }

    @classmethod
    def from_db_record(cls, record: Dict[str, Any]) -> 'DailyBonusEntry':
        """Створення з запису БД"""
        reward = Reward(
            winix=record.get('reward_winix', 0),
            tickets=record.get('reward_tickets', 0)
        )

        return cls(
            id=record.get('id'),
            user_id=record.get('user_id'),
            day_number=record.get('day_number', 1),
            claim_date=parse_datetime(record.get('claim_date')),
            reward=reward,
            streak_at_claim=record.get('streak_at_claim', 0),
            bonus_multiplier=record.get('multiplier_app', 1.0),
            is_special_day=record.get('is_special_day', False),
            created_at=parse_datetime(record.get('created_at'))
        )

@dataclass
class DailyBonusStatus:
    """Статус щоденних бонусів користувача"""

    # Основні дані (обов'язкове поле)
    user_id: str  # Змінено з telegram_id на user_id та з int на str

    # Всі інші поля з значеннями за замовчуванням
    current_streak: int = 0
    longest_streak: int = 0
    total_days_claimed: int = 0

    # Дати
    last_claim_date: Optional[datetime] = None
    next_available_date: Optional[datetime] = None

    # Поточний статус
    can_claim_today: bool = False
    current_day_number: int = 1
    today_reward: Optional[Reward] = None

    # ID з БД
    id: Optional[int] = None

    # Timestamp поля
    created_at: Optional[datetime] = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: Optional[datetime] = field(default_factory=lambda: datetime.now(timezone.utc))

    # Додаткова статистика (розраховується на льоту)
    total_winix_earned: int = 0
    total_tickets_earned: int = 0

    def __post_init__(self):
        """Ініціалізація після створення"""
        # Валідація user_id
        if not validate_user_id(self.user_id):
            raise ValueError(f"Невірний user_id: {self.user_id}")

        # Парсинг дат
        datetime_fields = ['last_claim_date', 'next_available_date', 'created_at', 'updated_at']
        for field_name in datetime_fields:
            value = getattr(self, field_name)
            if isinstance(value, str):
                setattr(self, field_name, parse_datetime(value))

        # Валідація значень
        self.current_streak = max(0, self.current_streak)
        self.longest_streak = max(0, self.longest_streak)
        self.total_days_claimed = max(0, self.total_days_claimed)

        # Обчислення поточного статусу
        self._update_current_status()

    def _update_current_status(self):
        """Оновлення поточного статусу з новою логікою скидання серії"""
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
                    # Пропустили дні - СКИДАЄМО ВСЮ СЕРІЮ НА 1 ДЕНЬ
                    logger.warning(f"User {self.user_id} пропустив {days_since_last} днів. Скидання серії на день 1")
                    self.can_claim_today = True
                    self.current_day_number = 1
                    self.current_streak = 0  # Скидаємо поточну серію

                # Розрахунок наступної доступної дати
                if self.can_claim_today:
                    self.next_available_date = now + timedelta(days=1)
                else:
                    # Наступний день після останнього отримання + 20 годин
                    next_claim = self.last_claim_date + timedelta(hours=20)
                    if next_claim.date() == now.date():
                        # Завтра
                        self.next_available_date = now.replace(hour=0, minute=0, second=0, microsecond=0) + timedelta(days=1)
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
                # Серія вже повинна бути скинута в _update_current_status
                # Починаємо з дня 1
                self.current_streak = 1
        else:
            # Перший бонус
            self.current_streak = 1

        # Оновлюємо найдовшу серію
        self.longest_streak = max(self.longest_streak, self.current_streak)

        # Оновлюємо статистику
        self.last_claim_date = now
        self.total_days_claimed += 1

        # Створюємо запис про отримання
        entry = DailyBonusEntry(
            user_id=self.user_id,
            day_number=self.current_day_number,
            claim_date=now,
            reward=reward,
            streak_at_claim=self.current_streak,
            bonus_multiplier=1.0,
            is_special_day=False
        )

        # Оновлюємо поточний статус
        self._update_current_status()
        self.update_timestamp()

        logger.info(f"User {self.user_id} claimed day {self.current_day_number} bonus: {reward.to_dict()}")

        return entry

    def get_streak_info(self) -> Dict[str, Any]:
        """Отримання інформації про серію"""
        return {
            "current_streak": self.current_streak,
            "longest_streak": self.longest_streak,
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
        logger.info(f"Resetting streak for user {self.user_id}: {reason}")

        self.current_streak = 0
        self.current_day_number = 1  # Повертаємось на день 1
        self._update_current_status()
        self.update_timestamp()

    def to_dict(self) -> Dict[str, Any]:
        """Серіалізація в словник для API"""
        return {
            "user_id": self.user_id,
            "current_streak": self.current_streak,
            "longest_streak": self.longest_streak,
            "total_days_claimed": self.total_days_claimed,
            "last_claim_date": format_datetime(self.last_claim_date),
            "next_available_date": format_datetime(self.next_available_date),
            "total_winix_earned": self.total_winix_earned,
            "total_tickets_earned": self.total_tickets_earned,
            "can_claim_today": self.can_claim_today,
            "current_day_number": self.current_day_number,
            "today_reward": self.today_reward.to_dict() if self.today_reward else None,
            "created_at": format_datetime(self.created_at),
            "updated_at": format_datetime(self.updated_at)
        }

    def to_db_dict(self) -> Dict[str, Any]:
        """Серіалізація в словник для БД"""
        return {
            "user_id": self.user_id,
            "current_streak": self.current_streak,
            "longest_streak": self.longest_streak,
            "total_days_claimed": self.total_days_claimed,
            "last_claim_date": format_datetime(self.last_claim_date),
            "next_available_date": format_datetime(self.next_available_date),
            "current_day_number": self.current_day_number,
            "updated_at": format_datetime(datetime.now(timezone.utc))
        }

    @classmethod
    def from_db_record(cls, record: Dict[str, Any]) -> 'DailyBonusStatus':
        """Створення з запису БД"""
        return cls(
            id=record.get('id'),
            user_id=record.get('user_id'),
            current_streak=record.get('current_streak', 0),
            longest_streak=record.get('longest_streak', 0),
            total_days_claimed=record.get('total_days_claimed', 0),
            last_claim_date=parse_datetime(record.get('last_claim_date')) if record.get('last_claim_date') else None,
            next_available_date=parse_datetime(record.get('next_available_date')) if record.get('next_available_date') else None,
            current_day_number=record.get('current_day_number', 1),
            created_at=parse_datetime(record.get('created_at')),
            updated_at=parse_datetime(record.get('updated_at'))
        )

    def update_timestamp(self):
        """Оновити timestamp"""
        self.updated_at = datetime.now(timezone.utc)


class DailyBonusManager:
    """Менеджер щоденних бонусів з підтримкою БД"""

    def __init__(self):
        # Кеш статусів
        self._status_cache: Dict[str, DailyBonusStatus] = {}
        self._cache_ttl = 300  # 5 хвилин
        self._last_cache_clear = get_current_utc_time()

    def _clear_old_cache(self):
        """Очищення застарілого кешу"""
        now = get_current_utc_time()
        if (now - self._last_cache_clear).total_seconds() > self._cache_ttl:
            self._status_cache.clear()
            self._last_cache_clear = now

    def get_user_status(self, user_id: str, force_refresh: bool = False) -> DailyBonusStatus:
        """
        Отримання статусу щоденних бонусів користувача

        Args:
            user_id: User ID користувача
            force_refresh: Примусове оновлення з БД

        Returns:
            DailyBonusStatus об'єкт
        """
        self._clear_old_cache()

        if not force_refresh and user_id in self._status_cache:
            cached_status = self._status_cache[user_id]
            # Оновлюємо поточний статус на основі часу
            cached_status._update_current_status()
            return cached_status

        # Завантажуємо з БД
        status = self._load_status_from_db(user_id)

        # Розраховуємо статистику з історії
        self._update_statistics_from_history(status)

        self._status_cache[user_id] = status

        return status

    def _load_status_from_db(self, user_id: str) -> DailyBonusStatus:
        """Завантаження статусу з БД"""
        try:
            from supabase_client import supabase

            # Завантажуємо статус користувача
            response = supabase.table('daily_bonus_status').select('*').eq('user_id', user_id).maybeSingle().execute()

            if response.data:
                # Конвертуємо з запису БД
                return DailyBonusStatus.from_db_record(response.data)
            else:
                # Новий користувач
                logger.info(f"Creating new daily bonus status for user {user_id}")
                return DailyBonusStatus(user_id=user_id)

        except Exception as e:
            logger.error(f"Error loading daily bonus status for {user_id}: {e}")
            return DailyBonusStatus(user_id=user_id)

    def _update_statistics_from_history(self, status: DailyBonusStatus):
        """Оновлення статистики з історії"""
        try:
            from supabase_client import supabase

            # Отримуємо суму винагород з історії
            response = supabase.table('daily_bonus_entries').select(
                'reward_winix',
                'reward_tickets'
            ).eq('user_id', status.user_id).execute()

            if response.data:
                total_winix = sum(entry.get('reward_winix', 0) for entry in response.data)
                total_tickets = sum(entry.get('reward_tickets', 0) for entry in response.data)

                status.total_winix_earned = total_winix
                status.total_tickets_earned = total_tickets

                logger.info(f"Updated statistics for {status.user_id}: winix={total_winix}, tickets={total_tickets}")

        except Exception as e:
            logger.error(f"Error updating statistics from history: {e}")

    def save_status_to_db(self, status: DailyBonusStatus) -> bool:
        """Збереження статусу в БД"""
        try:
            from supabase_client import supabase

            data = status.to_db_dict()

            # Використовуємо upsert для створення або оновлення
            response = supabase.table('daily_bonus_status').upsert(data, on_conflict='user_id').execute()

            logger.info(f"Saved daily bonus status for {status.user_id}")
            return True

        except Exception as e:
            logger.error(f"Error saving daily bonus status: {e}")
            return False

    def save_entry_to_db(self, entry: DailyBonusEntry) -> bool:
        """Збереження запису про отримання в БД"""
        try:
            from supabase_client import supabase

            data = entry.to_dict()

            response = supabase.table('daily_bonus_entries').insert(data).execute()

            logger.info(f"Saved daily bonus entry for {entry.user_id}, day {entry.day_number}")
            return True

        except Exception as e:
            logger.error(f"Error saving daily bonus entry: {e}")
            return False

    def get_user_history(self, user_id: str, limit: int = 30) -> List[DailyBonusEntry]:
        """Отримання історії отримання бонусів"""
        try:
            from supabase_client import supabase

            response = supabase.table('daily_bonus_entries').select('*').eq(
                'user_id', user_id
            ).order('claim_date', desc=True).limit(limit).execute()

            if response.data:
                return [DailyBonusEntry.from_db_record(record) for record in response.data]
            else:
                return []

        except Exception as e:
            logger.error(f"Error loading daily bonus history: {e}")
            return []


# Глобальний менеджер
daily_bonus_manager = DailyBonusManager()


def create_new_daily_status(user_id: str) -> DailyBonusStatus:
    """Створення нового статусу щоденних бонусів"""
    return DailyBonusStatus(user_id=user_id)


def get_daily_bonus_constants() -> Dict[str, Any]:
    """Отримання констант щоденних бонусів"""
    return {
        "MAX_DAYS": 30,
        "MIN_HOURS_BETWEEN_CLAIMS": 20,
        "SPECIAL_DAYS": [],  # Більше немає спеціальних днів
        "BASE_WINIX_REWARD": 100,  # Початкова винагорода
        "TICKETS_DAYS": [],  # Динамічно визначається для кожного користувача
        "PROGRESSIVE_MULTIPLIER": True,
        "STREAK_RESET_POLICY": "RESET_TO_DAY_1"  # Нова політика скидання
    }


# Експорт
__all__ = [
    'DailyBonusEntry',
    'DailyBonusStatus',
    'DailyBonusManager',
    'daily_bonus_manager',
    'create_new_daily_status',
    'get_daily_bonus_constants',
    'Reward'
]