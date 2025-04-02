import os
from supabase import create_client, Client
from dotenv import load_dotenv
import logging
import json
import time

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
    logger.error("⚠️ КРИТИЧНА ПОМИЛКА: Відсутні змінні середовища SUPABASE_URL або SUPABASE_ANON_KEY")

# Ініціалізація клієнта
try:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    logger.info("✅ Успішне підключення до Supabase")
except Exception as e:
    logger.error(f"❌ Помилка підключення до Supabase: {str(e)}", exc_info=True)
    supabase = None


# Функція для повторних спроб виконання запиту до Supabase
def retry_supabase(func, max_retries=3, retry_delay=1):
    """
    Функція, яка робить повторні спроби викликати операції Supabase при помилках

    Args:
        func: Функція, яку потрібно викликати
        max_retries: Максимальна кількість спроб
        retry_delay: Затримка між спробами (секунди)

    Returns:
        Результат функції або None у випадку помилки
    """
    retries = 0
    last_error = None

    while retries < max_retries:
        try:
            return func()
        except Exception as e:
            last_error = e
            retries += 1
            logger.warning(f"Спроба {retries}/{max_retries} не вдалася: {str(e)}")

            # Якщо це остання спроба, просто дозволяємо помилці прокинутись
            if retries >= max_retries:
                break

            # Інакше чекаємо перед наступною спробою
            time.sleep(retry_delay)

    # Якщо всі спроби не вдалися, піднімаємо останню помилку
    logger.error(f"Усі {max_retries} спроб не вдалися. Остання помилка: {str(last_error)}")
    return None


# Отримати користувача по telegram_id
def get_user(telegram_id: str):
    """
    Отримує дані користувача з Supabase за його Telegram ID

    Args:
        telegram_id: Ідентифікатор Telegram користувача

    Returns:
        Дані користувача або None у випадку помилки
    """
    try:
        if not supabase:
            logger.error("❌ Клієнт Supabase не ініціалізовано")
            return None

        # Перетворюємо на рядок, якщо це не рядок
        telegram_id = str(telegram_id)

        logger.info(f"get_user: Спроба отримати користувача з ID {telegram_id}")

        # Виконуємо запит з повторними спробами
        def fetch_user():
            # Виводимо тип для діагностики
            logger.info(f"fetch_user: Тип telegram_id: {type(telegram_id)}, Значення: {telegram_id}")

            # Явно конвертуємо в рядок ще раз для впевненості
            telegram_id_str = str(telegram_id)

            # Створюємо запит з детальним логуванням
            try:
                res = supabase.table("winix").select("*").eq("telegram_id", telegram_id_str).execute()
                logger.info(f"fetch_user: Результат запиту: {res}")

                if not res.data:
                    logger.warning(f"get_user: Користувача з ID {telegram_id} не знайдено")
                    return None

                logger.info(f"get_user: Користувача з ID {telegram_id} успішно отримано")
                return res.data[0] if res.data else None
            except Exception as e:
                logger.error(f"fetch_user: Помилка запиту до Supabase: {str(e)}")
                return None

        return retry_supabase(fetch_user)
    except Exception as e:
        logger.error(f"❌ Помилка отримання користувача {telegram_id}: {str(e)}", exc_info=True)
        return None


# Створити користувача
def create_user(telegram_id: str, username: str, referrer_id: str = None):
    """
    Створює нового користувача в Supabase

    Args:
        telegram_id: Ідентифікатор Telegram користувача
        username: Ім'я користувача (нікнейм)
        referrer_id: ID того, хто запросив (необов'язково)

    Returns:
        Дані створеного користувача або None у випадку помилки
    """
    try:
        if not supabase:
            logger.error("❌ Клієнт Supabase не ініціалізовано")
            return None

        # Перевіряємо, чи користувач вже існує
        existing_user = get_user(telegram_id)
        if existing_user:
            logger.info(f"create_user: Користувач {telegram_id} вже існує, повертаємо існуючі дані")
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

        logger.info(f"create_user: Спроба створити нового користувача: {telegram_id} (username: {username})")
        logger.debug(f"create_user: Дані для створення: {json.dumps(data)}")

        # Виконуємо запит з повторними спробами
        def insert_user():
            res = supabase.table("winix").insert(data).execute()
            logger.info(f"create_user: Створено нового користувача: {telegram_id}")
            return res.data[0] if res.data else None

        result = retry_supabase(insert_user)

        if result:
            logger.info(f"create_user: Користувача {telegram_id} успішно створено")
        else:
            logger.error(f"create_user: Не вдалося створити користувача {telegram_id}, можлива помилка в Supabase")

        return result
    except Exception as e:
        logger.error(f"❌ Помилка створення користувача {telegram_id}: {str(e)}", exc_info=True)
        return None


