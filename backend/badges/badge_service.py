d"""
Сервіс для управління бейджами користувачів.
Виділена логіка нагородження, перевірки та видачі бейджів.
"""

import logging
import os
import sys
from datetime import datetime

# Додаємо кореневу папку бекенду до шляху Python для імпортів
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
if parent_dir not in sys.path:
    sys.path.append(parent_dir)

# Імпортуємо з supabase_client
try:
    from supabase_client import get_user, update_user, supabase
except ImportError:
    from backend.supabase_client import get_user, update_user, supabase

# Налаштування логування
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


def award_badges(user_id, context=None):
    """
    Перевіряє і видає бейджі користувача на основі його досягнень

    Args:
        user_id: ID користувача
        context: Словник з додатковою інформацією про контекст події (розіграш, виграш тощо)
d
    Returns:
        dict: Оновлені дані користувача з інформацією про нові бейджі або None у випадку помилки
    """
    try:
        # Отримуємо дані користувача
        user = get_user(user_id)

        if not user:
            logger.warning(f"award_badges: Користувача {user_id} не знайдено")
            return None

        updates = {}
        awarded_badges = []

        # Бейдж початківця - за 5 участей в розіграшах
        if not user.get("badge_beginner", False) and user.get("participations_count", 0) >= 5:
            updates["badge_beginner"] = True
            awarded_badges.append({
                "id": "beginner",
                "name": "Початківець",
                "description": "За участь у 5 розіграшах",
                "reward": 1000
            })
            logger.info(f"Користувач {user_id} отримує бейдж початківця")

        # Бейдж багатія - за 50,000 WINIX
        if not user.get("badge_rich", False) and float(user.get("balance", 0)) >= 50000:
            updates["badge_rich"] = True
            awarded_badges.append({
                "id": "rich",
                "name": "Багатій",
                "description": "За накопичення 50,000 WINIX",
                "reward": 5000
            })
            logger.info(f"Користувач {user_id} отримує бейдж багатія")

        # Бейдж переможця - якщо є виграші
        if not user.get("badge_winner", False) and user.get("wins_count", 0) > 0:
            updates["badge_winner"] = True
            awarded_badges.append({
                "id": "winner",
                "name": "Переможець",
                "description": "За перемогу в розіграші",
                "reward": 2500
            })
            logger.info(f"Користувач {user_id} отримує бейдж переможця")

        # Якщо є зміни, оновлюємо дані користувача
        if updates:
            logger.info(f"award_badges: Оновлення бейджів користувача {user_id}: {updates}")
            updated_user = update_user(user_id, updates)

            # Додаємо інформацію про присвоєні бейджі
            if updated_user:
                updated_user["awarded_badges"] = awarded_badges

            return updated_user

        return user

    except Exception as e:
        logger.error(f"award_badges: Помилка нагородження бейджів для {user_id}: {str(e)}")
        return None


def get_badge_progress(user_id):
    """
    Отримує прогрес користувача для всіх бейджів

    Args:
        user_id: ID користувача

    Returns:
        dict: Дані про прогрес користувача для всіх бейджів
    """
    try:
        # Отримуємо дані користувача
        user = get_user(user_id)

        if not user:
            logger.warning(f"get_badge_progress: Користувача {user_id} не знайдено")
            return None

        # Формуємо інформацію про прогрес для кожного бейджу
        badges_progress = {
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

        return badges_progress

    except Exception as e:
        logger.error(f"get_badge_progress: Помилка отримання прогресу бейджів для {user_id}: {str(e)}")
        return None


def claim_badge_reward(user_id, badge_id):
    """
    Видає нагороду за отриманий бейдж

    Args:
        user_id: ID користувача
        badge_id: ID бейджу

    Returns:
        dict: Результат операції з інформацією про нагороду
    """
    try:
        # Отримуємо дані користувача
        user = get_user(user_id)

        if not user:
            logger.warning(f"claim_badge_reward: Користувача {user_id} не знайдено")
            return {"status": "error", "message": "Користувача не знайдено"}

        # Визначаємо інформацію про бейдж
        badge_info = {
            "beginner": {"field": "badge_beginner", "reward": 1000},
            "winner": {"field": "badge_winner", "reward": 2500},
            "rich": {"field": "badge_rich", "reward": 5000}
        }

        if badge_id not in badge_info:
            return {"status": "error", "message": "Невідомий тип бейджу"}

        badge = badge_info[badge_id]
        badge_field = badge["field"]
        reward_field = f"{badge_field}_reward_claimed"

        # Перевіряємо чи користувач має цей бейдж і чи не отримував вже нагороду
        if not user.get(badge_field, False):
            return {"status": "error", "message": "Ви ще не отримали цей бейдж"}

        if user.get(reward_field, False):
            return {"status": "already_claimed", "message": "Ви вже отримали нагороду за цей бейдж"}

        # Нараховуємо нагороду
        reward_amount = badge["reward"]
        current_balance = float(user.get("balance", 0))
        new_balance = current_balance + reward_amount

        # Оновлюємо дані користувача
        updates = {
            reward_field: True,
            "balance": new_balance
        }

        updated_user = update_user(user_id, updates)

        if not updated_user:
            return {"status": "error", "message": "Помилка оновлення даних користувача"}

        logger.info(f"Користувач {user_id} отримав нагороду {reward_amount} WINIX за бейдж {badge_id}")

        return {
            "status": "success",
            "message": f"Ви отримали нагороду {reward_amount} WINIX за бейдж {badge_id}",
            "reward_amount": reward_amount,
            "new_balance": new_balance
        }

    except Exception as e:
        logger.error(f"claim_badge_reward: Помилка видачі нагороди за бейдж {badge_id} для {user_id}: {str(e)}")
        return {"status": "error", "message": str(e)}