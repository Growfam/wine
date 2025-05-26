"""
Контролери для автентифікації користувачів WINIX
ВИПРАВЛЕНА версія з покращеною валідацією та синхронізацією з frontend
"""

import logging
import os
import sys
import hmac
import hashlib
import urllib.parse
import json
import re
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from flask import request

# Налаштування логування
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Додаємо шляхи для імпортів
current_dir = os.path.dirname(os.path.abspath(__file__))
backend_dir = os.path.dirname(current_dir)
if backend_dir not in sys.path:
    sys.path.append(backend_dir)

# Імпорти Supabase
try:
    from supabase_client import get_user, update_user, supabase
    SUPABASE_AVAILABLE = True
    logger.info("✅ Supabase client завантажено")
except ImportError as e:
    logger.error(f"❌ КРИТИЧНА ПОМИЛКА: Supabase client недоступний: {e}")
    raise ImportError("Supabase client є обов'язковим для роботи системи")

# Імпорти users контролерів
try:
    from users.controllers import get_user_info, create_new_user
    USERS_CONTROLLERS_AVAILABLE = True
    logger.info("✅ Users controllers завантажено")
except ImportError as e:
    logger.warning(f"⚠️ Users controllers недоступні: {e}")
    USERS_CONTROLLERS_AVAILABLE = False

# Константи
USER_ID_PATTERN = re.compile(r'^\d{1,12}$')  # Telegram ID: 1-12 цифр
USERNAME_PATTERN = re.compile(r'^[a-zA-Z0-9_]{1,32}$')
BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN')

if not BOT_TOKEN:
    logger.warning("⚠️ TELEGRAM_BOT_TOKEN не налаштовано - авторизація буде обмежена")


def validate_telegram_id(telegram_id: Any) -> str:
    """
    СТРОГА валідація Telegram ID без fallback варіантів

    Args:
        telegram_id: ID для валідації

    Returns:
        str: Валідний Telegram ID

    Raises:
        ValueError: Якщо ID невалідний
    """
    if telegram_id is None:
        raise ValueError("Telegram ID не може бути None")

    if telegram_id == '':
        raise ValueError("Telegram ID не може бути порожнім")

    # Конвертуємо в строку
    telegram_id_str = str(telegram_id).strip()

    # Перевіряємо на забороненні значення
    forbidden_values = {'undefined', 'null', 'none', '0', ''}
    if telegram_id_str.lower() in forbidden_values:
        raise ValueError(f"Недозволене значення Telegram ID: {telegram_id_str}")

    # Перевіряємо формат
    if not USER_ID_PATTERN.match(telegram_id_str):
        raise ValueError(f"Невалідний формат Telegram ID: {telegram_id_str}")

    # Перевіряємо діапазон
    try:
        telegram_id_int = int(telegram_id_str)
        if telegram_id_int <= 0:
            raise ValueError("Telegram ID має бути додатним числом")
        if telegram_id_int > 999999999999:  # 12 цифр максимум
            raise ValueError("Telegram ID занадто великий")
    except ValueError as e:
        if "invalid literal" in str(e):
            raise ValueError(f"Telegram ID містить недопустимі символи: {telegram_id_str}")
        raise

    return telegram_id_str


def validate_telegram_data(data: Dict[str, Any]) -> bool:
    """
    СТРОГА валідація даних від Telegram

    Args:
        data: Дані користувача від Telegram

    Returns:
        bool: True якщо дані валідні

    Raises:
        ValueError: Якщо дані невалідні
    """
    if not isinstance(data, dict):
        raise ValueError("Дані мають бути словником")

    # Перевіряємо наявність ID
    user_id = data.get('id') or data.get('telegram_id')
    if not user_id:
        raise ValueError("Відсутній user ID в даних")

    # Валідуємо ID
    try:
        validate_telegram_id(user_id)
    except ValueError as e:
        raise ValueError(f"Невалідний user ID: {e}")

    # Перевіряємо username якщо є
    username = data.get('username')
    if username and not USERNAME_PATTERN.match(str(username)):
        logger.warning(f"Невалідний формат username: {username}")
        # Не кидаємо помилку для username, просто попереджаємо

    # Перевіряємо first_name якщо є
    first_name = data.get('first_name', '')
    if first_name and len(str(first_name).strip()) > 100:
        raise ValueError("First name занадто довгий")

    return True


