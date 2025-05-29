"""
Константи для системи завдань WINIX
Централізоване сховище всіх констант, налаштувань та конфігурацій
"""

import os
from enum import Enum
from typing import Dict, Any,  Union


# === ОСНОВНІ КОНСТАНТИ СИСТЕМИ ===

class Environment(Enum):
    """Типи середовищ"""
    DEVELOPMENT = "development"
    STAGING = "staging"
    PRODUCTION = "production"
    TESTING = "testing"


class DatabaseType(Enum):
    """Типи баз даних"""
    SUPABASE = "supabase"
    POSTGRESQL = "postgresql"
    SQLITE = "sqlite"
    MYSQL = "mysql"


class LogLevel(Enum):
    """Рівні логування"""
    DEBUG = "DEBUG"
    INFO = "INFO"
    WARNING = "WARNING"
    ERROR = "ERROR"
    CRITICAL = "CRITICAL"


# === КОНФІГУРАЦІЯ СЕРЕДОВИЩА ===

# Поточне середовище
ENVIRONMENT = Environment(os.getenv('ENVIRONMENT', 'development'))

# Налагодження
DEBUG = os.getenv('DEBUG', 'true' if ENVIRONMENT == Environment.DEVELOPMENT else 'false').lower() == 'true'

# Логування
LOG_LEVEL = LogLevel(os.getenv('LOG_LEVEL', 'INFO' if ENVIRONMENT == Environment.PRODUCTION else 'DEBUG'))

# Часова зона
TIMEZONE = os.getenv('TIMEZONE', 'UTC')

# === API КОНФІГУРАЦІЯ ===

# Базові URL
API_BASE_URL = os.getenv('API_BASE_URL', '/api')
FRONTEND_URL = os.getenv('FRONTEND_URL', 'https://winix.app')
WEBHOOK_URL = os.getenv('WEBHOOK_URL', '')

# Версія API
API_VERSION = "v1"
API_PREFIX = f"{API_BASE_URL}/{API_VERSION}"

# Тайм-аути (в секундах)
REQUEST_TIMEOUT = int(os.getenv('REQUEST_TIMEOUT', '30'))
DATABASE_TIMEOUT = int(os.getenv('DATABASE_TIMEOUT', '10'))
CACHE_TIMEOUT = int(os.getenv('CACHE_TIMEOUT', '300'))

# Rate Limiting
RATE_LIMIT_ENABLED = os.getenv('RATE_LIMIT_ENABLED', 'true').lower() == 'true'
RATE_LIMIT_WINDOW = int(os.getenv('RATE_LIMIT_WINDOW', '60'))  # секунди
RATE_LIMIT_MAX_REQUESTS = int(os.getenv('RATE_LIMIT_MAX_REQUESTS', '100'))

# CORS
CORS_ORIGINS = os.getenv('CORS_ORIGINS', '*').split(',')
CORS_CREDENTIALS = os.getenv('CORS_CREDENTIALS', 'true').lower() == 'true'

# === БАЗА ДАНИХ ===

# Supabase
SUPABASE_URL = os.getenv('SUPABASE_URL', '')
SUPABASE_ANON_KEY = os.getenv('SUPABASE_ANON_KEY', '')
SUPABASE_SERVICE_KEY = os.getenv('SUPABASE_SERVICE_KEY', '')

# PostgreSQL (альтернативно)
DATABASE_URL = os.getenv('DATABASE_URL', '')
DATABASE_TYPE = DatabaseType(os.getenv('DATABASE_TYPE', 'supabase'))

# Пул з'єднань
DATABASE_POOL_SIZE = int(os.getenv('DATABASE_POOL_SIZE', '10'))
DATABASE_MAX_OVERFLOW = int(os.getenv('DATABASE_MAX_OVERFLOW', '20'))

# === REDIS / КЕШУВАННЯ ===

REDIS_URL = os.getenv('REDIS_URL', 'redis://localhost:6379/0')
REDIS_HOST = os.getenv('REDIS_HOST', 'localhost')
REDIS_PORT = int(os.getenv('REDIS_PORT', '6379'))
REDIS_DB = int(os.getenv('REDIS_DB', '0'))
REDIS_PASSWORD = os.getenv('REDIS_PASSWORD')

