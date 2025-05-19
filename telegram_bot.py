"""
Telegram бот для проекту WINIX
Інтеграція з міні-аппом та реферальною системою
"""

import logging
import os
import asyncio
import aiohttp
from aiogram import Bot, Dispatcher, types
from aiogram.filters import Command, CommandStart
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton, WebAppInfo
from dotenv import load_dotenv

# Завантажуємо змінні середовища
load_dotenv()

# Налаштування логування
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Токен бота та URL міні-апп
BOT_TOKEN = os.getenv('TELEGRAM_BOT_TOKEN')
WEBAPP_URL = os.getenv('WEBAPP_URL', 'https://winixbot.com')
API_BASE_URL = os.getenv('API_BASE_URL', 'https://winixbot.com')

# Ініціалізація бота та диспетчера
bot = Bot(token=BOT_TOKEN)
dp = Dispatcher()


class WinixBot:
    """Основний клас Telegram бота WINIX"""

    def __init__(self):
        self.bot = bot
        self.session = None

    async def init_session(self):
        """Ініціалізує HTTP сесію"""
        self.session = aiohttp.ClientSession()

    async def close_session(self):
        """Закриває HTTP сесію"""
        if self.session:
            await self.session.close()

    async def api_request(self, endpoint, method='GET', data=None):
        """Робить запит до API міні-апп"""
        try:
            url = f"{API_BASE_URL}/api/{endpoint}"

            if method == 'GET':
                async with self.session.get(url) as response:
                    return await response.json()
            elif method == 'POST':
                async with self.session.post(url, json=data) as response:
                    return await response.json()
        except Exception as e:
            logger.error(f"Помилка API запиту: {str(e)}")
            return None

    async def sync_user_with_webapp(self, user_id, user_data):
        """Синхронізує користувача з веб-аппом"""
        sync_data = {
            'telegram_id': str(user_id),
            'username': user_data.get('username'),
            'first_name': user_data.get('first_name'),
            'last_name': user_data.get('last_name')
        }

        return await self.api_request(
            f'telegram/user/{user_id}/sync',
            method='POST',
            data=sync_data
        )

    async def get_user_referrals(self, user_id):
        """Отримує дані про рефералів користувача"""
        return await self.api_request(f'telegram/user/{user_id}/referrals')

    async def send_referral_notification(self, referrer_id, referee_id):
        """Відправляє сповіщення про нового реферала"""
        notification_data = {
            'referrer_id': str(referrer_id),
            'referee_id': str(referee_id),
            'bonus_amount': 50
        }

        return await self.api_request(
            'telegram/referral/notify',
            method='POST',
            data=notification_data
        )


# Ініціалізуємо бот
winix_bot = WinixBot()


# Обробники команд

@dp.message(CommandStart())
async def start_command(message: types.Message):
    """Обробник команди /start"""
    try:
        user = message.from_user
        user_id = user.id

        # Отримуємо параметр start (реферальний код)
        args = message.text.split()[1:] if len(message.text.split()) > 1 else []
        referrer_id = args[0] if args and args[0].isdigit() else None

        # Синхронізуємо користувача з веб-аппом
        user_data = {
            'username': user.username,
            'first_name': user.first_name,
            'last_name': user.last_name
        }

        sync_result = await winix_bot.sync_user_with_webapp(user_id, user_data)

        # Створюємо клавіатуру
        keyboard = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(
                text="🚀 Відкрити WINIX",
                web_app=WebAppInfo(url=WEBAPP_URL)
            )],
            [
                InlineKeyboardButton(
                    text="👥 Мої реферали",
                    callback_data="my_referrals"
                ),
                InlineKeyboardButton(
                    text="💰 Баланс",
                    callback_data="my_balance"
                )
            ],
            [InlineKeyboardButton(
                text="ℹ️ Допомога",
                callback_data="help"
            )]
        ])

        # Формуємо привітальне повідомлення
        welcome_message = f"""
🎉 <b>Вітаємо в WINIX!</b>

Привіт, {user.first_name}! 👋

🎮 <b>WINIX</b> - це захоплююча платформа де ви можете:
• 🎲 Брати участь у розіграшах
• 💰 Зберігати та примножувати WINIX токени
• 👥 Запрошувати друзів та заробляти
• 🏆 Отримувати бейджі та досягнення

🚀 Натисніть кнопку нижче, щоб розпочати!
        """

        # Якщо є реферер, додаємо інформацію про це
        if referrer_id:
            welcome_message += f"\n🎁 Ви приєдналися за запрошенням користувача {referrer_id}!"

        await message.answer(welcome_message, reply_markup=keyboard)

        # Обробляємо реферальне посилання на backend
        if referrer_id:
            # Backend сам обробить реферальний зв'язок через webhook
            pass

    except Exception as e:
        logger.error(f"Помилка в start_command: {str(e)}")
        await message.answer("Сталася помилка. Спробуйте пізніше.")


