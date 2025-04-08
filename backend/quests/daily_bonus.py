from datetime import datetime, timedelta
import logging

# Налаштування логування
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


def calculate_daily_bonus(day_number):
    """
    Розраховує розмір щоденного бонусу залежно від дня циклу

    Args:
        day_number (int): Номер дня в циклі (1-7)

    Returns:
        int: Розмір бонусу
    """
    # Базова логіка: день * 10
    # День 1 = 10, День 2 = 20, День 3 = 30, і т.д.
    return day_number * 10


def get_next_day_in_cycle(current_day):
    """
    Визначає наступний день у циклі щоденних бонусів

    Args:
        current_day (int): Поточний день циклу

    Returns:
        int: Наступний день циклу
    """
    next_day = current_day + 1
    if next_day > 7:
        next_day = 1
    return next_day


def check_bonus_availability(last_claimed_date):
    """
    Перевіряє, чи можна отримати бонус сьогодні

    Args:
        last_claimed_date (str): Дата останнього отримання бонусу в форматі ISO

    Returns:
        bool: True, якщо бонус доступний, False інакше
    """
    if not last_claimed_date:
        return True

    try:
        # Парсимо дату останнього отримання
        last_date = datetime.fromisoformat(last_claimed_date)
        today = datetime.now()

        # Скидаємо час до початку дня для порівняння тільки дат
        last_date_day = last_date.replace(hour=0, minute=0, second=0, microsecond=0)
        today_day = today.replace(hour=0, minute=0, second=0, microsecond=0)

        # Бонус доступний, якщо минуло мінімум 24 години
        return today_day > last_date_day
    except Exception as e:
        logger.error(f"check_bonus_availability: Помилка перевірки доступності бонусу: {str(e)}")
        return False


def check_streak_reset(last_claimed_date):
    """
    Перевіряє, чи треба скинути стрік щоденних бонусів

    Args:
        last_claimed_date (str): Дата останнього отримання бонусу в форматі ISO

    Returns:
        bool: True, якщо стрік треба скинути, False інакше
    """
    if not last_claimed_date:
        return False

    try:
        # Парсимо дату останнього отримання
        last_date = datetime.fromisoformat(last_claimed_date)
        today = datetime.now()

        # Визначаємо, чи пройшло більше 48 годин (2 дні)
        time_diff = today - last_date
        return time_diff > timedelta(hours=48)
    except Exception as e:
        logger.error(f"check_streak_reset: Помилка перевірки скидання стріку: {str(e)}")
        return False