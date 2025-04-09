from flask import jsonify, request
import logging
import os
import sys
import functools
from datetime import datetime, timezone
from typing import Dict, Any, Tuple, Optional, Union, List, Callable

# Додаємо кореневу папку бекенду до шляху Python для імпортів
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
if parent_dir not in sys.path:
    sys.path.append(parent_dir)

# Імпортуємо з supabase_client без використання importlib
from supabase_client import get_user, update_user, update_balance, supabase, cached

# Налаштування логування
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)
# Константи
from .services import STAKING_REWARD_RATES


def api_response(status: str, data: Optional[Dict[str, Any]] = None,
                message: Optional[str] = None, status_code: int = 200) -> Tuple[Dict[str, Any], int]:
    """Єдина функція для формування відповіді API"""
    response = {"status": status}

    if data is not None:
        response["data"] = data

    if message is not None:
        response["message"] = message

    return jsonify(response), status_code


def validate_staking_amount(amount: Union[str, float, int],
                           current_balance: float,
                           min_amount: float = 50,
                           max_percent: float = 0.9) -> Tuple[bool, int, Optional[str]]:
    """
    Комплексна валідація суми стейкінгу

    Args:
        amount: Сума для стейкінгу
        current_balance: Поточний баланс користувача
        min_amount: Мінімальна сума стейкінгу
        max_percent: Максимальний відсоток від балансу для стейкінгу

    Returns:
        Tuple[bool, int, Optional[str]]: (валідно, сума як int, повідомлення про помилку)
    """
    try:
        # Спроба конвертації до float
        amount_float = float(amount)

        # Перевірка на ціле число
        if amount_float != int(amount_float):
            return False, 0, "Сума стейкінгу має бути цілим числом"

        # Конвертуємо в int
        amount_int = int(amount_float)

        # Перевірка на позитивне число
        if amount_int <= 0:
            return False, 0, "Сума стейкінгу повинна бути більше нуля"

        # Перевірка на мінімальну суму
        if amount_int < min_amount:
            return False, 0, f"Мінімальна сума стейкінгу: {min_amount} WINIX"

        # Перевірка на максимальний відсоток від балансу
        max_allowed = int(current_balance * max_percent)
        if amount_int > max_allowed:
            return False, 0, f"Максимальна сума: {max_allowed} WINIX ({int(max_percent * 100)}% від балансу)"

        # Перевірка на достатність коштів
        if amount_int > current_balance:
            return False, 0, f"Недостатньо коштів. Ваш баланс: {current_balance} WINIX"

        return True, amount_int, None
    except (ValueError, TypeError):
        return False, 0, "Некоректний формат суми стейкінгу"


def validate_period(period: Union[str, int]) -> Tuple[bool, int, Optional[str]]:
    """
    Валідація періоду стейкінгу

    Args:
        period: Період стейкінгу в днях

    Returns:
        Tuple[bool, int, Optional[str]]: (валідно, період як int, повідомлення про помилку)
    """
    try:
        # Конвертуємо до int
        period_int = int(period)

        # Перевіряємо, чи період у списку дозволених
        if period_int not in STAKING_REWARD_RATES:
            periods_str = ', '.join(map(str, STAKING_REWARD_RATES.keys()))
            return False, 0, f"Некоректний період стейкінгу. Доступні періоди: {periods_str}"

        return True, period_int, None
    except (ValueError, TypeError):
        return False, 0, "Некоректний формат періоду стейкінгу"


@cached()
def get_user_staking(telegram_id: str) -> Tuple[Dict[str, Any], int]:
    """
    Обробник маршруту /api/user/<telegram_id>/staking [GET]
    Отримання даних стейкінгу користувача

    Args:
        telegram_id (str): ID користувача Telegram

    Returns:
        tuple: (json_response, status_code)
    """
    try:
        # Логування початку обробки
        logger.info(f"get_user_staking: Отримання інформації про стейкінг для користувача {telegram_id}")

        # Перевіряємо цілісність даних стейкінгу
        verify_staking_consistency(telegram_id)

        # Перевіряємо наявність активного стейкінгу
        has_staking, staking_data = check_active_staking(telegram_id)

        # Якщо стейкінг завершився, автоматично фіналізуємо його
        if has_staking and staking_data and staking_data.get("remainingDays", 0) == 0:
            # Автоматичне завершення стейкінгу
            success, result, message = finalize_staking(
                telegram_id,
                staking_data.get("stakingId"),
                force=True
            )

            if success:
                logger.info(f"Автоматичне завершення стейкінгу для користувача {telegram_id}")
                return api_response("success", data=result["staking"])
            else:
                logger.error(f"Помилка автоматичного завершення стейкінгу: {message}")

        # Якщо немає даних стейкінгу або немає активного стейкінгу, повертаємо порожній об'єкт
        if not has_staking or not staking_data:
            staking_data = {
                "hasActiveStaking": False,
                "stakingAmount": 0,
                "period": 0,
                "rewardPercent": 0,
                "expectedReward": 0,
                "remainingDays": 0
            }

        # Детальне логування результату
        logger.info(f"get_user_staking: Успішно отримано дані стейкінгу для {telegram_id}: {has_staking}")

        return api_response("success", data=staking_data)
    except Exception as e:
        logger.error(f"Помилка отримання даних стейкінгу: {str(e)}")
        logger.error(traceback.format_exc())
        return api_response("error", message=f"Помилка отримання даних стейкінгу: {str(e)}", status_code=500)


