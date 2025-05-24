"""
Модель Analytics для системи завдань WINIX
Збереження та аналіз подій користувачів
"""

import os
import uuid
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional, Union
from dataclasses import dataclass, asdict
from enum import Enum
import json

logger = logging.getLogger(__name__)


class EventType(Enum):
    """Типи аналітичних подій"""
    # Аутентифікація
    AUTH_LOGIN = "auth_login"
    AUTH_LOGOUT = "auth_logout"
    AUTH_FAILED = "auth_failed"
    AUTH_TOKEN_REFRESH = "auth_token_refresh"

    # Завдання
    TASK_VIEW = "task_view"
    TASK_START = "task_start"
    TASK_COMPLETE = "task_complete"
    TASK_CLAIM = "task_claim"
    TASK_VERIFY = "task_verify"
    TASK_FAILED = "task_failed"

    # Гаманець
    WALLET_CONNECT = "wallet_connect"
    WALLET_DISCONNECT = "wallet_disconnect"
    WALLET_VERIFY = "wallet_verify"
    WALLET_ERROR = "wallet_error"

    # FLEX система
    FLEX_CHECK_BALANCE = "flex_check_balance"
    FLEX_CLAIM_REWARD = "flex_claim_reward"
    FLEX_LEVEL_ACHIEVED = "flex_level_achieved"

    # Щоденні бонуси
    DAILY_VIEW = "daily_view"
    DAILY_CLAIM = "daily_claim"
    DAILY_STREAK = "daily_streak"

    # Користувач
    USER_REGISTER = "user_register"
    USER_PROFILE_UPDATE = "user_profile_update"
    USER_BALANCE_UPDATE = "user_balance_update"

    # Реферали
    REFERRAL_REGISTERED = "referral_registered"
    REFERRAL_BONUS_CLAIMED = "referral_bonus_claimed"

    # Система
    ERROR_OCCURRED = "error_occurred"
    API_CALL = "api_call"
    PAGE_VIEW = "page_view"

    # Користувацькі події
    CUSTOM_EVENT = "custom_event"


class EventSeverity(Enum):
    """Рівні важливості подій"""
    LOW = "low"
    NORMAL = "normal"
    HIGH = "high"
    CRITICAL = "critical"


@dataclass
class AnalyticsEvent:
    """Базова структура аналітичної події"""
    id: str
    user_id: Optional[str]
    session_id: Optional[str]
    event_type: EventType
    category: str
    action: str
    label: Optional[str] = None
    value: Optional[Union[int, float]] = None
    properties: Optional[Dict[str, Any]] = None
    severity: EventSeverity = EventSeverity.NORMAL
    timestamp: datetime = None
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    referrer: Optional[str] = None
    page_url: Optional[str] = None

    def __post_init__(self):
        if self.timestamp is None:
            self.timestamp = datetime.now(timezone.utc)
        if self.id is None:
            self.id = str(uuid.uuid4())
        if self.properties is None:
            self.properties = {}

    def to_dict(self) -> Dict[str, Any]:
        """Конвертує подію в словник"""
        data = asdict(self)
        data['event_type'] = self.event_type.value
        data['severity'] = self.severity.value
        data['timestamp'] = self.timestamp.isoformat()
        return data

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> 'AnalyticsEvent':
        """Створює подію зі словника"""
        # Конвертуємо enum'и
        data['event_type'] = EventType(data['event_type'])
        data['severity'] = EventSeverity(data['severity'])
        data['timestamp'] = datetime.fromisoformat(data['timestamp'])
        return cls(**data)


@dataclass
class UserSession:
    """Сесія користувача"""
    session_id: str
    user_id: Optional[str]
    start_time: datetime
    end_time: Optional[datetime] = None
    duration: Optional[int] = None  # в секундах
    events_count: int = 0
    page_views: int = 0
    actions_count: int = 0
    ip_address: Optional[str] = None
    user_agent: Optional[str] = None
    is_active: bool = True

    def end_session(self):
        """Завершити сесію"""
        self.end_time = datetime.now(timezone.utc)
        self.duration = int((self.end_time - self.start_time).total_seconds())
        self.is_active = False

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data['start_time'] = self.start_time.isoformat()
        if self.end_time:
            data['end_time'] = self.end_time.isoformat()
        return data


@dataclass
class UserStats:
    """Статистика користувача"""
    user_id: str
    total_events: int = 0
    total_sessions: int = 0
    total_session_time: int = 0  # в секундах
    avg_session_time: float = 0.0

    # Статистика завдань
    tasks_viewed: int = 0
    tasks_started: int = 0
    tasks_completed: int = 0
    tasks_claimed: int = 0

    # Статистика винагород
    total_winix_earned: float = 0.0
    total_tickets_earned: int = 0

    # Статистика FLEX
    flex_checks: int = 0
    flex_rewards_claimed: int = 0

    # Статистика щоденних бонусів
    daily_bonuses_claimed: int = 0
    max_daily_streak: int = 0

    # Дати
    first_seen: datetime = None
    last_seen: datetime = None
    last_active: datetime = None

    def __post_init__(self):
        now = datetime.now(timezone.utc)
        if self.first_seen is None:
            self.first_seen = now
        if self.last_seen is None:
            self.last_seen = now
        if self.last_active is None:
            self.last_active = now

    def update_activity(self):
        """Оновити час активності"""
        self.last_active = datetime.now(timezone.utc)
        self.last_seen = self.last_active

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        data['first_seen'] = self.first_seen.isoformat()
        data['last_seen'] = self.last_seen.isoformat()
        data['last_active'] = self.last_active.isoformat()
        return data


