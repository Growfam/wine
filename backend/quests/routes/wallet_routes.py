"""
Маршрути для управління TON гаманцями користувачів
API endpoints для підключення, відключення та управління гаманцями
"""

import logging
from flask import Blueprint
from datetime import datetime, timezone

# Налаштування логування
logger = logging.getLogger(__name__)

# Імпорт контролерів
try:
    from quests.controllers.wallet_controller import (
        check_wallet_status,
        connect_wallet,
        disconnect_wallet,
        verify_wallet,
        get_wallet_balance,
        get_wallet_transactions,
        get_wallet_statistics
    )
except ImportError:
    try:
        from backend.quests.controllers.wallet_controller import (
            check_wallet_status,
            connect_wallet,
            disconnect_wallet,
            verify_wallet,
            get_wallet_balance,
            get_wallet_transactions,
            get_wallet_statistics
        )
    except ImportError:
        logger.error("Не вдалося імпортувати контролери гаманців")


        # Створюємо заглушки для контролерів
        def check_wallet_status(telegram_id):
            return {"status": "error", "message": "Контролер недоступний"}, 503


        def connect_wallet(telegram_id):
            return {"status": "error", "message": "Контролер недоступний"}, 503


        def disconnect_wallet(telegram_id):
            return {"status": "error", "message": "Контролер недоступний"}, 503


        def verify_wallet(telegram_id):
            return {"status": "error", "message": "Контролер недоступний"}, 503


        def get_wallet_balance(telegram_id):
            return {"status": "error", "message": "Контролер недоступний"}, 503


        def get_wallet_transactions(telegram_id):
            return {"status": "error", "message": "Контролер недоступний"}, 503


        def get_wallet_statistics():
            return {"status": "error", "message": "Контролер недоступний"}, 503

# Створення Blueprint для маршрутів гаманця
wallet_bp = Blueprint('wallet', __name__)


@wallet_bp.route('/status/<telegram_id>', methods=['GET'])
def route_check_wallet_status(telegram_id: str):
    """
    Перевірка статусу підключення TON гаманця

    Args:
        telegram_id: ID користувача в Telegram

    Returns:
        JSON з статусом гаманця

    Example:
        GET /api/wallet/status/123456789

        Response:
        {
            "status": "success",
            "data": {
                "connected": true,
                "address": "UQD...",
                "provider": "tonkeeper",
                "status": "connected",
                "verified": false
            }
        }
    """
    logger.info(f"API запит: перевірка статусу гаманця для {telegram_id}")
    return check_wallet_status(telegram_id)


@wallet_bp.route('/connect/<telegram_id>', methods=['POST'])
def route_connect_wallet(telegram_id: str):
    """
    Підключення TON гаманця користувача

    Args:
        telegram_id: ID користувача в Telegram

    Request Body:
        {
            "address": "UQD...",
            "chain": "-239",
            "publicKey": "...",
            "provider": "tonkeeper"
        }

    Returns:
        JSON з результатом підключення

    Example:
        POST /api/wallet/connect/123456789
        {
            "address": "UQDrjaLahLkMB5VRP0JGQZp45opPljHhZM8e3uaOUBr0LgPQ",
            "chain": "-239",
            "provider": "tonkeeper"
        }

        Response:
        {
            "status": "success",
            "message": "Гаманець успішно підключено",
            "data": {
                "wallet": {...},
                "first_connection": true,
                "bonus": {
                    "winix": 100,
                    "tickets": 5
                }
            }
        }
    """
    logger.info(f"API запит: підключення гаманця для {telegram_id}")
    return connect_wallet(telegram_id)


@wallet_bp.route('/disconnect/<telegram_id>', methods=['POST'])
def route_disconnect_wallet(telegram_id: str):
    """
    Відключення TON гаманця користувача

    Args:
        telegram_id: ID користувача в Telegram

    Returns:
        JSON з результатом відключення

    Example:
        POST /api/wallet/disconnect/123456789

        Response:
        {
            "status": "success",
            "message": "Гаманець успішно відключено"
        }
    """
    logger.info(f"API запит: відключення гаманця для {telegram_id}")
    return disconnect_wallet(telegram_id)


