#!/usr/bin/env python
"""
Telegram Bot для системи розіграшів WINIX.
Відповідає за взаємодію з користувачами через Telegram, відправку повідомлень
про розіграші, перемоги та інші події.
"""

import os
import sys
import logging
import asyncio
from datetime import datetime, timezone, timedelta
import json
import aiohttp
from aiogram import Bot, Dispatcher, types, executor
from aiogram.types import InlineKeyboardMarkup, InlineKeyboardButton
from aiogram.utils.exceptions import BotBlocked, ChatNotFound, UserDeactivated

# Додаємо кореневу папку бекенду до шляху Python для імпортів
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
if parent_dir not in sys.path:
    sys.path.append(parent_dir)

# Налаштування логування
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("raffle_bot.log")
    ]
)
logger = logging.getLogger(__name__)

# Імпортуємо необхідні модулі
try:
    from supabase_client import supabase, get_user
except ImportError:
    logger.critical("Помилка імпорту модуля supabase_client.py")
    sys.exit(1)

# Отримання конфігурації з середовища
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN")
if not TELEGRAM_BOT_TOKEN:
    logger.critical("Не вказано TELEGRAM_BOT_TOKEN")
    sys.exit(1)

API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:5000")

# Ініціалізація бота
bot = Bot(token=TELEGRAM_BOT_TOKEN)
dp = Dispatcher(bot)

# Типи повідомлень
MESSAGE_TYPES = {
    "WELCOME": "welcome",
    "RAFFLE_START": "raffle_start",
    "RAFFLE_END": "raffle_end",
    "WINNER": "winner",
    "DAILY_REMINDER": "daily_reminder"
}

# Шаблони повідомлень
MESSAGE_TEMPLATES = {
    MESSAGE_TYPES["WELCOME"]: """
🎮 *Вітаємо в системі розіграшів WINIX* 🎮

Дякуємо за реєстрацію! Тепер ви можете брати участь у розіграшах та вигравати WINIX токени.

*Як це працює:*
1. Отримуйте жетони за активність
2. Використовуйте жетони для участі в розіграшах
3. Вигравайте призи та отримуйте WINIX

*Ваші дані:*
👤 ID: {user_id}
💰 Баланс: {balance} WINIX
🎟️ Жетони: {coins}

Натисніть на кнопку нижче, щоб перейти до розіграшів:
""",

    MESSAGE_TYPES["RAFFLE_START"]: """
🎉 *Новий розіграш WINIX* 🎉

*{raffle_title}*
Призовий фонд: {prize_amount} {prize_currency}
Кількість переможців: {winners_count}
Вартість участі: {entry_fee} жетонів

⏰ Закінчення: {end_time}

Використайте свої жетони для участі та збільшіть свої шанси на перемогу!
""",

    MESSAGE_TYPES["RAFFLE_END"]: """
🏁 *Розіграш завершено* 🏁

*{raffle_title}* 
Загальний призовий фонд: {prize_amount} {prize_currency}
Кількість учасників: {participants_count}

{result_message}

Дякуємо за участь! Наступний розіграш вже скоро.
""",

    MESSAGE_TYPES["WINNER"]: """
🏆 *Вітаємо з перемогою!* 🏆

Ви зайняли *{place} місце* в розіграші "{raffle_title}"
Ваш приз: *{prize_amount} {prize_currency}*

Приз вже нараховано на ваш баланс. 
Поточний баланс: {balance} {prize_currency}

Дякуємо за участь та вітаємо з перемогою! 🎉
""",

    MESSAGE_TYPES["DAILY_REMINDER"]: """
⏰ *Щоденний розіграш WINIX* ⏰

Не пропустіть можливість взяти участь у щоденному розіграші!

Призовий фонд: {prize_amount} {prize_currency}
Кількість переможців: {winners_count}
До завершення: {time_left}

У вас є {coins} жетонів. Використайте їх зараз і збільшіть свої шанси на перемогу!
"""
}


