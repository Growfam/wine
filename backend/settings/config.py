import os
import sys
import secrets
from pathlib import Path
from dotenv import load_dotenv
import logging

# Налаштування логування
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Знаходимо кореневу директорію проекту
BASE_DIR = Path(__file__).parent.parent.parent

# Завантажуємо змінні оточення з .env файлу в корені проекту
load_dotenv(BASE_DIR / '.env')

# ВИПРАВЛЕНО: Пріоритетно беремо JWT_SECRET з .env файлу
JWT_SECRET = os.getenv("JWT_SECRET", "winix-secure-jwt-secret-key-2025")
JWT_ALGORITHM = "HS256"


# Функція для безпечного отримання змінної оточення
def get_env(key, default=None, required=False, type_cast=None):
    """
    Безпечно отримує змінну оточення з перетворенням типу

    Args:
        key: Ключ змінної оточення
        default: Значення за замовчуванням
        required: Чи обов'язкова змінна (якщо True і немає значення, буде попередження)
        type_cast: Функція для перетворення типу (int, float, bool, тощо)

    Returns:
        Значення змінної або default, якщо змінна не існує
    """
    value = os.environ.get(key, default)

    # Перевірка на обов'язковість
    if required and (value is None or value == ''):
        logger.warning(f"Обов'язкова змінна оточення {key} не встановлена!")
        return default

    # Перетворення типу, якщо вказано
    if type_cast and value is not None:
        try:
            # Особливий випадок для bool
            if type_cast == bool:
                # Якщо value вже є булевим значенням, повертаємо його напряму
                if isinstance(value, bool):
                    return value
                # Інакше, конвертуємо рядок до bool
                return str(value).lower() in ('true', 'yes', '1', 'y', 't')
            return type_cast(value)
        except (ValueError, TypeError):
            logger.warning(f"Не вдалося перетворити значення '{value}' для {key} до типу {type_cast.__name__}")
            return default

    return value


class Config:
    """Базова конфігурація для WINIX проекту"""

    # Базова директорія проекту
    BASE_DIR = BASE_DIR

    # Flask налаштування
    FLASK_APP = get_env('FLASK_APP', 'main.py')
    DEBUG = get_env('FLASK_DEBUG', False, type_cast=bool)
    PORT = get_env('PORT', 8080, type_cast=int)

    # ВИПРАВЛЕНО: Завжди використовуємо SECRET_KEY з .env, якщо є
    SECRET_KEY = get_env('SECRET_KEY')
    if not SECRET_KEY:
        # Перевіряємо альтернативні назви змінних
        for alt_key in ['FLASK_SECRET_KEY', 'APP_SECRET_KEY', 'WINIX_SECRET_KEY']:
            SECRET_KEY = get_env(alt_key)
            if SECRET_KEY:
                logger.info(f"Використовуємо SECRET_KEY з {alt_key}")
                break

        # Якщо все ще немає ключа, генеруємо випадковий
        if not SECRET_KEY:
            SECRET_KEY = secrets.token_hex(32)
            logger.warning("SECRET_KEY не встановлено, використовується випадкове значення")

    # Supabase з'єднання
    SUPABASE_URL = get_env('SUPABASE_URL')
    SUPABASE_KEY = get_env('SUPABASE_ANON_KEY')

    # Налаштування Telegram
    TELEGRAM_BOT_TOKEN = get_env('TELEGRAM_BOT_TOKEN', '')

    # Загальні налаштування WINIX
    DEFAULT_TOKENS_NEW_USER = get_env('DEFAULT_TOKENS_NEW_USER', 0, type_cast=int)
    DEFAULT_WINIX_NEW_USER = get_env('DEFAULT_WINIX_NEW_USER', 0, type_cast=float)
    WINIX_DECIMAL_PLACES = 2

    # Налаштування стейкінгу
    STAKING_MIN_AMOUNT = get_env('STAKING_MIN_AMOUNT', 50, type_cast=int)
    STAKING_PERIODS = [7, 14, 28]  # дні
    STAKING_RATES = {
        7: get_env('STAKING_RATE_7', 4.0, type_cast=float),  # 4% за 7 днів
        14: get_env('STAKING_RATE_14', 9.0, type_cast=float),  # 9% за 14 днів
        28: get_env('STAKING_RATE_28', 15.0, type_cast=float)  # 15% за 28 днів
    }
    STAKING_CANCELLATION_FEE = get_env('STAKING_CANCELLATION_FEE', 0.2, type_cast=float)  # 20% штраф при скасуванні

    # Реферальні налаштування
    REFERRAL_MAX_LEVEL = get_env('REFERRAL_MAX_LEVEL', 2, type_cast=int)
    REFERRAL_REWARD_LEVEL1 = get_env('REFERRAL_REWARD_LEVEL1', 25, type_cast=int)  # жетонів
    REFERRAL_REWARD_LEVEL2 = get_env('REFERRAL_REWARD_LEVEL2', 10, type_cast=int)  # жетонів

    # Налаштування розіграшів
    DEFAULT_RAFFLE_COST = get_env('DEFAULT_RAFFLE_COST', 1, type_cast=int)  # жетонів

    # Налаштування безпеки
    PASSWORD_SALT = get_env('PASSWORD_SALT', secrets.token_hex(16))
    JWT_SECRET = get_env('JWT_SECRET', SECRET_KEY)
    JWT_EXPIRATION = get_env('JWT_EXPIRATION', 86400, type_cast=int)  # 24 години в секундах

    # Кеш і оптимізація
    CACHE_TIMEOUT = get_env('CACHE_TIMEOUT', 300, type_cast=int)  # 5 хвилин в секундах
    CACHE_ENABLED = get_env('CACHE_ENABLED', True, type_cast=bool)

    # Налаштування безпеки паролів
    PASSWORD_MIN_LENGTH = 8
    PASSWORD_HASH_ALGORITHM = 'argon2'  # Використовуємо сучасний алгоритм хешування


