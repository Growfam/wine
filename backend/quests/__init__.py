"""
🏆 WINIX Quests Package - ULTIMATE INIT
Повна система завдань з TON інтеграцією

Цей файл - це ЦЕНТР ВСЕСВІТУ твого WINIX проекту! 🌟
Тут об'єднано ВСЕ: моделі, сервіси, контролери, маршрути, утиліти.

Автор: ростік 🇺🇦
Версія: 2.0.1 (MEGA EDITION)
Дата: 2025

🎯 Можливості:
- 📊 Повна система аналітики
- 💰 Розрахунок винагород та щоденні бонуси
- 🎮 Система завдань та верифікації
- 💎 FLEX токени та рівні
- 🔐 Авторизація та безпека
- 💳 Транзакції та гаманці
- 🚀 Автоматична ініціалізація та моніторинг
"""

import logging
import os
from typing import Dict, Any, Optional, List, Union
from datetime import datetime, timezone
from flask import Flask

# Налаштування логування для пакету
logger = logging.getLogger(__name__)

# Метаінформація пакету
__version__ = "2.0.1"
__author__ = "ростік"
__description__ = "WINIX Quests System - Повна система завдань з TON інтеграцією"
__license__ = "MIT"
__email__ = "rostik@winix.app"

# === ГЛОБАЛЬНІ ЗМІННІ СТАТУСУ ===

# Статус компонентів системи
COMPONENTS_STATUS = {
    'models': {'loaded': False, 'error': None, 'count': 0},
    'services': {'loaded': False, 'error': None, 'count': 0},
    'controllers': {'loaded': False, 'error': None, 'count': 0},
    'routes': {'loaded': False, 'error': None, 'count': 0},
    'utils': {'loaded': False, 'error': None, 'count': 0}
}

# === ІМПОРТ ВСІХ КОМПОНЕНТІВ ===

# 🛠️ === UTILS (ПЕРШИМ) ===
logger.info("🔧 Завантаження утилітів...")
try:
    from .utils import (
        # Cache
        CacheManager, CacheType, CachePolicy, CacheConfig,
        CacheStats, MemoryCache, RedisCache, cache_manager,
        cache, cache_invalidate,

        # Constants
        Environment, DatabaseType, LogLevel,
        TaskType, TaskStatus, TaskDifficulty, FlexLevel,
        DailyBonusType, ReferralLevel, BadgeType, CurrencyType,
        AnalyticsEventType, SocialPlatform,

        ENVIRONMENT, DEBUG, LOG_LEVEL, API_BASE_URL, API_VERSION,
        RATE_LIMIT_ENABLED, CACHE_ENABLED, JWT_SECRET_KEY,
        TELEGRAM_BOT_TOKEN, SUPABASE_URL,

        TASK_REWARDS, FLEX_LEVELS_CONFIG, DAILY_BONUS_CONFIG,
        REFERRAL_REWARDS, BADGE_REQUIREMENTS, CURRENCIES_CONFIG,
        SOCIAL_PLATFORMS_CONFIG, VALIDATION_RULES,

        MAX_BALANCE_LIMITS, SYNC_INTERVALS, OPERATION_TIMEOUTS,
        TASK_VERIFICATION_TIMEOUT, SUCCESS_MESSAGES, ERROR_MESSAGES,

        get_environment, is_development, is_production,
        get_task_reward, get_flex_level_config, get_badge_requirements,
        get_currency_config, get_social_platform_config,
        validate_amount, get_verification_timeout,

        # Decorators
        require_auth, optional_auth, validate_user_access,
        rate_limit, validate_json, validate_telegram_id,
        handle_errors, log_requests, security_headers,
        block_suspicious_requests, validate_input_data,
        secure_endpoint, public_endpoint,
        generate_jwt_token, decode_jwt_token,
        get_current_user, get_json_data, clear_rate_limit_storage,
        AuthError, ValidationError, SecurityError,

        # Validators
        validate_telegram_webapp_data, validate_username,
        validate_reward_amount, validate_task_type, validate_task_status,
        validate_url, validate_social_platform, validate_wallet_address,
        validate_timestamp, sanitize_string, create_validation_report,
        ValidationResult, TelegramValidationError,
        STANDARD_VALIDATION_RULES,

        # Утиліти utils
        get_utils_info, validate_user_input,
        create_secure_endpoint_decorator, setup_logging_with_constants
    )

    COMPONENTS_STATUS['utils'] = {
        'loaded': True,
        'error': None,
        'count': len(get_utils_info()['modules'])
    }
    logger.info(f"✅ Utils завантажено: {COMPONENTS_STATUS['utils']['count']} модулів")

