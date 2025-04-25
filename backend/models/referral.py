"""
Модель для реферальної системи в WINIX.
"""
from datetime import datetime
import uuid
import logging

# Налаштування логування
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Константи для статусів реферальних винагород
REWARD_STATUS_PENDING = "pending"  # Винагорода очікує зарахування
REWARD_STATUS_PAID = "paid"  # Винагорода зарахована
REWARD_STATUS_FAILED = "failed"  # Винагорода не зарахована
REWARD_STATUS_CANCELLED = "cancelled"  # Винагорода скасована

# Константи для рівнів реферальної програми
REFERRAL_LEVEL_1 = 1  # Перший рівень (безпосередні реферали)
REFERRAL_LEVEL_2 = 2  # Другий рівень (реферали рефералів)


class Referral:
    """
    Клас для управління реферальною системою

    Attributes:
        id (str): Унікальний ідентифікатор реферального запису
        referrer_id (str): Telegram ID користувача, який запросив
        referee_id (str): Telegram ID запрошеного користувача
        status (str): Статус реферальної винагороди
        reward_amount (float): Сума винагороди за реферала
        level (int): Рівень реферальної програми
        created_at (datetime): Дата створення запису
        completed_at (datetime): Дата виконання умов реферальної програми
        reward_paid_at (datetime): Дата виплати винагороди
    """

    def __init__(
            self,
            referrer_id,
            referee_id,
            status=REWARD_STATUS_PENDING,
            reward_amount=50.0,
            level=REFERRAL_LEVEL_1,
            id=None,
            completed_at=None,
            reward_paid_at=None
    ):
        """
        Ініціалізація нового реферального запису

        Args:
            referrer_id (str): Telegram ID користувача, який запросив
            referee_id (str): Telegram ID запрошеного користувача
            status (str, optional): Статус реферальної винагороди
            reward_amount (float, optional): Сума винагороди за реферала
            level (int, optional): Рівень реферальної програми
            id (str, optional): Унікальний ідентифікатор запису
            completed_at (datetime, optional): Дата виконання умов реферальної програми
            reward_paid_at (datetime, optional): Дата виплати винагороди
        """
        self.id = id if id else str(uuid.uuid4())
        self.referrer_id = str(referrer_id)
        self.referee_id = str(referee_id)
        self.status = status
        self.reward_amount = float(reward_amount)
        self.level = int(level)

        # Встановлення дат
        now = datetime.now()
        self.created_at = now
        self.completed_at = completed_at
        self.reward_paid_at = reward_paid_at

    def to_dict(self):
        """
        Повертає словникове представлення реферального запису

        Returns:
            dict: Словник з даними реферального запису
        """
        return {
            "id": self.id,
            "referrer_id": self.referrer_id,
            "referee_id": self.referee_id,
            "status": self.status,
            "reward_amount": self.reward_amount,
            "level": self.level,
            "created_at": self.created_at.isoformat(),
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
            "reward_paid_at": self.reward_paid_at.isoformat() if self.reward_paid_at else None
        }

    @classmethod
    def from_dict(cls, data):
        """
        Створює об'єкт реферального запису зі словника

        Args:
            data (dict): Словник з даними реферального запису

        Returns:
            Referral: Об'єкт реферального запису
        """
        referral = cls(
            referrer_id=data.get("referrer_id", ""),
            referee_id=data.get("referee_id", ""),
            status=data.get("status", REWARD_STATUS_PENDING),
            reward_amount=data.get("reward_amount", 50.0),
            level=data.get("level", REFERRAL_LEVEL_1),
            id=data.get("id"),
        )

        # Обробка дат
        if "created_at" in data and data["created_at"]:
            if isinstance(data["created_at"], str):
                referral.created_at = datetime.fromisoformat(data["created_at"].replace("Z", "+00:00"))
            else:
                referral.created_at = data["created_at"]

        if "completed_at" in data and data["completed_at"]:
            if isinstance(data["completed_at"], str):
                referral.completed_at = datetime.fromisoformat(data["completed_at"].replace("Z", "+00:00"))
            else:
                referral.completed_at = data["completed_at"]

        if "reward_paid_at" in data and data["reward_paid_at"]:
            if isinstance(data["reward_paid_at"], str):
                referral.reward_paid_at = datetime.fromisoformat(data["reward_paid_at"].replace("Z", "+00:00"))
            else:
                referral.reward_paid_at = data["reward_paid_at"]

        return referral

    def mark_as_completed(self):
        """
        Позначає реферальний запис як такий, де умови виконано

        Returns:
            Referral: Оновлений об'єкт реферального запису
        """
        if not self.completed_at:
            self.completed_at = datetime.now()
        return self

    def pay_reward(self):
        """
        Позначає реферальну винагороду як виплачену

        Returns:
            Referral: Оновлений об'єкт реферального запису
        """
        self.status = REWARD_STATUS_PAID
        self.reward_paid_at = datetime.now()
        return self

    def is_paid(self):
        """
        Перевіряє, чи виплачено винагороду за реферала

        Returns:
            bool: True, якщо винагороду виплачено, False інакше
        """
        return self.status == REWARD_STATUS_PAID and self.reward_paid_at is not None

    def cancel(self):
        """
        Скасовує реферальну винагороду

        Returns:
            Referral: Оновлений об'єкт реферального запису
        """
        self.status = REWARD_STATUS_CANCELLED
        return self

    def mark_as_failed(self):
        """
        Позначає реферальну винагороду як таку, що не може бути виплачена

        Returns:
            Referral: Оновлений об'єкт реферального запису
        """
        self.status = REWARD_STATUS_FAILED
        return self

    def __str__(self):
        """
        Повертає рядкове представлення реферального запису

        Returns:
            str: Рядкове представлення реферального запису
        """
        return f"Referral(referrer={self.referrer_id}, referee={self.referee_id}, status={self.status}, reward={self.reward_amount})"