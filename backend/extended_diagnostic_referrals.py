#!/usr/bin/env python3
"""
Виправлений діагностичний скрипт для реферальної системи WINIX
Використовує Flask контекст для уникнення помилок
"""

import sys
import os

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

# Створюємо Flask додаток для контексту
from flask import Flask

app = Flask(__name__)

# Імпортуємо все необхідне в контексті додатку
with app.app_context():
    from supabase_client import supabase
    from referrals.controllers.referral_controller import ReferralController
    from referrals.controllers.bonus_controller import BonusController
    from referrals.controllers.earnings_controller import EarningsController
    from referrals.controllers.activity_controller import ActivityController
    from referrals.controllers.analytics_controller import AnalyticsController
    from referrals.controllers.draw_controller import DrawController
    from referrals.controllers.history_controller import HistoryController
    from badges.controllers.badge_controller import BadgeController
    from badges.controllers.task_controller import TaskController
    import json
    from datetime import datetime


    def print_section(title):
        print(f"\n{'=' * 60}")
        print(f"=== {title} ===")
        print('=' * 60)


    def print_json(data):
        print(json.dumps(data, indent=2, ensure_ascii=False))


    def test_all_controllers(user_id):
        """Тестує всі контролери реферальної системи"""

        print(f"\n🔍 РОЗШИРЕНА ДІАГНОСТИКА ДЛЯ КОРИСТУВАЧА {user_id}")

        # 1. BONUS CONTROLLER
        print_section("BONUS CONTROLLER")
        try:
            bonus_history = BonusController.get_bonus_history(user_id)
            print(f"✅ Історія бонусів: {bonus_history['total_bonuses']} бонусів, сума: {bonus_history['total_amount']}")
            if bonus_history['bonuses']:
                print("Останній бонус:")
                print_json(bonus_history['bonuses'][0])
        except Exception as e:
            print(f"❌ Помилка BonusController: {str(e)}")

        # 2. EARNINGS CONTROLLER
        print_section("EARNINGS CONTROLLER")
        try:
            # Заробітки рефералів
            earnings = EarningsController.get_referral_earnings(user_id)
            print(f"✅ Заробітки рефералів:")
            print(
                f"   - Level 1: {earnings['summary']['level1Count']} рефералів, заробіток: {earnings['summary']['level1TotalEarnings']}")
            print(
                f"   - Level 2: {earnings['summary']['level2Count']} рефералів, заробіток: {earnings['summary']['level2TotalEarnings']}")

            # Загальна сума заробітків
            earnings_summary = EarningsController.get_earnings_summary(user_id)
            print(f"✅ Загальні заробітки:")
            print_json(earnings_summary['total_earnings'])
        except Exception as e:
            print(f"❌ Помилка EarningsController: {str(e)}")

        # 3. ACTIVITY CONTROLLER
        print_section("ACTIVITY CONTROLLER")
        try:
            # Активність рефералів
            activity = ActivityController.get_referral_activity(user_id)
            print(f"✅ Активність рефералів:")
            print(f"   - Level 1: {len(activity['level1Activity'])} рефералів")
            print(f"   - Level 2: {len(activity['level2Activity'])} рефералів")

            # Зведена статистика
            summary = ActivityController.get_activity_summary(user_id)
            print(f"✅ Статистика активності:")
            print(f"   - Всього рефералів: {summary['totalReferrals']}")
            print(f"   - Активних: {summary['activeReferrals']}")
            print(f"   - Конверсія: {summary['conversionRate']:.2f}%")
        except Exception as e:
            print(f"❌ Помилка ActivityController: {str(e)}")

        # 4. ANALYTICS CONTROLLER
        print_section("ANALYTICS CONTROLLER")
        try:
            # Загальні заробітки
            total_earnings = AnalyticsController.get_total_earnings(user_id)
            print(f"✅ Аналітика заробітків:")
            print_json(total_earnings)

            # Топ рефералів
            top_referrals = AnalyticsController.get_top_referrals(user_id, limit=3)
            print(f"✅ Топ-3 рефералів:")
            for ref in top_referrals.get('top_referrals', []):
                print(f"   - {ref['id']}: заробіток {ref.get('earnings', 0)}")
        except Exception as e:
            print(f"❌ Помилка AnalyticsController: {str(e)}")

        # 5. DRAW CONTROLLER
        print_section("DRAW CONTROLLER")
        try:
            # Перевіряємо участь рефералів в розіграшах
            draws_stats = DrawController.get_draws_participation_stats(user_id)
            print(f"✅ Статистика розіграшів:")
            print(f"   - Всього розіграшів: {draws_stats['totalDrawsCount']}")
            print(f"   - Участей: {draws_stats['totalParticipationCount']}")
            print(f"   - Виграшів: {draws_stats['totalWinCount']}")
            print(f"   - Загальний приз: {draws_stats['totalPrize']}")
        except Exception as e:
            print(f"❌ Помилка DrawController: {str(e)}")

        # 6. HISTORY CONTROLLER
        print_section("HISTORY CONTROLLER")
        try:
            # Історія подій
            history = HistoryController.get_referral_history(user_id, {'limit': 5})
            print(f"✅ Історія подій (останні 5):")
            print(f"   - Всього подій: {history['meta']['total_events']}")
            for event in history.get('history', [])[:3]:
                print(f"   - {event['type']}: {event.get('description', 'No description')}")
        except Exception as e:
            print(f"❌ Помилка HistoryController: {str(e)}")

        # 7. BADGE CONTROLLER
        print_section("BADGE CONTROLLER")
        try:
            # Бейджі користувача
            badges = BadgeController.get_user_badges(user_id)
            print(f"✅ Бейджі:")
            print(f"   - Всього рефералів: {badges['total_referrals']}")
            print(f"   - Отримано бейджів: {len(badges['badges'])}")
            print(f"   - Доступно бейджів: {len(badges['available_badges'])}")

            for badge in badges['badges']:
                print(f"   - {badge['badge_type']}: {'✅ Claimed' if badge['claimed'] else '❌ Not claimed'}")
        except Exception as e:
            print(f"❌ Помилка BadgeController: {str(e)}")

        # 8. TASK CONTROLLER
        print_section("TASK CONTROLLER")
        try:
            # Завдання користувача
            tasks = TaskController.get_user_tasks(user_id)
            print(f"✅ Завдання:")
            for task in tasks.get('tasks', []):
                progress = task.get('completion_percentage', 0)
                status = '✅' if task['completed'] else f"{progress}%"
                print(f"   - {task.get('title', task['task_type'])}: {status}")
        except Exception as e:
            print(f"❌ Помилка TaskController: {str(e)}")


    def check_table_data():
        """Перевіряє наявність даних в таблицях"""
        print_section("ПЕРЕВІРКА ДАНИХ В ТАБЛИЦЯХ")

        tables = [
            'referrals',
            'direct_bonuses',
            'percentage_rewards',
            'referral_activities',
            'user_badges',
            'user_tasks',
            'draws',
            'draw_participants'
        ]

        for table in tables:
            try:
                result = supabase.table(table).select("*", count='exact').limit(1).execute()
                count = result.count if hasattr(result, 'count') else len(result.data)
                print(f"✅ {table}: {count} записів")
            except Exception as e:
                print(f"❌ {table}: Помилка - {str(e)}")


    def main():
        print("РОЗШИРЕНА ДІАГНОСТИКА РЕФЕРАЛЬНОЇ СИСТЕМИ WINIX")
        print("=" * 60)

        # Перевірка даних в таблицях
        check_table_data()

        # Запит ID користувача
        user_id = input("\nВведіть ID користувача для детального тестування: ").strip()

        if user_id:
            test_all_controllers(user_id)

        print("\nДіагностика завершена!")


    if __name__ == "__main__":
        main()