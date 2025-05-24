"""
Маршрути системи завдань WINIX
Централізована реєстрація всіх маршрутів
"""

import logging
from flask import Flask

logger = logging.getLogger(__name__)


def register_quests_routes(app: Flask) -> bool:
    """
    Реєстрація всіх маршрутів системи завдань

    Args:
        app: Flask додаток

    Returns:
        bool: True якщо всі маршрути зареєстровано успішно
    """
    logger.info("=== РЕЄСТРАЦІЯ МАРШРУТІВ СИСТЕМИ ЗАВДАНЬ ===")

    success_count = 0
    total_routes = 0

    # Маршрути авторизації
    try:
        from .auth_routes import register_auth_routes
        if register_auth_routes(app):
            success_count += 1
            logger.info("✅ Auth маршрути зареєстровано")
        else:
            logger.error("❌ Помилка реєстрації auth маршрутів")
        total_routes += 1
    except Exception as e:
        logger.error(f"❌ Критична помилка реєстрації auth маршрутів: {e}", exc_info=True)
        total_routes += 1

    # Маршрути користувачів
    try:
        from .user_routes import register_user_routes
        if register_user_routes(app):
            success_count += 1
            logger.info("✅ User маршрути зареєстровано")
        else:
            logger.error("❌ Помилка реєстрації user маршрутів")
        total_routes += 1
    except Exception as e:
        logger.error(f"❌ Критична помилка реєстрації user маршрутів: {e}", exc_info=True)
        total_routes += 1

    # Маршрути щоденних бонусів
    try:
        from .daily_routes import register_daily_routes
        if register_daily_routes(app):
            success_count += 1
            logger.info("✅ Daily маршрути зареєстровано")
        else:
            logger.error("❌ Помилка реєстрації daily маршрутів")
        total_routes += 1
    except Exception as e:
        logger.error(f"❌ Критична помилка реєстрації daily маршрутів: {e}", exc_info=True)
        total_routes += 1

    # ✅ ДОДАНО: Маршрути аналітики
    try:
        from .analytics_routes import register_analytics_routes
        if register_analytics_routes(app):
            success_count += 1
            logger.info("✅ Analytics маршрути зареєстровано")
        else:
            logger.error("❌ Помилка реєстрації analytics маршрутів")
        total_routes += 1
    except Exception as e:
        logger.error(f"❌ Критична помилка реєстрації analytics маршрутів: {e}", exc_info=True)
        total_routes += 1

    # ✅ ДОДАНО: Маршрути FLEX
    try:
        from .flex_routes import register_flex_routes
        if register_flex_routes(app):
            success_count += 1
            logger.info("✅ FLEX маршрути зареєстровано")
        else:
            logger.error("❌ Помилка реєстрації FLEX маршрутів")
        total_routes += 1
    except Exception as e:
        logger.error(f"❌ Критична помилка реєстрації FLEX маршрутів: {e}", exc_info=True)
        total_routes += 1

    # ✅ ДОДАНО: Маршрути завдань
    try:
        from .tasks_routes import register_tasks_routes
        if register_tasks_routes(app):
            success_count += 1
            logger.info("✅ Tasks маршрути зареєстровано")
        else:
            logger.error("❌ Помилка реєстрації tasks маршрутів")
        total_routes += 1
    except Exception as e:
        logger.error(f"❌ Критична помилка реєстрації tasks маршрутів: {e}", exc_info=True)
        total_routes += 1

    # ✅ ДОДАНО: Маршрути транзакцій
    try:
        from .transaction_routes import register_transaction_routes
        if register_transaction_routes(app):
            success_count += 1
            logger.info("✅ Transaction маршрути зареєстровано")
        else:
            logger.error("❌ Помилка реєстрації transaction маршрутів")
        total_routes += 1
    except Exception as e:
        logger.error(f"❌ Критична помилка реєстрації transaction маршрутів: {e}", exc_info=True)
        total_routes += 1

    # ✅ ДОДАНО: Маршрути верифікації
    try:
        from .verification_routes import register_verification_routes
        if register_verification_routes(app):
            success_count += 1
            logger.info("✅ Verification маршрути зареєстровано")
        else:
            logger.error("❌ Помилка реєстрації verification маршрутів")
        total_routes += 1
    except Exception as e:
        logger.error(f"❌ Критична помилка реєстрації verification маршрутів: {e}", exc_info=True)
        total_routes += 1

    # ✅ ДОДАНО: Маршрути гаманців
    try:
        from .wallet_routes import register_wallet_routes
        if register_wallet_routes(app):
            success_count += 1
            logger.info("✅ Wallet маршрути зареєстровано")
        else:
            logger.error("❌ Помилка реєстрації wallet маршрутів")
        total_routes += 1
    except Exception as e:
        logger.error(f"❌ Критична помилка реєстрації wallet маршрутів: {e}", exc_info=True)
        total_routes += 1

    # Логуємо результат
    if success_count == total_routes:
        logger.info(f"🎉 Всі {total_routes} груп маршрутів зареєстровано успішно!")
    else:
        logger.warning(f"⚠️ Зареєстровано {success_count}/{total_routes} груп маршрутів")

    # Логуємо загальну кількість маршрутів
    quests_routes_count = 0
    for rule in app.url_map.iter_rules():
        if '/api/' in rule.rule and any(prefix in rule.rule for prefix in [
            '/auth/', '/user/', '/daily/', '/analytics/', '/flex/',
            '/tasks/', '/transactions/', '/verify/', '/wallet/'
        ]):
            quests_routes_count += 1

    logger.info(f"📊 Загальна кількість маршрутів системи завдань: {quests_routes_count}")

    return success_count == total_routes


# Експорт основної функції
__all__ = ['register_quests_routes']