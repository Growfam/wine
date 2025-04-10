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
import requests
import random
import json
from datetime import datetime, timezone, timedelta

# Налаштування логування
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s [%(levelname)s] %(name)s: %(message)s',
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler("raffle_service.log")
    ]
)
logger = logging.getLogger(__name__)

# Додаємо кореневу папку бекенду до шляху Python для імпортів
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
if parent_dir not in sys.path:
    sys.path.append(parent_dir)

# Імпортуємо необхідні модулі
try:
    from supabase_client import supabase, get_user
    from raffles.controllers import finish_raffle, check_and_finish_expired_raffles
except ImportError:
    logger.critical("Помилка імпорту критичних модулів. Сервіс не може бути запущено.")
    sys.exit(1)

# Отримання конфігурації з середовища
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")
TELEGRAM_API_URL = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}"
ADMIN_CHAT_ID = os.getenv("ADMIN_CHAT_ID", "")

# Шаблони повідомлень
WINNER_MESSAGE_TEMPLATE = """
🎉 Вітаємо з перемогою! 🎉

Ви посіли {place} місце в розіграші '{raffle_title}'
Ваш приз: {prize_amount} {prize_currency}

Приз вже нараховано на ваш баланс. Дякуємо за участь!
"""

DAILY_RAFFLE_NOTIFICATION = """
🎮 WINIX: Новий щоденний розіграш 🎮

Сьогоднішній розіграш на {prize_amount} {prize_currency} вже доступний!
15 переможців отримають призи.

Використайте ваші жетони для участі прямо зараз.
"""


