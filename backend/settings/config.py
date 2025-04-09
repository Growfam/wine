import os
import sys
import secrets
from pathlib import Path
from dotenv import load_dotenv

# Знаходимо кореневу директорію проекту
BASE_DIR = Path(__file__).parent.parent.parent

# Завантажуємо змінні оточення з .env файлу в корені проекту
load_dotenv(BASE_DIR / '.env')


class Config:
    """Базова конфігурація для WINIX проекту"""

    # Базова директорія проекту
    BASE_DIR = BASE_DIR

    # Flask налаштування
    FLASK_APP = os.environ.get('FLASK_APP', 'main.py')
    DEBUG = os.environ.get('FLASK_DEBUG', 'False').lower() == 'true'
    PORT = int(os.environ.get('PORT', 8080))

    # Секретний ключ для сесій Flask - генеруємо рандомно, якщо не вказано
    SECRET_KEY = os.environ.get('SECRET_KEY')
    if not SECRET_KEY:
        # В production режимі викидаємо помилку, якщо не вказано SECRET_KEY
        if os.environ.get('FLASK_ENV') == 'production':
            raise ValueError(
                "SECRET_KEY must be set for production! Set the SECRET_KEY environment variable."
            )
        # Для розробки генеруємо випадковий ключ
        SECRET_KEY = secrets.token_hex(32)

    # Supabase з'єднання
    SUPABASE_URL = os.environ.get('SUPABASE_URL')
    SUPABASE_KEY = os.environ.get('SUPABASE_ANON_KEY')

    # Перевірка критичних змінних оточення
    if not SUPABASE_URL or not SUPABASE_KEY:
        if os.environ.get('FLASK_ENV') == 'production':
            raise ValueError(
                "SUPABASE_URL and SUPABASE_ANON_KEY must be set for production!"
            )

    # Налаштування Telegram
    TELEGRAM_BOT_TOKEN = os.environ.get('TELEGRAM_BOT_TOKEN', '')
    if not TELEGRAM_BOT_TOKEN and os.environ.get('FLASK_ENV') == 'production':
        raise ValueError(
            "TELEGRAM_BOT_TOKEN must be set for production!"
        )

    # Загальні налаштування WINIX
    DEFAULT_TOKENS_NEW_USER = int(os.environ.get('DEFAULT_TOKENS_NEW_USER', 0))
    DEFAULT_WINIX_NEW_USER = float(os.environ.get('DEFAULT_WINIX_NEW_USER', 0))
    WINIX_DECIMAL_PLACES = 2

    # Налаштування стейкінгу
    STAKING_MIN_AMOUNT = int(os.environ.get('STAKING_MIN_AMOUNT', 50))
    STAKING_PERIODS = [7, 14, 28]  # дні
    STAKING_RATES = {
        7: float(os.environ.get('STAKING_RATE_7', 4.0)),  # 4% за 7 днів
        14: float(os.environ.get('STAKING_RATE_14', 9.0)),  # 9% за 14 днів
        28: float(os.environ.get('STAKING_RATE_28', 15.0))  # 15% за 28 днів
    }
    STAKING_CANCELLATION_FEE = float(os.environ.get('STAKING_CANCELLATION_FEE', 0.2))  # 20% штраф при скасуванні

    # Реферальні налаштування
    REFERRAL_MAX_LEVEL = int(os.environ.get('REFERRAL_MAX_LEVEL', 2))
    REFERRAL_REWARD_LEVEL1 = int(os.environ.get('REFERRAL_REWARD_LEVEL1', 25))  # жетонів
    REFERRAL_REWARD_LEVEL2 = int(os.environ.get('REFERRAL_REWARD_LEVEL2', 10))  # жетонів

    # Налаштування розіграшів
    DEFAULT_RAFFLE_COST = int(os.environ.get('DEFAULT_RAFFLE_COST', 1))  # жетонів

    # Налаштування безпеки
    # Використовуємо різні значення для різних аспектів безпеки
    PASSWORD_SALT = os.environ.get('PASSWORD_SALT', secrets.token_hex(16))
    JWT_SECRET = os.environ.get('JWT_SECRET')
    if not JWT_SECRET:
        JWT_SECRET = os.environ.get('SECRET_KEY', secrets.token_hex(32))
    JWT_EXPIRATION = int(os.environ.get('JWT_EXPIRATION', 86400))  # 24 години в секундах

    # Кеш і оптимізація
    CACHE_TIMEOUT = int(os.environ.get('CACHE_TIMEOUT', 300))  # 5 хвилин в секундах

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

    # Значення за замовчуванням для критичних змінних не дозволені в продакшені
    def __init__(self):
        if not self.SECRET_KEY or self.SECRET_KEY == secrets.token_hex(32):
            raise ValueError("SECRET_KEY must be set explicitly in production!")
        if not self.SUPABASE_URL or not self.SUPABASE_KEY:
            raise ValueError("SUPABASE_URL and SUPABASE_ANON_KEY must be set in production!")
        if not self.TELEGRAM_BOT_TOKEN:
            raise ValueError("TELEGRAM_BOT_TOKEN must be set in production!")


class TestingConfig(Config):
    """Конфігурація для тестування"""
    TESTING = True
    DEBUG = True
    LOG_LEVEL = 'DEBUG'

    # Використовуємо швидкі, але менш безпечні хеші для тестування
    PASSWORD_HASH_ALGORITHM = 'sha256'

    # Спеціальні налаштування для тестового середовища
    SUPABASE_URL = os.environ.get('TEST_SUPABASE_URL', 'https://test.supabase.co')
    SUPABASE_KEY = os.environ.get('TEST_SUPABASE_KEY', 'test_key')


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
    flask_env = os.environ.get('FLASK_ENV', 'default')

    # Якщо встановлено FLASK_DEBUG=True, використовуємо режим розробки
    if os.environ.get('FLASK_DEBUG', 'False').lower() == 'true':
        flask_env = 'development'

    # Якщо запущено з -m pytest, використовуємо тестову конфігурацію
    if 'pytest' in sys.modules:
        flask_env = 'testing'

    # Перевіряємо, чи вказане оточення існує в нашому словнику
    if flask_env not in config_by_name:
        print(f"Warning: Unknown environment '{flask_env}', using default")
        flask_env = 'default'

    # Повертаємо відповідну конфігурацію
    return config_by_name[flask_env]()  # Створюємо екземпляр класу конфігурації