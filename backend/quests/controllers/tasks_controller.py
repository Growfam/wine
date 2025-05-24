"""
Контролер для управління завданнями в системі WINIX
API endpoints для створення, отримання та виконання завдань
ОНОВЛЕНО: Інтеграція з Transaction Service для атомарних операцій з винагородами
"""

import logging
from typing import Dict, Any, List, Optional, Tuple
from flask import request, jsonify, Response
from datetime import datetime, timezone

# Налаштування логування
logger = logging.getLogger(__name__)

# Глобальні змінні для безпечного імпорту
transaction_service: Optional[Any] = None
secure_endpoint: Optional[Any] = None
public_endpoint: Optional[Any] = None
validate_json: Optional[Any] = None
validate_telegram_id: Optional[Any] = None
get_current_user: Optional[Any] = None
get_json_data: Optional[Any] = None
validate_tg_id: Optional[Any] = None
sanitize_string: Optional[Any] = None
validate_url: Optional[Any] = None
task_model: Optional[Any] = None
TaskType: Optional[Any] = None
TaskStatus: Optional[Any] = None
TaskPlatform: Optional[Any] = None
TaskAction: Optional[Any] = None

# Імпорт Transaction Service
try:
    from ..services.transaction_service import transaction_service
except ImportError:
    transaction_service = None
    try:
        from backend.quests.services.transaction_service import transaction_service
    except ImportError:
        transaction_service = None
        logger.error("Transaction service недоступний")

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
    secure_endpoint = None
    public_endpoint = None
    validate_json = None
    validate_telegram_id = None
    get_current_user = None
    get_json_data = None
    validate_tg_id = None
    sanitize_string = None
    validate_url = None
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
        secure_endpoint = None
        public_endpoint = None
        validate_json = None
        validate_telegram_id = None
        get_current_user = None
        get_json_data = None
        validate_tg_id = None
        sanitize_string = None
        validate_url = None
        logger.error("Не вдалося імпортувати декоратори та валідатори")

# Імпорт моделей та сервісів
try:
    from ..models.task import task_model, TaskType, TaskStatus, TaskPlatform, TaskAction
except ImportError:
    task_model = None
    TaskType = None
    TaskStatus = None
    TaskPlatform = None
    TaskAction = None
    try:
        from backend.quests.models.task import task_model, TaskType, TaskStatus, TaskPlatform, TaskAction
    except ImportError:
        task_model = None
        TaskType = None
        TaskStatus = None
        TaskPlatform = None
        TaskAction = None
        logger.error("Не вдалося імпортувати модель завдань")


