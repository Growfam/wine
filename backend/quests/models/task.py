"""
Модель для управління завданнями в системі WINIX
Підтримка соціальних, лімітованих та партнерських завдань
"""

import os
import time
import logging
import json
import uuid
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional, Union
from dataclasses import dataclass
from enum import Enum

# Налаштування логування
logger = logging.getLogger(__name__)

# Імпорт клієнта Supabase
try:
    from supabase_client import supabase, cached, retry_supabase, invalidate_cache_for_entity
except ImportError:
    try:
        from backend.supabase_client import supabase, cached, retry_supabase, invalidate_cache_for_entity
    except ImportError:
        logger.error("Не вдалося імпортувати supabase_client")
        supabase = None


class TaskType(Enum):
    """Типи завдань"""
    SOCIAL = "social"
    LIMITED = "limited"
    PARTNER = "partner"
    DAILY = "daily"


class TaskStatus(Enum):
    """Статуси завдань"""
    AVAILABLE = "available"
    STARTED = "started"
    PENDING = "pending"
    COMPLETED = "completed"
    CLAIMED = "claimed"
    EXPIRED = "expired"
    LOCKED = "locked"


class TaskPlatform(Enum):
    """Платформи для соціальних завдань"""
    TELEGRAM = "telegram"
    YOUTUBE = "youtube"
    TWITTER = "twitter"
    INSTAGRAM = "instagram"
    DISCORD = "discord"
    TIKTOK = "tiktok"
    FACEBOOK = "facebook"
    LINKEDIN = "linkedin"


class TaskAction(Enum):
    """Дії для завдань"""
    SUBSCRIBE = "subscribe"
    LIKE = "like"
    SHARE = "share"
    COMMENT = "comment"
    FOLLOW = "follow"
    JOIN = "join"
    WATCH = "watch"
    VISIT = "visit"
    CUSTOM = "custom"


@dataclass
class TaskReward:
    """Винагорода за завдання"""
    winix: int = 0
    tickets: int = 0
    special_items: List[str] = None

    def __post_init__(self):
        if self.special_items is None:
            self.special_items = []


@dataclass
class TaskRequirements:
    """Вимоги для завдання"""
    min_level: int = 1
    required_tasks: List[str] = None
    required_badges: List[str] = None
    geo_restrictions: List[str] = None
    min_flex_balance: int = 0

    def __post_init__(self):
        if self.required_tasks is None:
            self.required_tasks = []
        if self.required_badges is None:
            self.required_badges = []
        if self.geo_restrictions is None:
            self.geo_restrictions = []


@dataclass
class TaskMetadata:
    """Метадані завдання"""
    created_by: str = "system"
    priority: int = 1
    difficulty: str = "easy"
    category: str = "general"
    tags: List[str] = None
    estimated_time: int = 60  # в секундах
    verification_type: str = "auto"

    def __post_init__(self):
        if self.tags is None:
            self.tags = []


