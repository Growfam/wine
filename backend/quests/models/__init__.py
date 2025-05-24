"""
📊 WINIX Models Package
Моделі даних системи завдань WINIX

Цей пакет містить всі моделі для роботи з даними:
- Користувачі та їх завдання
- Транзакції та винагороди
- Щоденні бонуси та FLEX системи
- Аналітика та статистика
- TON гаманці та завдання
"""

import logging
from typing import Dict, Any, Optional

logger = logging.getLogger(__name__)

# Словник для відстеження статусу моделей
_models_status: Dict[str, Dict[str, Any]] = {}

# === ANALYTICS MODEL ===
try:
    from .analytics import (
        AnalyticsDB,
        AnalyticsEvent,
        UserSession,
        UserStats,
        EventType,
        EventSeverity,
        analytics_db,
        create_event,
        create_task_event,
        create_wallet_event
    )
    _models_status['analytics'] = {
        'loaded': True,
        'classes': ['AnalyticsDB', 'AnalyticsEvent', 'UserSession', 'UserStats'],
        'enums': ['EventType', 'EventSeverity'],
        'functions': ['create_event', 'create_task_event', 'create_wallet_event'],
        'instances': ['analytics_db'],
        'description': 'Аналітика та статистика користувачів'
    }
    logger.info("✅ Analytics моделі імпортовано")
except ImportError as e:
    logger.warning(f"⚠️ Analytics моделі недоступні: {e}")
    _models_status['analytics'] = {'loaded': False, 'error': str(e)}
    # Заглушки
    AnalyticsDB = AnalyticsEvent = UserSession = UserStats = None
    EventType = EventSeverity = analytics_db = None
    create_event = create_task_event = create_wallet_event = None

# === DAILY BONUS MODEL ===
try:
    from .daily_bonus import (
        DailyBonusEntry,
        DailyBonusStatus,
        DailyBonusManager,
        daily_bonus_manager,
        create_new_daily_status,
        get_daily_bonus_constants,
        Reward
    )
    _models_status['daily_bonus'] = {
        'loaded': True,
        'classes': ['DailyBonusEntry', 'DailyBonusStatus', 'DailyBonusManager', 'Reward'],
        'functions': ['create_new_daily_status', 'get_daily_bonus_constants'],
        'instances': ['daily_bonus_manager'],
        'description': 'Щоденні бонуси та серії'
    }
    logger.info("✅ Daily Bonus моделі імпортовано")
except ImportError as e:
    logger.warning(f"⚠️ Daily Bonus моделі недоступні: {e}")
    _models_status['daily_bonus'] = {'loaded': False, 'error': str(e)}
    # Заглушки
    DailyBonusEntry = DailyBonusStatus = DailyBonusManager = None
    daily_bonus_manager = create_new_daily_status = get_daily_bonus_constants = None
    Reward = None

# === FLEX REWARDS MODEL ===
try:
    from .flex_rewards import (
        FlexRewardsModel,
        FlexLevel,
        RewardStatus,
        FlexRewardConfig,
        UserFlexStatus,
        flex_rewards_model
    )
    _models_status['flex_rewards'] = {
        'loaded': True,
        'classes': ['FlexRewardsModel', 'FlexRewardConfig', 'UserFlexStatus'],
        'enums': ['FlexLevel', 'RewardStatus'],
        'instances': ['flex_rewards_model'],
        'description': 'FLEX токени та винагороди'
    }
    logger.info("✅ FLEX Rewards моделі імпортовано")
except ImportError as e:
    logger.warning(f"⚠️ FLEX Rewards моделі недоступні: {e}")
    _models_status['flex_rewards'] = {'loaded': False, 'error': str(e)}
    # Заглушки
    FlexRewardsModel = FlexLevel = RewardStatus = None
    FlexRewardConfig = UserFlexStatus = flex_rewards_model = None

# === TASK MODEL ===
try:
    from .task import (
        TaskModel,
        TaskType,
        TaskStatus,
        TaskPlatform,
        TaskAction,
        TaskReward,
        TaskRequirements,
        TaskMetadata,
        task_model
    )
    _models_status['task'] = {
        'loaded': True,
        'classes': ['TaskModel', 'TaskReward', 'TaskRequirements', 'TaskMetadata'],
        'enums': ['TaskType', 'TaskStatus', 'TaskPlatform', 'TaskAction'],
        'instances': ['task_model'],
        'description': 'Завдання та їх виконання'
    }
    logger.info("✅ Task моделі імпортовано")
except ImportError as e:
    logger.warning(f"⚠️ Task моделі недоступні: {e}")
    _models_status['task'] = {'loaded': False, 'error': str(e)}
    # Заглушки
    TaskModel = TaskType = TaskStatus = TaskPlatform = TaskAction = None
    TaskReward = TaskRequirements = TaskMetadata = task_model = None

