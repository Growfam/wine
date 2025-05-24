"""
Маршрути системи завдань WINIX
Централізована реєстрація всіх маршрутів з обробкою помилок
"""

import logging
from typing import Dict, Any, List
from flask import Flask

logger = logging.getLogger(__name__)

# Словник для відстеження статусу реєстрації маршрутів
_routes_status: Dict[str, Dict[str, Any]] = {}

# === ІМПОРТ МАРШРУТІВ З ОБРОБКОЮ ПОМИЛОК ===

# Auth маршрути
try:
    from .auth_routes import register_auth_routes
    _routes_status['auth'] = {
        'loaded': True,
        'register_function': register_auth_routes,
        'prefix': '/api/auth',
        'description': 'Авторизація та аутентифікація'
    }
    logger.info("✅ Auth маршрути імпортовано")
except ImportError as e:
    logger.warning(f"⚠️ Auth маршрути недоступні: {e}")
    _routes_status['auth'] = {
        'loaded': False,
        'error': str(e),
        'register_function': None
    }
    register_auth_routes = None

# User маршрути
try:
    from .user_routes import register_user_routes
    _routes_status['user'] = {
        'loaded': True,
        'register_function': register_user_routes,
        'prefix': '/api/user',
        'description': 'Управління користувачами'
    }
    logger.info("✅ User маршрути імпортовано")
except ImportError as e:
    logger.warning(f"⚠️ User маршрути недоступні: {e}")
    _routes_status['user'] = {
        'loaded': False,
        'error': str(e),
        'register_function': None
    }
    register_user_routes = None

# Daily маршрути
try:
    from .daily_routes import register_daily_routes
    _routes_status['daily'] = {
        'loaded': True,
        'register_function': register_daily_routes,
        'prefix': '/api/daily',
        'description': 'Щоденні бонуси'
    }
    logger.info("✅ Daily маршрути імпортовано")
except ImportError as e:
    logger.warning(f"⚠️ Daily маршрути недоступні: {e}")
    _routes_status['daily'] = {
        'loaded': False,
        'error': str(e),
        'register_function': None
    }
    register_daily_routes = None

# FLEX маршрути
try:
    from .flex_routes import register_flex_routes
    _routes_status['flex'] = {
        'loaded': True,
        'register_function': register_flex_routes,
        'prefix': '/api/flex',
        'description': 'FLEX токени та винагороди'
    }
    logger.info("✅ FLEX маршрути імпортовано")
except ImportError as e:
    logger.warning(f"⚠️ FLEX маршрути недоступні: {e}")
    _routes_status['flex'] = {
        'loaded': False,
        'error': str(e),
        'register_function': None
    }
    register_flex_routes = None

# Tasks маршрути
try:
    from .tasks_routes import register_tasks_routes
    _routes_status['tasks'] = {
        'loaded': True,
        'register_function': register_tasks_routes,
        'prefix': '/api/tasks',
        'description': 'Завдання та верифікація'
    }
    logger.info("✅ Tasks маршрути імпортовано")
except ImportError as e:
    logger.warning(f"⚠️ Tasks маршрути недоступні: {e}")
    _routes_status['tasks'] = {
        'loaded': False,
        'error': str(e),
        'register_function': None
    }
    register_tasks_routes = None

# Transaction маршрути
try:
    from .transaction_routes import register_transaction_routes
    _routes_status['transaction'] = {
        'loaded': True,
        'register_function': register_transaction_routes,
        'prefix': '/api/transactions',
        'description': 'Історія транзакцій'
    }
    logger.info("✅ Transaction маршрути імпортовано")
except ImportError as e:
    logger.warning(f"⚠️ Transaction маршрути недоступні: {e}")
    _routes_status['transaction'] = {
        'loaded': False,
        'error': str(e),
        'register_function': None
    }
    register_transaction_routes = None

# Verification маршрути
try:
    from .verification_routes import register_verification_routes
    _routes_status['verification'] = {
        'loaded': True,
        'register_function': register_verification_routes,
        'prefix': '/api/verify',
        'description': 'Верифікація завдань'
    }
    logger.info("✅ Verification маршрути імпортовано")
except ImportError as e:
    logger.warning(f"⚠️ Verification маршрути недоступні: {e}")
    _routes_status['verification'] = {
        'loaded': False,
        'error': str(e),
        'register_function': None
    }
    register_verification_routes = None

# Wallet маршрути
try:
    from .wallet_routes import register_wallet_routes
    _routes_status['wallet'] = {
        'loaded': True,
        'register_function': register_wallet_routes,
        'prefix': '/api/wallet',
        'description': 'TON гаманці'
    }
    logger.info("✅ Wallet маршрути імпортовано")
except ImportError as e:
    logger.warning(f"⚠️ Wallet маршрути недоступні: {e}")
    _routes_status['wallet'] = {
        'loaded': False,
        'error': str(e),
        'register_function': None
    }
    register_wallet_routes = None

