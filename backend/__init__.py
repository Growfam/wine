# Експортуємо основні функції supabase_client для спрощеного імпорту
from .supabase_client import (
    supabase, get_user, update_user, update_balance,
    update_coins, check_and_update_badges,
    create_user, force_create_user
)