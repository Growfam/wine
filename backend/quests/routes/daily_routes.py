"""
Маршрути щоденних бонусів для системи завдань WINIX
"""

import logging
from flask import Blueprint, request, jsonify, g

from ..controllers.daily_controller import (
    get_daily_status_route,
    claim_daily_bonus_route,
    get_daily_history_route,
    calculate_reward_route,
    get_reward_preview_route,
    reset_streak_route
)
from ..utils.decorators import (
    secure_endpoint,
    public_endpoint,
    validate_json,
    get_current_user,
    get_json_data
)

logger = logging.getLogger(__name__)

# Створюємо Blueprint для daily маршрутів
daily_bp = Blueprint('daily', __name__, url_prefix='/api/daily')


@daily_bp.route('/status/<telegram_id>', methods=['GET'])
@secure_endpoint(max_requests=50, window_seconds=60)
def get_daily_status(telegram_id):
    """
    Отримання статусу щоденних бонусів користувача

    GET /api/daily/status/<telegram_id>

    Headers:
        Authorization: Bearer <token>

    Response:
    {
        "status": "success",
        "data": {
            "telegram_id": number,
            "current_streak": number,
            "longest_streak": number,
            "total_days_claimed": number,
            "last_claim_date": string,
            "next_available_date": string,
            "can_claim_today": boolean,
            "current_day_number": number,
            "today_reward": {
                "winix": number,
                "tickets": number,
                "flex": number
            },
            "streak_info": object,
            "statistics": object,
            "next_claim_in_hours": number,
            "month_progress": number,
            "is_special_day": boolean
        }
    }
    """
    logger.info(f"=== GET /api/daily/status/{telegram_id} ===")

    try:
        result = get_daily_status_route(telegram_id)
        return jsonify(result), 200

    except Exception as e:
        logger.error(f"Помилка в get_daily_status: {e}", exc_info=True)
        return jsonify({
            "status": "error",
            "message": str(e),
            "code": "daily_status_error"
        }), 400


@daily_bp.route('/claim/<telegram_id>', methods=['POST'])
@secure_endpoint(max_requests=10, window_seconds=60)
@validate_json()
def claim_daily_bonus(telegram_id):
    """
    Отримання щоденного бонусу

    POST /api/daily/claim/<telegram_id>

    Headers:
        Authorization: Bearer <token>

    Body:
    {
        "timestamp": number  # опціонально
    }

    Response:
    {
        "status": "success",
        "data": {
            "success": true,
            "day_number": number,
            "reward": {
                "winix": number,
                "tickets": number,
                "flex": number
            },
            "operations": ["WINIX +50", "Tickets +2"],
            "new_streak": number,
            "is_special_day": boolean,
            "streak_bonus_applied": boolean,
            "claimed_at": string,
            "next_available": string,
            "total_days_claimed": number
        }
    }
    """
    logger.info(f"=== POST /api/daily/claim/{telegram_id} ===")

    try:
        json_data = get_json_data() or {}
        timestamp = json_data.get('timestamp')

        result = claim_daily_bonus_route(telegram_id, timestamp)
        return jsonify(result), 200

    except Exception as e:
        logger.error(f"Помилка в claim_daily_bonus: {e}", exc_info=True)
        return jsonify({
            "status": "error",
            "message": str(e),
            "code": "daily_claim_error"
        }), 400


@daily_bp.route('/history/<telegram_id>', methods=['GET'])
@secure_endpoint(max_requests=20, window_seconds=60)
def get_daily_history(telegram_id):
    """
    Отримання історії щоденних бонусів

    GET /api/daily/history/<telegram_id>?limit=30

    Headers:
        Authorization: Bearer <token>

    Query params:
        limit: Максимальна кількість записів (за замовчуванням 30)

    Response:
    {
        "status": "success",
        "data": {
            "history": [
                {
                    "day_number": number,
                    "claim_date": string,
                    "reward": object,
                    "streak_at_claim": number,
                    "is_special_day": boolean
                }
            ],
            "total_entries": number,
            "statistics": object,
            "current_streak": number,
            "longest_streak": number
        }
    }
    """
    logger.info(f"=== GET /api/daily/history/{telegram_id} ===")

    try:
        limit = int(request.args.get('limit', 30))
        limit = max(1, min(limit, 100))  # Обмежуємо між 1 і 100

        result = get_daily_history_route(telegram_id, limit)
        return jsonify(result), 200

    except Exception as e:
        logger.error(f"Помилка в get_daily_history: {e}", exc_info=True)
        return jsonify({
            "status": "error",
            "message": str(e),
            "code": "daily_history_error"
        }), 400


