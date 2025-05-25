"""
Маршрути для управління завданнями в системі WINIX
API endpoints для створення, отримання та виконання завдань
"""

import logging
from flask import Blueprint

# Налаштування логування
logger = logging.getLogger(__name__)

# Імпорт контролерів
try:
    from quests.controllers.tasks_controller import (
        get_tasks_list,
        get_task_details,
        start_task,
        verify_task,
        create_task,
        get_user_task_progress,
        get_tasks_statistics,
        get_tasks_health
    )
except ImportError:
    try:
        from backend.quests.controllers.tasks_controller import (
            get_tasks_list,
            get_task_details,
            start_task,
            verify_task,
            create_task,
            get_user_task_progress,
            get_tasks_statistics,
            get_tasks_health
        )
    except ImportError:
        logger.error("Не вдалося імпортувати контролери завдань")


        # Створюємо заглушки для контролерів
        def get_tasks_list(telegram_id):
            return {"status": "error", "message": "Контролер недоступний"}, 503


        def get_task_details(task_id):
            return {"status": "error", "message": "Контролер недоступний"}, 503


        def start_task(telegram_id, task_id):
            return {"status": "error", "message": "Контролер недоступний"}, 503


        def verify_task(telegram_id, task_id):
            return {"status": "error", "message": "Контролер недоступний"}, 503


        def create_task():
            return {"status": "error", "message": "Контролер недоступний"}, 503


        def get_user_task_progress(telegram_id):
            return {"status": "error", "message": "Контролер недоступний"}, 503


        def get_tasks_statistics():
            return {"status": "error", "message": "Контролер недоступний"}, 503


        def get_tasks_health():
            return {"status": "error", "message": "Контролер недоступний"}, 503

# Створення Blueprint для маршрутів завдань
tasks_bp = Blueprint('winix_tasks', __name__)


@tasks_bp.route('/list/<telegram_id>', methods=['GET'])
def route_get_tasks_list(telegram_id: str):
    """
    Отримання списку завдань для користувача

    Args:
        telegram_id: ID користувача в Telegram

    Query Parameters:
        type: string - тип завдань (social/limited/partner/daily/all)
        include_completed: bool - включати виконані завдання

    Returns:
        JSON зі списком завдань

    Example:
        GET /api/tasks/list/123456789?type=social&include_completed=false

        Response:
        {
            "status": "success",
            "data": {
                "telegram_id": "123456789",
                "tasks": {
                    "social": [
                        {
                            "id": "task_001",
                            "type": "social",
                            "title": "Підписатися на Telegram канал",
                            "description": "Підпишіться на наш офіційний канал",
                            "platform": "telegram",
                            "action": "subscribe",
                            "url": "https://t.me/winix_channel",
                            "reward": {
                                "winix": 50,
                                "tickets": 1
                            },
                            "user_status": "available",
                            "user_progress": 0
                        }
                    ],
                    "limited": [...],
                    "partner": [...]
                },
                "summary": {
                    "total_tasks": 25,
                    "available_tasks": 20,
                    "completed_tasks": 5,
                    "potential_rewards": {
                        "winix": 1250,
                        "tickets": 35
                    }
                }
            }
        }
    """
    logger.info(f"API запит: отримання списку завдань для {telegram_id}")
    return get_tasks_list(telegram_id)


@tasks_bp.route('/details/<task_id>', methods=['GET'])
def route_get_task_details(task_id: str):
    """
    Отримання детальної інформації про завдання

    Args:
        task_id: ID завдання

    Query Parameters:
        telegram_id: string - ID користувача (для отримання персонального статусу)

    Returns:
        JSON з деталями завдання

    Example:
        GET /api/tasks/details/task_001?telegram_id=123456789

        Response:
        {
            "status": "success",
            "data": {
                "id": "task_001",
                "type": "social",
                "title": "Підписатися на Telegram канал",
                "description": "Підпишіться на наш офіційний канал для отримання новин",
                "instructions": "1. Перейдіть по посиланню\n2. Натисніть 'Підписатися'\n3. Поверніться і натисніть 'Перевірити'",
                "platform": "telegram",
                "action": "subscribe",
                "url": "https://t.me/winix_channel",
                "channel_username": "@winix_channel",
                "reward": {
                    "winix": 50,
                    "tickets": 1
                },
                "requirements": {
                    "min_level": 1
                },
                "metadata": {
                    "difficulty": "easy",
                    "estimated_time": 60,
                    "verification_type": "auto"
                },
                "is_active": true,
                "priority": 5,
                "created_at": "2025-01-20T10:00:00Z",
                "user_status": "available",
                "user_progress": 0
            }
        }
    """
    logger.info(f"API запит: отримання деталей завдання {task_id}")
    return get_task_details(task_id)


