"""
Контролер для обробки HTTP-запитів, пов'язаних зі стейкінгом.
Виконує валідацію параметрів запиту та передає дані до сервісного шару.
"""
from typing import Tuple, Dict, Any, Optional, Union
from flask import jsonify, request
import logging

from .services import (
    check_active_staking,
    create_staking,
    add_to_staking,
    cancel_staking,
    finalize_staking,
    get_staking_history,
    calculate_staking_reward,
    reset_and_repair_staking as service_reset_repair,
    deep_repair_staking
)

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

        return jsonify({"status": "success", "data": staking_data}), 200
    except Exception as e:
        logger.error(f"Помилка отримання даних стейкінгу: {str(e)}")
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

        # Створюємо стейкінг
        success, result, message = create_staking(telegram_id, amount, period)

        if success:
            return jsonify({"status": "success", "data": result, "message": message}), 200
        else:
            return jsonify({"status": "error", "message": message}), 400
    except Exception as e:
        logger.error(f"Помилка створення стейкінгу: {str(e)}")
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
        # Отримуємо дані запиту
        data = request.json
        if not data or "additionalAmount" not in data:
            return jsonify({"status": "error", "message": "Відсутні необхідні параметри"}), 400

        # Отримуємо додаткову суму
        additional_amount = data.get("additionalAmount")

        # Додаємо до стейкінгу
        success, result, message = add_to_staking(telegram_id, staking_id, additional_amount)

        if success:
            return jsonify({"status": "success", "data": result, "message": message}), 200
        else:
            return jsonify({"status": "error", "message": message}), 400
    except Exception as e:
        logger.error(f"Помилка додавання до стейкінгу: {str(e)}")
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
        # Скасовуємо стейкінг
        success, result, message = cancel_staking(telegram_id, staking_id)

        if success:
            return jsonify({"status": "success", "data": result, "message": message}), 200
        else:
            return jsonify({"status": "error", "message": message}), 400
    except Exception as e:
        logger.error(f"Помилка скасування стейкінгу: {str(e)}")
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
        # Отримуємо дані запиту
        data = request.json or {}
        force = data.get("forceFinalize", False)

        # Завершуємо стейкінг
        success, result, message = finalize_staking(telegram_id, staking_id, force)

        if success:
            return jsonify({"status": "success", "data": result, "message": message}), 200
        else:
            return jsonify({"status": "error", "message": message}), 400
    except Exception as e:
        logger.error(f"Помилка завершення стейкінгу: {str(e)}")
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
        # Отримуємо історію стейкінгу
        success, data, message = get_staking_history(telegram_id)

        if success:
            return jsonify({"status": "success", "data": data}), 200
        else:
            return jsonify({"status": "error", "message": message}), 400
    except Exception as e:
        logger.error(f"Помилка отримання історії стейкінгу: {str(e)}")
        return jsonify({"status": "error", "message": f"Помилка отримання історії стейкінгу: {str(e)}"}), 500


def calculate_staking_reward_api() -> Tuple[Dict[str, Any], int]:
    """
    Обробник маршруту /api/user/<telegram_id>/staking/calculate-reward [GET]
    Розрахунок очікуваної винагороди за стейкінг

    Returns:
        tuple: (json_response, status_code)
    """
    try:
        # Отримуємо параметри з запиту
        amount = request.args.get('amount', type=float)
        period = request.args.get('period', type=int)

        if amount is None or period is None:
            return jsonify({"status": "error", "message": "Відсутні параметри amount або period"}), 400

        # Перевірка, що сума є цілим числом
        if amount != int(amount):
            return jsonify({"status": "error", "message": "Сума стейкінгу має бути цілим числом"}), 400

        if amount <= 0:
            return jsonify({"status": "error", "message": "Сума стейкінгу повинна бути більше 0"}), 400

        # Перевіряємо доступні періоди
        try:
            from models.staking_session import StakingSession
            if period not in StakingSession.STAKING_REWARD_RATES:
                periods_str = ', '.join(map(str, StakingSession.STAKING_REWARD_RATES.keys()))
                return jsonify({
                    "status": "error",
                    "message": f"Некоректний період стейкінгу. Доступні періоди: {periods_str}"
                }), 400
            # Визначаємо відсоток для вказаного періоду
            reward_percent = StakingSession.STAKING_REWARD_RATES.get(period, 9)
        except ImportError:
            # Альтернативний варіант, якщо модель недоступна
            from .services import STAKING_REWARD_RATES
            if period not in STAKING_REWARD_RATES:
                periods_str = ', '.join(map(str, STAKING_REWARD_RATES.keys()))
                return jsonify({
                    "status": "error",
                    "message": f"Некоректний період стейкінгу. Доступні періоди: {periods_str}"
                }), 400
            # Визначаємо відсоток для вказаного періоду
            reward_percent = STAKING_REWARD_RATES.get(period, 9)

        # Розраховуємо винагороду
        reward = calculate_staking_reward(amount, period)

        return jsonify({
            "status": "success",
            "data": {
                "reward": reward,
                "rewardPercent": reward_percent,
                "amount": int(amount),
                "period": period
            }
        }), 200
    except Exception as e:
        logger.error(f"Помилка розрахунку винагороди: {str(e)}")
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
        # Перевірка даних запиту
        data = request.json or {}
        force = data.get('force', False)

        # Виклик функції відновлення
        response, status_code = service_reset_repair(telegram_id, force)
        return jsonify(response), status_code
    except Exception as e:
        logger.error(f"Помилка відновлення стейкінгу: {str(e)}")
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
        # Викликаємо repair_user_staking з параметром force
        data = request.json or {}
        data['force'] = force
        request.json = data
        return repair_user_staking(telegram_id)
    except Exception as e:
        logger.error(f"Помилка відновлення стейкінгу: {str(e)}")
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
        # Перевірка даних запиту
        data = request.json or {}
        balance_adjustment = float(data.get('balance_adjustment', 0))

        # Виклик функції глибокого відновлення
        response, status_code = deep_repair_staking(telegram_id, balance_adjustment)
        return jsonify(response), status_code
    except Exception as e:
        logger.error(f"Помилка глибокого відновлення стейкінгу: {str(e)}")
        return jsonify({"status": "error", "message": f"Помилка глибокого відновлення стейкінгу: {str(e)}"}), 500