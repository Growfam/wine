from flask import jsonify
import logging
import os
import importlib.util
from datetime import datetime, timedelta

# Налаштування логування
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Імпортуємо supabase_client.py напряму
current_dir = os.path.dirname(os.path.abspath(__file__))  # папка stats
parent_dir = os.path.dirname(current_dir)  # папка backend

# Використання importlib для імпорту модуля з абсолютного шляху
spec = importlib.util.spec_from_file_location("supabase_client", os.path.join(parent_dir, "supabase_client.py"))
supabase_client = importlib.util.module_from_spec(spec)
spec.loader.exec_module(supabase_client)

# Витягуємо необхідні функції з модуля
get_user = supabase_client.get_user
supabase = supabase_client.supabase

def get_user_stats(telegram_id):
    """
    Отримує статистику користувача
    """
    try:
        # Отримуємо дані користувача
        user = get_user(telegram_id)

        if not user:
            return jsonify({"status": "error", "message": "Користувача не знайдено"}), 404

        # Отримуємо статистику транзакцій за останні 30 днів
        try:
            now = datetime.now()
            thirty_days_ago = (now - timedelta(days=30)).isoformat()

            transactions_query = supabase.table("transactions").select("*").eq("telegram_id", telegram_id).gte(
                "created_at", thirty_days_ago).execute()
            transactions = transactions_query.data if transactions_query.data else []

            # Підраховуємо статистику
            total_income = sum(float(tx.get("amount", 0)) for tx in transactions if float(tx.get("amount", 0)) > 0)
            total_spent = sum(abs(float(tx.get("amount", 0))) for tx in transactions if float(tx.get("amount", 0)) < 0)
            stake_rewards = sum(float(tx.get("amount", 0)) for tx in transactions if
                                tx.get("type") == "unstake" and float(tx.get("amount", 0)) > 0)
            quest_rewards = sum(float(tx.get("amount", 0)) for tx in transactions if tx.get("type") == "reward")

        except Exception as e:
            logger.error(f"get_user_stats: Помилка отримання транзакцій: {str(e)}")
            transactions = []
            total_income = 0
            total_spent = 0
            stake_rewards = 0
            quest_rewards = 0

        # Отримуємо статистику рефералів
        try:
            referrals_query = supabase.table("winix").select("count").eq("referrer_id", telegram_id).execute()
            referral_count = referrals_query.count if hasattr(referrals_query, 'count') else 0
        except Exception as e:
            logger.error(f"get_user_stats: Помилка отримання кількості рефералів: {str(e)}")
            referral_count = 0

        # Формуємо статистику для користувача
        stats = {
            "balance": float(user.get("balance", 0)),
            "coins": int(user.get("coins", 0)),
            "total_transactions": len(transactions),
            "monthly_income": total_income,
            "monthly_spent": total_spent,
            "stake_rewards": stake_rewards,
            "quest_rewards": quest_rewards,
            "referral_count": referral_count,
            "participations_count": user.get("participations_count", 0),
            "wins_count": user.get("wins_count", 0),
            "badges_count": sum([
                user.get("badge_beginner", False),
                user.get("badge_winner", False),
                user.get("badge_rich", False)
            ]),
            "creation_date": user.get("created_at", "N/A"),
            "last_login": user.get("last_login", "N/A")
        }

        return jsonify({
            "status": "success",
            "data": stats
        })

    except Exception as e:
        logger.error(f"get_user_stats: Помилка отримання статистики для {telegram_id}: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500


def get_leaderboard():
    """
    Отримує список лідерів за балансом
    """
    try:
        # Запит до бази для отримання топ-10 користувачів за балансом
        try:
            leaders_query = supabase.table("winix").select("telegram_id,username,balance").order("balance",
                                                                                                 desc=True).limit(
                10).execute()
            leaders = leaders_query.data if leaders_query.data else []
        except Exception as e:
            logger.error(f"get_leaderboard: Помилка отримання лідерів: {str(e)}")
            leaders = []

        # Форматуємо дані для відповіді
        formatted_leaders = []
        for i, leader in enumerate(leaders):
            formatted_leaders.append({
                "rank": i + 1,
                "id": leader.get("telegram_id"),
                "username": leader.get("username", "WINIX User"),
                "balance": float(leader.get("balance", 0))
            })

        return jsonify({
            "status": "success",
            "data": formatted_leaders
        })

    except Exception as e:
        logger.error(f"get_leaderboard: Помилка отримання лідерів: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500


def get_system_stats():
    """
    Отримує загальну статистику системи
    """
    try:
        stats = {
            "users_count": 0,
            "transactions_count": 0,
            "total_winix_in_circulation": 0,
            "total_winix_staked": 0,
            "active_raffles": 0,
            "active_users_today": 0
        }

        try:
            # Кількість користувачів
            users_query = supabase.table("winix").select("count").execute()
            stats["users_count"] = users_query.count if hasattr(users_query, 'count') else 0

            # Кількість транзакцій
            transactions_query = supabase.table("transactions").select("count").execute()
            stats["transactions_count"] = transactions_query.count if hasattr(transactions_query, 'count') else 0

            # Загальна кількість WINIX в обігу
            balance_sum_query = supabase.table("winix").select("sum(balance)").execute()
            stats["total_winix_in_circulation"] = float(
                balance_sum_query.data[0].get("sum", 0)) if balance_sum_query.data else 0

            # Кількість активних користувачів сьогодні
            today = datetime.now().strftime("%Y-%m-%d")
            active_users_query = supabase.table("winix").select("count").gte("last_login", today).execute()
            stats["active_users_today"] = active_users_query.count if hasattr(active_users_query, 'count') else 0

        except Exception as e:
            logger.error(f"get_system_stats: Помилка отримання системної статистики: {str(e)}")

        return jsonify({
            "status": "success",
            "data": stats
        })

    except Exception as e:
        logger.error(f"get_system_stats: Помилка отримання системної статистики: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500