@tasks_bp.route('/start/<telegram_id>/<task_id>', methods=['POST'])
def route_start_task(telegram_id: str, task_id: str):
    """
    Початок виконання завдання користувачем

    Args:
        telegram_id: ID користувача в Telegram
        task_id: ID завдання

    Returns:
        JSON з результатом початку виконання

    Example:
        POST /api/tasks/start/123456789/task_001

        Response:
        {
            "status": "success",
            "message": "Завдання успішно розпочато",
            "data": {
                "task_id": "task_001",
                "status": "started",
                "started_at": "2025-01-20T12:00:00Z",
                "task_title": "Підписатися на Telegram канал",
                "verification_url": "https://t.me/winix_channel",
                "instructions": "Підпишіться на канал і поверніться для верифікації"
            }
        }
    """
    logger.info(f"API запит: початок виконання завдання {task_id} для {telegram_id}")
    return start_task(telegram_id, task_id)


@tasks_bp.route('/verify/<telegram_id>/<task_id>', methods=['POST'])
def route_verify_task(telegram_id: str, task_id: str):
    """
    Верифікація виконання завдання користувачем

    Args:
        telegram_id: ID користувача в Telegram
        task_id: ID завдання

    Request Body (optional):
        {
            "verification_data": {
                "screenshot_url": "...",
                "additional_info": "..."
            }
        }

    Returns:
        JSON з результатом верифікації

    Example:
        POST /api/tasks/verify/123456789/task_001
        {
            "verification_data": {
                "channel_check": "confirmed"
            }
        }

        Response (Success):
        {
            "status": "success",
            "message": "Завдання успішно виконано!",
            "data": {
                "task_id": "task_001",
                "status": "completed",
                "completed_at": "2025-01-20T12:05:00Z",
                "reward": {
                    "winix": 50,
                    "tickets": 1
                },
                "task_title": "Підписатися на Telegram канал"
            }
        }

        Response (Failed):
        {
            "status": "error",
            "message": "Підписка на канал не підтверджена",
            "error_code": "VERIFICATION_FAILED",
            "data": {
                "task_id": "task_001",
                "status": "pending",
                "retry_allowed": true,
                "retry_after": 300
            }
        }
    """
    logger.info(f"API запит: верифікація завдання {task_id} для {telegram_id}")
    return verify_task(telegram_id, task_id)


@tasks_bp.route('/create', methods=['POST'])
def route_create_task():
    """
    Створення нового завдання (адміністративна функція)

    Request Body:
        {
            "type": "social",
            "title": "Підписатися на канал",
            "description": "Опис завдання",
            "instructions": "Детальні інструкції",
            "platform": "telegram",
            "action": "subscribe",
            "url": "https://t.me/channel",
            "channel_username": "@channel",
            "reward": {
                "winix": 50,
                "tickets": 1
            },
            "requirements": {
                "min_level": 1
            },
            "metadata": {
                "difficulty": "easy",
                "estimated_time": 60,
                "verification_type": "auto"
            },
            "is_active": true,
            "priority": 5,
            "expires_at": "2025-02-20T23:59:59Z"
        }

    Returns:
        JSON з результатом створення

    Example:
        POST /api/tasks/create

        Response:
        {
            "status": "success",
            "message": "Завдання успішно створено",
            "data": {
                "id": "task_new_001",
                "type": "social",
                "title": "Підписатися на канал",
                ...
            }
        }
    """
    logger.info("API запит: створення нового завдання")
    return create_task()


@tasks_bp.route('/progress/<telegram_id>', methods=['GET'])
def route_get_user_task_progress(telegram_id: str):
    """
    Отримання прогресу виконання завдань користувачем

    Args:
        telegram_id: ID користувача в Telegram

    Returns:
        JSON з прогресом користувача

    Example:
        GET /api/tasks/progress/123456789

        Response:
        {
            "status": "success",
            "data": {
                "telegram_id": "123456789",
                "progress": {
                    "total_tasks": 50,
                    "available_tasks": 30,
                    "started_tasks": 5,
                    "pending_tasks": 2,
                    "completed_tasks": 12,
                    "claimed_tasks": 1,
                    "expired_tasks": 0,
                    "completion_rate": 26.0,
                    "total_earned": {
                        "winix": 650,
                        "tickets": 18
                    },
                    "potential_earnings": {
                        "winix": 1500,
                        "tickets": 42
                    },
                    "by_type": {
                        "social": {
                            "total": 25,
                            "completed": 8,
                            "available": 17
                        },
                        "limited": {
                            "total": 15,
                            "completed": 3,
                            "available": 10
                        },
                        "partner": {
                            "total": 10,
                            "completed": 2,
                            "available": 3
                        }
                    }
                },
                "last_updated": "2025-01-20T12:00:00Z"
            }
        }
    """
    logger.info(f"API запит: отримання прогресу завдань для {telegram_id}")
    return get_user_task_progress(telegram_id)


