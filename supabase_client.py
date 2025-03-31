import os
from supabase import create_client, Client
from dotenv import load_dotenv

# Завантаження .env
load_dotenv()

# Дані з .env
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY")

# Ініціалізація клієнта
supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)

# Отримати користувача по telegram_id
def get_user(telegram_id: str):
    res = supabase.table("Winix").select("*").eq("telegram_id", telegram_id).execute()
    return res.data[0] if res.data else None

# Створити користувача
def create_user(telegram_id: str, username: str, referrer_id: int = None):
    if get_user(telegram_id):
        return get_user(telegram_id)

    data = {
        "telegram_id": telegram_id,
        "username": username,
        "balance": 0,
        "referrer_id": referrer_id
    }

    res = supabase.table("Winix").insert(data).execute()
    return res.data[0]

# Оновити баланс
def update_balance(telegram_id: str, amount: float):
    user = get_user(telegram_id)
    if not user:
        print("❌ Користувача не знайдено")
        return None

    new_balance = float(user["balance"]) + amount
    res = supabase.table("Winix").update({"balance": new_balance}).eq("telegram_id", telegram_id).execute()
    return res.data[0]

# Отримати баланс
def get_balance(telegram_id: str):
    user = get_user(telegram_id)
    return float(user["balance"]) if user else 0