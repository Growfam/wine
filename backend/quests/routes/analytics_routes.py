"""
Роути Analytics для системи завдань WINIX
API endpoints для аналітики та статистики
"""

import logging
import psutil
from flask import Blueprint, request, jsonify
from ..controllers.analytics_controller import AnalyticsController

logger = logging.getLogger(__name__)

# Створюємо Blueprint для аналітики
analytics_bp = Blueprint('analytics', __name__, url_prefix='/api/analytics')


# === ОСНОВНІ ENDPOINTS ===

@analytics_bp.route('/event', methods=['POST'])
def track_event():
    """
    Відстежити одну аналітичну подію

    POST /api/analytics/event
    Content-Type: application/json

    Body:
    {
        "category": "Task",           // required
        "action": "complete",         // required
        "label": "social",           // optional
        "value": 100,                // optional
        "properties": {              // optional
            "task_id": "task_123",
            "task_type": "social",
            "reward": {"winix": 100}
        },
        "session_id": "ses_123...",  // optional
        "severity": "normal"         // optional: low, normal, high, critical
    }

    Response:
    {
        "status": "success",
        "message": "Подію збережено",
        "event_id": "evt_123..."
    }
    """
    return AnalyticsController.track_event()


@analytics_bp.route('/batch', methods=['POST'])
def track_batch_events():
    """
    Відстежити пакет подій (до 50 за раз)

    POST /api/analytics/batch
    Content-Type: application/json

    Body:
    {
        "events": [
            {
                "category": "Task",
                "action": "view",
                "label": "social",
                "properties": {...}
            },
            {
                "category": "Task",
                "action": "start",
                "label": "social",
                "properties": {...}
            }
        ],
        "session_id": "ses_123..."
    }

    Response:
    {
        "status": "success",
        "message": "Збережено 2 подій",
        "events_processed": 2
    }
    """
    return AnalyticsController.track_batch_events()


@analytics_bp.route('/session', methods=['POST'])
def track_session():
    """
    Управління сесією користувача

    POST /api/analytics/session
    Content-Type: application/json

    Body:
    {
        "session_id": "ses_123...",   // required
        "action": "start",            // required: start, end, update
        "events_count": 5,            // optional для update
        "page_views": 3              // optional для update
    }

    Response:
    {
        "status": "success",
        "message": "Сесія start успішно"
    }
    """
    return AnalyticsController.track_session()


@analytics_bp.route('/user/<user_id>', methods=['GET'])
def get_user_analytics(user_id):
    """
    Отримати аналітику конкретного користувача

    GET /api/analytics/user/{user_id}
    Authorization: Bearer {token}

    Response:
    {
        "status": "success",
        "data": {
            "user_stats": {
                "user_id": "123456789",
                "total_events": 150,
                "total_sessions": 25,
                "tasks_completed": 42,
                "total_winix_earned": 2500,
                ...
            },
            "recent_events_count": 45,
            "daily_activity": {
                "2024-01-15": 12,
                "2024-01-16": 8,
                ...
            },
            "top_actions": [
                {"action": "Task.complete", "count": 15},
                {"action": "Task.view", "count": 32},
                ...
            ],
            "analysis_period": {
                "start": "2024-01-09T00:00:00Z",
                "end": "2024-01-16T00:00:00Z"
            }
        }
    }
    """
    return AnalyticsController.get_user_analytics(user_id)


@analytics_bp.route('/summary', methods=['GET'])
def get_summary_stats():
    """
    Отримати зведену статистику системи (публічну)

    GET /api/analytics/summary

    Response:
    {
        "status": "success",
        "data": {
            "total_events": 12456,
            "unique_users": 234,
            "event_types": {
                "task_complete": 1234,
                "task_view": 2345,
                ...
            },
            "hourly_distribution": {
                "0": 45,
                "1": 23,
                ...
            },
            "top_actions": {
                "Task.complete": 567,
                "Task.view": 890,
                ...
            },
            "error_rate": 2.3,
            "period": {
                "start": "2024-01-09T00:00:00Z",
                "end": "2024-01-16T00:00:00Z",
                "days": 7
            },
            "generated_at": "2024-01-16T10:30:00Z"
        }
    }
    """
    return AnalyticsController.get_summary_stats()