class DevelopmentConfig(Config):
    """Конфігурація для розробки"""
    DEBUG = True
    CACHE_TIMEOUT = 60  # 1 хвилина в секундах
    LOG_LEVEL = 'DEBUG'

    # Зменшуємо складність хешування для пришвидшення розробки
    PASSWORD_HASH_ALGORITHM = 'sha256'


class ProductionConfig(Config):
    """Конфігурація для продакшену"""
    DEBUG = False
    PASSWORD_MIN_LENGTH = 10  # Підвищені вимоги до паролів в продакшені
    JWT_EXPIRATION = 43200  # 12 годин в секундах
    LOG_LEVEL = 'ERROR'

    # Перевірка критичних налаштувань
    def __init__(self):
        super().__init__()
        missing_vars = []

        if not self.SECRET_KEY or self.SECRET_KEY == secrets.token_hex(32):
            missing_vars.append("SECRET_KEY")

        if not self.SUPABASE_URL:
            missing_vars.append("SUPABASE_URL")

        if not self.SUPABASE_KEY:
            missing_vars.append("SUPABASE_ANON_KEY")

        if not self.TELEGRAM_BOT_TOKEN:
            missing_vars.append("TELEGRAM_BOT_TOKEN")

        if missing_vars:
            logger.error(f"КРИТИЧНА ПОМИЛКА: У продакшені не налаштовані обов'язкові змінні: {', '.join(missing_vars)}")


class TestingConfig(Config):
    """Конфігурація для тестування"""
    TESTING = True
    DEBUG = True
    LOG_LEVEL = 'DEBUG'

    # Використовуємо швидкі, але менш безпечні хеші для тестування
    PASSWORD_HASH_ALGORITHM = 'sha256'

    # Спеціальні налаштування для тестового середовища
    SUPABASE_URL = get_env('TEST_SUPABASE_URL', 'https://test.supabase.co')
    SUPABASE_KEY = get_env('TEST_SUPABASE_KEY', 'test_key')


# Словник конфігурацій
config_by_name = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': DevelopmentConfig  # Змінено з ProductionConfig, щоб за замовчуванням використовувати режим розробки
}


def get_config():
    """Функція для отримання поточної конфігурації на основі оточення"""
    # Визначаємо оточення
    flask_env = get_env('FLASK_ENV', 'default')

    # Якщо встановлено FLASK_DEBUG=True, використовуємо режим розробки
    if get_env('FLASK_DEBUG', False, type_cast=bool):
        flask_env = 'development'

    # Якщо запущено з -m pytest, використовуємо тестову конфігурацію
    if 'pytest' in sys.modules:
        flask_env = 'testing'

    # Перевіряємо, чи вказане оточення існує в нашому словнику
    if flask_env not in config_by_name:
        logger.warning(f"Невідоме оточення '{flask_env}', використовуємо 'default'")
        flask_env = 'default'

    # Повертаємо відповідну конфігурацію
    config = config_by_name[flask_env]()
    logger.info(f"Завантажено конфігурацію для оточення: {flask_env}")
    return config