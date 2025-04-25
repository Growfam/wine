"""
Модель для щоденних бонусів у системі WINIX.
"""
from datetime import datetime, timedelta
import uuid
import logging

# Налаштування логування
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Константи для типів бонусів
BONUS_TYPE_DAILY = "daily"  # Щоденний бонус
BONUS_TYPE_STREAK = "streak"  # Бонус за серію
BONUS_TYPE_SPECIAL = "special"  # Спеціальний бонус

# Стандартний цикл щоденних бонусів - 7 днів
DEFAULT_CYCLE_DAYS = 7


class DailyBonus:
    """
    Клас для управління щоденними бонусами користувачів

    Attributes:
        id (str): Унікальний ідентифікатор запису бонусу
        telegram_id (str): Telegram ID користувача
        bonus_type (str): Тип бонусу
        amount (float): Розмір винагороди
        day_in_cycle (int): День у циклі бонусів (1-7)
        claimed_date (datetime): Дата отримання бонусу
        created_at (datetime): Дата створення запису
    """

    def __init__(
            self,
            telegram_id,
            bonus_type=BONUS_TYPE_DAILY,
            amount=10.0,
            day_in_cycle=1,
            claimed_date=None,
            id=None
    ):
        """
        Ініціалізація нового запису щоденного бонусу

        Args:
            telegram_id (str): Telegram ID користувача
            bonus_type (str, optional): Тип бонусу
            amount (float, optional): Розмір винагороди
            day_in_cycle (int, optional): День у циклі бонусів (1-7)
            claimed_date (datetime, optional): Дата отримання бонусу
            id (str, optional): Унікальний ідентифікатор запису
        """
        self.id = id if id else str(uuid.uuid4())
        self.telegram_id = str(telegram_id)
        self.bonus_type = bonus_type
        self.amount = float(amount)
        self.day_in_cycle = int(day_in_cycle)

        # Встановлення дат
        now = datetime.now()
        self.claimed_date = claimed_date if claimed_date else now
        self.created_at = now

    def to_dict(self):
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
            "claimed_date": self.claimed_date.isoformat() if self.claimed_date else None,
            "created_at": self.created_at.isoformat()
        }

    @classmethod
    def from_dict(cls, data):
        """
        Створює об'єкт щоденного бонусу зі словника

        Args:
            data (dict): Словник з даними бонусу

        Returns:
            DailyBonus: Об'єкт щоденного бонусу
        """
        bonus = cls(
            telegram_id=data.get("telegram_id", ""),
            bonus_type=data.get("bonus_type", BONUS_TYPE_DAILY),
            amount=data.get("amount", 10.0),
            day_in_cycle=data.get("day_in_cycle", 1),
            id=data.get("id")
        )

        # Обробка дат
        if "claimed_date" in data and data["claimed_date"]:
            if isinstance(data["claimed_date"], str):
                bonus.claimed_date = datetime.fromisoformat(data["claimed_date"].replace("Z", "+00:00"))
            else:
                bonus.claimed_date = data["claimed_date"]

        if "created_at" in data and data["created_at"]:
            if isinstance(data["created_at"], str):
                bonus.created_at = datetime.fromisoformat(data["created_at"].replace("Z", "+00:00"))
            else:
                bonus.created_at = data["created_at"]

        return bonus

    @staticmethod
    def calculate_daily_bonus_amount(day_in_cycle):
        """
        Розраховує розмір щоденного бонусу залежно від дня циклу

        Args:
            day_in_cycle (int): День у циклі (1-7)

        Returns:
            float: Розмір бонусу
        """
        # Базова формула: день * 10
        base_bonus = day_in_cycle * 10.0

        # Додатковий бонус для останнього дня циклу
        if day_in_cycle == DEFAULT_CYCLE_DAYS:
            base_bonus += 20.0  # Додатковий бонус за завершення циклу

        return base_bonus

    @staticmethod
    def get_next_day_in_cycle(current_day):
        """
        Визначає наступний день у циклі щоденних бонусів

        Args:
            current_day (int): Поточний день циклу

        Returns:
            int: Наступний день циклу
        """
        next_day = current_day + 1
        if next_day > DEFAULT_CYCLE_DAYS:
            next_day = 1
        return next_day

    @staticmethod
    def check_streak_reset(last_claimed_date):
        """
        Перевіряє, чи треба скинути стрік щоденних бонусів

        Args:
            last_claimed_date (datetime): Дата останнього отримання бонусу

        Returns:
            bool: True, якщо стрік треба скинути, False інакше
        """
        if not last_claimed_date:
            return False

        now = datetime.now()

        # Визначаємо різницю в днях
        delta = now - last_claimed_date

        # Якщо пропущено більше одного дня, стрік скидається
        return delta.days > 1

    @staticmethod
    def can_claim_today(last_claimed_date):
        """
        Перевіряє, чи можна отримати бонус сьогодні

        Args:
            last_claimed_date (datetime): Дата останнього отримання бонусу

        Returns:
            bool: True, якщо бонус можна отримати, False інакше
        """
        if not last_claimed_date:
            return True

        now = datetime.now()

        # Порівнюємо дату (без часу)
        last_date_day = last_claimed_date.date()
        today = now.date()

        # Бонус можна отримати, якщо остання дата отримання не сьогодні
        return last_date_day < today

    def __str__(self):
        """
        Повертає рядкове представлення щоденного бонусу

        Returns:
            str: Рядкове представлення щоденного бонусу
        """
        return f"DailyBonus(user={self.telegram_id}, day={self.day_in_cycle}, amount={self.amount}, claimed={self.claimed_date.strftime('%Y-%m-%d')})"