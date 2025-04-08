from flask import jsonify, request, session
import logging
import os
import importlib.util
import random
import string
from datetime import datetime

# Налаштування логування
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Імпортуємо supabase_client.py напряму
current_dir = os.path.dirname(os.path.abspath(__file__))  # папка auth
parent_dir = os.path.dirname(current_dir)  # папка backend

# Використання importlib для імпорту модуля з абсолютного шляху
spec = importlib.util.spec_from_file_location("supabase_client", os.path.join(parent_dir, "supabase_client.py"))
supabase_client = importlib.util.module_from_spec(spec)
spec.loader.exec_module(supabase_client)

# Витягуємо необхідні функції з модуля
get_user = supabase_client.get_user
update_user = supabase_client.update_user


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

        spec_users = importlib.util.spec_from_file_location("users_controllers",
                                                            os.path.join(parent_dir, "users", "controllers.py"))
        users_module = importlib.util.module_from_spec(spec_users)
        spec_users.loader.exec_module(users_module)
        get_user_info = users_module.get_user_info
        create_new_user = users_module.create_new_user

        user = get_user_info(telegram_id)

        if not user:
            display_name = username or first_name or "WINIX User"
            user = create_new_user(telegram_id, display_name)
            if not user:
                logger.error(f"verify_user: Помилка створення користувача: {telegram_id}")
                return None

        # Оновлюємо час останнього входу і мову користувача
        from datetime import datetime
        updates = {"last_login": datetime.now().isoformat()}

        # Додаємо мову, якщо вона є в запиті
        if 'language_code' in telegram_data:
            updates["language"] = telegram_data.get('language_code')

        update_user(telegram_id, updates)

        return user
    except Exception as e:
        logger.error(f"verify_user: Помилка авторизації користувача: {str(e)}", exc_info=True)
        return None