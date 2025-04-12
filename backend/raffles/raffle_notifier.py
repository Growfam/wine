"""
Модуль для відправки сповіщень користувачам про розіграші через Telegram API.
Заміна для raffle_bot.py з простішим API та кращою інтеграцією з Telegram Mini App.
"""

import os
import sys
import logging
import threading
import requests
import json
import time
from datetime import datetime, timezone
from typing import Dict, Any, List, Optional

# Налаштування логування
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
                    handlers=[
                        logging.StreamHandler(),
                        logging.FileHandler("raffle_notifier.log")
                    ])
logger = logging.getLogger(__name__)

# Імпортуємо необхідні модулі
try:
    from ..supabase_client import supabase, get_user, cache_get, cache_set, clear_cache
except ImportError:
    # Альтернативний імпорт для прямого запуску
    try:
        from supabase_client import supabase, get_user, cache_get, cache_set, clear_cache
    except ImportError:
        logger.critical("Помилка імпорту необхідних модулів. Модуль не може бути ініціалізовано.")
        sys.exit(1)

# Отримання конфігурації з середовища
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_API_URL = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}"
MAX_RETRY_ATTEMPTS = 3
MIN_TIME_BETWEEN_MESSAGES = 0.05  # мінімальний час між повідомленнями в секундах


# Типи сповіщень і шаблони
class NotificationType:
    """Типи сповіщень для користувачів"""
    RAFFLE_CREATED = "raffle_created"  # Створено новий розіграш
    RAFFLE_COMPLETED = "raffle_completed"  # Розіграш завершено
    WINNER_NOTIFICATION = "winner"  # Сповіщення переможця
    DAILY_REMINDER = "daily_reminder"  # Щоденне нагадування
    CUSTOM_MESSAGE = "custom_message"  # Користувацьке повідомлення
    SYSTEM_NOTIFICATION = "system"  # Системне сповіщення


# Шаблони повідомлень
MESSAGE_TEMPLATES = {
    NotificationType.RAFFLE_CREATED: """
🎉 *Новий розіграш WINIX* 🎉

*{raffle_title}*
Призовий фонд: {prize_amount} {prize_currency}
Кількість переможців: {winners_count}
Вартість участі: {entry_fee} жетонів

⏰ Закінчення: {end_time}

Використайте свої жетони для участі та збільшіть свої шанси на перемогу!
""",

    NotificationType.RAFFLE_COMPLETED: """
🏁 *Розіграш завершено* 🏁

*{raffle_title}* 
Загальний призовий фонд: {prize_amount} {prize_currency}
Кількість учасників: {participants_count}

{winners_info}

Дякуємо за участь! Наступний розіграш вже скоро.
""",

    NotificationType.WINNER_NOTIFICATION: """
🏆 *Вітаємо з перемогою!* 🏆

Ви зайняли *{place} місце* в розіграші "{raffle_title}"
Ваш приз: *{prize_amount} {prize_currency}*

Приз вже нараховано на ваш баланс. 
Поточний баланс: {balance} {prize_currency}

Дякуємо за участь та вітаємо з перемогою! 🎉
""",

    NotificationType.DAILY_REMINDER: """
⏰ *Щоденний розіграш WINIX* ⏰

Не пропустіть можливість взяти участь у щоденному розіграші!

Призовий фонд: {prize_amount} {prize_currency}
Кількість переможців: {winners_count}
До завершення: {time_left}

У вас є {coins} жетонів. Використайте їх зараз і збільшіть свої шанси на перемогу!
""",

    NotificationType.CUSTOM_MESSAGE: "{message}",

    NotificationType.SYSTEM_NOTIFICATION: """
🔔 *WINIX: Системне сповіщення*

{message}

_Час: {time}_
"""
}


class NotifierException(Exception):
    """Базовий клас для винятків в модулі notifier"""
    pass


class TelegramApiException(NotifierException):
    """Виняток, що виникає при помилках Telegram API"""
    pass