# === ДОПОМІЖНІ ENDPOINTS ===

@analytics_bp.route('/ping', methods=['GET'])
def ping():
    """
    Перевірка доступності сервісу аналітики

    GET /api/analytics/ping

    Response:
    {
        "status": "success",
        "service": "Analytics API",
        "timestamp": "2024-01-16T10:30:00Z"
    }
    """
    from datetime import datetime, timezone

    return jsonify({
        "status": "success",
        "service": "Analytics API",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "version": "1.0.0"
    })


@analytics_bp.route('/health', methods=['GET'])
def health_check():
    """
    Детальна перевірка здоров'я сервісу

    GET /api/analytics/health

    Response:
    {
        "status": "healthy",
        "checks": {
            "database": "connected",
            "cache": "available",
            "memory": "ok"
        },
        "timestamp": "2024-01-16T10:30:00Z"
    }
    """
    from datetime import datetime, timezone


    checks = {
        "database": "unknown",
        "cache": "unknown",
        "memory": "ok"
    }

    # Перевіряємо базу даних
    try:
        from ..models.analytics import analytics_db
        if analytics_db.supabase:
            checks["database"] = "connected"
        else:
            checks["database"] = "disconnected"
    except Exception:
        checks["database"] = "error"

    # Перевіряємо пам'ять
    try:
        memory = psutil.virtual_memory()
        if memory.percent > 90:
            checks["memory"] = "high_usage"
        elif memory.percent > 75:
            checks["memory"] = "moderate_usage"
        else:
            checks["memory"] = "ok"
    except Exception:
        checks["memory"] = "unknown"

    # Загальний статус
    overall_status = "healthy"
    if any(check in ["error", "disconnected"] for check in checks.values()):
        overall_status = "unhealthy"
    elif any(check in ["high_usage", "unknown"] for check in checks.values()):
        overall_status = "degraded"

    return jsonify({
        "status": overall_status,
        "checks": checks,
        "timestamp": datetime.now(timezone.utc).isoformat()
    })


# === ADMIN ENDPOINTS (додаткові) ===

@analytics_bp.route('/admin/stats', methods=['GET'])
def get_admin_stats():
    """
    Адміністративна статистика (розширена)
    Потрібні права адміністратора

    GET /api/analytics/admin/stats
    Authorization: Bearer {admin_token}
    """
    # TODO: Додати перевірку прав адміністратора

    try:
        from datetime import datetime, timezone, timedelta
        from ..models.analytics import analytics_db
        import asyncio

        # Отримуємо статистику за різні періоди
        now = datetime.now(timezone.utc)

        periods = {
            "today": now.replace(hour=0, minute=0, second=0, microsecond=0),
            "week": now - timedelta(days=7),
            "month": now - timedelta(days=30)
        }

        stats = {}

        for period_name, start_date in periods.items():
            period_stats = asyncio.run(analytics_db.get_summary_stats(start_date, now))
            stats[period_name] = period_stats

        return jsonify({
            "status": "success",
            "data": {
                "periods": stats,
                "generated_at": now.isoformat()
            }
        })

    except Exception as e:
        logger.error(f"Помилка отримання адміністративної статистики: {str(e)}")
        return jsonify({
            "status": "error",
            "message": "Помилка отримання статистики"
        }), 500


@analytics_bp.route('/admin/cleanup', methods=['POST'])
def cleanup_old_data():
    """
    Очищення старих аналітичних даних
    Потрібні права адміністратора

    POST /api/analytics/admin/cleanup
    Authorization: Bearer {admin_token}

    Body:
    {
        "days_to_keep": 90,  // optional, default 90
        "dry_run": false     // optional, default false
    }
    """
    # TODO: Додати перевірку прав адміністратора
    # TODO: Реалізувати логіку очищення

    return jsonify({
        "status": "error",
        "message": "Функція очищення поки не реалізована"
    }), 501


