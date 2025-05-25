"""
🚀 WINIX Services Package - ВИПРАВЛЕНА ВЕРСІЯ
Безпечна ініціалізація всіх сервісів системи завдань
"""

import logging

logger = logging.getLogger(__name__)

# === БЕЗПЕЧНИЙ ІМПОРТ ОСНОВНИХ СЕРВІСІВ ===

# 💰 RewardCalculator - ПРАЦЮЄ
reward_calculator = None
try:
    from .reward_calculator import (
        RewardCalculator,
        reward_calculator as _reward_calculator,
        calculate_daily_reward,
        get_reward_preview_for_user,
        validate_daily_claim
    )
    reward_calculator = _reward_calculator
    logger.info("✅ RewardCalculator імпортовано успішно")
except ImportError as e:
    logger.error(f"❌ Помилка імпорту RewardCalculator: {e}")
except Exception as e:
    logger.error(f"💥 Неочікувана помилка RewardCalculator: {e}")

# 📱 TelegramService - БЕЗПЕЧНИЙ ІМПОРТ
telegram_service = None
TelegramService = None
check_bot_started = check_channel_subscription = None
send_verification_message = get_bot_info = None

try:
    # Перевіряємо наявність telegram пакету
    import importlib.util
    telegram_spec = importlib.util.find_spec("telegram")

    if telegram_spec is None:
        logger.warning("⚠️ Пакет 'python-telegram-bot' не встановлено")
        raise ImportError("telegram package not found")

    from .telegram_service import (
        TelegramService as _TelegramService,
        telegram_service as _telegram_service,
        check_bot_started as _check_bot_started,
        check_channel_subscription as _check_channel_subscription,
        send_verification_message as _send_verification_message,
        get_bot_info as _get_bot_info
    )

    TelegramService = _TelegramService
    telegram_service = _telegram_service
    check_bot_started = _check_bot_started
    check_channel_subscription = _check_channel_subscription
    send_verification_message = _send_verification_message
    get_bot_info = _get_bot_info

    logger.info("✅ TelegramService імпортовано успішно")
except ImportError as e:
    logger.warning(f"⚠️ TelegramService недоступний: {e}")
    # Створюємо заглушки
    class TelegramService:
        def __init__(self): pass
        def check_bot_started_sync(self, user_id): return False
        def check_channel_subscription_sync(self, user_id, channel): return {'subscribed': False}

    def check_bot_started(user_id): return False
    def check_channel_subscription(user_id, channel): return {'subscribed': False}
    def send_verification_message(user_id, message): return False
    def get_bot_info(): return None

except Exception as e:
    logger.error(f"💥 Критична помилка TelegramService: {e}")

# 💎 TONConnectService - БЕЗПЕЧНИЙ ІМПОРТ
ton_connect_service = None
TONConnectService = None
TONNetwork = TONBalance = FlexTokenInfo = None
TransactionType = None

try:
    # Перевіряємо aiohttp
    import importlib.util
    aiohttp_spec = importlib.util.find_spec("aiohttp")

    if aiohttp_spec is None:
        logger.warning("⚠️ Пакет 'aiohttp' не встановлено")
        raise ImportError("aiohttp package not found")

    from .ton_connect_service import (
        TONConnectService as _TONConnectService,
        ton_connect_service as _ton_connect_service,
        TONNetwork as _TONNetwork,
        TransactionType as _TransactionType,
        TONBalance as _TONBalance,
        FlexTokenInfo as _FlexTokenInfo
    )

    TONConnectService = _TONConnectService
    ton_connect_service = _ton_connect_service
    TONNetwork = _TONNetwork
    TransactionType = _TransactionType
    TONBalance = _TONBalance
    FlexTokenInfo = _FlexTokenInfo

    logger.info("✅ TONConnectService імпортовано успішно")
except ImportError as e:
    logger.warning(f"⚠️ TONConnectService недоступний: {e}")
    # Заглушки
    class TONConnectService:
        def __init__(self): pass
        def get_wallet_balance_sync(self, address): return None

    from enum import Enum
    class TONNetwork(Enum):
        MAINNET = "mainnet"
        TESTNET = "testnet"

except Exception as e:
    logger.error(f"💥 Критична помилка TONConnectService: {e}")

# 💳 TransactionService - БЕЗПЕЧНИЙ ІМПОРТ
transaction_service = None
TransactionService = None
TransactionError = InsufficientFundsError = None
TransactionValidationError = TransactionProcessingError = None

try:
    from .transaction_service import (
        TransactionService as _TransactionService,
        transaction_service as _transaction_service,
        TransactionError as _TransactionError,
        InsufficientFundsError as _InsufficientFundsError,
        TransactionValidationError as _TransactionValidationError,
        TransactionProcessingError as _TransactionProcessingError
    )

    TransactionService = _TransactionService
    transaction_service = _transaction_service
    TransactionError = _TransactionError
    InsufficientFundsError = _InsufficientFundsError
    TransactionValidationError = _TransactionValidationError
    TransactionProcessingError = _TransactionProcessingError

    logger.info("✅ TransactionService імпортовано успішно")
except ImportError as e:
    logger.warning(f"⚠️ TransactionService недоступний: {e}")
    # Заглушки
    class TransactionService:
        def __init__(self): pass
        def process_reward(self, *args, **kwargs): return {'success': False, 'error': 'Service unavailable'}

    class TransactionError(Exception): pass
    class InsufficientFundsError(TransactionError): pass

