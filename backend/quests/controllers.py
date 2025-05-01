"""
Контролери для API завдань та бонусів у системі WINIX.
Обробляють запити API та передають керування відповідним сервісам.
"""
import logging
import sys
import os
from flask import jsonify, request, g
from typing import Dict, Any, Optional, Tuple
from datetime import datetime

# Додаємо кореневу папку проекту до шляху
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
if parent_dir not in sys.path:
    sys.path.append(parent_dir)

# Імпорт моделей та сервісів
from models.task import Task, TASK_TYPE_SOCIAL, TASK_TYPE_PARTNER, TASK_TYPE_LIMITED, TASK_TYPE_DAILY
from models.user_progress import UserProgress, STATUS_NOT_STARTED, STATUS_IN_PROGRESS, STATUS_COMPLETED, STATUS_VERIFIED
from quests.task_service import TaskService
from quests.verification_service import VerificationService
from quests.leaderboard_service import LeaderboardService
from quests.referral_service import ReferralService
from quests.daily_bonus import DailyBonusService
from utils.api_helpers import api_success, api_error, api_validation_error, handle_exception, validate_request_data, validate_numeric_field
from supabase_client import supabase

# Налаштування логування
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# НОВІ ФУНКЦІЇ ДЛЯ КЕРУВАННЯ ЗАВДАННЯМИ

def create_new_task(data):
    """
    Створення нового завдання (тільки для адміністраторів).

    Args:
        data (dict): Дані нового завдання

    Returns:
        tuple: (відповідь API, код статусу)
    """
    try:
        # Перевірка на обов'язкові поля
        required_fields = [
            "title", "description", "task_type", "reward_type",
            "reward_amount", "action_type"
        ]
        is_valid, errors = validate_request_data(data, required_fields)
        if not is_valid:
            return api_validation_error(errors)

        # Перевірка типу завдання
        valid_task_types = [TASK_TYPE_SOCIAL, TASK_TYPE_PARTNER, TASK_TYPE_LIMITED, TASK_TYPE_DAILY]
        if data.get("task_type") not in valid_task_types:
            return api_error(message="Невідомий тип завдання", details={"task_type": "Невідомий тип завдання"})

        # Валідація числових полів
        is_valid, error_msg, reward_amount = validate_numeric_field(
            data.get("reward_amount"), "reward_amount", min_value=1
        )
        if not is_valid:
            return api_error(message=error_msg)

        # Валідація цільового значення, якщо воно є
        if "target_value" in data:
            is_valid, error_msg, target_value = validate_numeric_field(
                data.get("target_value"), "target_value", min_value=1, integer_only=True
            )
            if not is_valid:
                return api_error(message=error_msg)
            data["target_value"] = target_value

        # Оновлюємо reward_amount у даних
        data["reward_amount"] = reward_amount

        # Створюємо завдання через сервіс
        task = TaskService.create_task(data)

        if not task:
            return api_error(message="Не вдалося створити завдання")

        return api_success(
            data={"task": task.to_dict()},
            message="Завдання успішно створено"
        )

    except Exception as e:
        return handle_exception(e, "Помилка створення завдання")


def update_existing_task(task_id, data):
    """
    Оновлення існуючого завдання (тільки для адміністраторів).

    Args:
        task_id (str): ID завдання для оновлення
        data (dict): Дані для оновлення

    Returns:
        tuple: (відповідь API, код статусу)
    """
    try:
        # Перевіряємо, чи існує завдання
        task = TaskService.get_task_by_id(task_id)

        if not task:
            return api_error(message=f"Завдання з ID {task_id} не знайдено", status_code=404)

        # Валідація числових полів, якщо вони присутні
        if "reward_amount" in data:
            is_valid, error_msg, reward_amount = validate_numeric_field(
                data.get("reward_amount"), "reward_amount", min_value=1
            )
            if not is_valid:
                return api_error(message=error_msg)
            data["reward_amount"] = reward_amount

        if "target_value" in data:
            is_valid, error_msg, target_value = validate_numeric_field(
                data.get("target_value"), "target_value", min_value=1, integer_only=True
            )
            if not is_valid:
                return api_error(message=error_msg)
            data["target_value"] = target_value

        # Оновлюємо завдання
        updated_task = TaskService.update_task(task_id, data)

        if not updated_task:
            return api_error(message="Не вдалося оновити завдання")

        return api_success(
            data={"task": updated_task.to_dict()},
            message="Завдання успішно оновлено"
        )

    except Exception as e:
        return handle_exception(e, f"Помилка оновлення завдання {task_id}")


