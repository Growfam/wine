"""
Контролер Analytics для системи завдань WINIX
Обробка аналітичних подій та генерація статистики
"""
import logging
import asyncio
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
from flask import request, jsonify
from collections import defaultdict, Counter

# Імпорт декораторів
from ..utils.decorators import (
    public_endpoint, secure_endpoint,
    validate_json, get_current_user, get_json_data
)

# Імпорт моделей аналітики
from ..models.analytics import (
    AnalyticsEvent, EventType, EventSeverity, UserSession, UserStats,
    analytics_db, create_event, create_task_event
)

logger = logging.getLogger(__name__)


def run_async(coro):
    """Helper для запуску async функцій у Flask"""
    try:
        return asyncio.run(coro)
    except RuntimeError:
        # Якщо вже є event loop
        try:
            loop = asyncio.get_event_loop()
            if loop.is_running():
                # Створюємо новий thread для виконання
                import concurrent.futures
                with concurrent.futures.ThreadPoolExecutor() as executor:
                    future = executor.submit(asyncio.run, coro)
                    return future.result()
            else:
                return loop.run_until_complete(coro)
        except Exception as e:
            logger.error(f"Помилка виконання async операції: {e}")
            return None


class AnalyticsController:
    """Контролер для управління аналітикою"""

    @staticmethod
    @public_endpoint(max_requests=50, window_seconds=60)
    @validate_json(required_fields=['category', 'action'])
    def track_event():
        """
        Відстежити аналітичну подію

        POST /api/analytics/event
        Body: {
            "category": "Task",
            "action": "complete",
            "label": "social",
            "value": 100,
            "properties": {...},
            "session_id": "ses_123...",
            "severity": "normal"
        }
        """
        try:
            data = get_json_data()
            current_user = get_current_user()

            user_id = current_user['telegram_id'] if current_user else None

            # Валідуємо обов'язкові поля
            category = data.get('category')
            action = data.get('action')

            if not category or not action:
                return jsonify({
                    "status": "error",
                    "message": "Категорія та дія обов'язкові"
                }), 400

            # Опціональні поля
            label = data.get('label')
            value = data.get('value')
            properties = data.get('properties', {})
            session_id = data.get('session_id')
            severity = data.get('severity', 'normal')

            # Додаємо метадані запиту
            if not properties:
                properties = {}

            properties.update({
                'ip_address': request.remote_addr,
                'user_agent': request.headers.get('User-Agent', ''),
                'referrer': request.headers.get('Referer', ''),
                'timestamp_received': datetime.now(timezone.utc).isoformat()
            })

            # Визначаємо тип події
            event_type = AnalyticsController._determine_event_type(category, action)

            # Створюємо подію
            event = create_event(
                user_id=user_id,
                event_type=event_type,
                category=category,
                action=action,
                label=label,
                value=value,
                properties=properties,
                session_id=session_id,
                severity=EventSeverity(severity)
            )

            # Зберігаємо синхронно
            saved = run_async(analytics_db.save_event(event))

            # Оновлюємо статистику користувача (якщо є)
            if user_id:
                run_async(AnalyticsController._update_user_stats(user_id, event))

            logger.info(f"Подія відстежена: {category}.{action} для користувача {user_id}")

            return jsonify({
                "status": "success",
                "message": "Подію збережено",
                "event_id": event.id
            })

        except Exception as e:
            logger.error(f"Помилка відстеження події: {str(e)}")
            return jsonify({
                "status": "error",
                "message": "Помилка збереження події"
            }), 500

    @staticmethod
    @public_endpoint(max_requests=20, window_seconds=60)
    @validate_json(required_fields=['events'])
    def track_batch_events():
        """
        Відстежити пакет подій

        POST /api/analytics/batch
        Body: {
            "events": [
                {
                    "category": "Task",
                    "action": "view",
                    ...
                },
                ...
            ],
            "session_id": "ses_123..."
        }
        """
        try:
            data = get_json_data()
            current_user = get_current_user()

            user_id = current_user['telegram_id'] if current_user else None
            events_data = data.get('events', [])
            session_id = data.get('session_id')

            if not events_data or len(events_data) > 50:  # Ліміт 50 подій
                return jsonify({
                    "status": "error",
                    "message": "Невірна кількість подій (1-50)"
                }), 400

            created_events = []

            for event_data in events_data:
                if not event_data.get('category') or not event_data.get('action'):
                    continue

                # Створюємо подію
                event_type = AnalyticsController._determine_event_type(
                    event_data['category'],
                    event_data['action']
                )

                properties = event_data.get('properties', {})
                properties.update({
                    'ip_address': request.remote_addr,
                    'user_agent': request.headers.get('User-Agent', ''),
                    'batch_processed': True
                })

                event = create_event(
                    user_id=user_id,
                    event_type=event_type,
                    category=event_data['category'],
                    action=event_data['action'],
                    label=event_data.get('label'),
                    value=event_data.get('value'),
                    properties=properties,
                    session_id=session_id,
                    severity=EventSeverity(event_data.get('severity', 'normal'))
                )

                created_events.append(event)

            # Зберігаємо всі події
            run_async(AnalyticsController._save_batch_events(created_events))

            # Оновлюємо статистику
            if user_id:
                run_async(AnalyticsController._update_user_stats_batch(user_id, created_events))

            logger.info(f"Пакет з {len(created_events)} подій збережено для користувача {user_id}")

            return jsonify({
                "status": "success",
                "message": f"Збережено {len(created_events)} подій",
                "events_processed": len(created_events)
            })

        except Exception as e:
            logger.error(f"Помилка пакетного збереження: {str(e)}")
            return jsonify({
                "status": "error",
                "message": "Помилка збереження пакету подій"
            }), 500

    @staticmethod
    @secure_endpoint(max_requests=10, window_seconds=60)
    def get_user_analytics(user_id: str):
        """
        Отримати аналітику користувача

        GET /api/analytics/user/{user_id}
        """
        try:
            # Перевіряємо права доступу
            current_user = get_current_user()
            if not current_user or current_user['telegram_id'] != user_id:
                return jsonify({
                    "status": "error",
                    "message": "Доступ заборонено"
                }), 403

            # Отримуємо статистику
            user_stats = run_async(analytics_db.get_user_stats(user_id))

            if not user_stats:
                return jsonify({
                    "status": "error",
                    "message": "Статистика не знайдена"
                }), 404

            # Отримуємо останні події (7 днів)
            end_date = datetime.now(timezone.utc)
            start_date = end_date - timedelta(days=7)

            recent_events = run_async(analytics_db.get_events(
                user_id=user_id,
                start_date=start_date,
                end_date=end_date,
                limit=100
            ))

            # Аналізуємо активність по днях
            daily_activity = AnalyticsController._analyze_daily_activity(recent_events)

            # Популярні дії
            top_actions = AnalyticsController._get_top_actions(recent_events)

            return jsonify({
                "status": "success",
                "data": {
                    "user_stats": user_stats.to_dict() if user_stats else {},
                    "recent_events_count": len(recent_events) if recent_events else 0,
                    "daily_activity": daily_activity,
                    "top_actions": top_actions,
                    "analysis_period": {
                        "start": start_date.isoformat(),
                        "end": end_date.isoformat()
                    }
                }
            })

        except Exception as e:
            logger.error(f"Помилка отримання аналітики користувача {user_id}: {str(e)}")
            return jsonify({
                "status": "error",
                "message": "Помилка отримання аналітики"
            }), 500

    @staticmethod
    @public_endpoint(max_requests=5, window_seconds=60)
    def get_summary_stats():
        """
        Отримати зведену статистику (публічну)

        GET /api/analytics/summary
        """
        try:
            # Отримуємо статистику за останній тиждень
            end_date = datetime.now(timezone.utc)
            start_date = end_date - timedelta(days=7)

            summary = run_async(analytics_db.get_summary_stats(start_date, end_date))

            # Додаємо додаткову інформацію
            if summary:
                summary.update({
                    "period": {
                        "start": start_date.isoformat(),
                        "end": end_date.isoformat(),
                        "days": 7
                    },
                    "generated_at": end_date.isoformat()
                })
            else:
                summary = {
                    "total_events": 0,
                    "unique_users": 0,
                    "event_types": {},
                    "period": {
                        "start": start_date.isoformat(),
                        "end": end_date.isoformat(),
                        "days": 7
                    },
                    "generated_at": end_date.isoformat()
                }

            return jsonify({
                "status": "success",
                "data": summary
            })

        except Exception as e:
            logger.error(f"Помилка отримання зведеної статистики: {str(e)}")
            return jsonify({
                "status": "error",
                "message": "Помилка отримання статистики"
            }), 500

    @staticmethod
    @public_endpoint(max_requests=20, window_seconds=60)
    @validate_json(required_fields=['session_id'])
    def track_session():
        """
        Відстежити сесію користувача

        POST /api/analytics/session
        Body: {
            "session_id": "ses_123...",
            "action": "start|end|update",
            "events_count": 5,
            "page_views": 3
        }
        """
        try:
            data = get_json_data()
            current_user = get_current_user()

            user_id = current_user['telegram_id'] if current_user else None
            session_id = data.get('session_id')
            action = data.get('action', 'update')

            if action == 'start':
                # Початок сесії
                session = UserSession(
                    session_id=session_id,
                    user_id=user_id,
                    start_time=datetime.now(timezone.utc),
                    ip_address=request.remote_addr,
                    user_agent=request.headers.get('User-Agent', '')
                )

                run_async(analytics_db.save_session(session))

                logger.info(f"Сесія {session_id} розпочата для користувача {user_id}")

            elif action == 'end':
                # Завершення сесії
                # Тут би ми оновили існуючу сесію
                logger.info(f"Сесія {session_id} завершена для користувача {user_id}")

            elif action == 'update':
                # Оновлення сесії
                events_count = data.get('events_count', 0)
                page_views = data.get('page_views', 0)

                logger.info(f"Сесія {session_id} оновлена: {events_count} подій, {page_views} переглядів")

            return jsonify({
                "status": "success",
                "message": f"Сесія {action} успішно"
            })

        except Exception as e:
            logger.error(f"Помилка обробки сесії: {str(e)}")
            return jsonify({
                "status": "error",
                "message": "Помилка обробки сесії"
            }), 500

    @staticmethod
    def _determine_event_type(category: str, action: str) -> EventType:
        """Визначити тип події на основі категорії та дії"""
        category_lower = category.lower()
        action_lower = action.lower()

        # Маппінг категорій та дій на типи подій
        mappings = {
            ('auth', 'login'): EventType.AUTH_LOGIN,
            ('auth', 'logout'): EventType.AUTH_LOGOUT,
            ('auth', 'failed'): EventType.AUTH_FAILED,
            ('auth', 'refresh'): EventType.AUTH_TOKEN_REFRESH,

            ('task', 'view'): EventType.TASK_VIEW,
            ('task', 'start'): EventType.TASK_START,
            ('task', 'complete'): EventType.TASK_COMPLETE,
            ('task', 'claim'): EventType.TASK_CLAIM,
            ('task', 'verify'): EventType.TASK_VERIFY,
            ('task', 'failed'): EventType.TASK_FAILED,

            ('wallet', 'connect'): EventType.WALLET_CONNECT,
            ('wallet', 'disconnect'): EventType.WALLET_DISCONNECT,
            ('wallet', 'verify'): EventType.WALLET_VERIFY,
            ('wallet', 'error'): EventType.WALLET_ERROR,

            ('flex', 'check_balance'): EventType.FLEX_CHECK_BALANCE,
            ('flex', 'claim_reward'): EventType.FLEX_CLAIM_REWARD,
            ('flex', 'level_achieved'): EventType.FLEX_LEVEL_ACHIEVED,

            ('daily', 'view'): EventType.DAILY_VIEW,
            ('daily', 'claim'): EventType.DAILY_CLAIM,
            ('daily', 'streak'): EventType.DAILY_STREAK,

            ('user', 'register'): EventType.USER_REGISTER,
            ('user', 'profile_update'): EventType.USER_PROFILE_UPDATE,
            ('user', 'balance_update'): EventType.USER_BALANCE_UPDATE,

            ('referral', 'registered'): EventType.REFERRAL_REGISTERED,
            ('referral', 'bonus_claimed'): EventType.REFERRAL_BONUS_CLAIMED,

            ('error', 'occurred'): EventType.ERROR_OCCURRED,
            ('api', 'call'): EventType.API_CALL,
            ('navigation', 'page_view'): EventType.PAGE_VIEW,
        }

        return mappings.get((category_lower, action_lower), EventType.CUSTOM_EVENT)

    @staticmethod
    async def _update_user_stats(user_id: str, event: AnalyticsEvent):
        """Оновити статистику користувача на основі події"""
        try:
            stats = await analytics_db.get_user_stats(user_id)
            if not stats:
                stats = UserStats(user_id=user_id)

            # Оновлюємо загальні лічильники
            stats.total_events += 1
            stats.update_activity()

            # Оновлюємо специфічні лічильники
            if event.event_type == EventType.TASK_VIEW:
                stats.tasks_viewed += 1
            elif event.event_type == EventType.TASK_START:
                stats.tasks_started += 1
            elif event.event_type == EventType.TASK_COMPLETE:
                stats.tasks_completed += 1
            elif event.event_type == EventType.TASK_CLAIM:
                stats.tasks_claimed += 1
                # Додаємо винагороди
                if event.properties and 'reward' in event.properties:
                    reward = event.properties['reward']
                    stats.total_winix_earned += reward.get('winix', 0)
                    stats.total_tickets_earned += reward.get('tickets', 0)
            elif event.event_type == EventType.FLEX_CHECK_BALANCE:
                stats.flex_checks += 1
            elif event.event_type == EventType.FLEX_CLAIM_REWARD:
                stats.flex_rewards_claimed += 1
            elif event.event_type == EventType.DAILY_CLAIM:
                stats.daily_bonuses_claimed += 1

            # Зберігаємо оновлену статистику
            await analytics_db.save_user_stats(stats)

        except Exception as e:
            logger.error(f"Помилка оновлення статистики користувача {user_id}: {str(e)}")

    @staticmethod
    async def _update_user_stats_batch(user_id: str, events: List[AnalyticsEvent]):
        """Оновити статистику користувача на основі пакету подій"""
        try:
            stats = await analytics_db.get_user_stats(user_id)
            if not stats:
                stats = UserStats(user_id=user_id)

            # Оновлюємо загальні лічильники
            stats.total_events += len(events)
            stats.update_activity()

            # Групуємо події по типах для ефективного оновлення
            event_counts = Counter(event.event_type for event in events)

            stats.tasks_viewed += event_counts.get(EventType.TASK_VIEW, 0)
            stats.tasks_started += event_counts.get(EventType.TASK_START, 0)
            stats.tasks_completed += event_counts.get(EventType.TASK_COMPLETE, 0)
            stats.tasks_claimed += event_counts.get(EventType.TASK_CLAIM, 0)
            stats.flex_checks += event_counts.get(EventType.FLEX_CHECK_BALANCE, 0)
            stats.flex_rewards_claimed += event_counts.get(EventType.FLEX_CLAIM_REWARD, 0)
            stats.daily_bonuses_claimed += event_counts.get(EventType.DAILY_CLAIM, 0)

            # Рахуємо винагороди
            for event in events:
                if event.event_type == EventType.TASK_CLAIM and event.properties:
                    reward = event.properties.get('reward', {})
                    stats.total_winix_earned += reward.get('winix', 0)
                    stats.total_tickets_earned += reward.get('tickets', 0)

            await analytics_db.save_user_stats(stats)

        except Exception as e:
            logger.error(f"Помилка пакетного оновлення статистики користувача {user_id}: {str(e)}")

    @staticmethod
    async def _save_batch_events(events: List[AnalyticsEvent]):
        """Зберегти пакет подій"""
        try:
            for event in events:
                await analytics_db.save_event(event)
        except Exception as e:
            logger.error(f"Помилка збереження пакету подій: {str(e)}")

    @staticmethod
    def _analyze_daily_activity(events: List[AnalyticsEvent]) -> Dict[str, int]:
        """Аналізувати щоденну активність"""
        if not events:
            return {}

        daily_counts = defaultdict(int)

        for event in events:
            if event and hasattr(event, 'timestamp'):
                date_key = event.timestamp.date().isoformat()
                daily_counts[date_key] += 1

        return dict(daily_counts)

    @staticmethod
    def _get_top_actions(events: List[AnalyticsEvent], limit: int = 10) -> List[Dict[str, Any]]:
        """Отримати топ дій"""
        if not events:
            return []

        action_counts = Counter()

        for event in events:
            if event and hasattr(event, 'category') and hasattr(event, 'action'):
                action_key = f"{event.category}.{event.action}"
                action_counts[action_key] += 1

        return [
            {"action": action, "count": count}
            for action, count in action_counts.most_common(limit)
        ]