# Налаштування кешу
CACHE_ENABLED = os.getenv('CACHE_ENABLED', 'true').lower() == 'true'
CACHE_TYPE = os.getenv('CACHE_TYPE', 'hybrid')  # memory, redis, hybrid
CACHE_DEFAULT_TTL = int(os.getenv('CACHE_DEFAULT_TTL', '300'))
CACHE_MAX_MEMORY_ITEMS = int(os.getenv('CACHE_MAX_MEMORY_ITEMS', '1000'))

# === БЕЗПЕКА ===

# JWT
JWT_SECRET_KEY = os.getenv('JWT_SECRET_KEY', 'winix-secret-key-2025-change-in-production')
JWT_ALGORITHM = os.getenv('JWT_ALGORITHM', 'HS256')
JWT_ACCESS_TOKEN_EXPIRE = int(os.getenv('JWT_ACCESS_TOKEN_EXPIRE', '3600'))  # 1 година
JWT_REFRESH_TOKEN_EXPIRE = int(os.getenv('JWT_REFRESH_TOKEN_EXPIRE', '604800'))  # 7 днів

# Шифрування
ENCRYPTION_KEY = os.getenv('ENCRYPTION_KEY', '')
SALT_ROUNDS = int(os.getenv('SALT_ROUNDS', '12'))

# Session
SESSION_TIMEOUT = int(os.getenv('SESSION_TIMEOUT', '86400'))  # 24 години
SESSION_CLEANUP_INTERVAL = int(os.getenv('SESSION_CLEANUP_INTERVAL', '3600'))  # 1 година

# === TELEGRAM ===

# Bot конфігурація
TELEGRAM_BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN', '')
TELEGRAM_BOT_USERNAME = os.getenv('TELEGRAM_BOT_USERNAME', '@WINIX_Official_bot')
TELEGRAM_BOT_WEBHOOK_URL = os.getenv('TELEGRAM_BOT_WEBHOOK_URL', '')

# WebApp
TELEGRAM_WEBAPP_URL = os.getenv('TELEGRAM_WEBAPP_URL', 'https://winix.app')
TELEGRAM_WEBAPP_SECRET = os.getenv('TELEGRAM_WEBAPP_SECRET', '')

# Валідація даних
TELEGRAM_DATA_EXPIRE_TIME = int(os.getenv('TELEGRAM_DATA_EXPIRE_TIME', '86400'))  # 24 години

# === TON BLOCKCHAIN ===

# TON Connect
TON_CONNECT_MANIFEST_URL = os.getenv('TON_CONNECT_MANIFEST_URL', 'https://winix.app/tonconnect-manifest.json')
TON_NETWORK = os.getenv('TON_NETWORK', 'mainnet')  # mainnet, testnet

# TON API
TON_API_KEY = os.getenv('TON_API_KEY', '')
TON_API_ENDPOINT = os.getenv('TON_API_ENDPOINT', 'https://toncenter.com/api/v2/')

# Адреси контрактів
FLEX_TOKEN_CONTRACT = os.getenv('FLEX_TOKEN_CONTRACT', '')
WINIX_TOKEN_CONTRACT = os.getenv('WINIX_TOKEN_CONTRACT', '')


# === ЗАВДАННЯ ===

class TaskType(Enum):
    """Типи завдань"""
    SOCIAL = "social"
    LIMITED = "limited"
    PARTNER = "partner"
    DAILY = "daily"
    SPECIAL = "special"
    REFERRAL = "referral"


class TaskStatus(Enum):
    """Статуси завдань"""
    AVAILABLE = "available"
    STARTED = "started"
    IN_PROGRESS = "in_progress"
    PENDING = "pending"
    VERIFYING = "verifying"
    COMPLETED = "completed"
    CLAIMED = "claimed"
    EXPIRED = "expired"
    FAILED = "failed"
    LOCKED = "locked"


