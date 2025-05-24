"""
🛠️ WINIX Utils Package
Утиліти, хелпери, валідатори та інші корисності

Цей пакет містить всі допоміжні функції та класи для WINIX проекту.
Імпортуй просто: from backend.quests.utils import validate_telegram_id
"""

import logging

logger = logging.getLogger(__name__)

# === ІМПОРТ КЕШУВАННЯ ===

try:
    from .cache import (
        # Основні класи
        CacheManager,
        CacheType,
        CachePolicy,
        CacheConfig,
        CacheStats,
        MemoryCache,
        RedisCache,

        # Глобальний менеджер
        cache_manager,

        # Декоратори
        cache,
        cache_invalidate
    )

    logger.info("✅ Cache модуль імпортовано")
except ImportError as e:
    logger.error(f"❌ Помилка імпорту Cache: {e}")
    cache_manager = None

# === ІМПОРТ КОНСТАНТ ===

try:
    from .constants import (
        # Енуми
        Environment,
        DatabaseType,
        LogLevel,
        TaskType,
        TaskStatus,
        TaskDifficulty,
        FlexLevel,
        DailyBonusType,
        ReferralLevel,
        BadgeType,
        CurrencyType,
        AnalyticsEventType,
        SocialPlatform,

        # Основні константи
        ENVIRONMENT,
        DEBUG,
        LOG_LEVEL,
        API_BASE_URL,
        API_VERSION,

        # Конфігурації
        RATE_LIMIT_ENABLED,
        CACHE_ENABLED,
        JWT_SECRET_KEY,
        TELEGRAM_BOT_TOKEN,
        SUPABASE_URL,

        # Структури даних
        TASK_REWARDS,
        FLEX_LEVELS_CONFIG,
        DAILY_BONUS_CONFIG,
        REFERRAL_REWARDS,
        BADGE_REQUIREMENTS,
        CURRENCIES_CONFIG,
        SOCIAL_PLATFORMS_CONFIG,
        VALIDATION_RULES,

        # Ліміти
        MAX_BALANCE_LIMITS,
        SYNC_INTERVALS,
        OPERATION_TIMEOUTS,
        TASK_VERIFICATION_TIMEOUT,

        # Повідомлення
        SUCCESS_MESSAGES,
        ERROR_MESSAGES,

        # Функції
        get_environment,
        is_development,
        is_production,
        get_task_reward,
        get_flex_level_config,
        get_badge_requirements,
        get_currency_config,
        get_social_platform_config,
        validate_amount,
        get_verification_timeout
    )

    logger.info("✅ Constants модуль імпортовано")
except ImportError as e:
    logger.error(f"❌ Помилка імпорту Constants: {e}")

# === ІМПОРТ ДЕКОРАТОРІВ ===

try:
    from .decorators import (
        # Авторизація
        require_auth,
        optional_auth,
        validate_user_access,

        # Rate limiting
        rate_limit,

        # Валідація
        validate_json,
        validate_telegram_id,

        # Обробка помилок
        handle_errors,
        log_requests,

        # Безпека
        security_headers,
        block_suspicious_requests,
        validate_input_data,

        # Комбіновані декоратори
        secure_endpoint,
        public_endpoint,

        # JWT функції
        generate_jwt_token,
        decode_jwt_token,

        # Хелпери
        get_current_user,
        get_json_data,
        clear_rate_limit_storage,

        # Винятки
        AuthError,
        ValidationError,
        SecurityError
    )

    logger.info("✅ Decorators модуль імпортовано")
except ImportError as e:
    logger.error(f"❌ Помилка імпорту Decorators: {e}")

# === ІМПОРТ ВАЛІДАТОРІВ ===

try:
    from .validators import (
        # Основна валідація
        validate_telegram_webapp_data,
        validate_telegram_id,
        validate_username,
        validate_reward_amount,
        validate_task_type,
        validate_task_status,
        validate_url,
        validate_social_platform,
        validate_wallet_address,
        validate_timestamp,

        # Хелпери
        sanitize_string,
        create_validation_report,

        # Класи
        ValidationResult,
        TelegramValidationError,

        # Правила
        STANDARD_VALIDATION_RULES
    )

    logger.info("✅ Validators модуль імпортовано")
except ImportError as e:
    logger.error(f"❌ Помилка імпорту Validators: {e}")


# === УТИЛІТИ ПАКЕТУ ===

def get_utils_info():
    """
    Інформація про доступні утиліти

    Returns:
        Dict з інформацією про модулі
    """
    modules_info = {
        'cache': {
            'available': cache_manager is not None,
            'description': 'Система кешування Redis + Memory'
        },
        'constants': {
            'available': 'ENVIRONMENT' in globals(),
            'description': 'Константи та конфігурація проекту'
        },
        'decorators': {
            'available': 'require_auth' in globals(),
            'description': 'Декоратори для авторизації та безпеки'
        },
        'validators': {
            'available': 'validate_telegram_webapp_data' in globals(),
            'description': 'Валідатори даних та параметрів'
        }
    }

    available_count = sum(1 for info in modules_info.values() if info['available'])

    return {
        'modules': modules_info,
        'available_modules': available_count,
        'total_modules': len(modules_info)
    }


def validate_user_input(data: dict, rules: dict = None):
    """
    Швидка валідація користувацьких даних

    Args:
        data: Дані для валідації
        rules: Правила валідації (за замовчуванням STANDARD_VALIDATION_RULES)

    Returns:
        ValidationResult з результатом
    """
    if rules is None:
        rules = STANDARD_VALIDATION_RULES if 'STANDARD_VALIDATION_RULES' in globals() else {}

    try:
        from .validators import create_validation_report
        return create_validation_report(data, rules)
    except:
        return {
            'valid': False,
            'error': 'Validation service unavailable'
        }