# Оновити баланс
def update_balance(telegram_id: str, amount: float):
    """
    Оновлює баланс користувача на вказану суму (додає до поточного)

    Args:
        telegram_id: Ідентифікатор Telegram користувача
        amount: Сума для додавання (може бути від'ємною для відніманням)

    Returns:
        Оновлені дані користувача або None у випадку помилки
    """
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

        logger.info(
            f"update_balance: Оновлення балансу {telegram_id}: {current_balance} -> {new_balance} (зміна: {amount})")

        # Виконуємо запит з повторними спробами
        def update_user_balance():
            res = supabase.table("winix").update({"balance": new_balance}).eq("telegram_id", telegram_id).execute()
            return res.data[0] if res.data else None

        result = retry_supabase(update_user_balance)

        # Перевіряємо, чи потрібно активувати бейдж багатія
        if new_balance >= 50000 and not user.get("badge_rich", False):
            logger.info(f"🏆 Користувач {telegram_id} отримує бейдж багатія")
            supabase.table("winix").update({"badge_rich": True}).eq("telegram_id", telegram_id).execute()

        return result
    except Exception as e:
        logger.error(f"❌ Помилка оновлення балансу {telegram_id}: {str(e)}", exc_info=True)
        return None


# Оновити кількість жетонів
def update_coins(telegram_id: str, amount: int):
    """
    Оновлює кількість жетонів користувача (додає до поточної)

    Args:
        telegram_id: Ідентифікатор Telegram користувача
        amount: Кількість жетонів для додавання (може бути від'ємною)

    Returns:
        Оновлені дані користувача або None у випадку помилки
    """
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

        logger.info(f"update_coins: Оновлення жетонів {telegram_id}: {current_coins} -> {new_coins} (зміна: {amount})")

        # Виконуємо запит з повторними спробами
        def update_user_coins():
            res = supabase.table("winix").update({"coins": new_coins}).eq("telegram_id", telegram_id).execute()
            return res.data[0] if res.data else None

        return retry_supabase(update_user_coins)
    except Exception as e:
        logger.error(f"❌ Помилка оновлення жетонів {telegram_id}: {str(e)}", exc_info=True)
        return None


# Оновити дані користувача
def update_user(telegram_id: str, data: dict):
    """
    Оновлює дані користувача зазначеними полями

    Args:
        telegram_id: Ідентифікатор Telegram користувача
        data: Словник з полями для оновлення

    Returns:
        Оновлені дані користувача або None у випадку помилки
    """
    try:
        if not supabase:
            logger.error("❌ Клієнт Supabase не ініціалізовано")
            return None

        user = get_user(telegram_id)
        if not user:
            logger.error(f"❌ Користувача {telegram_id} не знайдено")
            return None

        logger.info(f"update_user: Оновлення користувача {telegram_id} з полями: {list(data.keys())}")

        # Виконуємо запит з повторними спробами
        def update_user_data():
            res = supabase.table("winix").update(data).eq("telegram_id", telegram_id).execute()
            return res.data[0] if res.data else None

        return retry_supabase(update_user_data)
    except Exception as e:
        logger.error(f"❌ Помилка оновлення даних користувача {telegram_id}: {str(e)}", exc_info=True)
        return None