@daily_bp.route('/calculate-reward/<telegram_id>', methods=['POST'])
@secure_endpoint(max_requests=30, window_seconds=60)
@validate_json(required_fields=['dayNumber'])
def calculate_daily_reward(telegram_id):
    """
    Розрахунок винагороди для конкретного дня

    POST /api/daily/calculate-reward/<telegram_id>

    Headers:
        Authorization: Bearer <token>

    Body:
    {
        "dayNumber": number  # номер дня (1-30)
    }

    Response:
    {
        "status": "success",
        "data": {
            "day_number": number,
            "reward": {
                "winix": number,
                "tickets": number,
                "flex": number
            },
            "is_special_day": boolean,
            "multiplier": number,
            "calculated_for_level": number,
            "assuming_perfect_streak": boolean
        }
    }
    """
    logger.info(f"=== POST /api/daily/calculate-reward/{telegram_id} ===")

    try:
        json_data = get_json_data()
        day_number = json_data.get('dayNumber')

        if not isinstance(day_number, int) or day_number < 1 or day_number > 30:
            return jsonify({
                "status": "error",
                "message": "dayNumber має бути числом між 1 і 30",
                "code": "invalid_day_number"
            }), 400

        result = calculate_reward_route(telegram_id, day_number)
        return jsonify(result), 200

    except Exception as e:
        logger.error(f"Помилка в calculate_daily_reward: {e}", exc_info=True)
        return jsonify({
            "status": "error",
            "message": str(e),
            "code": "reward_calculation_error"
        }), 400


@daily_bp.route('/preview/<telegram_id>', methods=['GET'])
@secure_endpoint(max_requests=20, window_seconds=60)
def get_reward_preview(telegram_id):
    """
    Отримання попереднього перегляду винагород на весь місяць

    GET /api/daily/preview/<telegram_id>

    Headers:
        Authorization: Bearer <token>

    Response:
    {
        "status": "success",
        "data": {
            "preview": [
                {
                    "day": number,
                    "reward": object,
                    "is_special": boolean,
                    "is_final": boolean,
                    "multiplier": number,
                    "description": string
                }
            ],
            "total_statistics": {
                "total_winix": number,
                "total_tickets": number,
                "total_value_winix_equivalent": number,
                "average_daily_winix": number
            },
            "calculated_for_level": number,
            "month_duration": 30,
            "special_days_count": number,
            "calculator_info": object
        }
    }
    """
    logger.info(f"=== GET /api/daily/preview/{telegram_id} ===")

    try:
        result = get_reward_preview_route(telegram_id)
        return jsonify(result), 200

    except Exception as e:
        logger.error(f"Помилка в get_reward_preview: {e}", exc_info=True)
        return jsonify({
            "status": "error",
            "message": str(e),
            "code": "preview_error"
        }), 400


@daily_bp.route('/reset-streak/<telegram_id>', methods=['POST'])
@secure_endpoint(max_requests=5, window_seconds=60)
@validate_json()
def reset_daily_streak(telegram_id):
    """
    Скидання серії користувача (адміністративна функція)

    POST /api/daily/reset-streak/<telegram_id>

    Headers:
        Authorization: Bearer <token>

    Body:
    {
        "reason": string  # причина скидання (опціонально)
    }

    Response:
    {
        "status": "success",
        "message": "Серія успішно скинута",
        "old_streak": number,
        "new_streak": number,
        "reason": string,
        "reset_at": string
    }
    """
    logger.info(f"=== POST /api/daily/reset-streak/{telegram_id} ===")

    try:
        # Перевіряємо права адміністратора
        # TODO: Реалізувати перевірку адміністраторських прав
        current_user = get_current_user()
        if not current_user:
            return jsonify({
                "status": "error",
                "message": "Авторизація обов'язкова",
                "code": "auth_required"
            }), 401

        json_data = get_json_data() or {}
        reason = json_data.get('reason', 'manual_admin_reset')

        result = reset_streak_route(telegram_id, reason)
        return jsonify(result), 200

    except Exception as e:
        logger.error(f"Помилка в reset_daily_streak: {e}", exc_info=True)
        return jsonify({
            "status": "error",
            "message": str(e),
            "code": "streak_reset_error"
        }), 400