except ImportError as e:
    COMPONENTS_STATUS['utils'] = {'loaded': False, 'error': str(e), 'count': 0}
    logger.error(f"❌ Помилка завантаження Utils: {e}")
    # Створюємо заглушки для критичних компонентів
    cache_manager = None
    validate_telegram_webapp_data = lambda *args, **kwargs: {"valid": False, "error": "Utils unavailable"}


# 📊 === MODELS ===
logger.info("🏗️ Завантаження моделей...")
try:
    from .models import (
        # Analytics
        AnalyticsDB, AnalyticsEvent, UserSession, UserStats,
        EventType, EventSeverity, analytics_db,
        create_event, create_task_event, create_wallet_event,

        # Daily Bonus
        DailyBonusEntry, DailyBonusStatus, DailyBonusManager,
        daily_bonus_manager, create_new_daily_status,
        get_daily_bonus_constants, Reward,

        # FLEX Rewards
        FlexRewardsModel, FlexLevel as ModelFlexLevel, RewardStatus,
        FlexRewardConfig, UserFlexStatus, flex_rewards_model,

        # Tasks
        TaskModel, TaskType as ModelTaskType, TaskStatus as ModelTaskStatus,
        TaskPlatform, TaskAction, TaskReward, TaskRequirements, TaskMetadata, task_model,

        # Transactions
        TransactionModel, Transaction, TransactionAmount,
        TransactionType as ModelTransactionType, TransactionStatus as ModelTransactionStatus,
        CurrencyType as ModelCurrencyType, transaction_model,

        # Users
        UserQuest, UserBalance, UserReward, UserTaskStatus,
        create_new_user, validate_telegram_id as validate_telegram_id_model, get_current_utc_time,

        # Wallets
        WalletModel, WalletStatus, WalletProvider,
        WalletConnectionBonus, wallet_model,

        # Утиліти моделей
        get_models_status, get_loaded_models, get_failed_models,
        initialize_models, get_model_by_name,
        create_user_from_telegram_data, create_transaction_for_reward
    )

    COMPONENTS_STATUS['models'] = {
        'loaded': True,
        'error': None,
        'count': len(get_loaded_models())
    }
    logger.info(f"✅ Models завантажено: {COMPONENTS_STATUS['models']['count']} моделей")

except ImportError as e:
    COMPONENTS_STATUS['models'] = {'loaded': False, 'error': str(e), 'count': 0}
    logger.error(f"❌ Помилка завантаження Models: {e}")
    # Створюємо заглушки для критичних компонентів
    analytics_db = daily_bonus_manager = task_model = None
    transaction_model = wallet_model = flex_rewards_model = None


# ⚙️ === SERVICES ===
logger.info("🔧 Завантаження сервісів...")
try:
    from .services import (
        # Класи сервісів
        RewardCalculator, TelegramService, TONConnectService,
        TransactionService, VerificationService,

        # Глобальні інстанції
        reward_calculator, telegram_service, ton_connect_service,
        transaction_service, verification_service,

        # Функції-хелпери
        calculate_daily_reward, get_reward_preview_for_user,
        validate_daily_claim, check_bot_started, check_channel_subscription,
        send_verification_message, get_bot_info,

        # Винятки
        TransactionError, InsufficientFundsError,
        TransactionValidationError, TransactionProcessingError,

        # Енуми та класи даних
        TONNetwork, TransactionType as ServiceTransactionType,
        TaskType as ServiceTaskType, VerificationStatus,
        TONBalance, FlexTokenInfo,

        # Утиліти сервісів
        get_service, check_services_health, init_all_services, SERVICES
    )

    available_services = len([s for s in SERVICES.values() if s is not None])
    COMPONENTS_STATUS['services'] = {
        'loaded': True,
        'error': None,
        'count': available_services
    }
    logger.info(f"✅ Services завантажено: {available_services}/{len(SERVICES)} сервісів")