@dp.message_handler(commands=['start'])
async def cmd_start(message: types.Message):
    """Обробка команди /start"""
    try:
        telegram_id = str(message.from_user.id)
        user = get_user(telegram_id)

        if user:
            # Створюємо клавіатуру з кнопками
            keyboard = InlineKeyboardMarkup(row_width=2)
            keyboard.add(
                InlineKeyboardButton("🎮 Розіграші", web_app=types.WebAppInfo(url=f"{API_BASE_URL}/raffles")),
                InlineKeyboardButton("💰 Гаманець", web_app=types.WebAppInfo(url=f"{API_BASE_URL}/wallet"))
            )

            # Відправляємо вітальне повідомлення
            welcome_text = MESSAGE_TEMPLATES[MESSAGE_TYPES["WELCOME"]].format(
                user_id=telegram_id,
                balance=user.get("balance", 0),
                coins=user.get("coins", 0)
            )

            await message.answer(welcome_text, parse_mode=types.ParseMode.MARKDOWN, reply_markup=keyboard)

            logger.info(f"Відправлено вітальне повідомлення користувачу {telegram_id}")
        else:
            # Якщо користувач не зареєстрований
            await message.answer(
                "Ви ще не зареєстровані в системі WINIX. Будь ласка, зареєструйтеся через веб-додаток.")
            logger.warning(f"Спроба старту від незареєстрованого користувача {telegram_id}")
    except Exception as e:
        logger.error(f"Помилка обробки команди /start: {str(e)}", exc_info=True)
        await message.answer("Сталася помилка при обробці вашого запиту. Спробуйте пізніше.")


@dp.message_handler(commands=['raffles'])
async def cmd_raffles(message: types.Message):
    """Обробка команди /raffles - інформація про активні розіграші"""
    try:
        telegram_id = str(message.from_user.id)

        # Перевіряємо, чи користувач зареєстрований
        user = get_user(telegram_id)
        if not user:
            await message.answer(
                "Ви ще не зареєстровані в системі WINIX. Будь ласка, зареєструйтеся через веб-додаток.")
            return

        # Отримуємо активні розіграші
        raffles_response = supabase.table("raffles").select("*").eq("status", "active").order("is_daily",
                                                                                              desc=True).order(
            "end_time", asc=True).execute()

        if not raffles_response.data:
            await message.answer("На даний момент немає активних розіграшів. Перевірте пізніше.")
            return

        # Створюємо клавіатуру для кожного розіграшу
        keyboard = InlineKeyboardMarkup(row_width=1)
        keyboard.add(
            InlineKeyboardButton("🎮 Перейти до розіграшів", web_app=types.WebAppInfo(url=f"{API_BASE_URL}/raffles"))
        )

        # Форматуємо повідомлення з інформацією про активні розіграші
        msg_text = "🎮 *Активні розіграші WINIX* 🎮\n\n"

        for raffle in raffles_response.data:
            # Форматуємо час завершення
            end_time = datetime.fromisoformat(raffle.get("end_time").replace('Z', '+00:00'))
            now = datetime.now(timezone.utc)
            time_left = end_time - now

            days = time_left.days
            hours = time_left.seconds // 3600
            minutes = (time_left.seconds % 3600) // 60

            if days > 0:
                time_str = f"{days}д {hours}год"
            else:
                time_str = f"{hours}год {minutes}хв"

            # Додаємо інформацію про розіграш
            raffle_type = "🔄 Щоденний" if raffle.get("is_daily") else "🌟 Гранд"
            msg_text += f"*{raffle_type}: {raffle.get('title')}*\n"
            msg_text += f"💰 Приз: {raffle.get('prize_amount')} {raffle.get('prize_currency')}\n"
            msg_text += f"👥 Учасників: {raffle.get('participants_count', 0)}\n"
            msg_text += f"⏰ Залишилось: {time_str}\n\n"

        msg_text += f"У вас є {user.get('coins', 0)} жетонів для участі в розіграшах."

        await message.answer(msg_text, parse_mode=types.ParseMode.MARKDOWN, reply_markup=keyboard)
        logger.info(f"Відправлено інформацію про розіграші користувачу {telegram_id}")
    except Exception as e:
        logger.error(f"Помилка обробки команди /raffles: {str(e)}", exc_info=True)
        await message.answer("Сталася помилка при отриманні інформації про розіграші. Спробуйте пізніше.")


