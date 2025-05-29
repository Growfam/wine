"""
Контролер для управління FLEX токенами та винагородами
API endpoints для перевірки балансів, отримання винагород та історії
ОНОВЛЕНО: Інтеграція з Transaction Service для атомарних операцій
"""

import logging
from typing import Dict, Any, Optional, Callable, Tuple
from flask import request, jsonify, Response
from datetime import datetime, timezone

# Налаштування логування
logger = logging.getLogger(__name__)

# Ініціалізація всіх змінних для уникнення попереджень
transaction_service: Optional[Any] = None
flex_rewards_model: Optional[Any] = None
FlexLevel: Optional[Any] = None
supabase: Optional[Any] = None
secure_endpoint: Optional[Callable] = None
public_endpoint: Optional[Callable] = None
validate_json: Optional[Callable] = None
validate_telegram_id: Optional[Callable] = None
get_current_user: Optional[Callable] = None
get_json_data: Optional[Callable] = None
validate_tg_id: Optional[Callable] = None
validate_wallet_address: Optional[Callable] = None
sanitize_string: Optional[Callable] = None
invalidate_cache_for_entity: Optional[Callable] = None

# Fallback функції та декоратори
def default_decorator(*args, **kwargs):
    """Декоратор за замовчуванням"""
    def decorator(func):
        return func
    return decorator

def fallback_get_current_user():
    """Fallback для отримання поточного користувача"""
    return None

def fallback_get_json_data():
    """Fallback для отримання JSON даних"""
    try:
        return request.get_json() if request.is_json else {}
    except Exception:
        return {}

def fallback_validate_tg_id(telegram_id: str) -> str:
    """Fallback валідація telegram_id"""
    return str(telegram_id).strip()

def fallback_validate_wallet_address(address: str) -> bool:
    """
    Fallback валідація адреси гаманця
    БЕЗ ВАЛІДАЦІЇ - довіряємо TON Connect
    """
    # Просто перевіряємо що адреса не порожня
    return bool(address and len(address.strip()) > 0)

def fallback_sanitize_string(text: str) -> str:
    """Fallback санітизація рядка"""
    return str(text).strip()

def fallback_invalidate_cache_for_entity(entity_id: str):
    """Fallback для очищення кешу"""
    pass

# Спроба імпорту Transaction Service
try:
    from ..services.transaction_service import transaction_service
except ImportError:
    transaction_service = None
    try:
        from backend.quests.services.transaction_service import transaction_service
    except ImportError:
        transaction_service = None
        logger.error("Transaction service недоступний")

# Спроба імпорту декораторів
try:
    from ..utils.decorators import (
        secure_endpoint, public_endpoint, validate_json,
        validate_telegram_id, get_current_user, get_json_data
    )
except ImportError:
    secure_endpoint = default_decorator
    public_endpoint = default_decorator
    validate_json = default_decorator
    validate_telegram_id = default_decorator
    get_current_user = fallback_get_current_user
    get_json_data = fallback_get_json_data
    try:
        from backend.quests.utils.decorators import (
            secure_endpoint, public_endpoint, validate_json,
            validate_telegram_id, get_current_user, get_json_data
        )
    except ImportError:
        secure_endpoint = default_decorator
        public_endpoint = default_decorator
        validate_json = default_decorator
        validate_telegram_id = default_decorator
        get_current_user = fallback_get_current_user
        get_json_data = fallback_get_json_data
        logger.warning("Використовуємо fallback декоратори")

# Спроба імпорту валідаторів
try:
    from ..utils.validators import (
        validate_telegram_id as validate_tg_id,
        validate_wallet_address, sanitize_string
    )
except ImportError:
    validate_tg_id = fallback_validate_tg_id
    validate_wallet_address = fallback_validate_wallet_address
    sanitize_string = fallback_sanitize_string
    try:
        from backend.quests.utils.validators import (
            validate_telegram_id as validate_tg_id,
            validate_wallet_address, sanitize_string
        )
    except ImportError:
        validate_tg_id = fallback_validate_tg_id
        validate_wallet_address = fallback_validate_wallet_address
        sanitize_string = fallback_sanitize_string
        logger.warning("Використовуємо fallback валідатори")

# Спроба імпорту моделей FLEX
try:
    from ..models.flex_rewards import flex_rewards_model, FlexLevel
except ImportError:
    flex_rewards_model = None
    FlexLevel = None
    try:
        from backend.quests.models.flex_rewards import flex_rewards_model, FlexLevel
    except ImportError:
        flex_rewards_model = None
        FlexLevel = None
        logger.error("Модель FLEX недоступна")