except ImportError as e:
    COMPONENTS_STATUS['services'] = {'loaded': False, 'error': str(e), 'count': 0}
    logger.error(f"❌ Помилка завантаження Services: {e}")
    # Заглушки
    reward_calculator = telegram_service = ton_connect_service = None
    transaction_service = verification_service = None


# 🎮 === CONTROLLERS ===
logger.info("🎯 Завантаження контролерів...")
try:
    from .controllers import (
        # Класи контролерів
        AnalyticsController, AuthController, DailyController,
        FlexController, TasksController, TransactionController,
        UserController, WalletController,

        # Analytics функції
        register_analytics_routes, track_user_action,
        track_task_action, track_error,

        # Auth функції
        validate_telegram_route, refresh_token_route, validate_token_route,

        # Daily функції
        get_daily_status_route, claim_daily_bonus_route,
        get_daily_history_route, calculate_reward_route,
        get_reward_preview_route, reset_streak_route,
        get_daily_statistics_route,

        # FLEX функції
        get_flex_balance, check_flex_levels, claim_flex_reward,
        get_flex_history, get_user_flex_status, get_flex_statistics,
        get_flex_levels_config, get_flex_health,

        # Tasks функції
        get_tasks_list, get_task_details, start_task,
        verify_task, create_task, get_user_task_progress,
        get_tasks_statistics, get_tasks_health,

        # Transaction функції
        process_reward_route, process_spending_route,
        get_transaction_history_route, get_balance_summary_route,
        get_statistics_route,

        # User функції
        get_profile_route, get_balance_route, update_balance_route,
        get_stats_route, update_settings_route, add_reward_route,
        user_transaction_history_route,

        # Verification функції
        verify_telegram_subscription, check_bot_started as verify_bot_started,
        verify_social_task, start_task_verification,
        check_verification_status, complete_verification,
        get_verification_statistics, cleanup_expired_verifications,
        get_telegram_bot_info, get_user_completed_tasks,
        check_task_completion,

        # Wallet функції
        check_wallet_status, connect_wallet, disconnect_wallet,
        verify_wallet, get_wallet_balance, get_wallet_transactions,
        get_wallet_statistics, get_wallet_health,

        # Утиліти контролерів
        get_controllers_status, get_loaded_controllers, get_failed_controllers
    )

    loaded_controllers = len(get_loaded_controllers())
    COMPONENTS_STATUS['controllers'] = {
        'loaded': True,
        'error': None,
        'count': loaded_controllers
    }
    logger.info(f"✅ Controllers завантажено: {loaded_controllers} контролерів")

except ImportError as e:
    COMPONENTS_STATUS['controllers'] = {'loaded': False, 'error': str(e), 'count': 0}
    logger.error(f"❌ Помилка завантаження Controllers: {e}")
    # Заглушки для контролерів
    AnalyticsController = AuthController = DailyController = None


# 🛣️ === ROUTES ===
logger.info("🗺️ Завантаження маршрутів...")
try:
    from .routes import register_quests_routes

    COMPONENTS_STATUS['routes'] = {
        'loaded': True,
        'error': None,
        'count': 1  # Одна функція реєстрації, але вона реєструє багато маршрутів
    }
    logger.info("✅ Routes завантажено")

except ImportError as e:
    COMPONENTS_STATUS['routes'] = {'loaded': False, 'error': str(e), 'count': 0}
    logger.error(f"❌ Помилка завантаження Routes: {e}")
    register_quests_routes = None


# === WINIX CORE API ===

