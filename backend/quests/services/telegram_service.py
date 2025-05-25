"""
Сервіс для інтеграції з Telegram ботом - ВИПРАВЛЕНА ВЕРСІЯ
Безпечна верифікація підписок та інших дій користувачів
"""

import os
import logging
import asyncio
from typing import Dict, Any, Optional
from dotenv import load_dotenv

# Завантаження змінних середовища
load_dotenv()

# Налаштування логування
logger = logging.getLogger(__name__)

# === БЕЗПЕЧНИЙ ІМПОРТ TELEGRAM ===
HAS_TELEGRAM = False
Bot = None
BadRequest = Forbidden = None

try:
    from telegram import Bot
    from telegram.error import BadRequest, Forbidden
    HAS_TELEGRAM = True
    logger.info("✅ Telegram пакет доступний")
except ImportError as e:
    logger.warning(f"⚠️ Telegram пакет недоступний: {e}")
    logger.info("💡 Встановіть: pip install python-telegram-bot")

    # Заглушки для класів
    class Bot:
        def __init__(self, token): pass
        async def get_chat(self, user_id): return None
        async def get_chat_member(self, chat_id, user_id): return None
        async def send_message(self, chat_id, text, **kwargs): return None
        async def get_me(self): return None

    class BadRequest(Exception): pass
    class Forbidden(Exception): pass


class TelegramService:
    """Сервіс для роботи з Telegram Bot API"""

    def __init__(self):
        """Ініціалізація сервісу"""
        self.bot_token = os.getenv('TELEGRAM_BOT_TOKEN')
        self.bot_username = os.getenv('TELEGRAM_BOT_USERNAME', '@WINIX_Official_bot')
        self.bot = None
        self.is_available = HAS_TELEGRAM and bool(self.bot_token)

        if not HAS_TELEGRAM:
            logger.warning("⚠️ Telegram пакет недоступний - сервіс працює в режимі заглушки")
            return

        if self.bot_token:
            try:
                self.bot = Bot(token=self.bot_token)
                logger.info("✅ Telegram бот ініціалізовано")
            except Exception as e:
                logger.error(f"❌ Помилка ініціалізації Telegram бота: {str(e)}")
                self.is_available = False
        else:
            logger.warning("⚠️ TELEGRAM_BOT_TOKEN не встановлено")
            self.is_available = False

    async def check_bot_started(self, user_id: str) -> bool:
        """
        Перевіряє чи користувач запустив бота

        Args:
            user_id: Telegram ID користувача

        Returns:
            bool: True якщо бот запущено
        """
        if not self.is_available or not self.bot:
            logger.warning("🤖 Telegram бот не ініціалізовано")
            return False

        try:
            user_id = int(user_id)

            # Спробуємо отримати інформацію про чат з користувачем
            chat = await self.bot.get_chat(user_id)

            if chat:
                logger.info(f"✅ Користувач {user_id} має активний чат з ботом")
                return True
            else:
                logger.info(f"❌ Користувач {user_id} не має активного чата з ботом")
                return False

        except (BadRequest, Forbidden) as e:
            logger.warning(f"❌ Користувач {user_id} не запустив бота: {str(e)}")
            return False
        except Exception as e:
            logger.error(f"❌ Помилка перевірки бота для {user_id}: {str(e)}")
            return False

    async def check_channel_subscription(self, user_id: str, channel_username: str) -> Dict[str, Any]:
        """
        Перевіряє підписку користувача на канал

        Args:
            user_id: Telegram ID користувача
            channel_username: Username каналу (з @ або без)

        Returns:
            Dict з результатом перевірки
        """
        if not self.is_available or not self.bot:
            return {
                'subscribed': False,
                'error': 'Telegram бот не ініціалізовано'
            }

        try:
            user_id = int(user_id)

            # Нормалізуємо username каналу
            if not channel_username.startswith('@'):
                channel_username = f'@{channel_username}'

            logger.info(f"🔍 Перевірка підписки {user_id} на {channel_username}")

            # Отримуємо статус учасника каналу
            member = await self.bot.get_chat_member(
                chat_id=channel_username,
                user_id=user_id
            )

            # Перевіряємо статус
            if member.status in ['member', 'administrator', 'creator']:
                logger.info(f"✅ Користувач {user_id} підписаний на {channel_username}")
                return {
                    'subscribed': True,
                    'status': member.status,
                    'channel': channel_username
                }
            else:
                logger.info(f"❌ Користувач {user_id} не підписаний на {channel_username}")
                return {
                    'subscribed': False,
                    'status': member.status,
                    'channel': channel_username
                }

        except BadRequest as e:
            error_msg = str(e)
            if "chat not found" in error_msg.lower():
                logger.error(f"❌ Канал {channel_username} не знайдено")
                return {
                    'subscribed': False,
                    'error': f'Канал {channel_username} не знайдено'
                }
            elif "user not found" in error_msg.lower():
                logger.error(f"❌ Користувач {user_id} не знайдено")
                return {
                    'subscribed': False,
                    'error': 'Користувач не знайдено'
                }
            else:
                logger.error(f"❌ BadRequest при перевірці підписки: {error_msg}")
                return {
                    'subscribed': False,
                    'error': f'Помилка перевірки: {error_msg}'
                }
        except Forbidden as e:
            logger.error(f"❌ Бот не має доступу до каналу {channel_username}: {str(e)}")
            return {
                'subscribed': False,
                'error': f'Бот не має доступу до каналу {channel_username}'
            }
        except Exception as e:
            logger.error(f"❌ Помилка перевірки підписки: {str(e)}")
            return {
                'subscribed': False,
                'error': f'Помилка перевірки підписки: {str(e)}'
            }

    async def send_verification_message(self, user_id: str, message: str) -> bool:
        """
        Відправляє повідомлення користувачу для верифікації

        Args:
            user_id: Telegram ID користувача
            message: Текст повідомлення

        Returns:
            bool: True якщо повідомлення відправлено
        """
        if not self.is_available or not self.bot:
            logger.warning("🤖 Telegram бот не ініціалізовано")
            return False

        try:
            user_id = int(user_id)

            await self.bot.send_message(
                chat_id=user_id,
                text=message,
                parse_mode='HTML'
            )

            logger.info(f"✅ Повідомлення відправлено користувачу {user_id}")
            return True

        except Exception as e:
            logger.error(f"❌ Помилка відправки повідомлення {user_id}: {str(e)}")
            return False

    async def get_bot_info(self) -> Optional[Dict[str, Any]]:
        """
        Отримує інформацію про бота

        Returns:
            Dict з інформацією про бота або None
        """
        if not self.is_available or not self.bot:
            return None

        try:
            me = await self.bot.get_me()
            return {
                'id': me.id,
                'username': me.username,
                'first_name': me.first_name,
                'is_bot': me.is_bot
            }
        except Exception as e:
            logger.error(f"❌ Помилка отримання інформації про бота: {str(e)}")
            return None

    def run_async_task(self, coro):
        """
        БЕЗПЕЧНИЙ запуск асинхронної задачі в синхронному контексті

        Args:
            coro: Корутина для виконання

        Returns:
            Результат виконання корутини
        """
        if not self.is_available:
            logger.warning("⚠️ Telegram сервіс недоступний")
            return None

        try:
            # Спочатку пробуємо отримати поточний event loop
            try:
                loop = asyncio.get_running_loop()
                # Якщо loop вже запущено, використовуємо asyncio.run в окремому потоці
                import concurrent.futures
                import threading

                def run_in_thread():
                    return asyncio.run(coro)

                with concurrent.futures.ThreadPoolExecutor() as executor:
                    future = executor.submit(run_in_thread)
                    return future.result(timeout=30)  # 30 секунд timeout

            except RuntimeError:
                # Немає запущеного loop, можемо використовувати asyncio.run
                return asyncio.run(coro)

        except Exception as e:
            logger.error(f"❌ Помилка виконання async задачі: {str(e)}")
            return None

    # === СИНХРОННІ ОБГОРТКИ ===
    def check_bot_started_sync(self, user_id: str) -> bool:
        """Синхронна версія check_bot_started"""
        if not self.is_available:
            return False
        result = self.run_async_task(self.check_bot_started(user_id))
        return result if result is not None else False

    def check_channel_subscription_sync(self, user_id: str, channel_username: str) -> Dict[str, Any]:
        """Синхронна версія check_channel_subscription"""
        if not self.is_available:
            return {'subscribed': False, 'error': 'Сервіс недоступний'}
        result = self.run_async_task(self.check_channel_subscription(user_id, channel_username))
        return result if result is not None else {'subscribed': False, 'error': 'Помилка виконання'}

    def send_verification_message_sync(self, user_id: str, message: str) -> bool:
        """Синхронна версія send_verification_message"""
        if not self.is_available:
            return False
        result = self.run_async_task(self.send_verification_message(user_id, message))
        return result if result is not None else False

    def get_bot_info_sync(self) -> Optional[Dict[str, Any]]:
        """Синхронна версія get_bot_info"""
        if not self.is_available:
            return None
        return self.run_async_task(self.get_bot_info())

    def get_service_status(self) -> Dict[str, Any]:
        """Отримання статусу сервісу"""
        return {
            'available': self.is_available,
            'has_telegram_package': HAS_TELEGRAM,
            'has_bot_token': bool(self.bot_token),
            'bot_username': self.bot_username,
            'bot_initialized': self.bot is not None
        }


