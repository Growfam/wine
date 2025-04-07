from flask import request, jsonify
import logging
import staking_service as service
import staking_utils as utils

# Налаштування логування
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


def get_user_staking(telegram_id):
    """
    Обробник маршруту /api/user/<telegram_id>/staking [GET]
    Отримання даних стейкінгу користувача
    """
    try:
        # Перевіряємо наявність активного стейкінгу
        has_staking, staking_data = service.check_active_staking(telegram_id)

        # Якщо стейкінг завершився, автоматично фіналізуємо його
        if has_staking and staking_data and staking_data.get("remainingDays", 0) == 0:
            # Автоматичне завершення стейкінгу
            success, result, message = service.finalize_staking(
                telegram_id,
                staking_data.get("stakingId"),
                force=True
            )

            if success:
                logger.info(f"Автоматичне завершення стейкінгу для користувача {telegram_id}")
                return jsonify({"status": "success", "data": result["staking"]})
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

        return jsonify({"status": "success", "data": staking_data})
    except Exception as e:
        logger.error(f"Помилка отримання даних стейкінгу: {str(e)}")
        return jsonify({"status": "error", "message": "Помилка отримання даних стейкінгу"}), 500


def create_user_staking(telegram_id):
    """
    Обробник маршруту /api/user/<telegram_id>/staking [POST]
    Створення нового стейкінгу
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
        success, result, message = service.create_staking(telegram_id, amount, period)

        if success:
            return jsonify({"status": "success", "data": result, "message": message})
        else:
            return jsonify({"status": "error", "message": message}), 400
    except Exception as e:
        logger.error(f"Помилка створення стейкінгу: {str(e)}")
        return jsonify({"status": "error", "message": "Помилка створення стейкінгу"}), 500


def update_user_staking(telegram_id, staking_id):
    """
    Обробник маршруту /api/user/<telegram_id>/staking/<staking_id> [PUT]
    Додавання коштів до існуючого стейкінгу
    """
    try:
        # Отримуємо дані запиту
        data = request.json
        if not data or "additionalAmount" not in data:
            return jsonify({"status": "error", "message": "Відсутні необхідні параметри"}), 400

        # Отримуємо додаткову суму
        additional_amount = data.get("additionalAmount")

        # Додаємо до стейкінгу
        success, result, message = service.add_to_staking(telegram_id, staking_id, additional_amount)

        if success:
            return jsonify({"status": "success", "data": result, "message": message})
        else:
            return jsonify({"status": "error", "message": message}), 400
    except Exception as e:
        logger.error(f"Помилка додавання до стейкінгу: {str(e)}")
        return jsonify({"status": "error", "message": "Помилка додавання до стейкінгу"}), 500


def cancel_user_staking(telegram_id, staking_id):
    """
    Обробник маршруту /api/user/<telegram_id>/staking/<staking_id>/cancel [POST]
    Скасування стейкінгу
    """
    try:
        # Скасовуємо стейкінг
        success, result, message = service.cancel_staking(telegram_id, staking_id)

        if success:
            return jsonify({"status": "success", "data": result, "message": message})
        else:
            return jsonify({"status": "error", "message": message}), 400
    except Exception as e:
        logger.error(f"Помилка скасування стейкінгу: {str(e)}")
        return jsonify({"status": "error", "message": "Помилка скасування стейкінгу"}), 500


def finalize_user_staking(telegram_id, staking_id):
    """
    Обробник маршруту /api/user/<telegram_id>/staking/<staking_id>/finalize [POST]
    Завершення стейкінгу і нарахування винагороди
    """
    try:
        # Отримуємо дані запиту
        data = request.json or {}
        force = data.get("forceFinalize", False)

        # Завершуємо стейкінг
        success, result, message = service.finalize_staking(telegram_id, staking_id, force)

        if success:
            return jsonify({"status": "success", "data": result, "message": message})
        else:
            return jsonify({"status": "error", "message": message}), 400
    except Exception as e:
        logger.error(f"Помилка завершення стейкінгу: {str(e)}")
        return jsonify({"status": "error", "message": "Помилка завершення стейкінгу"}), 500


def get_user_staking_history(telegram_id):
    """
    Обробник маршруту /api/user/<telegram_id>/staking/history [GET]
    Отримання історії стейкінгу
    """
    try:
        # Отримуємо історію стейкінгу
        success, data, message = service.get_staking_history(telegram_id)

        if success:
            return jsonify({"status": "success", "data": data})
        else:
            return jsonify({"status": "error", "message": message}), 400
    except Exception as e:
        logger.error(f"Помилка отримання історії стейкінгу: {str(e)}")
        return jsonify({"status": "error", "message": "Помилка отримання історії стейкінгу"}), 500


def calculate_staking_reward_api():
    """
    Обробник маршруту /api/user/<telegram_id>/staking/calculate-reward [GET]
    Розрахунок очікуваної винагороди за стейкінг
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

        if period not in utils.STAKING_REWARD_RATES:
            return jsonify({"status": "error",
                            "message": f"Некоректний період стейкінгу. Доступні періоди: {', '.join(map(str, utils.STAKING_REWARD_RATES.keys()))}"
                            }), 400

        # Розраховуємо винагороду
        reward = utils.calculate_staking_reward(amount, period)

        # Визначаємо відсоток для вказаного періоду
        reward_percent = utils.STAKING_REWARD_RATES.get(period, 9)

        return jsonify({
            "status": "success",
            "data": {
                "reward": reward,
                "rewardPercent": reward_percent,
                "amount": int(amount),
                "period": period
            }
        })
    except Exception as e:
        logger.error(f"Помилка розрахунку винагороди: {str(e)}")
        return jsonify({"status": "error", "message": "Помилка розрахунку винагороди"}), 500


