import uuid
from datetime import datetime, timedelta
import logging

# Налаштування логування
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class StakingSession:
    """
    Об'єктно-орієнтована модель сесії стейкінгу
    """

    # Константи для відсотків винагороди стейкінгу
    STAKING_REWARD_RATES = {
        7: 4,  # 4% за 7 днів
        14: 9,  # 9% за 14 днів
        28: 15  # 15% за 28 днів
    }

    def __init__(self, telegram_id, staking_id=None, amount=0, period=14,
                 start_date=None, end_date=None, status="active"):
        """Ініціалізація нової сесії стейкінгу"""
        self.telegram_id = telegram_id
        self.staking_id = staking_id or f"st-{uuid.uuid4().hex[:12]}"
        self.amount = int(amount)
        self.period = period

        # Встановлення дат
        now = datetime.now()
        self.start_date = start_date or now.isoformat()
        if end_date:
            self.end_date = end_date
        else:
            end_date_calc = now + timedelta(days=period)
            self.end_date = end_date_calc.isoformat()

        self.status = status
        self.reward_percent = self._calculate_reward_percent()
        self.expected_reward = self._calculate_expected_reward()
        self.remaining_days = self._calculate_remaining_days()
        self.has_active_staking = status == "active"
        self.creation_timestamp = int(datetime.now().timestamp() * 1000)

    def _calculate_reward_percent(self):
        """Розрахунок відсотка винагороди на основі періоду"""
        return self.STAKING_REWARD_RATES.get(self.period, 9)  # За замовчуванням 9%

    def _calculate_expected_reward(self):
        """Розрахунок очікуваної винагороди на основі суми та відсотка"""
        return round((self.amount * self.reward_percent) / 100, 2)

    def _calculate_remaining_days(self):
        """Розрахунок залишку днів до завершення періоду"""
        try:
            if isinstance(self.end_date, str):
                end_date = datetime.fromisoformat(self.end_date.replace('Z', '+00:00'))
            else:
                end_date = self.end_date

            now = datetime.now()
            return max(0, (end_date - now).days)
        except Exception as e:
            logger.error(f"Помилка розрахунку залишку днів: {str(e)}")
            return self.period

    def update_amount(self, additional_amount):
        """Додавання токенів до суми стейкінгу"""
        self.amount += int(additional_amount)
        self.expected_reward = self._calculate_expected_reward()
        return self

    def mark_cancelled(self, returned_amount=0, fee_amount=0):
        """Позначення стейкінгу як скасованого"""
        self.status = "cancelled"
        self.has_active_staking = False
        self.cancelled_date = datetime.now().isoformat()
        self.returned_amount = returned_amount
        self.fee_amount = fee_amount
        return self

    def mark_completed(self):
        """Позначення стейкінгу як завершеного"""
        self.status = "completed"
        self.has_active_staking = False
        self.completed_date = datetime.now().isoformat()
        return self

    def to_dict(self):
        """Конвертація об'єкта сесії стейкінгу у словник для збереження в базі даних"""
        return {
            "telegram_id": self.telegram_id,
            "staking_id": self.staking_id,
            "amount": self.amount,
            "period": self.period,
            "start_date": self.start_date,
            "end_date": self.end_date,
            "status": self.status,
            "reward_percent": self.reward_percent,
            "expected_reward": self.expected_reward,
            "remaining_days": self.remaining_days,
            "has_active_staking": self.has_active_staking,
            "creation_timestamp": self.creation_timestamp
        }

    @classmethod
    def from_dict(cls, data):
        """Створення об'єкта сесії стейкінгу з словника даних"""
        session = cls(
            telegram_id=data.get("telegram_id"),
            staking_id=data.get("staking_id"),
            amount=data.get("amount", 0),
            period=data.get("period", 14),
            start_date=data.get("start_date"),
            end_date=data.get("end_date"),
            status=data.get("status", "active")
        )

        # Встановлення додаткових атрибутів, якщо вони є в даних
        if "returned_amount" in data:
            session.returned_amount = data["returned_amount"]
        if "fee_amount" in data:
            session.fee_amount = data["fee_amount"]
        if "cancelled_date" in data:
            session.cancelled_date = data["cancelled_date"]
        if "completed_date" in data:
            session.completed_date = data["completed_date"]

        return session