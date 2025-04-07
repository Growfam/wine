import os
from supabase import create_client, Client
from dotenv import load_dotenv
import logging
import json
import time
import uuid
from datetime import datetime, timedelta

# Налаштування логування
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(levelname)s - %(message)s')
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


# Функція для примусового створення користувача (без перевірок)
def force_create_user(telegram_id: str, username: str, referrer_id: str = None):
    """
    Примусово створює нового користувача в Supabase без перевірок

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

        # Перетворюємо ID в рядок
        telegram_id = str(telegram_id)

        # Створюємо базові дані для нового користувача
        data = {
            "telegram_id": telegram_id,
            "username": username,
            "balance": 0,
            "coins": 3,
            "referrer_id": referrer_id,
            "page1_completed": False,
            "newbie_bonus_claimed": False,
            "participations_count": 0,
            "badge_winner": False,
            "badge_beginner": False,
            "badge_rich": False,
            "wins_count": 0
        }

        logger.info(f"force_create_user: Примусове створення користувача: {telegram_id}")
        logger.debug(f"force_create_user: Дані для створення: {json.dumps(data)}")

        # Спроба вставити дані напряму
        try:
            res = supabase.table("winix").insert(data).execute()
            logger.info(f"force_create_user: Відповідь Supabase: {res}")

            if res.data:
                logger.info(f"force_create_user: Користувача {telegram_id} успішно створено")
                return res.data[0]
            else:
                logger.warning(f"force_create_user: Supabase повернув пустий результат")
                return None
        except Exception as e:
            logger.error(f"force_create_user: Помилка Supabase: {str(e)}")
            return None

    except Exception as e:
        logger.error(f"❌ Помилка примусового створення користувача {telegram_id}: {str(e)}", exc_info=True)
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

        # Перетворюємо ID в рядок
        telegram_id = str(telegram_id)

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
            logger.info(f"create_user: Відповідь Supabase: {res}")
            if not res.data:
                logger.warning("create_user: Supabase не повернув даних")
                return None
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

        # Перетворюємо ID в рядок
        telegram_id = str(telegram_id)

        user = get_user(telegram_id)
        if not user:
            logger.error(f"❌ Користувача {telegram_id} не знайдено")

            # Спробуємо створити користувача
            logger.info(f"update_balance: Спроба створити користувача {telegram_id}")
            user = force_create_user(telegram_id, "WINIX User")

            if not user:
                logger.error(f"update_balance: Не вдалося створити користувача {telegram_id}")
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

        # Перетворюємо ID в рядок
        telegram_id = str(telegram_id)

        user = get_user(telegram_id)
        if not user:
            logger.error(f"❌ Користувача {telegram_id} не знайдено")

            # Спробуємо створити користувача
            logger.info(f"update_coins: Спроба створити користувача {telegram_id}")
            user = force_create_user(telegram_id, "WINIX User")

            if not user:
                logger.error(f"update_coins: Не вдалося створити користувача {telegram_id}")
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

        # Перетворюємо ID в рядок
        telegram_id = str(telegram_id)

        user = get_user(telegram_id)
        if not user:
            logger.error(f"❌ Користувача {telegram_id} не знайдено")

            # Спробуємо створити користувача
            logger.info(f"update_user: Спроба створити користувача {telegram_id}")
            user = force_create_user(telegram_id, "WINIX User")

            if not user:
                logger.error(f"update_user: Не вдалося створити користувача {telegram_id}")
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
        # Перетворюємо ID в рядок
        telegram_id = str(telegram_id)

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


# Функції для роботи з таблицею staking_sessions

def create_staking_session(user_id, amount_staked, staking_days, reward_percent=None):
    """
    Створення нової сесії стейкінгу в окремій таблиці staking_sessions

    Args:
        user_id (str): ID користувача
        amount_staked (float): Сума токенів для стейкінгу
        staking_days (int): Кількість днів стейкінгу (7, 14, 28)
        reward_percent (float, optional): Відсоток винагороди.
                                        Якщо None, розрахується автоматично.

    Returns:
        dict або None: Дані створеної сесії стейкінгу або None у випадку помилки
    """
    try:
        if not supabase:
            logger.error("❌ Клієнт Supabase не ініціалізовано")
            return None

        # Перевіряємо параметри
        if not user_id or not amount_staked or not staking_days:
            logger.error("create_staking_session: Відсутні обов'язкові параметри")
            return None

        # Визначаємо відсоток винагороди, якщо не вказаний
        if reward_percent is None:
            if staking_days == 7:
                reward_percent = 5.0
            elif staking_days == 14:
                reward_percent = 9.0
            elif staking_days == 28:
                reward_percent = 15.0
            else:
                reward_percent = 9.0  # За замовчуванням

        # Розраховуємо дати
        started_at = datetime.now()
        ends_at = started_at + timedelta(days=staking_days)

        # Форматуємо дати для Supabase
        started_at_str = started_at.isoformat()
        ends_at_str = ends_at.isoformat()

        # Створюємо запис
        staking_data = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "amount_staked": float(amount_staked),
            "staking_days": int(staking_days),
            "reward_percent": float(reward_percent),
            "started_at": started_at_str,
            "ends_at": ends_at_str,
            "is_active": True,
            "cancelled_early": False,
            "final_amount_paid": 0  # Спочатку 0, буде оновлено при закритті
        }

        logger.info(f"create_staking_session: Створення нової сесії стейкінгу для {user_id}")

        # Виконуємо запит з повторними спробами
        def insert_staking():
            res = supabase.table("staking_sessions").insert(staking_data).execute()
            logger.info(f"create_staking_session: Відповідь Supabase: {res}")
            if not res.data:
                logger.warning("create_staking_session: Supabase не повернув даних")
                return None
            return res.data[0] if res.data else None

        result = retry_supabase(insert_staking)

        if result:
            logger.info(f"create_staking_session: Стейкінг-сесію {result.get('id')} для {user_id} успішно створено")
        else:
            logger.error(f"create_staking_session: Не вдалося створити стейкінг-сесію для {user_id}")

        return result
    except Exception as e:
        logger.error(f"create_staking_session: Помилка: {str(e)}", exc_info=True)
        return None


def get_user_staking_sessions(user_id, active_only=False):
    """
    Отримання всіх сесій стейкінгу користувача

    Args:
        user_id (str): ID користувача
        active_only (bool): Якщо True, повертає лише активні сесії

    Returns:
        list або None: Список сесій стейкінгу або None у випадку помилки
    """
    try:
        if not supabase:
            logger.error("❌ Клієнт Supabase не ініціалізовано")
            return None

        logger.info(f"get_user_staking_sessions: Отримання сесій стейкінгу для {user_id}, active_only={active_only}")

        # Виконуємо запит з повторними спробами
        def fetch_staking_sessions():
            # Створюємо базовий запит
            query = supabase.table("staking_sessions").select("*").eq("user_id", user_id)

            # Якщо потрібні лише активні сесії, додаємо фільтр
            if active_only:
                query = query.eq("is_active", True)

            # Сортуємо за датою початку (спочатку найновіші)
            query = query.order("started_at", desc=True)

            # Виконуємо запит
            res = query.execute()

            logger.info(f"get_user_staking_sessions: Отримано {len(res.data) if res.data else 0} сесій")

            return res.data if res.data else []

        return retry_supabase(fetch_staking_sessions)
    except Exception as e:
        logger.error(f"get_user_staking_sessions: Помилка: {str(e)}", exc_info=True)
        return None


def get_staking_session(session_id):
    """
    Отримання даних конкретної сесії стейкінгу за її ID

    Args:
        session_id (str): ID сесії стейкінгу

    Returns:
        dict або None: Дані сесії стейкінгу або None у випадку помилки
    """
    try:
        if not supabase:
            logger.error("❌ Клієнт Supabase не ініціалізовано")
            return None

        logger.info(f"get_staking_session: Отримання сесії стейкінгу {session_id}")

        # Виконуємо запит з повторними спробами
        def fetch_staking_session():
            res = supabase.table("staking_sessions").select("*").eq("id", session_id).execute()

            if not res.data:
                logger.warning(f"get_staking_session: Сесію стейкінгу {session_id} не знайдено")
                return None

            logger.info(f"get_staking_session: Сесію стейкінгу {session_id} успішно отримано")
            return res.data[0] if res.data else None

        return retry_supabase(fetch_staking_session)
    except Exception as e:
        logger.error(f"get_staking_session: Помилка: {str(e)}", exc_info=True)
        return None


def update_staking_session(session_id, update_data):
    """
    Оновлення даних сесії стейкінгу

    Args:
        session_id (str): ID сесії стейкінгу
        update_data (dict): Словник з полями для оновлення

    Returns:
        dict або None: Оновлені дані сесії стейкінгу або None у випадку помилки
    """
    try:
        if not supabase:
            logger.error("❌ Клієнт Supabase не ініціалізовано")
            return None

        logger.info(f"update_staking_session: Оновлення сесії стейкінгу {session_id}")

        # Отримуємо поточні дані сесії для перевірки
        current_session = get_staking_session(session_id)
        if not current_session:
            logger.error(f"update_staking_session: Сесію стейкінгу {session_id} не знайдено")
            return None

        # Перевіряємо поля, які не можна змінювати
        protected_fields = ["id", "user_id", "started_at"]
        for field in protected_fields:
            if field in update_data:
                logger.warning(f"update_staking_session: Поле {field} не може бути змінено, видаляємо з update_data")
                del update_data[field]

        # Логуємо поля, які будуть оновлені
        logger.info(f"update_staking_session: Поля для оновлення: {list(update_data.keys())}")

        # Виконуємо запит з повторними спробами
        def update_staking():
            res = supabase.table("staking_sessions").update(update_data).eq("id", session_id).execute()

            if not res.data:
                logger.warning(f"update_staking_session: Supabase не повернув даних")
                return None

            logger.info(f"update_staking_session: Сесію стейкінгу {session_id} успішно оновлено")
            return res.data[0] if res.data else None

        return retry_supabase(update_staking)
    except Exception as e:
        logger.error(f"update_staking_session: Помилка: {str(e)}", exc_info=True)
        return None


def complete_staking_session(session_id, final_amount=None, cancelled_early=False):
    """
    Завершення сесії стейкінгу (виплата винагороди або дострокове скасування)

    Args:
        session_id (str): ID сесії стейкінгу
        final_amount (float, optional): Сума, яку виплачено (з урахуванням винагороди або штрафу)
        cancelled_early (bool): Чи було скасовано достроково

    Returns:
        dict або None: Оновлені дані сесії стейкінгу або None у випадку помилки
    """
    try:
        if not supabase:
            logger.error("❌ Клієнт Supabase не ініціалізовано")
            return None

        # Отримуємо поточні дані сесії
        current_session = get_staking_session(session_id)
        if not current_session:
            logger.error(f"complete_staking_session: Сесію стейкінгу {session_id} не знайдено")
            return None

        # Перевіряємо, чи сесія активна
        if not current_session.get("is_active", False):
            logger.warning(f"complete_staking_session: Сесія стейкінгу {session_id} вже завершена")
            return current_session

        # Якщо сума не вказана, розраховуємо її
        if final_amount is None:
            amount_staked = float(current_session.get("amount_staked", 0))
            reward_percent = float(current_session.get("reward_percent", 0))

            if cancelled_early:
                # Штраф 20% при достроковому скасуванні
                cancellation_fee = amount_staked * 0.2
                final_amount = amount_staked - cancellation_fee
            else:
                # Повна сума з винагородою при нормальному завершенні
                reward = amount_staked * (reward_percent / 100)
                final_amount = amount_staked + reward

        # Підготовка даних для оновлення
        update_data = {
            "is_active": False,
            "cancelled_early": cancelled_early,
            "final_amount_paid": float(final_amount)
        }

        logger.info(
            f"complete_staking_session: Завершення сесії стейкінгу {session_id}, cancelled_early={cancelled_early}, final_amount={final_amount}")

        # Оновлюємо сесію
        return update_staking_session(session_id, update_data)
    except Exception as e:
        logger.error(f"complete_staking_session: Помилка: {str(e)}", exc_info=True)
        return None


def delete_staking_session(session_id):
    """
    Видалення сесії стейкінгу з бази даних

    Args:
        session_id (str): ID сесії стейкінгу

    Returns:
        bool: True, якщо видалення успішне, False у випадку помилки
    """
    try:
        if not supabase:
            logger.error("❌ Клієнт Supabase не ініціалізовано")
            return False

        logger.info(f"delete_staking_session: Видалення сесії стейкінгу {session_id}")

        # Виконуємо запит з повторними спробами
        def delete_staking():
            res = supabase.table("staking_sessions").delete().eq("id", session_id).execute()

            # Перевіряємо успішність видалення
            success = res and res.data and len(res.data) > 0

            if success:
                logger.info(f"delete_staking_session: Сесію стейкінгу {session_id} успішно видалено")
            else:
                logger.warning(f"delete_staking_session: Не вдалося видалити сесію стейкінгу {session_id}")

            return success

        return retry_supabase(delete_staking)
    except Exception as e:
        logger.error(f"delete_staking_session: Помилка: {str(e)}", exc_info=True)
        return False


def get_all_active_staking_sessions():
    """
    Отримання всіх активних сесій стейкінгу в системі

    Returns:
        list або None: Список активних сесій стейкінгу або None у випадку помилки
    """
    try:
        if not supabase:
            logger.error("❌ Клієнт Supabase не ініціалізовано")
            return None

        logger.info("get_all_active_staking_sessions: Отримання всіх активних сесій стейкінгу")

        # Виконуємо запит з повторними спробами
        def fetch_active_sessions():
            res = supabase.table("staking_sessions").select("*").eq("is_active", True).execute()

            logger.info(f"get_all_active_staking_sessions: Отримано {len(res.data) if res.data else 0} активних сесій")

            return res.data if res.data else []

        return retry_supabase(fetch_active_sessions)
    except Exception as e:
        logger.error(f"get_all_active_staking_sessions: Помилка: {str(e)}", exc_info=True)
        return None


def check_and_complete_expired_staking_sessions():
    """
    Перевірка та автоматичне завершення прострочених сесій стейкінгу

    Returns:
        int: Кількість завершених сесій
    """
    try:
        if not supabase:
            logger.error("❌ Клієнт Supabase не ініціалізовано")
            return 0

        logger.info("check_and_complete_expired_staking_sessions: Перевірка прострочених сесій стейкінгу")

        # Отримуємо всі активні сесії
        active_sessions = get_all_active_staking_sessions()
        if not active_sessions:
            logger.info("check_and_complete_expired_staking_sessions: Немає активних сесій")
            return 0

        # Поточний час
        now = datetime.now()
        completed_count = 0

        # Перевіряємо кожну сесію
        for session in active_sessions:
            try:
                # Отримуємо дату завершення
                ends_at_str = session.get("ends_at")
                if not ends_at_str:
                    continue

                # Парсимо дату завершення
                try:
                    ends_at = datetime.fromisoformat(ends_at_str.replace('Z', '+00:00'))
                except ValueError:
                    # Пробуємо інший формат
                    try:
                        ends_at = datetime.strptime(ends_at_str, "%Y-%m-%dT%H:%M:%S.%f")
                    except ValueError:
                        ends_at = datetime.strptime(ends_at_str, "%Y-%m-%dT%H:%M:%S")

                # Перевіряємо, чи сесія прострочена
                if now >= ends_at:
                    logger.info(f"Сесія {session.get('id')} прострочена, автоматичне завершення")

                    # Завершуємо сесію
                    result = complete_staking_session(session.get('id'), cancelled_early=False)

                    if result:
                        completed_count += 1
            except Exception as e:
                logger.error(f"Помилка обробки сесії {session.get('id')}: {str(e)}")
                continue

        logger.info(f"check_and_complete_expired_staking_sessions: Завершено {completed_count} прострочених сесій")
        return completed_count
    except Exception as e:
        logger.error(f"check_and_complete_expired_staking_sessions: Помилка: {str(e)}", exc_info=True)
        return 0


def calculate_total_staking_stats():
    """
    Розрахунок загальної статистики стейкінгу

    Returns:
        dict: Статистика стейкінгу або порожній словник у випадку помилки
    """
    try:
        if not supabase:
            logger.error("❌ Клієнт Supabase не ініціалізовано")
            return {}

        logger.info("calculate_total_staking_stats: Розрахунок загальної статистики стейкінгу")

        # Виконуємо запит з повторними спробами
        def fetch_staking_stats():
            # Отримуємо всі сесії
            all_sessions = supabase.table("staking_sessions").select("*").execute()

            if not all_sessions.data:
                logger.info("calculate_total_staking_stats: Немає даних стейкінгу")
                return {}

            sessions = all_sessions.data

            # Ініціалізуємо статистику
            stats = {
                "total_sessions": len(sessions),
                "active_sessions": sum(1 for s in sessions if s.get("is_active")),
                "total_staked": sum(float(s.get("amount_staked", 0)) for s in sessions),
                "total_paid_out": sum(float(s.get("final_amount_paid", 0)) for s in sessions if not s.get("is_active")),
                "active_staked": sum(float(s.get("amount_staked", 0)) for s in sessions if s.get("is_active")),
                "completed_sessions": sum(
                    1 for s in sessions if not s.get("is_active") and not s.get("cancelled_early")),
                "cancelled_sessions": sum(1 for s in sessions if not s.get("is_active") and s.get("cancelled_early")),
                "by_period": {
                    "7_days": sum(1 for s in sessions if s.get("staking_days") == 7),
                    "14_days": sum(1 for s in sessions if s.get("staking_days") == 14),
                    "28_days": sum(1 for s in sessions if s.get("staking_days") == 28)
                }
            }

            logger.info(f"calculate_total_staking_stats: Статистику успішно розраховано")
            return stats

        return retry_supabase(fetch_staking_stats) or {}
    except Exception as e:
        logger.error(f"msg: calculate_total_staking_stats: Помилка: {str(e)}", exc_info=True)
        return {}


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

            # Спроба вставки тестових даних
            test_id = f"test-{int(time.time())}"
            test_data = {
                "telegram_id": test_id,
                "username": "Test User",
                "balance": 0,
                "coins": 1
            }

            insert_test = False
            try:
                test_insert = supabase.table("winix").insert(test_data).execute()
                insert_test = bool(test_insert.data)
            except Exception as e:
                insert_test = False
                logger.error(f"test_supabase_connection: Помилка тестової вставки: {str(e)}")

            return {
                "success": True,
                "message": "З'єднання з Supabase успішне",
                "details": {
                    "response_time_ms": round(response_time * 1000, 2),
                    "tables_available": ["winix", "transactions", "staking_sessions"],
                    "insert_test": insert_test,
                    "supabase_url": SUPABASE_URL[:15] + "..." if SUPABASE_URL else None
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


# Якщо цей файл запускається напряму, виконати тести з'єднання
if __name__ == "__main__":
    print("🧪 Запуск тестування з'єднання з Supabase...")

    connection_result = test_supabase_connection()
    print(f"✓ Результат тесту з'єднання: {connection_result['success']}")
    print(f"✓ Повідомлення: {connection_result['message']}")

    if connection_result['success']:
        test_id = "test-" + str(int(time.time()))
        print(f"\n🧪 Тестування створення користувача з ID {test_id}...")
        test_user = force_create_user(test_id, "test_user")
        if test_user:
            print(f"✓ Користувача {test_id} успішно створено!")
        else:
            print(f"✗ Не вдалося створити користувача {test_id}")

        print(f"\n🧪 Тестування таблиці staking_sessions...")
        try:
            # Перевіряємо наявність таблиці
            result = supabase.table("staking_sessions").select("count").limit(1).execute()
            print(f"✓ Таблиця staking_sessions доступна")

            # Тестуємо створення сесії
            test_session = create_staking_session(test_id, 100, 7)
            if test_session:
                session_id = test_session.get("id")
                print(f"✓ Тестову сесію стейкінгу {session_id} успішно створено")

                # Тестуємо отримання сесії
                fetched_session = get_staking_session(session_id)
                if fetched_session:
                    print(f"✓ Тестову сесію стейкінгу успішно отримано")

                    # Тестуємо оновлення сесії
                    update_result = update_staking_session(session_id, {"amount_staked": 150})
                    if update_result:
                        print(f"✓ Тестову сесію стейкінгу успішно оновлено")

                    # Тестуємо завершення сесії
                    complete_result = complete_staking_session(session_id, cancelled_early=True)
                    if complete_result:
                        print(f"✓ Тестову сесію стейкінгу успішно завершено")

                # Очищаємо тестові дані
                delete_result = delete_staking_session(session_id)
                if delete_result:
                    print(f"✓ Тестову сесію стейкінгу успішно видалено")
            else:
                print(f"✗ Не вдалося створити тестову сесію стейкінгу")
        except Exception as e:
            print(f"✗ Помилка при тестуванні staking_sessions: {str(e)}")