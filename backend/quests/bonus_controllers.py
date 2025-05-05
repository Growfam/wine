"""
Контролери для роботи з бонусами та винагородами у системі WINIX.
Включає функціональність для щоденних бонусів та верифікації соціальних мереж.
"""
import logging
import sys
import os
from flask import request
from typing import Dict, Any, Optional, Tuple

# Додаємо кореневу папку проекту до шляху
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
if parent_dir not in sys.path:
    sys.path.append(parent_dir)

# Імпорт моделей та сервісів
from quests.daily_bonus import DailyBonusService
from quests.verification_service import VerificationService
from utils.api_helpers import api_success, api_error, handle_exception
from utils.transaction_helpers import execute_balance_transaction

# Налаштування логування
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


# Контролери для щоденних бонусів

def get_daily_bonus_status(telegram_id: str) -> Tuple[Dict[str, Any], int]:
    """
    Отримання статусу щоденного бонусу.

    Args:
        telegram_id (str): Telegram ID користувача

    Returns:
        tuple: (відповідь API, код статусу)
    """
    try:
        # Валідація telegram_id
        if not telegram_id or not isinstance(telegram_id, str):
            logger.error(f"get_daily_bonus_status: Недійсний telegram_id: {telegram_id}")
            return api_error(message="Недійсний ID користувача", status_code=400)

        # Логування запиту
        logger.info(f"get_daily_bonus_status: Запит статусу щоденного бонусу для користувача {telegram_id}")

        # Отримуємо статус бонусу через сервіс
        bonus_status = DailyBonusService.get_daily_bonus_status(telegram_id)

        # Перевіряємо наявність помилки
        if "error" in bonus_status:
            error_message = bonus_status.pop("error")
            if "не знайдено" in error_message.lower():
                return api_error(message=error_message, status_code=404)
            return api_error(message=error_message, status_code=400)

        # Повертаємо успішну відповідь
        return api_success(
            data=bonus_status,
            message="Статус щоденного бонусу успішно отримано"
        )
    except Exception as e:
        logger.exception(f"Помилка отримання статусу щоденного бонусу для користувача {telegram_id}")
        return handle_exception(e, f"Помилка отримання статусу щоденного бонусу для користувача {telegram_id}")


def claim_daily_bonus(telegram_id: str, data: Optional[Dict[str, Any]] = None) -> Tuple[Dict[str, Any], int]:
    """
    Отримання щоденного бонусу.

    Args:
        telegram_id (str): Telegram ID користувача
        data (dict, optional): Дані запиту

    Returns:
        tuple: (відповідь API, код статусу)
    """
    try:
        # Валідація telegram_id
        if not telegram_id or not isinstance(telegram_id, str):
            logger.error(f"claim_daily_bonus: Недійсний telegram_id: {telegram_id}")
            return api_error(message="Недійсний ID користувача", status_code=400)

        # Отримуємо дані запиту
        if data is None:
            data = request.json or {}

        # Логування запиту з рівнем безпеки
        logger.info(f"claim_daily_bonus: Запит на отримання щоденного бонусу для користувача {telegram_id}")

        # Отримуємо день, якщо він вказаний
        day = None
        if 'day' in data:
            try:
                day = int(data['day'])
                # Валідація дня
                if day < 1 or day > 7:
                    return api_error(message=f"Недійсний день циклу. Має бути від 1 до 7, отримано: {day}", status_code=400)
            except (ValueError, TypeError):
                return api_error(message=f"Недійсний формат дня. Має бути ціле число, отримано: {data['day']}", status_code=400)

        # Додаємо запис для аудиту
        logger.info(f"claim_daily_bonus: Початок процесу отримання бонусу для користувача {telegram_id}, день: {day}")

        # Видаємо бонус
        success, error, bonus_data = DailyBonusService.claim_daily_bonus(telegram_id, day)

        # Перевіряємо результат
        if not success:
            logger.warning(f"claim_daily_bonus: Помилка видачі бонусу для {telegram_id}: {error}")

            # Визначаємо код статусу залежно від помилки
            status_code = 400
            if error and ("не знайдено" in error.lower() or "не існує" in error.lower()):
                status_code = 404
            elif error and "вже отримано" in error.lower():
                status_code = 409  # Conflict

            return api_error(message=error, status_code=status_code)

        # Логуємо успішне отримання бонусу
        logger.info(f"claim_daily_bonus: Користувач {telegram_id} успішно отримав щоденний бонус: +{bonus_data.get('reward', 0)} WINIX")

        # Повертаємо успішну відповідь
        return api_success(
            data=bonus_data,
            message=f"Щоденний бонус отримано: +{bonus_data.get('reward', 0)} WINIX"
        )
    except Exception as e:
        logger.exception(f"Критична помилка отримання щоденного бонусу для користувача {telegram_id}")
        return handle_exception(e, f"Помилка отримання щоденного бонусу для користувача {telegram_id}")


