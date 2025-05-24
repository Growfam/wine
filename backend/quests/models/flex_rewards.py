"""
Модель для управління системою FLEX токенів та винагород
Щоденні винагороди за рівнями FLEX токенів
"""
import logging
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional
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


        # Fallback функції
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


class FlexLevel(Enum):
    """Рівні FLEX токенів"""
    BRONZE = "bronze"
    SILVER = "silver"
    GOLD = "gold"
    PLATINUM = "platinum"
    DIAMOND = "diamond"


class RewardStatus(Enum):
    """Статуси винагород"""
    AVAILABLE = "available"
    CLAIMED = "claimed"
    EXPIRED = "expired"
    LOCKED = "locked"


@dataclass
class FlexRewardConfig:
    """Конфігурація винагороди за рівень FLEX"""
    level: FlexLevel
    required_flex: int
    winix_reward: int
    tickets_reward: int
    name: str
    description: str
    icon: str
    color: str


@dataclass
class UserFlexStatus:
    """Статус користувача по FLEX токенах"""
    telegram_id: str
    current_flex_balance: int
    available_levels: List[FlexLevel]
    claimed_today: Dict[FlexLevel, bool]
    last_claim_times: Dict[FlexLevel, datetime]
    total_claimed_winix: int
    total_claimed_tickets: int
    last_updated: datetime


