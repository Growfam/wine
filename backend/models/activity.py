from datetime import datetime
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from main import db


class ReferralActivity(db.Model):
    """
    Модель для зберігання інформації про активність рефералів.

    Attributes:
        id (int): Унікальний ідентифікатор запису
        user_id (int): ID користувача (реферала)
        draws_participation (int): Кількість участі в розіграшах
        invited_referrals (int): Кількість запрошених рефералів
        is_active (bool): Чи активний реферал
        reason_for_activity (str): Причина активності (draws_criteria, invited_criteria, both_criteria, manual_activation)
        last_updated (datetime): Дата та час останнього оновлення статусу
    """
    __tablename__ = 'referral_activities'

    id = Column(Integer, primary_key=True)
    user_id = Column(Integer, nullable=False, unique=True)
    draws_participation = Column(Integer, default=0)
    invited_referrals = Column(Integer, default=0)
    is_active = Column(Boolean, default=False)
    reason_for_activity = Column(String(50), nullable=True)
    last_updated = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __init__(self, user_id, draws_participation=0, invited_referrals=0, is_active=False, reason_for_activity=None):
        """
        Ініціалізує новий запис активності реферала

        Args:
            user_id (int): ID користувача
            draws_participation (int, optional): Кількість участі в розіграшах. Defaults to 0.
            invited_referrals (int, optional): Кількість запрошених рефералів. Defaults to 0.
            is_active (bool, optional): Чи активний реферал. Defaults to False.
            reason_for_activity (str, optional): Причина активності. Defaults to None.
        """
        self.user_id = user_id
        self.draws_participation = draws_participation
        self.invited_referrals = invited_referrals
        self.is_active = is_active
        self.reason_for_activity = reason_for_activity

    def to_dict(self):
        """
        Конвертує об'єкт у словник для відповіді API

        Returns:
            dict: Словник з даними про активність реферала
        """
        return {
            'id': self.id,
            'user_id': self.user_id,
            'draws_participation': self.draws_participation,
            'invited_referrals': self.invited_referrals,
            'is_active': self.is_active,
            'reason_for_activity': self.reason_for_activity,
            'last_updated': self.last_updated.isoformat()
        }

    def check_activity(self, min_draws=3, min_invites=1):
        """
        Перевіряє та оновлює статус активності реферала на основі критеріїв

        Args:
            min_draws (int, optional): Мінімальна кількість розіграшів для активності. Defaults to 3.
            min_invites (int, optional): Мінімальна кількість запрошених для активності. Defaults to 1.

        Returns:
            bool: Результат перевірки - чи активний реферал
        """
        # Перевірка критеріїв активності
        meets_draws_criteria = self.draws_participation >= min_draws
        meets_invited_criteria = self.invited_referrals >= min_invites

        # Якщо реферал вже активний через ручну активацію, зберігаємо цей статус
        if self.is_active and self.reason_for_activity == 'manual_activation':
            return True

        # Визначення нового статусу активності
        new_is_active = meets_draws_criteria or meets_invited_criteria

        # Визначення причини активності
        new_reason = None
        if new_is_active:
            if meets_draws_criteria and meets_invited_criteria:
                new_reason = 'both_criteria'
            elif meets_draws_criteria:
                new_reason = 'draws_criteria'
            elif meets_invited_criteria:
                new_reason = 'invited_criteria'

        # Оновлення даних, якщо змінився статус
        if self.is_active != new_is_active or self.reason_for_activity != new_reason:
            self.is_active = new_is_active
            self.reason_for_activity = new_reason
            self.last_updated = datetime.utcnow()

        return self.is_active

    def activate_manually(self):
        """
        Вручну активує реферала

        Returns:
            bool: True, якщо активація пройшла успішно
        """
        if not self.is_active or self.reason_for_activity != 'manual_activation':
            self.is_active = True
            self.reason_for_activity = 'manual_activation'
            self.last_updated = datetime.utcnow()
            return True
        return False