def create_user_staking(telegram_id: str) -> Tuple[Dict[str, Any], int]:
    """
    Обробник маршруту /api/user/<telegram_id>/staking [POST]
    Створення нового стейкінгу

    Args:
        telegram_id (str): ID користувача Telegram

    Returns:
        tuple: (json_response, status_code)
    """
    try:
        # Логування початку обробки
        logger.info(f"create_user_staking: Початок обробки для користувача {telegram_id}")

        # Отримуємо дані запиту
        data = request.json
        if not data:
            return api_response("error", message="Відсутні дані стейкінгу", status_code=400)

        # Перевіряємо наявність необхідних полів
        if "stakingAmount" not in data or "period" not in data:
            return api_response(
                "error",
                message="Відсутні обов'язкові поля: stakingAmount та period",
                status_code=400
            )

        # Отримуємо користувача для перевірки балансу
        user = get_user(telegram_id)
        if not user:
            return api_response("error", message="Користувача не знайдено", status_code=404)

        current_balance = float(user.get("balance", 0))

        # Валідуємо суму стейкінгу
        is_valid_amount, amount, error_message = validate_staking_amount(data.get("stakingAmount"), current_balance)
        if not is_valid_amount:
            return api_response("error", message=error_message, status_code=400)

        # Валідуємо період стейкінгу
        is_valid_period, period, error_message = validate_period(data.get("period", 14))
        if not is_valid_period:
            return api_response("error", message=error_message, status_code=400)

        # Створюємо стейкінг
        success, result, message = create_staking(telegram_id, amount, period)

        if success:
            # Додаткове логування успішного створення
            logger.info(f"create_user_staking: Успішно створено стейкінг для {telegram_id}: {amount} WINIX на {period} днів")
            return api_response("success", data=result, message=message)
        else:
            logger.warning(f"create_user_staking: Помилка створення стейкінгу для {telegram_id}: {message}")
            return api_response("error", message=message, status_code=400)
    except Exception as e:
        logger.error(f"Помилка створення стейкінгу: {str(e)}")
        logger.error(traceback.format_exc())
        return api_response("error", message=f"Помилка створення стейкінгу: {str(e)}", status_code=500)


def add_to_staking(telegram_id: str, staking_id: str) -> Tuple[Dict[str, Any], int]:
    """
    Обробник маршруту /api/user/<telegram_id>/staking/<staking_id> [PUT]
    Додавання коштів до існуючого стейкінгу

    Args:
        telegram_id (str): ID користувача Telegram
        staking_id (str): ID стейкінгу

    Returns:
        tuple: (json_response, status_code)
    """
    try:
        # Логування початку обробки
        logger.info(f"add_to_staking: Початок обробки для користувача {telegram_id}, стейкінг {staking_id}")

        # Отримуємо дані запиту
        data = request.json
        if not data or "additionalAmount" not in data:
            return api_response("error", message="Відсутні необхідні параметри", status_code=400)

        # Отримуємо користувача для перевірки балансу
        user = get_user(telegram_id)
        if not user:
            return api_response("error", message="Користувача не знайдено", status_code=404)

        current_balance = float(user.get("balance", 0))

        # Валідуємо додаткову суму
        try:
            additional_amount = float(data.get("additionalAmount"))
            if additional_amount != int(additional_amount):
                return api_response("error", message="Сума додавання має бути цілим числом", status_code=400)

            additional_amount = int(additional_amount)

            if additional_amount <= 0:
                return api_response("error", message="Сума додавання має бути більше нуля", status_code=400)

            if additional_amount > current_balance:
                return api_response(
                    "error",
                    message=f"Недостатньо коштів. Ваш баланс: {current_balance} WINIX",
                    status_code=400
                )
        except (ValueError, TypeError):
            return api_response("error", message="Некоректний формат суми додавання", status_code=400)

        # Додаємо до стейкінгу
        success, result, message = service_add_to_staking(telegram_id, staking_id, additional_amount)

        if success:
            # Додаткове логування успішного додавання
            logger.info(f"add_to_staking: Успішно додано {additional_amount} WINIX до стейкінгу {staking_id}")
            return api_response("success", data=result, message=message)
        else:
            logger.warning(f"add_to_staking: Помилка додавання до стейкінгу {staking_id}: {message}")
            return api_response("error", message=message, status_code=400)
    except Exception as e:
        logger.error(f"Помилка додавання до стейкінгу: {str(e)}")
        logger.error(traceback.format_exc())
        return api_response("error", message=f"Помилка додавання до стейкінгу: {str(e)}", status_code=500)


