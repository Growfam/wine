from flask import jsonify, request, session
from supabase_client import supabase, get_user, create_user, update_user, update_balance, update_coins, \
    check_and_update_badges
from utils import get_current_time, generate_uuid
import logging
import uuid
from datetime import datetime
import time
import os
import random
import string

# Налаштування логування
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


def register_user(data):
    """Реєстрація нового користувача"""
    try:
        email = data.get('email')
        password = data.get('password')
        username = data.get('username')

        if not email or not password or not username:
            return jsonify({"success": False, "error": "Не всі поля заповнені"}), 400

        # Перевірка чи існує користувач
        existing_user = supabase.table('users').select('*').eq('email', email).execute()
        if existing_user.data:
            return jsonify({"success": False, "error": "Користувач з такою електронною поштою вже існує"}), 400

        # Реєстрація користувача через Supabase Auth
        auth_response = supabase.auth.sign_up({
            "email": email,
            "password": password,
        })

        user_id = auth_response.user.id

        # Створення запису в таблиці користувачів
        user_data = {
            "id": user_id,
            "username": username,
            "email": email,
            "wallet_address": generate_uuid(),
            "balance": 0,
            "created_at": get_current_time(),
            "last_login": get_current_time()
        }

        supabase.table('users').insert(user_data).execute()

        return jsonify({"success": True, "user": auth_response.user})

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


def login_user(data):
    """Авторизація користувача"""
    try:
        email = data.get('email')
        password = data.get('password')

        if not email or not password:
            return jsonify({"success": False, "error": "Електронна пошта та пароль обов'язкові"}), 400

        # Авторизація через Supabase Auth
        auth_response = supabase.auth.sign_in_with_password({
            "email": email,
            "password": password
        })

        user_id = auth_response.user.id

        # Оновлення часу останнього входу
        supabase.table('users').update({"last_login": get_current_time()}).eq('id', user_id).execute()

        # Встановлення сесії
        session['user_id'] = user_id

        return jsonify({"success": True, "user": auth_response.user})

    except Exception as e:
        return jsonify({"success": False, "error": str(e)}), 500


