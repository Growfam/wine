from datetime import datetime
from sqlalchemy import Column, Integer, String, ForeignKey, DateTime, UniqueConstraint
from sqlalchemy.orm import relationship
from database import db

# Додаємо відсутні константи
REWARD_STATUS_PENDING = 'pending'
REWARD_STATUS_PAID = 'paid'


class Referral(db.Model):
    """
    Модель для зберігання реферальних зв'язків між користувачами.

    Attributes:
        id (int): Унікальний ідентифікатор запису
        referrer_id (int): ID користувача, який запросив (реферер)
        referee_id (int): ID користувача, якого запросили (реферал)
        level (int): Рівень реферала (1 - прямий реферал, 2 - реферал другого рівня)
        created_at (datetime): Дата та час створення запису
    """
    __tablename__ = 'referrals'

    id = Column(Integer, primary_key=True)
    referrer_id = Column(String, nullable=False)
    referee_id = Column(String, nullable=False)
    level = Column(Integer, default=1)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Змінено обмеження: тепер унікальною має бути комбінація referee_id, level і referrer_id
    # Це дозволяє одному користувачу бути рефералом 1-го рівня для одного користувача
    # і рефералом 2-го рівня для іншого
    __table_args__ = (
        UniqueConstraint('referee_id', 'level', 'referrer_id', name='uq_referee_level_referrer'),
    )

    def __init__(self, referrer_id, referee_id, level=1):
        """
        Ініціалізує новий реферальний зв'язок

        Args:
            referrer_id (int): ID користувача-реферера
            referee_id (int): ID користувача-реферала
            level (int, optional): Рівень реферала. Defaults to 1.
        """
        self.referrer_id = str(referrer_id)
        self.referee_id = str(referee_id)
        self.level = level

    def to_dict(self):
        """
        Конвертує об'єкт у словник для відповіді API

        Returns:
            dict: Словник з даними реферального зв'язку
        """
        return {
            'id': self.id,
            'referrer_id': self.referrer_id,
            'referee_id': self.referee_id,
            'level': self.level,
            'created_at': self.created_at.isoformat()
        }