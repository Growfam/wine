"""
Модель гаманця для системи завдань WINIX
Управління TON гаманцями користувачів
ВИПРАВЛЕНА ВЕРСІЯ - покращена валідація адрес
"""
import logging
import re
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional
from dataclasses import dataclass
from enum import Enum

# Налаштування логування
logger = logging.getLogger(__name__)

# Імпорт клієнта Supabase
try:
    from supabase_client import supabase, cached, retry_supabase, invalidate_cache_for_entity
except ImportError:
    try:
        from backend.supabase_client import supabase, cached, retry_supabase, invalidate_cache_for_entity
    except ImportError:
        logger.error("Не вдалося імпортувати supabase_client")
        supabase = None

        # Fallback функції для уникнення NameError
        def cached(timeout=300):
            """Fallback декоратор для кешування"""
            def decorator(func):
                def wrapper(*args, **kwargs):
                    return func(*args, **kwargs)
                return wrapper
            return decorator

        def retry_supabase(func, max_retries=3):
            """Fallback функція для retry"""
            try:
                return func()
            except Exception as e:
                logger.error(f"Помилка виконання функції: {e}")
                return None

        def invalidate_cache_for_entity(entity_id):
            """Fallback функція для інвалідації кешу"""
            logger.debug(f"Кеш інвалідовано для {entity_id} (fallback)")
            pass


class WalletStatus(Enum):
    """Статуси гаманця"""
    DISCONNECTED = "disconnected"
    CONNECTED = "connected"
    VERIFIED = "verified"
    SUSPENDED = "suspended"


class WalletProvider(Enum):
    """Провайдери гаманців"""
    TONKEEPER = "tonkeeper"
    TONHUB = "tonhub"
    OPENMASK = "openmask"
    MYTONWALLET = "mytonwallet"
    TONWALLET = "tonwallet"
    OTHER = "other"


@dataclass
class WalletConnectionBonus:
    """Дані про бонус за підключення гаманця"""
    winix_amount: int = 100
    tickets_amount: int = 5
    description: str = "Бонус за перше підключення TON гаманця"
    one_time_only: bool = True


