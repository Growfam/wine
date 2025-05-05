"""
Контролери для лідерборду WINIX.
Обробляють запити API пов'язані з відображенням рейтингів користувачів.
"""
import logging
from flask import request
from typing import Dict, Any, Tuple

from quests.leaderboard_service import LeaderboardService
from utils.api_helpers import api_success, api_error, handle_exception

# Налаштування логування
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


def get_referrals_leaderboard() -> Tuple[Dict[str, Any], int]:
    """
    Отримання лідерборду по рефералам.

    Returns:
        tuple: (відповідь API, код статусу)
    """
    try:
        # Отримуємо параметри пагінації
        try:
            limit = request.args.get('limit', 10, type=int)
            offset = request.args.get('offset', 0, type=int)

            # Валідація параметрів
            if limit < 1 or limit > 100:
                limit = 10  # Встановлюємо безпечне значення за замовчуванням
                logger.warning(f"get_referrals_leaderboard: Невалідний параметр limit: {limit}, використовуємо значення за замовчуванням 10")

            if offset < 0:
                offset = 0  # Встановлюємо безпечне значення за замовчуванням
                logger.warning(f"get_referrals_leaderboard: Невалідний параметр offset: {offset}, використовуємо значення за замовчуванням 0")
        except ValueError:
            limit = 10
            offset = 0
            logger.warning("get_referrals_leaderboard: Невалідні параметри пагінації, використовуємо значення за замовчуванням")

        # Отримуємо лідерборд
        leaderboard = LeaderboardService.get_referrals_leaderboard(limit, offset)

        return api_success(
            data={"leaderboard": leaderboard},
            message="Лідерборд рефералів успішно отримано"
        )
    except Exception as e:
        logger.exception("Помилка отримання лідерборду рефералів")
        return handle_exception(e, "Помилка отримання лідерборду рефералів")


def get_tasks_leaderboard() -> Tuple[Dict[str, Any], int]:
    """
    Отримання лідерборду по завданням.

    Returns:
        tuple: (відповідь API, код статусу)
    """
    try:
        # Отримуємо параметри пагінації
        try:
            limit = request.args.get('limit', 10, type=int)
            offset = request.args.get('offset', 0, type=int)
            days = request.args.get('days', 30, type=int)

            # Валідація параметрів
            if limit < 1 or limit > 100:
                limit = 10  # Встановлюємо безпечне значення за замовчуванням
                logger.warning(f"get_tasks_leaderboard: Невалідний параметр limit: {limit}, використовуємо значення за замовчуванням 10")

            if offset < 0:
                offset = 0  # Встановлюємо безпечне значення за замовчуванням
                logger.warning(f"get_tasks_leaderboard: Невалідний параметр offset: {offset}, використовуємо значення за замовчуванням 0")

            if days < 1 or days > 365:
                days = 30  # Встановлюємо безпечне значення за замовчуванням
                logger.warning(f"get_tasks_leaderboard: Невалідний параметр days: {days}, використовуємо значення за замовчуванням 30")
        except ValueError:
            limit = 10
            offset = 0
            days = 30
            logger.warning("get_tasks_leaderboard: Невалідні параметри пагінації, використовуємо значення за замовчуванням")

        # Отримуємо лідерборд
        leaderboard = LeaderboardService.get_tasks_leaderboard(limit, offset, days)

        return api_success(
            data={"leaderboard": leaderboard},
            message="Лідерборд завдань успішно отримано"
        )
    except Exception as e:
        logger.exception("Помилка отримання лідерборду завдань")
        return handle_exception(e, "Помилка отримання лідерборду завдань")


def get_user_leaderboard_position(telegram_id: str) -> Tuple[Dict[str, Any], int]:
    """
    Отримання позиції користувача в лідерборді.

    Args:
        telegram_id (str): Telegram ID користувача

    Returns:
        tuple: (відповідь API, код статусу)
    """
    try:
        # Валідація telegram_id
        if not telegram_id or not isinstance(telegram_id, str):
            logger.error(f"get_user_leaderboard_position: Недійсний telegram_id: {telegram_id}")
            return api_error(message="Недійсний ID користувача", status_code=400)

        # Отримуємо тип лідерборду
        leaderboard_type = request.args.get('type', 'referrals')

        # Валідація типу лідерборду
        valid_types = ['referrals', 'tasks', 'balance']
        if leaderboard_type not in valid_types:
            leaderboard_type = 'referrals'  # Встановлюємо безпечне значення за замовчуванням
            logger.warning(f"get_user_leaderboard_position: Невалідний тип лідерборду: {leaderboard_type}, використовуємо значення за замовчуванням 'referrals'")

        # Отримуємо позицію
        position_data = LeaderboardService.get_user_position(telegram_id, leaderboard_type)

        return api_success(
            data=position_data,
            message=f"Позиція користувача в лідерборді {leaderboard_type} успішно отримана"
        )
    except Exception as e:
        logger.exception(f"Помилка отримання позиції користувача {telegram_id} в лідерборді")
        return handle_exception(e, f"Помилка отримання позиції користувача {telegram_id} в лідерборді")