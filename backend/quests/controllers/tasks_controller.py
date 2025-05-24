"""
Контролер для управління завданнями в системі WINIX
API endpoints для створення, отримання та виконання завдань
ОНОВЛЕНО: Інтеграція з Transaction Service для атомарних операцій з винагородами
"""

import logging
from typing import Dict, Any, Optional, List
from flask import request, jsonify, g
from datetime import datetime, timezone

# Налаштування логування
logger = logging.getLogger(__name__)

# Імпорт Transaction Service
try:
    from ..services.transaction_service import transaction_service
except ImportError:
    try:
        from backend.quests.services.transaction_service import transaction_service
    except ImportError:
        logger.error("Transaction service недоступний")
        transaction_service = None

# Імпорт декораторів та утилітів
try:
    from ..utils.decorators import (
        secure_endpoint, public_endpoint, validate_json,
        validate_telegram_id, get_current_user, get_json_data
    )
    from ..utils.validators import (
        validate_telegram_id as validate_tg_id,
        sanitize_string, validate_url
    )
except ImportError:
    try:
        from backend.quests.utils.decorators import (
            secure_endpoint, public_endpoint, validate_json,
            validate_telegram_id, get_current_user, get_json_data
        )
        from backend.quests.utils.validators import (
            validate_telegram_id as validate_tg_id,
            sanitize_string, validate_url
        )
    except ImportError:
        logger.error("Не вдалося імпортувати декоратори та валідатори")

# Імпорт моделей та сервісів
try:
    from ..models.task import task_model, TaskType, TaskStatus, TaskPlatform, TaskAction
except ImportError:
    try:
        from backend.quests.models.task import task_model, TaskType, TaskStatus, TaskPlatform, TaskAction
    except ImportError:
        logger.error("Не вдалося імпортувати модель завдань")
        task_model = None
        TaskType = None
        TaskStatus = None
        TaskPlatform = None
        TaskAction = None