class TaskDifficulty(Enum):
    """Складність завдань"""
    EASY = "easy"
    MEDIUM = "medium"
    HARD = "hard"
    EXPERT = "expert"


# Винагороди за завдання (базові)
TASK_REWARDS = {
    TaskType.SOCIAL: {
        TaskDifficulty.EASY: {"winix": 20, "tickets": 0},
        TaskDifficulty.MEDIUM: {"winix": 50, "tickets": 1},
        TaskDifficulty.HARD: {"winix": 100, "tickets": 2},
        TaskDifficulty.EXPERT: {"winix": 200, "tickets": 5}
    },
    TaskType.LIMITED: {
        TaskDifficulty.EASY: {"winix": 30, "tickets": 1},
        TaskDifficulty.MEDIUM: {"winix": 75, "tickets": 2},
        TaskDifficulty.HARD: {"winix": 150, "tickets": 3},
        TaskDifficulty.EXPERT: {"winix": 300, "tickets": 8}
    },
    TaskType.PARTNER: {
        TaskDifficulty.EASY: {"winix": 50, "tickets": 1},
        TaskDifficulty.MEDIUM: {"winix": 100, "tickets": 2},
        TaskDifficulty.HARD: {"winix": 200, "tickets": 4},
        TaskDifficulty.EXPERT: {"winix": 500, "tickets": 10}
    },
    TaskType.DAILY: {
        TaskDifficulty.EASY: {"winix": 10, "tickets": 0},
        TaskDifficulty.MEDIUM: {"winix": 25, "tickets": 0},
        TaskDifficulty.HARD: {"winix": 50, "tickets": 1},
        TaskDifficulty.EXPERT: {"winix": 100, "tickets": 2}
    }
}

# Тайм-аути для верифікації
TASK_VERIFICATION_TIMEOUT = {
    "telegram": 0,  # Миттєва верифікація
    "youtube": 15,  # 15 секунд
    "twitter": 15,  # 15 секунд
    "instagram": 15,  # 15 секунд
    "discord": 30,  # 30 секунд
    "default": 15  # За замовчуванням
}

# Максимальна кількість завдань на користувача
MAX_ACTIVE_TASKS_PER_USER = int(os.getenv('MAX_ACTIVE_TASKS_PER_USER', '50'))
MAX_DAILY_TASKS_PER_USER = int(os.getenv('MAX_DAILY_TASKS_PER_USER', '10'))


# === FLEX СИСТЕМА ===

class FlexLevel(Enum):
    """Рівні FLEX"""
    BRONZE = "bronze"
    SILVER = "silver"
    GOLD = "gold"
    PLATINUM = "platinum"
    DIAMOND = "diamond"


# Вимоги та винагороди для рівнів FLEX
FLEX_LEVELS_CONFIG = {
    FlexLevel.BRONZE: {
        "required": 100000,
        "rewards": {"winix": 50, "tickets": 2},
        "color": "#CD7F32",
        "name": "Bronze"
    },
    FlexLevel.SILVER: {
        "required": 500000,
        "rewards": {"winix": 150, "tickets": 5},
        "color": "#C0C0C0",
        "name": "Silver"
    },
    FlexLevel.GOLD: {
        "required": 1000000,
        "rewards": {"winix": 300, "tickets": 8},
        "color": "#FFD700",
        "name": "Gold"
    },
    FlexLevel.PLATINUM: {
        "required": 5000000,
        "rewards": {"winix": 1000, "tickets": 10},
        "color": "#E5E4E2",
        "name": "Platinum"
    },
    FlexLevel.DIAMOND: {
        "required": 10000000,
        "rewards": {"winix": 2500, "tickets": 15},
        "color": "#B9F2FF",
        "name": "Diamond"
    }
}

# Частота перевірки балансу FLEX
FLEX_BALANCE_CHECK_INTERVAL = int(os.getenv('FLEX_BALANCE_CHECK_INTERVAL', '3600'))  # 1 година


# === ЩОДЕННІ БОНУСИ ===

