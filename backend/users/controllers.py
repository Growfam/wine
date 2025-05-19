"""
Модуль контролерів для роботи з користувачами WINIX.
Покращена версія з оптимізованою структурою, обробкою помилок
та централізованими функціями для роботи з даними користувачів.
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

try:
    # Імпорт клієнта Supabase та утиліт
    from supabase_client import (
        get_user, create_user, update_user, update_balance, update_coins,
        check_and_update_badges, cache_get, cache_set, supabase
    )
except ImportError as e:
    logger.critical(f"Критична помилка імпорту: {str(e)}")
    raise

# ====== КЕШУВАННЯ ТА КОНСТАНТИ ======

# Константи для кешування
USER_CACHE_TTL = 300  # 5 хвилин для кешу користувача
PROFILE_CACHE_TTL = 180  # 3 хвилини для кешу профілю
BALANCE_CACHE_TTL = 120  # 2 хвилини для кешу балансу


# ====== ДОПОМІЖНІ ФУНКЦІЇ ======

def handle_exceptions(f):
    """
    Декоратор для уніфікованої обробки винятків у контролерах.
    Перехоплює винятки та повертає відповідні HTTP-відповіді.
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
                "code": "validation_error"
            }), 400
        except Exception as e:
            logger.error(f"Помилка у {f.__name__}: {str(e)}", exc_info=True)
            return jsonify({
                "status": "error",
                "message": "Сталася помилка на сервері. Спробуйте пізніше.",
                "code": "server_error",
                "details": str(e) if os.getenv("DEBUG") == "true" else None
            }), 500

    return wrapper