@tasks_bp.route('/statistics', methods=['GET'])
def route_get_tasks_statistics():
    """
    Отримання загальної статистики завдань (публічна)

    Returns:
        JSON зі статистикою

    Example:
        GET /api/tasks/statistics

        Response:
        {
            "status": "success",
            "data": {
                "total_tasks": 150,
                "active_tasks": 125,
                "type_distribution": {
                    "social": 75,
                    "limited": 30,
                    "partner": 20,
                    "daily": 25
                },
                "total_completions": 8450,
                "unique_users": 2150,
                "average_completions_per_user": 3.93,
                "metadata": {
                    "generated_at": "2025-01-20T12:00:00Z",
                    "system_version": "1.0.0",
                    "supported_types": ["social", "limited", "partner", "daily"],
                    "supported_platforms": ["telegram", "youtube", "twitter", "instagram"],
                    "supported_actions": ["subscribe", "like", "share", "follow", "join"]
                }
            }
        }
    """
    logger.info("API запит: отримання статистики завдань")
    return get_tasks_statistics()


@tasks_bp.route('/health', methods=['GET'])
def route_get_tasks_health():
    """
    Перевірка здоров'я сервісу завдань

    Returns:
        JSON зі статусом здоров'я

    Example:
        GET /api/tasks/health

        Response:
        {
            "status": "healthy",
            "timestamp": "2025-01-20T12:00:00Z",
            "services": {
                "task_model": {
                    "status": "healthy",
                    "total_tasks": 150,
                    "active_tasks": 125
                },
                "database": {
                    "status": "healthy",
                    "connection": "active"
                },
                "enums": {
                    "status": "healthy",
                    "task_types": 4,
                    "task_platforms": 8,
                    "task_actions": 9
                }
            },
            "version": "1.0.0"
        }
    """
    logger.info("API запит: перевірка здоров'я сервісу завдань")
    return get_tasks_health()


# Додаткові utility маршрути

@tasks_bp.route('/types', methods=['GET'])
def route_get_task_types():
    """
    Отримання списку підтримуваних типів завдань

    Returns:
        JSON з типами завдань

    Example:
        GET /api/tasks/types

        Response:
        {
            "status": "success",
            "data": {
                "types": [
                    {
                        "value": "social",
                        "name": "Соціальні завдання",
                        "description": "Завдання в соціальних мережах"
                    },
                    {
                        "value": "limited",
                        "name": "Лімітовані завдання",
                        "description": "Завдання з обмеженим часом"
                    },
                    {
                        "value": "partner",
                        "name": "Партнерські завдання",
                        "description": "Завдання від партнерів"
                    },
                    {
                        "value": "daily",
                        "name": "Щоденні завдання",
                        "description": "Завдання що оновлюються щодня"
                    }
                ]
            }
        }
    """
    try:
        from datetime import datetime, timezone

        # Визначаємо типи завдань
        task_types_info = [
            {
                "value": "social",
                "name": "Соціальні завдання",
                "description": "Завдання в соціальних мережах",
                "platforms": ["telegram", "youtube", "twitter", "instagram", "discord"]
            },
            {
                "value": "limited",
                "name": "Лімітовані завдання",
                "description": "Завдання з обмеженим часом виконання",
                "platforms": ["any"]
            },
            {
                "value": "partner",
                "name": "Партнерські завдання",
                "description": "Спеціальні завдання від партнерів проекту",
                "platforms": ["any"]
            },
            {
                "value": "daily",
                "name": "Щоденні завдання",
                "description": "Завдання що оновлюються кожен день",
                "platforms": ["any"]
            }
        ]

        logger.info("API запит: отримання типів завдань")

        return {
            "status": "success",
            "data": {
                "types": task_types_info,
                "total_types": len(task_types_info),
                "last_updated": datetime.now(timezone.utc).isoformat()
            }
        }, 200

    except Exception as e:
        logger.error(f"Помилка отримання типів завдань: {str(e)}")
        return {
            "status": "error",
            "message": "Помилка отримання типів завдань",
            "error": str(e)
        }, 500


