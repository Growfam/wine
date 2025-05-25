"""
Маршрути для роботи з транзакціями в системі WINIX
API endpoints для отримання історії та статистики транзакцій
"""

import logging
from flask import Blueprint, request, jsonify

logger = logging.getLogger(__name__)

# Імпорт сервісів
try:
    from ..services.transaction_service import transaction_service
    from ..utils.decorators import ValidationError
    from ..utils.validators import validate_telegram_id
except ImportError:
    try:
        from backend.quests.services.transaction_service import transaction_service
        from backend.quests.utils.decorators import ValidationError
        from backend.quests.utils.validators import validate_telegram_id
    except ImportError:
        logger.error("Не вдалося імпортувати залежності")
        transaction_service = None



# Створюємо Blueprint
transaction_bp = Blueprint('winix_transaction', __name__, url_prefix='/api/transactions')


@transaction_bp.route('/user/<telegram_id>/history', methods=['GET'])
def get_user_transaction_history(telegram_id: str):
    """
    GET /api/transactions/user/:telegram_id/history
    Отримання історії транзакцій користувача
    """
    try:
        logger.info(f"=== ОТРИМАННЯ ІСТОРІЇ ТРАНЗАКЦІЙ КОРИСТУВАЧА {telegram_id} ===")

        # Валідація telegram_id
        validated_id = validate_telegram_id(telegram_id)
        if not validated_id:
            return jsonify({
                "status": "error",
                "message": "Невірний Telegram ID",
                "error_code": "INVALID_TELEGRAM_ID"
            }), 400

        # Перевіряємо доступність сервісу
        if not transaction_service:
            return jsonify({
                "status": "error",
                "message": "Сервіс транзакцій недоступний",
                "error_code": "SERVICE_UNAVAILABLE"
            }), 503

        # Отримуємо параметри запиту
        try:
            limit = min(int(request.args.get('limit', 50)), 100)  # Максимум 100
        except (ValueError, TypeError):
            limit = 50

        # Отримуємо історію транзакцій
        result = transaction_service.get_user_transaction_history(
            telegram_id=str(validated_id),
            limit=limit
        )

        if result['success']:
            logger.info(
                f"Історія транзакцій для {validated_id} успішно отримана: {result.get('total_count', 0)} записів")

            return jsonify({
                "status": "success",
                "data": result
            }), 200
        else:
            logger.error(f"Помилка отримання історії транзакцій: {result.get('error')}")

            return jsonify({
                "status": "error",
                "message": result.get('error', 'Невідома помилка'),
                "error_code": "HISTORY_FETCH_ERROR"
            }), 500

    except ValidationError as e:
        logger.error(f"Помилка валідації: {e}")
        return jsonify({
            "status": "error",
            "message": str(e),
            "error_code": "VALIDATION_ERROR"
        }), 400
    except Exception as e:
        logger.error(f"Неочікувана помилка отримання історії транзакцій: {e}", exc_info=True)
        return jsonify({
            "status": "error",
            "message": "Внутрішня помилка сервера",
            "error_code": "INTERNAL_ERROR"
        }), 500


@transaction_bp.route('/user/<telegram_id>/balance-history', methods=['GET'])
def get_user_balance_history(telegram_id: str):
    """
    GET /api/transactions/user/:telegram_id/balance-history
    Отримання історії змін балансу користувача
    """
    try:
        logger.info(f"=== ОТРИМАННЯ ІСТОРІЇ БАЛАНСУ КОРИСТУВАЧА {telegram_id} ===")

        # Валідація telegram_id
        validated_id = validate_telegram_id(telegram_id)
        if not validated_id:
            return jsonify({
                "status": "error",
                "message": "Невірний Telegram ID",
                "error_code": "INVALID_TELEGRAM_ID"
            }), 400

        # Перевіряємо доступність сервісу
        if not transaction_service or not transaction_service.model:
            return jsonify({
                "status": "error",
                "message": "Сервіс транзакцій недоступний",
                "error_code": "SERVICE_UNAVAILABLE"
            }), 503

        # Отримуємо параметри запиту
        try:
            limit = min(int(request.args.get('limit', 30)), 100)
        except (ValueError, TypeError):
            limit = 30

        # Отримуємо історію балансу
        balance_history = transaction_service.model.get_user_balance_history(
            telegram_id=str(validated_id),
            limit=limit
        )

        logger.info(f"Історія балансу для {validated_id} успішно отримана")

        return jsonify({
            "status": "success",
            "data": {
                "telegram_id": str(validated_id),
                "balance_history": balance_history,
                "limit": limit
            }
        }), 200

    except ValidationError as e:
        logger.error(f"Помилка валідації: {e}")
        return jsonify({
            "status": "error",
            "message": str(e),
            "error_code": "VALIDATION_ERROR"
        }), 400
    except Exception as e:
        logger.error(f"Неочікувана помилка отримання історії балансу: {e}", exc_info=True)
        return jsonify({
            "status": "error",
            "message": "Внутрішня помилка сервера",
            "error_code": "INTERNAL_ERROR"
        }), 500


