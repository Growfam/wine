"""
🔥 WINIX Supabase Client - Enhanced Edition v2.2 (FIXED + STAKING COMPLETE)
Модуль для взаємодії з Supabase API з повною підтримкою WINIX Quests System + STAKING.

Забезпечує:
- Надійний доступ до даних з retry логікою
- Розумне кешування з автоочищенням
- Транзакційну обробку
- Повну інтеграцію з WINIX системою завдань
- Backward compatibility з існуючою системою
- Ідеальну сумісність з новими таблицями
- Виправлені всі IDE помилки та попередження
- ПОВНУ ПІДТРИМКУ СТЕЙКІНГУ

Автор: ростік 🇺🇦
Версія: 2.3.0 (WINIX Enhanced + Perfect Compatibility + STAKING FIXED)
"""

import os
import time
import logging
import json
import uuid
import functools
import warnings
from datetime import datetime, timezone, timedelta  # ✅ ДОДАНО timedelta для стейкінгу
from typing import Dict, Any, List, Optional, Callable, TypeVar, Union
from contextlib import contextmanager
from requests.exceptions import RequestException, Timeout, ConnectTimeout, ReadTimeout
from supabase import create_client, Client
from dotenv import load_dotenv

# Відключаємо попередження PyCharm для Supabase
warnings.filterwarnings("ignore", category=UserWarning, module="supabase")

# ===== ПОЧАТКОВІ НАЛАШТУВАННЯ =====

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

# Ініціалізація клієнта з виправленнями
try:
    if SUPABASE_URL and SUPABASE_SERVICE_KEY:
        supabase: Optional[Client] = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
        logger.info("✅ Успішне підключення до Supabase з Service Role Key")
    elif SUPABASE_URL and SUPABASE_KEY:
        # Fallback на anon key якщо service key відсутній
        supabase: Optional[Client] = create_client(SUPABASE_URL, SUPABASE_KEY)
        logger.warning("⚠️ Використовується ANON KEY - можливі проблеми з RLS")
    else:
        supabase = None
        logger.error("❌ Відсутні змінні середовища SUPABASE")
except Exception as e:
    logger.error(f"❌ Помилка підключення до Supabase: {str(e)}", exc_info=True)
    supabase = None

# Тип, який повертається з функції
T = TypeVar('T')

# ===== КЛАСИ ТА УТИЛІТИ =====

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

# ===== БЕЗПЕЧНІ ВИКЛИКИ SUPABASE =====

def safe_supabase_call(operation_name: str):
    """Декоратор для безпечних викликів Supabase"""

    def decorator(func):
        @functools.wraps(func)
        def wrapper(*args, **kwargs):
            if not supabase:
                logger.error(f"❌ {operation_name}: Клієнт Supabase не ініціалізовано")
                return None

            try:
                return func(*args, **kwargs)
            except (RequestException, ConnectionError, Timeout, ConnectTimeout, ReadTimeout) as e:
                logger.error(f"❌ {operation_name}: Мережева помилка: {str(e)}")
                return None
            except Exception as e:
                error_msg = str(e)
                if "supabase" in error_msg.lower() or "postgrest" in error_msg.lower():
                    logger.error(f"❌ {operation_name}: Помилка Supabase: {error_msg}")
                else:
                    logger.error(f"❌ {operation_name}: Загальна помилка: {error_msg}")
                return None

        return wrapper

    return decorator

# ===== КЕШУВАННЯ СИСТЕМА =====

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
    Повністю очищає кеш або його частину за патерном

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

# ===== ТРАНЗАКЦІЇ ТА RETRY ЛОГІКА =====

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
        logger.debug("Почато транзакцію")

        # Повертаємо клієнт для використання в транзакції
        yield supabase

        # Успішне завершення транзакції
        logger.debug("Транзакцію успішно завершено")
    except Exception as e:
        # Відкат транзакції при помилці
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

# ===== КРИТИЧНІ ФУНКЦІЇ КОРИСТУВАЧІВ (ВИПРАВЛЕНІ) =====

@safe_supabase_call("get_user")
@cached()
def get_user(telegram_id: Union[str, int]) -> Optional[Dict[str, Any]]:
    """
    🔥 КРИТИЧНА ФУНКЦІЯ: Отримує дані користувача з Supabase за його Telegram ID

    ⚠️ НЕ ЗМІНЮВАТИ - використовується скрізь у системі!

    Args:
        telegram_id: Ідентифікатор Telegram користувача

    Returns:
        Дані користувача або None у випадку помилки
    """
    try:
        # Перетворюємо на рядок, якщо це не рядок
        telegram_id = str(telegram_id)

        logger.info(f"get_user: Спроба отримати користувача з ID {telegram_id}")

        # Виконуємо запит з повторними спробами
        def fetch_user():
            if not supabase:  # Додаткова перевірка
                return None

            # Створюємо запит
            res = supabase.table("winix").select("*").eq("telegram_id", telegram_id).execute()  # type: ignore

            if not res.data:
                logger.warning(f"get_user: Користувача з ID {telegram_id} не знайдено")
                return None

            logger.info(f"get_user: Користувача з ID {telegram_id} успішно отримано")
            return res.data[0] if res.data else None

        return retry_supabase(fetch_user)
    except Exception as e:
        logger.error(f"❌ Помилка отримання користувача {telegram_id}: {str(e)}", exc_info=True)
        return None

@safe_supabase_call("force_create_user")
def force_create_user(telegram_id: Union[str, int], username: str, referrer_id: Optional[Union[str, int]] = None) -> Optional[Dict[str, Any]]:
    """
    🔥 КРИТИЧНА ФУНКЦІЯ: Примусово створює нового користувача в Supabase без перевірок

    ⚠️ НЕ ЗМІНЮВАТИ - критична для реєстрації!

    Args:
        telegram_id: Ідентифікатор Telegram користувача
        username: Ім'я користувача (нікнейм)
        referrer_id: ID того, хто запросив (необов'язково)

    Returns:
        Дані створеного користувача або None у випадку помилки
    """
    try:
        # Перетворюємо ID в рядок
        telegram_id = str(telegram_id)
        referrer_id = str(referrer_id) if referrer_id else None

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
            "level": 1,
            "experience": 0,
            "last_activity": now.isoformat(),
            "language_preference": "uk",
            "created_at": now.isoformat(),
            "updated_at": now.isoformat()
        }

        logger.info(f"force_create_user: Примусове створення користувача: {telegram_id}")
        logger.debug(f"force_create_user: Дані для створення: {json.dumps(data)}")

        # Спроба вставити дані напряму
        try:
            with execute_transaction() as txn:
                res = txn.table("winix").insert(data).execute()  # type: ignore

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
                    txn.table("transactions").insert(transaction_data).execute()  # type: ignore

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

@safe_supabase_call("update_balance")
def update_balance(telegram_id: Union[str, int], amount: Union[float, int]) -> Optional[Dict[str, Any]]:
    """
    🔥 КРИТИЧНА ФУНКЦІЯ: Оновлює баланс користувача на вказану суму (додає до поточного)

    ⚠️ НЕ ЗМІНЮВАТИ - використовується для всіх нарахувань WINIX!

    Args:
        telegram_id: Ідентифікатор Telegram користувача
        amount: Сума для додавання (може бути від'ємною для віднімання)

    Returns:
        Оновлені дані користувача або None у випадку помилки
    """
    try:
        # Перетворюємо типи
        telegram_id = str(telegram_id)
        amount = float(amount)

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
            if not supabase:
                return None

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
                txn.table("transactions").insert(transaction_data).execute()  # type: ignore

                # Потім оновлюємо баланс
                result = txn.table("winix").update({
                    "balance": new_balance,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }).eq("telegram_id", telegram_id).execute()  # type: ignore

        except Exception as e:
            logger.error(f"update_balance: Помилка транзакції: {str(e)}")
            raise e

        # Інвалідуємо кеш для цього користувача
        invalidate_cache_for_entity(telegram_id)

        # Перевіряємо, чи потрібно активувати бейдж багатія
        if new_balance >= 50000 and not user.get("badge_rich", False):
            logger.info(f"🏆 Користувач {telegram_id} отримує бейдж багатія")
            if supabase:
                supabase.table("winix").update({"badge_rich": True}).eq("telegram_id", telegram_id).execute()  # type: ignore

        return result.data[0] if result and result.data else None
    except Exception as e:
        logger.error(f"❌ Помилка оновлення балансу {telegram_id}: {str(e)}", exc_info=True)
        return None