# Спроба імпорту supabase utilities
try:
    from supabase_client import invalidate_cache_for_entity, supabase
except ImportError:
    invalidate_cache_for_entity = fallback_invalidate_cache_for_entity
    supabase = None
    try:
        from backend.supabase_client import invalidate_cache_for_entity, supabase
    except ImportError:
        invalidate_cache_for_entity = fallback_invalidate_cache_for_entity
        supabase = None
        logger.warning("Supabase utilities недоступні")
# Спроба імпорту TON Connect service
ton_connect_service = None
try:
    from ..services.ton_connect_service import ton_connect_service
except ImportError:
    try:
        from backend.quests.services.ton_connect_service import ton_connect_service
    except ImportError:
        logger.warning("TON Connect service недоступний")
        ton_connect_service = None


class FlexController:
    """Контролер для управління FLEX токенами та винагородами з підтримкою транзакцій"""

    @staticmethod
    @public_endpoint(max_requests=30, window_seconds=60)
    @validate_telegram_id
    def get_flex_balance(telegram_id: str) -> tuple[Response, int]:
        """
        Отримання балансу FLEX токенів користувача

        Args:
            telegram_id: ID користувача в Telegram

        Returns:
            Баланс FLEX токенів та HTTP код
        """
        try:
            logger.info(f"Отримання балансу FLEX для користувача {telegram_id}")

            if not flex_rewards_model:
                return jsonify({
                    "status": "error",
                    "message": "Сервіс FLEX недоступний",
                    "error_code": "SERVICE_UNAVAILABLE"
                }), 503

            # Отримуємо параметри
            wallet_address = request.args.get('wallet_address')
            force_refresh = request.args.get('force_refresh', 'false').lower() == 'true'

            # TON Connect вже валідував адресу - просто перевіряємо що не порожня
            if wallet_address and not wallet_address.strip():
                return jsonify({
                    "status": "error",
                    "message": "Адреса гаманця не може бути порожньою",
                    "error_code": "EMPTY_WALLET_ADDRESS"
                }), 400

            # Очищення кешу при потребі
            if force_refresh:
                invalidate_cache_for_entity(telegram_id)

            # Отримання балансу
            flex_balance = flex_rewards_model.get_user_flex_balance(telegram_id, wallet_address)

            logger.info(f"Баланс FLEX для {telegram_id}: {flex_balance:,}")

            return jsonify({
                "status": "success",
                "data": {
                    "telegram_id": telegram_id,
                    "flex_balance": flex_balance,
                    "wallet_address": wallet_address,
                    "formatted_balance": f"{flex_balance:,}",
                    "last_updated": datetime.now(timezone.utc).isoformat(),
                    "force_refresh": force_refresh,
                    "transaction_service_available": transaction_service is not None
                }
            }), 200

        except Exception as e:
            logger.error(f"Помилка отримання балансу FLEX для {telegram_id}: {str(e)}")
            return jsonify({
                "status": "error",
                "message": "Помилка отримання балансу FLEX",
                "error_code": "BALANCE_FETCH_ERROR"
            }), 500

    @staticmethod
    @public_endpoint(max_requests=30, window_seconds=60)
    @validate_telegram_id
    def check_flex_levels(telegram_id: str) -> tuple[Response, int]:
        """
        Перевірка доступних рівнів FLEX для користувача

        Args:
            telegram_id: ID користувача в Telegram

        Returns:
            Доступні рівні та їх статуси
        """
        try:
            logger.info(f"Перевірка рівнів FLEX для користувача {telegram_id}")

            if not flex_rewards_model:
                return jsonify({
                    "status": "error",
                    "message": "Сервіс FLEX недоступний",
                    "error_code": "SERVICE_UNAVAILABLE"
                }), 503

            # Отримання параметрів
            flex_balance_param = request.args.get('flex_balance')
            flex_balance = None

            if flex_balance_param:
                try:
                    flex_balance = int(flex_balance_param)
                except (ValueError, TypeError):
                    return jsonify({
                        "status": "error",
                        "message": "Невалідний параметр flex_balance",
                        "error_code": "INVALID_FLEX_BALANCE"
                    }), 400

            # Отримання доступних рівнів
            available_levels = flex_rewards_model.get_available_levels(telegram_id, flex_balance)

            # Статистика
            total_levels = len(available_levels)
            available_count = sum(1 for level_data in available_levels.values()
                                  if level_data['status']['has_enough_flex'])
            claimable_count = sum(1 for level_data in available_levels.values()
                                  if level_data['status']['can_claim'])
            claimed_today_count = sum(1 for level_data in available_levels.values()
                                      if level_data['status']['claimed_today'])

            # Потенційні винагороди
            potential_winix = sum(level_data['config']['winix_reward']
                                  for level_data in available_levels.values()
                                  if level_data['status']['can_claim'])
            potential_tickets = sum(level_data['config']['tickets_reward']
                                    for level_data in available_levels.values()
                                    if level_data['status']['can_claim'])

            logger.info(f"Рівні FLEX для {telegram_id}: доступно={available_count}, "
                        f"можна отримати={claimable_count}, отримано сьогодні={claimed_today_count}")

            # Конвертація FlexLevel enum в строки
            levels_data = {}
            for level, data in available_levels.items():
                level_key = level.value if hasattr(level, 'value') else str(level)
                levels_data[level_key] = data

            current_balance = flex_balance if flex_balance is not None else (
                flex_rewards_model.get_user_flex_balance(telegram_id) if flex_rewards_model else 0
            )

            return jsonify({
                "status": "success",
                "data": {
                    "telegram_id": telegram_id,
                    "current_flex_balance": current_balance,
                    "levels": levels_data,
                    "summary": {
                        "total_levels": total_levels,
                        "available_levels": available_count,
                        "claimable_levels": claimable_count,
                        "claimed_today": claimed_today_count,
                        "potential_rewards": {
                            "winix": potential_winix,
                            "tickets": potential_tickets
                        }
                    },
                    "last_updated": datetime.now(timezone.utc).isoformat(),
                    "transaction_service_available": transaction_service is not None
                }
            }), 200

        except Exception as e:
            logger.error(f"Помилка перевірки рівнів FLEX для {telegram_id}: {str(e)}")
            return jsonify({
                "status": "error",
                "message": "Помилка перевірки рівнів FLEX",
                "error_code": "LEVELS_CHECK_ERROR"
            }), 500

    @staticmethod
    @secure_endpoint(max_requests=10, window_seconds=300)
    @validate_json(required_fields=['level'])
    def claim_flex_reward(telegram_id: str) -> tuple[Response, int]:
        """
        Отримання винагороди за рівень FLEX через Transaction Service

        Args:
            telegram_id: ID користувача в Telegram

        Returns:
            Результат отримання винагороди та HTTP код
        """
        try:
            logger.info(f"Отримання винагороди FLEX для користувача {telegram_id}")

            if not flex_rewards_model or not FlexLevel:
                return jsonify({
                    "status": "error",
                    "message": "Сервіс FLEX недоступний",
                    "error_code": "SERVICE_UNAVAILABLE"
                }), 503

            # Отримання даних запиту
            request_data = get_json_data()
            if not request_data:
                return jsonify({
                    "status": "error",
                    "message": "Дані запиту відсутні",
                    "error_code": "MISSING_REQUEST_DATA"
                }), 400

            # Валідація рівня
            level_str = sanitize_string(request_data.get('level', '')).lower()

            try:
                level = FlexLevel(level_str)
            except (ValueError, AttributeError, TypeError):
                valid_levels = [level.value for level in FlexLevel] if FlexLevel else []
                return jsonify({
                    "status": "error",
                    "message": f"Невалідний рівень. Доступні: {', '.join(valid_levels)}",
                    "error_code": "INVALID_LEVEL"
                }), 400

            logger.debug(f"Отримання винагороди рівня {level.value} для {telegram_id}")

            # Обробка через transaction service або fallback
            if transaction_service:
                result = FlexController._process_reward_with_transaction_service(
                    telegram_id, level, flex_rewards_model
                )
            else:
                result = FlexController._process_reward_fallback(
                    telegram_id, level, flex_rewards_model
                )

            return result

        except Exception as e:
            logger.error(f"Помилка отримання винагороди FLEX для {telegram_id}: {str(e)}")
            return jsonify({
                "status": "error",
                "message": "Внутрішня помилка сервера",
                "error_code": "INTERNAL_ERROR"
            }), 500

    @staticmethod
    def _process_reward_with_transaction_service(telegram_id: str, level, flex_model) -> tuple[Response, int]:
        """Обробка винагороди через transaction service"""
        # Перевірка можливості отримання
        can_claim_result = flex_model.can_claim_level_reward(telegram_id, level)

        if not can_claim_result['can_claim']:
            logger.warning(f"Не можна отримати винагороду {level.value} для {telegram_id}: {can_claim_result['reason']}")

            error_code = "CLAIM_FAILED"
            status_code = 400

            if 'insufficient_flex' in can_claim_result['reason'].lower():
                error_code = "INSUFFICIENT_FLEX"
            elif 'already_claimed' in can_claim_result['reason'].lower():
                error_code = "ALREADY_CLAIMED_TODAY"
                status_code = 429

            response_data = {
                "status": "error",
                "message": can_claim_result['reason'],
                "error_code": error_code
            }

            if 'next_claim_available' in can_claim_result:
                response_data['next_claim_available'] = can_claim_result['next_claim_available']

            return jsonify(response_data), status_code

        # Отримання конфігурації рівня
        level_config = flex_model.FLEX_LEVELS_CONFIG.get(level)
        if not level_config:
            return jsonify({
                "status": "error",
                "message": "Конфігурація рівня не знайдена",
                "error_code": "LEVEL_CONFIG_NOT_FOUND"
            }), 400

        # Обробка через transaction service
        transaction_result = transaction_service.process_flex_reward(
            telegram_id=telegram_id,
            winix_amount=level_config.winix_reward,
            tickets_amount=level_config.tickets_reward,
            flex_level=level.value,
            flex_balance=flex_model.get_user_flex_balance(telegram_id)
        )

        if transaction_result['success']:
            # Позначення як отримано
            flex_mark_result = flex_model.mark_level_claimed(telegram_id, level)

            if flex_mark_result['success']:
                result_data = {
                    'level': level.value,
                    'winix_reward': level_config.winix_reward,
                    'tickets_reward': level_config.tickets_reward,
                    'flex_balance': flex_model.get_user_flex_balance(telegram_id),
                    'transaction_id': transaction_result['transaction_id'],
                    'operations': transaction_result['operations'],
                    'claimed_at': transaction_result['processed_at']
                }

                logger.info(f"FLEX винагорода {level.value} успішно нарахована користувачу {telegram_id}")

                return jsonify({
                    "status": "success",
                    "message": f"Винагорода рівня {level.value} успішно отримана",
                    "data": result_data
                }), 200
            else:
                logger.error(f"Не вдалося позначити рівень як отриманий: {flex_mark_result['message']}")
                return jsonify({
                    "status": "error",
                    "message": "Винагорода нарахована, але не вдалося оновити статус",
                    "error_code": "STATUS_UPDATE_FAILED"
                }), 500
        else:
            logger.error(f"Помилка transaction service: {transaction_result['error']}")
            return jsonify({
                "status": "error",
                "message": f"Помилка нарахування винагороди: {transaction_result['error']}",
                "error_code": "TRANSACTION_FAILED"
            }), 500

    @staticmethod
    def _process_reward_fallback(telegram_id: str, level, flex_model) -> tuple[Response, int]:
        """Fallback обробка винагороди"""
        result = flex_model.claim_level_reward(telegram_id, level)

        if result['success']:
            logger.info(f"Винагорода {level.value} успішно нарахована користувачу {telegram_id} (fallback)")

            result['data'] = result.get('reward', {})
            result['data']['telegram_id'] = telegram_id
            result['data']['claimed_at'] = datetime.now(timezone.utc).isoformat()
            result['data']['transaction_service_used'] = False

            return jsonify({
                "status": "success",
                "message": result['message'],
                "data": result['data']
            }), 200
        else:
            logger.warning(f"Не вдалося отримати винагороду {level.value} для {telegram_id}: {result['message']}")

            error_code = result.get('error_code', 'CLAIM_FAILED')
            status_code = 400

            if error_code == 'INSUFFICIENT_FLEX':
                status_code = 400
            elif error_code == 'ALREADY_CLAIMED_TODAY':
                status_code = 429
            else:
                status_code = 500

            response_data = {
                "status": "error",
                "message": result['message'],
                "error_code": error_code
            }

            if 'next_claim_available' in result:
                response_data['next_claim_available'] = result['next_claim_available']

            return jsonify(response_data), status_code

    @staticmethod
    @public_endpoint(max_requests=20, window_seconds=60)
    @validate_telegram_id
    def get_flex_history(telegram_id: str) -> tuple[Response, int]:
        """
        Отримання історії FLEX винагород користувача з транзакцій

        Args:
            telegram_id: ID користувача в Telegram

        Returns:
            Історія винагород та HTTP код
        """
        try:
            logger.info(f"Отримання історії FLEX для користувача {telegram_id}")

            if not flex_rewards_model:
                return jsonify({
                    "status": "error",
                    "message": "Сервіс FLEX недоступний",
                    "error_code": "SERVICE_UNAVAILABLE"
                }), 503

            # Отримуємо параметри запиту
            try:
                limit = min(int(request.args.get('limit', 50)), 100)  # Максимум 100
                offset = int(request.args.get('offset', 0))
            except (ValueError, TypeError):
                return jsonify({
                    "status": "error",
                    "message": "Невалідні параметри запиту",
                    "error_code": "INVALID_PARAMETERS"
                }), 400

            # Пробуємо отримати історію з transaction service
            transaction_history = []
            if transaction_service:
                try:
                    history_result = transaction_service.get_user_transaction_history(
                        telegram_id=telegram_id,
                        limit=limit + offset
                    )

                    if history_result['success']:
                        # Фільтруємо тільки flex_reward транзакції
                        all_transactions = history_result.get('transactions', [])
                        flex_transactions = [
                            t for t in all_transactions
                            if t.get('type') == 'flex_reward' and t.get('status') == 'completed'
                        ]

                        # Застосовуємо offset та limit
                        paginated_transactions = flex_transactions[offset:offset + limit] if offset > 0 else flex_transactions[:limit]

                        # Конвертуємо в формат історії FLEX
                        for trans in paginated_transactions:
                            metadata = trans.get('metadata', {})
                            transaction_history.append({
                                'transaction_id': trans.get('id'),
                                'level': metadata.get('flex_level', 'unknown'),
                                'winix_awarded': trans.get('amount', {}).get('winix', 0),
                                'tickets_awarded': trans.get('amount', {}).get('tickets', 0),
                                'flex_balance': metadata.get('flex_balance', 0),
                                'claimed_at': trans.get('created_at'),
                                'description': trans.get('description', ''),
                                'status': trans.get('status')
                            })

                        logger.info(f"Отримано {len(transaction_history)} FLEX транзакцій з transaction service")

                except Exception as e:
                    logger.warning(f"Помилка отримання історії з transaction service: {e}")

            # Fallback до старого методу якщо transaction service недоступний або порожній
            if not transaction_history:
                history = flex_rewards_model.get_user_flex_history(telegram_id, limit + offset)
                transaction_history = history[offset:offset + limit] if offset > 0 else history[:limit]

            # Рахуємо загальну статистику
            total_records = len(transaction_history)
            total_winix = sum(item.get('winix_awarded', 0) for item in transaction_history)
            total_tickets = sum(item.get('tickets_awarded', 0) for item in transaction_history)

            # Статистика по рівнях
            level_stats = {}
            for item in transaction_history:
                level = item.get('level', 'unknown')
                if level not in level_stats:
                    level_stats[level] = {
                        'count': 0,
                        'total_winix': 0,
                        'total_tickets': 0
                    }
                level_stats[level]['count'] += 1
                level_stats[level]['total_winix'] += item.get('winix_awarded', 0)
                level_stats[level]['total_tickets'] += item.get('tickets_awarded', 0)

            logger.info(f"Історія FLEX для {telegram_id}: {total_records} записів, "
                        f"всього {total_winix} WINIX та {total_tickets} tickets")

            return jsonify({
                "status": "success",
                "data": {
                    "telegram_id": telegram_id,
                    "history": transaction_history,
                    "pagination": {
                        "limit": limit,
                        "offset": offset,
                        "total": total_records,
                        "has_more": len(transaction_history) == limit
                    },
                    "statistics": {
                        "total_claims": total_records,
                        "total_rewards": {
                            "winix": total_winix,
                            "tickets": total_tickets
                        },
                        "level_breakdown": level_stats
                    },
                    "data_source": "transaction_service" if transaction_service and transaction_history else "flex_model"
                }
            }), 200

        except Exception as e:
            logger.error(f"Помилка отримання історії FLEX для {telegram_id}: {str(e)}")
            return jsonify({
                "status": "error",
                "message": "Помилка отримання історії FLEX",
                "error_code": "HISTORY_FETCH_ERROR"
            }), 500

    @staticmethod
    @public_endpoint(max_requests=20, window_seconds=60)
    @validate_telegram_id
    def get_user_flex_status(telegram_id: str) -> tuple[Response, int]:
        """
        Отримання повного статусу користувача по FLEX системі

        Args:
            telegram_id: ID користувача в Telegram

        Returns:
            Повний статус користувача та HTTP код
        """
        try:
            logger.info(f"Отримання статусу FLEX для користувача {telegram_id}")

            if not flex_rewards_model:
                return jsonify({
                    "status": "error",
                    "message": "Сервіс FLEX недоступний",
                    "error_code": "SERVICE_UNAVAILABLE"
                }), 503

            # Отримуємо повний статус
            user_status = flex_rewards_model.get_user_flex_status(telegram_id)

            # Конвертуємо в JSON-серіалізовний формат
            status_data = {
                "telegram_id": user_status.telegram_id,
                "current_flex_balance": user_status.current_flex_balance,
                "formatted_balance": f"{user_status.current_flex_balance:,}",
                "available_levels": [level.value for level in user_status.available_levels],
                "claimed_today": {level.value: claimed for level, claimed in user_status.claimed_today.items()},
                "last_claim_times": {
                    level.value: time.isoformat() if time else None
                    for level, time in user_status.last_claim_times.items()
                },
                "total_claimed": {
                    "winix": user_status.total_claimed_winix,
                    "tickets": user_status.total_claimed_tickets
                },
                "last_updated": user_status.last_updated.isoformat()
            }

            # Додаємо статистику з транзакцій якщо доступно
            if transaction_service:
                try:
                    history_result = transaction_service.get_user_transaction_history(
                        telegram_id=telegram_id,
                        limit=100
                    )

                    if history_result['success']:
                        flex_transactions = [
                            t for t in history_result.get('transactions', [])
                            if t.get('type') == 'flex_reward' and t.get('status') == 'completed'
                        ]

                        transaction_stats = {
                            'total_claims_from_transactions': len(flex_transactions),
                            'total_winix_from_transactions': sum(
                                t.get('amount', {}).get('winix', 0) for t in flex_transactions
                            ),
                            'total_tickets_from_transactions': sum(
                                t.get('amount', {}).get('tickets', 0) for t in flex_transactions
                            ),
                            'last_transaction_date': flex_transactions[0].get('created_at') if flex_transactions else None
                        }

                        status_data['transaction_statistics'] = transaction_stats

                except Exception as e:
                    logger.warning(f"Не вдалося отримати статистику з транзакцій: {e}")

            # Додаємо рекомендації
            recommendations = []

            if user_status.current_flex_balance == 0:
                recommendations.append({
                    "type": "connect_wallet",
                    "message": "Підключіть TON гаманець для отримання балансу FLEX",
                    "priority": "high"
                })
            elif not user_status.available_levels:
                recommendations.append({
                    "type": "increase_flex",
                    "message": "Збільште баланс FLEX для доступу до винагород",
                    "priority": "medium"
                })
            else:
                unclaimed_count = sum(1 for level, claimed in user_status.claimed_today.items()
                                      if level in user_status.available_levels and not claimed)
                if unclaimed_count > 0:
                    recommendations.append({
                        "type": "claim_rewards",
                        "message": f"Доступно {unclaimed_count} винагород для отримання",
                        "priority": "high"
                    })

            status_data["recommendations"] = recommendations
            status_data["service_info"] = {
                "transaction_service_available": transaction_service is not None,
                "atomic_operations_enabled": transaction_service is not None
            }

            logger.info(f"Статус FLEX для {telegram_id}: баланс={user_status.current_flex_balance:,}, "
                        f"доступно рівнів={len(user_status.available_levels)}")

            return jsonify({
                "status": "success",
                "data": status_data
            }), 200

        except Exception as e:
            logger.error(f"Помилка отримання статусу FLEX для {telegram_id}: {str(e)}")
            return jsonify({
                "status": "error",
                "message": "Помилка отримання статусу FLEX",
                "error_code": "STATUS_FETCH_ERROR"
            }), 500

    @staticmethod
    @public_endpoint(max_requests=50, window_seconds=300)
    def get_flex_statistics() -> tuple[Response, int]:
        """
        Отримання загальної статистики FLEX системи (публічна)

        Returns:
            Статистика FLEX системи та HTTP код
        """
        try:
            logger.info("Отримання загальної статистики FLEX")

            if not flex_rewards_model:
                return jsonify({
                    "status": "error",
                    "message": "Сервіс FLEX недоступний",
                    "error_code": "SERVICE_UNAVAILABLE"
                }), 503

            # Отримуємо статистику з flex моделі
            statistics = flex_rewards_model.get_flex_statistics()

            # Додаємо статистику з transaction service якщо доступний
            if transaction_service:
                try:
                    transaction_stats_result = transaction_service.get_service_statistics()

                    if transaction_stats_result['success']:
                        transaction_stats = transaction_stats_result.get('statistics', {})

                        # Фільтруємо статистику по FLEX транзакціях
                        type_breakdown = transaction_stats.get('type_breakdown', {})
                        flex_transaction_count = type_breakdown.get('flex_reward', 0)

                        statistics['transaction_service_stats'] = {
                            'flex_transactions': flex_transaction_count,
                            'service_available': True
                        }

                except Exception as e:
                    logger.warning(f"Не вдалося отримати статистику транзакцій: {e}")
                    statistics['transaction_service_stats'] = {
                        'service_available': False,
                        'error': str(e)
                    }
            else:
                statistics['transaction_service_stats'] = {
                    'service_available': False
                }

            # Додаємо метадані
            statistics['metadata'] = {
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "system_version": "1.0.0",
                "currency": "FLEX/WINIX/TICKETS",
                "transaction_service_integration": transaction_service is not None
            }

            logger.info(f"Статистика FLEX: {statistics.get('total_claims', 0)} отримань, "
                        f"{statistics.get('unique_users', 0)} користувачів")

            return jsonify({
                "status": "success",
                "data": statistics
            }), 200

        except Exception as e:
            logger.error(f"Помилка отримання статистики FLEX: {str(e)}")
            return jsonify({
                "status": "error",
                "message": "Помилка отримання статистики FLEX",
                "error_code": "STATISTICS_ERROR"
            }), 500

    @staticmethod
    @public_endpoint(max_requests=100, window_seconds=300)
    def get_flex_levels_config() -> tuple[Response, int]:
        """
        Отримання конфігурації рівнів FLEX (публічна)

        Returns:
            Конфігурація рівнів та HTTP код
        """
        try:
            logger.info("Отримання конфігурації рівнів FLEX")

            if not flex_rewards_model:
                return jsonify({
                    "status": "error",
                    "message": "Сервіс FLEX недоступний",
                    "error_code": "SERVICE_UNAVAILABLE"
                }), 503

            # Отримуємо конфігурацію рівнів
            levels_config = {}

            for level, config in flex_rewards_model.FLEX_LEVELS_CONFIG.items():
                levels_config[level.value] = {
                    "level": level.value,
                    "required_flex": config.required_flex,
                    "winix_reward": config.winix_reward,
                    "tickets_reward": config.tickets_reward,
                    "name": config.name,
                    "description": config.description,
                    "icon": config.icon,
                    "color": config.color,
                    "formatted_requirement": f"{config.required_flex:,} FLEX",
                    "formatted_rewards": f"{config.winix_reward} WINIX + {config.tickets_reward} TICKETS"
                }

            # Додаємо метаінформацію
            metadata = {
                "total_levels": len(levels_config),
                "min_flex_required": min(
                    config.required_flex for config in flex_rewards_model.FLEX_LEVELS_CONFIG.values()),
                "max_flex_required": max(
                    config.required_flex for config in flex_rewards_model.FLEX_LEVELS_CONFIG.values()),
                "total_max_daily_winix": sum(
                    config.winix_reward for config in flex_rewards_model.FLEX_LEVELS_CONFIG.values()),
                "total_max_daily_tickets": sum(
                    config.tickets_reward for config in flex_rewards_model.FLEX_LEVELS_CONFIG.values()),
                "claim_cooldown_hours": flex_rewards_model.CLAIM_COOLDOWN_HOURS,
                "last_updated": datetime.now(timezone.utc).isoformat(),
                "transaction_service_integration": transaction_service is not None
            }

            logger.info(f"Конфігурація рівнів FLEX: {len(levels_config)} рівнів")

            return jsonify({
                "status": "success",
                "data": {
                    "levels": levels_config,
                    "metadata": metadata
                }
            }), 200

        except Exception as e:
            logger.error(f"Помилка отримання конфігурації рівнів FLEX: {str(e)}")
            return jsonify({
                "status": "error",
                "message": "Помилка отримання конфігурації рівнів",
                "error_code": "CONFIG_ERROR"
            }), 500

    @staticmethod
    def get_flex_health() -> Tuple[Dict[str, Any], int]:
        """
        Перевірка здоров'я FLEX сервісу

        Returns:
            Статус здоров'я та HTTP код
        """
        try:
            # Перевіряємо доступність компонентів
            health_status: Dict[str, Dict[str, Any]] = {}
            overall_healthy: bool = True

            # Перевірка моделі FLEX
            if flex_rewards_model:
                try:
                    # Пробуємо отримати статистику
                    stats: Dict[str, Any] = flex_rewards_model.get_flex_statistics()
                    health_status['flex_model'] = {
                        "status": "healthy",
                        "total_claims": stats.get('total_claims', 0)
                    }
                except Exception as e:
                    health_status['flex_model'] = {
                        "status": "unhealthy",
                        "error": str(e)
                    }
                    overall_healthy = False
            else:
                health_status['flex_model'] = {
                    "status": "unavailable",
                    "error": "Model not loaded"
                }
                overall_healthy = False

            # Перевірка Transaction Service
            if transaction_service:
                try:
                    stats_result: Dict[str, Any] = transaction_service.get_service_statistics()
                    health_status['transaction_service'] = {
                        "status": "healthy" if stats_result['success'] else "degraded",
                        "version": "1.0.0",
                        "integration": "active"
                    }
                except Exception as e:
                    health_status['transaction_service'] = {
                        "status": "unhealthy",
                        "error": str(e)
                    }
                    # Не впливає на загальне здоров'я FLEX сервісу
            else:
                health_status['transaction_service'] = {
                    "status": "unavailable",
                    "error": "Service not loaded",
                    "impact": "fallback_mode_active"
                }

            # Перевірка TON Connect сервісу
            # Додаємо перевірку існування ton_connect_service
            ton_connect_service: Optional[Any] = globals().get('ton_connect_service')
            if ton_connect_service:
                try:
                    network_info: Dict[str, Any] = ton_connect_service.get_network_info()
                    health_status['ton_connect'] = {
                        "status": "healthy",
                        "network": network_info.get('network', 'unknown'),
                        "api_configured": network_info.get('api_key_configured', False)
                    }
                except Exception as e:
                    health_status['ton_connect'] = {
                        "status": "unhealthy",
                        "error": str(e)
                    }
                    overall_healthy = False
            else:
                health_status['ton_connect'] = {
                    "status": "unavailable",
                    "error": "Service not initialized"
                }
                overall_healthy = False

            # Перевірка бази даних
            if supabase:
                try:
                    # Простий тест підключення з type: ignore
                    supabase.table("flex_claims").select("id").limit(1).execute()  # type: ignore
                    health_status['database'] = {
                        "status": "healthy",
                        "connection": "active"
                    }
                except Exception as e:
                    health_status['database'] = {
                        "status": "unhealthy",
                        "error": str(e)
                    }
                    overall_healthy = False
            else:
                health_status['database'] = {
                    "status": "unavailable",
                    "error": "Supabase not initialized"
                }
                overall_healthy = False

            status: str = "healthy" if overall_healthy else "degraded"
            http_code: int = 200 if overall_healthy else 503

            logger.info(f"Перевірка здоров'я FLEX сервісу: {status}")

            return {
                "status": status,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "services": health_status,
                "version": "1.0.0",
                "features": {
                    "transaction_service_integration": transaction_service is not None,
                    "atomic_operations": transaction_service is not None,
                    "fallback_mode": transaction_service is None
                }
            }, http_code

        except Exception as e:
            logger.error(f"Помилка перевірки здоров'я FLEX сервісу: {str(e)}")
            return {
                "status": "unhealthy",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "error": str(e)
            }, 500

