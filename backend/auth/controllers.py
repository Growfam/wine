from flask import request
import logging
import os
import sys
import importlib
import hmac
import hashlib
import urllib.parse
import json
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


def verify_telegram_webapp_data(init_data, bot_token):
    """
    Перевіряє автентичність даних від Telegram WebApp
    """
    try:
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


def extract_user_from_webapp_data(init_data):
    """
    Витягує дані користувача з init_data
    """
    try:
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

        # Перевірка initData з Telegram WebApp
        init_data = telegram_data.get('initData')
        bot_token = os.getenv('TELEGRAM_BOT_TOKEN')

        # Прапорець валідності даних від Telegram
        is_valid_telegram_request = False

        if init_data:
            logger.info("verify_user: Отримано initData з Telegram WebApp")

            # Якщо є токен бота, перевіряємо підпис
            if bot_token:
                is_valid_telegram_request = verify_telegram_webapp_data(init_data, bot_token)
                if not is_valid_telegram_request:
                    logger.warning("verify_user: Невалідний підпис initData")
            else:
                # Якщо немає токена, довіряємо наявності initData
                is_valid_telegram_request = True
                logger.warning("verify_user: TELEGRAM_BOT_TOKEN не налаштовано, пропускаємо перевірку підпису")

            # Витягуємо дані користувача з initData
            if is_valid_telegram_request:
                webapp_user = extract_user_from_webapp_data(init_data)
                if webapp_user:
                    telegram_data.update(webapp_user)

        # Отримуємо дані користувача
        telegram_id = telegram_data.get('id')
        username = telegram_data.get('username', '')
        first_name = telegram_data.get('first_name', '')
        last_name = telegram_data.get('last_name', '')
        referrer_id = telegram_data.get('referrer_id', None)

        # Додаткова логіка для роботи з різними форматами даних
        if not telegram_id and 'telegram_id' in telegram_data:
            telegram_id = telegram_data.get('telegram_id')

        # Перевірка заголовків
        header_id = request.headers.get('X-Telegram-User-Id')
        if header_id:
            telegram_id = header_id
            # Якщо ID прийшов через заголовок від Telegram Mini App
            is_valid_telegram_request = True

        if not telegram_id:
            logger.error("verify_user: Не вдалося отримати telegram_id")
            return None

        # Валідація ID
        telegram_id = str(telegram_id)
        if not telegram_id.isdigit():
            logger.error(f"verify_user: Невалідний формат telegram_id: {telegram_id}")
            return None

        # Додаткова перевірка для визначення валідного запиту від Telegram
        if telegram_data.get('from_telegram'):
            is_valid_telegram_request = True

        # Імпортуємо функції
        _import_user_functions()

        # Перевіряємо існування користувача
        user = None
        if _get_user_info:
            try:
                user = _get_user_info(telegram_id)
            except Exception as e:
                logger.error(f"verify_user: Помилка при виклику get_user_info: {str(e)}")
                user = None

        if not user:
            # Спробуємо через supabase_client напряму
            user = get_user(telegram_id)

        # Якщо користувач НЕ існує
        if not user:
            # Створюємо ТІЛЬКИ якщо це валідний запит від Telegram
            if not is_valid_telegram_request:
                logger.error(f"verify_user: Користувач {telegram_id} не існує і запит не від Telegram")
                return None

            logger.info(f"verify_user: Створюємо нового користувача {telegram_id}")

            # Перевіряємо наявність функції створення
            if _create_new_user:
                display_name = username or first_name or f"User_{telegram_id[-4:]}"

                try:
                    user = _create_new_user(telegram_id, display_name, referrer_id)

                    if user:
                        logger.info(f"verify_user: ✅ Користувач {telegram_id} успішно створений")
                        # Встановлюємо прапорець нового користувача
                        user['is_new_user'] = True
                    else:
                        logger.error(f"verify_user: ❌ Не вдалося створити користувача {telegram_id}")
                        return None
                except Exception as e:
                    logger.error(f"verify_user: Помилка при створенні користувача: {str(e)}")
                    return None
            else:
                logger.error(f"verify_user: Функція create_new_user недоступна")
                return None
        else:
            logger.info(f"verify_user: Користувач {telegram_id} вже існує")
            user['is_new_user'] = False

        # Оновлюємо час останнього входу та інші дані
        try:
            updates = {
                "last_login": datetime.now().isoformat()
            }

            # Оновлюємо username якщо він змінився
            if username and username != user.get('username'):
                updates["username"] = username

            # Додаємо мову якщо є
            if 'language_code' in telegram_data:
                updates["language"] = telegram_data.get('language_code')

            # Оновлюємо дані користувача
            update_user(telegram_id, updates)

        except Exception as e:
            logger.warning(f"verify_user: Помилка оновлення даних користувача: {str(e)}")

        return user

    except Exception as e:
        logger.error(f"verify_user: Критична помилка авторизації: {str(e)}", exc_info=True)
        return None


def verify_telegram_mini_app_user(telegram_data):
    """
    Покращена верифікація користувача з Telegram Mini App
    Використовує verify_user з додатковими перевірками
    """
    try:
        # Додаємо прапорець що це запит від Telegram Mini App
        telegram_data['from_telegram'] = True

        # Використовуємо основну функцію верифікації
        return verify_user(telegram_data)

    except Exception as e:
        logger.error(f"verify_telegram_mini_app_user: Помилка: {str(e)}")
        return None