class TasksController:
    """Контролер для управління завданнями з підтримкою транзакцій"""

    @staticmethod
    def get_tasks_list(telegram_id: str) -> Tuple[Dict[str, Any], int]:
        """
        Отримання списку завдань для користувача
        """
        try:
            logger.info(f"Отримання списку завдань для користувача {telegram_id}")

            if not task_model or not TaskType:
                return {
                    "status": "error",
                    "message": "Сервіс завдань недоступний",
                    "error_code": "SERVICE_UNAVAILABLE"
                }, 503

            # Отримуємо параметри фільтрації
            task_type_param: str = request.args.get('type', 'all').lower()
            include_completed: bool = request.args.get('include_completed', 'false').lower() == 'true'

            # Валідуємо тип завдань
            task_type: Optional[Any] = None
            if task_type_param != 'all':
                try:
                    task_type = TaskType(task_type_param)
                except ValueError:
                    valid_types: List[str] = [t.value for t in TaskType] + ['all']
                    return {
                        "status": "error",
                        "message": f"Невалідний тип завдань. Доступні: {', '.join(valid_types)}",
                        "error_code": "INVALID_TASK_TYPE"
                    }, 400

            # Отримуємо завдання
            user_tasks: List[Dict[str, Any]] = task_model.get_user_tasks(
                telegram_id=telegram_id,
                task_type=task_type,
                include_completed=include_completed
            )

            # Групуємо завдання по типах
            tasks_by_type: Dict[str, List[Dict[str, Any]]] = {}
            total_tasks: int = 0
            available_tasks: int = 0
            completed_tasks: int = 0

            for task in user_tasks:
                task_type_value: str = str(task['type'])

                if task_type_value not in tasks_by_type:
                    tasks_by_type[task_type_value] = []

                tasks_by_type[task_type_value].append(task)
                total_tasks += 1

                user_status: str = task.get('user_status', TaskStatus.AVAILABLE.value)
                if user_status == TaskStatus.AVAILABLE.value:
                    available_tasks += 1
                elif user_status in [TaskStatus.COMPLETED.value, TaskStatus.CLAIMED.value]:
                    completed_tasks += 1

            # Рахуємо потенційні винагороди
            potential_winix: int = sum(
                task['reward']['winix'] for task in user_tasks
                if task.get('user_status') == TaskStatus.AVAILABLE.value
            )
            potential_tickets: int = sum(
                task['reward']['tickets'] for task in user_tasks
                if task.get('user_status') == TaskStatus.AVAILABLE.value
            )

            logger.info(f"Завдання для {telegram_id}: всього={total_tasks}, "
                        f"доступно={available_tasks}, виконано={completed_tasks}")

            return {
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
            }, 200

        except Exception as e:
            logger.error(f"Помилка отримання списку завдань для {telegram_id}: {str(e)}")
            return {
                "status": "error",
                "message": "Помилка отримання списку завдань",
                "error_code": "TASKS_FETCH_ERROR"
            }, 500

    @staticmethod
    def get_task_details(task_id: str) -> Tuple[Dict[str, Any], int]:
        """
        Отримання детальної інформації про завдання
        """
        try:
            logger.info(f"Отримання деталей завдання {task_id}")

            if not task_model:
                return {
                    "status": "error",
                    "message": "Сервіс завдань недоступний",
                    "error_code": "SERVICE_UNAVAILABLE"
                }, 503

            # Отримуємо завдання
            task: Optional[Dict[str, Any]] = task_model.get_task_by_id(task_id)

            if not task:
                return {
                    "status": "error",
                    "message": "Завдання не знайдено",
                    "error_code": "TASK_NOT_FOUND"
                }, 404

            # Якщо є telegram_id в параметрах, додаємо статус користувача
            telegram_id: Optional[str] = request.args.get('telegram_id')
            if telegram_id:
                try:
                    telegram_id = str(telegram_id)
                    user_status: Optional[Dict[str, Any]] = task_model._get_user_task_status(telegram_id, task_id)

                    if user_status:
                        task['user_status'] = user_status['status']
                        task['user_progress'] = user_status.get('progress', 0)
                        task['started_at'] = user_status.get('started_at')
                        task['completed_at'] = user_status.get('completed_at')

                        # Додаємо інформацію про транзакції якщо завдання виконано
                        if (user_status['status'] in [TaskStatus.COMPLETED.value, TaskStatus.CLAIMED.value]
                            and transaction_service):
                            try:
                                history_result: Dict[str, Any] = transaction_service.get_user_transaction_history(
                                    telegram_id=telegram_id,
                                    limit=50
                                )

                                if history_result['success']:
                                    task_transactions: List[Dict[str, Any]] = [
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

            return {
                "status": "success",
                "data": task
            }, 200

        except Exception as e:
            logger.error(f"Помилка отримання деталей завдання {task_id}: {str(e)}")
            return {
                "status": "error",
                "message": "Помилка отримання деталей завдання",
                "error_code": "TASK_DETAILS_ERROR"
            }, 500

    @staticmethod
    def start_task(telegram_id: str, task_id: str) -> Tuple[Dict[str, Any], int]:
        """
        Початок виконання завдання користувачем
        """
        try:
            logger.info(f"Початок виконання завдання {task_id} користувачем {telegram_id}")

            if not task_model:
                return {
                    "status": "error",
                    "message": "Сервіс завдань недоступний",
                    "error_code": "SERVICE_UNAVAILABLE"
                }, 503

            # Валідуємо task_id
            if sanitize_string:
                task_id = sanitize_string(task_id).strip()
            if not task_id:
                return {
                    "status": "error",
                    "message": "ID завдання не вказано",
                    "error_code": "MISSING_TASK_ID"
                }, 400

            # Розпочинаємо завдання
            result: Dict[str, Any] = task_model.start_task(telegram_id, task_id)

            if result['success']:
                # Логуємо початок виконання через transaction service якщо доступний
                if transaction_service:
                    try:
                        try:
                            from ..models.transaction import TransactionAmount, TransactionType
                        except ImportError:
                            from backend.quests.models.transaction import TransactionAmount, TransactionType

                        # Отримуємо дані завдання для метаданих
                        task: Optional[Dict[str, Any]] = task_model.get_task_by_id(task_id)

                        # Створюємо запис про початок завдання (нульова винагорода)
                        start_result: Dict[str, Any] = transaction_service.process_reward(
                            telegram_id=telegram_id,
                            reward_amount=TransactionAmount(winix=0, tickets=0, flex=0),
                            transaction_type=TransactionType.ADMIN_ADJUSTMENT,
                            description=f"Розпочато виконання завдання: {task.get('title', task_id) if task else task_id}",
                            reference_id=task_id,
                            reference_type="task_start",
                            metadata={
                                'operation': 'task_start',
                                'task_id': task_id,
                                'task_type': task.get('type', 'unknown') if task else 'unknown',
                                'task_title': task.get('title', '') if task else '',
                                'expected_reward': task.get('reward', {}) if task else {},
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

                return {
                    "status": "success",
                    "message": result['message'],
                    "data": {
                        **result['data'],
                        "service_info": {
                            "transaction_service_available": transaction_service is not None,
                            "progress_logged": transaction_service is not None
                        }
                    }
                }, 200
            else:
                logger.warning(f"Не вдалося розпочати завдання {task_id} для {telegram_id}: {result['message']}")

                # Визначаємо код статусу
                error_code: str = result.get('error_code', 'START_FAILED')

                status_code: int = 500
                if error_code == 'TASK_NOT_FOUND':
                    status_code = 404
                elif error_code in ['TASK_INACTIVE', 'TASK_EXPIRED', 'TASK_NOT_AVAILABLE']:
                    status_code = 400
                elif error_code == 'TASK_ALREADY_COMPLETED':
                    status_code = 409

                return {
                    "status": "error",
                    "message": result['message'],
                    "error_code": error_code
                }, status_code

        except Exception as e:
            logger.error(f"Помилка початку виконання завдання {task_id} для {telegram_id}: {str(e)}")
            return {
                "status": "error",
                "message": "Внутрішня помилка сервера",
                "error_code": "INTERNAL_ERROR"
            }, 500

    @staticmethod
    def verify_task(telegram_id: str, task_id: str) -> Tuple[Dict[str, Any], int]:
        """
        Верифікація виконання завдання користювачем з автоматичним нарахуванням винагороди
        """
        try:
            logger.info(f"Верифікація завдання {task_id} для користувача {telegram_id}")

            if not task_model:
                return {
                    "status": "error",
                    "message": "Сервіс завдань недоступний",
                    "error_code": "SERVICE_UNAVAILABLE"
                }, 503

            # Валідуємо task_id
            if sanitize_string:
                task_id = sanitize_string(task_id).strip()
            if not task_id:
                return {
                    "status": "error",
                    "message": "ID завдання не вказано",
                    "error_code": "MISSING_TASK_ID"
                }, 400

            # Отримуємо дані верифікації
            verification_data: Dict[str, Any] = {}
            if get_json_data:
                verification_data = get_json_data() or {}

            # Санітизуємо дані
            sanitized_verification_data: Dict[str, Any] = {}
            for key, value in verification_data.items():
                clean_key: str = sanitize_string(key) if sanitize_string else str(key)
                if isinstance(value, str) and sanitize_string:
                    sanitized_verification_data[clean_key] = sanitize_string(value)
                else:
                    sanitized_verification_data[clean_key] = value

            # Виконуємо верифікацію
            result: Dict[str, Any] = task_model.verify_task(telegram_id, task_id, sanitized_verification_data)

            if result['success']:
                # Отримуємо дані завдання для винагороди
                task: Optional[Dict[str, Any]] = task_model.get_task_by_id(task_id)
                if task and task.get('reward'):
                    # Нараховуємо винагороду через transaction service
                    if transaction_service:
                        reward_result: Dict[str, Any] = transaction_service.process_task_reward(
                            telegram_id=telegram_id,
                            winix_amount=task['reward'].get('winix', 0),
                            tickets_amount=task['reward'].get('tickets', 0),
                            task_id=task_id,
                            task_type=task.get('type', 'unknown')
                        )

                        if reward_result['success']:
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
                            TasksController._process_direct_reward(result, task, task_id, telegram_id)
                    else:
                        # Прямий метод якщо transaction service недоступний
                        TasksController._process_direct_reward(result, task, task_id, telegram_id)

                logger.info(f"Завдання {task_id} успішно верифіковано для користувача {telegram_id}")

                result['data']['service_info'] = {
                    "transaction_service_available": transaction_service is not None,
                    "atomic_rewards": transaction_service is not None
                }

                return {
                    "status": "success",
                    "message": result['message'],
                    "data": result['data']
                }, 200
            else:
                logger.warning(f"Верифікація завдання {task_id} не пройдена для {telegram_id}: {result['message']}")

                error_code: str = result.get('error_code', 'VERIFICATION_FAILED')
                status_code: int = 500

                if error_code == 'TASK_NOT_FOUND':
                    status_code = 404
                elif error_code in ['TASK_NOT_STARTED', 'TASK_ALREADY_COMPLETED']:
                    status_code = 400
                elif error_code == 'VERIFICATION_FAILED':
                    status_code = 422

                response_data: Dict[str, Any] = {
                    "status": "error",
                    "message": result['message'],
                    "error_code": error_code
                }

                if 'data' in result:
                    response_data['data'] = result['data']

                return response_data, status_code

        except Exception as e:
            logger.error(f"Помилка верифікації завдання {task_id} для {telegram_id}: {str(e)}")
            return {
                "status": "error",
                "message": "Внутрішня помилка сервера",
                "error_code": "INTERNAL_ERROR"
            }, 500

    @staticmethod
    def _process_direct_reward(result: Dict[str, Any], task: Dict[str, Any], task_id: str, telegram_id: str) -> None:
        """Обробка прямої винагороди через базу даних"""
        try:
            from supabase_client import update_balance, update_coins

            operations: List[str] = []
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
                    'transaction_service_unavailable': transaction_service is None
                }
                logger.info(f"Винагорода за завдання {task_id} нарахована користувачу {telegram_id} (прямий метод)")

        except Exception as direct_error:
            logger.error(f"Помилка прямого нарахування винагороди: {direct_error}")
            result['data']['reward_error'] = "Не вдалося нарахувати винагороду"

    @staticmethod
    def create_task() -> Tuple[Dict[str, Any], int]:
        """
        Створення нового завдання (адміністративна функція)
        """
        try:
            logger.info("Створення нового завдання")

            if not task_model or not TaskType:
                return {
                    "status": "error",
                    "message": "Сервіс завдань недоступний",
                    "error_code": "SERVICE_UNAVAILABLE"
                }, 503

            # Отримуємо дані завдання
            task_data: Dict[str, Any] = {}
            if get_json_data:
                task_data = get_json_data() or {}

            if not task_data:
                return {
                    "status": "error",
                    "message": "Дані завдання відсутні",
                    "error_code": "MISSING_TASK_DATA"
                }, 400

            # Санітизуємо дані
            sanitized_data: Dict[str, Any] = TasksController._sanitize_task_data(task_data)

            # Додаткова валідація
            validation_errors: List[str] = TasksController._validate_task_creation_data(sanitized_data)
            if validation_errors:
                return {
                    "status": "error",
                    "message": "Невалідні дані завдання",
                    "errors": validation_errors,
                    "error_code": "INVALID_TASK_DATA"
                }, 400

            # Створюємо завдання
            result: Dict[str, Any] = task_model.create_task(sanitized_data)

            if result['success']:
                # Логуємо створення через transaction service якщо доступний
                if transaction_service:
                    try:
                        try:
                            from ..models.transaction import TransactionAmount, TransactionType
                        except ImportError:
                            from backend.quests.models.transaction import TransactionAmount, TransactionType

                        creation_result: Dict[str, Any] = transaction_service.process_reward(
                            telegram_id='system',
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

                return {
                    "status": "success",
                    "message": result['message'],
                    "data": {
                        **result['data'],
                        "service_info": {
                            "transaction_service_available": transaction_service is not None,
                            "creation_logged": transaction_service is not None
                        }
                    }
                }, 201
            else:
                logger.error(f"Не вдалося створити завдання: {result['message']}")
                return {
                    "status": "error",
                    "message": result['message'],
                    "error_code": result.get('error_code', 'CREATE_FAILED')
                }, 500

        except Exception as e:
            logger.error(f"Помилка створення завдання: {str(e)}")
            return {
                "status": "error",
                "message": "Внутрішня помилка сервера",
                "error_code": "INTERNAL_ERROR"
            }, 500

    @staticmethod
    def get_user_task_progress(telegram_id: str) -> Tuple[Dict[str, Any], int]:
        """
        Отримання прогресу виконання завдань користувачем з транзакціями
        """
        try:
            logger.info(f"Отримання прогресу завдань для користувача {telegram_id}")

            if not task_model:
                return {
                    "status": "error",
                    "message": "Сервіс завдань недоступний",
                    "error_code": "SERVICE_UNAVAILABLE"
                }, 503

            # Отримуємо завдання користувача з усіма статусами
            user_tasks: List[Dict[str, Any]] = task_model.get_user_tasks(telegram_id, include_completed=True)

            # Рахуємо статистику
            progress_stats: Dict[str, Any] = {
                'total_tasks': 0,
                'available_tasks': 0,
                'started_tasks': 0,
                'pending_tasks': 0,
                'completed_tasks': 0,
                'claimed_tasks': 0,
                'expired_tasks': 0,
                'total_earned': {'winix': 0, 'tickets': 0},
                'potential_earnings': {'winix': 0, 'tickets': 0},
                'by_type': {}
            }

            for task in user_tasks:
                task_type: str = str(task['type'])
                user_status: str = task.get('user_status', TaskStatus.AVAILABLE.value)

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
                    progress_stats['by_type'][task_type] = {'total': 0, 'completed': 0, 'available': 0}

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
            transaction_stats: Dict[str, Any] = {'verification_available': False}
            if transaction_service:
                try:
                    history_result: Dict[str, Any] = transaction_service.get_user_transaction_history(
                        telegram_id=telegram_id, limit=100
                    )

                    if history_result['success']:
                        task_transactions: List[Dict[str, Any]] = [
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
                            'matches_calculated': len(task_transactions) == (
                                progress_stats['completed_tasks'] + progress_stats['claimed_tasks']
                            )
                        }

                except Exception as e:
                    logger.warning(f"Не вдалося отримати статистику з транзакцій: {e}")
                    transaction_stats = {'verification_available': False, 'error': str(e)}

            logger.info(f"Прогрес завдань для {telegram_id}: виконано {progress_stats['completion_rate']}%")

            return {
                "status": "success",
                "data": {
                    "telegram_id": telegram_id,
                    "progress": progress_stats,
                    "transaction_verification": transaction_stats,
                    "last_updated": datetime.now(timezone.utc).isoformat(),
                    "service_info": {"transaction_service_available": transaction_service is not None}
                }
            }, 200

        except Exception as e:
            logger.error(f"Помилка отримання прогресу завдань для {telegram_id}: {str(e)}")
            return {
                "status": "error",
                "message": "Помилка отримання прогресу завдань",
                "error_code": "PROGRESS_FETCH_ERROR"
            }, 500

    @staticmethod
    def get_tasks_statistics() -> Tuple[Dict[str, Any], int]:
        """
        Отримання загальної статистики завдань
        """
        try:
            logger.info("Отримання загальної статистики завдань")

            if not task_model:
                return {
                    "status": "error",
                    "message": "Сервіс завдань недоступний",
                    "error_code": "SERVICE_UNAVAILABLE"
                }, 503

            # Отримуємо статистику з task моделі
            statistics: Dict[str, Any] = task_model.get_tasks_statistics()

            # Додаємо статистику з transaction service якщо доступний
            if transaction_service:
                try:
                    transaction_stats_result: Dict[str, Any] = transaction_service.get_service_statistics()

                    if transaction_stats_result['success']:
                        transaction_stats: Dict[str, Any] = transaction_stats_result.get('statistics', {})
                        type_breakdown: Dict[str, int] = transaction_stats.get('type_breakdown', {})
                        task_reward_count: int = type_breakdown.get('task_reward', 0)

                        statistics['transaction_service_stats'] = {
                            'task_reward_transactions': task_reward_count,
                            'service_available': True
                        }

                except Exception as e:
                    logger.warning(f"Не вдалося отримати статистику транзакцій: {e}")
                    statistics['transaction_service_stats'] = {'service_available': False, 'error': str(e)}
            else:
                statistics['transaction_service_stats'] = {'service_available': False}

            # Додаємо метадані
            statistics['metadata'] = {
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "system_version": "1.0.0",
                "supported_types": [t.value for t in TaskType] if TaskType else [],
                "supported_platforms": [p.value for p in TaskPlatform] if TaskPlatform else [],
                "supported_actions": [a.value for a in TaskAction] if TaskAction else [],
                "transaction_service_integration": transaction_service is not None
            }

            logger.info(f"Статистика завдань: {statistics.get('total_tasks', 0)} завдань")

            return {"status": "success", "data": statistics}, 200

        except Exception as e:
            logger.error(f"Помилка отримання статистики завдань: {str(e)}")
            return {
                "status": "error",
                "message": "Помилка отримання статистики завдань",
                "error_code": "STATISTICS_ERROR"
            }, 500

    @staticmethod
    def get_tasks_health() -> Tuple[Dict[str, Any], int]:
        """
        Перевірка здоров'я сервісу завдань
        """
        try:
            health_status: Dict[str, Dict[str, Any]] = {}
            overall_healthy: bool = True

            # Перевірка моделі завдань
            if task_model:
                try:
                    stats: Dict[str, Any] = task_model.get_tasks_statistics()
                    health_status['task_model'] = {
                        "status": "healthy",
                        "total_tasks": stats.get('total_tasks', 0),
                        "active_tasks": stats.get('active_tasks', 0)
                    }
                except Exception as e:
                    health_status['task_model'] = {"status": "unhealthy", "error": str(e)}
                    overall_healthy = False
            else:
                health_status['task_model'] = {"status": "unavailable", "error": "Model not loaded"}
                overall_healthy = False

            # Перевірка Transaction Service
            if transaction_service:
                try:
                    stats_result: Dict[str, Any] = transaction_service.get_service_statistics()
                    health_status['transaction_service'] = {
                        "status": "healthy" if stats_result['success'] else "degraded",
                        "version": "1.0.0",
                        "reward_integration": "active"
                    }
                except Exception as e:
                    health_status['transaction_service'] = {"status": "unhealthy", "error": str(e)}
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
                    # Використовуємо більш безпечну перевірку
                    query_builder = supabase.table("tasks").select("id").limit(1)
                    result = query_builder.execute()  # type: ignore
                    health_status['database'] = {"status": "healthy", "connection": "active"}
                else:
                    health_status['database'] = {"status": "unavailable", "error": "Supabase not initialized"}
                    overall_healthy = False
            except Exception as e:
                health_status['database'] = {"status": "unhealthy", "error": str(e)}
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
                    health_status['enums'] = {"status": "degraded", "error": "Some enums not available"}
            except Exception as e:
                health_status['enums'] = {"status": "unhealthy", "error": str(e)}

            status: str = "healthy" if overall_healthy else "degraded"
            http_code: int = 200 if overall_healthy else 503

            logger.info(f"Перевірка здоров'я сервісу завдань: {status}")

            return {
                "status": status,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "services": health_status,
                "version": "1.0.0",
                "features": {
                    "automatic_rewards": transaction_service is not None,
                    "transaction_logging": transaction_service is not None,
                    "atomic_operations": transaction_service is not None
                }
            }, http_code

        except Exception as e:
            logger.error(f"Помилка перевірки здоров'я сервісу завдань: {str(e)}")
            return {
                "status": "unhealthy",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "error": str(e)
            }, 500

    @staticmethod
    def _sanitize_task_data(task_data: Dict[str, Any]) -> Dict[str, Any]:
        """Санітизація даних завдання"""
        sanitized: Dict[str, Any] = {}

        # Прості рядкові поля
        string_fields: List[str] = [
            'type', 'title', 'description', 'instructions',
            'platform', 'action', 'url', 'channel_username'
        ]

        for field in string_fields:
            if field in task_data and task_data[field] is not None:
                if sanitize_string:
                    sanitized[field] = sanitize_string(str(task_data[field]))
                else:
                    sanitized[field] = str(task_data[field])

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
            if sanitize_string:
                sanitized['expires_at'] = sanitize_string(str(task_data['expires_at']))
            else:
                sanitized['expires_at'] = str(task_data['expires_at'])

        return sanitized

    @staticmethod
    def _validate_task_creation_data(task_data: Dict[str, Any]) -> List[str]:
        """Валідація даних для створення завдання"""
        errors: List[str] = []

        # Валідація URL якщо є
        if 'url' in task_data and task_data['url']:
            if validate_url and not validate_url(task_data['url']):
                errors.append("Невалідний URL")

        # Валідація винагороди
        if 'reward' in task_data:
            reward: Any = task_data['reward']
            if not isinstance(reward, dict):
                errors.append("Винагорода має бути об'єктом")
            else:
                winix: int = reward.get('winix', 0)
                tickets: int = reward.get('tickets', 0)

                if winix < 0 or winix > 10000:
                    errors.append("Винагорода WINIX має бути від 0 до 10,000")

                if tickets < 0 or tickets > 100:
                    errors.append("Винагорода tickets має бути від 0 до 100")

        # Валідація пріоритету
        if 'priority' in task_data:
            priority: Any = task_data['priority']
            if not isinstance(priority, int) or priority < 1 or priority > 10:
                errors.append("Пріоритет має бути від 1 до 10")

        return errors
# Wrapper функції для реєстрації маршрутів
def get_tasks_list(telegram_id: str) -> Response:
    """Wrapper для отримання списку завдань"""
    result, status_code = TasksController.get_tasks_list(telegram_id)
    response = jsonify(result)
    response.status_code = status_code
    return response


def get_task_details(task_id: str) -> Response:
    """Wrapper для отримання деталей завдання"""
    result, status_code = TasksController.get_task_details(task_id)
    response = jsonify(result)
    response.status_code = status_code
    return response


def start_task(telegram_id: str, task_id: str) -> Response:
    """Wrapper для початку виконання завдання"""
    result, status_code = TasksController.start_task(telegram_id, task_id)
    response = jsonify(result)
    response.status_code = status_code
    return response


def verify_task(telegram_id: str, task_id: str) -> Response:
    """Wrapper для верифікації завдання"""
    result, status_code = TasksController.verify_task(telegram_id, task_id)
    response = jsonify(result)
    response.status_code = status_code
    return response


def create_task() -> Response:
    """Wrapper для створення завдання"""
    result, status_code = TasksController.create_task()
    response = jsonify(result)
    response.status_code = status_code
    return response


def get_user_task_progress(telegram_id: str) -> Response:
    """Wrapper для отримання прогресу користувача"""
    result, status_code = TasksController.get_user_task_progress(telegram_id)
    response = jsonify(result)
    response.status_code = status_code
    return response


def get_tasks_statistics() -> Response:
    """Wrapper для отримання статистики завдань"""
    result, status_code = TasksController.get_tasks_statistics()
    response = jsonify(result)
    response.status_code = status_code
    return response


def get_tasks_health() -> Response:
    """Wrapper для перевірки здоров'я сервісу"""
    result, status_code = TasksController.get_tasks_health()
    response = jsonify(result)
    response.status_code = status_code
    return response

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