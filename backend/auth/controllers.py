from flask import jsonify, request, session
import logging
import os
import sys
import random
import string
import importlib
from datetime import datetime

# Налаштування логування
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Імпортуємо модулі за допомогою абсолютних імпортів
try:
    from backend.supabase_client import get_user, update_user
except ImportError:
    # Це для зворотної сумісності - залишаємо на час перехідного періоду
    current_dir = os.path.dirname(os.path.abspath(__file__))
    parent_dir = os.path.dirname(current_dir)
    if parent_dir not in sys.path:
        sys.path.append(parent_dir)
    from supabase_client import get_user, update_user

# Глобальні змінні для імпортованих функцій
_get_user_info = None
_create_new_user = None


def _import_user_functions():
    """Завантаження функцій з users.controllers"""
    global _get_user_info, _create_new_user

    if _get_user_info is not None and _create_new_user is not None:
        return  # Функції вже імпортовані

    try:
        # Спроба абсолютного імпорту
        from backend.users.controllers import get_user_info, create_new_user
        _get_user_info = get_user_info
        _create_new_user = create_new_user
    except ImportError:
        # Запасний варіант з використанням importlib
        try:
            current_dir = os.path.dirname(os.path.abspath(__file__))
            parent_dir = os.path.dirname(current_dir)
            spec_users = importlib.util.spec_from_file_location(
                "users_controllers",
                os.path.join(parent_dir, "users", "controllers.py")
            )
            users_module = importlib.util.module_from_spec(spec_users)
            spec_users.loader.exec_module(users_module)
            _get_user_info = users_module.get_user_info
            _create_new_user = users_module.create_new_user
        except Exception as e:
            logger.error(f"Помилка імпорту функцій users.controllers: {str(e)}")
            # Якщо не вдалося імпортувати, використовуємо get_user з supabase_client
            _get_user_info = get_user
            _create_new_user = None


def get_user_data(telegram_id):
    """
    Отримання даних користувача за telegram_id

    Args:
        telegram_id (str): ID користувача в Telegram

    Returns:
        dict: Дані користувача або None, якщо користувача не знайдено
    """
    try:
        # Імпортуємо функції, якщо ще не імпортовані
        _import_user_functions()

        # Використовуємо імпортовану функцію get_user_info
        if _get_user_info:
            return _get_user_info(telegram_id)
        else:
            # Запасний варіант, якщо не вдалося імпортувати get_user_info
            return get_user(telegram_id)
    except Exception as e:
        logger.error(f"get_user_data: Помилка отримання даних користувача {telegram_id}: {str(e)}")
        return None


def verify_user(telegram_data):
    """
    Перевіряє дані Telegram WebApp та авторизує користувача
    """
    try:
        logger.info(f"verify_user: Початок верифікації користувача.")

        # Перевірка initData з Telegram WebApp (якщо надіслано)
        init_data = telegram_data.get('initData')
        if init_data:
            # Тут можна додати логіку перевірки підпису initData
            # Для безпеки можна використовувати бібліотеку для перевірки HMAC
            logger.info("verify_user: Отримано initData з Telegram WebApp")

        telegram_id = telegram_data.get('id')
        username = telegram_data.get('username', '')
        first_name = telegram_data.get('first_name', '')
        last_name = telegram_data.get('last_name', '')

        # Додаткова логіка для роботи з різними форматами даних
        if not telegram_id and 'telegram_id' in telegram_data:
            telegram_id = telegram_data.get('telegram_id')

        header_id = request.headers.get('X-Telegram-User-Id')
        if header_id:
            telegram_id = header_id

        if not telegram_id:
            logger.error("verify_user: Не вдалося отримати telegram_id")
            return None

        # Конвертація ID в рядок
        telegram_id = str(telegram_id)

        # Імпортуємо функції, якщо ще не імпортовані
        _import_user_functions()

        if _get_user_info and _create_new_user:
            user = _get_user_info(telegram_id)

            if not user:
                display_name = username or first_name or "WINIX User"
                user = _create_new_user(telegram_id, display_name)
                if not user:
                    logger.error(f"verify_user: Помилка створення користувача: {telegram_id}")
                    return None
        else:
            # Запасний варіант, якщо функції не доступні
            user = get_user(telegram_id)
            if not user:
                logger.error(f"verify_user: Користувача {telegram_id} не знайдено і функція create_new_user недоступна")
                return None

        # Оновлюємо час останнього входу і мову користувача
        updates = {"last_login": datetime.now().isoformat()}

        # Додаємо мову, якщо вона є в запиті
        if 'language_code' in telegram_data:
            updates["language"] = telegram_data.get('language_code')

        update_user(telegram_id, updates)

        return user
    except Exception as e:
        logger.error(f"verify_user: Помилка авторизації користувача: {str(e)}", exc_info=True)
        return None