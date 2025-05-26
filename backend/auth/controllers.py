"""
Контролери для автентифікації користувачів WINIX
ВИПРАВЛЕНА версія з покращеними імпортами та обробкою помилок
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

# Безпечні імпорти Supabase
try:
    from supabase_client import get_user, update_user, supabase

    SUPABASE_AVAILABLE = True
    logger.info("✅ Supabase client завантажено")
except ImportError as e:
    logger.warning(f"⚠️ Supabase client недоступний: {e}")
    SUPABASE_AVAILABLE = False
    get_user = None
    update_user = None
    supabase = None

# Безпечні імпорти users контролерів
try:
    from users.controllers import get_user_info, create_new_user

    USERS_CONTROLLERS_AVAILABLE = True
    logger.info("✅ Users controllers завантажено")
except ImportError as e:
    logger.warning(f"⚠️ Users controllers недоступні: {e}")
    USERS_CONTROLLERS_AVAILABLE = False
    get_user_info = None
    create_new_user = None

# Константи та regex паттерни
USER_ID_PATTERN = re.compile(r'^\d+$')
USERNAME_PATTERN = re.compile(r'^[a-zA-Z0-9_]{3,32}$')
BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN')


def validate_telegram_data(data: Dict[str, Any]) -> bool:
    """
    Валідація даних від Telegram

    Args:
        data: Дані користувача від Telegram

    Returns:
        bool: True якщо дані валідні
    """
    try:
        # Перевіряємо обов'язкові поля
        user_id = data.get('id') or data.get('telegram_id')
        if not user_id:
            logger.warning("Відсутній user ID в даних")
            return False

        # Перевіряємо формат ID
        if not USER_ID_PATTERN.match(str(user_id)):
            logger.warning(f"Невалідний формат user ID: {user_id}")
            return False

        # Перевіряємо розумні межі ID
        try:
            id_int = int(user_id)
            if id_int <= 0 or id_int > 999999999999:  # Telegram ID межі
                logger.warning(f"User ID поза допустимими межами: {id_int}")
                return False
        except (ValueError, OverflowError):
            return False

        # Перевіряємо username якщо є
        username = data.get('username')
        if username and not USERNAME_PATTERN.match(username):
            logger.warning(f"Невалідний формат username: {username}")
            return False

        # Перевіряємо first_name якщо є
        first_name = data.get('first_name', '')
        if first_name and len(first_name.strip()) > 100:
            logger.warning("First name занадто довгий")
            return False

        return True

    except Exception as e:
        logger.error(f"Помилка валідації Telegram даних: {str(e)}")
        return False


def verify_telegram_webapp_data(init_data: str, bot_token: str) -> bool:
    """
    Перевіряє автентичність даних від Telegram WebApp

    Args:
        init_data: Дані ініціалізації від Telegram
        bot_token: Токен бота

    Returns:
        bool: True якщо дані автентичні
    """
    try:
        if not init_data or not bot_token:
            return False

        # Розбираємо init_data
        parsed_data = urllib.parse.parse_qs(init_data)

        # Отримуємо hash та видаляємо його з даних
        received_hash = parsed_data.get('hash', [None])[0]
        if not received_hash:
            return False

        # Створюємо рядок для перевірки
        auth_items = []
        for key, value in parsed_data.items():
            if key != 'hash':
                auth_items.append(f"{key}={value[0]}")

        auth_string = '\n'.join(sorted(auth_items))

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
        return hmac.compare_digest(received_hash, calculated_hash)

    except Exception as e:
        logger.error(f"Помилка перевірки Telegram WebApp data: {str(e)}")
        return False


def extract_user_from_webapp_data(init_data: str) -> Optional[Dict[str, Any]]:
    """
    Витягує дані користувача з init_data

    Args:
        init_data: Дані ініціалізації від Telegram

    Returns:
        Dict з даними користувача або None
    """
    try:
        if not init_data:
            return None

        parsed_data = urllib.parse.parse_qs(init_data)
        user_data = parsed_data.get('user', [None])[0]

        if user_data:
            user_info = json.loads(user_data)
            return {
                'id': user_info.get('id'),
                'username': user_info.get('username'),
                'first_name': user_info.get('first_name'),
                'last_name': user_info.get('last_name'),
                'language_code': user_info.get('language_code')
            }
    except Exception as e:
        logger.error(f"Помилка витягування користувача: {str(e)}")

    return None


def get_user_data(telegram_id: str) -> Optional[Dict[str, Any]]:
    """
    Отримання даних користувача за telegram_id

    Args:
        telegram_id: ID користувача в Telegram

    Returns:
        Dict з даними користувача або None
    """
    try:
        telegram_id = str(telegram_id)

        # Спочатку пробуємо через users.controllers
        if USERS_CONTROLLERS_AVAILABLE and get_user_info:
            try:
                user_data = get_user_info(telegram_id)
                if user_data:
                    logger.info(f"Користувач {telegram_id} знайдений через users.controllers")
                    return user_data
            except Exception as e:
                logger.warning(f"Помилка в get_user_info: {str(e)}")

        # Fallback через supabase_client
        if SUPABASE_AVAILABLE and get_user:
            try:
                user_data = get_user(telegram_id)
                if user_data:
                    logger.info(f"Користувач {telegram_id} знайдений через supabase_client")
                    return user_data
            except Exception as e:
                logger.warning(f"Помилка в get_user: {str(e)}")

        # Останній fallback - пряме звернення до Supabase
        if SUPABASE_AVAILABLE and supabase:
            try:
                response = supabase.table("winix").select("*").eq("telegram_id", telegram_id).execute()
                if response.data and len(response.data) > 0:
                    user_data = response.data[0]
                    logger.info(f"Користувач {telegram_id} знайдений через прямий Supabase запит")
                    return user_data
            except Exception as e:
                logger.warning(f"Помилка прямого Supabase запиту: {str(e)}")

        logger.info(f"Користувач {telegram_id} не знайдений в базі")
        return None

    except Exception as e:
        logger.error(f"Критична помилка отримання даних користувача {telegram_id}: {str(e)}")
        return None


def create_user_safe(telegram_id: str, display_name: str, referrer_id: Optional[str] = None) -> Optional[
    Dict[str, Any]]:
    """
    Безпечне створення користувача з fallback механізмами

    Args:
        telegram_id: ID користувача в Telegram
        display_name: Відображуване ім'я
        referrer_id: ID реферера (опціонально)

    Returns:
        Dict з даними створеного користувача або None
    """
    try:
        telegram_id = str(telegram_id)

        # Спочатку пробуємо через users.controllers
        if USERS_CONTROLLERS_AVAILABLE and create_new_user:
            try:
                user_data = create_new_user(telegram_id, display_name, referrer_id)
                if user_data:
                    logger.info(f"✅ Користувач {telegram_id} створений через users.controllers")
                    user_data['is_new_user'] = True
                    return user_data
            except Exception as e:
                logger.warning(f"Помилка в create_new_user: {str(e)}")

        # Fallback - створення через прямий Supabase запит
        if SUPABASE_AVAILABLE and supabase:
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
                if referrer_id and referrer_id != telegram_id:
                    new_user_data["referrer_id"] = referrer_id

                # Створюємо користувача
                response = supabase.table("winix").insert(new_user_data).execute()

                if response.data and len(response.data) > 0:
                    created_user = response.data[0]
                    created_user['is_new_user'] = True
                    logger.info(f"✅ Користувач {telegram_id} створений через прямий Supabase запит")
                    return created_user
                else:
                    logger.error(f"❌ Не вдалося створити користувача {telegram_id} - порожня відповідь")
                    return None

            except Exception as e:
                logger.error(f"Помилка прямого створення користувача: {str(e)}")
                return None

        logger.error(f"❌ Всі методи створення користувача {telegram_id} провалилися")
        return None

    except Exception as e:
        logger.error(f"Критична помилка створення користувача {telegram_id}: {str(e)}")
        return None


def update_user_data(telegram_id: str, updates: Dict[str, Any]) -> bool:
    """
    Оновлення даних користувача

    Args:
        telegram_id: ID користувача
        updates: Дані для оновлення

    Returns:
        bool: True якщо оновлення успішне
    """
    try:
        telegram_id = str(telegram_id)

        # Спочатку пробуємо через update_user
        if SUPABASE_AVAILABLE and update_user:
            try:
                result = update_user(telegram_id, updates)
                if result:
                    logger.info(f"Дані користувача {telegram_id} оновлено через update_user")
                    return True
            except Exception as e:
                logger.warning(f"Помилка в update_user: {str(e)}")

        # Fallback через прямий Supabase запит
        if SUPABASE_AVAILABLE and supabase:
            try:
                response = supabase.table("winix").update(updates).eq("telegram_id", telegram_id).execute()
                if response.data:
                    logger.info(f"Дані користувача {telegram_id} оновлено через прямий Supabase запит")
                    return True
            except Exception as e:
                logger.warning(f"Помилка прямого оновлення: {str(e)}")

        logger.error(f"Не вдалося оновити дані користувача {telegram_id}")
        return False

    except Exception as e:
        logger.error(f"Критична помилка оновлення користувача {telegram_id}: {str(e)}")
        return False


def verify_user(telegram_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    ГОЛОВНА функція верифікації користувача

    Args:
        telegram_data: Дані від Telegram

    Returns:
        Dict з даними користувача або None
    """
    try:
        logger.info("🔐 verify_user: Початок верифікації користувача")

        # Перевірка initData з Telegram WebApp
        init_data = telegram_data.get('initData')
        is_valid_telegram_request = False

        if init_data:
            logger.info("📱 verify_user: Отримано initData з Telegram WebApp")

            # Якщо є токен бота, перевіряємо підпис
            if BOT_TOKEN:
                is_valid_telegram_request = verify_telegram_webapp_data(init_data, BOT_TOKEN)
                if not is_valid_telegram_request:
                    logger.warning("⚠️ verify_user: Невалідний підпис initData")
                else:
                    logger.info("✅ verify_user: Підпис initData валідний")
            else:
                # Якщо немає токена, довіряємо наявності initData
                is_valid_telegram_request = True
                logger.warning("⚠️ verify_user: TELEGRAM_BOT_TOKEN не налаштовано")

            # Витягуємо дані користувача з initData
            if is_valid_telegram_request:
                webapp_user = extract_user_from_webapp_data(init_data)
                if webapp_user:
                    telegram_data.update(webapp_user)
                    logger.info("📝 verify_user: Дані користувача витягнуто з initData")

        # Отримуємо ID користувача
        telegram_id = telegram_data.get('id') or telegram_data.get('telegram_id')

        # Перевірка заголовків
        header_id = request.headers.get('X-Telegram-User-Id') if request else None
        if header_id:
            telegram_id = header_id
            is_valid_telegram_request = True
            logger.info("📡 verify_user: ID отримано з заголовка X-Telegram-User-Id")

        # Додаткова перевірка для Telegram Mini App
        if telegram_data.get('from_telegram'):
            is_valid_telegram_request = True
            logger.info("🔵 verify_user: Позначено як запит від Telegram")

        if not telegram_id:
            logger.error("❌ verify_user: Не вдалося отримати telegram_id")
            return None

        # Валідація даних
        if not validate_telegram_data(telegram_data):
            logger.error("❌ verify_user: Невалідні дані користувача")
            return None

        telegram_id = str(telegram_id)
        logger.info(f"👤 verify_user: Обробка користувача {telegram_id}")

        # Перевіряємо існування користувача
        user = get_user_data(telegram_id)

        if not user:
            # Створюємо ТІЛЬКИ якщо це валідний запит від Telegram
            if not is_valid_telegram_request:
                logger.error(f"❌ verify_user: Користувач {telegram_id} не існує і запит не від Telegram")
                return None

            logger.info(f"🆕 verify_user: Створюємо нового користувача {telegram_id}")

            # Підготовка даних для створення
            username = telegram_data.get('username', '')
            first_name = telegram_data.get('first_name', '')
            display_name = username or first_name or f"User_{telegram_id[-4:]}"
            referrer_id = telegram_data.get('referrer_id')

            # Створюємо користувача
            user = create_user_safe(telegram_id, display_name, referrer_id)

            if not user:
                logger.error(f"❌ verify_user: Не вдалося створити користувача {telegram_id}")
                return None

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

        logger.info(f"🎉 verify_user: Верифікація користувача {telegram_id} завершена успішно")
        return user

    except Exception as e:
        logger.error(f"💥 verify_user: Критична помилка авторизації: {str(e)}", exc_info=True)
        return None