def delete_task_by_id(task_id):
    """
    Видалення завдання (тільки для адміністраторів).

    Args:
        task_id (str): ID завдання для видалення

    Returns:
        tuple: (відповідь API, код статусу)
    """
    try:
        # Перевіряємо, чи існує завдання
        task = TaskService.get_task_by_id(task_id)

        if not task:
            return api_error(message=f"Завдання з ID {task_id} не знайдено", status_code=404)

        # Видаляємо завдання
        deleted = TaskService.delete_task(task_id)

        if not deleted:
            return api_error(message="Не вдалося видалити завдання")

        return api_success(
            message=f"Завдання {task_id} успішно видалено"
        )

    except Exception as e:
        return handle_exception(e, f"Помилка видалення завдання {task_id}")


# Контролери для завдань

def get_all_tasks():
    """
    Отримання всіх завдань.

    Returns:
        tuple: (відповідь API, код статусу)
    """
    try:
        tasks = TaskService.get_all_tasks()

        # Конвертуємо у формат API
        tasks_data = [task.to_dict() for task in tasks]

        return api_success(data={"tasks": tasks_data}, message="Завдання успішно отримано")
    except Exception as e:
        return handle_exception(e, "Помилка отримання завдань")


def get_tasks_by_type(task_type):
    """
    Отримання завдань за типом.

    Args:
        task_type (str): Тип завдань (social, partner, limited, daily)

    Returns:
        tuple: (відповідь API, код статусу)
    """
    try:
        # Перевіряємо, чи тип завдань валідний
        valid_types = [TASK_TYPE_SOCIAL, TASK_TYPE_PARTNER, TASK_TYPE_LIMITED, TASK_TYPE_DAILY]

        # Додаткова валідація типу завдання
        if task_type is None:
            return api_error(message=f"Тип завдань не вказано", details={"task_type": "Тип завдань не вказано"})

        if task_type not in valid_types:
            return api_error(message=f"Невідомий тип завдань: {task_type}",
                             details={"task_type": "Невідомий тип завдань"})

        # Логування для відстеження
        logger.info(f"Запит на отримання завдань типу {task_type}")

        try:
            # Отримуємо завдання через сервіс
            tasks = TaskService.get_tasks_by_type(task_type)

            # Логування для відстеження
            logger.info(f"Отримано {len(tasks)} завдань типу {task_type} від сервісу")

            # Безпечне перетворення до формату API
            tasks_data = []
            for task in tasks:
                try:
                    # Перевіряємо формат даних
                    if hasattr(task, 'to_dict') and callable(getattr(task, 'to_dict')):
                        # Якщо це об'єкт з методом to_dict()
                        task_dict = task.to_dict()
                        tasks_data.append(task_dict)
                    elif isinstance(task, dict):
                        # Якщо це вже словник
                        tasks_data.append(task)
                    else:
                        # Логування проблеми
                        logger.warning(f"Пропускаємо завдання невідомого формату: {type(task)}")
                        continue
                except Exception as conversion_error:
                    logger.error(f"Помилка перетворення завдання: {str(conversion_error)}")
                    continue

            # Формуємо відповідь
            return api_success(data={"tasks": tasks_data}, message=f"Завдання типу {task_type} успішно отримано")

        except Exception as service_error:
            logger.error(f"Помилка TaskService: {str(service_error)}")
            return api_error(message=f"Помилка отримання завдань типу {task_type} через сервіс",
                             details={"error": str(service_error)})

    except Exception as e:
        logger.error(f"Критична помилка при отриманні завдань типу {task_type}: {str(e)}")
        logger.exception(e)  # Повний стек помилки для відлагодження
        return handle_exception(e, f"Помилка отримання завдань типу {task_type}")


