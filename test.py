from supabase_client import create_user, get_user, update_balance, get_balance

telegram_id = "123456"
username = "testuser"

create_user(telegram_id, username, referrer_id=None)
print("Баланс до:", get_balance(telegram_id))

update_balance(telegram_id, 10)
print("Баланс після:", get_balance(telegram_id))