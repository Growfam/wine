"""
Допоміжні функції для роботи зі стейкінгом.
Включає розрахунки винагород, дат тощо.
"""
import time
import logging
from datetime import datetime, timedelta

# Налаштування логування
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Константи для відсотків стейкінгу за різні періоди
STAKING_REWARD_RATES = {
    7: 4,  # 4% за 7 днів
    14: 9,  # 9% за 14 днів
    28: 15  # 15% за 28 днів
}

# Штраф при скасуванні стейкінгу (20%)
STAKING_CANCELLATION_FEE = 0.2

# Константи для валідації стейкінгу
MIN_STAKING_AMOUNT = 50  # Мінімальна сума стейкінгу
MAX_STAKING_PERCENTAGE = 0.9  # Максимально дозволений відсоток балансу для стейкінгу


def get_time_in_milliseconds():
    """Повертає поточний час у мілісекундах"""
    return int(time.time() * 1000)


def calculate_end_date(period_days):
    """Розраховує дату завершення на основі поточної дати та періоду у днях"""
    try:
        end_date = datetime.now() + timedelta(days=period_days)
        return end_date.isoformat()
    except Exception as e:
        logger.error(f"Помилка розрахунку дати завершення: {str(e)}")
        return None


def parse_date(date_string):
    """Універсальний парсер дати, який обробляє різні формати"""
    try:
        # Спочатку пробуємо ISO формат з обробкою часової зони
        return datetime.fromisoformat(date_string.replace('Z', '+00:00'))
    except ValueError:
        try:
            # Пробуємо формат з мілісекундами
            return datetime.strptime(date_string, "%Y-%m-%dT%H:%M:%S.%f")
        except ValueError:
            try:
                # Пробуємо формат без мілісекунд
                return datetime.strptime(date_string, "%Y-%m-%dT%H:%M:%S")
            except ValueError:
                # Якщо нічого не допомогло, повертаємо поточну дату
                logger.error(f"Неможливо розпарсити дату: {date_string}")
                return datetime.now()


def calculate_remaining_days(end_date):
    """Розраховує залишок днів до дати завершення"""
    try:
        if isinstance(end_date, str):
            end_date_parsed = parse_date(end_date)
        else:
            end_date_parsed = end_date

        now = datetime.now()
        remaining = max(0, (end_date_parsed - now).days)
        return remaining
    except Exception as e:
        logger.error(f"Помилка розрахунку залишку днів: {str(e)}")
        return 0


def calculate_staking_reward(amount, period):
    """Розрахунок очікуваної винагороди за стейкінг"""
    try:
        # Перевірка параметрів і перетворення на числа
        amount = float(amount)
        period = int(period)

        if amount <= 0 or period <= 0:
            return 0

        # Перевірка, що сума є цілим числом
        if amount != int(amount):
            amount = int(amount)  # Округляємо до цілого
            logger.warning("Сума не була цілим числом, округлено")

        # Визначаємо відсоток на основі періоду
        reward_percent = STAKING_REWARD_RATES.get(period, 9)  # За замовчуванням 9%

        # Розраховуємо винагороду
        reward = amount * (reward_percent / 100)

        return round(reward, 2)
    except Exception as e:
        logger.error(f"Помилка розрахунку винагороди: {str(e)}")
        return 0


def validate_staking_amount(current_balance, amount):
    """
    Валідація суми стейкінгу з усіма необхідними перевірками

    Повертає: tuple (success: bool, message: str)
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
        if amount < MIN_STAKING_AMOUNT:
            return (False, f'Мінімальна сума стейкінгу: {MIN_STAKING_AMOUNT} WINIX')

        # Перевірка на максимально дозволений відсоток від балансу
        max_allowed_amount = int(current_balance * MAX_STAKING_PERCENTAGE)
        if amount > max_allowed_amount:
            return (
            False, f'Максимальна сума: {max_allowed_amount} WINIX ({int(MAX_STAKING_PERCENTAGE * 100)}% від балансу)')

        # Перевірка на достатність коштів
        if amount > current_balance:
            return (False, f'Недостатньо коштів. Ваш баланс: {current_balance} WINIX')

        return (True, '')
    except Exception as e:
        logger.error(f"Помилка валідації суми стейкінгу: {str(e)}")
        return (False, 'Помилка валідації суми стейкінгу')


def calculate_cancellation_returns(staking_amount):
    """Розраховує суму повернення та штрафу при скасуванні стейкінгу"""
    try:
        staking_amount = int(float(staking_amount))
        fee_amount = int(staking_amount * STAKING_CANCELLATION_FEE)
        returned_amount = staking_amount - fee_amount

        # Перевірка, що сума повернення не від'ємна
        if returned_amount < 0:
            returned_amount = 0
            logger.warning("Сума повернення від'ємна, встановлено 0")

        return returned_amount, fee_amount
    except Exception as e:
        logger.error(f"Помилка розрахунку суми повернення: {str(e)}")
        return 0, 0


def check_staking_finished(end_date):
    """Перевіряє, чи стейкінг завершено за датою"""
    try:
        if isinstance(end_date, str):
            end_date_parsed = parse_date(end_date)
        else:
            end_date_parsed = end_date

        now = datetime.now()
        return now >= end_date_parsed
    except Exception as e:
        logger.error(f"Помилка перевірки завершення стейкінгу: {str(e)}")
        return False