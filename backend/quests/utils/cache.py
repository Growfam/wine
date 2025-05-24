"""
Система кешування для WINIX
Redis інтеграція, кешування запитів та оптимізація продуктивності
"""

import os
import redis
import json
import pickle
import hashlib
import logging
import functools
import asyncio
from datetime import datetime, timedelta, timezone
from typing import Any, Optional, Dict, List, Union, Callable, TypeVar
from dataclasses import dataclass, asdict
from enum import Enum
import time

logger = logging.getLogger(__name__)

# Типи
T = TypeVar('T')
F = TypeVar('F', bound=Callable[..., Any])


class CacheType(Enum):
    """Типи кешу"""
    MEMORY = "memory"  # Локальний кеш в пам'яті
    REDIS = "redis"  # Redis кеш
    HYBRID = "hybrid"  # Гібридний (пам'ять + Redis)


class CachePolicy(Enum):
    """Політики кешування"""
    LRU = "lru"  # Least Recently Used
    LFU = "lfu"  # Least Frequently Used
    TTL = "ttl"  # Time To Live
    FIFO = "fifo"  # First In First Out


@dataclass
class CacheConfig:
    """Конфігурація кешу"""
    type: CacheType = CacheType.HYBRID
    policy: CachePolicy = CachePolicy.LRU
    default_ttl: int = 300  # 5 хвилин
    max_memory_items: int = 1000
    max_memory_size: int = 10 * 1024 * 1024  # 10MB
    redis_host: str = "localhost"
    redis_port: int = 6379
    redis_db: int = 0
    redis_password: Optional[str] = None
    redis_prefix: str = "winix:"
    compression: bool = True
    serialization: str = "json"  # json, pickle


@dataclass
class CacheStats:
    """Статистика кешу"""
    hits: int = 0
    misses: int = 0
    sets: int = 0
    deletes: int = 0
    evictions: int = 0
    memory_usage: int = 0
    redis_connections: int = 0
    last_cleanup: Optional[datetime] = None

    @property
    def hit_rate(self) -> float:
        """Відсоток попадань в кеш"""
        total = self.hits + self.misses
        return (self.hits / total * 100) if total > 0 else 0.0

    def to_dict(self) -> Dict[str, Any]:
        data = asdict(self)
        if self.last_cleanup:
            data['last_cleanup'] = self.last_cleanup.isoformat()
        return data


class CacheItem:
    """Елемент кешу"""

    def __init__(self, value: Any, ttl: Optional[int] = None,
                 access_count: int = 0, tags: Optional[List[str]] = None):
        self.value = value
        self.created_at = time.time()
        self.expires_at = (time.time() + ttl) if ttl else None
        self.last_accessed = time.time()
        self.access_count = access_count
        self.tags = tags or []
        self.size = self._calculate_size(value)

    def _calculate_size(self, value: Any) -> int:
        """Розрахувати розмір об'єкта"""
        try:
            if isinstance(value, str):
                return len(value.encode('utf-8'))
            elif isinstance(value, (int, float, bool)):
                return 8
            elif isinstance(value, (list, dict)):
                return len(json.dumps(value, default=str).encode('utf-8'))
            else:
                return len(pickle.dumps(value))
        except:
            return 100  # Приблизний розмір за замовчуванням

    def is_expired(self) -> bool:
        """Перевірити чи не застарів елемент"""
        return self.expires_at is not None and time.time() > self.expires_at

    def touch(self):
        """Оновити час останнього доступу"""
        self.last_accessed = time.time()
        self.access_count += 1

    def to_dict(self) -> Dict[str, Any]:
        return {
            'value': self.value,
            'created_at': self.created_at,
            'expires_at': self.expires_at,
            'last_accessed': self.last_accessed,
            'access_count': self.access_count,
            'tags': self.tags,
            'size': self.size
        }


