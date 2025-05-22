from datetime import datetime
import re


def parse_datetime(date_string):
    """
    Парсить дату з різних форматів, включаючи Supabase формати

    Args:
        date_string (str): Рядок з датою

    Returns:
        datetime: Об'єкт datetime
    """
    if not date_string:
        return None

    # Якщо це вже datetime об'єкт
    if isinstance(date_string, datetime):
        return date_string

    # Видаляємо мілісекунди з більше ніж 6 цифр
    date_string = re.sub(r'\.(\d{6})\d+', r'.\1', str(date_string))

    # Список можливих форматів
    formats = [
        '%Y-%m-%dT%H:%M:%S.%fZ',
        '%Y-%m-%dT%H:%M:%S.%f',
        '%Y-%m-%dT%H:%M:%SZ',
        '%Y-%m-%dT%H:%M:%S',
        '%Y-%m-%dT%H:%M:%S.%f+00:00',
        '%Y-%m-%dT%H:%M:%S+00:00',
    ]

    for fmt in formats:
        try:
            return datetime.strptime(date_string, fmt)
        except ValueError:
            continue

    # Якщо жоден формат не підійшов, пробуємо fromisoformat
    try:
        # Додаємо Z якщо його немає
        if not date_string.endswith('Z') and '+' not in date_string and '-' not in date_string[-6:]:
            date_string += 'Z'
        return datetime.fromisoformat(date_string.replace('Z', '+00:00'))
    except:
        # В крайньому випадку повертаємо поточну дату
        return datetime.utcnow()


def format_datetime(dt):
    """
    Форматує datetime в ISO формат для Supabase

    Args:
        dt (datetime): Об'єкт datetime

    Returns:
        str: Відформатована дата
    """
    if not dt:
        return None

    if isinstance(dt, str):
        return dt

    return dt.isoformat()