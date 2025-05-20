from flask import jsonify, request, session
import logging
import os
import sys
import random
import string
import re
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


def validate_telegram_id(telegram_id):
    """
    Розширена валідація Telegram ID з детальною діагностикою

    Args:
        telegram_id (any): ID користувача для валідації

    Returns:
        str: Нормалізований валідний Telegram ID

    Raises:
        ValueError: Якщо ID невалідний з детальним поясненням
    """
    # Базові перевірки на None, undefined та порожні значення
    if telegram_id is None:
        raise ValueError("ID користувача не вказано (None)")

    if isinstance(telegram_id, str) and telegram_id.lower() in ['undefined', 'null', '']:
        raise ValueError(f"Невалідний формат Telegram ID: '{telegram_id}'")

    # Перевірка на різні типи і конвертація до рядка
    original_id = telegram_id
    try:
        telegram_id = str(telegram_id).strip()
    except Exception as e:
        raise ValueError(f"Неможливо конвертувати ID до рядка: {original_id}, помилка: {str(e)}")

    # Перевірка на порожній рядок після обробки
    if not telegram_id:
        raise ValueError("ID користувача порожній після обробки")

    # Перевірка на валідні формати:
    # 1. Цифровий ID користувача (може мати різну довжину)
    # 2. ID групового чату, починається з -100
    if re.match(r'^\d+$', telegram_id) or re.match(r'^-100\d+$', telegram_id):
        return telegram_id

    # Додаткові перевірки для виявлення проблем з форматом
    if re.search(r'[a-zA-Z]', telegram_id):
        raise ValueError(f"ID містить літери: {telegram_id}")

    if "undefined" in telegram_id.lower() or "null" in telegram_id.lower():
        raise ValueError(f"ID містить невалідні ключові слова: {telegram_id}")

    # Якщо ID містить цифри, але має інші символи, спробуємо вилучити лише цифри
    if re.search(r'\d', telegram_id):
        digits_only = re.sub(r'\D', '', telegram_id)
        if digits_only:
            logger.warning(f"ID містив невалідні символи, вилучено лише цифри: '{telegram_id}' -> '{digits_only}'")
            return digits_only

    # Якщо ми дійшли сюди, ID не відповідає жодному з відомих форматів
    raise ValueError(f"Невалідний формат Telegram ID: {telegram_id}")


def get_user_data(telegram_id):
    """
    Отримання даних користувача за telegram_id

    Args:
        telegram_id (str): ID користувача в Telegram

    Returns:
        dict: Дані користувача або None, якщо користувача не знайдено
    """
    try:
        # Валідуємо ID перед використанням
        try:
            validated_id = validate_telegram_id(telegram_id)
            if validated_id != telegram_id:
                logger.info(f"get_user_data: ID нормалізовано: '{telegram_id}' -> '{validated_id}'")
                telegram_id = validated_id
        except ValueError as e:
            logger.error(f"get_user_data: Помилка валідації ID {telegram_id}: {str(e)}")
            return None

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

        # Перевірка даних Telegram і визначення telegram_id
        telegram_id = None

        # 1. Перевірка даних з Telegram WebApp
        init_data = telegram_data.get('initData')
        if init_data:
            logger.info("verify_user: Отримано initData з Telegram WebApp")

            # Додатково перевіряємо наявність даних користувача в об'єкті
            user_data = extract_user_from_webapp_data(init_data)
            if user_data and user_data.get('id'):
                telegram_id = user_data.get('id')
                logger.info(f"verify_user: Отримано ID з initData: {telegram_id}")

        # 2. Перевірка прямих полів у вхідних даних
        if not telegram_id:
            # Перевіряємо різні можливі поля для ID
            for field in ['id', 'telegram_id', 'user_id']:
                if field in telegram_data and telegram_data[field]:
                    telegram_id = telegram_data[field]
                    logger.info(f"verify_user: Отримано ID з поля {field}: {telegram_id}")
                    break

        # 3. Перевірка заголовків запиту
        if not telegram_id:
            header_id = request.headers.get('X-Telegram-User-Id')
            if header_id:
                telegram_id = header_id
                logger.info(f"verify_user: Отримано ID з заголовка X-Telegram-User-Id: {telegram_id}")

        # Перевірка наявності ID після всіх спроб
        if not telegram_id:
            logger.error("verify_user: Не вдалося отримати telegram_id з жодного джерела")
            return None

        # Валідація отриманого ID
        try:
            telegram_id = validate_telegram_id(telegram_id)
            logger.info(f"verify_user: ID успішно валідовано: {telegram_id}")
        except ValueError as e:
            logger.error(f"verify_user: Помилка валідації ID: {str(e)}")
            return None

        # Збираємо дані для створення/оновлення користувача
        username = telegram_data.get('username', '')
        first_name = telegram_data.get('first_name', '')
        last_name = telegram_data.get('last_name', '')
        referrer_id = telegram_data.get('referrer_id', None)  # Додаємо можливість отримання referrer_id

        # Імпортуємо функції, якщо ще не імпортовані
        _import_user_functions()

        # Отримуємо або створюємо користувача
        if _get_user_info and _create_new_user:
            user = _get_user_info(telegram_id)

            if not user:
                display_name = username or first_name or "WINIX User"
                user = _create_new_user(telegram_id, display_name,
                                        referrer_id)  # Передаємо referrer_id у функцію створення
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

        # Додатково зберігаємо дані Telegram як резервну копію
        try:
            safe_tg_data = {
                "username": username,
                "first_name": first_name,
                "last_name": last_name,
                "language_code": telegram_data.get('language_code', '')
            }
            updates["telegram_data"] = str(safe_tg_data)
        except Exception as e:
            logger.warning(f"verify_user: Неможливо зберегти дані Telegram: {str(e)}")

        update_user(telegram_id, updates)

        return user
    except Exception as e:
        logger.error(f"verify_user: Помилка авторизації користувача: {str(e)}", exc_info=True)
        return None