def update_user_staking(telegram_id: str, staking_id: str) -> Tuple[Dict[str, Any], int]:
    """
    Обробник маршруту /api/user/<telegram_id>/staking/<staking_id> [PUT]
    Додавання коштів до існуючого стейкінгу
    (Ця функція є синонімом до add_to_staking для забезпечення сумісності)

    Args:
        telegram_id (str): ID користувача Telegram
        staking_id (str): ID стейкінгу

    Returns:
        tuple: (json_response, status_code)
    """
    return add_to_staking(telegram_id, staking_id)


def cancel_user_staking(telegram_id: str, staking_id: str) -> Tuple[Dict[str, Any], int]:
    """
    Обробник маршруту /api/user/<telegram_id>/staking/<staking_id>/cancel [POST]
    Скасування стейкінгу

    Args:
        telegram_id (str): ID користувача Telegram
        staking_id (str): ID стейкінгу

    Returns:
        tuple: (json_response, status_code)
    """
    try:
        # Логування початку обробки
        logger.info(f"cancel_user_staking: Початок обробки для користувача {telegram_id}, стейкінг {staking_id}")

        # Додаткове логування тіла запиту
        try:
            data = request.json or {}
        except Exception as e:
            logger.warning(f"cancel_user_staking: Помилка отримання JSON даних запиту: {str(e)}")
            data = {}

        # Запобігаємо випадковим натисканням
        confirm = data.get('confirm', False)
        if not confirm and 'confirm' in data:
            logger.warning(f"cancel_user_staking: Не отримано підтвердження скасування")
            return api_response(
                "error",
                message="Необхідне підтвердження скасування стейкінгу",
                status_code=400
            )

        # Перевіряємо наявність активного стейкінгу
        current_session = None
        try:
            all_sessions = get_user_staking_sessions(telegram_id, active_only=True)

            # Шукаємо сесію з вказаним ID
            for session in all_sessions:
                if session["id"] == staking_id:
                    current_session = session
                    break

            # Якщо не знайдено, перевіряємо ще раз за ID стейкінгу напряму
            if not current_session:
                current_session = get_staking_session(staking_id)

                # Перевіряємо відповідність користувача
                if current_session and (str(current_session.get("user_id")) != telegram_id and
                                        str(current_session.get("telegram_id")) != telegram_id):
                    logger.warning(f"cancel_user_staking: Сесія {staking_id} належить іншому користувачу")
                    current_session = None
        except Exception as e:
            logger.error(f"cancel_user_staking: Помилка отримання стейкінг-сесій: {str(e)}")
            current_session = None

        if not current_session:
            logger.warning(f"cancel_user_staking: Стейкінг {staking_id} для користувача {telegram_id} не знайдено")
            return api_response(
                "error",
                message="Стейкінг не знайдено або він не належить вам",
                status_code=404
            )

        # Додаткова перевірка активності сесії
        if not current_session.get("is_active", False):
            logger.warning(f"cancel_user_staking: Спроба скасувати неактивний стейкінг {staking_id}")
            return api_response(
                "error",
                message="Неможливо скасувати неактивний стейкінг",
                status_code=400
            )

        # Скасовуємо стейкінг
        success, result, message = cancel_staking(telegram_id, staking_id)

        if success:
            # Додаткове логування успішного скасування
            logger.info(f"cancel_user_staking: Успішно скасовано стейкінг {staking_id}")
            return api_response("success", data=result, message=message)
        else:
            logger.warning(f"cancel_user_staking: Помилка скасування стейкінгу {staking_id}: {message}")
            return api_response("error", message=message, status_code=400)
    except Exception as e:
        logger.error(f"Помилка скасування стейкінгу: {str(e)}")
        logger.error(traceback.format_exc())
        return api_response("error", message=f"Помилка скасування стейкінгу: {str(e)}", status_code=500)


