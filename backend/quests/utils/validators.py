"""
Валідатори для системи завдань WINIX
Перевірка Telegram WebApp даних та інших параметрів
"""

import os
import hmac
import hashlib
import json
import logging
import re
from datetime import datetime, timezone
from typing import Dict, Any, Optional, Union
from urllib.parse import parse_qs, unquote

logger = logging.getLogger(__name__)

# Telegram Bot Token для валідації
TELEGRAM_BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN')


class TelegramValidationError(Exception):
    """Помилка валідації Telegram даних"""
    pass


class ValidationResult:
    """Результат валідації"""

    def __init__(self, valid: bool, data: Optional[Dict] = None, error: Optional[str] = None):
        self.valid = valid
        self.data = data or {}
        self.error = error

    def to_dict(self) -> Dict[str, Any]:
        return {
            "valid": self.valid,
            "data": self.data,
            "error": self.error
        }


def validate_telegram_webapp_data(init_data: str, bot_token: Optional[str] = None) -> ValidationResult:
    """
    Валідація Telegram WebApp initData за допомогою HMAC-SHA256

    Args:
        init_data: Рядок з initData з Telegram WebApp
        bot_token: Токен бота (якщо не вказано, береться з env)

    Returns:
        ValidationResult з результатом валідації
    """
    try:
        if not init_data:
            return ValidationResult(False, error="init_data пустий")

        if not bot_token:
            bot_token = TELEGRAM_BOT_TOKEN

        if not bot_token:
            logger.error("TELEGRAM_BOT_TOKEN не налаштовано")
            return ValidationResult(False, error="Токен бота не налаштовано")

        logger.info("Початок валідації Telegram WebApp даних")
        logger.debug(f"init_data довжина: {len(init_data)}")

        # Парсимо init_data
        parsed_data = parse_telegram_init_data(init_data)
        if not parsed_data:
            return ValidationResult(False, error="Не вдалося парсити init_data")

        # Отримуємо hash
        received_hash = parsed_data.pop('hash', '')
        if not received_hash:
            return ValidationResult(False, error="Hash відсутній в init_data")

        # Створюємо рядок для перевірки
        data_check_string = create_data_check_string(parsed_data)
        logger.debug(f"Data check string: {data_check_string}")

        # Генеруємо секретний ключ
        secret_key = hmac.new(
            b"WebAppData",
            bot_token.encode(),
            hashlib.sha256
        ).digest()

        # Обчислюємо очікуваний hash
        expected_hash = hmac.new(
            secret_key,
            data_check_string.encode(),
            hashlib.sha256
        ).hexdigest()

        logger.debug(f"Received hash: {received_hash}")
        logger.debug(f"Expected hash: {expected_hash}")

        # Порівнюємо hash'і
        if not hmac.compare_digest(received_hash, expected_hash):
            logger.warning("Hash не співпадає")
            return ValidationResult(False, error="Невірний hash")

        # Перевіряємо термін дії (auth_date)
        auth_date = parsed_data.get('auth_date')
        if auth_date:
            try:
                auth_timestamp = int(auth_date)
                current_timestamp = int(datetime.now(timezone.utc).timestamp())
                age_seconds = current_timestamp - auth_timestamp

                # Дані дійсні 24 години
                if age_seconds > 86400:
                    logger.warning(f"Дані застарілі: {age_seconds} секунд")
                    return ValidationResult(False, error="Дані застарілі")

                logger.info(f"Дані актуальні: {age_seconds} секунд тому")
            except (ValueError, TypeError):
                logger.warning("Невірний формат auth_date")
                return ValidationResult(False, error="Невірний формат auth_date")

        # Парсимо дані користувача
        user_data = parse_user_data(parsed_data.get('user', ''))
        if not user_data:
            return ValidationResult(False, error="Дані користувача відсутні")

        # Валідуємо користувача
        user_validation = validate_user_data(user_data)
        if not user_validation.valid:
            return user_validation

        logger.info(f"Валідація успішна для користувача {user_data.get('id')}")

        return ValidationResult(True, data={
            "user": user_data,
            "auth_date": auth_date,
            "parsed_data": parsed_data
        })

    except Exception as e:
        logger.error(f"Помилка валідації Telegram даних: {e}", exc_info=True)
        return ValidationResult(False, error=f"Помилка валідації: {str(e)}")


