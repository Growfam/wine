from flask import jsonify
from supabase_client import supabase, get_user, update_user
import logging
from datetime import datetime

# Налаштування логування
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

def get_daily_bonus_status(telegram_id):
    """Отримання статусу щоденного бонусу"""
    try:
        # Отримуємо користувача
        user = get_user(telegram_id)

        if not user:
            return jsonify({"status": "error", "message": "Користувача не знайдено"}), 404

        # Отримуємо інформацію про щоденні бонуси
        daily_bonuses = user.get("daily_bonuses", {})

        # Якщо немає інформації про бонуси, створюємо її
        if not daily_bonuses:
            daily_bonuses = {
                "last_claimed_date": None,
                "claimed_days": [],
                "current_day": 1
            }

        # Перевіряємо, чи можна отримати бонус сьогодні
        today = datetime.now().strftime("%Y-%m-%d")
        last_date = daily_bonuses.get("last_claimed_date")

        # Якщо це перший бонус або минув день
        if not last_date or last_date != today:
            # Визначаємо поточний день у циклі (1-7)
            current_day = daily_bonuses.get("current_day", 1)
            claimed_days = daily_bonuses.get("claimed_days", [])

            # Визначаємо суму винагороди залежно від дня
            reward_amount = current_day * 10  # День 1 = 10, День 2 = 20, і т.д.

            # Перевіряємо, чи сьогодні вже отримано бонус
            can_claim = today != last_date

            return jsonify({
                "status": "success",
                "currentDay": current_day,
                "claimedDays": claimed_days,
                "canClaim": can_claim,
                "rewardAmount": reward_amount
            })
        else:
            # Бонус вже отримано сьогодні
            return jsonify({
                "status": "success",
                "currentDay": daily_bonuses.get("current_day", 1),
                "claimedDays": daily_bonuses.get("claimed_days", []),
                "canClaim": False,
                "message": "Бонус вже отримано сьогодні"
            })
    except Exception as e:
        logger.error(f"Помилка отримання статусу щоденного бонусу для {telegram_id}: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500

def claim_daily_bonus(telegram_id, data):
    """Отримання щоденного бонусу"""
    try:
        day = data.get("day", 1) if data else 1

        # Отримуємо користувача
        user = get_user(telegram_id)

        if not user:
            return jsonify({"status": "error", "message": "Користувача не знайдено"}), 404

        # Отримуємо інформацію про щоденні бонуси
        daily_bonuses = user.get("daily_bonuses", {})

        # Якщо немає інформації про бонуси, створюємо її
        if not daily_bonuses:
            daily_bonuses = {
                "last_claimed_date": None,
                "claimed_days": [],
                "current_day": 1
            }

        # Перевіряємо, чи можна отримати бонус сьогодні
        today = datetime.now().strftime("%Y-%m-%d")
        last_date = daily_bonuses.get("last_claimed_date")

        # Якщо бонус вже отримано сьогодні
        if last_date == today:
            return jsonify({
                "status": "already_claimed",
                "message": "Бонус вже отримано сьогодні"
            })

        # Визначаємо поточний день у циклі (1-7)
        current_day = daily_bonuses.get("current_day", 1)
        claimed_days = daily_bonuses.get("claimed_days", [])

        # Перевіряємо, чи переданий день співпадає з поточним
        if day != current_day:
            return jsonify({
                "status": "error",
                "message": f"Неправильний день! Очікувався день {current_day}, отримано {day}"
            }), 400

        # Визначаємо суму винагороди залежно від дня
        reward_amount = current_day * 10  # День 1 = 10, День 2 = 20, і т.д.

        # Нараховуємо винагороду
        current_balance = float(user.get("balance", 0))
        new_balance = current_balance + reward_amount

        # Оновлюємо інформацію про бонуси
        claimed_days.append(current_day)

        # Визначаємо наступний день (циклічно від 1 до 7)
        next_day = current_day + 1
        if next_day > 7:
            next_day = 1

        # Оновлюємо дані в базі
        updated_bonuses = {
            "last_claimed_date": today,
            "claimed_days": claimed_days,
            "current_day": next_day
        }

        update_user(telegram_id, {
            "balance": new_balance,
            "daily_bonuses": updated_bonuses
        })

        # Додаємо транзакцію
        transaction = {
            "telegram_id": telegram_id,
            "type": "reward",
            "amount": reward_amount,
            "description": f"Щоденний бонус (День {current_day})",
            "status": "completed"
        }

        supabase.table("transactions").insert(transaction).execute()

        return jsonify({
            "status": "success",
            "message": f"Щоденний бонус отримано: +{reward_amount} WINIX",
            "reward": reward_amount,
            "newBalance": new_balance
        })
    except Exception as e:
        logger.error(f"Помилка отримання щоденного бонусу для {telegram_id}: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500

def verify_subscription(telegram_id, data):
    """Перевірка підписки на соціальну мережу"""
    try:
        if not data or "platform" not in data:
            return jsonify({"status": "error", "message": "Відсутня платформа"}), 400

        platform = data["platform"]

        # Отримуємо користувача
        user = get_user(telegram_id)

        if not user:
            return jsonify({"status": "error", "message": "Користувача не знайдено"}), 404

        # Отримуємо статус соціальних завдань
        social_tasks = user.get("social_tasks", {})

        # Якщо завдання вже виконано
        if social_tasks.get(platform, False):
            return jsonify({
                "status": "already_completed",
                "message": "Це завдання вже виконано"
            })

        # Визначаємо винагороду залежно від платформи
        reward_amounts = {
            "twitter": 50,
            "telegram": 80,
            "youtube": 50,
            "discord": 60,
            "instagram": 70
        }

        reward_amount = reward_amounts.get(platform, 50)

        # Нараховуємо винагороду
        current_balance = float(user.get("balance", 0))
        new_balance = current_balance + reward_amount

        # Оновлюємо статус завдання
        if not social_tasks:
            social_tasks = {}
        social_tasks[platform] = True

        # Оновлюємо дані в базі
        update_user(telegram_id, {
            "balance": new_balance,
            "social_tasks": social_tasks
        })

        # Додаємо транзакцію
        transaction = {
            "telegram_id": telegram_id,
            "type": "reward",
            "amount": reward_amount,
            "description": f"Винагорода за підписку на {platform}",
            "status": "completed"
        }

        supabase.table("transactions").insert(transaction).execute()

        return jsonify({
            "status": "success",
            "message": f"Підписку підтверджено! Отримано {reward_amount} WINIX",
            "reward": reward_amount,
            "newBalance": new_balance
        })
    except Exception as e:
        logger.error(f"Помилка перевірки підписки для {telegram_id}: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500