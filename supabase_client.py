import os
from supabase import create_client, Client
from dotenv import load_dotenv
import logging

# Налаштування логування
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Завантаження .env
load_dotenv()

# Дані з .env
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY")

# Перевірка наявності критичних змінних
if not SUPABASE_URL or not SUPABASE_KEY:
    logger.warning("⚠️ УВАГА: Відсутні змінні середовища SUPABASE_URL або SUPABASE_ANON_KEY")

# Ініціалізація клієнта
try:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    logger.info("✅ Успішне підключення до Supabase")
except Exception as e:
    logger.error(f"❌ Помилка підключення до Supabase: {str(e)}")
    supabase = None


# Отримати користувача по telegram_id
def get_user(telegram_id: str):
    try:
        if not supabase:
            logger.error("❌ Клієнт Supabase не ініціалізовано")
            return None

        res = supabase.table("Winix").select("*").eq("telegram_id", telegram_id).execute()
        return res.data[0] if res.data else None
    except Exception as e:
        logger.error(f"❌ Помилка отримання користувача {telegram_id}: {str(e)}")
        return None


# Створити користувача
def create_user(telegram_id: str, username: str, referrer_id: str = None):
    try:
        if not supabase:
            logger.error("❌ Клієнт Supabase не ініціалізовано")
            return None

        # Перевіряємо, чи користувач вже існує
        existing_user = get_user(telegram_id)
        if existing_user:
            return existing_user

        # Створюємо нового користувача з усіма необхідними полями
        data = {
            "telegram_id": telegram_id,
            "username": username,
            "balance": 0,  # початковий баланс WINIX
            "coins": 3,  # початкова кількість жетонів
            "referrer_id": referrer_id,
            "page1_completed": False,
            "newbie_bonus_claimed": False,
            "participations_count": 0,
            "badge_winner": False,
            "badge_beginner": False,
            "badge_rich": False,
            "wins_count": 0  # кількість виграшів
        }

        res = supabase.table("Winix").insert(data).execute()
        logger.info(f"✅ Створено нового користувача: {telegram_id}")
        return res.data[0] if res.data else None
    except Exception as e:
        logger.error(f"❌ Помилка створення користувача {telegram_id}: {str(e)}")
        return None


# Оновити баланс
def update_balance(telegram_id: str, amount: float):
    try:
        if not supabase:
            logger.error("❌ Клієнт Supabase не ініціалізовано")
            return None

        user = get_user(telegram_id)
        if not user:
            logger.error(f"❌ Користувача {telegram_id} не знайдено")
            return None

        current_balance = float(user.get("balance", 0))
        new_balance = current_balance + amount

        res = supabase.table("Winix").update({"balance": new_balance}).eq("telegram_id", telegram_id).execute()
        logger.info(f"✅ Оновлено баланс користувача {telegram_id}: +{amount}, новий баланс: {new_balance}")

        # Перевіряємо, чи потрібно активувати бейдж багатія
        if new_balance >= 50000 and not user.get("badge_rich", False):
            supabase.table("Winix").update({"badge_rich": True}).eq("telegram_id", telegram_id).execute()
            logger.info(f"🏆 Користувач {telegram_id} отримує бейдж багатія")

        return res.data[0] if res.data else None
    except Exception as e:
        logger.error(f"❌ Помилка оновлення балансу {telegram_id}: {str(e)}")
        return None


# Оновити кількість жетонів
def update_coins(telegram_id: str, amount: int):
    try:
        if not supabase:
            logger.error("❌ Клієнт Supabase не ініціалізовано")
            return None

        user = get_user(telegram_id)
        if not user:
            logger.error(f"❌ Користувача {telegram_id} не знайдено")
            return None

        current_coins = int(user.get("coins", 0))
        new_coins = current_coins + amount
        if new_coins < 0:
            new_coins = 0  # запобігаємо від'ємному значенню

        res = supabase.table("Winix").update({"coins": new_coins}).eq("telegram_id", telegram_id).execute()
        logger.info(
            f"✅ Оновлено жетони користувача {telegram_id}: {'+' if amount >= 0 else ''}{amount}, нова кількість: {new_coins}")
        return res.data[0] if res.data else None
    except Exception as e:
        logger.error(f"❌ Помилка оновлення жетонів {telegram_id}: {str(e)}")
        return None


# Оновити дані користувача
def update_user(telegram_id: str, data: dict):
    try:
        if not supabase:
            logger.error("❌ Клієнт Supabase не ініціалізовано")
            return None

        user = get_user(telegram_id)
        if not user:
            logger.error(f"❌ Користувача {telegram_id} не знайдено")
            return None

        res = supabase.table("Winix").update(data).eq("telegram_id", telegram_id).execute()
        logger.info(f"✅ Оновлено дані користувача {telegram_id}")
        return res.data[0] if res.data else None
    except Exception as e:
        logger.error(f"❌ Помилка оновлення даних користувача {telegram_id}: {str(e)}")
        return None


