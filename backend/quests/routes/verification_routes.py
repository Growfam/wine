"""
Маршрути API для системи верифікації завдань WINIX
Реєстрація всіх endpoints верифікації
"""

import logging
from flask import Blueprint, request

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
except ImportError:
    try:
        from verification_controller import (
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
    except ImportError as e:
        logging.error(f"❌ Не вдалося імпортувати контролери верифікації: {str(e)}")


        # Створюємо заглушки для випадку коли контролери недоступні
        def verify_telegram_subscription(*args, **kwargs):
            return {'error': 'Контролер недоступний'}, 503


        def check_bot_started(*args, **kwargs):
            return {'error': 'Контролер недоступний'}, 503


        def verify_social_task(*args, **kwargs):
            return {'error': 'Контролер недоступний'}, 503


        def start_task_verification(*args, **kwargs):
            return {'error': 'Контролер недоступний'}, 503


        def check_verification_status(*args, **kwargs):
            return {'error': 'Контролер недоступний'}, 503


        def complete_verification(*args, **kwargs):
            return {'error': 'Контролер недоступний'}, 503


        def get_verification_statistics(*args, **kwargs):
            return {'error': 'Контролер недоступний'}, 503


        def cleanup_expired_verifications(*args, **kwargs):
            return {'error': 'Контролер недоступний'}, 503


        def get_telegram_bot_info(*args, **kwargs):
            return {'error': 'Контролер недоступний'}, 503


        def get_user_completed_tasks(*args, **kwargs):
            return {'error': 'Контролер недоступний'}, 503


        def check_task_completion(*args, **kwargs):
            return {'error': 'Контролер недоступний'}, 503

# Налаштування логування
logger = logging.getLogger(__name__)

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
            view_func=verify_telegram_subscription,
            methods=['POST']
        )

        # Перевірка запуску бота
        app.add_url_rule(
            '/api/verify/check-bot/<string:user_id>',
            endpoint='check_bot_started',
            view_func=check_bot_started,
            methods=['GET']
        )

        # Верифікація соціальних завдань
        app.add_url_rule(
            '/api/verify/social/<string:user_id>/<string:platform>',
            endpoint='verify_social_task',
            view_func=verify_social_task,
            methods=['POST']
        )

        # === МАРШРУТИ УПРАВЛІННЯ ВЕРИФІКАЦІЄЮ ===

        # Початок верифікації завдання
        app.add_url_rule(
            '/api/verify/start/<string:user_id>/<string:task_id>',
            endpoint='start_task_verification',
            view_func=start_task_verification,
            methods=['POST']
        )

        # Перевірка статусу верифікації
        app.add_url_rule(
            '/api/verify/status/<string:user_id>/<string:task_id>',
            endpoint='check_verification_status',
            view_func=check_verification_status,
            methods=['GET']
        )

        # Завершення верифікації
        app.add_url_rule(
            '/api/verify/complete/<string:user_id>/<string:task_id>',
            endpoint='complete_verification',
            view_func=complete_verification,
            methods=['POST']
        )

        # === МАРШРУТИ ІНФОРМАЦІЇ ТА СТАТИСТИКИ ===

        # Статистика верифікації
        app.add_url_rule(
            '/api/verify/statistics',
            endpoint='get_verification_statistics',
            view_func=get_verification_statistics,
            methods=['GET']
        )

        # Інформація про Telegram бота
        app.add_url_rule(
            '/api/verify/bot-info',
            endpoint='get_telegram_bot_info',
            view_func=get_telegram_bot_info,
            methods=['GET']
        )

        # === МАРШРУТИ УПРАВЛІННЯ ЗАВДАННЯМИ ===

        # Список виконаних завдань користувача
        app.add_url_rule(
            '/api/verify/completed/<string:user_id>',
            endpoint='get_user_completed_tasks',
            view_func=get_user_completed_tasks,
            methods=['GET']
        )

        # Перевірка виконання конкретного завдання
        app.add_url_rule(
            '/api/verify/check/<string:user_id>/<string:task_id>',
            endpoint='check_task_completion',
            view_func=check_task_completion,
            methods=['GET']
        )

        # === АДМІНІСТРАТИВНІ МАРШРУТИ ===

        # Очищення застарілих верифікацій
        app.add_url_rule(
            '/api/verify/cleanup',
            endpoint='cleanup_expired_verifications',
            view_func=cleanup_expired_verifications,
            methods=['POST']
        )

        # === АЛЬТЕРНАТИВНІ МАРШРУТИ (для зворотної сумісності) ===

        # Альтернативний маршрут для Telegram верифікації
        app.add_url_rule(
            '/api/verify/telegram',
            endpoint='verify_telegram_subscription_alt',
            view_func=lambda: verify_telegram_subscription(
                request.json.get('user_id') if hasattr(request, 'json') and request.json else None
            ),
            methods=['POST']
        )

        # Альтернативний маршрут для соціальних мереж
        app.add_url_rule(
            '/api/verify/social',
            endpoint='verify_social_task_alt',
            view_func=lambda: verify_social_task(
                request.json.get('user_id') if hasattr(request, 'json') and request.json else None,
                request.json.get('platform') if hasattr(request, 'json') and request.json else None
            ),
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
        ]

        logger.info("📋 Зареєстровані маршрути верифікації:")
        for route in registered_routes:
            logger.info(f"   ✓ {route}")

        return True

    except Exception as e:
        logger.error(f"❌ Помилка реєстрації маршрутів верифікації: {str(e)}")
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
            view_func=verify_telegram_subscription,
            methods=['POST']
        )

        verification_bp.add_url_rule(
            '/check-bot/<string:user_id>',
            endpoint='check_bot',
            view_func=check_bot_started,
            methods=['GET']
        )

        verification_bp.add_url_rule(
            '/social/<string:user_id>/<string:platform>',
            endpoint='verify_social',
            view_func=verify_social_task,
            methods=['POST']
        )

        verification_bp.add_url_rule(
            '/start/<string:user_id>/<string:task_id>',
            endpoint='start_verification',
            view_func=start_task_verification,
            methods=['POST']
        )

        verification_bp.add_url_rule(
            '/status/<string:user_id>/<string:task_id>',
            endpoint='check_status',
            view_func=check_verification_status,
            methods=['GET']
        )

        verification_bp.add_url_rule(
            '/complete/<string:user_id>/<string:task_id>',
            endpoint='complete',
            view_func=complete_verification,
            methods=['POST']
        )

        verification_bp.add_url_rule(
            '/statistics',
            endpoint='statistics',
            view_func=get_verification_statistics,
            methods=['GET']
        )

        verification_bp.add_url_rule(
            '/bot-info',
            endpoint='bot_info',
            view_func=get_telegram_bot_info,
            methods=['GET']
        )

        verification_bp.add_url_rule(
            '/completed/<string:user_id>',
            endpoint='completed_tasks',
            view_func=get_user_completed_tasks,
            methods=['GET']
        )

        verification_bp.add_url_rule(
            '/check/<string:user_id>/<string:task_id>',
            endpoint='check_completion',
            view_func=check_task_completion,
            methods=['GET']
        )

        verification_bp.add_url_rule(
            '/cleanup',
            endpoint='cleanup',
            view_func=cleanup_expired_verifications,
            methods=['POST']
        )

        # Реєструємо Blueprint в додатку
        app.register_blueprint(verification_bp, url_prefix='/api/verify')

        logger.info("✅ Blueprint верифікації успішно зареєстровано")
        return True

    except Exception as e:
        logger.error(f"❌ Помилка реєстрації Blueprint верифікації: {str(e)}")
        return False