class DailyBonusType(Enum):
    """Типи щоденних бонусів"""
    REGULAR = "regular"
    STREAK = "streak"
    SPECIAL = "special"
    MILESTONE = "milestone"


# Конфігурація щоденних бонусів
DAILY_BONUS_CONFIG = {
    "total_days": 30,
    "reset_hour": 0,  # 00:00 UTC
    "base_reward": 20,
    "streak_multiplier": 1.1,
    "max_streak_bonus": 5.0,
    "special_days": [7, 14, 21, 30],  # Дні з особливими бонусами
    "special_multiplier": 2.0
}

# Максимальна серія днів
MAX_DAILY_STREAK = int(os.getenv('MAX_DAILY_STREAK', '365'))


# === РЕФЕРАЛЬНА СИСТЕМА ===

class ReferralLevel(Enum):
    """Рівні реферальної системи"""
    LEVEL_1 = 1
    LEVEL_2 = 2


# Винагороди за рефералів
REFERRAL_REWARDS = {
    ReferralLevel.LEVEL_1: {
        "winix": 50,
        "tickets": 1,
        "percentage": 10  # 10% від винагород реферала
    },
    ReferralLevel.LEVEL_2: {
        "winix": 25,
        "tickets": 0,
        "percentage": 5  # 5% від винагород реферала
    }
}

# Максимальні рівні реферальної системи
MAX_REFERRAL_LEVELS = 2
MAX_REFERRALS_PER_USER = int(os.getenv('MAX_REFERRALS_PER_USER', '1000'))


# === БЕЙДЖІ ===

class BadgeType(Enum):
    """Типи бейджів"""
    BEGINNER = "beginner"
    WINNER = "winner"
    RICH = "rich"
    SOCIAL = "social"
    FLEX_MASTER = "flex_master"
    DAILY_WARRIOR = "daily_warrior"
    REFERRAL_KING = "referral_king"


# Вимоги для отримання бейджів
BADGE_REQUIREMENTS = {
    BadgeType.BEGINNER: {
        "participations_count": 5,
        "reward": {"winix": 100, "tickets": 1}
    },
    BadgeType.WINNER: {
        "wins_count": 1,
        "reward": {"winix": 200, "tickets": 2}
    },
    BadgeType.RICH: {
        "balance": 50000,
        "reward": {"winix": 500, "tickets": 5}
    },
    BadgeType.SOCIAL: {
        "social_tasks_completed": 20,
        "reward": {"winix": 300, "tickets": 3}
    },
    BadgeType.FLEX_MASTER: {
        "flex_rewards_claimed": 10,
        "reward": {"winix": 1000, "tickets": 10}
    },
    BadgeType.DAILY_WARRIOR: {
        "daily_streak": 30,
        "reward": {"winix": 600, "tickets": 6}
    },
    BadgeType.REFERRAL_KING: {
        "referrals_count": 50,
        "reward": {"winix": 2000, "tickets": 20}
    }
}


# === ВАЛЮТИ ===

class CurrencyType(Enum):
    """Типи валют"""
    WINIX = "winix"
    TICKETS = "tickets"
    FLEX = "flex"
    TON = "ton"


# Конфігурація валют
CURRENCIES_CONFIG = {
    CurrencyType.WINIX: {
        "name": "WINIX",
        "symbol": "W",
        "decimals": 0,
        "color": "#b366ff",
        "is_transferable": True
    },
    CurrencyType.TICKETS: {
        "name": "Tickets",
        "symbol": "T",
        "decimals": 0,
        "color": "#FFD700",
        "is_transferable": False,
        "is_rare": True
    },
    CurrencyType.FLEX: {
        "name": "FLEX",
        "symbol": "FLEX",
        "decimals": 0,
        "color": "#FFA500",
        "is_transferable": False
    },
    CurrencyType.TON: {
        "name": "TON",
        "symbol": "TON",
        "decimals": 9,
        "color": "#0088CC",
        "is_transferable": True
    }
}