def get_user_profile(telegram_id):
    """Отримання профілю користувача з розширеними даними"""
    try:
        user = get_user(telegram_id)

        if not user:
            return jsonify({"status": "error", "message": "Користувача не знайдено"}), 404

        # Отримуємо дані стейкінгу
        staking_data = None
        try:
            from staking import get_user_staking
            staking_response, _ = get_user_staking(telegram_id)
            staking_data = staking_response.json.get('data') if hasattr(staking_response, 'json') else None
        except Exception as e:
            logger.error(f"get_user_profile: Помилка отримання даних стейкінгу: {str(e)}")

        # Оновлений формат відповіді з усіма необхідними даними
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

        return jsonify({"status": "success", "data": user_data})
    except Exception as e:
        logger.error(f"get_user_profile: Помилка отримання профілю користувача {telegram_id}: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500


def get_user_balance(telegram_id):
    """Отримання балансу користувача"""
    try:
        user = get_user(telegram_id)

        if not user:
            logger.warning(f"get_user_balance: Користувача {telegram_id} не знайдено")
            return jsonify({"status": "error", "message": "Користувача не знайдено"}), 404

        balance_data = {
            "balance": float(user.get("balance", 0)),
            "coins": int(user.get("coins", 0))
        }

        return jsonify({"status": "success", "data": balance_data})

    except Exception as e:
        logger.error(f"get_user_balance: Помилка отримання балансу користувача {telegram_id}: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500


def update_user_balance(telegram_id, data):
    """Оновлення балансу користувача"""
    try:
        if not data or 'balance' not in data:
            return jsonify({"status": "error", "message": "Відсутні дані балансу"}), 400

        new_balance = float(data['balance'])

        user = get_user(telegram_id)
        if not user:
            logger.warning(f"update_user_balance: Користувача {telegram_id} не знайдено")
            return jsonify({"status": "error", "message": "Користувача не знайдено"}), 404

        result = update_user(telegram_id, {"balance": new_balance})
        if not result:
            return jsonify({"status": "error", "message": "Помилка оновлення балансу"}), 500

        return jsonify({"status": "success", "data": {"balance": new_balance}})

    except Exception as e:
        logger.error(f"update_user_balance: Помилка оновлення балансу користувача {telegram_id}: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500


def claim_badge_reward(telegram_id, data):
    """Отримання нагороди за бейдж"""
    try:
        if not data or 'badge_id' not in data:
            return jsonify({"status": "error", "message": "Відсутній ідентифікатор бейджа"}), 400

        badge_id = data['badge_id']

        user = get_user(telegram_id)
        if not user:
            return jsonify({"status": "error", "message": "Користувача не знайдено"}), 404

        badge_field = f"badge_{badge_id}"
        reward_field = f"badge_{badge_id}_reward_claimed"

        if not user.get(badge_field, False):
            return jsonify({"status": "error", "message": "Умови отримання бейджа не виконані"}), 400

        if user.get(reward_field, False):
            return jsonify({"status": "already_claimed", "message": "Нагороду за цей бейдж вже отримано"}), 200

        reward_amounts = {
            "winner": 2500,
            "beginner": 1000,
            "rich": 5000
        }

        reward_amount = reward_amounts.get(badge_id, 0)

        if reward_amount == 0:
            return jsonify({"status": "error", "message": "Невідомий бейдж"}), 400

        current_balance = float(user.get("balance", 0))
        new_balance = current_balance + reward_amount

        updates = {
            "balance": new_balance,
            reward_field: True
        }

        try:
            supabase.table("winix").update(updates).eq("telegram_id", telegram_id).execute()

            # Додаємо транзакцію
            try:
                transaction = {
                    "telegram_id": telegram_id,
                    "type": "reward",
                    "amount": reward_amount,
                    "description": f"Нагорода за бейдж '{badge_id}'",
                    "status": "completed"
                }

                supabase.table("transactions").insert(transaction).execute()
            except Exception as e:
                logger.error(f"claim_badge_reward: Помилка при створенні транзакції: {str(e)}")
                # Не зупиняємо процес, якщо помилка при створенні транзакції
        except Exception as e:
            logger.error(f"claim_badge_reward: Помилка при оновленні бази даних: {str(e)}")
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

    except Exception as e:
        logger.error(f"claim_badge_reward: Помилка видачі нагороди за бейдж для {telegram_id}: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500


def claim_newbie_bonus(telegram_id):
    """Отримання бонусу новачка"""
    try:
        user = get_user(telegram_id)

        if not user:
            return jsonify({
                'status': 'error',
                'message': 'Користувача не знайдено'
            }), 404

        if user.get('newbie_bonus_claimed', False):
            return jsonify({
                'status': 'already_claimed',
                'message': 'Бонус новачка вже було отримано'
            })

        bonus_amount = 150
        current_balance = float(user.get('balance', 0))
        new_balance = current_balance + bonus_amount

        try:
            updated_user = update_user(telegram_id, {
                'balance': new_balance,
                'newbie_bonus_claimed': True
            })

            if updated_user:
                # Додаємо транзакцію
                try:
                    transaction = {
                        "telegram_id": telegram_id,
                        "type": "reward",
                        "amount": bonus_amount,
                        "description": "Бонус новачка",
                        "status": "completed"
                    }

                    supabase.table("transactions").insert(transaction).execute()
                except Exception as e:
                    logger.error(f"claim_newbie_bonus: Помилка при створенні транзакції: {str(e)}")
                    # Не зупиняємо процес, якщо помилка при створенні транзакції

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
            logger.error(f"claim_newbie_bonus: Помилка оновлення даних: {str(e)}")
            return jsonify({
                'status': 'error',
                'message': str(e)
            }), 500

    except Exception as e:
        logger.error(f"claim_newbie_bonus: Помилка в /api/user/{telegram_id}/claim-newbie-bonus: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


def get_user_settings(telegram_id):
    """Отримання налаштувань користувача"""
    try:
        user = get_user(telegram_id)

        if not user:
            return jsonify({"status": "error", "message": "Користувача не знайдено"}), 404

        settings = {
            "username": user.get("username", "WINIX User"),
            "avatar_id": user.get("avatar_id"),
            "avatar_url": user.get("avatar_url"),
            "language": user.get("language", "uk"),
            "password_hash": user.get("password_hash"),
            "notifications_enabled": user.get("notifications_enabled", True)
        }

        return jsonify({"status": "success", "data": settings})

    except Exception as e:
        logger.error(f"get_user_settings: Помилка отримання налаштувань користувача {telegram_id}: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500


def update_user_settings(telegram_id, data):
    """Оновлення налаштувань користувача"""
    try:
        user = get_user(telegram_id)

        if not user:
            return jsonify({"status": "error", "message": "Користувача не знайдено"}), 404

        allowed_fields = ["username", "avatar_id", "avatar_url", "language", "notifications_enabled"]
        updates = {k: v for k, v in data.items() if k in allowed_fields}

        try:
            updated_user = update_user(telegram_id, updates)

            if not updated_user:
                return jsonify({"status": "error", "message": "Помилка оновлення налаштувань"}), 500

            return jsonify({"status": "success", "message": "Налаштування успішно оновлено"})
        except Exception as e:
            logger.error(f"update_user_settings: Помилка оновлення бази даних: {str(e)}")
            return jsonify({"status": "error", "message": str(e)}), 500

    except Exception as e:
        logger.error(f"update_user_settings: Помилка оновлення налаштувань користувача {telegram_id}: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500


def update_user_password(telegram_id, data):
    """Оновлення пароля користувача"""
    try:
        if not data or "password_hash" not in data:
            return jsonify({"status": "error", "message": "Відсутній хеш пароля"}), 400

        user = get_user(telegram_id)

        if not user:
            return jsonify({"status": "error", "message": "Користувача не знайдено"}), 404

        try:
            updated_user = update_user(telegram_id, {"password_hash": data["password_hash"]})

            if not updated_user:
                return jsonify({"status": "error", "message": "Помилка оновлення пароля"}), 500

            return jsonify({"status": "success", "message": "Пароль успішно оновлено"})
        except Exception as e:
            logger.error(f"update_user_password: Помилка оновлення бази даних: {str(e)}")
            return jsonify({"status": "error", "message": str(e)}), 500

    except Exception as e:
        logger.error(f"update_user_password: Помилка оновлення пароля користувача {telegram_id}: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500


def get_user_seed_phrase(telegram_id):
    """Отримання seed-фрази користувача"""
    try:
        user = get_user(telegram_id)

        if not user:
            return jsonify({"status": "error", "message": "Користувача не знайдено"}), 404

        seed_phrase = user.get("seed_phrase")

        if not seed_phrase:
            try:
                seed_words = [
                    "abandon", "ability", "able", "about", "above", "absent", "absorb", "abstract", "absurd", "abuse",
                    "access", "accident", "account", "accuse", "achieve", "acid", "acoustic", "acquire", "across",
                    "act",
                    "solve", "notable", "quick", "pluck", "tribe", "dinosaur", "cereal", "casino", "rail", "media",
                    "final", "curve"
                ]

                # Безпечна генерація seed-фрази
                seed_value = int(telegram_id) if telegram_id.isdigit() else hash(telegram_id)
                random.seed(seed_value)
                seed_phrase = " ".join(random.sample(seed_words, 12))

                update_user(telegram_id, {"seed_phrase": seed_phrase})
            except Exception as e:
                logger.error(f"get_user_seed_phrase: Помилка генерації seed-фрази: {str(e)}")
                seed_phrase = "Seed фраза недоступна"

        return jsonify({
            "status": "success",
            "data": {
                "seed_phrase": seed_phrase
            }
        })

    except Exception as e:
        logger.error(f"get_user_seed_phrase: Помилка отримання seed-фрази користувача {telegram_id}: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500


def verify_user(telegram_data):
    """
    Перевіряє дані Telegram WebApp та авторизує користувача
    """
    try:
        logger.info(f"verify_user: Початок верифікації користувача.")

        # Перевірка initData з Telegram WebApp (якщо надіслано)
        init_data = telegram_data.get('initData')
        if init_data:
            # Тут можна додати логіку перевірки підпису initData
            # Для безпеки можна використовувати бібліотеку для перевірки HMAC
            logger.info("verify_user: Отримано initData з Telegram WebApp")

        telegram_id = telegram_data.get('id')
        username = telegram_data.get('username', '')
        first_name = telegram_data.get('first_name', '')
        last_name = telegram_data.get('last_name', '')

        # Додаткова логіка для роботи з різними форматами даних
        if not telegram_id and 'telegram_id' in telegram_data:
            telegram_id = telegram_data.get('telegram_id')

        header_id = request.headers.get('X-Telegram-User-Id')
        if header_id:
            telegram_id = header_id

        if not telegram_id:
            logger.error("verify_user: Не вдалося отримати telegram_id")
            return None

        # Конвертація ID в рядок
        telegram_id = str(telegram_id)

        # Перевіряємо існування користувача або створюємо нового
        user = get_user(telegram_id)

        if not user:
            display_name = username or first_name or "WINIX User"
            user = create_user(telegram_id, display_name)
            if not user:
                logger.error(f"verify_user: Помилка створення користувача: {telegram_id}")
                return None

        # Оновлюємо час останнього входу і мову користувача
        updates = {"last_login": datetime.now().isoformat()}

        # Додаємо мову, якщо вона є в запиті
        if 'language_code' in telegram_data:
            updates["language"] = telegram_data.get('language_code')

        update_user(telegram_id, updates)

        return user
    except Exception as e:
        logger.error(f"verify_user: Помилка авторизації користувача: {str(e)}", exc_info=True)
        return None