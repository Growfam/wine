from flask import jsonify, request, session
import logging
import os
import sys
import random
import string
import importlib
import traceback
from datetime import datetime

# Налаштування логування
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Додаємо шляхи до sys.path для правильного імпорту
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
root_dir = os.path.dirname(parent_dir)

paths_to_add = [
    current_dir,
    parent_dir,
    root_dir,
    os.path.join(parent_dir, 'referrals')
]

for path in paths_to_add:
    if path not in sys.path and os.path.exists(path):
        sys.path.append(path)
        logger.debug(f"Додано до sys.path: {path}")

# Імпортуємо модулі за допомогою абсолютних імпортів
try:
    from backend.supabase_client import get_user, update_user
except ImportError:
    # Це для зворотної сумісності - залишаємо на час перехідного періоду
    try:
        from supabase_client import get_user, update_user
    except ImportError as e:
        logger.error(f"Помилка імпорту supabase_client: {str(e)}")


        # Якщо не вдалося імпортувати, встановлюємо заглушки
        def get_user(telegram_id):
            return None


        def update_user(telegram_id, data):
            return None

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
        logger.info("Успішний імпорт функцій з backend.users.controllers")
    except ImportError:
        # Спроба відносного імпорту
        try:
            from users.controllers import get_user_info, create_new_user
            _get_user_info = get_user_info
            _create_new_user = create_new_user
            logger.info("Успішний імпорт функцій з users.controllers")
        except ImportError:
            # Запасний варіант з використанням importlib
            try:
                user_controllers_path = os.path.join(parent_dir, "users", "controllers.py")
                if os.path.exists(user_controllers_path):
                    spec_users = importlib.util.spec_from_file_location(
                        "users_controllers", user_controllers_path
                    )
                    users_module = importlib.util.module_from_spec(spec_users)
                    spec_users.loader.exec_module(users_module)
                    _get_user_info = users_module.get_user_info
                    _create_new_user = users_module.create_new_user
                    logger.info("Успішний імпорт функцій через importlib")
                else:
                    logger.warning(f"Файл controllers.py не знайдено за шляхом: {user_controllers_path}")
            except Exception as e:
                logger.error(f"Помилка імпорту функцій users.controllers: {str(e)}")
                logger.error(f"Stacktrace: {traceback.format_exc()}")
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

        # Переконуємося, що telegram_id - це рядок
        telegram_id = str(telegram_id)

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
        referrer_id = telegram_data.get('referrer_id')  # Додаємо явне отримання referrer_id

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
        logger.info(f"verify_user: Обробка користувача з ID {telegram_id}, referrer_id: {referrer_id}")

        # Імпортуємо функції, якщо ще не імпортовані
        _import_user_functions()

        # Спроба імпорту контролерів реферальної системи
        referral_controller = None
        bonus_controller = None

        try:
            # Перша спроба імпорту
            from referrals.controllers.referral_controller import ReferralController
            from referrals.controllers.bonus_controller import BonusController
            referral_controller = ReferralController
            bonus_controller = BonusController
            logger.info("verify_user: Успішний імпорт контролерів реферальної системи")
        except ImportError:
            try:
                # Друга спроба імпорту
                from backend.referrals.controllers.referral_controller import ReferralController
                from backend.referrals.controllers.bonus_controller import BonusController
                referral_controller = ReferralController
                bonus_controller = BonusController
                logger.info("verify_user: Успішний імпорт контролерів через backend")
            except ImportError as e:
                logger.warning(f"verify_user: Не вдалося імпортувати контролери реферальної системи: {str(e)}")

        if _get_user_info and _create_new_user:
            user = _get_user_info(telegram_id)

            if not user:
                # Створюємо нового користувача з можливим referrer_id
                display_name = username or first_name or "WINIX User"
                user = _create_new_user(telegram_id, display_name, referrer_id)

                if not user:
                    logger.error(f"verify_user: Помилка створення користувача: {telegram_id}")
                    return None

                # Якщо користувач був успішно створений і є referrer_id,
                # але в supabase_client.py не вдалося створити реферальний зв'язок,
                # спробуємо створити його тут
                if user and referrer_id and referral_controller and bonus_controller:
                    try:
                        logger.info(
                            f"verify_user: Повторна спроба створення реферального зв'язку: {referrer_id} -> {telegram_id}")

                        # Створюємо реферальний зв'язок
                        ref_result = referral_controller.register_referral(
                            referrer_id=str(referrer_id),
                            referee_id=str(telegram_id)
                        )

                        if ref_result.get('success', False):
                            logger.info(f"verify_user: Реферальний зв'язок успішно створено")

                            # Нараховуємо бонус
                            bonus_result = bonus_controller.award_direct_bonus(
                                referrer_id=str(referrer_id),
                                referee_id=str(telegram_id)
                            )

                            if bonus_result.get('success', False):
                                logger.info(f"verify_user: Бонус успішно нараховано")

                                # Оновлюємо баланс реферера через supabase_client
                                referrer_user = get_user(str(referrer_id))
                                if referrer_user:
                                    current_balance = float(referrer_user.get('balance', 0))
                                    new_balance = current_balance + 50

                                    update_user(str(referrer_id), {
                                        "balance": new_balance,
                                        "updated_at": datetime.now().isoformat()
                                    })

                                    logger.info(
                                        f"verify_user: Баланс реферера оновлено з {current_balance} на {new_balance}")
                    except Exception as e:
                        logger.error(f"verify_user: Помилка створення реферального зв'язку: {str(e)}")
                        logger.error(traceback.format_exc())
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

            # Перевіряємо наявність start параметра, який може містити referrer_id
            start_param = parsed_data.get('start_param', [None])[0]

            user_dict = {
                'id': user_info.get('id'),
                'username': user_info.get('username'),
                'first_name': user_info.get('first_name'),
                'last_name': user_info.get('last_name'),
                'language_code': user_info.get('language_code')
            }

            # Додаємо referrer_id, якщо є
            if start_param:
                user_dict['referrer_id'] = start_param
                logger.info(f"extract_user_from_webapp_data: Знайдено referrer_id: {start_param}")

            return user_dict
    except Exception as e:
        logger.error(f"Помилка витягення користувача: {str(e)}")
        logger.error(traceback.format_exc())

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
            if not verify_telegram_webapp_data(init_data, bot_token):
                logger.warning("verify_telegram_mini_app_user: Невалідні WebApp дані")
                return None

            # Витягуємо дані користувача
            webapp_user = extract_user_from_webapp_data(init_data)
            if webapp_user:
                telegram_data.update(webapp_user)

                # Логуємо якщо є referrer_id
                if 'referrer_id' in webapp_user:
                    logger.info(f"verify_telegram_mini_app_user: Отримано referrer_id: {webapp_user['referrer_id']}")

        # Продовжуємо з базовою логікою
        return verify_user(telegram_data)

    except Exception as e:
        logger.error(f"verify_telegram_mini_app_user: Помилка: {str(e)}")
        logger.error(traceback.format_exc())
        return None