@transaction_bp.route('/<transaction_id>', methods=['GET'])
def get_transaction_details(transaction_id: str):
    """
    GET /api/transactions/:transaction_id
    Отримання деталей конкретної транзакції
    """
    try:
        logger.info(f"=== ОТРИМАННЯ ДЕТАЛЕЙ ТРАНЗАКЦІЇ {transaction_id} ===")

        # Перевіряємо доступність сервісу
        if not transaction_service:
            return jsonify({
                "status": "error",
                "message": "Сервіс транзакцій недоступний",
                "error_code": "SERVICE_UNAVAILABLE"
            }), 503

        # Валідація transaction_id
        if not transaction_id or len(transaction_id.strip()) == 0:
            return jsonify({
                "status": "error",
                "message": "ID транзакції відсутній",
                "error_code": "MISSING_TRANSACTION_ID"
            }), 400

        # Отримуємо деталі транзакції
        result = transaction_service.get_transaction_details(transaction_id.strip())

        if result['success']:
            logger.info(f"Деталі транзакції {transaction_id} успішно отримані")

            return jsonify({
                "status": "success",
                "data": result['transaction']
            }), 200
        else:
            logger.warning(f"Транзакція {transaction_id} не знайдена")

            return jsonify({
                "status": "error",
                "message": result.get('error', 'Транзакція не знайдена'),
                "error_code": "TRANSACTION_NOT_FOUND"
            }), 404

    except Exception as e:
        logger.error(f"Неочікувана помилка отримання деталей транзакції: {e}", exc_info=True)
        return jsonify({
            "status": "error",
            "message": "Внутрішня помилка сервера",
            "error_code": "INTERNAL_ERROR"
        }), 500


@transaction_bp.route('/statistics', methods=['GET'])
def get_transaction_statistics():
    """
    GET /api/transactions/statistics
    Отримання загальної статистики транзакцій
    """
    try:
        logger.info("=== ОТРИМАННЯ СТАТИСТИКИ ТРАНЗАКЦІЙ ===")

        # Перевіряємо доступність сервісу
        if not transaction_service:
            return jsonify({
                "status": "error",
                "message": "Сервіс транзакцій недоступний",
                "error_code": "SERVICE_UNAVAILABLE"
            }), 503

        # Отримуємо статистику
        result = transaction_service.get_service_statistics()

        if result['success']:
            logger.info("Статистика транзакцій успішно отримана")

            return jsonify({
                "status": "success",
                "data": result
            }), 200
        else:
            logger.error(f"Помилка отримання статистики: {result.get('error')}")

            return jsonify({
                "status": "error",
                "message": result.get('error', 'Помилка отримання статистики'),
                "error_code": "STATISTICS_ERROR"
            }), 500

    except Exception as e:
        logger.error(f"Неочікувана помилка отримання статистики транзакцій: {e}", exc_info=True)
        return jsonify({
            "status": "error",
            "message": "Внутрішня помилка сервера",
            "error_code": "INTERNAL_ERROR"
        }), 500