class WalletModel:
    """Модель для управління TON гаманцями"""

    # Константи
    TABLE_NAME = "wallets"
    CONNECTION_BONUS = WalletConnectionBonus()

    # Валідація адрес TON
    TON_ADDRESS_LENGTH = 48
    TON_MAINNET_CHAIN = "-239"
    TON_TESTNET_CHAIN = "-3"

    def __init__(self):
        """Ініціалізація моделі гаманця"""
        if not supabase:
            logger.error("❌ Supabase клієнт не ініціалізовано")
            raise RuntimeError("Supabase not initialized")

        logger.info("✅ WalletModel ініціалізовано")

    @staticmethod
    def validate_ton_address(address: str) -> bool:
        """
        Валідація TON адреси - ВИПРАВЛЕНА версія з детальним логуванням
        Підтримує всі формати TON адрес
        """
        try:
            # Перевірка на None/пусту адресу
            if not address or not isinstance(address, str):
                logger.error(f"Адреса None або не string: {address}")
                return False

            # Очищаємо пробіли
            address = address.strip()

            if not address:
                logger.error("Адреса порожня після очищення пробілів")
                return False

            logger.info(f"Валідація адреси: '{address}', довжина: {len(address)}, тип: {type(address)}")

            # 1. User-friendly формат (48 символів з префіксом EQ/UQ)
            if len(address) == 48 and (address.startswith('EQ') or address.startswith('UQ')):
                # Перевіряємо що решта символів - це base64url
                remaining = address[2:]  # Без префікса
                is_valid = bool(re.match(r'^[A-Za-z0-9_-]+$', remaining))
                logger.info(f"User-friendly формат (EQ/UQ): валідний={is_valid}")
                return is_valid

            # 2. Raw format (workchain:hex)
            if ':' in address:
                parts = address.split(':', 1)  # Розділяємо тільки по першому :
                if len(parts) == 2:
                    workchain = parts[0]
                    hex_part = parts[1]
                    is_valid = workchain in ['-1', '0'] and bool(re.match(r'^[0-9a-fA-F]{64}$', hex_part))
                    logger.info(f"Raw формат (workchain:hex): workchain={workchain}, hex_valid={is_valid}")
                    return is_valid

            # 3. Hex only (64 символи)
            if len(address) == 64 and re.match(r'^[0-9a-fA-F]+$', address):
                logger.info("Hex-only формат (64 символи): валідний=True")
                return True

            # 4. Додаткова перевірка для нестандартних форматів
            # Деякі гаманці можуть використовувати інші довжини
            if len(address) >= 40 and re.match(r'^[A-Za-z0-9_-]+$', address):
                logger.warning(f"Нестандартний формат адреси, але приймаємо: {len(address)} символів")
                return True

            logger.warning(f"Адреса не відповідає жодному відомому формату: '{address}'")
            return False

        except Exception as e:
            logger.error(f"Помилка валідації адреси '{address}': {str(e)}", exc_info=True)
            return False

    @staticmethod
    def normalize_provider(provider: str) -> str:
        """
        Нормалізація назви провайдера гаманця

        Args:
            provider: Назва провайдера

        Returns:
            Нормалізована назва
        """
        if not provider:
            return WalletProvider.OTHER.value

        provider_lower = provider.lower()

        # Маппінг популярних провайдерів
        provider_mapping = {
            'tonkeeper': WalletProvider.TONKEEPER.value,
            'tonhub': WalletProvider.TONHUB.value,
            'openmask': WalletProvider.OPENMASK.value,
            'mytonwallet': WalletProvider.MYTONWALLET.value,
            'tonwallet': WalletProvider.TONWALLET.value,
            'ton wallet': WalletProvider.TONWALLET.value,
            'my ton wallet': WalletProvider.MYTONWALLET.value,
        }

        return provider_mapping.get(provider_lower, WalletProvider.OTHER.value)

    @cached(timeout=300)
    def get_user_wallet(self, telegram_id: str) -> Optional[Dict[str, Any]]:
        """
        Отримання гаманця користувача

        Args:
            telegram_id: ID користувача в Telegram

        Returns:
            Дані гаманця або None
        """
        try:
            telegram_id = str(telegram_id)
            logger.info(f"Отримання гаманця для користувача {telegram_id}")

            def fetch_wallet():
                response = supabase.table(self.TABLE_NAME) \
                    .select("*") \
                    .eq("telegram_id", telegram_id) \
                    .eq("status", WalletStatus.CONNECTED.value) \
                    .order("connected_at", desc=True) \
                    .limit(1) \
                    .execute()

                if response.data:
                    wallet = response.data[0]
                    logger.info(f"Знайдено гаманець для {telegram_id}: {wallet['address']}")
                    return wallet

                logger.info(f"Гаманець для користувача {telegram_id} не знайдено")
                return None

            return retry_supabase(fetch_wallet)

        except Exception as e:
            logger.error(f"Помилка отримання гаманця для {telegram_id}: {str(e)}")
            return None

    def connect_wallet(self, telegram_id: str, wallet_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Підключення гаманця користувача

        Args:
            telegram_id: ID користувача в Telegram
            wallet_data: Дані гаманця

        Returns:
            Результат підключення
        """
        try:
            telegram_id = str(telegram_id)
            logger.info(f"Підключення гаманця для користувача {telegram_id}")
            logger.debug(f"Дані гаманця: {wallet_data}")

            # Валідація вхідних даних
            validation_result = self._validate_wallet_data(wallet_data)
            if not validation_result['valid']:
                return {
                    'success': False,
                    'message': f"Невалідні дані гаманця: {validation_result['error']}",
                    'error_code': 'INVALID_WALLET_DATA'
                }

            address = wallet_data['address']

            # Перевіряємо чи гаманець вже підключений до іншого користувача
            existing_wallet = self._get_wallet_by_address(address)
            if existing_wallet and existing_wallet['telegram_id'] != telegram_id:
                logger.warning(f"Гаманець {address} вже підключений до користувача {existing_wallet['telegram_id']}")
                return {
                    'success': False,
                    'message': 'Цей гаманець вже підключений до іншого акаунта',
                    'error_code': 'WALLET_ALREADY_CONNECTED'
                }

            # Перевіряємо чи у користувача вже є підключений гаманець
            current_wallet = self.get_user_wallet(telegram_id)
            is_first_connection = current_wallet is None

            # Відключаємо попередній гаманець якщо є
            if current_wallet:
                self._disconnect_wallet_internal(telegram_id, current_wallet['id'])

            # Підключаємо новий гаманець
            now = datetime.now(timezone.utc)

            wallet_record = {
                'telegram_id': telegram_id,
                'address': address,
                'chain_id': wallet_data.get('chain', self.TON_MAINNET_CHAIN),
                'public_key': wallet_data.get('publicKey'),
                'provider': self.normalize_provider(wallet_data.get('provider', '')),
                'status': WalletStatus.CONNECTED.value,
                'connected_at': now.isoformat(),
                'last_activity': now.isoformat(),
                'metadata': {
                    'connection_timestamp': wallet_data.get('timestamp', int(now.timestamp())),
                    'user_agent': wallet_data.get('userAgent', ''),
                    'ip_address': wallet_data.get('ipAddress', ''),
                    'app_version': wallet_data.get('appVersion', '')
                },
                'created_at': now.isoformat(),
                'updated_at': now.isoformat()
            }

            def create_wallet():
                response = supabase.table(self.TABLE_NAME) \
                    .insert(wallet_record) \
                    .execute()

                if response.data:
                    return response.data[0]
                raise Exception("Не вдалося створити запис гаманця")

            created_wallet = retry_supabase(create_wallet)

            # Інвалідуємо кеш
            invalidate_cache_for_entity(telegram_id)

            logger.info(f"Гаманець успішно підключено: {address} для користувача {telegram_id}")

            result = {
                'success': True,
                'message': 'Гаманець успішно підключено',
                'wallet': created_wallet,
                'first_connection': is_first_connection
            }

            # Нараховуємо бонус за перше підключення
            if is_first_connection:
                bonus_result = self._award_connection_bonus(telegram_id)
                if bonus_result['success']:
                    result['bonus'] = bonus_result['bonus']
                    result['message'] += f". Нарахований бонус: {bonus_result['bonus']['winix']} WINIX та {bonus_result['bonus']['tickets']} tickets"

            # Логуємо подію
            self._log_wallet_event(telegram_id, 'connect', {
                'address': address,
                'provider': wallet_record['provider'],
                'first_connection': is_first_connection
            })

            return result

        except Exception as e:
            logger.error(f"Помилка підключення гаманця для {telegram_id}: {str(e)}")
            return {
                'success': False,
                'message': 'Внутрішня помилка сервера',
                'error_code': 'INTERNAL_ERROR'
            }

    def disconnect_wallet(self, telegram_id: str) -> Dict[str, Any]:
        """
        Відключення гаманця користувача

        Args:
            telegram_id: ID користувача в Telegram

        Returns:
            Результат відключення
        """
        try:
            telegram_id = str(telegram_id)
            logger.info(f"Відключення гаманця для користувача {telegram_id}")

            # Знаходимо активний гаманець
            current_wallet = self.get_user_wallet(telegram_id)
            if not current_wallet:
                return {
                    'success': False,
                    'message': 'Гаманець не знайдено',
                    'error_code': 'WALLET_NOT_FOUND'
                }

            # Відключаємо гаманець
            disconnect_result = self._disconnect_wallet_internal(telegram_id, current_wallet['id'])

            if disconnect_result:
                # Інвалідуємо кеш
                invalidate_cache_for_entity(telegram_id)

                # Логуємо подію
                self._log_wallet_event(telegram_id, 'disconnect', {
                    'address': current_wallet['address'],
                    'provider': current_wallet['provider']
                })

                logger.info(f"Гаманець успішно відключено для користувача {telegram_id}")

                return {
                    'success': True,
                    'message': 'Гаманець успішно відключено'
                }
            else:
                return {
                    'success': False,
                    'message': 'Помилка відключення гаманця',
                    'error_code': 'DISCONNECT_FAILED'
                }

        except Exception as e:
            logger.error(f"Помилка відключення гаманця для {telegram_id}: {str(e)}")
            return {
                'success': False,
                'message': 'Внутрішня помилка сервера',
                'error_code': 'INTERNAL_ERROR'
            }

    def verify_wallet(self, telegram_id: str, verification_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Верифікація гаманця користувача

        Args:
            telegram_id: ID користувача в Telegram
            verification_data: Дані для верифікації

        Returns:
            Результат верифікації
        """
        try:
            telegram_id = str(telegram_id)
            logger.info(f"Верифікація гаманця для користувача {telegram_id}")

            # Знаходимо гаманець
            wallet = self.get_user_wallet(telegram_id)
            if not wallet:
                return {
                    'success': False,
                    'message': 'Гаманець не знайдено',
                    'error_code': 'WALLET_NOT_FOUND'
                }

            # Оновлюємо статус на верифікований
            now = datetime.now(timezone.utc)

            def update_verification():
                response = supabase.table(self.TABLE_NAME) \
                    .update({
                        'status': WalletStatus.VERIFIED.value,
                        'verified_at': now.isoformat(),
                        'verification_data': verification_data,
                        'updated_at': now.isoformat()
                    }) \
                    .eq('id', wallet['id']) \
                    .execute()

                return response.data[0] if response.data else None

            updated_wallet = retry_supabase(update_verification)

            if updated_wallet:
                # Інвалідуємо кеш
                invalidate_cache_for_entity(telegram_id)

                # Логуємо подію
                self._log_wallet_event(telegram_id, 'verify', {
                    'address': wallet['address'],
                    'verification_type': verification_data.get('type', 'standard')
                })

                logger.info(f"Гаманець успішно верифіковано для користувача {telegram_id}")

                return {
                    'success': True,
                    'message': 'Гаманець успішно верифіковано',
                    'wallet': updated_wallet
                }
            else:
                return {
                    'success': False,
                    'message': 'Помилка оновлення статусу',
                    'error_code': 'UPDATE_FAILED'
                }

        except Exception as e:
            logger.error(f"Помилка верифікації гаманця для {telegram_id}: {str(e)}")
            return {
                'success': False,
                'message': 'Внутрішня помилка сервера',
                'error_code': 'INTERNAL_ERROR'
            }

    def get_wallet_status(self, telegram_id: str) -> Dict[str, Any]:
        """
        Отримання статусу гаманця користувача

        Args:
            telegram_id: ID користувача в Telegram

        Returns:
            Статус гаманця
        """
        try:
            telegram_id = str(telegram_id)
            wallet = self.get_user_wallet(telegram_id)

            if wallet:
                # Оновлюємо час останньої активності
                self._update_last_activity(wallet['id'])

                return {
                    'connected': True,
                    'address': wallet['address'],
                    'provider': wallet['provider'],
                    'status': wallet['status'],
                    'connected_at': wallet['connected_at'],
                    'verified': wallet['status'] == WalletStatus.VERIFIED.value
                }
            else:
                return {
                    'connected': False,
                    'address': None,
                    'provider': None,
                    'status': WalletStatus.DISCONNECTED.value,
                    'verified': False
                }

        except Exception as e:
            logger.error(f"Помилка отримання статусу гаманця для {telegram_id}: {str(e)}")
            return {
                'connected': False,
                'address': None,
                'provider': None,
                'status': WalletStatus.DISCONNECTED.value,
                'verified': False,
                'error': str(e)
            }

    @cached(timeout=600)
    def get_wallet_statistics(self) -> Dict[str, Any]:
        """
        Отримання статистики гаманців

        Returns:
            Статистика
        """
        try:
            logger.info("Отримання статистики гаманців")

            def fetch_stats():
                # Загальна кількість підключених гаманців
                total_response = supabase.table(self.TABLE_NAME) \
                    .select("id", count="exact") \
                    .eq("status", WalletStatus.CONNECTED.value) \
                    .execute()

                total_connected = total_response.count if total_response.count is not None else 0

                # Статистика по провайдерах
                providers_response = supabase.table(self.TABLE_NAME) \
                    .select("provider", count="exact") \
                    .eq("status", WalletStatus.CONNECTED.value) \
                    .execute()

                # Підрахунок по провайдерах
                provider_stats = {}
                if providers_response.data:
                    for row in providers_response.data:
                        provider = row.get('provider', 'unknown')
                        provider_stats[provider] = provider_stats.get(provider, 0) + 1

                # Активність за останній тиждень
                week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
                active_response = supabase.table(self.TABLE_NAME) \
                    .select("id", count="exact") \
                    .eq("status", WalletStatus.CONNECTED.value) \
                    .gte("last_activity", week_ago) \
                    .execute()

                active_week = active_response.count if active_response.count is not None else 0

                return {
                    'total_connected': total_connected,
                    'active_week': active_week,
                    'providers': provider_stats,
                    'activity_rate': (active_week / total_connected * 100) if total_connected > 0 else 0
                }

            return retry_supabase(fetch_stats)

        except Exception as e:
            logger.error(f"Помилка отримання статистики гаманців: {str(e)}")
            return {
                'total_connected': 0,
                'active_week': 0,
                'providers': {},
                'activity_rate': 0,
                'error': str(e)
            }

    def _validate_wallet_data(self, wallet_data: Dict[str, Any]) -> Dict[str, Any]:
        """Валідація даних гаманця з покращеним логуванням"""
        try:
            # Перевіряємо обов'язкові поля
            if not wallet_data.get('address'):
                return {'valid': False, 'error': 'Адреса гаманця відсутня'}

            address = str(wallet_data['address']).strip()
            logger.info(f"Валідація адреси: '{address}', довжина: {len(address)}, тип: {type(address)}")

            # Валідуємо адресу
            if not self.validate_ton_address(address):
                logger.error(f"Адреса не пройшла валідацію: '{address}'")
                return {'valid': False, 'error': f'Невалідна адреса TON гаманця: {address}'}

            # Перевіряємо chain_id
            chain_id = str(wallet_data.get('chain', self.TON_MAINNET_CHAIN))
            if chain_id not in [self.TON_MAINNET_CHAIN, self.TON_TESTNET_CHAIN]:
                logger.warning(f"Невідомий chain ID: {chain_id}, використовуємо mainnet")
                # Не блокуємо, просто використовуємо mainnet за замовчуванням

            logger.info(f"✅ Адреса {address} успішно пройшла валідацію")
            return {'valid': True}

        except Exception as e:
            logger.error(f"Помилка валідації даних гаманця: {str(e)}")
            return {'valid': False, 'error': 'Помилка валідації'}

    def _get_wallet_by_address(self, address: str) -> Optional[Dict[str, Any]]:
        """Отримання гаманця за адресою"""
        try:
            def fetch_by_address():
                response = supabase.table(self.TABLE_NAME) \
                    .select("*") \
                    .eq("address", address) \
                    .eq("status", WalletStatus.CONNECTED.value) \
                    .limit(1) \
                    .execute()

                return response.data[0] if response.data else None

            return retry_supabase(fetch_by_address)

        except Exception as e:
            logger.error(f"Помилка пошуку гаманця за адресою {address}: {str(e)}")
            return None

    def _disconnect_wallet_internal(self, telegram_id: str, wallet_id: str) -> bool:
        """Внутрішня функція відключення гаманця"""
        try:
            now = datetime.now(timezone.utc)

            def disconnect_internal():
                response = supabase.table(self.TABLE_NAME) \
                    .update({
                        'status': WalletStatus.DISCONNECTED.value,
                        'disconnected_at': now.isoformat(),
                        'updated_at': now.isoformat()
                    }) \
                    .eq('id', wallet_id) \
                    .eq('telegram_id', telegram_id) \
                    .execute()

                return bool(response.data)

            return retry_supabase(disconnect_internal)

        except Exception as e:
            logger.error(f"Помилка відключення гаманця {wallet_id}: {str(e)}")
            return False

    def _award_connection_bonus(self, telegram_id: str) -> Dict[str, Any]:
        """Нарахування бонусу за підключення гаманця"""
        try:
            # Перевіряємо чи користувач вже отримував бонус
            existing_bonus = self._check_existing_connection_bonus(telegram_id)
            if existing_bonus:
                return {
                    'success': False,
                    'message': 'Бонус за підключення вже нарахований'
                }

            # Імпортуємо функції роботи з балансом
            try:
                from supabase_client import update_balance
            except ImportError:
                from backend.supabase_client import update_balance

            # Нараховуємо WINIX
            balance_result = update_balance(telegram_id, self.CONNECTION_BONUS.winix_amount)
            if not balance_result:
                raise Exception("Не вдалося нарахувати WINIX бонус")

            # Нараховуємо tickets (тут потрібна функція для роботи з tickets)
            # Поки що просто логуємо
            logger.info(f"Нарахування {self.CONNECTION_BONUS.tickets_amount} tickets для {telegram_id}")

            # Створюємо запис про бонус
            self._create_connection_bonus_record(telegram_id)

            return {
                'success': True,
                'bonus': {
                    'winix': self.CONNECTION_BONUS.winix_amount,
                    'tickets': self.CONNECTION_BONUS.tickets_amount,
                    'description': self.CONNECTION_BONUS.description
                }
            }

        except Exception as e:
            logger.error(f"Помилка нарахування бонусу для {telegram_id}: {str(e)}")
            return {
                'success': False,
                'message': 'Помилка нарахування бонусу'
            }

    def _check_existing_connection_bonus(self, telegram_id: str) -> bool:
        """Перевірка чи користувач вже отримував бонус за підключення"""
        try:
            def check_bonus():
                response = supabase.table("wallet_connection_bonuses") \
                    .select("id") \
                    .eq("telegram_id", telegram_id) \
                    .limit(1) \
                    .execute()

                return bool(response.data)

            return retry_supabase(check_bonus)

        except Exception as e:
            logger.error(f"Помилка перевірки бонусу для {telegram_id}: {str(e)}")
            return False

    def _create_connection_bonus_record(self, telegram_id: str) -> bool:
        """Створення запису про бонус за підключення"""
        try:
            now = datetime.now(timezone.utc)

            bonus_record = {
                'telegram_id': telegram_id,
                'winix_amount': self.CONNECTION_BONUS.winix_amount,
                'tickets_amount': self.CONNECTION_BONUS.tickets_amount,
                'description': self.CONNECTION_BONUS.description,
                'awarded_at': now.isoformat(),
                'created_at': now.isoformat()
            }

            def create_bonus():
                response = supabase.table("wallet_connection_bonuses") \
                    .insert(bonus_record) \
                    .execute()

                return bool(response.data)

            return retry_supabase(create_bonus)

        except Exception as e:
            logger.error(f"Помилка створення запису бонусу для {telegram_id}: {str(e)}")
            return False

    def _update_last_activity(self, wallet_id: str) -> bool:
        """Оновлення часу останньої активності"""
        try:
            now = datetime.now(timezone.utc)

            def update_activity():
                response = supabase.table(self.TABLE_NAME) \
                    .update({'last_activity': now.isoformat()}) \
                    .eq('id', wallet_id) \
                    .execute()

                return bool(response.data)

            return retry_supabase(update_activity)

        except Exception as e:
            logger.error(f"Помилка оновлення активності гаманця {wallet_id}: {str(e)}")
            return False

    def _log_wallet_event(self, telegram_id: str, event_type: str, event_data: Dict[str, Any]) -> None:
        """Логування подій гаманця"""
        try:
            now = datetime.now(timezone.utc)

            event_record = {
                'telegram_id': telegram_id,
                'event_type': event_type,
                'event_data': event_data,
                'timestamp': now.isoformat(),
                'created_at': now.isoformat()
            }

            def log_event():
                supabase.table("wallet_events") \
                    .insert(event_record) \
                    .execute()

            retry_supabase(log_event)
            logger.info(f"Подія гаманця зареєстрована: {event_type} для {telegram_id}")

        except Exception as e:
            logger.error(f"Помилка логування події гаманця: {str(e)}")


# Ініціалізація моделі
wallet_model = WalletModel()

# Експорт
__all__ = [
    'WalletModel',
    'WalletStatus',
    'WalletProvider',
    'WalletConnectionBonus',
    'wallet_model'
]