def get_tasks_for_user(telegram_id):
    """
    Отримання завдань для конкретного користувача.

    Args:
        telegram_id (str): Telegram ID користувача

    Returns:
        tuple: (відповідь API, код статусу)
    """
    try:
        available_tasks, completed_tasks = TaskService.get_tasks_for_user(telegram_id)

        return api_success(
            data={
                "available_tasks": available_tasks,
                "completed_tasks": completed_tasks
            },
            message="Завдання для користувача успішно отримано"
        )
    except Exception as e:
        return handle_exception(e, f"Помилка отримання завдань для користувача {telegram_id}")


def get_task_details(task_id):
    """
    Отримання детальної інформації про завдання.

    Args:
        task_id (str): ID завдання

    Returns:
        tuple: (відповідь API, код статусу)
    """
    try:
        task = TaskService.get_task_by_id(task_id)

        if not task:
            return api_error(message=f"Завдання з ID {task_id} не знайдено", status_code=404)

        return api_success(data={"task": task.to_dict()}, message="Деталі завдання успішно отримано")
    except Exception as e:
        return handle_exception(e, f"Помилка отримання деталей завдання {task_id}")


def start_task(telegram_id, task_id):
    """
    Початок виконання завдання користувачем.

    Args:
        telegram_id (str): Telegram ID користувача
        task_id (str): ID завдання

    Returns:
        tuple: (відповідь API, код статусу)
    """
    try:
        # Отримуємо дані завдання
        task = TaskService.get_task_by_id(task_id)

        if not task:
            return api_error(message=f"Завдання з ID {task_id} не знайдено", status_code=404)

        # Перевіряємо, чи завдання активне
        if not task.is_active():
            return api_error(message="Завдання неактивне або термін його виконання минув")

        # Починаємо виконання завдання
        progress = TaskService.start_task(telegram_id, task_id)

        if not progress:
            return api_error(message="Не вдалося розпочати виконання завдання")

        return api_success(
            data={"progress": progress.to_dict()},
            message="Виконання завдання успішно розпочато"
        )
    except Exception as e:
        return handle_exception(e, f"Помилка початку виконання завдання {task_id}")


def update_task_progress(telegram_id, task_id):
    """
    Оновлення прогресу виконання завдання.

    Args:
        telegram_id (str): Telegram ID користувача
        task_id (str): ID завдання

    Returns:
        tuple: (відповідь API, код статусу)
    """
    try:
        # Отримуємо дані запиту
        data = request.json or {}

        # Перевірка на обов'язкові поля
        is_valid, errors = validate_request_data(data, ["progress_value"])
        if not is_valid:
            return api_validation_error(errors)

        # Отримуємо значення прогресу
        is_valid, error_msg, progress_value = validate_numeric_field(
            data.get("progress_value"), "progress_value", min_value=0, integer_only=True
        )
        if not is_valid:
            return api_error(message=error_msg)

        # Отримуємо дані для верифікації, якщо вони є
        verification_data = data.get("verification_data", {})

        # Оновлюємо прогрес
        updated_progress = TaskService.update_progress(telegram_id, task_id, progress_value, verification_data)

        if not updated_progress:
            return api_error(message="Не вдалося оновити прогрес завдання")

        # Перевіряємо, чи завдання виконано
        task_completed = updated_progress.is_completed()

        # Якщо завдання виконано, перевіряємо, чи треба автоматично нарахувати винагороду
        reward_result = {}
        if task_completed and not updated_progress.reward_claimed:
            # Отримуємо завдання
            task = TaskService.get_task_by_id(task_id)

            if task:
                # ВИПРАВЛЕНО: Видалено перевірку task.verification_type == "auto"
                # Автоматично нараховуємо винагороду для всіх типів завдань
                success, error, reward_data = VerificationService.process_reward(telegram_id, task, updated_progress)
                if success:
                    reward_result = {
                        "reward_claimed": True,
                        "reward_amount": task.reward_amount,
                        "reward_type": task.reward_type
                    }
                else:
                    reward_result = {
                        "reward_claimed": False,
                        "error": error
                    }

        response_data = {
            "progress": updated_progress.to_dict(),
            "task_completed": task_completed
        }

        if reward_result:
            response_data["reward"] = reward_result

        message = "Прогрес завдання успішно оновлено"
        if task_completed:
            message = "Завдання успішно виконано!"

        return api_success(data=response_data, message=message)
    except Exception as e:
        return handle_exception(e, f"Помилка оновлення прогресу завдання {task_id}")


