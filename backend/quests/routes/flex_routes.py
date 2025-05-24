"""
Маршрути для управління FLEX токенами та винагородами
API endpoints для перевірки балансів, отримання винагород та управління рівнями
"""

import logging
from flask import Blueprint

# Налаштування логування
logger = logging.getLogger(__name__)

# Імпорт контролерів
try:
    from quests.controllers.flex_controller import (
        get_flex_balance,
        check_flex_levels,
        claim_flex_reward,
        get_flex_history,
        get_user_flex_status,
        get_flex_statistics,
        get_flex_levels_config,
        get_flex_health
    )
except ImportError:
    try:
        from backend.quests.controllers.flex_controller import (
            get_flex_balance,
            check_flex_levels,
            claim_flex_reward,
            get_flex_history,
            get_user_flex_status,
            get_flex_statistics,
            get_flex_levels_config,
            get_flex_health
        )
    except ImportError:
        logger.error("Не вдалося імпортувати контролери FLEX")


        # Створюємо заглушки для контролерів
        def get_flex_balance(telegram_id):
            return {"status": "error", "message": "Контролер недоступний"}, 503


        def check_flex_levels(telegram_id):
            return {"status": "error", "message": "Контролер недоступний"}, 503


        def claim_flex_reward(telegram_id):
            return {"status": "error", "message": "Контролер недоступний"}, 503


        def get_flex_history(telegram_id):
            return {"status": "error", "message": "Контролер недоступний"}, 503


        def get_user_flex_status(telegram_id):
            return {"status": "error", "message": "Контролер недоступний"}, 503


        def get_flex_statistics():
            return {"status": "error", "message": "Контролер недоступний"}, 503


        def get_flex_levels_config():
            return {"status": "error", "message": "Контролер недоступний"}, 503


        def get_flex_health():
            return {"status": "error", "message": "Контролер недоступний"}, 503

# Створення Blueprint для маршрутів FLEX
flex_bp = Blueprint('flex', __name__)


@flex_bp.route('/balance/<telegram_id>', methods=['GET'])
def route_get_flex_balance(telegram_id: str):
    """
    Отримання балансу FLEX токенів користувача

    Args:
        telegram_id: ID користувача в Telegram

    Query Parameters:
        wallet_address: string - адреса гаманця (опціонально)
        force_refresh: bool - примусове оновлення

    Returns:
        JSON з балансом FLEX токенів

    Example:
        GET /api/flex/balance/123456789?force_refresh=true

        Response:
        {
            "status": "success",
            "data": {
                "telegram_id": "123456789",
                "flex_balance": 75000,
                "formatted_balance": "75,000",
                "wallet_address": "UQD...",
                "last_updated": "2025-01-20T12:00:00Z",
                "force_refresh": true
            }
        }
    """
    logger.info(f"API запит: отримання балансу FLEX для {telegram_id}")
    return get_flex_balance(telegram_id)


@flex_bp.route('/levels/<telegram_id>', methods=['GET'])
def route_check_flex_levels(telegram_id: str):
    """
    Перевірка доступних рівнів FLEX для користувача

    Args:
        telegram_id: ID користувача в Telegram

    Query Parameters:
        flex_balance: int - баланс FLEX (якщо не вказано - отримується автоматично)

    Returns:
        JSON з доступними рівнями та їх статусами

    Example:
        GET /api/flex/levels/123456789?flex_balance=75000

        Response:
        {
            "status": "success",
            "data": {
                "telegram_id": "123456789",
                "current_flex_balance": 75000,
                "levels": {
                    "bronze": {
                        "config": {
                            "required_flex": 10000,
                            "winix_reward": 25,
                            "tickets_reward": 1,
                            "name": "Bronze"
                        },
                        "status": {
                            "has_enough_flex": true,
                            "claimed_today": false,
                            "can_claim": true,
                            "progress_percent": 100
                        }
                    }
                },
                "summary": {
                    "total_levels": 5,
                    "available_levels": 3,
                    "claimable_levels": 2,
                    "claimed_today": 1,
                    "potential_rewards": {
                        "winix": 200,
                        "tickets": 6
                    }
                }
            }
        }
    """
    logger.info(f"API запит: перевірка рівнів FLEX для {telegram_id}")
    return check_flex_levels(telegram_id)