# Ліміти балансів
MAX_BALANCE_LIMITS = {
    CurrencyType.WINIX: 1000000000,  # 1 мільярд
    CurrencyType.TICKETS: 100000,  # 100 тисяч
    CurrencyType.FLEX: 100000000000,  # 100 мільярдів (зовнішній баланс)
    CurrencyType.TON: 1000000  # 1 мільйон TON
}


# === АНАЛІТИКА ===

class AnalyticsEventType(Enum):
    """Типи аналітичних подій"""
    # Користувач
    USER_REGISTER = "user_register"
    USER_LOGIN = "user_login"
    USER_LOGOUT = "user_logout"

    # Завдання
    TASK_VIEW = "task_view"
    TASK_START = "task_start"
    TASK_COMPLETE = "task_complete"
    TASK_CLAIM = "task_claim"

    # Гаманець
    WALLET_CONNECT = "wallet_connect"
    WALLET_DISCONNECT = "wallet_disconnect"

    # FLEX
    FLEX_CHECK = "flex_check"
    FLEX_CLAIM = "flex_claim"

    # Щоденні бонуси
    DAILY_CLAIM = "daily_claim"

    # Помилки
    ERROR_OCCURRED = "error_occurred"

    # API
    API_CALL = "api_call"


# Конфігурація аналітики
ANALYTICS_CONFIG = {
    "enabled": os.getenv('ANALYTICS_ENABLED', 'true').lower() == 'true',
    "batch_size": int(os.getenv('ANALYTICS_BATCH_SIZE', '100')),
    "flush_interval": int(os.getenv('ANALYTICS_FLUSH_INTERVAL', '60')),  # секунди
    "retention_days": int(os.getenv('ANALYTICS_RETENTION_DAYS', '90')),
    "sampling_rate": float(os.getenv('ANALYTICS_SAMPLING_RATE', '1.0'))
}


# === СОЦІАЛЬНІ ПЛАТФОРМИ ===

class SocialPlatform(Enum):
    """Соціальні платформи"""
    TELEGRAM = "telegram"
    YOUTUBE = "youtube"
    TWITTER = "twitter"
    INSTAGRAM = "instagram"
    DISCORD = "discord"
    TIKTOK = "tiktok"
    FACEBOOK = "facebook"
    LINKEDIN = "linkedin"


# Конфігурація соціальних платформ
SOCIAL_PLATFORMS_CONFIG = {
    SocialPlatform.TELEGRAM: {
        "name": "Telegram",
        "verification_time": 0,
        "auto_verification": True,
        "api_available": True
    },
    SocialPlatform.YOUTUBE: {
        "name": "YouTube",
        "verification_time": 15,
        "auto_verification": False,
        "api_available": True
    },
    SocialPlatform.TWITTER: {
        "name": "Twitter",
        "verification_time": 15,
        "auto_verification": False,
        "api_available": True
    },
    SocialPlatform.INSTAGRAM: {
        "name": "Instagram",
        "verification_time": 15,
        "auto_verification": False,
        "api_available": False
    },
    SocialPlatform.DISCORD: {
        "name": "Discord",
        "verification_time": 30,
        "auto_verification": False,
        "api_available": True
    }
}

# === ТАЙМЕРИ ===

# Інтервали синхронізації
SYNC_INTERVALS = {
    "user_balance": 300,  # 5 хвилин
    "flex_balance": 3600,  # 1 година
    "task_status": 600,  # 10 хвилин
    "daily_bonus": 60,  # 1 хвилина
    "analytics": 300,  # 5 хвилин
    "cache_cleanup": 3600  # 1 година
}

# Тайм-аути операцій
OPERATION_TIMEOUTS = {
    "task_verification": 300,  # 5 хвилин
    "wallet_verification": 60,  # 1 хвилина
    "api_request": 30,  # 30 секунд
    "database_query": 10,  # 10 секунд
    "cache_operation": 5  # 5 секунд
}

# === ФАЙЛИ ===

# Налаштування файлів
FILE_UPLOAD_CONFIG = {
    "max_size": int(os.getenv('MAX_FILE_SIZE', '10485760')),  # 10MB
    "allowed_extensions": ['jpg', 'jpeg', 'png', 'gif', 'pdf', 'txt'],
    "upload_path": os.getenv('UPLOAD_PATH', './uploads'),
    "cdn_url": os.getenv('CDN_URL', '')
}