# === ОБРОБНИКИ ПОМИЛОК ===

@analytics_bp.errorhandler(400)
def bad_request(error):
    """Обробник помилок 400"""
    return jsonify({
        "status": "error",
        "message": "Невірний запит",
        "code": "bad_request"
    }), 400


@analytics_bp.errorhandler(401)
def unauthorized(error):
    """Обробник помилок 401"""
    return jsonify({
        "status": "error",
        "message": "Не авторизовано",
        "code": "unauthorized"
    }), 401


@analytics_bp.errorhandler(403)
def forbidden(error):
    """Обробник помилок 403"""
    return jsonify({
        "status": "error",
        "message": "Доступ заборонено",
        "code": "forbidden"
    }), 403


@analytics_bp.errorhandler(404)
def not_found(error):
    """Обробник помилок 404"""
    return jsonify({
        "status": "error",
        "message": "Ресурс не знайдено",
        "code": "not_found"
    }), 404


@analytics_bp.errorhandler(429)
def rate_limit_exceeded(error):
    """Обробник помилок 429"""
    return jsonify({
        "status": "error",
        "message": "Перевищено ліміт запитів",
        "code": "rate_limit_exceeded"
    }), 429


@analytics_bp.errorhandler(500)
def internal_error(error):
    """Обробник помилок 500"""
    logger.error(f"Внутрішня помилка в analytics API: {str(error)}")
    return jsonify({
        "status": "error",
        "message": "Внутрішня помилка сервера",
        "code": "internal_error"
    }), 500


# === ФУНКЦІЯ РЕЄСТРАЦІЇ ===

def register_analytics_routes(app):
    """
    Реєструє всі роути аналітики в Flask додатку

    Args:
        app: Flask application instance
    """
    try:
        # Реєструємо Blueprint
        app.register_blueprint(analytics_bp)

        logger.info("✅ Аналітичні роути успішно зареєстровано:")
        logger.info("   POST /api/analytics/event - Відстеження події")
        logger.info("   POST /api/analytics/batch - Пакетне відстеження")
        logger.info("   POST /api/analytics/session - Управління сесією")
        logger.info("   GET  /api/analytics/user/<id> - Аналітика користувача")
        logger.info("   GET  /api/analytics/summary - Зведена статистика")
        logger.info("   GET  /api/analytics/ping - Перевірка доступності")
        logger.info("   GET  /api/analytics/health - Перевірка здоров'я")

        return True

    except Exception as e:
        logger.error(f"❌ Помилка реєстрації аналітичних роутів: {str(e)}")
        return False


# === MIDDLEWARE ===

@analytics_bp.before_request
def before_request():
    """
    Middleware, що виконується перед кожним запитом до аналітики
    """
    # Логуємо API виклики до аналітики
    logger.debug(f"Analytics API call: {request.method} {request.path}")

    # Додаємо заголовки CORS для analytics endpoints
    if request.method == 'OPTIONS':
        from flask import make_response
        response = make_response()
        response.headers.add('Access-Control-Allow-Origin', '*')
        response.headers.add('Access-Control-Allow-Headers', '*')
        response.headers.add('Access-Control-Allow-Methods', '*')
        return response


@analytics_bp.after_request
def after_request(response):
    """
    Middleware, що виконується після кожного запиту до аналітики
    """
    # Додаємо заголовки безпеки
    response.headers.add('X-Content-Type-Options', 'nosniff')
    response.headers.add('X-Frame-Options', 'DENY')
    response.headers.add('X-XSS-Protection', '1; mode=block')

    # Додаємо кешування для статичних endpoint'ів
    if request.endpoint in ['analytics.ping', 'analytics.get_summary_stats']:
        response.headers.add('Cache-Control', 'public, max-age=300')  # 5 хвилин
    else:
        response.headers.add('Cache-Control', 'no-store, no-cache, must-revalidate, max-age=0')

    return response


# Експорт
__all__ = [
    'analytics_bp',
    'register_analytics_routes'
]