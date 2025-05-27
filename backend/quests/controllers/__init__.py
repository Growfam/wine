"""
Ініціалізація контролерів системи завдань WINIX
Централізований імпорт та експорт всіх контролерів
"""

import logging
from typing import Dict, Any

logger = logging.getLogger(__name__)

# Контролери та їх статуси
_controllers_status: Dict[str, Dict[str, Any]] = {}

# === ANALYTICS CONTROLLER ===
try:
    from .analytics_controller import (
        AnalyticsController,
        register_analytics_routes,
        track_user_action,
        track_task_action,
        track_error
    )

    _controllers_status['analytics'] = {
        'loaded': True,
        'controller': AnalyticsController,
        'functions': ['track_user_action', 'track_task_action', 'track_error'],
        'routes': ['register_analytics_routes']
    }
    logger.info("✅ Analytics контролер завантажено")
except ImportError as e:
    logger.warning(f"⚠️ Analytics контролер недоступний: {e}")
    _controllers_status['analytics'] = {
        'loaded': False,
        'error': str(e),
        'controller': None
    }
    # Заглушки
    AnalyticsController = None
    register_analytics_routes = None
    track_user_action = None
    track_task_action = None
    track_error = None

# === AUTH CONTROLLER ===
try:
    from backend.auth.controllers import (
        AuthController,
        validate_telegram_route,
        refresh_token_route,
        validate_token_route
    )

    _controllers_status['auth'] = {
        'loaded': True,
        'controller': AuthController,
        'functions': ['validate_telegram_route', 'refresh_token_route', 'validate_token_route']
    }
    logger.info("✅ Auth контролер завантажено")
except ImportError as e:
    logger.warning(f"⚠️ Auth контролер недоступний: {e}")
    _controllers_status['auth'] = {
        'loaded': False,
        'error': str(e),
        'controller': None
    }
    # Заглушки
    AuthController = None
    validate_telegram_route = None
    refresh_token_route = None
    validate_token_route = None

# === DAILY CONTROLLER ===
try:
    from .daily_controller import (
        DailyController,
        get_daily_status_route,
        claim_daily_bonus_route,
        get_daily_history_route,
        calculate_reward_route,
        get_reward_preview_route,
        reset_streak_route,
        get_daily_statistics_route
    )

    _controllers_status['daily'] = {
        'loaded': True,
        'controller': DailyController,
        'functions': [
            'get_daily_status_route', 'claim_daily_bonus_route',
            'get_daily_history_route', 'calculate_reward_route',
            'get_reward_preview_route', 'reset_streak_route',
            'get_daily_statistics_route'
        ]
    }
    logger.info("✅ Daily контролер завантажено")
except ImportError as e:
    logger.warning(f"⚠️ Daily контролер недоступний: {e}")
    _controllers_status['daily'] = {
        'loaded': False,
        'error': str(e),
        'controller': None
    }
    # Заглушки
    DailyController = None
    get_daily_status_route = None
    claim_daily_bonus_route = None
    get_daily_history_route = None
    calculate_reward_route = None
    get_reward_preview_route = None
    reset_streak_route = None
    get_daily_statistics_route = None

# === FLEX CONTROLLER ===
try:
    from .flex_controller import (
        FlexController,
        get_flex_balance,
        check_flex_levels,
        claim_flex_reward,
        get_flex_history,
        get_user_flex_status,
        get_flex_statistics,
        get_flex_levels_config,
        get_flex_health
    )

    _controllers_status['flex'] = {
        'loaded': True,
        'controller': FlexController,
        'functions': [
            'get_flex_balance', 'check_flex_levels', 'claim_flex_reward',
            'get_flex_history', 'get_user_flex_status', 'get_flex_statistics',
            'get_flex_levels_config', 'get_flex_health'
        ]
    }
    logger.info("✅ FLEX контролер завантажено")
except ImportError as e:
    logger.warning(f"⚠️ FLEX контролер недоступний: {e}")
    _controllers_status['flex'] = {
        'loaded': False,
        'error': str(e),
        'controller': None
    }
    # Заглушки
    FlexController = None
    get_flex_balance = None
    check_flex_levels = None
    claim_flex_reward = None
    get_flex_history = None
    get_user_flex_status = None
    get_flex_statistics = None
    get_flex_levels_config = None
    get_flex_health = None

