from flask import jsonify
import logging
import os
import importlib.util
import uuid
from datetime import datetime

# Налаштування логування
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Імпортуємо supabase_client.py напряму
current_dir = os.path.dirname(os.path.abspath(__file__))  # папка raffles
parent_dir = os.path.dirname(current_dir)  # папка backend

# Використання importlib для імпорту модуля з абсолютного шляху
spec = importlib.util.spec_from_file_location("supabase_client", os.path.join(parent_dir, "supabase_client.py"))
supabase_client = importlib.util.module_from_spec(spec)
spec.loader.exec_module(supabase_client)

# Витягуємо необхідні функції з модуля
get_user = supabase_client.get_user
update_user = supabase_client.update_user
supabase = supabase_client.supabase
check_and_update_badges = supabase_client.check_and_update_badges


def determine_raffle_winner(raffle_id):
    """
    Визначає переможця розіграшу

    Args:
        raffle_id (str): Ідентифікатор розіграшу

    Returns:
        dict: Інформація про переможця або None у випадку помилки
    """
    try:
        # У реальному випадку тут має бути логіка отримання списку учасників
        # з бази даних та випадкового визначення переможця

        # Приклад реалізації:
        # 1. Отримуємо всіх учасників розіграшу
        # participants = supabase.table("raffle_participants").select("*").eq("raffle_id", raffle_id).execute()

        # 2. Випадково вибираємо переможця
        # if participants.data:
        #     winner = random.choice(participants.data)
        #
        #     # 3. Оновлюємо статус розіграшу та записуємо переможця
        #     supabase.table("raffles").update({"status": "completed", "winner_id": winner["telegram_id"]}).eq("id", raffle_id).execute()
        #
        #     # 4. Оновлюємо статистику користувача
        #     update_user(winner["telegram_id"], {"wins_count": winner.get("wins_count", 0) + 1})
        #
        #     return winner

        # Заглушка для прикладу
        winner = {
            "telegram_id": "123456789",
            "username": "winner_user",
            "entry_number": 42,
            "win_time": datetime.now().isoformat()
        }

        logger.info(f"determine_raffle_winner: Для розіграшу {raffle_id} визначено переможця: {winner['telegram_id']}")

        return winner
    except Exception as e:
        logger.error(f"determine_raffle_winner: Помилка визначення переможця розіграшу {raffle_id}: {str(e)}")
        return None


def process_raffle_prize(raffle_id, winner_id, prize_amount):
    """
    Обробляє видачу призу переможцю розіграшу

    Args:
        raffle_id (str): Ідентифікатор розіграшу
        winner_id (str): Ідентифікатор переможця
        prize_amount (float): Сума призу

    Returns:
        bool: True у випадку успіху, False інакше
    """
    try:
        # 1. Оновлюємо баланс переможця
        spec_wallet = importlib.util.spec_from_file_location("balance",
                                                             os.path.join(parent_dir, "wallet", "balance.py"))
        balance_module = importlib.util.module_from_spec(spec_wallet)
        spec_wallet.loader.exec_module(balance_module)
        add_tokens = balance_module.add_tokens

        # 2. Додаємо транзакцію
        transaction_data = {
            'type': 'reward',
            'amount': prize_amount,
            'description': f'Приз за перемогу в розіграші {raffle_id}'
        }

        add_tokens(winner_id, {
            'amount': prize_amount,
            'description': transaction_data['description']
        })

        # Імпорт badges.controllers
        spec_badges = importlib.util.spec_from_file_location("badges_controllers",
                                                             os.path.join(parent_dir, "badges", "controllers.py"))
        badges_module = importlib.util.module_from_spec(spec_badges)
        spec_badges.loader.exec_module(badges_module)
        check_user_badges = badges_module.check_user_badges

        logger.info(f"process_raffle_prize: Переможцю {winner_id} нараховано приз у розмірі {prize_amount} WINIX")

        return True
    except Exception as e:
        logger.error(f"process_raffle_prize: Помилка видачі призу {prize_amount} для {winner_id}: {str(e)}")
        return False