# === TRANSACTION MODEL ===
try:
    from .transaction import (
        TransactionModel,
        Transaction,
        TransactionAmount,
        TransactionType,
        TransactionStatus,
        CurrencyType,
        transaction_model
    )
    _models_status['transaction'] = {
        'loaded': True,
        'classes': ['TransactionModel', 'Transaction', 'TransactionAmount'],
        'enums': ['TransactionType', 'TransactionStatus', 'CurrencyType'],
        'instances': ['transaction_model'],
        'description': 'Транзакції та операції з балансом'
    }
    logger.info("✅ Transaction моделі імпортовано")
except ImportError as e:
    logger.warning(f"⚠️ Transaction моделі недоступні: {e}")
    _models_status['transaction'] = {'loaded': False, 'error': str(e)}
    # Заглушки
    TransactionModel = Transaction = TransactionAmount = None
    TransactionType = TransactionStatus = CurrencyType = transaction_model = None

# === USER QUEST MODEL ===
try:
    from .user_quest import (
        UserQuest,
        UserBalance,
        Reward as UserReward,
        TaskStatus as UserTaskStatus,
        create_new_user,
        validate_telegram_id,
        get_current_utc_time
    )
    _models_status['user_quest'] = {
        'loaded': True,
        'classes': ['UserQuest', 'UserBalance'],
        'functions': ['create_new_user', 'validate_telegram_id', 'get_current_utc_time'],
        'description': 'Користувачі та їх профілі'
    }
    logger.info("✅ User Quest моделі імпортовано")
except ImportError as e:
    logger.warning(f"⚠️ User Quest моделі недоступні: {e}")
    _models_status['user_quest'] = {'loaded': False, 'error': str(e)}
    # Заглушки
    UserQuest = UserBalance = UserReward = UserTaskStatus = None
    create_new_user = validate_telegram_id = get_current_utc_time = None

# === WALLET MODEL ===
try:
    from .wallet import (
        WalletModel,
        WalletStatus,
        WalletProvider,
        WalletConnectionBonus,
        wallet_model
    )
    _models_status['wallet'] = {
        'loaded': True,
        'classes': ['WalletModel', 'WalletConnectionBonus'],
        'enums': ['WalletStatus', 'WalletProvider'],
        'instances': ['wallet_model'],
        'description': 'TON гаманці та з\'єднання'
    }
    logger.info("✅ Wallet моделі імпортовано")
except ImportError as e:
    logger.warning(f"⚠️ Wallet моделі недоступні: {e}")
    _models_status['wallet'] = {'loaded': False, 'error': str(e)}
    # Заглушки
    WalletModel = WalletStatus = WalletProvider = None
    WalletConnectionBonus = wallet_model = None

# === УТИЛІТИ ПАКЕТУ ===

def get_models_status() -> Dict[str, Any]:
    """
    Отримання статусу всіх моделей

    Returns:
        Dict з інформацією про статус кожної моделі
    """
    return _models_status.copy()

def get_loaded_models() -> Dict[str, Any]:
    """
    Отримання списку завантажених моделей

    Returns:
        Dict з завантаженими моделями
    """
    return {
        name: status for name, status in _models_status.items()
        if status.get('loaded', False)
    }

def get_failed_models() -> Dict[str, Any]:
    """
    Отримання списку моделей що не завантажились

    Returns:
        Dict з моделями що не завантажились
    """
    return {
        name: status for name, status in _models_status.items()
        if not status.get('loaded', False)
    }

def initialize_models() -> Dict[str, Any]:
    """
    Ініціалізація всіх моделей

    Returns:
        Dict з результатом ініціалізації
    """
    logger.info("🚀 Ініціалізація моделей WINIX...")

    loaded = get_loaded_models()
    failed = get_failed_models()

    result = {
        'total_models': len(_models_status),
        'loaded_models': len(loaded),
        'failed_models': len(failed),
        'success_rate': (len(loaded) / len(_models_status)) * 100 if _models_status else 0,
        'loaded_list': list(loaded.keys()),
        'failed_list': list(failed.keys()),
        'status': 'healthy' if len(loaded) >= len(failed) else 'degraded'
    }

    if result['success_rate'] == 100:
        logger.info(f"🎉 Всі {result['total_models']} моделей ініціалізовано успішно!")
    else:
        logger.warning(f"⚠️ Ініціалізовано {result['loaded_models']}/{result['total_models']} моделей")

    return result

def get_model_by_name(model_name: str):
    """
    Отримання моделі за назвою

    Args:
        model_name: Назва моделі

    Returns:
        Інстанція моделі або None
    """
    model_instances = {
        'analytics': analytics_db,
        'daily_bonus': daily_bonus_manager,
        'flex_rewards': flex_rewards_model,
        'task': task_model,
        'transaction': transaction_model,
        'wallet': wallet_model
    }

    model_instance = model_instances.get(model_name)
    if model_instance is None:
        logger.warning(f"⚠️ Модель '{model_name}' не знайдена або недоступна")

    return model_instance