def finalize_user_staking(telegram_id: str, staking_id: str) -> Tuple[Dict[str, Any], int]:
    """
    Обробник маршруту /api/user/<telegram_id>/staking/<staking_id>/finalize [POST]
    Завершення стейкінгу і нарахування винагороди

    Args:
        telegram_id (str): ID користувача Telegram
        staking_id (str): ID стейкінгу

    Returns:
        tuple: (json_response, status_code)
    """
    try:
        # Логування початку обробки
        logger.info(f"finalize_user_staking: Початок обробки для користувача {telegram_id}, стейкінг {staking_id}")

        # Отримуємо дані запиту
        data = request.json or {}
        force = data.get("forceFinalize", False)

        # Отримуємо інформацію про стейкінг
        staking_session = get_staking_session(staking_id)
        if not staking_session:
            return api_response(
                "error",
                message=f"Стейкінг з ID {staking_id} не знайдено",
                status_code=404
            )

        # Перевіряємо права доступу
        if str(staking_session.get("user_id", "")) != telegram_id and str(staking_session.get("telegram_id", "")) != telegram_id:
            return api_response(
                "error",
                message="Ви не маєте прав на цей стейкінг",
                status_code=403
            )

        # Перевіряємо, чи стейкінг активний
        if not staking_session.get("is_active", False):
            return api_response(
                "error",
                message="Стейкінг вже завершено",
                status_code=400
            )

        # Завершуємо стейкінг
        success, result, message = finalize_staking(telegram_id, staking_id, force)

        if success:
            # Додаткове логування успішного завершення
            logger.info(f"finalize_user_staking: Успішно завершено стейкінг {staking_id}")
            return api_response("success", data=result, message=message)
        else:
            logger.warning(f"finalize_user_staking: Помилка завершення стейкінгу {staking_id}: {message}")
            return api_response("error", message=message, status_code=400)
    except Exception as e:
        logger.error(f"Помилка завершення стейкінгу: {str(e)}")
        logger.error(traceback.format_exc())
        return api_response("error", message=f"Помилка завершення стейкінгу: {str(e)}", status_code=500)


@cached()
def get_user_staking_history(telegram_id: str) -> Tuple[Dict[str, Any], int]:
    """
    Обробник маршруту /api/user/<telegram_id>/staking/history [GET]
    Отримання історії стейкінгу

    Args:
        telegram_id (str): ID користувача Telegram

    Returns:
        tuple: (json_response, status_code)
    """
    try:
        # Логування початку обробки
        logger.info(f"get_user_staking_history: Початок обробки для користувача {telegram_id}")

        # Отримуємо історію стейкінгу
        success, data, message = get_staking_history(telegram_id)

        if success:
            # Додаткове логування успішного отримання
            logger.info(f"get_user_staking_history: Успішно отримано історію для {telegram_id}, {len(data)} записів")
            return api_response("success", data=data)
        else:
            logger.warning(f"get_user_staking_history: Помилка отримання історії: {message}")
            return api_response("error", message=message, status_code=400)
    except Exception as e:
        logger.error(f"Помилка отримання історії стейкінгу: {str(e)}")
        logger.error(traceback.format_exc())
        return api_response("error", message=f"Помилка отримання історії стейкінгу: {str(e)}", status_code=500)


