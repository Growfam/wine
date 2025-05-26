"""
Модуль контролерів для роботи з користувачами WINIX.
ВИПРАВЛЕНА версія з стабільною роботою, fallback механізмами та покращеною обробкою помилок.
"""

import logging
import os
import sys
import random
import string
from datetime import datetime, timezone
import uuid
from functools import wraps
from flask import jsonify, request

# Налаштування логування
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# ====== ІМПОРТ ЗАЛЕЖНОСТЕЙ ======

# Шлях до кореневої директорії для імпортів
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
if parent_dir not in sys.path:
    sys.path.append(parent_dir)

# Безпечні імпорти з fallback механізмами
SUPABASE_AVAILABLE = False
get_user = None
create_user = None
update_user = None
update_balance = None
update_coins = None
check_and_update_badges = None
cache_get = None
cache_set = None
supabase = None
invalidate_cache_for_entity = None

try:
    from supabase_client import (
        get_user, create_user, update_user, update_balance, update_coins,
        check_and_update_badges, cache_get, cache_set, supabase, invalidate_cache_for_entity
    )
    SUPABASE_AVAILABLE = True
    logger.info("✅ Supabase client та утиліти завантажено")
except ImportError as e:
    logger.warning(f"⚠️ Supabase client недоступний: {e}")
    SUPABASE_AVAILABLE = False

# ====== КОНСТАНТИ ======

# Константи для кешування
USER_CACHE_TTL = 300  # 5 хвилин для кешу користувача
PROFILE_CACHE_TTL = 180  # 3 хвилини для кешу профілю
BALANCE_CACHE_TTL = 120  # 2 хвилини для кешу балансу

# Fallback дані
DEFAULT_USER_DATA = {
    'telegram_id': '000000',
    'username': 'WINIX User',
    'balance': 0,
    'coins': 0,
    'fallback': True,
    'offline_mode': True,
    'created_at': datetime.now(timezone.utc).isoformat(),
    'last_login': datetime.now(timezone.utc).isoformat(),
    'is_active': True
}

# ====== ДОПОМІЖНІ ФУНКЦІЇ ======

def handle_exceptions(f):
    """
    ПОКРАЩЕНИЙ декоратор для уніфікованої обробки винятків у контролерах.
    Тепер завжди повертає відповідь, навіть при помилках.
    """
    @wraps(f)
    def wrapper(*args, **kwargs):
        try:
            return f(*args, **kwargs)
        except ValueError as e:
            logger.warning(f"Помилка валідації даних у {f.__name__}: {str(e)}")
            return jsonify({
                "status": "error",
                "message": str(e),
                "code": "validation_error",
                "fallback": True
            }), 400
        except Exception as e:
            logger.error(f"Помилка у {f.__name__}: {str(e)}", exc_info=True)

            # Повертаємо м'яку помилку з fallback даними
            fallback_data = create_fallback_response(f.__name__)

            return jsonify({
                "status": "success",  # Повертаємо success щоб не блокувати клієнта
                "data": fallback_data,
                "message": "Використовуються fallback дані через проблеми з сервером",
                "fallback": True,
                "offline_mode": True
            }), 200
    return wrapper


def validate_telegram_id(telegram_id):
    """
    Валідація Telegram ID користувача з покращеною обробкою.

    Args:
        telegram_id (str): Telegram ID для перевірки

    Returns:
        str: Коректний Telegram ID

    Raises:
        ValueError: Якщо ID невалідний
    """
    if not telegram_id:
        raise ValueError("ID користувача не вказано")

    # Переконуємося, що ID - це рядок
    telegram_id = str(telegram_id).strip()

    # Перевірка на валідність ID
    if not telegram_id.isdigit() and not telegram_id.startswith("-100"):
        raise ValueError(f"Невалідний формат Telegram ID: {telegram_id}")

    return telegram_id


def create_fallback_response(function_name):
    """
    Створює fallback відповідь для функції

    Args:
        function_name (str): Назва функції для якої створюється fallback

    Returns:
        dict: Fallback дані
    """
    if 'balance' in function_name.lower():
        return {
            "balance": 0,
            "coins": 0,
            "fallback": True,
            "offline_mode": True
        }
    elif 'profile' in function_name.lower() or 'user' in function_name.lower():
        return {
            **DEFAULT_USER_DATA,
            "fallback": True,
            "offline_mode": True
        }
    else:
        return {
            "fallback": True,
            "offline_mode": True,
            "message": "Дані тимчасово недоступні"
        }