def verify_telegram_mini_app_user(telegram_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Спеціалізована верифікація для Telegram Mini App

    Args:
        telegram_data: Дані від Telegram Mini App

    Returns:
        Dict з даними користувача або None
    """
    try:
        # Додаємо прапорець що це запит від Telegram Mini App
        telegram_data['from_telegram'] = True

        logger.info("📱 verify_telegram_mini_app_user: Початок верифікації Telegram Mini App користувача")

        # Використовуємо основну функцію верифікації
        result = verify_user(telegram_data)

        if result:
            logger.info("✅ verify_telegram_mini_app_user: Верифікація Mini App успішна")
        else:
            logger.error("❌ verify_telegram_mini_app_user: Верифікація Mini App провалена")

        return result

    except Exception as e:
        logger.error(f"💥 verify_telegram_mini_app_user: Помилка: {str(e)}")
        return None


def create_mock_user(telegram_id: str, data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Створює мок-користувача для тестування

    Args:
        telegram_id: ID користувача
        data: Дані користувача

    Returns:
        Dict з мок-даними користувача
    """
    return {
        'telegram_id': telegram_id,
        'username': data.get('username', f'user_{telegram_id}'),
        'first_name': data.get('first_name', 'Test User'),
        'balance': 0,
        'coins': 0,
        'is_new_user': True,
        'created_at': datetime.now(timezone.utc).isoformat(),
        'mock_user': True
    }


# Експорт основних функцій
__all__ = [
    'verify_user',
    'verify_telegram_mini_app_user',
    'get_user_data',
    'validate_telegram_data',
    'verify_telegram_webapp_data',
    'extract_user_from_webapp_data'
]