def parse_telegram_init_data(init_data: str) -> Optional[Dict[str, str]]:
    """Парсинг Telegram init_data"""
    try:
        # URL decode
        decoded_data = unquote(init_data)

        # Парсимо як query string
        parsed = parse_qs(decoded_data, keep_blank_values=True)

        # Конвертуємо в простий словник
        result = {}
        for key, values in parsed.items():
            if values:
                result[key] = values[0]  # Беремо перше значення
            else:
                result[key] = ''

        logger.debug(f"Parsed init_data keys: {list(result.keys())}")
        return result

    except Exception as e:
        logger.error(f"Помилка парсингу init_data: {e}")
        return None


def create_data_check_string(data: Dict[str, str]) -> str:
    """Створення рядка для перевірки hash"""
    try:
        # Сортуємо ключі та створюємо рядок
        sorted_items = sorted(data.items())
        data_check_array = []

        for key, value in sorted_items:
            if key != 'hash':  # Пропускаємо hash
                data_check_array.append(f"{key}={value}")

        return '\n'.join(data_check_array)

    except Exception as e:
        logger.error(f"Помилка створення data check string: {e}")
        return ""


def parse_user_data(user_json: str) -> Optional[Dict[str, Any]]:
    """Парсинг JSON даних користувача"""
    try:
        if not user_json:
            return None

        user_data = json.loads(user_json)
        logger.debug(f"Parsed user data: {user_data}")
        return user_data

    except json.JSONDecodeError as e:
        logger.error(f"Помилка парсингу JSON користувача: {e}")
        return None
    except Exception as e:
        logger.error(f"Неочікувана помилка парсингу користувача: {e}")
        return None


def validate_user_data(user_data: Dict[str, Any]) -> ValidationResult:
    """Валідація даних користувача"""
    try:
        errors = []

        # Перевіряємо обов'язкові поля
        required_fields = ['id']
        for field in required_fields:
            if field not in user_data:
                errors.append(f"Поле '{field}' відсутнє")

        # Валідуємо ID
        user_id = user_data.get('id')
        if user_id is not None:
            if not isinstance(user_id, int) or user_id <= 0:
                errors.append("Невірний формат ID користувача")

        # Валідуємо username (якщо є)
        username = user_data.get('username')
        if username:
            if not isinstance(username, str) or len(username) > 32:
                errors.append("Невірний формат username")
            if not re.match(r'^[a-zA-Z0-9_]+$', username):
                errors.append("Username містить недозволені символи")

        # Валідуємо імена
        for field in ['first_name', 'last_name']:
            value = user_data.get(field)
            if value:
                if not isinstance(value, str) or len(value) > 64:
                    errors.append(f"Невірний формат {field}")

        # Валідуємо мовний код
        language_code = user_data.get('language_code')
        if language_code:
            if not isinstance(language_code, str) or len(language_code) > 10:
                errors.append("Невірний формат language_code")

        if errors:
            return ValidationResult(False, error="; ".join(errors))

        return ValidationResult(True, data=user_data)

    except Exception as e:
        logger.error(f"Помилка валідації користувача: {e}")
        return ValidationResult(False, error="Помилка валідації користувача")


def validate_telegram_id(telegram_id: Union[str, int]) -> Optional[int]:
    """Валідація Telegram ID"""
    try:
        if isinstance(telegram_id, str):
            telegram_id = int(telegram_id)

        if not isinstance(telegram_id, int) or telegram_id <= 0:
            return None

        # Telegram ID зазвичай більше 100000
        if telegram_id < 100000:
            logger.warning(f"Підозрілий Telegram ID: {telegram_id}")

        return telegram_id

    except (ValueError, TypeError):
        return None


def validate_username(username: str) -> bool:
    """Валідація username"""
    if not username or not isinstance(username, str):
        return False

    # Довжина від 5 до 32 символів
    if len(username) < 5 or len(username) > 32:
        return False

    # Тільки букви, цифри та підкреслення
    if not re.match(r'^[a-zA-Z0-9_]+$', username):
        return False

    # Не може починатися з цифри
    if username[0].isdigit():
        return False

    return True