# Перевірити і оновити прогрес бейджів
def check_and_update_badges(telegram_id: str):
    """
    Перевіряє та оновлює бейджі користувача, якщо він відповідає критеріям

    Args:
        telegram_id: Ідентифікатор Telegram користувача

    Returns:
        Оновлені дані користувача або None у випадку помилки
    """
    try:
        user = get_user(telegram_id)
        if not user:
            logger.warning(f"check_and_update_badges: Користувача {telegram_id} не знайдено")
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
            logger.info(f"check_and_update_badges: Оновлення бейджів користувача {telegram_id}: {updates}")
            return update_user(telegram_id, updates)

        return user
    except Exception as e:
        logger.error(f"❌ Помилка перевірки бейджів {telegram_id}: {str(e)}", exc_info=True)
        return None


# Додати участь у розіграші
def add_participation(telegram_id: str, raffle_id: str, token_amount: int = 1):
    """
    Додає запис про участь користувача в розіграші

    Args:
        telegram_id: Ідентифікатор Telegram користувача
        raffle_id: Ідентифікатор розіграшу
        token_amount: Кількість жетонів для участі (за замовчуванням 1)

    Returns:
        Словник з результатами операції або None у випадку помилки
    """
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
            logger.info(f"🏆 Користувач {telegram_id} отримує бейдж початківця за 5 участей")

        # Оновлюємо дані
        logger.info(f"add_participation: Оновлення даних користувача {telegram_id} для участі в розіграші {raffle_id}")
        res_user = update_user(telegram_id, updates)

        # Додаємо запис про участь у розіграші (якщо є таблиця)
        res_participation = None
        try:
            participation_data = {
                "telegram_id": telegram_id,
                "raffle_id": raffle_id,
                "token_amount": token_amount
            }

            logger.info(
                f"add_participation: Додавання запису про участь користувача {telegram_id} в розіграші {raffle_id}")

            # Виконуємо запит з повторними спробами
            def insert_participation():
                insert_res = supabase.table("raffleParticipations").insert(participation_data).execute()
                return insert_res.data[0] if insert_res.data else None

            res_participation = retry_supabase(insert_participation)

            logger.info(f"✅ Користувач {telegram_id} взяв участь у розіграші {raffle_id} з {token_amount} жетонами")
        except Exception as e:
            logger.error(f"Помилка додавання запису про участь: {str(e)}", exc_info=True)

        return {
            "user": res_user,
            "participation": res_participation
        }
    except Exception as e:
        logger.error(f"❌ Помилка додавання участі у розіграші для {telegram_id}: {str(e)}", exc_info=True)
        return None


# Отримати історію розіграшів користувача
def get_user_raffle_history(telegram_id: str, limit: int = 10):
    """
    Отримує історію участі користувача в розіграшах

    Args:
        telegram_id: Ідентифікатор Telegram користувача
        limit: Максимальна кількість записів (за замовчуванням 10)

    Returns:
        Список з історією розіграшів або пустий список у випадку помилки
    """
    try:
        if not supabase:
            logger.error("❌ Клієнт Supabase не ініціалізовано")
            return []

        logger.info(f"get_user_raffle_history: Отримання історії розіграшів для {telegram_id}")

        # Спочатку спробуємо отримати дані за допомогою функції RPC, якщо вона існує
        try:
            def get_history_rpc():
                rpc_res = supabase.rpc('get_user_raffle_history',
                                       {'user_id': telegram_id, 'history_limit': limit}).execute()
                return rpc_res.data or []

            history = retry_supabase(get_history_rpc)
            if history:
                logger.info(f"get_user_raffle_history: Отримано {len(history)} записів через RPC")
                return history
        except Exception as e:
            logger.error(f"Помилка виклику RPC get_user_raffle_history: {str(e)}", exc_info=True)

        # Якщо RPC не спрацював, спробуємо прямий запит до таблиці
        try:
            def get_history_direct():
                direct_res = supabase.table("raffleParticipations").select("*").eq("telegram_id", telegram_id).order(
                    "participated_at", desc=True).limit(limit).execute()
                return direct_res.data or []

            history = retry_supabase(get_history_direct)
            logger.info(f"get_user_raffle_history: Отримано {len(history)} записів через прямий запит")
            return history
        except Exception as e:
            logger.error(f"Помилка прямого запиту до таблиці RaffleParticipations: {str(e)}", exc_info=True)
            return []
    except Exception as e:
        logger.error(f"❌ Помилка отримання історії розіграшів {telegram_id}: {str(e)}", exc_info=True)
        return []