def verify_task(telegram_id, task_id):
    """
    Верифікація виконання завдання.

    Args:
        telegram_id (str): Telegram ID користувача
        task_id (str): ID завдання

    Returns:
        tuple: (відповідь API, код статусу)
    """
    try:
        # Отримуємо дані запиту
        data = request.json or {}

        # Перевірка на обов'язкові поля
        is_valid, errors = validate_request_data(data, ["verification_data"])
        if not is_valid:
            return api_validation_error(errors)

        # Отримуємо дані для верифікації
        verification_data = data.get("verification_data", {})

        # Отримуємо завдання
        task = TaskService.get_task_by_id(task_id)

        if not task:
            return api_error(message=f"Завдання з ID {task_id} не знайдено", status_code=404)

        # Отримуємо поточний прогрес
        progress = TaskService.get_single_progress(telegram_id, task_id)

        if not progress:
            return api_error(message="Не знайдено прогрес для цього завдання", status_code=404)

        # Виконуємо відповідну верифікацію залежно від типу завдання
        verification_result = {}
        if task.action_type == "visit":
            # Верифікація відвідування сайту
            success, error, verification_details = VerificationService.verify_website_visit(
                telegram_id, task.action_url, verification_data
            )
            verification_result = {"success": success, "details": verification_details}
            if error:
                verification_result["error"] = error
        elif task.action_type == "follow":
            # Верифікація підписки на соціальну мережу
            platform = verification_data.get("platform", "")
            username = verification_data.get("username", "")
            proof_url = verification_data.get("proof_url", "")

            success, error, verification_details = VerificationService.verify_social_subscription(
                telegram_id, platform, username, proof_url
            )
            verification_result = {"success": success, "details": verification_details}
            if error:
                verification_result["error"] = error

            # Якщо верифікація успішна, оновлюємо статус соціального завдання
            if success:
                VerificationService.update_user_social_tasks(telegram_id, platform, True)
        else:
            # Інші типи дій
            success, error, verification_details = VerificationService.verify_custom_action(
                telegram_id, task.action_type, verification_data
            )
            verification_result = {"success": success, "details": verification_details}
            if error:
                verification_result["error"] = error

        # Оновлюємо прогрес залежно від результату верифікації
        if verification_result.get("success", False):
            # Завершуємо виконання завдання
            completed_progress = TaskService.update_progress(telegram_id, task_id, task.target_value,
                                                             verification_details)

            # Нараховуємо винагороду, якщо вона ще не була видана
            reward_result = {}
            if completed_progress and not completed_progress.reward_claimed:
                # ВИПРАВЛЕНО: Нараховуємо винагороду для всіх типів завдань, незалежно від verification_type
                success, error, reward_data = VerificationService.process_reward(telegram_id, task, completed_progress)
                if success:
                    reward_result = {
                        "reward_claimed": True,
                        "reward_amount": task.reward_amount,
                        "reward_type": task.reward_type
                    }
                else:
                    reward_result = {
                        "reward_claimed": False,
                        "error": error
                    }

            response_data = {
                "verification": verification_result,
                "progress": completed_progress.to_dict() if completed_progress else progress.to_dict()
            }

            if reward_result:
                response_data["reward"] = reward_result

            return api_success(data=response_data, message="Завдання успішно верифіковано та виконано")
        else:
            # Верифікація не успішна
            progress.add_verification_data(verification_data)
            progress.increment_attempts()

            # Зберігаємо оновлений прогрес
            update_response = supabase.table('user_progress').update(progress.to_dict()).eq('id', progress.id).execute()

            return api_success(
                data={"verification": verification_result, "progress": progress.to_dict()},
                message="Верифікація не пройшла успішно. Спробуйте ще раз.",
                status_code=400
            )
    except Exception as e:
        return handle_exception(e, f"Помилка верифікації завдання {task_id}")