class UserNotFoundException(NotifierException):
    """Виняток, що виникає, коли користувача не знайдено"""
    pass


class TemplateFormatException(NotifierException):
    """Виняток, що виникає при помилках форматування шаблону"""
    pass


def send_telegram_message(
        chat_id: str,
        message: str,
        parse_mode: str = "Markdown",
        retry_count: int = 0,
        disable_web_page_preview: bool = True
) -> bool:
    """
    Надійно відправляє повідомлення через Telegram Bot API з повторними спробами.

    Args:
        chat_id: ID чату/користувача в Telegram
        message: Текст повідомлення
        parse_mode: Режим форматування ("Markdown" або "HTML")
        retry_count: Поточна спроба (для внутрішнього використання)
        disable_web_page_preview: Вимкнути попередній перегляд посилань

    Returns:
        bool: True якщо повідомлення успішно відправлено, False інакше
    """
    if not TELEGRAM_BOT_TOKEN:
        logger.warning("TELEGRAM_BOT_TOKEN не налаштовано. Пропускаємо відправку повідомлення.")
        return False

    try:
        url = f"{TELEGRAM_API_URL}/sendMessage"
        payload = {
            "chat_id": chat_id,
            "text": message,
            "parse_mode": parse_mode,
            "disable_web_page_preview": disable_web_page_preview
        }

        response = requests.post(url, json=payload, )

        if response.status_code == 200:
            return True
        else:
            # Обробка типових помилок Telegram API
            try:
                error_data = response.json()
                error_code = error_data.get("error_code", 0)
                error_description = error_data.get("description", "Невідома помилка")

                logger.warning(f"Помилка Telegram API {error_code}: {error_description}")

                # Обробка специфічних помилок
                if error_code == 400 and "parse mode is invalid" in error_description.lower():
                    # Спробуємо відправити без режиму форматування
                    logger.info(f"Спроба відправки повідомлення без форматування для {chat_id}")
                    return send_telegram_message(chat_id, message, parse_mode=None, retry_count=retry_count)

                if error_code == 400 and "chat not found" in error_description.lower():
                    logger.warning(f"Користувач {chat_id} не знайдений в Telegram")
                    return False

                if error_code == 403 and "bot was blocked by the user" in error_description.lower():
                    logger.warning(f"Користувач {chat_id} заблокував бота")
                    return False

            except Exception as parse_error:
                logger.error(f"Помилка парсингу відповіді Telegram API: {parse_error}")

            # Спроба повторити відправку
            if retry_count < MAX_RETRY_ATTEMPTS:
                # Експоненціальне збільшення часу очікування
                delay = 2 ** retry_count
                logger.info(f"Повторна спроба через {delay} секунд...")
                time.sleep(delay)
                return send_telegram_message(chat_id, message, parse_mode, retry_count + 1, disable_web_page_preview)

            return False
    except requests.RequestException as e:
        logger.error(f"Мережева помилка при відправці Telegram повідомлення: {str(e)}")

        # Спроба повторно відправити повідомлення при мережевих помилках
        if retry_count < MAX_RETRY_ATTEMPTS:
            delay = 2 ** retry_count
            logger.info(f"Повторна спроба через {delay} секунд...")
            time.sleep(delay)
            return send_telegram_message(chat_id, message, parse_mode, retry_count + 1, disable_web_page_preview)

        return False
    except Exception as e:
        logger.error(f"Неочікувана помилка при відправці Telegram повідомлення: {str(e)}")
        return False