def create_user_from_telegram_data(telegram_data: Dict[str, Any]) -> Optional[UserQuest]:
    """
    Створення користувача з Telegram даних

    Args:
        telegram_data: Дані з Telegram WebApp

    Returns:
        UserQuest об'єкт або None
    """
    try:
        if not UserQuest:
            logger.error("UserQuest модель недоступна")
            return None

        telegram_id = telegram_data.get('id')
        if not validate_telegram_id(telegram_id):
            logger.error(f"Невірний telegram_id: {telegram_id}")
            return None

        return create_new_user(
            telegram_id=telegram_id,
            username=telegram_data.get('username', ''),
            first_name=telegram_data.get('first_name', ''),
            last_name=telegram_data.get('last_name', ''),
            language_code=telegram_data.get('language_code', 'uk')
        )

    except Exception as e:
        logger.error(f"Помилка створення користувача з Telegram даних: {e}")
        return None

def create_transaction_for_reward(telegram_id: str, reward_data: Dict[str, Any],
                                 transaction_type: str, description: str = "") -> Optional[Transaction]:
    """
    Створення транзакції для винагороди

    Args:
        telegram_id: ID користувача
        reward_data: Дані винагороди
        transaction_type: Тип транзакції
        description: Опис транзакції

    Returns:
        Transaction об'єкт або None
    """
    try:
        if not Transaction or not TransactionAmount or not TransactionType:
            logger.error("Transaction моделі недоступні")
            return None

        amount = TransactionAmount(
            winix=float(reward_data.get('winix', 0)),
            tickets=int(reward_data.get('tickets', 0)),
            flex=int(reward_data.get('flex', 0))
        )

        return Transaction(
            telegram_id=telegram_id,
            type=TransactionType(transaction_type),
            amount=amount,
            description=description
        )

    except Exception as e:
        logger.error(f"Помилка створення транзакції: {e}")
        return None

def log_models_summary():
    """Виведення підсумку завантаження моделей"""
    loaded = get_loaded_models()
    failed = get_failed_models()

    logger.info(f"📊 Статус моделей: {len(loaded)}/{len(_models_status)} завантажено")

    if loaded:
        logger.info("✅ Завантажені моделі:")
        for name, status in loaded.items():
            classes_count = len(status.get('classes', []))
            enums_count = len(status.get('enums', []))
            functions_count = len(status.get('functions', []))
            logger.info(f"  • {name}: {classes_count} класів, {enums_count} енумів, {functions_count} функцій - {status.get('description', '')}")

    if failed:
        logger.warning("❌ Моделі з помилками:")
        for name, status in failed.items():
            logger.warning(f"  • {name}: {status.get('error', 'Unknown error')}")

# Автоматичний виклик при імпорті
log_models_summary()

# === ЕКСПОРТ ===

__all__ = [
    # === ANALYTICS ===
    'AnalyticsDB',
    'AnalyticsEvent',
    'UserSession',
    'UserStats',
    'EventType',
    'EventSeverity',
    'analytics_db',
    'create_event',
    'create_task_event',
    'create_wallet_event',

    # === DAILY BONUS ===
    'DailyBonusEntry',
    'DailyBonusStatus',
    'DailyBonusManager',
    'daily_bonus_manager',
    'create_new_daily_status',
    'get_daily_bonus_constants',
    'Reward',

    # === FLEX REWARDS ===
    'FlexRewardsModel',
    'FlexLevel',
    'RewardStatus',
    'FlexRewardConfig',
    'UserFlexStatus',
    'flex_rewards_model',

    # === TASK ===
    'TaskModel',
    'TaskType',
    'TaskStatus',
    'TaskPlatform',
    'TaskAction',
    'TaskReward',
    'TaskRequirements',
    'TaskMetadata',
    'task_model',

    # === TRANSACTION ===
    'TransactionModel',
    'Transaction',
    'TransactionAmount',
    'TransactionType',
    'TransactionStatus',
    'CurrencyType',
    'transaction_model',

    # === USER QUEST ===
    'UserQuest',
    'UserBalance',
    'UserReward',
    'UserTaskStatus',
    'create_new_user',
    'validate_telegram_id',
    'get_current_utc_time',

    # === WALLET ===
    'WalletModel',
    'WalletStatus',
    'WalletProvider',
    'WalletConnectionBonus',
    'wallet_model',

    # === УТИЛІТИ ПАКЕТУ ===
    'get_models_status',
    'get_loaded_models',
    'get_failed_models',
    'initialize_models',
    'get_model_by_name',
    'create_user_from_telegram_data',
    'create_transaction_for_reward',
    'log_models_summary'
]