def claim_streak_bonus(telegram_id: str) -> Tuple[Dict[str, Any], int]:
    """
    Отримання бонусу за стрік щоденних входів.

    Args:
        telegram_id (str): Telegram ID користувача

    Returns:
        tuple: (відповідь API, код статусу)
    """
    try:
        # Валідація telegram_id
        if not telegram_id or not isinstance(telegram_id, str):
            logger.error(f"claim_streak_bonus: Недійсний telegram_id: {telegram_id}")
            return api_error(message="Недійсний ID користувача", status_code=400)

        # Логування запиту
        logger.info(f"claim_streak_bonus: Запит на отримання бонусу за стрік для користувача {telegram_id}")

        # Видаємо бонус за стрік
        success, error, bonus_data = DailyBonusService.get_streak_bonus(telegram_id)

        # Перевіряємо результат
        if not success:
            logger.warning(f"claim_streak_bonus: Помилка видачі бонусу за стрік для {telegram_id}: {error}")

            # Визначаємо код статусу залежно від помилки
            status_code = 400
            if error and ("не знайдено" in error.lower() or "не існує" in error.lower()):
                status_code = 404
            elif error and "вже отримано" in error.lower():
                status_code = 409  # Conflict

            return api_error(message=error, status_code=status_code)

        # Логуємо успішне отримання бонусу за стрік
        logger.info(f"claim_streak_bonus: Користувач {telegram_id} успішно отримав бонус за стрік: +{bonus_data.get('reward', 0)} WINIX")

        # Повертаємо успішну відповідь
        return api_success(
            data=bonus_data,
            message=f"Бонус за стрік отримано: +{bonus_data.get('reward', 0)} WINIX"
        )
    except Exception as e:
        logger.exception(f"Критична помилка отримання бонусу за стрік для користувача {telegram_id}")
        return handle_exception(e, f"Помилка отримання бонусу за стрік для користувача {telegram_id}")


def get_bonus_history(telegram_id: str) -> Tuple[Dict[str, Any], int]:
    """
    Отримання історії щоденних бонусів.

    Args:
        telegram_id (str): Telegram ID користувача

    Returns:
        tuple: (відповідь API, код статусу)
    """
    try:
        # Валідація telegram_id
        if not telegram_id or not isinstance(telegram_id, str):
            logger.error(f"get_bonus_history: Недійсний telegram_id: {telegram_id}")
            return api_error(message="Недійсний ID користувача", status_code=400)

        # Отримуємо параметри пагінації та валідуємо їх
        try:
            limit = request.args.get('limit', 10, type=int)
            offset = request.args.get('offset', 0, type=int)

            # Валідація параметрів
            if limit < 1 or limit > 100:
                return api_error(message="Параметр limit має бути від 1 до 100", status_code=400)
            if offset < 0:
                return api_error(message="Параметр offset має бути невід'ємним", status_code=400)
        except ValueError:
            return api_error(message="Некоректні параметри пагінації", status_code=400)

        # Логування запиту
        logger.info(f"get_bonus_history: Запит історії бонусів для користувача {telegram_id}, limit={limit}, offset={offset}")

        # Отримуємо історію бонусів
        bonus_history = DailyBonusService.get_bonus_history(telegram_id, limit, offset)

        # Перевіряємо наявність помилки
        if "error" in bonus_history:
            error_message = bonus_history.pop("error")
            return api_error(message=error_message, status_code=400)

        # Повертаємо успішну відповідь
        return api_success(
            data=bonus_history,
            message="Історія бонусів успішно отримана"
        )
    except Exception as e:
        logger.exception(f"Помилка отримання історії бонусів для користувача {telegram_id}")
        return handle_exception(e, f"Помилка отримання історії бонусів для користувача {telegram_id}")


# Контролери для верифікації соціальних мереж

def verify_subscription(telegram_id: str, data: Optional[Dict[str, Any]] = None) -> Tuple[Dict[str, Any], int]:
    """
    Верифікація підписки на соціальну мережу.

    Args:
        telegram_id (str): Telegram ID користувача
        data (dict, optional): Дані запиту

    Returns:
        tuple: (відповідь API, код статусу)
    """
    try:
        # Валідація telegram_id
        if not telegram_id or not isinstance(telegram_id, str):
            logger.error(f"verify_subscription: Недійсний telegram_id: {telegram_id}")
            return api_error(message="Недійсний ID користувача", status_code=400)

        # Отримуємо дані запиту
        if data is None:
            data = request.json or {}

        # Перевірка на обов'язкові поля
        if "platform" not in data:
            return api_error(message="Відсутня платформа", status_code=400)

        # Отримуємо платформу та додаткові дані
        platform = data.get("platform", "").lower()
        if not platform:
            return api_error(message="Платформа не вказана", status_code=400)

        username = data.get("username", "")
        proof_url = data.get("proof_url", "")

        # Виконуємо верифікацію
        success, error, verification_details = VerificationService.verify_social_subscription(
            telegram_id, platform, username, proof_url
        )

        if not success:
            return api_error(message=error or "Помилка верифікації підписки", status_code=400)

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
        transaction_result = execute_balance_transaction(
            telegram_id=telegram_id,
            amount=reward_amount,
            type_name="social_reward",
            description=f"Винагорода за підписку на {platform}"
        )

        if transaction_result.get("status") != "success":
            return api_error(
                message=f"Помилка нарахування винагороди: {transaction_result.get('message', 'Невідома помилка')}",
                status_code=500
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
        logger.exception(f"Помилка верифікації підписки для користувача {telegram_id}")
        return handle_exception(e, f"Помилка верифікації підписки для користувача {telegram_id}")