# Утилітарні маршрути
@daily_bp.route('/info', methods=['GET'])
@public_endpoint(max_requests=30, window_seconds=60)
def get_daily_bonus_info():
    """
    Отримання загальної інформації про систему щоденних бонусів

    GET /api/daily/info

    Response:
    {
        "status": "success",
        "data": {
            "system_info": {
                "max_days": 30,
                "min_hours_between_claims": 20,
                "special_days": [7, 14, 21, 28],
                "base_winix_reward": 20
            },
            "calculator_stats": object,
            "available_endpoints": array
        }
    }
    """
    logger.info("=== GET /api/daily/info ===")

    try:
        from ..models.daily_bonus import get_daily_bonus_constants
        from ..services.reward_calculator import reward_calculator

        constants = get_daily_bonus_constants()
        calculator_stats = reward_calculator.get_calculator_stats()

        return jsonify({
            "status": "success",
            "data": {
                "system_info": constants,
                "calculator_stats": calculator_stats,
                "available_endpoints": [
                    "GET /api/daily/status/<telegram_id>",
                    "POST /api/daily/claim/<telegram_id>",
                    "GET /api/daily/history/<telegram_id>",
                    "POST /api/daily/calculate-reward/<telegram_id>",
                    "GET /api/daily/preview/<telegram_id>",
                    "POST /api/daily/reset-streak/<telegram_id>",
                    "GET /api/daily/info"
                ]
            }
        }), 200

    except Exception as e:
        logger.error(f"Помилка в get_daily_bonus_info: {e}")
        return jsonify({
            "status": "error",
            "message": "Помилка отримання інформації",
            "code": "info_error"
        }), 500


# Обробники помилок для Blueprint
@daily_bp.errorhandler(400)
def handle_bad_request(error):
    """Обробка помилок 400"""
    return jsonify({
        "status": "error",
        "message": "Невірний запит",
        "code": "bad_request"
    }), 400


@daily_bp.errorhandler(401)
def handle_unauthorized(error):
    """Обробка помилок 401"""
    return jsonify({
        "status": "error",
        "message": "Не авторизовано",
        "code": "unauthorized"
    }), 401


@daily_bp.errorhandler(403)
def handle_forbidden(error):
    """Обробка помилок 403"""
    return jsonify({
        "status": "error",
        "message": "Доступ заборонено",
        "code": "forbidden"
    }), 403


@daily_bp.errorhandler(404)
def handle_not_found(error):
    """Обробка помилок 404"""
    return jsonify({
        "status": "error",
        "message": "Ресурс не знайдений",
        "code": "not_found"
    }), 404


@daily_bp.errorhandler(429)
def handle_rate_limit(error):
    """Обробка помилок rate limiting"""
    return jsonify({
        "status": "error",
        "message": "Забагато запитів",
        "code": "rate_limit_exceeded"
    }), 429


@daily_bp.errorhandler(500)
def handle_internal_error(error):
    """Обробка внутрішніх помилок"""
    logger.error(f"Внутрішня помилка в daily routes: {error}")
    return jsonify({
        "status": "error",
        "message": "Внутрішня помилка сервера",
        "code": "internal_error"
    }), 500


def register_daily_routes(app):
    """
    Реєстрація daily маршрутів в додатку

    Args:
        app: Flask додаток
    """
    try:
        app.register_blueprint(daily_bp)
        logger.info("✅ Daily маршрути зареєстровано успішно")

        # Логуємо зареєстровані маршрути
        daily_routes = []
        for rule in app.url_map.iter_rules():
            if rule.rule.startswith('/api/daily'):
                daily_routes.append({
                    "path": rule.rule,
                    "methods": list(rule.methods - {'HEAD', 'OPTIONS'}),
                    "endpoint": rule.endpoint
                })

        logger.info(f"Зареєстровано {len(daily_routes)} daily маршрутів:")
        for route in daily_routes:
            logger.info(f"  {route['methods']} {route['path']}")

        return True

    except Exception as e:
        logger.error(f"❌ Помилка реєстрації daily маршрутів: {e}", exc_info=True)
        return False


# Експорт
__all__ = [
    'daily_bp',
    'register_daily_routes'
]