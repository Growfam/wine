"""
🛠️ WINIX Utils Package
Утиліти, хелпери, валідатори та інші корисності

Цей пакет містить всі допоміжні функції та класи для WINIX проекту.
Імпортуй просто: from backend.quests.utils import validate_telegram_id
"""

import logging

logger = logging.getLogger(__name__)

# === ІМПОРТ КЕШУВАННЯ ===

logger.info("📦 Ініціалізація Utils package...")

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

        # Декоратори та функції
        cache,
        cached,
        cache_invalidate,

        # Utility функції
        get_cache_manager,
        start_cache_cleanup,
        cache_key_for_user,
        cache_key_for_data
    )

    logger.info("✅ Cache модуль імпортовано")
    CACHE_AVAILABLE = True
except ImportError as e:
    logger.error(f"❌ Помилка імпорту Cache: {e}")

    # Створюємо заглушки для Cache
    class _DummyCacheManager:
        def get(self, *args, **kwargs): return kwargs.get('default')
        def set(self, *args, **kwargs): return False
        def delete(self, *args, **kwargs): return False
        def exists(self, *args, **kwargs): return False
        def clear(self, *args, **kwargs): return False
        def get_stats(self): return {}

    cache_manager = _DummyCacheManager()
    CacheManager = _DummyCacheManager
    CacheType = None
    CachePolicy = None
    CacheConfig = None
    CacheStats = None
    MemoryCache = None
    RedisCache = None

    def cache(*args, **kwargs):
        def decorator(func): return func
        return decorator

    cached = cache
    cache_invalidate = lambda *args, **kwargs: 0
    get_cache_manager = lambda *args, **kwargs: cache_manager
    start_cache_cleanup = lambda: False
    cache_key_for_user = lambda u, o: f"user:{u}:{o}"
    cache_key_for_data = lambda t, i: f"data:{t}:{i}"

    CACHE_AVAILABLE = False

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
    CONSTANTS_AVAILABLE = True
except ImportError as e:
    logger.error(f"❌ Помилка імпорту Constants: {e}")
    CONSTANTS_AVAILABLE = False

    # Заглушки для критичних констант
    from enum import Enum

    class Environment(Enum):
        DEVELOPMENT = "development"
        PRODUCTION = "production"

    DEBUG = True
    ENVIRONMENT = Environment.DEVELOPMENT
    LOG_LEVEL = None
    API_BASE_URL = "/api"
    API_VERSION = "v1"
    RATE_LIMIT_ENABLED = True
    CACHE_ENABLED = True
    JWT_SECRET_KEY = "winix-secret"
    TELEGRAM_BOT_TOKEN = ""
    SUPABASE_URL = ""

    # Заглушки функцій
    get_environment = lambda: Environment.DEVELOPMENT
    is_development = lambda: True
    is_production = lambda: False

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
    DECORATORS_AVAILABLE = True
except ImportError as e:
    logger.error(f"❌ Помилка імпорту Decorators: {e}")
    DECORATORS_AVAILABLE = False

    # Заглушки для декораторів
    def require_auth(*args, **kwargs):
        def decorator(func): return func
        return decorator

    optional_auth = require_auth
    validate_user_access = require_auth
    rate_limit = require_auth
    validate_json = require_auth
    validate_telegram_id = require_auth
    handle_errors = require_auth
    log_requests = require_auth
    security_headers = require_auth
    block_suspicious_requests = require_auth
    validate_input_data = require_auth
    secure_endpoint = require_auth
    public_endpoint = require_auth

    # Заглушки функцій
    generate_jwt_token = lambda *args, **kwargs: "dummy_token"
    decode_jwt_token = lambda *args, **kwargs: {"user_id": 123456789}
    get_current_user = lambda: None
    get_json_data = lambda: {}
    clear_rate_limit_storage = lambda: None

    # Заглушки винятків
    class AuthError(Exception): pass
    class ValidationError(Exception): pass
    class SecurityError(Exception): pass