@transaction_bp.route('/user/<telegram_id>/summary', methods=['GET'])
def get_user_transaction_summary(telegram_id: str):
    """
    GET /api/transactions/user/:telegram_id/summary
    Отримання короткої статистики транзакцій користувача
    """
    try:
        logger.info(f"=== ОТРИМАННЯ СТАТИСТИКИ ТРАНЗАКЦІЙ КОРИСТУВАЧА {telegram_id} ===")

        # Валідація telegram_id
        validated_id = validate_telegram_id(telegram_id)
        if not validated_id:
            return jsonify({
                "status": "error",
                "message": "Невірний Telegram ID",
                "error_code": "INVALID_TELEGRAM_ID"
            }), 400

        # Перевіряємо доступність сервісу
        if not transaction_service or not transaction_service.model:
            return jsonify({
                "status": "error",
                "message": "Сервіс транзакцій недоступний",
                "error_code": "SERVICE_UNAVAILABLE"
            }), 503

        # Отримуємо останні транзакції для статистики
        transactions = transaction_service.model.get_user_transactions(
            telegram_id=str(validated_id),
            limit=100  # Останні 100 транзакцій
        )

        # Рахуємо коротку статистику
        from ..models.transaction import TransactionStatus, TransactionType

        summary = {
            'total_transactions': len(transactions),
            'completed_transactions': 0,
            'pending_transactions': 0,
            'failed_transactions': 0,
            'total_earned': {'winix': 0, 'tickets': 0, 'flex': 0},
            'total_spent': {'winix': 0, 'tickets': 0, 'flex': 0},
            'last_transaction': None,
            'earning_types': {},
            'recent_activity': []
        }

        # Типи транзакцій що вважаються заробітком
        earning_types = {
            TransactionType.DAILY_BONUS,
            TransactionType.FLEX_REWARD,
            TransactionType.TASK_REWARD,
            TransactionType.REFERRAL_BONUS,
            TransactionType.NEWBIE_BONUS,
            TransactionType.WALLET_CONNECTION_BONUS
        }

        for transaction in transactions:
            # Статистика по статусах
            if transaction.status == TransactionStatus.COMPLETED:
                summary['completed_transactions'] += 1
            elif transaction.status == TransactionStatus.PENDING:
                summary['pending_transactions'] += 1
            elif transaction.status == TransactionStatus.FAILED:
                summary['failed_transactions'] += 1

            # Статистика по сумах (тільки завершені)
            if transaction.status == TransactionStatus.COMPLETED:
                if transaction.type in earning_types:
                    summary['total_earned']['winix'] += transaction.amount.winix
                    summary['total_earned']['tickets'] += transaction.amount.tickets
                    summary['total_earned']['flex'] += transaction.amount.flex

                    # Статистика по типах заробітку
                    type_key = transaction.type.value
                    if type_key not in summary['earning_types']:
                        summary['earning_types'][type_key] = {
                            'count': 0,
                            'amount': {'winix': 0, 'tickets': 0, 'flex': 0}
                        }

                    summary['earning_types'][type_key]['count'] += 1
                    summary['earning_types'][type_key]['amount']['winix'] += transaction.amount.winix
                    summary['earning_types'][type_key]['amount']['tickets'] += transaction.amount.tickets
                    summary['earning_types'][type_key]['amount']['flex'] += transaction.amount.flex
                else:
                    # Витрати (від'ємні суми)
                    summary['total_spent']['winix'] += abs(transaction.amount.winix)
                    summary['total_spent']['tickets'] += abs(transaction.amount.tickets)
                    summary['total_spent']['flex'] += abs(transaction.amount.flex)

        # Остання транзакція
        if transactions:
            summary['last_transaction'] = transactions[0].to_dict()

        # Недавня активність (останні 5 транзакцій)
        summary['recent_activity'] = [
            {
                'id': t.id,
                'type': t.type.value,
                'status': t.status.value,
                'amount': t.amount.to_dict(),
                'description': t.description,
                'created_at': t.created_at.isoformat() if t.created_at else None
            }
            for t in transactions[:5]
        ]

        logger.info(f"Статистика транзакцій для {validated_id}: {summary['total_transactions']} транзакцій")

        return jsonify({
            "status": "success",
            "data": {
                "telegram_id": str(validated_id),
                "summary": summary
            }
        }), 200

    except ValidationError as e:
        logger.error(f"Помилка валідації: {e}")
        return jsonify({
            "status": "error",
            "message": str(e),
            "error_code": "VALIDATION_ERROR"
        }), 400
    except Exception as e:
        logger.error(f"Неочікувана помилка отримання статистики користувача: {e}", exc_info=True)
        return jsonify({
            "status": "error",
            "message": "Внутрішня помилка сервера",
            "error_code": "INTERNAL_ERROR"
        }), 500