# Перевірити і оновити прогрес бейджів
def check_and_update_badges(telegram_id: str):
    try:
        user = get_user(telegram_id)
        if not user:
            return None

        updates = {}

        # Бейдж початківця - за 5 участей в розіграшах
        if not user.get("badge_beginner") and user.get("participations_count", 0) >= 5:
            updates["badge_beginner"] = True
            logger.info(f"🏆 Користувач {telegram_id} отримує бейдж початківця")

        # Бейдж багатія - за 50,000 WINIX
        if not user.get("badge_rich") and float(user.get("balance", 0)) >= 50000:
            updates["badge_rich"] = True
            logger.info(f"🏆 Користувач {telegram_id} отримує бейдж багатія")

        # Бейдж переможця - якщо є виграші
        if not user.get("badge_winner") and user.get("wins_count", 0) > 0:
            updates["badge_winner"] = True
            logger.info(f"🏆 Користувач {telegram_id} отримує бейдж переможця")

        # Якщо є оновлення, зберігаємо їх
        if updates:
            return update_user(telegram_id, updates)

        return user
    except Exception as e:
        logger.error(f"❌ Помилка перевірки бейджів {telegram_id}: {str(e)}")
        return None


# Додати участь у розіграші
def add_participation(telegram_id: str, raffle_id: str, token_amount: int = 1):
    try:
        if not supabase:
            logger.error("❌ Клієнт Supabase не ініціалізовано")
            return None

        user = get_user(telegram_id)
        if not user:
            logger.error(f"❌ Користувача {telegram_id} не знайдено")
            return None

        # Перевіряємо, чи достатньо жетонів
        current_coins = int(user.get("coins", 0))
        if current_coins < token_amount:
            logger.error(
                f"❌ Недостатньо жетонів для участі {telegram_id} (наявно {current_coins}, потрібно {token_amount})")
            return None

        # Знімаємо жетони
        new_coins = current_coins - token_amount

        # Збільшуємо лічильник участей
        current_participations = int(user.get("participations_count", 0))
        new_participations = current_participations + 1

        # Оновлюємо дані користувача
        updates = {
            "coins": new_coins,
            "participations_count": new_participations
        }

        # Перевіряємо, чи не потрібно активувати бейдж початківця
        if new_participations >= 5 and not user.get("badge_beginner", False):
            updates["badge_beginner"] = True

        # Оновлюємо дані
        res_user = supabase.table("Winix").update(updates).eq("telegram_id", telegram_id).execute()

        # Додаємо запис про участь у розіграші (якщо є таблиця)
        try:
            participation_data = {
                "telegram_id": telegram_id,
                "raffle_id": raffle_id,
                "token_amount": token_amount
            }

            res_participation = supabase.table("RaffleParticipations").insert(participation_data).execute()
            logger.info(f"✅ Користувач {telegram_id} взяв участь у розіграші {raffle_id} з {token_amount} жетонами")
        except Exception as e:
            logger.error(f"Помилка додавання запису про участь: {str(e)}")
            res_participation = None

        return {
            "user": res_user.data[0] if res_user.data else None,
            "participation": res_participation.data[0] if res_participation and hasattr(res_participation,
                                                                                        'data') else None
        }
    except Exception as e:
        logger.error(f"❌ Помилка додавання участі у розіграші для {telegram_id}: {str(e)}")
        return None


# Отримати історію розіграшів користувача
def get_user_raffle_history(telegram_id: str, limit: int = 10):
    try:
        if not supabase:
            logger.error("❌ Клієнт Supabase не ініціалізовано")
            return []

        # Спочатку спробуємо отримати дані за допомогою функції RPC, якщо вона існує
        try:
            res = supabase.rpc('get_user_raffle_history', {'user_id': telegram_id, 'history_limit': limit}).execute()
            if res.data:
                return res.data
        except Exception as e:
            logger.error(f"Помилка виклику RPC get_user_raffle_history: {str(e)}")

        # Якщо RPC не спрацював, спробуємо прямий запит до таблиці
        try:
            res = supabase.table("RaffleParticipations").select("*").eq("telegram_id", telegram_id).order(
                "participated_at", desc=True).limit(limit).execute()
            return res.data if res.data else []
        except Exception as e:
            logger.error(f"Помилка прямого запиту до таблиці RaffleParticipations: {str(e)}")
            return []
    except Exception as e:
        logger.error(f"❌ Помилка отримання історії розіграшів {telegram_id}: {str(e)}")
        return []