# Глобальний екземпляр сервісу з безпечною ініціалізацією
try:
    telegram_service = TelegramService()
    logger.info("✅ TelegramService створено")
except Exception as e:
    logger.error(f"❌ Помилка створення TelegramService: {e}")
    # Створюємо заглушку
    class TelegramServiceStub:
        def __init__(self):
            self.is_available = False
        def check_bot_started_sync(self, user_id): return False
        def check_channel_subscription_sync(self, user_id, channel): return {'subscribed': False}
        def send_verification_message_sync(self, user_id, message): return False
        def get_bot_info_sync(self): return None
        def get_service_status(self): return {'available': False, 'error': 'Service creation failed'}

    telegram_service = TelegramServiceStub()


# === ФУНКЦІЇ ДЛЯ ЗРУЧНОГО ВИКОРИСТАННЯ ===
def check_bot_started(user_id: str) -> bool:
    """Перевіряє чи користувач запустив бота"""
    return telegram_service.check_bot_started_sync(user_id)

def check_channel_subscription(user_id: str, channel_username: str) -> Dict[str, Any]:
    """Перевіряє підписку на канал"""
    return telegram_service.check_channel_subscription_sync(user_id, channel_username)

def send_verification_message(user_id: str, message: str) -> bool:
    """Відправляє повідомлення користувачу"""
    return telegram_service.send_verification_message_sync(user_id, message)

def get_bot_info() -> Optional[Dict[str, Any]]:
    """Отримує інформацію про бота"""
    return telegram_service.get_bot_info_sync()

# === ЕКСПОРТ ===
__all__ = [
    'TelegramService',
    'telegram_service',
    'check_bot_started',
    'check_channel_subscription',
    'send_verification_message',
    'get_bot_info',
    'HAS_TELEGRAM'
]