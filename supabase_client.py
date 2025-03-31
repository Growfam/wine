import os
from supabase import create_client, Client
from dotenv import load_dotenv

# Завантаження .env
load_dotenv()

# Дані з .env
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY")

# Перевірка наявності критичних змінних
if not SUPABASE_URL or not SUPABASE_KEY:
    print("⚠️ УВАГА: Відсутні змінні середовища SUPABASE_URL або SUPABASE_ANON_KEY")

# Ініціалізація клієнта
try:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    print("✅ Успішне підключення до Supabase")
except Exception as e:
    print(f"❌ Помилка підключення до Supabase: {str(e)}")
    supabase = None


# Отримати користувача по telegram_id
def get_user(telegram_id: str):
    try:
        if not supabase:
            print("❌ Клієнт Supabase не ініціалізовано")
            return None

        res = supabase.table("Winix").select("*").eq("telegram_id", telegram_id).execute()
        return res.data[0] if res.data else None
    except Exception as e:
        print(f"❌ Помилка отримання користувача {telegram_id}: {str(e)}")
        return None


# Створити користувача
def create_user(telegram_id: str, username: str, referrer_id: int = None):
    try:
        if not supabase:
            print("❌ Клієнт Supabase не ініціалізовано")
            return None

        # Перевіряємо, чи користувач вже існує
        existing_user = get_user(telegram_id)
        if existing_user:
            return existing_user

        # Створюємо нового користувача з полем page1_completed
        data = {
            "telegram_id": telegram_id,
            "username": username,
            "balance": 0,
            "referrer_id": referrer_id,
            "page1_completed": False  # Додаємо поле за замовчуванням
        }

        res = supabase.table("Winix").insert(data).execute()
        print(f"✅ Створено нового користувача: {telegram_id}")
        return res.data[0] if res.data else None
    except Exception as e:
        print(f"❌ Помилка створення користувача {telegram_id}: {str(e)}")
        return None


# Оновити баланс
def update_balance(telegram_id: str, amount: float):
    try:
        if not supabase:
            print("❌ Клієнт Supabase не ініціалізовано")
            return None

        user = get_user(telegram_id)
        if not user:
            print(f"❌ Користувача {telegram_id} не знайдено")
            return None

        new_balance = float(user["balance"]) + amount
        res = supabase.table("Winix").update({"balance": new_balance}).eq("telegram_id", telegram_id).execute()
        print(f"✅ Оновлено баланс користувача {telegram_id}: +{amount}, новий баланс: {new_balance}")
        return res.data[0] if res.data else None
    except Exception as e:
        print(f"❌ Помилка оновлення балансу {telegram_id}: {str(e)}")
        return None


# Отримати баланс
def get_balance(telegram_id: str):
    try:
        user = get_user(telegram_id)
        return float(user["balance"]) if user else 0
    except Exception as e:
        print(f"❌ Помилка отримання балансу {telegram_id}: {str(e)}")
        return 0