except Exception as e:
    logger.error(f"💥 Критична помилка TransactionService: {e}")

# ✅ VerificationService - БЕЗПЕЧНИЙ ІМПОРТ БЕЗ АВТОСТАРТУ
verification_service = None
VerificationService = None
TaskType = VerificationStatus = None

try:
    from .verification_service import (
        VerificationService as _VerificationService,
        verification_service as _verification_service,
        TaskType as _TaskType,
        VerificationStatus as _VerificationStatus
    )

    VerificationService = _VerificationService
    verification_service = _verification_service
    TaskType = _TaskType
    VerificationStatus = _VerificationStatus

    logger.info("✅ VerificationService імпортовано успішно")
except ImportError as e:
    logger.warning(f"⚠️ VerificationService недоступний: {e}")
    # Заглушки
    class VerificationService:
        def __init__(self): pass
        def start_task_verification(self, *args): return {'success': False}

    from enum import Enum
    class TaskType(Enum):
        TELEGRAM_SUBSCRIBE = "telegram_subscribe"

except Exception as e:
    logger.error(f"💥 Критична помилка VerificationService: {e}")

# === ГЛОБАЛЬНІ ІНСТАНЦІЇ СЕРВІСІВ ===
SERVICES = {
    'reward_calculator': reward_calculator,
    'telegram_service': telegram_service,
    'ton_connect_service': ton_connect_service,
    'transaction_service': transaction_service,
    'verification_service': verification_service
}

# === ФУНКЦІЇ-ХЕЛПЕРИ ===

def get_service(service_name: str):
    """Безпечне отримання сервісу за назвою"""
    service = SERVICES.get(service_name)
    if service is None:
        logger.warning(f"⚠️ Сервіс '{service_name}' недоступний")
    return service

def check_services_health():
    """Перевірка здоров'я всіх сервісів"""
    health_status = {}

    for name, service in SERVICES.items():
        try:
            if service is not None:
                if hasattr(service, 'get_stats'):
                    stats = service.get_stats()
                    health_status[name] = {'status': 'healthy', 'stats': stats}
                elif hasattr(service, '__class__'):
                    health_status[name] = {'status': 'healthy', 'class': service.__class__.__name__}
                else:
                    health_status[name] = {'status': 'unknown'}
            else:
                health_status[name] = {'status': 'unavailable'}
        except Exception as e:
            health_status[name] = {'status': 'error', 'error': str(e)}

    return health_status

def init_all_services():
    """Безпечна ініціалізація всіх сервісів"""
    logger.info("🚀 Безпечна ініціалізація всіх сервісів WINIX...")

    available_services = []
    failed_services = []

    for name, service in SERVICES.items():
        if service is not None:
            try:
                # Тестова перевірка сервісу
                if hasattr(service, '__class__'):
                    available_services.append(name)
                    logger.info(f"✅ {name} готовий до роботи")
                else:
                    failed_services.append(name)
                    logger.warning(f"⚠️ {name} частково доступний")
            except Exception as e:
                failed_services.append(name)
                logger.error(f"❌ {name} має помилки: {e}")
        else:
            failed_services.append(name)
            logger.error(f"❌ {name} недоступний")

    logger.info(f"📊 Статус сервісів: {len(available_services)}/{len(SERVICES)} повністю доступні")

    if failed_services:
        logger.warning(f"⚠️ Проблемні сервіси: {', '.join(failed_services)}")

    return {
        'available': available_services,
        'failed': failed_services,
        'total': len(SERVICES),
        'success_rate': (len(available_services) / len(SERVICES)) * 100 if SERVICES else 0
    }

# === ЕКСПОРТ ===
__all__ = [
    # Класи сервісів
    'RewardCalculator', 'TelegramService', 'TONConnectService',
    'TransactionService', 'VerificationService',

    # Глобальні інстанції
    'reward_calculator', 'telegram_service', 'ton_connect_service',
    'transaction_service', 'verification_service',

    # Функції-хелпери
    'calculate_daily_reward', 'get_reward_preview_for_user', 'validate_daily_claim',
    'check_bot_started', 'check_channel_subscription', 'send_verification_message', 'get_bot_info',

    # Винятки
    'TransactionError', 'InsufficientFundsError',
    'TransactionValidationError', 'TransactionProcessingError',

    # Енуми
    'TONNetwork', 'TransactionType', 'TaskType', 'VerificationStatus',

    # Датакласи
    'TONBalance', 'FlexTokenInfo',

    # Утиліти пакету
    'get_service', 'check_services_health', 'init_all_services', 'SERVICES'
]

# Автоматична безпечна ініціалізація при імпорті
logger.info("🎯 Services package ініціалізовано з безпечними fallback'ами")

# Статистика завантаження
available_count = len([s for s in SERVICES.values() if s is not None])
total_count = len(SERVICES)

if available_count == total_count:
    logger.info("🎉 ВСІ СЕРВІСИ ЗАВАНТАЖЕНО УСПІШНО!")
elif available_count > 0:
    logger.warning(f"⚠️ Частково завантажено: {available_count}/{total_count} сервісів")
else:
    logger.error(f"❌ КРИТИЧНО: Жодного сервісу не завантажено!")

logger.info("✅ Services package готовий до роботи з fallback підтримкою")