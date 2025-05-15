from datetime import datetime
from sqlalchemy import Column, Integer, ForeignKey, DateTime, UniqueConstraint
from sqlalchemy.orm import relationship
from main import db


class DirectBonus(db.Model):
    """
    Модель для зберігання прямих бонусів за запрошення рефералів.

    Attributes:
        id (int): Унікальний ідентифікатор запису
        referrer_id (int): ID користувача, який отримує бонус
        referee_id (int): ID запрошеного користувача, за якого нараховується бонус
        amount (int): Сума бонусу в winix
        created_at (datetime): Дата та час нарахування бонусу
    """
    __tablename__ = 'direct_bonuses'

    id = Column(Integer, primary_key=True)
    referrer_id = Column(Integer, nullable=False)
    referee_id = Column(Integer, nullable=False, unique=True)
    amount = Column(Integer, default=50)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Обмеження для унікальності referee_id
    __table_args__ = (
        UniqueConstraint('referee_id', name='uq_bonus_referee_id'),
    )

    def __init__(self, referrer_id, referee_id, amount=50):
        """
        Ініціалізує новий прямий бонус

        Args:
            referrer_id (int): ID користувача, який отримує бонус
            referee_id (int): ID запрошеного користувача
            amount (int, optional): Сума бонусу. Defaults to 50.
        """
        self.referrer_id = referrer_id
        self.referee_id = referee_id
        self.amount = amount

    def to_dict(self):
        """
        Конвертує об'єкт у словник для відповіді API

        Returns:
            dict: Словник з даними про бонус
        """
        return {
            'id': self.id,
            'referrer_id': self.referrer_id,
            'referee_id': self.referee_id,
            'amount': self.amount,
            'created_at': self.created_at.isoformat()
        }