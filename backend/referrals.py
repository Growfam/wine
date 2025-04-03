from flask import jsonify
from supabase_client import supabase, get_user, update_user
import logging

# Налаштування логування
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Допоміжна функція для перевірки валідності реферального коду
def is_valid_referral_code(code):
    """Перевірка валідності реферального коду"""
    try:
        return len(code) > 5
    except:
        return False

def get_referral_tasks(telegram_id):
    """Отримання статусу реферальних завдань"""
    try:
        # Отримуємо користувача
        user = get_user(telegram_id)

        if not user:
            return jsonify({"status": "error", "message": "Користувача не знайдено"}), 404

        # Отримуємо кількість рефералів
        try:
            referrals_res = supabase.table("winix").select("count").eq("referrer_id", telegram_id).execute()
            referral_count = referrals_res.count if hasattr(referrals_res, 'count') else 0
        except Exception as e:
            logger.error(f"Помилка отримання кількості рефералів: {str(e)}")
            referral_count = 0

        # Отримуємо статус реферальних завдань
        referral_tasks = user.get("referral_tasks", {})

        # Визначаємо завдання і їх цілі
        tasks = [
            {"id": "invite-friends", "target": 5, "reward": 300},
            {"id": "invite-friends-10", "target": 10, "reward": 700},
            {"id": "invite-friends-25", "target": 25, "reward": 1500},
            {"id": "invite-friends-100", "target": 100, "reward": 5000}
        ]

        # Визначаємо, які завдання виконані
        completed_tasks = []

        for task in tasks:
            task_id = task["id"]
            target = task["target"]

            # Завдання виконане, якщо кількість рефералів >= цільової або статус в базі = True
            if referral_count >= target or referral_tasks.get(task_id, False):
                completed_tasks.append(task_id)

        return jsonify({
            "status": "success",
            "referralCount": referral_count,
            "completedTasks": completed_tasks,
            "tasks": tasks
        })
    except Exception as e:
        logger.error(f"Помилка отримання статусу реферальних завдань для {telegram_id}: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500

def claim_referral_reward(telegram_id, data):
    """Отримання винагороди за реферальне завдання"""
    try:
        if not data or "taskId" not in data or "reward" not in data:
            return jsonify({"status": "error", "message": "Відсутні необхідні дані"}), 400

        task_id = data["taskId"]
        reward_amount = float(data["reward"])

        # Отримуємо користувача
        user = get_user(telegram_id)

        if not user:
            return jsonify({"status": "error", "message": "Користувача не знайдено"}), 404

        # Отримуємо кількість рефералів і статус завдань
        try:
            referrals_res = supabase.table("winix").select("count").eq("referrer_id", telegram_id).execute()
            referral_count = referrals_res.count if hasattr(referrals_res, 'count') else 0
        except Exception as e:
            logger.error(f"Помилка отримання кількості рефералів: {str(e)}")
            referral_count = 0

        referral_tasks = user.get("referral_tasks", {})

        # Визначаємо цільову кількість рефералів
        target_map = {
            "invite-friends": 5,
            "invite-friends-10": 10,
            "invite-friends-25": 25,
            "invite-friends-100": 100
        }

        target = target_map.get(task_id, 0)

        # Перевіряємо, чи завдання вже виконане
        if referral_tasks.get(task_id, False):
            return jsonify({
                "status": "already_claimed",
                "message": "Ви вже отримали винагороду за це завдання"
            })

        # Перевіряємо, чи достатньо рефералів
        if referral_count < target:
            return jsonify({
                "status": "not_completed",
                "message": f"Недостатньо рефералів для завершення завдання. Потрібно {target}, наявно {referral_count}"
            }), 400

        # Нараховуємо винагороду
        current_balance = float(user.get("balance", 0))
        new_balance = current_balance + reward_amount

        # Оновлюємо статус завдання
        if not referral_tasks:
            referral_tasks = {}
        referral_tasks[task_id] = True

        # Оновлюємо дані в базі
        update_user(telegram_id, {
            "balance": new_balance,
            "referral_tasks": referral_tasks
        })

        # Додаємо транзакцію
        transaction = {
            "telegram_id": telegram_id,
            "type": "reward",
            "amount": reward_amount,
            "description": f"Винагорода за реферальне завдання: {task_id}",
            "status": "completed"
        }

        supabase.table("transactions").insert(transaction).execute()

        return jsonify({
            "status": "success",
            "message": f"Винагороду отримано: {reward_amount} WINIX",
            "reward": reward_amount,
            "newBalance": new_balance
        })
    except Exception as e:
        logger.error(f"Помилка отримання винагороди за реферальне завдання для {telegram_id}: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500

def invite_referral(telegram_id, data):
    """Запросити нового реферала"""
    try:
        if not data or "referralCode" not in data:
            return jsonify({"status": "error", "message": "Відсутній реферальний код"}), 400

        referral_code = data["referralCode"]

        # Отримуємо користувача
        user = get_user(telegram_id)

        if not user:
            return jsonify({"status": "error", "message": "Користувача не знайдено"}), 404

        # Перевіряємо, чи реферальний код валідний
        if not is_valid_referral_code(referral_code):
            return jsonify({
                "status": "error",
                "message": "Невалідний реферальний код"
            }), 400

        # Отримуємо поточну кількість рефералів
        try:
            referrals_res = supabase.table("winix").select("count").eq("referrer_id", telegram_id).execute()
            current_referrals = referrals_res.count if hasattr(referrals_res, 'count') else 0
        except Exception as e:
            logger.error(f"Помилка отримання кількості рефералів: {str(e)}")
            current_referrals = 0

        # Додаємо нового реферала (у реальному випадку тут має бути логіка додавання реферала)
        new_referrals = current_referrals + 1

        return jsonify({
            "status": "success",
            "message": f"Друга успішно запрошено!",
            "referralCount": new_referrals
        })
    except Exception as e:
        logger.error(f"Помилка запрошення реферала для {telegram_id}: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500