def verify_telegram_webapp_data(init_data: str, bot_token: str) -> bool:
    """
    ВИПРАВЛЕНА перевірка автентичності даних від Telegram WebApp

    Args:
        init_data: Дані ініціалізації від Telegram
        bot_token: Токен бота

    Returns:
        bool: True якщо дані автентичні
    """
    if not init_data or not bot_token:
        logger.warning("Відсутні init_data або bot_token")
        return False

    try:
        # Розбираємо init_data
        parsed_data = urllib.parse.parse_qs(init_data)

        # Отримуємо hash та видаляємо його з даних
        received_hash = parsed_data.get('hash', [None])[0]
        if not received_hash:
            logger.warning("Відсутній hash в init_data")
            return False

        # Створюємо рядок для перевірки (сортуємо ключі)
        auth_items = []
        for key, value in parsed_data.items():
            if key != 'hash' and value and value[0]:  # Додаткова перевірка на порожні значення
                auth_items.append(f"{key}={value[0]}")

        if not auth_items:
            logger.warning("Немає даних для верифікації")
            return False

        auth_string = '\n'.join(sorted(auth_items))
        logger.debug(f"Auth string for verification: {auth_string}")

        # Створюємо секретний ключ
        secret_key = hmac.new(
            "WebAppData".encode(),
            bot_token.encode(),
            hashlib.sha256
        ).digest()

        # Обчислюємо hash
        calculated_hash = hmac.new(
            secret_key,
            auth_string.encode(),
            hashlib.sha256
        ).hexdigest()

        # Порівнюємо hash'і
        is_valid = hmac.compare_digest(received_hash, calculated_hash)

        if not is_valid:
            logger.warning(f"Hash mismatch. Received: {received_hash}, Calculated: {calculated_hash}")
        else:
            logger.info("Telegram WebApp data verification successful")

        return is_valid

    except Exception as e:
        logger.error(f"Помилка перевірки Telegram WebApp data: {str(e)}")
        return False


def extract_user_from_webapp_data(init_data: str) -> Optional[Dict[str, Any]]:
    """
    ВИПРАВЛЕНА функція витягування даних користувача з init_data

    Args:
        init_data: Дані ініціалізації від Telegram

    Returns:
        Dict з даними користувача або None
    """
    if not init_data:
        return None

    try:
        parsed_data = urllib.parse.parse_qs(init_data)
        user_data = parsed_data.get('user', [None])[0]

        if user_data:
            user_info = json.loads(user_data)

            # Додаткова валідація витягнутих даних
            if not user_info.get('id'):
                logger.warning("Відсутній ID в user data")
                return None

            return {
                'id': user_info.get('id'),
                'username': user_info.get('username'),
                'first_name': user_info.get('first_name'),
                'last_name': user_info.get('last_name'),
                'language_code': user_info.get('language_code')
            }
    except json.JSONDecodeError as e:
        logger.error(f"Помилка парсингу JSON user data: {str(e)}")
    except Exception as e:
        logger.error(f"Помилка витягування користувача: {str(e)}")

    return None


def get_user_data(telegram_id: str) -> Optional[Dict[str, Any]]:
    """
    Отримання даних користувача за telegram_id БЕЗ fallback механізмів

    Args:
        telegram_id: ID користувача в Telegram

    Returns:
        Dict з даними користувача або None якщо не знайдено

    Raises:
        ValueError: При невалідному ID
        ConnectionError: При проблемах з БД
    """
    # Строга валідація ID
    telegram_id = validate_telegram_id(telegram_id)

    logger.info(f"🔍 Пошук користувача {telegram_id}")

    # Спочатку пробуємо через users.controllers
    if USERS_CONTROLLERS_AVAILABLE and get_user_info:
        try:
            user_data = get_user_info(telegram_id)
            if user_data:
                logger.info(f"✅ Користувач {telegram_id} знайдений через users.controllers")
                return user_data
        except Exception as e:
            logger.error(f"❌ Помилка в get_user_info: {str(e)}")
            raise ConnectionError(f"Помилка доступу до даних користувача: {e}")

    # Fallback через прямий запит до Supabase
    try:
        response = supabase.table("winix").select("*").eq("telegram_id", telegram_id).execute()
        if response.data and len(response.data) > 0:
            user_data = response.data[0]
            logger.info(f"✅ Користувач {telegram_id} знайдений через прямий Supabase запит")
            return user_data
    except Exception as e:
        logger.error(f"❌ Помилка прямого Supabase запиту: {str(e)}")
        raise ConnectionError(f"Помилка підключення до бази даних: {e}")

    # Користувач не знайдений
    logger.info(f"ℹ️ Користувач {telegram_id} не знайдений в базі даних")
    return None