@wallet_bp.route('/verify/<telegram_id>', methods=['POST'])
def route_verify_wallet(telegram_id: str):
    """
    Верифікація володіння TON гаманцем

    Args:
        telegram_id: ID користувача в Telegram

    Request Body:
        {
            "signature": "...",
            "message": "...",
            "type": "ownership"
        }

    Returns:
        JSON з результатом верифікації

    Example:
        POST /api/wallet/verify/123456789
        {
            "signature": "base64_signature",
            "message": "WINIX verification message",
            "type": "ownership"
        }

        Response:
        {
            "status": "success",
            "message": "Гаманець успішно верифіковано",
            "data": {
                "wallet": {...},
                "verified_at": "2025-01-20T12:00:00Z"
            }
        }
    """
    logger.info(f"API запит: верифікація гаманця для {telegram_id}")
    return verify_wallet(telegram_id)


@wallet_bp.route('/balance/<telegram_id>', methods=['GET'])
def route_get_wallet_balance(telegram_id: str):
    """
    Отримання балансу TON та FLEX токенів

    Args:
        telegram_id: ID користувача в Telegram

    Query Parameters:
        force_refresh: bool - примусове оновлення (пропуск кешу)

    Returns:
        JSON з балансом гаманця

    Example:
        GET /api/wallet/balance/123456789?force_refresh=true

        Response:
        {
            "status": "success",
            "data": {
                "address": "UQD...",
                "ton_balance": 1.5,
                "flex_balance": 50000,
                "last_updated": "2025-01-20T12:00:00Z",
                "cached": false
            }
        }
    """
    logger.info(f"API запит: отримання балансу гаманця для {telegram_id}")
    return get_wallet_balance(telegram_id)


@wallet_bp.route('/transactions/<telegram_id>', methods=['GET'])
def route_get_wallet_transactions(telegram_id: str):
    """
    Отримання транзакцій TON гаманця

    Args:
        telegram_id: ID користувача в Telegram

    Query Parameters:
        limit: int - кількість транзакцій (макс. 100, за замовчуванням 20)
        before_lt: int - логічний час для пагінації

    Returns:
        JSON зі списком транзакцій

    Example:
        GET /api/wallet/transactions/123456789?limit=50&before_lt=123456

        Response:
        {
            "status": "success",
            "data": {
                "address": "UQD...",
                "transactions": [
                    {
                        "hash": "...",
                        "timestamp": 1642694400,
                        "type": "incoming",
                        "amount_ton": 1.0,
                        "source": "...",
                        "destination": "..."
                    }
                ],
                "count": 50,
                "has_more": true
            }
        }
    """
    logger.info(f"API запит: отримання транзакцій гаманця для {telegram_id}")
    return get_wallet_transactions(telegram_id)


@wallet_bp.route('/statistics', methods=['GET'])
def route_get_wallet_statistics():
    """
    Отримання загальної статистики гаманців (публічна)

    Returns:
        JSON зі статистикою

    Example:
        GET /api/wallet/statistics

        Response:
        {
            "status": "success",
            "data": {
                "total_connected": 1250,
                "active_week": 890,
                "providers": {
                    "tonkeeper": 650,
                    "tonhub": 300,
                    "mytonwallet": 200,
                    "other": 100
                },
                "activity_rate": 71.2,
                "network": {
                    "name": "mainnet",
                    "api_configured": true
                },
                "cache": {
                    "total_entries": 45,
                    "active_entries": 42
                }
            }
        }
    """
    logger.info("API запит: отримання статистики гаманців")
    return get_wallet_statistics()


# Додаткові utility маршрути

