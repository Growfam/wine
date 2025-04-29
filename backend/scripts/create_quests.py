"""
Скрипт для створення завдань у системі WINIX з обходом RLS Supabase.
"""
import sys
import os
import json
import logging
import getpass
from datetime import datetime, timedelta
from supabase import create_client

# Налаштування логування
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Додаємо поточну директорію до шляху Python
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)  # backend/
if parent_dir not in sys.path:
    sys.path.append(parent_dir)

# Отримуємо дані з .env файлу, якщо він є
from dotenv import load_dotenv

load_dotenv()

# Константи для Supabase
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_ANON_KEY = os.getenv("SUPABASE_ANON_KEY")
SUPABASE_SERVICE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

# Перевіряємо наявність сервісного ключа
if not SUPABASE_SERVICE_KEY:
    logger.warning("SUPABASE_SERVICE_KEY не знайдено в змінних середовища!")
    SUPABASE_SERVICE_KEY = getpass.getpass("Введіть сервісний ключ Supabase (service_role key): ")

# Створюємо клієнт з сервісним ключем для обходу RLS
if SUPABASE_URL and SUPABASE_SERVICE_KEY:
    try:
        supabase = create_client(SUPABASE_URL, SUPABASE_SERVICE_KEY)
        logger.info("✅ Успішне підключення до Supabase з сервісним ключем")

        # Перевіряємо доступ до таблиці tasks
        try:
            response = supabase.table("tasks").select("count").limit(1).execute()
            logger.info("Успішне підключення до Supabase з сервісним ключем. Доступ до таблиці tasks перевірено.")
        except Exception as e:
            logger.error(f"Помилка доступу до таблиці tasks: {str(e)}")
    except Exception as e:
        logger.error(f"❌ Помилка підключення до Supabase: {str(e)}")
        supabase = None
else:
    logger.error("❌ Відсутні змінні середовища SUPABASE_URL або SUPABASE_SERVICE_KEY")
    supabase = None


def create_task_direct(task_data):
    """
    Створює завдання напряму через Supabase API з обходом RLS.

    Args:
        task_data (dict): Дані завдання

    Returns:
        dict: Створене завдання або None у випадку помилки
    """
    try:
        if not supabase:
            logger.error("Не вдалося підключитися до Supabase")
            return None

        # Якщо id не вказано, генеруємо його
        if "id" not in task_data:
            from uuid import uuid4
            task_data["id"] = str(uuid4())

        # Додаємо часові поля, якщо їх немає
        now = datetime.now().isoformat()
        if "created_at" not in task_data:
            task_data["created_at"] = now
        if "updated_at" not in task_data:
            task_data["updated_at"] = now

        # Конвертуємо списки в JSON рядки для Supabase
        for key, value in task_data.items():
            if isinstance(value, list):
                task_data[key] = json.dumps(value)

        # Використовуємо напряму insert з сервісним ключем
        response = supabase.table("tasks").insert(task_data).execute()

        if response.data and len(response.data) > 0:
            logger.info(f"Завдання успішно створено: {task_data['title']}")
            return response.data[0]
        else:
            logger.error("Не вдалося створити завдання: порожня відповідь від Supabase")
            return None
    except Exception as e:
        logger.error(f"Помилка при створенні завдання: {str(e)}")
        return None