class WinixQuests:
    """
    🏆 Головний клас WINIX Quests System

    Це - ваш головний інтерфейс для роботи з усією системою!
    Через цей клас можна отримати доступ до всіх компонентів.
    """

    def __init__(self):
        self.version = __version__
        self.author = __author__
        self.models = self._init_models()
        self.services = self._init_services()
        self.controllers = self._init_controllers()
        self.utils = self._init_utils()

        logger.info(f"🚀 WinixQuests {self.version} ініціалізовано")

    def _init_models(self):
        """Ініціалізація моделей"""
        models = {}
        if COMPONENTS_STATUS['models']['loaded']:
            models.update({
                'analytics': analytics_db,
                'daily_bonus': daily_bonus_manager,
                'flex_rewards': flex_rewards_model,
                'task': task_model,
                'transaction': transaction_model,
                'wallet': wallet_model
            })
        return models

    def _init_services(self):
        """Ініціалізація сервісів"""
        services = {}
        if COMPONENTS_STATUS['services']['loaded']:
            services.update({
                'reward_calculator': reward_calculator,
                'telegram': telegram_service,
                'ton_connect': ton_connect_service,
                'transaction': transaction_service,
                'verification': verification_service
            })
        return services

    def _init_controllers(self):
        """Ініціалізація контролерів"""
        controllers = {}
        if COMPONENTS_STATUS['controllers']['loaded']:
            controllers.update({
                'analytics': AnalyticsController,
                'auth': AuthController,
                'daily': DailyController,
                'flex': FlexController,
                'tasks': TasksController,
                'transaction': TransactionController,
                'user': UserController,
                'wallet': WalletController
            })
        return controllers

    def _init_utils(self):
        """Ініціалізація утилітів"""
        utils = {}
        if COMPONENTS_STATUS['utils']['loaded']:
            utils.update({
                'cache': cache_manager,
                'validators': {
                    'telegram_webapp': validate_telegram_webapp_data,
                    'telegram_id': validate_telegram_id,
                    'username': validate_username,
                    'wallet_address': validate_wallet_address
                },
                'decorators': {
                    'auth': require_auth,
                    'secure': secure_endpoint,
                    'public': public_endpoint,
                    'rate_limit': rate_limit
                }
            })
        return utils

    def get_model(self, name: str):
        """Отримати модель за назвою"""
        return self.models.get(name)

    def get_service(self, name: str):
        """Отримати сервіс за назвою"""
        return self.services.get(name)

    def get_controller(self, name: str):
        """Отримати контролер за назвою"""
        return self.controllers.get(name)

    def health_check(self) -> Dict[str, Any]:
        """Перевірка здоров'я всієї системи"""
        return {
            'timestamp': datetime.now(timezone.utc).isoformat(),
            'version': self.version,
            'components': COMPONENTS_STATUS.copy(),
            'models_health': get_models_status() if COMPONENTS_STATUS['models']['loaded'] else None,
            'services_health': check_services_health() if COMPONENTS_STATUS['services']['loaded'] else None,
            'controllers_health': get_controllers_status() if COMPONENTS_STATUS['controllers']['loaded'] else None,
            'utils_health': get_utils_info() if COMPONENTS_STATUS['utils']['loaded'] else None
        }

    def register_routes(self, app: Flask) -> bool:
        """Реєстрація всіх маршрутів у Flask додатку"""
        if not COMPONENTS_STATUS['routes']['loaded']:
            logger.error("Routes не завантажені")
            return False

        try:
            return register_quests_routes(app)
        except Exception as e:
            logger.error(f"Помилка реєстрації маршрутів: {e}")
            return False


# Глобальна інстанція WINIX
winix = WinixQuests()


# === ГЛОБАЛЬНІ ФУНКЦІЇ СИСТЕМИ ===

