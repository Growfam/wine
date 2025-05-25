"""
Кеш система для WINIX Quests з підтримкою Redis та in-memory storage
Виправлена версія без async проблем при імпорті
"""

import asyncio
import json
import logging
import time
from datetime import datetime, timezone
from typing import Any, Dict, Optional
import hashlib
import threading

logger = logging.getLogger(__name__)

# Константи для кешу
DEFAULT_TTL = 300  # 5 хвилин
MAX_MEMORY_ITEMS = 1000
CLEANUP_INTERVAL = 60  # 1 хвилина


class CacheItem:
    """Елемент кешу з TTL та метаданими"""

    def __init__(self, value: Any, ttl: int = DEFAULT_TTL):
        self.value = value
        self.created_at = time.time()
        self.ttl = ttl
        self.access_count = 0
        self.last_accessed = self.created_at

    @property
    def expires_at(self) -> float:
        """Час закінчення TTL"""
        return self.created_at + self.ttl

    @property
    def is_expired(self) -> bool:
        """Перевірка чи закінчився TTL"""
        return time.time() > self.expires_at

    @property
    def remaining_ttl(self) -> float:
        """Залишковий час життя в секундах"""
        return max(0, self.expires_at - time.time())

    def touch(self):
        """Оновлює час останнього доступу"""
        self.access_count += 1
        self.last_accessed = time.time()

    def to_dict(self) -> Dict[str, Any]:
        """Конвертує в словник для серіалізації"""
        return {
            'value': self.value,
            'created_at': self.created_at,
            'ttl': self.ttl,
            'access_count': self.access_count,
            'last_accessed': self.last_accessed
        }