def create_secure_endpoint_decorator(**kwargs):
    """
    Фабрика для створення декораторів захищених endpoints

    Args:
        **kwargs: Параметри для secure_endpoint

    Returns:
        Налаштований декоратор

    Example:
        >>> api_endpoint = create_secure_endpoint_decorator(
        ...     max_requests=20,
        ...     window_seconds=60,
        ...     require_fresh_token=True
        ... )
        >>> @api_endpoint
        ... def my_api_function():
        ...     pass
    """
    try:
        return secure_endpoint(**kwargs)
    except NameError:
        logger.error("secure_endpoint decorator недоступний")

        def dummy_decorator(func):
            return func

        return dummy_decorator


def setup_logging_with_constants():
    """
    Налаштування логування з використанням констант
    """
    try:
        import logging

        level = LOG_LEVEL.value if 'LOG_LEVEL' in globals() else 'INFO'

        logging.basicConfig(
            level=getattr(logging, level),
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )

        logger.info(f"✅ Логування налаштовано на рівень {level}")

        if 'DEBUG' in globals() and DEBUG:
            logger.info("🐞 DEBUG режим увімкнено")

    except Exception as e:
        print(f"❌ Помилка налаштування логування: {e}")


# === ЕКСПОРТ ВСЬОГО ===

__all__ = [
    # === CACHE ===
    'CacheManager',
    'CacheType',
    'CachePolicy',
    'CacheConfig',
    'CacheStats',
    'MemoryCache',
    'RedisCache',
    'cache_manager',
    'cache',
    'cache_invalidate',

    # === CONSTANTS ===
    # Енуми
    'Environment',
    'DatabaseType',
    'LogLevel',
    'TaskType',
    'TaskStatus',
    'TaskDifficulty',
    'FlexLevel',
    'DailyBonusType',
    'ReferralLevel',
    'BadgeType',
    'CurrencyType',
    'AnalyticsEventType',
    'SocialPlatform',

    # Основні константи
    'ENVIRONMENT',
    'DEBUG',
    'LOG_LEVEL',
    'API_BASE_URL',
    'API_VERSION',
    'RATE_LIMIT_ENABLED',
    'CACHE_ENABLED',
    'JWT_SECRET_KEY',
    'TELEGRAM_BOT_TOKEN',
    'SUPABASE_URL',

    # Конфігурації та дані
    'TASK_REWARDS',
    'FLEX_LEVELS_CONFIG',
    'DAILY_BONUS_CONFIG',
    'REFERRAL_REWARDS',
    'BADGE_REQUIREMENTS',
    'CURRENCIES_CONFIG',
    'SOCIAL_PLATFORMS_CONFIG',
    'VALIDATION_RULES',
    'MAX_BALANCE_LIMITS',
    'SYNC_INTERVALS',
    'OPERATION_TIMEOUTS',
    'TASK_VERIFICATION_TIMEOUT',
    'SUCCESS_MESSAGES',
    'ERROR_MESSAGES',

    # Функції констант
    'get_environment',
    'is_development',
    'is_production',
    'get_task_reward',
    'get_flex_level_config',
    'get_badge_requirements',
    'get_currency_config',
    'get_social_platform_config',
    'validate_amount',
    'get_verification_timeout',

    # === DECORATORS ===
    'require_auth',
    'optional_auth',
    'validate_user_access',
    'rate_limit',
    'validate_json',
    'validate_telegram_id',
    'handle_errors',
    'log_requests',
    'security_headers',
    'block_suspicious_requests',
    'validate_input_data',
    'secure_endpoint',
    'public_endpoint',
    'generate_jwt_token',
    'decode_jwt_token',
    'get_current_user',
    'get_json_data',
    'clear_rate_limit_storage',
    'AuthError',
    'ValidationError',
    'SecurityError',

    # === VALIDATORS ===
    'validate_telegram_webapp_data',
    'validate_telegram_id',
    'validate_username',
    'validate_reward_amount',
    'validate_task_type',
    'validate_task_status',
    'validate_url',
    'validate_social_platform',
    'validate_wallet_address',
    'validate_timestamp',
    'sanitize_string',
    'create_validation_report',
    'ValidationResult',
    'TelegramValidationError',
    'STANDARD_VALIDATION_RULES',

    # === УТИЛІТИ ПАКЕТУ ===
    'get_utils_info',
    'validate_user_input',
    'create_secure_endpoint_decorator',
    'setup_logging_with_constants'
]

# === ІНІЦІАЛІЗАЦІЯ ===

# Автоматичне налаштування логування
setup_logging_with_constants()

logger.info("🎯 Utils package ініціалізовано")

# Виводимо інформацію про доступні утиліти
utils_info = get_utils_info()
available = utils_info['available_modules']
total = utils_info['total_modules']

logger.info(f"📊 Утиліти: {available}/{total} модулів доступні")

if available < total:
    unavailable = [name for name, info in utils_info['modules'].items() if not info['available']]
    logger.warning(f"⚠️ Недоступні модулі: {', '.join(unavailable)}")
else:
    logger.info("✅ Всі утиліти доступні та готові до використання!")

# Глобальні налаштування для зручності
if cache_manager:
    logger.info("🗄️ Cache manager активний")

if 'ENVIRONMENT' in globals():
    logger.info(f"🌍 Середовище: {ENVIRONMENT.value}")

logger.info("🚀 WINIX Utils готові до роботи!")