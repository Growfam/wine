"""
Система Rate Limiting для WINIX
Розумне обмеження запитів з підтримкою різних стратегій
"""

import time
import asyncio
import logging
import functools
import hashlib
from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
from typing import Dict, Any, Optional, Callable, List, Union, Tuple
from dataclasses import dataclass, asdict
from enum import Enum
import redis
from flask import request, jsonify, g

logger = logging.getLogger(__name__)


class RateLimitStrategy(Enum):
    """Стратегії rate limiting"""
    FIXED_WINDOW = "fixed_window"  # Фіксоване вікно
    SLIDING_WINDOW = "sliding_window"  # Ковзне вікно
    TOKEN_BUCKET = "token_bucket"  # Токен бакет
    LEAKY_BUCKET = "leaky_bucket"  # Дірявий бакет
    ADAPTIVE = "adaptive"  # Адаптивне обмеження


class RateLimitScope(Enum):
    """Області застосування rate limiting"""
    GLOBAL = "global"  # Глобально
    IP = "ip"  # По IP адресі
    USER = "user"  # По користувачу
    ENDPOINT = "endpoint"  # По endpoint'у
    CUSTOM = "custom"  # Кастомний ключ


@dataclass
class RateLimitRule:
    """Правило rate limiting"""
    name: str
    strategy: RateLimitStrategy
    scope: RateLimitScope
    limit: int  # Максимальна кількість запитів
    window: int  # Вікно часу в секундах
    burst: Optional[int] = None  # Burst ліміт для token bucket
    penalty: Optional[int] = None  # Час блокування при перевищенні
    exempt_ips: Optional[List[str]] = None  # Виключення IP
    exempt_users: Optional[List[str]] = None  # Виключення користувачів
    enabled: bool = True

    def __post_init__(self):
        if self.exempt_ips is None:
            self.exempt_ips = []
        if self.exempt_users is None:
            self.exempt_users = []


@dataclass
class RateLimitResult:
    """Результат перевірки rate limit"""
    allowed: bool
    remaining: int
    reset_time: int
    retry_after: Optional[int] = None
    rule_name: Optional[str] = None
    current_count: int = 0


class TokenBucket:
    """Реалізація алгоритму Token Bucket"""

    def __init__(self, capacity: int, refill_rate: float, refill_period: int = 1):
        self.capacity = capacity
        self.tokens = capacity
        self.refill_rate = refill_rate
        self.refill_period = refill_period
        self.last_refill = time.time()
        self._lock = asyncio.Lock()

    async def consume(self, tokens: int = 1) -> bool:
        """Спробувати споживати токени"""
        async with self._lock:
            await self._refill()

            if self.tokens >= tokens:
                self.tokens -= tokens
                return True
            return False

    async def _refill(self):
        """Поповнити токени"""
        now = time.time()
        time_passed = now - self.last_refill

        if time_passed >= self.refill_period:
            periods = int(time_passed / self.refill_period)
            new_tokens = periods * self.refill_rate
            self.tokens = min(self.capacity, self.tokens + new_tokens)
            self.last_refill = now

    def get_state(self) -> Dict[str, Any]:
        """Отримати стан bucket'а"""
        return {
            'tokens': self.tokens,
            'capacity': self.capacity,
            'refill_rate': self.refill_rate,
            'last_refill': self.last_refill
        }


class LeakyBucket:
    """Реалізація алгоритму Leaky Bucket"""

    def __init__(self, capacity: int, leak_rate: float):
        self.capacity = capacity
        self.current_volume = 0
        self.leak_rate = leak_rate  # витікань за секунду
        self.last_leak = time.time()
        self._lock = asyncio.Lock()

    async def add_request(self) -> bool:
        """Додати запит до bucket'а"""
        async with self._lock:
            await self._leak()

            if self.current_volume < self.capacity:
                self.current_volume += 1
                return True
            return False

    async def _leak(self):
        """Витік з bucket'а"""
        now = time.time()
        time_passed = now - self.last_leak

        leak_amount = time_passed * self.leak_rate
        self.current_volume = max(0, self.current_volume - leak_amount)
        self.last_leak = now

    def get_state(self) -> Dict[str, Any]:
        """Отримати стан bucket'а"""
        return {
            'current_volume': self.current_volume,
            'capacity': self.capacity,
            'leak_rate': self.leak_rate,
            'last_leak': self.last_leak
        }