@dp.message_handler(commands=['balance'])
async def cmd_balance(message: types.Message):
    """Обробка команди /balance - інформація про баланс користувача"""
    try:
        telegram_id = str(message.from_user.id)

        # Перевіряємо, чи користувач зареєстрований
        user = get_user(telegram_id)
        if not user:
            await message.answer(
                "Ви ще не зареєстровані в системі WINIX. Будь ласка, зареєструйтеся через веб-додаток.")
            return

        # Створюємо клавіатуру
        keyboard = InlineKeyboardMarkup(row_width=1)
        keyboard.add(
            InlineKeyboardButton("💰 Перейти до гаманця", web_app=types.WebAppInfo(url=f"{API_BASE_URL}/wallet"))
        )

        # Форматуємо повідомлення з інформацією про баланс
        msg_text = "💰 *Ваш баланс WINIX* 💰\n\n"
        msg_text += f"*WINIX*: {user.get('balance', 0)}\n"
        msg_text += f"*Жетони*: {user.get('coins', 0)}\n\n"

        # Додаємо інформацію про участь у розіграшах
        msg_text += f"👥 Участь у розіграшах: {user.get('participations_count', 0)}\n"
        msg_text += f"🏆 Перемоги: {user.get('wins_count', 0)}\n"

        await message.answer(msg_text, parse_mode=types.ParseMode.MARKDOWN, reply_markup=keyboard)
        logger.info(f"Відправлено інформацію про баланс користувачу {telegram_id}")
    except Exception as e:
        logger.error(f"Помилка обробки команди /balance: {str(e)}", exc_info=True)
        await message.answer("Сталася помилка при отриманні інформації про баланс. Спробуйте пізніше.")


@dp.message_handler(commands=['help'])
async def cmd_help(message: types.Message):
    """Обробка команди /help - допомога та інструкції"""
    try:
        help_text = """
📋 *Довідка по боту WINIX* 📋

*Доступні команди:*
/start - Почати роботу з ботом
/raffles - Показати активні розіграші
/balance - Перевірити баланс
/help - Показати цю довідку

*Як це працює:*
1. Отримуйте жетони за активність в системі
2. Використовуйте жетони для участі в розіграшах
3. Вигравайте призи та отримуйте WINIX токени

*Типи розіграшів:*
🔄 *Щоденні розіграші* - проводяться кожного дня з невеликими призами
🌟 *Гранд розіграші* - спеціальні розіграші з великими призами

Щоб взяти участь у розіграші, перейдіть на веб-сторінку розіграшів:
        """

        # Створюємо клавіатуру
        keyboard = InlineKeyboardMarkup(row_width=2)
        keyboard.add(
            InlineKeyboardButton("🎮 Розіграші", web_app=types.WebAppInfo(url=f"{API_BASE_URL}/raffles")),
            InlineKeyboardButton("💰 Гаманець", web_app=types.WebAppInfo(url=f"{API_BASE_URL}/wallet"))
        )

        await message.answer(help_text, parse_mode=types.ParseMode.MARKDOWN, reply_markup=keyboard)
        logger.info(f"Відправлено довідку користувачу {message.from_user.id}")
    except Exception as e:
        logger.error(f"Помилка обробки команди /help: {str(e)}", exc_info=True)
        await message.answer("Сталася помилка при отриманні довідки. Спробуйте пізніше.")


async def send_raffle_notification(user_id, raffle_data, message_type):
    """Відправка повідомлення про розіграш конкретному користувачу"""
    try:
        if message_type not in MESSAGE_TEMPLATES:
            logger.error(f"Невідомий тип повідомлення: {message_type}")
            return False

        # Отримуємо користувача для актуальних даних балансу
        user = get_user(user_id)
        if not user:
            logger.warning(f"Користувача {user_id} не знайдено")
            return False

        # Форматуємо час завершення для повідомлення
        if "end_time" in raffle_data:
            end_time = datetime.fromisoformat(raffle_data["end_time"].replace('Z', '+00:00'))
            raffle_data["end_time"] = end_time.strftime("%d.%m.%Y %H:%M")

            # Розраховуємо час, що залишився
            now = datetime.now(timezone.utc)
            time_left = end_time - now

            days = time_left.days
            hours = time_left.seconds // 3600
            minutes = (time_left.seconds % 3600) // 60

            if days > 0:
                raffle_data["time_left"] = f"{days}д {hours}год"
            else:
                raffle_data["time_left"] = f"{hours}год {minutes}хв"

        # Додаємо дані користувача
        raffle_data["balance"] = user.get("balance", 0)
        raffle_data["coins"] = user.get("coins", 0)

        # Отримуємо шаблон повідомлення і форматуємо його
        message_template = MESSAGE_TEMPLATES[message_type]
        message_text = message_template.format(**raffle_data)

        # Створюємо клавіатуру залежно від типу повідомлення
        keyboard = InlineKeyboardMarkup(row_width=1)

        if message_type in [MESSAGE_TYPES["RAFFLE_START"], MESSAGE_TYPES["DAILY_REMINDER"]]:
            keyboard.add(
                InlineKeyboardButton("🎮 Взяти участь", web_app=types.WebAppInfo(url=f"{API_BASE_URL}/raffles"))
            )
        elif message_type == MESSAGE_TYPES["WINNER"]:
            keyboard.add(
                InlineKeyboardButton("💰 Переглянути баланс", web_app=types.WebAppInfo(url=f"{API_BASE_URL}/wallet")),
                InlineKeyboardButton("🏆 Історія розіграшів", web_app=types.WebAppInfo(url=f"{API_BASE_URL}/raffles"))
            )
        else:
            keyboard.add(
                InlineKeyboardButton("🎮 Перейти до розіграшів", web_app=types.WebAppInfo(url=f"{API_BASE_URL}/raffles"))
            )

        # Відправляємо повідомлення
        await bot.send_message(
            chat_id=user_id,
            text=message_text,
            parse_mode=types.ParseMode.MARKDOWN,
            reply_markup=keyboard
        )

        logger.info(f"Відправлено повідомлення типу {message_type} користувачу {user_id}")
        return True
    except BotBlocked:
        logger.warning(f"Не вдалося відправити повідомлення користувачу {user_id}: бот заблокований")
        return False
    except ChatNotFound:
        logger.warning(f"Не вдалося відправити повідомлення користувачу {user_id}: чат не знайдено")
        return False
    except UserDeactivated:
        logger.warning(f"Не вдалося відправити повідомлення користувачу {user_id}: користувач деактивований")
        return False
    except Exception as e:
        logger.error(f"Помилка відправки повідомлення користувачу {user_id}: {str(e)}", exc_info=True)
        return False


