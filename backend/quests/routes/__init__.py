"""
Маршрути системи завдань WINIX
Централізована реєстрація всіх маршрутів
"""

import logging
from typing import Any
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

    # Логуємо результат
    if success_count == total_routes:
        logger.info(f"🎉 Всі {total_routes} груп маршрутів зареєстровано успішно!")
    else:
        logger.warning(f"⚠️ Зареєстровано {success_count}/{total_routes} груп маршрутів")

    # Логуємо загальну кількість маршрутів
    quests_routes_count = 0
    for rule in app.url_map.iter_rules():
        if '/api/' in rule.rule and any(prefix in rule.rule for prefix in ['/auth/', '/user/', '/daily/']):
            quests_routes_count += 1

    logger.info(f"📊 Загальна кількість маршрутів системи завдань: {quests_routes_count}")

    return success_count == total_routes


# Експорт основної функції
__all__ = ['register_quests_routes']