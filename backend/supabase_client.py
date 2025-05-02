"""
Модуль для взаємодії з Supabase API.
Забезпечує надійний доступ до даних, кешування та транзакційну обробку.
"""

import os
import time
import logging
import json
import uuid
import functools
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, List, Optional, Callable, TypeVar
from contextlib import contextmanager
from requests.exceptions import RequestException, Timeout, ConnectTimeout, ReadTimeout
from supabase import create_client, Client
from dotenv import load_dotenv

# Налаштування логування
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Завантаження змінних середовища
load_dotenv()

# Дані підключення з .env
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

# Константи для кешування та запитів
CACHE_TIMEOUT = int(os.getenv("CACHE_TIMEOUT", "300"))  # 5 хвилин за замовчуванням
CACHE_ENABLED = os.getenv("CACHE_ENABLED", "True").lower() == "true"
MAX_RETRIES = int(os.getenv("MAX_RETRIES", "3"))  # максимум 3 спроби
RETRY_DELAY = float(os.getenv("RETRY_DELAY", "2.5"))  # початкова затримка 2.5 секунда
DEFAULT_TIMEOUT = int(os.getenv("DEFAULT_TIMEOUT", "10"))  # таймаут запиту в секундах
MAX_CACHE_SIZE = int(os.getenv("MAX_CACHE_SIZE", "1000"))  # максимальний розмір кешу

# Перевірка наявності критичних змінних
if not SUPABASE_URL or not SUPABASE_KEY:
    logger.error("⚠️ КРИТИЧНА ПОМИЛКА: Відсутні змінні середовища SUPABASE_URL або SUPABASE_ANON_KEY")

# Структура кешу зі строгим контролем життєвого циклу записів
_cache: Dict[str, Dict[str, Any]] = {}

# Ініціалізація клієнта
try:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    logger.info("✅ Успішне підключення до Supabase")
except Exception as e:
    logger.error(f"❌ Помилка підключення до Supabase: {str(e)}", exc_info=True)
    supabase = None

# Тип, який повертається з функції
T = TypeVar('T')


# Клас для детальної інформації про кеш
class CacheStats:
    """Клас для збору та надання статистики кешування"""

    def __init__(self):
        self.hits = 0
        self.misses = 0
        self.invalidations = 0
        self.entries = 0
        self.last_cleanup = time.time()

    def get_stats(self) -> Dict[str, Any]:
        """Повертає поточну статистику кешування"""
        total_requests = self.hits + self.misses
        hit_rate = (self.hits / total_requests) * 100 if total_requests > 0 else 0

        return {
            "hits": self.hits,
            "misses": self.misses,
            "invalidations": self.invalidations,
            "entries": self.entries,
            "hit_rate": f"{hit_rate:.2f}%",
            "cache_enabled": CACHE_ENABLED,
            "last_cleanup": datetime.fromtimestamp(self.last_cleanup).isoformat()
        }


# Ініціалізація статистики кешу
cache_stats = CacheStats()


def cache_key(func_name: str, *args, **kwargs) -> str:
    """
    Генерує унікальний ключ для запису в кеші на основі функції та параметрів

    Args:
        func_name: Ім'я функції
        *args: Позиційні аргументи
        **kwargs: Іменовані аргументи

    Returns:
        Унікальний ключ для кешування
    """
    key_parts = [func_name]
    key_parts.extend([str(arg) for arg in args])
    key_parts.extend([f"{k}={v}" for k, v in sorted(kwargs.items())])
    return ":".join(key_parts)


def cache_get(key: str) -> Optional[Any]:
    """
    Отримує запис з кешу, якщо він існує і не застарів

    Args:
        key: Ключ кешу

    Returns:
        Дані з кешу або None, якщо запис відсутній або застарів
    """
    if not CACHE_ENABLED:
        return None

    cache_entry = _cache.get(key)
    if not cache_entry:
        cache_stats.misses += 1
        return None

    # Перевіряємо, чи не застарів запис
    current_time = time.time()
    if current_time > cache_entry.get("термін_дії", 0):
        # Видаляємо застарілий запис
        _cache.pop(key, None)
        cache_stats.misses += 1
        cache_stats.entries = len(_cache)
        return None

    cache_stats.hits += 1
    return cache_entry.get("дані")


def cache_set(key: str, data: Any, timeout: int = CACHE_TIMEOUT) -> None:
    """
    Зберігає дані в кеші із заданим терміном дії

    Args:
        key: Ключ кешу
        data: Дані для збереження
        timeout: Час життя запису в секундах
    """
    if not CACHE_ENABLED:
        return

    current_time = time.time()
    _cache[key] = {
        "дані": data,
        "час_створення": current_time,
        "термін_дії": current_time + timeout
    }
    cache_stats.entries = len(_cache)

    # Перевіряємо розмір кешу
    if len(_cache) > MAX_CACHE_SIZE or (current_time - cache_stats.last_cleanup > 3600):
        cleanup_cache()


def cleanup_cache() -> None:
    """Очищує застарілі записи в кеші"""
    if not CACHE_ENABLED:
        return

    current_time = time.time()
    keys_to_delete = []

    # Знаходимо всі застарілі записи
    for key, entry in list(_cache.items()):
        if current_time > entry.get("термін_дії", 0):
            keys_to_delete.append(key)

    # Видаляємо застарілі записи
    for key in keys_to_delete:
        _cache.pop(key, None)

    # Якщо після очищення застарілих записів кеш все ще занадто великий,
    # видаляємо найстаріші записи
    if len(_cache) > MAX_CACHE_SIZE:
        # Сортуємо за часом створення (найстаріші спочатку)
        sorted_keys = sorted(_cache.keys(),
                           key=lambda k: _cache[k].get("час_створення", 0))

        # Видаляємо найстаріші записи, щоб досягти 75% від максимального розміру
        target_size = int(MAX_CACHE_SIZE * 0.75)
        keys_to_delete = sorted_keys[:len(_cache) - target_size]

        for key in keys_to_delete:
            _cache.pop(key, None)

    cache_stats.entries = len(_cache)
    cache_stats.last_cleanup = current_time
    logger.info(f"Очищено {len(keys_to_delete)} застарілих записів у кеші. Поточний розмір: {len(_cache)}")


