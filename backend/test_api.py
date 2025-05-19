#!/usr/bin/env python3
"""
Виправлений тестовий скрипт для перевірки API користувачів.
"""

import requests
import json
import time

# Конфігурація
API_BASE_URL = "http://localhost:8080"
TEST_USER_ID = f"test_user_{int(time.time())}"
TEST_USERNAME = "Test User"


def test_api_endpoint(method, endpoint, data=None):
    """Тестує API ендпоінт"""
    url = f"{API_BASE_URL}{endpoint}"

    try:
        if method == "GET":
            response = requests.get(url, timeout=10)
        elif method == "POST":
            response = requests.post(url, json=data, timeout=10,
                                     headers={'Content-Type': 'application/json'})
        else:
            return {"success": False, "error": f"Unsupported method: {method}"}

        # Виправлена логіка обробки відповіді
        try:
            response_data = response.json() if response.content else None
        except:
            response_data = response.text if response.content else None

        return {
            "success": response.status_code in [200, 201],
            "status_code": response.status_code,
            "data": response_data,
            "error": response_data if response.status_code not in [200, 201] else None
        }
    except requests.exceptions.RequestException as e:
        return {"success": False, "error": str(e), "status_code": None, "data": None}
    except Exception as e:
        return {"success": False, "error": f"Unexpected error: {str(e)}", "status_code": None, "data": None}


def main():
    """Основна функція тестування"""
    print(f"🧪 Запуск тестів API для WINIX...")
    print(f"📡 URL: {API_BASE_URL}")
    print(f"👤 Тестовий користувач: {TEST_USER_ID}")
    print("=" * 50)

    tests = [
        # Перевірка статусу сервера
        {
            "name": "Server Health Check",
            "method": "GET",
            "endpoint": "/api/health"
        },

        # Перевірка статусу бота
        {
            "name": "Bot Status Check",
            "method": "GET",
            "endpoint": "/api/bot/status"
        },

        # Тестування підключення до бази даних
        {
            "name": "Database Connection Test",
            "method": "GET",
            "endpoint": "/debug"
        },

        # Створення користувача
        {
            "name": "User Creation",
            "method": "POST",
            "endpoint": "/api/user/create",
            "data": {
                "telegram_id": TEST_USER_ID,
                "username": TEST_USERNAME,
                "referrer_id": None
            }
        },

        # Отримання профілю користувача
        {
            "name": "Get User Profile",
            "method": "GET",
            "endpoint": f"/api/user/{TEST_USER_ID}"
        },

        # Перевірка існування користувача
        {
            "name": "Check User Exists",
            "method": "GET",
            "endpoint": f"/api/user/{TEST_USER_ID}/exists"
        },

        # Оновлення балансу
        {
            "name": "Update User Balance",
            "method": "POST",
            "endpoint": f"/api/user/{TEST_USER_ID}/balance",
            "data": {"balance": 100.0}
        },

        # Тест реферальної системи (якщо доступна)
        {
            "name": "Referral System Test",
            "method": "GET",
            "endpoint": f"/api/referrals/link/{TEST_USER_ID}"
        }
    ]

    passed = 0
    failed = 0

    for i, test in enumerate(tests, 1):
        print(f"\n🔍 {i}/{len(tests)} Тестуємо: {test['name']}")
        print(f"   {test['method']} {test['endpoint']}")

        result = test_api_endpoint(
            test['method'],
            test['endpoint'],
            test.get('data')
        )

        if result['success']:
            print(f"   ✅ ПРОЙДЕНО (Статус: {result['status_code']})")
            passed += 1

            # Виводимо дані відповіді для важливих тестів
            if test['name'] in ['User Creation', 'Get User Profile', 'Database Connection Test']:
                if result['data']:
                    try:
                        if isinstance(result['data'], str):
                            print(f"      Відповідь: {result['data'][:200]}...")
                        else:
                            formatted_data = json.dumps(result['data'], indent=6, ensure_ascii=False)
                            if len(formatted_data) > 500:
                                formatted_data = formatted_data[:500] + "..."
                            print(f"      Дані: {formatted_data}")
                    except:
                        print(f"      Дані: {result['data']}")
        else:
            print(f"   ❌ НЕ ПРОЙДЕНО")
            if 'status_code' in result and result['status_code']:
                print(f"      Статус: {result['status_code']}")
            if 'error' in result and result['error']:
                try:
                    if isinstance(result['error'], dict):
                        error_text = json.dumps(result['error'], indent=6, ensure_ascii=False)
                    else:
                        error_text = str(result['error'])
                    print(f"      Помилка: {error_text}")
                except:
                    print(f"      Помилка: {result.get('error', 'Unknown error')}")

            # Додаткова інформація для налагодження
            if result.get('data'):
                try:
                    if isinstance(result['data'], dict):
                        print(f"      Відповідь сервера: {json.dumps(result['data'], ensure_ascii=False)}")
                    else:
                        print(f"      Відповідь сервера: {result['data']}")
                except:
                    print(f"      Відповідь сервера: {result['data']}")

            failed += 1

    print("\n" + "=" * 50)
    print(f"📊 РЕЗУЛЬТАТИ ТЕСТУВАННЯ:")
    print(f"   ✅ Пройдено: {passed}")
    print(f"   ❌ Не пройдено: {failed}")
    print(f"   📈 Успішність: {passed / (passed + failed) * 100:.1f}%")

    if failed == 0:
        print("\n🎉 Всі тести пройдено! API готовий для роботи з ботом.")
        return True
    else:
        print(f"\n⚠️ {failed} тестів не пройдено. Перевірте конфігурацію API.")

        # Додаткові рекомендації
        print("\n💡 Рекомендації для діагностики:")
        print("   1. Перевірте, чи працює Flask сервер на http://localhost:8080")
        print("   2. Перевірте логи сервера на наявність помилок")
        print("   3. Переконайтеся, що Supabase правильно налаштована")
        print("   4. Перевірте .env файл на наявність всіх необхідних змінних")

        return False


def diagnose_connection():
    """Додаткова діагностика підключення"""
    print("\n🔧 ДОДАТКОВА ДІАГНОСТИКА:")

    # Перевірка доступності сервера
    try:
        response = requests.get(f"{API_BASE_URL}/api/ping", timeout=5)
        print(f"   ✅ Сервер доступний (ping: {response.status_code})")
    except:
        print(f"   ❌ Сервер недоступний на {API_BASE_URL}")
        return

    # Перевірка ендпоінту debug
    try:
        response = requests.get(f"{API_BASE_URL}/debug", timeout=10)
        if response.status_code == 200:
            debug_data = response.json()
            print(f"   ✅ Debug ендпоінт працює")

            # Перевіряємо статус Supabase
            supabase_test = debug_data.get('environment', {}).get('supabase_test', {})
            if supabase_test.get('success'):
                print(f"   ✅ Supabase підключення працює")
            else:
                print(f"   ❌ Проблема з Supabase: {supabase_test.get('message', 'Unknown')}")
        else:
            print(f"   ⚠️ Debug ендпоінт повернув статус: {response.status_code}")
    except Exception as e:
        print(f"   ❌ Помилка debug ендпоінту: {str(e)}")


if __name__ == "__main__":
    success = main()
    if not success:
        diagnose_connection()
    exit(0 if success else 1)