class AnalyticsDB:
    """Клас для роботи з базою даних аналітики"""

    def __init__(self, supabase_client=None):
        self.supabase = supabase_client
        if not self.supabase:
            try:
                from supabase_client import supabase
                self.supabase = supabase
            except ImportError:
                logger.error("Не вдалося імпортувати Supabase клієнт")
                self.supabase = None

    async def save_event(self, event: AnalyticsEvent) -> bool:
        """Зберегти подію в базу даних"""
        try:
            if not self.supabase:
                logger.error("Supabase клієнт недоступний")
                return False

            data = event.to_dict()

            # Адаптуємо для Supabase
            db_data = {
                'id': data['id'],
                'user_id': data['user_id'],
                'session_id': data['session_id'],
                'event_type': data['event_type'],
                'category': data['category'],
                'action': data['action'],
                'label': data['label'],
                'value': data['value'],
                'properties': json.dumps(data['properties']) if data['properties'] else None,
                'severity': data['severity'],
                'timestamp': data['timestamp'],
                'ip_address': data['ip_address'],
                'user_agent': data['user_agent'],
                'referrer': data['referrer'],
                'page_url': data['page_url'],
                'created_at': data['timestamp']
            }

            result = self.supabase.table('analytics_events').insert(db_data).execute()

            if result.data:
                logger.info(f"Подія {event.id} збережена в базу даних")
                return True
            else:
                logger.error(f"Помилка збереження події {event.id}")
                return False

        except Exception as e:
            logger.error(f"Помилка збереження події: {str(e)}")
            return False

    async def save_session(self, session: UserSession) -> bool:
        """Зберегти сесію в базу даних"""
        try:
            if not self.supabase:
                return False

            data = session.to_dict()

            db_data = {
                'session_id': data['session_id'],
                'user_id': data['user_id'],
                'start_time': data['start_time'],
                'end_time': data['end_time'],
                'duration': data['duration'],
                'events_count': data['events_count'],
                'page_views': data['page_views'],
                'actions_count': data['actions_count'],
                'ip_address': data['ip_address'],
                'user_agent': data['user_agent'],
                'is_active': data['is_active']
            }

            result = self.supabase.table('analytics_sessions').insert(db_data).execute()

            if result.data:
                logger.info(f"Сесія {session.session_id} збережена")
                return True
            else:
                logger.error(f"Помилка збереження сесії {session.session_id}")
                return False

        except Exception as e:
            logger.error(f"Помилка збереження сесії: {str(e)}")
            return False

    async def get_user_stats(self, user_id: str) -> Optional[UserStats]:
        """Отримати статистику користувача"""
        try:
            if not self.supabase:
                return None

            # Отримуємо збережену статистику
            result = self.supabase.table('user_analytics_stats').select('*').eq('user_id', user_id).execute()

            if result.data:
                data = result.data[0]

                # Конвертуємо дати
                data['first_seen'] = datetime.fromisoformat(data['first_seen'])
                data['last_seen'] = datetime.fromisoformat(data['last_seen'])
                data['last_active'] = datetime.fromisoformat(data['last_active'])

                return UserStats(**data)
            else:
                # Створюємо нову статистику
                stats = UserStats(user_id=user_id)
                await self.save_user_stats(stats)
                return stats

        except Exception as e:
            logger.error(f"Помилка отримання статистики користувача {user_id}: {str(e)}")
            return None

    async def save_user_stats(self, stats: UserStats) -> bool:
        """Зберегти статистику користувача"""
        try:
            if not self.supabase:
                return False

            data = stats.to_dict()

            # Перевіряємо чи існує запис
            existing = self.supabase.table('user_analytics_stats').select('user_id').eq('user_id',
                                                                                        stats.user_id).execute()

            if existing.data:
                # Оновлюємо
                result = self.supabase.table('user_analytics_stats').update(data).eq('user_id', stats.user_id).execute()
            else:
                # Створюємо
                result = self.supabase.table('user_analytics_stats').insert(data).execute()

            if result.data:
                logger.info(f"Статистика користувача {stats.user_id} збережена")
                return True
            else:
                logger.error(f"Помилка збереження статистики користувача {stats.user_id}")
                return False

        except Exception as e:
            logger.error(f"Помилка збереження статистики: {str(e)}")
            return False

    async def get_events(self, user_id: Optional[str] = None,
                         event_type: Optional[EventType] = None,
                         start_date: Optional[datetime] = None,
                         end_date: Optional[datetime] = None,
                         limit: int = 100) -> List[AnalyticsEvent]:
        """Отримати події з фільтрами"""
        try:
            if not self.supabase:
                return []

            query = self.supabase.table('analytics_events').select('*')

            if user_id:
                query = query.eq('user_id', user_id)

            if event_type:
                query = query.eq('event_type', event_type.value)

            if start_date:
                query = query.gte('timestamp', start_date.isoformat())

            if end_date:
                query = query.lte('timestamp', end_date.isoformat())

            query = query.order('timestamp', desc=True).limit(limit)

            result = query.execute()

            events = []
            for item in result.data:
                # Конвертуємо назад в об'єкт
                item['properties'] = json.loads(item['properties']) if item['properties'] else {}
                events.append(AnalyticsEvent.from_dict(item))

            return events

        except Exception as e:
            logger.error(f"Помилка отримання подій: {str(e)}")
            return []

    async def get_summary_stats(self, start_date: Optional[datetime] = None,
                                end_date: Optional[datetime] = None) -> Dict[str, Any]:
        """Отримати зведену статистику"""
        try:
            if not self.supabase:
                return {}

            # Базовий запит
            query = self.supabase.table('analytics_events').select('*')

            if start_date:
                query = query.gte('timestamp', start_date.isoformat())

            if end_date:
                query = query.lte('timestamp', end_date.isoformat())

            result = query.execute()
            events = result.data

            # Аналізуємо дані
            stats = {
                'total_events': len(events),
                'unique_users': len(set(e['user_id'] for e in events if e['user_id'])),
                'event_types': {},
                'hourly_distribution': {},
                'top_actions': {},
                'error_rate': 0
            }

            # Рахуємо по типах подій
            for event in events:
                event_type = event['event_type']
                stats['event_types'][event_type] = stats['event_types'].get(event_type, 0) + 1

                action = event['action']
                stats['top_actions'][action] = stats['top_actions'].get(action, 0) + 1

                # Розподіл по годинах
                hour = datetime.fromisoformat(event['timestamp']).hour
                stats['hourly_distribution'][hour] = stats['hourly_distribution'].get(hour, 0) + 1

            # Частота помилок
            error_events = sum(1 for e in events if 'error' in e['event_type'].lower())
            stats['error_rate'] = (error_events / len(events) * 100) if events else 0

            return stats

        except Exception as e:
            logger.error(f"Помилка отримання зведеної статистики: {str(e)}")
            return {}