@flex_bp.route('/claim/<telegram_id>', methods=['POST'])
def route_claim_flex_reward(telegram_id: str):
    """
    Отримання винагороди за рівень FLEX

    Args:
        telegram_id: ID користувача в Telegram

    Request Body:
        {
            "level": "bronze"  // bronze, silver, gold, platinum, diamond
        }

    Returns:
        JSON з результатом отримання винагороди

    Example:
        POST /api/flex/claim/123456789
        {
            "level": "gold"
        }

        Response:
        {
            "status": "success",
            "message": "Винагорода Gold успішно отримана!",
            "data": {
                "level": "gold",
                "winix": 150,
                "tickets": 4,
                "name": "Gold",
                "icon": "🥇",
                "telegram_id": "123456789",
                "claimed_at": "2025-01-20T12:00:00Z"
            }
        }
    """
    logger.info(f"API запит: отримання винагороди FLEX для {telegram_id}")
    return claim_flex_reward(telegram_id)


@flex_bp.route('/history/<telegram_id>', methods=['GET'])
def route_get_flex_history(telegram_id: str):
    """
    Отримання історії FLEX винагород користувача

    Args:
        telegram_id: ID користувача в Telegram

    Query Parameters:
        limit: int - кількість записів (макс. 100, за замовчуванням 50)
        offset: int - зсув для пагінації (за замовчуванням 0)

    Returns:
        JSON з історією винагород

    Example:
        GET /api/flex/history/123456789?limit=20&offset=0

        Response:
        {
            "status": "success",
            "data": {
                "telegram_id": "123456789",
                "history": [
                    {
                        "id": 456,
                        "level": "gold",
                        "level_name": "Gold",
                        "level_icon": "🥇",
                        "flex_balance_at_claim": 150000,
                        "winix_awarded": 150,
                        "tickets_awarded": 4,
                        "claimed_at": "2025-01-20T10:00:00Z",
                        "days_ago": 0
                    }
                ],
                "pagination": {
                    "limit": 20,
                    "offset": 0,
                    "total": 45,
                    "has_more": true
                },
                "statistics": {
                    "total_claims": 45,
                    "total_rewards": {
                        "winix": 3250,
                        "tickets": 87
                    },
                    "level_breakdown": {
                        "bronze": {"count": 20, "total_winix": 500},
                        "silver": {"count": 15, "total_winix": 1125}
                    }
                }
            }
        }
    """
    logger.info(f"API запит: отримання історії FLEX для {telegram_id}")
    return get_flex_history(telegram_id)


@flex_bp.route('/status/<telegram_id>', methods=['GET'])
def route_get_user_flex_status(telegram_id: str):
    """
    Отримання повного статусу користувача по FLEX системі

    Args:
        telegram_id: ID користувача в Telegram

    Returns:
        JSON з повним статусом користувача

    Example:
        GET /api/flex/status/123456789

        Response:
        {
            "status": "success",
            "data": {
                "telegram_id": "123456789",
                "current_flex_balance": 75000,
                "formatted_balance": "75,000",
                "available_levels": ["bronze", "silver"],
                "claimed_today": {
                    "bronze": true,
                    "silver": false,
                    "gold": false
                },
                "last_claim_times": {
                    "bronze": "2025-01-20T08:00:00Z",
                    "silver": null
                },
                "total_claimed": {
                    "winix": 1250,
                    "tickets": 35
                },
                "recommendations": [
                    {
                        "type": "claim_rewards",
                        "message": "Доступно 1 винагород для отримання",
                        "priority": "high"
                    }
                ],
                "last_updated": "2025-01-20T12:00:00Z"
            }
        }
    """
    logger.info(f"API запит: отримання статусу FLEX для {telegram_id}")
    return get_user_flex_status(telegram_id)


@flex_bp.route('/statistics', methods=['GET'])
def route_get_flex_statistics():
    """
    Отримання загальної статистики FLEX системи (публічна)

    Returns:
        JSON зі статистикою

    Example:
        GET /api/flex/statistics

        Response:
        {
            "status": "success",
            "data": {
                "total_claims": 5420,
                "unique_users": 1250,
                "claims_this_week": 890,
                "level_distribution": {
                    "bronze": 2100,
                    "silver": 1850,
                    "gold": 1020,
                    "platinum": 350,
                    "diamond": 100
                },
                "total_rewards": {
                    "winix": 486750,
                    "tickets": 12840
                },
                "average_claims_per_user": 4.34,
                "levels_config": {
                    "bronze": {
                        "required_flex": 10000,
                        "winix_reward": 25,
                        "tickets_reward": 1
                    }
                },
                "metadata": {
                    "generated_at": "2025-01-20T12:00:00Z",
                    "system_version": "1.0.0",
                    "currency": "FLEX/WINIX/TICKETS"
                }
            }
        }
    """
    logger.info("API запит: отримання статистики FLEX")
    return get_flex_statistics()


