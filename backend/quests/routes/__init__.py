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
    registration_errors = []

    # === 1. МАРШРУТИ АВТОРИЗАЦІЇ ===
    try:
        logger.info("🔐 Реєстрація auth маршрутів...")
        from .auth_routes import register_auth_routes

        if register_auth_routes(app):
            success_count += 1
            logger.info("✅ Auth маршрути зареєстровано")
        else:
            logger.error("❌ Помилка реєстрації auth маршрутів: функція повернула False")
            registration_errors.append("Auth: registration function returned False")
        total_routes += 1

    except Exception as e:
        logger.error(f"❌ Критична помилка реєстрації auth маршрутів: {e}")

        # Детальна діагностика помилки Blueprint
        error_msg = str(e).lower()
        if "already registered" in error_msg and "auth" in error_msg:
            logger.error("🔴 КОНФЛІКТ BLUEPRINT 'auth' - Blueprint з такою назвою вже існує!")
            logger.error("💡 Рішення: змініть назву Blueprint в auth_routes.py на 'quests_auth'")
            registration_errors.append("Auth: Blueprint name conflict - 'auth' already exists")
        else:
            registration_errors.append(f"Auth: {str(e)}")
        total_routes += 1

    # === 2. МАРШРУТИ КОРИСТУВАЧІВ ===
    try:
        logger.info("👤 Реєстрація user маршрутів...")
        from .user_routes import register_user_routes

        if register_user_routes(app):
            success_count += 1
            logger.info("✅ User маршрути зареєстровано")
        else:
            logger.error("❌ Помилка реєстрації user маршрутів: функція повернула False")
            registration_errors.append("User: registration function returned False")
        total_routes += 1

    except Exception as e:
        logger.error(f"❌ Критична помилка реєстрації user маршрутів: {e}")
        registration_errors.append(f"User: {str(e)}")
        total_routes += 1

    # === 3. МАРШРУТИ ЩОДЕННИХ БОНУСІВ ===
    try:
        logger.info("📅 Реєстрація daily маршрутів...")
        from .daily_routes import register_daily_routes

        if register_daily_routes(app):
            success_count += 1
            logger.info("✅ Daily маршрути зареєстровано")
        else:
            logger.error("❌ Помилка реєстрації daily маршрутів: функція повернула False")
            registration_errors.append("Daily: registration function returned False")
        total_routes += 1

    except Exception as e:
        logger.error(f"❌ Критична помилка реєстрації daily маршрутів: {e}")
        registration_errors.append(f"Daily: {str(e)}")
        total_routes += 1

    # === 4. МАРШРУТИ АНАЛІТИКИ ===
    try:
        logger.info("📊 Реєстрація analytics маршрутів...")
        from .analytics_routes import register_analytics_routes

        if register_analytics_routes(app):
            success_count += 1
            logger.info("✅ Analytics маршрути зареєстровано")
        else:
            logger.error("❌ Помилка реєстрації analytics маршрутів: функція повернула False")
            registration_errors.append("Analytics: registration function returned False")
        total_routes += 1

    except Exception as e:
        logger.error(f"❌ Критична помилка реєстрації analytics маршрутів: {e}")
        registration_errors.append(f"Analytics: {str(e)}")
        total_routes += 1

    # === 5. МАРШРУТИ FLEX ===
    try:
        logger.info("💎 Реєстрація FLEX маршрутів...")
        from .flex_routes import register_flex_routes

        if register_flex_routes(app):
            success_count += 1
            logger.info("✅ FLEX маршрути зареєстровано")
        else:
            logger.error("❌ Помилка реєстрації FLEX маршрутів: функція повернула False")
            registration_errors.append("FLEX: registration function returned False")
        total_routes += 1

    except Exception as e:
        logger.error(f"❌ Критична помилка реєстрації FLEX маршрутів: {e}")
        registration_errors.append(f"FLEX: {str(e)}")
        total_routes += 1

    # === 6. МАРШРУТИ ЗАВДАНЬ ===
    try:
        logger.info("📋 Реєстрація tasks маршрутів...")
        from .tasks_routes import register_tasks_routes

        if register_tasks_routes(app):
            success_count += 1
            logger.info("✅ Tasks маршрути зареєстровано")
        else:
            logger.error("❌ Помилка реєстрації tasks маршрутів: функція повернула False")
            registration_errors.append("Tasks: registration function returned False")
        total_routes += 1

    except Exception as e:
        logger.error(f"❌ Критична помилка реєстрації tasks маршрутів: {e}")
        registration_errors.append(f"Tasks: {str(e)}")
        total_routes += 1

    # === 7. МАРШРУТИ ТРАНЗАКЦІЙ ===
    try:
        logger.info("💳 Реєстрація transaction маршрутів...")
        from .transaction_routes import register_transaction_routes

        if register_transaction_routes(app):
            success_count += 1
            logger.info("✅ Transaction маршрути зареєстровано")
        else:
            logger.error("❌ Помилка реєстрації transaction маршрутів: функція повернула False")
            registration_errors.append("Transaction: registration function returned False")
        total_routes += 1

    except Exception as e:
        logger.error(f"❌ Критична помилка реєстрації transaction маршрутів: {e}")

        # Спеціальна діагностика для транзакцій
        error_msg = str(e).lower()
        if "blueprint" in error_msg and "already registered" in error_msg:
            logger.error("🔴 КОНФЛІКТ BLUEPRINT 'transaction' - можливо Blueprint вже існує!")
            registration_errors.append("Transaction: Blueprint name conflict")
        else:
            registration_errors.append(f"Transaction: {str(e)}")
        total_routes += 1

    # === 8. МАРШРУТИ ВЕРИФІКАЦІЇ ===
    try:
        logger.info("🔍 Реєстрація verification маршрутів...")
        from .verification_routes import register_verification_routes

        if register_verification_routes(app):
            success_count += 1
            logger.info("✅ Verification маршрути зареєстровано")
        else:
            logger.error("❌ Помилка реєстрації verification маршрутів: функція повернула False")
            registration_errors.append("Verification: registration function returned False")
        total_routes += 1

    except Exception as e:
        logger.error(f"❌ Критична помилка реєстрації verification маршрутів: {e}")
        registration_errors.append(f"Verification: {str(e)}")
        total_routes += 1

    # === 9. МАРШРУТИ ГАМАНЦІВ ===
    try:
        logger.info("💰 Реєстрація wallet маршрутів...")
        from .wallet_routes import register_wallet_routes

        if register_wallet_routes(app):
            success_count += 1
            logger.info("✅ Wallet маршрути зареєстровано")
        else:
            logger.error("❌ Помилка реєстрації wallet маршрутів: функція повернула False")
            registration_errors.append("Wallet: registration function returned False")
        total_routes += 1

    except Exception as e:
        logger.error(f"❌ Критична помилка реєстрації wallet маршрутів: {e}")
        registration_errors.append(f"Wallet: {str(e)}")
        total_routes += 1

    # === ПІДСУМОК РЕЄСТРАЦІЇ ===
    logger.info("📊 === ПІДСУМОК РЕЄСТРАЦІЇ МАРШРУТІВ ===")

    success_rate = (success_count / total_routes * 100) if total_routes > 0 else 0

    if success_count == total_routes:
        logger.info(f"🎉 Всі {total_routes} груп маршрутів зареєстровано успішно!")
    else:
        logger.warning(f"⚠️ Зареєстровано {success_count}/{total_routes} груп маршрутів ({success_rate:.1f}%)")

    # Виводимо помилки реєстрації
    if registration_errors:
        logger.error("🔴 Помилки реєстрації:")
        for i, error in enumerate(registration_errors, 1):
            logger.error(f"   {i}. {error}")

    # Аналіз зареєстрованих маршрутів
    try:
        quests_routes_count = 0
        quests_routes = []

        for rule in app.url_map.iter_rules():
            rule_str = str(rule.rule)

            # Перевіряємо чи це маршрут системи завдань
            if '/api/' in rule_str and any(prefix in rule_str for prefix in [
                '/auth/', '/user/', '/daily/', '/analytics/', '/flex/',
                '/tasks/', '/transactions/', '/verify/', '/wallet/'
            ]):
                quests_routes_count += 1
                quests_routes.append({
                    'path': rule_str,
                    'methods': list(rule.methods - {'HEAD', 'OPTIONS'}),
                    'endpoint': rule.endpoint
                })

        logger.info(f"📋 Загальна кількість маршрутів системи завдань: {quests_routes_count}")

        # Групуємо маршрути по типах
        routes_by_type = {}
        for route in quests_routes:
            for route_type in ['auth', 'user', 'daily', 'analytics', 'flex', 'tasks', 'transactions', 'verify', 'wallet']:
                if f'/{route_type}/' in route['path']:
                    if route_type not in routes_by_type:
                        routes_by_type[route_type] = 0
                    routes_by_type[route_type] += 1
                    break

        logger.info("📈 Маршрути по типах:")
        for route_type, count in routes_by_type.items():
            logger.info(f"   {route_type}: {count} маршрутів")

    except Exception as e:
        logger.error(f"Помилка аналізу маршрутів: {e}")

    # === КРИТИЧНІ ПЕРЕВІРКИ ===

    # Перевірка 1: Чи є взагалі маршрути системи завдань
    if quests_routes_count == 0:
        logger.error("💥 КРИТИЧНА ПОМИЛКА: НІ ОДНОГО МАРШРУТУ СИСТЕМИ ЗАВДАНЬ НЕ ЗАРЕЄСТРОВАНО!")
        return False

    # Перевірка 2: Чи хоча б половина груп зареєстрована
    if success_count < (total_routes / 2):
        logger.error(f"💥 КРИТИЧНА ПОМИЛКА: Занадто мало груп маршрутів зареєстровано ({success_count}/{total_routes})")
        return False

    # Перевірка 3: Чи є критичні системи
    critical_systems = ['auth', 'user', 'daily']
    missing_critical = []

    for system in critical_systems:
        if system not in routes_by_type or routes_by_type[system] == 0:
            missing_critical.append(system)

    if missing_critical:
        logger.error(f"⚠️ ПОПЕРЕДЖЕННЯ: Відсутні критичні системи: {', '.join(missing_critical)}")

    # === ФІНАЛЬНИЙ РЕЗУЛЬТАТ ===

    if success_count >= (total_routes * 0.7):  # 70% успішність
        logger.info("🎉 Реєстрація маршрутів системи завдань завершена УСПІШНО!")
        return True
    elif success_count >= (total_routes * 0.5):  # 50% успішність
        logger.warning("⚠️ Реєстрація маршрутів завершена з попередженнями")
        return True
    else:
        logger.error("❌ Реєстрація маршрутів завершена з КРИТИЧНИМИ помилками")
        return False


