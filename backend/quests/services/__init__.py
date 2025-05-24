"""
🚀 WINIX Services Package
Ініціалізація всіх сервісів системи завдань

Цей файл організує доступ до всіх сервісів проекту WINIX.
Імпортуй сервіси просто: from backend.quests.services import reward_calculator
"""

import logging

logger = logging.getLogger(__name__)

# === ІМПОРТ ОСНОВНИХ СЕРВІСІВ ===

try:
    # 💰 Сервіс розрахунку винагород
    from .reward_calculator import (
        RewardCalculator,
        reward_calculator,
        calculate_daily_reward,
        get_reward_preview_for_user,
        validate_daily_claim
    )

    logger.info("✅ RewardCalculator імпортовано")
except ImportError as e:
    logger.error(f"❌ Помилка імпорту RewardCalculator: {e}")
    reward_calculator = None

try:
    # 📱 Telegram сервіс
    from .telegram_service import (
        TelegramService,
        telegram_service,
        check_bot_started,
        check_channel_subscription,
        send_verification_message,
        get_bot_info
    )

    logger.info("✅ TelegramService імпортовано")
except ImportError as e:
    logger.error(f"❌ Помилка імпорту TelegramService: {e}")
    telegram_service = None

try:
    # 💎 TON Connect сервіс
    from .ton_connect_service import (
        TONConnectService,
        ton_connect_service,
        TONNetwork,
        TransactionType,
        TONBalance,
        FlexTokenInfo
    )

    logger.info("✅ TONConnectService імпортовано")
except ImportError as e:
    logger.error(f"❌ Помилка імпорту TONConnectService: {e}")
    ton_connect_service = None

try:
    # 💳 Сервіс транзакцій
    from .transaction_service import (
        TransactionService,
        transaction_service,
        TransactionError,
        InsufficientFundsError,
        TransactionValidationError,
        TransactionProcessingError
    )

    logger.info("✅ TransactionService імпортовано")
except ImportError as e:
    logger.error(f"❌ Помилка імпорту TransactionService: {e}")
    transaction_service = None

try:
    # ✅ Сервіс верифікації завдань
    from .verification_service import (
        VerificationService,
        verification_service,
        TaskType,
        VerificationStatus
    )

    logger.info("✅ VerificationService імпортовано")
except ImportError as e:
    logger.error(f"❌ Помилка імпорту VerificationService: {e}")
    verification_service = None

# === ГЛОБАЛЬНІ ІНСТАНЦІЇ СЕРВІСІВ ===

# Основні сервіси, готові до використання 🔥
SERVICES = {
    'reward_calculator': reward_calculator,
    'telegram_service': telegram_service,
    'ton_connect_service': ton_connect_service,
    'transaction_service': transaction_service,
    'verification_service': verification_service
}


# === ФУНКЦІЇ-ХЕЛПЕРИ ===

def get_service(service_name: str):
    """
    Отримати сервіс за назвою

    Args:
        service_name: Назва сервісу

    Returns:
        Інстанція сервісу або None

    Example:
        >>> reward_calc = get_service('reward_calculator')
        >>> if reward_calc:
        >>>     reward = reward_calc.calculate_daily_bonus(1, 1)
    """
    service = SERVICES.get(service_name)
    if service is None:
        logger.warning(f"⚠️ Сервіс '{service_name}' недоступний")
    return service


def check_services_health():
    """
    Перевірка здоров'я всіх сервісів

    Returns:
        Dict з статусом кожного сервісу
    """
    health_status = {}

    for name, service in SERVICES.items():
        try:
            if service is not None:
                # Перевіряємо чи сервіс має метод get_stats або similar
                if hasattr(service, 'get_stats'):
                    stats = service.get_stats()
                    health_status[name] = {
                        'status': 'healthy',
                        'stats': stats
                    }
                elif hasattr(service, '__class__'):
                    health_status[name] = {
                        'status': 'healthy',
                        'class': service.__class__.__name__
                    }
                else:
                    health_status[name] = {'status': 'unknown'}
            else:
                health_status[name] = {'status': 'unavailable'}
        except Exception as e:
            health_status[name] = {
                'status': 'error',
                'error': str(e)
            }

    return health_status


def init_all_services():
    """
    Ініціалізація всіх сервісів
    Корисно при старті додатку
    """
    logger.info("🚀 Ініціалізація всіх сервісів WINIX...")

    available_services = []
    failed_services = []

    for name, service in SERVICES.items():
        if service is not None:
            available_services.append(name)
            logger.info(f"✅ {name} готовий до роботи")
        else:
            failed_services.append(name)
            logger.error(f"❌ {name} недоступний")

    logger.info(f"📊 Статус сервісів: {len(available_services)}/{len(SERVICES)} доступні")

    if failed_services:
        logger.warning(f"⚠️ Недоступні сервіси: {', '.join(failed_services)}")

    return {
        'available': available_services,
        'failed': failed_services,
        'total': len(SERVICES)
    }


# === ЕКСПОРТ ===

__all__ = [
    # Класи сервісів
    'RewardCalculator',
    'TelegramService',
    'TONConnectService',
    'TransactionService',
    'VerificationService',

    # Глобальні інстанції
    'reward_calculator',
    'telegram_service',
    'ton_connect_service',
    'transaction_service',
    'verification_service',

    # Функції-хелпери
    'calculate_daily_reward',
    'get_reward_preview_for_user',
    'validate_daily_claim',
    'check_bot_started',
    'check_channel_subscription',
    'send_verification_message',
    'get_bot_info',

    # Винятки
    'TransactionError',
    'InsufficientFundsError',
    'TransactionValidationError',
    'TransactionProcessingError',

    # Енуми
    'TONNetwork',
    'TransactionType',
    'TaskType',
    'VerificationStatus',

    # Датакласи
    'TONBalance',
    'FlexTokenInfo',

    # Утиліти пакету
    'get_service',
    'check_services_health',
    'init_all_services',
    'SERVICES'
]

# Автоматична ініціалізація при імпорті
logger.info("🎯 Services package ініціалізовано")

# Перевіряємо доступність критично важливих сервісів
critical_services = ['reward_calculator', 'transaction_service']
missing_critical = [name for name in critical_services if SERVICES.get(name) is None]

if missing_critical:
    logger.critical(f"🚨 КРИТИЧНІ СЕРВІСИ НЕДОСТУПНІ: {missing_critical}")
else:
    logger.info("✅ Всі критичні сервіси доступні")