@wallet_bp.route('/health', methods=['GET'])
def route_wallet_health():
    from datetime import datetime, timezone

    """
    Перевірка здоров'я сервісу гаманців

    Returns:
        JSON зі статусом сервісу

    Example:
        GET /api/wallet/health

        Response:
        {
            "status": "healthy",
            "services": {
                "wallet_model": true,
                "ton_connect": true
            },
            "timestamp": "2025-01-20T12:00:00Z"
        }
    """
    try:
        # Перевіряємо доступність сервісів
        services_status = {}

        try:
            from quests.models.wallet import wallet_model
            services_status['wallet_model'] = wallet_model is not None
        except ImportError:
            services_status['wallet_model'] = False

        try:
            from quests.services.ton_connect_service import ton_connect_service
            services_status['ton_connect'] = ton_connect_service is not None
        except ImportError:
            services_status['ton_connect'] = False

        # Визначаємо загальний статус
        all_healthy = all(services_status.values())
        status = "healthy" if all_healthy else "degraded"

        from datetime import datetime, timezone

        logger.info(f"Перевірка здоров'я сервісу гаманців: {status}")

        return {
            "status": status,
            "services": services_status,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }, 200 if all_healthy else 503

    except Exception as e:
        logger.error(f"Помилка перевірки здоров'я сервісу: {str(e)}")
        return {
            "status": "unhealthy",
            "error": str(e),
            "timestamp": datetime.now(timezone.utc).isoformat()
        }, 500


@wallet_bp.route('/cache/clear', methods=['POST'])
def route_clear_wallet_cache():
    """
    Очищення кешу балансів (адміністративний)

    Request Body (optional):
        {
            "address": "UQD..."  // для очищення конкретної адреси
        }

    Returns:
        JSON з результатом

    Example:
        POST /api/wallet/cache/clear

        Response:
        {
            "status": "success",
            "message": "Кеш успішно очищено"
        }
    """
    try:
        from flask import request

        # Отримуємо дані запиту
        try:
            data = request.get_json() or {}
        except Exception:
            data = {}

        address = data.get('address')

        # Очищаємо кеш TON Connect сервісу
        try:
            from quests.services.ton_connect_service import ton_connect_service
            if ton_connect_service:
                ton_connect_service.clear_cache(address)
                message = f"Кеш очищено для адреси {address}" if address else "Кеш повністю очищено"
            else:
                message = "TON Connect сервіс недоступний"
        except ImportError:
            message = "TON Connect сервіс не знайдено"

        logger.info(f"Очищення кешу гаманців: {message}")

        return {
            "status": "success",
            "message": message,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }, 200

    except Exception as e:
        logger.error(f"Помилка очищення кешу: {str(e)}")
        return {
            "status": "error",
            "message": "Помилка очищення кешу",
            "error": str(e)
        }, 500


# Функція для реєстрації маршрутів
def register_wallet_routes(app):
    """
    Реєстрація маршрутів гаманця в Flask додатку

    Args:
        app: Flask додаток
    """
    try:
        # Реєструємо Blueprint з префіксом
        app.register_blueprint(wallet_bp, url_prefix='/api/wallet')
        logger.info("✅ Маршрути гаманців успішно зареєстровано")

        # Логуємо зареєстровані маршрути
        registered_routes = []
        for rule in app.url_map.iter_rules():
            if rule.endpoint and rule.endpoint.startswith('wallet.'):
                registered_routes.append({
                    'endpoint': rule.endpoint,
                    'methods': list(rule.methods - {'HEAD', 'OPTIONS'}),
                    'path': str(rule)
                })

        logger.info(f"📋 Зареєстровано {len(registered_routes)} маршрутів гаманців:")
        for route in registered_routes:
            logger.info(f"  {' | '.join(route['methods'])} {route['path']}")

        return True

    except Exception as e:
        logger.error(f"❌ Помилка реєстрації маршрутів гаманців: {str(e)}")
        return False


# Експорт
__all__ = [
    'wallet_bp',
    'register_wallet_routes',
    'route_check_wallet_status',
    'route_connect_wallet',
    'route_disconnect_wallet',
    'route_verify_wallet',
    'route_get_wallet_balance',
    'route_get_wallet_transactions',
    'route_get_wallet_statistics'
]