@flex_bp.route('/config', methods=['GET'])
def route_get_flex_levels_config():
    """
    Отримання конфігурації рівнів FLEX (публічна)

    Returns:
        JSON з конфігурацією рівнів

    Example:
        GET /api/flex/config

        Response:
        {
            "status": "success",
            "data": {
                "levels": {
                    "bronze": {
                        "level": "bronze",
                        "required_flex": 10000,
                        "winix_reward": 25,
                        "tickets_reward": 1,
                        "name": "Bronze",
                        "description": "Базовий рівень для початківців",
                        "icon": "🥉",
                        "color": "#CD7F32",
                        "formatted_requirement": "10,000 FLEX",
                        "formatted_rewards": "25 WINIX + 1 TICKETS"
                    }
                },
                "metadata": {
                    "total_levels": 5,
                    "min_flex_required": 10000,
                    "max_flex_required": 500000,
                    "total_max_daily_winix": 1050,
                    "total_max_daily_tickets": 30,
                    "claim_cooldown_hours": 24,
                    "last_updated": "2025-01-20T12:00:00Z"
                }
            }
        }
    """
    logger.info("API запит: отримання конфігурації рівнів FLEX")
    return get_flex_levels_config()


@flex_bp.route('/health', methods=['GET'])
def route_get_flex_health():
    """
    Перевірка здоров'я FLEX сервісу

    Returns:
        JSON зі статусом здоров'я

    Example:
        GET /api/flex/health

        Response:
        {
            "status": "healthy",
            "timestamp": "2025-01-20T12:00:00Z",
            "services": {
                "flex_model": {
                    "status": "healthy",
                    "total_claims": 5420
                },
                "ton_connect": {
                    "status": "healthy",
                    "network": "mainnet",
                    "api_configured": true
                },
                "database": {
                    "status": "healthy",
                    "connection": "active"
                }
            },
            "version": "1.0.0"
        }
    """
    logger.info("API запит: перевірка здоров'я FLEX сервісу")
    return get_flex_health()


# Додаткові utility маршрути

@flex_bp.route('/cache/clear/<telegram_id>', methods=['POST'])
def route_clear_flex_cache(telegram_id: str):
    try:
        # Визначаємо функцію заздалегідь
        cache_function = None

        try:
            from supabase_client import invalidate_cache_for_entity
            cache_function = invalidate_cache_for_entity
        except ImportError:
            cache_function = None

        # Використовуємо
        if cache_function is not None:
            try:
                cache_function(telegram_id)
                message = f"Кеш FLEX очищено для користувача {telegram_id}"
            except Exception as e:
                message = f"Помилка очищення кешу: {str(e)}"
        else:
            message = "Функція очищення кешу недоступна"

        logger.info(f"Очищення кешу FLEX для {telegram_id}")

        from datetime import datetime, timezone

        return {
            "status": "success",
            "message": message,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }, 200

    except Exception as e:
        logger.error(f"Помилка очищення кешу FLEX: {str(e)}")
        return {
            "status": "error",
            "message": "Помилка очищення кешу",
            "error": str(e)
        }, 500