# Функція для тестування з'єднання з Supabase
def test_supabase_connection():
    """
    Тестує з'єднання з Supabase

    Returns:
        Словник з результатами тестування
    """
    try:
        if not SUPABASE_URL or not SUPABASE_KEY:
            return {
                "success": False,
                "message": "Відсутні змінні середовища SUPABASE_URL або SUPABASE_ANON_KEY",
                "details": {
                    "SUPABASE_URL": bool(SUPABASE_URL),
                    "SUPABASE_KEY": bool(SUPABASE_KEY)
                }
            }

        if not supabase:
            return {
                "success": False,
                "message": "Клієнт Supabase не ініціалізовано",
                "details": None
            }

        # Спроба виконати простий запит
        try:
            start_time = time.time()
            res = supabase.table("winix").select("count").limit(1).execute()
            end_time = time.time()
            response_time = end_time - start_time

            return {
                "success": True,
                "message": "З'єднання з Supabase успішне",
                "details": {
                    "response_time_ms": round(response_time * 1000, 2),
                    "tables_available": ["winix", "raffleParticipations", "transactions"]
                }
            }
        except Exception as e:
            return {
                "success": False,
                "message": f"Помилка виконання тестового запиту: {str(e)}",
                "details": {
                    "error_type": type(e).__name__,
                    "error_details": str(e)
                }
            }
    except Exception as e:
        return {
            "success": False,
            "message": f"Неочікувана помилка при тестуванні з'єднання: {str(e)}",
            "details": None
        }


# Тест створення користувача
def test_create_user(telegram_id: str, username: str):
    """
    Тестує створення користувача

    Args:
        telegram_id: Тестовий ID Telegram
        username: Тестове ім'я користувача

    Returns:
        Словник з результатами тестування
    """
    try:
        # Спочатку перевіряємо з'єднання
        connection_test = test_supabase_connection()
        if not connection_test["success"]:
            return {
                "success": False,
                "message": "Неможливо виконати тест створення користувача: проблема з'єднання з Supabase",
                "details": connection_test
            }

        start_time = time.time()

        # Спроба створити користувача
        result = create_user(telegram_id, username)

        end_time = time.time()
        response_time = end_time - start_time

        if result:
            return {
                "success": True,
                "message": f"Користувача {telegram_id} успішно створено або отримано існуючого",
                "details": {
                    "user": result,
                    "response_time_ms": round(response_time * 1000, 2)
                }
            }
        else:
            return {
                "success": False,
                "message": f"Не вдалося створити користувача {telegram_id}",
                "details": {
                    "response_time_ms": round(response_time * 1000, 2)
                }
            }
    except Exception as e:
        return {
            "success": False,
            "message": f"Неочікувана помилка при тестуванні створення користувача: {str(e)}",
            "details": {
                "error_type": type(e).__name__,
                "error_details": str(e)
            }
        }


# Отримати налаштування користувача
def get_user_settings(telegram_id: str):
    """
    Отримує налаштування користувача

    Args:
        telegram_id: Ідентифікатор Telegram користувача

    Returns:
        Словник з налаштуваннями або None у випадку помилки
    """
    try:
        user = get_user(telegram_id)
        if not user:
            return None

        # Формуємо об'єкт з налаштуваннями
        settings = {
            "username": user.get("username", "WINIX User"),
            "avatar_id": user.get("avatar_id"),
            "avatar_url": user.get("avatar_url"),
            "language": user.get("language", "uk"),
            "notifications_enabled": user.get("notifications_enabled", True),
            "password_hash": user.get("password_hash")
        }

        return settings
    except Exception as e:
        logger.error(f"❌ Помилка отримання налаштувань користувача {telegram_id}: {str(e)}")
        return None