async def notify_winners(raffle_id):
    """Відправка повідомлень переможцям розіграшу"""
    try:
        # Отримуємо дані розіграшу
        raffle_response = supabase.table("raffles").select("*").eq("id", raffle_id).execute()
        if not raffle_response.data:
            logger.error(f"Розіграш з ID {raffle_id} не знайдено")
            return False

        raffle = raffle_response.data[0]

        # Отримуємо переможців
        winners_response = supabase.table("raffle_winners").select("*").eq("raffle_id", raffle_id).order("place",
                                                                                                         asc=True).execute()
        if not winners_response.data:
            logger.warning(f"Переможців для розіграшу {raffle_id} не знайдено")
            return False

        success_count = 0
        for winner in winners_response.data:
            telegram_id = winner.get("telegram_id")

            # Створюємо дані для повідомлення
            notification_data = {
                "raffle_title": raffle.get("title"),
                "place": winner.get("place"),
                "prize_amount": winner.get("prize_amount"),
                "prize_currency": winner.get("prize_currency", "WINIX")
            }

            # Відправляємо повідомлення
            if await send_raffle_notification(telegram_id, notification_data, MESSAGE_TYPES["WINNER"]):
                success_count += 1

                # Оновлюємо статус відправки повідомлення
                supabase.table("raffle_winners").update({
                    "notification_sent": True
                }).eq("id", winner.get("id")).execute()

        logger.info(f"Відправлено {success_count} повідомлень переможцям розіграшу {raffle_id}")
        return success_count > 0
    except Exception as e:
        logger.error(f"Помилка відправки повідомлень переможцям розіграшу {raffle_id}: {str(e)}", exc_info=True)
        return False


async def notify_about_new_raffle(raffle_id):
    """Відправка повідомлень про новий розіграш"""
    try:
        # Отримуємо дані розіграшу
        raffle_response = supabase.table("raffles").select("*").eq("id", raffle_id).execute()
        if not raffle_response.data:
            logger.error(f"Розіграш з ID {raffle_id} не знайдено")
            return False

        raffle = raffle_response.data[0]

        # Створюємо дані для повідомлення
        notification_data = {
            "raffle_title": raffle.get("title"),
            "prize_amount": raffle.get("prize_amount"),
            "prize_currency": raffle.get("prize_currency", "WINIX"),
            "winners_count": raffle.get("winners_count"),
            "entry_fee": raffle.get("entry_fee"),
            "end_time": raffle.get("end_time")
        }

        # Отримуємо користувачів для розсилки (обмеження для уникнення перенавантаження)
        users_response = supabase.table("winix").select("telegram_id").limit(100).execute()
        if not users_response.data:
            logger.warning("Користувачів для розсилки не знайдено")
            return False

        # Відправляємо повідомлення з обмеженням швидкості
        success_count = 0
        for user in users_response.data:
            telegram_id = user.get("telegram_id")

            if await send_raffle_notification(telegram_id, notification_data, MESSAGE_TYPES["RAFFLE_START"]):
                success_count += 1

            # Пауза для уникнення обмежень Telegram API
            await asyncio.sleep(0.05)

        logger.info(f"Відправлено {success_count} повідомлень про новий розіграш {raffle_id}")
        return success_count > 0
    except Exception as e:
        logger.error(f"Помилка відправки повідомлень про новий розіграш {raffle_id}: {str(e)}", exc_info=True)
        return False