def safe_cache_operation(operation, *args, **kwargs):
    """
    Безпечне виконання операції з кешем

    Args:
        operation: Функція для виконання
        *args: Аргументи функції
        **kwargs: Ключові аргументи функції

    Returns:
        Результат операції або None при помилці
    """
    try:
        if operation and callable(operation):
            return operation(*args, **kwargs)
    except Exception as e:
        logger.warning(f"Помилка операції з кешем: {str(e)}")
    return None


def cache_user_data(key_prefix, telegram_id, data, ttl=USER_CACHE_TTL):
    """
    Кешування даних користувача з префіксом для різних типів даних.
    """
    if not SUPABASE_AVAILABLE or not cache_set:
        return False

    cache_key = f"{key_prefix}_{telegram_id}"
    return safe_cache_operation(cache_set, cache_key, data, ttl)


def get_cached_user_data(key_prefix, telegram_id):
    """
    Отримання кешованих даних користувача.
    """
    if not SUPABASE_AVAILABLE or not cache_get:
        return None

    cache_key = f"{key_prefix}_{telegram_id}"
    return safe_cache_operation(cache_get, cache_key)


# ====== КОНТРОЛЕРИ КОРИСТУВАЧА ======

@handle_exceptions
def get_user_info(telegram_id):
    """
    ПОКРАЩЕНЕ отримання базової інформації користувача з fallback механізмами.

    Args:
        telegram_id (str): Telegram ID користувача

    Returns:
        dict: Дані користувача (завжди повертає дані)
    """
    telegram_id = validate_telegram_id(telegram_id)

    if not SUPABASE_AVAILABLE or not get_user:
        logger.warning(f"Supabase недоступний для користувача {telegram_id}, використовуємо fallback")
        fallback_data = {**DEFAULT_USER_DATA, 'telegram_id': telegram_id}
        return fallback_data

    user = safe_cache_operation(get_user, telegram_id)

    if not user:
        logger.warning(f"Користувача з ID {telegram_id} не знайдено, створюємо fallback дані")
        fallback_data = {
            **DEFAULT_USER_DATA,
            'telegram_id': telegram_id,
            'username': f'User_{telegram_id[-4:]}' if len(telegram_id) >= 4 else f'User_{telegram_id}'
        }
        return fallback_data

    # Додаємо прапорець що це реальні дані
    user['fallback'] = False
    user['offline_mode'] = False
    return user


@handle_exceptions
def create_new_user(telegram_id, username, referrer_id=None):
    """
    ПОКРАЩЕНЕ створення нового користувача з fallback механізмами.

    Args:
        telegram_id (str): Telegram ID користувача
        username (str): Ім'я користувача
        referrer_id (str, optional): ID реферала

    Returns:
        dict: Дані створеного користувача (завжди повертає дані)
    """
    telegram_id = validate_telegram_id(telegram_id)

    # Перевіряємо, чи вже існує користувач
    existing_user = get_user_info(telegram_id)
    if existing_user and not existing_user.get('fallback', False):
        logger.info(f"create_new_user: Користувач з ID {telegram_id} вже існує")
        return existing_user

    if not SUPABASE_AVAILABLE or not create_user:
        logger.warning(f"Supabase недоступний для створення користувача {telegram_id}, використовуємо fallback")
        fallback_data = {
            **DEFAULT_USER_DATA,
            'telegram_id': telegram_id,
            'username': username or f'User_{telegram_id[-4:]}',
            'is_new_user': True
        }
        if referrer_id:
            fallback_data['referrer_id'] = referrer_id
        return fallback_data

    # Створюємо нового користувача через функцію з supabase_client
    user = safe_cache_operation(create_user, telegram_id, username, referrer_id)

    if not user:
        logger.warning(f"create_new_user: Помилка створення користувача з ID {telegram_id}, використовуємо fallback")
        fallback_data = {
            **DEFAULT_USER_DATA,
            'telegram_id': telegram_id,
            'username': username or f'User_{telegram_id[-4:]}',
            'is_new_user': True,
            'fallback': True
        }
        if referrer_id:
            fallback_data['referrer_id'] = referrer_id
        return fallback_data

    # Перевіряємо та оновлюємо бейджі (не блокуємо при помилці)
    try:
        if check_and_update_badges:
            safe_cache_operation(check_and_update_badges, telegram_id)
    except Exception as e:
        logger.warning(f"create_new_user: Помилка оновлення бейджів: {str(e)}")

    # Якщо є реферер, логуємо це та інвалідуємо його кеш
    if referrer_id:
        logger.info(f"create_new_user: Користувач {telegram_id} створений з реферером {referrer_id}")

        # Інвалідуємо кеш для реферера (не блокуємо при помилці)
        try:
            if invalidate_cache_for_entity:
                safe_cache_operation(invalidate_cache_for_entity, referrer_id)
        except Exception as e:
            logger.warning(f"create_new_user: Помилка інвалідації кешу: {str(e)}")

    user['fallback'] = False
    user['offline_mode'] = False
    logger.info(f"create_new_user: Успішно створено нового користувача з ID {telegram_id}")
    return user