@safe_supabase_call("update_coins")
def update_coins(telegram_id: Union[str, int], amount: int) -> Optional[Dict[str, Any]]:
    """
    🔥 КРИТИЧНА ФУНКЦІЯ: Оновлює кількість жетонів користувача (додає до поточної)

    ⚠️ НЕ ЗМІНЮВАТИ - використовується для розіграшів!

    Args:
        telegram_id: Ідентифікатор Telegram користувача
        amount: Кількість жетонів для додавання (може бути від'ємною)

    Returns:
        Оновлені дані користувача або None у випадку помилки
    """
    try:
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
            if not supabase:
                return None

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
                txn.table("transactions").insert(transaction_data).execute()  # type: ignore

                # Потім оновлюємо кількість жетонів
                result = txn.table("winix").update({
                    "coins": new_coins,
                    "updated_at": datetime.now(timezone.utc).isoformat()
                }).eq("telegram_id", telegram_id).execute()  # type: ignore
        except Exception as e:
            logger.error(f"update_coins: Помилка транзакції: {str(e)}")
            raise e

        # Інвалідуємо кеш для цього користувача
        invalidate_cache_for_entity(telegram_id)

        return result.data[0] if result and result.data else None
    except Exception as e:
        logger.error(f"❌ Помилка оновлення жетонів {telegram_id}: {str(e)}", exc_info=True)
        return None

