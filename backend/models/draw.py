from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship
from database import db


class Draw(db.Model):
    """
    Модель для зберігання інформації про розіграші.

    Attributes:
        id (int): Унікальний ідентифікатор розіграшу
        name (str): Назва розіграшу
        date (datetime): Дата проведення розіграшу
    """
    __tablename__ = 'draws'

    id = Column(Integer, primary_key=True)
    name = Column(String(100), nullable=False)
    date = Column(DateTime, nullable=False)

    def __init__(self, name, date):
        """
        Ініціалізує новий розіграш

        Args:
            name (str): Назва розіграшу
            date (datetime): Дата проведення розіграшу
        """
        self.name = name
        self.date = date

    def to_dict(self):
        """
        Конвертує об'єкт у словник для відповіді API

        Returns:
            dict: Словник з даними про розіграш
        """
        return {
            'id': self.id,
            'name': self.name,
            'date': self.date.isoformat()
        }


class DrawParticipant(db.Model):
    """
    Модель для зберігання інформації про учасників розіграшів.

    Attributes:
        id (int): Унікальний ідентифікатор запису
        draw_id (int): ID розіграшу
        user_id (int): ID користувача
        is_winner (bool): Чи є користувач переможцем
        prize_amount (int): Сума призу
    """
    __tablename__ = 'draw_participants'

    id = Column(Integer, primary_key=True)
    draw_id = Column(Integer, ForeignKey('draws.id'), nullable=False)
    user_id = Column(Integer, nullable=False)
    is_winner = Column(Boolean, default=False)
    prize_amount = Column(Integer, default=0)

    # Обмеження для унікальності комбінації draw_id та user_id
    __table_args__ = (
        UniqueConstraint('draw_id', 'user_id', name='uq_draw_participant'),
    )

    # Зв'язок з розіграшем
    draw = relationship('Draw', foreign_keys=[draw_id])

    def __init__(self, draw_id, user_id, is_winner=False, prize_amount=0):
        """
        Ініціалізує нового учасника розіграшу

        Args:
            draw_id (int): ID розіграшу
            user_id (int): ID користувача
            is_winner (bool, optional): Чи є користувач переможцем. Defaults to False.
            prize_amount (int, optional): Сума призу. Defaults to 0.
        """
        self.draw_id = draw_id
        self.user_id = user_id
        self.is_winner = is_winner
        self.prize_amount = prize_amount

    def to_dict(self):
        """
        Конвертує об'єкт у словник для відповіді API

        Returns:
            dict: Словник з даними про учасника розіграшу
        """
        return {
            'id': self.id,
            'draw_id': self.draw_id,
            'user_id': self.user_id,
            'is_winner': self.is_winner,
            'prize_amount': self.prize_amount
        }