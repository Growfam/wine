from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from database import db
import logging

# Налаштування логування
logger = logging.getLogger(__name__)

# Додаємо константи типів дій, яких бракувало
ACTION_TYPE_VISIT = 'visit'
ACTION_TYPE_FOLLOW = 'follow'
ACTION_TYPE_SHARE = 'share'
ACTION_TYPE_COMPLETE = 'complete'
ACTION_TYPE_VERIFY = 'verify'


class UserTask(db.Model):
    """
    Модель для зберігання інформації про завдання користувачів.

    Attributes:
        id (int): Унікальний ідентифікатор запису
        user_id (int): ID користувача
        task_type (str): Тип завдання (REFERRAL_COUNT, ACTIVE_REFERRALS)
        progress (int): Прогрес виконання завдання
        threshold (int): Поріг для виконання завдання
        completed (bool): Чи завершено завдання
        claimed (bool): Чи була отримана винагорода за завдання
        reward_amount (int): Сума винагороди за завдання
    """
    __tablename__ = 'user_tasks'

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, nullable=False)
    task_type = Column(String(30), nullable=False)
    progress = Column(Integer, default=0)
    threshold = Column(Integer, nullable=False)
    completed = Column(Boolean, default=False)
    claimed = Column(Boolean, default=False)
    reward_amount = Column(Integer, nullable=False)
    completed_at = Column(DateTime, nullable=True)
    last_updated = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    # Обмеження для унікальності комбінації user_id та task_type
    __table_args__ = (
        UniqueConstraint('user_id', 'task_type', name='uq_user_task'),
    )

    def __init__(self, user_id, task_type, threshold, reward_amount, progress=0):
        """
        Ініціалізує нове завдання користувача

        Args:
            user_id (int): ID користувача
            task_type (str): Тип завдання (REFERRAL_COUNT, ACTIVE_REFERRALS)
            threshold (int): Поріг для виконання завдання
            reward_amount (int): Сума винагороди за завдання
            progress (int, optional): Початковий прогрес. Defaults to 0.
        """
        try:
            self.user_id = user_id
            self.task_type = task_type
            self.threshold = threshold
            self.reward_amount = reward_amount
            self.progress = progress
            self.completed = progress >= threshold
            self.claimed = False

            if self.completed:
                self.completed_at = datetime.utcnow()

            logger.info(f"Створено нове завдання для користувача {user_id} типу {task_type} з порогом {threshold}")
        except Exception as e:
            logger.error(f"Помилка створення завдання для користувача {user_id}: {str(e)}")
            raise

    def to_dict(self):
        """
        Конвертує об'єкт у словник для відповіді API

        Returns:
            dict: Словник з даними про завдання
        """
        try:
            completion_percentage = 0
            if self.threshold > 0:
                completion_percentage = min(100, int((self.progress / self.threshold) * 100))

            return {
                'id': self.id,
                'user_id': self.user_id,
                'task_type': self.task_type,
                'progress': self.progress,
                'threshold': self.threshold,
                'completed': self.completed,
                'claimed': self.claimed,
                'reward_amount': self.reward_amount,
                'completion_percentage': completion_percentage,
                'completed_at': self.completed_at.isoformat() if self.completed_at else None,
                'last_updated': self.last_updated.isoformat() if self.last_updated else None
            }
        except Exception as e:
            logger.error(f"Помилка конвертації завдання {self.id} до словника: {str(e)}")
            # Повертаємо базові поля, щоб не втратити дані повністю
            return {
                'id': self.id,
                'user_id': self.user_id,
                'task_type': self.task_type,
                'progress': self.progress,
                'threshold': self.threshold,
                'completed': self.completed,
                'claimed': self.claimed,
                'reward_amount': self.reward_amount,
                'error': f"Помилка конвертації: {str(e)}"
            }

    def update_progress(self, new_progress):
        """
        Оновлює прогрес виконання завдання

        Args:
            new_progress (int): Новий прогрес

        Returns:
            bool: True, якщо завдання було виконано в результаті оновлення прогресу
        """
        try:
            old_completed = self.completed
            old_progress = self.progress

            # Перевіряємо на валідність нового значення
            if not isinstance(new_progress, (int, float)):
                logger.warning(f"Невалідний тип прогресу для завдання {self.id}: {type(new_progress)}")
                new_progress = int(float(new_progress))

            self.progress = new_progress
            self.completed = self.progress >= self.threshold

            # Якщо завдання щойно виконано, записуємо дату
            if self.completed and not old_completed:
                self.completed_at = datetime.utcnow()
                logger.info(f"Завдання {self.id} для користувача {self.user_id} виконано! "
                            f"Прогрес: {old_progress} -> {new_progress}, поріг: {self.threshold}")
            else:
                logger.debug(f"Прогрес завдання {self.id} оновлено: {old_progress} -> {new_progress}")

            # Оновлюємо дату останнього оновлення
            self.last_updated = datetime.utcnow()

            # Повертаємо True, якщо завдання було щойно виконано
            return self.completed and not old_completed
        except Exception as e:
            logger.error(f"Помилка оновлення прогресу завдання {self.id}: {str(e)}")
            # Не змінюємо статус при помилці
            return False

    def claim_reward(self):
        """
        Отримує винагороду за завдання

        Returns:
            bool: True, якщо винагорода успішно отримана, False в іншому випадку
        """
        try:
            if not self.completed:
                logger.warning(f"Спроба отримати винагороду за незавершене завдання {self.id}")
                return False

            if self.claimed:
                logger.warning(f"Спроба повторно отримати винагороду за завдання {self.id}")
                return False

            self.claimed = True
            self.last_updated = datetime.utcnow()

            logger.info(f"Винагороду в розмірі {self.reward_amount} успішно отримано за завдання {self.id}")
            return True
        except Exception as e:
            logger.error(f"Помилка отримання винагороди за завдання {self.id}: {str(e)}")
            return False

    def reset_progress(self):
        """
        Скидає прогрес завдання у випадку помилки або для повторного виконання

        Returns:
            bool: True, якщо прогрес успішно скинуто
        """
        try:
            self.progress = 0
            self.completed = False
            self.completed_at = None
            self.last_updated = datetime.utcnow()

            logger.info(f"Прогрес завдання {self.id} для користувача {self.user_id} скинуто")
            return True
        except Exception as e:
            logger.error(f"Помилка скидання прогресу завдання {self.id}: {str(e)}")
            return False