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
from models.task import Task, TASK_TYPE_SOCIAL, TASK_TYPE_PARTNER, TASK_TYPE_LIMITED, TASK_TYPE_DAILY
from models.user_progress import UserProgress, STATUS_NOT_STARTED, STATUS_IN_PROGRESS, STATUS_COMPLETED, STATUS_VERIFIED
from supabase_client import supabase, cached

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
    @cached(timeout=300)  # Кешуємо на 5 хвилин
    def get_all_tasks() -> List[Task]:
        """
        Отримує всі завдання з бази даних

        Returns:
            List[Task]: Список всіх завдань
        """
        try:
            response = supabase.table('tasks').select('*').order('created_at', desc=True).execute()

            if not response.data:
                logger.info("Завдання не знайдено")
                return []

            tasks = []
            for task_data in response.data:
                try:
                    task = Task.from_dict(task_data)
                    tasks.append(task)
                except Exception as e:
                    logger.error(f"Помилка при створенні об'єкта завдання: {str(e)}")

            logger.info(f"Отримано {len(tasks)} завдань")
            return tasks
        except Exception as e:
            logger.error(f"Помилка при отриманні завдань: {str(e)}")
            return []

    @staticmethod
    @cached(timeout=300)  # Кешуємо на 5 хвилин
    def get_task_by_id(task_id: str) -> Optional[Task]:
        """
        Отримує завдання за ID

        Args:
            task_id (str): ID завдання

        Returns:
            Optional[Task]: Знайдене завдання або None
        """
        try:
            response = supabase.table('tasks').select('*').eq('id', task_id).execute()

            if not response.data or len(response.data) == 0:
                logger.info(f"Завдання з ID {task_id} не знайдено")
                return None

            task_data = response.data[0]
            task = Task.from_dict(task_data)

            logger.info(f"Отримано завдання: {task}")
            return task
        except Exception as e:
            logger.error(f"Помилка при отриманні завдання {task_id}: {str(e)}")
            return None

    @staticmethod
    def get_tasks_by_type(task_type: str) -> List[Task]:
        """
        Отримує завдання за типом

        Args:
            task_type (str): Тип завдання (social, partner, limited, daily)

        Returns:
            List[Task]: Список завдань вказаного типу
        """
        try:
            response = supabase.table('tasks').select('*').eq('task_type', task_type).order('created_at', desc=True).execute()

            if not response.data:
                logger.info(f"Завдання типу {task_type} не знайдено")
                return []

            tasks = []
            for task_data in response.data:
                try:
                    task = Task.from_dict(task_data)
                    # Перевіряємо, чи завдання активне
                    if task.is_active():
                        tasks.append(task)
                except Exception as e:
                    logger.error(f"Помилка при створенні об'єкта завдання: {str(e)}")

            logger.info(f"Отримано {len(tasks)} завдань типу {task_type}")
            return tasks
        except Exception as e:
            logger.error(f"Помилка при отриманні завдань типу {task_type}: {str(e)}")
            return []

    @staticmethod
    def get_active_tasks() -> List[Task]:
        """
        Отримує всі активні завдання

        Returns:
            List[Task]: Список активних завдань
        """
        try:
            # Спочатку отримуємо всі завдання зі статусом 'active'
            response = supabase.table('tasks').select('*').eq('status', 'active').execute()

            if not response.data:
                logger.info("Активні завдання не знайдено")
                return []

            # Фільтруємо за датою
            # ВИПРАВЛЕННЯ: Використовуємо datetime з часовим поясом UTC
            now = datetime.now(timezone.utc)
            active_tasks = []

            for task_data in response.data:
                try:
                    task = Task.from_dict(task_data)

                    # ВИПРАВЛЕННЯ: Переконуємося, що дати мають часовий пояс
                    if task.start_date and not task.start_date.tzinfo:
                        task.start_date = task.start_date.replace(tzinfo=timezone.utc)
                    if task.end_date and not task.end_date.tzinfo:
                        task.end_date = task.end_date.replace(tzinfo=timezone.utc)

                    # Перевіряємо дату початку
                    if task.start_date and task.start_date > now:
                        continue

                    # Перевіряємо дату завершення
                    if task.end_date and task.end_date < now:
                        continue

                    active_tasks.append(task)
                except Exception as e:
                    logger.error(f"Помилка при створенні об'єкта завдання: {str(e)}")

            logger.info(f"Отримано {len(active_tasks)} активних завдань")
            return active_tasks
        except Exception as e:
            logger.error(f"Помилка при отриманні активних завдань: {str(e)}")
            return []

    @staticmethod
    def get_tasks_for_user(telegram_id: str) -> Tuple[List[Dict[str, Any]], List[Dict[str, Any]]]:
        """
        Отримує завдання для користувача з інформацією про прогрес

        Args:
            telegram_id (str): Telegram ID користувача

        Returns:
            Tuple[List[Dict], List[Dict]]: Кортеж (доступні завдання, виконані завдання)
        """
        try:
            # Отримуємо всі активні завдання
            all_tasks = TaskService.get_active_tasks()

            # Отримуємо прогрес користувача
            progress_response = supabase.table('user_progress').select('*').eq('telegram_id', str(telegram_id)).execute()

            # Створюємо словник прогресу для швидкого доступу
            progress_dict = {}
            if progress_response.data:
                for progress_data in progress_response.data:
                    task_id = progress_data.get('task_id')
                    if task_id:
                        progress_dict[task_id] = UserProgress.from_dict(progress_data)

            # Розділяємо завдання на доступні та виконані
            available_tasks = []
            completed_tasks = []

            for task in all_tasks:
                task_dict = task.to_dict()

                # Додаємо інформацію про прогрес
                if task.id in progress_dict:
                    progress = progress_dict[task.id]
                    progress_info = progress.to_dict()

                    # Видаляємо зайві поля
                    if 'verification_data' in progress_info:
                        del progress_info['verification_data']

                    task_dict['progress'] = progress_info

                    # Розділяємо на доступні та виконані
                    if progress.is_completed():
                        completed_tasks.append(task_dict)
                    else:
                        available_tasks.append(task_dict)
                else:
                    # Якщо немає прогресу, створюємо базовий прогрес
                    task_dict['progress'] = {
                        'status': STATUS_NOT_STARTED,
                        'progress_value': 0,
                        'max_progress': 100,
                        'progress_percent': 0
                    }
                    available_tasks.append(task_dict)

            logger.info(f"Отримано {len(available_tasks)} доступних та {len(completed_tasks)} виконаних завдань для користувача {telegram_id}")
            return available_tasks, completed_tasks
        except Exception as e:
            logger.error(f"Помилка при отриманні завдань для користувача {telegram_id}: {str(e)}")
            return [], []

    @staticmethod
    def create_task(task_data: Dict[str, Any]) -> Optional[Task]:
        """
        Створює нове завдання

        Args:
            task_data (Dict[str, Any]): Дані для створення завдання

        Returns:
            Optional[Task]: Створене завдання або None у випадку помилки
        """
        try:
            # Переконуємось, що обов'язкові поля присутні
            required_fields = ["title", "description", "task_type", "reward_type", "reward_amount"]
            for field in required_fields:
                if field not in task_data:
                    logger.error(f"Відсутнє обов'язкове поле: {field}")
                    return None

            # ВИПРАВЛЕННЯ: Переконуємося, що дати мають часовий пояс
            if 'start_date' in task_data and task_data['start_date'] and isinstance(task_data['start_date'], datetime):
                if not task_data['start_date'].tzinfo:
                    task_data['start_date'] = task_data['start_date'].replace(tzinfo=timezone.utc)

            if 'end_date' in task_data and task_data['end_date'] and isinstance(task_data['end_date'], datetime):
                if not task_data['end_date'].tzinfo:
                    task_data['end_date'] = task_data['end_date'].replace(tzinfo=timezone.utc)

            # Створюємо об'єкт завдання
            task = Task.from_dict(task_data)

            # Зберігаємо в базі даних
            response = supabase.table('tasks').insert(task.to_dict()).execute()

            if not response.data or len(response.data) == 0:
                logger.error("Не вдалося створити завдання")
                return None

            logger.info(f"Створено нове завдання: {task}")
            return task
        except Exception as e:
            logger.error(f"Помилка при створенні завдання: {str(e)}")
            return None

    @staticmethod
    def update_task(task_id: str, update_data: Dict[str, Any]) -> Optional[Task]:
        """
        Оновлює існуюче завдання

        Args:
            task_id (str): ID завдання для оновлення
            update_data (Dict[str, Any]): Дані для оновлення

        Returns:
            Optional[Task]: Оновлене завдання або None у випадку помилки
        """
        try:
            # Отримуємо поточне завдання
            current_task = TaskService.get_task_by_id(task_id)

            if not current_task:
                logger.error(f"Завдання з ID {task_id} не знайдено")
                return None

            # ВИПРАВЛЕННЯ: Переконуємося, що дати мають часовий пояс
            if 'start_date' in update_data and update_data['start_date'] and isinstance(update_data['start_date'], datetime):
                if not update_data['start_date'].tzinfo:
                    update_data['start_date'] = update_data['start_date'].replace(tzinfo=timezone.utc)

            if 'end_date' in update_data and update_data['end_date'] and isinstance(update_data['end_date'], datetime):
                if not update_data['end_date'].tzinfo:
                    update_data['end_date'] = update_data['end_date'].replace(tzinfo=timezone.utc)

            # Оновлюємо завдання
            updated_task = current_task.update(update_data)

            # Зберігаємо в базі даних
            response = supabase.table('tasks').update(updated_task.to_dict()).eq('id', task_id).execute()

            if not response.data or len(response.data) == 0:
                logger.error("Не вдалося оновити завдання")
                return None

            logger.info(f"Оновлено завдання: {updated_task}")
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
            # Видаляємо з бази даних
            response = supabase.table('tasks').delete().eq('id', task_id).execute()

            if not response.data or len(response.data) == 0:
                logger.error(f"Не вдалося видалити завдання {task_id}")
                return False

            logger.info(f"Видалено завдання з ID {task_id}")
            return True
        except Exception as e:
            logger.error(f"Помилка при видаленні завдання {task_id}: {str(e)}")
            return False

    @staticmethod
    def start_task(telegram_id: str, task_id: str) -> Optional[UserProgress]:
        """
        Починає виконання завдання користувачем

        Args:
            telegram_id (str): Telegram ID користувача
            task_id (str): ID завдання

        Returns:
            Optional[UserProgress]: Об'єкт прогресу або None у випадку помилки
        """
        try:
            # Перевіряємо, чи існує завдання
            task = TaskService.get_task_by_id(task_id)

            if not task:
                logger.error(f"Завдання з ID {task_id} не знайдено")
                return None

            # Перевіряємо, чи завдання активне
            if not task.is_active():
                logger.error(f"Завдання з ID {task_id} не активне")
                return None

            # Перевіряємо, чи вже є прогрес для цього завдання
            progress_response = supabase.table('user_progress').select('*').eq('telegram_id', str(telegram_id)).eq('task_id', task_id).execute()

            if progress_response.data and len(progress_response.data) > 0:
                # Якщо прогрес вже існує, повертаємо його
                progress = UserProgress.from_dict(progress_response.data[0])

                # Якщо завдання не розпочато, оновлюємо статус
                if progress.status == STATUS_NOT_STARTED:
                    progress.set_status(STATUS_IN_PROGRESS)

                    # Зберігаємо оновлений прогрес
                    update_response = supabase.table('user_progress').update(progress.to_dict()).eq('id', progress.id).execute()

                    if not update_response.data or len(update_response.data) == 0:
                        logger.error("Не вдалося оновити прогрес")
                        return None

                logger.info(f"Користувач {telegram_id} вже розпочав завдання {task_id}")
                return progress

            # Створюємо новий прогрес
            progress = UserProgress(
                telegram_id=telegram_id,
                task_id=task_id,
                status=STATUS_IN_PROGRESS,
                progress_value=0,
                max_progress=task.target_value
            )

            # Зберігаємо в базі даних
            response = supabase.table('user_progress').insert(progress.to_dict()).execute()

            if not response.data or len(response.data) == 0:
                logger.error("Не вдалося створити прогрес")
                return None

            logger.info(f"Користувач {telegram_id} розпочав завдання {task_id}")
            return progress
        except Exception as e:
            logger.error(f"Помилка при початку виконання завдання {task_id} користувачем {telegram_id}: {str(e)}")
            return None

    @staticmethod
    def update_progress(telegram_id: str, task_id: str, progress_value: int, verification_data: Optional[Dict[str, Any]] = None) -> Optional[UserProgress]:
        """
        Оновлює прогрес виконання завдання користувачем

        Args:
            telegram_id (str): Telegram ID користувача
            task_id (str): ID завдання
            progress_value (int): Нове значення прогресу
            verification_data (Dict[str, Any], optional): Дані для верифікації

        Returns:
            Optional[UserProgress]: Оновлений об'єкт прогресу або None у випадку помилки
        """
        try:
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
            progress_response = supabase.table('user_progress').select('*').eq('telegram_id', str(telegram_id)).eq('task_id', task_id).execute()

            if not progress_response.data or len(progress_response.data) == 0:
                # Якщо прогресу немає, створюємо новий
                return TaskService.start_task(telegram_id, task_id)

            # Оновлюємо прогрес
            progress = UserProgress.from_dict(progress_response.data[0])

            # Якщо завдання вже виконано, не оновлюємо прогрес
            if progress.is_completed():
                logger.info(f"Завдання {task_id} вже виконано користувачем {telegram_id}")
                return progress

            # Оновлюємо значення прогресу
            progress.update_progress(progress_value, task.target_value)

            # Додаємо дані для верифікації, якщо вони є
            if verification_data:
                progress.add_verification_data(verification_data)

            # Зберігаємо оновлений прогрес
            update_response = supabase.table('user_progress').update(progress.to_dict()).eq('id', progress.id).execute()

            if not update_response.data or len(update_response.data) == 0:
                logger.error("Не вдалося оновити прогрес")
                return None

            logger.info(f"Оновлено прогрес користувача {telegram_id} для завдання {task_id}: {progress_value}/{task.target_value}")

            # Якщо прогрес досягнув максимуму, викликаємо подію завершення завдання
            if progress.is_completed():
                logger.info(f"Користувач {telegram_id} виконав завдання {task_id}")
                # Тут можна додати логіку для відправки події

            return progress
        except Exception as e:
            logger.error(f"Помилка при оновленні прогресу для завдання {task_id} користувачем {telegram_id}: {str(e)}")
            return None

    @staticmethod
    def verify_task(telegram_id: str, task_id: str, is_verified: bool, verification_comment: Optional[str] = None) -> Optional[UserProgress]:
        """
        Підтверджує або відхиляє виконання завдання

        Args:
            telegram_id (str): Telegram ID користувача
            task_id (str): ID завдання
            is_verified (bool): True для підтвердження, False для відхилення
            verification_comment (str, optional): Коментар до верифікації

        Returns:
            Optional[UserProgress]: Оновлений об'єкт прогресу або None у випадку помилки
        """
        try:
            # Отримуємо поточний прогрес
            progress_response = supabase.table('user_progress').select('*').eq('telegram_id', str(telegram_id)).eq('task_id', task_id).execute()

            if not progress_response.data or len(progress_response.data) == 0:
                logger.error(f"Прогрес для завдання {task_id} користувача {telegram_id} не знайдено")
                return None

            # Оновлюємо прогрес
            progress = UserProgress.from_dict(progress_response.data[0])

            # Оновлюємо статус
            if is_verified:
                progress.set_status(STATUS_VERIFIED)
            else:
                progress.set_status("rejected")

            # Додаємо коментар до верифікації
            if verification_comment:
                progress.add_verification_data({"verification_comment": verification_comment})

            # Зберігаємо оновлений прогрес
            update_response = supabase.table('user_progress').update(progress.to_dict()).eq('id', progress.id).execute()

            if not update_response.data or len(update_response.data) == 0:
                logger.error("Не вдалося оновити прогрес")
                return None

            if is_verified:
                logger.info(f"Завдання {task_id} успішно верифіковано для користувача {telegram_id}")
            else:
                logger.info(f"Завдання {task_id} відхилено для користувача {telegram_id}")

            return progress
        except Exception as e:
            logger.error(f"Помилка при верифікації завдання {task_id} для користувача {telegram_id}: {str(e)}")
            return None

    @staticmethod
    def get_user_progress(telegram_id: str, task_id: Optional[str] = None) -> List[UserProgress]:
        """
        Отримує прогрес користувача для одного або всіх завдань

        Args:
            telegram_id (str): Telegram ID користувача
            task_id (str, optional): ID завдання (якщо потрібно отримати прогрес для конкретного завдання)

        Returns:
            List[UserProgress]: Список об'єктів прогресу
        """
        try:
            query = supabase.table('user_progress').select('*').eq('telegram_id', str(telegram_id))

            if task_id:
                query = query.eq('task_id', task_id)

            response = query.execute()

            if not response.data:
                logger.info(f"Прогрес для користувача {telegram_id} не знайдено")
                return []

            progress_list = []
            for progress_data in response.data:
                try:
                    progress = UserProgress.from_dict(progress_data)
                    progress_list.append(progress)
                except Exception as e:
                    logger.error(f"Помилка при створенні об'єкта прогресу: {str(e)}")

            logger.info(f"Отримано {len(progress_list)} записів прогресу для користувача {telegram_id}")
            return progress_list
        except Exception as e:
            logger.error(f"Помилка при отриманні прогресу користувача {telegram_id}: {str(e)}")
            return []

    @staticmethod
    def get_single_progress(telegram_id: str, task_id: str) -> Optional[UserProgress]:
        """
        Отримує прогрес користувача для конкретного завдання

        Args:
            telegram_id (str): Telegram ID користувача
            task_id (str): ID завдання

        Returns:
            Optional[UserProgress]: Об'єкт прогресу або None, якщо прогрес не знайдено
        """
        try:
            progress_list = TaskService.get_user_progress(telegram_id, task_id)

            if not progress_list:
                logger.info(f"Прогрес для завдання {task_id} користувача {telegram_id} не знайдено")
                return None

            return progress_list[0]
        except Exception as e:
            logger.error(f"Помилка при отриманні прогресу для завдання {task_id} користувача {telegram_id}: {str(e)}")
            return None