# Wrapper функції для маршрутів
def get_flex_balance(telegram_id: str) -> tuple[Response, int]:
    """Wrapper для отримання балансу FLEX"""
    return FlexController.get_flex_balance(telegram_id)


def check_flex_levels(telegram_id: str) -> tuple[Response, int]:
    """Wrapper для перевірки рівнів FLEX"""
    return FlexController.check_flex_levels(telegram_id)


def claim_flex_reward(telegram_id: str) -> tuple[Response, int]:
    """Wrapper для отримання винагороди FLEX"""
    return FlexController.claim_flex_reward(telegram_id)


def get_flex_history(telegram_id: str) -> tuple[Response, int]:
    """Wrapper для отримання історії FLEX"""
    return FlexController.get_flex_history(telegram_id)


def get_user_flex_status(telegram_id: str) -> tuple[Response, int]:
    """Wrapper для отримання статусу користувача"""
    return FlexController.get_user_flex_status(telegram_id)


def get_flex_statistics() -> tuple[Response, int]:
    """Wrapper для отримання статистики FLEX"""
    return FlexController.get_flex_statistics()


def get_flex_levels_config() -> tuple[Response, int]:
    """Wrapper для отримання конфігурації рівнів"""
    return FlexController.get_flex_levels_config()


def get_flex_health() -> Response:
    """Wrapper для перевірки здоров'я сервісу"""
    result, status_code = FlexController.get_flex_health()
    response = jsonify(result)
    response.status_code = status_code
    return response


# Експорт
__all__ = [
    'FlexController',
    'get_flex_balance',
    'check_flex_levels',
    'claim_flex_reward',
    'get_flex_history',
    'get_user_flex_status',
    'get_flex_statistics',
    'get_flex_levels_config',
    'get_flex_health'
]