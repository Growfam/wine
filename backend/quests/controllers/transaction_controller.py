"""
Контролер транзакцій для системи завдань WINIX
Централізоване управління всіма операціями з балансами
"""

import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional, Type
from flask import request, jsonify

# Налаштування логування
logger = logging.getLogger(__name__)

# Ініціалізація всіх змінних для безпечного імпорту
transaction_service: Optional[Any] = None
TransactionError: Optional[Type[Exception]] = None
InsufficientFundsError: Optional[Type[Exception]] = None
TransactionValidationError: Optional[Type[Exception]] = None
TransactionProcessingError: Optional[Type[Exception]] = None
Transaction: Optional[Any] = None
TransactionAmount: Optional[Any] = None
TransactionType: Optional[Any] = None
TransactionStatus: Optional[Any] = None
transaction_model: Optional[Any] = None
ValidationError: Optional[Type[Exception]] = None
validate_telegram_id: Optional[Any] = None

# Імпорт сервісів та моделей
try:
    from ..services.transaction_service import (
        transaction_service, TransactionError, InsufficientFundsError,
        TransactionValidationError, TransactionProcessingError
    )
    from ..models.transaction import (
        Transaction, TransactionAmount, TransactionType,
        TransactionStatus, transaction_model
    )
    from ..utils.decorators import ValidationError
    from ..utils.validators import validate_telegram_id
except ImportError:
    transaction_service = None
    TransactionError = None
    InsufficientFundsError = None
    TransactionValidationError = None
    TransactionProcessingError = None
    Transaction = None
    TransactionAmount = None
    TransactionType = None
    TransactionStatus = None
    transaction_model = None
    ValidationError = None
    validate_telegram_id = None
    try:
        from backend.quests.services.transaction_service import (
            transaction_service, TransactionError, InsufficientFundsError,
            TransactionValidationError, TransactionProcessingError
        )
        from backend.quests.models.transaction import (
            Transaction, TransactionAmount, TransactionType,
            TransactionStatus, transaction_model
        )
        from backend.quests.utils.decorators import ValidationError
        from backend.quests.utils.validators import validate_telegram_id
    except ImportError:
        transaction_service = None
        TransactionError = None
        InsufficientFundsError = None
        TransactionValidationError = None
        TransactionProcessingError = None
        Transaction = None
        TransactionAmount = None
        TransactionType = None
        TransactionStatus = None
        transaction_model = None
        ValidationError = None
        validate_telegram_id = None
        logger.error("Не вдалося імпортувати залежності транзакцій")

# Fallback функції для випадків коли імпорти недоступні
def fallback_validate_telegram_id(telegram_id: str) -> str:
    """Fallback валідація telegram_id"""
    return str(telegram_id).strip()

# Встановлюємо fallback якщо функція не була імпортована
if validate_telegram_id is None:
    validate_telegram_id = fallback_validate_telegram_id

# Fallback класи для винятків
class FallbackTransactionError(Exception):
    """Fallback для TransactionError"""
    pass

class FallbackInsufficientFundsError(Exception):
    """Fallback для InsufficientFundsError"""
    pass

class FallbackTransactionValidationError(Exception):
    """Fallback для TransactionValidationError"""
    pass

class FallbackTransactionProcessingError(Exception):
    """Fallback для TransactionProcessingError"""
    pass

class FallbackValidationError(Exception):
    """Fallback для ValidationError"""
    pass

# Встановлюємо fallback класи якщо не були імпортовані
if TransactionError is None:
    TransactionError = FallbackTransactionError
if InsufficientFundsError is None:
    InsufficientFundsError = FallbackInsufficientFundsError
if TransactionValidationError is None:
    TransactionValidationError = FallbackTransactionValidationError
if TransactionProcessingError is None:
    TransactionProcessingError = FallbackTransactionProcessingError
if ValidationError is None:
    ValidationError = FallbackValidationError

