#!/usr/bin/env python
"""
Скрипт для автоматичного завершення прострочених розіграшів і нарахування винагород
"""
import os
import sys
import uuid
from datetime import datetime, timezone
import random

# Додаємо шляхи для імпортів
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
if parent_dir not in sys.path:
    sys.path.append(parent_dir)

try:
    from supabase_client import supabase, get_user, execute_transaction, clear_cache

    print("✅ Модулі успішно імпортовано")
except ImportError as e:
    print(f"❌ Помилка імпорту модулів: {e}")
    sys.exit(1)


def process_participation_rewards(raffle_id):
    """Нарахування винагород усім учасникам розіграшу"""
    print(f"⏳ Обробка винагород за участь у розіграші {raffle_id}")

    try:
        # Отримуємо дані розіграшу
        raffle_response = supabase.table("raffles").select("*").eq("id", raffle_id).execute()

        if not raffle_response.data:
            print(f"❌ Розіграш з ID {raffle_id} не знайдено")
            return False

        raffle = raffle_response.data[0]

        # Перевіряємо, чи є винагорода за участь
        participation_reward = raffle.get("participation_reward", 0)
        reward_currency = raffle.get("participation_reward_currency", "$Winix")

        if participation_reward <= 0:
            print(f"ℹ️ Розіграш {raffle_id} не має винагороди за участь")
            return True

        # Отримуємо учасників розіграшу
        participants_response = supabase.table("raffle_participants").select("*").eq("raffle_id", raffle_id).execute()

        if not participants_response.data:
            print(f"ℹ️ Розіграш {raffle_id} не має учасників")
            return True

        # Нараховуємо винагороду кожному учаснику
        now = datetime.now(timezone.utc)
        processed_count = 0

        for participant in participants_response.data:
            telegram_id = participant.get("telegram_id")

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
                print(f"ℹ️ Винагорода вже нарахована користувачу {telegram_id}")
                continue

            # Отримуємо дані користувача
            user = get_user(telegram_id)

            if not user:
                print(f"❌ Користувача {telegram_id} не знайдено")
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

                # Зберігаємо транзакцію
                supabase.table("transactions").insert(transaction_data).execute()

                # Оновлюємо баланс
                supabase.table("winix").update({"balance": new_balance}).eq("telegram_id", telegram_id).execute()

                processed_count += 1
                print(f"✅ Нараховано {participation_reward} {reward_currency} користувачу {telegram_id}")

            except Exception as e:
                print(f"❌ Помилка нарахування винагороди для {telegram_id}: {str(e)}")

        # Оновлюємо статус розіграшу
        supabase.table("raffles").update({
            "rewards_processed": True,
            "rewards_processed_at": now.isoformat()
        }).eq("id", raffle_id).execute()

        print(f"✅ Оброблено {processed_count} винагород за участь у розіграші {raffle_id}")
        return True

    except Exception as e:
        print(f"❌ Помилка обробки винагород за участь: {str(e)}")
        return False


