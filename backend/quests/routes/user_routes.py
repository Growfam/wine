"""
Маршрути користувачів для системи завдань WINIX
"""

import logging
from flask import Blueprint, jsonify

from ..controllers.user_controller import (
    get_profile_route,
    get_balance_route,
    update_balance_route,
    get_stats_route,
    update_settings_route,
    add_reward_route
)
from ..utils.decorators import (
    secure_endpoint,
    public_endpoint,
    validate_json,
    get_current_user,
    get_json_data
)

logger = logging.getLogger(__name__)

# Створюємо Blueprint для user маршрутів
user_bp = Blueprint('winix_user', __name__, url_prefix='/api/user')


@user_bp.route('/profile/<telegram_id>', methods=['GET'])
@secure_endpoint(max_requests=30, window_seconds=60)
def get_user_profile(telegram_id):
    """
    Отримання повного профілю користувача

    GET /api/user/profile/<telegram_id>

    Headers:
        Authorization: Bearer <token>

    Response:
    {
        "status": "success",
        "data": {
            "id": number,
            "telegram_id": number,
            "username": string,
            "first_name": string,
            "last_name": string,
            "language_code": string,
            "balance": {
                "winix": number,
                "tickets": number,
                "flex": number
            },
            "level": number,
            "experience": number,
            "level_progress": {
                "current_level": number,
                "current_exp": number,
                "exp_for_next": number,
                "progress_percent": number
            },
            "stats": object,
            "created_at": string,
            "updated_at": string,
            "last_activity": string
        }
    }
    """
    logger.info(f"=== GET /api/user/profile/{telegram_id} ===")

    try:
        result = get_profile_route(telegram_id)
        return jsonify(result), 200

    except Exception as e:
        logger.error(f"Помилка в get_user_profile: {e}", exc_info=True)
        return jsonify({
            "status": "error",
            "message": str(e),
            "code": "profile_error"
        }), 400


@user_bp.route('/balance/<telegram_id>', methods=['GET'])
@secure_endpoint(max_requests=50, window_seconds=60)
def get_user_balance(telegram_id):
    """
    Отримання балансів користувача

    GET /api/user/balance/<telegram_id>

    Headers:
        Authorization: Bearer <token>

    Response:
    {
        "status": "success",
        "balance": {
            "winix": number,
            "tickets": number,
            "flex": number
        },
        "last_updated": string
    }
    """
    logger.info(f"=== GET /api/user/balance/{telegram_id} ===")

    try:
        result = get_balance_route(telegram_id)
        return jsonify(result), 200

    except Exception as e:
        logger.error(f"Помилка в get_user_balance: {e}", exc_info=True)
        return jsonify({
            "status": "error",
            "message": str(e),
            "code": "balance_error"
        }), 400


@user_bp.route('/update-balance/<telegram_id>', methods=['POST'])
@secure_endpoint(max_requests=20, window_seconds=60)
@validate_json(required_fields=['balance'])
def update_user_balance(telegram_id):
    """
    Оновлення балансу користувача

    POST /api/user/update-balance/<telegram_id>

    Headers:
        Authorization: Bearer <token>

    Body:
    {
        "balance": {
            "winix": number,    # новий абсолютний баланс WINIX
            "tickets": number   # новий абсолютний баланс tickets
        }
    }

    Response:
    {
        "status": "success",
        "message": "Баланс успішно оновлено",
        "operations": ["WINIX: 100 -> 200", "Tickets: 5 -> 8"],
        "new_balance": {
            "winix": number,
            "tickets": number,
            "flex": number
        },
        "updated_at": string
    }
    """
    logger.info(f"=== POST /api/user/update-balance/{telegram_id} ===")

    try:
        json_data = get_json_data()
        balance_data = json_data.get('balance', {})

        if not balance_data:
            return jsonify({
                "status": "error",
                "message": "Дані балансу відсутні",
                "code": "missing_balance_data"
            }), 400

        result = update_balance_route(telegram_id, balance_data)
        return jsonify(result), 200

    except Exception as e:
        logger.error(f"Помилка в update_user_balance: {e}", exc_info=True)
        return jsonify({
            "status": "error",
            "message": str(e),
            "code": "balance_update_error"
        }), 400


