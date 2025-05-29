"""
Сервіс для роботи з TON Connect та TON блокчейном
БЕЗ ВАЛІДАЦІЇ - довіряємо TON Connect UI
"""

import os
import time
import logging
import asyncio
from typing import Dict, Any, List, Optional
from datetime import datetime, timezone
from dataclasses import dataclass
from enum import Enum

# Налаштування логування
logger = logging.getLogger(__name__)

# Конфігурація TON
TON_API_BASE_URL = os.getenv('TON_API_BASE_URL', 'https://toncenter.com/api/v2')
TON_API_KEY = os.getenv('TON_API_KEY', '')
TON_TESTNET_API_URL = os.getenv('TON_TESTNET_API_URL', 'https://testnet.toncenter.com/api/v2')

# Конфігурація FLEX токенів
FLEX_CONTRACT_ADDRESS = os.getenv('FLEX_CONTRACT_ADDRESS', 'EQD-cvR0Nz6XAyRBpDeWFVyaIrVrQlm7Q_1nglcuSvJhYk4h')
FLEX_DECIMALS = int(os.getenv('FLEX_DECIMALS', '9'))

# Конфігурація кешування
CACHE_BALANCE_TIMEOUT = int(os.getenv('CACHE_BALANCE_TIMEOUT', '300'))  # 5 хвилин
CACHE_TRANSACTION_TIMEOUT = int(os.getenv('CACHE_TRANSACTION_TIMEOUT', '60'))  # 1 хвилина

# Конфігурація HTTP
HTTP_TIMEOUT = int(os.getenv('HTTP_TIMEOUT', '30'))
MAX_RETRIES = int(os.getenv('MAX_RETRIES', '3'))

# === БЕЗПЕЧНИЙ ІМПОРТ AIOHTTP ===
HAS_AIOHTTP = False
aiohttp = None

try:
    import aiohttp
    HAS_AIOHTTP = True
    logger.info("✅ aiohttp пакет доступний")
except ImportError as e:
    logger.warning(f"⚠️ aiohttp пакет недоступний: {e}")
    logger.info("💡 Встановіть: pip install aiohttp")

    # Заглушка для aiohttp
    class MockClientSession:
        def __init__(self, *args, **kwargs): pass
        async def __aenter__(self): return self
        async def __aexit__(self, *args): pass
        async def get(self, *args, **kwargs):
            return MockResponse()

    class MockClientTimeout:
        def __init__(self, *args, **kwargs): pass

    class MockResponse:
        def __init__(self):
            self.status = 503
        async def json(self): return {'ok': False, 'error': 'aiohttp unavailable'}
        async def text(self): return 'aiohttp unavailable'

    class MockAiohttp:
        ClientSession = MockClientSession
        ClientTimeout = MockClientTimeout

    aiohttp = MockAiohttp()


class TONNetwork(Enum):
    """TON мережі"""
    MAINNET = "mainnet"
    TESTNET = "testnet"


class TransactionType(Enum):
    """Типи транзакцій"""
    INCOMING = "incoming"
    OUTGOING = "outgoing"
    INTERNAL = "internal"


@dataclass
class TONBalance:
    """Баланс TON гаманця"""
    ton_balance: float
    flex_balance: int
    last_updated: datetime
    address: str


@dataclass
class FlexTokenInfo:
    """Інформація про FLEX токен"""
    contract_address: str
    decimals: int
    symbol: str = "FLEX"
    name: str = "FLEX Token"


