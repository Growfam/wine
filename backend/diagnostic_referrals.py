# diagnostic_referrals.py
"""
Діагностичний скрипт для перевірки реферальної системи
Запускати з кореневої директорії проекту: python diagnostic_referrals.py
"""

import os
import sys

sys.path.append(os.path.dirname(os.path.abspath(__file__)))

from flask import Flask
from database import db
from models.referral import Referral
from models.direct_bonus import DirectBonus
from models.activity import ReferralActivity
from models.percentage_reward import PercentageReward
import json

app = Flask(__name__)
app.config['SQLALCHEMY_DATABASE_URI'] = os.getenv('DATABASE_URL', 'sqlite:///winix.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

db.init_app(app)


def check_data_types():
    """Перевіряє типи даних в базі"""
    with app.app_context():
        print("=== ПЕРЕВІРКА ТИПІВ ДАНИХ ===\n")

        # Перевірка таблиці referrals
        print("1. Таблиця referrals:")
        referrals = Referral.query.limit(5).all()
        for ref in referrals:
            print(f"   ID: {ref.id}, referrer_id: {ref.referrer_id} (тип: {type(ref.referrer_id).__name__}), "
                  f"referee_id: {ref.referee_id} (тип: {type(ref.referee_id).__name__})")

        # Перевірка таблиці direct_bonuses
        print("\n2. Таблиця direct_bonuses:")
        bonuses = DirectBonus.query.limit(5).all()
        for bonus in bonuses:
            print(f"   ID: {bonus.id}, referrer_id: {bonus.referrer_id} (тип: {type(bonus.referrer_id).__name__}), "
                  f"referee_id: {bonus.referee_id} (тип: {type(bonus.referee_id).__name__})")

        # Перевірка таблиці referral_activities
        print("\n3. Таблиця referral_activities:")
        activities = ReferralActivity.query.limit(5).all()
        for act in activities:
            print(f"   ID: {act.id}, user_id: {act.user_id} (тип: {type(act.user_id).__name__})")

        # Перевірка таблиці percentage_rewards
        print("\n4. Таблиця percentage_rewards:")
        rewards = PercentageReward.query.limit(5).all()
        for reward in rewards:
            print(f"   ID: {reward.id}, user_id: {reward.user_id} (тип: {type(reward.user_id).__name__}), "
                  f"referral_id: {reward.referral_id} (тип: {type(reward.referral_id).__name__})")


def check_referral_links():
    """Перевіряє цілісність реферальних зв'язків"""
    with app.app_context():
        print("\n\n=== ПЕРЕВІРКА РЕФЕРАЛЬНИХ ЗВ'ЯЗКІВ ===\n")

        # Підрахунок рефералів
        total_referrals = Referral.query.count()
        level1_referrals = Referral.query.filter_by(level=1).count()
        level2_referrals = Referral.query.filter_by(level=2).count()

        print(f"Загальна кількість рефералів: {total_referrals}")
        print(f"Рефералів 1-го рівня: {level1_referrals}")
        print(f"Рефералів 2-го рівня: {level2_referrals}")

        # Перевірка бонусів без реферальних зв'язків
        orphan_bonuses = []
        bonuses = DirectBonus.query.all()
        for bonus in bonuses:
            referral = Referral.query.filter_by(
                referrer_id=str(bonus.referrer_id),
                referee_id=str(bonus.referee_id),
                level=1
            ).first()
            if not referral:
                orphan_bonuses.append(bonus)

        if orphan_bonuses:
            print(f"\n⚠️  Знайдено {len(orphan_bonuses)} бонусів без реферальних зв'язків!")
            for bonus in orphan_bonuses[:5]:
                print(f"   Бонус ID: {bonus.id}, referrer: {bonus.referrer_id}, referee: {bonus.referee_id}")


def test_api_endpoint(user_id):
    """Тестує API endpoint для отримання структури рефералів"""
    with app.app_context():
        print(f"\n\n=== ТЕСТ API ДЛЯ КОРИСТУВАЧА {user_id} ===\n")

        from referrals.controllers.referral_controller import ReferralController

        # Генеруємо реферальне посилання
        link_result = ReferralController.generate_referral_link(user_id)
        print(f"1. Реферальне посилання: {json.dumps(link_result, indent=2)}")

        # Отримуємо структуру рефералів
        structure_result = ReferralController.get_referral_structure(user_id)
        print(f"\n2. Структура рефералів:")
        if structure_result.get('success'):
            stats = structure_result.get('statistics', {})
            print(f"   - Всього рефералів: {stats.get('totalReferrals', 0)}")
            print(f"   - Рівень 1: {stats.get('level1Count', 0)}")
            print(f"   - Рівень 2: {stats.get('level2Count', 0)}")
            print(f"   - Активних: {stats.get('activeReferrals', 0)}")

            # Виводимо перших кілька рефералів
            refs = structure_result.get('referrals', {})
            if refs.get('level1'):
                print("\n   Реферали 1-го рівня (перші 3):")
                for ref in refs['level1'][:3]:
                    print(f"     {json.dumps(ref, indent=6)}")
        else:
            print(f"   Помилка: {structure_result.get('error')}")


def check_supabase_connection():
    """Перевіряє з'єднання з Supabase"""
    print("\n\n=== ПЕРЕВІРКА З'ЄДНАННЯ З SUPABASE ===\n")
    try:
        from supabase_client import supabase

        # Спробуємо отримати дані користувача
        response = supabase.table("winix").select("telegram_id, username, balance").limit(5).execute()

        if response.data:
            print("✅ З'єднання з Supabase успішне!")
            print("Приклад даних користувачів:")
            for user in response.data:
                print(
                    f"   ID: {user.get('telegram_id')}, Username: {user.get('username')}, Balance: {user.get('balance')}")
        else:
            print("⚠️  З'єднання встановлено, але даних не знайдено")
    except Exception as e:
        print(f"❌ Помилка з'єднання з Supabase: {str(e)}")


if __name__ == "__main__":
    print("ДІАГНОСТИКА РЕФЕРАЛЬНОЇ СИСТЕМИ WINIX")
    print("=" * 50)

    # Виконуємо перевірки
    check_data_types()
    check_referral_links()

    # Перевірка Supabase
    check_supabase_connection()

    # Тест API для конкретного користувача
    test_user_id = input("\n\nВведіть ID користувача для тестування API (або Enter для пропуску): ").strip()
    if test_user_id:
        test_api_endpoint(test_user_id)

    print("\n\nДіагностика завершена!")