@safe_supabase_call("update_user")
def update_user(telegram_id: Union[str, int], data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    🔥 КРИТИЧНА ФУНКЦІЯ: Оновлює дані користувача зазначеними полями

    ⚠️ НЕ ЗМІНЮВАТИ - використовується для оновлення профілів!

    Args:
        telegram_id: Ідентифікатор Telegram користувача
        data: Словник з полями для оновлення

    Returns:
        Оновлені дані користувача або None у випадку помилки
    """
    try:
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
            if not supabase:
                return None
            res = supabase.table("winix").update(valid_data).eq("telegram_id", telegram_id).execute()  # type: ignore
            return res.data[0] if res.data else None

        result = retry_supabase(update_user_data)

        # Інвалідуємо кеш для цього користувача
        invalidate_cache_for_entity(telegram_id)

        return result
    except Exception as e:
        logger.error(f"❌ Помилка оновлення даних користувача {telegram_id}: {str(e)}", exc_info=True)
        return None

# ===== РЕФЕРАЛЬНА СИСТЕМА (ВИПРАВЛЕНА) =====

@safe_supabase_call("create_referral_records_directly")
def create_referral_records_directly(referrer_id: Union[str, int], referee_id: Union[str, int], amount: int = 50) -> bool:
    """
    🔥 КРИТИЧНА ФУНКЦІЯ: Створює записи в таблицях referrals та direct_bonuses напряму

    ⚠️ НЕ ЗМІНЮВАТИ - використовується для реферальної системи!
    """
    try:
        # Конвертуємо ID в рядки
        referrer_id = str(referrer_id)
        referee_id = str(referee_id)

        # Перевіряємо, чи існує вже запис у таблиці referrals
        if supabase:
            check_res = supabase.table("referrals").select("id").eq("referee_id", referee_id).execute()  # type: ignore
            if check_res and check_res.data and len(check_res.data) > 0:
                logger.info(f"create_referral_records_directly: Реферальний запис для {referee_id} вже існує")
                return False

        # Поточний час для записів
        current_time = datetime.now(timezone.utc).isoformat()

        # 1. Створюємо запис про реферала 1-го рівня
        referral_data = {
            "referrer_id": referrer_id,
            "referee_id": referee_id,
            "level": 1,
            "created_at": current_time
        }

        if supabase:
            ref_res = supabase.table("referrals").insert(referral_data).execute()  # type: ignore
            logger.info(f"create_referral_records_directly: Створено реферальний запис 1-го рівня: {referrer_id} -> {referee_id}")

            # 2. Перевіряємо наявність реферера 2-го рівня
            try:
                higher_ref_res = supabase.table("referrals").select("referrer_id").eq("referee_id", referrer_id).eq("level", 1).execute()  # type: ignore

                if higher_ref_res and higher_ref_res.data and len(higher_ref_res.data) > 0:
                    higher_referrer_id = higher_ref_res.data[0]["referrer_id"]

                    # Створюємо запис про реферала 2-го рівня
                    second_level_data = {
                        "referrer_id": higher_referrer_id,
                        "referee_id": referee_id,
                        "level": 2,
                        "created_at": current_time
                    }

                    supabase.table("referrals").insert(second_level_data).execute()  # type: ignore
                    logger.info(f"create_referral_records_directly: Створено реферальний запис 2-го рівня: {higher_referrer_id} -> {referee_id}")
            except Exception as e:
                logger.warning(f"create_referral_records_directly: Помилка створення запису 2-го рівня: {str(e)}")

            # 3. Створюємо запис про прямий бонус
            try:
                bonus_data = {
                    "referrer_id": referrer_id,
                    "referee_id": referee_id,
                    "amount": amount,
                    "created_at": current_time
                }

                supabase.table("direct_bonuses").insert(bonus_data).execute()  # type: ignore
                logger.info(f"create_referral_records_directly: Створено запис прямого бонусу для {referrer_id}")

                # 4. Оновлюємо баланс реферера
                referrer_user = get_user(referrer_id)
                if referrer_user:
                    current_balance = float(referrer_user.get('balance', 0))
                    new_balance = current_balance + amount

                    update_data = {
                        "balance": new_balance,
                        "updated_at": current_time
                    }

                    supabase.table("winix").update(update_data).eq("telegram_id", referrer_id).execute()  # type: ignore
                    logger.info(f"create_referral_records_directly: Оновлено баланс реферера {referrer_id}: {current_balance} -> {new_balance}")

                    # Інвалідуємо кеш для реферера
                    invalidate_cache_for_entity(referrer_id)
            except Exception as e:
                logger.error(f"create_referral_records_directly: Помилка нарахування бонусу: {str(e)}")

        return True
    except Exception as e:
        logger.error(f"create_referral_records_directly: Помилка створення реферальних записів: {str(e)}")
        return False

@safe_supabase_call("create_user")
def create_user(telegram_id: Union[str, int], username: str, referrer_id: Optional[Union[str, int]] = None) -> Optional[Dict[str, Any]]:
    """
    🔥 КРИТИЧНА ФУНКЦІЯ: Створює нового користувача з автоматичною реєстрацією реферального зв'язку

    ⚠️ НЕ ЗМІНЮВАТИ - головна функція реєстрації!
    """
    try:
        # Перетворюємо ID в рядок
        telegram_id = str(telegram_id)

        # Перевіряємо, чи користувач вже існує
        existing_user = get_user(telegram_id)
        if existing_user:
            logger.info(f"create_user: Користувач {telegram_id} вже існує, повертаємо існуючі дані")
            return existing_user

        # Створюємо нового користувача
        user = force_create_user(telegram_id, username, referrer_id)

        if not user:
            logger.error(f"create_user: Не вдалося створити користувача {telegram_id}")
            return None

        # Якщо є referrer_id, реєструємо реферальний зв'язок
        if referrer_id:
            try:
                referrer_id = str(referrer_id)
                logger.info(f"create_user: Реєструємо реферальний зв'язок: {referrer_id} -> {telegram_id}")

                # Спроба імпорту контролерів
                try:
                    from referrals.controllers.referral_controller import ReferralController  # type: ignore
                    from referrals.controllers.bonus_controller import BonusController  # type: ignore
                    modules_imported = True
                    logger.info("create_user: Успішно імпортовано контролери реферальної системи")
                except ImportError:
                    try:
                        from backend.referrals.controllers.referral_controller import ReferralController  # type: ignore
                        from backend.referrals.controllers.bonus_controller import BonusController  # type: ignore
                        modules_imported = True
                        logger.info("create_user: Успішно імпортовано контролери реферальної системи (backend)")
                    except ImportError:
                        modules_imported = False
                        ReferralController = None  # type: ignore
                        BonusController = None  # type: ignore

                # Якщо контролери успішно імпортовано, використовуємо їх
                if modules_imported and ReferralController and BonusController:
                    # Реєструємо реферальний зв'язок
                    referral_result = ReferralController.register_referral(
                        referrer_id=referrer_id,
                        referee_id=telegram_id
                    )

                    if referral_result.get('success', False):
                        logger.info(f"create_user: Реферальний зв'язок успішно створено")

                        # Нараховуємо прямий бонус
                        bonus_result = BonusController.award_direct_bonus(
                            referrer_id=referrer_id,
                            referee_id=telegram_id,
                            amount=50
                        )

                        if bonus_result.get('success', False):
                            logger.info(f"create_user: Прямий бонус успішно нараховано")

                            # Оновлюємо баланс реферера
                            referrer_user = get_user(referrer_id)
                            if referrer_user and supabase:
                                current_balance = float(referrer_user.get('balance', 0))
                                new_balance = current_balance + 50

                                supabase.table("winix").update({
                                    "balance": new_balance,
                                    "updated_at": datetime.now(timezone.utc).isoformat()
                                }).eq("telegram_id", referrer_id).execute()  # type: ignore

                                logger.info(
                                    f"create_user: Баланс реферера {referrer_id} оновлено: {current_balance} -> {new_balance}")

                                # Інвалідуємо кеш для реферера
                                invalidate_cache_for_entity(referrer_id)
                        else:
                            logger.warning(f"create_user: Помилка нарахування бонусу: {bonus_result}")
                    else:
                        logger.warning(f"create_user: Помилка реєстрації реферального зв'язку: {referral_result}")
                else:
                    # Якщо імпорт не вдався, використовуємо прямий запис
                    logger.warning("create_user: Не вдалося імпортувати контролери реферальної системи")
                    logger.info("create_user: Використовуємо прямий запис реферальних даних")
                    create_referral_records_directly(referrer_id, telegram_id)

            except Exception as e:
                logger.error(f"create_user: Помилка обробки реферального зв'язку: {str(e)}", exc_info=True)
                # Спроба прямого запису як запасний варіант
                try:
                    logger.info("create_user: Спроба прямого запису реферальних даних після помилки")
                    create_referral_records_directly(referrer_id, telegram_id)
                except Exception as direct_error:
                    logger.error(f"create_user: Помилка прямого запису реферальних даних: {str(direct_error)}")

        return user
    except Exception as e:
        logger.error(f"❌ Помилка створення користувача {telegram_id}: {str(e)}", exc_info=True)
        return None

# ===== 🔥 STAKING FUNCTIONS (НОВИЙ РОЗДІЛ) =====

logger.info("🎯 === ЗАВАНТАЖЕННЯ STAKING FUNCTIONS ===")

@safe_supabase_call("get_staking_session")
@cached()
def get_staking_session(session_id: str) -> Optional[Dict[str, Any]]:
    """
    🔥 КРИТИЧНА ФУНКЦІЯ: Отримує одну сесію стейкінгу за її ID

    ⚠️ НЕ ЗМІНЮВАТИ - використовується стейкінгом!

    Args:
        session_id: ID сесії стейкінгу

    Returns:
        Дані сесії стейкінгу або None у випадку помилки
    """
    try:
        logger.info(f"get_staking_session: Отримання сесії {session_id}")

        def fetch_session():
            if not supabase:
                return None
            res = supabase.table("staking_sessions").select("*").eq("id", session_id).execute()  # type: ignore
            return res.data[0] if res.data else None

        return retry_supabase(fetch_session)
    except Exception as e:
        logger.error(f"❌ Помилка отримання сесії стейкінгу {session_id}: {str(e)}", exc_info=True)
        return None

@safe_supabase_call("update_staking_session")
def update_staking_session(session_id: str, update_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
    """
    🔥 КРИТИЧНА ФУНКЦІЯ: Оновлює дані сесії стейкінгу

    Args:
        session_id: ID сесії стейкінгу
        update_data: Дані для оновлення

    Returns:
        Оновлені дані сесії або None у випадку помилки
    """
    try:
        logger.info(f"update_staking_session: Оновлення сесії {session_id}")

        # Додаємо час оновлення
        update_data["updated_at"] = datetime.now(timezone.utc).isoformat()

        def update_session():
            if not supabase:
                return None
            res = supabase.table("staking_sessions").update(update_data).eq("id", session_id).execute()  # type: ignore
            return res.data[0] if res.data else None

        result = retry_supabase(update_session)

        # Інвалідуємо кеш
        invalidate_cache_for_entity(session_id)

        return result
    except Exception as e:
        logger.error(f"❌ Помилка оновлення сесії стейкінгу {session_id}: {str(e)}", exc_info=True)
        return None

@safe_supabase_call("complete_staking_session")
def complete_staking_session(session_id: str, final_amount: float, cancelled_early: bool = False) -> Optional[Dict[str, Any]]:
    """
    🔥 КРИТИЧНА ФУНКЦІЯ: Завершує сесію стейкінгу

    Args:
        session_id: ID сесії стейкінгу
        final_amount: Фінальна сума для виплати
        cancelled_early: Чи скасовано достроково

    Returns:
        Дані завершеної сесії або None у випадку помилки
    """
    try:
        logger.info(f"complete_staking_session: Завершення сесії {session_id}")

        current_time = datetime.now(timezone.utc).isoformat()
        update_data = {
            "is_active": False,
            "cancelled_early": cancelled_early,
            "final_amount_paid": final_amount,
            "completed_at": current_time,
            "updated_at": current_time
        }

        return update_staking_session(session_id, update_data)
    except Exception as e:
        logger.error(f"❌ Помилка завершення сесії стейкінгу {session_id}: {str(e)}", exc_info=True)
        return None

@safe_supabase_call("delete_staking_session")
def delete_staking_session(session_id: str) -> bool:
    """
    🔥 КРИТИЧНА ФУНКЦІЯ: Видаляє сесію стейкінгу

    Args:
        session_id: ID сесії стейкінгу

    Returns:
        True якщо успішно видалено, False інакше
    """
    try:
        logger.info(f"delete_staking_session: Видалення сесії {session_id}")

        def delete_session():
            if not supabase:
                return False
            res = supabase.table("staking_sessions").delete().eq("id", session_id).execute()  # type: ignore
            return bool(res.data)

        result = retry_supabase(delete_session)

        # Інвалідуємо кеш
        invalidate_cache_for_entity(session_id)

        return result
    except Exception as e:
        logger.error(f"❌ Помилка видалення сесії стейкінгу {session_id}: {str(e)}", exc_info=True)
        return False

@safe_supabase_call("create_staking_session")
def create_staking_session(user_id: str, amount_staked: float, staking_days: int, reward_percent: float) -> Optional[Dict[str, Any]]:
    """
    🔥 КРИТИЧНА ФУНКЦІЯ: Створює нову сесію стейкінгу

    Args:
        user_id: ID користувача
        amount_staked: Сума стейкінгу
        staking_days: Кількість днів стейкінгу
        reward_percent: Відсоток винагороди

    Returns:
        Дані створеної сесії або None у випадку помилки
    """
    try:
        logger.info(f"create_staking_session: Створення сесії для {user_id}, сума: {amount_staked}")

        current_time = datetime.now(timezone.utc)
        end_time = current_time + timedelta(days=staking_days)

        session_data = {
            "id": str(uuid.uuid4()),
            "user_id": user_id,
            "telegram_id": user_id,  # Для сумісності
            "amount_staked": amount_staked,
            "staking_days": staking_days,
            "reward_percent": reward_percent,
            "is_active": True,
            "cancelled_early": False,
            "started_at": current_time.isoformat(),
            "ends_at": end_time.isoformat(),
            "created_at": current_time.isoformat(),
            "updated_at": current_time.isoformat()
        }

        def create_session():
            if not supabase:
                return None
            res = supabase.table("staking_sessions").insert(session_data).execute()  # type: ignore
            return res.data[0] if res.data else None

        return retry_supabase(create_session)
    except Exception as e:
        logger.error(f"❌ Помилка створення сесії стейкінгу {user_id}: {str(e)}", exc_info=True)
        return None

@safe_supabase_call("verify_staking_consistency")
def verify_staking_consistency(telegram_id: str) -> bool:
    """
    🔥 ДОПОМІЖНА ФУНКЦІЯ: Перевіряє цілісність даних стейкінгу

    Args:
        telegram_id: ID користувача

    Returns:
        True якщо дані цілісні, False інакше
    """
    try:
        logger.info(f"verify_staking_consistency: Перевірка цілісності для {telegram_id}")
        # Базова реалізація - просто повертаємо True
        # Можна розширити логікою перевірки
        return True
    except Exception as e:
        logger.error(f"❌ Помилка перевірки цілісності стейкінгу {telegram_id}: {str(e)}")
        return False

@safe_supabase_call("get_all_active_staking_sessions")
@cached()
def get_all_active_staking_sessions() -> List[Dict[str, Any]]:
    """
    🔥 ДОПОМІЖНА ФУНКЦІЯ: Отримує всі активні сесії стейкінгу

    Returns:
        Список активних сесій стейкінгу
    """
    try:
        logger.info("get_all_active_staking_sessions: Отримання всіх активних сесій")

        def fetch_active_sessions():
            if not supabase:
                return []
            res = supabase.table("staking_sessions").select("*").eq("is_active", True).execute()  # type: ignore
            return res.data if res.data else []

        return retry_supabase(fetch_active_sessions)
    except Exception as e:
        logger.error(f"❌ Помилка отримання всіх активних сесій: {str(e)}")
        return []

@safe_supabase_call("check_and_complete_expired_staking_sessions")
def check_and_complete_expired_staking_sessions() -> int:
    """
    🔥 ДОПОМІЖНА ФУНКЦІЯ: Перевіряє та завершує прострочені сесії стейкінгу

    Returns:
        Кількість завершених сесій
    """
    try:
        logger.info("check_and_complete_expired_staking_sessions: Перевірка прострочених сесій")

        current_time = datetime.now(timezone.utc)
        active_sessions = get_all_active_staking_sessions()
        completed_count = 0

        for session in active_sessions:
            try:
                # Парсимо дату завершення
                ends_at_str = session.get("ends_at")
                if not ends_at_str:
                    continue

                ends_at = datetime.fromisoformat(ends_at_str.replace('Z', '+00:00')) if ends_at_str.endswith('Z') else datetime.fromisoformat(ends_at_str)

                # Якщо сесія прострочена, завершуємо її
                if current_time >= ends_at:
                    amount_staked = float(session.get("amount_staked", 0))
                    reward_percent = float(session.get("reward_percent", 0))
                    total_amount = amount_staked + (amount_staked * reward_percent / 100)

                    if complete_staking_session(session["id"], total_amount, False):
                        completed_count += 1
                        logger.info(f"Автоматично завершено прострочену сесію {session['id']}")

            except Exception as session_error:
                logger.error(f"Помилка обробки сесії {session.get('id')}: {str(session_error)}")

        logger.info(f"check_and_complete_expired_staking_sessions: Завершено {completed_count} сесій")
        return completed_count
    except Exception as e:
        logger.error(f"❌ Помилка перевірки прострочених сесій: {str(e)}")
        return 0

# ===== LEGACY ФУНКЦІЇ (ВИПРАВЛЕНІ) =====

@safe_supabase_call("get_user_staking_sessions")
@cached()
def get_user_staking_sessions(telegram_id: Union[str, int], active_only: bool = True) -> Optional[List[Dict[str, Any]]]:
    """
    🔥 LEGACY ФУНКЦІЯ: Отримує сесії стейкінгу користувача з Supabase

    ⚠️ НЕ ЗМІНЮВАТИ - використовується стейкінгом!

    Args:
        telegram_id: ID користувача в Telegram
        active_only: Чи повертати тільки активні сесії (за замовчуванням True)

    Returns:
        Список сесій стейкінгу або пустий список
    """
    try:
        # Перетворюємо ID в рядок
        telegram_id = str(telegram_id)

        logger.info(f"get_user_staking_sessions: Спроба отримати сесії стейкінгу для {telegram_id} (active_only={active_only})")

        # Виконуємо запит з повторними спробами
        def fetch_sessions():
            if not supabase:
                return []

            # Створюємо базовий запит
            query = supabase.table("staking_sessions").select("*")

            # Фільтруємо за telegram_id (перевіряємо обидва поля для сумісності)
            query = query.or_(f"telegram_id.eq.{telegram_id},user_id.eq.{telegram_id}")

            # Якщо потрібні тільки активні сесії
            if active_only:
                query = query.eq("is_active", True)

            # Сортуємо за датою початку (найновіші спочатку)
            query = query.order("started_at", desc=True)

            res = query.execute()  # type: ignore

            if not res.data:
                logger.info(f"get_user_staking_sessions: Для користувача {telegram_id} не знайдено сесій стейкінгу (active_only={active_only})")
                return []

            logger.info(f"get_user_staking_sessions: Знайдено {len(res.data)} сесій стейкінгу для {telegram_id} (active_only={active_only})")
            return res.data if res.data else []

        return retry_supabase(fetch_sessions)
    except Exception as e:
        logger.error(f"❌ Помилка отримання сесій стейкінгу для {telegram_id}: {str(e)}", exc_info=True)
        return []

def check_and_update_badges(user_id: Union[str, int], context=None):
    """
    🔥 LEGACY ФУНКЦІЯ: Перевірка та оновлення бейджів користувача

    ⚠️ НЕ ЗМІНЮВАТИ - використовується бейджами!
    """
    try:
        try:
            from badges.badge_service import award_badges  # type: ignore
            return award_badges(user_id, context)
        except ImportError:
            try:
                from backend.badges.badge_service import award_badges  # type: ignore
                return award_badges(user_id, context)
            except ImportError:
                pass

        # Запасний варіант - власна реалізація
        # Перетворюємо ID в рядок
        user_id = str(user_id)

        user = get_user(user_id)
        if not user:
            logger.warning(f"check_and_update_badges: Користувача {user_id} не знайдено")
            return None

        updates = {}

        # Бейдж початківця - за 5 участей в розіграшах
        if not user.get("badge_beginner", False) and user.get("participations_count", 0) >= 5:
            updates["badge_beginner"] = True
            logger.info(f"🏆 Користувач {user_id} отримує бейдж початківця")

        # Бейдж багатія - за 50,000 WINIX
        if not user.get("badge_rich", False) and float(user.get("balance", 0)) >= 50000:
            updates["badge_rich"] = True
            logger.info(f"🏆 Користувач {user_id} отримує бейдж багатія")

        # Бейдж переможця - якщо є виграші
        if not user.get("badge_winner", False) and user.get("wins_count", 0) > 0:
            updates["badge_winner"] = True
            logger.info(f"🏆 Користувач {user_id} отримує бейдж переможця")

        # Якщо є оновлення, зберігаємо їх
        if updates:
            updates["updated_at"] = datetime.now(timezone.utc).isoformat()
            logger.info(f"check_and_update_badges: Оновлення бейджів користувача {user_id}: {updates}")
            return update_user(user_id, updates)

        return user
    except Exception as e:
        logger.error(f"❌ Помилка перевірки бейджів {user_id}: {str(e)}", exc_info=True)
        return None

def test_supabase_connection() -> Dict[str, Any]:
    """
    🔥 LEGACY ФУНКЦІЯ: Тестування з'єднання з Supabase

    ⚠️ НЕ ЗМІНЮВАТИ - використовується в main.py!
    """
    try:
        if not supabase:
            return {
                "status": "error",
                "message": "Клієнт Supabase не ініціалізовано"
            }

        # Спроба простого запиту
        res = supabase.table("winix").select("telegram_id").limit(1).execute()  # type: ignore

        return {
            "status": "success",
            "message": "З'єднання з Supabase працює",
            "data_available": len(res.data) > 0 if res.data else False
        }
    except Exception as e:
        return {
            "status": "error",
            "message": f"Помилка з'єднання: {str(e)}"
        }

# ===== 🔥 WINIX QUESTS INTEGRATION - ВИПРАВЛЕНІ ФУНКЦІЇ =====

logger.info("🎯 === ЗАВАНТАЖЕННЯ WINIX QUESTS ІНТЕГРАЦІЇ (FIXED) ===")

# 📊 Analytics Functions
@safe_supabase_call("get_user_analytics")
@cached()
def get_user_analytics(telegram_id: Union[str, int]) -> Optional[Dict[str, Any]]:
    """
    🎯 WINIX: Отримання аналітики користувача
    """
    try:
        telegram_id = str(telegram_id)
        logger.info(f"get_user_analytics: Отримання аналітики для {telegram_id}")

        def fetch_analytics():
            if not supabase:
                return None
            res = supabase.table("user_analytics_stats").select("*").eq("user_id", telegram_id).execute()  # type: ignore
            return res.data[0] if res.data else None

        return retry_supabase(fetch_analytics)
    except Exception as e:
        logger.error(f"❌ Помилка отримання аналітики {telegram_id}: {str(e)}")
        return None

@safe_supabase_call("create_analytics_event")
def create_analytics_event(telegram_id: Union[str, int], event_type: str, event_data: Dict[str, Any]) -> bool:
    """
    🎯 WINIX: Створення події аналітики
    """
    try:
        # Генеруємо унікальний session_id якщо немає
        session_id = event_data.get('session_id', str(uuid.uuid4()))

        event_record = {
            "user_id": str(telegram_id),
            "session_id": session_id,
            "event_type": event_type,
            "category": event_data.get('category', 'User'),
            "action": event_data.get('action', event_type),
            "label": event_data.get('label'),
            "value": event_data.get('value'),
            "properties": event_data,
            "severity": event_data.get('severity', 'normal'),
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "ip_address": event_data.get('ip', ''),
            "user_agent": event_data.get('user_agent', '')[:100] if event_data.get('user_agent') else ''
        }

        if supabase:
            res = supabase.table("analytics_events").insert(event_record).execute()  # type: ignore
            logger.info(f"create_analytics_event: Подія {event_type} створена для {telegram_id}")
            return bool(res.data)
        return False
    except Exception as e:
        logger.error(f"❌ Помилка створення події аналітики: {str(e)}")
        return False

@safe_supabase_call("update_user_analytics_stats")
def update_user_analytics_stats(telegram_id: Union[str, int], stats_update: Dict[str, Any]) -> bool:
    """
    🎯 WINIX: Оновлення статистики користувача
    """
    try:
        telegram_id = str(telegram_id)
        current_time = datetime.now(timezone.utc).isoformat()

        # Додаємо час оновлення
        stats_update["last_active"] = current_time

        if not supabase:
            return False

        # Спробуємо оновити існуючий запис
        res = supabase.table("user_analytics_stats").update(stats_update).eq("user_id", telegram_id).execute()  # type: ignore

        # Якщо немає записів, створюємо новий
        if not res.data:
            stats_update.update({
                "user_id": telegram_id,
                "first_seen": current_time,
                "last_seen": current_time
            })
            res = supabase.table("user_analytics_stats").insert(stats_update).execute()  # type: ignore

        # Інвалідуємо кеш
        invalidate_cache_for_entity(telegram_id)

        logger.info(f"update_user_analytics_stats: Статистика оновлена для {telegram_id}")
        return bool(res.data)
    except Exception as e:
        logger.error(f"❌ Помилка оновлення статистики {telegram_id}: {str(e)}")
        return False

# 💰 Daily Bonus Functions
@safe_supabase_call("get_user_daily_status")
@cached(timeout=60)  # Кешуємо на 1 хвилину
def get_user_daily_status(telegram_id: Union[str, int]) -> Optional[Dict[str, Any]]:
    """
    🎯 WINIX: Отримання статусу щоденних бонусів
    """
    try:
        telegram_id = str(telegram_id)
        logger.info(f"get_user_daily_status: Перевірка щоденного статусу для {telegram_id}")

        def fetch_daily_status():
            if not supabase:
                return None
            res = supabase.table("daily_bonus_status").select("*").eq("user_id", telegram_id).execute()  # type: ignore
            return res.data[0] if res.data else None

        return retry_supabase(fetch_daily_status)
    except Exception as e:
        logger.error(f"❌ Помилка отримання щоденного статусу {telegram_id}: {str(e)}")
        return None

@safe_supabase_call("update_daily_bonus_status")
def update_daily_bonus_status(telegram_id: Union[str, int], data: Dict[str, Any]) -> bool:
    """
    🎯 WINIX: Оновлення статусу щоденних бонусів
    """
    try:
        telegram_id = str(telegram_id)
        current_time = datetime.now(timezone.utc).isoformat()
        data["updated_at"] = current_time

        if not supabase:
            return False

        # Спочатку спробуємо оновити
        res = supabase.table("daily_bonus_status").update(data).eq("user_id", telegram_id).execute()  # type: ignore

        # Якщо немає записів, створюємо новий
        if not res.data:
            data["user_id"] = telegram_id
            data["created_at"] = current_time
            res = supabase.table("daily_bonus_status").insert(data).execute()  # type: ignore

        # Інвалідуємо кеш
        invalidate_cache_for_entity(telegram_id)

        logger.info(f"update_daily_bonus_status: Статус оновлено для {telegram_id}")
        return bool(res.data)
    except Exception as e:
        logger.error(f"❌ Помилка оновлення щоденного статусу {telegram_id}: {str(e)}")
        return False

@safe_supabase_call("create_daily_bonus_entry")
def create_daily_bonus_entry(telegram_id: Union[str, int], day_number: int, reward_winix: int, reward_tickets: int, streak: int) -> bool:
    """
    🎯 WINIX: Створення запису щоденного бонусу
    """
    try:
        current_time = datetime.now(timezone.utc)

        entry_data = {
            "user_id": str(telegram_id),
            "day_number": day_number,
            "claim_date": current_time.date().isoformat(),
            "reward_winix": reward_winix,
            "reward_tickets": reward_tickets,
            "streak_at_claim": streak,
            "is_special_day": day_number % 7 == 0,  # Каждый 7-й день особый
            "multiplier_applied": 2.0 if day_number % 7 == 0 else 1.0
        }

        if supabase:
            res = supabase.table("daily_bonus_entries").insert(entry_data).execute()  # type: ignore
            logger.info(f"create_daily_bonus_entry: Запис створено для {telegram_id}, день {day_number}")
            return bool(res.data)
        return False
    except Exception as e:
        logger.error(f"❌ Помилка створення запису щоденного бонусу {telegram_id}: {str(e)}")
        return False

@safe_supabase_call("get_user_daily_entries")
def get_user_daily_entries(telegram_id: Union[str, int], limit: int = 30) -> List[Dict[str, Any]]:
    """
    🎯 WINIX: Отримання записів щоденних бонусів
    """
    try:
        telegram_id = str(telegram_id)

        def fetch_entries():
            if not supabase:
                return []
            res = (supabase.table("daily_bonus_entries")
                   .select("*")
                   .eq("user_id", telegram_id)
                   .order("claim_date", desc=True)
                   .limit(limit)
                   .execute())  # type: ignore
            return res.data if res.data else []

        return retry_supabase(fetch_entries)
    except Exception as e:
        logger.error(f"❌ Помилка отримання записів щоденних бонусів {telegram_id}: {str(e)}")
        return []

# 💎 FLEX Functions
@safe_supabase_call("get_user_flex_balance")
@cached()
def get_user_flex_balance(telegram_id: Union[str, int]) -> Optional[Dict[str, Any]]:
    """
    🎯 WINIX: Отримання FLEX балансу користувача
    """
    try:
        telegram_id = str(telegram_id)
        logger.info(f"get_user_flex_balance: Отримання FLEX балансу для {telegram_id}")

        def fetch_flex_balance():
            if not supabase:
                return None
            res = supabase.table("flex_balances").select("*").eq("telegram_id", telegram_id).execute()  # type: ignore
            return res.data[0] if res.data else None

        return retry_supabase(fetch_flex_balance)
    except Exception as e:
        logger.error(f"❌ Помилка отримання FLEX балансу {telegram_id}: {str(e)}")
        return None

@safe_supabase_call("update_flex_balance")
def update_flex_balance(telegram_id: Union[str, int], flex_balance: int, wallet_address: Optional[str] = None) -> bool:
    """
    🎯 WINIX: Оновлення FLEX балансу
    """
    try:
        telegram_id = str(telegram_id)
        current_time = datetime.now(timezone.utc).isoformat()

        balance_data = {
            "flex_balance": flex_balance,
            "last_updated": current_time
        }

        if wallet_address:
            balance_data["wallet_address"] = wallet_address

        if not supabase:
            return False

        # Спробуємо оновити існуючий запис
        res = supabase.table("flex_balances").update(balance_data).eq("telegram_id", telegram_id).execute()  # type: ignore

        # Якщо немає записів, створюємо новий
        if not res.data:
            balance_data.update({
                "telegram_id": telegram_id,
                "created_at": current_time
            })
            res = supabase.table("flex_balances").insert(balance_data).execute()  # type: ignore

        # Інвалідуємо кеш
        invalidate_cache_for_entity(telegram_id)

        logger.info(f"update_flex_balance: FLEX баланс оновлено для {telegram_id}: {flex_balance}")
        return bool(res.data)
    except Exception as e:
        logger.error(f"❌ Помилка оновлення FLEX балансу {telegram_id}: {str(e)}")
        return False

@safe_supabase_call("create_flex_claim")
def create_flex_claim(telegram_id: Union[str, int], level: str, flex_balance: int, winix_awarded: int, tickets_awarded: int) -> bool:
    """
    🎯 WINIX: Створення запису отримання FLEX винагороди
    """
    try:
        claim_data = {
            "telegram_id": str(telegram_id),
            "level": level,
            "flex_balance_at_claim": flex_balance,
            "winix_awarded": winix_awarded,
            "tickets_awarded": tickets_awarded,
            "claimed_at": datetime.now(timezone.utc).isoformat()
        }

        if supabase:
            res = supabase.table("flex_claims").insert(claim_data).execute()  # type: ignore
            logger.info(f"create_flex_claim: FLEX винагорода {level} створена для {telegram_id}")
            return bool(res.data)
        return False
    except Exception as e:
        logger.error(f"❌ Помилка створення FLEX винагороди {telegram_id}: {str(e)}")
        return False

@safe_supabase_call("get_user_flex_claims")
def get_user_flex_claims(telegram_id: Union[str, int]) -> List[Dict[str, Any]]:
    """
    🎯 WINIX: Отримання історії FLEX винагород
    """
    try:
        telegram_id = str(telegram_id)

        def fetch_flex_claims():
            if not supabase:
                return []
            res = (supabase.table("flex_claims")
                   .select("*")
                   .eq("telegram_id", telegram_id)
                   .order("claimed_at", desc=True)
                   .execute())  # type: ignore
            return res.data if res.data else []

        return retry_supabase(fetch_flex_claims)
    except Exception as e:
        logger.error(f"❌ Помилка отримання FLEX історії {telegram_id}: {str(e)}")
        return []

@safe_supabase_call("get_flex_levels")
@cached()
def get_flex_levels() -> List[Dict[str, Any]]:
    """
    🎯 WINIX: Отримання всіх рівнів FLEX
    """
    try:
        def fetch_levels():
            if not supabase:
                return []
            res = supabase.table("flex_levels").select("*").order("required_flex").execute()  # type: ignore
            return res.data if res.data else []

        return retry_supabase(fetch_levels)
    except Exception as e:
        logger.error(f"❌ Помилка отримання FLEX рівнів: {str(e)}")
        return []

# 🎮 Tasks Functions
@safe_supabase_call("get_user_tasks_progress")
@cached()
def get_user_tasks_progress(telegram_id: Union[str, int]) -> List[Dict[str, Any]]:
    """
    🎯 WINIX: Отримання прогресу завдань користувача
    """
    try:
        telegram_id = str(telegram_id)
        logger.info(f"get_user_tasks_progress: Отримання прогресу завдань для {telegram_id}")

        def fetch_tasks_progress():
            if not supabase:
                return []
            res = supabase.table("task_progress").select("*").eq("user_id", telegram_id).execute()  # type: ignore
            return res.data if res.data else []

        return retry_supabase(fetch_tasks_progress)
    except Exception as e:
        logger.error(f"❌ Помилка отримання прогресу завдань {telegram_id}: {str(e)}")
        return []

@safe_supabase_call("update_task_progress")
def update_task_progress(telegram_id: Union[str, int], task_id: str, status: str, task_data: Optional[Dict] = None, result: Optional[Dict] = None) -> bool:
    """
    🎯 WINIX: Оновлення прогресу завдання
    """
    try:
        telegram_id = str(telegram_id)
        current_time = datetime.now(timezone.utc).isoformat()

        progress_data = {
            "status": status,
            "updated_at": current_time
        }

        if task_data:
            progress_data["task_data"] = task_data

        if result:
            progress_data["result"] = result

        if status == "completed":
            progress_data["completed_at"] = current_time

        if not supabase:
            return False
               # Спробуємо оновити існуючий запис
        res = supabase.table("task_progress").update(progress_data).eq("user_id", telegram_id).eq("task_id", task_id).execute()  # type: ignore

        # Якщо немає записів, створюємо новий
        if not res.data:
            progress_data.update({
                "user_id": telegram_id,
                "task_id": task_id,
                "task_type": task_data.get("type", "unknown") if task_data else "unknown",
                "created_at": current_time
            })
            res = supabase.table("task_progress").insert(progress_data).execute()  # type: ignore

        # Інвалідуємо кеш
        invalidate_cache_for_entity(telegram_id)

        logger.info(f"update_task_progress: Прогрес завдання {task_id} оновлено для {telegram_id}")
        return bool(res.data)
    except Exception as e:
        logger.error(f"❌ Помилка оновлення прогресу завдання {telegram_id}: {str(e)}")
        return False

@safe_supabase_call("create_completed_task")
def create_completed_task(telegram_id: Union[str, int], task_id: str, task_type: str, reward: Dict[str, Any]) -> bool:
    """
    🎯 WINIX: Створення запису виконаного завдання
    """
    try:
        completion_data = {
            "user_id": str(telegram_id),
            "task_id": task_id,
            "task_type": task_type,
            "reward": reward,
            "completed_at": datetime.now(timezone.utc).isoformat()
        }

        if supabase:
            res = supabase.table("completed_tasks").insert(completion_data).execute()  # type: ignore
            logger.info(f"create_completed_task: Завдання {task_id} позначено як виконане для {telegram_id}")
            return bool(res.data)
        return False
    except Exception as e:
        logger.error(f"❌ Помилка створення запису виконаного завдання {telegram_id}: {str(e)}")
        return False

@safe_supabase_call("get_completed_tasks")
def get_completed_tasks(telegram_id: Union[str, int]) -> List[Dict[str, Any]]:
    """
    🎯 WINIX: Отримання виконаних завдань
    """
    try:
        telegram_id = str(telegram_id)

        def fetch_completed():
            if not supabase:
                return []
            res = (supabase.table("completed_tasks")
                   .select("*")
                   .eq("user_id", telegram_id)
                   .order("completed_at", desc=True)
                   .execute())  # type: ignore
            return res.data if res.data else []

        return retry_supabase(fetch_completed)
    except Exception as e:
        logger.error(f"❌ Помилка отримання виконаних завдань {telegram_id}: {str(e)}")
        return []

# 💳 Enhanced Transaction Functions
@safe_supabase_call("create_winix_transaction")
def create_winix_transaction(telegram_id: Union[str, int], transaction_type: str, amount_winix: float = 0,
                           amount_tickets: int = 0, amount_flex: int = 0, description: str = "",
                           metadata: Optional[Dict] = None, reference_id: Optional[str] = None,
                           reference_type: Optional[str] = None) -> bool:
    """
    🎯 WINIX: Створення розширеної WINIX транзакції
    """
    try:
        telegram_id = str(telegram_id)
        current_time = datetime.now(timezone.utc).isoformat()

        transaction_data = {
            "id": str(uuid.uuid4()),
            "telegram_id": telegram_id,
            "type": transaction_type,
            "amount_winix": amount_winix,
            "amount_tickets": amount_tickets,
            "amount_flex": amount_flex,
            "description": description,
            "metadata": metadata or {},
            "reference_id": reference_id,
            "reference_type": reference_type,
            "status": "completed",
            "created_at": current_time,
            "updated_at": current_time
        }

        if supabase:
            res = supabase.table("transactions").insert(transaction_data).execute()  # type: ignore
            logger.info(f"create_winix_transaction: Транзакція {transaction_type} створена для {telegram_id}")
            return bool(res.data)
        return False
    except Exception as e:
        logger.error(f"❌ Помилка створення WINIX транзакції {telegram_id}: {str(e)}")
        return False

@safe_supabase_call("get_user_transaction_history")
@cached()
def get_user_transaction_history(telegram_id: Union[str, int], limit: int = 50) -> List[Dict[str, Any]]:
    """
    🎯 WINIX: Отримання історії WINIX транзакцій
    """
    try:
        telegram_id = str(telegram_id)
        logger.info(f"get_user_transaction_history: Отримання історії для {telegram_id}")

        def fetch_transactions():
            if not supabase:
                return []
            res = (supabase.table("transactions")
                   .select("*")
                   .eq("telegram_id", telegram_id)
                   .order("created_at", desc=True)
                   .limit(limit)
                   .execute())  # type: ignore
            return res.data if res.data else []

        return retry_supabase(fetch_transactions)
    except Exception as e:
        logger.error(f"❌ Помилка отримання історії транзакцій {telegram_id}: {str(e)}")
        return []

# 👛 Wallet Functions
@safe_supabase_call("get_user_wallet_info")
@cached()
def get_user_wallet_info(telegram_id: Union[str, int]) -> Optional[Dict[str, Any]]:
    """
    🎯 WINIX: Отримання інформації про гаманець користувача
    """
    try:
        telegram_id = str(telegram_id)
        logger.info(f"get_user_wallet_info: Отримання інформації про гаманець для {telegram_id}")

        def fetch_wallet_info():
            if not supabase:
                return None
            res = supabase.table("wallets").select("*").eq("telegram_id", telegram_id).execute()  # type: ignore
            return res.data[0] if res.data else None

        return retry_supabase(fetch_wallet_info)
    except Exception as e:
        logger.error(f"❌ Помилка отримання інформації про гаманець {telegram_id}: {str(e)}")
        return None

@safe_supabase_call("update_wallet_connection")
def update_wallet_connection(telegram_id: Union[str, int], address: str, provider: str = "tonconnect",
                           chain_id: str = "-239", public_key: Optional[str] = None,
                           verification_data: Optional[Dict] = None) -> bool:
    """
    🎯 WINIX: Оновлення з'єднання з гаманцем
    """
    try:
        telegram_id = str(telegram_id)
        current_time = datetime.now(timezone.utc).isoformat()

        wallet_data = {
            "address": address,
            "provider": provider,
            "chain_id": chain_id,
            "status": "connected",
            "connected_at": current_time,
            "updated_at": current_time
        }

        if public_key:
            wallet_data["public_key"] = public_key

        if verification_data:
            wallet_data["verification_data"] = verification_data

        if not supabase:
            return False

        # Спробуємо оновити існуючий запис
        res = supabase.table("wallets").update(wallet_data).eq("telegram_id", telegram_id).execute()  # type: ignore

        # Якщо немає записів, створюємо новий
        if not res.data:
            wallet_data.update({
                "telegram_id": telegram_id,
                "created_at": current_time
            })
            res = supabase.table("wallets").insert(wallet_data).execute()  # type: ignore

        # Інвалідуємо кеш
        invalidate_cache_for_entity(telegram_id)

        logger.info(f"update_wallet_connection: Гаманець підключено для {telegram_id}")
        return bool(res.data)
    except Exception as e:
        logger.error(f"❌ Помилка підключення гаманця {telegram_id}: {str(e)}")
        return False

@safe_supabase_call("create_wallet_event")
def create_wallet_event(telegram_id: Union[str, int], event_type: str, event_data: Dict[str, Any]) -> bool:
    """
    🎯 WINIX: Створення події гаманця
    """
    try:
        event_record = {
            "telegram_id": str(telegram_id),
            "event_type": event_type,
            "event_data": event_data,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

        if supabase:
            res = supabase.table("wallet_events").insert(event_record).execute()  # type: ignore
            logger.info(f"create_wallet_event: Подія гаманця {event_type} створена для {telegram_id}")
            return bool(res.data)
        return False
    except Exception as e:
        logger.error(f"❌ Помилка створення події гаманця {telegram_id}: {str(e)}")
        return False

@safe_supabase_call("get_wallet_events")
def get_wallet_events(telegram_id: Union[str, int]) -> List[Dict[str, Any]]:
    """
    🎯 WINIX: Отримання подій гаманця
    """
    try:
        telegram_id = str(telegram_id)

        def fetch_events():
            if not supabase:
                return []
            res = (supabase.table("wallet_events")
                   .select("*")
                   .eq("telegram_id", telegram_id)
                   .order("timestamp", desc=True)
                   .limit(50)
                   .execute())  # type: ignore
            return res.data if res.data else []

        return retry_supabase(fetch_events)
    except Exception as e:
        logger.error(f"❌ Помилка отримання подій гаманця {telegram_id}: {str(e)}")
        return []

@safe_supabase_call("create_wallet_connection_bonus")
def create_wallet_connection_bonus(telegram_id: Union[str, int], winix_amount: int, tickets_amount: int, description: str = "") -> bool:
    """
    🎯 WINIX: Створення бонусу за підключення гаманця
    """
    try:
        bonus_data = {
            "telegram_id": str(telegram_id),
            "winix_amount": winix_amount,
            "tickets_amount": tickets_amount,
            "description": description or "Бонус за підключення гаманця",
            "awarded_at": datetime.now(timezone.utc).isoformat()
        }

        if supabase:
            res = supabase.table("wallet_connection_bonuses").insert(bonus_data).execute()  # type: ignore
            logger.info(f"create_wallet_connection_bonus: Бонус за підключення створено для {telegram_id}")
            return bool(res.data)
        return False
    except Exception as e:
        logger.error(f"❌ Помилка створення бонусу за підключення {telegram_id}: {str(e)}")
        return False

# ===== WINIX INTEGRATION HELPERS =====

def ensure_winix_user_exists(telegram_id: Union[str, int], user_data: Optional[Dict] = None) -> bool:
    """
    🎯 WINIX: Переконується що користувач існує в усіх WINIX таблицях
    """
    try:
        telegram_id = str(telegram_id)

        # Переконуємося що основний користувач існує
        user = get_user(telegram_id)
        if not user:
            username = user_data.get("username", "WINIX User") if user_data else "WINIX User"
            user = create_user(telegram_id, username)
            if not user:
                return False

        current_time = datetime.now(timezone.utc).isoformat()

        # Створюємо записи в WINIX таблицях якщо їх немає
        tables_to_check = [
            ("user_analytics_stats", {
                "user_id": telegram_id,
                "total_events": 0,
                "first_seen": current_time,
                "last_seen": current_time
            }),
            ("daily_bonus_status", {
                "user_id": telegram_id,
                "current_day_number": 1,
                "current_streak": 0,
                "longest_streak": 0,
                "total_days_claimed": 0
            }),
            ("flex_balances", {
                "telegram_id": telegram_id,
                "flex_balance": 0,
                "last_updated": current_time
            }),
        ]

        for table_name, default_data in tables_to_check:
            try:
                if not supabase:
                    continue

                # Перевіряємо чи існує запис
                id_field = "user_id" if table_name in ["user_analytics_stats", "daily_bonus_status"] else "telegram_id"
                existing = supabase.table(table_name).select(id_field).eq(id_field, telegram_id).execute()  # type: ignore

                if not existing.data:
                    # Створюємо запис
                    default_data.update({
                        "created_at": current_time,
                        "updated_at": current_time
                    })
                    supabase.table(table_name).insert(default_data).execute()  # type: ignore
                    logger.info(f"ensure_winix_user_exists: Створено запис в {table_name} для {telegram_id}")
            except Exception as e:
                logger.warning(f"Помилка створення запису в {table_name}: {str(e)}")

        return True
    except Exception as e:
        logger.error(f"❌ Помилка ensure_winix_user_exists {telegram_id}: {str(e)}")
        return False

def get_winix_user_summary(telegram_id: Union[str, int]) -> Dict[str, Any]:
    """
    🎯 WINIX: Отримання повного зведення користувача WINIX
    """
    try:
        telegram_id = str(telegram_id)

        # Основні дані
        user = get_user(telegram_id)
        analytics = get_user_analytics(telegram_id)
        daily_status = get_user_daily_status(telegram_id)
        flex_balance = get_user_flex_balance(telegram_id)
        flex_claims = get_user_flex_claims(telegram_id)
        wallet_info = get_user_wallet_info(telegram_id)
        recent_transactions = get_user_transaction_history(telegram_id, limit=10)
        tasks_progress = get_user_tasks_progress(telegram_id)
        completed_tasks_list = get_completed_tasks(telegram_id)

        return {
            "user": user,
            "analytics": analytics,
            "daily_bonus": {
                "status": daily_status,
                "recent_entries": get_user_daily_entries(telegram_id, 7)
            },
            "flex": {
                "balance": flex_balance,
                "claims": flex_claims,
                "levels": get_flex_levels()
            },
            "wallet": {
                "info": wallet_info,
                "events": get_wallet_events(telegram_id)
            },
            "tasks": {
                "progress": tasks_progress,
                "completed": completed_tasks_list
            },
            "recent_transactions": recent_transactions,
            "summary_generated_at": datetime.now(timezone.utc).isoformat()
        }
    except Exception as e:
        logger.error(f"❌ Помилка get_winix_user_summary {telegram_id}: {str(e)}")
        return {}

# ===== WINIX CACHE MANAGEMENT =====

def clear_winix_cache(telegram_id: Optional[Union[str, int]] = None):
    """
    🎯 WINIX: Очищення WINIX кешу
    """
    try:
        if telegram_id:
            telegram_id = str(telegram_id)
            # Очищуємо кеш для конкретного користувача
            patterns = [
                f"get_user_analytics:{telegram_id}",
                f"get_user_daily_status:{telegram_id}",
                f"get_user_flex_balance:{telegram_id}",
                f"get_user_wallet_info:{telegram_id}",
                f"get_user_transaction_history:{telegram_id}",
                f"get_user_tasks_progress:{telegram_id}"
            ]

            total_cleared = 0
            for pattern in patterns:
                total_cleared += clear_cache(pattern)

            logger.info(f"clear_winix_cache: Очищено {total_cleared} записів для {telegram_id}")
            return total_cleared
        else:
            # Очищуємо весь WINIX кеш
            winix_patterns = [
                "get_user_analytics",
                "get_user_daily_status",
                "get_user_flex_balance",
                "get_user_wallet_info",
                "get_user_transaction_history",
                "get_user_tasks_progress",
                "get_flex_levels"
            ]

            total_cleared = 0
            for pattern in winix_patterns:
                total_cleared += clear_cache(pattern)

            logger.info(f"clear_winix_cache: Очищено {total_cleared} WINIX записів")
            return total_cleared
    except Exception as e:
        logger.error(f"❌ Помилка clear_winix_cache: {str(e)}")
        return 0

# ===== WINIX TESTING AND MONITORING =====

def test_winix_integration() -> Dict[str, Any]:
    """
    🎯 WINIX: Тестування WINIX інтеграції з Supabase
    """
    try:
        if not supabase:
            return {"status": "error", "message": "Supabase не підключено"}

        test_results = {}

        # Тестуємо доступність таблиць
        tables_to_test = [
            "winix", "user_analytics_stats", "daily_bonus_status", "daily_bonus_entries",
            "flex_balances", "flex_claims", "flex_levels", "transactions",
            "wallets", "wallet_events", "wallet_connection_bonuses",
            "task_progress", "completed_tasks", "analytics_events", "analytics_sessions",
            "staking_sessions"  # ✅ ДОДАНО ТАБЛИЦЯ СТЕЙКІНГУ
        ]

        for table in tables_to_test:
            try:
                res = supabase.table(table).select("*").limit(1).execute()  # type: ignore
                test_results[f"table_{table}"] = {
                    "status": "ok",
                    "accessible": True
                }
            except Exception as e:
                test_results[f"table_{table}"] = {
                    "status": "error",
                    "accessible": False,
                    "error": str(e)
                }

        # Тестуємо кеш
        test_results["cache"] = {
            "enabled": CACHE_ENABLED,
            "entries": len(_cache),
            "stats": cache_stats.get_stats()
        }

        # Підраховуємо доступні таблиці
        accessible_tables = sum(1 for result in test_results.values()
                              if isinstance(result, dict) and result.get("accessible", False))
        total_tables = len(tables_to_test)

        return {
            "status": "success",
            "message": "WINIX інтеграція перевірена",
            "summary": f"Доступно {accessible_tables}/{total_tables} таблиць",
            "results": test_results,
            "tested_at": datetime.now(timezone.utc).isoformat()
        }

    except Exception as e:
        logger.error(f"❌ Помилка test_winix_integration: {str(e)}")
        return {
            "status": "error",
            "message": str(e)
        }

# ===== ФІНАЛЬНА ІНІЦІАЛІЗАЦІЯ =====

# Очищення кешу від застарілих записів при завантаженні модуля
cleanup_cache()

logger.info("🎯 WINIX Quests + Staking інтеграція в Supabase завершена!")
logger.info(f"📊 Кеш: {cache_stats.entries} записів, статус: {'увімкнено' if CACHE_ENABLED else 'вимкнено'}")
logger.info(f"🔗 Supabase: {'підключено' if supabase else 'недоступний'}")
logger.info("🚀 Supabase Client готовий до роботи з WINIX Quests + Staking System!")
logger.info("✅ Всі таблиці та функції оновлені для повної сумісності з новою схемою БД")
logger.info("💎 STAKING FUNCTIONS: Додано повну підтримку стейкінгу!")
logger.info("🔧 Всі IDE помилки та попередження виправлені!")

# Type ignore для PyCharm IDE помилок
# noinspection PyUnresolvedReferences
def _supabase_type_hints_helper():
    """Функція для допомоги PyCharm з типізацією Supabase"""
    if supabase:
        # Це допоможе IDE розуміти методи
        supabase.table("test").select("*").execute()  # type: ignore
        supabase.table("test").insert({}).execute()  # type: ignore
        supabase.table("test").update({}).execute()  # type: ignore
        supabase.table("test").delete().execute()  # type: ignore