def send_notification(
        user_id: str,
        notification_type: str,
        data: Dict[str, Any],
        delay: float = 0
) -> bool:
    """
    Відправляє сповіщення конкретному користувачу

    Args:
        user_id: ID користувача Telegram
        notification_type: Тип сповіщення (з NotificationType)
        data: Дані для форматування шаблону повідомлення
        delay: Затримка перед відправкою повідомлення в секундах

    Returns:
        bool: True якщо повідомлення успішно відправлено, False інакше
    """
    try:
        # Отримуємо або створюємо шаблон
        template = MESSAGE_TEMPLATES.get(notification_type)
        if not template:
            # Якщо шаблон не знайдено, використовуємо текст з data['message']
            if "message" in data:
                message = data["message"]
            else:
                raise TemplateFormatException(f"Шаблон для типу {notification_type} не знайдено")
        else:
            # Форматуємо шаблон
            try:
                message = template.format(**data)
            except KeyError as e:
                logger.error(f"Відсутні дані для шаблону {notification_type}: {e}")
                raise TemplateFormatException(f"Помилка форматування шаблону: відсутні дані - {e}")
            except Exception as e:
                logger.error(f"Помилка форматування повідомлення типу {notification_type}: {e}")
                raise TemplateFormatException(f"Помилка форматування шаблону: {e}")

        # Очікуємо затримку, якщо вказана
        if delay > 0:
            time.sleep(delay)

        # Відправляємо повідомлення
        return send_telegram_message(user_id, message)

    except NotifierException as e:
        logger.error(f"Помилка відправки сповіщення для {user_id}: {str(e)}")
        return False
    except Exception as e:
        logger.error(f"Неочікувана помилка при відправці сповіщення для {user_id}: {str(e)}")
        return False


def send_bulk_notification(
        user_ids: List[str],
        notification_type: str,
        data: Dict[str, Any],
        max_users: int = 100
) -> Dict[str, Any]:
    """
    Відправляє масове сповіщення багатьом користувачам

    Args:
        user_ids: Список ID користувачів Telegram
        notification_type: Тип сповіщення (з NotificationType)
        data: Дані для форматування шаблону повідомлення
        max_users: Максимальна кількість користувачів для відправки

    Returns:
        Dict: Результати відправки з лічильниками
    """
    if not user_ids:
        return {
            "status": "error",
            "message": "Не вказано жодного користувача",
            "sent_count": 0,
            "failed_count": 0
        }

    # Обмежуємо кількість користувачів
    if max_users > 0 and len(user_ids) > max_users:
        user_ids = user_ids[:max_users]

    sent_count = 0
    failed_count = 0

    # Відправляємо повідомлення кожному користувачу з затримкою
    for i, user_id in enumerate(user_ids):
        # Перевіряємо коректність ID
        if not user_id or not isinstance(user_id, str):
            failed_count += 1
            continue

        # Розраховуємо затримку для уникнення обмежень API
        delay = i * MIN_TIME_BETWEEN_MESSAGES

        # Відправляємо повідомлення
        if send_notification(user_id, notification_type, data, delay):
            sent_count += 1
        else:
            failed_count += 1

    return {
        "status": "success" if sent_count > 0 else "error",
        "message": f"Відправлено {sent_count} повідомлень, невдало: {failed_count}",
        "sent_count": sent_count,
        "failed_count": failed_count,
        "total_requested": len(user_ids)
    }


