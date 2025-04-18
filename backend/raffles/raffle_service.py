"""
Сервіс для управління розіграшами, що включає автоматичне створення щоденних розіграшів,
завершення прострочених та відправку повідомлень переможцям.
"""

import os
import sys
import time
import logging
import threading
import schedule
import secrets
import json
import uuid
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, List, Optional

# Налаштування логування
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
                    handlers=[
                        logging.StreamHandler(),
                        logging.FileHandler("raffle_service.log")
                    ])
logger = logging.getLogger(__name__)

# Імпортуємо необхідні модулі
try:
    from ..supabase_client import supabase, get_user, execute_transaction, cache_get, cache_set, clear_cache
    from ..raffles.controllers import finish_raffle, check_and_finish_expired_raffles
except ImportError:
    # Альтернативний імпорт для прямого запуску
    try:
        from supabase_client import supabase, get_user, execute_transaction, cache_get, cache_set, clear_cache
        from raffles.controllers import finish_raffle, check_and_finish_expired_raffles
    except ImportError:
        logger.critical("Помилка імпорту критичних модулів. Сервіс не може бути запущено.")
        sys.exit(1)

# Отримання конфігурації з середовища
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_API_URL = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}"
ADMIN_CHAT_ID = os.getenv("ADMIN_CHAT_ID", "")
MAX_RETRY_ATTEMPTS = 3

# Типи сповіщень
class NotificationType:
    WELCOME = "welcome"
    RAFFLE_START = "raffle_start"
    RAFFLE_END = "raffle_end"
    WINNER = "winner"
    DAILY_REMINDER = "daily_reminder"
    SYSTEM = "system"

# Шаблони повідомлень
MESSAGE_TEMPLATES = {
    NotificationType.WINNER: """
🎉 Вітаємо з перемогою! 🎉

Ви посіли {place} місце в розіграші '{raffle_title}'
Ваш приз: {prize_amount} {prize_currency}

Приз вже нараховано на ваш баланс. Дякуємо за участь!
""",

    NotificationType.DAILY_REMINDER: """
🎮 WINIX: Новий щоденний розіграш 🎮

Сьогоднішній розіграш на {prize_amount} {prize_currency} вже доступний!
15 переможців отримають призи.

Використайте ваші жетони для участі прямо зараз.
""",

    NotificationType.SYSTEM: """
🔔 WINIX: Системне сповіщення

{message}

Час: {time}
"""
}


class WebhookException(Exception):
    """Виняток для помилок webhooks"""
    pass

class TelegramApiException(Exception):
    """Виняток для помилок Telegram API"""
    pass


def send_telegram_message(chat_id: str, message: str, retry_count: int = 0) -> bool:
    """Надійна відправка повідомлення через Telegram Bot API з повторними спробами"""
    if not TELEGRAM_BOT_TOKEN:
        logger.warning("TELEGRAM_BOT_TOKEN не налаштовано. Пропускаємо відправку повідомлення.")
        return False

    try:
        import requests
        url = f"{TELEGRAM_API_URL}/sendMessage"
        payload = {
            "chat_id": chat_id,
            "text": message,
            "parse_mode": "HTML"
        }

        response = requests.post(url, json=payload, )

        if response.status_code == 200:
            return True
        else:
            error_info = response.json() if response.text else {"description": "Немає відповіді"}
            logger.warning(f"Помилка відправки повідомлення: {error_info}")

            # Спроба повторно відправити повідомлення при помилках
            if retry_count < MAX_RETRY_ATTEMPTS:
                # Експоненціальне збільшення часу очікування
                delay = 2 ** retry_count
                logger.info(f"Повторна спроба через {delay} секунд...")
                time.sleep(delay)
                return send_telegram_message(chat_id, message, retry_count + 1)
            return False
    except Exception as e:
        logger.error(f"Мережева помилка при відправці Telegram повідомлення: {str(e)}")

        # Спроба повторно відправити повідомлення при помилках
        if retry_count < MAX_RETRY_ATTEMPTS:
            delay = 2 ** retry_count
            logger.info(f"Повторна спроба через {delay} секунд...")
            time.sleep(delay)
            return send_telegram_message(chat_id, message, retry_count + 1)
        return False


class RaffleServiceState:
    """Клас для збереження стану сервісу"""
    def __init__(self):
        self.active = False
        self.start_time = None
        self.task_statuses = {}
        self.thread = None
        self.notifications_enabled = True
        self.last_backup = None
        self.task_lock = threading.Lock()


