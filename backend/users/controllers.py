"""
Модуль контролерів для роботи з користувачами WINIX.
ВИПРАВЛЕНА версія БЕЗ fallback плутанини та з правильною обробкою помилок.
"""

import logging
import os
import sys
import re
from datetime import datetime, timezone
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

# Імпорти Supabase (обов'язкові)
try:
    from supabase_client import (
        get_user, create_user, update_user, update_balance, update_coins,
        check_and_update_badges, cache_get, cache_set, supabase, invalidate_cache_for_entity
    )
    SUPABASE_AVAILABLE = True
    logger.info("✅ Supabase client та утиліти завантажено")
except ImportError as e:
    logger.error(f"❌ КРИТИЧНА ПОМИЛКА: Supabase client недоступний: {e}")
    raise ImportError("Supabase client є обов'язковим для роботи системи")

# ====== КОНСТАНТИ ======

# Regex для валідації
USER_ID_PATTERN = re.compile(r'^\d{1,12}$')

# Константи для кешування
USER_CACHE_TTL = 300  # 5 хвилин для кешу користувача
PROFILE_CACHE_TTL = 180  # 3 хвилини для кешу профілю
BALANCE_CACHE_TTL = 120  # 2 хвилини для кешу балансу

# ====== ВАЛІДАЦІЯ ======

def validate_telegram_id(telegram_id):
    """
    СТРОГА валідація Telegram ID користувача

    Args:
        telegram_id: Telegram ID для перевірки

    Returns:
        str: Коректний Telegram ID

    Raises:
        ValueError: Якщо ID невалідний
    """
    if telegram_id is None:
        raise ValueError("Telegram ID не може бути None")

    # Конвертуємо в строку та очищуємо
    telegram_id = str(telegram_id).strip()

    if not telegram_id:
        raise ValueError("Telegram ID не може бути порожнім")

    # Перевіряємо на заборонені значення
    forbidden_values = {'undefined', 'null', 'none', '0', ''}
    if telegram_id.lower() in forbidden_values:
        raise ValueError(f"Недозволене значення Telegram ID: {telegram_id}")

    # Перевіряємо формат
    if not USER_ID_PATTERN.match(telegram_id):
        raise ValueError(f"Невалідний формат Telegram ID: {telegram_id}")

    try:
        telegram_id_int = int(telegram_id)
        if telegram_id_int <= 0:
            raise ValueError("Telegram ID має бути додатним числом")
        if telegram_id_int > 999999999999:
            raise ValueError("Telegram ID занадто великий")
    except ValueError as e:
        if "invalid literal" in str(e):
            raise ValueError(f"Telegram ID містить недопустимі символи: {telegram_id}")
        raise

    return telegram_id


def validate_balance(balance):
    """
    Валідація балансу

    Args:
        balance: Значення балансу

    Returns:
        float: Валідний баланс

    Raises:
        ValueError: Якщо баланс невалідний
    """
    try:
        balance_float = float(balance)
        if balance_float < 0:
            raise ValueError("Баланс не може бути від'ємним")
        if balance_float > 999999999:  # Розумна межа
            raise ValueError("Баланс занадто великий")
        return balance_float
    except (TypeError, ValueError) as e:
        if "could not convert" in str(e) or "invalid literal" in str(e):
            raise ValueError(f"Невалідне значення балансу: {balance}")
        raise


def validate_coins(coins):
    """
    Валідація кількості монет

    Args:
        coins: Кількість монет

    Returns:
        int: Валідна кількість монет

    Raises:
        ValueError: Якщо кількість невалідна
    """
    try:
        coins_int = int(coins)
        if coins_int < 0:
            raise ValueError("Кількість монет не може бути від'ємною")
        if coins_int > 999999999:  # Розумна межа
            raise ValueError("Кількість монет занадто велика")
        return coins_int
    except (TypeError, ValueError) as e:
        if "could not convert" in str(e) or "invalid literal" in str(e):
            raise ValueError(f"Невалідна кількість монет: {coins}")
        raise


