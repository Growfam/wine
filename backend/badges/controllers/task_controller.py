from models.task import UserTask
from models.referral import Referral
from main import db
from flask import current_app
from sqlalchemy.exc import SQLAlchemyError
from datetime import datetime


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
            # Перевіряємо, чи вже є завдання для цього користувача
            existing_tasks = UserTask.query.filter_by(user_id=user_id).all()
            existing_task_types = set(task.task_type for task in existing_tasks)

            # Створюємо завдання, які ще не існують
            new_tasks = []

            for task_type, task_data in TaskController.TASK_THRESHOLDS.items():
                if task_type not in existing_task_types:
                    # Отримуємо поточний прогрес для завдання
                    progress = TaskController._get_task_progress(user_id, task_type)

                    # Створюємо нове завдання
                    new_task = UserTask(
                        user_id=user_id,
                        task_type=task_type,
                        threshold=task_data['threshold'],
                        reward_amount=task_data['reward'],
                        progress=progress
                    )
                    db.session.add(new_task)
                    new_tasks.append(new_task)

            # Оновлюємо прогрес для існуючих завдань
            for task in existing_tasks:
                progress = TaskController._get_task_progress(user_id, task.task_type)
                task.update_progress(progress)

            # Зберігаємо зміни в базі даних
            db.session.commit()

            return {
                'success': True,
                'user_id': user_id,
                'existing_tasks': [task.to_dict() for task in existing_tasks],
                'new_tasks': [task.to_dict() for task in new_tasks]
            }
        except SQLAlchemyError as e:
            db.session.rollback()
            current_app.logger.error(f"Database error during task initialization: {str(e)}")
            return {
                'success': False,
                'error': 'Database error during task initialization',
                'details': str(e)
            }
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Error initializing tasks: {str(e)}")
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
            # Отримуємо всі завдання користувача
            tasks = UserTask.query.filter_by(user_id=user_id).all()

            # Якщо завдань немає, ініціалізуємо їх
            if not tasks:
                return TaskController.init_user_tasks(user_id)

            # Оновлюємо прогрес для кожного завдання
            completed_tasks = []

            for task in tasks:
                progress = TaskController._get_task_progress(user_id, task.task_type)
                task_completed = task.update_progress(progress)

                if task_completed:
                    completed_tasks.append(task)

            # Зберігаємо зміни в базі даних
            db.session.commit()

            return {
                'success': True,
                'user_id': user_id,
                'tasks': [task.to_dict() for task in tasks],
                'completed_tasks': [task.to_dict() for task in completed_tasks]
            }
        except SQLAlchemyError as e:
            db.session.rollback()
            current_app.logger.error(f"Database error during task update: {str(e)}")
            return {
                'success': False,
                'error': 'Database error during task update',
                'details': str(e)
            }
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Error updating tasks: {str(e)}")
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

                enhanced_tasks.append(task_info)

            return {
                'success': True,
                'user_id': user_id,
                'tasks': enhanced_tasks
            }
        except Exception as e:
            current_app.logger.error(f"Error getting user tasks: {str(e)}")
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
            # Перевіряємо, чи є таке завдання у користувача
            task = UserTask.query.filter_by(
                user_id=user_id,
                task_type=task_type
            ).first()

            if not task:
                return {
                    'success': False,
                    'error': 'Task not found',
                    'details': f'User {user_id} does not have task {task_type}'
                }

            # Перевіряємо, чи виконано завдання
            if not task.completed:
                return {
                    'success': False,
                    'error': 'Task not completed',
                    'details': f'Task {task_type} is not completed yet'
                }

            # Перевіряємо, чи не була вже отримана винагорода
            if task.claimed:
                return {
                    'success': False,
                    'error': 'Reward already claimed',
                    'details': f'Reward for task {task_type} has already been claimed'
                }

            # Отримуємо винагороду
            task.claim_reward()
            db.session.commit()

            # В реальному додатку тут буде код для нарахування валюти користувачу

            return {
                'success': True,
                'message': 'Task reward successfully claimed',
                'task': task.to_dict(),
                'reward_amount': task.reward_amount
            }
        except SQLAlchemyError as e:
            db.session.rollback()
            current_app.logger.error(f"Database error during task reward claim: {str(e)}")
            return {
                'success': False,
                'error': 'Database error during task reward claim',
                'details': str(e)
            }
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Error claiming task reward: {str(e)}")
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
            user_id (int): ID користувача
            task_type (str): Тип завдання

        Returns:
            int: Поточний прогрес
        """
        if task_type == 'REFERRAL_COUNT':
            # Підраховуємо загальну кількість рефералів
            return Referral.query.filter_by(referrer_id=user_id).count()
        elif task_type == 'ACTIVE_REFERRALS':
            # Підраховуємо кількість активних рефералів
            # В реальному додатку це буде запит до таблиці активності
            from models.activity import ReferralActivity

            # Отримуємо ID рефералів користувача
            referrals = Referral.query.filter_by(referrer_id=user_id).all()
            referral_ids = [ref.referee_id for ref in referrals]

            # Підраховуємо кількість активних рефералів
            active_count = ReferralActivity.query.filter(
                ReferralActivity.user_id.in_(referral_ids),
                ReferralActivity.is_active == True
            ).count()

            return active_count
        else:
            # Для невідомих типів завдань повертаємо 0
            return 0