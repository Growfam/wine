from datetime import datetime
from sqlalchemy import Column, String, Integer, DateTime, UniqueConstraint
from sqlalchemy.orm import relationship
from database import db


class DirectBonus(db.Model):
    """
    Модель для зберігання прямих бонусів за запрошення рефералів.
    """
    __tablename__ = 'direct_bonuses'

    id = Column(Integer, primary_key=True)
    referrer_id = Column(String, nullable=False)  # Змінено на String
    referee_id = Column(String, nullable=False, unique=True)  # Змінено на String
    amount = Column(Integer, default=50)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Обмеження для унікальності referee_id
    __table_args__ = (
        UniqueConstraint('referee_id', name='uq_bonus_referee_id'),
    )

    def __init__(self, referrer_id, referee_id, amount=50):
        self.referrer_id = str(referrer_id)  # Конвертуємо в String
        self.referee_id = str(referee_id)    # Конвертуємо в String
        self.amount = amount

    def to_dict(self):
        return {
            'id': self.id,
            'referrer_id': self.referrer_id,
            'referee_id': self.referee_id,
            'amount': self.amount,
            'created_at': self.created_at.isoformat()
        }