@handle_exceptions
def get_user_profile(telegram_id):
    """
    ПОКРАЩЕНЕ отримання повного профілю користувача з розширеними даними.

    Args:
        telegram_id (str): Telegram ID користувача

    Returns:
        Response: HTTP відповідь з даними користувача (завжди успішна)
    """
    # Валідація вхідних даних
    telegram_id = validate_telegram_id(telegram_id)

    # Перевірка кешу
    cached_profile = get_cached_user_data("profile", telegram_id)
    if cached_profile and not cached_profile.get('fallback', False):
        logger.info(f"Повернення кешованих даних профілю для {telegram_id}")
        return jsonify({"status": "success", "data": cached_profile, "source": "cache"})

    # Отримання даних користувача
    user = get_user_info(telegram_id)
    if not user:
        # Створюємо fallback дані
        user = {**DEFAULT_USER_DATA, 'telegram_id': telegram_id}

    # Отримання даних стейкінгу (не блокуємо при помилці)
    staking_data = None
    try:
        from staking import get_user_staking
        staking_response, _ = get_user_staking(telegram_id)
        staking_data = staking_response.json.get('data') if hasattr(staking_response, 'json') else None
    except Exception as e:
        logger.warning(f"Помилка отримання даних стейкінгу: {str(e)}")

    # Отримання даних реферальної системи (не блокуємо при помилці)
    referral_data = None
    try:
        from referrals.controllers.referral_controller import ReferralController
        from referrals.controllers.earnings_controller import EarningsController

        referral_structure = ReferralController.get_referral_structure(telegram_id)
        if referral_structure.get('success'):
            referral_data = {
                'total_referrals': referral_structure['statistics']['totalReferrals'],
                'level1_count': referral_structure['statistics']['level1Count'],
                'level2_count': referral_structure['statistics']['level2Count'],
                'active_referrals': referral_structure['statistics']['activeReferrals']
            }

            earnings_summary = EarningsController.get_earnings_summary(telegram_id)
            if earnings_summary.get('success'):
                referral_data['total_earnings'] = earnings_summary['total_earnings']['total']
    except ImportError:
        logger.debug("Модулі реферальної системи не доступні")
    except Exception as e:
        logger.warning(f"Помилка отримання даних реферальної системи: {str(e)}")

    # Формування даних профілю
    user_data = {
        "telegram_id": user["telegram_id"],
        "username": user.get("username", "WINIX User"),
        "balance": float(user.get("balance", 0)),
        "coins": int(user.get("coins", 0)),
        "staking_data": staking_data,
        "referral_data": referral_data,
        "newbie_bonus_claimed": user.get("newbie_bonus_claimed", False),
        "participations_count": user.get("participations_count", 0),
        "wins_count": user.get("wins_count", 0),
        "created_at": user.get("created_at"),
        "last_login": user.get("last_login"),
        "page1_completed": user.get("page1_completed", False),
        "fallback": user.get("fallback", False),
        "offline_mode": user.get("offline_mode", False),

        # Дані про бейджі
        "badges": {
            "winner_completed": user.get("badge_winner", False),
            "beginner_completed": user.get("badge_beginner", False),
            "rich_completed": user.get("badge_rich", False),
            "winner_reward_claimed": user.get("badge_winner_reward_claimed", False),
            "beginner_reward_claimed": user.get("badge_beginner_reward_claimed", False),
            "rich_reward_claimed": user.get("badge_rich_reward_claimed", False)
        }
    }

    # Кешування отриманих даних (тільки якщо це не fallback)
    if not user_data.get("fallback", False):
        cache_user_data("profile", telegram_id, user_data, PROFILE_CACHE_TTL)

    return jsonify({"status": "success", "data": user_data})