def validate_telegram_id(telegram_id):
    """
    Валідація Telegram ID користувача.

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


def cache_user_data(key_prefix, telegram_id, data, ttl=USER_CACHE_TTL):
    """
    Кешування даних користувача з префіксом для різних типів даних.

    Args:
        key_prefix (str): Префікс ключа кешу
        telegram_id (str): ID користувача
        data (dict): Дані для кешування
        ttl (int): Час життя кешу в секундах
    """
    cache_key = f"{key_prefix}_{telegram_id}"
    cache_set(cache_key, data, ttl)
    logger.debug(f"Дані користувача кешовано з ключем {cache_key}")


def get_cached_user_data(key_prefix, telegram_id):
    """
    Отримання кешованих даних користувача.

    Args:
        key_prefix (str): Префікс ключа кешу
        telegram_id (str): ID користувача

    Returns:
        dict or None: Кешовані дані або None, якщо кеш відсутній
    """
    cache_key = f"{key_prefix}_{telegram_id}"
    return cache_get(cache_key)


# ====== КОНТРОЛЕРИ КОРИСТУВАЧА ======

@handle_exceptions
def get_user_info(telegram_id):
    """
    Отримання базової інформації користувача.

    Args:
        telegram_id (str): Telegram ID користувача

    Returns:
        dict: Дані користувача
    """
    telegram_id = validate_telegram_id(telegram_id)
    user = get_user(telegram_id)

    if not user:
        logger.warning(f"Користувача з ID {telegram_id} не знайдено")
        raise ValueError(f"Користувача з ID {telegram_id} не знайдено")

    return user


@handle_exceptions
def create_new_user(telegram_id, username, referrer_id=None):
    """
    Створення нового користувача.

    Args:
        telegram_id (str): Telegram ID користувача
        username (str): Ім'я користувача
        referrer_id (str, optional): ID реферала, який запросив користувача

    Returns:
        dict: Дані створеного користувача
    """
    telegram_id = validate_telegram_id(telegram_id)

    # Перевіряємо, чи вже існує користувач
    existing_user = get_user(telegram_id)
    if existing_user:
        logger.info(f"Користувач з ID {telegram_id} вже існує")
        return existing_user

    # Створюємо нового користувача через функцію з supabase_client
    user = create_user(telegram_id, username, referrer_id)

    if not user:
        logger.error(f"Помилка створення користувача з ID {telegram_id}")
        raise ValueError(f"Не вдалося створити користувача з ID {telegram_id}")

    logger.info(f"Успішно створено нового користувача з ID {telegram_id}")
    return user


@handle_exceptions
def get_user_profile(telegram_id):
    """
    Отримання повного профілю користувача з розширеними даними.

    Args:
        telegram_id (str): Telegram ID користувача

    Returns:
        Response: HTTP відповідь з даними користувача
    """
    # Валідація вхідних даних
    telegram_id = validate_telegram_id(telegram_id)

    # Перевірка кешу
    cached_profile = get_cached_user_data("profile", telegram_id)
    if cached_profile:
        logger.info(f"Повернення кешованих даних профілю для {telegram_id}")
        return jsonify({"status": "success", "data": cached_profile, "source": "cache"})

    # Отримання даних користувача
    user = get_user(telegram_id)
    if not user:
        return jsonify({"status": "error", "message": "Користувача не знайдено"}), 404

    # Отримання даних стейкінгу
    staking_data = None
    try:
        from staking import get_user_staking
        staking_response, _ = get_user_staking(telegram_id)
        staking_data = staking_response.json.get('data') if hasattr(staking_response, 'json') else None
    except Exception as e:
        logger.warning(f"Помилка отримання даних стейкінгу: {str(e)}")

    # Формування даних профілю
    user_data = {
        "telegram_id": user["telegram_id"],
        "username": user.get("username", "WINIX User"),
        "balance": float(user.get("balance", 0)),
        "coins": int(user.get("coins", 0)),
        "staking_data": staking_data,
        "newbie_bonus_claimed": user.get("newbie_bonus_claimed", False),
        "participations_count": user.get("participations_count", 0),
        "wins_count": user.get("wins_count", 0),
        "created_at": user.get("created_at"),
        "last_login": user.get("last_login"),
        "page1_completed": user.get("page1_completed", False),

        # Дані про бейджі
        "badges": {
            "winner_completed": user.get("badge_winner", False),
            "beginner_completed": user.get("badge_beginner", False),
            "rich_completed": user.get("badge_rich", False)
        }
    }

    # Кешування отриманих даних
    cache_user_data("profile", telegram_id, user_data, PROFILE_CACHE_TTL)

    return jsonify({"status": "success", "data": user_data})


@handle_exceptions
def get_user_init_data(telegram_id):
    """
    Отримання всіх необхідних даних користувача для початкової ініціалізації.
    Заміняє кілька окремих запитів одним об'єднаним.

    Args:
        telegram_id (str): Telegram ID користувача

    Returns:
        Response: HTTP відповідь з даними ініціалізації
    """
    # Валідація вхідних даних
    telegram_id = validate_telegram_id(telegram_id)

    # Перевірка кешу
    cached_init_data = get_cached_user_data("init", telegram_id)
    if cached_init_data:
        logger.info(f"Повернення кешованих даних ініціалізації для {telegram_id}")
        return jsonify({"status": "success", "data": cached_init_data, "source": "cache"})

    # Отримання даних користувача
    user = get_user(telegram_id)
    if not user:
        return jsonify({"status": "error", "message": "Користувача не знайдено"}), 404

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

        # Статистика розіграшів
        "raffle_stats": {
            "participations_count": user.get("participations_count", 0),
            "wins_count": user.get("wins_count", 0)
        },

        # Дані про бейджі
        "badges": {
            "winner_completed": user.get("badge_winner", False),
            "beginner_completed": user.get("badge_beginner", False),
            "rich_completed": user.get("badge_rich", False)
        },

        # Дані про бонуси
        "newbie_bonus_claimed": user.get("newbie_bonus_claimed", False)
    }

    # Отримуємо дані стейкінгу
    try:
        from staking import get_user_staking
        staking_response, _ = get_user_staking(telegram_id)
        staking_data = staking_response.json.get('data') if hasattr(staking_response, 'json') else None
        init_data["staking_data"] = staking_data
    except Exception as e:
        logger.debug(f"Помилка отримання даних стейкінгу: {str(e)}")
        init_data["staking_data"] = None

    # Збираємо кількість активних розіграшів (для інформації)
    try:
        from raffles.controllers import get_active_raffles
        active_raffles_response = get_active_raffles()
        active_raffles = active_raffles_response.json.get('data', []) if hasattr(active_raffles_response,
                                                                                 'json') else []
        init_data["active_raffles_count"] = len(active_raffles)
    except Exception as e:
        logger.debug(f"Помилка отримання активних розіграшів: {str(e)}")
        init_data["active_raffles_count"] = 0

    # Кешування отриманих даних
    cache_user_data("init", telegram_id, init_data, USER_CACHE_TTL)

    logger.info(f"Успішно отримано дані ініціалізації для користувача {telegram_id}")
    return jsonify({"status": "success", "data": init_data})


@handle_exceptions
def get_user_balance(telegram_id):
    """
    Отримання балансу користувача.

    Args:
        telegram_id (str): Telegram ID користувача

    Returns:
        Response: HTTP відповідь з балансом користувача
    """
    # Валідація вхідних даних
    telegram_id = validate_telegram_id(telegram_id)

    # Перевірка кешу
    cached_balance = get_cached_user_data("balance", telegram_id)
    if cached_balance:
        logger.info(f"Повернення кешованих даних балансу для {telegram_id}")
        return jsonify({"status": "success", "data": cached_balance, "source": "cache"})

    # Отримання даних користувача
    user = get_user(telegram_id)
    if not user:
        logger.warning(f"Користувача {telegram_id} не знайдено")
        return jsonify({"status": "error", "message": "Користувача не знайдено"}), 404

    # Формування даних балансу
    balance_data = {
        "balance": float(user.get("balance", 0)),
        "coins": int(user.get("coins", 0))
    }

    # Кешування отриманих даних
    cache_user_data("balance", telegram_id, balance_data, BALANCE_CACHE_TTL)

    return jsonify({"status": "success", "data": balance_data})


@handle_exceptions
def update_user_balance(telegram_id, data):
    """
    Оновлення балансу користувача.

    Args:
        telegram_id (str): Telegram ID користувача
        data (dict): Дані для оновлення балансу

    Returns:
        Response: HTTP відповідь з результатом оновлення
    """
    # Валідація вхідних даних
    telegram_id = validate_telegram_id(telegram_id)

    if not data or 'balance' not in data:
        return jsonify({"status": "error", "message": "Відсутні дані балансу"}), 400

    try:
        new_balance = float(data['balance'])
    except (ValueError, TypeError):
        return jsonify({"status": "error", "message": "Невалідне значення балансу"}), 400

    # Отримання даних користувача
    user = get_user(telegram_id)
    if not user:
        logger.warning(f"Користувача {telegram_id} не знайдено")
        return jsonify({"status": "error", "message": "Користувача не знайдено"}), 404

    # Оновлення балансу
    result = update_user(telegram_id, {"balance": new_balance})
    if not result:
        return jsonify({"status": "error", "message": "Помилка оновлення балансу"}), 500

    # Інвалідація кешу після оновлення
    cache_user_data("balance", telegram_id, {"balance": new_balance, "coins": int(user.get("coins", 0))}, 0)
    cache_user_data("profile", telegram_id, None, 0)
    cache_user_data("init", telegram_id, None, 0)

    # Запис транзакції
    try:
        transaction_data = {
            "telegram_id": telegram_id,
            "type": "manual_update",
            "amount": new_balance - float(user.get("balance", 0)),
            "description": "Ручне оновлення балансу",
            "status": "completed",
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        supabase.table("transactions").insert(transaction_data).execute()
    except Exception as e:
        logger.warning(f"Помилка створення запису транзакції: {str(e)}")

    return jsonify({"status": "success", "data": {"balance": new_balance}})


@handle_exceptions
def claim_badge_reward(telegram_id, data):
    """
    Отримання нагороди за бейдж.

    Args:
        telegram_id (str): Telegram ID користувача
        data (dict): Дані з ідентифікатором бейджа

    Returns:
        Response: HTTP відповідь з результатом отримання нагороди
    """
    # Валідація вхідних даних
    telegram_id = validate_telegram_id(telegram_id)

    if not data or 'badge_id' not in data:
        return jsonify({"status": "error", "message": "Відсутній ідентифікатор бейджа"}), 400

    badge_id = data['badge_id']

    # Валідація ID бейджа
    valid_badge_ids = ["winner", "beginner", "rich"]
    if badge_id not in valid_badge_ids:
        return jsonify({"status": "error", "message": "Невідомий бейдж"}), 400

    # Отримання даних користувача
    user = get_user(telegram_id)
    if not user:
        return jsonify({"status": "error", "message": "Користувача не знайдено"}), 404

    # Перевірка чи користувач має бейдж
    badge_field = f"badge_{badge_id}"
    reward_field = f"badge_{badge_id}_reward_claimed"

    if not user.get(badge_field, False):
        return jsonify({"status": "error", "message": "Умови отримання бейджа не виконані"}), 400

    if user.get(reward_field, False):
        return jsonify({"status": "already_claimed", "message": "Нагороду за цей бейдж вже отримано"}), 200

    # Визначення розміру нагороди
    reward_amounts = {
        "winner": 2500,
        "beginner": 1000,
        "rich": 5000
    }

    reward_amount = reward_amounts.get(badge_id, 0)
    current_balance = float(user.get("balance", 0))
    new_balance = current_balance + reward_amount

    # Оновлення балансу та статусу нагороди
    updates = {
        "balance": new_balance,
        reward_field: True
    }

    try:
        # Оновлення в базі даних
        supabase.table("winix").update(updates).eq("telegram_id", telegram_id).execute()

        # Запис транзакції
        transaction = {
            "telegram_id": telegram_id,
            "type": "reward",
            "amount": reward_amount,
            "description": f"Нагорода за бейдж '{badge_id}'",
            "status": "completed",
            "created_at": datetime.now(timezone.utc).isoformat()
        }

        supabase.table("transactions").insert(transaction).execute()

        # Інвалідація кешу після оновлення
        cache_user_data("balance", telegram_id, None, 0)
        cache_user_data("profile", telegram_id, None, 0)
        cache_user_data("init", telegram_id, None, 0)

    except Exception as e:
        logger.error(f"Помилка при оновленні бази даних: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500

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
    Отримання бонусу новачка.

    Args:
        telegram_id (str): Telegram ID користувача

    Returns:
        Response: HTTP відповідь з результатом отримання бонусу
    """
    # Валідація вхідних даних
    telegram_id = validate_telegram_id(telegram_id)

    # Отримання даних користувача
    user = get_user(telegram_id)
    if not user:
        return jsonify({'status': 'error', 'message': 'Користувача не знайдено'}), 404

    # Перевірка чи бонус вже отримано
    if user.get('newbie_bonus_claimed', False):
        return jsonify({
            'status': 'already_claimed',
            'message': 'Бонус новачка вже було отримано'
        })

    # Визначення розміру бонусу
    bonus_amount = 150
    current_balance = float(user.get('balance', 0))
    new_balance = current_balance + bonus_amount

    try:
        # Оновлення балансу та статусу бонусу
        updated_user = update_user(telegram_id, {
            'balance': new_balance,
            'newbie_bonus_claimed': True
        })

        if updated_user:
            # Запис транзакції
            transaction = {
                "telegram_id": telegram_id,
                "type": "reward",
                "amount": bonus_amount,
                "description": "Бонус новачка",
                "status": "completed",
                "created_at": datetime.now(timezone.utc).isoformat()
            }

            supabase.table("transactions").insert(transaction).execute()

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
        else:
            return jsonify({
                'status': 'error',
                'message': 'Помилка нарахування бонусу'
            }), 500
    except Exception as e:
        logger.error(f"Помилка нарахування бонусу: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


@handle_exceptions
def get_user_settings(telegram_id):
    """
    Отримання налаштувань користувача.

    Args:
        telegram_id (str): Telegram ID користувача

    Returns:
        Response: HTTP відповідь з налаштуваннями користувача
    """
    # Валідація вхідних даних
    telegram_id = validate_telegram_id(telegram_id)

    # Перевірка кешу
    cached_settings = get_cached_user_data("settings", telegram_id)
    if cached_settings:
        logger.info(f"Повернення кешованих налаштувань для {telegram_id}")
        return jsonify({"status": "success", "data": cached_settings, "source": "cache"})

    # Отримання даних користувача
    user = get_user(telegram_id)
    if not user:
        return jsonify({"status": "error", "message": "Користувача не знайдено"}), 404

    # Формування даних налаштувань
    settings = {
        "username": user.get("username", "WINIX User"),
        "avatar_id": user.get("avatar_id"),
        "avatar_url": user.get("avatar_url"),
        "language": user.get("language", "uk"),
        "password_hash": user.get("password_hash"),
        "notifications_enabled": user.get("notifications_enabled", True)
    }

    # Кешування отриманих даних
    cache_user_data("settings", telegram_id, settings, USER_CACHE_TTL)

    return jsonify({"status": "success", "data": settings})


@handle_exceptions
def update_user_settings(telegram_id, data):
    """
    Оновлення налаштувань користувача.

    Args:
        telegram_id (str): Telegram ID користувача
        data (dict): Дані для оновлення налаштувань

    Returns:
        Response: HTTP відповідь з результатом оновлення
    """
    # Валідація вхідних даних
    telegram_id = validate_telegram_id(telegram_id)

    if not data:
        return jsonify({"status": "error", "message": "Відсутні дані налаштувань"}), 400

    # Отримання даних користувача
    user = get_user(telegram_id)
    if not user:
        return jsonify({"status": "error", "message": "Користувача не знайдено"}), 404

    # Валідація та фільтрація полів для оновлення
    allowed_fields = ["username", "avatar_id", "avatar_url", "language", "notifications_enabled"]
    updates = {k: v for k, v in data.items() if k in allowed_fields}

    if not updates:
        return jsonify({"status": "error", "message": "Відсутні валідні поля для оновлення"}), 400

    try:
        # Оновлення налаштувань
        updated_user = update_user(telegram_id, updates)
        if not updated_user:
            return jsonify({"status": "error", "message": "Помилка оновлення налаштувань"}), 500

        # Інвалідація кешу після оновлення
        cache_user_data("settings", telegram_id, None, 0)
        cache_user_data("profile", telegram_id, None, 0)
        cache_user_data("init", telegram_id, None, 0)

        return jsonify({"status": "success", "message": "Налаштування успішно оновлено"})
    except Exception as e:
        logger.error(f"Помилка оновлення налаштувань: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500


@handle_exceptions
def update_user_password(telegram_id, data):
    """
    Оновлення пароля користувача.

    Args:
        telegram_id (str): Telegram ID користувача
        data (dict): Дані з хешем пароля

    Returns:
        Response: HTTP відповідь з результатом оновлення
    """
    # Валідація вхідних даних
    telegram_id = validate_telegram_id(telegram_id)

    if not data or "password_hash" not in data:
        return jsonify({"status": "error", "message": "Відсутній хеш пароля"}), 400

    # Валідація хешу пароля
    password_hash = data["password_hash"]
    if not password_hash or len(password_hash) < 8:
        return jsonify({"status": "error", "message": "Невалідний хеш пароля"}), 400

    # Отримання даних користувача
    user = get_user(telegram_id)
    if not user:
        return jsonify({"status": "error", "message": "Користувача не знайдено"}), 404

    try:
        # Оновлення пароля
        updated_user = update_user(telegram_id, {"password_hash": password_hash})
        if not updated_user:
            return jsonify({"status": "error", "message": "Помилка оновлення пароля"}), 500

        # Інвалідація кешу налаштувань
        cache_user_data("settings", telegram_id, None, 0)

        return jsonify({"status": "success", "message": "Пароль успішно оновлено"})
    except Exception as e:
        logger.error(f"Помилка оновлення пароля: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500


@handle_exceptions
def get_user_seed_phrase(telegram_id):
    """
    Отримання seed-фрази користувача.

    Args:
        telegram_id (str): Telegram ID користувача

    Returns:
        Response: HTTP відповідь з seed-фразою користувача
    """
    # Валідація вхідних даних
    telegram_id = validate_telegram_id(telegram_id)

    # Отримання даних користувача
    user = get_user(telegram_id)
    if not user:
        return jsonify({"status": "error", "message": "Користувача не знайдено"}), 404

    # Отримання або генерація seed-фрази
    seed_phrase = user.get("seed_phrase")

    if not seed_phrase:
        try:
            # Список слів для seed-фрази
            seed_words = [
                "abandon", "ability", "able", "about", "above", "absent", "absorb", "abstract", "absurd", "abuse",
                "access", "accident", "account", "accuse", "achieve", "acid", "acoustic", "acquire", "across", "act",
                "solve", "notable", "quick", "pluck", "tribe", "dinosaur", "cereal", "casino", "rail", "media",
                "final", "curve"
            ]

            # Генерація seed-фрази
            seed_value = int(telegram_id) if telegram_id.isdigit() else hash(telegram_id)
            random.seed(seed_value)
            seed_phrase = " ".join(random.sample(seed_words, 12))

            # Збереження seed-фрази
            update_user(telegram_id, {"seed_phrase": seed_phrase})
        except Exception as e:
            logger.error(f"Помилка генерації seed-фрази: {str(e)}")
            seed_phrase = "Seed фраза недоступна"

    return jsonify({
        "status": "success",
        "data": {
            "seed_phrase": seed_phrase
        }
    })


# ====== ДОДАТКОВІ КОНТРОЛЕРИ ======

@handle_exceptions
def get_user_transactions(telegram_id, limit=50, offset=0):
    """
    Отримання історії транзакцій користувача.

    Args:
        telegram_id (str): Telegram ID користувача
        limit (int): Ліміт кількості транзакцій
        offset (int): Зміщення для пагінації

    Returns:
        Response: HTTP відповідь з історією транзакцій
    """
    # Валідація вхідних даних
    telegram_id = validate_telegram_id(telegram_id)

    # Валідація параметрів пагінації
    try:
        limit = min(int(limit), 100)  # Максимум 100 транзакцій за запит
        offset = max(int(offset), 0)  # Мінімум 0
    except (ValueError, TypeError):
        return jsonify({"status": "error", "message": "Невалідні параметри пагінації"}), 400

    # Перевірка кешу
    cache_key = f"transactions_{telegram_id}_{limit}_{offset}"
    cached_transactions = cache_get(cache_key)
    if cached_transactions:
        logger.info(f"Повернення кешованих транзакцій для {telegram_id}")
        return jsonify({"status": "success", "data": cached_transactions, "source": "cache"})

    # Отримання даних користувача
    user = get_user(telegram_id)
    if not user:
        return jsonify({"status": "error", "message": "Користувача не знайдено"}), 404

    try:
        # Отримання транзакцій
        response = supabase.table("transactions") \
            .select("*") \
            .eq("telegram_id", telegram_id) \
            .order("created_at", desc=True) \
            .limit(limit) \
            .offset(offset) \
            .execute()

        # Формування даних транзакцій
        transactions = []
        for transaction in response.data:
            # Форматуємо дату
            created_at = transaction.get("created_at")
            if created_at:
                try:
                    # Перетворюємо ISO формат у читабельний
                    dt = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                    formatted_date = dt.strftime("%d.%m.%Y %H:%M")
                    transaction["formatted_date"] = formatted_date
                except (ValueError, TypeError):
                    transaction["formatted_date"] = created_at

            transactions.append(transaction)

        # Кешування отриманих даних
        cache_set(cache_key, transactions, 180)  # Кешування на 3 хвилини

        return jsonify({
            "status": "success",
            "data": transactions,
            "pagination": {
                "total": len(transactions),
                "limit": limit,
                "offset": offset
            }
        })
    except Exception as e:
        logger.error(f"Помилка отримання транзакцій: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500


@handle_exceptions
def update_user_coins(telegram_id, data):
    """
    Оновлення кількості жетонів користувача.

    Args:
        telegram_id (str): Telegram ID користувача
        data (dict): Дані для оновлення жетонів

    Returns:
        Response: HTTP відповідь з результатом оновлення
    """
    # Валідація вхідних даних
    telegram_id = validate_telegram_id(telegram_id)

    if not data or 'coins' not in data:
        return jsonify({"status": "error", "message": "Відсутні дані жетонів"}), 400

    try:
        new_coins = int(data['coins'])
        if new_coins < 0:
            return jsonify({"status": "error", "message": "Кількість жетонів не може бути від'ємною"}), 400
    except (ValueError, TypeError):
        return jsonify({"status": "error", "message": "Невалідне значення жетонів"}), 400

    # Отримання даних користувача
    user = get_user(telegram_id)
    if not user:
        return jsonify({"status": "error", "message": "Користувача не знайдено"}), 404

    # Оновлення жетонів
    current_coins = int(user.get("coins", 0))
    result = update_coins(telegram_id, new_coins - current_coins)
    if not result:
        return jsonify({"status": "error", "message": "Помилка оновлення жетонів"}), 500

    # Інвалідація кешу після оновлення
    cache_user_data("balance", telegram_id, None, 0)
    cache_user_data("profile", telegram_id, None, 0)
    cache_user_data("init", telegram_id, None, 0)

    return jsonify({
        "status": "success",
        "data": {
            "coins": new_coins,
            "change": new_coins - current_coins
        }
    })


@handle_exceptions
def add_user_coins(telegram_id, data):
    """
    Додавання жетонів користувачу.

    Args:
        telegram_id (str): Telegram ID користувача
        data (dict): Дані з кількістю жетонів для додавання

    Returns:
        Response: HTTP відповідь з результатом додавання
    """
    # Валідація вхідних даних
    telegram_id = validate_telegram_id(telegram_id)

    if not data or 'amount' not in data:
        return jsonify({"status": "error", "message": "Відсутня кількість жетонів для додавання"}), 400

    try:
        amount = int(data['amount'])
    except (ValueError, TypeError):
        return jsonify({"status": "error", "message": "Невалідне значення кількості жетонів"}), 400

    # Валідація опису транзакції
    description = data.get('description', 'Додавання жетонів')

    # Отримання даних користувача
    user = get_user(telegram_id)
    if not user:
        return jsonify({"status": "error", "message": "Користувача не знайдено"}), 404

    # Оновлення жетонів
    result = update_coins(telegram_id, amount)
    if not result:
        return jsonify({"status": "error", "message": "Помилка додавання жетонів"}), 500

    # Інвалідація кешу після оновлення
    cache_user_data("balance", telegram_id, None, 0)
    cache_user_data("profile", telegram_id, None, 0)
    cache_user_data("init", telegram_id, None, 0)

    return jsonify({
        "status": "success",
        "message": f"Додано {amount} жетонів",
        "data": {
            "coins": result.get("coins", 0),
            "added": amount
        }
    })


@handle_exceptions
def create_user_profile(telegram_id, username, referrer_id=None):
    """
    Створення профілю користувача з повними даними (для Telegram бота).

    Args:
        telegram_id (str): Telegram ID користувача
        username (str): Ім'я користувача
        referrer_id (str, optional): ID реферала, який запросив користувача

    Returns:
        dict: Результат створення з повними даними користувача
    """
    telegram_id = validate_telegram_id(telegram_id)

    # Перевіряємо, чи вже існує користувач
    existing_user = get_user(telegram_id)
    if existing_user:
        logger.info(f"Користувач з ID {telegram_id} вже існує")

        # Повертаємо дані існуючого користувача
        return {
            "status": "exists",
            "message": "Користувач вже існує",
            "data": {
                "telegram_id": existing_user["telegram_id"],
                "username": existing_user.get("username", username),
                "balance": float(existing_user.get("balance", 0)),
                "coins": int(existing_user.get("coins", 0)),
                "created_at": existing_user.get("created_at"),
                "referrer_id": existing_user.get("referrer_id")
            }
        }

    # Створюємо нового користувача через функцію з supabase_client
    user = create_user(telegram_id, username, referrer_id)

    if not user:
        logger.error(f"Помилка створення користувача з ID {telegram_id}")
        return {
            "status": "error",
            "message": f"Не вдалося створити користувача з ID {telegram_id}"
        }

    # Формуємо повні дані користувача для відповіді
    user_data = {
        "telegram_id": user["telegram_id"],
        "username": user.get("username", username),
        "balance": float(user.get("balance", 0)),
        "coins": int(user.get("coins", 0)),
        "created_at": user.get("created_at"),
        "referrer_id": user.get("referrer_id"),
        "newbie_bonus_claimed": user.get("newbie_bonus_claimed", False),
        "participations_count": user.get("participations_count", 0),
        "wins_count": user.get("wins_count", 0),
        "badges": {
            "winner_completed": user.get("badge_winner", False),
            "beginner_completed": user.get("badge_beginner", False),
            "rich_completed": user.get("badge_rich", False)
        }
    }

    logger.info(f"Успішно створено нового користувача з ID {telegram_id}")

    return {
        "status": "success",
        "message": "Користувача успішно створено",
        "data": user_data
    }