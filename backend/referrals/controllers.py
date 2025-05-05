"""
Контролер для API реферальної системи.
Оптимізована версія з уніфікованими методами та обробкою помилок.
"""
import logging
from datetime import datetime
from typing import Tuple, Dict, Any, Optional

from flask import jsonify, request, g
from referrals.service import ReferralService
from common.helpers import validate_telegram_id, api_response, api_error, api_success

# Налаштування логування
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


def get_referral_code(telegram_id: str) -> Tuple[Dict[str, Any], int]:
    """
    Отримання реферального коду користувача.

    Args:
        telegram_id (str): Telegram ID користувача

    Returns:
        tuple: (відповідь API, код статусу)
    """
    # Валідація ID користувача
    if not validate_telegram_id(telegram_id):
        return api_error("Некоректний ID користувача", status_code=400)

    # Отримуємо реферальний код
    referral_code = ReferralService.get_user_referral_code(telegram_id)

    if not referral_code:
        return api_error(f"Не вдалося отримати реферальний код для користувача {telegram_id}", status_code=404)

    # Повертаємо успішний результат
    return api_success({
        "referral_code": referral_code,
        "share_url": f"https://t.me/winix_bot?start={referral_code}"
    }, "Реферальний код успішно отримано")


def get_user_referrals(telegram_id: str) -> Tuple[Dict[str, Any], int]:
    """
    Отримання інформації про рефералів користувача.

    Args:
        telegram_id (str): Telegram ID користувача

    Returns:
        tuple: (відповідь API, код статусу)
    """
    # Валідація ID користувача
    if not validate_telegram_id(telegram_id):
        return api_error("Некоректний ID користувача", status_code=400)

    # Отримуємо інформацію про рефералів
    referrals_data = ReferralService.get_user_referrals(telegram_id)

    # Перевіряємо на наявність помилки
    if "error" in referrals_data:
        return api_error(f"Помилка отримання рефералів: {referrals_data['error']}", status_code=500)

    # Повертаємо успішний результат
    return api_success(referrals_data, "Інформація про рефералів успішно отримана")


def use_referral_code() -> Tuple[Dict[str, Any], int]:
    """
    Використання реферального коду новим користувачем.

    Returns:
        tuple: (відповідь API, код статусу)
    """
    # Отримуємо дані з запиту
    data = request.json or {}

    # Перевіряємо наявність необхідних полів
    required_fields = ["referral_code", "telegram_id"]
    missing_fields = [field for field in required_fields if field not in data]

    if missing_fields:
        return api_error(f"Відсутні обов'язкові поля: {', '.join(missing_fields)}", status_code=400)

    referral_code = data.get("referral_code")
    telegram_id = data.get("telegram_id")

    # Валідація ID користувача
    if not validate_telegram_id(telegram_id):
        return api_error("Некоректний ID користувача", status_code=400)

    # Перевіряємо валідність реферального коду
    if not ReferralService.is_valid_referral_code(referral_code):
        return api_error("Невалідний реферальний код", status_code=400)

    # Знаходимо користувача з цим реферальним кодом
    referrer_data = ReferralService.get_user_by_referral_code(referral_code)

    if not referrer_data:
        return api_error("Реферальний код не знайдено", status_code=404)

    referrer_id = referrer_data.get("telegram_id")

    # Перевіряємо, що користувач не запрошує сам себе
    if str(referrer_id) == str(telegram_id):
        return api_error("Ви не можете використати власний реферальний код", status_code=400)

    # Створюємо реферальний запис
    referral = ReferralService.create_referral(referrer_id, telegram_id)

    if not referral:
        # Можливо, користувач вже був запрошений
        return api_error("Не вдалося створити реферальне запрошення. Можливо, ви вже були запрошені.", status_code=400)

    # Повертаємо успішний результат
    return api_success({
        "referral_id": referral.id,
        "referrer_id": referral.referrer_id,
        "referee_id": referral.referee_id
    }, "Реферальний код успішно використано")