@user_bp.route('/stats/<telegram_id>', methods=['GET'])
@secure_endpoint(max_requests=30, window_seconds=60)
def get_user_stats(telegram_id):
    """
    Отримання статистики користувача

    GET /api/user/stats/<telegram_id>

    Headers:
        Authorization: Bearer <token>

    Response:
    {
        "status": "success",
        "stats": {
            "level": number,
            "experience": number,
            "level_progress": object,
            "balance": object,
            "tasks_completed": number,
            "rewards_claimed": number,
            "daily_streak": number,
            "badges": object,
            "wins_count": number,
            "participations_count": number,
            "last_activity": string,
            "member_since": string
        }
    }
    """
    logger.info(f"=== GET /api/user/stats/{telegram_id} ===")

    try:
        result = get_stats_route(telegram_id)
        return jsonify(result), 200

    except Exception as e:
        logger.error(f"Помилка в get_user_stats: {e}", exc_info=True)
        return jsonify({
            "status": "error",
            "message": str(e),
            "code": "stats_error"
        }), 400


@user_bp.route('/settings/<telegram_id>', methods=['GET'])
@secure_endpoint(max_requests=20, window_seconds=60)
def get_user_settings(telegram_id):
    """
    Отримання налаштувань користувача

    GET /api/user/settings/<telegram_id>

    Headers:
        Authorization: Bearer <token>

    Response:
    {
        "status": "success",
        "settings": {
            "notifications_enabled": boolean,
            "language_preference": string,
            "username": string,
            "first_name": string,
            "last_name": string
        }
    }
    """
    logger.info(f"=== GET /api/user/settings/{telegram_id} ===")

    try:
        # Отримуємо профіль і витягуємо налаштування
        profile_result = get_profile_route(telegram_id)

        if profile_result.get('status') == 'success':
            user_data = profile_result.get('data', {})
            settings = {
                "notifications_enabled": True,  # За замовчуванням
                "language_preference": user_data.get('language_code', 'uk'),
                "username": user_data.get('username', ''),
                "first_name": user_data.get('first_name', ''),
                "last_name": user_data.get('last_name', '')
            }

            return jsonify({
                "status": "success",
                "settings": settings
            }), 200
        else:
            return jsonify({
                "status": "error",
                "message": "Помилка отримання налаштувань",
                "code": "settings_error"
            }), 400

    except Exception as e:
        logger.error(f"Помилка в get_user_settings: {e}", exc_info=True)
        return jsonify({
            "status": "error",
            "message": str(e),
            "code": "settings_error"
        }), 400


@user_bp.route('/settings/<telegram_id>', methods=['POST'])
@secure_endpoint(max_requests=10, window_seconds=60)
@validate_json()
def update_user_settings(telegram_id):
    """
    Оновлення налаштувань користувача

    POST /api/user/settings/<telegram_id>

    Headers:
        Authorization: Bearer <token>

    Body:
    {
        "notifications_enabled": boolean,
        "language_preference": string,
        "username": string,
        "first_name": string,
        "last_name": string
    }

    Response:
    {
        "status": "success",
        "message": "Налаштування успішно оновлено",
        "updated_fields": ["notifications_enabled", "username"],
        "updated_at": string
    }
    """
    logger.info(f"=== POST /api/user/settings/{telegram_id} ===")

    try:
        json_data = get_json_data()

        if not json_data:
            return jsonify({
                "status": "error",
                "message": "Дані налаштувань відсутні",
                "code": "missing_settings_data"
            }), 400

        result = update_settings_route(telegram_id, json_data)
        return jsonify(result), 200

    except Exception as e:
        logger.error(f"Помилка в update_user_settings: {e}", exc_info=True)
        return jsonify({
            "status": "error",
            "message": str(e),
            "code": "settings_update_error"
        }), 400


@user_bp.route('/add-reward/<telegram_id>', methods=['POST'])
@secure_endpoint(max_requests=5, window_seconds=60)
@validate_json(required_fields=['winix'])
def add_user_reward(telegram_id):
    """
    Додавання винагороди користувачу (адміністративна функція)

    POST /api/user/add-reward/<telegram_id>

    Headers:
        Authorization: Bearer <token>

    Body:
    {
        "winix": number,    # кількість WINIX для додавання
        "tickets": number,  # кількість tickets для додавання (опціонально)
        "source": string    # джерело винагороди (опціонально)
    }

    Response:
    {
        "status": "success",
        "message": "Винагорода успішно додана",
        "reward": {
            "winix": number,
            "tickets": number,
            "flex": number
        },
        "operations": ["WINIX +100", "Tickets +5"],
        "source": string,
        "added_at": string
    }
    """
    logger.info(f"=== POST /api/user/add-reward/{telegram_id} ===")

    try:
        json_data = get_json_data()

        # Перевіряємо чи користувач має права адміністратора
        # TODO: Реалізувати перевірку адміністраторських прав
        current_user = get_current_user()
        if not current_user:
            return jsonify({
                "status": "error",
                "message": "Авторизація обов'язкова",
                "code": "auth_required"
            }), 401

        result = add_reward_route(telegram_id, json_data)
        return jsonify(result), 200

    except Exception as e:
        logger.error(f"Помилка в add_user_reward: {e}", exc_info=True)
        return jsonify({
            "status": "error",
            "message": str(e),
            "code": "reward_error"
        }), 400