# Глобальний екземпляр для зручності
analytics_db = AnalyticsDB()


# Допоміжні функції
def create_event(user_id: Optional[str], event_type: EventType, category: str, action: str,
                 label: Optional[str] = None, value: Optional[Union[int, float]] = None,
                 properties: Optional[Dict[str, Any]] = None,
                 session_id: Optional[str] = None,
                 severity: EventSeverity = EventSeverity.NORMAL) -> AnalyticsEvent:
    """Створити нову аналітичну подію"""
    return AnalyticsEvent(
        id=str(uuid.uuid4()),
        user_id=user_id,
        session_id=session_id,
        event_type=event_type,
        category=category,
        action=action,
        label=label,
        value=value,
        properties=properties,
        severity=severity
    )


def create_task_event(user_id: str, action: str, task_id: str, task_type: str,
                      reward: Optional[Dict[str, int]] = None,
                      session_id: Optional[str] = None) -> AnalyticsEvent:
    """Створити подію завдання"""
    event_type_map = {
        'view': EventType.TASK_VIEW,
        'start': EventType.TASK_START,
        'complete': EventType.TASK_COMPLETE,
        'claim': EventType.TASK_CLAIM,
        'verify': EventType.TASK_VERIFY,
        'failed': EventType.TASK_FAILED
    }

    properties = {
        'task_id': task_id,
        'task_type': task_type
    }

    if reward:
        properties['reward'] = reward

    return create_event(
        user_id=user_id,
        event_type=event_type_map.get(action, EventType.CUSTOM_EVENT),
        category='Task',
        action=action,
        label=task_type,
        value=reward.get('winix', 0) if reward else None,
        properties=properties,
        session_id=session_id
    )


def create_wallet_event(user_id: str, action: str, wallet_address: Optional[str] = None,
                        session_id: Optional[str] = None) -> AnalyticsEvent:
    """Створити подію гаманця"""
    event_type_map = {
        'connect': EventType.WALLET_CONNECT,
        'disconnect': EventType.WALLET_DISCONNECT,
        'verify': EventType.WALLET_VERIFY,
        'error': EventType.WALLET_ERROR
    }

    properties = {}
    if wallet_address:
        properties['wallet_address'] = wallet_address

    return create_event(
        user_id=user_id,
        event_type=event_type_map.get(action, EventType.CUSTOM_EVENT),
        category='Wallet',
        action=action,
        properties=properties,
        session_id=session_id
    )


# Експорт
__all__ = [
    'EventType',
    'EventSeverity',
    'AnalyticsEvent',
    'UserSession',
    'UserStats',
    'AnalyticsDB',
    'analytics_db',
    'create_event',
    'create_task_event',
    'create_wallet_event'
]