class MemoryCache:
    """In-memory кеш з TTL та LRU евикцією"""

    def __init__(self, max_items: int = MAX_MEMORY_ITEMS):
        self.max_items = max_items
        self._cache: Dict[str, CacheItem] = {}
        self._lock = threading.RLock()

    def get(self, key: str) -> Optional[Any]:
        """Отримує значення з кешу"""
        with self._lock:
            item = self._cache.get(key)
            if item is None:
                return None

            if item.is_expired:
                del self._cache[key]
                return None

            item.touch()
            return item.value

    def set(self, key: str, value: Any, ttl: int = DEFAULT_TTL) -> bool:
        """Зберігає значення в кеші"""
        with self._lock:
            # Очищуємо простір якщо потрібно
            if len(self._cache) >= self.max_items:
                self._evict_lru()

            self._cache[key] = CacheItem(value, ttl)
            return True

    def delete(self, key: str) -> bool:
        """Видаляє ключ з кешу"""
        with self._lock:
            return self._cache.pop(key, None) is not None

    def clear(self) -> bool:
        """Очищує весь кеш"""
        with self._lock:
            self._cache.clear()
            return True

    def exists(self, key: str) -> bool:
        """Перевіряє існування ключа"""
        with self._lock:
            item = self._cache.get(key)
            if item is None:
                return False

            if item.is_expired:
                del self._cache[key]
                return False

            return True

    def size(self) -> int:
        """Повертає кількість елементів в кеші"""
        with self._lock:
            return len(self._cache)

    def cleanup_expired(self) -> int:
        """Видаляє прострочені елементи"""
        with self._lock:
            expired_keys = []
            current_time = time.time()

            for key, item in self._cache.items():
                if item.created_at + item.ttl < current_time:
                    expired_keys.append(key)

            for key in expired_keys:
                del self._cache[key]

            return len(expired_keys)

    def _evict_lru(self):
        """Видаляє найменш використовувані елементи"""
        if not self._cache:
            return

        # Сортуємо за часом останнього доступу
        sorted_items = sorted(
            self._cache.items(),
            key=lambda x: x[1].last_accessed
        )

        # Видаляємо 10% найстаріших
        to_remove = max(1, len(sorted_items) // 10)
        for i in range(to_remove):
            key, _ = sorted_items[i]
            del self._cache[key]

    def get_stats(self) -> Dict[str, Any]:
        """Статистика кешу"""
        with self._lock:
            total_access = sum(item.access_count for item in self._cache.values())

            return {
                'total_items': len(self._cache),
                'max_items': self.max_items,
                'total_accesses': total_access,
                'memory_usage_percent': (len(self._cache) / self.max_items) * 100
            }


class RedisCache:
    """Redis кеш (заглушка для майбутньої реалізації)"""

    def __init__(self, redis_url: Optional[str] = None):
        self.redis_url = redis_url
        self._connected = False

        # Спроба підключення до Redis
        if redis_url:
            try:
                import redis
                self._redis = redis.from_url(redis_url, decode_responses=True)
                # Тестове підключення
                self._redis.ping()
                self._connected = True
                logger.info(f"✅ Підключено до Redis: {redis_url}")
            except Exception as e:
                logger.warning(f"⚠️ Не вдалося підключитися до Redis: {e}")
                self._connected = False

    @property
    def is_connected(self) -> bool:
        return self._connected

    def get(self, key: str) -> Optional[Any]:
        """Отримує значення з Redis"""
        if not self._connected:
            return None

        try:
            value = self._redis.get(key)
            if value is None:
                return None
            return json.loads(value)
        except Exception as e:
            logger.error(f"Помилка читання з Redis: {e}")
            return None

    def set(self, key: str, value: Any, ttl: int = DEFAULT_TTL) -> bool:
        """Зберігає значення в Redis"""
        if not self._connected:
            return False

        try:
            json_value = json.dumps(value, default=str)
            self._redis.setex(key, ttl, json_value)
            return True
        except Exception as e:
            logger.error(f"Помилка запису в Redis: {e}")
            return False

    def delete(self, key: str) -> bool:
        """Видаляє ключ з Redis"""
        if not self._connected:
            return False

        try:
            return bool(self._redis.delete(key))
        except Exception as e:
            logger.error(f"Помилка видалення з Redis: {e}")
            return False

    def clear(self) -> bool:
        """Очищує Redis (обережно!)"""
        if not self._connected:
            return False

        try:
            self._redis.flushdb()
            return True
        except Exception as e:
            logger.error(f"Помилка очищення Redis: {e}")
            return False

    def exists(self, key: str) -> bool:
        """Перевіряє існування ключа в Redis"""
        if not self._connected:
            return False

        try:
            return bool(self._redis.exists(key))
        except Exception as e:
            logger.error(f"Помилка перевірки існування в Redis: {e}")
            return False


class CacheManager:
    """
    Головний менеджер кешу з підтримкою Redis та in-memory
    Виправлена версія без async проблем
    """

    def __init__(self,
                 redis_url: Optional[str] = None,
                 enable_memory_cache: bool = True,
                 auto_start_cleanup: bool = False):
        """
        Ініціалізація менеджера кешу

        Args:
            redis_url: URL для підключення до Redis
            enable_memory_cache: Чи використовувати in-memory кеш
            auto_start_cleanup: Чи автоматично запускати cleanup task
        """
        self.redis_url = redis_url
        self.enable_memory_cache = enable_memory_cache

        # Ініціалізуємо кеші
        self.redis_cache = RedisCache(redis_url) if redis_url else None
        self.memory_cache = MemoryCache() if enable_memory_cache else None

        # Cleanup task контроль
        self._cleanup_task = None
        self._cleanup_running = False
        self._should_stop_cleanup = False

        # Статистика
        self._stats = {
            'hits': 0,
            'misses': 0,
            'sets': 0,
            'deletes': 0,
            'errors': 0
        }

        # Автоматичний запуск cleanup якщо дозволено
        if auto_start_cleanup:
            try:
                self.start_cleanup_task()
            except Exception as e:
                logger.warning(f"⚠️ Не вдалося запустити cleanup task: {e}")

    def start_cleanup_task(self):
        """Запускає cleanup task (викликати після створення event loop)"""
        try:
            # Перевіряємо чи є event loop
            loop = asyncio.get_running_loop()

            if self._cleanup_task is None or self._cleanup_task.done():
                self._should_stop_cleanup = False
                self._cleanup_task = loop.create_task(self._cleanup_loop())
                logger.info("✅ Cleanup task запущено")
                return True
        except RuntimeError:
            logger.debug("Немає event loop для cleanup task")
            return False
        except Exception as e:
            logger.error(f"Помилка запуску cleanup task: {e}")
            return False

    def stop_cleanup_task(self):
        """Зупиняє cleanup task"""
        self._should_stop_cleanup = True
        if self._cleanup_task and not self._cleanup_task.done():
            self._cleanup_task.cancel()
            logger.info("🛑 Cleanup task зупинено")

    async def _cleanup_loop(self):
        """Основний цикл очищення кешу"""
        self._cleanup_running = True

        try:
            while not self._should_stop_cleanup:
                try:
                    # Очищуємо memory cache
                    if self.memory_cache:
                        expired_count = self.memory_cache.cleanup_expired()
                        if expired_count > 0:
                            logger.debug(f"Очищено {expired_count} прострочених записів з memory cache")

                    # Чекаємо перед наступною ітерацією
                    await asyncio.sleep(CLEANUP_INTERVAL)

                except asyncio.CancelledError:
                    break
                except Exception as e:
                    logger.error(f"Помилка в cleanup loop: {e}")
                    await asyncio.sleep(CLEANUP_INTERVAL)

        finally:
            self._cleanup_running = False
            logger.debug("Cleanup loop завершено")

    def _generate_key(self, key: str, namespace: str = "") -> str:
        """Генерує фінальний ключ з namespace"""
        if namespace:
            return f"{namespace}:{key}"
        return key

    def get(self, key: str, namespace: str = "", default: Any = None) -> Any:
        """
        Отримує значення з кешу

        Args:
            key: Ключ для пошуку
            namespace: Простір імен
            default: Значення за замовчуванням

        Returns:
            Значення з кешу або default
        """
        final_key = self._generate_key(key, namespace)

        try:
            # Спочатку перевіряємо Redis
            if self.redis_cache and self.redis_cache.is_connected:
                value = self.redis_cache.get(final_key)
                if value is not None:
                    self._stats['hits'] += 1
                    return value

            # Потім memory cache
            if self.memory_cache:
                value = self.memory_cache.get(final_key)
                if value is not None:
                    self._stats['hits'] += 1
                    return value

            # Нічого не знайдено
            self._stats['misses'] += 1
            return default

        except Exception as e:
            self._stats['errors'] += 1
            logger.error(f"Помилка отримання з кешу {final_key}: {e}")
            return default

    def set(self,
            key: str,
            value: Any,
            ttl: int = DEFAULT_TTL,
            namespace: str = "") -> bool:
        """
        Зберігає значення в кеші

        Args:
            key: Ключ для збереження
            value: Значення для збереження
            ttl: Час життя в секундах
            namespace: Простір імен

        Returns:
            True якщо збережено успішно
        """
        final_key = self._generate_key(key, namespace)
        success = False

        try:
            # Зберігаємо в Redis
            if self.redis_cache and self.redis_cache.is_connected:
                if self.redis_cache.set(final_key, value, ttl):
                    success = True

            # Зберігаємо в memory cache
            if self.memory_cache:
                if self.memory_cache.set(final_key, value, ttl):
                    success = True

            if success:
                self._stats['sets'] += 1

            return success

        except Exception as e:
            self._stats['errors'] += 1
            logger.error(f"Помилка збереження в кеші {final_key}: {e}")
            return False

    def delete(self, key: str, namespace: str = "") -> bool:
        """
        Видаляє ключ з кешу

        Args:
            key: Ключ для видалення
            namespace: Простір імен

        Returns:
            True якщо видалено
        """
        final_key = self._generate_key(key, namespace)
        deleted = False

        try:
            # Видаляємо з Redis
            if self.redis_cache and self.redis_cache.is_connected:
                if self.redis_cache.delete(final_key):
                    deleted = True

            # Видаляємо з memory cache
            if self.memory_cache:
                if self.memory_cache.delete(final_key):
                    deleted = True

            if deleted:
                self._stats['deletes'] += 1

            return deleted

        except Exception as e:
            self._stats['errors'] += 1
            logger.error(f"Помилка видалення з кешу {final_key}: {e}")
            return False

    def exists(self, key: str, namespace: str = "") -> bool:
        """Перевіряє існування ключа"""
        final_key = self._generate_key(key, namespace)

        try:
            # Перевіряємо Redis
            if self.redis_cache and self.redis_cache.is_connected:
                if self.redis_cache.exists(final_key):
                    return True

            # Перевіряємо memory cache
            if self.memory_cache:
                if self.memory_cache.exists(final_key):
                    return True

            return False

        except Exception as e:
            logger.error(f"Помилка перевірки існування {final_key}: {e}")
            return False

    def clear(self, namespace: str = "") -> bool:
        """Очищує кеш"""
        try:
            success = True

            if namespace:
                # Очищаємо тільки конкретний namespace (складно реалізувати)
                logger.warning("Очищення по namespace поки не підтримується")
                return False
            else:
                # Очищаємо весь кеш
                if self.redis_cache and self.redis_cache.is_connected:
                    success &= self.redis_cache.clear()

                if self.memory_cache:
                    success &= self.memory_cache.clear()

            return success

        except Exception as e:
            logger.error(f"Помилка очищення кешу: {e}")
            return False

    def get_stats(self) -> Dict[str, Any]:
        """Отримує статистику кешу"""
        stats = self._stats.copy()

        # Додаємо інформацію про кеші
        stats.update({
            'redis_connected': self.redis_cache.is_connected if self.redis_cache else False,
            'memory_cache_enabled': self.memory_cache is not None,
            'cleanup_running': self._cleanup_running,
            'timestamp': datetime.now(timezone.utc).isoformat()
        })

        # Статистика memory cache
        if self.memory_cache:
            stats['memory_cache'] = self.memory_cache.get_stats()

        return stats

    def invalidate_pattern(self, pattern: str, namespace: str = "") -> int:
        """Видаляє ключі за патерном (поки тільки prefix)"""
        # Поки що проста реалізація - тільки для memory cache
        if not self.memory_cache:
            return 0

        prefix = self._generate_key(pattern, namespace)
        deleted = 0

        try:
            keys_to_delete = []
            for key in self.memory_cache._cache.keys():
                if key.startswith(prefix):
                    keys_to_delete.append(key)

            for key in keys_to_delete:
                if self.memory_cache.delete(key.replace(f"{namespace}:" if namespace else "", "")):
                    deleted += 1

            return deleted

        except Exception as e:
            logger.error(f"Помилка invalidate_pattern: {e}")
            return 0


# ✅ ГЛОБАЛЬНІ ЗМІННІ ДЛЯ LAZY INITIALIZATION

_cache_manager_instance = None
_initialization_attempted = False
_initialization_lock = threading.Lock()


def get_cache_manager(redis_url: Optional[str] = None) -> Optional[CacheManager]:
    """
    Отримує глобальний екземпляр CacheManager з lazy initialization

    Args:
        redis_url: URL Redis для першої ініціалізації

    Returns:
        CacheManager або None якщо не вдалося ініціалізувати
    """
    global _cache_manager_instance, _initialization_attempted

    # Якщо вже є екземпляр - повертаємо його
    if _cache_manager_instance is not None:
        return _cache_manager_instance

    # Thread-safe ініціалізація
    with _initialization_lock:
        # Двойна перевірка
        if _cache_manager_instance is not None:
            return _cache_manager_instance

        if _initialization_attempted:
            return None

        _initialization_attempted = True

        try:
            # Створюємо manager без автоматичного cleanup
            _cache_manager_instance = CacheManager(
                redis_url=redis_url,
                enable_memory_cache=True,
                auto_start_cleanup=False  # НЕ запускаємо async task автоматично
            )

            logger.info("✅ CacheManager ініціалізовано (lazy)")
            return _cache_manager_instance

        except Exception as e:
            logger.error(f"❌ Помилка ініціалізації CacheManager: {e}")
            return None


def start_cache_cleanup():
    """
    Запускає cleanup task для глобального cache manager
    Викликати після створення event loop
    """
    manager = get_cache_manager()
    if manager:
        return manager.start_cleanup_task()
    return False


# ✅ PROXY КЛАС ДЛЯ ЗВОРОТНОЇ СУМІСНОСТІ

class _CacheManagerProxy:
    """
    Proxy об'єкт для зворотної сумісності з існуючим кодом
    Автоматично викликає get_cache_manager() при доступі до методів
    """

    def __getattr__(self, name: str):
        manager = get_cache_manager()
        if manager is None:
            # Fallback для випадків коли manager недоступний
            if name in ['get', 'set', 'delete', 'exists', 'clear']:
                return self._create_fallback_method(name)
            raise AttributeError(f"CacheManager недоступний. Метод '{name}' не може бути викликаний.")

        return getattr(manager, name)

    def _create_fallback_method(self, method_name: str):
        """Створює fallback метод який не робить нічого"""
        def fallback(*args, **kwargs):
            logger.warning(f"CacheManager недоступний, {method_name} ігнорується")
            if method_name == 'get':
                return kwargs.get('default')
            return False
        return fallback

    def __bool__(self):
        return get_cache_manager() is not None

    def __repr__(self):
        manager = get_cache_manager()
        if manager:
            return f"<CacheManagerProxy: {manager}>"
        return "<CacheManagerProxy: Manager не ініціалізовано>"


# ✅ ГЛОБАЛЬНИЙ ОБ'ЄКТ ДЛЯ ЕКСПОРТУ

# ЗАМІСТЬ: cache_manager = CacheManager()  # ❌ Викликає async проблеми
cache_manager = _CacheManagerProxy()  # ✅ Безпечний proxy об'єкт


# ✅ UTILITY ФУНКЦІЇ

def cache_key_for_user(user_id: str, operation: str) -> str:
    """Генерує ключ кешу для користувача"""
    return f"user:{user_id}:{operation}"


def cache_key_for_data(data_type: str, identifier: str) -> str:
    """Генерує ключ кешу для даних"""
    return f"data:{data_type}:{identifier}"


def hash_key(key: str) -> str:
    """Створює хеш від ключа для коротших імен"""
    return hashlib.md5(key.encode()).hexdigest()


# ✅ ДЕКОРАТОРИ ДЛЯ КЕШУВАННЯ

def cached(ttl: int = DEFAULT_TTL, namespace: str = ""):
    """
    Декоратор для кешування результатів функцій

    Args:
        ttl: Час життя кешу в секундах
        namespace: Простір імен для кешу
    """
    def decorator(func):
        def wrapper(*args, **kwargs):
            # Генеруємо ключ з назви функції та аргументів
            key_data = f"{func.__name__}:{str(args)}:{str(sorted(kwargs.items()))}"
            cache_key = hash_key(key_data)

            # Спробуємо отримати з кешу
            cached_result = cache_manager.get(cache_key, namespace)
            if cached_result is not None:
                return cached_result

            # Виконуємо функцію та кешуємо результат
            result = func(*args, **kwargs)
            cache_manager.set(cache_key, result, ttl, namespace)

            return result
        return wrapper
    return decorator


# ✅ ІНІЦІАЛІЗАЦІЯ ПРИ ІМПОРТІ

logger.info("📦 Cache модуль завантажено (без async ініціалізації)")

# Експортуємо головні об'єкти
__all__ = [
    'cache_manager',
    'get_cache_manager',
    'start_cache_cleanup',
    'CacheManager',
    'cached',
    'cache_key_for_user',
    'cache_key_for_data'
]