class TaskModel:
    """Модель для управління завданнями"""

    # Таблиці бази даних
    TABLE_TASKS = "tasks"
    TABLE_USER_TASKS = "user_tasks"
    TABLE_TASK_COMPLETIONS = "task_completions"

    # Часові обмеження
    DEFAULT_EXPIRATION_HOURS = 24 * 7  # 7 днів
    VERIFICATION_TIMEOUT_MINUTES = 30
    MAX_DAILY_TASKS_PER_USER = 50

    def __init__(self):
        """Ініціалізація моделі завдань"""
        if not supabase:
            logger.error("❌ Supabase клієнт не ініціалізовано")
            raise RuntimeError("Supabase not initialized")

        logger.info("✅ TaskModel ініціалізовано")

    @cached(timeout=600)  # Кеш на 10 хвилин
    def get_all_tasks(self, task_type: Optional[TaskType] = None,
                      active_only: bool = True) -> List[Dict[str, Any]]:
        """
        Отримання всіх завдань

        Args:
            task_type: Тип завдань для фільтрації
            active_only: Тільки активні завдання

        Returns:
            Список завдань
        """
        try:
            logger.info(f"Отримання завдань: type={task_type}, active_only={active_only}")

            def fetch_tasks():
                query = supabase.table(self.TABLE_TASKS).select("*")

                # Фільтруємо по типу
                if task_type:
                    query = query.eq("type", task_type.value)

                # Фільтруємо тільки активні
                if active_only:
                    query = query.eq("is_active", True)

                    # Виключаємо прострочені лімітовані завдання
                    current_time = datetime.now(timezone.utc).isoformat()
                    query = query.or_(
                        f"type.neq.{TaskType.LIMITED.value},"
                        f"expires_at.is.null,"
                        f"expires_at.gt.{current_time}"
                    )

                # Сортуємо по пріоритету та даті створення
                query = query.order("priority", desc=True).order("created_at", desc=True)

                response = query.execute()

                if response.data:
                    # Обробляємо завдання
                    tasks = []
                    for task_data in response.data:
                        processed_task = self._process_task_data(task_data)
                        if processed_task:
                            tasks.append(processed_task)

                    logger.info(f"Отримано {len(tasks)} завдань")
                    return tasks

                return []

            return retry_supabase(fetch_tasks)

        except Exception as e:
            logger.error(f"Помилка отримання завдань: {str(e)}")
            return []

    def get_task_by_id(self, task_id: str) -> Optional[Dict[str, Any]]:
        """
        Отримання завдання за ID

        Args:
            task_id: ID завдання

        Returns:
            Дані завдання або None
        """
        try:
            task_id = str(task_id).strip()
            logger.info(f"Отримання завдання за ID: {task_id}")

            def fetch_task():
                response = supabase.table(self.TABLE_TASKS) \
                    .select("*") \
                    .eq("id", task_id) \
                    .limit(1) \
                    .execute()

                if response.data:
                    task_data = response.data[0]
                    processed_task = self._process_task_data(task_data)

                    if processed_task:
                        logger.info(f"Завдання знайдено: {task_data.get('title', 'Unknown')}")
                        return processed_task

                logger.warning(f"Завдання з ID {task_id} не знайдено")
                return None

            return retry_supabase(fetch_task)

        except Exception as e:
            logger.error(f"Помилка отримання завдання {task_id}: {str(e)}")
            return None

    def get_user_tasks(self, telegram_id: str, task_type: Optional[TaskType] = None,
                       include_completed: bool = True) -> List[Dict[str, Any]]:
        """
        Отримання завдань для користувача з їх статусами

        Args:
            telegram_id: ID користувача в Telegram
            task_type: Тип завдань для фільтрації
            include_completed: Включати завершені завдання

        Returns:
            Список завдань з статусами користувача
        """
        try:
            telegram_id = str(telegram_id)
            logger.info(f"Отримання завдань для користувача {telegram_id}")

            # Отримуємо всі активні завдання
            all_tasks = self.get_all_tasks(task_type=task_type, active_only=True)

            # Отримуємо статуси користувача для цих завдань
            user_statuses = self._get_user_task_statuses(telegram_id, [task['id'] for task in all_tasks])

            # Об'єднуємо дані
            user_tasks = []

            for task in all_tasks:
                task_id = task['id']
                user_status = user_statuses.get(task_id, {})

                # Визначаємо статус завдання для користувача
                task_status = user_status.get('status', TaskStatus.AVAILABLE.value)

                # Пропускаємо завершені якщо не потрібні
                if not include_completed and task_status in [TaskStatus.COMPLETED.value, TaskStatus.CLAIMED.value]:
                    continue

                # Перевіряємо доступність завдання для користувача
                if not self._is_task_available_for_user(task, telegram_id, user_status):
                    continue

                # Додаємо інформацію про статус користувача
                task_with_status = task.copy()
                task_with_status['user_status'] = task_status
                task_with_status['user_progress'] = user_status.get('progress', 0)
                task_with_status['started_at'] = user_status.get('started_at')
                task_with_status['completed_at'] = user_status.get('completed_at')
                task_with_status['claimed_at'] = user_status.get('claimed_at')

                user_tasks.append(task_with_status)

            logger.info(f"Підготовлено {len(user_tasks)} завдань для користувача {telegram_id}")
            return user_tasks

        except Exception as e:
            logger.error(f"Помилка отримання завдань користувача {telegram_id}: {str(e)}")
            return []

    @cached(timeout=300)
    def _get_user_task_statuses(self, telegram_id: str, task_ids: List[str]) -> Dict[str, Dict[str, Any]]:
        """Отримання статусів завдань для користувача"""
        try:
            if not task_ids:
                return {}

            def fetch_statuses():
                response = supabase.table(self.TABLE_USER_TASKS) \
                    .select("*") \
                    .eq("telegram_id", telegram_id) \
                    .in_("task_id", task_ids) \
                    .execute()

                statuses = {}
                if response.data:
                    for status in response.data:
                        statuses[status['task_id']] = status

                return statuses

            return retry_supabase(fetch_statuses)

        except Exception as e:
            logger.error(f"Помилка отримання статусів завдань: {str(e)}")
            return {}

    def start_task(self, telegram_id: str, task_id: str) -> Dict[str, Any]:
        """
        Початок виконання завдання користувачем

        Args:
            telegram_id: ID користувача в Telegram
            task_id: ID завдання

        Returns:
            Результат початку виконання
        """
        try:
            telegram_id = str(telegram_id)
            task_id = str(task_id).strip()

            logger.info(f"Початок виконання завдання {task_id} користувачем {telegram_id}")

            # Отримуємо завдання
            task = self.get_task_by_id(task_id)
            if not task:
                return {
                    'success': False,
                    'message': 'Завдання не знайдено',
                    'error_code': 'TASK_NOT_FOUND'
                }

            # Перевіряємо чи завдання активне
            if not task.get('is_active', False):
                return {
                    'success': False,
                    'message': 'Завдання неактивне',
                    'error_code': 'TASK_INACTIVE'
                }

            # Перевіряємо чи не прострочене
            if task.get('expires_at'):
                expires_at = datetime.fromisoformat(task['expires_at'].replace('Z', '+00:00'))
                if datetime.now(timezone.utc) > expires_at:
                    return {
                        'success': False,
                        'message': 'Завдання прострочене',
                        'error_code': 'TASK_EXPIRED'
                    }

            # Перевіряємо поточний статус користувача
            current_status = self._get_user_task_status(telegram_id, task_id)

            if current_status:
                if current_status['status'] in [TaskStatus.COMPLETED.value, TaskStatus.CLAIMED.value]:
                    return {
                        'success': False,
                        'message': 'Завдання вже виконано',
                        'error_code': 'TASK_ALREADY_COMPLETED'
                    }
                elif current_status['status'] == TaskStatus.STARTED.value:
                    return {
                        'success': True,
                        'message': 'Завдання вже розпочато',
                        'data': current_status
                    }

            # Перевіряємо доступність завдання
            if not self._is_task_available_for_user(task, telegram_id):
                return {
                    'success': False,
                    'message': 'Завдання недоступне для вас',
                    'error_code': 'TASK_NOT_AVAILABLE'
                }

            # Створюємо або оновлюємо запис про початок виконання
            now = datetime.now(timezone.utc)

            user_task_data = {
                'telegram_id': telegram_id,
                'task_id': task_id,
                'status': TaskStatus.STARTED.value,
                'progress': 0,
                'started_at': now.isoformat(),
                'updated_at': now.isoformat()
            }

            if current_status:
                # Оновлюємо існуючий запис
                result = self._update_user_task_status(telegram_id, task_id, user_task_data)
            else:
                # Створюємо новий запис
                user_task_data['created_at'] = now.isoformat()
                result = self._create_user_task_status(user_task_data)

            if result:
                # Інвалідуємо кеш
                invalidate_cache_for_entity(telegram_id)

                logger.info(f"Завдання {task_id} розпочато користувачем {telegram_id}")

                return {
                    'success': True,
                    'message': 'Завдання успішно розпочато',
                    'data': {
                        'task_id': task_id,
                        'status': TaskStatus.STARTED.value,
                        'started_at': now.isoformat(),
                        'task_title': task.get('title', ''),
                        'verification_url': task.get('url', ''),
                        'instructions': task.get('instructions', '')
                    }
                }
            else:
                return {
                    'success': False,
                    'message': 'Помилка початку виконання завдання',
                    'error_code': 'START_FAILED'
                }

        except Exception as e:
            logger.error(f"Помилка початку виконання завдання {task_id} для {telegram_id}: {str(e)}")
            return {
                'success': False,
                'message': 'Внутрішня помилка сервера',
                'error_code': 'INTERNAL_ERROR'
            }

    def verify_task(self, telegram_id: str, task_id: str,
                    verification_data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """
        Верифікація виконання завдання

        Args:
            telegram_id: ID користувача в Telegram
            task_id: ID завдання
            verification_data: Додаткові дані для верифікації

        Returns:
            Результат верифікації
        """
        try:
            telegram_id = str(telegram_id)
            task_id = str(task_id).strip()

            logger.info(f"Верифікація завдання {task_id} для користувача {telegram_id}")

            # Отримуємо завдання
            task = self.get_task_by_id(task_id)
            if not task:
                return {
                    'success': False,
                    'message': 'Завдання не знайдено',
                    'error_code': 'TASK_NOT_FOUND'
                }

            # Перевіряємо поточний статус
            current_status = self._get_user_task_status(telegram_id, task_id)
            if not current_status:
                return {
                    'success': False,
                    'message': 'Завдання не розпочато',
                    'error_code': 'TASK_NOT_STARTED'
                }

            if current_status['status'] in [TaskStatus.COMPLETED.value, TaskStatus.CLAIMED.value]:
                return {
                    'success': False,
                    'message': 'Завдання вже виконано',
                    'error_code': 'TASK_ALREADY_COMPLETED'
                }

            # Виконуємо верифікацію в залежності від типу завдання
            verification_result = self._perform_task_verification(task, telegram_id, verification_data)

            if verification_result['success']:
                # Оновлюємо статус на завершено
                now = datetime.now(timezone.utc)

                update_data = {
                    'status': TaskStatus.COMPLETED.value,
                    'progress': 100,
                    'completed_at': now.isoformat(),
                    'updated_at': now.isoformat(),
                    'verification_data': verification_data or {}
                }

                update_result = self._update_user_task_status(telegram_id, task_id, update_data)

                if update_result:
                    # Нараховуємо винагороду
                    reward_result = self._award_task_completion(telegram_id, task)

                    # Інвалідуємо кеш
                    invalidate_cache_for_entity(telegram_id)

                    logger.info(f"Завдання {task_id} успішно виконано користувачем {telegram_id}")

                    return {
                        'success': True,
                        'message': 'Завдання успішно виконано!',
                        'data': {
                            'task_id': task_id,
                            'status': TaskStatus.COMPLETED.value,
                            'completed_at': now.isoformat(),
                            'reward': reward_result.get('reward', {}),
                            'task_title': task.get('title', '')
                        }
                    }
                else:
                    return {
                        'success': False,
                        'message': 'Помилка оновлення статусу завдання',
                        'error_code': 'STATUS_UPDATE_FAILED'
                    }
            else:
                # Оновлюємо статус на pending (очікування)
                now = datetime.now(timezone.utc)

                update_data = {
                    'status': TaskStatus.PENDING.value,
                    'updated_at': now.isoformat(),
                    'verification_data': verification_data or {}
                }

                self._update_user_task_status(telegram_id, task_id, update_data)

                return {
                    'success': False,
                    'message': verification_result.get('message', 'Верифікація не пройдена'),
                    'error_code': verification_result.get('error_code', 'VERIFICATION_FAILED'),
                    'data': {
                        'task_id': task_id,
                        'status': TaskStatus.PENDING.value,
                        'retry_allowed': verification_result.get('retry_allowed', True),
                        'retry_after': verification_result.get('retry_after')
                    }
                }

        except Exception as e:
            logger.error(f"Помилка верифікації завдання {task_id} для {telegram_id}: {str(e)}")
            return {
                'success': False,
                'message': 'Внутрішня помилка сервера',
                'error_code': 'INTERNAL_ERROR'
            }

    def create_task(self, task_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Створення нового завдання

        Args:
            task_data: Дані завдання

        Returns:
            Результат створення
        """
        try:
            logger.info("Створення нового завдання")

            # Валідуємо дані завдання
            validation_result = self._validate_task_data(task_data)
            if not validation_result['valid']:
                return {
                    'success': False,
                    'message': f"Невалідні дані завдання: {validation_result['error']}",
                    'error_code': 'INVALID_TASK_DATA'
                }

            # Генеруємо ID для завдання
            task_id = str(uuid.uuid4())

            # Підготовуємо дані для вставки
            now = datetime.now(timezone.utc)

            db_task_data = {
                'id': task_id,
                'type': task_data['type'],
                'title': task_data['title'],
                'description': task_data.get('description', ''),
                'instructions': task_data.get('instructions', ''),
                'platform': task_data.get('platform'),
                'action': task_data.get('action'),
                'url': task_data.get('url', ''),
                'channel_username': task_data.get('channel_username', ''),
                'reward_winix': task_data.get('reward', {}).get('winix', 0),
                'reward_tickets': task_data.get('reward', {}).get('tickets', 0),
                'requirements': task_data.get('requirements', {}),
                'metadata': task_data.get('metadata', {}),
                'is_active': task_data.get('is_active', True),
                'priority': task_data.get('priority', 1),
                'expires_at': task_data.get('expires_at'),
                'created_at': now.isoformat(),
                'updated_at': now.isoformat()
            }

            def create_task():
                response = supabase.table(self.TABLE_TASKS) \
                    .insert(db_task_data) \
                    .execute()

                return response.data[0] if response.data else None

            created_task = retry_supabase(create_task)

            if created_task:
                # Очищаємо кеш завдань
                invalidate_cache_for_entity("all_tasks")

                logger.info(f"Завдання створено з ID: {task_id}")

                return {
                    'success': True,
                    'message': 'Завдання успішно створено',
                    'data': self._process_task_data(created_task)
                }
            else:
                return {
                    'success': False,
                    'message': 'Помилка створення завдання',
                    'error_code': 'CREATE_FAILED'
                }

        except Exception as e:
            logger.error(f"Помилка створення завдання: {str(e)}")
            return {
                'success': False,
                'message': 'Внутрішня помилка сервера',
                'error_code': 'INTERNAL_ERROR'
            }

    def _process_task_data(self, task_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """Обробка сирих даних завдання з бази даних"""
        try:
            if not task_data:
                return None

            # Базові дані
            processed = {
                'id': task_data['id'],
                'type': task_data['type'],
                'title': task_data['title'],
                'description': task_data.get('description', ''),
                'instructions': task_data.get('instructions', ''),
                'platform': task_data.get('platform'),
                'action': task_data.get('action'),
                'url': task_data.get('url', ''),
                'channel_username': task_data.get('channel_username', ''),
                'is_active': task_data.get('is_active', True),
                'priority': task_data.get('priority', 1),
                'created_at': task_data.get('created_at'),
                'updated_at': task_data.get('updated_at'),
                'expires_at': task_data.get('expires_at')
            }

            # Винагорода
            processed['reward'] = {
                'winix': task_data.get('reward_winix', 0),
                'tickets': task_data.get('reward_tickets', 0)
            }

            # Вимоги та метадані
            processed['requirements'] = task_data.get('requirements', {})
            processed['metadata'] = task_data.get('metadata', {})

            # Додаткові поля для лімітованих завдань
            if processed['type'] == TaskType.LIMITED.value and processed['expires_at']:
                expires_at = datetime.fromisoformat(processed['expires_at'].replace('Z', '+00:00'))
                now = datetime.now(timezone.utc)

                processed['time_remaining'] = max(0, int((expires_at - now).total_seconds()))
                processed['is_expired'] = now > expires_at

            return processed

        except Exception as e:
            logger.error(f"Помилка обробки даних завдання: {str(e)}")
            return None

    def _get_user_task_status(self, telegram_id: str, task_id: str) -> Optional[Dict[str, Any]]:
        """Отримання статусу завдання для користувача"""
        try:
            def fetch_status():
                response = supabase.table(self.TABLE_USER_TASKS) \
                    .select("*") \
                    .eq("telegram_id", telegram_id) \
                    .eq("task_id", task_id) \
                    .limit(1) \
                    .execute()

                return response.data[0] if response.data else None

            return retry_supabase(fetch_status)

        except Exception as e:
            logger.error(f"Помилка отримання статусу завдання: {str(e)}")
            return None

    def _create_user_task_status(self, user_task_data: Dict[str, Any]) -> bool:
        """Створення статусу завдання для користувача"""
        try:
            def create_status():
                response = supabase.table(self.TABLE_USER_TASKS) \
                    .insert(user_task_data) \
                    .execute()

                return bool(response.data)

            return retry_supabase(create_status)

        except Exception as e:
            logger.error(f"Помилка створення статусу завдання: {str(e)}")
            return False

    def _update_user_task_status(self, telegram_id: str, task_id: str,
                                 update_data: Dict[str, Any]) -> bool:
        """Оновлення статусу завдання для користувача"""
        try:
            def update_status():
                response = supabase.table(self.TABLE_USER_TASKS) \
                    .update(update_data) \
                    .eq("telegram_id", telegram_id) \
                    .eq("task_id", task_id) \
                    .execute()

                return bool(response.data)

            return retry_supabase(update_status)

        except Exception as e:
            logger.error(f"Помилка оновлення статусу завдання: {str(e)}")
            return False

    def _is_task_available_for_user(self, task: Dict[str, Any], telegram_id: str,
                                    user_status: Optional[Dict[str, Any]] = None) -> bool:
        """Перевірка доступності завдання для користувача"""
        try:
            # Перевіряємо чи завдання активне
            if not task.get('is_active', False):
                return False

            # Перевіряємо прострочення
            if task.get('expires_at'):
                expires_at = datetime.fromisoformat(task['expires_at'].replace('Z', '+00:00'))
                if datetime.now(timezone.utc) > expires_at:
                    return False

            # Перевіряємо вимоги
            requirements = task.get('requirements', {})

            if requirements:
                # Тут можна додати логіку перевірки вимог
                # наприклад, мінімальний рівень, бейджі тощо
                pass

            return True

        except Exception as e:
            logger.error(f"Помилка перевірки доступності завдання: {str(e)}")
            return False

    def _perform_task_verification(self, task: Dict[str, Any], telegram_id: str,
                                   verification_data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Виконання верифікації завдання"""
        try:
            task_type = task.get('type')
            task_platform = task.get('platform')
            task_action = task.get('action')

            # Автоматична верифікація для деяких типів завдань
            if task.get('metadata', {}).get('verification_type') == 'auto':
                return {
                    'success': True,
                    'message': 'Завдання автоматично верифіковано'
                }

            # Верифікація соціальних завдань
            if task_type == TaskType.SOCIAL.value:
                return self._verify_social_task(task, telegram_id, verification_data)

            # Для інших типів - поки що автоматичне підтвердження
            return {
                'success': True,
                'message': 'Завдання верифіковано'
            }

        except Exception as e:
            logger.error(f"Помилка верифікації завдання: {str(e)}")
            return {
                'success': False,
                'message': 'Помилка верифікації',
                'error_code': 'VERIFICATION_ERROR'
            }

    def _verify_social_task(self, task: Dict[str, Any], telegram_id: str,
                            verification_data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Верифікація соціального завдання"""
        try:
            platform = task.get('platform')
            action = task.get('action')

            # Для Telegram завдань
            if platform == TaskPlatform.TELEGRAM.value:
                return self._verify_telegram_task(task, telegram_id, verification_data)

            # Для інших платформ - імітація перевірки
            # В реальному проекті тут буде інтеграція з API соціальних мереж

            # Симулюємо затримку верифікації
            import time
            time.sleep(1)

            # 90% успішних верифікацій для демонстрації
            import random
            if random.random() < 0.9:
                return {
                    'success': True,
                    'message': f'Завдання {platform} верифіковано'
                }
            else:
                return {
                    'success': False,
                    'message': 'Не вдалося підтвердити виконання завдання',
                    'error_code': 'VERIFICATION_FAILED',
                    'retry_allowed': True,
                    'retry_after': 300  # 5 хвилин
                }

        except Exception as e:
            logger.error(f"Помилка верифікації соціального завдання: {str(e)}")
            return {
                'success': False,
                'message': 'Помилка верифікації соціального завдання',
                'error_code': 'SOCIAL_VERIFICATION_ERROR'
            }

    def _verify_telegram_task(self, task: Dict[str, Any], telegram_id: str,
                              verification_data: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
        """Верифікація Telegram завдання"""
        try:
            # Тут буде інтеграція з Telegram Bot API для перевірки підписки
            # Поки що повертаємо успішну верифікацію

            channel_username = task.get('channel_username', '')
            action = task.get('action')

            if action == TaskAction.SUBSCRIBE.value and channel_username:
                # В реальному проекті тут буде запит до Telegram API
                # bot.get_chat_member(chat_id=channel_username, user_id=telegram_id)

                logger.info(f"Перевірка підписки користувача {telegram_id} на канал {channel_username}")

                # Симулюємо успішну перевірку
                return {
                    'success': True,
                    'message': f'Підписка на канал {channel_username} підтверджена'
                }

            return {
                'success': True,
                'message': 'Telegram завдання виконано'
            }

        except Exception as e:
            logger.error(f"Помилка верифікації Telegram завдання: {str(e)}")
            return {
                'success': False,
                'message': 'Помилка верифікації Telegram завдання',
                'error_code': 'TELEGRAM_VERIFICATION_ERROR'
            }

    def _award_task_completion(self, telegram_id: str, task: Dict[str, Any]) -> Dict[str, Any]:
        """Нарахування винагороди за виконання завдання"""
        try:
            reward = task.get('reward', {})
            winix_amount = reward.get('winix', 0)
            tickets_amount = reward.get('tickets', 0)

            if winix_amount <= 0 and tickets_amount <= 0:
                return {
                    'success': True,
                    'message': 'Винагорода відсутня',
                    'reward': {}
                }

            # Імпортуємо функції роботи з балансом
            try:
                from supabase_client import update_balance, update_coins
            except ImportError:
                from backend.supabase_client import update_balance, update_coins

            awarded_reward = {}

            # Нараховуємо WINIX
            if winix_amount > 0:
                winix_result = update_balance(telegram_id, winix_amount)
                if winix_result:
                    awarded_reward['winix'] = winix_amount
                    logger.info(f"Нараховано {winix_amount} WINIX користувачу {telegram_id}")

            # Нараховуємо tickets
            if tickets_amount > 0:
                tickets_result = update_coins(telegram_id, tickets_amount)
                if tickets_result:
                    awarded_reward['tickets'] = tickets_amount
                    logger.info(f"Нараховано {tickets_amount} tickets користувачу {telegram_id}")

            # Створюємо транзакцію
            self._create_task_completion_transaction(telegram_id, task, awarded_reward)

            return {
                'success': True,
                'message': 'Винагорода нарахована',
                'reward': awarded_reward
            }

        except Exception as e:
            logger.error(f"Помилка нарахування винагороди за завдання: {str(e)}")
            return {
                'success': False,
                'message': 'Помилка нарахування винагороди',
                'error_code': 'REWARD_FAILED'
            }

    def _create_task_completion_transaction(self, telegram_id: str, task: Dict[str, Any],
                                            reward: Dict[str, Any]) -> None:
        """Створення транзакції для виконання завдання"""
        try:
            if not reward:
                return

            now = datetime.now(timezone.utc)

            transaction_record = {
                'telegram_id': telegram_id,
                'type': 'task_completion',
                'amount': reward.get('winix', 0),
                'description': f'Виконання завдання: {task.get("title", "Невідоме завдання")}',
                'status': 'completed',
                'metadata': {
                    'task_id': task['id'],
                    'task_title': task.get('title', ''),
                    'task_type': task.get('type', ''),
                    'reward': reward
                },
                'created_at': now.isoformat(),
                'updated_at': now.isoformat()
            }

            def create_transaction():
                supabase.table("transactions") \
                    .insert(transaction_record) \
                    .execute()

            retry_supabase(create_transaction)
            logger.debug(f"Транзакція завдання створена для {telegram_id}")

        except Exception as e:
            logger.error(f"Помилка створення транзакції завдання: {str(e)}")

    def _validate_task_data(self, task_data: Dict[str, Any]) -> Dict[str, Any]:
        """Валідація даних завдання"""
        try:
            errors = []

            # Перевіряємо обов'язкові поля
            required_fields = ['type', 'title']
            for field in required_fields:
                if field not in task_data or not task_data[field]:
                    errors.append(f"Поле '{field}' обов'язкове")

            # Валідуємо тип завдання
            if 'type' in task_data:
                try:
                    TaskType(task_data['type'])
                except ValueError:
                    errors.append(f"Невалідний тип завдання: {task_data['type']}")

            # Валідуємо платформу для соціальних завдань
            if task_data.get('type') == TaskType.SOCIAL.value:
                if 'platform' not in task_data:
                    errors.append("Платформа обов'язкова для соціальних завдань")
                else:
                    try:
                        TaskPlatform(task_data['platform'])
                    except ValueError:
                        errors.append(f"Невалідна платформа: {task_data['platform']}")

            # Валідуємо винагороду
            reward = task_data.get('reward', {})
            if reward:
                winix = reward.get('winix', 0)
                tickets = reward.get('tickets', 0)

                if not isinstance(winix, int) or winix < 0:
                    errors.append("Невалідна винагорода WINIX")

                if not isinstance(tickets, int) or tickets < 0:
                    errors.append("Невалідна винагорода tickets")

            return {
                'valid': len(errors) == 0,
                'error': '; '.join(errors) if errors else None
            }

        except Exception as e:
            logger.error(f"Помилка валідації даних завдання: {str(e)}")
            return {
                'valid': False,
                'error': 'Помилка валідації'
            }

    @cached(timeout=1800)  # Кеш на 30 хвилин
    def get_tasks_statistics(self) -> Dict[str, Any]:
        """Отримання статистики завдань"""
        try:
            logger.info("Отримання статистики завдань")

            def fetch_stats():
                # Загальна кількість завдань
                total_tasks_response = supabase.table(self.TABLE_TASKS) \
                    .select("id", count="exact") \
                    .execute()

                total_tasks = total_tasks_response.count if total_tasks_response.count else 0

                # Активні завдання
                active_tasks_response = supabase.table(self.TABLE_TASKS) \
                    .select("id", count="exact") \
                    .eq("is_active", True) \
                    .execute()

                active_tasks = active_tasks_response.count if active_tasks_response.count else 0

                # Статистика по типах
                types_response = supabase.table(self.TABLE_TASKS) \
                    .select("type") \
                    .eq("is_active", True) \
                    .execute()

                type_stats = {}
                if types_response.data:
                    for task in types_response.data:
                        task_type = task['type']
                        type_stats[task_type] = type_stats.get(task_type, 0) + 1

                # Загальна кількість виконань
                total_completions_response = supabase.table(self.TABLE_USER_TASKS) \
                    .select("id", count="exact") \
                    .eq("status", TaskStatus.COMPLETED.value) \
                    .execute()

                total_completions = total_completions_response.count if total_completions_response.count else 0

                # Унікальні користувачі
                users_response = supabase.table(self.TABLE_USER_TASKS) \
                    .select("telegram_id") \
                    .execute()

                unique_users = len(
                    set(user['telegram_id'] for user in users_response.data)) if users_response.data else 0

                return {
                    'total_tasks': total_tasks,
                    'active_tasks': active_tasks,
                    'type_distribution': type_stats,
                    'total_completions': total_completions,
                    'unique_users': unique_users,
                    'average_completions_per_user': round(total_completions / unique_users,
                                                          2) if unique_users > 0 else 0
                }

            return retry_supabase(fetch_stats)

        except Exception as e:
            logger.error(f"Помилка отримання статистики завдань: {str(e)}")
            return {
                'total_tasks': 0,
                'active_tasks': 0,
                'type_distribution': {},
                'total_completions': 0,
                'unique_users': 0,
                'average_completions_per_user': 0,
                'error': str(e)
            }


# Ініціалізація моделі
task_model = TaskModel()

# Експорт
__all__ = [
    'TaskModel',
    'TaskType',
    'TaskStatus',
    'TaskPlatform',
    'TaskAction',
    'TaskReward',
    'TaskRequirements',
    'TaskMetadata',
    'task_model'
]