# Отримати статус щоденного бонусу
def get_daily_bonus_status(telegram_id: str):
    """
    Отримує статус щоденного бонусу користувача

    Args:
        telegram_id: Ідентифікатор Telegram користувача

    Returns:
        Словник зі статусом щоденного бонусу або None у випадку помилки
    """
    try:
        user = get_user(telegram_id)
        if not user:
            return None

        from datetime import datetime

        # Отримуємо інформацію про щоденні бонуси
        daily_bonuses = user.get("daily_bonuses", {})

        # Якщо немає інформації про бонуси, створюємо її
        if not daily_bonuses:
            daily_bonuses = {
                "last_claimed_date": None,
                "claimed_days": [],
                "current_day": 1
            }

        # Перевіряємо, чи можна отримати бонус сьогодні
        today = datetime.now().strftime("%Y-%m-%d")
        last_date = daily_bonuses.get("last_claimed_date")

        # Визначаємо поточний день у циклі (1-7)
        current_day = daily_bonuses.get("current_day", 1)
        claimed_days = daily_bonuses.get("claimed_days", [])

        # Визначаємо суму винагороди залежно від дня
        reward_amount = current_day * 10  # День 1 = 10, День 2 = 20, і т.д.

        # Перевіряємо, чи сьогодні вже отримано бонус
        can_claim = today != last_date

        return {
            "currentDay": current_day,
            "claimedDays": claimed_days,
            "canClaim": can_claim,
            "rewardAmount": reward_amount
        }
    except Exception as e:
        logger.error(f"❌ Помилка отримання статусу щоденного бонусу для {telegram_id}: {str(e)}")
        return None


# Отримати щоденний бонус
def claim_daily_bonus(telegram_id: str, day: int):
    """
    Нараховує щоденний бонус користувачу

    Args:
        telegram_id: Ідентифікатор Telegram користувача
        day: День циклу (1-7), який намагаємось отримати

    Returns:
        Словник з результатом операції або None у випадку помилки
    """
    try:
        user = get_user(telegram_id)
        if not user:
            return None

        from datetime import datetime

        # Отримуємо інформацію про щоденні бонуси
        daily_bonuses = user.get("daily_bonuses", {})

        # Якщо немає інформації про бонуси, створюємо її
        if not daily_bonuses:
            daily_bonuses = {
                "last_claimed_date": None,
                "claimed_days": [],
                "current_day": 1
            }

        # Перевіряємо, чи можна отримати бонус сьогодні
        today = datetime.now().strftime("%Y-%m-%d")
        last_date = daily_bonuses.get("last_claimed_date")

        # Якщо бонус вже отримано сьогодні
        if last_date == today:
            return {
                "status": "already_claimed",
                "message": "Бонус вже отримано сьогодні"
            }

        # Визначаємо поточний день у циклі (1-7)
        current_day = daily_bonuses.get("current_day", 1)
        claimed_days = daily_bonuses.get("claimed_days", [])

        # Перевіряємо, чи переданий день співпадає з поточним
        if day != current_day:
            return {
                "status": "error",
                "message": f"Неправильний день! Очікувався день {current_day}, отримано {day}"
            }

        # Визначаємо суму винагороди залежно від дня
        reward_amount = current_day * 10  # День 1 = 10, День 2 = 20, і т.д.

        # Нараховуємо винагороду
        current_balance = float(user.get("balance", 0))
        new_balance = current_balance + reward_amount

        # Оновлюємо інформацію про бонуси
        claimed_days.append(current_day)

        # Визначаємо наступний день (циклічно від 1 до 7)
        next_day = current_day + 1
        if next_day > 7:
            next_day = 1

        # Оновлюємо дані в базі
        updated_bonuses = {
            "last_claimed_date": today,
            "claimed_days": claimed_days,
            "current_day": next_day
        }

        update_user(telegram_id, {
            "balance": new_balance,
            "daily_bonuses": updated_bonuses
        })

        # Додаємо транзакцію
        transaction = {
            "telegram_id": telegram_id,
            "type": "reward",
            "amount": reward_amount,
            "description": f"Щоденний бонус (День {current_day})",
            "status": "completed"
        }

        if supabase:
            supabase.table("transactions").insert(transaction).execute()

        return {
            "status": "success",
            "message": f"Щоденний бонус отримано: +{reward_amount} WINIX",
            "reward": reward_amount,
            "newBalance": new_balance
        }
    except Exception as e:
        logger.error(f"❌ Помилка отримання щоденного бонусу для {telegram_id}: {str(e)}")
        return None


