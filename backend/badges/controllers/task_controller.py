from supabase_client import supabase
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class TaskController:
    """
    Контролер для управління завданнями
    """

    # Константи порогів для завдань
    TASK_THRESHOLDS = {
        'REFERRAL_COUNT': {
            'threshold': 100,
            'reward': 12000,
            'title': 'Запросити 100 рефералів',
            'description': 'Запросіть 100 нових користувачів та отримайте додаткову винагороду'
        },
        'ACTIVE_REFERRALS': {
            'threshold': 50,
            'reward': 6000,
            'title': 'Залучити 50 активних рефералів',
            'description': 'Залучіть 50 активних користувачів для отримання винагороди'
        }
    }

    @staticmethod
    def init_user_tasks(user_id):
        """
        Ініціалізує завдання для нового користувача

        Args:
            user_id (int): ID користувача

        Returns:
            dict: Результат ініціалізації завдань
        """
        try:
            user_id_str = str(user_id)

            # Перевіряємо, чи вже є завдання для цього користувача
            existing_tasks_result = supabase.table("user_tasks").select("*").eq("user_id", user_id_str).execute()
            existing_tasks = existing_tasks_result.data
            existing_task_types = set(task['task_type'] for task in existing_tasks)

            # Створюємо завдання, які ще не існують
            new_tasks = []

            for task_type, task_data in TaskController.TASK_THRESHOLDS.items():
                if task_type not in existing_task_types:
                    # Отримуємо поточний прогрес для завдання
                    progress = TaskController._get_task_progress(user_id_str, task_type)

                    # Створюємо нове завдання
                    new_task_data = {
                        "user_id": user_id_str,
                        "task_type": task_type,
                        "threshold": task_data['threshold'],
                        "reward_amount": task_data['reward'],
                        "progress": progress,
                        "completed": progress >= task_data['threshold'],
                        "claimed": False,
                        "last_updated": datetime.utcnow().isoformat()
                    }

                    if progress >= task_data['threshold']:
                        new_task_data["completed_at"] = datetime.utcnow().isoformat()

                    result = supabase.table("user_tasks").insert(new_task_data).execute()
                    if result.data:
                        new_tasks.append(result.data[0])

            # Оновлюємо прогрес для існуючих завдань
            for task in existing_tasks:
                progress = TaskController._get_task_progress(user_id_str, task['task_type'])

                update_data = {
                    "progress": progress,
                    "last_updated": datetime.utcnow().isoformat()
                }

                # Якщо завдання тільки що виконано
                if progress >= task['threshold'] and not task['completed']:
                    update_data["completed"] = True
                    update_data["completed_at"] = datetime.utcnow().isoformat()

                supabase.table("user_tasks").update(update_data).eq("id", task['id']).execute()

            # Отримуємо оновлені завдання
            updated_tasks_result = supabase.table("user_tasks").select("*").eq("user_id", user_id_str).execute()

            return {
                'success': True,
                'user_id': user_id_str,
                'existing_tasks': existing_tasks,
                'new_tasks': new_tasks,
                'all_tasks': updated_tasks_result.data
            }
        except Exception as e:
            logger.error(f"Error initializing tasks: {str(e)}")
            return {
                'success': False,
                'error': 'Failed to initialize tasks',
                'details': str(e)
            }

    @staticmethod
    def update_tasks(user_id):
        """
        Оновлює прогрес завдань користувача

        Args:
            user_id (int): ID користувача

        Returns:
            dict: Результат оновлення завдань
        """
        try:
            user_id_str = str(user_id)

            # Отримуємо всі завдання користувача
            tasks_result = supabase.table("user_tasks").select("*").eq("user_id", user_id_str).execute()
            tasks = tasks_result.data

            # Якщо завдань немає, ініціалізуємо їх
            if not tasks:
                return TaskController.init_user_tasks(user_id)

            # Оновлюємо прогрес для кожного завдання
            completed_tasks = []

            for task in tasks:
                progress = TaskController._get_task_progress(user_id_str, task['task_type'])

                update_data = {
                    "progress": progress,
                    "last_updated": datetime.utcnow().isoformat()
                }

                # Перевіряємо, чи тільки що виконано завдання
                if progress >= task['threshold'] and not task['completed']:
                    update_data["completed"] = True
                    update_data["completed_at"] = datetime.utcnow().isoformat()
                    completed_tasks.append(task)

                supabase.table("user_tasks").update(update_data).eq("id", task['id']).execute()

            # Отримуємо оновлені завдання
            updated_tasks_result = supabase.table("user_tasks").select("*").eq("user_id", user_id_str).execute()

            return {
                'success': True,
                'user_id': user_id_str,
                'tasks': updated_tasks_result.data,
                'completed_tasks': completed_tasks
            }
        except Exception as e:
            logger.error(f"Error updating tasks: {str(e)}")
            return {
                'success': False,
                'error': 'Failed to update tasks',
                'details': str(e)
            }

    @staticmethod
    def get_user_tasks(user_id):
        """
        Отримує всі завдання користувача

        Args:
            user_id (int): ID користувача

        Returns:
            dict: Інформація про завдання користувача
        """
        try:
            user_id_str = str(user_id)

            # Перевіряємо, чи є завдання для цього користувача і оновлюємо їх
            update_result = TaskController.update_tasks(user_id)

            if not update_result['success']:
                return update_result

            tasks = update_result['tasks']

            # Додаємо інформацію про завдання з констант
            enhanced_tasks = []

            for task in tasks:
                task_info = task.copy()  # Копіюємо словник, щоб не змінювати оригінал

                # Додаємо додаткову інформацію з констант
                if task['task_type'] in TaskController.TASK_THRESHOLDS:
                    task_data = TaskController.TASK_THRESHOLDS[task['task_type']]
                    task_info['title'] = task_data['title']
                    task_info['description'] = task_data['description']

                    # Розраховуємо відсоток виконання
                    task_info['completion_percentage'] = min(100, int((task['progress'] / task['threshold']) * 100)) if \
                    task['threshold'] > 0 else 0

                enhanced_tasks.append(task_info)

            return {
                'success': True,
                'user_id': user_id_str,
                'tasks': enhanced_tasks
            }
        except Exception as e:
            logger.error(f"Error getting user tasks: {str(e)}")
            return {
                'success': False,
                'error': 'Failed to get user tasks',
                'details': str(e)
            }

    @staticmethod
    def claim_task_reward(user_id, task_type):
        """
        Отримує винагороду за виконане завдання

        Args:
            user_id (int): ID користувача
            task_type (str): Тип завдання

        Returns:
            dict: Результат отримання винагороди
        """
        try:
            user_id_str = str(user_id)

            # Перевіряємо, чи є таке завдання у користувача
            task_result = supabase.table("user_tasks").select("*").eq(
                "user_id", user_id_str
            ).eq("task_type", task_type).execute()

            if not task_result.data:
                return {
                    'success': False,
                    'error': 'Task not found',
                    'details': f'User {user_id_str} does not have task {task_type}'
                }

            task = task_result.data[0]

            # Перевіряємо, чи виконано завдання
            if not task['completed']:
                return {
                    'success': False,
                    'error': 'Task not completed',
                    'details': f'Task {task_type} is not completed yet'
                }

            # Перевіряємо, чи не була вже отримана винагорода
            if task['claimed']:
                return {
                    'success': False,
                    'error': 'Reward already claimed',
                    'details': f'Reward for task {task_type} has already been claimed'
                }

            # Оновлюємо статус отримання винагороди
            update_result = supabase.table("user_tasks").update({
                "claimed": True,
                "claimed_at": datetime.utcnow().isoformat()
            }).eq("id", task['id']).execute()

            if not update_result.data:
                return {
                    'success': False,
                    'error': 'Failed to update task status',
                    'details': 'Database error while updating task'
                }

            # Оновлюємо баланс користувача
            try:
                # Отримуємо поточний баланс
                user_response = supabase.table("winix").select("balance").eq("telegram_id", user_id_str).execute()

                if user_response.data:
                    current_balance = float(user_response.data[0].get('balance', 0))
                    new_balance = current_balance + task['reward_amount']

                    # Оновлюємо баланс
                    supabase.table("winix").update({
                        "balance": new_balance,
                        "updated_at": datetime.utcnow().isoformat()
                    }).eq("telegram_id", user_id_str).execute()

                    # Записуємо транзакцію
                    transaction_data = {
                        "telegram_id": user_id_str,
                        "type": "task_reward",
                        "amount": task['reward_amount'],
                        "description": f"Винагорода за виконання завдання: {TaskController.TASK_THRESHOLDS[task_type]['title']}",
                        "status": "completed",
                        "created_at": datetime.utcnow().isoformat()
                    }
                    supabase.table("transactions").insert(transaction_data).execute()

                    logger.info(
                        f"Task reward claimed: user {user_id_str}, task {task_type}, amount {task['reward_amount']}")
            except Exception as e:
                logger.error(f"Error updating user balance: {str(e)}")

            # Отримуємо оновлені дані завдання
            updated_task = supabase.table("user_tasks").select("*").eq("id", task['id']).execute()

            return {
                'success': True,
                'message': 'Task reward successfully claimed',
                'task': updated_task.data[0] if updated_task.data else task,
                'reward_amount': task['reward_amount']
            }
        except Exception as e:
            logger.error(f"Error claiming task reward: {str(e)}")
            return {
                'success': False,
                'error': 'Failed to claim task reward',
                'details': str(e)
            }

    @staticmethod
    def _get_task_progress(user_id, task_type):
        """
        Отримує поточний прогрес для завдання

        Args:
            user_id (str): ID користувача
            task_type (str): Тип завдання

        Returns:
            int: Поточний прогрес
        """
        try:
            if task_type == 'REFERRAL_COUNT':
                # Підраховуємо загальну кількість рефералів
                referrals_result = supabase.table("referrals").select("*").eq("referrer_id", user_id).execute()
                return len(referrals_result.data)

            elif task_type == 'ACTIVE_REFERRALS':
                # Підраховуємо кількість активних рефералів
                # Отримуємо ID рефералів користувача
                referrals_result = supabase.table("referrals").select("referee_id").eq("referrer_id", user_id).execute()
                referral_ids = [ref['referee_id'] for ref in referrals_result.data]

                if not referral_ids:
                    return 0

                # Підраховуємо кількість активних рефералів
                activities_result = supabase.table("referral_activities").select("*").in_("user_id", referral_ids).eq(
                    "is_active", True).execute()

                return len(activities_result.data)
            else:
                # Для невідомих типів завдань повертаємо 0
                return 0
        except Exception as e:
            logger.error(f"Error getting task progress: {str(e)}")
            return 0