# ====== ДОПОМІЖНІ ФУНКЦІЇ ======

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
    Кешування даних користувача з префіксом для різних типів даних

    Args:
        key_prefix: Префікс ключа кешу
        telegram_id: ID користувача
        data: Дані для кешування
        ttl: Час життя кешу

    Returns:
        bool: True якщо успішно
    """
    if not cache_set:
        return False

    cache_key = f"{key_prefix}_{telegram_id}"
    return safe_cache_operation(cache_set, cache_key, data, ttl)


def get_cached_user_data(key_prefix, telegram_id):
    """
    Отримання кешованих даних користувача

    Args:
        key_prefix: Префікс ключа кешу
        telegram_id: ID користувача

    Returns:
        Кешовані дані або None
    """
    if not cache_get:
        return None

    cache_key = f"{key_prefix}_{telegram_id}"
    return safe_cache_operation(cache_get, cache_key)


# ====== КОНТРОЛЕРИ КОРИСТУВАЧА ======

def get_user_info(telegram_id):
    """
    Отримання базової інформації користувача БЕЗ fallback механізмів

    Args:
        telegram_id (str): Telegram ID користувача

    Returns:
        dict: Дані користувача або None якщо не знайдено

    Raises:
        ValueError: При невалідному ID
        ConnectionError: При проблемах з БД
    """
    # Строга валідація
    telegram_id = validate_telegram_id(telegram_id)

    if not get_user:
        raise ConnectionError("Функція get_user недоступна")

    try:
        user = get_user(telegram_id)

        if user:
            logger.info(f"✅ Користувач {telegram_id} знайдений")
            return user
        else:
            logger.info(f"ℹ️ Користувач {telegram_id} не знайдений")
            return None

    except Exception as e:
        logger.error(f"❌ Помилка отримання користувача {telegram_id}: {str(e)}")
        raise ConnectionError(f"Не вдалося отримати дані користувача: {e}")


def create_new_user(telegram_id, username, referrer_id=None):
    """
    Створення нового користувача БЕЗ fallback механізмів

    Args:
        telegram_id (str): Telegram ID користувача
        username (str): Ім'я користувача
        referrer_id (str, optional): ID реферала

    Returns:
        dict: Дані створеного користувача

    Raises:
        ValueError: При невалідних даних
        ConnectionError: При проблемах з БД
    """
    # Строга валідація
    telegram_id = validate_telegram_id(telegram_id)

    if not username or len(str(username).strip()) == 0:
        username = f"User_{telegram_id[-4:]}"

    if referrer_id:
        referrer_id = validate_telegram_id(referrer_id)
        if referrer_id == telegram_id:
            raise ValueError("Користувач не може бути рефералом самого себе")

    # Перевіряємо, чи вже існує користувач
    existing_user = get_user_info(telegram_id)
    if existing_user:
        logger.info(f"create_new_user: Користувач з ID {telegram_id} вже існує")
        existing_user['is_new_user'] = False
        return existing_user

    if not create_user:
        raise ConnectionError("Функція create_user недоступна")

    try:
        # Створюємо нового користувача
        user = create_user(telegram_id, username, referrer_id)

        if not user:
            raise ConnectionError("Порожня відповідь від create_user")

        user['is_new_user'] = True

        # Перевіряємо та оновлюємо бейджі (не критично)
        try:
            if check_and_update_badges:
                safe_cache_operation(check_and_update_badges, telegram_id)
        except Exception as e:
            logger.warning(f"create_new_user: Помилка оновлення бейджів: {str(e)}")

        # Інвалідуємо кеш для реферера (не критично)
        if referrer_id:
            logger.info(f"create_new_user: Користувач {telegram_id} створений з реферером {referrer_id}")
            try:
                if invalidate_cache_for_entity:
                    safe_cache_operation(invalidate_cache_for_entity, referrer_id)
            except Exception as e:
                logger.warning(f"create_new_user: Помилка інвалідації кешу: {str(e)}")

        logger.info(f"✅ create_new_user: Успішно створено нового користувача з ID {telegram_id}")
        return user

    except Exception as e:
        logger.error(f"❌ create_new_user: Помилка створення користувача {telegram_id}: {str(e)}")
        raise ConnectionError(f"Не вдалося створити користувача: {e}")


def get_user_profile(telegram_id):
    """
    Отримання повного профілю користувача

    Args:
        telegram_id (str): Telegram ID користувача

    Returns:
        Response: HTTP відповідь з даними користувача
    """
    try:
        # Валідація вхідних даних
        telegram_id = validate_telegram_id(telegram_id)

        # Перевірка кешу
        cached_profile = get_cached_user_data("profile", telegram_id)
        if cached_profile:
            logger.info(f"Повернення кешованих даних профілю для {telegram_id}")
            return jsonify({"status": "success", "data": cached_profile, "source": "cache"})

        # Отримання даних користувача
        user = get_user_info(telegram_id)
        if not user:
            return jsonify({
                "status": "error",
                "message": "Користувач не знайдений",
                "code": "user_not_found"
            }), 404

        # Отримання даних стейкінгу (не критично)
        staking_data = None
        try:
            from staking import get_user_staking
            staking_response, _ = get_user_staking(telegram_id)
            staking_data = staking_response.json.get('data') if hasattr(staking_response, 'json') else None
        except Exception as e:
            logger.warning(f"Помилка отримання даних стейкінгу: {str(e)}")

        # Отримання даних реферальної системи (не критично)
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

        # Кешування отриманих даних
        cache_user_data("profile", telegram_id, user_data, PROFILE_CACHE_TTL)

        return jsonify({"status": "success", "data": user_data})

    except ValueError as e:
        logger.warning(f"Валідаційна помилка в get_user_profile: {str(e)}")
        return jsonify({
            "status": "error",
            "message": str(e),
            "code": "validation_error"
        }), 400

    except ConnectionError as e:
        logger.error(f"Помилка підключення в get_user_profile: {str(e)}")
        return jsonify({
            "status": "error",
            "message": "Тимчасові проблеми з сервером. Спробуйте пізніше.",
            "code": "connection_error"
        }), 503

    except Exception as e:
        logger.error(f"Непередбачена помилка в get_user_profile: {str(e)}", exc_info=True)
        return jsonify({
            "status": "error",
            "message": "Внутрішня помилка сервера",
            "code": "internal_error"
        }), 500


def get_user_balance(telegram_id):
    """
    Отримання балансу користувача

    Args:
        telegram_id (str): Telegram ID користувача

    Returns:
        Response: HTTP відповідь з балансом користувача
    """
    try:
        # Валідація вхідних даних
        telegram_id = validate_telegram_id(telegram_id)

        # Перевірка кешу
        cached_balance = get_cached_user_data("balance", telegram_id)
        if cached_balance:
            logger.info(f"Повернення кешованих даних балансу для {telegram_id}")
            return jsonify({"status": "success", "data": cached_balance, "source": "cache"})

        # Отримання даних користувача
        user = get_user_info(telegram_id)
        if not user:
            return jsonify({
                "status": "error",
                "message": "Користувач не знайдений",
                "code": "user_not_found"
            }), 404

        # Формування даних балансу
        balance_data = {
            "balance": float(user.get("balance", 0)),
            "coins": int(user.get("coins", 0))
        }

        # Кешування отриманих даних
        cache_user_data("balance", telegram_id, balance_data, BALANCE_CACHE_TTL)

        return jsonify({"status": "success", "data": balance_data})

    except ValueError as e:
        logger.warning(f"Валідаційна помилка в get_user_balance: {str(e)}")
        return jsonify({
            "status": "error",
            "message": str(e),
            "code": "validation_error"
        }), 400

    except ConnectionError as e:
        logger.error(f"Помилка підключення в get_user_balance: {str(e)}")
        return jsonify({
            "status": "error",
            "message": "Тимчасові проблеми з сервером. Спробуйте пізніше.",
            "code": "connection_error"
        }), 503

    except Exception as e:
        logger.error(f"Непередбачена помилка в get_user_balance: {str(e)}", exc_info=True)
        return jsonify({
            "status": "error",
            "message": "Внутрішня помилка сервера",
            "code": "internal_error"
        }), 500


def update_user_balance(telegram_id, data):
    """
    Оновлення балансу користувача

    Args:
        telegram_id (str): Telegram ID користувача
        data (dict): Дані для оновлення балансу

    Returns:
        Response: HTTP відповідь з результатом оновлення
    """
    try:
        # Валідація вхідних даних
        telegram_id = validate_telegram_id(telegram_id)

        if not isinstance(data, dict) or 'balance' not in data:
            return jsonify({
                "status": "error",
                "message": "Відсутні дані балансу",
                "code": "missing_balance_data"
            }), 400

        new_balance = validate_balance(data['balance'])

        # Перевіряємо існування користувача
        user = get_user_info(telegram_id)
        if not user:
            return jsonify({
                "status": "error",
                "message": "Користувач не знайдений",
                "code": "user_not_found"
            }), 404

        # Оновлення балансу
        if not update_user:
            raise ConnectionError("Функція update_user недоступна")

        result = update_user(telegram_id, {"balance": new_balance})
        if not result:
            raise ConnectionError("Не вдалося оновити баланс")

        # Інвалідація кешу після оновлення
        cache_user_data("balance", telegram_id, None, 0)
        cache_user_data("profile", telegram_id, None, 0)

        # Запис транзакції (не критично)
        try:
            if supabase:
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

    except ValueError as e:
        logger.warning(f"Валідаційна помилка в update_user_balance: {str(e)}")
        return jsonify({
            "status": "error",
            "message": str(e),
            "code": "validation_error"
        }), 400

    except ConnectionError as e:
        logger.error(f"Помилка підключення в update_user_balance: {str(e)}")
        return jsonify({
            "status": "error",
            "message": "Тимчасові проблеми з сервером. Спробуйте пізніше.",
            "code": "connection_error"
        }), 503

    except Exception as e:
        logger.error(f"Непередбачена помилка в update_user_balance: {str(e)}", exc_info=True)
        return jsonify({
            "status": "error",
            "message": "Внутрішня помилка сервера",
            "code": "internal_error"
        }), 500


def claim_badge_reward(telegram_id, data):
    """
    Отримання нагороди за бейдж

    Args:
        telegram_id (str): Telegram ID користувача
        data (dict): Дані запиту з badge_id

    Returns:
        Response: HTTP відповідь з результатом
    """
    try:
        # Валідація вхідних даних
        telegram_id = validate_telegram_id(telegram_id)

        if not isinstance(data, dict) or 'badge_id' not in data:
            return jsonify({
                "status": "error",
                "message": "Відсутній ідентифікатор бейджа",
                "code": "missing_badge_id"
            }), 400

        badge_id = data['badge_id']
        valid_badge_ids = ["winner", "beginner", "rich"]
        if badge_id not in valid_badge_ids:
            return jsonify({
                "status": "error",
                "message": "Невідомий бейдж",
                "code": "invalid_badge_id"
            }), 400

        # Отримуємо дані користувача
        user = get_user_info(telegram_id)
        if not user:
            return jsonify({
                "status": "error",
                "message": "Користувач не знайдений",
                "code": "user_not_found"
            }), 404

        badge_field = f"badge_{badge_id}"
        reward_field = f"badge_{badge_id}_reward_claimed"

        if not user.get(badge_field, False):
            return jsonify({
                "status": "error",
                "message": "Умови отримання бейджа не виконані",
                "code": "badge_not_earned"
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

        # Оновлення в базі даних
        if not supabase:
            raise ConnectionError("Supabase недоступний")

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

        return jsonify({
            "status": "success",
            "message": f"Нагороду в розмірі {reward_amount} WINIX за бейдж успішно отримано",
            "data": {
                "badge_id": badge_id,
                "reward_amount": reward_amount,
                "new_balance": new_balance
            }
        })

    except ValueError as e:
        logger.warning(f"Валідаційна помилка в claim_badge_reward: {str(e)}")
        return jsonify({
            "status": "error",
            "message": str(e),
            "code": "validation_error"
        }), 400

    except ConnectionError as e:
        logger.error(f"Помилка підключення в claim_badge_reward: {str(e)}")
        return jsonify({
            "status": "error",
            "message": "Тимчасові проблеми з сервером. Спробуйте пізніше.",
            "code": "connection_error"
        }), 503

    except Exception as e:
        logger.error(f"Непередбачена помилка в claim_badge_reward: {str(e)}", exc_info=True)
        return jsonify({
            "status": "error",
            "message": "Внутрішня помилка сервера",
            "code": "internal_error"
        }), 500


def claim_newbie_bonus(telegram_id):
    """
    Отримання бонусу новачка

    Args:
        telegram_id (str): Telegram ID користувача

    Returns:
        Response: HTTP відповідь з результатом
    """
    try:
        # Валідація вхідних даних
        telegram_id = validate_telegram_id(telegram_id)

        # Отримуємо дані користувача
        user = get_user_info(telegram_id)
        if not user:
            return jsonify({
                "status": "error",
                "message": "Користувач не знайдений",
                "code": "user_not_found"
            }), 404

        if user.get('newbie_bonus_claimed', False):
            return jsonify({
                'status': 'already_claimed',
                'message': 'Бонус новачка вже було отримано'
            })

        bonus_amount = 150
        current_balance = float(user.get('balance', 0))
        new_balance = current_balance + bonus_amount

        # Оновлення балансу та статусу бонусу
        if not update_user:
            raise ConnectionError("Функція update_user недоступна")

        updated_user = update_user(telegram_id, {
            'balance': new_balance,
            'newbie_bonus_claimed': True
        })

        if not updated_user:
            raise ConnectionError("Не вдалося оновити дані користувача")

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
            supabase.table("transactions").insert(transaction).execute()

        # Інвалідація кешу після оновлення
        cache_user_data("balance", telegram_id, None, 0)
        cache_user_data("profile", telegram_id, None, 0)

        return jsonify({
            'status': 'success',
            'message': f'Ви отримали {bonus_amount} WINIX як бонус новачка!',
            'data': {
                'amount': bonus_amount,
                'newBalance': new_balance
            }
        })

    except ValueError as e:
        logger.warning(f"Валідаційна помилка в claim_newbie_bonus: {str(e)}")
        return jsonify({
            "status": "error",
            "message": str(e),
            "code": "validation_error"
        }), 400

    except ConnectionError as e:
        logger.error(f"Помилка підключення в claim_newbie_bonus: {str(e)}")
        return jsonify({
            "status": "error",
            "message": "Тимчасові проблеми з сервером. Спробуйте пізніше.",
            "code": "connection_error"
        }), 503

    except Exception as e:
        logger.error(f"Непередбачена помилка в claim_newbie_bonus: {str(e)}", exc_info=True)
        return jsonify({
            "status": "error",
            "message": "Внутрішня помилка сервера",
            "code": "internal_error"
        }), 500


# Експортуємо функції
__all__ = [
    'get_user_info',
    'create_new_user',
    'get_user_profile',
    'get_user_balance',
    'update_user_balance',
    'claim_badge_reward',
    'claim_newbie_bonus',
    'validate_telegram_id',
    'validate_balance',
    'validate_coins'
]