class FlexRewardsModel:
    """Модель для управління FLEX винагородами"""

    # Таблиці бази даних
    TABLE_FLEX_CLAIMS = "flex_claims"
    TABLE_FLEX_BALANCES = "flex_balances"
    TABLE_FLEX_LEVELS = "flex_levels"

    # Конфігурація рівнів FLEX
    FLEX_LEVELS_CONFIG = {
        FlexLevel.BRONZE: FlexRewardConfig(
            level=FlexLevel.BRONZE,
            required_flex=10_000,
            winix_reward=25,
            tickets_reward=1,
            name="Bronze",
            description="Базовий рівень для початківців",
            icon="🥉",
            color="#CD7F32"
        ),
        FlexLevel.SILVER: FlexRewardConfig(
            level=FlexLevel.SILVER,
            required_flex=50_000,
            winix_reward=75,
            tickets_reward=2,
            name="Silver",
            description="Срібний рівень для активних користувачів",
            icon="🥈",
            color="#C0C0C0"
        ),
        FlexLevel.GOLD: FlexRewardConfig(
            level=FlexLevel.GOLD,
            required_flex=100_000,
            winix_reward=150,
            tickets_reward=4,
            name="Gold",
            description="Золотий рівень для досвідчених",
            icon="🥇",
            color="#FFD700"
        ),
        FlexLevel.PLATINUM: FlexRewardConfig(
            level=FlexLevel.PLATINUM,
            required_flex=250_000,
            winix_reward=300,
            tickets_reward=8,
            name="Platinum",
            description="Платиновий рівень для експертів",
            icon="💎",
            color="#E5E4E2"
        ),
        FlexLevel.DIAMOND: FlexRewardConfig(
            level=FlexLevel.DIAMOND,
            required_flex=500_000,
            winix_reward=500,
            tickets_reward=15,
            name="Diamond",
            description="Діамантовий рівень для еліти",
            icon="💠",
            color="#B9F2FF"
        )
    }

    # Часові обмеження
    CLAIM_COOLDOWN_HOURS = 24  # Можна отримувати раз на добу
    BALANCE_CACHE_MINUTES = 5  # Кеш балансу на 5 хвилин

    def __init__(self):
        """Ініціалізація моделі FLEX винагород"""
        if not supabase:
            logger.error("❌ Supabase клієнт не ініціалізовано")
            raise RuntimeError("Supabase not initialized")

        logger.info("✅ FlexRewardsModel ініціалізовано")
        logger.info(f"📊 Конфігурація рівнів: {len(self.FLEX_LEVELS_CONFIG)} рівнів")

    @cached(timeout=300)  # Кеш на 5 хвилин
    def get_user_flex_balance(self, telegram_id: str, wallet_address: str = None) -> int:
        """
        Отримання балансу FLEX токенів користувача

        Args:
            telegram_id: ID користувача в Telegram
            wallet_address: Адреса гаманця (опціонально)

        Returns:
            Баланс FLEX токенів
        """
        try:
            telegram_id = str(telegram_id)
            logger.info(f"Отримання балансу FLEX для користувача {telegram_id}")

            # Спочатку перевіряємо збережений баланс
            def fetch_saved_balance():
                response = supabase.table(self.TABLE_FLEX_BALANCES) \
                    .select("flex_balance, last_updated") \
                    .eq("telegram_id", telegram_id) \
                    .order("last_updated", desc=True) \
                    .limit(1) \
                    .execute()

                if response.data:
                    balance_data = response.data[0]
                    last_updated = datetime.fromisoformat(balance_data['last_updated'].replace('Z', '+00:00'))

                    # Перевіряємо чи баланс не застарів
                    age_minutes = (datetime.now(timezone.utc) - last_updated).total_seconds() / 60

                    if age_minutes < self.BALANCE_CACHE_MINUTES:
                        logger.debug(
                            f"Використовуємо збережений баланс FLEX для {telegram_id}: {balance_data['flex_balance']}")
                        return balance_data['flex_balance']

                return None

            saved_balance = retry_supabase(fetch_saved_balance)
            if saved_balance is not None:
                return saved_balance

            # Якщо немає збереженого балансу або він застарів, отримуємо через TON API
            flex_balance = self._fetch_flex_balance_from_ton(telegram_id, wallet_address)

            # Зберігаємо оновлений баланс
            self._save_flex_balance(telegram_id, flex_balance, wallet_address)

            return flex_balance

        except Exception as e:
            logger.error(f"Помилка отримання балансу FLEX для {telegram_id}: {str(e)}")
            return 0

    def _fetch_flex_balance_from_ton(self, telegram_id: str, wallet_address: str = None) -> int:
        """Отримання балансу FLEX через TON API"""
        try:
            # Якщо адреса не вказана, отримуємо з підключеного гаманця
            if not wallet_address:
                wallet_address = self._get_user_wallet_address(telegram_id)
                if not wallet_address:
                    logger.warning(f"Адреса гаманця не знайдена для {telegram_id}")
                    return 0

            # Імпортуємо TON Connect сервіс
            try:
                from quests.services.ton_connect_service import ton_connect_service
            except ImportError:
                from backend.quests.services.ton_connect_service import ton_connect_service

            # Отримуємо баланс
            balance_info = ton_connect_service.get_wallet_balance_sync(wallet_address, force_refresh=True)

            if balance_info:
                logger.info(f"FLEX баланс отримано з TON для {telegram_id}: {balance_info.flex_balance:,}")
                return balance_info.flex_balance
            else:
                logger.warning(f"Не вдалося отримати баланс з TON для {telegram_id}")
                return 0

        except Exception as e:
            logger.error(f"Помилка отримання FLEX з TON для {telegram_id}: {str(e)}")
            return 0

    def _get_user_wallet_address(self, telegram_id: str) -> Optional[str]:
        """Отримання адреси гаманця користувача"""
        try:
            from quests.models.wallet import wallet_model
            wallet = wallet_model.get_user_wallet(telegram_id)
            return wallet['address'] if wallet else None
        except ImportError:
            logger.error("Не вдалося імпортувати модель гаманця")
            return None

    def _save_flex_balance(self, telegram_id: str, flex_balance: int, wallet_address: str = None) -> bool:
        """Збереження балансу FLEX в базі даних"""
        try:
            now = datetime.now(timezone.utc)

            balance_record = {
                'telegram_id': telegram_id,
                'flex_balance': flex_balance,
                'wallet_address': wallet_address,
                'last_updated': now.isoformat(),
                'created_at': now.isoformat()
            }

            def save_balance():
                # Спочатку видаляємо старі записи
                supabase.table(self.TABLE_FLEX_BALANCES) \
                    .delete() \
                    .eq("telegram_id", telegram_id) \
                    .execute()

                # Вставляємо новий запис
                response = supabase.table(self.TABLE_FLEX_BALANCES) \
                    .insert(balance_record) \
                    .execute()

                return bool(response.data)

            success = retry_supabase(save_balance)

            if success:
                # Інвалідуємо кеш
                invalidate_cache_for_entity(telegram_id)
                logger.debug(f"Баланс FLEX збережено для {telegram_id}: {flex_balance:,}")

            return success

        except Exception as e:
            logger.error(f"Помилка збереження балансу FLEX для {telegram_id}: {str(e)}")
            return False

    def get_available_levels(self, telegram_id: str, flex_balance: int = None) -> Dict[FlexLevel, Dict[str, Any]]:
        """
        Отримання доступних рівнів для користувача

        Args:
            telegram_id: ID користувача в Telegram
            flex_balance: Баланс FLEX (якщо не вказано - отримується автоматично)

        Returns:
            Словник з доступними рівнями та їх статусами
        """
        try:
            telegram_id = str(telegram_id)

            # Отримуємо баланс якщо не вказано
            if flex_balance is None:
                flex_balance = self.get_user_flex_balance(telegram_id)

            logger.info(f"Перевірка доступних рівнів для {telegram_id} з балансом {flex_balance:,} FLEX")

            # Отримуємо інформацію про сьогоднішні отримання
            today_claims = self._get_today_claims(telegram_id)

            available_levels = {}

            for level, config in self.FLEX_LEVELS_CONFIG.items():
                has_enough_flex = flex_balance >= config.required_flex
                claimed_today = level in today_claims

                level_info = {
                    'config': {
                        'required_flex': config.required_flex,
                        'winix_reward': config.winix_reward,
                        'tickets_reward': config.tickets_reward,
                        'name': config.name,
                        'description': config.description,
                        'icon': config.icon,
                        'color': config.color
                    },
                    'status': {
                        'has_enough_flex': has_enough_flex,
                        'claimed_today': claimed_today,
                        'can_claim': has_enough_flex and not claimed_today,
                        'progress_percent': min((flex_balance / config.required_flex) * 100, 100),
                        'next_claim_available': self._get_next_claim_time(telegram_id, level) if claimed_today else None
                    }
                }

                available_levels[level] = level_info

                logger.debug(f"Рівень {level.value}: потрібно={config.required_flex:,}, "
                             f"є={flex_balance:,}, claimed_today={claimed_today}, can_claim={level_info['status']['can_claim']}")

            return available_levels

        except Exception as e:
            logger.error(f"Помилка отримання доступних рівнів для {telegram_id}: {str(e)}")
            return {}

    @cached(timeout=300)
    def _get_today_claims(self, telegram_id: str) -> List[FlexLevel]:
        """Отримання сьогоднішніх отримань користувача"""
        try:
            today = datetime.now(timezone.utc).date()
            today_start = datetime.combine(today, datetime.min.time()).replace(tzinfo=timezone.utc)
            today_end = today_start + timedelta(days=1)

            def fetch_claims():
                response = supabase.table(self.TABLE_FLEX_CLAIMS) \
                    .select("level") \
                    .eq("telegram_id", telegram_id) \
                    .gte("claimed_at", today_start.isoformat()) \
                    .lt("claimed_at", today_end.isoformat()) \
                    .execute()

                return [FlexLevel(claim['level']) for claim in response.data] if response.data else []

            return retry_supabase(fetch_claims)

        except Exception as e:
            logger.error(f"Помилка отримання сьогоднішніх claims для {telegram_id}: {str(e)}")
            return []

    def _get_next_claim_time(self, telegram_id: str, level: FlexLevel) -> Optional[datetime]:
        """Отримання часу наступного можливого отримання"""
        try:
            def fetch_last_claim():
                response = supabase.table(self.TABLE_FLEX_CLAIMS) \
                    .select("claimed_at") \
                    .eq("telegram_id", telegram_id) \
                    .eq("level", level.value) \
                    .order("claimed_at", desc=True) \
                    .limit(1) \
                    .execute()

                if response.data:
                    last_claim = datetime.fromisoformat(response.data[0]['claimed_at'].replace('Z', '+00:00'))
                    next_claim = last_claim + timedelta(hours=self.CLAIM_COOLDOWN_HOURS)
                    return next_claim

                return None

            return retry_supabase(fetch_last_claim)

        except Exception as e:
            logger.error(f"Помилка отримання часу наступного claim для {telegram_id}, {level}: {str(e)}")
            return None

    def claim_level_reward(self, telegram_id: str, level: FlexLevel) -> Dict[str, Any]:
        """
        Отримання винагороди за рівень FLEX

        Args:
            telegram_id: ID користувача в Telegram
            level: Рівень для отримання винагороди

        Returns:
            Результат отримання винагороди
        """
        try:
            telegram_id = str(telegram_id)
            logger.info(f"Отримання винагороди {level.value} для користувача {telegram_id}")

            # Перевіряємо конфігурацію рівня
            if level not in self.FLEX_LEVELS_CONFIG:
                return {
                    'success': False,
                    'message': f'Невідомий рівень: {level.value}',
                    'error_code': 'UNKNOWN_LEVEL'
                }

            config = self.FLEX_LEVELS_CONFIG[level]

            # Перевіряємо баланс FLEX
            flex_balance = self.get_user_flex_balance(telegram_id)

            if flex_balance < config.required_flex:
                return {
                    'success': False,
                    'message': f'Недостатньо FLEX токенів. Потрібно: {config.required_flex:,}, є: {flex_balance:,}',
                    'error_code': 'INSUFFICIENT_FLEX'
                }

            # Перевіряємо чи не отримував сьогодні
            today_claims = self._get_today_claims(telegram_id)

            if level in today_claims:
                next_claim_time = self._get_next_claim_time(telegram_id, level)
                return {
                    'success': False,
                    'message': 'Винагорода за цей рівень вже отримана сьогодні',
                    'error_code': 'ALREADY_CLAIMED_TODAY',
                    'next_claim_available': next_claim_time.isoformat() if next_claim_time else None
                }

            # Нараховуємо винагороду
            reward_result = self._award_level_reward(telegram_id, level, config)

            if reward_result['success']:
                # Створюємо запис про отримання
                claim_result = self._create_claim_record(telegram_id, level, config, flex_balance)

                if claim_result:
                    # Інвалідуємо кеш
                    invalidate_cache_for_entity(telegram_id)

                    logger.info(f"Винагорода {level.value} успішно нарахована користувачу {telegram_id}")

                    return {
                        'success': True,
                        'message': f'Винагорода {config.name} успішно отримана!',
                        'reward': {
                            'level': level.value,
                            'winix': config.winix_reward,
                            'tickets': config.tickets_reward,
                            'name': config.name,
                            'icon': config.icon
                        },
                        'next_claim_available': (
                                    datetime.now(timezone.utc) + timedelta(hours=self.CLAIM_COOLDOWN_HOURS)).isoformat()
                    }
                else:
                    return {
                        'success': False,
                        'message': 'Помилка створення запису про отримання',
                        'error_code': 'CLAIM_RECORD_FAILED'
                    }
            else:
                return reward_result

        except Exception as e:
            logger.error(f"Помилка отримання винагороди {level} для {telegram_id}: {str(e)}")
            return {
                'success': False,
                'message': 'Внутрішня помилка сервера',
                'error_code': 'INTERNAL_ERROR'
            }

    def _award_level_reward(self, telegram_id: str, level: FlexLevel, config: FlexRewardConfig) -> Dict[str, Any]:
        """Нарахування винагороди користувачу"""
        try:
            # Імпортуємо функції роботи з балансом з fallback
            try:
                from supabase_client import update_balance, update_coins
            except ImportError:
                try:
                    from backend.supabase_client import update_balance, update_coins
                except ImportError:
                    logger.error("Не вдалося імпортувати функції balance")

                    # Fallback функції
                    def update_balance(user_id: str, amount: int) -> bool:
                        logger.warning(f"Fallback: update_balance({user_id}, {amount})")
                        return True

                    def update_coins(user_id: str, amount: int) -> bool:
                        logger.warning(f"Fallback: update_coins({user_id}, {amount})")
                        return True

            # Нараховуємо WINIX
            winix_result = update_balance(telegram_id, config.winix_reward)
            if not winix_result:
                raise Exception("Не вдалося нарахувати WINIX")

            # Нараховуємо tickets (поки що через coins)
            tickets_result = update_coins(telegram_id, config.tickets_reward)
            if not tickets_result:
                logger.warning(f"Не вдалося нарахувати tickets для {telegram_id}")

            # Створюємо транзакцію
            self._create_reward_transaction(telegram_id, level, config)

            return {
                'success': True,
                'winix_awarded': config.winix_reward,
                'tickets_awarded': config.tickets_reward
            }

        except Exception as e:
            logger.error(f"Помилка нарахування винагороди для {telegram_id}: {str(e)}")
            return {
                'success': False,
                'message': f'Помилка нарахування винагороди: {str(e)}',
                'error_code': 'REWARD_FAILED'
            }

    def _create_claim_record(self, telegram_id: str, level: FlexLevel, config: FlexRewardConfig,
                             flex_balance: int) -> bool:
        """Створення запису про отримання винагороди"""
        try:
            now = datetime.now(timezone.utc)

            claim_record = {
                'telegram_id': telegram_id,
                'level': level.value,
                'flex_balance_at_claim': flex_balance,
                'winix_awarded': config.winix_reward,
                'tickets_awarded': config.tickets_reward,
                'claimed_at': now.isoformat(),
                'created_at': now.isoformat()
            }

            def create_claim():
                response = supabase.table(self.TABLE_FLEX_CLAIMS) \
                    .insert(claim_record) \
                    .execute()

                return bool(response.data)

            return retry_supabase(create_claim)

        except Exception as e:
            logger.error(f"Помилка створення запису claim для {telegram_id}: {str(e)}")
            return False

    def _create_reward_transaction(self, telegram_id: str, level: FlexLevel, config: FlexRewardConfig) -> None:
        """Створення транзакції для винагороди"""
        try:
            now = datetime.now(timezone.utc)

            transaction_record = {
                'telegram_id': telegram_id,
                'type': 'flex_reward',
                'amount': config.winix_reward,
                'description': f'Винагорода FLEX {config.name} ({config.winix_reward} WINIX + {config.tickets_reward} tickets)',
                'status': 'completed',
                'metadata': {
                    'flex_level': level.value,
                    'winix_amount': config.winix_reward,
                    'tickets_amount': config.tickets_reward,
                    'level_name': config.name
                },
                'created_at': now.isoformat(),
                'updated_at': now.isoformat()
            }

            def create_transaction():
                supabase.table("transactions") \
                    .insert(transaction_record) \
                    .execute()

            retry_supabase(create_transaction)
            logger.debug(f"Транзакція FLEX винагороди створена для {telegram_id}")

        except Exception as e:
            logger.error(f"Помилка створення транзакції FLEX для {telegram_id}: {str(e)}")

    @cached(timeout=600)  # Кеш на 10 хвилин
    def get_user_flex_history(self, telegram_id: str, limit: int = 50) -> List[Dict[str, Any]]:
        """
        Отримання історії отримань FLEX винагород

        Args:
            telegram_id: ID користувача в Telegram
            limit: Кількість записів

        Returns:
            Список історії отримань
        """
        try:
            telegram_id = str(telegram_id)

            def fetch_history():
                response = supabase.table(self.TABLE_FLEX_CLAIMS) \
                    .select("*") \
                    .eq("telegram_id", telegram_id) \
                    .order("claimed_at", desc=True) \
                    .limit(min(limit, 100)) \
                    .execute()

                if response.data:
                    # Обробляємо дані для відповіді
                    history = []
                    for claim in response.data:
                        level = FlexLevel(claim['level'])
                        config = self.FLEX_LEVELS_CONFIG.get(level)

                        history_item = {
                            'id': claim['id'],
                            'level': claim['level'],
                            'level_name': config.name if config else claim['level'],
                            'level_icon': config.icon if config else '🎁',
                            'flex_balance_at_claim': claim['flex_balance_at_claim'],
                            'winix_awarded': claim['winix_awarded'],
                            'tickets_awarded': claim['tickets_awarded'],
                            'claimed_at': claim['claimed_at'],
                            'days_ago': (datetime.now(timezone.utc) -
                                         datetime.fromisoformat(claim['claimed_at'].replace('Z', '+00:00'))).days
                        }
                        history.append(history_item)

                    return history

                return []

            return retry_supabase(fetch_history)

        except Exception as e:
            logger.error(f"Помилка отримання історії FLEX для {telegram_id}: {str(e)}")
            return []

    @cached(timeout=1800)  # Кеш на 30 хвилин
    def get_flex_statistics(self) -> Dict[str, Any]:
        """
        Отримання загальної статистики FLEX системи

        Returns:
            Статистика FLEX винагород
        """
        try:
            logger.info("Отримання статистики FLEX системи")

            def fetch_stats():
                # Загальна кількість отримань
                total_claims_response = supabase.table(self.TABLE_FLEX_CLAIMS) \
                    .select("id", count="exact") \
                    .execute()

                total_claims = total_claims_response.count if total_claims_response.count else 0

                # Статистика по рівнях
                levels_response = supabase.table(self.TABLE_FLEX_CLAIMS) \
                    .select("level", count="exact") \
                    .execute()

                level_stats = {}
                if levels_response.data:
                    for claim in levels_response.data:
                        level = claim['level']
                        level_stats[level] = level_stats.get(level, 0) + 1

                # Отримання за останній тиждень
                week_ago = (datetime.now(timezone.utc) - timedelta(days=7)).isoformat()
                week_claims_response = supabase.table(self.TABLE_FLEX_CLAIMS) \
                    .select("id", count="exact") \
                    .gte("claimed_at", week_ago) \
                    .execute()

                week_claims = week_claims_response.count if week_claims_response.count else 0

                # Сума нарахованих винагород
                rewards_response = supabase.table(self.TABLE_FLEX_CLAIMS) \
                    .select("winix_awarded, tickets_awarded") \
                    .execute()

                total_winix = 0
                total_tickets = 0
                if rewards_response.data:
                    for reward in rewards_response.data:
                        total_winix += reward.get('winix_awarded', 0)
                        total_tickets += reward.get('tickets_awarded', 0)

                # Унікальні користувачі
                users_response = supabase.table(self.TABLE_FLEX_CLAIMS) \
                    .select("telegram_id") \
                    .execute()

                unique_users = len(
                    set(claim['telegram_id'] for claim in users_response.data)) if users_response.data else 0

                return {
                    'total_claims': total_claims,
                    'unique_users': unique_users,
                    'claims_this_week': week_claims,
                    'level_distribution': level_stats,
                    'total_rewards': {
                        'winix': total_winix,
                        'tickets': total_tickets
                    },
                    'average_claims_per_user': round(total_claims / unique_users, 2) if unique_users > 0 else 0,
                    'levels_config': {
                        level.value: {
                            'required_flex': config.required_flex,
                            'winix_reward': config.winix_reward,
                            'tickets_reward': config.tickets_reward,
                            'name': config.name
                        }
                        for level, config in self.FLEX_LEVELS_CONFIG.items()
                    }
                }

            return retry_supabase(fetch_stats)

        except Exception as e:
            logger.error(f"Помилка отримання статистики FLEX: {str(e)}")
            return {
                'total_claims': 0,
                'unique_users': 0,
                'claims_this_week': 0,
                'level_distribution': {},
                'total_rewards': {'winix': 0, 'tickets': 0},
                'average_claims_per_user': 0,
                'levels_config': {},
                'error': str(e)
            }

    def get_user_flex_status(self, telegram_id: str) -> UserFlexStatus:
        """Отримання повного статусу користувача по FLEX"""
        try:
            telegram_id = str(telegram_id)

            # Отримуємо поточний баланс
            flex_balance = self.get_user_flex_balance(telegram_id)

            # Отримуємо доступні рівні
            available_levels_data = self.get_available_levels(telegram_id, flex_balance)

            # Формуємо списки
            available_levels = [level for level, data in available_levels_data.items()
                                if data['status']['has_enough_flex']]

            claimed_today = {level: data['status']['claimed_today']
                             for level, data in available_levels_data.items()}

            # Отримуємо час останніх отримань
            last_claim_times = {}
            for level in FlexLevel:
                last_time = self._get_next_claim_time(telegram_id, level)
                if last_time:
                    last_claim_times[level] = last_time - timedelta(hours=self.CLAIM_COOLDOWN_HOURS)

            # Підраховуємо загальні нарахування
            history = self.get_user_flex_history(telegram_id, limit=1000)
            total_winix = sum(item['winix_awarded'] for item in history)
            total_tickets = sum(item['tickets_awarded'] for item in history)

            return UserFlexStatus(
                telegram_id=telegram_id,
                current_flex_balance=flex_balance,
                available_levels=available_levels,
                claimed_today=claimed_today,
                last_claim_times=last_claim_times,
                total_claimed_winix=total_winix,
                total_claimed_tickets=total_tickets,
                last_updated=datetime.now(timezone.utc)
            )

        except Exception as e:
            logger.error(f"Помилка отримання статусу FLEX для {telegram_id}: {str(e)}")
            # Повертаємо порожній статус при помилці
            return UserFlexStatus(
                telegram_id=telegram_id,
                current_flex_balance=0,
                available_levels=[],
                claimed_today={},
                last_claim_times={},
                total_claimed_winix=0,
                total_claimed_tickets=0,
                last_updated=datetime.now(timezone.utc)
            )


# Ініціалізація моделі
flex_rewards_model = FlexRewardsModel()

# Експорт
__all__ = [
    'FlexRewardsModel',
    'FlexLevel',
    'RewardStatus',
    'FlexRewardConfig',
    'UserFlexStatus',
    'flex_rewards_model'
]