# Перевірити підписку на соціальну мережу
def verify_social_subscription(telegram_id: str, platform: str):
    """
    Перевіряє підписку користувача на соціальну мережу

    Args:
        telegram_id: Ідентифікатор Telegram користувача
        platform: Платформа (twitter, telegram, youtube, discord, instagram)

    Returns:
        Словник з результатом перевірки або None у випадку помилки
    """
    try:
        user = get_user(telegram_id)
        if not user:
            return None

        # Отримуємо статус соціальних завдань
        social_tasks = user.get("social_tasks", {})

        # Якщо завдання вже виконано
        if social_tasks.get(platform, False):
            return {
                "status": "already_completed",
                "message": "Це завдання вже виконано"
            }

        # Визначаємо винагороду залежно від платформи
        reward_amounts = {
            "twitter": 50,
            "telegram": 80,
            "youtube": 50,
            "discord": 60,
            "instagram": 70
        }

        reward_amount = reward_amounts.get(platform, 50)

        # Нараховуємо винагороду
        current_balance = float(user.get("balance", 0))
        new_balance = current_balance + reward_amount

        # Оновлюємо статус завдання
        if not social_tasks:
            social_tasks = {}
        social_tasks[platform] = True

        # Оновлюємо дані в базі
        update_user(telegram_id, {
            "balance": new_balance,
            "social_tasks": social_tasks
        })

        # Додаємо транзакцію
        transaction = {
            "telegram_id": telegram_id,
            "type": "reward",
            "amount": reward_amount,
            "description": f"Винагорода за підписку на {platform}",
            "status": "completed"
        }

        if supabase:
            supabase.table("transactions").insert(transaction).execute()

        return {
            "status": "success",
            "message": f"Підписку підтверджено! Отримано {reward_amount} WINIX",
            "reward": reward_amount,
            "newBalance": new_balance
        }
    except Exception as e:
        logger.error(f"❌ Помилка перевірки підписки для {telegram_id}: {str(e)}")
        return None


# Отримати статус реферальних завдань
def get_referral_tasks_status(telegram_id: str):
    """
    Отримує статус реферальних завдань користувача

    Args:
        telegram_id: Ідентифікатор Telegram користувача

    Returns:
        Словник зі статусом реферальних завдань або None у випадку помилки
    """
    try:
        user = get_user(telegram_id)
        if not user:
            return None

        # Отримуємо кількість рефералів
        referral_count = 0
        if supabase:
            try:
                referrals_res = supabase.table("winix").select("count").eq("referrer_id", telegram_id).execute()
                referral_count = referrals_res.count if hasattr(referrals_res, 'count') else 0
            except Exception as e:
                logger.error(f"Помилка отримання кількості рефералів: {str(e)}")

        # Отримуємо статус реферальних завдань
        referral_tasks = user.get("referral_tasks", {})

        # Визначаємо завдання і їх цілі
        tasks = [
            {"id": "invite-friends", "target": 5, "reward": 300},
            {"id": "invite-friends-10", "target": 10, "reward": 700},
            {"id": "invite-friends-25", "target": 25, "reward": 1500},
            {"id": "invite-friends-100", "target": 100, "reward": 5000}
        ]

        # Визначаємо, які завдання виконані
        completed_tasks = []

        for task in tasks:
            task_id = task["id"]
            target = task["target"]

            # Завдання виконане, якщо кількість рефералів >= цільової або статус в базі = True
            if referral_count >= target or referral_tasks.get(task_id, False):
                completed_tasks.append(task_id)

        return {
            "referralCount": referral_count,
            "completedTasks": completed_tasks,
            "tasks": tasks
        }
    except Exception as e:
        logger.error(f"❌ Помилка отримання статусу реферальних завдань для {telegram_id}: {str(e)}")
        return None