@dp.callback_query(lambda c: c.data == "my_referrals")
async def my_referrals_callback(callback: types.CallbackQuery):
    """Обробник кнопки "Мої реферали" """
    try:
        user_id = callback.from_user.id

        # Отримуємо дані про рефералів
        referrals_data = await winix_bot.get_user_referrals(user_id)

        if referrals_data and referrals_data.get('status') == 'success':
            data = referrals_data['data']

            message = f"""
👥 <b>Ваші реферали</b>

📊 <b>Статистика:</b>
• Всього рефералів: {data.get('total_referrals', 0)}
• 1-й рівень: {data.get('level1_count', 0)}
• 2-й рівень: {data.get('level2_count', 0)}
• Активні: {data.get('active_referrals', 0)}

💰 <b>Загальний заробіток:</b> {data.get('total_earnings', 0)} WINIX

🔗 <b>Ваше реферальне посилання:</b>
{data.get('referral_link', '')}

💡 Поділіться посиланням з друзями та заробляйте разом!
            """

            keyboard = InlineKeyboardMarkup(inline_keyboard=[
                [InlineKeyboardButton(
                    text="📊 Детальна статистика",
                    web_app=WebAppInfo(url=f"{WEBAPP_URL}/referrals")
                )],
                [InlineKeyboardButton(
                    text="🔗 Поділитися посиланням",
                    switch_inline_query=f"Приєднуйся до WINIX! {data.get('referral_link', '')}"
                )],
                [InlineKeyboardButton(
                    text="« Назад",
                    callback_data="main_menu"
                )]
            ])
        else:
            message = "❌ Не вдалося отримати дані про рефералів. Спробуйте пізніше."
            keyboard = InlineKeyboardMarkup(inline_keyboard=[
                [InlineKeyboardButton(
                    text="« Назад",
                    callback_data="main_menu"
                )]
            ])

        await callback.message.edit_text(message, reply_markup=keyboard)
        await callback.answer()

    except Exception as e:
        logger.error(f"Помилка в my_referrals_callback: {str(e)}")
        await callback.answer("Сталася помилка при отриманні даних.")


@dp.callback_query(lambda c: c.data == "my_balance")
async def my_balance_callback(callback: types.CallbackQuery):
    """Обробник кнопки "Баланс" """
    try:
        user_id = callback.from_user.id

        # Отримуємо дані користувача
        sync_result = await winix_bot.api_request(f'telegram/user/{user_id}/sync', method='POST')

        if sync_result and sync_result.get('status') == 'success':
            data = sync_result['data']

            message = f"""
💰 <b>Ваш баланс</b>

🏦 <b>WINIX токени:</b> {data.get('balance', 0)}
🎫 <b>Жетони розіграшів:</b> {data.get('coins', 0)}

📈 <b>Статистика:</b>
• Участей у розіграшах: {data.get('participations_count', 0)}
• Виграшів: {data.get('wins_count', 0)}

🎮 Відкрийте міні-апп для більш детальної інформації!
            """

            keyboard = InlineKeyboardMarkup(inline_keyboard=[
                [InlineKeyboardButton(
                    text="🎮 Відкрити WINIX",
                    web_app=WebAppInfo(url=WEBAPP_URL)
                )],
                [InlineKeyboardButton(
                    text="« Назад",
                    callback_data="main_menu"
                )]
            ])
        else:
            message = "❌ Не вдалося отримати дані про баланс. Спробуйте пізніше."
            keyboard = InlineKeyboardMarkup(inline_keyboard=[
                [InlineKeyboardButton(
                    text="« Назад",
                    callback_data="main_menu"
                )]
            ])

        await callback.message.edit_text(message, reply_markup=keyboard)
        await callback.answer()

    except Exception as e:
        logger.error(f"Помилка в my_balance_callback: {str(e)}")
        await callback.answer("Сталася помилка при отриманні даних.")