class TransactionController:
    """Контролер для управління транзакціями"""

    @staticmethod
    def process_user_reward(telegram_id: str, reward_data: Dict[str, Any],
                            reward_type: str, source: str = "manual") -> Dict[str, Any]:
        """
        Централізована обробка будь-якої винагороди користувача

        Args:
            telegram_id: Telegram ID користувача
            reward_data: Дані винагороди (winix, tickets, flex)
            reward_type: Тип винагороди (daily, flex, task, etc.)
            source: Джерело винагороди

        Returns:
            Результат операції
        """
        try:
            logger.info(f"=== ОБРОБКА ВИНАГОРОДИ КОРИСТУВАЧА {telegram_id} ===")
            logger.info(f"Тип: {reward_type}, Дані: {reward_data}")

            # Валідація telegram_id
            validated_id = validate_telegram_id(telegram_id)
            if not validated_id:
                raise ValidationError("Невірний Telegram ID")

            # Перевіряємо доступність сервісу
            if not transaction_service:
                raise ValidationError("Сервіс транзакцій недоступний")

            # Парсимо суму винагороди
            try:
                reward_amount = TransactionAmount(
                    winix=float(reward_data.get('winix', 0)),
                    tickets=int(reward_data.get('tickets', 0)),
                    flex=int(reward_data.get('flex', 0))
                )
            except (ValueError, TypeError) as e:
                raise ValidationError(f"Невірний формат винагороди: {e}")

            if reward_amount.is_empty():
                raise ValidationError("Винагорода не може бути пустою")

            # Визначаємо тип транзакції
            transaction_type_map = {
                'daily': TransactionType.DAILY_BONUS,
                'flex': TransactionType.FLEX_REWARD,
                'task': TransactionType.TASK_REWARD,
                'referral': TransactionType.REFERRAL_BONUS,
                'newbie': TransactionType.NEWBIE_BONUS,
                'wallet': TransactionType.WALLET_CONNECTION_BONUS,
                'manual': TransactionType.ADMIN_ADJUSTMENT
            }

            transaction_type = transaction_type_map.get(
                reward_type.lower(),
                TransactionType.ADMIN_ADJUSTMENT
            )

            # Формуємо метадані
            metadata = {
                'source': source,
                'reward_type': reward_type,
                'processed_by': 'TransactionController',
                'timestamp': datetime.now(timezone.utc).isoformat()
            }

            # Додаємо специфічні метадані з reward_data
            for key, value in reward_data.items():
                if key not in ['winix', 'tickets', 'flex']:
                    metadata[key] = value

            # Обробляємо винагороду через сервіс
            result = transaction_service.process_reward(
                telegram_id=str(validated_id),
                reward_amount=reward_amount,
                transaction_type=transaction_type,
                description=f"{reward_type.title()} винагорода від {source}",
                reference_id=reward_data.get('reference_id'),
                reference_type=reward_type,
                metadata=metadata
            )

            if result['success']:
                logger.info(f"Винагорода успішно оброблена для {validated_id}: {result['operations']}")

                return {
                    "status": "success",
                    "message": "Винагорода успішно нарахована",
                    "data": {
                        "transaction_id": result['transaction_id'],
                        "amount": result['amount'],
                        "operations": result['operations'],
                        "type": reward_type,
                        "source": source,
                        "processed_at": result['processed_at']
                    }
                }
            else:
                logger.error(f"Помилка обробки винагороди: {result['error']}")

                return {
                    "status": "error",
                    "message": f"Помилка нарахування винагороди: {result['error']}",
                    "error_code": result.get('error_type', 'REWARD_PROCESSING_ERROR')
                }

        except ValidationError:
            raise
        except Exception as e:
            logger.error(f"Неочікувана помилка обробки винагороди: {e}", exc_info=True)
            raise ValidationError("Внутрішня помилка обробки винагороди")

    @staticmethod
    def process_user_spending(telegram_id: str, spend_data: Dict[str, Any],
                              spend_type: str, source: str = "purchase") -> Dict[str, Any]:
        """
        Централізована обробка витрачання коштів користувача

        Args:
            telegram_id: Telegram ID користувача
            spend_data: Дані витрат (winix, tickets, flex)
            spend_type: Тип витрат (purchase, withdrawal, penalty)
            source: Джерело витрат

        Returns:
            Результат операції
        """
        try:
            logger.info(f"=== ОБРОБКА ВИТРАТ КОРИСТУВАЧА {telegram_id} ===")
            logger.info(f"Тип: {spend_type}, Дані: {spend_data}")

            # Валідація telegram_id
            validated_id = validate_telegram_id(telegram_id)
            if not validated_id:
                raise ValidationError("Невірний Telegram ID")

            # Перевіряємо доступність сервісу
            if not transaction_service:
                raise ValidationError("Сервіс транзакцій недоступний")

            # Парсимо суму витрат
            try:
                spend_amount = TransactionAmount(
                    winix=float(spend_data.get('winix', 0)),
                    tickets=int(spend_data.get('tickets', 0)),
                    flex=int(spend_data.get('flex', 0))
                )
            except (ValueError, TypeError) as e:
                raise ValidationError(f"Невірний формат витрат: {e}")

            if spend_amount.is_empty():
                raise ValidationError("Сума витрат не може бути пустою")

            # Визначаємо тип транзакції
            transaction_type_map = {
                'purchase': TransactionType.PURCHASE,
                'withdrawal': TransactionType.WITHDRAWAL,
                'penalty': TransactionType.PENALTY
            }

            transaction_type = transaction_type_map.get(
                spend_type.lower(),
                TransactionType.PURCHASE
            )

            # Формуємо метадані
            metadata = {
                'source': source,
                'spend_type': spend_type,
                'processed_by': 'TransactionController',
                'timestamp': datetime.now(timezone.utc).isoformat()
            }

            # Додаємо специфічні метадані
            for key, value in spend_data.items():
                if key not in ['winix', 'tickets', 'flex']:
                    metadata[key] = value

            # Обробляємо витрати через сервіс
            result = transaction_service.process_spending(
                telegram_id=str(validated_id),
                spend_amount=spend_amount,
                transaction_type=transaction_type,
                description=f"{spend_type.title()} від {source}",
                reference_id=spend_data.get('reference_id'),
                reference_type=spend_type,
                metadata=metadata
            )

            if result['success']:
                logger.info(f"Витрати успішно оброблені для {validated_id}: {result['operations']}")

                return {
                    "status": "success",
                    "message": "Витрати успішно оброблені",
                    "data": {
                        "transaction_id": result['transaction_id'],
                        "amount": result['amount'],
                        "operations": result['operations'],
                        "type": spend_type,
                        "source": source,
                        "processed_at": result['processed_at']
                    }
                }
            else:
                logger.error(f"Помилка обробки витрат: {result['error']}")

                error_type = result.get('error_type', 'SPENDING_ERROR')
                status_code = 400

                if error_type == 'InsufficientFundsError':
                    status_code = 402  # Payment Required

                return {
                    "status": "error",
                    "message": f"Помилка обробки витрат: {result['error']}",
                    "error_code": error_type,
                    "http_status": status_code
                }

        except ValidationError:
            raise
        except Exception as e:
            logger.error(f"Неочікувана помилка обробки витрат: {e}", exc_info=True)
            raise ValidationError("Внутрішня помилка обробки витрат")

    @staticmethod
    def get_user_transaction_history(telegram_id: str, filters: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Отримання історії транзакцій користувача з фільтрами

        Args:
            telegram_id: Telegram ID користувача
            filters: Фільтри (limit, type, status, date_from, date_to)

        Returns:
            Історія транзакцій
        """
        try:
            logger.info(f"=== ОТРИМАННЯ ІСТОРІЇ ТРАНЗАКЦІЙ {telegram_id} ===")

            # Валідація telegram_id
            validated_id = validate_telegram_id(telegram_id)
            if not validated_id:
                raise ValidationError("Невірний Telegram ID")

            # Перевіряємо доступність сервісу
            if not transaction_service:
                raise ValidationError("Сервіс транзакцій недоступний")

            # Парсимо фільтри
            filters = filters or {}
            limit = min(int(filters.get('limit', 50)), 200)  # Максимум 200

            # Отримуємо історію
            result = transaction_service.get_user_transaction_history(
                telegram_id=str(validated_id),
                limit=limit
            )

            if result['success']:
                # Додаткова фільтрація якщо потрібно
                transactions = result['transactions']

                # Фільтр по типу
                if 'type' in filters and filters['type']:
                    transaction_type = filters['type']
                    transactions = [
                        t for t in transactions
                        if t.get('type') == transaction_type
                    ]

                # Фільтр по статусу
                if 'status' in filters and filters['status']:
                    status = filters['status']
                    transactions = [
                        t for t in transactions
                        if t.get('status') == status
                    ]

                result['transactions'] = transactions
                result['filtered_count'] = len(transactions)

                logger.info(f"Історія транзакцій для {validated_id}: {len(transactions)} записів")

                return {
                    "status": "success",
                    "data": result
                }
            else:
                logger.error(f"Помилка отримання історії: {result['error']}")

                return {
                    "status": "error",
                    "message": result['error'],
                    "error_code": "HISTORY_FETCH_ERROR"
                }

        except ValidationError:
            raise
        except Exception as e:
            logger.error(f"Неочікувана помилка отримання історії: {e}", exc_info=True)
            raise ValidationError("Внутрішня помилка отримання історії")

    @staticmethod
    def get_user_balance_summary(telegram_id: str) -> Dict[str, Any]:
        """
        Отримання зведення по балансу користувача

        Args:
            telegram_id: Telegram ID користувача

        Returns:
            Зведення балансу
        """
        try:
            logger.info(f"=== ОТРИМАННЯ ЗВЕДЕННЯ БАЛАНСУ {telegram_id} ===")

            # Валідація telegram_id
            validated_id = validate_telegram_id(telegram_id)
            if not validated_id:
                raise ValidationError("Невірний Telegram ID")

            # Перевіряємо доступність сервісу
            if not transaction_service or not transaction_service.model:
                raise ValidationError("Сервіс транзакцій недоступний")

            # Отримуємо поточний баланс з БД
            from supabase_client import get_user
            user_data = get_user(str(validated_id))
            if not user_data:
                raise ValidationError("Користувач не знайдений")

            current_balance = TransactionAmount(
                winix=float(user_data.get('balance', 0)),
                tickets=int(user_data.get('coins', 0)),
                flex=0  # FLEX рахується окремо
            )

            # Отримуємо історію балансу
            balance_history = transaction_service.model.get_user_balance_history(
                telegram_id=str(validated_id),
                limit=100
            )

            # Отримуємо статистику за період
            recent_transactions = transaction_service.model.get_user_transactions(
                telegram_id=str(validated_id),
                limit=30
            )

            # Рахуємо активність за останні дні
            from collections import defaultdict
            daily_activity = defaultdict(lambda: {'earned': TransactionAmount(), 'spent': TransactionAmount()})

            today = datetime.now(timezone.utc).date()

            for transaction in recent_transactions:
                if transaction.status == TransactionStatus.COMPLETED and transaction.created_at:
                    trans_date = transaction.created_at.date()
                    days_ago = (today - trans_date).days

                    if days_ago <= 7:  # Останні 7 днів
                        if transaction.amount.winix > 0 or transaction.amount.tickets > 0:
                            daily_activity[days_ago]['earned'] += transaction.amount
                        else:
                            # Витрати (від'ємні значення)
                            spend_amount = TransactionAmount(
                                winix=abs(transaction.amount.winix),
                                tickets=abs(transaction.amount.tickets),
                                flex=abs(transaction.amount.flex)
                            )
                            daily_activity[days_ago]['spent'] += spend_amount

            # Формуємо зведення
            summary = {
                'telegram_id': str(validated_id),
                'current_balance': current_balance.to_dict(),
                'balance_history': balance_history,
                'recent_activity': {
                    str(days_ago): {
                        'earned': activity['earned'].to_dict(),
                        'spent': activity['spent'].to_dict()
                    }
                    for days_ago, activity in daily_activity.items()
                },
                'statistics': {
                    'total_transactions': len(recent_transactions),
                    'last_transaction_date': recent_transactions[
                        0].created_at.isoformat() if recent_transactions else None
                },
                'last_updated': datetime.now(timezone.utc).isoformat()
            }

            logger.info(f"Зведення балансу для {validated_id} успішно сформовано")

            return {
                "status": "success",
                "data": summary
            }

        except ValidationError:
            raise
        except Exception as e:
            logger.error(f"Неочікувана помилка отримання зведення балансу: {e}", exc_info=True)
            raise ValidationError("Внутрішня помилка отримання зведення")

    @staticmethod
    def get_transaction_statistics() -> Dict[str, Any]:
        """
        Отримання загальної статистики транзакцій

        Returns:
            Статистика системи
        """
        try:
            logger.info("=== ОТРИМАННЯ СТАТИСТИКИ ТРАНЗАКЦІЙ ===")

            # Перевіряємо доступність сервісу
            if not transaction_service:
                raise ValidationError("Сервіс транзакцій недоступний")

            result = transaction_service.get_service_statistics()

            if result['success']:
                logger.info("Статистика транзакцій успішно отримана")

                return {
                    "status": "success",
                    "data": result
                }
            else:
                logger.error(f"Помилка отримання статистики: {result['error']}")

                return {
                    "status": "error",
                    "message": result['error'],
                    "error_code": "STATISTICS_ERROR"
                }

        except ValidationError:
            raise
        except Exception as e:
            logger.error(f"Неочікувана помилка отримання статистики: {e}", exc_info=True)
            raise ValidationError("Внутрішня помилка отримання статистики")


# Функції-обгортки для роутів
def process_reward_route(telegram_id: str):
    """Роут для обробки винагороди"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({
                "status": "error",
                "message": "Дані винагороди відсутні",
                "error_code": "MISSING_REWARD_DATA"
            }), 400

        reward_type = data.get('type', 'manual')
        source = data.get('source', 'api')
        reward_data = data.get('reward', {})

        return TransactionController.process_user_reward(
            telegram_id, reward_data, reward_type, source
        )

    except ValidationError as e:
        return jsonify({
            "status": "error",
            "message": str(e),
            "error_code": "VALIDATION_ERROR"
        }), 400
    except Exception as e:
        logger.error(f"Помилка в process_reward_route: {e}")
        return jsonify({
            "status": "error",
            "message": "Внутрішня помилка сервера",
            "error_code": "INTERNAL_ERROR"
        }), 500