def notify_winners(raffle_id: str) -> Dict[str, Any]:
    """
    Відправляє сповіщення переможцям розіграшу

    Args:
        raffle_id: ID розіграшу

    Returns:
        Dict: Результати відправки сповіщень
    """
    try:
        # Отримуємо дані розіграшу
        raffle_response = supabase.table("raffles").select("*").eq("id", raffle_id).execute()
        if not raffle_response.data:
            logger.error(f"Розіграш з ID {raffle_id} не знайдено")
            return {
                "status": "error",
                "message": f"Розіграш не знайдено: {raffle_id}"
            }

        raffle = raffle_response.data[0]

        # Отримуємо переможців
        winners_response = supabase.table("raffle_winners").select("*").eq("raffle_id", raffle_id).order("place").execute()
        if not winners_response.data:
            logger.warning(f"Переможців для розіграшу {raffle_id} не знайдено")
            return {
                "status": "error",
                "message": f"Переможців не знайдено для розіграшу: {raffle_id}"
            }

        success_count = 0
        failed_count = 0

        # Відправляємо сповіщення кожному переможцю
        for winner in winners_response.data:
            winner_id = winner.get("id")
            telegram_id = winner.get("telegram_id")

            if not telegram_id:
                failed_count += 1
                continue

            # Отримуємо баланс користувача для включення в повідомлення
            user = get_user(telegram_id)
            if not user:
                logger.warning(f"Не знайдено користувача {telegram_id} для сповіщення про перемогу")
                failed_count += 1
                continue

            # Додаємо дані про баланс
            balance = user.get("balance", 0)

            # Створюємо дані для повідомлення
            notification_data = {
                "raffle_title": raffle.get("title"),
                "place": winner.get("place"),
                "prize_amount": winner.get("prize_amount"),
                "prize_currency": winner.get("prize_currency", "WINIX"),
                "balance": balance
            }

            # Відправляємо повідомлення з затримкою для уникнення обмежень API
            delay = success_count * MIN_TIME_BETWEEN_MESSAGES
            if send_notification(telegram_id, NotificationType.WINNER_NOTIFICATION, notification_data, delay):
                success_count += 1

                # Оновлюємо статус відправки повідомлення
                supabase.table("raffle_winners").update({
                    "notification_sent": True
                }).eq("id", winner_id).execute()
            else:
                failed_count += 1

        logger.info(f"Відправлено {success_count} повідомлень переможцям розіграшу {raffle_id}")

        return {
            "status": "success" if success_count > 0 else "error",
            "message": f"Відправлено {success_count} повідомлень переможцям, невдало: {failed_count}",
            "sent_count": success_count,
            "failed_count": failed_count,
            "raffle_id": raffle_id,
            "total_winners": len(winners_response.data)
        }
    except Exception as e:
        logger.error(f"Помилка відправки сповіщень переможцям розіграшу {raffle_id}: {str(e)}", exc_info=True)
        return {
            "status": "error",
            "message": f"Помилка відправки сповіщень: {str(e)}",
            "raffle_id": raffle_id
        }


def notify_about_new_raffle(raffle_id: str, max_users: int = 50) -> Dict[str, Any]:
    """
    Відправляє сповіщення про новий розіграш кільком користувачам

    Args:
        raffle_id: ID розіграшу
        max_users: Максимальна кількість користувачів для відправки

    Returns:
        Dict: Результати відправки сповіщень
    """
    try:
        # Отримуємо дані розіграшу
        raffle_response = supabase.table("raffles").select("*").eq("id", raffle_id).execute()
        if not raffle_response.data:
            logger.error(f"Розіграш з ID {raffle_id} не знайдено")
            return {
                "status": "error",
                "message": f"Розіграш не знайдено: {raffle_id}"
            }

        raffle = raffle_response.data[0]

        # Форматуємо дату завершення для повідомлення
        try:
            end_time = datetime.fromisoformat(raffle.get("end_time", "").replace('Z', '+00:00'))
            end_time_str = end_time.strftime("%d.%m.%Y %H:%M")
        except (ValueError, AttributeError):
            logger.warning(f"Помилка форматування часу завершення для розіграшу {raffle_id}")
            end_time_str = "скоро"

        # Створюємо дані для повідомлення
        notification_data = {
            "raffle_title": raffle.get("title"),
            "prize_amount": raffle.get("prize_amount"),
            "prize_currency": raffle.get("prize_currency", "WINIX"),
            "winners_count": raffle.get("winners_count"),
            "entry_fee": raffle.get("entry_fee"),
            "end_time": end_time_str
        }

        # Отримуємо користувачів для розсилки (обмеження для уникнення перенавантаження)
        users_response = supabase.table("winix").select("telegram_id").limit(max_users).execute()
        if not users_response.data:
            logger.warning("Користувачів для розсилки не знайдено")
            return {
                "status": "error",
                "message": "Користувачів для розсилки не знайдено"
            }

        # Отримуємо список telegram_id
        user_ids = [user.get("telegram_id") for user in users_response.data if user.get("telegram_id")]

        # Відправляємо сповіщення
        result = send_bulk_notification(user_ids, NotificationType.RAFFLE_CREATED, notification_data)
        result["raffle_id"] = raffle_id

        logger.info(f"Відправлено {result.get('sent_count')} повідомлень про новий розіграш {raffle_id}")
        return result

    except Exception as e:
        logger.error(f"Помилка відправки сповіщень про новий розіграш {raffle_id}: {str(e)}", exc_info=True)
        return {
            "status": "error",
            "message": f"Помилка відправки сповіщень: {str(e)}",
            "raffle_id": raffle_id
        }


