import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from supabase_client import supabase
import logging

logging.basicConfig(level=logging.DEBUG)
logger = logging.getLogger(__name__)


def test_user_referrals(user_id):
    """Тестує дані рефералів для конкретного користувача"""
    user_id_str = str(user_id)
    print(f"\n{'=' * 60}")
    print(f"ТЕСТУВАННЯ ДАНИХ ДЛЯ КОРИСТУВАЧА: {user_id_str}")
    print(f"{'=' * 60}\n")

    # 1. Перевірка користувача
    print("1. ПЕРЕВІРКА КОРИСТУВАЧА:")
    try:
        user_query = supabase.table("winix").select("telegram_id, username, balance").eq("telegram_id", user_id_str)
        user_result = user_query.execute()
        if user_result.data:
            print(f"   ✓ Користувач знайдений: {user_result.data[0]}")
        else:
            print(f"   ✗ Користувач НЕ знайдений!")
    except Exception as e:
        print(f"   ✗ ПОМИЛКА: {e}")

    # 2. Перевірка рефералів
    print("\n2. ПЕРЕВІРКА РЕФЕРАЛІВ:")
    try:
        # Level 1
        level1_query = supabase.table("referrals").select("*").eq("referrer_id", user_id_str).eq("level", 1)
        level1_result = level1_query.execute()
        print(f"   - Рефералів 1-го рівня: {len(level1_result.data)}")
        if level1_result.data:
            print(f"     Приклад: {level1_result.data[0]}")

        # Level 2
        level2_query = supabase.table("referrals").select("*").eq("referrer_id", user_id_str).eq("level", 2)
        level2_result = level2_query.execute()
        print(f"   - Рефералів 2-го рівня: {len(level2_result.data)}")
        if level2_result.data:
            print(f"     Приклад: {level2_result.data[0]}")

        # Всі
        all_query = supabase.table("referrals").select("*").eq("referrer_id", user_id_str)
        all_result = all_query.execute()
        print(f"   - Всього рефералів: {len(all_result.data)}")

    except Exception as e:
        print(f"   ✗ ПОМИЛКА: {e}")

    # 3. Перевірка бонусів
    print("\n3. ПЕРЕВІРКА БОНУСІВ:")
    try:
        bonuses_query = supabase.table("direct_bonuses").select("*").eq("referrer_id", user_id_str)
        bonuses_result = bonuses_query.execute()
        total_bonuses = sum(b.get('amount', 0) for b in bonuses_result.data)
        print(f"   - Кількість бонусів: {len(bonuses_result.data)}")
        print(f"   - Сума бонусів: {total_bonuses}")
    except Exception as e:
        print(f"   ✗ ПОМИЛКА: {e}")

    # 4. Перевірка активностей
    print("\n4. ПЕРЕВІРКА АКТИВНОСТЕЙ:")
    try:
        if all_result.data:
            referee_ids = [ref['referee_id'] for ref in all_result.data[:5]]  # перші 5
            activities_query = supabase.table("referral_activities").select("*").in_("user_id", referee_ids)
            activities_result = activities_query.execute()
            print(f"   - Знайдено активностей: {len(activities_result.data)}")
            if activities_result.data:
                print(f"     Приклад: {activities_result.data[0]}")
    except Exception as e:
        print(f"   ✗ ПОМИЛКА: {e}")

    print(f"\n{'=' * 60}\n")


# Використання
if __name__ == "__main__":
    # Замініть на ваш реальний user_id
    TEST_USER_ID = "YOUR_USER_ID"
    test_user_referrals(TEST_USER_ID)