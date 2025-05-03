"""
Модель для опису завдань в системі WINIX.
Містить структуру даних завдання, типи завдань та методи роботи з ними.
"""
from datetime import datetime
import uuid
import logging

# Налаштування логування
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Константи для типів завдань
TASK_TYPE_SOCIAL = "social"  # Соціальні завдання (підписки тощо)
TASK_TYPE_PARTNER = "partner"  # Партнерські завдання
TASK_TYPE_LIMITED = "limited"  # Обмежені за часом завдання
TASK_TYPE_DAILY = "daily"  # Щоденні завдання
TASK_TYPE_ACHIEVEMENT = "achievement"  # Досягнення

# Константи для типів винагород
REWARD_TYPE_TOKENS = "tokens"  # Токени WINIX
REWARD_TYPE_COINS = "coins"  # Жетони для розіграшів
REWARD_TYPE_BADGE = "badge"  # Бейджі (досягнення)
REWARD_TYPE_NFT = "nft"  # NFT або цифрові предмети

# Константи для статусів завдань
TASK_STATUS_ACTIVE = "active"  # Активне завдання
TASK_STATUS_INACTIVE = "inactive"  # Неактивне завдання
TASK_STATUS_EXPIRED = "expired"  # Завдання, термін виконання якого минув

# Константи для типів дій
ACTION_TYPE_VISIT = "visit"  # Відвідати сайт або ресурс
ACTION_TYPE_FOLLOW = "follow"  # Підписатися на акаунт
ACTION_TYPE_SHARE = "share"  # Поділитися контентом
ACTION_TYPE_LIKE = "like"  # Вподобати контент
ACTION_TYPE_POST = "post"  # Написати пост
ACTION_TYPE_INSTALL = "install"  # Встановити додаток
ACTION_TYPE_SIGNUP = "signup"  # Зареєструватися
ACTION_TYPE_CUSTOM = "custom"  # Кастомна дія

# Константа для реферальних завдань
TASK_TAG_REFERRAL = "referral"  # Тег для реферальних завдань


