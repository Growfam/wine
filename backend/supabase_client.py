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
import importlib.util
import sys
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
    """Очищає застарілі записи в кеші"""
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


# Функція для створення реферальних записів напряму
def create_referral_records_directly(referrer_id, referee_id, amount=50):
    """
    Створює записи в таблицях referrals та direct_bonuses напряму, без використання контролерів.
    Використовується як запасний варіант, якщо не вдалося імпортувати контролери.
    """
    try:
        # Конвертуємо ID в цілі числа, якщо це можливо
        try:
            referrer_id_int = int(referrer_id)
        except (ValueError, TypeError):
            referrer_id_int = referrer_id

        try:
            referee_id_int = int(referee_id)
        except (ValueError, TypeError):
            referee_id_int = referee_id

        # Перевіряємо, чи існує вже запис у таблиці referrals
        check_res = supabase.table("referrals").select("id").eq("referee_id", referee_id_int).execute()
        if check_res and check_res.data and len(check_res.data) > 0:
            logger.info(f"create_referral_records_directly: Реферальний запис для {referee_id} вже існує")
            return False

        # Поточний час для записів
        current_time = datetime.now(timezone.utc).isoformat()

        # 1. Створюємо запис про реферала 1-го рівня
        referral_data = {
            "referrer_id": referrer_id_int,
            "referee_id": referee_id_int,
            "level": 1,
            "created_at": current_time
        }

        ref_res = supabase.table("referrals").insert(referral_data).execute()
        logger.info(f"create_referral_records_directly: Створено реферальний запис 1-го рівня: {referrer_id} -> {referee_id}")

        # 2. Перевіряємо наявність реферера 2-го рівня
        try:
            higher_ref_res = supabase.table("referrals").select("referrer_id").eq("referee_id", referrer_id_int).eq("level", 1).execute()

            if higher_ref_res and higher_ref_res.data and len(higher_ref_res.data) > 0:
                higher_referrer_id = higher_ref_res.data[0]["referrer_id"]

                # Створюємо запис про реферала 2-го рівня
                second_level_data = {
                    "referrer_id": higher_referrer_id,
                    "referee_id": referee_id_int,
                    "level": 2,
                    "created_at": current_time
                }

                supabase.table("referrals").insert(second_level_data).execute()
                logger.info(f"create_referral_records_directly: Створено реферальний запис 2-го рівня: {higher_referrer_id} -> {referee_id}")
        except Exception as e:
            logger.warning(f"create_referral_records_directly: Помилка створення запису 2-го рівня: {str(e)}")

        # 3. Створюємо запис про прямий бонус
        try:
            bonus_data = {
                "referrer_id": referrer_id_int,
                "referee_id": referee_id_int,
                "amount": amount,
                "created_at": current_time
            }

            supabase.table("direct_bonuses").insert(bonus_data).execute()
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

                supabase.table("winix").update(update_data).eq("telegram_id", str(referrer_id)).execute()
                logger.info(f"create_referral_records_directly: Оновлено баланс реферера {referrer_id}: {current_balance} -> {new_balance}")

                # Інвалідуємо кеш для реферера
                invalidate_cache_for_entity(referrer_id)
        except Exception as e:
            logger.error(f"create_referral_records_directly: Помилка нарахування бонусу: {str(e)}")

        return True
    except Exception as e:
        logger.error(f"create_referral_records_directly: Помилка створення реферальних записів: {str(e)}")
        return False


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
    Створює нового користувача в Supabase з автоматичною реєстрацією реферального зв'язку

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
        user = force_create_user(telegram_id, username, referrer_id)

        if not user:
            logger.error(f"create_user: Не вдалося створити користувача {telegram_id}")
            return None

        # Якщо є referrer_id, реєструємо реферальний зв'язок
        if referrer_id:
            try:
                referrer_id = str(referrer_id)
                logger.info(f"create_user: Реєструємо реферальний зв'язок: {referrer_id} -> {telegram_id}")

                # Визначаємо змінні заздалегідь для уникнення попереджень
                modules_imported = False
                ReferralController = None
                BonusController = None

                # Спроба 1: Стандартний імпорт
                try:
                    from referrals.controllers.referral_controller import ReferralController
                    from referrals.controllers.bonus_controller import BonusController
                    modules_imported = True
                    logger.info("create_user: Успішно імпортовано контролери реферальної системи (спроба 1)")
                except ImportError:
                    pass

                # Спроба 2: Імпорт з префіксом backend
                if not modules_imported:
                    try:
                        from backend.referrals.controllers.referral_controller import ReferralController
                        from backend.referrals.controllers.bonus_controller import BonusController
                        modules_imported = True
                        logger.info("create_user: Успішно імпортовано контролери реферальної системи (спроба 2)")
                    except ImportError:
                        pass

                # Спроба 3: Динамічний імпорт через модульний шлях
                if not modules_imported:
                    try:
                        # Підготовка системного шляху
                        current_dir = os.path.dirname(os.path.abspath(__file__))
                        parent_dir = os.path.dirname(current_dir) if current_dir else os.getcwd()

                        # Спроба знайти файли контролерів
                        referral_controller_path = os.path.join(parent_dir, 'referrals', 'controllers', 'referral_controller.py')
                        bonus_controller_path = os.path.join(parent_dir, 'referrals', 'controllers', 'bonus_controller.py')

                        if os.path.exists(referral_controller_path) and os.path.exists(bonus_controller_path):
                            # Динамічний імпорт через spec
                            spec_referral = importlib.util.spec_from_file_location(
                                "referral_controller", referral_controller_path)
                            referral_module = importlib.util.module_from_spec(spec_referral)
                            spec_referral.loader.exec_module(referral_module)

                            spec_bonus = importlib.util.spec_from_file_location(
                                "bonus_controller", bonus_controller_path)
                            bonus_module = importlib.util.module_from_spec(spec_bonus)
                            spec_bonus.loader.exec_module(bonus_module)

                            ReferralController = referral_module.ReferralController
                            BonusController = bonus_module.BonusController
                            modules_imported = True
                            logger.info("create_user: Успішно імпортовано контролери реферальної системи (спроба 3)")
                    except Exception as e:
                        logger.warning(f"create_user: Помилка динамічного імпорту: {str(e)}")

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
                            if referrer_user:
                                current_balance = float(referrer_user.get('balance', 0))
                                new_balance = current_balance + 50

                                supabase.table("winix").update({
                                    "balance": new_balance,
                                    "updated_at": datetime.now(timezone.utc).isoformat()
                                }).eq("telegram_id", referrer_id).execute()

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
            # Запасний варіант - власна реалізація
            try:
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

# Очищення кешу від застарілих записів при завантаженні модуля
cleanup_cache()