class RaffleService:
    """Клас для управління всіма аспектами роботи з розіграшами"""

    def __init__(self):
        self.active = False
        self.thread = None
        self.check_interval = 60  # Перевірка кожну хвилину

    def start(self):
        """Запуск сервісу в окремому потоці"""
        if self.active:
            logger.warning("Сервіс розіграшів вже запущено")
            return False

        self.active = True
        self.thread = threading.Thread(target=self._run_service)
        self.thread.daemon = True
        self.thread.start()

        logger.info("✅ Сервіс розіграшів успішно запущено")
        return True

    def stop(self):
        """Зупинка сервісу"""
        if not self.active:
            logger.warning("Сервіс розіграшів не запущено")
            return False

        self.active = False
        if self.thread:
            self.thread.join(timeout=5.0)

        logger.info("✅ Сервіс розіграшів зупинено")
        return True

    def _run_service(self):
        """Основний цикл сервісу"""
        logger.info("Запуск основного циклу сервісу розіграшів")

        # Налаштування планувальника
        self._setup_scheduler()

        # Запуск при старті
        self._initial_checks()

        # Основний цикл
        while self.active:
            try:
                schedule.run_pending()
                time.sleep(self.check_interval)
            except Exception as e:
                logger.error(f"Помилка в основному циклі сервісу: {str(e)}", exc_info=True)
                # Чекаємо перед повторною спробою
                time.sleep(300)

    def _setup_scheduler(self):
        """Налаштування планувальника завдань"""
        # Перевірка прострочених розіграшів кожну годину
        schedule.every(1).hour.do(self.check_expired_raffles)

        # Створення щоденного розіграшу о 12:05 щодня
        schedule.every().day.at("12:05").do(self.check_and_create_daily_raffle)

        # Відправка повідомлень переможцям кожні 30 хвилин
        schedule.every(30).minutes.do(self.send_notifications_to_winners)

        # Нагадування про розіграш о 9:00 та 18:00
        schedule.every().day.at("09:00").do(self.send_daily_raffle_reminder)
        schedule.every().day.at("18:00").do(self.send_daily_raffle_reminder)

        # Резервне копіювання даних розіграшів щодня о 3:00
        schedule.every().day.at("03:00").do(self.backup_raffle_data)

        logger.info("Планувальник успішно налаштовано")

    def _initial_checks(self):
        """Початкові перевірки при запуску сервісу"""
        logger.info("Запуск початкових перевірок")

        # Перевірка прострочених розіграшів
        self.check_expired_raffles()

        # Перевірка необхідності створення щоденного розіграшу
        self.check_and_create_daily_raffle()

        # Відправка повідомлень переможцям
        self.send_notifications_to_winners()

        # Повідомлення про запуск сервісу
        self._send_admin_notification("🎮 Сервіс розіграшів WINIX запущено")

    def check_expired_raffles(self):
        """Перевірка та завершення прострочених розіграшів"""
        try:
            logger.info("Запуск перевірки прострочених розіграшів")
            result = check_and_finish_expired_raffles()

            if result.get("status") == "success":
                finished_count = result.get("finished_count", 0)
                if finished_count > 0:
                    logger.info(f"Успішно завершено {finished_count} розіграшів")

                    # Відправляємо повідомлення адміністратору
                    self._send_admin_notification(f"🏁 Автоматично завершено {finished_count} розіграшів")

                    # Відправляємо повідомлення переможцям
                    self.send_notifications_to_winners()
                else:
                    logger.info("Прострочені розіграші не знайдено")
            else:
                logger.error(f"Помилка перевірки розіграшів: {result.get('message', 'Невідома помилка')}")
                self._send_admin_notification(
                    f"❌ Помилка перевірки розіграшів: {result.get('message', 'Невідома помилка')}")
        except Exception as e:
            logger.error(f"Критична помилка при перевірці розіграшів: {str(e)}", exc_info=True)
            self._send_admin_notification(f"❌ Критична помилка при перевірці розіграшів: {str(e)}")

    def send_notifications_to_winners(self):
        """Відправка повідомлень переможцям через Telegram Bot API"""
        try:
            if not TELEGRAM_BOT_TOKEN:
                logger.warning("TELEGRAM_BOT_TOKEN не налаштовано. Пропускаємо відправку повідомлень.")
                return

            logger.info("Запуск відправки повідомлень переможцям")

            # Отримуємо переможців, яким ще не відправлено повідомлення
            winners_response = supabase.table("raffle_winners").select("*").eq("notification_sent", False).execute()

            if not winners_response.data:
                logger.info("Немає переможців, яким потрібно відправити повідомлення")
                return

            sent_count = 0
            for winner in winners_response.data:
                telegram_id = winner.get("telegram_id")
                raffle_id = winner.get("raffle_id")
                place = winner.get("place")
                prize_amount = winner.get("prize_amount")
                prize_currency = winner.get("prize_currency", "WINIX")

                # Отримуємо дані розіграшу
                raffle_response = supabase.table("raffles").select("title").eq("id", raffle_id).execute()
                raffle_title = raffle_response.data[0].get("title", "Розіграш") if raffle_response.data else "Розіграш"

                # Формуємо повідомлення
                message = WINNER_MESSAGE_TEMPLATE.format(
                    place=place,
                    raffle_title=raffle_title,
                    prize_amount=prize_amount,
                    prize_currency=prize_currency
                )

                # Відправляємо повідомлення
                success = self._send_telegram_message(telegram_id, message)

                if success:
                    # Оновлюємо статус відправки повідомлення
                    supabase.table("raffle_winners").update({
                        "notification_sent": True
                    }).eq("id", winner.get("id")).execute()

                    sent_count += 1
                    logger.info(f"Відправлено повідомлення переможцю {telegram_id}")
                else:
                    logger.warning(f"Не вдалося відправити повідомлення переможцю {telegram_id}")

            logger.info(f"Відправлено повідомлень: {sent_count} з {len(winners_response.data)}")
            if sent_count > 0:
                self._send_admin_notification(f"📨 Відправлено {sent_count} повідомлень переможцям розіграшів")
        except Exception as e:
            logger.error(f"Помилка відправки повідомлень переможцям: {str(e)}", exc_info=True)
            self._send_admin_notification(f"❌ Помилка відправки повідомлень переможцям: {str(e)}")

    def check_and_create_daily_raffle(self):
        """Перевірка необхідності та створення щоденного розіграшу"""
        try:
            logger.info("Перевірка необхідності створення щоденного розіграшу")

            # Перевіряємо, чи є активний щоденний розіграш
            daily_raffles_response = supabase.table("raffles").select("id, end_time").eq("is_daily", True).eq("status",
                                                                                                              "active").execute()

            if daily_raffles_response.data:
                # Отримуємо дату завершення найпізнішого розіграшу
                latest_raffle = max(daily_raffles_response.data, key=lambda r: r.get("end_time", ""))
                end_time = datetime.fromisoformat(latest_raffle.get("end_time").replace('Z', '+00:00'))

                # Якщо розіграш ще не завершився, не створюємо новий
                now = datetime.now(timezone.utc)
                if end_time > now:
                    logger.info(f"Активний щоденний розіграш ще не завершено. Завершення: {end_time.isoformat()}")
                    return

            # Створюємо новий щоденний розіграш
            result = self._create_daily_raffle()
            if result:
                # Відправляємо повідомлення про новий розіграш
                self.send_daily_raffle_notification()
        except Exception as e:
            logger.error(f"Помилка перевірки щоденного розіграшу: {str(e)}", exc_info=True)
            self._send_admin_notification(f"❌ Помилка перевірки щоденного розіграшу: {str(e)}")

    def _create_daily_raffle(self):
        """Створення нового щоденного розіграшу"""
        try:
            logger.info("Створення нового щоденного розіграшу")

            # Поточний час
            now = datetime.now(timezone.utc)

            # Час закінчення (24 години)
            end_time = now + timedelta(days=1)

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
                "updated_at": now.isoformat()
            }

            # Створюємо розіграш
            response = supabase.table("raffles").insert(daily_raffle_data).execute()

            if response.data:
                raffle_id = response.data[0].get('id')
                logger.info(f"Щоденний розіграш успішно створено з ID: {raffle_id}")
                self._send_admin_notification(
                    f"🎮 Створено новий щоденний розіграш на {daily_raffle_data['prize_amount']} {daily_raffle_data['prize_currency']} (ID: {raffle_id})")
                return raffle_id
            else:
                logger.error("Не вдалося створити щоденний розіграш")
                self._send_admin_notification(f"❌ Не вдалося створити щоденний розіграш")
                return None
        except Exception as e:
            logger.error(f"Помилка створення щоденного розіграшу: {str(e)}", exc_info=True)
            self._send_admin_notification(f"❌ Помилка створення щоденного розіграшу: {str(e)}")
            return None

    def send_daily_raffle_notification(self):
        """Відправка повідомлення про новий щоденний розіграш"""
        try:
            if not TELEGRAM_BOT_TOKEN:
                logger.warning("TELEGRAM_BOT_TOKEN не налаштовано. Пропускаємо відправку повідомлень.")
                return

            # Отримуємо активний щоденний розіграш
            raffle_response = supabase.table("raffles").select("*").eq("is_daily", True).eq("status", "active").order(
                "created_at", desc=True).limit(1).execute()

            if not raffle_response.data:
                logger.warning("Активний щоденний розіграш не знайдено для відправки повідомлення")
                return

            raffle = raffle_response.data[0]

            # Формуємо повідомлення
            message = DAILY_RAFFLE_NOTIFICATION.format(
                prize_amount=raffle.get("prize_amount"),
                prize_currency=raffle.get("prize_currency", "WINIX")
            )

            # Отримуємо список користувачів для розсилки (обмеження 100 для уникнення перенавантаження)
            users_response = supabase.table("winix").select("telegram_id").limit(100).execute()

            if not users_response.data:
                logger.warning("Користувачів для розсилки не знайдено")
                return

            sent_count = 0
            for user in users_response.data:
                telegram_id = user.get("telegram_id")

                # Відправляємо повідомлення
                if self._send_telegram_message(telegram_id, message):
                    sent_count += 1

            logger.info(f"Відправлено {sent_count} повідомлень про новий щоденний розіграш")
            self._send_admin_notification(f"📢 Відправлено {sent_count} повідомлень про новий щоденний розіграш")
        except Exception as e:
            logger.error(f"Помилка відправки повідомлень про щоденний розіграш: {str(e)}", exc_info=True)
            self._send_admin_notification(f"❌ Помилка відправки повідомлень про щоденний розіграш: {str(e)}")

    def send_daily_raffle_reminder(self):
        """Відправка нагадування про поточний розіграш"""
        try:
            if not TELEGRAM_BOT_TOKEN:
                logger.warning("TELEGRAM_BOT_TOKEN не налаштовано. Пропускаємо відправку нагадувань.")
                return

            # Отримуємо активний щоденний розіграш
            raffle_response = supabase.table("raffles").select("*").eq("is_daily", True).eq("status", "active").order(
                "created_at", desc=True).limit(1).execute()

            if not raffle_response.data:
                logger.warning("Активний щоденний розіграш не знайдено для відправки нагадування")
                return

            raffle = raffle_response.data[0]

            # Розраховуємо, скільки часу залишилось
            now = datetime.now(timezone.utc)
            end_time = datetime.fromisoformat(raffle.get("end_time").replace('Z', '+00:00'))
            time_left = end_time - now

            hours_left = int(time_left.total_seconds() // 3600)
            minutes_left = int((time_left.total_seconds() % 3600) // 60)

            # Формуємо повідомлення
            message = f"""
🎮 WINIX: Не пропустіть розіграш! 🎮

До завершення розіграшу {raffle.get("title")} залишилось {hours_left} год {minutes_left} хв.

Призовий фонд: {raffle.get("prize_amount")} {raffle.get("prize_currency", "WINIX")}
Кількість переможців: {raffle.get("winners_count")}

Використайте ваші жетони для участі зараз!
"""

            # Отримуємо список користувачів, які ще НЕ взяли участь у цьому розіграші
            # Спочатку знаходимо тих, хто вже бере участь
            participants_response = supabase.table("raffle_participants").select("telegram_id").eq("raffle_id",
                                                                                                   raffle.get(
                                                                                                       "id")).execute()

            participant_ids = [p.get("telegram_id") for p in
                               participants_response.data] if participants_response.data else []

            # Тепер отримуємо користувачів, які не є в списку учасників (обмеження 50 для уникнення перенавантаження)
            users_query = supabase.table("winix").select("telegram_id")

            if participant_ids:
                users_query = users_query.not_.in_("telegram_id", participant_ids)

            users_response = users_query.limit(50).execute()

            if not users_response.data:
                logger.warning("Користувачів для розсилки нагадувань не знайдено")
                return

            # Відправляємо нагадування випадковій підмножині користувачів
            sample_size = min(20, len(users_response.data))  # Максимум 20 повідомлень за раз
            selected_users = random.sample(users_response.data, sample_size)

            sent_count = 0
            for user in selected_users:
                telegram_id = user.get("telegram_id")

                # Відправляємо повідомлення
                if self._send_telegram_message(telegram_id, message):
                    sent_count += 1

            logger.info(f"Відправлено {sent_count} нагадувань про розіграш")
            self._send_admin_notification(f"⏰ Відправлено {sent_count} нагадувань про активний розіграш")
        except Exception as e:
            logger.error(f"Помилка відправки нагадувань про розіграш: {str(e)}", exc_info=True)
            self._send_admin_notification(f"❌ Помилка відправки нагадувань про розіграш: {str(e)}")

    def backup_raffle_data(self):
        """Резервне копіювання даних розіграшів"""
        try:
            logger.info("Створення резервної копії даних розіграшів")

            # Створюємо директорію для резервних копій, якщо вона не існує
            backup_dir = os.path.join(current_dir, "backups")
            os.makedirs(backup_dir, exist_ok=True)

            # Поточна дата для імені файлу
            today = datetime.now().strftime('%Y-%m-%d')

            # Отримуємо дані розіграшів
            raffles_response = supabase.table("raffles").select("*").execute()
            participants_response = supabase.table("raffle_participants").select("*").execute()
            winners_response = supabase.table("raffle_winners").select("*").execute()

            # Створюємо структуру даних для резервної копії
            backup_data = {
                "timestamp": datetime.now().isoformat(),
                "raffles": raffles_response.data if raffles_response.data else [],
                "participants": participants_response.data if participants_response.data else [],
                "winners": winners_response.data if winners_response.data else []
            }

            # Зберігаємо в файл
            backup_file = os.path.join(backup_dir, f"raffles_backup_{today}.json")
            with open(backup_file, 'w', encoding='utf-8') as f:
                json.dump(backup_data, f, ensure_ascii=False, indent=2)

            logger.info(f"Резервну копію даних розіграшів створено: {backup_file}")
            self._send_admin_notification(
                f"💾 Створено резервну копію даних розіграшів: {len(backup_data['raffles'])} розіграшів, {len(backup_data['participants'])} учасників, {len(backup_data['winners'])} переможців")

            # Видаляємо старі резервні копії (старші 30 днів)
            self._cleanup_old_backups(backup_dir)
        except Exception as e:
            logger.error(f"Помилка створення резервної копії: {str(e)}", exc_info=True)
            self._send_admin_notification(f"❌ Помилка створення резервної копії даних розіграшів: {str(e)}")

    def _cleanup_old_backups(self, backup_dir, days_to_keep=30):
        """Видалення старих резервних копій"""
        try:
            # Поточна дата
            now = datetime.now()

            # Перевіряємо всі файли в директорії резервних копій
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
                    logger.info(f"Видалено стару резервну копію: {filename}")
        except Exception as e:
            logger.error(f"Помилка при очищенні старих резервних копій: {str(e)}")

    def _send_telegram_message(self, telegram_id, message):
        """Відправка повідомлення через Telegram Bot API"""
        try:
            if not TELEGRAM_BOT_TOKEN:
                logger.warning("TELEGRAM_BOT_TOKEN не налаштовано. Пропускаємо відправку повідомлення.")
                return False

            url = f"{TELEGRAM_API_URL}/sendMessage"
            payload = {
                "chat_id": telegram_id,
                "text": message,
                "parse_mode": "HTML"
            }

            response = requests.post(url, json=payload, timeout=10)

            if response.status_code == 200:
                return True
            else:
                logger.error(f"Помилка відправки повідомлення: {response.text}")
                return False
        except Exception as e:
            logger.error(f"Помилка при відправці Telegram повідомлення: {str(e)}")
            return False

    def _send_admin_notification(self, message):
        """Відправка повідомлення адміністратору"""
        if not ADMIN_CHAT_ID:
            logger.warning("ADMIN_CHAT_ID не налаштовано. Пропускаємо відправку повідомлення адміністратору.")
            return False

        return self._send_telegram_message(ADMIN_CHAT_ID, message)


# Створення екземпляру сервісу
raffle_service = RaffleService()


# Функція для запуску сервісу
def start_raffle_service():
    """Запуск сервісу розіграшів"""
    return raffle_service.start()


# Функція для зупинки сервісу
def stop_raffle_service():
    """Зупинка сервісу розіграшів"""
    return raffle_service.stop()


# Якщо скрипт запущено напряму
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