class TasksController:
    """Контролер для управління завданнями з підтримкою транзакцій"""

    @staticmethod
    @public_endpoint(max_requests=50, window_seconds=60)
    @validate_telegram_id
    def get_tasks_list(telegram_id: str) -> tuple[Dict[str, Any], int]:
        """
        Отримання списку завдань для користувача

        Args:
            telegram_id: ID користувача в Telegram

        Returns:
            Список завдань та HTTP код
        """
        try:
            logger.info(f"Отримання списку завдань для користувача {telegram_id}")

            if not task_model or not TaskType:
                return jsonify({
                    "status": "error",
                    "message": "Сервіс завдань недоступний",
                    "error_code": "SERVICE_UNAVAILABLE"
                }), 503

            # Отримуємо параметри фільтрації
            task_type_param = request.args.get('type', 'all').lower()
            include_completed = request.args.get('include_completed', 'false').lower() == 'true'

            # Валідуємо тип завдань
            task_type = None
            if task_type_param != 'all':
                try:
                    task_type = TaskType(task_type_param)
                except ValueError:
                    valid_types = [t.value for t in TaskType] + ['all']
                    return jsonify({
                        "status": "error",
                        "message": f"Невалідний тип завдань. Доступні: {', '.join(valid_types)}",
                        "error_code": "INVALID_TASK_TYPE"
                    }), 400

            # Отримуємо завдання
            user_tasks = task_model.get_user_tasks(
                telegram_id=telegram_id,
                task_type=task_type,
                include_completed=include_completed
            )

            # Групуємо завдання по типах
            tasks_by_type = {}
            total_tasks = 0
            available_tasks = 0
            completed_tasks = 0

            for task in user_tasks:
                task_type_value = task['type']

                if task_type_value not in tasks_by_type:
                    tasks_by_type[task_type_value] = []

                tasks_by_type[task_type_value].append(task)
                total_tasks += 1

                user_status = task.get('user_status', TaskStatus.AVAILABLE.value)
                if user_status == TaskStatus.AVAILABLE.value:
                    available_tasks += 1
                elif user_status in [TaskStatus.COMPLETED.value, TaskStatus.CLAIMED.value]:
                    completed_tasks += 1

            # Рахуємо потенційні винагороди
            potential_winix = sum(
                task['reward']['winix'] for task in user_tasks
                if task.get('user_status') == TaskStatus.AVAILABLE.value
            )
            potential_tickets = sum(
                task['reward']['tickets'] for task in user_tasks
                if task.get('user_status') == TaskStatus.AVAILABLE.value
            )

            logger.info(f"Завдання для {telegram_id}: всього={total_tasks}, "
                        f"доступно={available_tasks}, виконано={completed_tasks}")

            return jsonify({
                "status": "success",
                "data": {
                    "telegram_id": telegram_id,
                    "tasks": tasks_by_type,
                    "filters": {
                        "type": task_type_param,
                        "include_completed": include_completed
                    },
                    "summary": {
                        "total_tasks": total_tasks,
                        "available_tasks": available_tasks,
                        "completed_tasks": completed_tasks,
                        "potential_rewards": {
                            "winix": potential_winix,
                            "tickets": potential_tickets
                        }
                    },
                    "last_updated": datetime.now(timezone.utc).isoformat(),
                    "service_info": {
                        "transaction_service_available": transaction_service is not None
                    }
                }
            }), 200

        except Exception as e:
            logger.error(f"Помилка отримання списку завдань для {telegram_id}: {str(e)}")
            return jsonify({
                "status": "error",
                "message": "Помилка отримання списку завдань",
                "error_code": "TASKS_FETCH_ERROR"
            }), 500

    @staticmethod
    @public_endpoint(max_requests=30, window_seconds=60)
    def get_task_details(task_id: str) -> tuple[Dict[str, Any], int]:
        """
        Отримання детальної інформації про завдання

        Args:
            task_id: ID завдання

        Returns:
            Деталі завдання та HTTP код
        """
        try:
            logger.info(f"Отримання деталей завдання {task_id}")

            if not task_model:
                return jsonify({
                    "status": "error",
                    "message": "Сервіс завдань недоступний",
                    "error_code": "SERVICE_UNAVAILABLE"
                }), 503

            # Отримуємо завдання
            task = task_model.get_task_by_id(task_id)

            if not task:
                return jsonify({
                    "status": "error",
                    "message": "Завдання не знайдено",
                    "error_code": "TASK_NOT_FOUND"
                }), 404

            # Якщо є telegram_id в параметрах, додаємо статус користувача
            telegram_id = request.args.get('telegram_id')
            if telegram_id:
                try:
                    telegram_id = str(telegram_id)
                    user_status = task_model._get_user_task_status(telegram_id, task_id)

                    if user_status:
                        task['user_status'] = user_status['status']
                        task['user_progress'] = user_status.get('progress', 0)
                        task['started_at'] = user_status.get('started_at')
                        task['completed_at'] = user_status.get('completed_at')

                        # Додаємо інформацію про транзакції якщо завдання виконано
                        if (user_status['status'] in [TaskStatus.COMPLETED.value, TaskStatus.CLAIMED.value]
                            and transaction_service):
                            try:
                                # Шукаємо транзакції пов'язані з цим завданням
                                history_result = transaction_service.get_user_transaction_history(
                                    telegram_id=telegram_id,
                                    limit=50
                                )

                                if history_result['success']:
                                    task_transactions = [
                                        t for t in history_result.get('transactions', [])
                                        if (t.get('type') == 'task_reward' and
                                            t.get('reference_id') == task_id)
                                    ]

                                    if task_transactions:
                                        task['reward_transaction'] = task_transactions[0]
                                        task['reward_processed_through'] = 'transaction_service'

                            except Exception as e:
                                logger.warning(f"Не вдалося отримати інформацію про транзакції: {e}")
                    else:
                        task['user_status'] = TaskStatus.AVAILABLE.value
                        task['user_progress'] = 0

                except Exception as user_error:
                    logger.warning(f"Помилка отримання статусу користувача: {user_error}")

            # Додаємо інформацію про сервіси
            task['service_info'] = {
                "transaction_service_available": transaction_service is not None,
                "atomic_rewards": transaction_service is not None
            }

            logger.info(f"Деталі завдання {task_id} надано")

            return jsonify({
                "status": "success",
                "data": task
            }), 200

        except Exception as e:
            logger.error(f"Помилка отримання деталей завдання {task_id}: {str(e)}")
            return jsonify({
                "status": "error",
                "message": "Помилка отримання деталей завдання",
                "error_code": "TASK_DETAILS_ERROR"
            }), 500

    @staticmethod
    @secure_endpoint(max_requests=20, window_seconds=300)
    def start_task(telegram_id: str, task_id: str) -> tuple[Dict[str, Any], int]:
        """
        Початок виконання завдання користувачем

        Args:
            telegram_id: ID користувача в Telegram
            task_id: ID завдання

        Returns:
            Результат початку виконання та HTTP код
        """
        try:
            logger.info(f"Початок виконання завдання {task_id} користувачем {telegram_id}")

            if not task_model:
                return jsonify({
                    "status": "error",
                    "message": "Сервіс завдань недоступний",
                    "error_code": "SERVICE_UNAVAILABLE"
                }), 503

            # Валідуємо task_id
            task_id = sanitize_string(task_id).strip()
            if not task_id:
                return jsonify({
                    "status": "error",
                    "message": "ID завдання не вказано",
                    "error_code": "MISSING_TASK_ID"
                }), 400

            # Розпочинаємо завдання
            result = task_model.start_task(telegram_id, task_id)

            if result['success']:
                # Логуємо початок виконання через transaction service якщо доступний
                if transaction_service:
                    try:
                        from ..models.transaction import TransactionAmount, TransactionType

                        # Отримуємо дані завдання для метаданих
                        task = task_model.get_task_by_id(task_id)

                        # Створюємо запис про початок завдання (нульова винагорода)
                        start_result = transaction_service.process_reward(
                            telegram_id=telegram_id,
                            reward_amount=TransactionAmount(winix=0, tickets=0, flex=0),
                            transaction_type=TransactionType.ADMIN_ADJUSTMENT,
                            description=f"Розпочато виконання завдання: {task.get('title', task_id)}",
                            reference_id=task_id,
                            reference_type="task_start",
                            metadata={
                                'operation': 'task_start',
                                'task_id': task_id,
                                'task_type': task.get('type', 'unknown'),
                                'task_title': task.get('title', ''),
                                'expected_reward': task.get('reward', {}),
                                'started_at': datetime.now(timezone.utc).isoformat(),
                                'user_action': True
                            }
                        )

                        if start_result['success']:
                            result['data']['start_transaction_id'] = start_result['transaction_id']
                            logger.info(f"Початок завдання зареєстровано: {start_result['transaction_id']}")

                    except Exception as e:
                        logger.warning(f"Не вдалося зареєструвати початок завдання: {e}")

                logger.info(f"Завдання {task_id} успішно розпочато користувачем {telegram_id}")

                return jsonify({
                    "status": "success",
                    "message": result['message'],
                    "data": {
                        **result['data'],
                        "service_info": {
                            "transaction_service_available": transaction_service is not None,
                            "progress_logged": transaction_service is not None
                        }
                    }
                }), 200
            else:
                logger.warning(f"Не вдалося розпочати завдання {task_id} для {telegram_id}: {result['message']}")

                # Визначаємо код статусу
                error_code = result.get('error_code', 'START_FAILED')

                if error_code == 'TASK_NOT_FOUND':
                    status_code = 404
                elif error_code in ['TASK_INACTIVE', 'TASK_EXPIRED', 'TASK_NOT_AVAILABLE']:
                    status_code = 400
                elif error_code == 'TASK_ALREADY_COMPLETED':
                    status_code = 409  # Conflict
                else:
                    status_code = 500

                return jsonify({
                    "status": "error",
                    "message": result['message'],
                    "error_code": error_code
                }), status_code

        except Exception as e:
            logger.error(f"Помилка початку виконання завдання {task_id} для {telegram_id}: {str(e)}")
            return jsonify({
                "status": "error",
                "message": "Внутрішня помилка сервера",
                "error_code": "INTERNAL_ERROR"
            }), 500

    @staticmethod
    @secure_endpoint(max_requests=15, window_seconds=300)
    @validate_json(required_fields=[])  # Верифікаційні дані опціональні
    def verify_task(telegram_id: str, task_id: str) -> tuple[Dict[str, Any], int]:
        """
        Верифікація виконання завдання користувачем з автоматичним нарахуванням винагороди

        Args:
            telegram_id: ID користувача в Telegram
            task_id: ID завдання

        Returns:
            Результат верифікації та HTTP код
        """
        try:
            logger.info(f"Верифікація завдання {task_id} для користувача {telegram_id}")

            if not task_model:
                return jsonify({
                    "status": "error",
                    "message": "Сервіс завдань недоступний",
                    "error_code": "SERVICE_UNAVAILABLE"
                }), 503

            # Валідуємо task_id
            task_id = sanitize_string(task_id).strip()
            if not task_id:
                return jsonify({
                    "status": "error",
                    "message": "ID завдання не вказано",
                    "error_code": "MISSING_TASK_ID"
                }), 400

            # Отримуємо дані верифікації
            verification_data = get_json_data() or {}

            # Санітизуємо дані
            sanitized_verification_data = {}
            for key, value in verification_data.items():
                if isinstance(value, str):
                    sanitized_verification_data[sanitize_string(key)] = sanitize_string(value)
                else:
                    sanitized_verification_data[sanitize_string(key)] = value

            # Виконуємо верифікацію
            result = task_model.verify_task(telegram_id, task_id, sanitized_verification_data)

            # Якщо верифікація пройшла успішно, нараховуємо винагороду
            if result['success']:
                # Отримуємо дані завдання для винагороди
                task = task_model.get_task_by_id(task_id)
                if task and task.get('reward'):
                    # Нараховуємо винагороду через transaction service
                    if transaction_service:
                        reward_result = transaction_service.process_task_reward(
                            telegram_id=telegram_id,
                            winix_amount=task['reward'].get('winix', 0),
                            tickets_amount=task['reward'].get('tickets', 0),
                            task_id=task_id,
                            task_type=task.get('type', 'unknown')
                        )

                        if reward_result['success']:
                            # Додаємо інформацію про винагороду до результату
                            result['data']['reward'] = {
                                'amount': reward_result['amount'],
                                'operations': reward_result['operations'],
                                'transaction_id': reward_result['transaction_id'],
                                'processed_through': 'transaction_service',
                                'processed_at': reward_result['processed_at']
                            }
                            logger.info(f"Винагорода за завдання {task_id} нарахована користувачу {telegram_id} через transaction service")
                        else:
                            logger.warning(f"Не вдалося нарахувати винагороду через transaction service: {reward_result['error']}")

                            # Fallback до прямого нарахування
                            try:
                                from supabase_client import update_balance, update_coins

                                operations = []
                                if task['reward'].get('winix', 0) > 0:
                                    if update_balance(telegram_id, task['reward']['winix']):
                                        operations.append(f"WINIX +{task['reward']['winix']}")

                                if task['reward'].get('tickets', 0) > 0:
                                    if update_coins(telegram_id, task['reward']['tickets']):
                                        operations.append(f"Tickets +{task['reward']['tickets']}")

                                if operations:
                                    result['data']['reward'] = {
                                        'amount': task['reward'],
                                        'operations': operations,
                                        'processed_through': 'direct_db',
                                        'fallback': True
                                    }
                                    logger.info(f"Винагорода за завдання {task_id} нарахована користувачу {telegram_id} (fallback)")

                            except Exception as fallback_error:
                                logger.error(f"Помилка fallback нарахування винагороди: {fallback_error}")
                                result['data']['reward_error'] = "Не вдалося нарахувати винагороду"
                    else:
                        # Прямий метод якщо transaction service недоступний
                        try:
                            from supabase_client import update_balance, update_coins

                            operations = []
                            if task['reward'].get('winix', 0) > 0:
                                if update_balance(telegram_id, task['reward']['winix']):
                                    operations.append(f"WINIX +{task['reward']['winix']}")

                            if task['reward'].get('tickets', 0) > 0:
                                if update_coins(telegram_id, task['reward']['tickets']):
                                    operations.append(f"Tickets +{task['reward']['tickets']}")

                            if operations:
                                result['data']['reward'] = {
                                    'amount': task['reward'],
                                    'operations': operations,
                                    'processed_through': 'direct_db',
                                    'transaction_service_unavailable': True
                                }
                                logger.info(f"Винагорода за завдання {task_id} нарахована користувачу {telegram_id} (прямий метод)")

                        except Exception as direct_error:
                            logger.error(f"Помилка прямого нарахування винагороди: {direct_error}")
                            result['data']['reward_error'] = "Не вдалося нарахувати винагороду"

                logger.info(f"Завдання {task_id} успішно верифіковано для користувача {telegram_id}")

                # Додаємо інформацію про сервіси
                result['data']['service_info'] = {
                    "transaction_service_available": transaction_service is not None,
                    "atomic_rewards": transaction_service is not None
                }

                return jsonify({
                    "status": "success",
                    "message": result['message'],
                    "data": result['data']
                }), 200
            else:
                logger.warning(f"Верифікація завдання {task_id} не пройдена для {telegram_id}: {result['message']}")

                # Визначаємо код статусу
                error_code = result.get('error_code', 'VERIFICATION_FAILED')

                if error_code == 'TASK_NOT_FOUND':
                    status_code = 404
                elif error_code in ['TASK_NOT_STARTED', 'TASK_ALREADY_COMPLETED']:
                    status_code = 400
                elif error_code == 'VERIFICATION_FAILED':
                    status_code = 422  # Unprocessable Entity
                else:
                    status_code = 500

                response_data = {
                    "status": "error",
                    "message": result['message'],
                    "error_code": error_code
                }

                # Додаємо додаткові дані якщо є
                if 'data' in result:
                    response_data['data'] = result['data']

                return jsonify(response_data), status_code

        except Exception as e:
            logger.error(f"Помилка верифікації завдання {task_id} для {telegram_id}: {str(e)}")
            return jsonify({
                "status": "error",
                "message": "Внутрішня помилка сервера",
                "error_code": "INTERNAL_ERROR"
            }), 500

    @staticmethod
    @secure_endpoint(max_requests=10, window_seconds=300)
    @validate_json(required_fields=['type', 'title'])
    def create_task() -> tuple[Dict[str, Any], int]:
        """
        Створення нового завдання (адміністративна функція)

        Returns:
            Результат створення та HTTP код
        """
        try:
            logger.info("Створення нового завдання")

            if not task_model or not TaskType:
                return jsonify({
                    "status": "error",
                    "message": "Сервіс завдань недоступний",
                    "error_code": "SERVICE_UNAVAILABLE"
                }), 503

            # Отримуємо дані завдання
            task_data = get_json_data()
            if not task_data:
                return jsonify({
                    "status": "error",
                    "message": "Дані завдання відсутні",
                    "error_code": "MISSING_TASK_DATA"
                }), 400

            # Санітизуємо дані
            sanitized_data = TasksController._sanitize_task_data(task_data)

            # Додаткова валідація
            validation_errors = TasksController._validate_task_creation_data(sanitized_data)
            if validation_errors:
                return jsonify({
                    "status": "error",
                    "message": "Невалідні дані завдання",
                    "errors": validation_errors,
                    "error_code": "INVALID_TASK_DATA"
                }), 400

            # Створюємо завдання
            result = task_model.create_task(sanitized_data)

            if result['success']:
                # Логуємо створення через transaction service якщо доступний
                if transaction_service:
                    try:
                        from ..models.transaction import TransactionAmount, TransactionType

                        # Створюємо запис про створення завдання
                        creation_result = transaction_service.process_reward(
                            telegram_id='system',  # Системна операція
                            reward_amount=TransactionAmount(winix=0, tickets=0, flex=0),
                            transaction_type=TransactionType.ADMIN_ADJUSTMENT,
                            description=f"Створено нове завдання: {sanitized_data.get('title', '')}",
                            reference_id=result['data']['id'],
                            reference_type="task_creation",
                            metadata={
                                'operation': 'task_creation',
                                'task_id': result['data']['id'],
                                'task_type': sanitized_data.get('type'),
                                'task_title': sanitized_data.get('title'),
                                'reward': sanitized_data.get('reward', {}),
                                'created_at': datetime.now(timezone.utc).isoformat(),
                                'admin_action': True
                            }
                        )

                        if creation_result['success']:
                            result['data']['creation_transaction_id'] = creation_result['transaction_id']
                            logger.info(f"Створення завдання зареєстровано: {creation_result['transaction_id']}")

                    except Exception as e:
                        logger.warning(f"Не вдалося зареєструвати створення завдання: {e}")

                logger.info(f"Завдання успішно створено: {result['data']['id']}")

                return jsonify({
                    "status": "success",
                    "message": result['message'],
                    "data": {
                        **result['data'],
                        "service_info": {
                            "transaction_service_available": transaction_service is not None,
                            "creation_logged": transaction_service is not None
                        }
                    }
                }), 201
            else:
                logger.error(f"Не вдалося створити завдання: {result['message']}")

                return jsonify({
                    "status": "error",
                    "message": result['message'],
                    "error_code": result.get('error_code', 'CREATE_FAILED')
                }), 500

        except Exception as e:
            logger.error(f"Помилка створення завдання: {str(e)}")
            return jsonify({
                "status": "error",
                "message": "Внутрішня помилка сервера",
                "error_code": "INTERNAL_ERROR"
            }), 500

    @staticmethod
    @public_endpoint(max_requests=30, window_seconds=60)
    @validate_telegram_id
    def get_user_task_progress(telegram_id: str) -> tuple[Dict[str, Any], int]:
        """
        Отримання прогресу виконання завдань користувачем з транзакціями

        Args:
            telegram_id: ID користувача в Telegram

        Returns:
            Прогрес користувача та HTTP код
        """
        try:
            logger.info(f"Отримання прогресу завдань для користувача {telegram_id}")

            if not task_model:
                return jsonify({
                    "status": "error",
                    "message": "Сервіс завдань недоступний",
                    "error_code": "SERVICE_UNAVAILABLE"
                }), 503

            # Отримуємо завдання користувача з усіма статусами
            user_tasks = task_model.get_user_tasks(telegram_id, include_completed=True)

            # Рахуємо статистику
            progress_stats = {
                'total_tasks': 0,
                'available_tasks': 0,
                'started_tasks': 0,
                'pending_tasks': 0,
                'completed_tasks': 0,
                'claimed_tasks': 0,
                'expired_tasks': 0,
                'total_earned': {
                    'winix': 0,
                    'tickets': 0
                },
                'potential_earnings': {
                    'winix': 0,
                    'tickets': 0
                },
                'by_type': {}
            }

            for task in user_tasks:
                task_type = task['type']
                user_status = task.get('user_status', TaskStatus.AVAILABLE.value)

                # Загальна статистика
                progress_stats['total_tasks'] += 1

                if user_status == TaskStatus.AVAILABLE.value:
                    progress_stats['available_tasks'] += 1
                    progress_stats['potential_earnings']['winix'] += task['reward']['winix']
                    progress_stats['potential_earnings']['tickets'] += task['reward']['tickets']
                elif user_status == TaskStatus.STARTED.value:
                    progress_stats['started_tasks'] += 1
                elif user_status == TaskStatus.PENDING.value:
                    progress_stats['pending_tasks'] += 1
                elif user_status == TaskStatus.COMPLETED.value:
                    progress_stats['completed_tasks'] += 1
                    progress_stats['total_earned']['winix'] += task['reward']['winix']
                    progress_stats['total_earned']['tickets'] += task['reward']['tickets']
                elif user_status == TaskStatus.CLAIMED.value:
                    progress_stats['claimed_tasks'] += 1
                    progress_stats['total_earned']['winix'] += task['reward']['winix']
                    progress_stats['total_earned']['tickets'] += task['reward']['tickets']
                elif user_status == TaskStatus.EXPIRED.value:
                    progress_stats['expired_tasks'] += 1

                # Статистика по типах
                if task_type not in progress_stats['by_type']:
                    progress_stats['by_type'][task_type] = {
                        'total': 0,
                        'completed': 0,
                        'available': 0
                    }

                progress_stats['by_type'][task_type]['total'] += 1
                if user_status in [TaskStatus.COMPLETED.value, TaskStatus.CLAIMED.value]:
                    progress_stats['by_type'][task_type]['completed'] += 1
                elif user_status == TaskStatus.AVAILABLE.value:
                    progress_stats['by_type'][task_type]['available'] += 1

            # Розраховуємо відсотки
            if progress_stats['total_tasks'] > 0:
                progress_stats['completion_rate'] = round(
                    (progress_stats['completed_tasks'] + progress_stats['claimed_tasks']) /
                    progress_stats['total_tasks'] * 100, 2
                )
            else:
                progress_stats['completion_rate'] = 0

            # Додаємо статистику з transaction service якщо доступний
            transaction_stats = {}
            if transaction_service:
                try:
                    history_result = transaction_service.get_user_transaction_history(
                        telegram_id=telegram_id,
                        limit=100
                    )

                    if history_result['success']:
                        # Фільтруємо task_reward транзакції
                        task_transactions = [
                            t for t in history_result.get('transactions', [])
                            if t.get('type') == 'task_reward' and t.get('status') == 'completed'
                        ]

                        transaction_stats = {
                            'rewards_from_transactions': len(task_transactions),
                            'total_winix_from_transactions': sum(
                                t.get('amount', {}).get('winix', 0) for t in task_transactions
                            ),
                            'total_tickets_from_transactions': sum(
                                t.get('amount', {}).get('tickets', 0) for t in task_transactions
                            ),
                            'verification_available': True,
                            'matches_calculated': len(task_transactions) == progress_stats['completed_tasks'] + progress_stats['claimed_tasks']
                        }

                except Exception as e:
                    logger.warning(f"Не вдалося отримати статистику з транзакцій: {e}")
                    transaction_stats = {'verification_available': False, 'error': str(e)}
            else:
                transaction_stats = {'verification_available': False}

            logger.info(f"Прогрес завдань для {telegram_id}: виконано {progress_stats['completion_rate']}%")

            return jsonify({
                "status": "success",
                "data": {
                    "telegram_id": telegram_id,
                    "progress": progress_stats,
                    "transaction_verification": transaction_stats,
                    "last_updated": datetime.now(timezone.utc).isoformat(),
                    "service_info": {
                        "transaction_service_available": transaction_service is not None
                    }
                }
            }), 200

        except Exception as e:
            logger.error(f"Помилка отримання прогресу завдань для {telegram_id}: {str(e)}")
            return jsonify({
                "status": "error",
                "message": "Помилка отримання прогресу завдань",
                "error_code": "PROGRESS_FETCH_ERROR"
            }), 500

    @staticmethod
    @public_endpoint(max_requests=50, window_seconds=300)
    def get_tasks_statistics() -> tuple[Dict[str, Any], int]:
        """
        Отримання загальної статистики завдань (публічна)

        Returns:
            Статистика завдань та HTTP код
        """
        try:
            logger.info("Отримання загальної статистики завдань")

            if not task_model:
                return jsonify({
                    "status": "error",
                    "message": "Сервіс завдань недоступний",
                    "error_code": "SERVICE_UNAVAILABLE"
                }), 503

            # Отримуємо статистику з task моделі
            statistics = task_model.get_tasks_statistics()

            # Додаємо статистику з transaction service якщо доступний
            if transaction_service:
                try:
                    transaction_stats_result = transaction_service.get_service_statistics()

                    if transaction_stats_result['success']:
                        transaction_stats = transaction_stats_result.get('statistics', {})

                        # Фільтруємо статистику по task транзакціях
                        type_breakdown = transaction_stats.get('type_breakdown', {})
                        task_reward_count = type_breakdown.get('task_reward', 0)

                        statistics['transaction_service_stats'] = {
                            'task_reward_transactions': task_reward_count,
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
                "supported_types": [t.value for t in TaskType] if TaskType else [],
                "supported_platforms": [p.value for p in TaskPlatform] if TaskPlatform else [],
                "supported_actions": [a.value for a in TaskAction] if TaskAction else [],
                "transaction_service_integration": transaction_service is not None
            }

            logger.info(f"Статистика завдань: {statistics.get('total_tasks', 0)} завдань, "
                        f"{statistics.get('total_completions', 0)} виконань")

            return jsonify({
                "status": "success",
                "data": statistics
            }), 200

        except Exception as e:
            logger.error(f"Помилка отримання статистики завдань: {str(e)}")
            return jsonify({
                "status": "error",
                "message": "Помилка отримання статистики завдань",
                "error_code": "STATISTICS_ERROR"
            }), 500

    @staticmethod
    def _sanitize_task_data(task_data: Dict[str, Any]) -> Dict[str, Any]:
        """Санітизація даних завдання"""
        sanitized = {}

        # Прості рядкові поля
        string_fields = ['type', 'title', 'description', 'instructions', 'platform', 'action', 'url',
                         'channel_username']
        for field in string_fields:
            if field in task_data:
                sanitized[field] = sanitize_string(task_data[field])

        # Числові поля
        if 'priority' in task_data:
            try:
                sanitized['priority'] = int(task_data['priority'])
            except (ValueError, TypeError):
                sanitized['priority'] = 1

        # Булеві поля
        if 'is_active' in task_data:
            sanitized['is_active'] = bool(task_data['is_active'])

        # Складні об'єкти
        if 'reward' in task_data and isinstance(task_data['reward'], dict):
            sanitized['reward'] = {}
            for key in ['winix', 'tickets']:
                if key in task_data['reward']:
                    try:
                        sanitized['reward'][key] = int(task_data['reward'][key])
                    except (ValueError, TypeError):
                        sanitized['reward'][key] = 0

        if 'requirements' in task_data and isinstance(task_data['requirements'], dict):
            sanitized['requirements'] = task_data['requirements']

        if 'metadata' in task_data and isinstance(task_data['metadata'], dict):
            sanitized['metadata'] = task_data['metadata']

        # Дати
        if 'expires_at' in task_data:
            sanitized['expires_at'] = sanitize_string(task_data['expires_at'])

        return sanitized

    @staticmethod
    def _validate_task_creation_data(task_data: Dict[str, Any]) -> List[str]:
        """Валідація даних для створення завдання"""
        errors = []

        # Валідація URL якщо є
        if 'url' in task_data and task_data['url']:
            if not validate_url(task_data['url']):
                errors.append("Невалідний URL")

        # Валідація винагороди
        if 'reward' in task_data:
            reward = task_data['reward']
            if not isinstance(reward, dict):
                errors.append("Винагорода має бути об'єктом")
            else:
                winix = reward.get('winix', 0)
                tickets = reward.get('tickets', 0)

                if winix < 0 or winix > 10000:
                    errors.append("Винагорода WINIX має бути від 0 до 10,000")

                if tickets < 0 or tickets > 100:
                    errors.append("Винагорода tickets має бути від 0 до 100")

        # Валідація пріоритету
        if 'priority' in task_data:
            priority = task_data['priority']
            if not isinstance(priority, int) or priority < 1 or priority > 10:
                errors.append("Пріоритет має бути від 1 до 10")

        return errors

    @staticmethod
    @public_endpoint(max_requests=20, window_seconds=60)
    def get_tasks_health() -> tuple[Dict[str, Any], int]:
        """
        Перевірка здоров'я сервісу завдань

        Returns:
            Статус здоров'я та HTTP код
        """
        try:
            # Перевіряємо доступність компонентів
            health_status = {}
            overall_healthy = True

            # Перевірка моделі завдань
            if task_model:
                try:
                    # Пробуємо отримати статистику
                    stats = task_model.get_tasks_statistics()
                    health_status['task_model'] = {
                        "status": "healthy",
                        "total_tasks": stats.get('total_tasks', 0),
                        "active_tasks": stats.get('active_tasks', 0)
                    }
                except Exception as e:
                    health_status['task_model'] = {
                        "status": "unhealthy",
                        "error": str(e)
                    }
                    overall_healthy = False
            else:
                health_status['task_model'] = {
                    "status": "unavailable",
                    "error": "Model not loaded"
                }
                overall_healthy = False

            # Перевірка Transaction Service
            if transaction_service:
                try:
                    stats_result = transaction_service.get_service_statistics()
                    health_status['transaction_service'] = {
                        "status": "healthy" if stats_result['success'] else "degraded",
                        "version": "1.0.0",
                        "reward_integration": "active"
                    }
                except Exception as e:
                    health_status['transaction_service'] = {
                        "status": "unhealthy",
                        "error": str(e)
                    }
                    # Не впливає на загальне здоров'я task сервісу
            else:
                health_status['transaction_service'] = {
                    "status": "unavailable",
                    "error": "Service not loaded",
                    "impact": "manual_reward_mode"
                }

            # Перевірка бази даних
            try:
                from supabase_client import supabase
                if supabase:
                    # Простий тест підключення
                    supabase.table("tasks").select("id").limit(1).execute()
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

            # Перевірка енумів
            try:
                if TaskType and TaskStatus and TaskPlatform and TaskAction:
                    health_status['enums'] = {
                        "status": "healthy",
                        "task_types": len([t for t in TaskType]),
                        "task_platforms": len([p for p in TaskPlatform]),
                        "task_actions": len([a for a in TaskAction])
                    }
                else:
                    health_status['enums'] = {
                        "status": "degraded",
                        "error": "Some enums not available"
                    }
            except Exception as e:
                health_status['enums'] = {
                    "status": "unhealthy",
                    "error": str(e)
                }

            status = "healthy" if overall_healthy else "degraded"
            http_code = 200 if overall_healthy else 503

            logger.info(f"Перевірка здоров'я сервісу завдань: {status}")

            return jsonify({
                "status": status,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "services": health_status,
                "version": "1.0.0",
                "features": {
                    "automatic_rewards": transaction_service is not None,
                    "transaction_logging": transaction_service is not None,
                    "atomic_operations": transaction_service is not None
                }
            }), http_code

        except Exception as e:
            logger.error(f"Помилка перевірки здоров'я сервісу завдань: {str(e)}")
            return jsonify({
                "status": "unhealthy",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "error": str(e)
            }), 500


