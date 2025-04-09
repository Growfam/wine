"""
Утилітарні функції для стандартизації API відповідей.
Цей модуль дозволяє забезпечити консистентний формат відповідей у всіх контролерах.
"""
import logging
from flask import jsonify
from typing import Dict, Any, Tuple, Optional, Union

# Налаштування логування
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


def api_success(data: Optional[Dict[str, Any]] = None, message: Optional[str] = None,
                status_code: int = 200) -> Tuple[Dict[str, Any], int]:
    """
    Стандартна успішна відповідь API.

    Args:
        data: Дані для повернення (може бути None)
        message: Повідомлення про успіх (може бути None)
        status_code: HTTP код статусу (за замовчуванням 200)

    Returns:
        tuple: (jsonified_response, status_code)
    """
    response = {"status": "success"}

    if data is not None:
        response["data"] = data

    if message:
        response["message"] = message

    return jsonify(response), status_code


def api_error(message: str, details: Optional[Any] = None,
              status_code: int = 400) -> Tuple[Dict[str, Any], int]:
    """
    Стандартна відповідь API з помилкою.

    Args:
        message: Повідомлення про помилку
        details: Додаткові деталі помилки (може бути None)
        status_code: HTTP код статусу (за замовчуванням 400)

    Returns:
        tuple: (jsonified_response, status_code)
    """
    response = {
        "status": "error",
        "message": message
    }

    if details is not None:
        response["details"] = details

    return jsonify(response), status_code


def api_validation_error(errors: Dict[str, str],
                         message: str = "Помилка валідації даних") -> Tuple[Dict[str, Any], int]:
    """
    Відповідь API для помилок валідації з детальним описом помилок по полях.

    Args:
        errors: Словник помилок валідації (поле: повідомлення)
        message: Загальне повідомлення про помилку валідації

    Returns:
        tuple: (jsonified_response, status_code)
    """
    return jsonify({
        "status": "error",
        "message": message,
        "errors": errors
    }), 400


def handle_exception(e: Exception,
                     default_message: str = "Сталася внутрішня помилка сервера",
                     log_error: bool = True) -> Tuple[Dict[str, Any], int]:
    """
    Стандартна обробка винятків для контролерів.

    Args:
        e: Виняток, що виник
        default_message: Повідомлення за замовчуванням
        log_error: Чи потрібно логувати помилку

    Returns:
        tuple: (jsonified_response, status_code)
    """
    if log_error:
        logger.error(f"{default_message}: {str(e)}", exc_info=True)

    return jsonify({
        "status": "error",
        "message": default_message,
        "details": str(e)
    }), 500


def paginate_response(data: list, total: int, limit: int, offset: int,
                      message: Optional[str] = None) -> Tuple[Dict[str, Any], int]:
    """
    Стандартна відповідь з пагінацією.

    Args:
        data: Список елементів на поточній сторінці
        total: Загальна кількість елементів
        limit: Ліміт елементів на сторінці
        offset: Зміщення від початку списку
        message: Додаткове повідомлення (опціонально)

    Returns:
        tuple: (jsonified_response, status_code)
    """
    response = {
        "status": "success",
        "data": data,
        "pagination": {
            "total": total,
            "limit": limit,
            "offset": offset,
            "current_page": offset // limit + 1 if limit else 1,
            "total_pages": (total + limit - 1) // limit if limit else 1
        }
    }

    if message:
        response["message"] = message

    return jsonify(response), 200


def validate_request_data(data: Optional[Dict[str, Any]],
                          required_fields: list) -> Tuple[bool, Optional[Dict[str, str]]]:
    """
    Валідація даних запиту на наявність обов'язкових полів.

    Args:
        data: Дані запиту
        required_fields: Список обов'язкових полів

    Returns:
        tuple: (is_valid, errors_dict)
    """
    if not data:
        return False, {"request": "Відсутні дані запиту"}

    errors = {}

    for field in required_fields:
        if field not in data or data[field] is None:
            errors[field] = f"Поле '{field}' є обов'язковим"

    return len(errors) == 0, errors if errors else None


def validate_numeric_field(value: Any, field_name: str,
                           min_value: Optional[float] = None,
                           max_value: Optional[float] = None,
                           integer_only: bool = False) -> Tuple[bool, Optional[str], Optional[float]]:
    """
    Валідація числового поля.

    Args:
        value: Значення поля
        field_name: Назва поля для повідомлення про помилку
        min_value: Мінімальне допустиме значення (опціонально)
        max_value: Максимальне допустиме значення (опціонально)
        integer_only: Чи повинно значення бути цілим числом

    Returns:
        tuple: (is_valid, error_message, validated_value)
    """
    # Спроба конвертації до float
    try:
        numeric_value = float(value)
    except (ValueError, TypeError):
        return False, f"Поле '{field_name}' повинно бути числом", None

    # Перевірка на цілочисельність
    if integer_only and numeric_value != int(numeric_value):
        return False, f"Поле '{field_name}' повинно бути цілим числом", None

    # Конвертація в int, якщо потрібно
    if integer_only:
        numeric_value = int(numeric_value)

    # Перевірка мінімального значення
    if min_value is not None and numeric_value < min_value:
        return False, f"Поле '{field_name}' повинно бути не менше {min_value}", None

    # Перевірка максимального значення
    if max_value is not None and numeric_value > max_value:
        return False, f"Поле '{field_name}' повинно бути не більше {max_value}", None

    return True, None, numeric_value