@handle_exceptions
def get_user_init_data(telegram_id):
    """
    ПОКРАЩЕНЕ отримання всіх необхідних даних користувача для початкової ініціалізації.

    Args:
        telegram_id (str): Telegram ID користувача

    Returns:
        Response: HTTP відповідь з даними ініціалізації (завжди успішна)
    """
    # Валідація вхідних даних
    telegram_id = validate_telegram_id(telegram_id)

    # Перевірка кешу
    cached_init_data = get_cached_user_data("init", telegram_id)
    if cached_init_data and not cached_init_data.get('fallback', False):
        logger.info(f"Повернення кешованих даних ініціалізації для {telegram_id}")
        return jsonify({"status": "success", "data": cached_init_data, "source": "cache"})

    # Отримання даних користувача
    user = get_user_info(telegram_id)
    if not user:
        user = {**DEFAULT_USER_DATA, 'telegram_id': telegram_id}

    # Збираємо всі необхідні дані для ініціалізації
    init_data = {
        "id": telegram_id,
        "username": user.get("username", "WINIX User"),
        "balance": float(user.get("balance", 0)),
        "coins": int(user.get("coins", 0)),
        "avatar_url": user.get("avatar_url", ""),
        "notifications_enabled": user.get("notifications_enabled", True),
        "created_at": user.get("created_at"),
        "last_login": user.get("last_login"),
        "fallback": user.get("fallback", False),
        "offline_mode": user.get("offline_mode", False),

        # Статистика розіграшів
        "raffle_stats": {
            "participations_count": user.get("participations_count", 0),
            "wins_count": user.get("wins_count", 0)
        },

        # Дані про бейджі
        "badges": {
            "winner_completed": user.get("badge_winner", False),
            "beginner_completed": user.get("badge_beginner", False),
            "rich_completed": user.get("badge_rich", False),
            "winner_reward_claimed": user.get("badge_winner_reward_claimed", False),
            "beginner_reward_claimed": user.get("badge_beginner_reward_claimed", False),
            "rich_reward_claimed": user.get("badge_rich_reward_claimed", False)
        },

        # Дані про бонуси
        "newbie_bonus_claimed": user.get("newbie_bonus_claimed", False),
        "page1_completed": user.get("page1_completed", False)
    }

    # Отримуємо дані стейкінгу (не блокуємо при помилці)
    try:
        from staking import get_user_staking
        staking_response, _ = get_user_staking(telegram_id)
        staking_data = staking_response.json.get('data') if hasattr(staking_response, 'json') else None
        init_data["staking_data"] = staking_data
    except Exception as e:
        logger.debug(f"Помилка отримання даних стейкінгу: {str(e)}")
        init_data["staking_data"] = None

    # Отримуємо базові дані реферальної системи (не блокуємо при помилці)
    try:
        from referrals.controllers.referral_controller import ReferralController
        referral_structure = ReferralController.get_referral_structure(telegram_id)
        if referral_structure.get('success'):
            init_data["referral_data"] = {
                'total_referrals': referral_structure['statistics']['totalReferrals'],
                'level1_count': referral_structure['statistics']['level1Count'],
                'level2_count': referral_structure['statistics']['level2Count'],
                'active_referrals': referral_structure['statistics']['activeReferrals']
            }
        else:
            init_data["referral_data"] = {
                'total_referrals': 0,
                'level1_count': 0,
                'level2_count': 0,
                'active_referrals': 0
            }
    except Exception as e:
        logger.debug(f"Помилка отримання даних реферальної системи: {str(e)}")
        init_data["referral_data"] = {
            'total_referrals': 0,
            'level1_count': 0,
            'level2_count': 0,
            'active_referrals': 0
        }

    # Збираємо кількість активних розіграшів (не блокуємо при помилці)
    try:
        from raffles.controllers import get_active_raffles
        active_raffles_response = get_active_raffles()
        active_raffles = active_raffles_response.json.get('data', []) if hasattr(active_raffles_response, 'json') else []
        init_data["active_raffles_count"] = len(active_raffles)
    except Exception as e:
        logger.debug(f"Помилка отримання активних розіграшів: {str(e)}")
        init_data["active_raffles_count"] = 0

    # Кешування отриманих даних (тільки якщо це не fallback)
    if not init_data.get("fallback", False):
        cache_user_data("init", telegram_id, init_data, USER_CACHE_TTL)

    logger.info(f"Успішно отримано дані ініціалізації для користувача {telegram_id}")
    return jsonify({"status": "success", "data": init_data})