# === ІМПОРТ ВАЛІДАТОРІВ ===

try:
    from .validators import (
        # Основна валідація
        validate_telegram_webapp_data,
        validate_telegram_id as validate_telegram_id_validator,
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
    VALIDATORS_AVAILABLE = True

    # Тест критичної функції
    try:
        test_result = validate_telegram_webapp_data("test")
        logger.debug(f"🧪 Тест validate_telegram_webapp_data: OK ({type(test_result)})")
    except Exception as e:
        logger.warning(f"⚠️ validate_telegram_webapp_data тест провалився: {e}")

except ImportError as e:
    logger.error(f"❌ Помилка імпорту Validators: {e}")
    VALIDATORS_AVAILABLE = False

    # Критична заглушка для validate_telegram_webapp_data
    def validate_telegram_webapp_data(init_data: str, bot_token=None):
        """Заглушка для validate_telegram_webapp_data"""
        logger.warning("validate_telegram_webapp_data недоступна, використовується заглушка")
        return {
            "valid": False,
            "error": "Validator service unavailable",
            "data": {}
        }

    # Інші заглушки
    validate_telegram_id_validator = lambda x: None
    validate_username = lambda x: False
    validate_reward_amount = lambda x: None
    validate_task_type = lambda x: False
    validate_task_status = lambda x: False
    validate_url = lambda x: False
    validate_social_platform = lambda x: False
    validate_wallet_address = lambda x: False
    validate_timestamp = lambda x: None
    sanitize_string = lambda x, *args, **kwargs: str(x) if x else ""
    create_validation_report = lambda *args, **kwargs: {"valid": False}

    class ValidationResult:
        def __init__(self, valid, data=None, error=None):
            self.valid = valid
            self.data = data or {}
            self.error = error

    class TelegramValidationError(Exception): pass

    STANDARD_VALIDATION_RULES = {}


# === УТИЛІТИ ПАКЕТУ ===

def get_utils_info():
    """
    Інформація про доступні утиліти

    Returns:
        Dict з інформацією про модулі
    """
    modules_info = {
        'cache': {
            'available': CACHE_AVAILABLE,
            'description': 'Система кешування Redis + Memory'
        },
        'constants': {
            'available': CONSTANTS_AVAILABLE,
            'description': 'Константи та конфігурація проекту'
        },
        'decorators': {
            'available': DECORATORS_AVAILABLE,
            'description': 'Декоратори для авторизації та безпеки'
        },
        'validators': {
            'available': VALIDATORS_AVAILABLE,
            'description': 'Валідатори даних та параметрів'
        }
    }

    available_count = sum(1 for info in modules_info.values() if info['available'])

    return {
        'modules': modules_info,
        'available_modules': available_count,
        'total_modules': len(modules_info),
        'success_rate': (available_count / len(modules_info)) * 100
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
    if not VALIDATORS_AVAILABLE:
        return {
            'valid': False,
            'error': 'Validation service unavailable'
        }

    if rules is None:
        rules = STANDARD_VALIDATION_RULES

    try:
        return create_validation_report(data, rules)
    except Exception as e:
        logger.error(f"Помилка валідації: {e}")
        return {
            'valid': False,
            'error': f'Validation error: {str(e)}'
        }


def create_secure_endpoint_decorator(**kwargs):
    """
    Фабрика для створення декораторів захищених endpoints

    Args:
        **kwargs: Параметри для secure_endpoint

    Returns:
        Налаштований декоратор
    """
    if not DECORATORS_AVAILABLE:
        logger.error("secure_endpoint decorator недоступний")

        def dummy_decorator(func):
            return func

        return dummy_decorator

    try:
        return secure_endpoint(**kwargs)
    except Exception as e:
        logger.error(f"Помилка створення secure_endpoint: {e}")

        def dummy_decorator(func):
            return func

        return dummy_decorator


def setup_logging_with_constants():
    """
    Налаштування логування з використанням констант
    """
    try:
        import logging

        if CONSTANTS_AVAILABLE and 'LOG_LEVEL' in globals() and LOG_LEVEL:
            level = LOG_LEVEL.value
        else:
            level = 'INFO'

        logging.basicConfig(
            level=getattr(logging, level),
            format='%(asctime)s - %(name)s - %(levelname)s - %(message)s',
            datefmt='%Y-%m-%d %H:%M:%S'
        )

        logger.info(f"✅ Логування налаштовано на рівень {level}")

        if CONSTANTS_AVAILABLE and DEBUG:
            logger.info("🐞 DEBUG режим увімкнено")

    except Exception as e:
        print(f"❌ Помилка налаштування логування: {e}")


def check_utils_health():
    """
    Перевірка здоров'я всіх утиліт

    Returns:
        Dict зі статусом всіх компонентів
    """
    health = {
        'overall_status': 'healthy',
        'components': {},
        'available_count': 0,
        'total_count': 4
    }

    # Перевіряємо кожен компонент
    components = {
        'cache': CACHE_AVAILABLE,
        'constants': CONSTANTS_AVAILABLE,
        'decorators': DECORATORS_AVAILABLE,
        'validators': VALIDATORS_AVAILABLE
    }

    for component, available in components.items():
        health['components'][component] = {
            'available': available,
            'status': 'healthy' if available else 'unavailable'
        }

        if available:
            health['available_count'] += 1

    # Визначаємо загальний статус
    success_rate = (health['available_count'] / health['total_count']) * 100

    if success_rate >= 100:
        health['overall_status'] = 'healthy'
    elif success_rate >= 75:
        health['overall_status'] = 'degraded'
    elif success_rate >= 50:
        health['overall_status'] = 'critical'
    else:
        health['overall_status'] = 'failed'

    health['success_rate'] = success_rate

    return health


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
    'cached',
    'cache_invalidate',
    'get_cache_manager',
    'start_cache_cleanup',
    'cache_key_for_user',
    'cache_key_for_data',

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
    'validate_telegram_id_validator',
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
    'setup_logging_with_constants',
    'check_utils_health'
]

# === ІНІЦІАЛІЗАЦІЯ ===

# Автоматичне налаштування логування
setup_logging_with_constants()

logger.info("🎯 Utils package ініціалізовано")

# Виводимо інформацію про доступні утиліти
utils_info = get_utils_info()
available = utils_info['available_modules']
total = utils_info['total_modules']
success_rate = utils_info['success_rate']

logger.info(f"📊 Утиліти: {available}/{total} модулів доступні ({success_rate:.1f}%)")

if available < total:
    unavailable = [name for name, info in utils_info['modules'].items() if not info['available']]
    logger.warning(f"⚠️ Недоступні модулі: {', '.join(unavailable)}")

# Статус результату
if success_rate >= 100:
    logger.info("✅ Всі утиліти доступні та готові до використання!")
elif success_rate >= 75:
    logger.info("🟡 Більшість утилітів доступні")
elif success_rate >= 50:
    logger.warning("🟠 Частина утилітів недоступна")
else:
    logger.error("🔴 Критична кількість утилітів недоступна")

# Глобальні налаштування для зручності
if CACHE_AVAILABLE and cache_manager:
    logger.info("🗄️ Cache manager активний")

if CONSTANTS_AVAILABLE and ENVIRONMENT:
    logger.info(f"🌍 Середовище: {ENVIRONMENT.value}")

logger.info("🚀 WINIX Utils готові до роботи!")

# Тест критичних функцій
logger.debug("🧪 Тестування критичних функцій...")
try:
    test_validation = validate_telegram_webapp_data("test_init_data")
    logger.debug(f"✅ validate_telegram_webapp_data: працює")
except Exception as e:
    logger.warning(f"⚠️ validate_telegram_webapp_data: {e}")