# === TASKS CONTROLLER ===
try:
    from .tasks_controller import (
        TasksController,
        get_tasks_list,
        get_task_details,
        start_task,
        verify_task,
        create_task,
        get_user_task_progress,
        get_tasks_statistics,
        get_tasks_health
    )

    _controllers_status['tasks'] = {
        'loaded': True,
        'controller': TasksController,
        'functions': [
            'get_tasks_list', 'get_task_details', 'start_task',
            'verify_task', 'create_task', 'get_user_task_progress',
            'get_tasks_statistics', 'get_tasks_health'
        ]
    }
    logger.info("✅ Tasks контролер завантажено")
except ImportError as e:
    logger.warning(f"⚠️ Tasks контролер недоступний: {e}")
    _controllers_status['tasks'] = {
        'loaded': False,
        'error': str(e),
        'controller': None
    }
    # Заглушки
    TasksController = None
    get_tasks_list = None
    get_task_details = None
    start_task = None
    verify_task = None
    create_task = None
    get_user_task_progress = None
    get_tasks_statistics = None
    get_tasks_health = None

# === TRANSACTION CONTROLLER ===
try:
    from .transaction_controller import (
        TransactionController,
        process_reward_route,
        process_spending_route,
        get_transaction_history_route,
        get_balance_summary_route,
        get_statistics_route
    )

    _controllers_status['transaction'] = {
        'loaded': True,
        'controller': TransactionController,
        'functions': [
            'process_reward_route', 'process_spending_route',
            'get_transaction_history_route', 'get_balance_summary_route',
            'get_statistics_route'
        ]
    }
    logger.info("✅ Transaction контролер завантажено")
except ImportError as e:
    logger.warning(f"⚠️ Transaction контролер недоступний: {e}")
    _controllers_status['transaction'] = {
        'loaded': False,
        'error': str(e),
        'controller': None
    }
    # Заглушки
    TransactionController = None
    process_reward_route = None
    process_spending_route = None
    get_transaction_history_route = None
    get_balance_summary_route = None
    get_statistics_route = None

# === USER CONTROLLER ===
try:
    from .user_controller import (
        UserController,
        get_profile_route,
        get_balance_route,
        update_balance_route,
        get_stats_route,
        update_settings_route,
        add_reward_route,
        get_transaction_history_route as user_transaction_history_route
    )

    _controllers_status['user'] = {
        'loaded': True,
        'controller': UserController,
        'functions': [
            'get_profile_route', 'get_balance_route', 'update_balance_route',
            'get_stats_route', 'update_settings_route', 'add_reward_route',
            'user_transaction_history_route'
        ]
    }
    logger.info("✅ User контролер завантажено")
except ImportError as e:
    logger.warning(f"⚠️ User контролер недоступний: {e}")
    _controllers_status['user'] = {
        'loaded': False,
        'error': str(e),
        'controller': None
    }
    # Заглушки
    UserController = None
    get_profile_route = None
    get_balance_route = None
    update_balance_route = None
    get_stats_route = None
    update_settings_route = None
    add_reward_route = None
    user_transaction_history_route = None

# === VERIFICATION CONTROLLER ===
try:
    from .verification_controller import (
        verify_telegram_subscription,
        check_bot_started,
        verify_social_task,
        start_task_verification,
        check_verification_status,
        complete_verification,
        get_verification_statistics,
        cleanup_expired_verifications,
        get_telegram_bot_info,
        get_user_completed_tasks,
        check_task_completion
    )

    _controllers_status['verification'] = {
        'loaded': True,
        'controller': None,  # Немає класу-контролера
        'functions': [
            'verify_telegram_subscription', 'check_bot_started',
            'verify_social_task', 'start_task_verification',
            'check_verification_status', 'complete_verification',
            'get_verification_statistics', 'cleanup_expired_verifications',
            'get_telegram_bot_info', 'get_user_completed_tasks',
            'check_task_completion'
        ]
    }
    logger.info("✅ Verification контролер завантажено")
except ImportError as e:
    logger.warning(f"⚠️ Verification контролер недоступний: {e}")
    _controllers_status['verification'] = {
        'loaded': False,
        'error': str(e),
        'controller': None
    }
    # Заглушки
    verify_telegram_subscription = None
    check_bot_started = None
    verify_social_task = None
    start_task_verification = None
    check_verification_status = None
    complete_verification = None
    get_verification_statistics = None
    cleanup_expired_verifications = None
    get_telegram_bot_info = None
    get_user_completed_tasks = None
    check_task_completion = None

# === WALLET CONTROLLER ===
try:
    from .wallet_controller import (
        WalletController,
        check_wallet_status,
        connect_wallet,
        disconnect_wallet,
        verify_wallet,
        get_wallet_balance,
        get_wallet_transactions,
        get_wallet_statistics,
        get_wallet_health
    )

    _controllers_status['wallet'] = {
        'loaded': True,
        'controller': WalletController,
        'functions': [
            'check_wallet_status', 'connect_wallet', 'disconnect_wallet',
            'verify_wallet', 'get_wallet_balance', 'get_wallet_transactions',
            'get_wallet_statistics', 'get_wallet_health'
        ]
    }
    logger.info("✅ Wallet контролер завантажено")
