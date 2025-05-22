from datetime import datetime
from sqlalchemy import Column, Integer, String, Float, DateTime
from sqlalchemy.orm import relationship
from database import db


class PercentageReward(db.Model):
    """
    Модель для зберігання відсоткових винагород від активності рефералів.
    """
    __tablename__ = 'percentage_rewards'

    id = Column(Integer, primary_key=True)
    user_id = Column(String, nullable=False)      # Змінено на String
    referral_id = Column(String, nullable=False)  # Змінено на String
    level = Column(Integer, nullable=False)
    rate = Column(Float, nullable=False)
    base_amount = Column(Integer, nullable=False)
    reward_amount = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    def __init__(self, user_id, referral_id, level, rate, base_amount, reward_amount):
        self.user_id = str(user_id)        # Конвертуємо в String
        self.referral_id = str(referral_id) # Конвертуємо в String
        self.level = level
        self.rate = rate
        self.base_amount = base_amount
        self.reward_amount = reward_amount

    def to_dict(self):
        """
        Конвертує об'єкт у словник для відповіді API

        Returns:
            dict: Словник з даними про відсоткову винагороду
        """
        return {
            'id': self.id,
            'user_id': self.user_id,
            'referral_id': self.referral_id,
            'level': self.level,
            'rate': self.rate,
            'base_amount': self.base_amount,
            'reward_amount': self.reward_amount,
            'created_at': self.created_at.isoformat()
        }