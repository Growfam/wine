"""
Контролер для обробки HTTP-запитів, пов'язаних зі стейкінгом.
Виконує валідацію параметрів запиту та передає дані до сервісного шару.
"""
from typing import Tuple, Dict, Any, Optional, Union
from flask import jsonify, request
import logging
import traceback
from datetime import datetime, timezone

# Виправлений імпорт сервісного шару
from .services import (
    check_active_staking,
    create_staking,
    add_to_staking as service_add_to_staking,
    cancel_staking,
    finalize_staking,
    get_staking_history,
    calculate_staking_reward,
    reset_and_repair_staking as service_reset_repair,
    deep_repair_staking,
    verify_staking_consistency
)

# Імпортуємо константи з сервісного шару
from .services import STAKING_REWARD_RATES

# Налаштування логування
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


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
        logger.info(f"get_user_staking: Початок обробки для користувача {telegram_id}")

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
                return jsonify({"status": "success", "data": result["staking"]}), 200
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

        return jsonify({"status": "success", "data": staking_data}), 200
    except Exception as e:
        logger.error(f"Помилка отримання даних стейкінгу: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({"status": "error", "message": f"Помилка отримання даних стейкінгу: {str(e)}"}), 500


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
            return jsonify({"status": "error", "message": "Відсутні дані стейкінгу"}), 400

        # Перевіряємо наявність необхідних полів
        if "stakingAmount" not in data or "period" not in data:
            return jsonify({"status": "error", "message": "Відсутні обов'язкові поля: stakingAmount та period"}), 400

        # Отримуємо та перевіряємо параметри
        amount = data.get("stakingAmount")
        period = int(data.get("period", 14))

        # Додаткова валідація
        try:
            amount = float(amount)
            if amount != int(amount):
                return jsonify({"status": "error", "message": "Сума стейкінгу має бути цілим числом"}), 400
            amount = int(amount)

            if amount <= 0:
                return jsonify({"status": "error", "message": "Сума стейкінгу повинна бути більше 0"}), 400

            if period not in STAKING_REWARD_RATES:
                periods_str = ', '.join(map(str, STAKING_REWARD_RATES.keys()))
                return jsonify({
                    "status": "error",
                    "message": f"Некоректний період стейкінгу. Доступні періоди: {periods_str}"
                }), 400
        except (ValueError, TypeError) as e:
            return jsonify({"status": "error", "message": f"Некоректний формат суми: {str(e)}"}), 400

        # Створюємо стейкінг
        success, result, message = create_staking(telegram_id, amount, period)

        if success:
            # Додаткове логування успішного створення
            logger.info(f"create_user_staking: Успішно створено стейкінг для {telegram_id}: {amount} WINIX на {period} днів")
            return jsonify({"status": "success", "data": result, "message": message}), 200
        else:
            logger.warning(f"create_user_staking: Помилка створення стейкінгу для {telegram_id}: {message}")
            return jsonify({"status": "error", "message": message}), 400
    except Exception as e:
        logger.error(f"Помилка створення стейкінгу: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({"status": "error", "message": f"Помилка створення стейкінгу: {str(e)}"}), 500


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
            return jsonify({"status": "error", "message": "Відсутні необхідні параметри"}), 400

        # Отримуємо додаткову суму та валідуємо
        try:
            additional_amount = float(data.get("additionalAmount"))
            if additional_amount != int(additional_amount):
                return jsonify({"status": "error", "message": "Сума додавання має бути цілим числом"}), 400
            additional_amount = int(additional_amount)

            if additional_amount <= 0:
                return jsonify({"status": "error", "message": "Сума додавання має бути більше нуля"}), 400
        except (ValueError, TypeError) as e:
            return jsonify({"status": "error", "message": f"Некоректний формат суми: {str(e)}"}), 400

        # Додаємо до стейкінгу
        success, result, message = service_add_to_staking(telegram_id, staking_id, additional_amount)

        if success:
            # Додаткове логування успішного додавання
            logger.info(f"add_to_staking: Успішно додано {additional_amount} WINIX до стейкінгу {staking_id}")
            return jsonify({"status": "success", "data": result, "message": message}), 200
        else:
            logger.warning(f"add_to_staking: Помилка додавання до стейкінгу {staking_id}: {message}")
            return jsonify({"status": "error", "message": message}), 400
    except Exception as e:
        logger.error(f"Помилка додавання до стейкінгу: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({"status": "error", "message": f"Помилка додавання до стейкінгу: {str(e)}"}), 500


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

        # Скасовуємо стейкінг
        success, result, message = cancel_staking(telegram_id, staking_id)

        if success:
            # Додаткове логування успішного скасування
            logger.info(f"cancel_user_staking: Успішно скасовано стейкінг {staking_id}")
            return jsonify({"status": "success", "data": result, "message": message}), 200
        else:
            logger.warning(f"cancel_user_staking: Помилка скасування стейкінгу {staking_id}: {message}")
            return jsonify({"status": "error", "message": message}), 400
    except Exception as e:
        logger.error(f"Помилка скасування стейкінгу: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({"status": "error", "message": f"Помилка скасування стейкінгу: {str(e)}"}), 500


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

        # Завершуємо стейкінг
        success, result, message = finalize_staking(telegram_id, staking_id, force)

        if success:
            # Додаткове логування успішного завершення
            logger.info(f"finalize_user_staking: Успішно завершено стейкінг {staking_id}")
            return jsonify({"status": "success", "data": result, "message": message}), 200
        else:
            logger.warning(f"finalize_user_staking: Помилка завершення стейкінгу {staking_id}: {message}")
            return jsonify({"status": "error", "message": message}), 400
    except Exception as e:
        logger.error(f"Помилка завершення стейкінгу: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({"status": "error", "message": f"Помилка завершення стейкінгу: {str(e)}"}), 500


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
            return jsonify({"status": "success", "data": data}), 200
        else:
            logger.warning(f"get_user_staking_history: Помилка отримання історії: {message}")
            return jsonify({"status": "error", "message": message}), 400
    except Exception as e:
        logger.error(f"Помилка отримання історії стейкінгу: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({"status": "error", "message": f"Помилка отримання історії стейкінгу: {str(e)}"}), 500


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
            return jsonify({"status": "error", "message": "Відсутні параметри amount або period"}), 400

        # Перевірка, що сума є цілим числом
        if amount != int(amount):
            return jsonify({"status": "error", "message": "Сума стейкінгу має бути цілим числом"}), 400

        amount = int(amount)
        if amount <= 0:
            return jsonify({"status": "error", "message": "Сума стейкінгу повинна бути більше 0"}), 400

        # Перевіряємо доступні періоди
        if period not in STAKING_REWARD_RATES:
            periods_str = ', '.join(map(str, STAKING_REWARD_RATES.keys()))
            return jsonify({
                "status": "error",
                "message": f"Некоректний період стейкінгу. Доступні періоди: {periods_str}"
            }), 400

        # Розраховуємо винагороду
        reward = calculate_staking_reward(amount, period)

        # Визначаємо відсоток для вказаного періоду
        reward_percent = STAKING_REWARD_RATES.get(period, 9)

        # Додаткове логування успішного розрахунку
        logger.info(f"calculate_staking_reward_api: Успішно розраховано винагороду для {amount} WINIX на {period} днів: {reward} WINIX")

        return jsonify({
            "status": "success",
            "data": {
                "reward": reward,
                "rewardPercent": reward_percent,
                "amount": amount,
                "period": period
            }
        }), 200
    except Exception as e:
        logger.error(f"Помилка розрахунку винагороди: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({"status": "error", "message": f"Помилка розрахунку винагороди: {str(e)}"}), 500


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

        # Додаткове логування результату
        if status_code == 200:
            logger.info(f"repair_user_staking: Успішне відновлення для {telegram_id}: {response.get('message')}")
        else:
            logger.warning(f"repair_user_staking: Помилка відновлення для {telegram_id}: {response.get('message')}")

        return jsonify(response), status_code
    except Exception as e:
        logger.error(f"Помилка відновлення стейкінгу: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({"status": "error", "message": f"Помилка відновлення стейкінгу: {str(e)}"}), 500


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
        return jsonify({"status": "error", "message": f"Помилка відновлення стейкінгу: {str(e)}"}), 500


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
        return jsonify({"status": "error", "message": f"Помилка глибокого відновлення стейкінгу: {str(e)}"}), 500