except ImportError as e:
    logger.warning(f"⚠️ Wallet контролер недоступний: {e}")
    _controllers_status['wallet'] = {
        'loaded': False,
        'error': str(e),
        'controller': None
    }
    # Заглушки
    WalletController = None
    check_wallet_status = None
    connect_wallet = None
    disconnect_wallet = None
    verify_wallet = None
    get_wallet_balance = None
    get_wallet_transactions = None
    get_wallet_statistics = None
    get_wallet_health = None


def get_controllers_status() -> Dict[str, Any]:
    """
    Отримання статусу всіх контролерів

    Returns:
        Dict з інформацією про статус кожного контролера
    """
    return _controllers_status.copy()


def get_loaded_controllers() -> Dict[str, Any]:
    """
    Отримання списку завантажених контролерів

    Returns:
        Dict з завантаженими контролерами
    """
    return {
        name: status for name, status in _controllers_status.items()
        if status.get('loaded', False)
    }


def get_failed_controllers() -> Dict[str, Any]:
    """
    Отримання списку контролерів що не завантажились

    Returns:
        Dict з контролерами що не завантажились
    """
    return {
        name: status for name, status in _controllers_status.items()
        if not status.get('loaded', False)
    }


def log_controllers_summary():
    """Виведення підсумку завантаження контролерів"""
    loaded_count = len(get_loaded_controllers())
    failed_count = len(get_failed_controllers())
    total_count = len(_controllers_status)

    logger.info(f"📊 Статус контролерів: {loaded_count}/{total_count} завантажено")

    if loaded_count > 0:
        logger.info("✅ Завантажені контролери:")
        for name in get_loaded_controllers().keys():
            logger.info(f"  • {name}")

    if failed_count > 0:
        logger.warning("❌ Контролери з помилками:")
        for name, status in get_failed_controllers().items():
            logger.warning(f"  • {name}: {status.get('error', 'Unknown error')}")


# Логуємо підсумок при імпорті
log_controllers_summary()

# Експорт всіх доступних контролерів та функцій
__all__ = [
    # Класи контролерів
    'AnalyticsController',
    'AuthController',
    'DailyController',
    'FlexController',
    'TasksController',
    'TransactionController',
    'UserController',
    'WalletController',

    # Analytics функції
    'register_analytics_routes',
    'track_user_action',
    'track_task_action',
    'track_error',

    # Auth функції
    'validate_telegram_route',
    'refresh_token_route',
    'validate_token_route',

    # Daily функції
    'get_daily_status_route',
    'claim_daily_bonus_route',
    'get_daily_history_route',
    'calculate_reward_route',
    'get_reward_preview_route',
    'reset_streak_route',
    'get_daily_statistics_route',

    # FLEX функції
    'get_flex_balance',
    'check_flex_levels',
    'claim_flex_reward',
    'get_flex_history',
    'get_user_flex_status',
    'get_flex_statistics',
    'get_flex_levels_config',
    'get_flex_health',

    # Tasks функції
    'get_tasks_list',
    'get_task_details',
    'start_task',
    'verify_task',
    'create_task',
    'get_user_task_progress',
    'get_tasks_statistics',
    'get_tasks_health',

    # Transaction функції
    'process_reward_route',
    'process_spending_route',
    'get_transaction_history_route',
    'get_balance_summary_route',
    'get_statistics_route',

    # User функції
    'get_profile_route',
    'get_balance_route',
    'update_balance_route',
    'get_stats_route',
    'update_settings_route',
    'add_reward_route',
    'user_transaction_history_route',

    # Verification функції
    'verify_telegram_subscription',
    'check_bot_started',
    'verify_social_task',
    'start_task_verification',
    'check_verification_status',
    'complete_verification',
    'get_verification_statistics',
    'cleanup_expired_verifications',
    'get_telegram_bot_info',
    'get_user_completed_tasks',
    'check_task_completion',

    # Wallet функції
    'check_wallet_status',
    'connect_wallet',
    'disconnect_wallet',
    'verify_wallet',
    'get_wallet_balance',
    'get_wallet_transactions',
    'get_wallet_statistics',
    'get_wallet_health',

    # Утилітарні функції
    'get_controllers_status',
    'get_loaded_controllers',
    'get_failed_controllers',
    'log_controllers_summary'
]