@transaction_bp.route('/health', methods=['GET'])
def get_transaction_service_health():
    """
    GET /api/transactions/health
    Перевірка здоров'я сервісу транзакцій
    """
    from datetime import datetime, timezone
    try:
        from datetime import datetime, timezone

        # Перевіряємо доступність компонентів
        health_status = {}
        overall_healthy = True

        # Перевірка transaction service
        if transaction_service:
            try:
                # Пробуємо отримати статистику
                stats_result = transaction_service.get_service_statistics()
                health_status['transaction_service'] = {
                    "status": "healthy" if stats_result['success'] else "degraded",
                    "version": "1.0.0"
                }
            except Exception as e:
                health_status['transaction_service'] = {
                    "status": "unhealthy",
                    "error": str(e)
                }
                overall_healthy = False
        else:
            health_status['transaction_service'] = {
                "status": "unavailable",
                "error": "Service not loaded"
            }
            overall_healthy = False

        # Перевірка transaction model
        if transaction_service and transaction_service.model:
            try:
                # Простий тест моделі
                stats = transaction_service.model.get_transaction_statistics()
                health_status['transaction_model'] = {
                    "status": "healthy",
                    "total_transactions": stats.get('total_transactions', 0)
                }
            except Exception as e:
                health_status['transaction_model'] = {
                    "status": "unhealthy",
                    "error": str(e)
                }
                overall_healthy = False
        else:
            health_status['transaction_model'] = {
                "status": "unavailable",
                "error": "Model not available"
            }
            overall_healthy = False

        # Перевірка бази даних
        try:
            from supabase_client import supabase
            if supabase:
                # Простий тест підключення до таблиці транзакцій
                supabase.table("transactions").select("id").limit(1).execute()
                health_status['database'] = {
                    "status": "healthy",
                    "connection": "active"
                }
            else:
                health_status['database'] = {
                    "status": "unavailable",
                    "error": "Supabase not initialized"
                }
                overall_healthy = False
        except Exception as e:
            health_status['database'] = {
                "status": "unhealthy",
                "error": str(e)
            }
            overall_healthy = False

        status = "healthy" if overall_healthy else "degraded"
        http_code = 200 if overall_healthy else 503

        logger.info(f"Перевірка здоров'я сервісу транзакцій: {status}")

        return jsonify({
            "status": status,
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "services": health_status,
            "version": "1.0.0"
        }), http_code

    except Exception as e:
        logger.error(f"Помилка перевірки здоров'я сервісу транзакцій: {e}")
        return jsonify({
            "status": "unhealthy",
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "error": str(e)
        }), 500

# Функції для реєстрації маршрутів
def register_transaction_routes(app):
    """Реєстрація маршрутів транзакцій в додатку Flask"""
    try:
        logger.info("Реєстрація маршрутів транзакцій")

        # Перевіряємо доступність сервісу
        if not transaction_service:
            logger.error("❌ Transaction service недоступний")
            return False

        # Реєструємо blueprint
        app.register_blueprint(transaction_bp)

        logger.info("✅ Маршрути транзакцій успішно зареєстровано")
        logger.info("📋 Зареєстровано маршрути транзакцій:")
        logger.info("   GET /api/transactions/user/<telegram_id>/history")
        logger.info("   GET /api/transactions/user/<telegram_id>/balance-history")
        logger.info("   GET /api/transactions/<transaction_id>")
        logger.info("   GET /api/transactions/statistics")
        logger.info("   GET /api/transactions/user/<telegram_id>/summary")
        logger.info("   GET /api/transactions/health")

        # КРИТИЧНО ВАЖЛИВО: повертаємо True!
        return True

    except Exception as e:
        logger.error(f"❌ Помилка реєстрації маршрутів транзакцій: {e}")
        return False


# Експорт
__all__ = [
    'transaction_bp',
    'register_transaction_routes',
    'get_user_transaction_history',
    'get_user_balance_history',
    'get_transaction_details',
    'get_transaction_statistics',
    'get_user_transaction_summary',
    'get_transaction_service_health'
]