"""
Допоміжні функції для всіх модулів бекенду.
"""
import logging
import re
import functools
from typing import Dict, Any, Tuple, Optional, List, Callable

from flask import jsonify

# Налаштування логування
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


def validate_telegram_id(telegram_id: str) -> bool:
    """
    Перевірка валідності Telegram ID

    Args:
        telegram_id (str): ID для перевірки

    Returns:
        bool: True якщо ID валідний, False інакше
    """
    if not telegram_id or not isinstance(telegram_id, str):
        return False

    # Telegram ID має складатися з цифр, або починатися з "-100" для груп/каналів
    if telegram_id.startswith("-100"):
        return telegram_id[4:].isdigit()
    else:
        return telegram_id.isdigit()


def safe_get_user_id() -> Optional[str]:
    """
    Безпечне отримання ID користувача з різних джерел

    Returns:
        Optional[str]: ID користувача або None
    """
    try:
        # Перевіряємо request.headers
        from flask import request
        if request and request.headers and 'X-Telegram-User-Id' in request.headers:
            return request.headers.get('X-Telegram-User-Id')

        # Перевіряємо request.json
        if request and request.json and 'telegram_id' in request.json:
            return request.json.get('telegram_id')

        # Перевіряємо request.args
        if request and request.args and 'telegram_id' in request.args:
            return request.args.get('telegram_id')

        # Перевіряємо request.form
        if request and request.form and 'telegram_id' in request.form:
            return request.form.get('telegram_id')

        # Перевіряємо глобальний об'єкт g
        from flask import g
        if hasattr(g, 'telegram_id') and g.telegram_id:
            return g.telegram_id

        return None
    except Exception as e:
        logger.error(f"Помилка при отриманні ID користувача: {str(e)}")
        return None


def error_handler(func: Callable) -> Callable:
    """
    Декоратор для обробки помилок у функціях сервісу

    Args:
        func (Callable): Функція для декорування

    Returns:
        Callable: Декорована функція
    """

    @functools.wraps(func)
    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except Exception as e:
            logger.error(f"Помилка у функції {func.__name__}: {str(e)}")
            # Залежно від типу функції, повертаємо відповідний результат
            if func.__name__.startswith('get_'):
                return None
            elif func.__name__.startswith('create_') or func.__name__.startswith('update_'):
                return False
            elif func.__name__.startswith('process_'):
                return False, str(e), {}
            else:
                raise

    return wrapper


def api_response(data: Dict[str, Any], status_code: int = 200) -> Tuple[Dict[str, Any], int]:
    """
    Повертає відповідь API з даними

    Args:
        data (Dict[str, Any]): Дані для відповіді
        status_code (int, optional): HTTP код статусу

    Returns:
        Tuple[Dict[str, Any], int]: Відповідь API та код статусу
    """
    return data, status_code


def api_success(data: Dict[str, Any] = None, message: str = "Операцію успішно виконано", status_code: int = 200) -> \
Tuple[Dict[str, Any], int]:
    """
    Формує успішну відповідь API

    Args:
        data (Dict[str, Any], optional): Дані для відповіді
        message (str, optional): Повідомлення
        status_code (int, optional): HTTP код статусу

    Returns:
        Tuple[Dict[str, Any], int]: Відповідь API та код статусу
    """
    response = {
        "status": "success",
        "message": message
    }

    if data is not None:
        response["data"] = data

    return response, status_code


def api_error(message: str, details: Dict[str, Any] = None, status_code: int = 400) -> Tuple[Dict[str, Any], int]:
    """
    Формує відповідь API з помилкою

    Args:
        message (str): Повідомлення про помилку
        details (Dict[str, Any], optional): Деталі помилки
        status_code (int, optional): HTTP код статусу

    Returns:
        Tuple[Dict[str, Any], int]: Відповідь API та код статусу
    """
    response = {
        "status": "error",
        "message": message
    }

    if details is not None:
        response["details"] = details

    return response, status_code