@tasks_bp.route('/platforms', methods=['GET'])
def route_get_task_platforms():
    """
    Отримання списку підтримуваних платформ для соціальних завдань

    Returns:
        JSON з платформами

    Example:
        GET /api/tasks/platforms

        Response:
        {
            "status": "success",
            "data": {
                "platforms": [
                    {
                        "value": "telegram",
                        "name": "Telegram",
                        "icon": "🔵",
                        "actions": ["subscribe", "join"]
                    },
                    {
                        "value": "youtube",
                        "name": "YouTube",
                        "icon": "🔴",
                        "actions": ["subscribe", "like", "watch"]
                    }
                ]
            }
        }
    """
    try:
        from datetime import datetime, timezone

        # Визначаємо платформи
        platforms_info = [
            {
                "value": "telegram",
                "name": "Telegram",
                "icon": "🔵",
                "actions": ["subscribe", "join"],
                "verification": "auto"
            },
            {
                "value": "youtube",
                "name": "YouTube",
                "icon": "🔴",
                "actions": ["subscribe", "like", "watch"],
                "verification": "manual"
            },
            {
                "value": "twitter",
                "name": "Twitter",
                "icon": "🐦",
                "actions": ["follow", "like", "share"],
                "verification": "manual"
            },
            {
                "value": "instagram",
                "name": "Instagram",
                "icon": "📷",
                "actions": ["follow", "like"],
                "verification": "manual"
            },
            {
                "value": "discord",
                "name": "Discord",
                "icon": "💬",
                "actions": ["join"],
                "verification": "manual"
            }
        ]

        logger.info("API запит: отримання платформ завдань")

        return {
            "status": "success",
            "data": {
                "platforms": platforms_info,
                "total_platforms": len(platforms_info),
                "last_updated": datetime.now(timezone.utc).isoformat()
            }
        }, 200

    except Exception as e:
        logger.error(f"Помилка отримання платформ завдань: {str(e)}")
        return {
            "status": "error",
            "message": "Помилка отримання платформ завдань",
            "error": str(e)
        }, 500


@tasks_bp.route('/cache/clear/<telegram_id>', methods=['POST'])
def route_clear_tasks_cache(telegram_id: str):
    """
    Очищення кешу завдань для користувача (адміністративний)

    Args:
        telegram_id: ID користувача в Telegram

    Returns:
        JSON з результатом

    Example:
        POST /api/tasks/cache/clear/123456789

        Response:
        {
            "status": "success",
            "message": "Кеш завдань очищено для користувача 123456789"
        }
    """
    try:
        # Очищаємо кеш для користувача
        # Спочатку намагаємося імпортувати
        invalidate_cache_for_entity = None
        try:
            from supabase_client import invalidate_cache_for_entity
        except ImportError:
            pass

        # Тепер безпечно використовуємо
        if invalidate_cache_for_entity:
            try:
                invalidate_cache_for_entity(telegram_id)
                invalidate_cache_for_entity("all_tasks")
                message = f"Кеш завдань очищено для користувача {telegram_id}"
            except Exception as e:
                message = f"Помилка очищення кешу: {str(e)}"
        else:
            message = "Функція очищення кешу недоступна"

        logger.info(f"Очищення кешу завдань для {telegram_id}")

        from datetime import datetime, timezone

        return {
            "status": "success",
            "message": message,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }, 200

    except Exception as e:
        logger.error(f"Помилка очищення кешу завдань: {str(e)}")
        return {
            "status": "error",
            "message": "Помилка очищення кешу",
            "error": str(e)
        }, 500


# Функція для реєстрації маршрутів
def register_tasks_routes(app):
    """
    Реєстрація маршрутів завдань в Flask додатку

    Args:
        app: Flask додаток
    """
    try:
        # Реєструємо Blueprint з префіксом
        app.register_blueprint(tasks_bp, url_prefix='/api/tasks')
        logger.info("✅ Маршрути завдань успішно зареєстровано")

        # Логуємо зареєстровані маршрути
        registered_routes = []
        for rule in app.url_map.iter_rules():
            if rule.endpoint and rule.endpoint.startswith('tasks.'):
                registered_routes.append({
                    'endpoint': rule.endpoint,
                    'methods': list(rule.methods - {'HEAD', 'OPTIONS'}),
                    'path': str(rule)
                })

        logger.info(f"📋 Зареєстровано {len(registered_routes)} маршрутів завдань:")
        for route in registered_routes:
            logger.info(f"  {' | '.join(route['methods'])} {route['path']}")

        return True

    except Exception as e:
        logger.error(f"❌ Помилка реєстрації маршрутів завдань: {str(e)}")
        return False


# Експорт
__all__ = [
    'tasks_bp',
    'register_tasks_routes',
    'route_get_tasks_list',
    'route_get_task_details',
    'route_start_task',
    'route_verify_task',
    'route_create_task',
    'route_get_user_task_progress',
    'route_get_tasks_statistics',
    'route_get_tasks_health'
]