class MemoryCache:
    """Локальний кеш в пам'яті"""

    def __init__(self, config: CacheConfig):
        self.config = config
        self._cache: Dict[str, CacheItem] = {}
        self._access_order: List[str] = []  # Для LRU
        self._lock = asyncio.Lock()

    async def get(self, key: str) -> Optional[Any]:
        """Отримати значення з кешу"""
        async with self._lock:
            item = self._cache.get(key)
            if not item:
                return None

            if item.is_expired():
                await self._delete(key)
                return None

            item.touch()
            self._update_access_order(key)
            return item.value

    async def set(self, key: str, value: Any, ttl: Optional[int] = None,
                  tags: Optional[List[str]] = None) -> bool:
        """Зберегти значення в кеші"""
        async with self._lock:
            if ttl is None:
                ttl = self.config.default_ttl

            item = CacheItem(value, ttl, tags=tags)

            # Перевіряємо ліміти пам'яті
            if len(self._cache) >= self.config.max_memory_items:
                await self._evict_items()

            total_size = sum(item.size for item in self._cache.values()) + item.size
            if total_size > self.config.max_memory_size:
                await self._evict_by_size()

            self._cache[key] = item
            self._update_access_order(key)
            return True

    async def delete(self, key: str) -> bool:
        """Видалити елемент з кешу"""
        async with self._lock:
            return await self._delete(key)

    async def _delete(self, key: str) -> bool:
        """Внутрішній метод видалення"""
        if key in self._cache:
            del self._cache[key]
            if key in self._access_order:
                self._access_order.remove(key)
            return True
        return False

    async def clear(self) -> bool:
        """Очистити весь кеш"""
        async with self._lock:
            self._cache.clear()
            self._access_order.clear()
            return True

    async def exists(self, key: str) -> bool:
        """Перевірити чи існує ключ"""
        async with self._lock:
            item = self._cache.get(key)
            if not item:
                return False
            if item.is_expired():
                await self._delete(key)
                return False
            return True

    async def get_by_tags(self, tags: List[str]) -> Dict[str, Any]:
        """Отримати всі елементи з вказаними тегами"""
        async with self._lock:
            result = {}
            for key, item in self._cache.items():
                if item.is_expired():
                    continue
                if any(tag in item.tags for tag in tags):
                    result[key] = item.value
            return result

    async def delete_by_tags(self, tags: List[str]) -> int:
        """Видалити всі елементи з вказаними тегами"""
        async with self._lock:
            keys_to_delete = []
            for key, item in self._cache.items():
                if any(tag in item.tags for tag in tags):
                    keys_to_delete.append(key)

            for key in keys_to_delete:
                await self._delete(key)

            return len(keys_to_delete)

    def _update_access_order(self, key: str):
        """Оновити порядок доступу для LRU"""
        if key in self._access_order:
            self._access_order.remove(key)
        self._access_order.append(key)

    async def _evict_items(self):
        """Видалити елементи згідно з політикою"""
        if self.config.policy == CachePolicy.LRU:
            # Видаляємо найменш нещодавно використовувані
            keys_to_remove = self._access_order[:len(self._access_order) // 4]
            for key in keys_to_remove:
                await self._delete(key)

        elif self.config.policy == CachePolicy.LFU:
            # Видаляємо найменш часто використовувані
            items = [(key, item.access_count) for key, item in self._cache.items()]
            items.sort(key=lambda x: x[1])
            keys_to_remove = [key for key, _ in items[:len(items) // 4]]
            for key in keys_to_remove:
                await self._delete(key)

    async def _evict_by_size(self):
        """Видалити елементи для звільнення пам'яті"""
        target_size = self.config.max_memory_size * 0.75  # 75% від ліміту
        current_size = sum(item.size for item in self._cache.values())

        # Сортуємо за розміром (спочатку найбільші)
        items = sorted(self._cache.items(), key=lambda x: x[1].size, reverse=True)

        for key, item in items:
            if current_size <= target_size:
                break
            current_size -= item.size
            await self._delete(key)

    async def cleanup_expired(self) -> int:
        """Очистити застарілі елементи"""
        async with self._lock:
            expired_keys = []
            for key, item in self._cache.items():
                if item.is_expired():
                    expired_keys.append(key)

            for key in expired_keys:
                await self._delete(key)

            return len(expired_keys)

    async def get_stats(self) -> Dict[str, Any]:
        """Отримати статистику кешу"""
        async with self._lock:
            total_size = sum(item.size for item in self._cache.values())
            return {
                'type': 'memory',
                'items': len(self._cache),
                'size_bytes': total_size,
                'size_mb': round(total_size / 1024 / 1024, 2),
                'max_items': self.config.max_memory_items,
                'max_size_mb': self.config.max_memory_size / 1024 / 1024
            }


class RedisCache:
    """Redis кеш"""

    def __init__(self, config: CacheConfig):
        self.config = config
        self._redis: Optional[redis.Redis] = None
        self._connect()

    def _connect(self):
        """Підключитися до Redis"""
        try:
            self._redis = redis.Redis(
                host=self.config.redis_host,
                port=self.config.redis_port,
                db=self.config.redis_db,
                password=self.config.redis_password,
                decode_responses=False,  # Для підтримки binary даних
                socket_connect_timeout=5,
                socket_timeout=5,
                retry_on_timeout=True,
                health_check_interval=30
            )

            # Перевіряємо з'єднання
            self._redis.ping()
            logger.info(f"✅ Підключено до Redis: {self.config.redis_host}:{self.config.redis_port}")

        except Exception as e:
            logger.error(f"❌ Помилка підключення до Redis: {str(e)}")
            self._redis = None

    def _make_key(self, key: str) -> str:
        """Створити ключ з префіксом"""
        return f"{self.config.redis_prefix}{key}"

    def _serialize(self, value: Any) -> bytes:
        """Серіалізувати значення"""
        try:
            if self.config.serialization == "json":
                return json.dumps(value, default=str, ensure_ascii=False).encode('utf-8')
            else:  # pickle
                return pickle.dumps(value)
        except Exception as e:
            logger.error(f"Помилка серіалізації: {str(e)}")
            return pickle.dumps(value)

    def _deserialize(self, data: bytes) -> Any:
        """Десеріалізувати значення"""
        try:
            if self.config.serialization == "json":
                return json.loads(data.decode('utf-8'))
            else:  # pickle
                return pickle.loads(data)
        except json.JSONDecodeError:
            # Fallback на pickle
            return pickle.loads(data)
        except Exception as e:
            logger.error(f"Помилка десеріалізації: {str(e)}")
            return None

    async def get(self, key: str) -> Optional[Any]:
        """Отримати значення з Redis"""
        if not self._redis:
            return None

        try:
            redis_key = self._make_key(key)
            data = self._redis.get(redis_key)

            if data is None:
                return None

            return self._deserialize(data)

        except Exception as e:
            logger.error(f"Помилка отримання з Redis {key}: {str(e)}")
            return None

    async def set(self, key: str, value: Any, ttl: Optional[int] = None,
                  tags: Optional[List[str]] = None) -> bool:
        """Зберегти значення в Redis"""
        if not self._redis:
            return False

        try:
            redis_key = self._make_key(key)
            data = self._serialize(value)

            if ttl is None:
                ttl = self.config.default_ttl

            result = self._redis.setex(redis_key, ttl, data)

            # Зберігаємо теги окремо
            if tags:
                for tag in tags:
                    tag_key = self._make_key(f"tag:{tag}")
                    self._redis.sadd(tag_key, key)
                    self._redis.expire(tag_key, ttl + 60)  # Трохи довше ніж основний ключ

            return bool(result)

        except Exception as e:
            logger.error(f"Помилка збереження в Redis {key}: {str(e)}")
            return False

    async def delete(self, key: str) -> bool:
        """Видалити елемент з Redis"""
        if not self._redis:
            return False

        try:
            redis_key = self._make_key(key)
            result = self._redis.delete(redis_key)
            return bool(result)

        except Exception as e:
            logger.error(f"Помилка видалення з Redis {key}: {str(e)}")
            return False

    async def clear(self) -> bool:
        """Очистити всі ключі з префіксом"""
        if not self._redis:
            return False

        try:
            pattern = f"{self.config.redis_prefix}*"
            keys = self._redis.keys(pattern)

            if keys:
                self._redis.delete(*keys)

            return True

        except Exception as e:
            logger.error(f"Помилка очищення Redis: {str(e)}")
            return False

    async def exists(self, key: str) -> bool:
        """Перевірити чи існує ключ"""
        if not self._redis:
            return False

        try:
            redis_key = self._make_key(key)
            return bool(self._redis.exists(redis_key))

        except Exception as e:
            logger.error(f"Помилка перевірки існування в Redis {key}: {str(e)}")
            return False

    async def get_by_tags(self, tags: List[str]) -> Dict[str, Any]:
        """Отримати всі елементи з вказаними тегами"""
        if not self._redis:
            return {}

        try:
            all_keys = set()
            for tag in tags:
                tag_key = self._make_key(f"tag:{tag}")
                keys = self._redis.smembers(tag_key)
                all_keys.update(key.decode('utf-8') if isinstance(key, bytes) else key for key in keys)

            result = {}
            for key in all_keys:
                value = await self.get(key)
                if value is not None:
                    result[key] = value

            return result

        except Exception as e:
            logger.error(f"Помилка отримання по тегах з Redis: {str(e)}")
            return {}

    async def delete_by_tags(self, tags: List[str]) -> int:
        """Видалити всі елементи з вказаними тегами"""
        if not self._redis:
            return 0

        try:
            all_keys = set()
            for tag in tags:
                tag_key = self._make_key(f"tag:{tag}")
                keys = self._redis.smembers(tag_key)
                all_keys.update(key.decode('utf-8') if isinstance(key, bytes) else key for key in keys)

            deleted_count = 0
            for key in all_keys:
                if await self.delete(key):
                    deleted_count += 1

            # Видаляємо також ключі тегів
            for tag in tags:
                tag_key = self._make_key(f"tag:{tag}")
                self._redis.delete(tag_key)

            return deleted_count

        except Exception as e:
            logger.error(f"Помилка видалення по тегах з Redis: {str(e)}")
            return 0

    async def get_stats(self) -> Dict[str, Any]:
        """Отримати статистику Redis"""
        if not self._redis:
            return {'type': 'redis', 'connected': False}

        try:
            info = self._redis.info()
            memory_info = self._redis.info('memory')

            return {
                'type': 'redis',
                'connected': True,
                'version': info.get('redis_version'),
                'used_memory': memory_info.get('used_memory'),
                'used_memory_human': memory_info.get('used_memory_human'),
                'connected_clients': info.get('connected_clients'),
                'total_commands_processed': info.get('total_commands_processed'),
                'keyspace_hits': info.get('keyspace_hits', 0),
                'keyspace_misses': info.get('keyspace_misses', 0)
            }

        except Exception as e:
            logger.error(f"Помилка отримання статистики Redis: {str(e)}")
            return {'type': 'redis', 'connected': False, 'error': str(e)}


class CacheManager:
    """Головний менеджер кешування"""

    def __init__(self, config: Optional[CacheConfig] = None):
        self.config = config or self._load_config()
        self.stats = CacheStats()

        # Ініціалізуємо кеші
        self.memory_cache = MemoryCache(self.config)
        self.redis_cache = RedisCache(self.config) if self.config.type != CacheType.MEMORY else None

        # Запускаємо періодичну очистку
        self._start_cleanup_task()

    def _load_config(self) -> CacheConfig:
        """Завантажити конфігурацію з змінних середовища"""
        return CacheConfig(
            type=CacheType(os.getenv('CACHE_TYPE', 'hybrid')),
            default_ttl=int(os.getenv('CACHE_DEFAULT_TTL', '300')),
            max_memory_items=int(os.getenv('CACHE_MAX_MEMORY_ITEMS', '1000')),
            redis_host=os.getenv('REDIS_HOST', 'localhost'),
            redis_port=int(os.getenv('REDIS_PORT', '6379')),
            redis_db=int(os.getenv('REDIS_DB', '0')),
            redis_password=os.getenv('REDIS_PASSWORD'),
            redis_prefix=os.getenv('REDIS_PREFIX', 'winix:'),
            compression=os.getenv('CACHE_COMPRESSION', 'true').lower() == 'true',
            serialization=os.getenv('CACHE_SERIALIZATION', 'json')
        )

    async def get(self, key: str) -> Optional[Any]:
        """Отримати значення з кешу"""
        # Спочатку перевіряємо пам'ять
        if self.config.type in [CacheType.MEMORY, CacheType.HYBRID]:
            value = await self.memory_cache.get(key)
            if value is not None:
                self.stats.hits += 1
                return value

        # Потім Redis
        if self.redis_cache and self.config.type in [CacheType.REDIS, CacheType.HYBRID]:
            value = await self.redis_cache.get(key)
            if value is not None:
                self.stats.hits += 1

                # Для гібридного режиму зберігаємо в пам'яті
                if self.config.type == CacheType.HYBRID:
                    await self.memory_cache.set(key, value, ttl=60)  # Коротший TTL в пам'яті

                return value

        self.stats.misses += 1
        return None

    async def set(self, key: str, value: Any, ttl: Optional[int] = None,
                  tags: Optional[List[str]] = None) -> bool:
        """Зберегти значення в кеші"""
        success = False

        # Зберігаємо в пам'яті
        if self.config.type in [CacheType.MEMORY, CacheType.HYBRID]:
            success = await self.memory_cache.set(key, value, ttl, tags) or success

        # Зберігаємо в Redis
        if self.redis_cache and self.config.type in [CacheType.REDIS, CacheType.HYBRID]:
            success = await self.redis_cache.set(key, value, ttl, tags) or success

        if success:
            self.stats.sets += 1

        return success

    async def delete(self, key: str) -> bool:
        """Видалити елемент з кешу"""
        success = False

        if self.config.type in [CacheType.MEMORY, CacheType.HYBRID]:
            success = await self.memory_cache.delete(key) or success

        if self.redis_cache and self.config.type in [CacheType.REDIS, CacheType.HYBRID]:
            success = await self.redis_cache.delete(key) or success

        if success:
            self.stats.deletes += 1

        return success

    async def clear(self) -> bool:
        """Очистити весь кеш"""
        success = False

        if self.config.type in [CacheType.MEMORY, CacheType.HYBRID]:
            success = await self.memory_cache.clear() or success

        if self.redis_cache and self.config.type in [CacheType.REDIS, CacheType.HYBRID]:
            success = await self.redis_cache.clear() or success

        return success

    async def exists(self, key: str) -> bool:
        """Перевірити чи існує ключ"""
        if self.config.type in [CacheType.MEMORY, CacheType.HYBRID]:
            if await self.memory_cache.exists(key):
                return True

        if self.redis_cache and self.config.type in [CacheType.REDIS, CacheType.HYBRID]:
            return await self.redis_cache.exists(key)

        return False

    async def get_by_tags(self, tags: List[str]) -> Dict[str, Any]:
        """Отримати всі елементи з вказаними тегами"""
        result = {}

        if self.config.type in [CacheType.MEMORY, CacheType.HYBRID]:
            memory_result = await self.memory_cache.get_by_tags(tags)
            result.update(memory_result)

        if self.redis_cache and self.config.type in [CacheType.REDIS, CacheType.HYBRID]:
            redis_result = await self.redis_cache.get_by_tags(tags)
            result.update(redis_result)

        return result

    async def delete_by_tags(self, tags: List[str]) -> int:
        """Видалити всі елементи з вказаними тегами"""
        total_deleted = 0

        if self.config.type in [CacheType.MEMORY, CacheType.HYBRID]:
            total_deleted += await self.memory_cache.delete_by_tags(tags)

        if self.redis_cache and self.config.type in [CacheType.REDIS, CacheType.HYBRID]:
            total_deleted += await self.redis_cache.delete_by_tags(tags)

        return total_deleted

    async def get_stats(self) -> Dict[str, Any]:
        """Отримати детальну статистику"""
        stats = self.stats.to_dict()

        # Додаємо статистику окремих кешів
        if self.config.type in [CacheType.MEMORY, CacheType.HYBRID]:
            stats['memory'] = await self.memory_cache.get_stats()

        if self.redis_cache and self.config.type in [CacheType.REDIS, CacheType.HYBRID]:
            stats['redis'] = await self.redis_cache.get_stats()

        stats['config'] = {
            'type': self.config.type.value,
            'policy': self.config.policy.value,
            'default_ttl': self.config.default_ttl
        }

        return stats

    def _start_cleanup_task(self):
        """Запустити фонову задачу очищення"""

        async def cleanup_task():
            while True:
                try:
                    await asyncio.sleep(300)  # Кожні 5 хвилин

                    expired_count = 0
                    if self.config.type in [CacheType.MEMORY, CacheType.HYBRID]:
                        expired_count += await self.memory_cache.cleanup_expired()

                    if expired_count > 0:
                        logger.info(f"Очищено {expired_count} застарілих елементів кешу")
                        self.stats.evictions += expired_count
                        self.stats.last_cleanup = datetime.now(timezone.utc)

                except Exception as e:
                    logger.error(f"Помилка очищення кешу: {str(e)}")

        asyncio.create_task(cleanup_task())


# Глобальний екземпляр менеджера кешу
cache_manager = CacheManager()


# Декоратори для кешування
def cache(ttl: Optional[int] = None, tags: Optional[List[str]] = None,
          key_func: Optional[Callable] = None):
    """
    Декоратор для кешування результатів функцій

    Args:
        ttl: Час життя в секундах
        tags: Теги для групування
        key_func: Функція для генерації ключа кешу
    """

    def decorator(func: F) -> F:
        @functools.wraps(func)
        async def async_wrapper(*args, **kwargs):
            # Генеруємо ключ кешу
            if key_func:
                cache_key = key_func(*args, **kwargs)
            else:
                cache_key = _generate_cache_key(func.__name__, args, kwargs)

            # Перевіряємо кеш
            cached_result = await cache_manager.get(cache_key)
            if cached_result is not None:
                return cached_result

            # Виконуємо функцію
            if asyncio.iscoroutinefunction(func):
                result = await func(*args, **kwargs)
            else:
                result = func(*args, **kwargs)

            # Зберігаємо в кеші
            await cache_manager.set(cache_key, result, ttl, tags)

            return result

        @functools.wraps(func)
        def sync_wrapper(*args, **kwargs):
            return asyncio.run(async_wrapper(*args, **kwargs))

        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper

    return decorator


def cache_invalidate(tags: Optional[List[str]] = None, key: Optional[str] = None):
    """
    Декоратор для інвалідації кешу після виконання функції

    Args:
        tags: Теги для видалення
        key: Конкретний ключ для видалення
    """

    def decorator(func: F) -> F:
        @functools.wraps(func)
        async def async_wrapper(*args, **kwargs):
            # Виконуємо функцію
            if asyncio.iscoroutinefunction(func):
                result = await func(*args, **kwargs)
            else:
                result = func(*args, **kwargs)

            # Інвалідуємо кеш
            if key:
                await cache_manager.delete(key)
            elif tags:
                await cache_manager.delete_by_tags(tags)

            return result

        @functools.wraps(func)
        def sync_wrapper(*args, **kwargs):
            return asyncio.run(async_wrapper(*args, **kwargs))

        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper

    return decorator


def _generate_cache_key(func_name: str, args: tuple, kwargs: dict) -> str:
    """Генерувати ключ кешу на основі функції та аргументів"""
    # Створюємо хеш від аргументів
    args_str = json.dumps(args, default=str, sort_keys=True)
    kwargs_str = json.dumps(kwargs, default=str, sort_keys=True)

    combined = f"{func_name}:{args_str}:{kwargs_str}"
    return hashlib.md5(combined.encode()).hexdigest()


# Експорт
__all__ = [
    'CacheType',
    'CachePolicy',
    'CacheConfig',
    'CacheStats',
    'CacheManager',
    'cache_manager',
    'cache',
    'cache_invalidate'
]