import re
import logging

# Налаштування логування
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


def validate_email(email):
    """
    Валідація електронної пошти

    Args:
        email (str): Електронна пошта для перевірки

    Returns:
        bool: True, якщо пошта валідна, False інакше
    """
    pattern = re.compile(r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$')
    return bool(pattern.match(email))


def validate_password_strength(password):
    """
    Перевірка надійності пароля

    Args:
        password (str): Пароль для перевірки

    Returns:
        dict: Результат перевірки з полями:
            - valid (bool): Чи пароль валідний
            - message (str): Повідомлення про помилку (якщо є)
            - strength (str): Надійність пароля (weak/medium/strong)
    """
    # Перевірка довжини
    if len(password) < 8:
        return {
            "valid": False,
            "message": "Пароль повинен бути не менше 8 символів",
            "strength": "weak"
        }

    # Перевірка наявності різних типів символів
    has_digit = any(char.isdigit() for char in password)
    has_lower = any(char.islower() for char in password)
    has_upper = any(char.isupper() for char in password)
    has_special = any(not char.isalnum() for char in password)

    # Визначення надійності
    strength_count = sum([has_digit, has_lower, has_upper, has_special])

    if strength_count == 4:
        strength = "strong"
    elif strength_count >= 2:
        strength = "medium"
    else:
        strength = "weak"

    # Перевірка мінімальних вимог
    if not (has_digit and (has_lower or has_upper)):
        return {
            "valid": False,
            "message": "Пароль повинен містити літери та цифри",
            "strength": strength
        }

    return {
        "valid": True,
        "message": "",
        "strength": strength
    }


def validate_username(username):
    """
    Перевірка валідності імені користувача

    Args:
        username (str): Ім'я користувача для перевірки

    Returns:
        dict: Результат перевірки з полями:
            - valid (bool): Чи ім'я валідне
            - message (str): Повідомлення про помилку (якщо є)
    """
    # Перевірка довжини
    if len(username) < 3:
        return {
            "valid": False,
            "message": "Ім'я користувача повинно бути не менше 3 символів"
        }

    if len(username) > 30:
        return {
            "valid": False,
            "message": "Ім'я користувача повинно бути не більше 30 символів"
        }

    # Перевірка на допустимі символи
    pattern = re.compile(r'^[a-zA-Z0-9._-]+$')
    if not pattern.match(username):
        return {
            "valid": False,
            "message": "Ім'я користувача може містити лише літери, цифри та символи ._-"
        }

    return {
        "valid": True,
        "message": ""
    }


def validate_amount(amount, min_amount=0, max_amount=None):
    """
    Покращена перевірка валідності суми

    Args:
        amount: Сума для перевірки (рядок або число)
        min_amount: Мінімальна допустима сума
        max_amount: Максимальна допустима сума (необов'язково)

    Returns:
        dict: Результат перевірки з полями:
            - valid (bool): Чи сума валідна
            - message (str): Повідомлення про помилку (якщо є)
            - amount (float): Конвертована сума (якщо валідна)
    """
    try:
        # Спроба конвертації у float
        if isinstance(amount, (int, float)):
            amount_float = float(amount)
        elif isinstance(amount, str):
            # Видаляємо лишні пробіли та замінюємо кому на крапку
            amount = amount.strip().replace(',', '.')
            amount_float = float(amount)
        else:
            return {
                "valid": False,
                "message": f"Некоректний тип суми: {type(amount).__name__}",
                "amount": None
            }

        # Перевірка на від'ємне значення
        if amount_float < min_amount:
            return {
                "valid": False,
                "message": f"Сума повинна бути не менше {min_amount}",
                "amount": amount_float
            }

        # Перевірка на максимальне значення, якщо вказано
        if max_amount is not None and amount_float > max_amount:
            return {
                "valid": False,
                "message": f"Сума повинна бути не більше {max_amount}",
                "amount": amount_float
            }

        return {
            "valid": True,
            "message": "",
            "amount": amount_float
        }
    except (ValueError, TypeError) as e:
        return {
            "valid": False,
            "message": f"Некоректний формат суми: {str(e)}",
            "amount": None
        }