class MemoryRateLimiter:
    """In-memory rate limiter"""

    def __init__(self):
        self.counters: Dict[str, Dict[str, Any]] = defaultdict(dict)
        self.sliding_windows: Dict[str, deque] = defaultdict(deque)
        self.token_buckets: Dict[str, TokenBucket] = {}
        self.leaky_buckets: Dict[str, LeakyBucket] = {}
        self._lock = asyncio.Lock()

    async def check_rate_limit(self, key: str, rule: RateLimitRule) -> RateLimitResult:
        """Перевірити rate limit"""
        async with self._lock:
            if rule.strategy == RateLimitStrategy.FIXED_WINDOW:
                return await self._check_fixed_window(key, rule)
            elif rule.strategy == RateLimitStrategy.SLIDING_WINDOW:
                return await self._check_sliding_window(key, rule)
            elif rule.strategy == RateLimitStrategy.TOKEN_BUCKET:
                return await self._check_token_bucket(key, rule)
            elif rule.strategy == RateLimitStrategy.LEAKY_BUCKET:
                return await self._check_leaky_bucket(key, rule)
            else:
                return RateLimitResult(allowed=True, remaining=rule.limit, reset_time=0)

    async def _check_fixed_window(self, key: str, rule: RateLimitRule) -> RateLimitResult:
        """Перевірка з фіксованим вікном"""
        now = int(time.time())
        window_start = (now // rule.window) * rule.window

        if key not in self.counters:
            self.counters[key] = {'count': 0, 'window_start': window_start}

        counter = self.counters[key]

        # Скидаємо лічильник якщо почалося нове вікно
        if counter['window_start'] != window_start:
            counter['count'] = 0
            counter['window_start'] = window_start

        current_count = counter['count']

        if current_count >= rule.limit:
            reset_time = window_start + rule.window
            return RateLimitResult(
                allowed=False,
                remaining=0,
                reset_time=reset_time,
                retry_after=reset_time - now,
                rule_name=rule.name,
                current_count=current_count
            )

        counter['count'] += 1
        remaining = rule.limit - current_count - 1
        reset_time = window_start + rule.window

        return RateLimitResult(
            allowed=True,
            remaining=remaining,
            reset_time=reset_time,
            rule_name=rule.name,
            current_count=current_count + 1
        )

    async def _check_sliding_window(self, key: str, rule: RateLimitRule) -> RateLimitResult:
        """Перевірка з ковзним вікном"""
        now = time.time()
        window_start = now - rule.window

        # Отримуємо вікно для цього ключа
        window = self.sliding_windows[key]

        # Видаляємо старі запити
        while window and window[0] <= window_start:
            window.popleft()

        current_count = len(window)

        if current_count >= rule.limit:
            # Знаходимо час коли можна буде зробити наступний запит
            oldest_request = window[0] if window else now
            retry_after = oldest_request + rule.window - now

            return RateLimitResult(
                allowed=False,
                remaining=0,
                reset_time=int(oldest_request + rule.window),
                retry_after=max(0, int(retry_after)),
                rule_name=rule.name,
                current_count=current_count
            )

        # Додаємо поточний запит
        window.append(now)
        remaining = rule.limit - current_count - 1

        return RateLimitResult(
            allowed=True,
            remaining=remaining,
            reset_time=int(now + rule.window),
            rule_name=rule.name,
            current_count=current_count + 1
        )

    async def _check_token_bucket(self, key: str, rule: RateLimitRule) -> RateLimitResult:
        """Перевірка з token bucket"""
        if key not in self.token_buckets:
            burst = rule.burst or rule.limit
            refill_rate = rule.limit / rule.window
            self.token_buckets[key] = TokenBucket(burst, refill_rate, 1)

        bucket = self.token_buckets[key]
        allowed = await bucket.consume(1)

        state = bucket.get_state()
        remaining = int(state['tokens'])

        if not allowed:
            retry_after = int((1 - (state['tokens'] % 1)) / state['refill_rate'])
            return RateLimitResult(
                allowed=False,
                remaining=remaining,
                reset_time=int(time.time() + retry_after),
                retry_after=retry_after,
                rule_name=rule.name
            )

        return RateLimitResult(
            allowed=True,
            remaining=remaining,
            reset_time=int(time.time() + rule.window),
            rule_name=rule.name
        )

    async def _check_leaky_bucket(self, key: str, rule: RateLimitRule) -> RateLimitResult:
        """Перевірка з leaky bucket"""
        if key not in self.leaky_buckets:
            leak_rate = rule.limit / rule.window
            self.leaky_buckets[key] = LeakyBucket(rule.limit, leak_rate)

        bucket = self.leaky_buckets[key]
        allowed = await bucket.add_request()

        state = bucket.get_state()
        remaining = int(state['capacity'] - state['current_volume'])

        if not allowed:
            retry_after = int((state['current_volume'] - state['capacity'] + 1) / state['leak_rate'])
            return RateLimitResult(
                allowed=False,
                remaining=0,
                reset_time=int(time.time() + retry_after),
                retry_after=retry_after,
                rule_name=rule.name
            )

        return RateLimitResult(
            allowed=True,
            remaining=remaining,
            reset_time=int(time.time() + rule.window),
            rule_name=rule.name
        )

    async def cleanup_expired(self):
        """Очистити застарілі дані"""
        async with self._lock:
            now = time.time()

            # Очищаємо старі лічильники фіксованих вікон
            expired_keys = []
            for key, counter in self.counters.items():
                if now - counter.get('window_start', 0) > 3600:  # 1 година
                    expired_keys.append(key)

            for key in expired_keys:
                del self.counters[key]

            # Очищаємо старі ковзні вікна
            for key, window in list(self.sliding_windows.items()):
                while window and window[0] <= now - 3600:  # 1 година
                    window.popleft()

                if not window:
                    del self.sliding_windows[key]


class RedisRateLimiter:
    """Redis-based rate limiter"""

    def __init__(self, redis_client: Optional[redis.Redis] = None):
        self.redis = redis_client
        self._connect_redis()

    def _connect_redis(self):
        """Підключитися до Redis"""
        if not self.redis:
            try:
                import os
                self.redis = redis.Redis(
                    host=os.getenv('REDIS_HOST', 'localhost'),
                    port=int(os.getenv('REDIS_PORT', '6379')),
                    db=int(os.getenv('REDIS_DB', '1')),  # Окрема база для rate limiting
                    password=os.getenv('REDIS_PASSWORD'),
                    decode_responses=True
                )
                self.redis.ping()
                logger.info("✅ Redis rate limiter підключено")
            except Exception as e:
                logger.error(f"❌ Помилка підключення Redis rate limiter: {str(e)}")
                self.redis = None

    async def check_rate_limit(self, key: str, rule: RateLimitRule) -> RateLimitResult:
        """Перевірити rate limit через Redis"""
        if not self.redis:
            return RateLimitResult(allowed=True, remaining=rule.limit, reset_time=0)

        try:
            if rule.strategy == RateLimitStrategy.FIXED_WINDOW:
                return await self._check_fixed_window_redis(key, rule)
            elif rule.strategy == RateLimitStrategy.SLIDING_WINDOW:
                return await self._check_sliding_window_redis(key, rule)
            else:
                # Fallback до fixed window для інших стратегій в Redis
                return await self._check_fixed_window_redis(key, rule)
        except Exception as e:
            logger.error(f"Redis rate limit error: {str(e)}")
            return RateLimitResult(allowed=True, remaining=rule.limit, reset_time=0)

    async def _check_fixed_window_redis(self, key: str, rule: RateLimitRule) -> RateLimitResult:
        """Перевірка з фіксованим вікном через Redis"""
        now = int(time.time())
        window_start = (now // rule.window) * rule.window
        redis_key = f"rate_limit:fixed:{key}:{window_start}"

        pipe = self.redis.pipeline()
        pipe.incr(redis_key)
        pipe.expire(redis_key, rule.window + 1)
        result = pipe.execute()

        current_count = result[0]

        if current_count > rule.limit:
            reset_time = window_start + rule.window
            return RateLimitResult(
                allowed=False,
                remaining=0,
                reset_time=reset_time,
                retry_after=reset_time - now,
                rule_name=rule.name,
                current_count=current_count
            )

        remaining = rule.limit - current_count
        reset_time = window_start + rule.window

        return RateLimitResult(
            allowed=True,
            remaining=remaining,
            reset_time=reset_time,
            rule_name=rule.name,
            current_count=current_count
        )

    async def _check_sliding_window_redis(self, key: str, rule: RateLimitRule) -> RateLimitResult:
        """Перевірка з ковзним вікном через Redis"""
        now = time.time()
        window_start = now - rule.window
        redis_key = f"rate_limit:sliding:{key}"

        pipe = self.redis.pipeline()
        pipe.zremrangebyscore(redis_key, 0, window_start)
        pipe.zcard(redis_key)
        pipe.zadd(redis_key, {str(now): now})
        pipe.expire(redis_key, rule.window + 1)
        result = pipe.execute()

        current_count = result[1]

        if current_count >= rule.limit:
            # Отримуємо найстаріший запит
            oldest = self.redis.zrange(redis_key, 0, 0, withscores=True)
            if oldest:
                oldest_time = oldest[0][1]
                retry_after = oldest_time + rule.window - now

                return RateLimitResult(
                    allowed=False,
                    remaining=0,
                    reset_time=int(oldest_time + rule.window),
                    retry_after=max(0, int(retry_after)),
                    rule_name=rule.name,
                    current_count=current_count
                )

        remaining = rule.limit - current_count - 1

        return RateLimitResult(
            allowed=True,
            remaining=remaining,
            reset_time=int(now + rule.window),
            rule_name=rule.name,
            current_count=current_count + 1
        )


class RateLimitManager:
    """Головний менеджер rate limiting"""

    def __init__(self, use_redis: bool = True):
        self.rules: Dict[str, RateLimitRule] = {}
        self.memory_limiter = MemoryRateLimiter()
        self.redis_limiter = RedisRateLimiter() if use_redis else None
        self.use_redis = use_redis and self.redis_limiter and self.redis_limiter.redis

        # Статистика
        self.stats = {
            'total_requests': 0,
            'blocked_requests': 0,
            'rules_triggered': defaultdict(int)
        }

        # Завантажуємо стандартні правила
        self._load_default_rules()

        # Запускаємо cleanup task
        self._start_cleanup_task()

    def _load_default_rules(self):
        """Завантажити стандартні правила rate limiting"""
        import os

        # Загальні правила
        self.add_rule(RateLimitRule(
            name="global_api",
            strategy=RateLimitStrategy.SLIDING_WINDOW,
            scope=RateLimitScope.IP,
            limit=int(os.getenv('RATE_LIMIT_GLOBAL', '100')),
            window=60,
            exempt_ips=['127.0.0.1', '::1']
        ))

        # Правила для аутентифікації
        self.add_rule(RateLimitRule(
            name="auth_attempts",
            strategy=RateLimitStrategy.FIXED_WINDOW,
            scope=RateLimitScope.IP,
            limit=int(os.getenv('RATE_LIMIT_AUTH', '10')),
            window=300,  # 5 хвилин
            penalty=3600  # 1 година блокування
        ))

        # Правила для завдань
        self.add_rule(RateLimitRule(
            name="task_operations",
            strategy=RateLimitStrategy.TOKEN_BUCKET,
            scope=RateLimitScope.USER,
            limit=int(os.getenv('RATE_LIMIT_TASKS', '30')),
            window=60,
            burst=50
        ))

        # Правила для аналітики
        self.add_rule(RateLimitRule(
            name="analytics_events",
            strategy=RateLimitStrategy.LEAKY_BUCKET,
            scope=RateLimitScope.USER,
            limit=int(os.getenv('RATE_LIMIT_ANALYTICS', '100')),
            window=60
        ))

    def add_rule(self, rule: RateLimitRule):
        """Додати правило rate limiting"""
        self.rules[rule.name] = rule
        logger.info(f"Rate limit rule added: {rule.name}")

    def remove_rule(self, name: str):
        """Видалити правило"""
        if name in self.rules:
            del self.rules[name]
            logger.info(f"Rate limit rule removed: {name}")

    def get_rule(self, name: str) -> Optional[RateLimitRule]:
        """Отримати правило"""
        return self.rules.get(name)

    async def check_rate_limit(self, rule_name: str, scope_value: Optional[str] = None,
                               custom_key: Optional[str] = None) -> RateLimitResult:
        """Перевірити rate limit для правила"""
        rule = self.rules.get(rule_name)
        if not rule or not rule.enabled:
            return RateLimitResult(allowed=True, remaining=999999, reset_time=0)

        # Генеруємо ключ
        key = self._generate_key(rule, scope_value, custom_key)

        # Перевіряємо виключення
        if self._is_exempt(rule, scope_value):
            return RateLimitResult(allowed=True, remaining=999999, reset_time=0)

        # Вибираємо limiter
        limiter = self.redis_limiter if self.use_redis else self.memory_limiter

        # Перевіряємо ліміт
        result = await limiter.check_rate_limit(key, rule)

        # Оновлюємо статистику
        self.stats['total_requests'] += 1
        if not result.allowed:
            self.stats['blocked_requests'] += 1
            self.stats['rules_triggered'][rule_name] += 1

        return result

    def _generate_key(self, rule: RateLimitRule, scope_value: Optional[str],
                      custom_key: Optional[str]) -> str:
        """Генерувати ключ для rate limiting"""
        if custom_key:
            return f"custom:{custom_key}"

        if rule.scope == RateLimitScope.GLOBAL:
            return "global"
        elif rule.scope == RateLimitScope.IP:
            ip = scope_value or request.remote_addr if request else 'unknown'
            return f"ip:{ip}"
        elif rule.scope == RateLimitScope.USER:
            user_id = scope_value or getattr(g, 'user_id', 'anonymous') if hasattr(g, 'user_id') else 'anonymous'
            return f"user:{user_id}"
        elif rule.scope == RateLimitScope.ENDPOINT:
            endpoint = scope_value or request.endpoint if request else 'unknown'
            return f"endpoint:{endpoint}"
        else:
            return "unknown"

    def _is_exempt(self, rule: RateLimitRule, scope_value: Optional[str]) -> bool:
        """Перевірити чи є виключення"""
        if rule.scope == RateLimitScope.IP:
            ip = scope_value or request.remote_addr if request else None
            return ip in rule.exempt_ips if ip else False
        elif rule.scope == RateLimitScope.USER:
            user_id = scope_value or getattr(g, 'user_id', None) if hasattr(g, 'user_id') else None
            return str(user_id) in rule.exempt_users if user_id else False

        return False

    def _start_cleanup_task(self):
        """Запустити фонову задачу очищення"""

        async def cleanup_task():
            while True:
                try:
                    await asyncio.sleep(300)  # Кожні 5 хвилин
                    await self.memory_limiter.cleanup_expired()
                    logger.debug("Rate limiter cleanup completed")
                except Exception as e:
                    logger.error(f"Rate limiter cleanup error: {str(e)}")

        asyncio.create_task(cleanup_task())

    def get_stats(self) -> Dict[str, Any]:
        """Отримати статистику"""
        block_rate = (self.stats['blocked_requests'] / self.stats['total_requests'] * 100) if self.stats[
                                                                                                  'total_requests'] > 0 else 0

        return {
            'total_requests': self.stats['total_requests'],
            'blocked_requests': self.stats['blocked_requests'],
            'block_rate': round(block_rate, 2),
            'rules_count': len(self.rules),
            'rules_triggered': dict(self.stats['rules_triggered']),
            'backend': 'redis' if self.use_redis else 'memory'
        }


# Глобальний екземпляр
rate_limit_manager = RateLimitManager()


# Декоратори
def rate_limit(rule_name: str, scope_value: Optional[str] = None,
               custom_key: Optional[str] = None):
    """
    Декоратор для rate limiting

    Args:
        rule_name: Назва правила
        scope_value: Значення області (IP, user_id, etc.)
        custom_key: Кастомний ключ
    """

    def decorator(func: Callable) -> Callable:
        @functools.wraps(func)
        async def async_wrapper(*args, **kwargs):
            result = await rate_limit_manager.check_rate_limit(
                rule_name, scope_value, custom_key
            )

            if not result.allowed:
                response_data = {
                    "status": "error",
                    "message": "Rate limit exceeded",
                    "code": "rate_limit_exceeded",
                    "retry_after": result.retry_after,
                    "reset_time": result.reset_time
                }

                # Створюємо Flask response
                from flask import jsonify
                response = jsonify(response_data)
                response.status_code = 429
                response.headers['X-RateLimit-Limit'] = str(rate_limit_manager.get_rule(rule_name).limit)
                response.headers['X-RateLimit-Remaining'] = str(result.remaining)
                response.headers['X-RateLimit-Reset'] = str(result.reset_time)
                if result.retry_after:
                    response.headers['Retry-After'] = str(result.retry_after)

                return response

            # Додаємо заголовки rate limit до відповіді
            if asyncio.iscoroutinefunction(func):
                response = await func(*args, **kwargs)
            else:
                response = func(*args, **kwargs)

            # Додаємо заголовки якщо це Flask response
            if hasattr(response, 'headers'):
                rule = rate_limit_manager.get_rule(rule_name)
                if rule:
                    response.headers['X-RateLimit-Limit'] = str(rule.limit)
                    response.headers['X-RateLimit-Remaining'] = str(result.remaining)
                    response.headers['X-RateLimit-Reset'] = str(result.reset_time)

            return response

        @functools.wraps(func)
        def sync_wrapper(*args, **kwargs):
            return asyncio.run(async_wrapper(*args, **kwargs))

        if asyncio.iscoroutinefunction(func):
            return async_wrapper
        else:
            return sync_wrapper

    return decorator


def flask_rate_limit_middleware(app):
    """Flask middleware для rate limiting"""

    @app.before_request
    def check_rate_limit():
        """Перевірка rate limit перед запитом"""

        # Пропускаємо статичні файли
        if request.endpoint and request.endpoint.startswith('static'):
            return

        # Загальна перевірка
        async def check():
            return await rate_limit_manager.check_rate_limit(
                'global_api',
                scope_value=request.remote_addr
            )

        result = asyncio.run(check())

        if not result.allowed:
            response_data = {
                "status": "error",
                "message": "Rate limit exceeded",
                "code": "rate_limit_exceeded",
                "retry_after": result.retry_after
            }

            response = jsonify(response_data)
            response.status_code = 429
            response.headers['X-RateLimit-Limit'] = str(rate_limit_manager.get_rule('global_api').limit)
            response.headers['X-RateLimit-Remaining'] = str(result.remaining)
            response.headers['X-RateLimit-Reset'] = str(result.reset_time)
            if result.retry_after:
                response.headers['Retry-After'] = str(result.retry_after)

            return response

    @app.after_request
    def add_rate_limit_headers(response):
        """Додати заголовки rate limit"""
        # Додаємо загальні заголовки rate limit
        rule = rate_limit_manager.get_rule('global_api')
        if rule:
            # Отримуємо поточний стан (без споживання)
            response.headers['X-RateLimit-Policy'] = f"{rule.limit} per {rule.window}s"

        return response


# Експорт
__all__ = [
    'RateLimitStrategy',
    'RateLimitScope',
    'RateLimitRule',
    'RateLimitResult',
    'RateLimitManager',
    'rate_limit_manager',
    'rate_limit',
    'flask_rate_limit_middleware'
]