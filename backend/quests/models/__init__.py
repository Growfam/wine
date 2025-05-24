"""
Модуль завдань та верифікації WINIX
Ініціалізація системи завдань, верифікації та інтеграції з Telegram
"""

import logging
import os
from typing import Optional, Dict, Any

# Налаштування логування
logger = logging.getLogger(__name__)

# Версія модуля
__version__ = "1.0.0"

# Інформація про модуль
__module_info__ = {
    "name": "WINIX Quests & Verification System",
    "version": __version__,
    "description": "Система завдань та верифікації для WINIX",
    "components": [
        "Telegram Service - інтеграція з ботом",
        "Verification Service - логіка верифікації",
        "Task Management - управління завданнями",
        "Timer System - система таймерів",
        "Reward Calculator - розрахунок винагород"
    ]
}

# Глобальні змінні для сервісів
_telegram_service = None
_verification_service = None
_services_initialized = False

def initialize_services() -> bool:
    """
    Ініціалізує всі сервіси модуля

    Returns:
        bool: True якщо всі сервіси успішно ініціалізовані
    """
    global _telegram_service, _verification_service, _services_initialized

    if _services_initialized:
        logger.info("✅ Сервіси вже ініціалізовані")
        return True

    logger.info("🚀 Ініціалізація сервісів модуля quests...")

    try:
        # Ініціалізація Telegram сервісу
        try:
            from .services.telegram_service import telegram_service
            _telegram_service = telegram_service
            logger.info("✅ Telegram сервіс ініціалізовано")
        except ImportError as e:
            logger.warning(f"⚠️ Не вдалося ініціалізувати Telegram сервіс: {str(e)}")
            _telegram_service = None

        # Ініціалізація сервісу верифікації
        try:
            from .services.verification_service import verification_service
            _verification_service = verification_service
            logger.info("✅ Сервіс верифікації ініціалізовано")
        except ImportError as e:
            logger.warning(f"⚠️ Не вдалося ініціалізувати сервіс верифікації: {str(e)}")
            _verification_service = None

        _services_initialized = True
        logger.info("✅ Сервіси модуля quests успішно ініціалізовані")

        return True

    except Exception as e:
        logger.error(f"❌ Помилка ініціалізації сервісів: {str(e)}")
        return False

def get_telegram_service():
    """Повертає екземпляр Telegram сервісу"""
    if not _services_initialized:
        initialize_services()
    return _telegram_service

def get_verification_service():
    """Повертає екземпляр сервісу верифікації"""
    if not _services_initialized:
        initialize_services()
    return _verification_service

def register_routes(app) -> bool:
    """
    Реєструє всі маршрути модуля в Flask додатку

    Args:
        app: Екземпляр Flask додатку

    Returns:
        bool: True якщо маршрути успішно зареєстровано
    """
    logger.info("🔧 Реєстрація маршрутів модуля quests...")

    routes_registered = 0
    total_routes = 0

    # Реєстрація маршрутів верифікації
    try:
        from .routes.verification_routes import register_verification_routes
        if register_verification_routes(app):
            routes_registered += 1
            logger.info("✅ Маршрути верифікації зареєстровано")
        else:
            logger.error("❌ Не вдалося зареєструвати маршрути верифікації")
        total_routes += 1
    except ImportError as e:
        logger.warning(f"⚠️ Маршрути верифікації недоступні: {str(e)}")

    # Тут можуть бути додані інші маршрути модуля
    # Наприклад: auth_routes, tasks_routes, etc.

    success_rate = (routes_registered / total_routes * 100) if total_routes > 0 else 0
    logger.info(f"📊 Зареєстровано {routes_registered}/{total_routes} груп маршрутів ({success_rate:.1f}%)")

    return routes_registered > 0

