#!/usr/bin/env python
"""
Скрипт для створення спеціальних розіграшів: Jackpot та Щоденний розіграш з токеном $Winix
Використовує прямий доступ до бази даних замість API
"""

import os
import sys
import uuid
import re
from datetime import datetime, timedelta, timezone
from typing import Dict

# Додаємо поточну директорію до шляху для імпорту модулів
current_dir = os.path.dirname(os.path.abspath(__file__))
if current_dir not in sys.path:
    sys.path.append(current_dir)

# Додаємо батьківську директорію для імпорту supabase_client
parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if parent_dir not in sys.path:
    sys.path.append(parent_dir)

# Імпортуємо supabase_client напряму
try:
    from supabase_client import supabase

    print("✅ Supabase client успішно імпортовано")
except ImportError as e:
    print(f"❌ Помилка імпорту supabase_client: {e}")
    print(f"Пошук у: {parent_dir}")
    print(f"Доступні файли: {os.listdir(parent_dir)}")
    sys.exit(1)


def create_jackpot_raffle(admin_id: str, duration_days: int = 7) -> Dict:
    """
    Створення Jackpot розіграшу напряму через базу даних

    Args:
        admin_id: ID адміністратора
        duration_days: Тривалість розіграшу в днях

    Returns:
        Dict: Створений розіграш
    """
    title = "JACKPOT РОЗІГРАШ"
    description = """
🎰 ВЕЛИКИЙ JACKPOT РОЗІГРАШ 🎰

Головний приз: $250 USD + 550,000 $Winix токенів!

💰 10 ПЕРЕМОЖЦІВ 💰
• 1-5 місце: Грошові винагороди (частина від $250)
• 6-10 місце: $Winix токени

✨ БОНУС ДЛЯ ВСІХ УЧАСНИКІВ ✨
Кожен учасник гарантовано отримає 550 $Winix токенів після завершення розіграшу!

Вартість участі: 3 жетони
Тривалість: {duration_days} днів
    """.format(duration_days=duration_days)

    # Визначаємо розподіл призів
    prize_distribution = {
        # Грошові призи (у USD)
        "1": {"amount": 100, "currency": "USD"},
        "2": {"amount": 70, "currency": "USD"},
        "3": {"amount": 40, "currency": "USD"},
        "4": {"amount": 25, "currency": "USD"},
        "5": {"amount": 15, "currency": "USD"},

        # Призи в токенах ($Winix)
        "6": {"amount": 150000, "currency": "$Winix"},
        "7": {"amount": 120000, "currency": "$Winix"},
        "8": {"amount": 100000, "currency": "$Winix"},
        "9": {"amount": 90000, "currency": "$Winix"},
        "10": {"amount": 90000, "currency": "$Winix"}
    }

    # Обчислюємо загальну суму призів в токенах
    total_winix = sum(prize["amount"] for place, prize in prize_distribution.items()
                      if prize["currency"] == "$Winix")

    # Генеруємо ID та час
    raffle_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    start_time = now.isoformat()
    end_time = (now + timedelta(days=duration_days)).isoformat()

    # Створюємо дані розіграшу з правильними назвами колонок
    raffle_data = {
        "id": raffle_id,
        "title": title,
        "description": description,
        "prize": 250,  # Сума призу
        "prize_currency": "USD + $Winix",
        "entry_fee": 3,
        "winners_count": 10,
        "start_time": start_time,
        "end_time": end_time,
        "is_daily": False,
        "status": "active",
        "participants_count": 0,
        "prize_distribution": prize_distribution,
        "jackpot_mode": True,
        "participation_reward": 550,
        "participation_reward_currency": "$Winix",
        "total_winix_pool": total_winix,
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
        "created_by": admin_id,
        "raffle_type": "jackpot"  # Додаємо тип розіграшу
    }

    # Створюємо розіграш напряму через Supabase
    try:
        response = supabase.table("raffles").insert(raffle_data).execute()
        if response.data:
            print(f"✅ Jackpot розіграш успішно створено через базу даних")
            return response.data[0]
        else:
            print(f"❌ Помилка створення Jackpot розіграшу: відсутні дані у відповіді")
            return {"status": "error", "message": "Відсутні дані у відповіді від бази даних"}
    except Exception as e:
        print(f"❌ Помилка створення Jackpot розіграшу через базу даних: {str(e)}")
        return {"status": "error", "message": str(e)}