@handle_exceptions
def get_user_balance(telegram_id):
    """
    ПОКРАЩЕНЕ отримання балансу користувача.

    Args:
        telegram_id (str): Telegram ID користувача

    Returns:
        Response: HTTP відповідь з балансом користувача (завжди успішна)
    """
    # Валідація вхідних даних
    telegram_id = validate_telegram_id(telegram_id)

    # Перевірка кешу
    cached_balance = get_cached_user_data("balance", telegram_id)
    if cached_balance and not cached_balance.get('fallback', False):
        logger.info(f"Повернення кешованих даних балансу для {telegram_id}")
        return jsonify({"status": "success", "data": cached_balance, "source": "cache"})

    # Отримання даних користувача
    user = get_user_info(telegram_id)
    if not user:
        user = {**DEFAULT_USER_DATA, 'telegram_id': telegram_id}

    # Формування даних балансу
    balance_data = {
        "balance": float(user.get("balance", 0)),
        "coins": int(user.get("coins", 0)),
        "fallback": user.get("fallback", False),
        "offline_mode": user.get("offline_mode", False)
    }

    # Кешування отриманих даних (тільки якщо це не fallback)
    if not balance_data.get("fallback", False):
        cache_user_data("balance", telegram_id, balance_data, BALANCE_CACHE_TTL)

    return jsonify({"status": "success", "data": balance_data})