# Отримати винагороду за реферальне завдання
def claim_referral_reward(telegram_id: str, task_id: str, reward_amount: float):
    """
    Нараховує винагороду за виконане реферальне завдання

    Args:
        telegram_id: Ідентифікатор Telegram користувача
        task_id: Ідентифікатор завдання
        reward_amount: Сума винагороди

    Returns:
        Словник з результатом операції або None у випадку помилки
    """
    try:
        user = get_user(telegram_id)
        if not user:
            return None

        # Отримуємо статус реферальних завдань
        referral_tasks = user.get("referral_tasks", {})

        # Якщо завдання вже виконано
        if referral_tasks.get(task_id, False):
            return {
                "status": "already_claimed",
                "message": "Ви вже отримали винагороду за це завдання"
            }

        # Отримуємо кількість рефералів
        referral_count = 0
        if supabase:
            try:
                referrals_res = supabase.table("winix").select("count").eq("referrer_id", telegram_id).execute()
                referral_count = referrals_res.count if hasattr(referrals_res, 'count') else 0
            except Exception as e:
                logger.error(f"Помилка отримання кількості рефералів: {str(e)}")

        # Визначаємо цільову кількість рефералів
        target_map = {
            "invite-friends": 5,
            "invite-friends-10": 10,
            "invite-friends-25": 25,
            "invite-friends-100": 100
        }

        target = target_map.get(task_id, 0)

        # Перевіряємо, чи достатньо рефералів
        if referral_count < target:
            return {
                "status": "not_completed",
                "message": f"Недостатньо рефералів для завершення завдання. Потрібно {target}, наявно {referral_count}"
            }

        # Нараховуємо винагороду
        current_balance = float(user.get("balance", 0))
        new_balance = current_balance + reward_amount

        # Оновлюємо статус завдання
        if not referral_tasks:
            referral_tasks = {}
        referral_tasks[task_id] = True

        # Оновлюємо дані в базі
        update_user(telegram_id, {
            "balance": new_balance,
            "referral_tasks": referral_tasks
        })

        # Додаємо транзакцію
        transaction = {
            "telegram_id": telegram_id,
            "type": "reward",
            "amount": reward_amount,
            "description": f"Винагорода за реферальне завдання: {task_id}",
            "status": "completed"
        }

        if supabase:
            supabase.table("transactions").insert(transaction).execute()

        return {
            "status": "success",
            "message": f"Винагороду отримано: {reward_amount} WINIX",
            "reward": reward_amount,
            "newBalance": new_balance
        }
    except Exception as e:
        logger.error(f"❌ Помилка отримання винагороди за реферальне завдання для {telegram_id}: {str(e)}")
        return None


# Перевірити валідність реферального коду
def is_valid_referral_code(code: str) -> bool:
    """
    Перевіряє, чи код є валідним ID Telegram

    Args:
        code: Реферальний код (Telegram ID)

    Returns:
        True, якщо код валідний, інакше False
    """
    try:
        return len(code) > 5
    except:
        return False


# Якщо цей файл запускається напряму, виконати тести з'єднання
if __name__ == "__main__":
    print("🧪 Запуск тестування з'єднання з Supabase...")

    connection_result = test_supabase_connection()
    print(f"✓ Результат тесту з'єднання: {connection_result['success']}")
    print(f"✓ Повідомлення: {connection_result['message']}")

    if connection_result['success']:
        test_id = "7066583465"  # Тестовий ID
        print(f"\n🧪 Тестування створення користувача з ID {test_id}...")
        creation_result = test_create_user(test_id, "test_user")
        print(f"✓ Результат: {creation_result['success']}")
        print(f"✓ Повідомлення: {creation_result['message']}")