def setup_quests_module(app) -> Dict[str, Any]:
    """
    Повна ініціалізація модуля quests

    Args:
        app: Екземпляр Flask додатку

    Returns:
        Dict з результатами ініціалізації
    """
    logger.info("🎯 === ІНІЦІАЛІЗАЦІЯ МОДУЛЯ QUESTS ===")

    result = {
        "success": False,
        "services_initialized": False,
        "routes_registered": False,
        "telegram_available": False,
        "verification_available": False,
        "errors": []
    }

    try:
        # Ініціалізуємо сервіси
        if initialize_services():
            result["services_initialized"] = True
            result["telegram_available"] = _telegram_service is not None
            result["verification_available"] = _verification_service is not None
        else:
            result["errors"].append("Не вдалося ініціалізувати сервіси")

        # Реєструємо маршрути
        if register_routes(app):
            result["routes_registered"] = True
        else:
            result["errors"].append("Не вдалося зареєструвати маршрути")

        # Визначаємо загальний успіх
        result["success"] = result["services_initialized"] and result["routes_registered"]

        if result["success"]:
            logger.info("✅ Модуль quests успішно ініціалізовано")
            _log_module_status(result)
        else:
            logger.warning(f"⚠️ Модуль quests частково ініціалізовано з помилками: {result['errors']}")

        return result

    except Exception as e:
        logger.error(f"❌ Критична помилка ініціалізації модуля quests: {str(e)}")
        result["errors"].append(str(e))
        return result

def _log_module_status(result: Dict[str, Any]):
    """Логує статус модуля"""
    logger.info("📋 Статус модуля quests:")
    logger.info(f"   🔧 Сервіси: {'✅' if result['services_initialized'] else '❌'}")
    logger.info(f"   📡 Telegram: {'✅' if result['telegram_available'] else '❌'}")
    logger.info(f"   🔍 Верифікація: {'✅' if result['verification_available'] else '❌'}")
    logger.info(f"   🌐 Маршрути: {'✅' if result['routes_registered'] else '❌'}")

def get_module_info() -> Dict[str, Any]:
    """Повертає інформацію про модуль"""
    return {
        **__module_info__,
        "initialized": _services_initialized,
        "telegram_service_available": _telegram_service is not None,
        "verification_service_available": _verification_service is not None,
        "environment": {
            "telegram_bot_token": bool(os.getenv('TELEGRAM_BOT_TOKEN')),
            "telegram_bot_username": os.getenv('TELEGRAM_BOT_USERNAME', 'Не встановлено')
        }
    }

def get_health_status() -> Dict[str, Any]:
    """Повертає статус здоров'я модуля"""
    health = {
        "status": "healthy",
        "services": {},
        "issues": []
    }

    # Перевіряємо Telegram сервіс
    if _telegram_service:
        try:
            bot_info = _telegram_service.get_bot_info_sync()
            health["services"]["telegram"] = {
                "status": "healthy" if bot_info else "warning",
                "bot_info": bot_info
            }
            if not bot_info:
                health["issues"].append("Telegram бот недоступний")
        except Exception as e:
            health["services"]["telegram"] = {
                "status": "error",
                "error": str(e)
            }
            health["issues"].append(f"Помилка Telegram сервісу: {str(e)}")
    else:
        health["services"]["telegram"] = {"status": "unavailable"}
        health["issues"].append("Telegram сервіс не ініціалізовано")

    # Перевіряємо сервіс верифікації
    if _verification_service:
        try:
            stats = _verification_service.get_verification_statistics()
            health["services"]["verification"] = {
                "status": "healthy",
                "statistics": stats
            }
        except Exception as e:
            health["services"]["verification"] = {
                "status": "error",
                "error": str(e)
            }
            health["issues"].append(f"Помилка сервісу верифікації: {str(e)}")
    else:
        health["services"]["verification"] = {"status": "unavailable"}
        health["issues"].append("Сервіс верифікації не ініціалізовано")

    # Визначаємо загальний статус
    if health["issues"]:
        health["status"] = "warning" if len(health["issues"]) <= 2 else "error"

    return health

# Автоматична ініціалізація при імпорті (якщо потрібно)
def auto_initialize():
    """Автоматична ініціалізація при імпорті модуля"""
    if os.getenv('QUESTS_AUTO_INIT', 'false').lower() == 'true':
        logger.info("🔄 Автоматична ініціалізація модуля quests...")
        initialize_services()

# Експортуємо основні функції та класи
__all__ = [
    # Основні функції
    'setup_quests_module',
    'initialize_services',
    'register_routes',

    # Getter функції
    'get_telegram_service',
    'get_verification_service',
    'get_module_info',
    'get_health_status',

    # Константи
    '__version__',
    '__module_info__'
]

# Викликаємо автоініціалізацію якщо потрібно
auto_initialize()

logger.info(f"📦 Модуль quests v{__version__} завантажено")