# Шляхи до файлів
PATHS = {
    "logs": os.getenv('LOGS_PATH', './logs'),
    "backups": os.getenv('BACKUPS_PATH', './backups'),
    "temp": os.getenv('TEMP_PATH', './temp'),
    "static": os.getenv('STATIC_PATH', './static'),
    "templates": os.getenv('TEMPLATES_PATH', './templates')
}

# === МЕРЕЖЕВІ НАЛАШТУВАННЯ ===

# HTTP
HTTP_CONFIG = {
    "max_content_length": int(os.getenv('MAX_CONTENT_LENGTH', '16777216')),  # 16MB
    "connection_timeout": int(os.getenv('CONNECTION_TIMEOUT', '30')),
    "read_timeout": int(os.getenv('READ_TIMEOUT', '60')),
    "max_retries": int(os.getenv('MAX_RETRIES', '3')),
    "retry_backoff": float(os.getenv('RETRY_BACKOFF', '1.0'))
}

# Заголовки безпеки
SECURITY_HEADERS = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "X-XSS-Protection": "1; mode=block",
    "Strict-Transport-Security": "max-age=31536000; includeSubDomains",
    "Content-Security-Policy": "default-src 'self'",
    "Referrer-Policy": "strict-origin-when-cross-origin"
}

# === МОНІТОРИНГ ===

# Health Check
HEALTH_CHECK_CONFIG = {
    "enabled": os.getenv('HEALTH_CHECK_ENABLED', 'true').lower() == 'true',
    "interval": int(os.getenv('HEALTH_CHECK_INTERVAL', '60')),
    "timeout": int(os.getenv('HEALTH_CHECK_TIMEOUT', '10')),
    "endpoints": [
        "/api/health",
        "/api/analytics/ping",
        "/api/tasks/ping"
    ]
}

# Метрики
METRICS_CONFIG = {
    "enabled": os.getenv('METRICS_ENABLED', 'true').lower() == 'true',
    "export_interval": int(os.getenv('METRICS_EXPORT_INTERVAL', '60')),
    "prometheus_port": int(os.getenv('PROMETHEUS_PORT', '8000')),
    "custom_metrics": os.getenv('CUSTOM_METRICS_ENABLED', 'true').lower() == 'true'
}

# === ПОВІДОМЛЕННЯ ===

# Успішні повідомлення
SUCCESS_MESSAGES = {
    "task_completed": "Завдання успішно виконано!",
    "reward_claimed": "Винагороду отримано!",
    "wallet_connected": "Гаманець підключено!",
    "daily_bonus_claimed": "Щоденний бонус отримано!",
    "badge_earned": "Новий бейдж отримано!",
    "referral_registered": "Реферал зареєстровано!",
    "profile_updated": "Профіль оновлено!"
}

# Повідомлення помилок
ERROR_MESSAGES = {
    "task_not_found": "Завдання не знайдено",
    "task_already_completed": "Завдання вже виконано",
    "insufficient_balance": "Недостатньо коштів",
    "wallet_not_connected": "Гаманець не підключено",
    "invalid_verification": "Верифікація не пройдена",
    "rate_limit_exceeded": "Перевищено ліміт запитів",
    "session_expired": "Сесія закінчилася",
    "invalid_data": "Невірні дані",
    "server_error": "Помилка сервера",
    "network_error": "Помилка мережі",
    "unauthorized": "Не авторизовано",
    "forbidden": "Доступ заборонено"
}

# === ВАЛІДАЦІЯ ===

# Правила валідації
VALIDATION_RULES = {
    "telegram_id": {
        "type": "integer",
        "min": 1,
        "max": 9999999999999999999  # 19 цифр макс для Telegram ID
    },
    "username": {
        "type": "string",
        "min_length": 3,
        "max_length": 32,
        "pattern": "^[a-zA-Z0-9_]+$"
    },
    "task_id": {
        "type": "string",
        "min_length": 3,
        "max_length": 50,
        "pattern": "^[a-zA-Z0-9_-]+$"
    },
    "wallet_address": {
        "type": "string",
        "min_length": 20,  # Мінімальна довжина замість фіксованої
        "max_length": 100,  # Максимальна довжина для різних форматів
    },
    "amount": {
        "type": "number",
        "min": 0,
        "max": 1000000000
    }
}


