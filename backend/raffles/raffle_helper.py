#!/usr/bin/env python
"""
Допоміжний модуль для обробки нарахування бонусів учасникам розіграшів
та інших специфічних операцій з розіграшами $Winix.
"""

import os
import sys
import logging
import json
import uuid
from datetime import datetime, timezone
from typing import Dict, List, Optional, Union

# Налаштування логування
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Додаємо батьківську директорію до шляху для імпорту supabase_client
parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if parent_dir not in sys.path:
    sys.path.append(parent_dir)

try:
    from supabase_client import supabase, get_user, update_balance, update_coins
except ImportError as e:
    print(f"Помилка імпорту supabase_client: {e}")
    print(f"Пошук у: {parent_dir}")
    print(f"Доступні файли: {os.listdir(parent_dir)}")
    sys.exit(1)


class RaffleRewardProcessor:
    """
    Клас для обробки винагород за участь у розіграшах
    """

    def __init__(self):
        """Ініціалізація процесора винагород"""
        logger.info("Ініціалізація RaffleRewardProcessor")

    def process_participation_rewards(self, raffle_id: str, admin_id: Optional[str] = None) -> Dict:
        """
        Обробка винагород за участь у розіграші

        Args:
            raffle_id: ID розіграшу
            admin_id: ID адміністратора для логування

        Returns:
            Dict: Результат обробки винагород
        """
        logger.info(f"Обробка винагород за участь у розіграші {raffle_id}")

        try:
            # Отримуємо дані розіграшу
            raffle_response = supabase.table("raffles").select("*").eq("id", raffle_id).execute()

            if not raffle_response.data:
                logger.error(f"Розіграш з ID {raffle_id} не знайдено")
                return {"status": "error", "message": f"Розіграш з ID {raffle_id} не знайдено"}

            raffle = raffle_response.data[0]

            # Перевіряємо, чи розіграш завершено
            if raffle.get("status") != "completed":
                logger.warning(f"Розіграш {raffle_id} ще не завершено")
                return {"status": "error", "message": "Неможливо обробити винагороди для незавершеного розіграшу"}

            # Отримуємо інформацію про винагороду за участь
            participation_reward = raffle.get("participation_reward", 0)
            reward_currency = raffle.get("participation_reward_currency", "$Winix")

            if participation_reward <= 0:
                logger.warning(f"Розіграш {raffle_id} не має винагороди за участь")
                return {"status": "success", "message": "Розіграш не має винагороди за участь", "processed": 0}

            # Отримуємо учасників розіграшу
            participants_response = supabase.table("raffle_participants").select("*").eq("raffle_id",
                                                                                         raffle_id).execute()

            if not participants_response.data:
                logger.warning(f"Розіграш {raffle_id} не має учасників")
                return {"status": "success", "message": "Розіграш не має учасників", "processed": 0}

            # Підготовка до обробки винагород
            participants = participants_response.data
            rewards_processed = 0
            errors = []

            # Дата та час обробки
            now = datetime.now(timezone.utc)

            # Обробляємо кожного учасника
            for participant in participants:
                telegram_id = participant.get("telegram_id")
                entry_count = participant.get("entry_count", 0)

                if not telegram_id:
                    continue

                # Перевіряємо, чи винагорода вже була нарахована
                reward_exists_response = supabase.table("transactions").select("count", count="exact") \
                    .eq("telegram_id", telegram_id) \
                    .eq("raffle_id", raffle_id) \
                    .eq("type", "participation_reward") \
                    .execute()

                reward_exists = reward_exists_response.count > 0

                if reward_exists:
                    logger.info(f"Винагорода за участь уже була нарахована для користувача {telegram_id}")
                    continue

                # Отримуємо дані користувача
                user = get_user(telegram_id)

                if not user:
                    logger.warning(f"Користувача з ID {telegram_id} не знайдено")
                    errors.append({
                        "telegram_id": telegram_id,
                        "error": f"Користувача не знайдено"
                    })
                    continue

                try:
                    # Нараховуємо винагороду
                    current_balance = float(user.get("balance", 0))
                    new_balance = current_balance + participation_reward

                    # Створюємо транзакцію
                    transaction_data = {
                        "id": str(uuid.uuid4()),
                        "telegram_id": telegram_id,
                        "type": "participation_reward",
                        "amount": participation_reward,
                        "description": f"Винагорода за участь у розіграші '{raffle.get('title')}'",
                        "status": "completed",
                        "created_at": now.isoformat(),
                        "raffle_id": raffle_id
                    }

                    transaction_response = supabase.table("transactions").insert(transaction_data).execute()

                    # Оновлюємо баланс користувача
                    update_response = update_balance(telegram_id, participation_reward)

                    # Якщо успішно
                    if transaction_response.data and update_response:
                        rewards_processed += 1
                        logger.info(f"Нараховано {participation_reward} {reward_currency} користувачу {telegram_id}")
                    else:
                        logger.warning(f"Помилка нарахування винагороди користувачу {telegram_id}")
                        errors.append({
                            "telegram_id": telegram_id,
                            "error": "Помилка оновлення балансу"
                        })

                except Exception as e:
                    logger.error(f"Помилка обробки винагороди для {telegram_id}: {str(e)}")
                    errors.append({
                        "telegram_id": telegram_id,
                        "error": str(e)
                    })

            # Оновлюємо статус розіграшу
            update_data = {
                "rewards_processed": True,
                "rewards_processed_at": now.isoformat(),
                "rewards_processed_by": admin_id,
                "updated_at": now.isoformat()
            }

            supabase.table("raffles").update(update_data).eq("id", raffle_id).execute()

            return {
                "status": "success",
                "message": f"Обробка винагород завершена. Нараховано {rewards_processed} винагород.",
                "processed": rewards_processed,
                "errors": errors,
                "total_participants": len(participants)
            }

        except Exception as e:
            logger.error(f"Помилка обробки винагород: {str(e)}")
            return {"status": "error", "message": f"Помилка обробки винагород: {str(e)}"}

    def process_jackpot_rewards(self, raffle_id: str, admin_id: Optional[str] = None) -> Dict:
        """
        Спеціальна обробка винагород для Jackpot розіграшу

        Args:
            raffle_id: ID розіграшу
            admin_id: ID адміністратора для логування

        Returns:
            Dict: Результат обробки винагород
        """
        logger.info(f"Обробка Jackpot винагород для розіграшу {raffle_id}")

        # Спочатку обробляємо звичайні винагороди за участь
        regular_rewards_result = self.process_participation_rewards(raffle_id, admin_id)

        if regular_rewards_result.get("status") == "error":
            return regular_rewards_result

        # Додаткова логіка для обробки USD призів
        try:
            # Отримуємо дані розіграшу
            raffle_response = supabase.table("raffles").select("*").eq("id", raffle_id).execute()
            raffle = raffle_response.data[0]

            # Отримуємо переможців розіграшу
            winners_response = supabase.table("raffle_winners").select("*").eq("raffle_id", raffle_id).execute()

            if not winners_response.data:
                logger.warning(f"Розіграш {raffle_id} не має переможців")
                return {
                    **regular_rewards_result,
                    "usd_prizes_processed": 0
                }

            winners = winners_response.data
            usd_prizes_processed = 0

            # Обробляємо USD призи
            for winner in winners:
                telegram_id = winner.get("telegram_id")
                prize_amount = winner.get("prize_amount", 0)
                prize_currency = winner.get("prize_currency", "$Winix")

                if prize_currency != "USD" or prize_amount <= 0:
                    continue

                # Створюємо запис про USD приз
                usd_prize_data = {
                    "id": str(uuid.uuid4()),
                    "telegram_id": telegram_id,
                    "raffle_id": raffle_id,
                    "amount": prize_amount,
                    "currency": "USD",
                    "status": "pending",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "created_by": admin_id,
                    "notes": f"Приз за {winner.get('place')} місце у Jackpot розіграші '{raffle.get('title')}'"
                }

                # Зберігаємо запис у таблицю USD призів
                usd_prize_response = supabase.table("usd_prizes").insert(usd_prize_data).execute()

                if usd_prize_response.data:
                    usd_prizes_processed += 1
                    logger.info(f"Створено запис про USD приз для користувача {telegram_id}: ${prize_amount}")

            return {
                **regular_rewards_result,
                "usd_prizes_processed": usd_prizes_processed
            }

        except Exception as e:
            logger.error(f"Помилка обробки Jackpot винагород: {str(e)}")
            return {
                **regular_rewards_result,
                "usd_prizes_status": "error",
                "usd_prizes_message": f"Помилка обробки USD призів: {str(e)}"
            }


if __name__ == "__main__":
    # Отримуємо ADMIN_ID з середовища
    admin_id = os.getenv("ADMIN_ID")

    if not admin_id:
        print("Помилка: ADMIN_ID не вказано в середовищі")
        sys.exit(1)

    # Створюємо процесор винагород
    processor = RaffleRewardProcessor()

    # Запитуємо ID розіграшу
    raffle_id = input("Введіть ID розіграшу для обробки винагород: ")

    if not raffle_id:
        print("Помилка: ID розіграшу не вказано")
        sys.exit(1)

    # Запитуємо тип розіграшу
    raffle_type = input("Це Jackpot розіграш? (y/n): ").lower()

    if raffle_type == "y":
        # Обробляємо Jackpot розіграш
        result = processor.process_jackpot_rewards(raffle_id, admin_id)
    else:
        # Обробляємо звичайний розіграш
        result = processor.process_participation_rewards(raffle_id, admin_id)

    # Виводимо результат
    print(json.dumps(result, indent=2, ensure_ascii=False))