class Task:
    """
    Клас для представлення завдання в системі WINIX.

    Attributes:
        id (str): Унікальний ідентифікатор завдання
        title (str): Назва завдання
        description (str): Опис завдання
        task_type (str): Тип завдання (social, partner, limited, daily, achievement)
        reward_type (str): Тип винагороди (tokens, coins, badge, nft)
        reward_amount (float): Кількість винагороди
        target_value (int): Цільове значення для виконання завдання
        action_type (str): Тип дії для виконання завдання
        action_url (str): URL для виконання дії (якщо потрібно)
        action_label (str): Підпис для кнопки дії
        status (str): Статус завдання (active, inactive, expired)
        start_date (datetime): Дата початку доступності завдання
        end_date (datetime): Дата завершення доступності завдання
        created_at (datetime): Дата створення завдання
        updated_at (datetime): Дата останнього оновлення завдання
        platforms (list): Список платформ, для яких доступне завдання
        tags (list): Теги для категоризації завдання
        difficulty (int): Складність завдання (1-5)
        repeatable (bool): Чи можна виконувати завдання повторно
        cooldown_hours (int): Кількість годин перед повторним виконанням
        verification_type (str): Спосіб верифікації виконання завдання
    """

    def __init__(
        self,
        title,
        description,
        task_type,
        reward_type,
        reward_amount,
        target_value=1,
        action_type=ACTION_TYPE_CUSTOM,
        action_url=None,
        action_label=None,
        status=TASK_STATUS_ACTIVE,
        id=None,
        start_date=None,
        end_date=None,
        platforms=None,
        tags=None,
        difficulty=1,
        repeatable=False,
        cooldown_hours=24,
        verification_type="manual"
    ):
        """
        Ініціалізація нового завдання.

        Args:
            title (str): Назва завдання
            description (str): Опис завдання
            task_type (str): Тип завдання
            reward_type (str): Тип винагороди
            reward_amount (float): Кількість винагороди
            target_value (int, optional): Цільове значення для виконання завдання
            action_type (str, optional): Тип дії для виконання завдання
            action_url (str, optional): URL для виконання дії
            action_label (str, optional): Підпис для кнопки дії
            status (str, optional): Статус завдання
            id (str, optional): Унікальний ідентифікатор (генерується автоматично, якщо не вказано)
            start_date (datetime, optional): Дата початку доступності
            end_date (datetime, optional): Дата завершення доступності
            platforms (list, optional): Список платформ
            tags (list, optional): Теги для категоризації
            difficulty (int, optional): Складність завдання (1-5)
            repeatable (bool, optional): Чи можна виконувати повторно
            cooldown_hours (int, optional): Кількість годин перед повторним виконанням
            verification_type (str, optional): Спосіб верифікації виконання
        """
        self.id = id if id else str(uuid.uuid4())
        self.title = title
        self.description = description
        self.task_type = task_type
        self.reward_type = reward_type
        self.reward_amount = float(reward_amount)
        self.target_value = int(target_value)
        self.action_type = action_type
        self.action_url = action_url
        self.action_label = action_label
        self.status = status

        # Датові поля
        now = datetime.now()
        self.start_date = start_date if start_date else now
        self.end_date = end_date
        self.created_at = now
        self.updated_at = now

        # Додаткові параметри
        self.platforms = platforms if platforms else []
        self.tags = tags if tags else []
        self.difficulty = min(max(1, difficulty), 5)  # Від 1 до 5
        self.repeatable = repeatable
        self.cooldown_hours = cooldown_hours
        self.verification_type = verification_type

    def to_dict(self):
        """
        Повертає словникове представлення завдання для зберігання або серіалізації

        Returns:
            dict: Словник з даними завдання
        """
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "task_type": self.task_type,
            "reward_type": self.reward_type,
            "reward_amount": self.reward_amount,
            "target_value": self.target_value,
            "action_type": self.action_type,
            "action_url": self.action_url,
            "action_label": self.action_label,
            "status": self.status,
            "start_date": self.start_date.isoformat() if self.start_date else None,
            "end_date": self.end_date.isoformat() if self.end_date else None,
            "created_at": self.created_at.isoformat(),
            "updated_at": self.updated_at.isoformat(),
            "platforms": self.platforms,
            "tags": self.tags,
            "difficulty": self.difficulty,
            "repeatable": self.repeatable,
            "cooldown_hours": self.cooldown_hours,
            "verification_type": self.verification_type
        }

    @classmethod
    def from_dict(cls, data):
        """
        Створює об'єкт завдання з словника

        Args:
            data (dict): Словник з даними завдання

        Returns:
            Task: Об'єкт завдання
        """
        task = cls(
            title=data.get("title", ""),
            description=data.get("description", ""),
            task_type=data.get("task_type", TASK_TYPE_SOCIAL),
            reward_type=data.get("reward_type", REWARD_TYPE_TOKENS),
            reward_amount=data.get("reward_amount", 0),
            target_value=data.get("target_value", 1),
            action_type=data.get("action_type", ACTION_TYPE_CUSTOM),
            action_url=data.get("action_url"),
            action_label=data.get("action_label"),
            status=data.get("status", TASK_STATUS_ACTIVE),
            id=data.get("id"),
            platforms=data.get("platforms", []),
            tags=data.get("tags", []),
            difficulty=data.get("difficulty", 1),
            repeatable=data.get("repeatable", False),
            cooldown_hours=data.get("cooldown_hours", 24),
            verification_type=data.get("verification_type", "manual")
        )

        # Обробка дат
        if "start_date" in data and data["start_date"]:
            if isinstance(data["start_date"], str):
                task.start_date = datetime.fromisoformat(data["start_date"].replace("Z", "+00:00"))
            else:
                task.start_date = data["start_date"]

        if "end_date" in data and data["end_date"]:
            if isinstance(data["end_date"], str):
                task.end_date = datetime.fromisoformat(data["end_date"].replace("Z", "+00:00"))
            else:
                task.end_date = data["end_date"]

        if "created_at" in data and data["created_at"]:
            if isinstance(data["created_at"], str):
                task.created_at = datetime.fromisoformat(data["created_at"].replace("Z", "+00:00"))
            else:
                task.created_at = data["created_at"]

        if "updated_at" in data and data["updated_at"]:
            if isinstance(data["updated_at"], str):
                task.updated_at = datetime.fromisoformat(data["updated_at"].replace("Z", "+00:00"))
            else:
                task.updated_at = data["updated_at"]

        return task

    def is_active(self):
        """
        Перевіряє, чи активне завдання зараз

        Returns:
            bool: True, якщо завдання активне, False інакше
        """
        now = datetime.now()

        # Перевірка статусу
        if self.status != TASK_STATUS_ACTIVE:
            return False

        # Перевірка дати початку
        if self.start_date and now < self.start_date:
            return False

        # Перевірка дати завершення
        if self.end_date and now > self.end_date:
            return False

        return True

    def is_expired(self):
        """
        Перевіряє, чи закінчився термін виконання завдання

        Returns:
            bool: True, якщо термін виконання завдання закінчився, False інакше
        """
        if not self.end_date:
            return False

        return datetime.now() > self.end_date

    def update(self, data):
        """
        Оновлює дані завдання

        Args:
            data (dict): Словник з даними для оновлення

        Returns:
            Task: Оновлений об'єкт завдання
        """
        for key, value in data.items():
            if key in [
                "title", "description", "task_type", "reward_type",
                "reward_amount", "target_value", "action_type",
                "action_url", "action_label", "status", "platforms",
                "tags", "difficulty", "repeatable", "cooldown_hours",
                "verification_type"
            ]:
                setattr(self, key, value)

        # Обробка спеціальних полів
        if "start_date" in data and data["start_date"]:
            if isinstance(data["start_date"], str):
                self.start_date = datetime.fromisoformat(data["start_date"].replace("Z", "+00:00"))
            else:
                self.start_date = data["start_date"]

        if "end_date" in data and data["end_date"]:
            if isinstance(data["end_date"], str):
                self.end_date = datetime.fromisoformat(data["end_date"].replace("Z", "+00:00"))
            else:
                self.end_date = data["end_date"]

        # Оновлюємо час останнього оновлення
        self.updated_at = datetime.now()

        return self

    def __str__(self):
        """
        Повертає рядкове представлення завдання

        Returns:
            str: Рядкове представлення завдання
        """
        return f"Task({self.title}, type={self.task_type}, reward={self.reward_amount} {self.reward_type})"