def diagnose_quests_routes(app: Flask) -> dict:
    """
    Діагностика стану маршрутів системи завдань

    Args:
        app: Flask додаток

    Returns:
        dict: Результати діагностики
    """
    logger.info("🔍 === ДІАГНОСТИКА МАРШРУТІВ СИСТЕМИ ЗАВДАНЬ ===")

    diagnosis = {
        'total_routes': 0,
        'quests_routes': 0,
        'routes_by_type': {},
        'blueprint_conflicts': [],
        'missing_endpoints': [],
        'duplicate_endpoints': [],
        'recommendations': []
    }

    try:
        # Аналізуємо всі маршрути
        all_routes = list(app.url_map.iter_rules())
        diagnosis['total_routes'] = len(all_routes)

        # Групуємо маршрути системи завдань
        quests_routes = []
        endpoint_counts = {}

        for rule in all_routes:
            rule_str = str(rule.rule)

            # Перевіряємо endpoint'и на дублікати
            if rule.endpoint:
                endpoint_counts[rule.endpoint] = endpoint_counts.get(rule.endpoint, 0) + 1

            # Фільтруємо маршрути системи завдань
            if '/api/' in rule_str and any(prefix in rule_str for prefix in [
                '/auth/', '/user/', '/daily/', '/analytics/', '/flex/',
                '/tasks/', '/transactions/', '/verify/', '/wallet/'
            ]):
                quests_routes.append(rule)
                diagnosis['quests_routes'] += 1

                # Групуємо по типах
                for route_type in ['auth', 'user', 'daily', 'analytics', 'flex', 'tasks', 'transactions', 'verify', 'wallet']:
                    if f'/{route_type}/' in rule_str:
                        if route_type not in diagnosis['routes_by_type']:
                            diagnosis['routes_by_type'][route_type] = []
                        diagnosis['routes_by_type'][route_type].append({
                            'path': rule_str,
                            'methods': list(rule.methods - {'HEAD', 'OPTIONS'}),
                            'endpoint': rule.endpoint
                        })
                        break

        # Знаходимо дублікати endpoint'ів
        for endpoint, count in endpoint_counts.items():
            if count > 1 and endpoint:
                diagnosis['duplicate_endpoints'].append({
                    'endpoint': endpoint,
                    'count': count
                })

        # Перевіряємо Blueprint конфлікти
        blueprints = set()
        for blueprint_name, blueprint in app.blueprints.items():
            if blueprint_name in blueprints:
                diagnosis['blueprint_conflicts'].append(blueprint_name)
            blueprints.add(blueprint_name)

        # Перевіряємо обов'язкові endpoint'и
        required_endpoints = [
            '/api/auth/telegram'
            '/api/user/profile/<telegram_id>',
            '/api/daily/status/<telegram_id>',
        ]

        existing_paths = [str(rule.rule) for rule in all_routes]
        for required in required_endpoints:
            # Перевіряємо чи є схожий маршрут (без урахування параметрів)
            base_path = required.replace('<telegram_id>', '').replace('<user_id>', '')
            if not any(base_path.replace('<', '').replace('>', '') in path for path in existing_paths):
                diagnosis['missing_endpoints'].append(required)

        # Генеруємо рекомендації
        if diagnosis['duplicate_endpoints']:
            diagnosis['recommendations'].append("🔴 Виправити дублікати endpoint'ів")

        if diagnosis['blueprint_conflicts']:
            diagnosis['recommendations'].append("🔴 Вирішити конфлікти Blueprint'ів")

        if diagnosis['missing_endpoints']:
            diagnosis['recommendations'].append("⚠️ Додати відсутні критичні endpoint'и")

        if diagnosis['quests_routes'] == 0:
            diagnosis['recommendations'].append("💥 КРИТИЧНО: Зареєструвати маршрути системи завдань")
        elif diagnosis['quests_routes'] < 20:
            diagnosis['recommendations'].append("⚠️ Перевірити чому мало маршрутів зареєстровано")

        # Логуємо результати
        logger.info(f"📊 Знайдено {diagnosis['quests_routes']} маршрутів системи завдань з {diagnosis['total_routes']} загальних")
        logger.info(f"📈 Маршрути по типах: {len(diagnosis['routes_by_type'])} типів")

        if diagnosis['duplicate_endpoints']:
            logger.warning(f"⚠️ Знайдено {len(diagnosis['duplicate_endpoints'])} дублікатів endpoint'ів")

        if diagnosis['blueprint_conflicts']:
            logger.error(f"🔴 Знайдено {len(diagnosis['blueprint_conflicts'])} конфліктів Blueprint'ів")

        if diagnosis['missing_endpoints']:
            logger.warning(f"⚠️ Відсутні {len(diagnosis['missing_endpoints'])} критичних endpoint'ів")

    except Exception as e:
        logger.error(f"Помилка діагностики: {e}")
        diagnosis['error'] = str(e)

    return diagnosis


# Експорт основної функції
__all__ = ['register_quests_routes', 'diagnose_quests_routes']