# Функція для тестування доступності маршрутів
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

    # Список маршрутів для тестування
    test_routes = [
        ('/api/verify/bot-info', 'GET'),
        ('/api/verify/statistics', 'GET'),
    ]

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

                if response.status_code < 500:  # Не враховуємо серверні помилки як проблеми маршруту
                    test_results['working_routes'] += 1
                else:
                    test_results['failed_routes'].append(f"{method} {route} - {response.status_code}")

            except Exception as e:
                test_results['failed_routes'].append(f"{method} {route} - Exception: {str(e)}")

    # Розраховуємо успішність
    if test_results['total_routes'] > 0:
        test_results['success_rate'] = int((test_results['working_routes'] / test_results['total_routes']) * 100)

    logger.info(
        f"🧪 Результати тестування: {test_results['working_routes']}/{test_results['total_routes']} маршрутів працюють ({test_results['success_rate']:.1f}%)")

    if test_results['failed_routes']:
        logger.warning("⚠️ Проблемні маршрути:")
        for failed_route in test_results['failed_routes']:
            logger.warning(f"   ❌ {failed_route}")

    return test_results


# Основна функція експорту
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

        if test_results['success_rate'] < 50:  # Якщо менше 50% маршрутів працює
            logger.warning(f"⚠️ Низька успішність маршрутів: {test_results['success_rate']:.1f}%")

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