# Експорт для реєстрації роутів
def register_analytics_routes(app):
    """Реєструє роути аналітики"""

    # Основні endpoints
    app.add_url_rule('/api/analytics/event', 'track_event',
                     AnalyticsController.track_event, methods=['POST'])

    app.add_url_rule('/api/analytics/batch', 'track_batch_events',
                     AnalyticsController.track_batch_events, methods=['POST'])

    app.add_url_rule('/api/analytics/session', 'track_session',
                     AnalyticsController.track_session, methods=['POST'])

    app.add_url_rule('/api/analytics/user/<user_id>', 'get_user_analytics',
                     AnalyticsController.get_user_analytics, methods=['GET'])

    app.add_url_rule('/api/analytics/summary', 'get_summary_stats',
                     AnalyticsController.get_summary_stats, methods=['GET'])

    logger.info("✅ Аналітичні роути зареєстровано")


# Зручні функції для використання в інших модулях
def track_user_action(user_id: str, action: str, category: str = "User",
                      label: Optional[str] = None, value: Optional[int] = None,
                      properties: Optional[Dict[str, Any]] = None):
    """Відстежити дію користувача"""
    try:
        event = create_event(
            user_id=user_id,
            event_type=AnalyticsController._determine_event_type(category, action),
            category=category,
            action=action,
            label=label,
            value=value,
            properties=properties
        )

        run_async(analytics_db.save_event(event))
        logger.info(f"Дія відстежена: {category}.{action} для користувача {user_id}")

    except Exception as e:
        logger.error(f"Помилка відстеження дії: {str(e)}")


