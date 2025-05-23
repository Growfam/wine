#!/usr/bin/env python3
"""
Тест API реферальної системи
"""
import requests
import json


def test_referral_api(user_id):
    base_url = "http://localhost:8080"  # Змініть на ваш URL

    print(f"\n🔍 Тестування API для користувача {user_id}")

    # 1. Тест статистики
    print("\n📊 Тест /api/referrals/stats/")
    try:
        response = requests.get(f"{base_url}/api/referrals/stats/{user_id}")
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"Success: {data.get('success', False)}")
            if 'statistics' in data:
                print(f"Статистика: {json.dumps(data['statistics'], indent=2)}")
            if 'referrals' in data:
                print(f"Рефералів L1: {len(data['referrals'].get('level1', []))}")
                print(f"Рефералів L2: {len(data['referrals'].get('level2', []))}")
        else:
            print(f"Помилка: {response.text}")
    except Exception as e:
        print(f"Помилка запиту: {e}")

    # 2. Тест бейджів
    print("\n🏆 Тест /api/badges/")
    try:
        response = requests.get(f"{base_url}/api/badges/{user_id}")
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            print(f"Бейджів: {data.get('total_badges', 0)}")
            print(f"Доступних: {len(data.get('available_badges', []))}")
            if data.get('badges'):
                for badge in data['badges']:
                    print(f"  - {badge['badge_type']}: {'✅ Claimed' if badge['claimed'] else '❌ Not claimed'}")
    except Exception as e:
        print(f"Помилка запиту: {e}")

    # 3. Тест завдань
    print("\n📋 Тест /api/tasks/")
    try:
        response = requests.get(f"{base_url}/api/tasks/{user_id}")
        print(f"Status: {response.status_code}")
        if response.status_code == 200:
            data = response.json()
            if data.get('tasks'):
                for task in data['tasks']:
                    progress = task.get('completion_percentage', 0)
                    print(f"  - {task['task_type']}: {progress}% ({'✅' if task['completed'] else '❌'})")
    except Exception as e:
        print(f"Помилка запиту: {e}")


if __name__ == "__main__":
    user_id = input("Введіть ID користувача: ").strip()
    if user_id:
        test_referral_api(user_id)