def send_daily_reminder(raffle_id: str = None, max_users: int = 30) -> Dict[str, Any]:
    """
    Відправляє щоденне нагадування про розіграші

    Args:
        raffle_id: ID розіграшу (якщо None, буде вибрано активний щоденний розіграш)
        max_users: Максимальна кількість користувачів для відправки

    Returns:
        Dict: Результати відправки нагадувань
    """
    try:
        # Якщо raffle_id не вказано, отримуємо активний щоденний розіграш
        if not raffle_id:
            raffle_response = supabase.table("raffles").select("*") \
                .eq("is_daily", True) \
                .eq("status", "active") \
                .order("created_at", desc=True) \
                .limit(1) \
                .execute()

            if not raffle_response.data:
                logger.warning("Активний щоденний розіграш не знайдено для відправки нагадування")
                return {
                    "status": "error",
                    "message": "Активний щоденний розіграш не знайдено"
                }

            raffle = raffle_response.data[0]
            raffle_id = raffle.get("id")
        else:
            # Отримуємо вказаний розіграш
            raffle_response = supabase.table("raffles").select("*").eq("id", raffle_id).execute()
            if not raffle_response.data:
                logger.error(f"Розіграш з ID {raffle_id} не знайдено")
                return {
                    "status": "error",
                    "message": f"Розіграш не знайдено: {raffle_id}"
                }

            raffle = raffle_response.data[0]

        # Розраховуємо час, що залишився
        try:
            end_time = datetime.fromisoformat(raffle.get("end_time", "").replace('Z', '+00:00'))
            now = datetime.now(timezone.utc)
            time_left = end_time - now

            hours_left = int(time_left.total_seconds() // 3600)
            minutes_left = int((time_left.total_seconds() % 3600) // 60)

            if hours_left < 0:
                time_left_str = "скоро завершиться"
            else:
                time_left_str = f"{hours_left} год {minutes_left} хв"

        except (ValueError, AttributeError):
            logger.warning(f"Помилка розрахунку часу, що залишився для розіграшу {raffle_id}")
            time_left_str = "скоро завершиться"

        # Отримуємо учасників розіграшу (щоб не відправляти їм нагадування)
        participants_response = supabase.table("raffle_participants") \
            .select("telegram_id") \
            .eq("raffle_id", raffle_id) \
            .execute()

        participant_ids = [p.get("telegram_id") for p in
                           participants_response.data] if participants_response.data else []

        # Отримуємо користувачів, які ще не взяли участь і мають жетони
        query = supabase.table("winix").select("telegram_id,coins")

        if participant_ids:
            query = query.not_.in_("telegram_id", participant_ids)

        query = query.gt("coins", 0).limit(max_users)
        users_response = query.execute()

        if not users_response.data:
            logger.warning("Користувачів для нагадувань не знайдено")
            return {
                "status": "success",
                "message": "Користувачів для нагадувань не знайдено",
                "sent_count": 0,
                "raffle_id": raffle_id
            }

        # Відправляємо персоналізовані нагадування кожному користувачу
        sent_count = 0
        failed_count = 0

        for user in users_response.data:
            telegram_id = user.get("telegram_id")
            coins = user.get("coins", 0)

            if not telegram_id:
                continue

            # Створюємо дані для повідомлення
            notification_data = {
                "prize_amount": raffle.get("prize_amount"),
                "prize_currency": raffle.get("prize_currency", "WINIX"),
                "winners_count": raffle.get("winners_count"),
                "time_left": time_left_str,
                "coins": coins
            }

            # Відправляємо повідомлення з затримкою
            delay = sent_count * MIN_TIME_BETWEEN_MESSAGES
            if send_notification(telegram_id, NotificationType.DAILY_REMINDER, notification_data, delay):
                sent_count += 1
            else:
                failed_count += 1

        logger.info(f"Відправлено {sent_count} нагадувань про розіграш {raffle_id}")

        return {
            "status": "success" if sent_count > 0 else "warning",
            "message": f"Відправлено {sent_count} нагадувань, невдало: {failed_count}",
            "sent_count": sent_count,
            "failed_count": failed_count,
            "raffle_id": raffle_id
        }
    except Exception as e:
        logger.error(f"Помилка відправки нагадувань: {str(e)}", exc_info=True)
        return {
            "status": "error",
            "message": f"Помилка відправки нагадувань: {str(e)}",
            "raffle_id": raffle_id if raffle_id else None
        }


def send_custom_message(user_id: str, message: str) -> bool:
    """
    Відправляє користувацьке повідомлення конкретному користувачу

    Args:
        user_id: ID користувача Telegram
        message: Текст повідомлення

    Returns:
        bool: True якщо повідомлення успішно відправлено, False інакше
    """
    try:
        return send_notification(user_id, NotificationType.CUSTOM_MESSAGE, {"message": message})
    except Exception as e:
        logger.error(f"Помилка відправки користувацького повідомлення для {user_id}: {str(e)}")
        return False


def send_admin_notification(message: str, admin_chat_id: str = None) -> bool:
    """
    Відправляє системне сповіщення адміністратору

    Args:
        message: Текст повідомлення
        admin_chat_id: ID адміністратора (якщо None, використовується з оточення)

    Returns:
        bool: True якщо повідомлення успішно відправлено, False інакше
    """
    if not admin_chat_id:
        admin_chat_id = os.getenv("ADMIN_CHAT_ID", "")

    if not admin_chat_id:
        logger.warning("ADMIN_CHAT_ID не налаштовано. Пропускаємо відправку повідомлення адміністратору.")
        return False

    # Форматуємо системне повідомлення з часом
    notification_data = {
        "message": message,
        "time": datetime.now().strftime("%d.%m.%Y %H:%M:%S")
    }

    return send_notification(admin_chat_id, NotificationType.SYSTEM_NOTIFICATION, notification_data)


# Допоміжна функція для обробки webhook від зовнішніх систем
def process_notification_request(event_type: str, data: Dict[str, Any]) -> Dict[str, Any]:
    """
    Обробляє запит на відправку сповіщень від зовнішніх систем

    Args:
        event_type: Тип події
        data: Дані для обробки

    Returns:
        Dict: Результат обробки
    """
    try:
        logger.info(f"Отримано запит на відправку сповіщення типу: {event_type}")

        if event_type == "raffle_created":
            # Відправка сповіщення про новий розіграш
            raffle_id = data.get("raffle_id")
            max_users = data.get("max_users", 50)

            if not raffle_id:
                return {
                    "status": "error",
                    "message": "Не вказано ID розіграшу"
                }

            # Запускаємо в окремому потоці для асинхронної обробки
            thread = threading.Thread(
                target=lambda: notify_about_new_raffle(raffle_id, max_users),
                daemon=True
            )
            thread.start()

            return {
                "status": "success",
                "message": "Відправку сповіщень про новий розіграш заплановано",
                "raffle_id": raffle_id
            }

        elif event_type == "raffle_completed":
            # Відправка сповіщень переможцям
            raffle_id = data.get("raffle_id")

            if not raffle_id:
                return {
                    "status": "error",
                    "message": "Не вказано ID розіграшу"
                }

            # Запускаємо в окремому потоці для асинхронної обробки
            thread = threading.Thread(
                target=lambda: notify_winners(raffle_id),
                daemon=True
            )
            thread.start()

            return {
                "status": "success",
                "message": "Відправку сповіщень переможцям заплановано",
                "raffle_id": raffle_id
            }

        elif event_type == "daily_reminder":
            # Відправка щоденного нагадування
            raffle_id = data.get("raffle_id")
            max_users = data.get("max_users", 30)

            # Запускаємо в окремому потоці для асинхронної обробки
            thread = threading.Thread(
                target=lambda: send_daily_reminder(raffle_id, max_users),
                daemon=True
            )
            thread.start()

            return {
                "status": "success",
                "message": "Відправку щоденних нагадувань заплановано"
            }

        elif event_type == "custom_message":
            # Відправка користувацького повідомлення
            user_id = data.get("user_id")
            message = data.get("message")

            if not user_id or not message:
                return {
                    "status": "error",
                    "message": "Не вказано ID користувача або текст повідомлення"
                }

            result = send_custom_message(user_id, message)

            return {
                "status": "success" if result else "error",
                "message": "Повідомлення відправлено" if result else "Помилка відправки повідомлення",
                "user_id": user_id
            }

        elif event_type == "admin_notification":
            # Відправка сповіщення адміністратору
            message = data.get("message")
            admin_chat_id = data.get("admin_chat_id")

            if not message:
                return {
                    "status": "error",
                    "message": "Не вказано текст повідомлення"
                }

            result = send_admin_notification(message, admin_chat_id)

            return {
                "status": "success" if result else "error",
                "message": "Повідомлення адміністратору відправлено" if result else "Помилка відправки повідомлення"
            }

        else:
            logger.warning(f"Невідомий тип події: {event_type}")
            return {
                "status": "error",
                "message": f"Невідомий тип події: {event_type}"
            }

    except Exception as e:
        logger.error(f"Помилка обробки запиту на відправку сповіщення: {str(e)}", exc_info=True)
        return {
            "status": "error",
            "message": f"Помилка обробки запиту: {str(e)}"
        }


# Функція для перевірки стану модуля
def check_status() -> Dict[str, Any]:
    """
    Перевіряє стан модуля сповіщень

    Returns:
        Dict: Інформація про стан модуля
    """
    try:
        telegram_configured = bool(TELEGRAM_BOT_TOKEN)

        test_result = None
        if telegram_configured and os.getenv("ADMIN_CHAT_ID"):
            # Відправляємо тестове повідомлення адміністратору (якщо налаштовано)
            test_result = send_admin_notification("Тест з'єднання з Telegram API")

        return {
            "status": "ok",
            "telegram_api_configured": telegram_configured,
            "admin_chat_configured": bool(os.getenv("ADMIN_CHAT_ID")),
            "test_message_sent": test_result,
            "version": "1.0",
            "templates_available": list(MESSAGE_TEMPLATES.keys())
        }
    except Exception as e:
        logger.error(f"Помилка перевірки стану модуля сповіщень: {str(e)}")
        return {
            "status": "error",
            "message": f"Помилка перевірки стану: {str(e)}"
        }


# Код для тестування, якщо скрипт запущено напряму
if __name__ == "__main__":
    logger.info("Запуск модуля сповіщень в режимі тестування")

    status = check_status()
    print(json.dumps(status, indent=2, ensure_ascii=False))

    if status["status"] == "ok" and status["telegram_api_configured"] and status["admin_chat_configured"]:
        print("Модуль сповіщень працює коректно і готовий до використання")
    else:
        print("Модуль сповіщень налаштовано некоректно. Перевірте конфігурацію.")