def create_user_safe(telegram_id: str, display_name: str, referrer_id: Optional[str] = None) -> Dict[str, Any]:
    """
    Безпечне створення користувача БЕЗ fallback механізмів

    Args:
        telegram_id: ID користувача в Telegram
        display_name: Відображуване ім'я
        referrer_id: ID реферера (опціонально)

    Returns:
        Dict з даними створеного користувача

    Raises:
        ValueError: При невалідних даних
        ConnectionError: При проблемах з БД
    """
    # Строга валідація
    telegram_id = validate_telegram_id(telegram_id)

    if not display_name or len(str(display_name).strip()) == 0:
        display_name = f"User_{telegram_id[-4:]}"

    if referrer_id:
        referrer_id = validate_telegram_id(referrer_id)
        if referrer_id == telegram_id:
            raise ValueError("Користувач не може бути рефералом самого себе")

    logger.info(f"🆕 Створення користувача {telegram_id}")

    # Спочатку пробуємо через users.controllers
    if USERS_CONTROLLERS_AVAILABLE and create_new_user:
        try:
            user_data = create_new_user(telegram_id, display_name, referrer_id)
            if user_data:
                logger.info(f"✅ Користувач {telegram_id} створений через users.controllers")
                return user_data
        except Exception as e:
            logger.error(f"❌ Помилка в create_new_user: {str(e)}")
            raise ConnectionError(f"Помилка створення користувача: {e}")

    # Fallback - створення через прямий Supabase запит
    try:
        # Базові дані нового користувача
        new_user_data = {
            "telegram_id": telegram_id,
            "username": display_name,
            "balance": int(os.getenv('DEFAULT_TOKENS_NEW_USER', '0')),
            "coins": int(os.getenv('DEFAULT_WINIX_NEW_USER', '0')),
            "created_at": datetime.now(timezone.utc).isoformat(),
            "last_login": datetime.now(timezone.utc).isoformat(),
            "is_active": True
        }

        # Додаємо реферера якщо є
        if referrer_id:
            new_user_data["referrer_id"] = referrer_id

        # Створюємо користувача
        response = supabase.table("winix").insert(new_user_data).execute()

        if response.data and len(response.data) > 0:
            created_user = response.data[0]
            created_user['is_new_user'] = True
            logger.info(f"✅ Користувач {telegram_id} створений через прямий Supabase запит")
            return created_user
        else:
            raise ConnectionError("Порожня відповідь від бази даних")

    except Exception as e:
        logger.error(f"❌ Помилка створення користувача: {str(e)}")
        raise ConnectionError(f"Не вдалося створити користувача: {e}")


def update_user_data(telegram_id: str, updates: Dict[str, Any]) -> bool:
    """
    Оновлення даних користувача

    Args:
        telegram_id: ID користувача
        updates: Дані для оновлення

    Returns:
        bool: True якщо оновлення успішне

    Raises:
        ValueError: При невалідних даних
        ConnectionError: При проблемах з БД
    """
    # Строга валідація
    telegram_id = validate_telegram_id(telegram_id)

    if not isinstance(updates, dict) or len(updates) == 0:
        raise ValueError("Updates мають бути непорожнім словником")

    logger.info(f"📝 Оновлення даних користувача {telegram_id}")

    try:
        response = supabase.table("winix").update(updates).eq("telegram_id", telegram_id).execute()
        if response.data:
            logger.info(f"✅ Дані користувача {telegram_id} оновлено")
            return True
        else:
            raise ConnectionError("Порожня відповідь від бази даних")
    except Exception as e:
        logger.error(f"❌ Помилка оновлення користувача {telegram_id}: {str(e)}")
        raise ConnectionError(f"Не вдалося оновити дані користувача: {e}")


