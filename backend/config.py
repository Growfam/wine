import os
import sys
from pathlib import Path
from dotenv import load_dotenv

# Знаходимо кореневу директорію проекту (рівень вище від backend)
BASE_DIR = Path(__file__).parent.parent

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

    # Секретний ключ для сесій Flask
    SECRET_KEY = os.environ.get('SECRET_KEY', 'winix-secure-secret-key-2024')

    # Supabase з'єднання
    SUPABASE_URL = os.environ.get('SUPABASE_URL')
    SUPABASE_KEY = os.environ.get('SUPABASE_ANON_KEY')

    # Налаштування Telegram
    TELEGRAM_BOT_TOKEN = os.environ.get('TELEGRAM_BOT_TOKEN', '')

    # Загальні налаштування WINIX
    DEFAULT_TOKENS_NEW_USER = int(os.environ.get('DEFAULT_TOKENS_NEW_USER', 0))
    DEFAULT_WINIX_NEW_USER = float(os.environ.get('DEFAULT_WINIX_NEW_USER', 0))
    WINIX_DECIMAL_PLACES = 2

    # Налаштування стейкінгу
    STAKING_MIN_AMOUNT = int(os.environ.get('STAKING_MIN_AMOUNT', 50))
    STAKING_PERIODS = [7, 14, 28]  # дні
    STAKING_RATES = {
        7: 4,  # 4% за 7 днів
        14: 9,  # 9% за 14 днів
        28: 15  # 15% за 28 днів
    }
    STAKING_CANCELLATION_FEE = 0.2  # 20% штраф при скасуванні

    # Реферальні налаштування
    REFERRAL_MAX_LEVEL = 2
    REFERRAL_REWARD_LEVEL1 = int(os.environ.get('REFERRAL_REWARD_LEVEL1', 25))  # жетонів
    REFERRAL_REWARD_LEVEL2 = int(os.environ.get('REFERRAL_REWARD_LEVEL2', 10))  # жетонів

    # Налаштування розіграшів
    DEFAULT_RAFFLE_COST = int(os.environ.get('DEFAULT_RAFFLE_COST', 1))  # жетонів

    # Налаштування безпеки
    PASSWORD_SALT = os.environ.get('PASSWORD_SALT', 'winix-salt')
    JWT_SECRET = os.environ.get('JWT_SECRET', SECRET_KEY)
    JWT_EXPIRATION = 86400  # 24 години в секундах

    # Кеш і оптимізація
    CACHE_TIMEOUT = 300  # 5 хвилин в секундах


class DevelopmentConfig(Config):
    """Конфігурація для розробки"""
    DEBUG = True
    CACHE_TIMEOUT = 60  # 1 хвилина в секундах
    LOG_LEVEL = 'DEBUG'


class ProductionConfig(Config):
    """Конфігурація для продакшену"""
    DEBUG = False
    PASSWORD_MIN_LENGTH = 8
    JWT_EXPIRATION = 43200  # 12 годин в секундах
    LOG_LEVEL = 'ERROR'


class TestingConfig(Config):
    """Конфігурація для тестування"""
    TESTING = True
    DEBUG = True
    LOG_LEVEL = 'DEBUG'


# Словник конфігурацій
config_by_name = {
    'development': DevelopmentConfig,
    'production': ProductionConfig,
    'testing': TestingConfig,
    'default': ProductionConfig
}


def get_config():
    """Функція для отримання поточної конфігурації на основі оточення"""
    # Визначаємо оточення
    flask_env = os.environ.get('FLASK_ENV', 'default')
    if os.environ.get('FLASK_DEBUG', 'False').lower() == 'true':
        flask_env = 'development'

    # Повертаємо відповідну конфігурацію
    return config_by_name[flask_env]()  # Створюємо екземпляр класу конфігурації