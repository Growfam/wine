from flask import jsonify
import logging
import os
import sys
from datetime import datetime

# Додаємо кореневу папку бекенду до шляху Python для імпортів
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
if parent_dir not in sys.path:
    sys.path.append(parent_dir)

# Імпортуємо з supabase_client без використання importlib
from supabase_client import get_user, update_user, supabase

# Імпортуємо сервіс бейджів
from badges.badge_service import award_badges, get_badge_progress, claim_badge_reward

# Налаштування логування
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


def check_user_badges(telegram_id):
    """
    Перевіряє і оновлює бейджі користувача згідно з його досягненнями
    """
    return award_badges(telegram_id)


def get_available_badges(telegram_id):
    """
    Отримує інформацію про доступні бейджі користувача
    """
    try:
        # Отримуємо дані користувача
        user = get_user(telegram_id)

        if not user:
            return jsonify({"status": "error", "message": "Користувача не знайдено"}), 404

        # Перевіряємо, чи сталися зміни в бейджах
        updated_user = check_user_badges(telegram_id)

        if updated_user:
            user = updated_user

        # Отримуємо інформацію про бейджі
        badges = get_badge_progress(telegram_id)

        if not badges:
            return jsonify({"status": "error", "message": "Помилка отримання даних про бейджі"}), 500

        return jsonify({
            "status": "success",
            "data": badges
        })

    except Exception as e:
        logger.error(f"get_available_badges: Помилка отримання бейджів для {telegram_id}: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500


def claim_badge_reward_handler(telegram_id, badge_id):
    """
    API-обробник для видачі нагороди за бейдж
    """
    try:
        result = claim_badge_reward(telegram_id, badge_id)

        if result['status'] == 'error':
            return jsonify({
                "status": "error",
                "message": result["message"]
            }), 400

        if result['status'] == 'already_claimed':
            return jsonify({
                "status": "already_claimed",
                "message": result["message"]
            }), 200

        return jsonify({
            "status": "success",
            "message": result["message"],
            "data": {
                "reward_amount": result["reward_amount"],
                "new_balance": result["new_balance"]
            }
        })

    except Exception as e:
        logger.error(f"claim_badge_reward_handler: Помилка для {telegram_id} з бейджем {badge_id}: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500