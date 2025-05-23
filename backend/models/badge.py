from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from database import db


class UserBadge(db.Model):
    """
    Модель для зберігання інформації про бейджі користувачів.

    Attributes:
        id (int): Унікальний ідентифікатор запису
        user_id (int): ID користувача
        badge_type (str): Тип бейджа (BRONZE, SILVER, GOLD, PLATINUM)
        earned_at (datetime): Дата та час отримання бейджа
        claimed (bool): Чи була отримана винагорода за бейдж
        reward_amount (int): Сума винагороди за бейдж
    """
    __tablename__ = 'user_badges'

    id = Column(Integer, primary_key=True)
    user_id = Column(String, nullable=False)
    badge_type = Column(String(20), nullable=False)
    earned_at = Column(DateTime, default=datetime.utcnow)
    claimed = Column(Boolean, default=False)
    reward_amount = Column(Integer, nullable=False)

    # Обмеження для унікальності комбінації user_id та badge_type
    __table_args__ = (
        UniqueConstraint('user_id', 'badge_type', name='uq_user_badge'),
    )

    def __init__(self, user_id, badge_type, reward_amount):
        """
        Ініціалізує новий бейдж користувача

        Args:
            user_id (int): ID користувача
            badge_type (str): Тип бейджа (BRONZE, SILVER, GOLD, PLATINUM)
            reward_amount (int): Сума винагороди за бейдж
        """
        self.user_id = user_id
        self.badge_type = badge_type
        self.reward_amount = reward_amount
        self.earned_at = datetime.utcnow()
        self.claimed = False

    def to_dict(self):
        """
        Конвертує об'єкт у словник для відповіді API

        Returns:
            dict: Словник з даними про бейдж
        """
        return {
            'id': self.id,
            'user_id': self.user_id,
            'badge_type': self.badge_type,
            'earned_at': self.earned_at.isoformat(),
            'claimed': self.claimed,
            'reward_amount': self.reward_amount
        }

    def claim_reward(self):
        """
        Отримує винагороду за бейдж

        Returns:
            bool: True, якщо винагорода успішно отримана, False, якщо вже була отримана
        """
        if not self.claimed:
            self.claimed = True
            return True
        return False