# Analytics маршрути
try:
    from .analytics_routes import register_analytics_routes
    _routes_status['analytics'] = {
        'loaded': True,
        'register_function': register_analytics_routes,
        'prefix': '/api/analytics',
        'description': 'Аналітика та статистика'
    }
    logger.info("✅ Analytics маршрути імпортовано")
except ImportError as e:
    logger.warning(f"⚠️ Analytics маршрути недоступні: {e}")
    _routes_status['analytics'] = {
        'loaded': False,
        'error': str(e),
        'register_function': None
    }
    register_analytics_routes = None


def register_quests_routes(app: Flask, routes_to_register: List[str] = None) -> Dict[str, Any]:
    """
    Реєстрація всіх маршрутів системи завдань

    Args:
        app: Flask додаток
        routes_to_register: Список маршрутів для реєстрації (за замовчуванням - всі)

    Returns:
        Dict з результатами реєстрації
    """
    logger.info("=== РЕЄСТРАЦІЯ МАРШРУТІВ СИСТЕМИ ЗАВДАНЬ ===")

    registration_results = {
        'total_attempted': 0,
        'successfully_registered': 0,
        'failed_registrations': 0,
        'registered_routes': [],
        'failed_routes': [],
        'summary': {}
    }

    # Визначаємо які маршрути реєструвати
    # Визначаємо які маршрути реєструвати
    if routes_to_register is None:
        routes_to_register = list(_routes_status.keys())

    # ЗАМІНІТЬ ЦЕ:
    # Функції реєстрації у визначеному порядку пріоритету - ТІЛЬКИ ТІ ЩО ДОСТУПНІ
    route_registry = []

    # Порядок пріоритету
    priority_routes = [
        ('auth', register_auth_routes),
        ('user', register_user_routes),
        ('daily', register_daily_routes),
        ('tasks', register_tasks_routes),
        ('flex', register_flex_routes),
        ('wallet', register_wallet_routes),
        ('transaction', register_transaction_routes),
        ('verification', register_verification_routes),
        ('analytics', register_analytics_routes)
    ]

    # Додаємо тільки ті функції що не None та callable
    for route_name, register_func in priority_routes:
        if register_func is not None and callable(register_func):
            route_registry.append((route_name, register_func))
        else:
            logger.debug(f"⏭️ Пропускаємо {route_name} - функція недоступна")

    # Реєструємо маршрути в порядку пріоритету
    for route_name, register_func in route_registry:
        if route_name not in routes_to_register:
            continue

        registration_results['total_attempted'] += 1
        route_status = _routes_status.get(route_name, {})

        if not route_status.get('loaded', False):
            logger.warning(f"⏭️ Пропускаємо {route_name} маршрути (не завантажені)")
            registration_results['failed_routes'].append({
                'name': route_name,
                'reason': 'not_loaded',
                'error': route_status.get('error', 'Import failed')
            })
            registration_results['failed_registrations'] += 1
            continue

        if register_func is None:
            logger.warning(f"⏭️ Пропускаємо {route_name} маршрути (функція реєстрації недоступна)")
            registration_results['failed_routes'].append({
                'name': route_name,
                'reason': 'no_register_function',
                'error': 'Register function is None'
            })
            registration_results['failed_registrations'] += 1
            continue

        try:
            logger.info(f"🔧 Реєстрація {route_name} маршрутів...")

            # Викликаємо функцію реєстрації
            result = register_func(app)

            if result is True or result is None:  # Більшість функцій повертають True або None при успіху
                registration_results['successfully_registered'] += 1
                registration_results['registered_routes'].append({
                    'name': route_name,
                    'prefix': route_status.get('prefix', 'unknown'),
                    'description': route_status.get('description', '')
                })
                logger.info(f"✅ {route_name.title()} маршрути зареєстровано")
            else:
                registration_results['failed_registrations'] += 1
                registration_results['failed_routes'].append({
                    'name': route_name,
                    'reason': 'registration_failed',
                    'error': f'Function returned: {result}'
                })
                logger.error(f"❌ Помилка реєстрації {route_name} маршрутів")

        except Exception as e:
            registration_results['failed_registrations'] += 1
            registration_results['failed_routes'].append({
                'name': route_name,
                'reason': 'exception',
                'error': str(e)
            })
            logger.error(f"❌ Виняток при реєстрації {route_name} маршрутів: {e}", exc_info=True)

    # Підрахунок загальної кількості маршрутів
    total_routes_count = 0
    for rule in app.url_map.iter_rules():
        if '/api/' in rule.rule:
            total_routes_count += 1

    # Формуємо підсумок
    registration_results['summary'] = {
        'success_rate': round(
            (registration_results['successfully_registered'] / registration_results['total_attempted']) * 100, 1
        ) if registration_results['total_attempted'] > 0 else 0,
        'total_api_routes': total_routes_count,
        'system_status': 'healthy' if registration_results['successfully_registered'] >= registration_results['failed_registrations'] else 'degraded'
    }

    # Логуємо результат
    _log_registration_summary(registration_results)

    return registration_results


