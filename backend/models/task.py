from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from database import db

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
        self.user_id = user_id
        self.task_type = task_type
        self.threshold = threshold
        self.reward_amount = reward_amount
        self.progress = progress
        self.completed = progress >= threshold
        self.claimed = False
    
    def to_dict(self):
        """
        Конвертує об'єкт у словник для відповіді API
        
        Returns:
            dict: Словник з даними про завдання
        """
        return {
            'id': self.id,
            'user_id': self.user_id,
            'task_type': self.task_type,
            'progress': self.progress,
            'threshold': self.threshold,
            'completed': self.completed,
            'claimed': self.claimed,
            'reward_amount': self.reward_amount,
            'completion_percentage': min(100, int((self.progress / self.threshold) * 100)) if self.threshold > 0 else 0
        }
    
    def update_progress(self, new_progress):
        """
        Оновлює прогрес виконання завдання
        
        Args:
            new_progress (int): Новий прогрес
            
        Returns:
            bool: True, якщо завдання було виконано в результаті оновлення прогресу
        """
        old_completed = self.completed
        self.progress = new_progress
        self.completed = self.progress >= self.threshold
        
        # Повертаємо True, якщо завдання було щойно виконано
        return self.completed and not old_completed
    
    def claim_reward(self):
        """
        Отримує винагороду за завдання
        
        Returns:
            bool: True, якщо винагорода успішно отримана, False в іншому випадку
        """
        if self.completed and not self.claimed:
            self.claimed = True
            return True
        return False