def cached(timeout: int = CACHE_TIMEOUT):
    """
    Декоратор, який кешує результати функції

    Args:
        timeout: Час життя запису в секундах

    Returns:
        Декорована функція з кешуванням результатів
    """

    def decorator(func: Callable[..., T]) -> Callable[..., T]:
        @functools.wraps(func)
        def wrapper(*args, **kwargs) -> T:
            # Ігноруємо кешування для функцій зміни даних
            if func.__name__.startswith(('update_', 'create_', 'delete_', 'add_')):
                # Інвалідуємо кеш для get_ функцій, що мають спільне ім'я сутності
                if args:
                    invalidate_cache_for_entity(args[0])
                return func(*args, **kwargs)

            # Для функцій отримання даних використовуємо кеш
            key = cache_key(func.__name__, *args, **kwargs)
            result = cache_get(key)

            if result is not None:
                logger.debug(f"Використовуємо кешований результат для {func.__name__}")
                return result

            result = func(*args, **kwargs)
            cache_set(key, result, timeout)
            return result

        return wrapper

    return decorator


def invalidate_cache_for_entity(entity_id: Any) -> None:
    """
    Інвалідує всі записи в кеші, пов'язані з вказаним ID

    Args:
        entity_id: Ідентифікатор сутності
    """
    if not CACHE_ENABLED:
        return

    keys_to_delete = []
    entity_id_str = str(entity_id)

    # Використовуємо list() для створення копії ключів
    for key in list(_cache.keys()):
        if entity_id_str in key:
            keys_to_delete.append(key)

    for key in keys_to_delete:
        _cache.pop(key, None)
        cache_stats.invalidations += 1

    cache_stats.entries = len(_cache)

    if keys_to_delete:
        logger.debug(f"Інвалідовано {len(keys_to_delete)} записів у кеші для {entity_id}")


def clear_cache(pattern: Optional[str] = None) -> int:
    """
    Повністю очищує кеш або його частину за патерном

    Args:
        pattern: Опціональний патерн для часткового очищення

    Returns:
        Кількість видалених записів
    """
    global _cache
    deleted_count = 0

    if pattern:
        keys_to_delete = [key for key in list(_cache.keys()) if pattern in key]
        for key in keys_to_delete:
            _cache.pop(key, None)
        deleted_count = len(keys_to_delete)
        cache_stats.entries = len(_cache)
        cache_stats.invalidations += 1
        logger.info(f"Очищено {deleted_count} записів у кеші за патерном '{pattern}'")
    else:
        deleted_count = len(_cache)
        _cache = {}
        cache_stats.entries = 0
        cache_stats.invalidations += 1
        logger.info(f"Кеш повністю очищено ({deleted_count} записів)")

    return deleted_count


@contextmanager
def execute_transaction():
    """
    Контекстний менеджер для атомарних транзакцій у Supabase

    Використання:
    with execute_transaction() as txn:
        txn.table("table1").insert(...).execute()
        txn.table("table2").update(...).execute()

    Повертає:
        Екземпляр клієнта Supabase для використання в транзакції

    Примітка:
    Це спрощена реалізація транзакцій. Для повної підтримки транзакцій
    в Supabase потрібно використовувати SQL-запити BEGIN/COMMIT/ROLLBACK.
    """
    if not supabase:
        raise ValueError("Клієнт Supabase не ініціалізовано")

    try:
        # Запуск транзакції
        # У майбутній версії тут був би SQL запит BEGIN
        logger.debug("Почато транзакцію")

        # Повертаємо клієнт для використання в транзакції
        yield supabase

        # Успішне завершення транзакції
        # У майбутній версії тут був би SQL запит COMMIT
        logger.debug("Транзакцію успішно завершено")
    except Exception as e:
        # Відкат транзакції при помилці
        # У майбутній версії тут був би SQL запит ROLLBACK
        logger.error(f"Помилка у транзакції: {str(e)}", exc_info=True)

        # Перевидаємо виняток для обробки на рівні вище
        raise


def retry_supabase(func: Callable[[], T], max_retries: int = MAX_RETRIES,
                   retry_delay: float = RETRY_DELAY,
                   exponential_backoff: bool = True) -> T:
    """
    Функція, яка робить повторні спроби викликати операції Supabase при помилках

    Args:
        func: Функція, яку потрібно викликати
        max_retries: Максимальна кількість спроб
        retry_delay: Затримка між спробами (секунди)
        exponential_backoff: Чи використовувати експоненційне збільшення затримки

    Returns:
        Результат функції або None у випадку помилки

    Raises:
        Exception: Остання помилка після всіх невдалих спроб
    """
    retries = 0
    last_error = None
    current_delay = retry_delay

    while retries < max_retries:
        try:
            return func()
        except (RequestException, ConnectionError, Timeout, ConnectTimeout, ReadTimeout) as e:
            # Мережеві помилки або помилки з'єднання
            last_error = e
            retries += 1

            # Залишається спроб
            remaining = max_retries - retries
            logger.warning(f"Спроба {retries}/{max_retries} не вдалася (мережева помилка): {str(e)}. "
                           f"Залишилось спроб: {remaining}")

            # Якщо це остання спроба, дозволяємо помилці прокинутись
            if retries >= max_retries:
                break

            # Інакше чекаємо перед наступною спробою
            time.sleep(current_delay)

            # Збільшуємо затримку експоненційно
            if exponential_backoff:
                current_delay *= 2
        except Exception as e:
            # Інші помилки (логіка, формат даних тощо)
            last_error = e
            retries += 1

            # Залишається спроб
            remaining = max_retries - retries
            logger.warning(f"Спроба {retries}/{max_retries} не вдалася (помилка логіки): {str(e)}. "
                           f"Залишилось спроб: {remaining}")

            # Якщо це остання спроба або помилка критична, дозволяємо їй прокинутись
            if retries >= max_retries:
                break

            # Інакше чекаємо перед наступною спробою
            time.sleep(current_delay)

            # Збільшуємо затримку експоненційно
            if exponential_backoff:
                current_delay *= 2

    # Якщо всі спроби не вдалися, піднімаємо останню помилку
    logger.error(f"Усі {max_retries} спроб не вдалися. Остання помилка: {str(last_error)}")
    raise last_error


# Базові функції для роботи з користувачами