def reset_and_repair_staking(telegram_id):
    """
    Обробник маршруту /api/user/<telegram_id>/staking/repair [POST]
    Відновлення стану стейкінгу після помилок
    """
    try:
        # Отримуємо дані запиту
        data = request.json or {}
        force = data.get("force", False)

        # Отримуємо наявність активного стейкінгу
        has_staking, staking_data = service.check_active_staking(telegram_id)

        if not has_staking:
            return jsonify({
                "status": "success",
                "message": "Відновлення не потрібне. Немає активного стейкінгу."
            })

        # Якщо є активний стейкінг, але примусово не вказано, перевіряємо його стан
        if has_staking and not force:
            # Перевіряємо чи стейкінг завершився
            end_date = staking_data.get("endDate")

            if end_date and utils.check_staking_finished(end_date):
                # Стейкінг завершився, автоматично фіналізуємо його
                success, result, message = service.finalize_staking(
                    telegram_id,
                    staking_data.get("stakingId"),
                    force=True
                )

                if success:
                    return jsonify({
                        "status": "success",
                        "message": "Стейкінг успішно завершено при відновленні",
                        "data": result
                    })
                else:
                    return jsonify({"status": "error", "message": message}), 400
            else:
                # Стейкінг ще активний і не потребує відновлення
                return jsonify({
                    "status": "success",
                    "message": "Відновлення не потрібне. Стейкінг активний та коректний."
                })

        # Якщо потрібно примусово скасувати стейкінг
        if has_staking and force:
            # Скасовуємо стейкінг без штрафу
            success, result, message = service.cancel_staking(
                telegram_id,
                staking_data.get("stakingId")
            )

            if success:
                return jsonify({
                    "status": "success",
                    "message": "Стейкінг успішно відновлено (стан скинуто)",
                    "data": result
                })
            else:
                return jsonify({"status": "error", "message": message}), 400

        return jsonify({"status": "error", "message": "Невідома помилка при відновленні стейкінгу"}), 400
    except Exception as e:
        logger.error(f"Помилка відновлення стейкінгу: {str(e)}")
        return jsonify({"status": "error", "message": "Помилка відновлення стейкінгу"}), 500