@dp.callback_query(lambda c: c.data == "help")
async def help_callback(callback: types.CallbackQuery):
    """Обробник кнопки "Допомога" """
    try:
        message = """
ℹ️ <b>Допомога WINIX</b>

🎯 <b>Основні функції:</b>
• <b>Розіграші</b> - беріть участь та вигравайте цінні призи
• <b>Стейкінг</b> - зберігайте токени та отримуйте прибуток
• <b>Реферали</b> - запрошуйте друзів та заробляйте бонуси
• <b>Завдання</b> - виконуйте завдання для отримання винагород

💰 <b>Як заробляти:</b>
1. Беріть участь у розіграшах
2. Запрошуйте друзів (50 WINIX за кожного)
3. Ставте токени в стейкінг
4. Виконуйте щоденні завдання

🎁 <b>Реферальна програма:</b>
• 10% від заробітків рефералів 1-го рівня
• 5% від заробітків рефералів 2-го рівня
• Бонус 50 WINIX за кожного нового реферала

👥 <b>Підтримка:</b>
📧 Email: support@winix.com
💬 Telegram: @winix_support

🚀 Відкрийте міні-апп для повного функціоналу!
        """

        keyboard = InlineKeyboardMarkup(inline_keyboard=[
            [InlineKeyboardButton(
                text="🚀 Відкрити WINIX",
                web_app=WebAppInfo(url=WEBAPP_URL)
            )],
            [InlineKeyboardButton(
                text="« Назад",
                callback_data="main_menu"
            )]
        ])

        await callback.message.edit_text(message, reply_markup=keyboard)
        await callback.answer()

    except Exception as e:
        logger.error(f"Помилка в help_callback: {str(e)}")
        await callback.answer("Сталася помилка.")


@dp.callback_query(lambda c: c.data == "main_menu")
async def main_menu_callback(callback: types.CallbackQuery):
    """Повернення до головного меню"""
    user = callback.from_user

    keyboard = InlineKeyboardMarkup(inline_keyboard=[
        [InlineKeyboardButton(
            text="🚀 Відкрити WINIX",
            web_app=WebAppInfo(url=WEBAPP_URL)
        )],
        [
            InlineKeyboardButton(
                text="👥 Мої реферали",
                callback_data="my_referrals"
            ),
            InlineKeyboardButton(
                text="💰 Баланс",
                callback_data="my_balance"
            )
        ],
        [InlineKeyboardButton(
            text="ℹ️ Допомога",
            callback_data="help"
        )]
    ])

    message = f"""
🎉 <b>WINIX - головне меню</b>

Привіт, {user.first_name}! 👋

Оберіть дію:
    """

    await callback.message.edit_text(message, reply_markup=keyboard)
    await callback.answer()


# Запуск бота
async def main():
    """Основна функція запуску бота"""
    try:
        # Ініціалізуємо сесію
        await winix_bot.init_session()

        # Встановлюємо webhook якщо потрібно
        webhook_url = os.getenv('WEBHOOK_URL')
        if webhook_url:
            await bot.set_webhook(
                url=f"{webhook_url}/telegram/webhook",
                allowed_updates=["message", "callback_query"]
            )
            logger.info(f"Webhook встановлено: {webhook_url}")

        # Запускаємо polling якщо webhook не налаштований
        if not webhook_url:
            logger.info("Запуск бота в режимі polling...")
            await dp.start_polling(bot)

    except Exception as e:
        logger.error(f"Помилка запуску бота: {str(e)}")

    finally:
        # Закриваємо сесію
        await winix_bot.close_session()


if __name__ == "__main__":
    asyncio.run(main())