def process_spending_route(telegram_id: str):
    """Роут для обробки витрат"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({
                "status": "error",
                "message": "Дані витрат відсутні",
                "error_code": "MISSING_SPENDING_DATA"
            }), 400

        spend_type = data.get('type', 'purchase')
        source = data.get('source', 'api')
        spend_data = data.get('amount', {})

        result = TransactionController.process_user_spending(
            telegram_id, spend_data, spend_type, source
        )

        status_code = result.get('http_status', 200 if result['status'] == 'success' else 400)
        return jsonify(result), status_code

    except ValidationError as e:
        return jsonify({
            "status": "error",
            "message": str(e),
            "error_code": "VALIDATION_ERROR"
        }), 400
    except Exception as e:
        logger.error(f"Помилка в process_spending_route: {e}")
        return jsonify({
            "status": "error",
            "message": "Внутрішня помилка сервера",
            "error_code": "INTERNAL_ERROR"
        }), 500


def get_transaction_history_route(telegram_id: str):
    """Роут для отримання історії транзакцій"""
    try:
        filters = {
            'limit': request.args.get('limit', 50),
            'type': request.args.get('type'),
            'status': request.args.get('status')
        }

        result = TransactionController.get_user_transaction_history(telegram_id, filters)
        return jsonify(result)

    except ValidationError as e:
        return jsonify({
            "status": "error",
            "message": str(e),
            "error_code": "VALIDATION_ERROR"
        }), 400
    except Exception as e:
        logger.error(f"Помилка в get_transaction_history_route: {e}")
        return jsonify({
            "status": "error",
            "message": "Внутрішня помилка сервера",
            "error_code": "INTERNAL_ERROR"
        }), 500


def get_balance_summary_route(telegram_id: str):
    """Роут для отримання зведення балансу"""
    try:
        result = TransactionController.get_user_balance_summary(telegram_id)
        return jsonify(result)

    except ValidationError as e:
        return jsonify({
            "status": "error",
            "message": str(e),
            "error_code": "VALIDATION_ERROR"
        }), 400
    except Exception as e:
        logger.error(f"Помилка в get_balance_summary_route: {e}")
        return jsonify({
            "status": "error",
            "message": "Внутрішня помилка сервера",
            "error_code": "INTERNAL_ERROR"
        }), 500


def get_statistics_route():
    """Роут для отримання статистики"""
    try:
        result = TransactionController.get_transaction_statistics()
        return jsonify(result)

    except ValidationError as e:
        return jsonify({
            "status": "error",
            "message": str(e),
            "error_code": "VALIDATION_ERROR"
        }), 400
    except Exception as e:
        logger.error(f"Помилка в get_statistics_route: {e}")
        return jsonify({
            "status": "error",
            "message": "Внутрішня помилка сервера",
            "error_code": "INTERNAL_ERROR"
        }), 500


# Експорт
__all__ = [
    'TransactionController',
    'process_reward_route',
    'process_spending_route',
    'get_transaction_history_route',
    'get_balance_summary_route',
    'get_statistics_route'
]