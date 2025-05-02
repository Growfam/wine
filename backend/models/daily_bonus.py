"""
Модель для щоденних бонусів у системі WINIX.
"""
from datetime import datetime, timedelta, timezone
import uuid
import logging
import random
from typing import Optional, Union, Dict, Any, List, Tuple

# Налаштування логування
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Константи для типів бонусів
BONUS_TYPE_DAILY = "daily"  # Щоденний бонус
BONUS_TYPE_STREAK = "streak"  # Бонус за серію
BONUS_TYPE_SPECIAL = "special"  # Спеціальний бонус
BONUS_TYPE_TOKEN = "token"  # Бонус у вигляді жетону

# Стандартний цикл щоденних бонусів - 30 днів
DEFAULT_CYCLE_DAYS = 30

# Мінімальний проміжок часу між отриманням бонусів у секундах
MIN_CLAIM_INTERVAL_SECONDS = 60  # 1 хвилина для запобігання дублюванню

# Мінімальна сума бонусу
MIN_BONUS_AMOUNT = 5.0

# Винагороди за кожен день циклу (індекс 0 = день 1)
DAILY_BONUS_REWARDS = [
    35, 45, 55, 65, 75, 85, 100, 115, 130, 145,
    165, 185, 205, 230, 255, 285, 315, 345, 375, 405,
    445, 485, 525, 570, 615, 665, 715, 800, 950, 1200
]

# Дні з винагородою у вигляді жетонів (індекс 0 = день 1)
TOKEN_REWARD_DAYS = {
    3: 1,   # День 3: 1 жетон
    7: 1,   # День 7: 1 жетон
    10: 1,  # День 10: 1 жетон
    14: 2,  # День 14: 2 жетони
    17: 1,  # День 17: 1 жетон
    21: 3,  # День 21: 3 жетони
    24: 2,  # День 24: 2 жетони
    28: 3,  # День 28: 3 жетони
    30: 3   # День 30: 3 жетони
}

# Бонус за повне проходження циклу
COMPLETION_BONUS = {
    "amount": 3000,  # Додаткова винагорода
    "tokens": 5,     # Додаткові жетони
    "badge": "Залізна дисципліна"  # Унікальний значок
}