def get_referral_tasks(telegram_id: str) -> Tuple[Dict[str, Any], int]:
    """
    Отримання статусу реферальних завдань.

    Args:
        telegram_id (str): Telegram ID користувача

    Returns:
        tuple: (відповідь API, код статусу)
    """
    # Валідація ID користувача
    if not validate_telegram_id(telegram_id):
        return api_error("Некоректний ID користувача", status_code=400)

    # Отримуємо дані реферальних завдань
    result = ReferralService.get_referral_tasks(telegram_id)

    # Перевіряємо результат
    if result.get("status") == "error":
        return api_error(result.get("message", "Невідома помилка"), status_code=400)

    # Повертаємо успішний результат
    return api_success(result, "Статус реферальних завдань успішно отримано")


def claim_referral_reward(telegram_id: str) -> Tuple[Dict[str, Any], int]:
    """
    Отримання винагороди за реферальне завдання.

    Args:
        telegram_id (str): Telegram ID користувача

    Returns:
        tuple: (відповідь API, код статусу)
    """
    # Валідація ID користувача
    if not validate_telegram_id(telegram_id):
        return api_error("Некоректний ID користувача", status_code=400)

    # Отримуємо дані з запиту
    data = request.json or {}

    # Перевіряємо наявність task_id
    if "taskId" not in data:
        return api_error("Відсутній ідентифікатор завдання", status_code=400)

    task_id = data.get("taskId")

    # Викликаємо сервіс для обробки винагороди
    result = ReferralService.claim_referral_reward(telegram_id, task_id)

    # Перевіряємо статус
    if result.get("status") == "error":
        return api_error(result.get("message", "Невідома помилка"), status_code=500)
    elif result.get("status") == "already_claimed":
        return api_response(result, 200)
    elif result.get("status") == "not_completed":
        return api_error(result.get("message", "Завдання не виконане"), status_code=400)

    # Повертаємо успішний результат
    return api_success(result, result.get("message", "Винагороду успішно отримано"))


def invite_referral(telegram_id: str) -> Tuple[Dict[str, Any], int]:
    """
    Запросити нового реферала.

    Args:
        telegram_id (str): Telegram ID користувача

    Returns:
        tuple: (відповідь API, код статусу)
    """
    # Валідація ID користувача
    if not validate_telegram_id(telegram_id):
        return api_error("Некоректний ID користувача", status_code=400)

    # Отримуємо дані з запиту
    data = request.json or {}

    # Перевіряємо наявність referralCode
    if "referralCode" not in data:
        return api_error("Відсутній реферальний код", status_code=400)

    referral_code = data.get("referralCode")

    # Перевіряємо валідність реферального коду
    if not ReferralService.is_valid_referral_code(referral_code):
        return api_error("Невалідний реферальний код", status_code=400)

    # Знаходимо користувача з цим реферальним кодом
    referrer_data = ReferralService.get_user_by_referral_code(referral_code)

    if not referrer_data:
        return api_error("Реферальний код не знайдено", status_code=404)

    referrer_id = referrer_data.get("telegram_id")

    # Повертаємо поточну кількість рефералів
    referrals_data = ReferralService.get_user_referrals(telegram_id)
    referral_count = referrals_data.get("total_count", 0)

    # Повертаємо успішний результат
    return api_success({
        "referralCount": referral_count + 1,
        "message": "Друга успішно запрошено!"
    })


def admin_process_pending_rewards() -> Tuple[Dict[str, Any], int]:
    """
    Адміністративна функція для обробки всіх очікуючих реферальних винагород.

    Returns:
        tuple: (відповідь API, код статусу)
    """
    # Перевірка прав адміністратора
    if not g.get('is_admin', False):
        return api_error("Недостатньо прав для виконання операції", status_code=403)

    # Обробляємо всі очікуючі винагороди
    result = ReferralService.process_all_pending_rewards()

    # Перевіряємо результат
    if not result.get('success', False):
        return api_error(result.get('error', 'Невідома помилка'), status_code=500)

    # Повертаємо успішний результат
    return api_success(result,
                       f"Оброблено {result.get('processed_count', 0)} винагород на суму {result.get('total_amount', 0)} WINIX")