# Додаткові утилітарні маршрути
@user_bp.route('/exists/<telegram_id>', methods=['GET'])
@public_endpoint(max_requests=20, window_seconds=60)
def check_user_exists(telegram_id):
    """
    Перевірка існування користувача

    GET /api/user/exists/<telegram_id>

    Response:
    {
        "exists": boolean,
        "telegram_id": number
    }
    """
    logger.info(f"=== GET /api/user/exists/{telegram_id} ===")

    try:
        from ..utils.validators import validate_telegram_id

        # Валідація telegram_id
        validated_id = validate_telegram_id(telegram_id)
        if not validated_id:
            return jsonify({
                "exists": False,
                "telegram_id": None,
                "error": "Невірний Telegram ID"
            }), 400

        # Спочатку присвоюємо None
        get_user = None

        # Намагаємося імпортувати
        try:
            from supabase_client import get_user
        except ImportError:
            try:
                from backend.supabase_client import get_user
            except ImportError:
                pass

        # Перевіряємо чи імпорт успішний
        if get_user is None:
            return jsonify({
                "exists": False,
                "error": "Сервіс недоступний"
            }), 500

        # Тепер безпечно використовуємо
        user_data = get_user(str(validated_id))
        exists = user_data is not None

        return jsonify({
            "exists": exists,
            "telegram_id": validated_id
        }), 200

    except Exception as e:
        logger.error(f"Помилка в check_user_exists: {e}", exc_info=True)
        return jsonify({
            "exists": False,
            "error": "Помилка перевірки"
        }), 500


# Обробники помилок для Blueprint
@user_bp.errorhandler(400)
def handle_bad_request(error):
    """Обробка помилок 400"""
    return jsonify({
        "status": "error",
        "message": "Невірний запит",
        "code": "bad_request"
    }), 400


@user_bp.errorhandler(401)
def handle_unauthorized(error):
    """Обробка помилок 401"""
    return jsonify({
        "status": "error",
        "message": "Не авторизовано",
        "code": "unauthorized"
    }), 401


@user_bp.errorhandler(403)
def handle_forbidden(error):
    """Обробка помилок 403"""
    return jsonify({
        "status": "error",
        "message": "Доступ заборонено",
        "code": "forbidden"
    }), 403


@user_bp.errorhandler(404)
def handle_not_found(error):
    """Обробка помилок 404"""
    return jsonify({
        "status": "error",
        "message": "Користувач не знайдений",
        "code": "user_not_found"
    }), 404


@user_bp.errorhandler(429)
def handle_rate_limit(error):
    """Обробка помилок rate limiting"""
    return jsonify({
        "status": "error",
        "message": "Забагато запитів",
        "code": "rate_limit_exceeded"
    }), 429


@user_bp.errorhandler(500)
def handle_internal_error(error):
    """Обробка внутрішніх помилок"""
    logger.error(f"Внутрішня помилка в user routes: {error}")
    return jsonify({
        "status": "error",
        "message": "Внутрішня помилка сервера",
        "code": "internal_error"
    }), 500


def register_user_routes(app):
    """
    Реєстрація user маршрутів в додатку

    Args:
        app: Flask додаток
    """
    try:
        app.register_blueprint(user_bp)
        logger.info("✅ User маршрути зареєстровано успішно")

        # Логуємо зареєстровані маршрути
        user_routes = []
        for rule in app.url_map.iter_rules():
            if rule.rule.startswith('/api/user'):
                user_routes.append({
                    "path": rule.rule,
                    "methods": list(rule.methods - {'HEAD', 'OPTIONS'}),
                    "endpoint": rule.endpoint
                })

        logger.info(f"Зареєстровано {len(user_routes)} user маршрутів:")
        for route in user_routes:
            logger.info(f"  {route['methods']} {route['path']}")

        return True

    except Exception as e:
        logger.error(f"❌ Помилка реєстрації user маршрутів: {e}", exc_info=True)
        return False


# Експорт
__all__ = [
    'user_bp',
    'register_user_routes'
]