def finish_expired_raffles():
    """Перевірка та автоматичне завершення прострочених розіграшів"""
    print("⏳ Початок перевірки прострочених розіграшів")

    # Отримуємо поточний час
    now = datetime.now(timezone.utc)

    # Отримуємо активні розіграші, у яких минув час завершення
    try:
        expired_raffles_response = supabase.table("raffles").select("*") \
            .eq("status", "active") \
            .lt("end_time", now.isoformat()) \
            .execute()
    except Exception as e:
        print(f"❌ Помилка запиту прострочених розіграшів: {str(e)}")
        return {
            "status": "error",
            "message": f"Помилка запиту прострочених розіграшів: {str(e)}"
        }

    if not expired_raffles_response.data:
        print("ℹ️ Прострочені розіграші не знайдено")
        return {
            "status": "success",
            "message": "Прострочені розіграші не знайдено",
            "finished_count": 0
        }

    print(f"ℹ️ Знайдено {len(expired_raffles_response.data)} прострочених розіграшів")

    # Завершуємо кожен прострочений розіграш
    finished_count = 0
    finished_raffles = []
    errors = []

    for raffle in expired_raffles_response.data:
        raffle_id = raffle.get("id")
        print(f"⏳ Обробка розіграшу {raffle_id}: {raffle.get('title')}")

        try:
            # Отримуємо учасників розіграшу
            participants_response = supabase.table("raffle_participants").select("*") \
                .eq("raffle_id", raffle_id) \
                .execute()

            # Оновлюємо статус розіграшу на "completed"
            supabase.table("raffles").update({
                "status": "completed",
                "updated_at": now.isoformat(),
                "completed_at": now.isoformat()
            }).eq("id", raffle_id).execute()

            if not participants_response.data:
                print(f"ℹ️ Розіграш {raffle_id} не має учасників")
                finished_count += 1
                finished_raffles.append({
                    "raffle_id": raffle_id,
                    "title": raffle.get("title"),
                    "winners_count": 0
                })
                continue

            # Визначення переможців
            participants = participants_response.data
            winners_count = raffle.get("winners_count", 1)

            # Створюємо пул учасників на основі кількості жетонів
            draw_pool = []
            for participant in participants:
                telegram_id = participant.get("telegram_id")
                entry_count = participant.get("entry_count", 0)

                # Додаємо учасника в пул стільки разів, скільки у нього жетонів
                for _ in range(entry_count):
                    draw_pool.append(telegram_id)

            # Перемішуємо пул
            random.shuffle(draw_pool)

            # Вибираємо унікальних переможців
            winners = []
            selected_winners = set()

            # Обмежуємо кількість переможців
            unique_participants = set(p.get("telegram_id") for p in participants)
            max_winners = min(winners_count, len(unique_participants))

            for place in range(1, max_winners + 1):
                if not draw_pool:
                    break

                winner_id = None
                while draw_pool and winner_id is None:
                    candidate = random.choice(draw_pool)
                    if candidate not in selected_winners:
                        winner_id = candidate
                        selected_winners.add(winner_id)

                    while candidate in draw_pool:
                        draw_pool.remove(candidate)

                if winner_id:
                    # Визначаємо приз
                    prize_distribution = raffle.get("prize_distribution", {})
                    place_str = str(place)
                    prize_currency = raffle.get("prize_currency", "WINIX")
                    prize_info = prize_distribution.get(place_str, {"amount": 0, "currency": prize_currency})

                    winners.append({
                        "telegram_id": winner_id,
                        "place": place,
                        "prize_amount": prize_info.get("amount", 0),
                        "prize_currency": prize_info.get("currency", prize_currency)
                    })

            # Зберігаємо переможців та нараховуємо призи
            for winner in winners:
                try:
                    # Створюємо запис переможця
                    winner_data = {
                        "id": str(uuid.uuid4()),
                        "raffle_id": raffle_id,
                        "telegram_id": winner["telegram_id"],
                        "place": winner["place"],
                        "prize_amount": winner["prize_amount"],
                        "prize_currency": winner["prize_currency"],
                        "created_at": now.isoformat(),
                        "notification_sent": False
                    }

                    supabase.table("raffle_winners").insert(winner_data).execute()

                    # Нараховуємо виграш
                    user = get_user(winner["telegram_id"])
                    if user:
                        # Збільшуємо лічильник перемог
                        wins_count = int(user.get("wins_count", 0)) + 1
                        supabase.table("winix").update({"wins_count": wins_count}).eq("telegram_id",
                                                                                      winner["telegram_id"]).execute()

                        # Нараховуємо приз
                        balance = float(user.get("balance", 0))
                        new_balance = balance + float(winner["prize_amount"])
                        supabase.table("winix").update({"balance": new_balance}).eq("telegram_id",
                                                                                    winner["telegram_id"]).execute()

                        # Створюємо транзакцію для призу
                        transaction_data = {
                            "id": str(uuid.uuid4()),
                            "telegram_id": winner["telegram_id"],
                            "type": "prize",
                            "amount": float(winner["prize_amount"]),
                            "description": f"Виграш у розіграші '{raffle.get('title')}' - {winner['place']} місце",
                            "status": "completed",
                            "created_at": now.isoformat(),
                            "raffle_id": raffle_id
                        }

                        supabase.table("transactions").insert(transaction_data).execute()

                        # Перевіряємо, чи потрібно активувати бейдж переможця
                        if wins_count == 1 and not user.get("badge_winner", False):
                            supabase.table("winix").update({"badge_winner": True}).eq("telegram_id",
                                                                                      winner["telegram_id"]).execute()
                except Exception as e:
                    print(f"❌ Помилка обробки переможця {winner['telegram_id']}: {str(e)}")

            # Очищаємо кеш
            clear_cache(f"raffle_details_{raffle_id}")
            clear_cache("active_raffles")

            finished_count += 1
            finished_raffles.append({
                "raffle_id": raffle_id,
                "title": raffle.get("title"),
                "winners_count": len(winners)
            })

            print(f"✅ Розіграш {raffle_id} успішно завершено. Обрано {len(winners)} переможців.")

            # Нараховуємо винагороди за участь
            if raffle.get("participation_reward", 0) > 0:
                print(f"⏳ Нарахування винагород за участь у розіграші {raffle_id}")
                process_participation_rewards(raffle_id)

        except Exception as e:
            print(f"❌ Помилка завершення розіграшу {raffle_id}: {str(e)}")
            errors.append({
                "raffle_id": raffle_id,
                "error": str(e)
            })

    # Формуємо результат
    result = {
        "status": "success",
        "message": f"Автоматично завершено {finished_count} розіграшів",
        "finished_count": finished_count,
        "finished_raffles": finished_raffles,
        "errors": errors,
        "total_expired": len(expired_raffles_response.data)
    }

    print(f"✅ Успішно завершено {finished_count} прострочених розіграшів")

    if errors:
        print("\nПомилки:")
        for error in errors:
            print(f"- {error}")

    return result


if __name__ == "__main__":
    # Виконуємо перевірку
    finish_expired_raffles()