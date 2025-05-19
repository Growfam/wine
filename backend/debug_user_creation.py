#!/usr/bin/env python3
"""
Простий тест створення користувача для діагностики проблем.
"""

import requests
import json
import time

API_BASE_URL = "http://localhost:8080"
TEST_USER_ID = f"debug_user_{int(time.time())}"

print("🔍 Діагностика створення користувача...")

# 1. Перевірка доступності сервера
print(f"\n1. Перевірка сервера {API_BASE_URL}")
try:
    response = requests.get(f"{API_BASE_URL}/api/health", timeout=5)
    print(f"   ✅ Сервер доступний: {response.status_code}")
    print(f"   📄 Відповідь: {response.json()}")
except Exception as e:
    print(f"   ❌ Сервер недоступний: {e}")
    exit(1)

# 2. Перевірка ендпоінту створення користувача
print(f"\n2. Тест створення користувача {TEST_USER_ID}")
create_data = {
    "telegram_id": TEST_USER_ID,
    "username": "Debug User",
    "referrer_id": None
}

try:
    response = requests.post(
        f"{API_BASE_URL}/api/user/create",
        json=create_data,
        headers={'Content-Type': 'application/json'},
        timeout=10
    )
    
    print(f"   📊 Статус код: {response.status_code}")
    print(f"   📄 Headers: {dict(response.headers)}")
    
    try:
        response_data = response.json()
        print(f"   📄 Відповідь JSON:")
        print(json.dumps(response_data, indent=4, ensure_ascii=False))
    except:
        print(f"   📄 Відповідь (текст): {response.text}")
        
    if response.status_code in [200, 201]:
        print("   ✅ Створення користувача успішне!")
    else:
        print("   ❌ Створення користувача не вдалося")
        
except Exception as e:
    print(f"   ❌ Помилка запиту: {e}")

# 3. Додаткова діагностика
print(f"\n3. Діагностика середовища")

# Перевірка debug ендпоінту
try:
    response = requests.get(f"{API_BASE_URL}/debug", timeout=10)
    if response.status_code == 200:
        debug_data = response.json()
        print("   ✅ Debug ендпоінт працює")
        
        # Supabase статус
        supabase_test = debug_data.get('environment', {}).get('supabase_test', {})
        print(f"   🔗 Supabase: {'✅' if supabase_test.get('success') else '❌'} {supabase_test.get('message', '')}")
        
        # Маршрути
        routes = debug_data.get('routes', [])
        user_routes = [r for r in routes if '/api/user' in r.get('path', '')]
        print(f"   🛣️  Маршрути користувачів знайдено: {len(user_routes)}")
        for route in user_routes[:5]:  # Показуємо перші 5
            print(f"      - {route.get('methods', [])} {route.get('path', '')}")
    else:
        print(f"   ⚠️ Debug ендпоінт недоступний: {response.status_code}")
except Exception as e:
    print(f"   ❌ Помилка debug: {e}")

# 4. Перевірка специфічного тестового ендпоінту
print(f"\n4. Тест спеціального ендпоінту")
try:
    response = requests.get(f"{API_BASE_URL}/api/test/user-creation", timeout=10)
    print(f"   📊 Статус: {response.status_code}")
    if response.status_code == 200:
        data = response.json()
        print(f"   ✅ Тестовий ендпоінт працює")
        print(f"   📄 Результат тесту:")
        print(json.dumps(data, indent=4, ensure_ascii=False))
    else:
        print(f"   ❌ Тестовий ендпоінт не працює: {response.text}")
except Exception as e:
    print(f"   ❌ Помилка тестового ендпоінту: {e}")

print(f"\n✅ Діагностика завершена")

# 5. Рекомендації
print(f"\n💡 Якщо створення користувача не працює:")
print("   1. Перевірте, чи запущений Flask сервер")
print("   2. Перевірте логи сервера (python main.py)")
print("   3. Переконайтеся, що змінні Supabase налаштовані в .env")
print("   4. Перевірте підключення до інтернету")
print("   5. Спробуйте перезапустити сервер")


