"""
Модель стейкінг-сесії для зберігання та управління даними стейкінгу.
"""
import uuid
from datetime import datetime, timedelta
import logging

# Налаштування логування
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class StakingSession:
    """
    Об'єктно-орієнтована модель сесії стейкінгу.
    Зберігає дані про тривалість, суму та винагороду за стейкінг.
    """

    # Константи для відсотків винагороди стейкінгу
    STAKING_REWARD_RATES = {
        7: 4,  # 4% за 7 днів
        14: 9,  # 9% за 14 днів
        28: 15  # 15% за 28 днів
    }

    # Сталі для валідацій
    MIN_STAKING_AMOUNT = 50  # Мінімальна сума стейкінгу
    MAX_STAKING_PERCENTAGE = 0.9  # Максимальний відсоток від балансу для стейкінгу
    CANCELLATION_FEE = 0.2  # Комісія за дострокове скасування (20%)

    def __init__(self, telegram_id, staking_id=None, amount=0, period=14,
                 start_date=None, end_date=None, status="active"):
        """
        Ініціалізація нової сесії стейкінгу.

        Args:
            telegram_id (str): ID користувача Telegram
            staking_id (str, optional): Унікальний ID стейкінгу. Якщо не вказано, генерується автоматично.
            amount (int): Сума токенів для стейкінгу
            period (int): Період стейкінгу в днях (7, 14, 28)
            start_date (str, optional): Дата початку стейкінгу у форматі ISO
            end_date (str, optional): Дата закінчення стейкінгу у форматі ISO
            status (str): Статус стейкінгу ('active', 'completed', 'cancelled')
        """
        self.telegram_id = str(telegram_id)
        self.staking_id = staking_id or f"stk_{uuid.uuid4().hex[:12]}"
        self.amount = int(amount)
        self.period = int(period)

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
        """Розрахунок відсотка винагороди на основі періоду."""
        return self.STAKING_REWARD_RATES.get(self.period, 9)  # За замовчуванням 9%

    def _calculate_expected_reward(self):
        """Розрахунок очікуваної винагороди на основі суми та відсотка."""
        return round((self.amount * self.reward_percent) / 100, 2)

    def _calculate_remaining_days(self):
        """Розрахунок залишку днів до завершення періоду."""
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
        """
        Додавання токенів до суми стейкінгу.

        Args:
            additional_amount (int): Кількість токенів для додавання

        Returns:
            StakingSession: Оновлений об'єкт сесії
        """
        self.amount += int(additional_amount)
        self.expected_reward = self._calculate_expected_reward()
        return self

    def mark_cancelled(self, returned_amount=0, fee_amount=0):
        """
        Позначення стейкінгу як скасованого.

        Args:
            returned_amount (float): Сума, повернена користувачу
            fee_amount (float): Сума комісії за скасування

        Returns:
            StakingSession: Оновлений об'єкт сесії
        """
        self.status = "cancelled"
        self.has_active_staking = False
        self.cancelled_date = datetime.now().isoformat()
        self.returned_amount = returned_amount
        self.fee_amount = fee_amount
        return self

    def mark_completed(self):
        """
        Позначення стейкінгу як завершеного.

        Returns:
            StakingSession: Оновлений об'єкт сесії
        """
        self.status = "completed"
        self.has_active_staking = False
        self.completed_date = datetime.now().isoformat()
        return self

    def to_dict(self):
        """
        Конвертація об'єкта сесії стейкінгу у словник для збереження в базі даних.

        Returns:
            dict: Дані стейкінгу в форматі словника
        """
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

    def to_client_dict(self):
        """
        Конвертація об'єкта сесії стейкінгу у словник для клієнтської частини.
        Забезпечує консистентні назви полів.

        Returns:
            dict: Дані стейкінгу в форматі для клієнта
        """
        return {
            "stakingId": self.staking_id,
            "stakingAmount": self.amount,
            "period": self.period,
            "startDate": self.start_date,
            "endDate": self.end_date,
            "status": self.status,
            "rewardPercent": self.reward_percent,
            "expectedReward": self.expected_reward,
            "remainingDays": self.remaining_days,
            "hasActiveStaking": self.has_active_staking,
            "creationTimestamp": self.creation_timestamp
        }

    @classmethod
    def from_dict(cls, data):
        """
        Створення об'єкта сесії стейкінгу з словника даних.

        Args:
            data (dict): Дані стейкінгу

        Returns:
            StakingSession: Об'єкт сесії стейкінгу
        """
        # Обробка різних форматів ключів для сумісності
        telegram_id = data.get("telegram_id") or data.get("user_id")
        staking_id = data.get("staking_id") or data.get("stakingId")
        amount = data.get("amount") or data.get("stakingAmount", 0)
        period = data.get("period", 14)
        start_date = data.get("start_date") or data.get("startDate")
        end_date = data.get("end_date") or data.get("endDate")
        status = data.get("status", "active")

        session = cls(
            telegram_id=telegram_id,
            staking_id=staking_id,
            amount=amount,
            period=period,
            start_date=start_date,
            end_date=end_date,
            status=status
        )

        # Встановлення додаткових атрибутів, якщо вони є в даних
        if "returned_amount" in data or "returnedAmount" in data:
            session.returned_amount = data.get("returned_amount") or data.get("returnedAmount")
        if "fee_amount" in data or "feeAmount" in data:
            session.fee_amount = data.get("fee_amount") or data.get("feeAmount")
        if "cancelled_date" in data or "cancelledDate" in data:
            session.cancelled_date = data.get("cancelled_date") or data.get("cancelledDate")
        if "completed_date" in data or "completedDate" in data:
            session.completed_date = data.get("completed_date") or data.get("completedDate")

        return session

    @staticmethod
    def validate_staking_amount(current_balance, amount):
        """
        Валідація суми стейкінгу з усіма необхідними перевірками.

        Args:
            current_balance (float): Поточний баланс користувача
            amount (float): Сума для стейкінгу

        Returns:
            tuple: (success: bool, message: str)
        """
        try:
            # Перетворимо на float і переконаємось, що це число
            try:
                amount = float(amount)
            except (ValueError, TypeError):
                return (False, 'Некоректна сума стейкінгу')

            # Перевірка на позитивне число
            if amount <= 0:
                return (False, 'Сума стейкінгу має бути більше нуля')

            # Перевірка на ціле число
            if amount != int(amount):
                return (False, 'Сума стейкінгу має бути цілим числом')

            amount = int(amount)  # Переконаємось, що використовуємо int

            # Отримуємо поточний баланс і конвертуємо в int
            current_balance = int(float(current_balance))

            # Перевірка на мінімальну суму
            if amount < StakingSession.MIN_STAKING_AMOUNT:
                return (False, f'Мінімальна сума стейкінгу: {StakingSession.MIN_STAKING_AMOUNT} WINIX')

            # Перевірка на максимально дозволений відсоток від балансу
            max_allowed_amount = int(current_balance * StakingSession.MAX_STAKING_PERCENTAGE)
            if amount > max_allowed_amount:
                return (
                    False,
                    f'Максимальна сума: {max_allowed_amount} WINIX ({int(StakingSession.MAX_STAKING_PERCENTAGE * 100)}% від балансу)')

            # Перевірка на достатність коштів
            if amount > current_balance:
                return (False, f'Недостатньо коштів. Ваш баланс: {current_balance} WINIX')

            return (True, '')
        except Exception as e:
            logger.error(f"Помилка валідації суми стейкінгу: {str(e)}")
            return (False, 'Помилка валідації суми стейкінгу')

    @staticmethod
    def calculate_cancellation_returns(staking_amount):
        """
        Розраховує суму повернення та штрафу при скасуванні стейкінгу.

        Args:
            staking_amount (float): Сума стейкінгу

        Returns:
            tuple: (returned_amount: float, fee_amount: float)
        """
        try:
            staking_amount = int(float(staking_amount))
            fee_amount = int(staking_amount * StakingSession.CANCELLATION_FEE)
            returned_amount = staking_amount - fee_amount

            # Перевірка, що сума повернення не від'ємна
            if returned_amount < 0:
                returned_amount = 0
                logger.warning("Сума повернення від'ємна, встановлено 0")

            return returned_amount, fee_amount
        except Exception as e:
            logger.error(f"Помилка розрахунку суми повернення: {str(e)}")
            return 0, 0