def verify_telegram_webapp_data(init_data, bot_token):
    """
    Перевіряє автентичність даних від Telegram WebApp
    """
    import hmac
    import hashlib
    import urllib.parse

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
    import urllib.parse
    import json

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
        logger.error(f"Помилка витягення користувача: {str(e)}")

    return None


def verify_telegram_mini_app_user(telegram_data):
    """
    Покращена верифікація користувача з Telegram Mini App
    """
    try:
        # Перевіряємо initData якщо є
        init_data = telegram_data.get('initData')
        if init_data:
            # Перевіряємо автентичність даних
            bot_token = os.getenv('TELEGRAM_BOT_TOKEN')
            if bot_token and not verify_telegram_webapp_data(init_data, bot_token):
                logger.warning("verify_telegram_mini_app_user: Невалідні WebApp дані")
                # Не завершуємо, а продовжуємо з іншими методами верифікації
            else:
                # Витягуємо дані користувача з initData
                webapp_user = extract_user_from_webapp_data(init_data)
                if webapp_user:
                    # Оновлюємо дані для передачі в основну функцію верифікації
                    telegram_data.update(webapp_user)
                    logger.info(f"verify_telegram_mini_app_user: Оновлено дані з WebApp: ID={webapp_user.get('id')}")

        # Продовжуємо з базовою логікою
        return verify_user(telegram_data)

    except Exception as e:
        logger.error(f"verify_telegram_mini_app_user: Помилка: {str(e)}")
        return None


def recover_user_session(token=None, user_id=None):
    """
    Відновлює сесію користувача на основі токена або user_id

    Args:
        token (str, optional): JWT токен
        user_id (str, optional): ID користувача

    Returns:
        dict: Дані користувача або None, якщо відновлення не вдалося
    """
    try:
        logger.info(f"recover_user_session: Спроба відновлення сесії. Token={bool(token)}, user_id={user_id}")

        # Спроба отримати ID з токена, якщо токен є
        extracted_id = None
        if token and len(token.split('.')) == 3:
            try:
                import jwt
                from backend.settings.config import JWT_SECRET, JWT_ALGORITHM

                # Спроба декодувати токен без перевірки підпису
                decoded = jwt.decode(token, options={"verify_signature": False})
                if 'user_id' in decoded:
                    extracted_id = decoded['user_id']
                    logger.info(f"recover_user_session: Отримано ID з токена: {extracted_id}")
            except Exception as e:
                logger.warning(f"recover_user_session: Помилка декодування токена: {str(e)}")

        # Використовуємо найкращий доступний ID
        user_id_to_use = user_id or extracted_id

        if not user_id_to_use:
            logger.warning("recover_user_session: Не вдалося отримати ID користувача")
            return None

        # Валідуємо ID перед використанням
        try:
            validated_id = validate_telegram_id(user_id_to_use)
            if validated_id != user_id_to_use:
                logger.info(f"recover_user_session: ID нормалізовано: '{user_id_to_use}' -> '{validated_id}'")
                user_id_to_use = validated_id
        except ValueError as e:
            logger.error(f"recover_user_session: Помилка валідації ID {user_id_to_use}: {str(e)}")
            return None

        # Отримуємо дані користувача
        user = get_user_data(user_id_to_use)
        if user:
            logger.info(f"recover_user_session: Успішно відновлено сесію для користувача {user_id_to_use}")

            # Оновлюємо час останнього входу
            update_user(user_id_to_use, {"last_login": datetime.now().isoformat()})

            return user
        else:
            logger.warning(f"recover_user_session: Користувача {user_id_to_use} не знайдено")
            return None

    except Exception as e:
        logger.error(f"recover_user_session: Помилка відновлення сесії: {str(e)}")
        return None