# Експорт функцій для реєстрації маршрутів
def get_tasks_list(telegram_id: str):
    """Wrapper для отримання списку завдань"""
    return TasksController.get_tasks_list(telegram_id)


def get_task_details(task_id: str):
    """Wrapper для отримання деталей завдання"""
    return TasksController.get_task_details(task_id)


def start_task(telegram_id: str, task_id: str):
    """Wrapper для початку виконання завдання"""
    return TasksController.start_task(telegram_id, task_id)


def verify_task(telegram_id: str, task_id: str):
    """Wrapper для верифікації завдання"""
    return TasksController.verify_task(telegram_id, task_id)


def create_task():
    """Wrapper для створення завдання"""
    return TasksController.create_task()


def get_user_task_progress(telegram_id: str):
    """Wrapper для отримання прогресу користувача"""
    return TasksController.get_user_task_progress(telegram_id)


def get_tasks_statistics():
    """Wrapper для отримання статистики завдань"""
    return TasksController.get_tasks_statistics()


def get_tasks_health():
    """Wrapper для перевірки здоров'я сервісу"""
    return TasksController.get_tasks_health()


# Експорт
__all__ = [
    'TasksController',
    'get_tasks_list',
    'get_task_details',
    'start_task',
    'verify_task',
    'create_task',
    'get_user_task_progress',
    'get_tasks_statistics',
    'get_tasks_health'
]