def create_daily_raffle(admin_id: str) -> Dict:
    """
    Створення щоденного розіграшу напряму через базу даних

    Args:
        admin_id: ID адміністратора

    Returns:
        Dict: Створений розіграш
    """
    today = datetime.now().strftime("%d.%m.%Y")
    title = f"ЩОДЕННИЙ РОЗІГРАШ {today}"
    description = """
🎁 ЩОДЕННИЙ РОЗІГРАШ 🎁

Призовий фонд: 90,000 $Winix токенів!

💰 15 ПЕРЕМОЖЦІВ 💰
Розподіл призів відповідно до зайнятого місця.

✨ БОНУС ДЛЯ ВСІХ УЧАСНИКІВ ✨
Кожен учасник гарантовано отримає 200 $Winix токенів після завершення розіграшу!

Вартість участі: 1 жетон
Тривалість: 24 години
    """

    # Визначаємо розподіл призів для 15 переможців (сума: 90,000 $Winix)
    prize_distribution = {}

    # Перші 3 місця отримують більші призи
    prize_distribution["1"] = {"amount": 15000, "currency": "$Winix"}  # 15,000 $Winix
    prize_distribution["2"] = {"amount": 12000, "currency": "$Winix"}  # 12,000 $Winix
    prize_distribution["3"] = {"amount": 10000, "currency": "$Winix"}  # 10,000 $Winix

    # Місця 4-7 отримують середні призи
    for place in range(4, 8):
        prize_distribution[str(place)] = {"amount": 7000, "currency": "$Winix"}  # 7,000 $Winix (загалом 28,000)

    # Місця 8-15 отримують менші призи
    remaining_prize = 25000  # 90,000 - 15,000 - 12,000 - 10,000 - 28,000 = 25,000
    individual_prize = int(remaining_prize / 8)  # розділити порівну на 8 останніх місць

    for place in range(8, 16):
        prize_distribution[str(place)] = {"amount": individual_prize,
                                          "currency": "$Winix"}  # приблизно 3,125 $Winix кожному

    # Генеруємо ID та час
    raffle_id = str(uuid.uuid4())
    now = datetime.now(timezone.utc)
    start_time = now.isoformat()
    end_time = (now + timedelta(hours=24)).isoformat()

    # Створюємо дані розіграшу з правильними назвами колонок
    raffle_data = {
        "id": raffle_id,
        "title": title,
        "description": description,
        "prize": 90000,  # Сума призу
        "prize_currency": "$Winix",
        "entry_fee": 1,
        "winners_count": 15,
        "start_time": start_time,
        "end_time": end_time,
        "is_daily": True,
        "status": "active",
        "participants_count": 0,
        "prize_distribution": prize_distribution,
        "jackpot_mode": False,
        "participation_reward": 200,
        "participation_reward_currency": "$Winix",
        "created_at": now.isoformat(),
        "updated_at": now.isoformat(),
        "created_by": admin_id,
        "raffle_type": "daily"  # Додаємо тип розіграшу
    }

    # Створюємо розіграш напряму через Supabase
    try:
        response = supabase.table("raffles").insert(raffle_data).execute()
        if response.data:
            print(f"✅ Щоденний розіграш успішно створено через базу даних")
            return response.data[0]
        else:
            print(f"❌ Помилка створення щоденного розіграшу: відсутні дані у відповіді")
            return {"status": "error", "message": "Відсутні дані у відповіді від бази даних"}
    except Exception as e:
        print(f"❌ Помилка створення щоденного розіграшу через базу даних: {str(e)}")
        return {"status": "error", "message": str(e)}


def clean_input(input_str):
    """Очищує вхідний рядок від непотрібних символів"""
    # Видаляємо всі нецифрові символи
    return re.sub(r'[^\d]', '', input_str)


if __name__ == "__main__":
    # Отримуємо ADMIN_ID з середовища
    admin_id = os.getenv("ADMIN_ID")

    if not admin_id:
        print("❌ ПОМИЛКА: ADMIN_ID не вказано в середовищі")
        print("Встановіть змінну середовища ADMIN_ID перед запуском")
        print("Наприклад: export ADMIN_ID=7066583465")
        sys.exit(1)

    # Виводимо інформацію для діагностики
    print(f"👤 Використовується ADMIN_ID: {admin_id}")
    print(f"📁 Поточна директорія: {os.getcwd()}")

    # Вибір типу розіграшу для створення
    print("\n🎲 Оберіть розіграш для створення:")
    print("1. Jackpot розіграш")
    print("2. Щоденний розіграш")
    print("3. Обидва розіграші")

    choice = input("Ваш вибір (1/2/3): ").strip()

    if choice == "1" or choice == "3":
        # Створюємо Jackpot розіграш
        try:
            # Використовуємо безпечний ввід для тривалості розіграшу
            duration_input = input("Тривалість Jackpot розіграшу в днях [7]: ").strip()

            # Встановлюємо значення за замовчуванням, якщо введено порожній рядок
            if not duration_input:
                duration_days = 7
            else:
                # Очищуємо ввід від непотрібних символів
                clean_duration = clean_input(duration_input)

                # Переконуємося, що є цифри для конвертації
                if clean_duration:
                    duration_days = int(clean_duration)
                else:
                    duration_days = 7
                    print("⚠️ Використовуємо значення за замовчуванням: 7 днів")

            print(f"⏳ Створення Jackpot розіграшу тривалістю {duration_days} днів...")
            jackpot_result = create_jackpot_raffle(admin_id, duration_days)
            if jackpot_result and "id" in jackpot_result:
                print(f"✅ Jackpot розіграш успішно створено з ID: {jackpot_result.get('id')}")
            else:
                print(f"❌ Помилка створення Jackpot розіграшу: {jackpot_result}")
        except Exception as e:
            print(f"❌ Помилка: {str(e)}")

    if choice == "2" or choice == "3":
        # Створюємо щоденний розіграш
        try:
            print("\n⏳ Створення щоденного розіграшу...")
            daily_result = create_daily_raffle(admin_id)
            if daily_result and "id" in daily_result:
                print(f"✅ Щоденний розіграш успішно створено з ID: {daily_result.get('id')}")
            else:
                print(f"❌ Помилка створення щоденного розіграшу: {daily_result}")
        except Exception as e:
            print(f"❌ Помилка: {str(e)}")

    if choice not in ["1", "2", "3"]:
        print("❌ Невірний вибір. Спробуйте знову.")