def _log_registration_summary(results: Dict[str, Any]):
    """Виведення підсумку реєстрації маршрутів"""
    summary = results['summary']

    if results['successfully_registered'] == results['total_attempted']:
        logger.info(f"🎉 Всі {results['total_attempted']} груп маршрутів зареєстровано успішно!")
    else:
        logger.warning(
            f"⚠️ Зареєстровано {results['successfully_registered']}/{results['total_attempted']} "
            f"груп маршрутів ({summary['success_rate']}%)"
        )

    if results['registered_routes']:
        logger.info("✅ Успішно зареєстровані маршрути:")
        for route in results['registered_routes']:
            logger.info(f"  • {route['name']}: {route['prefix']} - {route['description']}")

    if results['failed_routes']:
        logger.warning("❌ Проблемні маршрути:")
        for route in results['failed_routes']:
            logger.warning(f"  • {route['name']}: {route['reason']} - {route['error']}")

    logger.info(f"📊 Загальна кількість API маршрутів: {summary['total_api_routes']}")
    logger.info(f"🏥 Статус системи: {summary['system_status']}")


def get_routes_status() -> Dict[str, Any]:
    """
    Отримання статусу всіх маршрутів

    Returns:
        Dict з інформацією про статус кожної групи маршрутів
    """
    return _routes_status.copy()


def get_loaded_routes() -> Dict[str, Any]:
    """
    Отримання списку завантажених маршрутів

    Returns:
        Dict з завантаженими маршрутами
    """
    return {
        name: status for name, status in _routes_status.items()
        if status.get('loaded', False)
    }


def get_failed_routes() -> Dict[str, Any]:
    """
    Отримання списку маршрутів що не завантажились

    Returns:
        Dict з маршрутами що не завантажились
    """
    return {
        name: status for name, status in _routes_status.items()
        if not status.get('loaded', False)
    }


def register_specific_routes(app: Flask, route_names: List[str]) -> Dict[str, Any]:
    """
    Реєстрація конкретних груп маршрутів

    Args:
        app: Flask додаток
        route_names: Список назв маршрутів для реєстрації

    Returns:
        Dict з результатами реєстрації
    """
    logger.info(f"🎯 Реєстрація вибраних маршрутів: {', '.join(route_names)}")
    return register_quests_routes(app, route_names)


def register_core_routes(app: Flask) -> Dict[str, Any]:
    """
    Реєстрація тільки основних маршрутів (auth, user, tasks)

    Args:
        app: Flask додаток

    Returns:
        Dict з результатами реєстрації
    """
    core_routes = ['auth', 'user', 'tasks', 'daily']
    logger.info("🔧 Реєстрація основних маршрутів системи")
    return register_quests_routes(app, core_routes)


def register_extended_routes(app: Flask) -> Dict[str, Any]:
    """
    Реєстрація розширених маршрутів (flex, wallet, analytics)

    Args:
        app: Flask додаток

    Returns:
        Dict з результатами реєстрації
    """
    extended_routes = ['flex', 'wallet', 'transaction', 'verification', 'analytics']
    logger.info("🚀 Реєстрація розширених маршрутів системи")
    return register_quests_routes(app, extended_routes)


def log_routes_summary():
    """Виведення підсумку завантаження маршрутів"""
    loaded_count = len(get_loaded_routes())
    failed_count = len(get_failed_routes())
    total_count = len(_routes_status)

    logger.info(f"📊 Статус маршрутів: {loaded_count}/{total_count} завантажено")

    if loaded_count > 0:
        logger.info("✅ Завантажені маршрути:")
        for name, status in get_loaded_routes().items():
            logger.info(f"  • {name}: {status.get('prefix', 'N/A')} - {status.get('description', 'N/A')}")

    if failed_count > 0:
        logger.warning("❌ Маршрути з помилками:")
        for name, status in get_failed_routes().items():
            logger.warning(f"  • {name}: {status.get('error', 'Unknown error')}")


# Логуємо підсумок при імпорті
log_routes_summary()

# Експорт основних функцій
__all__ = [
    'register_quests_routes',
    'register_specific_routes',
    'register_core_routes',
    'register_extended_routes',
    'get_routes_status',
    'get_loaded_routes',
    'get_failed_routes',
    'log_routes_summary',

    # Функції реєстрації (якщо доступні)
    'register_auth_routes',
    'register_user_routes',
    'register_daily_routes',
    'register_tasks_routes',
    'register_flex_routes',
    'register_wallet_routes',
    'register_transaction_routes',
    'register_verification_routes',
    'register_analytics_routes'
]