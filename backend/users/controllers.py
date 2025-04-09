from flask import jsonify, request
import logging
import os
import sys
import random
import string
from datetime import datetime
import uuid

# Додаємо кореневу папку бекенду до шляху Python для імпортів
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
if parent_dir not in sys.path:
    sys.path.append(parent_dir)

# Імпортуємо з supabase_client без використання importlib
from supabase_client import get_user, create_user, update_user, update_balance, update_coins, check_and_update_badges, supabase

# Налаштування логування
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def get_user_info(telegram_id):
    """Обгортка для функції get_user з supabase_client"""
    return get_user(telegram_id)

def create_new_user(telegram_id, username, referrer_id=None):
    """Обгортка для функції create_user з supabase_client"""
    return create_user(telegram_id, username, referrer_id)

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