def track_task_action(user_id: str, action: str, task_id: str, task_type: str,
                      reward: Optional[Dict[str, int]] = None):
    """Відстежити дію з завданням"""
    try:
        event = create_task_event(
            user_id=user_id,
            action=action,
            task_id=task_id,
            task_type=task_type,
            reward=reward
        )

        run_async(analytics_db.save_event(event))
        run_async(AnalyticsController._update_user_stats(user_id, event))

        logger.info(f"Дія завдання відстежена: {action} для користувача {user_id}")

    except Exception as e:
        logger.error(f"Помилка відстеження дії завдання: {str(e)}")


def track_error(user_id: Optional[str], error_message: str, context: Optional[str] = None):
    """Відстежити помилку"""
    try:
        properties = {
            'error_message': error_message,
            'context': context or 'unknown'
        }

        event = create_event(
            user_id=user_id,
            event_type=EventType.ERROR_OCCURRED,
            category='Error',
            action='occurred',
            label=context,
            properties=properties,
            severity=EventSeverity.HIGH
        )

        run_async(analytics_db.save_event(event))
        logger.warning(f"Помилка відстежена: {error_message}")

    except Exception as e:
        logger.error(f"Помилка відстеження помилки: {str(e)}")


# Експорт
__all__ = [
    'AnalyticsController',
    'register_analytics_routes',
    'track_user_action',
    'track_task_action',
    'track_error'
]