def validate_reward_amount(amount: Union[str, int, float]) -> Optional[int]:
    """Валідація суми винагороди"""
    try:
        amount = int(float(amount))

        # Мінімум 0, максимум 1,000,000
        if amount < 0 or amount > 1000000:
            return None

        return amount

    except (ValueError, TypeError):
        return None


def validate_task_type(task_type: str) -> bool:
    """Валідація типу завдання"""
    valid_types = ['social', 'limited', 'partner', 'daily']
    return task_type in valid_types


def validate_task_status(status: str) -> bool:
    """Валідація статусу завдання"""
    valid_statuses = ['available', 'started', 'pending', 'completed', 'claimed', 'expired']
    return status in valid_statuses


def validate_url(url: str) -> bool:
    """Валідація URL"""
    if not url or not isinstance(url, str):
        return False

    # Базова перевірка URL
    url_pattern = re.compile(
        r'^https?://'  # http:// або https://
        r'(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+[A-Z]{2,6}\.?|'  # domain
        r'localhost|'  # localhost
        r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})'  # IP
        r'(?::\d+)?'  # опціональний порт
        r'(?:/?|[/?]\S+)$', re.IGNORECASE)

    return bool(url_pattern.match(url))


def validate_social_platform(platform: str) -> bool:
    """Валідація соціальної платформи"""
    valid_platforms = [
        'telegram', 'twitter', 'instagram', 'youtube',
        'tiktok', 'facebook', 'discord', 'linkedin'
    ]
    return platform.lower() in valid_platforms


def validate_wallet_address(address: str) -> bool:
    """Валідація адреси TON гаманця"""
    if not address or not isinstance(address, str):
        return False

    # TON адреса має бути base64url encoded і 48 символів
    if len(address) != 48:
        return False

    # Перевіряємо символи (base64url)
    if not re.match(r'^[A-Za-z0-9_-]+$', address):
        return False

    return True


def sanitize_string(value: str, max_length: int = 255) -> str:
    """Очищення рядка від небезпечних символів"""
    if not value or not isinstance(value, str):
        return ""

    # Видаляємо керуючі символи
    cleaned = re.sub(r'[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]', '', value)

    # Обрізаємо до максимальної довжини
    cleaned = cleaned[:max_length]

    # Видаляємо зайві пробіли
    cleaned = cleaned.strip()

    return cleaned


def validate_timestamp(timestamp: Union[str, int, float]) -> Optional[datetime]:
    """Валідація timestamp"""
    try:
        if isinstance(timestamp, str):
            timestamp = float(timestamp)

        # Перевіряємо розумні межі (2020-2030)
        if timestamp < 1577836800 or timestamp > 1893456000:  # 2020-01-01 - 2030-01-01
            return None

        return datetime.fromtimestamp(timestamp, tz=timezone.utc)

    except (ValueError, TypeError, OSError):
        return None


def create_validation_report(data: Dict[str, Any], rules: Dict[str, callable]) -> Dict[str, Any]:
    """Створення звіту валідації"""
    report = {
        "valid": True,
        "errors": [],
        "warnings": [],
        "validated_data": {}
    }

    for field, validator in rules.items():
        if field in data:
            try:
                result = validator(data[field])
                if result is None or result is False:
                    report["valid"] = False
                    report["errors"].append(f"Невірне значення поля '{field}'")
                else:
                    report["validated_data"][field] = result
            except Exception as e:
                report["valid"] = False
                report["errors"].append(f"Помилка валідації поля '{field}': {str(e)}")
        else:
            report["warnings"].append(f"Поле '{field}' відсутнє")

    return report


# Стандартні правила валідації
STANDARD_VALIDATION_RULES = {
    'telegram_id': validate_telegram_id,
    'username': validate_username,
    'winix_amount': validate_reward_amount,
    'tickets_amount': validate_reward_amount,
    'task_type': validate_task_type,
    'task_status': validate_task_status,
    'url': validate_url,
    'wallet_address': validate_wallet_address
}

# Експорт
__all__ = [
    'validate_telegram_webapp_data',
    'validate_telegram_id',
    'validate_username',
    'validate_reward_amount',
    'validate_task_type',
    'validate_task_status',
    'validate_url',
    'validate_social_platform',
    'validate_wallet_address',
    'validate_timestamp',
    'sanitize_string',
    'create_validation_report',
    'ValidationResult',
    'TelegramValidationError',
    'STANDARD_VALIDATION_RULES'
]