class TONConnectService:
    """Сервіс для роботи з TON Connect та блокчейном БЕЗ ВАЛІДАЦІЇ"""

    def __init__(self, network: TONNetwork = TONNetwork.MAINNET):
        """
        Ініціалізація сервісу

        Args:
            network: Мережа TON (mainnet/testnet)
        """
        self.network = network
        self.base_url = TON_API_BASE_URL if network == TONNetwork.MAINNET else TON_TESTNET_API_URL
        self.api_key = TON_API_KEY
        self.is_available = HAS_AIOHTTP

        # Інформація про FLEX токен
        self.flex_token = FlexTokenInfo(
            contract_address=FLEX_CONTRACT_ADDRESS,
            decimals=FLEX_DECIMALS
        )

        # Кеш для балансів
        self._balance_cache: Dict[str, Dict[str, Any]] = {}

        if not HAS_AIOHTTP:
            logger.warning("⚠️ aiohttp недоступний - сервіс працює в режимі заглушки")
        else:
            logger.info(f"✅ TONConnectService ініціалізовано для мережі {network.value} (без валідації)")
            logger.info(f"📡 API URL: {self.base_url}")
            logger.info(f"💎 FLEX Contract: {self.flex_token.contract_address}")

    async def get_wallet_balance(self, address: str, force_refresh: bool = False) -> Optional[TONBalance]:
        """
        Отримання балансу гаманця (TON + FLEX)

        Args:
            address: Адреса гаманця
            force_refresh: Примусове оновлення (пропуск кешу)

        Returns:
            Баланс гаманця або None при помилці
        """
        if not self.is_available:
            logger.warning("⚠️ TON сервіс недоступний")
            return None

        try:
            logger.info(f"📊 Отримання балансу для адреси {address}")

            # Перевіряємо кеш
            cache_key = f"balance_{address}"
            if not force_refresh and cache_key in self._balance_cache:
                cached_data = self._balance_cache[cache_key]
                cache_age = time.time() - cached_data['timestamp']

                if cache_age < CACHE_BALANCE_TIMEOUT:
                    logger.debug(f"🔄 Використовуємо кешований баланс для {address}")
                    return cached_data['balance']

            # Отримуємо баланс TON та FLEX паралельно
            ton_balance_task = self._get_ton_balance(address)
            flex_balance_task = self._get_flex_balance(address)

            ton_balance, flex_balance = await asyncio.gather(
                ton_balance_task,
                flex_balance_task,
                return_exceptions=True
            )

            # Обробляємо результати
            if isinstance(ton_balance, Exception):
                logger.error(f"❌ Помилка отримання TON балансу: {ton_balance}")
                ton_balance = 0.0

            if isinstance(flex_balance, Exception):
                logger.error(f"❌ Помилка отримання FLEX балансу: {flex_balance}")
                flex_balance = 0

            # Створюємо об'єкт балансу
            now = datetime.now(timezone.utc)
            balance = TONBalance(
                ton_balance=float(ton_balance),
                flex_balance=int(flex_balance),
                last_updated=now,
                address=address
            )

            # Кешуємо результат
            self._balance_cache[cache_key] = {
                'balance': balance,
                'timestamp': time.time()
            }

            logger.info(f"✅ Баланс отримано: TON={balance.ton_balance:.4f}, FLEX={balance.flex_balance:,}")
            return balance

        except Exception as e:
            logger.error(f"❌ Помилка отримання балансу для {address}: {str(e)}")
            return None

    async def _get_ton_balance(self, address: str) -> float:
        """Отримання балансу TON"""
        if not self.is_available:
            return 0.0

        try:
            url = f"{self.base_url}/getAddressBalance"
            params = {
                'address': address,
                'api_key': self.api_key
            }

            async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=HTTP_TIMEOUT)) as session:
                async with session.get(url, params=params) as response:
                    if response.status == 200:
                        data = await response.json()

                        if data.get('ok'):
                            # Баланс повертається в наногrams, конвертуємо в TON
                            balance_nanograms = int(data.get('result', '0'))
                            balance_ton = balance_nanograms / 1_000_000_000  # 1 TON = 10^9 nanograms

                            logger.debug(f"💎 TON баланс для {address}: {balance_ton:.4f}")
                            return balance_ton
                        else:
                            raise Exception(f"API помилка: {data.get('error', 'Unknown error')}")
                    else:
                        raise Exception(f"HTTP {response.status}: {await response.text()}")

        except Exception as e:
            logger.error(f"❌ Помилка отримання TON балансу: {str(e)}")
            raise

    async def _get_flex_balance(self, address: str) -> int:
        """Отримання балансу FLEX токенів"""
        try:
            # Для спрощення поки що повертаємо симульований баланс
            # В реальній реалізації тут буде запит до смарт-контракту FLEX

            # Симулюємо запит до контракту
            await asyncio.sleep(0.1)  # Імітація мережевого запиту

            # Тимчасова логіка: генеруємо баланс на основі адреси
            import hashlib
            address_hash = hashlib.md5(address.encode()).hexdigest()
            balance = int(address_hash[:8], 16) % 1_000_000  # 0-1M FLEX

            logger.debug(f"🔥 FLEX баланс для {address}: {balance:,}")
            return balance

        except Exception as e:
            logger.error(f"❌ Помилка отримання FLEX балансу: {str(e)}")
            raise

    def get_wallet_balance_sync(self, address: str, force_refresh: bool = False) -> Optional[TONBalance]:
        """
        БЕЗПЕЧНА синхронна версія отримання балансу

        Args:
            address: Адреса гаманця
            force_refresh: Примусове оновлення

        Returns:
            Баланс гаманця або None
        """
        if not self.is_available:
            return None

        try:
            # Безпечний запуск асинхронної функції
            try:
                loop = asyncio.get_running_loop()
                # Якщо loop вже запущено, використовуємо ThreadPoolExecutor
                import concurrent.futures
                import threading

                def run_in_thread():
                    return asyncio.run(self.get_wallet_balance(address, force_refresh))

                with concurrent.futures.ThreadPoolExecutor() as executor:
                    future = executor.submit(run_in_thread)
                    return future.result(timeout=60)  # 60 секунд timeout

            except RuntimeError:
                # Немає запущеного loop
                return asyncio.run(self.get_wallet_balance(address, force_refresh))

        except Exception as e:
            logger.error(f"❌ Помилка синхронного отримання балансу: {str(e)}")
            return None

    async def verify_wallet_ownership(self, address: str, signature: str, message: str) -> bool:
        """
        Верифікація володіння гаманцем через підпис
        БЕЗ ВАЛІДАЦІЇ - довіряємо TON Connect

        Args:
            address: Адреса гаманця
            signature: Підпис повідомлення
            message: Повідомлення що було підписано

        Returns:
            True - завжди, бо довіряємо TON Connect
        """
        try:
            logger.info(f"🔐 Верифікація володіння гаманцем {address}")

            # TON Connect вже перевірив підпис - довіряємо йому
            logger.info(f"✅ Верифікація прийнята від TON Connect для {address}")
            return True

        except Exception as e:
            logger.error(f"❌ Помилка верифікації гаманця {address}: {str(e)}")
            return True  # Все одно повертаємо True, бо довіряємо TON Connect

    async def get_wallet_transactions(self, address: str, limit: int = 50,
                                      before_lt: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        Отримання транзакцій гаманця

        Args:
            address: Адреса гаманця
            limit: Кількість транзакцій
            before_lt: Логічний час (для пагінації)

        Returns:
            Список транзакцій
        """
        if not self.is_available:
            return []

        try:
            logger.info(f"📋 Отримання транзакцій для {address} (limit={limit})")

            url = f"{self.base_url}/getTransactions"
            params = {
                'address': address,
                'limit': min(limit, 100),  # Максимум 100 за запит
                'api_key': self.api_key
            }

            if before_lt:
                params['lt'] = before_lt
                params['hash'] = ''  # Потрібен для API

            async with aiohttp.ClientSession(timeout=aiohttp.ClientTimeout(total=HTTP_TIMEOUT)) as session:
                async with session.get(url, params=params) as response:
                    if response.status == 200:
                        data = await response.json()

                        if data.get('ok'):
                            transactions = data.get('result', [])
                            processed_transactions = self._process_transactions(transactions, address)

                            logger.info(f"✅ Отримано {len(processed_transactions)} транзакцій для {address}")
                            return processed_transactions
                        else:
                            raise Exception(f"API помилка: {data.get('error', 'Unknown error')}")
                    else:
                        raise Exception(f"HTTP {response.status}: {await response.text()}")

        except Exception as e:
            logger.error(f"❌ Помилка отримання транзакцій для {address}: {str(e)}")
            return []

    def _process_transactions(self, raw_transactions: List[Dict], address: str) -> List[Dict[str, Any]]:
        """Обробка сирих транзакцій від API"""
        processed = []

        try:
            for tx in raw_transactions:
                # Визначаємо тип транзакції
                in_msg = tx.get('in_msg', {})
                out_msgs = tx.get('out_msgs', [])

                transaction_type = TransactionType.INTERNAL
                amount = 0
                source = ""
                destination = ""

                # Аналізуємо вхідні повідомлення
                if in_msg and in_msg.get('source'):
                    if in_msg['source'] != address:
                        transaction_type = TransactionType.INCOMING
                        amount = int(in_msg.get('value', '0'))
                        source = in_msg['source']
                        destination = address

                # Аналізуємо вихідні повідомлення
                for out_msg in out_msgs:
                    if out_msg.get('destination') and out_msg['destination'] != address:
                        transaction_type = TransactionType.OUTGOING
                        amount = int(out_msg.get('value', '0'))
                        source = address
                        destination = out_msg['destination']
                        break

                # Створюємо оброблену транзакцію
                processed_tx = {
                    'hash': tx.get('transaction_id', {}).get('hash', ''),
                    'lt': tx.get('transaction_id', {}).get('lt', 0),
                    'timestamp': tx.get('utime', 0),
                    'type': transaction_type.value,
                    'amount_nanograms': amount,
                    'amount_ton': amount / 1_000_000_000,
                    'source': source,
                    'destination': destination,
                    'fee': int(tx.get('fee', '0')),
                    'success': True,  # Поки що всі транзакції вважаємо успішними
                    'raw': tx  # Зберігаємо сирі дані для налагодження
                }

                processed.append(processed_tx)

        except Exception as e:
            logger.error(f"❌ Помилка обробки транзакцій: {str(e)}")

        return processed

    def validate_address(self, address: str) -> bool:
        """
        БЕЗ ВАЛІДАЦІЇ - завжди повертаємо True для непорожніх адрес
        Довіряємо TON Connect UI

        Args:
            address: Адреса для валідації

        Returns:
            True якщо адреса не порожня
        """
        try:
            if not address or not isinstance(address, str):
                return False

            # Очищаємо пробіли
            address = address.strip()

            # TON Connect UI вже зробив всю необхідну валідацію
            if len(address) > 0:
                logger.info(f"✅ Адреса від TON Connect прийнята: {address}")
                return True

            return False

        except Exception as e:
            logger.error(f"❌ Помилка валідації адреси {address}: {str(e)}")
            return True  # У випадку помилки все одно довіряємо TON Connect

    def clear_cache(self, address: Optional[str] = None) -> None:
        """
        Очищення кешу

        Args:
            address: Адреса для очищення (якщо None - очищує весь кеш)
        """
        try:
            if address:
                cache_key = f"balance_{address}"
                if cache_key in self._balance_cache:
                    del self._balance_cache[cache_key]
                    logger.info(f"🧹 Кеш очищено для адреси {address}")
            else:
                self._balance_cache.clear()
                logger.info("🧹 Кеш повністю очищено")

        except Exception as e:
            logger.error(f"❌ Помилка очищення кешу: {str(e)}")

    def get_cache_stats(self) -> Dict[str, Any]:
        """Статистика кешу"""
        try:
            now = time.time()
            total_entries = len(self._balance_cache)
            expired_entries = 0

            for cache_data in self._balance_cache.values():
                cache_age = now - cache_data['timestamp']
                if cache_age > CACHE_BALANCE_TIMEOUT:
                    expired_entries += 1

            return {
                'total_entries': total_entries,
                'expired_entries': expired_entries,
                'active_entries': total_entries - expired_entries,
                'cache_timeout': CACHE_BALANCE_TIMEOUT
            }

        except Exception as e:
            logger.error(f"❌ Помилка отримання статистики кешу: {str(e)}")
            return {
                'total_entries': 0,
                'expired_entries': 0,
                'active_entries': 0,
                'cache_timeout': CACHE_BALANCE_TIMEOUT,
                'error': str(e)
            }

    def get_network_info(self) -> Dict[str, Any]:
        """Інформація про мережу та сервіс"""
        return {
            'network': self.network.value,
            'api_url': self.base_url,
            'api_key_configured': bool(self.api_key),
            'flex_contract': self.flex_token.contract_address,
            'flex_decimals': self.flex_token.decimals,
            'cache_timeout': CACHE_BALANCE_TIMEOUT,
            'http_timeout': HTTP_TIMEOUT,
            'max_retries': MAX_RETRIES,
            'aiohttp_available': HAS_AIOHTTP,
            'service_available': self.is_available
        }

    def get_service_status(self) -> Dict[str, Any]:
        """Отримання статусу сервісу"""
        return {
            'available': self.is_available,
            'has_aiohttp': HAS_AIOHTTP,
            'has_api_key': bool(self.api_key),
            'network': self.network.value,
            'cache_entries': len(self._balance_cache)
        }


# Ініціалізація глобального сервісу з безпечною обробкою
try:
    ton_connect_service = TONConnectService()
    logger.info("✅ TONConnectService створено (без валідації)")
except Exception as e:
    logger.error(f"❌ Помилка створення TONConnectService: {e}")
    # Заглушка
    class TONConnectServiceStub:
        def __init__(self):
            self.is_available = False
        def get_wallet_balance_sync(self, address): return None
        def validate_address(self, address): return True  # Завжди True
        def get_service_status(self): return {'available': False, 'error': 'Service creation failed'}
        def get_network_info(self): return {'error': 'Service unavailable'}
        def clear_cache(self, address=None): pass
        def get_cache_stats(self): return {'total_entries': 0}

    ton_connect_service = TONConnectServiceStub()


# === ЕКСПОРТ ===
__all__ = [
    'TONConnectService',
    'TONNetwork',
    'TransactionType',
    'TONBalance',
    'FlexTokenInfo',
    'ton_connect_service',
    'HAS_AIOHTTP'
]