class DailyBonus:
    """
    Клас для управління щоденними бонусами користувачів

    Attributes:
        id (str): Унікальний ідентифікатор запису бонусу
        telegram_id (str): Telegram ID користувача
        bonus_type (str): Тип бонусу
        amount (float): Розмір винагороди
        day_in_cycle (int): День у циклі бонусів (1-30)
        token_amount (int): Кількість отриманих жетонів (якщо є)
        claimed_date (datetime): Дата отримання бонусу
        created_at (datetime): Дата створення запису
    """

    def __init__(
            self,
            telegram_id: str,
            bonus_type: str = BONUS_TYPE_DAILY,
            amount: float = 10.0,
            day_in_cycle: int = 1,
            token_amount: int = 0,
            claimed_date: Optional[datetime] = None,
            id: Optional[str] = None
    ):
        """
        Ініціалізація нового запису щоденного бонусу

        Args:
            telegram_id (str): Telegram ID користувача
            bonus_type (str, optional): Тип бонусу
            amount (float, optional): Розмір винагороди
            day_in_cycle (int, optional): День у циклі бонусів (1-30)
            token_amount (int, optional): Кількість отриманих жетонів
            claimed_date (datetime, optional): Дата отримання бонусу
            id (str, optional): Унікальний ідентифікатор запису
        """
        self.id = id if id else str(uuid.uuid4())
        self.telegram_id = str(telegram_id)
        self.bonus_type = bonus_type
        self.amount = float(amount)
        self.day_in_cycle = int(day_in_cycle)
        self.token_amount = int(token_amount) if token_amount else 0

        # Встановлення дат
        now = datetime.now(timezone.utc)
        self.claimed_date = claimed_date if claimed_date else now

        # Перевірка наявності часового поясу
        if self.claimed_date and not self.claimed_date.tzinfo:
            self.claimed_date = self.claimed_date.replace(tzinfo=timezone.utc)

        self.created_at = now

    def to_dict(self) -> Dict[str, Any]:
        """
        Повертає словникове представлення щоденного бонусу

        Returns:
            dict: Словник з даними бонусу
        """
        return {
            "id": self.id,
            "telegram_id": self.telegram_id,
            "bonus_type": self.bonus_type,
            "amount": self.amount,
            "day_in_cycle": self.day_in_cycle,
            "token_amount": self.token_amount,
            "claimed_date": self.claimed_date.isoformat() if self.claimed_date else None,
            "created_at": self.created_at.isoformat()
        }

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'DailyBonus':
        """
        Створює об'єкт щоденного бонусу зі словника

        Args:
            data (dict): Словник з даними бонусу

        Returns:
            DailyBonus: Об'єкт щоденного бонусу
        """
        if not data:
            raise ValueError("Не вдалося створити бонус з пустих даних")

        bonus = cls(
            telegram_id=data.get("telegram_id", ""),
            bonus_type=data.get("bonus_type", BONUS_TYPE_DAILY),
            amount=data.get("amount", 10.0),
            day_in_cycle=data.get("day_in_cycle", 1),
            token_amount=data.get("token_amount", 0),
            id=data.get("id")
        )

        # Обробка дат
        if "claimed_date" in data and data["claimed_date"]:
            try:
                if isinstance(data["claimed_date"], str):
                    claimed_date = cls.parse_date(data["claimed_date"])
                    bonus.claimed_date = claimed_date
                else:
                    bonus.claimed_date = data["claimed_date"]

                # Перевірка наявності часового поясу
                if bonus.claimed_date and not bonus.claimed_date.tzinfo:
                    bonus.claimed_date = bonus.claimed_date.replace(tzinfo=timezone.utc)
            except Exception as e:
                logger.error(f"Помилка обробки claimed_date: {e}")
                bonus.claimed_date = datetime.now(timezone.utc)

        if "created_at" in data and data["created_at"]:
            try:
                if isinstance(data["created_at"], str):
                    created_at = cls.parse_date(data["created_at"])
                    bonus.created_at = created_at
                else:
                    bonus.created_at = data["created_at"]

                # Перевірка наявності часового поясу
                if bonus.created_at and not bonus.created_at.tzinfo:
                    bonus.created_at = bonus.created_at.replace(tzinfo=timezone.utc)
            except Exception as e:
                logger.error(f"Помилка обробки created_at: {e}")
                bonus.created_at = datetime.now(timezone.utc)

        return bonus

    @staticmethod
    def parse_date(date_string: str) -> datetime:
        """
        Парсить рядок дати у об'єкт datetime з підтримкою різних форматів

        Args:
            date_string (str): Рядок з датою

        Returns:
            datetime: Об'єкт datetime з часовим поясом UTC
        """
        date_formats = [
            # ISO формат з Z
            "%Y-%m-%dT%H:%M:%SZ",
            # ISO формат з мілісекундами та Z
            "%Y-%m-%dT%H:%M:%S.%fZ",
            # ISO формат з явним часовим поясом
            "%Y-%m-%dT%H:%M:%S%z",
            # ISO формат з мілісекундами та явним часовим поясом
            "%Y-%m-%dT%H:%M:%S.%f%z",
            # Простий формат без часу
            "%Y-%m-%d",
            # Формат з часом
            "%Y-%m-%d %H:%M:%S",
            # Формат з часом та мілісекундами
            "%Y-%m-%d %H:%M:%S.%f"
        ]

        # Замінюємо Z на +00:00 для сумісності
        if date_string.endswith('Z'):
            date_string = date_string[:-1] + "+00:00"

        # Спробуємо спочатку використати стандартний метод fromisoformat
        try:
            dt = datetime.fromisoformat(date_string)
            if not dt.tzinfo:
                dt = dt.replace(tzinfo=timezone.utc)
            return dt
        except ValueError:
            pass

        # Пробуємо різні формати
        for fmt in date_formats:
            try:
                dt = datetime.strptime(date_string, fmt)
                if not dt.tzinfo:
                    dt = dt.replace(tzinfo=timezone.utc)
                return dt
            except ValueError:
                continue

        # Якщо жоден формат не підійшов, викидаємо помилку
        raise ValueError(f"Неможливо розпізнати формат дати: {date_string}")

    @staticmethod
    def calculate_daily_bonus_amount(day_in_cycle: int) -> float:
        """
        Розраховує розмір щоденного бонусу залежно від дня циклу

        Args:
            day_in_cycle (int): День у циклі (1-30)

        Returns:
            float: Розмір бонусу
        """
        # Нормалізуємо день у циклі
        day = max(1, min(day_in_cycle, DEFAULT_CYCLE_DAYS))

        # Використовуємо заздалегідь визначену таблицю винагород
        # Індекси в масиві починаються з 0, тому віднімаємо 1 від номера дня
        return float(DAILY_BONUS_REWARDS[day - 1])

    @staticmethod
    def get_token_reward_amount(day_in_cycle: int) -> int:
        """
        Повертає кількість жетонів для вказаного дня циклу

        Args:
            day_in_cycle (int): День у циклі (1-30)

        Returns:
            int: Кількість жетонів або 0, якщо в цей день жетони не видаються
        """
        return TOKEN_REWARD_DAYS.get(day_in_cycle, 0)

    @staticmethod
    def get_next_day_in_cycle(current_day: int) -> int:
        """
        Визначає наступний день у циклі щоденних бонусів

        Args:
            current_day (int): Поточний день циклу

        Returns:
            int: Наступний день циклу
        """
        # Нормалізуємо поточний день
        normalized_day = max(1, min(current_day, DEFAULT_CYCLE_DAYS))

        next_day = normalized_day + 1
        if next_day > DEFAULT_CYCLE_DAYS:
            next_day = 1
        return next_day

    @staticmethod
    def check_streak_reset(last_claimed_date: Optional[datetime]) -> bool:
        """
        Перевіряє, чи треба скинути стрік щоденних бонусів

        Args:
            last_claimed_date (datetime): Дата останнього отримання бонусу

        Returns:
            bool: True, якщо стрік треба скинути, False інакше
        """
        if not last_claimed_date:
            return False

        now = datetime.now(timezone.utc)

        # Перевіряємо, чи last_claimed_date має часовий пояс
        if not last_claimed_date.tzinfo:
            last_claimed_date = last_claimed_date.replace(tzinfo=timezone.utc)

        # Визначаємо різницю в днях
        # Порівнюємо по даті (без часу)
        last_date_day = last_claimed_date.date()
        today = now.date()
        yesterday = (now - timedelta(days=1)).date()

        # Якщо остання дата не вчора і не сьогодні, стрік скидається
        return last_date_day < yesterday

    @staticmethod
    def can_claim_today(last_claimed_date: Optional[datetime]) -> bool:
        """
        Перевіряє, чи можна отримати бонус сьогодні

        Args:
            last_claimed_date (datetime): Дата останнього отримання бонусу

        Returns:
            bool: True, якщо бонус можна отримати, False інакше
        """
        if not last_claimed_date:
            return True

        now = datetime.now(timezone.utc)

        # Перевіряємо, чи last_claimed_date має часовий пояс
        if not last_claimed_date.tzinfo:
            last_claimed_date = last_claimed_date.replace(tzinfo=timezone.utc)

        # Порівнюємо дату (без часу)
        last_date_day = last_claimed_date.date()
        today = now.date()

        # Також перевіряємо мінімальний часовий інтервал для запобігання дублюванню
        time_diff_seconds = (now - last_claimed_date).total_seconds()

        # Якщо остання дата отримання не сьогодні і пройшов мінімальний інтервал
        return (last_date_day < today) and (time_diff_seconds >= MIN_CLAIM_INTERVAL_SECONDS)

    @staticmethod
    def get_cycle_completion_bonus() -> Dict[str, Any]:
        """
        Повертає бонус за повне проходження циклу (30/30 днів)

        Returns:
            Dict[str, Any]: Словник з даними бонусу за проходження
        """
        return COMPLETION_BONUS

    def __str__(self) -> str:
        """
        Повертає рядкове представлення щоденного бонусу

        Returns:
            str: Рядкове представлення щоденного бонусу
        """
        claimed_date_str = self.claimed_date.strftime('%Y-%m-%d %H:%M:%S') if self.claimed_date else "Не отримано"
        return f"DailyBonus(id={self.id}, user={self.telegram_id}, day={self.day_in_cycle}, amount={self.amount}, token_amount={self.token_amount}, claimed={claimed_date_str})"