def get_user_progress(telegram_id):
    """
    Отримання прогресу користувача для всіх завдань.

    Args:
        telegram_id (str): Telegram ID користувача

    Returns:
        tuple: (відповідь API, код статусу)
    """
    try:
        progress_list = TaskService.get_user_progress(telegram_id)

        # Конвертуємо у формат API
        progress_data = [progress.to_dict() for progress in progress_list]

        # Отримуємо додаткову статистику
        completed_count = sum(1 for p in progress_list if p.is_completed())
        in_progress_count = sum(1 for p in progress_list if p.status == STATUS_IN_PROGRESS)

        return api_success(
            data={
                "progress": progress_data,
                "stats": {
                    "total_count": len(progress_list),
                    "completed_count": completed_count,
                    "in_progress_count": in_progress_count
                }
            },
            message="Прогрес користувача успішно отримано"
        )
    except Exception as e:
        return handle_exception(e, f"Помилка отримання прогресу для користувача {telegram_id}")


def get_task_status(telegram_id, task_id):
    """
    Отримання статусу конкретного завдання для користувача.

    Args:
        telegram_id (str): Telegram ID користувача
        task_id (str): ID завдання

    Returns:
        tuple: (відповідь API, код статусу)
    """
    try:
        # Отримуємо завдання
        task = TaskService.get_task_by_id(task_id)

        if not task:
            return api_error(message=f"Завдання з ID {task_id} не знайдено", status_code=404)

        # Отримуємо прогрес
        progress = TaskService.get_single_progress(telegram_id, task_id)

        # Якщо прогресу немає, створюємо базовий прогрес
        if not progress:
            progress_data = {
                "task_id": task_id,
                "telegram_id": telegram_id,
                "status": STATUS_NOT_STARTED,
                "progress_value": 0,
                "max_progress": task.target_value,
                "progress_percent": 0
            }
        else:
            progress_data = progress.to_dict()

        # Додаємо дані завдання для зручності
        task_data = task.to_dict()

        return api_success(
            data={"task": task_data, "progress": progress_data},
            message="Статус завдання успішно отримано"
        )
    except Exception as e:
        return handle_exception(e, f"Помилка отримання статусу завдання {task_id} для користувача {telegram_id}")


# Контролери для щоденних бонусів

def get_daily_bonus_status(telegram_id):
    """
    Отримання статусу щоденного бонусу.

    Args:
        telegram_id (str): Telegram ID користувача

    Returns:
        tuple: (відповідь API, код статусу)
    """
    try:
        bonus_status = DailyBonusService.get_daily_bonus_status(telegram_id)

        return api_success(
            data=bonus_status,
            message="Статус щоденного бонусу успішно отримано"
        )
    except Exception as e:
        return handle_exception(e, f"Помилка отримання статусу щоденного бонусу для користувача {telegram_id}")


def claim_daily_bonus(telegram_id, data=None):
    """
    Отримання щоденного бонусу.

    Args:
        telegram_id (str): Telegram ID користувача
        data (dict, optional): Дані запиту

    Returns:
        tuple: (відповідь API, код статусу)
    """
    try:
        # Отримуємо дані запиту
        if data is None:
            data = request.json or {}

        # Отримуємо день, якщо він вказаний
        day = data.get("day")

        # Видаємо бонус
        success, error, bonus_data = DailyBonusService.claim_daily_bonus(telegram_id, day)

        if not success:
            return api_error(message=error)

        return api_success(
            data=bonus_data,
            message=f"Щоденний бонус отримано: +{bonus_data.get('reward', 0)} WINIX"
        )
    except Exception as e:
        return handle_exception(e, f"Помилка отримання щоденного бонусу для користувача {telegram_id}")


