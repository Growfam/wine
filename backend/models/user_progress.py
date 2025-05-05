"""
Модель для відстеження прогресу користувача у виконанні завдань.
"""
from datetime import datetime, timezone
import uuid
import logging

# Налаштування логування
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Константи для статусів прогресу
STATUS_NOT_STARTED = "not_started"  # Завдання не розпочато
STATUS_IN_PROGRESS = "in_progress"  # Завдання в процесі виконання
STATUS_COMPLETED = "completed"  # Завдання виконано
STATUS_FAILED = "failed"  # Завдання провалено
STATUS_EXPIRED = "expired"  # Завдання протерміновано
STATUS_VERIFIED = "verified"  # Завдання підтверджено
STATUS_REJECTED = "rejected"  # Верифікація завдання відхилена


class UserProgress:
    """
    Клас для відстеження прогресу користувача у виконанні завдань.

    Attributes:
        id (str): Унікальний ідентифікатор запису прогресу
        telegram_id (str): Telegram ID користувача
        task_id (str): ID завдання
        status (str): Статус виконання завдання
        progress_value (int): Поточне значення прогресу
        max_progress (int): Максимальне значення прогресу
        start_date (datetime): Дата початку виконання завдання
        completion_date (datetime): Дата завершення виконання завдання
        last_updated (datetime): Дата останнього оновлення прогресу
        verification_data (dict): Дані для верифікації виконання завдання
        reward_claimed (bool): Чи була отримана винагорода
        attempts (int): Кількість спроб виконання завдання
    """

    def __init__(
        self,
        telegram_id,
        task_id,
        status=STATUS_NOT_STARTED,
        progress_value=0,
        max_progress=100,
        start_date=None,
        completion_date=None,
        id=None,
        verification_data=None,
        reward_claimed=False,
        attempts=0
    ):
        """
        Ініціалізація нового запису прогресу.

        Args:
            telegram_id (str): Telegram ID користувача
            task_id (str): ID завдання
            status (str, optional): Статус виконання завдання
            progress_value (int, optional): Поточне значення прогресу
            max_progress (int, optional): Максимальне значення прогресу
            start_date (datetime, optional): Дата початку виконання завдання
            completion_date (datetime, optional): Дата завершення виконання завдання
            id (str, optional): Унікальний ідентифікатор запису прогресу
            verification_data (dict, optional): Дані для верифікації виконання завдання
            reward_claimed (bool, optional): Чи була отримана винагорода
            attempts (int, optional): Кількість спроб виконання завдання
        """
        self.id = id if id else str(uuid.uuid4())
        self.telegram_id = str(telegram_id)
        self.task_id = str(task_id)
        self.status = status
        self.progress_value = progress_value
        self.max_progress = max_progress

        # Встановлення дат з використанням UTC для стандартизації
        now = datetime.now(timezone.utc)
        self.start_date = start_date if start_date else now
        self.completion_date = completion_date
        self.last_updated = now

        # Додаткові поля
        self.verification_data = verification_data if verification_data else {}
        self.reward_claimed = reward_claimed
        self.attempts = attempts

    def to_dict(self):
        """
        Повертає словникове представлення прогресу для зберігання або серіалізації

        Returns:
            dict: Словник з даними прогресу
        """
        return {
            "id": self.id,
            "telegram_id": self.telegram_id,
            "task_id": self.task_id,
            "status": self.status,
            "progress_value": self.progress_value,
            "max_progress": self.max_progress,
            "start_date": self.start_date.isoformat() if self.start_date else None,
            "completion_date": self.completion_date.isoformat() if self.completion_date else None,
            "last_updated": self.last_updated.isoformat(),
            "verification_data": self.verification_data,
            "reward_claimed": self.reward_claimed,
            "attempts": self.attempts,
            "progress_percent": self.get_progress_percent()
        }

    @classmethod
    def from_dict(cls, data):
        """
        Створює об'єкт прогресу з словника

        Args:
            data (dict): Словник з даними прогресу

        Returns:
            UserProgress: Об'єкт прогресу
        """
        progress = cls(
            telegram_id=data.get("telegram_id", ""),
            task_id=data.get("task_id", ""),
            status=data.get("status", STATUS_NOT_STARTED),
            progress_value=data.get("progress_value", 0),
            max_progress=data.get("max_progress", 100),
            id=data.get("id"),
            verification_data=data.get("verification_data", {}),
            reward_claimed=data.get("reward_claimed", False),
            attempts=data.get("attempts", 0)
        )

        # Обробка дат - стандартизоване перетворення ISO 8601 до datetime з UTC
        def parse_date(date_str):
            if not date_str:
                return None

            if isinstance(date_str, str):
                # Додаємо UTC якщо часовий пояс не вказано
                if 'Z' not in date_str and '+' not in date_str and '-' not in date_str[-6:]:
                    date_str += 'Z'
                return datetime.fromisoformat(date_str.replace('Z', '+00:00'))
            return date_str

        # Обробляємо дати
        progress.start_date = parse_date(data.get("start_date"))
        progress.completion_date = parse_date(data.get("completion_date"))
        progress.last_updated = parse_date(data.get("last_updated")) or datetime.now(timezone.utc)

        return progress

    def update_progress(self, value, max_value=None):
        """
        Оновлює значення прогресу та статус

        Args:
            value (int): Нове значення прогресу
            max_value (int, optional): Нове максимальне значення прогресу

        Returns:
            UserProgress: Оновлений об'єкт прогресу
        """
        # Оновлюємо максимальне значення, якщо вказано
        if max_value is not None:
            self.max_progress = max_value

        # Оновлюємо поточне значення
        self.progress_value = min(value, self.max_progress)

        # Оновлюємо статус, якщо прогрес досягнув максимуму
        if self.progress_value >= self.max_progress and self.status == STATUS_IN_PROGRESS:
            self.status = STATUS_COMPLETED
            self.completion_date = datetime.now(timezone.utc)
        # Якщо прогрес розпочато, але ще не завершено
        elif self.progress_value > 0 and self.status == STATUS_NOT_STARTED:
            self.status = STATUS_IN_PROGRESS

        # Оновлюємо дату останнього оновлення
        self.last_updated = datetime.now(timezone.utc)

        return self

    def get_progress_percent(self):
        """
        Повертає відсоток виконання завдання

        Returns:
            float: Відсоток виконання завдання (0-100)
        """
        if self.max_progress <= 0:
            return 0

        percent = (self.progress_value / self.max_progress) * 100
        return round(min(percent, 100), 2)

    def set_status(self, status):
        """
        Встановлює статус виконання завдання

        Args:
            status (str): Новий статус

        Returns:
            UserProgress: Оновлений об'єкт прогресу
        """
        self.status = status

        # Оновлюємо відповідні поля залежно від статусу
        now = datetime.now(timezone.utc)

        if status == STATUS_COMPLETED and not self.completion_date:
            self.completion_date = now
            self.progress_value = self.max_progress
        elif status == STATUS_IN_PROGRESS and self.status != STATUS_IN_PROGRESS:
            if self.progress_value == 0:
                self.progress_value = 1
        elif status == STATUS_VERIFIED:
            if not self.completion_date:
                self.completion_date = now
            self.progress_value = self.max_progress

        # Оновлюємо дату останнього оновлення
        self.last_updated = now

        return self

    def is_completed(self):
        """
        Перевіряє, чи завершено виконання завдання

        Returns:
            bool: True, якщо завдання виконано, False інакше
        """
        return self.status in [STATUS_COMPLETED, STATUS_VERIFIED]

    def increment_attempts(self):
        """
        Збільшує лічильник спроб виконання завдання

        Returns:
            UserProgress: Оновлений об'єкт прогресу
        """
        self.attempts += 1
        self.last_updated = datetime.now(timezone.utc)
        return self

    def claim_reward(self):
        """
        Позначає винагороду як отриману

        Returns:
            UserProgress: Оновлений об'єкт прогресу
        """
        self.reward_claimed = True
        self.last_updated = datetime.now(timezone.utc)
        return self

    def add_verification_data(self, data):
        """
        Додає дані для верифікації виконання завдання

        Args:
            data (dict): Дані для верифікації

        Returns:
            UserProgress: Оновлений об'єкт прогресу
        """
        self.verification_data.update(data)
        self.last_updated = datetime.now(timezone.utc)
        return self

    def __str__(self):
        """
        Повертає рядкове представлення прогресу

        Returns:
            str: Рядкове представлення прогресу
        """
        return f"UserProgress(user={self.telegram_id}, task={self.task_id}, status={self.status}, progress={self.get_progress_percent()}%)"