def create_referral_tasks():
    """Функція для створення реферальних завдань"""

    referral_tasks = []

    # Реферальні завдання з різними рівнями
    referral_levels = [
        {
            "title": "Запросити 5 друзів",
            "description": "Запросіть 5 друзів у систему WINIX і отримайте 500 WINIX токенів та 3 жетони для участі в розіграшах!",
            "target_value": 5,
            "reward_tokens": 500,
            "reward_coins": 3
        },
        {
            "title": "Запросити 15 друзів",
            "description": "Запросіть 15 друзів у систему WINIX і отримайте 2000 WINIX токенів та 6 жетонів для участі в розіграшах!",
            "target_value": 15,
            "reward_tokens": 2000,
            "reward_coins": 6
        },
        {
            "title": "Запросити 25 друзів",
            "description": "Запросіть 25 друзів у систему WINIX і отримайте 3200 WINIX токенів та 12 жетонів для участі в розіграшах!",
            "target_value": 25,
            "reward_tokens": 3200,
            "reward_coins": 12
        },
        {
            "title": "Запросити 50 друзів",
            "description": "Запросіть 50 друзів у систему WINIX і отримайте 7000 WINIX токенів та 20 жетонів для участі в розіграшах!",
            "target_value": 50,
            "reward_tokens": 7000,
            "reward_coins": 20
        },
        {
            "title": "Запросити 100 друзів",
            "description": "Запросіть 100 друзів у систему WINIX і отримайте 12000 WINIX токенів та 32 жетони для участі в розіграшах!",
            "target_value": 100,
            "reward_tokens": 12000,
            "reward_coins": 32
        }
    ]

    for level in referral_levels:
        # Основна винагорода буде в токенах, а про жетони зазначимо в описі
        task_data = {
            "title": level["title"],
            "description": level["description"],
            "task_type": "social",
            "reward_type": "tokens",
            "reward_amount": level["reward_tokens"],
            "target_value": level["target_value"],
            "action_type": "referral",
            "action_label": "Запросити друзів",
            "action_url": "https://winix.com/invite",
            "verification_type": "auto",
            "platforms": json.dumps(["web", "mobile"]),
            "tags": json.dumps(["social", "referral", "friends"]),
            "difficulty": min(5, 1 + level["target_value"] // 20),  # Складність залежить від кількості рефералів
            "repeatable": False,
            "extra_data": json.dumps({
                "reward_coins": level["reward_coins"]  # Додаткові дані про винагороду жетонами
            }),
            "status": "active"
        }

        task = create_task_direct(task_data)
        if task:
            referral_tasks.append(task)
            logger.info(f"Реферальне завдання створено: {task['title']} (ID: {task['id']})")

    logger.info(f"Всього створено реферальних завдань: {len(referral_tasks)}")
    return referral_tasks


def create_diverse_tasks():
    """Функція для створення 10 різних завдань"""

    tasks_created = []

    # 1. Соціальне завдання: Підписка на Telegram канал
    task_data = {
        "title": "Підписатися на Telegram канал",
        "description": "Підпишіться на наш офіційний Telegram канал, щоб отримувати найсвіжіші новини та оновлення.",
        "task_type": "social",
        "reward_type": "tokens",
        "reward_amount": 150,
        "target_value": 1,
        "action_type": "follow",
        "action_url": "https://t.me/winix_official",
        "action_label": "Підписатися",
        "verification_type": "auto",
        "platforms": json.dumps(["web", "mobile"]),
        "tags": json.dumps(["social", "telegram", "easy"]),
        "difficulty": 1,
        "repeatable": False,
        "status": "active"
    }
    task = create_task_direct(task_data)
    if task:
        tasks_created.append(task)
        logger.info(f"Завдання створено: {task['title']} (ID: {task['id']})")

    # 2. Соціальне завдання: Підписка на Twitter
    task_data = {
        "title": "Підписатися на Twitter",
        "description": "Підпишіться на наш офіційний Twitter акаунт, щоб отримувати новини про проект.",
        "task_type": "social",
        "reward_type": "tokens",
        "reward_amount": 90,
        "target_value": 1,
        "action_type": "follow",
        "action_url": "https://twitter.com/winix_official",
        "action_label": "Підписатися",
        "verification_type": "auto",
        "platforms": json.dumps(["web", "mobile"]),
        "tags": json.dumps(["social", "twitter", "easy"]),
        "difficulty": 1,
        "repeatable": False,
        "status": "active"
    }
    task = create_task_direct(task_data)
    if task:
        tasks_created.append(task)
        logger.info(f"Завдання створено: {task['title']} (ID: {task['id']})")

    # 4. Партнерське завдання: Реєстрація на біржі
    task_data = {
        "title": "Зареєструватися на біржі Bybit",
        "description": "Пройдіть реєстрацію на нашій партнерській біржі Bybit і відкрийте нові можливості для торгівлі.",
        "task_type": "partner",
        "reward_type": "tokens",
        "reward_amount": 500,
        "target_value": 1,
        "action_type": "signup",
        "action_url": "https://partner.bybit.com/b/116780",
        "action_label": "Зареєструватися",
        "verification_type": "manual",
        "platforms": json.dumps(["web"]),
        "tags": json.dumps(["partner", "exchange", "signup"]),
        "difficulty": 2,
        "repeatable": False,
        "status": "active"
    }
    task = create_task_direct(task_data)
    if task:
        tasks_created.append(task)
        logger.info(f"Завдання створено: {task['title']} (ID: {task['id']})")

    # 7. Обмежене завдання: Розіграш призів
    start_date = datetime.now().isoformat()
    end_date = (datetime.now() + timedelta(days=14)).isoformat()
    task_data = {
        "title": "Розіграш 100000 WINIX: Заповніть анкету",
        "description": "Візьміть участь у розіграші 100000 WINIX токенів, заповнивши спеціальну анкету. Переможців буде обрано випадковим чином після завершення акції.",
        "task_type": "limited",
        "reward_type": "tokens",
        "reward_amount": 90,
        "target_value": 1,
        "action_type": "custom",
        "action_url": "https://winix.com/survey",
        "action_label": "Заповнити анкету",
        "verification_type": "auto",
        "start_date": start_date,
        "end_date": end_date,
        "platforms": json.dumps(["web"]),
        "tags": json.dumps(["limited", "raffle", "survey"]),
        "difficulty": 2,
        "repeatable": False,
        "status": "active"
    }
    task = create_task_direct(task_data)
    if task:
        tasks_created.append(task)
        logger.info(f"Завдання створено: {task['title']} (ID: {task['id']})")

    # 8. Щоденне завдання: Відвідування сайту
    task_data = {
        "title": "Щоденне відвідування сайту WINIX",
        "description": "Відвідуйте наш сайт щодня, щоб заробляти токени WINIX. Завдання можна виконувати раз на день.",
        "task_type": "daily",
        "reward_type": "tokens",
        "reward_amount": 15,
        "target_value": 1,
        "action_type": "visit",
        "action_url": "https://winix.com",
        "action_label": "Відвідати",
        "verification_type": "auto",
        "platforms": json.dumps(["web", "mobile"]),
        "tags": json.dumps(["daily", "easy", "visit"]),
        "difficulty": 1,
        "repeatable": True,
        "cooldown_hours": 24,
        "status": "active"
    }
    task = create_task_direct(task_data)
    if task:
        tasks_created.append(task)
        logger.info(f"Завдання створено: {task['title']} (ID: {task['id']})")

    # 10. Соціальне завдання: Підписка на YouTube канал
    task_data = {
        "title": "Підписатися на YouTube канал",
        "description": "Підпишіться на наш YouTube канал, щоб отримувати інформативні відео про криптовалюти та новини проекту.",
        "task_type": "social",
        "reward_type": "tokens",
        "reward_amount": 55,
        "target_value": 1,
        "action_type": "follow",
        "action_url": "https://youtube.com/c/winix",
        "action_label": "Підписатися",
        "verification_type": "manual",
        "platforms": json.dumps(["web", "mobile"]),
        "tags": json.dumps(["social", "youtube", "content"]),
        "difficulty": 1,
        "repeatable": False,
        "status": "active"
    }
    task = create_task_direct(task_data)
    if task:
        tasks_created.append(task)
        logger.info(f"Завдання створено: {task['title']} (ID: {task['id']})")

    logger.info(f"Всього створено завдань: {len(tasks_created)} з 6")
    return tasks_created


if __name__ == "__main__":
    logger.info("Початок створення завдань з сервісним ключем...")

    # Перевіряємо підключення до Supabase
    if not supabase:
        logger.error("Неможливо продовжити без підключення до Supabase")
        sys.exit(1)

    # Спочатку створюємо стандартні завдання
    created_tasks = create_diverse_tasks()
    logger.info(f"Процес створення стандартних завдань завершено. Створено: {len(created_tasks)} завдань")

    # Далі створюємо реферальні завдання
    created_referral_tasks = create_referral_tasks()
    logger.info(f"Процес створення реферальних завдань завершено. Створено: {len(created_referral_tasks)} завдань")

    # Загальна статистика
    total_tasks = len(created_tasks) + len(created_referral_tasks)
    logger.info(f"Всього створено завдань: {total_tasks}")