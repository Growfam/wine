from datetime import datetime
from sqlalchemy import Column, Integer, Float, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from database import db


class PercentageReward(db.Model):
    """
    Модель для зберігання відсоткових винагород від активності рефералів.

    Attributes:
        id (int): Унікальний ідентифікатор запису
        user_id (int): ID користувача, який отримує винагороду
        referral_id (int): ID реферала, від активності якого нараховується винагорода
        level (int): Рівень реферала (1 або 2)
        rate (float): Відсоткова ставка (0.1 для 1-го рівня, 0.05 для 2-го рівня)
        base_amount (int): Сума активності реферала, від якої нараховується відсоток
        reward_amount (int): Сума нарахованої винагороди
        created_at (datetime): Дата та час нарахування винагороди
    """
    __tablename__ = 'percentage_rewards'

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, nullable=False)
    referral_id = Column(Integer, nullable=False)
    level = Column(Integer, nullable=False)
    rate = Column(Float, nullable=False)
    base_amount = Column(Integer, nullable=False)
    reward_amount = Column(Integer, nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    def __init__(self, user_id, referral_id, level, rate, base_amount, reward_amount):
        """
        Ініціалізує нову відсоткову винагороду

        Args:
            user_id (int): ID користувача, який отримує винагороду
            referral_id (int): ID реферала, від активності якого нараховується винагорода
            level (int): Рівень реферала (1 або 2)
            rate (float): Відсоткова ставка
            base_amount (int): Сума активності реферала
            reward_amount (int): Сума нарахованої винагороди
        """
        self.user_id = user_id
        self.referral_id = referral_id
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