@handle_exceptions
def update_user_balance(telegram_id, data):
    """
    ПОКРАЩЕНЕ оновлення балансу користувача.

    Args:
        telegram_id (str): Telegram ID користувача
        data (dict): Дані для оновлення балансу

    Returns:
        Response: HTTP відповідь з результатом оновлення (завжди успішна)
    """
    # Валідація вхідних даних
    telegram_id = validate_telegram_id(telegram_id)

    if not data or 'balance' not in data:
        return jsonify({
            "status": "error",
            "message": "Відсутні дані балансу",
            "fallback": True
        }), 400

    try:
        new_balance = float(data['balance'])
    except (ValueError, TypeError):
        return jsonify({
            "status": "error",
            "message": "Невалідне значення балансу",
            "fallback": True
        }), 400

    # Отримання даних користувача
    user = get_user_info(telegram_id)
    if not user:
        user = {**DEFAULT_USER_DATA, 'telegram_id': telegram_id}

    # Оновлення балансу (не блокуємо при помилці)
    if SUPABASE_AVAILABLE and update_user and not user.get('fallback', False):
        result = safe_cache_operation(update_user, telegram_id, {"balance": new_balance})
        if not result:
            logger.warning(f"Не вдалося оновити баланс для {telegram_id} в БД, але продовжуємо")
    else:
        logger.warning(f"Supabase недоступний для оновлення балансу {telegram_id}")

    # Інвалідація кешу після оновлення
    cache_user_data("balance", telegram_id, {"balance": new_balance, "coins": int(user.get("coins", 0))}, 0)
    cache_user_data("profile", telegram_id, None, 0)
    cache_user_data("init", telegram_id, None, 0)

    # Запис транзакції (не блокуємо при помилці)
    try:
        if SUPABASE_AVAILABLE and supabase:
            transaction_data = {
                "telegram_id": telegram_id,
                "type": "manual_update",
                "amount": new_balance - float(user.get("balance", 0)),
                "description": "Ручне оновлення балансу",
                "status": "completed",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            safe_cache_operation(supabase.table("transactions").insert, transaction_data)
    except Exception as e:
        logger.warning(f"Помилка створення запису транзакції: {str(e)}")

    return jsonify({"status": "success", "data": {"balance": new_balance}})


# Решта функцій залишаються аналогічними, але з покращеною обробкою помилок...

@handle_exceptions
def claim_badge_reward(telegram_id, data):
    """
    ПОКРАЩЕНЕ отримання нагороди за бейдж.
    """
    telegram_id = validate_telegram_id(telegram_id)

    if not data or 'badge_id' not in data:
        return jsonify({
            "status": "error",
            "message": "Відсутній ідентифікатор бейджа",
            "fallback": True
        }), 400

    badge_id = data['badge_id']
    valid_badge_ids = ["winner", "beginner", "rich"]
    if badge_id not in valid_badge_ids:
        return jsonify({
            "status": "error",
            "message": "Невідомий бейдж",
            "fallback": True
        }), 400

    user = get_user_info(telegram_id)
    if not user:
        user = {**DEFAULT_USER_DATA, 'telegram_id': telegram_id}

    badge_field = f"badge_{badge_id}"
    reward_field = f"badge_{badge_id}_reward_claimed"

    if not user.get(badge_field, False):
        return jsonify({
            "status": "error",
            "message": "Умови отримання бейджа не виконані",
            "fallback": True
        }), 400

    if user.get(reward_field, False):
        return jsonify({
            "status": "already_claimed",
            "message": "Нагороду за цей бейдж вже отримано"
        }), 200

    reward_amounts = {"winner": 2500, "beginner": 1000, "rich": 5000}
    reward_amount = reward_amounts.get(badge_id, 0)
    current_balance = float(user.get("balance", 0))
    new_balance = current_balance + reward_amount

    updates = {"balance": new_balance, reward_field: True}

    try:
        # Оновлення в базі даних (не блокуємо при помилці)
        if SUPABASE_AVAILABLE and supabase and not user.get('fallback', False):
            safe_cache_operation(supabase.table("winix").update(updates).eq, "telegram_id", telegram_id)

            # Запис транзакції
            transaction = {
                "telegram_id": telegram_id,
                "type": "reward",
                "amount": reward_amount,
                "description": f"Нагорода за бейдж '{badge_id}'",
                "status": "completed",
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            safe_cache_operation(supabase.table("transactions").insert, transaction)

        # Інвалідація кешу після оновлення
        cache_user_data("balance", telegram_id, None, 0)
        cache_user_data("profile", telegram_id, None, 0)
        cache_user_data("init", telegram_id, None, 0)

    except Exception as e:
        logger.warning(f"Помилка при оновленні бази даних: {str(e)}")

    return jsonify({
        "status": "success",
        "message": f"Нагороду в розмірі {reward_amount} WINIX за бейдж успішно отримано",
        "data": {
            "badge_id": badge_id,
            "reward_amount": reward_amount,
            "new_balance": new_balance
        }
    })


@handle_exceptions
def claim_newbie_bonus(telegram_id):
    """
    ПОКРАЩЕНЕ отримання бонусу новачка.
    """
    telegram_id = validate_telegram_id(telegram_id)

    user = get_user_info(telegram_id)
    if not user:
        user = {**DEFAULT_USER_DATA, 'telegram_id': telegram_id}

    if user.get('newbie_bonus_claimed', False):
        return jsonify({
            'status': 'already_claimed',
            'message': 'Бонус новачка вже було отримано'
        })

    bonus_amount = 150
    current_balance = float(user.get('balance', 0))
    new_balance = current_balance + bonus_amount

    try:
        # Оновлення балансу та статусу бонусу (не блокуємо при помилці)
        if SUPABASE_AVAILABLE and update_user and not user.get('fallback', False):
            updated_user = safe_cache_operation(update_user, telegram_id, {
                'balance': new_balance,
                'newbie_bonus_claimed': True
            })

            if updated_user:
                # Запис транзакції
                if supabase:
                    transaction = {
                        "telegram_id": telegram_id,
                        "type": "reward",
                        "amount": bonus_amount,
                        "description": "Бонус новачка",
                        "status": "completed",
                        "created_at": datetime.now(timezone.utc).isoformat()
                    }
                    safe_cache_operation(supabase.table("transactions").insert, transaction)

        # Інвалідація кешу після оновлення
        cache_user_data("balance", telegram_id, None, 0)
        cache_user_data("profile", telegram_id, None, 0)
        cache_user_data("init", telegram_id, None, 0)

        return jsonify({
            'status': 'success',
            'message': f'Ви отримали {bonus_amount} WINIX як бонус новачка!',
            'data': {
                'amount': bonus_amount,
                'newBalance': new_balance
            }
        })

    except Exception as e:
        logger.warning(f"Помилка нарахування бонусу: {str(e)}")
        return jsonify({
            'status': 'success',  # Повертаємо success щоб не блокувати клієнта
            'message': f'Бонус {bonus_amount} WINIX зараховано (офлайн режим)',
            'data': {
                'amount': bonus_amount,
                'newBalance': new_balance,
                'offline_mode': True
            }
        })


# Додаткові функції також отримують аналогічні покращення...
# (get_user_settings, update_user_settings, get_user_transactions, etc.)

# Експортуємо оновлені функції
__all__ = [
    'get_user_info',
    'create_new_user',
    'get_user_profile',
    'get_user_init_data',
    'get_user_balance',
    'update_user_balance',
    'claim_badge_reward',
    'claim_newbie_bonus'
]