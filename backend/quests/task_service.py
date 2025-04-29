"""
Сервіс для роботи з завданнями в системі WINIX.
Надає функціонал для створення, отримання та управління завданнями.
"""
import logging
import sys
import os
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional, Tuple

# Додаємо кореневу папку проекту до шляху
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
if parent_dir not in sys.path:
    sys.path.append(parent_dir)

# Імпорт моделей та інших залежностей
from models.user_progress import UserProgress, STATUS_NOT_STARTED, STATUS_IN_PROGRESS, STATUS_COMPLETED, STATUS_VERIFIED
from supabase_client import supabase, cached

# Визначаємо константу, якщо вона не доступна в моделі
STATUS_REJECTED = "rejected"

# Налаштування логування
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class TaskService:
    """
    Сервіс для роботи з завданнями в системі.
    Надає методи для отримання, створення та управління завданнями.
    """

    @staticmethod
    def normalize_date(date_obj):
        """
        Нормалізує дату, додаючи часовий пояс, якщо він відсутній

        Args:
            date_obj: Об'єкт datetime для нормалізації

        Returns:
            Об'єкт datetime з часовим поясом UTC
        """
        if date_obj is None:
            return None

        if isinstance(date_obj, str):
            try:
                if 'Z' in date_obj:
                    date_obj = date_obj.replace('Z', '+00:00')
                date_obj = datetime.fromisoformat(date_obj)
            except ValueError:
                try:
                    date_obj = datetime.strptime(date_obj, "%Y-%m-%dT%H:%M:%S.%f")
                except ValueError:
                    try:
                        date_obj = datetime.strptime(date_obj, "%Y-%m-%d %H:%M:%S")
                    except ValueError:
                        logger.error(f"Не вдалося розпізнати формат дати: {date_obj}")
                        return None

        if isinstance(date_obj, datetime) and not date_obj.tzinfo:
            date_obj = date_obj.replace(tzinfo=timezone.utc)

        return date_obj

    @staticmethod
    def execute_query(query):
        """
        Виконує запит до бази даних і обробляє помилки

        Args:
            query: Об'єкт запиту Supabase

        Returns:
            Результат запиту або None у випадку помилки
        """
        try:
            response = query.execute()
            return response
        except Exception as e:
            logger.error(f"Помилка виконання запиту до бази даних: {str(e)}")
            return None

    @staticmethod
    @cached(timeout=300)  # Кешуємо на 5 хвилин
    def get_all_tasks() -> List[Dict]:
        """
        Отримує всі завдання з бази даних

        Returns:
            List[Dict]: Список всіх завдань у форматі словників
        """
        try:
            logger.info("Отримання всіх завдань")
            response = TaskService.execute_query(
                supabase.table('tasks').select('*').order('created_at', desc=True)
            )

            if not response or not response.data:
                logger.info("Завдання не знайдено")
                return []

            tasks = []
            for task_data in response.data:
                try:
                    # Нормалізуємо дати
                    if 'start_date' in task_data and task_data['start_date']:
                        task_data['start_date'] = TaskService.normalize_date(task_data['start_date'])

                    if 'end_date' in task_data and task_data['end_date']:
                        task_data['end_date'] = TaskService.normalize_date(task_data['end_date'])

                    # Конвертуємо в словник замість створення об'єкта Task
                    tasks.append(task_data)
                except Exception as e:
                    logger.error(f"Помилка при обробці даних завдання: {str(e)}")

            logger.info(f"Отримано {len(tasks)} завдань")
            return tasks
        except Exception as e:
            logger.error(f"Помилка при отриманні завдань: {str(e)}")
            return []

    @staticmethod
    @cached(timeout=300)  # Кешуємо на 5 хвилин
    def get_task_by_id(task_id: str) -> Optional[Dict]:
        """
        Отримує завдання за ID

        Args:
            task_id (str): ID завдання

        Returns:
            Optional[Dict]: Знайдене завдання як словник або None
        """
        try:
            logger.info(f"Отримання завдання з ID {task_id}")
            response = TaskService.execute_query(
                supabase.table('tasks').select('*').eq('id', task_id)
            )

            if not response or not response.data:
                logger.info(f"Завдання з ID {task_id} не знайдено")
                return None

            task_data = response.data[0]

            # Нормалізуємо дати
            if 'start_date' in task_data and task_data['start_date']:
                task_data['start_date'] = TaskService.normalize_date(task_data['start_date'])

            if 'end_date' in task_data and task_data['end_date']:
                task_data['end_date'] = TaskService.normalize_date(task_data['end_date'])

            logger.info(f"Отримано завдання: {task_id}")
            return task_data
        except Exception as e:
            logger.error(f"Помилка при отриманні завдання {task_id}: {str(e)}")
            return None

    @staticmethod
    def get_tasks_by_type(task_type: str) -> List[Dict]:
        """
        Отримує завдання за типом

        Args:
            task_type (str): Тип завдання (social, partner, limited, daily)

        Returns:
            List[Dict]: Список завдань вказаного типу
        """
        try:
            logger.info(f"Отримання завдань типу {task_type}")
            response = TaskService.execute_query(
                supabase.table('tasks').select('*').eq('task_type', task_type).order('created_at', desc=True)
            )

            if not response or not response.data:
                logger.info(f"Завдання типу {task_type} не знайдено")
                return []

            tasks = []
            for task_data in response.data:
                try:
                    # Нормалізуємо дати
                    if 'start_date' in task_data and task_data['start_date']:
                        task_data['start_date'] = TaskService.normalize_date(task_data['start_date'])

                    if 'end_date' in task_data and task_data['end_date']:
                        task_data['end_date'] = TaskService.normalize_date(task_data['end_date'])

                    # Перевіряємо, чи завдання активне
                    if TaskService.is_task_active(task_data):
                        tasks.append(task_data)
                except Exception as e:
                    logger.error(f"Помилка при обробці даних завдання: {str(e)}")

            logger.info(f"Отримано {len(tasks)} завдань типу {task_type}")
            return tasks
        except Exception as e:
            logger.error(f"Помилка при отриманні завдань типу {task_type}: {str(e)}")
            return []

    @staticmethod
    def is_task_active(task_data: Dict) -> bool:
        """
        Перевіряє, чи завдання активне (за статусом та датами)

        Args:
            task_data: Дані завдання

        Returns:
            bool: True, якщо завдання активне
        """
        if task_data.get('status') != 'active':
            return False

        now = datetime.now(timezone.utc)

        # Перевіряємо дату початку
        start_date = task_data.get('start_date')
        if start_date and start_date > now:
            return False

        # Перевіряємо дату завершення
        end_date = task_data.get('end_date')
        if end_date and end_date < now:
            return False

        return True

    @staticmethod
    def get_active_tasks() -> List[Dict]:
        """
        Отримує всі активні завдання

        Returns:
            List[Dict]: Список активних завдань
        """
        try:
            logger.info("Отримання активних завдань")
            response = TaskService.execute_query(
                supabase.table('tasks').select('*').eq('status', 'active')
            )

            if not response or not response.data:
                logger.info("Активні завдання не знайдено")
                return []

            # Використовуємо UTC для поточного часу
            now = datetime.now(timezone.utc)
            active_tasks = []

            for task_data in response.data:
                try:
                    # Нормалізуємо дати
                    if 'start_date' in task_data and task_data['start_date']:
                        task_data['start_date'] = TaskService.normalize_date(task_data['start_date'])

                    if 'end_date' in task_data and task_data['end_date']:
                        task_data['end_date'] = TaskService.normalize_date(task_data['end_date'])

                    if TaskService.is_task_active(task_data):
                        active_tasks.append(task_data)
                except Exception as e:
                    logger.error(f"Помилка при обробці даних завдання: {str(e)}")

            logger.info(f"Отримано {len(active_tasks)} активних завдань")
            return active_tasks
        except Exception as e:
            logger.error(f"Помилка при отриманні активних завдань: {str(e)}")
            return []

    @staticmethod
    def get_tasks_for_user(telegram_id: str) -> Tuple[List[Dict], List[Dict]]:
        """
        Отримує завдання для користувача з інформацією про прогрес

        Args:
            telegram_id (str): Telegram ID користувача

        Returns:
            Tuple[List[Dict], List[Dict]]: Кортеж (доступні завдання, виконані завдання)
        """
        try:
            logger.info(f"Отримання завдань для користувача {telegram_id}")
            # Отримуємо всі активні завдання
            all_tasks = TaskService.get_active_tasks()

            # Отримуємо прогрес користувача
            progress_response = TaskService.execute_query(
                supabase.table('user_progress').select('*').eq('telegram_id', str(telegram_id))
            )

            # Створюємо словник прогресу для швидкого доступу
            progress_dict = {}
            if progress_response and progress_response.data:
                for progress_data in progress_response.data:
                    task_id = progress_data.get('task_id')
                    if task_id:
                        progress_dict[task_id] = progress_data

            # Розділяємо завдання на доступні та виконані
            available_tasks = []
            completed_tasks = []

            for task in all_tasks:
                task_id = task.get('id')
                task_copy = task.copy()  # Створюємо копію, щоб не змінювати оригінал

                # Додаємо інформацію про прогрес
                if task_id in progress_dict:
                    progress = progress_dict[task_id]
                    progress_info = progress.copy()

                    # Видаляємо зайві поля
                    if 'verification_data' in progress_info:
                        del progress_info['verification_data']

                    task_copy['progress'] = progress_info

                    # Розділяємо на доступні та виконані
                    if progress.get('status') in [STATUS_COMPLETED, STATUS_VERIFIED]:
                        completed_tasks.append(task_copy)
                    else:
                        available_tasks.append(task_copy)
                else:
                    # Якщо немає прогресу, створюємо базовий прогрес
                    task_copy['progress'] = {
                        'status': STATUS_NOT_STARTED,
                        'progress_value': 0,
                        'max_progress': task.get('target_value', 100),
                        'progress_percent': 0
                    }
                    available_tasks.append(task_copy)

            logger.info(f"Отримано {len(available_tasks)} доступних та {len(completed_tasks)} виконаних завдань для користувача {telegram_id}")
            return available_tasks, completed_tasks
        except Exception as e:
            logger.error(f"Помилка при отриманні завдань для користувача {telegram_id}: {str(e)}")
            return [], []

    @staticmethod
    def create_task(task_data: Dict[str, Any]) -> Optional[Dict]:
        """
        Створює нове завдання

        Args:
            task_data (Dict[str, Any]): Дані для створення завдання

        Returns:
            Optional[Dict]: Створене завдання або None у випадку помилки
        """
        try:
            logger.info("Створення нового завдання")
            # Переконуємось, що обов'язкові поля присутні
            required_fields = ["title", "description", "task_type", "reward_type", "reward_amount"]
            for field in required_fields:
                if field not in task_data:
                    logger.error(f"Відсутнє обов'язкове поле: {field}")
                    return None

            # Нормалізуємо дати
            if 'start_date' in task_data and task_data['start_date']:
                task_data['start_date'] = TaskService.normalize_date(task_data['start_date'])

            if 'end_date' in task_data and task_data['end_date']:
                task_data['end_date'] = TaskService.normalize_date(task_data['end_date'])

            # Додаємо created_at, якщо не передано
            if 'created_at' not in task_data:
                task_data['created_at'] = datetime.now(timezone.utc).isoformat()

            # Зберігаємо в базі даних
            response = TaskService.execute_query(
                supabase.table('tasks').insert(task_data)
            )

            if not response or not response.data:
                logger.error("Не вдалося створити завдання")
                return None

            created_task = response.data[0]
            logger.info(f"Створено нове завдання з ID: {created_task.get('id')}")
            return created_task
        except Exception as e:
            logger.error(f"Помилка при створенні завдання: {str(e)}")
            return None

    @staticmethod
    def update_task(task_id: str, update_data: Dict[str, Any]) -> Optional[Dict]:
        """
        Оновлює існуюче завдання

        Args:
            task_id (str): ID завдання для оновлення
            update_data (Dict[str, Any]): Дані для оновлення

        Returns:
            Optional[Dict]: Оновлене завдання або None у випадку помилки
        """
        try:
            logger.info(f"Оновлення завдання {task_id}")
            # Отримуємо поточне завдання
            current_task = TaskService.get_task_by_id(task_id)

            if not current_task:
                logger.error(f"Завдання з ID {task_id} не знайдено")
                return None

            # Нормалізуємо дати
            if 'start_date' in update_data and update_data['start_date']:
                update_data['start_date'] = TaskService.normalize_date(update_data['start_date'])

            if 'end_date' in update_data and update_data['end_date']:
                update_data['end_date'] = TaskService.normalize_date(update_data['end_date'])

            # Додаємо updated_at
            update_data['updated_at'] = datetime.now(timezone.utc).isoformat()

            # Зберігаємо в базі даних
            response = TaskService.execute_query(
                supabase.table('tasks').update(update_data).eq('id', task_id)
            )

            if not response or not response.data:
                logger.error(f"Не вдалося оновити завдання {task_id}")
                return None

            updated_task = response.data[0]
            logger.info(f"Оновлено завдання: {task_id}")
            return updated_task
        except Exception as e:
            logger.error(f"Помилка при оновленні завдання {task_id}: {str(e)}")
            return None

    @staticmethod
    def delete_task(task_id: str) -> bool:
        """
        Видаляє завдання

        Args:
            task_id (str): ID завдання для видалення

        Returns:
            bool: True якщо видалення успішне, False у випадку помилки
        """
        try:
            logger.info(f"Видалення завдання {task_id}")
            # Видаляємо з бази даних
            response = TaskService.execute_query(
                supabase.table('tasks').delete().eq('id', task_id)
            )

            if not response or not response.data:
                logger.error(f"Не вдалося видалити завдання {task_id}")
                return False

            logger.info(f"Видалено завдання з ID {task_id}")
            return True
        except Exception as e:
            logger.error(f"Помилка при видаленні завдання {task_id}: {str(e)}")
            return False

    @staticmethod
    def start_task(telegram_id: str, task_id: str) -> Optional[Dict]:
        """
        Починає виконання завдання користувачем

        Args:
            telegram_id (str): Telegram ID користувача
            task_id (str): ID завдання

        Returns:
            Optional[Dict]: Об'єкт прогресу або None у випадку помилки
        """
        try:
            logger.info(f"Початок виконання завдання {task_id} користувачем {telegram_id}")
            # Перевіряємо, чи існує завдання
            task = TaskService.get_task_by_id(task_id)

            if not task:
                logger.error(f"Завдання з ID {task_id} не знайдено")
                return None

            # Перевіряємо, чи завдання активне
            if not TaskService.is_task_active(task):
                logger.error(f"Завдання з ID {task_id} не активне")
                return None

            # Перевіряємо, чи вже є прогрес для цього завдання
            progress_response = TaskService.execute_query(
                supabase.table('user_progress').select('*').eq('telegram_id', str(telegram_id)).eq('task_id', task_id)
            )

            if progress_response and progress_response.data:
                # Якщо прогрес вже існує, повертаємо його
                progress = progress_response.data[0]

                # Якщо завдання не розпочато, оновлюємо статус
                if progress.get('status') == STATUS_NOT_STARTED:
                    progress['status'] = STATUS_IN_PROGRESS
                    progress['start_date'] = datetime.now(timezone.utc).isoformat()

                    # Зберігаємо оновлений прогрес
                    update_response = TaskService.execute_query(
                        supabase.table('user_progress').update(progress).eq('id', progress.get('id'))
                    )

                    if not update_response or not update_response.data:
                        logger.error("Не вдалося оновити прогрес")
                        return None

                    progress = update_response.data[0]

                logger.info(f"Користувач {telegram_id} вже розпочав завдання {task_id}")
                return progress

            # Створюємо новий прогрес
            target_value = task.get('target_value', 100)
            progress_data = {
                'telegram_id': telegram_id,
                'task_id': task_id,
                'status': STATUS_IN_PROGRESS,
                'progress_value': 0,
                'max_progress': target_value,
                'progress_percent': 0,
                'start_date': datetime.now(timezone.utc).isoformat(),
                'attempts': 0,
                'verification_data': {},
                'created_at': datetime.now(timezone.utc).isoformat()
            }

            # Зберігаємо в базі даних
            response = TaskService.execute_query(
                supabase.table('user_progress').insert(progress_data)
            )

            if not response or not response.data:
                logger.error("Не вдалося створити прогрес")
                return None

            progress = response.data[0]
            logger.info(f"Користувач {telegram_id} розпочав завдання {task_id}")
            return progress
        except Exception as e:
            logger.error(f"Помилка при початку виконання завдання {task_id} користувачем {telegram_id}: {str(e)}")
            return None

    @staticmethod
    def update_progress(telegram_id: str, task_id: str, progress_value: int, verification_data: Optional[Dict[str, Any]] = None) -> Optional[Dict]:
        """
        Оновлює прогрес виконання завдання користувачем

        Args:
            telegram_id (str): Telegram ID користувача
            task_id (str): ID завдання
            progress_value (int): Нове значення прогресу
            verification_data (Dict[str, Any], optional): Дані для верифікації

        Returns:
            Optional[Dict]: Оновлений об'єкт прогресу або None у випадку помилки
        """
        try:
            logger.info(f"Оновлення прогресу для завдання {task_id} користувачем {telegram_id}")
            # Отримуємо завдання
            task = TaskService.get_task_by_id(task_id)

            if not task:
                logger.error(f"Завдання з ID {task_id} не знайдено")
                return None

            # Валідуємо progress_value
            if progress_value < 0:
                logger.error(f"Значення прогресу не може бути від'ємним: {progress_value}")
                return None

            # Отримуємо поточний прогрес
            progress_response = TaskService.execute_query(
                supabase.table('user_progress').select('*').eq('telegram_id', str(telegram_id)).eq('task_id', task_id)
            )

            if not progress_response or not progress_response.data:
                # Якщо прогресу немає, створюємо новий
                return TaskService.start_task(telegram_id, task_id)

            # Оновлюємо прогрес
            progress = progress_response.data[0]

            # Якщо завдання вже виконано, не оновлюємо прогрес
            if progress.get('status') in [STATUS_COMPLETED, STATUS_VERIFIED]:
                logger.info(f"Завдання {task_id} вже виконано користувачем {telegram_id}")
                return progress

            # Оновлюємо значення прогресу
            target_value = task.get('target_value', 100)
            progress['progress_value'] = progress_value
            progress['progress_percent'] = min(100, int((progress_value / target_value) * 100))
            progress['last_updated'] = datetime.now(timezone.utc).isoformat()

            # Якщо прогрес досяг максимуму, змінюємо статус
            if progress_value >= target_value:
                progress['status'] = STATUS_COMPLETED
                progress['completion_date'] = datetime.now(timezone.utc).isoformat()

            # Додаємо дані для верифікації, якщо вони є
            if verification_data:
                existing_data = progress.get('verification_data', {})
                if not existing_data:
                    existing_data = {}
                existing_data.update(verification_data)
                progress['verification_data'] = existing_data

            # Зберігаємо оновлений прогрес
            update_response = TaskService.execute_query(
                supabase.table('user_progress').update(progress).eq('id', progress.get('id'))
            )

            if not update_response or not update_response.data:
                logger.error("Не вдалося оновити прогрес")
                return None

            updated_progress = update_response.data[0]
            logger.info(f"Оновлено прогрес користувача {telegram_id} для завдання {task_id}: {progress_value}/{target_value}")

            # Якщо прогрес досягнув максимуму, викликаємо подію завершення завдання
            if updated_progress.get('status') == STATUS_COMPLETED:
                logger.info(f"Користувач {telegram_id} виконав завдання {task_id}")
                # Тут можна додати логіку для відправки події

            return updated_progress
        except Exception as e:
            logger.error(f"Помилка при оновленні прогресу для завдання {task_id} користувачем {telegram_id}: {str(e)}")
            return None

    @staticmethod
    def verify_task(telegram_id: str, task_id: str, is_verified: bool, verification_comment: Optional[str] = None) -> Optional[Dict]:
        """
        Підтверджує або відхиляє виконання завдання

        Args:
            telegram_id (str): Telegram ID користувача
            task_id (str): ID завдання
            is_verified (bool): True для підтвердження, False для відхилення
            verification_comment (str, optional): Коментар до верифікації

        Returns:
            Optional[Dict]: Оновлений об'єкт прогресу або None у випадку помилки
        """
        try:
            logger.info(f"Верифікація завдання {task_id} для користувача {telegram_id}")
            # Отримуємо поточний прогрес
            progress_response = TaskService.execute_query(
                supabase.table('user_progress').select('*').eq('telegram_id', str(telegram_id)).eq('task_id', task_id)
            )

            if not progress_response or not progress_response.data:
                logger.error(f"Прогрес для завдання {task_id} користувача {telegram_id} не знайдено")
                return None

            # Оновлюємо прогрес
            progress = progress_response.data[0]

            # Оновлюємо статус
            if is_verified:
                progress['status'] = STATUS_VERIFIED
            else:
                progress['status'] = STATUS_REJECTED

            # Додаємо коментар до верифікації
            if verification_comment:
                verification_data = progress.get('verification_data', {})
                if not verification_data:
                    verification_data = {}
                verification_data['verification_comment'] = verification_comment
                progress['verification_data'] = verification_data

            # Зберігаємо оновлений прогрес
            update_response = TaskService.execute_query(
                supabase.table('user_progress').update(progress).eq('id', progress.get('id'))
            )

            if not update_response or not update_response.data:
                logger.error("Не вдалося оновити прогрес")
                return None

            if is_verified:
                logger.info(f"Завдання {task_id} успішно верифіковано для користувача {telegram_id}")
            else:
                logger.info(f"Завдання {task_id} відхилено для користувача {telegram_id}")

            return update_response.data[0]
        except Exception as e:
            logger.error(f"Помилка при верифікації завдання {task_id} для користувача {telegram_id}: {str(e)}")
            return None

    @staticmethod
    def get_user_progress(telegram_id: str, task_id: Optional[str] = None) -> List[Dict]:
        """
        Отримує прогрес користувача для одного або всіх завдань

        Args:
            telegram_id (str): Telegram ID користувача
            task_id (str, optional): ID завдання (якщо потрібно отримати прогрес для конкретного завдання)

        Returns:
            List[Dict]: Список об'єктів прогресу
        """
        try:
            logger.info(f"Отримання прогресу для користувача {telegram_id}")
            # Формуємо запит
            query = supabase.table('user_progress').select('*').eq('telegram_id', str(telegram_id))

            if task_id:
                query = query.eq('task_id', task_id)

            # Виконуємо запит
            response = TaskService.execute_query(query)

            if not response or not response.data:
                logger.info(f"Прогрес для користувача {telegram_id} не знайдено")
                return []

            progress_list = response.data
            logger.info(f"Отримано {len(progress_list)} записів прогресу для користувача {telegram_id}")
            return progress_list
        except Exception as e:
            logger.error(f"Помилка при отриманні прогресу користувача {telegram_id}: {str(e)}")
            return []

    @staticmethod
    def get_single_progress(telegram_id: str, task_id: str) -> Optional[Dict]:
        """
        Отримує прогрес користувача для конкретного завдання

        Args:
            telegram_id (str): Telegram ID користувача
            task_id (str): ID завдання

        Returns:
            Optional[Dict]: Об'єкт прогресу або None, якщо прогрес не знайдено
        """
        try:
            logger.info(f"Отримання прогресу для завдання {task_id} користувача {telegram_id}")
            progress_list = TaskService.get_user_progress(telegram_id, task_id)

            if not progress_list:
                logger.info(f"Прогрес для завдання {task_id} користувача {telegram_id} не знайдено")
                return None

            return progress_list[0]
        except Exception as e:
            logger.error(f"Помилка при отриманні прогресу для завдання {task_id} користувача {telegram_id}: {str(e)}")
            return None