# === ЕКСПОРТ ФУНКЦІЙ ===

def get_environment() -> Environment:
    """Отримати поточне середовище"""
    return ENVIRONMENT


def is_development() -> bool:
    """Перевірити чи це середовище розробки"""
    return ENVIRONMENT == Environment.DEVELOPMENT


def is_production() -> bool:
    """Перевірити чи це продакшен"""
    return ENVIRONMENT == Environment.PRODUCTION


def get_task_reward(task_type: TaskType, difficulty: TaskDifficulty) -> Dict[str, int]:
    """Отримати винагороду за завдання"""
    return TASK_REWARDS.get(task_type, {}).get(difficulty, {"winix": 0, "tickets": 0})


def get_flex_level_config(level: FlexLevel) -> Dict[str, Any]:
    """Отримати конфігурацію рівня FLEX"""
    return FLEX_LEVELS_CONFIG.get(level, {})


def get_badge_requirements(badge_type: BadgeType) -> Dict[str, Any]:
    """Отримати вимоги для бейджа"""
    return BADGE_REQUIREMENTS.get(badge_type, {})


def get_currency_config(currency_type: CurrencyType) -> Dict[str, Any]:
    """Отримати конфігурацію валюти"""
    return CURRENCIES_CONFIG.get(currency_type, {})


def get_social_platform_config(platform: SocialPlatform) -> Dict[str, Any]:
    """Отримати конфігурацію соціальної платформи"""
    return SOCIAL_PLATFORMS_CONFIG.get(platform, {})


def validate_amount(amount: Union[int, float], currency: CurrencyType) -> bool:
    """Валідувати суму"""
    if amount < 0:
        return False

    max_limit = MAX_BALANCE_LIMITS.get(currency, 1000000000)
    return amount <= max_limit


def get_verification_timeout(platform: str) -> int:
    """Отримати таймаут верифікації для платформи"""
    return TASK_VERIFICATION_TIMEOUT.get(platform, TASK_VERIFICATION_TIMEOUT["default"])


# Експорт констант
__all__ = [
    # Enums
    'Environment', 'DatabaseType', 'LogLevel', 'TaskType', 'TaskStatus', 'TaskDifficulty',
    'FlexLevel', 'DailyBonusType', 'ReferralLevel', 'BadgeType', 'CurrencyType',
    'AnalyticsEventType', 'SocialPlatform',

    # Конфігурації
    'ENVIRONMENT', 'DEBUG', 'LOG_LEVEL', 'API_BASE_URL', 'API_VERSION',
    'RATE_LIMIT_ENABLED', 'CACHE_ENABLED', 'JWT_SECRET_KEY',
    'TELEGRAM_BOT_TOKEN', 'SUPABASE_URL',

    # Структури даних
    'TASK_REWARDS', 'FLEX_LEVELS_CONFIG', 'DAILY_BONUS_CONFIG',
    'REFERRAL_REWARDS', 'BADGE_REQUIREMENTS', 'CURRENCIES_CONFIG',
    'SOCIAL_PLATFORMS_CONFIG', 'VALIDATION_RULES',

    # Ліміти та таймаути
    'MAX_BALANCE_LIMITS', 'SYNC_INTERVALS', 'OPERATION_TIMEOUTS',
    'TASK_VERIFICATION_TIMEOUT',

    # Повідомлення
    'SUCCESS_MESSAGES', 'ERROR_MESSAGES',

    # Функції
    'get_environment', 'is_development', 'is_production',
    'get_task_reward', 'get_flex_level_config', 'get_badge_requirements',
    'get_currency_config', 'get_social_platform_config', 'validate_amount',
    'get_verification_timeout'
]