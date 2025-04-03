from flask import jsonify
from supabase_client import supabase, get_user, update_user
import logging

# Налаштування логування
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


def check_user_badges(telegram_id):
    """
    Перевіряє і оновлює бейджі користувача згідно з його досягненнями
    """
    try:
        # Отримуємо дані користувача
        user = get_user(telegram_id)

        if not user:
            logger.warning(f"check_user_badges: Користувача {telegram_id} не знайдено")
            return None

        updates = {}

        # Бейдж початківця - за 5 участей в розіграшах
        if not user.get("badge_beginner", False) and user.get("participations_count", 0) >= 5:
            updates["badge_beginner"] = True
            logger.info(f"Користувач {telegram_id} отримує бейдж початківця")

        # Бейдж багатія - за 50,000 WINIX
        if not user.get("badge_rich", False) and float(user.get("balance", 0)) >= 50000:
            updates["badge_rich"] = True
            logger.info(f"Користувач {telegram_id} отримує бейдж багатія")

        # Бейдж переможця - якщо є виграші
        if not user.get("badge_winner", False) and user.get("wins_count", 0) > 0:
            updates["badge_winner"] = True
            logger.info(f"Користувач {telegram_id} отримує бейдж переможця")

        # Якщо є зміни, оновлюємо дані користувача
        if updates:
            logger.info(f"check_user_badges: Оновлення бейджів користувача {telegram_id}: {updates}")
            updated_user = update_user(telegram_id, updates)
            return updated_user

        return user

    except Exception as e:
        logger.error(f"check_user_badges: Помилка перевірки бейджів для {telegram_id}: {str(e)}")
        return None


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

        # Формуємо інформацію про бейджі
        badges = {
            "beginner": {
                "id": "beginner",
                "name": "Початківець",
                "description": "Взяти участь у 5 розіграшах",
                "achieved": user.get("badge_beginner", False),
                "reward": 1000,
                "reward_claimed": user.get("badge_beginner_reward_claimed", False),
                "progress": min(user.get("participations_count", 0), 5),
                "total": 5
            },
            "winner": {
                "id": "winner",
                "name": "Переможець",
                "description": "Виграти хоча б один розіграш",
                "achieved": user.get("badge_winner", False),
                "reward": 2500,
                "reward_claimed": user.get("badge_winner_reward_claimed", False),
                "progress": min(user.get("wins_count", 0), 1),
                "total": 1
            },
            "rich": {
                "id": "rich",
                "name": "Багатій",
                "description": "Мати на балансі 50,000 WINIX",
                "achieved": user.get("badge_rich", False),
                "reward": 5000,
                "reward_claimed": user.get("badge_rich_reward_claimed", False),
                "progress": min(int(float(user.get("balance", 0))), 50000),
                "total": 50000
            }
        }

        return jsonify({
            "status": "success",
            "data": badges
        })

    except Exception as e:
        logger.error(f"get_available_badges: Помилка отримання бейджів для {telegram_id}: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500