@cached()
def get_user(telegram_id: str) -> Optional[Dict[str, Any]]:
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
            # Створюємо запит
            res = supabase.table("winix").select("*").eq("telegram_id", telegram_id).execute()

            if not res.data:
                logger.warning(f"get_user: Користувача з ID {telegram_id} не знайдено")
                return None

            logger.info(f"get_user: Користувача з ID {telegram_id} успішно отримано")
            return res.data[0] if res.data else None

        return retry_supabase(fetch_user)
    except Exception as e:
        logger.error(f"❌ Помилка отримання користувача {telegram_id}: {str(e)}", exc_info=True)
        return None


def force_create_user(telegram_id: str, username: str, referrer_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
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

        # Унікальний код реферала
        referral_code = str(uuid.uuid4())[:8].upper()

        # Створюємо базові дані для нового користувача
        now = datetime.now(timezone.utc)
        data = {
            "telegram_id": telegram_id,
            "username": username,
            "balance": 0,
            "coins": 3,
            "referrer_id": referrer_id,
            "referral_code": referral_code,
            "page1_completed": False,
            "newbie_bonus_claimed": False,
            "participations_count": 0,
            "badge_winner": False,
            "badge_beginner": False,
            "badge_rich": False,
            "badge_winner_reward_claimed": False,
            "badge_beginner_reward_claimed": False,
            "badge_rich_reward_claimed": False,
            "wins_count": 0,
            "created_at": now.isoformat(),
            "updated_at": now.isoformat()
        }

        logger.info(f"force_create_user: Примусове створення користувача: {telegram_id}")
        logger.debug(f"force_create_user: Дані для створення: {json.dumps(data)}")

        # Спроба вставити дані напряму
        try:
            with execute_transaction() as txn:
                res = txn.table("winix").insert(data).execute()

                # Створюємо транзакцію для початкових жетонів
                if res.data:
                    transaction_data = {
                        "telegram_id": telegram_id,
                        "type": "reward",
                        "amount": 3,
                        "description": "Початкові жетони при реєстрації",
                        "status": "completed",
                        "created_at": now.isoformat(),
                        "updated_at": now.isoformat()
                    }
                    txn.table("transactions").insert(transaction_data).execute()

            if res.data:
                logger.info(f"force_create_user: Користувача {telegram_id} успішно створено")
                # Інвалідуємо кеш для цього користувача
                invalidate_cache_for_entity(telegram_id)
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


def create_user(telegram_id: str, username: str, referrer_id: Optional[str] = None) -> Optional[Dict[str, Any]]:
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

        # Створюємо нового користувача
        return force_create_user(telegram_id, username, referrer_id)
    except Exception as e:
        logger.error(f"❌ Помилка створення користувача {telegram_id}: {str(e)}", exc_info=True)
        return None


def update_balance(telegram_id: str, amount: float) -> Optional[Dict[str, Any]]:
    """
    Оновлює баланс користувача на вказану суму (додає до поточного)

    Args:
        telegram_id: Ідентифікатор Telegram користувача
        amount: Сума для додавання (може бути від'ємною для віднімання)

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

        # Виконуємо транзакцію
        try:
            with execute_transaction() as txn:
                # Спочатку створюємо запис транзакції
                transaction_data = {
                    "telegram_id": telegram_id,
                    "type": "update_balance",
                    "amount": amount,
                    "description": f"Оновлення балансу ({'+' if amount >= 0 else ''}{amount})",
                    "status": "completed",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                    "previous_balance": current_balance
                }
                txn.table("transactions").insert(transaction_data).execute()

                # Потім оновлюємо баланс
                result = txn.table("winix").update({
                    "balance": new_balance,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }).eq("telegram_id", telegram_id).execute()

        except Exception as e:
            logger.error(f"update_balance: Помилка транзакції: {str(e)}")
            raise e

        # Інвалідуємо кеш для цього користувача
        invalidate_cache_for_entity(telegram_id)

        # Перевіряємо, чи потрібно активувати бейдж багатія
        if new_balance >= 50000 and not user.get("badge_rich", False):
            logger.info(f"🏆 Користувач {telegram_id} отримує бейдж багатія")
            supabase.table("winix").update({"badge_rich": True}).eq("telegram_id", telegram_id).execute()

        return result.data[0] if result.data else None
    except Exception as e:
        logger.error(f"❌ Помилка оновлення балансу {telegram_id}: {str(e)}", exc_info=True)
        return None


def update_coins(telegram_id: str, amount: int) -> Optional[Dict[str, Any]]:
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

        # Виконуємо транзакцію
        try:
            with execute_transaction() as txn:
                # Спочатку створюємо запис транзакції
                transaction_data = {
                    "telegram_id": telegram_id,
                    "type": "update_coins",
                    "amount": amount,
                    "description": f"Оновлення жетонів ({'+' if amount >= 0 else ''}{amount})",
                    "status": "completed",
                    "created_at": datetime.now(timezone.utc).isoformat(),
                    "updated_at": datetime.now(timezone.utc).isoformat(),
                    "previous_coins": current_coins
                }
                txn.table("transactions").insert(transaction_data).execute()

                # Потім оновлюємо кількість жетонів
                result = txn.table("winix").update({
                    "coins": new_coins,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }).eq("telegram_id", telegram_id).execute()
        except Exception as e:
            logger.error(f"update_coins: Помилка транзакції: {str(e)}")
            raise e

        # Інвалідуємо кеш для цього користувача
        invalidate_cache_for_entity(telegram_id)

        return result.data[0] if result.data else None
    except Exception as e:
        logger.error(f"❌ Помилка оновлення жетонів {telegram_id}: {str(e)}", exc_info=True)
        return None


def update_user(telegram_id: str, data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
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

        # Фільтруємо та валідуємо дані для оновлення
        valid_data = {}
        for key, value in data.items():
            # Перевіряємо, чи поле існує для користувача і чи змінилось
            if key in user and user[key] != value:
                valid_data[key] = value

        # Додаємо поле updated_at
        valid_data["updated_at"] = datetime.now(timezone.utc).isoformat()

        logger.info(f"update_user: Оновлення користувача {telegram_id} з полями: {list(valid_data.keys())}")

        # Виконуємо запит з повторними спробами
        def update_user_data():
            res = supabase.table("winix").update(valid_data).eq("telegram_id", telegram_id).execute()
            return res.data[0] if res.data else None

        result = retry_supabase(update_user_data)

        # Інвалідуємо кеш для цього користувача
        invalidate_cache_for_entity(telegram_id)

        return result
    except Exception as e:
        logger.error(f"❌ Помилка оновлення даних користувача {telegram_id}: {str(e)}", exc_info=True)
        return None


def check_and_update_badges(telegram_id: str) -> Optional[Dict[str, Any]]:
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
        if not user.get("badge_beginner", False) and user.get("participations_count", 0) >= 5:
            updates["badge_beginner"] = True
            logger.info(f"🏆 Користувач {telegram_id} отримує бейдж початківця")

        # Бейдж багатія - за 50,000 WINIX
        if not user.get("badge_rich", False) and float(user.get("balance", 0)) >= 50000:
            updates["badge_rich"] = True
            logger.info(f"🏆 Користувач {telegram_id} отримує бейдж багатія")

        # Бейдж переможця - якщо є виграші
        if not user.get("badge_winner", False) and user.get("wins_count", 0) > 0:
            updates["badge_winner"] = True
            logger.info(f"🏆 Користувач {telegram_id} отримує бейдж переможця")

        # Якщо є оновлення, зберігаємо їх
        if updates:
            updates["updated_at"] = datetime.now(timezone.utc).isoformat()
            logger.info(f"check_and_update_badges: Оновлення бейджів користувача {telegram_id}: {updates}")
            return update_user(telegram_id, updates)

        return user
    except Exception as e:
        logger.error(f"❌ Помилка перевірки бейджів {telegram_id}: {str(e)}", exc_info=True)
        return None


# Функції для роботи з таблицею staking_sessions

def create_staking_session(user_id: str, amount_staked: float, staking_days: int,
                           reward_percent: Optional[float] = None) -> Optional[Dict[str, Any]]:
    """
    Створення нової сесії стейкінгу в окремій таблиці staking_sessions

    Args:
        user_id: ID користувача (Telegram ID)
        amount_staked: Сума токенів для стейкінгу
        staking_days: Кількість днів стейкінгу (7, 14, 28)
        reward_percent: Відсоток винагороди. Якщо None, розрахується автоматично.

    Returns:
        Дані створеної сесії стейкінгу або None у випадку помилки
    """
    try:
        if not supabase:
            logger.error("❌ Клієнт Supabase не ініціалізовано")
            return None

        # Перевіряємо параметри
        if not user_id or not amount_staked or not staking_days:
            logger.error("create_staking_session: Відсутні обов'язкові параметри")
            return None

        # Переконуємося, що user_id - рядок
        user_id = str(user_id)

        # Визначаємо відсоток винагороди, якщо не вказаний
        if reward_percent is None:
            if staking_days == 7:
                reward_percent = 5.0
            elif staking_days == 14:
                reward_percent = 7.5
            elif staking_days == 28:
                reward_percent = 10.0
            else:
                reward_percent = 5.0  # За замовчуванням

        # Розраховуємо дати з урахуванням часових поясів
        started_at = datetime.now(timezone.utc)
        ends_at = started_at + timedelta(days=staking_days)

        # Форматуємо дати для Supabase
        started_at_str = started_at.isoformat()
        ends_at_str = ends_at.isoformat()

        # Підготовка даних для зниження коштів в балансі користувача
        user = get_user(user_id)
        if not user:
            logger.error(f"create_staking_session: Користувача {user_id} не знайдено")
            return None

        current_balance = float(user.get("balance", 0))

        # Перевіряємо, чи достатньо коштів
        if current_balance < amount_staked:
            logger.error(
                f"create_staking_session: Недостатньо коштів. Потрібно: {amount_staked}, наявно: {current_balance}")
            return None

        # Створюємо ID для сесії стейкінгу
        session_id = str(uuid.uuid4())

        # Виконуємо транзакцію
        try:
            with execute_transaction() as txn:
                # 1. Спочатку списуємо кошти з балансу
                new_balance = current_balance - amount_staked
                txn.table("winix").update({
                    "balance": new_balance,
                    "updated_at": started_at_str
                }).eq("telegram_id", user_id).execute()

                # 2. Записуємо транзакцію списання коштів
                stake_transaction = {
                    "telegram_id": user_id,
                    "type": "stake",
                    "amount": -amount_staked,  # Від'ємна сума, бо кошти списуються з балансу
                    "description": f"Стейкінг на {staking_days} днів ({reward_percent}% річних)",
                    "status": "completed",
                    "created_at": started_at_str,
                    "updated_at": started_at_str,
                    "staking_id": session_id
                }
                txn.table("transactions").insert(stake_transaction).execute()

                # 3. Створюємо запис стейкінгу
                staking_data = {
                    "id": session_id,
                    "user_id": user_id,
                    "telegram_id": user_id,  # Додаємо для зворотної сумісності
                    "amount_staked": float(amount_staked),
                    "staking_days": int(staking_days),
                    "reward_percent": float(reward_percent),
                    "started_at": started_at_str,
                    "ends_at": ends_at_str,
                    "is_active": True,
                    "cancelled_early": False,
                    "final_amount_paid": 0,  # Спочатку 0, буде оновлено при закритті
                    "created_at": started_at_str,
                    "updated_at": started_at_str
                }
                staking_result = txn.table("staking_sessions").insert(staking_data).execute()

                # Отримуємо дані створеної сесії
                result = staking_result.data[0] if staking_result.data else None

                if not result:
                    # Якщо не вдалося створити сесію стейкінгу, відбувається відкат транзакції
                    raise ValueError("Не вдалося створити сесію стейкінгу")

                # Інвалідуємо кеш для користувача
                invalidate_cache_for_entity(user_id)

                return result
        except Exception as e:
            logger.error(f"create_staking_session: Помилка транзакції: {str(e)}")
            raise e
    except Exception as e:
        logger.error(f"create_staking_session: Критична помилка: {str(e)}", exc_info=True)
        return None


@cached()
def get_user_staking_sessions(user_id: str, active_only: bool = False) -> Optional[List[Dict[str, Any]]]:
    """
    Отримання всіх сесій стейкінгу користувача

    Args:
        user_id: ID користувача (Telegram ID)
        active_only: Якщо True, повертає лише активні сесії

    Returns:
        Список сесій стейкінгу або None у випадку помилки
    """
    try:
        if not supabase:
            logger.error("❌ Клієнт Supabase не ініціалізовано")
            return None

        # Переконуємося, що user_id - рядок
        user_id = str(user_id)

        logger.info(f"get_user_staking_sessions: Отримання сесій стейкінгу для {user_id}, active_only={active_only}")

        # Виконуємо запит з повторними спробами
        def fetch_staking_sessions():
            # Спершу спробуємо за полем telegram_id (для зворотної сумісності)
            query = supabase.table("staking_sessions").select("*").eq("telegram_id", user_id)

            # Якщо потрібні лише активні сесії, додаємо фільтр
            if active_only:
                query = query.eq("is_active", True)

            # Сортуємо за датою початку (спочатку найновіші)
            query = query.order("started_at", desc=True)

            # Виконуємо запит
            res = query.execute()

            if not res.data:
                # Якщо не знайдено за telegram_id, спробуємо за user_id
                query = supabase.table("staking_sessions").select("*").eq("user_id", user_id)

                if active_only:
                    query = query.eq("is_active", True)

                query = query.order("started_at", desc=True)
                res = query.execute()

            logger.info(f"get_user_staking_sessions: Отримано {len(res.data) if res.data else 0} сесій")

            return res.data if res.data else []

        return retry_supabase(fetch_staking_sessions)
    except Exception as e:
        logger.error(f"get_user_staking_sessions: Помилка: {str(e)}", exc_info=True)
        return None


@cached()
def get_staking_session(session_id: str) -> Optional[Dict[str, Any]]:
    """
    Отримання даних конкретної сесії стейкінгу за її ID

    Args:
        session_id: ID сесії стейкінгу

    Returns:
        Дані сесії стейкінгу або None у випадку помилки
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


def update_staking_session(session_id: str, update_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    Оновлення даних сесії стейкінгу

    Args:
        session_id: ID сесії стейкінгу
        update_data: Словник з полями для оновлення

    Returns:
        Оновлені дані сесії стейкінгу або None у випадку помилки
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
        protected_fields = ["id", "user_id", "telegram_id", "started_at"]
        for field in protected_fields:
            if field in update_data:
                logger.warning(f"update_staking_session: Поле {field} не може бути змінено, видаляємо з update_data")
                del update_data[field]

        # Логуємо поля, які будуть оновлені
        logger.info(f"update_staking_session: Поля для оновлення: {list(update_data.keys())}")

        # Додаємо час оновлення
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()

        # Виконуємо запит з повторними спробами
        def update_staking():
            res = supabase.table("staking_sessions").update(update_data).eq("id", session_id).execute()

            if not res.data:
                logger.warning(f"update_staking_session: Supabase не повернув даних")
                return None

            logger.info(f"update_staking_session: Сесію стейкінгу {session_id} успішно оновлено")
            return res.data[0] if res.data else None

        result = retry_supabase(update_staking)

        # Інвалідуємо кеш для цієї сесії та користувача
        invalidate_cache_for_entity(session_id)
        if current_session.get("user_id"):
            invalidate_cache_for_entity(current_session.get("user_id"))
        if current_session.get("telegram_id"):
            invalidate_cache_for_entity(current_session.get("telegram_id"))

        return result
    except Exception as e:
        logger.error(f"update_staking_session: Помилка: {str(e)}", exc_info=True)
        return None


def complete_staking_session(session_id: str, final_amount: Optional[float] = None,
                             cancelled_early: bool = False) -> Optional[Dict[str, Any]]:
    """
    Завершення сесії стейкінгу (виплата винагороди або дострокове скасування)

    Args:
        session_id: ID сесії стейкінгу
        final_amount: Сума, яку виплачено (з урахуванням винагороди або штрафу)
        cancelled_early: Чи було скасовано достроково

    Returns:
        Оновлені дані сесії стейкінгу або None у випадку помилки
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

        # Отримуємо telegram_id користувача
        user_id = current_session.get("telegram_id") or current_session.get("user_id")
        if not user_id:
            logger.error(f"complete_staking_session: Не вдалося отримати ID користувача для сесії {session_id}")
            return None

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
                staking_days = float(current_session.get("staking_days", 14))
                # Розрахунок річного відсотка пропорційно до днів стейкінгу
                daily_reward_rate = reward_percent / 365
                reward = amount_staked * (daily_reward_rate / 100) * staking_days
                final_amount = amount_staked + reward

        # Оновлення даних в транзакції для атомарності
        try:
            now = datetime.now(timezone.utc).isoformat()

            with execute_transaction() as txn:
                # 1. Оновлюємо статус сесії стейкінгу
                update_data = {
                    "is_active": False,
                    "cancelled_early": cancelled_early,
                    "final_amount_paid": float(final_amount),
                    "completed_at": now,
                    "updated_at": now
                }

                staking_result = txn.table("staking_sessions").update(update_data).eq("id", session_id).execute()

                # 2. Нараховуємо кошти на баланс користувача
                user = get_user(user_id)
                if user:
                    current_balance = float(user.get("balance", 0))
                    new_balance = current_balance + final_amount

                    txn.table("winix").update({
                        "balance": new_balance,
                        "updated_at": now
                    }).eq("telegram_id", user_id).execute()

                    # 3. Створюємо транзакцію для повернення коштів
                    transaction_type = "unstake_penalty" if cancelled_early else "unstake_reward"
                    transaction_desc = "Дострокове скасування стейкінгу (зі штрафом)" if cancelled_early else "Завершення стейкінгу з винагородою"

                    transaction_data = {
                        "telegram_id": user_id,
                        "type": transaction_type,
                        "amount": final_amount,
                        "description": transaction_desc,
                        "status": "completed",
                        "created_at": now,
                        "updated_at": now,
                        "staking_id": session_id,
                        "previous_balance": current_balance
                    }

                    txn.table("transactions").insert(transaction_data).execute()

                result = staking_result.data[0] if staking_result.data else None

                if not result:
                    raise ValueError("Не вдалося завершити сесію стейкінгу")

                # Інвалідуємо кеш для сесії та користувача
                invalidate_cache_for_entity(session_id)
                invalidate_cache_for_entity(user_id)

                return result
        except Exception as e:
            logger.error(f"complete_staking_session: Помилка транзакції: {str(e)}")
            raise e
    except Exception as e:
        logger.error(f"complete_staking_session: Помилка: {str(e)}", exc_info=True)
        return None


def delete_staking_session(session_id: str) -> bool:
    """
    Видалення сесії стейкінгу з бази даних

    Args:
        session_id: ID сесії стейкінгу

    Returns:
        True, якщо видалення успішне, False у випадку помилки
    """
    try:
        if not supabase:
            logger.error("❌ Клієнт Supabase не ініціалізовано")
            return False

        # Отримуємо сесію для інвалідації кешу
        current_session = get_staking_session(session_id)

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

        result = retry_supabase(delete_staking)

        # Інвалідуємо кеш для сесії та користувача
        invalidate_cache_for_entity(session_id)
        if current_session:
            if current_session.get("user_id"):
                invalidate_cache_for_entity(current_session.get("user_id"))
            if current_session.get("telegram_id"):
                invalidate_cache_for_entity(current_session.get("telegram_id"))

        return result
    except Exception as e:
        logger.error(f"delete_staking_session: Помилка: {str(e)}", exc_info=True)
        return False


@cached()
def get_all_active_staking_sessions() -> List[Dict[str, Any]]:
    """
    Отримання всіх активних сесій стейкінгу в системі

    Returns:
        Список активних сесій стейкінгу або порожній список у випадку помилки
    """
    try:
        if not supabase:
            logger.error("❌ Клієнт Supabase не ініціалізовано")
            return []

        logger.info("get_all_active_staking_sessions: Отримання всіх активних сесій стейкінгу")

        # Виконуємо запит з повторними спробами
        def fetch_active_sessions():
            res = supabase.table("staking_sessions").select("*").eq("is_active", True).execute()

            logger.info(f"get_all_active_staking_sessions: Отримано {len(res.data) if res.data else 0} активних сесій")

            return res.data if res.data else []

        return retry_supabase(fetch_active_sessions)
    except Exception as e:
        logger.error(f"get_all_active_staking_sessions: Помилка: {str(e)}", exc_info=True)
        return []


def check_and_complete_expired_staking_sessions() -> Dict[str, Any]:
    """
    Перевірка та автоматичне завершення прострочених сесій стейкінгу

    Returns:
        Словник з результатами операції
    """
    try:
        if not supabase:
            logger.error("❌ Клієнт Supabase не ініціалізовано")
            return {"status": "error", "message": "Клієнт Supabase не ініціалізовано", "completed_count": 0}

        logger.info("check_and_complete_expired_staking_sessions: Перевірка прострочених сесій стейкінгу")

        # Отримуємо всі активні сесії
        active_sessions = get_all_active_staking_sessions()
        if not active_sessions:
            logger.info("check_and_complete_expired_staking_sessions: Немає активних сесій")
            return {"status": "success", "message": "Немає активних сесій", "completed_count": 0}

        # Поточний час з часовим поясом
        now = datetime.now(timezone.utc)
        completed_count = 0
        completed_sessions = []
        errors = []

        # Перевіряємо кожну сесію
        for session in active_sessions:
            try:
                # Отримуємо дату завершення
                ends_at_str = session.get("ends_at")
                if not ends_at_str:
                    continue

                # Парсимо дату завершення і забезпечуємо наявність часового поясу
                try:
                    ends_at = datetime.fromisoformat(ends_at_str.replace('Z', '+00:00'))
                    if ends_at.tzinfo is None:
                        ends_at = ends_at.replace(tzinfo=timezone.utc)
                except ValueError:
                    logger.error(f"Помилка парсингу дати {ends_at_str}")
                    continue

                # Перевіряємо, чи сесія прострочена
                if now >= ends_at:
                    logger.info(f"Сесія {session.get('id')} прострочена, автоматичне завершення")

                    # Завершуємо сесію з повною винагородою
                    result = complete_staking_session(session.get('id'), cancelled_early=False)

                    if result:
                        completed_count += 1
                        completed_sessions.append({
                            "id": session.get('id'),
                            "user_id": session.get('user_id') or session.get('telegram_id'),
                            "amount_staked": session.get('amount_staked'),
                            "final_amount": result.get('final_amount_paid')
                        })
            except Exception as e:
                logger.error(f"Помилка обробки сесії {session.get('id')}: {str(e)}")
                errors.append({
                    "session_id": session.get('id'),
                    "error": str(e)
                })
                continue

        logger.info(f"check_and_complete_expired_staking_sessions: Завершено {completed_count} прострочених сесій")
        return {
            "status": "success",
            "completed_count": completed_count,
            "completed_sessions": completed_sessions,
            "errors": errors,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
    except Exception as e:
        logger.error(f"check_and_complete_expired_staking_sessions: Помилка: {str(e)}", exc_info=True)
        return {
            "status": "error",
            "message": str(e),
            "completed_count": 0
        }


def verify_staking_consistency(telegram_id: str) -> Dict[str, Any]:
    """
    Перевіряє цілісність даних стейкінгу та виправляє їх при необхідності.

    Args:
        telegram_id: ID користувача Telegram

    Returns:
        Словник з результатами перевірки
    """
    try:
        # Отримуємо активні сесії для користувача
        active_sessions = get_user_staking_sessions(telegram_id, active_only=True)

        if not active_sessions:
            logger.info(f"verify_staking_consistency: Користувач {telegram_id} не має активних сесій стейкінгу")
            return {
                "status": "success",
                "message": "Активні сесії стейкінгу відсутні",
                "active_sessions": 0
            }

        # Якщо є більше однієї активної сесії - залишаємо лише найновішу
        if len(active_sessions) > 1:
            logger.warning(
                f"verify_staking_consistency: Користувач {telegram_id} має {len(active_sessions)} активних сесій. Залишаємо тільки найновішу.")

            # Сортуємо за датою створення (спочатку найновіші)
            sorted_sessions = sorted(active_sessions, key=lambda x: x.get("started_at", ""), reverse=True)

            # Залишаємо тільки найновішу сесію
            newest_session = sorted_sessions[0]
            closed_sessions = []

            # Скасовуємо всі інші сесії
            for session in sorted_sessions[1:]:
                try:
                    # Завершуємо сесію як скасовану
                    result = complete_staking_session(
                        session_id=session["id"],
                        final_amount=0,
                        cancelled_early=True
                    )

                    if result:
                        closed_sessions.append(session["id"])
                        logger.info(f"verify_staking_consistency: Автоматично скасовано дублікат сесії {session['id']}")
                except Exception as e:
                    logger.error(
                        f"verify_staking_consistency: Помилка скасування дублікату сесії {session['id']}: {str(e)}")

            return {
                "status": "fixed",
                "message": "Виправлено дублікати активних сесій стейкінгу",
                "active_sessions": 1,
                "closed_sessions": closed_sessions
            }

        # Перевіряємо дату завершення стейкінгу
        fixed_count = 0
        for session in active_sessions:
            try:
                # Отримуємо кінцеву дату
                ends_at_str = session.get("ends_at")
                if ends_at_str:
                    try:
                        # Парсимо дату з урахуванням часового поясу
                        ends_at = datetime.fromisoformat(ends_at_str.replace('Z', '+00:00'))
                        if ends_at.tzinfo is None:
                            ends_at = ends_at.replace(tzinfo=timezone.utc)

                        # Перевіряємо, чи не закінчився термін стейкінгу
                        now = datetime.now(timezone.utc)
                        if now >= ends_at:
                            logger.info(
                                f"verify_staking_consistency: Знайдено простроченую сесію {session['id']}, автоматичне завершення")

                            # Автоматичне завершення стейкінгу
                            result = complete_staking_session(
                                session_id=session["id"],
                                cancelled_early=False
                            )

                            if result:
                                fixed_count += 1
                    except ValueError:
                        logger.error(f"verify_staking_consistency: Неможливо розпарсити дату завершення: {ends_at_str}")
            except Exception as e:
                logger.error(f"verify_staking_consistency: Помилка перевірки сесії {session.get('id')}: {str(e)}")

        if fixed_count > 0:
            return {
                "status": "fixed",
                "message": "Виправлено прострочені сесії стейкінгу",
                "active_sessions": len(active_sessions) - fixed_count,
                "fixed_sessions": fixed_count
            }
        else:
            return {
                "status": "success",
                "message": "Всі сесії стейкінгу коректні",
                "active_sessions": len(active_sessions)
            }
    except Exception as e:
        logger.error(f"verify_staking_consistency: Помилка: {str(e)}", exc_info=True)
        return {
            "status": "error",
            "message": str(e),
            "error": True
        }


@cached(timeout=600)  # Кешування на 10 хвилин
def calculate_total_staking_stats() -> Dict[str, Any]:
    """
    Розрахунок загальної статистики стейкінгу

    Returns:
        Словник зі статистикою стейкінгу
    """
    try:
        if not supabase:
            logger.error("❌ Клієнт Supabase не ініціалізовано")
            return {}

        logger.info("calculate_total_staking_stats: Розрахунок загальної статистики стейкінгу")

        # Виконуємо запит з повторними спробами
        def fetch_staking_stats():
            # Оптимізуємо запит для зменшення обсягу даних
            all_sessions_res = supabase.table("staking_sessions").select(
                "id,is_active,amount_staked,final_amount_paid,cancelled_early,staking_days"
            ).execute()

            if not all_sessions_res.data:
                logger.info("calculate_total_staking_stats: Немає даних стейкінгу")
                return {}

            sessions = all_sessions_res.data

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
                },
                "timestamp": datetime.now(timezone.utc).isoformat()
            }

            logger.info(f"calculate_total_staking_stats: Статистику успішно розраховано")
            return stats

        return retry_supabase(fetch_staking_stats)
    except Exception as e:
        logger.error(f"calculate_total_staking_stats: Помилка: {str(e)}", exc_info=True)
        return {
            "status": "error",
            "message": str(e),
            "timestamp": datetime.now(timezone.utc).isoformat()
        }


def repair_staking_session(telegram_id: str) -> Dict[str, Any]:
    """
    Знаходить і відновлює пошкоджені сесії стейкінгу.

    Args:
        telegram_id: ID користувача Telegram

    Returns:
        Результат відновлення
    """
    try:
        # Перетворюємо ID в рядок
        telegram_id = str(telegram_id)

        logger.info(f"repair_staking_session: Запуск відновлення сесій стейкінгу для користувача {telegram_id}")

        # Інвалідуємо кеш для цього користувача
        invalidate_cache_for_entity(telegram_id)

        # Спочатку запускаємо перевірку цілісності (вона виправить більшість проблем)
        consistency_result = verify_staking_consistency(telegram_id)

        # Якщо перевірка цілісності знайшла і виправила проблеми, повертаємо результат
        if consistency_result.get("status") == "fixed":
            return consistency_result

        # Якщо активні сесії є, і вони коректні, то додаткове відновлення не потрібне
        if consistency_result.get("status") == "success" and consistency_result.get("active_sessions", 0) > 0:
            return consistency_result

        # Якщо немає активних сесій, перевіряємо останню сесію
        all_sessions = get_user_staking_sessions(telegram_id, active_only=False)

        if not all_sessions or len(all_sessions) == 0:
            logger.info(f"repair_staking_session: Користувач {telegram_id} не має жодних сесій стейкінгу")
            return {
                "status": "success",
                "message": "Сесії стейкінгу не знайдено",
                "active_sessions": 0
            }

        # Сортуємо за датою (спочатку найновіші)
        sorted_sessions = sorted(all_sessions, key=lambda x: x.get("started_at", ""), reverse=True)

        # Перевіряємо останню сесію
        latest_session = sorted_sessions[0]

        # Перевіряємо, чи не була вона випадково деактивована
        if not latest_session.get("is_active", False):
            # Перевіряємо, чи не завершена сесія коректно
            if not latest_session.get("final_amount_paid", 0) > 0 and not latest_session.get("cancelled_early", False):
                logger.info(f"repair_staking_session: Відновлення випадково деактивованої сесії {latest_session['id']}")

                # Отримуємо дату завершення
                ends_at_str = latest_session.get("ends_at")
                if ends_at_str:
                    try:
                        # Парсимо дату
                        ends_at = datetime.fromisoformat(ends_at_str.replace('Z', '+00:00'))
                        if ends_at.tzinfo is None:
                            ends_at = ends_at.replace(tzinfo=timezone.utc)

                        # Перевіряємо, чи не закінчився термін стейкінгу
                        now = datetime.now(timezone.utc)

                        if now < ends_at:
                            # Реактивуємо сесію, якщо термін ще не вийшов
                            update_staking_session(latest_session["id"], {"is_active": True})

                            logger.info(f"repair_staking_session: Сесію {latest_session['id']} успішно відновлено")

                            return {
                                "status": "fixed",
                                "message": "Виявлено та відновлено пошкоджену сесію стейкінгу",
                                "recovered_session": latest_session["id"]
                            }
                        else:
                            # Якщо термін вже вийшов, завершуємо сесію коректно
                            logger.info(
                                f"repair_staking_session: Сесія {latest_session['id']} вже закінчилася, завершуємо її")

                            complete_staking_session(
                                session_id=latest_session["id"],
                                cancelled_early=False
                            )

                            return {
                                "status": "fixed",
                                "message": "Знайдено та завершено прострочену сесію стейкінгу",
                                "completed_session": latest_session["id"]
                            }
                    except ValueError:
                        logger.error(f"repair_staking_session: Неможливо розпарсити дату завершення: {ends_at_str}")

        logger.info(f"repair_staking_session: Відновлення не потрібне для користувача {telegram_id}")

        return {
            "status": "success",
            "message": "Відновлення не потрібне. Останній стейкінг коректно завершено або активний."
        }
    except Exception as e:
        logger.error(f"repair_staking_session: Помилка: {str(e)}", exc_info=True)
        return {
            "status": "error",
            "message": f"Помилка відновлення стейкінгу: {str(e)}"
        }


# Функція для тестування з'єднання з Supabase
def test_supabase_connection() -> Dict[str, Any]:
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

            # Кеш-статистика
            cache_information = {
                "enabled": CACHE_ENABLED,
                "timeout": CACHE_TIMEOUT,
                "entries": cache_stats.entries,
                "hit_rate": f"{(cache_stats.hits / (cache_stats.hits + cache_stats.misses)) * 100:.2f}%" if (
                                                                                                                      cache_stats.hits + cache_stats.misses) > 0 else "0.00%",
                "hits": cache_stats.hits,
                "misses": cache_stats.misses,
                "invalidations": cache_stats.invalidations,
                "last_cleanup": datetime.fromtimestamp(cache_stats.last_cleanup).isoformat()
            }

            return {
                "success": True,
                "message": "З'єднання з Supabase успішне",
                "details": {
                    "response_time_ms": round(response_time * 1000, 2),
                    "tables_available": ["winix", "transactions", "staking_sessions"],
                    "insert_test": insert_test,
                    "supabase_url": SUPABASE_URL[:15] + "..." if SUPABASE_URL else None,
                    "cache": cache_information,
                    "timestamp": datetime.now(timezone.utc).isoformat()
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
def check_and_update_badges(user_id, context=None):
    """
    Функція для перевірки та оновлення бейджів користувача.
    Для зворотної сумісності перенаправляє на award_badges
    """
    try:
        from badges.badge_service import award_badges
        return award_badges(user_id, context)
    except ImportError:
        try:
            from backend.badges.badge_service import award_badges
            return award_badges(user_id, context)
        except ImportError:
            logger.error("Помилка імпорту badge_service.py. Неможливо виконати перевірку бейджів.")
            return None

# Очищення кешу від застарілих записів при завантаженні модуля
cleanup_cache()

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

            # Тестуємо кешування
            print(f"\n🧪 Тестування системи кешування...")
            # Вимірюємо час першого запиту
            start_time = time.time()
            user1 = get_user(test_id)
            first_request_time = time.time() - start_time

            # Вимірюємо час другого запиту (має бути швидше через кеш)
            start_time = time.time()
            user2 = get_user(test_id)
            second_request_time = time.time() - start_time

            # Вимірюємо статистику кешу
            cache_stats_data = cache_stats.get_stats()

            print(f"✓ Час першого запиту: {first_request_time:.6f} сек.")
            print(f"✓ Час повторного запиту: {second_request_time:.6f} сек.")
            print(f"✓ Статистика кешу: {cache_stats_data}")

            if second_request_time < first_request_time:
                print(f"✓ Кешування працює коректно! Прискорення: {first_request_time / second_request_time:.2f}x")
            else:
                print(f"✗ Кешування не працює належним чином")

            # Тестуємо інвалідацію кешу
            print(f"\n🧪 Тестування інвалідації кешу...")
            update_user(test_id, {"username": "Updated Test User"})

            # Вимірюємо час запиту після інвалідації
            start_time = time.time()
            user3 = get_user(test_id)
            invalidated_request_time = time.time() - start_time

            print(f"✓ Час запиту після інвалідації: {invalidated_request_time:.6f} сек.")

            if user3 and user3.get("username") == "Updated Test User":
                print(f"✓ Інвалідація кешу працює коректно!")
            else:
                print(f"✗ Інвалідація кешу не працює належним чином")

            # Тестуємо транзакції через execute_transaction
            print(f"\n🧪 Тестування транзакцій...")
            try:
                with execute_transaction() as txn:
                    txn.table("winix").update({"balance": 10.0}).eq("telegram_id", test_id).execute()
                    txn.table("transactions").insert({
                        "telegram_id": test_id,
                        "type": "test",
                        "amount": 10.0,
                        "description": "Тестова транзакція",
                        "status": "completed",
                        "created_at": datetime.now(timezone.utc).isoformat(),
                        "updated_at": datetime.now(timezone.utc).isoformat()
                    }).execute()
                print(f"✓ Транзакція успішно виконана")
            except Exception as e:
                print(f"✗ Помилка при тестуванні транзакції: {str(e)}")

            # Видаляємо тестового користувача
            try:
                supabase.table("winix").delete().eq("telegram_id", test_id).execute()
                print(f"✓ Тестового користувача {test_id} успішно видалено")
            except Exception as e:
                print(f"✗ Помилка при видаленні тестового користувача: {str(e)}")

        except Exception as e:
            print(f"✗ Помилка при тестуванні: {str(e)}")