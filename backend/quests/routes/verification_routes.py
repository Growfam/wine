"""
Маршрути API для системи верифікації завдань WINIX
Реєстрація всіх endpoints верифікації
"""

import logging
from flask import Blueprint, request

# Налаштування логування
logger = logging.getLogger(__name__)

# Ініціалізація змінних контролерів
verification_functions = {
    'verify_telegram_subscription': None,
    'check_bot_started': None,
    'verify_social_task': None,
    'start_task_verification': None,
    'check_verification_status': None,
    'complete_verification': None,
    'get_verification_statistics': None,
    'cleanup_expired_verifications': None,
    'get_telegram_bot_info': None,
    'get_user_completed_tasks': None,
    'check_task_completion': None
}

# Імпорт контролерів верифікації
try:
    from ..controllers.verification_controller import (
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

    # Оновлюємо словник з функціями
    verification_functions.update({
        'verify_telegram_subscription': verify_telegram_subscription,
        'check_bot_started': check_bot_started,
        'verify_social_task': verify_social_task,
        'start_task_verification': start_task_verification,
        'check_verification_status': check_verification_status,
        'complete_verification': complete_verification,
        'get_verification_statistics': get_verification_statistics,
        'cleanup_expired_verifications': cleanup_expired_verifications,
        'get_telegram_bot_info': get_telegram_bot_info,
        'get_user_completed_tasks': get_user_completed_tasks,
        'check_task_completion': check_task_completion
    })

    logger.info("✅ Контролери верифікації успішно імпортовано")

except ImportError as e:
    logger.error(f"❌ Не вдалося імпортувати контролери верифікації: {str(e)}")

    # Створюємо заглушки для випадку коли контролери недоступні
    def create_unavailable_handler(function_name):
        def handler(*args, **kwargs):
            logger.warning(f"Виклик недоступного контролера: {function_name}")
            return {
                'success': False,
                'error': 'Контролер верифікації недоступний',
                'code': 'VERIFICATION_CONTROLLER_UNAVAILABLE',
                'function': function_name
            }, 503
        return handler

    # Створюємо заглушки для всіх функцій
    for func_name in verification_functions.keys():
        verification_functions[func_name] = create_unavailable_handler(func_name)

# Створення Blueprint для верифікації
verification_bp = Blueprint('verification', __name__)


def register_verification_routes(app):
    """
    Реєструє всі маршрути верифікації в Flask додатку

    Args:
        app: Екземпляр Flask додатку
    """
    logger.info("🔧 Реєстрація маршрутів верифікації...")

    try:
        # === ОСНОВНІ МАРШРУТИ ВЕРИФІКАЦІЇ ===

        # Telegram верифікація
        app.add_url_rule(
            '/api/verify/telegram/<string:user_id>',
            endpoint='verify_telegram_subscription',
            view_func=verification_functions['verify_telegram_subscription'],
            methods=['POST']
        )

        # Перевірка запуску бота
        app.add_url_rule(
            '/api/verify/check-bot/<string:user_id>',
            endpoint='verify_check_bot_started',
            view_func=verification_functions['check_bot_started'],
            methods=['GET']
        )

        # Верифікація соціальних завдань
        app.add_url_rule(
            '/api/verify/social/<string:user_id>/<string:platform>',
            endpoint='verify_social_task',
            view_func=verification_functions['verify_social_task'],
            methods=['POST']
        )

        # === МАРШРУТИ УПРАВЛІННЯ ВЕРИФІКАЦІЄЮ ===

        # Початок верифікації завдання
        app.add_url_rule(
            '/api/verify/start/<string:user_id>/<string:task_id>',
            endpoint='verify_start_task_verification',
            view_func=verification_functions['start_task_verification'],
            methods=['POST']
        )

        # Перевірка статусу верифікації
        app.add_url_rule(
            '/api/verify/status/<string:user_id>/<string:task_id>',
            endpoint='verify_check_verification_status',
            view_func=verification_functions['check_verification_status'],
            methods=['GET']
        )

        # Завершення верифікації
        app.add_url_rule(
            '/api/verify/complete/<string:user_id>/<string:task_id>',
            endpoint='verify_complete_verification',
            view_func=verification_functions['complete_verification'],
            methods=['POST']
        )

        # === МАРШРУТИ ІНФОРМАЦІЇ ТА СТАТИСТИКИ ===

        # Статистика верифікації
        app.add_url_rule(
            '/api/verify/statistics',
            endpoint='verify_get_verification_statistics',
            view_func=verification_functions['get_verification_statistics'],
            methods=['GET']
        )

        # Інформація про Telegram бота
        app.add_url_rule(
            '/api/verify/bot-info',
            endpoint='verify_get_telegram_bot_info',
            view_func=verification_functions['get_telegram_bot_info'],
            methods=['GET']
        )

        # === МАРШРУТИ УПРАВЛІННЯ ЗАВДАННЯМИ ===

        # Список виконаних завдань користувача
        app.add_url_rule(
            '/api/verify/completed/<string:user_id>',
            endpoint='verify_get_user_completed_tasks',
            view_func=verification_functions['get_user_completed_tasks'],
            methods=['GET']
        )

        # Перевірка виконання конкретного завдання
        app.add_url_rule(
            '/api/verify/check/<string:user_id>/<string:task_id>',
            endpoint='verify_check_task_completion',
            view_func=verification_functions['check_task_completion'],
            methods=['GET']
        )

        # === АДМІНІСТРАТИВНІ МАРШРУТИ ===

        # Очищення застарілих верифікацій
        app.add_url_rule(
            '/api/verify/cleanup',
            endpoint='verify_cleanup_expired_verifications',
            view_func=verification_functions['cleanup_expired_verifications'],
            methods=['POST']
        )

        # === АЛЬТЕРНАТИВНІ МАРШРУТИ (для зворотної сумісності) ===

        def verify_telegram_alt():
            """Альтернативний маршрут для Telegram верифікації"""
            data = request.get_json() if request.is_json else {}
            user_id = data.get('user_id')

            if not user_id:
                return {
                    'success': False,
                    'error': 'user_id обов\'язковий в body запиту',
                    'code': 'MISSING_USER_ID'
                }, 400

            return verification_functions['verify_telegram_subscription'](user_id)

        def verify_social_alt():
            """Альтернативний маршрут для соціальних мереж"""
            data = request.get_json() if request.is_json else {}
            user_id = data.get('user_id')
            platform = data.get('platform')

            if not user_id or not platform:
                return {
                    'success': False,
                    'error': 'user_id та platform обов\'язкові в body запиту',
                    'code': 'MISSING_PARAMETERS'
                }, 400

            return verification_functions['verify_social_task'](user_id, platform)

        # Реєстрація альтернативних маршрутів
        app.add_url_rule(
            '/api/verify/telegram',
            endpoint='verify_telegram_subscription_alt',
            view_func=verify_telegram_alt,
            methods=['POST']
        )

        app.add_url_rule(
            '/api/verify/social',
            endpoint='verify_social_task_alt',
            view_func=verify_social_alt,
            methods=['POST']
        )

        logger.info("✅ Маршрути верифікації успішно зареєстровано")

        # Виводимо список зареєстрованих маршрутів
        registered_routes = [
            'POST /api/verify/telegram/<user_id>',
            'GET  /api/verify/check-bot/<user_id>',
            'POST /api/verify/social/<user_id>/<platform>',
            'POST /api/verify/start/<user_id>/<task_id>',
            'GET  /api/verify/status/<user_id>/<task_id>',
            'POST /api/verify/complete/<user_id>/<task_id>',
            'GET  /api/verify/statistics',
            'GET  /api/verify/bot-info',
            'GET  /api/verify/completed/<user_id>',
            'GET  /api/verify/check/<user_id>/<task_id>',
            'POST /api/verify/cleanup',
            'POST /api/verify/telegram (альтернативний)',
            'POST /api/verify/social (альтернативний)',
        ]

        logger.info("📋 Зареєстровані маршрути верифікації:")
        for route in registered_routes:
            logger.info(f"   ✓ {route}")

        return True

    except Exception as e:
        logger.error(f"❌ Помилка реєстрації маршрутів верифікації: {str(e)}")
        logger.error(f"Тип помилки: {type(e).__name__}")
        return False


def register_verification_blueprint(app):
    """
    Альтернативний метод реєстрації через Blueprint

    Args:
        app: Екземпляр Flask додатку
    """
    logger.info("🔧 Реєстрація Blueprint верифікації...")

    try:
        # Додаємо маршрути до Blueprint
        verification_bp.add_url_rule(
            '/telegram/<string:user_id>',
            endpoint='verify_telegram',
            view_func=verification_functions['verify_telegram_subscription'],
            methods=['POST']
        )

        verification_bp.add_url_rule(
            '/check-bot/<string:user_id>',
            endpoint='check_bot',
            view_func=verification_functions['check_bot_started'],
            methods=['GET']
        )

        verification_bp.add_url_rule(
            '/social/<string:user_id>/<string:platform>',
            endpoint='verify_social',
            view_func=verification_functions['verify_social_task'],
            methods=['POST']
        )

        verification_bp.add_url_rule(
            '/start/<string:user_id>/<string:task_id>',
            endpoint='start_verification',
            view_func=verification_functions['start_task_verification'],
            methods=['POST']
        )

        verification_bp.add_url_rule(
            '/status/<string:user_id>/<string:task_id>',
            endpoint='check_status',
            view_func=verification_functions['check_verification_status'],
            methods=['GET']
        )

        verification_bp.add_url_rule(
            '/complete/<string:user_id>/<string:task_id>',
            endpoint='complete',
            view_func=verification_functions['complete_verification'],
            methods=['POST']
        )

        verification_bp.add_url_rule(
            '/statistics',
            endpoint='statistics',
            view_func=verification_functions['get_verification_statistics'],
            methods=['GET']
        )

        verification_bp.add_url_rule(
            '/bot-info',
            endpoint='bot_info',
            view_func=verification_functions['get_telegram_bot_info'],
            methods=['GET']
        )

        verification_bp.add_url_rule(
            '/completed/<string:user_id>',
            endpoint='completed_tasks',
            view_func=verification_functions['get_user_completed_tasks'],
            methods=['GET']
        )

        verification_bp.add_url_rule(
            '/check/<string:user_id>/<string:task_id>',
            endpoint='check_completion',
            view_func=verification_functions['check_task_completion'],
            methods=['GET']
        )

        verification_bp.add_url_rule(
            '/cleanup',
            endpoint='cleanup',
            view_func=verification_functions['cleanup_expired_verifications'],
            methods=['POST']
        )

        # Реєструємо Blueprint в додатку
        app.register_blueprint(verification_bp, url_prefix='/api/verify')

        logger.info("✅ Blueprint верифікації успішно зареєстровано")
        return True

    except Exception as e:
        logger.error(f"❌ Помилка реєстрації Blueprint верифікації: {str(e)}")
        return False


def test_verification_routes(app):
    """
    Тестує доступність маршрутів верифікації

    Args:
        app: Екземпляр Flask додатку

    Returns:
        Dict з результатами тестування
    """
    logger.info("🧪 Тестування маршрутів верифікації...")

    test_results = {
        'total_routes': 0,
        'working_routes': 0,
        'failed_routes': [],
        'success_rate': 0
    }

    # Список маршрутів для тестування (тільки GET маршрути без параметрів)
    test_routes = [
        ('/api/verify/bot-info', 'GET'),
        ('/api/verify/statistics', 'GET'),
    ]

    try:
        with app.test_client() as client:
            for route, method in test_routes:
                test_results['total_routes'] += 1

                try:
                    if method == 'GET':
                        response = client.get(route)
                    elif method == 'POST':
                        response = client.post(route, json={})
                    else:
                        continue

                    # Враховуємо як успішні всі відповіді крім 500+ (серверні помилки)
                    if response.status_code < 500:
                        test_results['working_routes'] += 1
                    else:
                        test_results['failed_routes'].append(f"{method} {route} - HTTP {response.status_code}")

                except Exception as e:
                    test_results['failed_routes'].append(f"{method} {route} - Exception: {str(e)}")

        # Розраховуємо успішність
        if test_results['total_routes'] > 0:
            test_results['success_rate'] = (test_results['working_routes'] / test_results['total_routes']) * 100

        logger.info(
            f"🧪 Результати тестування: {test_results['working_routes']}/{test_results['total_routes']} "
            f"маршрутів працюють ({test_results['success_rate']:.1f}%)"
        )

        if test_results['failed_routes']:
            logger.warning("⚠️ Проблемні маршрути:")
            for failed_route in test_results['failed_routes']:
                logger.warning(f"   ❌ {failed_route}")

    except Exception as e:
        logger.error(f"Помилка тестування маршрутів: {e}")
        test_results['failed_routes'].append(f"Testing error: {str(e)}")

    return test_results


def setup_verification_system(app):
    """
    Повна ініціалізація системи верифікації

    Args:
        app: Екземпляр Flask додатку

    Returns:
        bool: True якщо система успішно ініціалізована
    """
    logger.info("🚀 Ініціалізація системи верифікації WINIX...")

    try:
        # Реєструємо маршрути
        routes_registered = register_verification_routes(app)

        if not routes_registered:
            logger.error("❌ Не вдалося зареєструвати маршрути верифікації")
            return False

        # Тестуємо маршрути
        test_results = test_verification_routes(app)

        success_threshold = 50  # 50% маршрутів повинні працювати
        if test_results['success_rate'] < success_threshold:
            logger.warning(f"⚠️ Низька успішність маршрутів: {test_results['success_rate']:.1f}% (очікувалось >{success_threshold}%)")
        else:
            logger.info(f"✅ Маршрути верифікації працюють успішно: {test_results['success_rate']:.1f}%")

        logger.info("✅ Система верифікації WINIX успішно ініціалізована")
        logger.info("📋 Доступні функції:")
        logger.info("   🔍 Верифікація Telegram підписок")
        logger.info("   ⏱️ Таймери для соціальних завдань")
        logger.info("   📊 Статистика верифікацій")
        logger.info("   🤖 Інтеграція з Telegram ботом")
        logger.info("   🧹 Автоматичне очищення застарілих даних")

        return True

    except Exception as e:
        logger.error(f"❌ Помилка ініціалізації системи верифікації: {str(e)}")
        return False


# Експортуємо основні функції
__all__ = [
    'register_verification_routes',
    'register_verification_blueprint',
    'verification_bp',
    'setup_verification_system',
    'test_verification_routes'
]