from datetime import datetime
from sqlalchemy import Column, Integer, ForeignKey, DateTime, UniqueConstraint, String
from sqlalchemy.orm import relationship
from database import db


class DirectBonus(db.Model):
    """
    Модель для зберігання прямих бонусів за запрошення рефералів.

    Attributes:
        id (int): Унікальний ідентифікатор запису
        referrer_id (str): ID користувача, який отримує бонус
        referee_id (str): ID запрошеного користувача, за якого нараховується бонус
        amount (int): Сума бонусу в winix
        created_at (datetime): Дата та час нарахування бонусу
    """
    __tablename__ = 'direct_bonuses'

    id = Column(Integer, primary_key=True)
    referrer_id = Column(String(100), nullable=False)
    referee_id = Column(String(100), nullable=False, unique=True)
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
            referrer_id (str): ID користувача, який отримує бонус
            referee_id (str): ID запрошеного користувача
            amount (int, optional): Сума бонусу. Defaults to 50.
        """
        # Перетворюємо ID в рядки для уникнення проблем з типами
        self.referrer_id = str(referrer_id)
        self.referee_id = str(referee_id)
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