def calculate_staking_reward_api() -> Tuple[Dict[str, Any], int]:
    """
    Обробник маршруту /api/user/<telegram_id>/staking/calculate-reward [GET]
    Розрахунок очікуваної винагороди за стейкінг

    Returns:
        tuple: (json_response, status_code)
    """
    try:
        # Логування початку обробки
        logger.info("calculate_staking_reward_api: Початок обробки")

        # Отримуємо параметри з запиту
        amount = request.args.get('amount', type=float)
        period = request.args.get('period', type=int)

        if amount is None or period is None:
            return api_response(
                "error",
                message="Відсутні параметри amount або period",
                status_code=400
            )

        # Валідуємо параметри
        if amount != int(amount):
            return api_response(
                "error",
                message="Сума стейкінгу має бути цілим числом",
                status_code=400
            )

        amount = int(amount)
        if amount <= 0:
            return api_response(
                "error",
                message="Сума стейкінгу повинна бути більше 0",
                status_code=400
            )

        # Перевіряємо доступні періоди
        if period not in STAKING_REWARD_RATES:
            periods_str = ', '.join(map(str, STAKING_REWARD_RATES.keys()))
            return api_response(
                "error",
                message=f"Некоректний період стейкінгу. Доступні періоди: {periods_str}",
                status_code=400
            )

        # Розраховуємо винагороду
        reward = calculate_staking_reward(amount, period)

        # Визначаємо відсоток для вказаного періоду
        reward_percent = STAKING_REWARD_RATES.get(period, 9)

        # Додаткове логування успішного розрахунку
        logger.info(f"calculate_staking_reward_api: Успішно розраховано винагороду для {amount} WINIX на {period} днів: {reward} WINIX")

        return api_response(
            "success",
            data={
                "reward": reward,
                "rewardPercent": reward_percent,
                "amount": amount,
                "period": period
            }
        )
    except Exception as e:
        logger.error(f"Помилка розрахунку винагороди: {str(e)}")
        logger.error(traceback.format_exc())
        return api_response("error", message=f"Помилка розрахунку винагороди: {str(e)}", status_code=500)


def repair_user_staking(telegram_id: str) -> Tuple[Dict[str, Any], int]:
    """
    Обробник маршруту /api/user/<telegram_id>/staking/repair [POST]
    Відновлення стану стейкінгу після помилок

    Args:
        telegram_id (str): ID користувача Telegram

    Returns:
        tuple: (json_response, status_code)
    """
    try:
        # Логування початку обробки
        logger.info(f"repair_user_staking: Початок обробки для користувача {telegram_id}")

        # Перевірка даних запиту
        data = request.json or {}
        force = data.get('force', False)

        # Виклик функції відновлення
        response, status_code = service_reset_repair(telegram_id, force)
        return jsonify(response), status_code
    except Exception as e:
        logger.error(f"Помилка відновлення стейкінгу: {str(e)}")
        logger.error(traceback.format_exc())
        return api_response("error", message=f"Помилка відновлення стейкінгу: {str(e)}", status_code=500)


def reset_and_repair_staking(telegram_id: str, force: bool = False) -> Tuple[Dict[str, Any], int]:
    """
    Обробник маршруту /api/user/<telegram_id>/staking/reset-repair [POST]
    Відновлення стану стейкінгу після помилок
    (Ця функція є синонімом до repair_user_staking для забезпечення сумісності)

    Args:
        telegram_id (str): ID користувача Telegram
        force (bool): Примусове відновлення

    Returns:
        tuple: (json_response, status_code)
    """
    try:
        # Логування початку обробки
        logger.info(f"reset_and_repair_staking: Початок обробки для користувача {telegram_id}, force={force}")

        # Модифікуємо request.json для передачі параметра force
        if not hasattr(request, '_json'):
            setattr(request, '_json', {})
        request._json = {'force': force}

        # Викликаємо repair_user_staking
        return repair_user_staking(telegram_id)
    except Exception as e:
        logger.error(f"Помилка відновлення стейкінгу: {str(e)}")
        logger.error(traceback.format_exc())
        return api_response("error", message=f"Помилка відновлення стейкінгу: {str(e)}", status_code=500)


def deep_repair_user_staking(telegram_id: str) -> Tuple[Dict[str, Any], int]:
    """
    Обробник маршруту /api/user/<telegram_id>/staking/deep-repair [POST]
    Глибоке відновлення стану стейкінгу з перевіркою цілісності даних

    Args:
        telegram_id (str): ID користувача Telegram

    Returns:
        tuple: (json_response, status_code)
    """
    try:
        # Логування початку обробки
        logger.info(f"deep_repair_user_staking: Початок обробки для користувача {telegram_id}")

        # Перевірка даних запиту
        data = request.json or {}
        balance_adjustment = float(data.get('balance_adjustment', 0))

        # Виклик функції глибокого відновлення
        response, status_code = deep_repair_staking(telegram_id, balance_adjustment)

        # Додаткове логування результату
        if status_code == 200:
            logger.info(f"deep_repair_user_staking: Успішне глибоке відновлення для {telegram_id}")
        else:
            logger.warning(f"deep_repair_user_staking: Помилка глибокого відновлення для {telegram_id}")

        return jsonify(response), status_code
    except Exception as e:
        logger.error(f"Помилка глибокого відновлення стейкінгу: {str(e)}")
        logger.error(traceback.format_exc())
        return api_response("error", message=f"Помилка глибокого відновлення стейкінгу: {str(e)}", status_code=500)