def claim_streak_bonus(telegram_id):
    """
    Отримання бонусу за стрік щоденних входів.

    Args:
        telegram_id (str): Telegram ID користувача

    Returns:
        tuple: (відповідь API, код статусу)
    """
    try:
        # Видаємо бонус за стрік
        success, error, bonus_data = DailyBonusService.get_streak_bonus(telegram_id)

        if not success:
            return api_error(message=error)

        return api_success(
            data=bonus_data,
            message=f"Бонус за стрік отримано: +{bonus_data.get('reward', 0)} WINIX"
        )
    except Exception as e:
        return handle_exception(e, f"Помилка отримання бонусу за стрік для користувача {telegram_id}")


def get_bonus_history(telegram_id):
    """
    Отримання історії щоденних бонусів.

    Args:
        telegram_id (str): Telegram ID користувача

    Returns:
        tuple: (відповідь API, код статусу)
    """
    try:
        # Отримуємо параметри пагінації
        limit = request.args.get('limit', 10, type=int)
        offset = request.args.get('offset', 0, type=int)

        # Отримуємо історію бонусів
        bonus_history = DailyBonusService.get_bonus_history(telegram_id, limit, offset)

        return api_success(
            data=bonus_history,
            message="Історія бонусів успішно отримана"
        )
    except Exception as e:
        return handle_exception(e, f"Помилка отримання історії бонусів для користувача {telegram_id}")


# Контролери для верифікації соціальних мереж

def verify_subscription(telegram_id, data=None):
    """
    Верифікація підписки на соціальну мережу.

    Args:
        telegram_id (str): Telegram ID користувача
        data (dict, optional): Дані запиту

    Returns:
        tuple: (відповідь API, код статусу)
    """
    try:
        # Отримуємо дані запиту
        if data is None:
            data = request.json or {}

        # Перевірка на обов'язкові поля
        is_valid, errors = validate_request_data(data, ["platform"])
        if not is_valid:
            return api_validation_error(errors)

        # Отримуємо платформу та додаткові дані
        platform = data.get("platform", "").lower()
        username = data.get("username", "")
        proof_url = data.get("proof_url", "")

        # Виконуємо верифікацію
        success, error, verification_details = VerificationService.verify_social_subscription(
            telegram_id, platform, username, proof_url
        )

        if not success:
            return api_error(message=error or "Помилка верифікації підписки")

        # Оновлюємо статус соціального завдання
        VerificationService.update_user_social_tasks(telegram_id, platform, True)

        # Визначаємо суму винагороди залежно від платформи
        reward_amounts = {
            "twitter": 50,
            "telegram": 80,
            "youtube": 50,
            "discord": 60,
            "instagram": 70,
            "facebook": 50,
            "tiktok": 60
        }

        reward_amount = reward_amounts.get(platform, 50)

        # Видаємо винагороду
        from utils.transaction_helpers import execute_balance_transaction

        transaction_result = execute_balance_transaction(
            telegram_id=telegram_id,
            amount=reward_amount,
            type_name="social_reward",
            description=f"Винагорода за підписку на {platform}"
        )

        if transaction_result.get("status") != "success":
            return api_error(
                message=f"Помилка нарахування винагороди: {transaction_result.get('message', 'Невідома помилка')}"
            )

        return api_success(
            data={
                "platform": platform,
                "reward": reward_amount,
                "previous_balance": transaction_result.get("previous_balance", 0),
                "new_balance": transaction_result.get("new_balance", 0)
            },
            message=f"Підписку підтверджено! Отримано {reward_amount} WINIX"
        )
    except Exception as e:
        return handle_exception(e, f"Помилка верифікації підписки для користувача {telegram_id}")


# Контролери для лідерборду

def get_referrals_leaderboard():
    """
    Отримання лідерборду по рефералам.

    Returns:
        tuple: (відповідь API, код статусу)
    """
    try:
        # Отримуємо параметри пагінації
        limit = request.args.get('limit', 10, type=int)
        offset = request.args.get('offset', 0, type=int)

        # Отримуємо лідерборд
        leaderboard = LeaderboardService.get_referrals_leaderboard(limit, offset)

        return api_success(
            data={"leaderboard": leaderboard},
            message="Лідерборд рефералів успішно отримано"
        )
    except Exception as e:
        return handle_exception(e, "Помилка отримання лідерборду рефералів")


