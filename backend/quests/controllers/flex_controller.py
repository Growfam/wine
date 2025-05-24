"""
Контролер для управління FLEX токенами та винагородами
API endpoints для перевірки балансів, отримання винагород та історії
"""

import logging
from typing import Dict, Any, Optional
from flask import request, jsonify, g
from datetime import datetime, timezone

# Налаштування логування
logger = logging.getLogger(__name__)

# Імпорт декораторів та утилітів
try:
    from quests.utils.decorators import (
        secure_endpoint, public_endpoint, validate_json,
        validate_telegram_id, get_current_user, get_json_data
    )
    from quests.utils.validators import (
        validate_telegram_id as validate_tg_id,
        validate_wallet_address, sanitize_string
    )
except ImportError:
    try:
        from backend.quests.utils.decorators import (
            secure_endpoint, public_endpoint, validate_json,
            validate_telegram_id, get_current_user, get_json_data
        )
        from backend.quests.utils.validators import (
            validate_telegram_id as validate_tg_id,
            validate_wallet_address, sanitize_string
        )
    except ImportError:
        logger.error("Не вдалося імпортувати декоратори та валідатори")

# Імпорт моделей та сервісів
try:
    from quests.models.flex_rewards import flex_rewards_model, FlexLevel
except ImportError:
    try:
        from backend.quests.models.flex_rewards import flex_rewards_model, FlexLevel
    except ImportError:
        logger.error("Не вдалося імпортувати модель FLEX винагород")
        flex_rewards_model = None
        FlexLevel = None