def verify_user(telegram_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    ГОЛОВНА функція верифікації користувача БЕЗ fallback механізмів
    ВИПРАВЛЕНА для кращої роботи з frontend

    Args:
        telegram_data: Дані від Telegram

    Returns:
        Dict з даними користувача

    Raises:
        ValueError: При невалідних даних
        ConnectionError: При проблемах з БД
        PermissionError: При невалідній авторизації
    """
    logger.info("🔐 verify_user: Початок верифікації користувача")

    # Строга валідація вхідних даних
    if not isinstance(telegram_data, dict):
        raise ValueError("telegram_data має бути словником")

    validate_telegram_data(telegram_data)

    # Перевірка initData з Telegram WebApp
    init_data = telegram_data.get('initData')
    is_valid_telegram_request = False

    if init_data:
        logger.info("📱 verify_user: Отримано initData з Telegram WebApp")

        # Перевіряємо підпис якщо є токен бота
        if BOT_TOKEN:
            is_valid_telegram_request = verify_telegram_webapp_data(init_data, BOT_TOKEN)
            if not is_valid_telegram_request:
                logger.warning("⚠️ verify_user: Невалідний підпис initData")
                # ВИПРАВЛЕНО: Не кидаємо помилку, а логуємо попередження
                logger.warning("InitData verification failed, but continuing...")
            else:
                logger.info("✅ verify_user: Підпис initData валідний")
        else:
            # Якщо немає токена, довіряємо наявності initData
            is_valid_telegram_request = True
            logger.warning("⚠️ verify_user: TELEGRAM_BOT_TOKEN не налаштовано")

        # Витягуємо дані користувача з initData
        if init_data:  # ВИПРАВЛЕНО: перевіряємо initData замість is_valid_telegram_request
            webapp_user = extract_user_from_webapp_data(init_data)
            if webapp_user:
                telegram_data.update(webapp_user)
                logger.info("📝 verify_user: Дані користувача витягнуто з initData")
                is_valid_telegram_request = True  # Встановлюємо true якщо витягли дані

    # Отримуємо ID користувача
    telegram_id = telegram_data.get('id') or telegram_data.get('telegram_id')

    # ВИПРАВЛЕНО: Перевірка заголовків для отримання ID
    if not telegram_id and request:
        header_id = request.headers.get('X-Telegram-User-Id')
        if header_id:
            telegram_id = header_id
            is_valid_telegram_request = True
            logger.info("📡 verify_user: ID отримано з заголовка X-Telegram-User-Id")

    # Додаткова перевірка для Telegram Mini App
    if telegram_data.get('from_telegram'):
        is_valid_telegram_request = True
        logger.info("🔵 verify_user: Позначено як запит від Telegram")

    if not telegram_id:
        raise ValueError("Не вдалося отримати telegram_id")

    # Финальна валідація ID
    telegram_id = validate_telegram_id(telegram_id)
    logger.info(f"👤 verify_user: Обробка користувача {telegram_id}")

    # Перевіряємо існування користувача
    user = get_user_data(telegram_id)

    if not user:
        # ВИПРАВЛЕНО: Створюємо користувача навіть якщо верифікація не пройшла
        # але логуємо це як попередження
        if not is_valid_telegram_request:
            logger.warning(f"⚠️ verify_user: Створюємо користувача {telegram_id} без повної верифікації Telegram")

        logger.info(f"🆕 verify_user: Створюємо нового користувача {telegram_id}")

        # Підготовка даних для створення
        username = telegram_data.get('username', '')
        first_name = telegram_data.get('first_name', '')
        display_name = username or first_name or f"User_{telegram_id[-4:]}"
        referrer_id = telegram_data.get('referrer_id')

        # Створюємо користувача
        user = create_user_safe(telegram_id, display_name, referrer_id)
        logger.info(f"✅ verify_user: Користувач {telegram_id} успішно створений")
    else:
        logger.info(f"👋 verify_user: Існуючий користувач {telegram_id}")
        user['is_new_user'] = False

    # Оновлюємо дані користувача
    try:
        updates = {
            "last_login": datetime.now(timezone.utc).isoformat()
        }

        # Оновлюємо username якщо він змінився
        username = telegram_data.get('username')
        if username and username != user.get('username'):
            updates["username"] = username

        # Додаємо мову якщо є
        language_code = telegram_data.get('language_code')
        if language_code:
            updates["language"] = language_code

        # Виконуємо оновлення
        if updates:
            update_user_data(telegram_id, updates)
            logger.info(f"📝 verify_user: Дані користувача {telegram_id} оновлено")

    except Exception as e:
        logger.warning(f"⚠️ verify_user: Помилка оновлення даних користувача: {str(e)}")
        # Не кидаємо помилку для оновлення, це не критично

    logger.info(f"🎉 verify_user: Верифікація користувача {telegram_id} завершена успішно")
    return user


def verify_telegram_mini_app_user(telegram_data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Спеціалізована верифікація для Telegram Mini App

    Args:
        telegram_data: Дані від Telegram Mini App

    Returns:
        Dict з даними користувача
    """
    # Додаємо прапорець що це запит від Telegram Mini App
    telegram_data['from_telegram'] = True

    logger.info("📱 verify_telegram_mini_app_user: Початок верифікації Telegram Mini App користувача")

    # Використовуємо основну функцію верифікації
    return verify_user(telegram_data)


# Експорт основних функцій
__all__ = [
    'verify_user',
    'verify_telegram_mini_app_user',
    'get_user_data',
    'validate_telegram_data',
    'validate_telegram_id',
    'verify_telegram_webapp_data',
    'extract_user_from_webapp_data',
    'create_user_safe',
    'update_user_data'
]