def get_tasks_leaderboard():
    """
    Отримання лідерборду по завданням.

    Returns:
        tuple: (відповідь API, код статусу)
    """
    try:
        # Отримуємо параметри пагінації
        limit = request.args.get('limit', 10, type=int)
        offset = request.args.get('offset', 0, type=int)
        days = request.args.get('days', 30, type=int)

        # Отримуємо лідерборд
        leaderboard = LeaderboardService.get_tasks_leaderboard(limit, offset, days)

        return api_success(
            data={"leaderboard": leaderboard},
            message="Лідерборд завдань успішно отримано"
        )
    except Exception as e:
        return handle_exception(e, "Помилка отримання лідерборду завдань")


def get_user_leaderboard_position(telegram_id):
    """
    Отримання позиції користувача в лідерборді.

    Args:
        telegram_id (str): Telegram ID користувача

    Returns:
        tuple: (відповідь API, код статусу)
    """
    try:
        # Отримуємо тип лідерборду
        leaderboard_type = request.args.get('type', 'referrals')

        # Отримуємо позицію
        position_data = LeaderboardService.get_user_position(telegram_id, leaderboard_type)

        return api_success(
            data=position_data,
            message=f"Позиція користувача в лідерборді {leaderboard_type} успішно отримана"
        )
    except Exception as e:
        return handle_exception(e, f"Помилка отримання позиції користувача {telegram_id} в лідерборді")


# Контролери для рефералів

def get_referral_code(telegram_id):
    """
    Отримання реферального коду користувача.

    Args:
        telegram_id (str): Telegram ID користувача

    Returns:
        tuple: (відповідь API, код статусу)
    """
    try:
        referral_code = ReferralService.get_user_referral_code(telegram_id)

        if not referral_code:
            return api_error(message="Не вдалося отримати реферальний код", status_code=404)

        return api_success(
            data={"referral_code": referral_code},
            message="Реферальний код успішно отримано"
        )
    except Exception as e:
        return handle_exception(e, f"Помилка отримання реферального коду для користувача {telegram_id}")


def get_user_referrals(telegram_id):
    """
    Отримання інформації про рефералів користувача.

    Args:
        telegram_id (str): Telegram ID користувача

    Returns:
        tuple: (відповідь API, код статусу)
    """
    try:
        referrals_data = ReferralService.get_user_referrals(telegram_id)

        return api_success(
            data=referrals_data,
            message="Інформація про рефералів успішно отримана"
        )
    except Exception as e:
        return handle_exception(e, f"Помилка отримання інформації про рефералів для користувача {telegram_id}")


def use_referral_code():
    """
    Використання реферального коду.

    Returns:
        tuple: (відповідь API, код статусу)
    """
    try:
        # Отримуємо дані запиту
        data = request.json or {}

        # Перевірка на обов'язкові поля
        is_valid, errors = validate_request_data(data, ["referral_code", "telegram_id"])
        if not is_valid:
            return api_validation_error(errors)

        referral_code = data.get("referral_code", "")
        referee_id = data.get("telegram_id", "")

        # Отримуємо користувача за реферальним кодом
        referrer = ReferralService.get_user_by_referral_code(referral_code)

        if not referrer:
            return api_error(message=f"Реферальний код {referral_code} не знайдено", status_code=404)

        referrer_id = referrer.get("telegram_id")

        # Перевіряємо, чи не намагається користувач використати свій власний код
        if str(referrer_id) == str(referee_id):
            return api_error(message="Ви не можете використати свій власний реферальний код")

        # Створюємо реферальний запис
        referral = ReferralService.create_referral(referrer_id, referee_id)

        if not referral:
            return api_error(message="Не вдалося створити реферальний запис")

        # Обробляємо винагороду для реферера
        success, error, reward_data = ReferralService.process_referral_reward(referral.id)

        if not success:
            return api_error(message=f"Не вдалося обробити реферальну винагороду: {error}")

        return api_success(
            data={
                "referral": referral.to_dict(),
                "referrer": {
                    "telegram_id": referrer_id,
                    "username": referrer.get("username")
                },
                "reward": reward_data
            },
            message="Реферальний код успішно використано"
        )
    except Exception as e:
        return handle_exception(e, "Помилка використання реферального коду")