async def send_daily_reminder():
    """Відправка щоденного нагадування про розіграші"""
    try:
        # Отримуємо активний щоденний розіграш
        raffle_response = supabase.table("raffles").select("*").eq("is_daily", True).eq("status", "active").order(
            "end_time", asc=True).limit(1).execute()
        if not raffle_response.data:
            logger.warning("Активний щоденний розіграш не знайдено")
            return False

        raffle = raffle_response.data[0]

        # Створюємо дані для повідомлення
        notification_data = {
            "raffle_title": raffle.get("title"),
            "prize_amount": raffle.get("prize_amount"),
            "prize_currency": raffle.get("prize_currency", "WINIX"),
            "winners_count": raffle.get("winners_count"),
            "end_time": raffle.get("end_time")
        }

        # Отримуємо користувачів, які ще не брали участь у цьому розіграші
        # Спочатку отримуємо IDs користувачів, які вже беруть участь
        participants_response = supabase.table("raffle_participants").select("telegram_id").eq("raffle_id", raffle.get(
            "id")).execute()
        participant_ids = [p.get("telegram_id") for p in
                           participants_response.data] if participants_response.data else []

        # Тепер отримуємо користувачів, які не є в списку учасників
        users_query = supabase.table("winix").select("telegram_id")
        if participant_ids:
            # Використовуємо not_.in_ для фільтрації
            users_query = users_query.not_.in_("telegram_id", participant_ids)

        # Обмежуємо кількість користувачів для розсилки
        users_response = users_query.limit(50).execute()
        if not users_response.data:
            logger.warning("Користувачів для нагадування не знайдено")
            return False

        # Відправляємо повідомлення з обмеженням швидкості
        success_count = 0
        for user in users_response.data:
            telegram_id = user.get("telegram_id")

            # Отримуємо актуальні дані користувача для інформації про жетони
            user_data = get_user(telegram_id)
            if not user_data:
                continue

            # Додаємо дані користувача до повідомлення
            notification_data["coins"] = user_data.get("coins", 0)

            if await send_raffle_notification(telegram_id, notification_data, MESSAGE_TYPES["DAILY_REMINDER"]):
                success_count += 1

            # Пауза для уникнення обмежень Telegram API
            await asyncio.sleep(0.05)

        logger.info(f"Відправлено {success_count} нагадувань про щоденний розіграш")
        return success_count > 0
    except Exception as e:
        logger.error(f"Помилка відправки нагадувань про щоденний розіграш: {str(e)}", exc_info=True)
        return False


# Веб-хук для отримання повідомлень від API
async def process_webhook(request):
    """Обробка вхідних повідомлень від API через веб-хук"""
    try:
        data = await request.json()
        event_type = data.get("event_type")

        logger.info(f"Отримано подію: {event_type}")

        if event_type == "raffle_created":
            # Новий розіграш створено
            raffle_id = data.get("raffle_id")
            if raffle_id:
                asyncio.create_task(notify_about_new_raffle(raffle_id))
                return {"status": "success", "message": "Повідомлення про новий розіграш заплановано"}

        elif event_type == "raffle_completed":
            # Розіграш завершено
            raffle_id = data.get("raffle_id")
            if raffle_id:
                asyncio.create_task(notify_winners(raffle_id))
                return {"status": "success", "message": "Повідомлення переможцям заплановано"}

        elif event_type == "daily_reminder":
            # Щоденне нагадування
            asyncio.create_task(send_daily_reminder())
            return {"status": "success", "message": "Щоденні нагадування заплановано"}

        else:
            logger.warning(f"Невідомий тип події: {event_type}")
            return {"status": "error", "message": "Невідомий тип події"}

    except Exception as e:
        logger.error(f"Помилка обробки веб-хука: {str(e)}", exc_info=True)
        return {"status": "error", "message": str(e)}


# Запуск бота через long-polling
def main():
    """Основна функція для запуску бота"""
    logger.info("Запуск бота розіграшів WINIX")
    executor.start_polling(dp, skip_updates=True)


# Якщо скрипт запущено напряму
if __name__ == "__main__":
    main()