@flex_bp.route('/simulate/<telegram_id>', methods=['POST'])
def route_simulate_flex_claim(telegram_id: str):
    """
    Симуляція отримання винагороди FLEX (для тестування)

    Args:
        telegram_id: ID користувача в Telegram

    Request Body:
        {
            "level": "bronze",
            "flex_balance": 50000
        }

    Returns:
        JSON з результатом симуляції

    Example:
        POST /api/flex/simulate/123456789
        {
            "level": "silver",
            "flex_balance": 75000
        }

        Response:
        {
            "status": "success",
            "data": {
                "can_claim": true,
                "requirements_met": true,
                "potential_rewards": {
                    "winix": 75,
                    "tickets": 2
                },
                "next_claim_available": null,
                "simulation": true
            }
        }
    """
    try:
        from flask import request
        from datetime import datetime, timezone

        # Отримуємо дані запиту
        try:
            data = request.get_json() or {}
        except Exception:
            return {
                "status": "error",
                "message": "Невалідний JSON",
                "error_code": "INVALID_JSON"
            }, 400

        level_str = data.get('level', '').lower()
        flex_balance = data.get('flex_balance')

        if not level_str:
            return {
                "status": "error",
                "message": "Рівень не вказано",
                "error_code": "MISSING_LEVEL"
            }, 400

        # ✅ ВИПРАВЛЕНО: Спочатку намагаємося імпортувати
        flex_rewards_model = None
        FlexLevel = None
        try:
            from quests.models.flex_rewards import flex_rewards_model, FlexLevel
        except ImportError:
            pass

        if not flex_rewards_model or not FlexLevel:
            return {
                "status": "error",
                "message": "FLEX сервіс недоступний",
                "error_code": "SERVICE_UNAVAILABLE"
            }, 503

        # Тепер безпечно валідуємо рівень
        try:
            level = FlexLevel(level_str)
        except ValueError:
            valid_levels = [level.value for level in FlexLevel]
            return {
                "status": "error",
                "message": f"Невалідний рівень. Доступні: {', '.join(valid_levels)}",
                "error_code": "INVALID_LEVEL"
            }, 400

        # Отримуємо конфігурацію рівня
        config = flex_rewards_model.FLEX_LEVELS_CONFIG.get(level)
        if not config:
            return {
                "status": "error",
                "message": "Конфігурація рівня не знайдена",
                "error_code": "CONFIG_NOT_FOUND"
            }, 404

        # Використовуємо переданий баланс або отримуємо поточний
        if flex_balance is None:
            flex_balance = flex_rewards_model.get_user_flex_balance(telegram_id)
        else:
            try:
                flex_balance = int(flex_balance)
            except (ValueError, TypeError):
                return {
                    "status": "error",
                    "message": "Невалідний баланс FLEX",
                    "error_code": "INVALID_FLEX_BALANCE"
                }, 400

        # Перевіряємо вимоги
        requirements_met = flex_balance >= config.required_flex

        # Перевіряємо чи отримував сьогодні (для реального статусу)
        today_claims = flex_rewards_model._get_today_claims(telegram_id)
        claimed_today = level in today_claims

        can_claim = requirements_met and not claimed_today

        # Визначаємо час наступного отримання
        next_claim_available = None
        if claimed_today:
            next_claim_time = flex_rewards_model._get_next_claim_time(telegram_id, level)
            if next_claim_time:
                next_claim_available = next_claim_time.isoformat()

        logger.info(f"Симуляція FLEX для {telegram_id}: рівень={level_str}, "
                    f"баланс={flex_balance:,}, can_claim={can_claim}")

        return {
            "status": "success",
            "data": {
                "level": level_str,
                "flex_balance": flex_balance,
                "required_flex": config.required_flex,
                "requirements_met": requirements_met,
                "claimed_today": claimed_today,
                "can_claim": can_claim,
                "potential_rewards": {
                    "winix": config.winix_reward,
                    "tickets": config.tickets_reward
                },
                "progress_percent": min((flex_balance / config.required_flex) * 100, 100),
                "next_claim_available": next_claim_available,
                "simulation": True,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
        }, 200

    except Exception as e:
        logger.error(f"Помилка симуляції FLEX: {str(e)}")
        return {
            "status": "error",
            "message": "Помилка симуляції",
            "error": str(e)
        }, 500


# Функція для реєстрації маршрутів
def register_flex_routes(app):
    """
    Реєстрація маршрутів FLEX в Flask додатку

    Args:
        app: Flask додаток
    """
    try:
        # Реєструємо Blueprint з префіксом
        app.register_blueprint(flex_bp, url_prefix='/api/flex')
        logger.info("✅ Маршрути FLEX успішно зареєстровано")

        # Логуємо зареєстровані маршрути
        registered_routes = []
        for rule in app.url_map.iter_rules():
            if rule.endpoint and rule.endpoint.startswith('flex.'):
                registered_routes.append({
                    'endpoint': rule.endpoint,
                    'methods': list(rule.methods - {'HEAD', 'OPTIONS'}),
                    'path': str(rule)
                })

        logger.info(f"📋 Зареєстровано {len(registered_routes)} маршрутів FLEX:")
        for route in registered_routes:
            logger.info(f"  {' | '.join(route['methods'])} {route['path']}")

        return True

    except Exception as e:
        logger.error(f"❌ Помилка реєстрації маршрутів FLEX: {str(e)}")
        return False


# Експорт
__all__ = [
    'flex_bp',
    'register_flex_routes',
    'route_get_flex_balance',
    'route_check_flex_levels',
    'route_claim_flex_reward',
    'route_get_flex_history',
    'route_get_user_flex_status',
    'route_get_flex_statistics',
    'route_get_flex_levels_config',
    'route_get_flex_health'
]