class RaffleService:
    """Клас для управління всіма аспектами роботи з розіграшами"""

    def __init__(self):
        self.state = RaffleServiceState()
        self.check_interval = 60  # Перевірка кожну хвилину

    def start(self) -> bool:
        """Запуск сервісу в окремому потоці"""
        if self.state.active:
            logger.warning("Сервіс розіграшів вже запущено")
            return False

        try:
            self.state.active = True
            self.state.start_time = datetime.now().isoformat()
            self.state.thread = threading.Thread(target=self._run_service, daemon=True)
            self.state.thread.start()

            logger.info("✅ Сервіс розіграшів успішно запущено")

            # Відправляємо повідомлення про запуск адміністратору
            if ADMIN_CHAT_ID:
                send_telegram_message(
                    ADMIN_CHAT_ID,
                    f"🎮 Сервіс розіграшів WINIX запущено {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
                )

            return True
        except Exception as e:
            logger.critical(f"Помилка запуску сервісу розіграшів: {str(e)}")
            self.state.active = False
            return False

    def stop(self) -> bool:
        """Зупинка сервісу"""
        if not self.state.active:
            logger.warning("Сервіс розіграшів не запущено")
            return False

        try:
            self.state.active = False
            if self.state.thread:
                self.state.thread.join()

            logger.info("✅ Сервіс розіграшів зупинено")

            # Відправляємо повідомлення про зупинку адміністратору
            if ADMIN_CHAT_ID:
                send_telegram_message(
                    ADMIN_CHAT_ID,
                    f"⚠️ Сервіс розіграшів WINIX зупинено {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}"
                )

            return True
        except Exception as e:
            logger.error(f"Помилка зупинки сервісу розіграшів: {str(e)}")
            return False

    def _run_service(self) -> None:
        """Основний цикл сервісу"""
        logger.info("Запуск основного циклу сервісу розіграшів")

        # Налаштування планувальника
        self._setup_scheduler()

        # Запуск при старті
        self._initial_checks()

        # Основний цикл
        retry_count = 0
        while self.state.active:
            try:
                schedule.run_pending()
                time.sleep(self.check_interval)
                retry_count = 0  # Скидаємо лічильник помилок при успішному циклі
            except Exception as e:
                retry_count += 1
                wait_time = min(300, 30 * retry_count)  # Максимум 5 хвилин очікування

                logger.error(f"Помилка в основному циклі сервісу (спроба {retry_count}): {str(e)}", exc_info=True)

                # Відправляємо повідомлення адміністратору при серйозних проблемах
                if retry_count >= 3 and ADMIN_CHAT_ID:
                    send_telegram_message(
                        ADMIN_CHAT_ID,
                        f"❌ Критична помилка в сервісі розіграшів: {str(e)}\nСпроба відновлення через {wait_time} секунд"
                    )

                # Чекаємо перед повторною спробою
                time.sleep(wait_time)

    def _setup_scheduler(self) -> None:
        """Налаштування планувальника завдань"""
        # Перевірка прострочених розіграшів кожну годину
        schedule.every(1).hour.do(self.run_task, "check_expired_raffles", self.check_expired_raffles)

        # Створення щоденного розіграшу о 12:05 щодня
        schedule.every().day.at("12:05").do(self.run_task, "create_daily_raffle", self.check_and_create_daily_raffle)

        # Відправка повідомлень переможцям кожні 30 хвилин
        schedule.every(30).minutes.do(self.run_task, "send_winner_notifications", self.send_notifications_to_winners)

        # Нагадування про розіграш о 9:00 та 18:00
        schedule.every().day.at("09:00").do(self.run_task, "morning_reminder", self.send_daily_raffle_reminder)
        schedule.every().day.at("18:00").do(self.run_task, "evening_reminder", self.send_daily_raffle_reminder)

        # Резервне копіювання даних розіграшів щодня о 3:00
        schedule.every().day.at("03:00").do(self.run_task, "backup_data", self.backup_raffle_data)

        logger.info("Планувальник успішно налаштовано")

    def run_task(self, task_name: str, task_func) -> Dict[str, Any]:
        """Запуск задачі з логуванням статусу та обробкою помилок"""
        # Запобігаємо одночасному виконанню однієї і тієї ж задачі
        with self.state.task_lock:
            try:
                logger.info(f"Запуск задачі: {task_name}")

                # Фіксуємо початок виконання
                self.state.task_statuses[task_name] = {
                    "start_time": datetime.now().isoformat(),
                    "status": "running"
                }

                # Виконуємо задачу
                result = task_func()

                # Оновлюємо статус
                self.state.task_statuses[task_name] = {
                    "last_run": datetime.now().isoformat(),
                    "status": "success",
                    "result": result
                }

                logger.info(f"Задача {task_name} успішно виконана")
                return result
            except Exception as e:
                logger.error(f"Помилка виконання задачі {task_name}: {str(e)}", exc_info=True)

                # Оновлюємо статус з помилкою
                self.state.task_statuses[task_name] = {
                    "last_run": datetime.now().isoformat(),
                    "status": "error",
                    "error": str(e)
                }

                # Відправляємо повідомлення про помилку адміністратору
                if ADMIN_CHAT_ID:
                    self._send_admin_notification(f"❌ Помилка виконання задачі {task_name}: {str(e)}")

                # Повертаємо None, а не піднімаємо виняток, щоб не зупиняти планувальник
                return {
                    "status": "error",
                    "message": str(e),
                    "task": task_name
                }

    def _initial_checks(self) -> None:
        """Початкові перевірки при запуску сервісу"""
        logger.info("Запуск початкових перевірок")

        # Перевірка прострочених розіграшів
        self.run_task("initial_check_expired", self.check_expired_raffles)

        # Перевірка необхідності створення щоденного розіграшу
        self.run_task("initial_check_daily", self.check_and_create_daily_raffle)

        # Відправка повідомлень переможцям
        self.run_task("initial_send_notifications", self.send_notifications_to_winners)

        # Повідомлення про запуск сервісу
        self._send_admin_notification("🎮 Сервіс розіграшів WINIX запущено")

    def check_expired_raffles(self) -> Dict[str, Any]:
        """Перевірка та завершення прострочених розіграшів"""
        logger.info("Запуск перевірки прострочених розіграшів")

        try:
            result = check_and_finish_expired_raffles()

            if result.get("status") == "success":
                finished_count = result.get("finished_count", 0)
                if finished_count > 0:
                    finished_raffles = result.get("finished_raffles", [])
                    logger.info(f"Успішно завершено {finished_count} розіграшів: {finished_raffles}")

                    # Відправляємо повідомлення адміністратору
                    self._send_admin_notification(f"🏁 Автоматично завершено {finished_count} розіграшів")

                    # Відправляємо повідомлення переможцям
                    self.send_notifications_to_winners()
                else:
                    logger.info("Прострочені розіграші не знайдено")
            else:
                error_message = result.get('message', 'Невідома помилка')
                logger.error(f"Помилка перевірки розіграшів: {error_message}")
                self._send_admin_notification(f"❌ Помилка перевірки розіграшів: {error_message}")

            return result
        except Exception as e:
            logger.error(f"Помилка перевірки прострочених розіграшів: {str(e)}", exc_info=True)
            return {
                "status": "error",
                "message": str(e)
            }

    def send_notifications_to_winners(self) -> Dict[str, Any]:
        """Відправка повідомлень переможцям через Telegram API"""
        if not TELEGRAM_BOT_TOKEN:
            logger.warning("TELEGRAM_BOT_TOKEN не налаштовано. Пропускаємо відправку повідомлень.")
            return {"status": "error", "message": "TELEGRAM_BOT_TOKEN не налаштовано"}

        if not self.state.notifications_enabled:
            logger.info("Сповіщення відключені в налаштуваннях сервісу")
            return {"status": "skipped", "message": "Сповіщення відключені"}

        logger.info("Запуск відправки повідомлень переможцям")

        try:
            # Отримуємо переможців, яким ще не відправлено повідомлення
            winners_response = supabase.table("raffle_winners").select("*").eq("notification_sent", False).execute()

            if not winners_response.data:
                logger.info("Немає переможців, яким потрібно відправити повідомлення")
                return {"status": "success", "message": "Немає повідомлень для відправки", "count": 0}

            # Отримуємо інформацію про розіграші одним запитом
            raffle_ids = list(set([w.get("raffle_id") for w in winners_response.data if w.get("raffle_id")]))
            raffles_response = supabase.table("raffles").select("id,title").in_("id", raffle_ids).execute()

            # Створюємо словник розіграшів за id
            raffles_by_id = {r.get("id"): r for r in raffles_response.data if r.get("id")}

            sent_count = 0
            failed_count = 0

            for winner in winners_response.data:
                winner_id = winner.get("id")
                telegram_id = winner.get("telegram_id")
                raffle_id = winner.get("raffle_id")

                if not telegram_id or not raffle_id:
                    logger.warning(f"Пропускаємо переможця з неповними даними: {winner_id}")
                    continue

                place = winner.get("place")
                prize_amount = winner.get("prize_amount")
                prize_currency = winner.get("prize_currency", "WINIX")

                # Отримуємо назву розіграшу з кешу
                raffle = raffles_by_id.get(raffle_id, {})
                raffle_title = raffle.get("title", "Розіграш")

                # Формуємо повідомлення
                message = MESSAGE_TEMPLATES[NotificationType.WINNER].format(
                    place=place,
                    raffle_title=raffle_title,
                    prize_amount=prize_amount,
                    prize_currency=prize_currency
                )

                # Відправляємо повідомлення
                success = send_telegram_message(telegram_id, message)

                if success:
                    # Оновлюємо статус відправки повідомлення
                    supabase.table("raffle_winners").update({
                        "notification_sent": True
                    }).eq("id", winner_id).execute()

                    sent_count += 1
                    logger.info(f"Відправлено повідомлення переможцю {telegram_id}")
                else:
                    failed_count += 1
                    logger.warning(f"Не вдалося відправити повідомлення переможцю {telegram_id}")

            result = {
                "status": "success",
                "message": f"Відправлено {sent_count} повідомлень, не вдалося відправити {failed_count}",
                "sent_count": sent_count,
                "failed_count": failed_count,
                "total": len(winners_response.data)
            }

            if sent_count > 0:
                self._send_admin_notification(f"📨 Відправлено {sent_count} повідомлень переможцям розіграшів")

            return result
        except Exception as e:
            error_message = f"Помилка відправки повідомлень переможцям: {str(e)}"
            logger.error(error_message, exc_info=True)
            self._send_admin_notification(f"❌ {error_message}")

            return {
                "status": "error",
                "message": error_message,
                "sent_count": 0,
                "failed_count": 0
            }

    def check_and_create_daily_raffle(self) -> Dict[str, Any]:
        """Перевірка необхідності та створення щоденного розіграшу"""
        try:
            logger.info("Перевірка необхідності створення щоденного розіграшу")

            # Перевіряємо, чи є активний щоденний розіграш
            daily_raffles_response = supabase.table("raffles").select("id, end_time").eq("is_daily", True).eq("status", "active").execute()

            if daily_raffles_response.data:
                # Отримуємо дату завершення найпізнішого розіграшу
                latest_raffle = max(daily_raffles_response.data, key=lambda r: r.get("end_time", ""))

                try:
                    end_time = datetime.fromisoformat(latest_raffle.get("end_time", "").replace('Z', '+00:00'))

                    # Якщо розіграш ще не завершився, не створюємо новий
                    now = datetime.now(timezone.utc)
                    if end_time > now:
                        logger.info(f"Активний щоденний розіграш ще не завершено. Завершення: {end_time.isoformat()}")
                        return {
                            "status": "skipped",
                            "message": "Активний щоденний розіграш ще не завершено",
                            "raffle_id": latest_raffle.get("id"),
                            "end_time": end_time.isoformat()
                        }
                except (ValueError, AttributeError):
                    logger.error(f"Помилка конвертації часу завершення розіграшу")

            # Створюємо новий щоденний розіграш
            result = self._create_daily_raffle()

            if result and result.get("status") == "success":
                # Відправляємо повідомлення про новий розіграш
                notification_result = self.send_daily_raffle_notification()
                result["notification"] = notification_result

            return result
        except Exception as e:
            error_message = f"Помилка перевірки щоденного розіграшу: {str(e)}"
            logger.error(error_message, exc_info=True)
            self._send_admin_notification(f"❌ {error_message}")

            return {
                "status": "error",
                "message": error_message
            }

    def _create_daily_raffle(self) -> Dict[str, Any]:
        """Створення нового щоденного розіграшу"""
        try:
            logger.info("Створення нового щоденного розіграшу")

            # Поточний час
            now = datetime.now(timezone.utc)

            # Час закінчення (24 години)
            end_time = now + timedelta(days=1)

            # Генеруємо унікальний ID
            raffle_id = str(uuid.uuid4())

            # Підготовка призового розподілу
            prize_distribution = {
                "1": {"amount": 5000, "currency": "WINIX"},
                "2": {"amount": 3000, "currency": "WINIX"},
                "3": {"amount": 2000, "currency": "WINIX"},
                "4": {"amount": 1000, "currency": "WINIX"},
                "5": {"amount": 1000, "currency": "WINIX"},
                "6": {"amount": 500, "currency": "WINIX"},
                "7": {"amount": 500, "currency": "WINIX"},
                "8": {"amount": 500, "currency": "WINIX"},
                "9": {"amount": 500, "currency": "WINIX"},
                "10": {"amount": 500, "currency": "WINIX"},
                "11": {"amount": 500, "currency": "WINIX"},
                "12": {"amount": 500, "currency": "WINIX"},
                "13": {"amount": 500, "currency": "WINIX"},
                "14": {"amount": 500, "currency": "WINIX"},
                "15": {"amount": 500, "currency": "WINIX"}
            }

            # Дані для щоденного розіграшу
            daily_raffle_data = {
                "id": raffle_id,
                "title": f"Щоденний розіграш {now.strftime('%d.%m.%Y')}",
                "description": "Щоденний розіграш WINIX. 15 переможців отримають призи! Кожен жетон збільшує ваші шанси на перемогу.",
                "prize_amount": 17000,  # Загальна сума призів
                "prize_currency": "WINIX",
                "entry_fee": 1,  # Вартість участі в жетонах
                "start_time": now.isoformat(),
                "end_time": end_time.isoformat(),
                "winners_count": 15,
                "status": "active",
                "is_daily": True,
                "image_url": "assets/daily-prize.png",
                "prize_distribution": prize_distribution,
                "created_by": "system",
                "created_at": now.isoformat(),
                "updated_at": now.isoformat(),
                "participants_count": 0
            }

            # Створюємо розіграш
            response = supabase.table("raffles").insert(daily_raffle_data).execute()

            if response.data:
                logger.info(f"Щоденний розіграш успішно створено з ID: {raffle_id}")
                self._send_admin_notification(
                    f"🎮 Створено новий щоденний розіграш на {daily_raffle_data['prize_amount']} {daily_raffle_data['prize_currency']} (ID: {raffle_id})"
                )

                return {
                    "status": "success",
                    "message": "Щоденний розіграш успішно створено",
                    "raffle_id": raffle_id,
                    "prize_amount": daily_raffle_data['prize_amount'],
                    "prize_currency": daily_raffle_data['prize_currency']
                }
            else:
                logger.error("Не вдалося створити щоденний розіграш")
                self._send_admin_notification(f"❌ Не вдалося створити щоденний розіграш")

                return {
                    "status": "error",
                    "message": "Не вдалося створити щоденний розіграш"
                }
        except Exception as e:
            error_message = f"Помилка створення щоденного розіграшу: {str(e)}"
            logger.error(error_message, exc_info=True)
            self._send_admin_notification(f"❌ {error_message}")

            return {
                "status": "error",
                "message": error_message
            }

    def send_daily_raffle_notification(self) -> Dict[str, Any]:
        """Відправка повідомлення про новий щоденний розіграш"""
        if not TELEGRAM_BOT_TOKEN:
            logger.warning("TELEGRAM_BOT_TOKEN не налаштовано. Пропускаємо відправку повідомлень.")
            return {"status": "error", "message": "TELEGRAM_BOT_TOKEN не налаштовано"}

        if not self.state.notifications_enabled:
            logger.info("Сповіщення відключені в налаштуваннях сервісу")
            return {"status": "skipped", "message": "Сповіщення відключені"}

        try:
            # Отримуємо активний щоденний розіграш
            raffle_response = supabase.table("raffles").select("*") \
                                    .eq("is_daily", True) \
                                    .eq("status", "active") \
                                    .order("created_at", desc=True) \
                                    .limit(1) \
                                    .execute()

            if not raffle_response.data:
                logger.warning("Активний щоденний розіграш не знайдено для відправки повідомлення")
                return {
                    "status": "error",
                    "message": "Активний щоденний розіграш не знайдено"
                }

            raffle = raffle_response.data[0]

            # Формуємо повідомлення
            message = MESSAGE_TEMPLATES[NotificationType.DAILY_REMINDER].format(
                prize_amount=raffle.get("prize_amount"),
                prize_currency=raffle.get("prize_currency", "WINIX")
            )

            # Отримуємо список користувачів для розсилки (обмеження для уникнення перенавантаження)
            users_response = supabase.table("winix").select("telegram_id").limit(100).execute()

            if not users_response.data:
                logger.warning("Користувачів для розсилки не знайдено")
                return {
                    "status": "error",
                    "message": "Користувачів для розсилки не знайдено"
                }

            # Використовуємо криптографічно безпечний вибір користувачів для розсилки
            sample_size = min(50, len(users_response.data))
            selected_indexes = []

            # Створюємо список індексів без повторень
            pool = list(range(len(users_response.data)))
            for _ in range(sample_size):
                if not pool:
                    break
                idx = secrets.randbelow(len(pool))
                selected_indexes.append(pool.pop(idx))

            selected_users = [users_response.data[i] for i in selected_indexes]

            sent_count = 0
            failed_count = 0

            for user in selected_users:
                telegram_id = user.get("telegram_id")
                if not telegram_id:
                    continue

                # Відправляємо повідомлення
                if send_telegram_message(telegram_id, message):
                    sent_count += 1
                else:
                    failed_count += 1

                # Пауза між повідомленнями для уникнення блокування API
                time.sleep(0.1)

            result = {
                "status": "success",
                "message": f"Відправлено {sent_count} повідомлень з {len(selected_users)}",
                "sent_count": sent_count,
                "failed_count": failed_count,
                "raffle_id": raffle.get("id")
            }

            logger.info(f"Відправлено {sent_count} повідомлень про новий щоденний розіграш")
            self._send_admin_notification(f"📢 Відправлено {sent_count} повідомлень про новий щоденний розіграш")

            return result
        except Exception as e:
            error_message = f"Помилка відправки повідомлень про щоденний розіграш: {str(e)}"
            logger.error(error_message, exc_info=True)
            self._send_admin_notification(f"❌ {error_message}")

            return {
                "status": "error",
                "message": error_message
            }

    def send_daily_raffle_reminder(self) -> Dict[str, Any]:
        """Відправка нагадування про поточний розіграш"""
        if not TELEGRAM_BOT_TOKEN:
            logger.warning("TELEGRAM_BOT_TOKEN не налаштовано. Пропускаємо відправку нагадувань.")
            return {"status": "error", "message": "TELEGRAM_BOT_TOKEN не налаштовано"}

        if not self.state.notifications_enabled:
            logger.info("Сповіщення відключені в налаштуваннях сервісу")
            return {"status": "skipped", "message": "Сповіщення відключені"}

        try:
            # Отримуємо активний щоденний розіграш
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

            # Розраховуємо, скільки часу залишилось
            now = datetime.now(timezone.utc)

            try:
                end_time = datetime.fromisoformat(raffle.get("end_time", "").replace('Z', '+00:00'))
                time_left = end_time - now

                hours_left = int(time_left.total_seconds() // 3600)
                minutes_left = int((time_left.total_seconds() % 3600) // 60)

                time_left_str = f"{hours_left} год {minutes_left} хв"
            except (ValueError, AttributeError):
                logger.warning(f"Помилка конвертації часу завершення розіграшу")
                time_left_str = "скоро"

            # Формуємо повідомлення
            message = f"""
🎮 WINIX: Не пропустіть розіграш! 🎮

До завершення розіграшу {raffle.get("title")} залишилось {time_left_str}.

Призовий фонд: {raffle.get("prize_amount")} {raffle.get("prize_currency", "WINIX")}
Кількість переможців: {raffle.get("winners_count")}

Використайте ваші жетони для участі зараз!
"""

            # Отримуємо учасників розіграшу
            participants_response = supabase.table("raffle_participants") \
                                        .select("telegram_id") \
                                        .eq("raffle_id", raffle_id) \
                                        .execute()

            participant_ids = [p.get("telegram_id") for p in participants_response.data] if participants_response.data else []

            # Отримуємо користувачів, які ще не взяли участь
            users_query = supabase.table("winix").select("telegram_id,coins")

            if participant_ids:
                users_query = users_query.not_.in_("telegram_id", participant_ids)

            # Обмежуємо кількість і беремо лише тих, хто має жетони
            users_query = users_query.gt("coins", 0).limit(50)
            users_response = users_query.execute()

            if not users_response.data:
                logger.warning("Користувачів для нагадувань не знайдено")
                return {
                    "status": "success",
                    "message": "Користувачів для нагадувань не знайдено",
                    "sent_count": 0
                }

            # Використовуємо криптографічно безпечний вибір користувачів для розсилки
            sample_size = min(20, len(users_response.data))
            selected_indexes = []

            # Створюємо список індексів без повторень
            pool = list(range(len(users_response.data)))
            for _ in range(sample_size):
                if not pool:
                    break
                idx = secrets.randbelow(len(pool))
                selected_indexes.append(pool.pop(idx))

            selected_users = [users_response.data[i] for i in selected_indexes]

            sent_count = 0
            for user in selected_users:
                telegram_id = user.get("telegram_id")
                coins = user.get("coins", 0)

                if not telegram_id:
                    continue

                # Персоналізуємо повідомлення
                personalized_message = message + f"\n\nУ вас є {coins} жетонів. Використайте їх для збільшення шансів на перемогу!"

                # Відправляємо повідомлення
                if send_telegram_message(telegram_id, personalized_message):
                    sent_count += 1

                # Пауза між повідомленнями для уникнення блокування API
                time.sleep(0.1)

            logger.info(f"Відправлено {sent_count} нагадувань про розіграш")

            result = {
                "status": "success",
                "message": f"Відправлено {sent_count} нагадувань з {len(selected_users)}",
                "sent_count": sent_count,
                "raffle_id": raffle_id
            }

            if sent_count > 0:
                self._send_admin_notification(f"⏰ Відправлено {sent_count} нагадувань про активний розіграш")

            return result
        except Exception as e:
            error_message = f"Помилка відправки нагадувань про розіграш: {str(e)}"
            logger.error(error_message, exc_info=True)
            self._send_admin_notification(f"❌ {error_message}")

            return {
                "status": "error",
                "message": error_message
            }

    def backup_raffle_data(self) -> Dict[str, Any]:
        """Резервне копіювання даних розіграшів"""
        try:
            logger.info("Створення резервної копії даних розіграшів")

            # Створюємо директорію для резервних копій, якщо вона не існує
            backup_dir = os.path.join(os.getcwd(), "backups")
            os.makedirs(backup_dir, exist_ok=True)

            # Поточна дата для імені файлу
            today = datetime.now().strftime('%Y-%m-%d')

            # Отримуємо дані розіграшів з обмеженнями кількості записів
            raffles_response = supabase.table("raffles").select("*").limit(1000).execute()
            participants_response = supabase.table("raffle_participants").select("*").limit(1000).execute()
            winners_response = supabase.table("raffle_winners").select("*").limit(1000).execute()

            # Створюємо структуру даних для резервної копії
            backup_data = {
                "timestamp": datetime.now().isoformat(),
                "raffles": raffles_response.data if raffles_response.data else [],
                "participants": participants_response.data if participants_response.data else [],
                "winners": winners_response.data if winners_response.data else []
            }

            # Зберігаємо в файл з використанням криптографічно безпечного ідентифікатора
            backup_id = secrets.token_hex(8)
            backup_file = os.path.join(backup_dir, f"raffles_backup_{today}_{backup_id}.json")

            with open(backup_file, 'w', encoding='utf-8') as f:
                json.dump(backup_data, f, ensure_ascii=False, indent=2)

            # Зберігаємо час останнього резервного копіювання
            self.state.last_backup = datetime.now().isoformat()

            logger.info(f"Резервну копію даних розіграшів створено: {backup_file}")

            backup_info = {
                "status": "success",
                "message": "Резервну копію даних розіграшів створено",
                "file": backup_file,
                "timestamp": datetime.now().isoformat(),
                "raffles_count": len(backup_data['raffles']),
                "participants_count": len(backup_data['participants']),
                "winners_count": len(backup_data['winners'])
            }

            self._send_admin_notification(
                f"💾 Створено резервну копію даних розіграшів: {len(backup_data['raffles'])} розіграшів, "
                f"{len(backup_data['participants'])} учасників, {len(backup_data['winners'])} переможців"
            )

            # Видаляємо старі резервні копії (старші 30 днів)
            self._cleanup_old_backups(backup_dir)

            return backup_info
        except Exception as e:
            error_message = f"Помилка створення резервної копії: {str(e)}"
            logger.error(error_message, exc_info=True)
            self._send_admin_notification(f"❌ {error_message}")

            return {
                "status": "error",
                "message": error_message
            }

    def _cleanup_old_backups(self, backup_dir: str, days_to_keep: int = 30) -> Dict[str, Any]:
        """Видалення старих резервних копій"""
        try:
            # Поточна дата
            now = datetime.now()

            # Перевіряємо всі файли в директорії резервних копій
            deleted_count = 0
            for filename in os.listdir(backup_dir):
                filepath = os.path.join(backup_dir, filename)

                # Пропускаємо директорії
                if os.path.isdir(filepath):
                    continue

                # Перевіряємо, чи файл є резервною копією розіграшів
                if not filename.startswith("raffles_backup_"):
                    continue

                # Отримуємо час модифікації файлу
                file_time = datetime.fromtimestamp(os.path.getmtime(filepath))

                # Видаляємо файл, якщо він старший за вказану кількість днів
                if (now - file_time).days > days_to_keep:
                    os.remove(filepath)
                    deleted_count += 1
                    logger.info(f"Видалено стару резервну копію: {filename}")

            return {
                "status": "success",
                "message": f"Видалено {deleted_count} старих резервних копій",
                "deleted_count": deleted_count
            }
        except Exception as e:
            logger.error(f"Помилка при очищенні старих резервних копій: {str(e)}")
            return {
                "status": "error",
                "message": f"Помилка при очищенні старих резервних копій: {str(e)}"
            }

    def _send_admin_notification(self, message: str) -> bool:
        """Відправка повідомлення адміністратору"""
        if not ADMIN_CHAT_ID:
            logger.warning("ADMIN_CHAT_ID не налаштовано. Пропускаємо відправку повідомлення адміністратору.")
            return False

        if not self.state.notifications_enabled:
            logger.info("Сповіщення відключені в налаштуваннях сервісу")
            return False

        # Форматуємо системне повідомлення з часом
        formatted_message = MESSAGE_TEMPLATES[NotificationType.SYSTEM].format(
            message=message,
            time=datetime.now().strftime("%d.%m.%Y %H:%M:%S")
        )

        return send_telegram_message(ADMIN_CHAT_ID, formatted_message)

    def toggle_notifications(self, enabled: bool = True) -> Dict[str, Any]:
        """Вмикає або вимикає сповіщення"""
        previous_state = self.state.notifications_enabled
        self.state.notifications_enabled = enabled

        logger.info(f"Сповіщення {'увімкнено' if enabled else 'вимкнено'}")

        if enabled and not previous_state:
            self._send_admin_notification("🔔 Сповіщення увімкнено")

        return {
            "status": "success",
            "notifications_enabled": enabled,
            "previous_state": previous_state
        }

    def get_status(self) -> Dict[str, Any]:
        """Отримання статусу сервісу розіграшів"""
        try:
            # Отримуємо інформацію про активні розіграші
            active_raffles_response = supabase.table("raffles").select("id,title,end_time").eq("status",
                                                                                               "active").execute()
            active_raffles = active_raffles_response.data if active_raffles_response.data else []

            # Отримуємо статус останніх завдань
            task_statuses = {k: v for k, v in self.state.task_statuses.items()}

            return {
                "status": "running" if self.state.active else "stopped",
                "start_time": self.state.start_time,
                "active_raffles_count": len(active_raffles),
                "active_raffles": active_raffles,
                "task_statuses": task_statuses,
                "notifications_enabled": self.state.notifications_enabled,
                "last_backup": self.state.last_backup
            }
        except Exception as e:
            logger.error(f"Помилка отримання статусу сервісу: {str(e)}")
            return {
                "status": "error",
                "message": f"Помилка отримання статусу: {str(e)}"
            }


# Створення єдиного екземпляру сервісу (Singleton)
_raffle_service_instance = None


def get_raffle_service() -> RaffleService:
    """Отримання екземпляру сервісу розіграшів (Singleton)"""
    global _raffle_service_instance
    if _raffle_service_instance is None:
        _raffle_service_instance = RaffleService()
    return _raffle_service_instance


# Функції для зручності використання
def start_raffle_service() -> bool:
    """Запуск сервісу розіграшів"""
    service = get_raffle_service()
    return service.start()


def stop_raffle_service() -> bool:
    """Зупинка сервісу розіграшів"""
    service = get_raffle_service()
    return service.stop()


def get_raffle_service_status() -> Dict[str, Any]:
    """Отримання статусу сервісу розіграшів"""
    service = get_raffle_service()
    return service.get_status()


def toggle_notifications(enabled: bool = True) -> Dict[str, Any]:
    """Вмикає або вимикає сповіщення"""
    service = get_raffle_service()
    return service.toggle_notifications(enabled)


# Базовий метод для обробки веб-хуків від зовнішніх систем
def process_webhook(event_type: str, data: Dict[str, Any]) -> Dict[str, Any]:
    """Обробка вхідних веб-хуків від зовнішніх систем"""
    try:
        logger.info(f"Отримано webhook подію: {event_type}")
        service = get_raffle_service()

        if event_type == "raffle_created":
            # Відправка сповіщення про новий розіграш
            raffle_id = data.get("raffle_id")
            if raffle_id:
                # Запускаємо асинхронно в окремому потоці
                threading.Thread(
                    target=lambda: service.send_daily_raffle_notification(),
                    daemon=True
                ).start()
                return {"status": "success", "message": "Сповіщення про новий розіграш заплановано"}

        elif event_type == "raffle_completed":
            # Відправка сповіщень переможцям
            raffle_id = data.get("raffle_id")
            if raffle_id:
                threading.Thread(
                    target=lambda: service.send_notifications_to_winners(),
                    daemon=True
                ).start()
                return {"status": "success", "message": "Сповіщення переможцям заплановано"}

        elif event_type == "toggle_notifications":
            # Вмикання/вимикання сповіщень
            enabled = data.get("enabled", True)
            return toggle_notifications(enabled)

        else:
            logger.warning(f"Невідомий тип події: {event_type}")
            return {"status": "error", "message": "Невідомий тип події"}

    except Exception as e:
        logger.error(f"Помилка обробки webhook: {str(e)}", exc_info=True)
        return {"status": "error", "message": str(e)}


# Запуск сервісу, якщо скрипт запущено напряму
if __name__ == "__main__":
    logger.info("Запуск сервісу розіграшів як окремого процесу")
    start_raffle_service()

    try:
        # Утримуємо головний потік
        while True:
            time.sleep(1)
    except KeyboardInterrupt:
        logger.info("Отримано сигнал завершення роботи")
        stop_raffle_service()