class FlexController:
    """Контролер для управління FLEX токенами та винагородами"""

    @staticmethod
    @public_endpoint(max_requests=30, window_seconds=60)
    @validate_telegram_id
    def get_flex_balance(telegram_id: str) -> tuple[Dict[str, Any], int]:
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

            # Отримуємо адресу гаманця з параметрів (опціонально)
            wallet_address = request.args.get('wallet_address')
            force_refresh = request.args.get('force_refresh', 'false').lower() == 'true'

            # Валідуємо адресу якщо вказана
            if wallet_address and not validate_wallet_address(wallet_address):
                return jsonify({
                    "status": "error",
                    "message": "Невалідна адреса гаманця",
                    "error_code": "INVALID_WALLET_ADDRESS"
                }), 400

            # Якщо потрібно примусове оновлення, очищаємо кеш
            if force_refresh:
                try:
                    from supabase_client import invalidate_cache_for_entity
                    invalidate_cache_for_entity(telegram_id)
                except ImportError:
                    pass

            # Отримуємо баланс FLEX
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
                    "force_refresh": force_refresh
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
    def check_flex_levels(telegram_id: str) -> tuple[Dict[str, Any], int]:
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

            # Отримуємо баланс з параметрів або автоматично
            flex_balance_param = request.args.get('flex_balance')
            if flex_balance_param:
                try:
                    flex_balance = int(flex_balance_param)
                except (ValueError, TypeError):
                    return jsonify({
                        "status": "error",
                        "message": "Невалідний параметр flex_balance",
                        "error_code": "INVALID_FLEX_BALANCE"
                    }), 400
            else:
                flex_balance = None

            # Отримуємо доступні рівні
            available_levels = flex_rewards_model.get_available_levels(telegram_id, flex_balance)

            # Рахуємо статистику
            total_levels = len(available_levels)
            available_count = sum(1 for level_data in available_levels.values()
                                  if level_data['status']['has_enough_flex'])
            claimable_count = sum(1 for level_data in available_levels.values()
                                  if level_data['status']['can_claim'])
            claimed_today_count = sum(1 for level_data in available_levels.values()
                                      if level_data['status']['claimed_today'])

            # Підраховуємо потенційні винагороди
            potential_winix = sum(level_data['config']['winix_reward']
                                  for level_data in available_levels.values()
                                  if level_data['status']['can_claim'])
            potential_tickets = sum(level_data['config']['tickets_reward']
                                    for level_data in available_levels.values()
                                    if level_data['status']['can_claim'])

            logger.info(f"Рівні FLEX для {telegram_id}: доступно={available_count}, "
                        f"можна отримати={claimable_count}, отримано сьогодні={claimed_today_count}")

            # Конвертуємо FlexLevel enum в строки для JSON
            levels_data = {}
            for level, data in available_levels.items():
                levels_data[level.value] = data

            return jsonify({
                "status": "success",
                "data": {
                    "telegram_id": telegram_id,
                    "current_flex_balance": flex_balance or flex_rewards_model.get_user_flex_balance(telegram_id),
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
                    "last_updated": datetime.now(timezone.utc).isoformat()
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
    @secure_endpoint(max_requests=10, window_seconds=300)  # Обмеження: 10 отримань за 5 хвилин
    @validate_json(required_fields=['level'])
    def claim_flex_reward(telegram_id: str) -> tuple[Dict[str, Any], int]:
        """
        Отримання винагороди за рівень FLEX

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

            # Отримуємо дані з запиту
            request_data = get_json_data()
            if not request_data:
                return jsonify({
                    "status": "error",
                    "message": "Дані запиту відсутні",
                    "error_code": "MISSING_REQUEST_DATA"
                }), 400

            # Валідуємо рівень
            level_str = sanitize_string(request_data.get('level', '')).lower()

            try:
                level = FlexLevel(level_str)
            except ValueError:
                valid_levels = [level.value for level in FlexLevel]
                return jsonify({
                    "status": "error",
                    "message": f"Невалідний рівень. Доступні: {', '.join(valid_levels)}",
                    "error_code": "INVALID_LEVEL"
                }), 400

            logger.debug(f"Отримання винагороди рівня {level.value} для {telegram_id}")

            # Отримуємо винагороду
            result = flex_rewards_model.claim_level_reward(telegram_id, level)

            if result['success']:
                logger.info(f"Винагорода {level.value} успішно нарахована користувачу {telegram_id}")

                # Додаємо додаткову інформацію
                result['data'] = result.get('reward', {})
                result['data']['telegram_id'] = telegram_id
                result['data']['claimed_at'] = datetime.now(timezone.utc).isoformat()

                return jsonify({
                    "status": "success",
                    "message": result['message'],
                    "data": result['data']
                }), 200
            else:
                logger.warning(f"Не вдалося отримати винагороду {level.value} для {telegram_id}: {result['message']}")

                # Визначаємо код статусу на основі помилки
                error_code = result.get('error_code', 'CLAIM_FAILED')

                if error_code == 'INSUFFICIENT_FLEX':
                    status_code = 400
                elif error_code == 'ALREADY_CLAIMED_TODAY':
                    status_code = 429  # Too Many Requests
                elif error_code == 'UNKNOWN_LEVEL':
                    status_code = 400
                else:
                    status_code = 500

                response_data = {
                    "status": "error",
                    "message": result['message'],
                    "error_code": error_code
                }

                # Додаємо час наступного отримання якщо є
                if 'next_claim_available' in result:
                    response_data['next_claim_available'] = result['next_claim_available']

                return jsonify(response_data), status_code

        except Exception as e:
            logger.error(f"Помилка отримання винагороди FLEX для {telegram_id}: {str(e)}")
            return jsonify({
                "status": "error",
                "message": "Внутрішня помилка сервера",
                "error_code": "INTERNAL_ERROR"
            }), 500

    @staticmethod
    @public_endpoint(max_requests=20, window_seconds=60)
    @validate_telegram_id
    def get_flex_history(telegram_id: str) -> tuple[Dict[str, Any], int]:
        """
        Отримання історії FLEX винагород користувача

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

            # Отримуємо історію
            history = flex_rewards_model.get_user_flex_history(telegram_id, limit + offset)

            # Застосовуємо offset
            paginated_history = history[offset:offset + limit] if offset > 0 else history[:limit]

            # Рахуємо загальну статистику
            total_records = len(history)
            total_winix = sum(item['winix_awarded'] for item in history)
            total_tickets = sum(item['tickets_awarded'] for item in history)

            # Статистика по рівнях
            level_stats = {}
            for item in history:
                level = item['level']
                if level not in level_stats:
                    level_stats[level] = {
                        'count': 0,
                        'total_winix': 0,
                        'total_tickets': 0
                    }
                level_stats[level]['count'] += 1
                level_stats[level]['total_winix'] += item['winix_awarded']
                level_stats[level]['total_tickets'] += item['tickets_awarded']

            logger.info(f"Історія FLEX для {telegram_id}: {total_records} записів, "
                        f"всього {total_winix} WINIX та {total_tickets} tickets")

            return jsonify({
                "status": "success",
                "data": {
                    "telegram_id": telegram_id,
                    "history": paginated_history,
                    "pagination": {
                        "limit": limit,
                        "offset": offset,
                        "total": total_records,
                        "has_more": offset + limit < total_records
                    },
                    "statistics": {
                        "total_claims": total_records,
                        "total_rewards": {
                            "winix": total_winix,
                            "tickets": total_tickets
                        },
                        "level_breakdown": level_stats
                    }
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
    def get_user_flex_status(telegram_id: str) -> tuple[Dict[str, Any], int]:
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
    def get_flex_statistics() -> tuple[Dict[str, Any], int]:
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

            # Отримуємо статистику
            statistics = flex_rewards_model.get_flex_statistics()

            # Додаємо метадані
            statistics['metadata'] = {
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "system_version": "1.0.0",
                "currency": "FLEX/WINIX/TICKETS"
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
    def get_flex_levels_config() -> tuple[Dict[str, Any], int]:
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
                "last_updated": datetime.now(timezone.utc).isoformat()
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
    @public_endpoint(max_requests=20, window_seconds=60)
    def get_flex_health() -> tuple[Dict[str, Any], int]:
        """
        Перевірка здоров'я FLEX сервісу

        Returns:
            Статус здоров'я та HTTP код
        """
        try:
            # Перевіряємо доступність компонентів
            health_status = {}
            overall_healthy = True

            # Перевірка моделі FLEX
            if flex_rewards_model:
                try:
                    # Пробуємо отримати статистику
                    stats = flex_rewards_model.get_flex_statistics()
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

            # Перевірка TON Connect сервісу
            try:
                from quests.services.ton_connect_service import ton_connect_service
                if ton_connect_service:
                    network_info = ton_connect_service.get_network_info()
                    health_status['ton_connect'] = {
                        "status": "healthy",
                        "network": network_info.get('network', 'unknown'),
                        "api_configured": network_info.get('api_key_configured', False)
                    }
                else:
                    health_status['ton_connect'] = {
                        "status": "unavailable",
                        "error": "Service not initialized"
                    }
                    overall_healthy = False
            except ImportError:
                health_status['ton_connect'] = {
                    "status": "unavailable",
                    "error": "Service not found"
                }
                overall_healthy = False

            # Перевірка бази даних
            try:
                from supabase_client import supabase
                if supabase:
                    # Простий тест підключення
                    supabase.table("flex_claims").select("id").limit(1).execute()
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

            logger.info(f"Перевірка здоров'я FLEX сервісу: {status}")

            return jsonify({
                "status": status,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "services": health_status,
                "version": "1.0.0"
            }), http_code

        except Exception as e:
            logger.error(f"Помилка перевірки здоров'я FLEX сервісу: {str(e)}")
            return jsonify({
                "status": "unhealthy",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "error": str(e)
            }), 500


# Експорт функцій для реєстрації маршрутів
def get_flex_balance(telegram_id: str):
    """Wrapper для отримання балансу FLEX"""
    return FlexController.get_flex_balance(telegram_id)


def check_flex_levels(telegram_id: str):
    """Wrapper для перевірки рівнів FLEX"""
    return FlexController.check_flex_levels(telegram_id)


def claim_flex_reward(telegram_id: str):
    """Wrapper для отримання винагороди FLEX"""
    return FlexController.claim_flex_reward(telegram_id)


def get_flex_history(telegram_id: str):
    """Wrapper для отримання історії FLEX"""
    return FlexController.get_flex_history(telegram_id)


def get_user_flex_status(telegram_id: str):
    """Wrapper для отримання статусу користувача"""
    return FlexController.get_user_flex_status(telegram_id)


def get_flex_statistics():
    """Wrapper для отримання статистики FLEX"""
    return FlexController.get_flex_statistics()


def get_flex_levels_config():
    """Wrapper для отримання конфігурації рівнів"""
    return FlexController.get_flex_levels_config()


def get_flex_health():
    """Wrapper для перевірки здоров'я сервісу"""
    return FlexController.get_flex_health()


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