def initialize_winix_quests(config: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """
    🚀 Повна ініціалізація WINIX Quests System

    Args:
        config: Додаткова конфігурація

    Returns:
        Dict з результатом ініціалізації
    """
    logger.info("🎯 === ІНІЦІАЛІЗАЦІЯ WINIX QUESTS SYSTEM ===")

    result = {
        'success': True,
        'errors': [],
        'warnings': [],
        'initialized_components': [],
        'failed_components': [],
        'total_score': 0,
        'max_score': 500  # 100 балів за кожен компонент
    }

    # Ініціалізуємо моделі
    if COMPONENTS_STATUS['models']['loaded']:
        try:
            models_result = initialize_models()
            result['initialized_components'].append('models')
            result['models'] = models_result
            result['total_score'] += 100 * (models_result['success_rate'] / 100)

            logger.info(
                f"✅ Models: {models_result['success_rate']:.1f}% ({models_result['loaded_models']}/{models_result['total_models']})")
        except Exception as e:
            result['errors'].append(f"Помилка ініціалізації моделей: {str(e)}")
            result['failed_components'].append('models')
    else:
        result['errors'].append("Models не завантажені")
        result['failed_components'].append('models')

    # Ініціалізуємо сервіси
    if COMPONENTS_STATUS['services']['loaded']:
        try:
            services_result = init_all_services()
            result['initialized_components'].append('services')
            result['services'] = services_result
            score = 100 * (len(services_result['available']) / services_result['total'])
            result['total_score'] += score

            logger.info(f"✅ Services: {len(services_result['available'])}/{services_result['total']} доступні")
        except Exception as e:
            result['errors'].append(f"Помилка ініціалізації сервісів: {str(e)}")
            result['failed_components'].append('services')
    else:
        result['errors'].append("Services не завантажені")
        result['failed_components'].append('services')

    # Перевіряємо контролери
    if COMPONENTS_STATUS['controllers']['loaded']:
        try:
            controllers_status = get_controllers_status()
            loaded_count = len(get_loaded_controllers())
            total_count = len(controllers_status)

            result['initialized_components'].append('controllers')
            result['controllers'] = {
                'loaded': loaded_count,
                'total': total_count,
                'success_rate': (loaded_count / total_count) * 100 if total_count > 0 else 0
            }

            score = 100 * (loaded_count / total_count) if total_count > 0 else 0
            result['total_score'] += score

            logger.info(f"✅ Controllers: {loaded_count}/{total_count} завантажено")
        except Exception as e:
            result['warnings'].append(f"Проблеми з контролерами: {str(e)}")
            result['failed_components'].append('controllers')
    else:
        result['errors'].append("Controllers не завантажені")
        result['failed_components'].append('controllers')

    # Перевіряємо маршрути
    if COMPONENTS_STATUS['routes']['loaded']:
        result['initialized_components'].append('routes')
        result['total_score'] += 100
        logger.info("✅ Routes готові до реєстрації")
    else:
        result['errors'].append("Routes не завантажені")
        result['failed_components'].append('routes')

    # Перевіряємо утиліти
    if COMPONENTS_STATUS['utils']['loaded']:
        try:
            utils_info = get_utils_info()
            result['initialized_components'].append('utils')
            result['utils'] = utils_info
            score = 100 * (utils_info['available_modules'] / utils_info['total_modules'])
            result['total_score'] += score

            logger.info(f"✅ Utils: {utils_info['available_modules']}/{utils_info['total_modules']} модулів")
        except Exception as e:
            result['warnings'].append(f"Проблеми з утилітами: {str(e)}")
            result['failed_components'].append('utils')
    else:
        result['errors'].append("Utils не завантажені")
        result['failed_components'].append('utils')

    # Обчислюємо фінальний результат
    result['success'] = len(result['failed_components']) == 0
    result['success_rate'] = (result['total_score'] / result['max_score']) * 100
    result['health_status'] = winix.health_check()

    # Логуємо фінальний результат
    if result['success_rate'] >= 90:
        logger.info(f"🎉 WINIX QUESTS SYSTEM успішно ініціалізовано! Оцінка: {result['success_rate']:.1f}%")
    elif result['success_rate'] >= 70:
        logger.warning(f"⚠️ WINIX QUESTS SYSTEM ініціалізовано з попередженнями. Оцінка: {result['success_rate']:.1f}%")
    else:
        logger.error(f"❌ WINIX QUESTS SYSTEM ініціалізовано з помилками. Оцінка: {result['success_rate']:.1f}%")

    return result


def quick_test() -> Dict[str, Any]:
    """
    🧪 Швидкий тест основних компонентів системи

    Returns:
        Dict з результатами тестів
    """
    logger.info("🔬 Запуск швидкого тесту WINIX системи...")

    tests = {}

    # Тест моделей
    if analytics_db and hasattr(analytics_db, 'create_event'):
        try:
            # Тестуємо створення події
            tests['models_test'] = True
            logger.info("✅ Models тест пройдено")
        except Exception as e:
            tests['models_test'] = False
            logger.error(f"❌ Models тест не пройдено: {e}")
    else:
        tests['models_test'] = False
        logger.warning("⚠️ Models недоступні для тестування")

    # Тест сервісів
    if reward_calculator and hasattr(reward_calculator, 'calculate_daily_bonus'):
        try:
            reward = reward_calculator.calculate_daily_bonus(1, 1, 1)
            if reward and hasattr(reward, 'winix'):
                tests['services_test'] = True
                logger.info("✅ Services тест пройдено")
            else:
                tests['services_test'] = False
                logger.error("❌ Services тест не пройдено: невірний результат")
        except Exception as e:
            tests['services_test'] = False
            logger.error(f"❌ Services тест не пройдено: {e}")
    else:
        tests['services_test'] = False
        logger.warning("⚠️ Services недоступні для тестування")

    # Тест контролерів
    if AnalyticsController:
        try:
            # Тестуємо ініціалізацію контролера
            controller = AnalyticsController()
            tests['controllers_test'] = True
            logger.info("✅ Controllers тест пройдено")
        except Exception as e:
            tests['controllers_test'] = False
            logger.error(f"❌ Controllers тест не пройдено: {e}")
    else:
        tests['controllers_test'] = False
        logger.warning("⚠️ Controllers недоступні для тестування")

    # Тест утилітів
    if validate_telegram_webapp_data and cache_manager:
        try:
            # Тест валідації
            result = validate_telegram_webapp_data("test_data")
            if result:
                tests['utils_test'] = True
                logger.info("✅ Utils тест пройдено")
            else:
                tests['utils_test'] = False
                logger.error("❌ Utils тест не пройдено: валідація не спрацювала")
        except Exception as e:
            tests['utils_test'] = False
            logger.error(f"❌ Utils тест не пройдено: {e}")
    else:
        tests['utils_test'] = False
        logger.warning("⚠️ Utils недоступні для тестування")

    # Підрахунок результатів
    passed_tests = sum(tests.values())
    total_tests = len(tests)
    success_rate = (passed_tests / total_tests) * 100 if total_tests > 0 else 0

    logger.info(f"📊 Тести завершено: {passed_tests}/{total_tests} пройдено ({success_rate:.1f}%)")

    return {
        'tests': tests,
        'passed': passed_tests,
        'total': total_tests,
        'success_rate': success_rate,
        'status': 'healthy' if success_rate >= 75 else 'degraded' if success_rate >= 50 else 'critical'
    }


def get_package_info() -> Dict[str, Any]:
    """
    📋 Повна інформація про пакет WINIX Quests

    Returns:
        Dict з детальною інформацією
    """
    return {
        'name': 'winix-quests',
        'version': __version__,
        'author': __author__,
        'description': __description__,
        'license': __license__,
        'email': __email__,
        'environment': get_environment().value if COMPONENTS_STATUS['utils']['loaded'] else 'unknown',
        'debug_mode': DEBUG if COMPONENTS_STATUS['utils']['loaded'] else False,
        'components_status': COMPONENTS_STATUS.copy(),
        'system_health': winix.health_check(),
        'available_features': {
            'analytics': COMPONENTS_STATUS['models']['loaded'] and analytics_db is not None,
            'daily_bonuses': COMPONENTS_STATUS['services']['loaded'] and reward_calculator is not None,
            'flex_rewards': COMPONENTS_STATUS['models']['loaded'] and flex_rewards_model is not None,
            'tasks_system': COMPONENTS_STATUS['models']['loaded'] and task_model is not None,
            'transactions': COMPONENTS_STATUS['services']['loaded'] and transaction_service is not None,
            'ton_integration': COMPONENTS_STATUS['services']['loaded'] and ton_connect_service is not None,
            'telegram_bot': COMPONENTS_STATUS['services']['loaded'] and telegram_service is not None,
            'caching': COMPONENTS_STATUS['utils']['loaded'] and cache_manager is not None,
            'security': COMPONENTS_STATUS['utils']['loaded'] and 'require_auth' in globals()
        }
    }


# === AUTO-SETUP ===

# Автоматичне налаштування логування
if COMPONENTS_STATUS['utils']['loaded']:
    try:
        setup_logging_with_constants()
    except:
        pass

logger.info(f"🎯 === WINIX QUESTS {__version__} PACKAGE ІНІЦІАЛІЗОВАНО ===")

# Виводимо статус компонентів
total_components = len(COMPONENTS_STATUS)
loaded_components = sum(1 for status in COMPONENTS_STATUS.values() if status['loaded'])

logger.info(f"📊 Статус компонентів: {loaded_components}/{total_components} завантажено")

if loaded_components == total_components:
    logger.info("🎉 ВСІ КОМПОНЕНТИ ЗАВАНТАЖЕНО УСПІШНО!")
elif loaded_components >= total_components * 0.8:
    logger.warning(f"⚠️ Більшість компонентів завантажено ({loaded_components}/{total_components})")
else:
    logger.error(f"❌ Багато компонентів не завантажено ({loaded_components}/{total_components})")

# Виводимо які компоненти не завантажились
failed_components = [name for name, status in COMPONENTS_STATUS.items() if not status['loaded']]
if failed_components:
    logger.warning(f"⚠️ Компоненти з помилками: {', '.join(failed_components)}")

logger.info("🚀 WINIX QUESTS ГОТОВИЙ ДО РОБОТИ!")

# === ЕКСПОРТ ВСЬОГО ===

__all__ = [
    # === МЕТА ===
    '__version__', '__author__', '__description__', '__license__', '__email__',

    # === WINIX CORE ===
    'WinixQuests', 'winix',
    'initialize_winix_quests', 'quick_test', 'get_package_info',
    'COMPONENTS_STATUS',

    # === MODELS ===
    # Analytics
    'AnalyticsDB', 'AnalyticsEvent', 'UserSession', 'UserStats',
    'EventType', 'EventSeverity', 'analytics_db',
    'create_event', 'create_task_event', 'create_wallet_event',

    # Daily Bonus
    'DailyBonusEntry', 'DailyBonusStatus', 'DailyBonusManager',
    'daily_bonus_manager', 'create_new_daily_status',
    'get_daily_bonus_constants', 'Reward',

    # FLEX Rewards
    'FlexRewardsModel', 'RewardStatus',
    'FlexRewardConfig', 'UserFlexStatus', 'flex_rewards_model',

    # Tasks
    'TaskModel', 'TaskPlatform', 'TaskAction',
    'TaskReward', 'TaskRequirements', 'TaskMetadata', 'task_model',

    # Transactions
    'TransactionModel', 'Transaction', 'TransactionAmount', 'transaction_model',

    # Users
    'UserQuest', 'UserBalance', 'UserReward', 'UserTaskStatus',
    'create_new_user', 'get_current_utc_time',

    # Wallets
    'WalletModel', 'WalletStatus', 'WalletProvider',
    'WalletConnectionBonus', 'wallet_model',

    # === SERVICES ===
    'RewardCalculator', 'TelegramService', 'TONConnectService',
    'TransactionService', 'VerificationService',
    'reward_calculator', 'telegram_service', 'ton_connect_service',
    'transaction_service', 'verification_service',
    'calculate_daily_reward', 'get_reward_preview_for_user', 'validate_daily_claim',
    'check_bot_started', 'check_channel_subscription', 'send_verification_message', 'get_bot_info',
    'TransactionError', 'InsufficientFundsError', 'TransactionValidationError', 'TransactionProcessingError',
    'TONNetwork', 'TONBalance', 'FlexTokenInfo', 'VerificationStatus',

    # === CONTROLLERS ===
    'AnalyticsController', 'AuthController', 'DailyController',
    'FlexController', 'TasksController', 'TransactionController',
    'UserController', 'WalletController',

    # Routes функції (основні)
    'register_quests_routes',
    'get_daily_status_route', 'claim_daily_bonus_route',
    'get_flex_balance', 'check_flex_levels', 'claim_flex_reward',
    'get_tasks_list', 'start_task', 'verify_task',
    'process_reward_route', 'process_spending_route',
    'get_profile_route', 'get_balance_route',
    'verify_telegram_subscription', 'start_task_verification',
    'connect_wallet', 'get_wallet_balance',

    # === UTILS ===
    # Cache
    'CacheManager', 'cache_manager', 'cache', 'cache_invalidate',

    # Constants
    'Environment', 'ENVIRONMENT', 'DEBUG', 'is_development', 'is_production',
    'TaskType', 'TaskStatus', 'FlexLevel', 'CurrencyType',
    'TASK_REWARDS', 'FLEX_LEVELS_CONFIG', 'SUCCESS_MESSAGES', 'ERROR_MESSAGES',

    # Decorators
    'require_auth', 'optional_auth', 'secure_endpoint', 'public_endpoint',
    'rate_limit', 'validate_json', 'handle_errors',
    'generate_jwt_token', 'decode_jwt_token', 'get_current_user',
    'AuthError', 'ValidationError', 'SecurityError',

    # Validators
    'validate_telegram_webapp_data', 'validate_username', 'validate_wallet_address',
    'ValidationResult', 'TelegramValidationError', 'sanitize_string'
]