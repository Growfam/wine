"""
Сервіс для інтеграції з Telegram ботом
Верифікація підписок та інших дій користувачів
"""

import os
import logging
import asyncio
from typing import Dict, Any, Optional
from telegram import Bot
from telegram.error import BadRequest, Forbidden
from dotenv import load_dotenv

# Завантаження змінних середовища
load_dotenv()

# Налаштування логування
logger = logging.getLogger(__name__)


class TelegramService:
    """Сервіс для роботи з Telegram Bot API"""

    def __init__(self):
        """Ініціалізація сервісу"""
        self.bot_token = os.getenv('TELEGRAM_BOT_TOKEN')
        self.bot_username = os.getenv('TELEGRAM_BOT_USERNAME', '@WINIX_Official_bot')
        self.bot = None

        if self.bot_token:
            try:
                self.bot = Bot(token=self.bot_token)
                logger.info("✅ Telegram бот ініціалізовано")
            except Exception as e:
                logger.error(f"❌ Помилка ініціалізації Telegram бота: {str(e)}")
        else:
            logger.warning("⚠️ TELEGRAM_BOT_TOKEN не встановлено")

    async def check_bot_started(self, user_id: str) -> bool:
        """
        Перевіряє чи користувач запустив бота

        Args:
            user_id: Telegram ID користувача

        Returns:
            bool: True якщо бот запущено
        """
        if not self.bot:
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
        if not self.bot:
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
        if not self.bot:
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
        if not self.bot:
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
        Запускає асинхронну задачу в синхронному контексті

        Args:
            coro: Корутина для виконання

        Returns:
            Результат виконання корутини
        """
        try:
            # Отримуємо поточний event loop
            loop = asyncio.get_event_loop()
            if loop.is_running():
                # Якщо loop вже запущено, створюємо новий в окремому потоці
                import concurrent.futures
                with concurrent.futures.ThreadPoolExecutor() as executor:
                    future = executor.submit(asyncio.run, coro)
                    return future.result()
            else:
                # Якщо loop не запущено, використовуємо його
                return loop.run_until_complete(coro)
        except RuntimeError:
            # Якщо немає event loop, створюємо новий
            return asyncio.run(coro)

    # Синхронні обгортки для зручності використання в Flask
    def check_bot_started_sync(self, user_id: str) -> bool:
        """Синхронна версія check_bot_started"""
        return self.run_async_task(self.check_bot_started(user_id))

    def check_channel_subscription_sync(self, user_id: str, channel_username: str) -> Dict[str, Any]:
        """Синхронна версія check_channel_subscription"""
        return self.run_async_task(self.check_channel_subscription(user_id, channel_username))

    def send_verification_message_sync(self, user_id: str, message: str) -> bool:
        """Синхронна версія send_verification_message"""
        return self.run_async_task(self.send_verification_message(user_id, message))

    def get_bot_info_sync(self) -> Optional[Dict[str, Any]]:
        """Синхронна версія get_bot_info"""
        return self.run_async_task(self.get_bot_info())


# Глобальний екземпляр сервісу
telegram_service = TelegramService()


# Функції для зручного використання
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