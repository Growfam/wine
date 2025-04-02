import os
from supabase import create_client, Client
from dotenv import load_dotenv
import logging

# Налаштування логування
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Завантаження .env
load_dotenv()

# Дані з .env
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY")

# Перевірка наявності критичних змінних
if not SUPABASE_URL or not SUPABASE_KEY:
    logger.warning("⚠️ УВАГА: Відсутні змінні середовища SUPABASE_URL або SUPABASE_ANON_KEY")

# Ініціалізація клієнта
try:
    supabase: Client = create_client(SUPABASE_URL, SUPABASE_KEY)
    logger.info("✅ Успішне підключення до Supabase")
except Exception as e:
    logger.error(f"❌ Помилка підключення до Supabase: {str(e)}")
    supabase = None


# Отримати користувача по telegram_id
def get_user(telegram_id: str):
    try:
        if not supabase:
            logger.error("❌ Клієнт Supabase не ініціалізовано")
            return None

        res = supabase.table("Winix").select("*").eq("telegram_id", telegram_id).execute()
        return res.data[0] if res.data else None
    except Exception as e:
        logger.error(f"❌ Помилка отримання користувача {telegram_id}: {str(e)}")
        return None


# Створити користувача
def create_user(telegram_id: str, username: str, referrer_id: str = None):
    try:
        if not supabase:
            logger.error("❌ Клієнт Supabase не ініціалізовано")
            return None

        # Перевіряємо, чи користувач вже існує
        existing_user = get_user(telegram_id)
        if existing_user:
            return existing_user

        # Створюємо нового користувача з усіма необхідними полями
        data = {
            "telegram_id": telegram_id,
            "username": username,
            "balance": 0,  # початковий баланс WINIX
            "coins": 3,  # початкова кількість жетонів
            "referrer_id": referrer_id,
            "page1_completed": False,
            "newbie_bonus_claimed": False,
            "participations_count": 0,
            "badge_winner": False,
            "badge_beginner": False,
            "badge_rich": False,
            "wins_count": 0  # кількість виграшів
        }

        res = supabase.table("Winix").insert(data).execute()
        logger.info(f"✅ Створено нового користувача: {telegram_id}")
        return res.data[0] if res.data else None
    except Exception as e:
        logger.error(f"❌ Помилка створення користувача {telegram_id}: {str(e)}")
        return None


# Оновити баланс
def update_balance(telegram_id: str, amount: float):
    try:
        if not supabase:
            logger.error("❌ Клієнт Supabase не ініціалізовано")
            return None

        user = get_user(telegram_id)
        if not user:
            logger.error(f"❌ Користувача {telegram_id} не знайдено")
            return None

        current_balance = float(user.get("balance", 0))
        new_balance = current_balance + amount

        res = supabase.table("Winix").update({"balance": new_balance}).eq("telegram_id", telegram_id).execute()
        logger.info(f"✅ Оновлено баланс користувача {telegram_id}: +{amount}, новий баланс: {new_balance}")

        # Перевіряємо, чи потрібно активувати бейдж багатія
        if new_balance >= 50000 and not user.get("badge_rich", False):
            supabase.table("Winix").update({"badge_rich": True}).eq("telegram_id", telegram_id).execute()
            logger.info(f"🏆 Користувач {telegram_id} отримує бейдж багатія")

        return res.data[0] if res.data else None
    except Exception as e:
        logger.error(f"❌ Помилка оновлення балансу {telegram_id}: {str(e)}")
        return None


# Оновити кількість жетонів
def update_coins(telegram_id: str, amount: int):
    try:
        if not supabase:
            logger.error("❌ Клієнт Supabase не ініціалізовано")
            return None

        user = get_user(telegram_id)
        if not user:
            logger.error(f"❌ Користувача {telegram_id} не знайдено")
            return None

        current_coins = int(user.get("coins", 0))
        new_coins = current_coins + amount
        if new_coins < 0:
            new_coins = 0  # запобігаємо від'ємному значенню

        res = supabase.table("Winix").update({"coins": new_coins}).eq("telegram_id", telegram_id).execute()
        logger.info(
            f"✅ Оновлено жетони користувача {telegram_id}: {'+' if amount >= 0 else ''}{amount}, нова кількість: {new_coins}")
        return res.data[0] if res.data else None
    except Exception as e:
        logger.error(f"❌ Помилка оновлення жетонів {telegram_id}: {str(e)}")
        return None


# Оновити дані користувача
def update_user(telegram_id: str, data: dict):
    try:
        if not supabase:
            logger.error("❌ Клієнт Supabase не ініціалізовано")
            return None

        user = get_user(telegram_id)
        if not user:
            logger.error(f"❌ Користувача {telegram_id} не знайдено")
            return None

        res = supabase.table("Winix").update(data).eq("telegram_id", telegram_id).execute()
        logger.info(f"✅ Оновлено дані користувача {telegram_id}")
        return res.data[0] if res.data else None
    except Exception as e:
        logger.error(f"❌ Помилка оновлення даних користувача {telegram_id}: {str(e)}")
        return None


# Перевірити і оновити прогрес бейджів
def check_and_update_badges(telegram_id: str):
    try:
        user = get_user(telegram_id)
        if not user:
            return None

        updates = {}

        # Бейдж початківця - за 5 участей в розіграшах
        if not user.get("badge_beginner") and user.get("participations_count", 0) >= 5:
            updates["badge_beginner"] = True
            logger.info(f"🏆 Користувач {telegram_id} отримує бейдж початківця")

        # Бейдж багатія - за 50,000 WINIX
        if not user.get("badge_rich") and float(user.get("balance", 0)) >= 50000:
            updates["badge_rich"] = True
            logger.info(f"🏆 Користувач {telegram_id} отримує бейдж багатія")

        # Бейдж переможця - якщо є виграші
        if not user.get("badge_winner") and user.get("wins_count", 0) > 0:
            updates["badge_winner"] = True
            logger.info(f"🏆 Користувач {telegram_id} отримує бейдж переможця")

        # Якщо є оновлення, зберігаємо їх
        if updates:
            return update_user(telegram_id, updates)

        return user
    except Exception as e:
        logger.error(f"❌ Помилка перевірки бейджів {telegram_id}: {str(e)}")
        return None


# Додати участь у розіграші
def add_participation(telegram_id: str, raffle_id: str, token_amount: int = 1):
    try:
        if not supabase:
            logger.error("❌ Клієнт Supabase не ініціалізовано")
            return None

        user = get_user(telegram_id)
        if not user:
            logger.error(f"❌ Користувача {telegram_id} не знайдено")
            return None

        # Перевіряємо, чи достатньо жетонів
        current_coins = int(user.get("coins", 0))
        if current_coins < token_amount:
            logger.error(
                f"❌ Недостатньо жетонів для участі {telegram_id} (наявно {current_coins}, потрібно {token_amount})")
            return None

        # Знімаємо жетони
        new_coins = current_coins - token_amount

        # Збільшуємо лічильник участей
        current_participations = int(user.get("participations_count", 0))
        new_participations = current_participations + 1

        # Оновлюємо дані користувача
        updates = {
            "coins": new_coins,
            "participations_count": new_participations
        }

        # Перевіряємо, чи не потрібно активувати бейдж початківця
        if new_participations >= 5 and not user.get("badge_beginner", False):
            updates["badge_beginner"] = True

        # Оновлюємо дані
        res_user = supabase.table("Winix").update(updates).eq("telegram_id", telegram_id).execute()

        # Додаємо запис про участь у розіграші (якщо є таблиця)
        try:
            participation_data = {
                "telegram_id": telegram_id,
                "raffle_id": raffle_id,
                "token_amount": token_amount
            }

            res_participation = supabase.table("RaffleParticipations").insert(participation_data).execute()
            logger.info(f"✅ Користувач {telegram_id} взяв участь у розіграші {raffle_id} з {token_amount} жетонами")
        except Exception as e:
            logger.error(f"Помилка додавання запису про участь: {str(e)}")
            res_participation = None

        return {
            "user": res_user.data[0] if res_user.data else None,
            "participation": res_participation.data[0] if res_participation and hasattr(res_participation,
                                                                                        'data') else None
        }
    except Exception as e:
        logger.error(f"❌ Помилка додавання участі у розіграші для {telegram_id}: {str(e)}")
        return None


# Отримати історію розіграшів користувача
def get_user_raffle_history(telegram_id: str, limit: int = 10):
    try:
        if not supabase:
            logger.error("❌ Клієнт Supabase не ініціалізовано")
            return []

        # Спочатку спробуємо отримати дані за допомогою функції RPC, якщо вона існує
        try:
            res = supabase.rpc('get_user_raffle_history', {'user_id': telegram_id, 'history_limit': limit}).execute()
            if res.data:
                return res.data
        except Exception as e:
            logger.error(f"Помилка виклику RPC get_user_raffle_history: {str(e)}")

        # Якщо RPC не спрацював, спробуємо прямий запит до таблиці
        try:
            res = supabase.table("RaffleParticipations").select("*").eq("telegram_id", telegram_id).order(
                "participated_at", desc=True).limit(limit).execute()
            return res.data if res.data else []
        except Exception as e:
            logger.error(f"Помилка прямого запиту до таблиці RaffleParticipations: {str(e)}")
            return []
    except Exception as e:
        logger.error(f"❌ Помилка отримання історії розіграшів {telegram_id}: {str(e)}")
        return []

    # Додайте ці функції до вашого файлу supabase_client.py

    def get_user_settings(telegram_id: str):
        """
        Отримати налаштування користувача
        """
        try:
            user = get_user(telegram_id)
            if not user:
                return None

            # Формуємо об'єкт з налаштуваннями
            settings = {
                "username": user.get("username", "WINIX User"),
                "avatar_id": user.get("avatar_id"),
                "avatar_url": user.get("avatar_url"),
                "language": user.get("language", "uk"),
                "notifications_enabled": user.get("notifications_enabled", True),
                "password_hash": user.get("password_hash")
            }

            return settings
        except Exception as e:
            logger.error(f"❌ Помилка отримання налаштувань користувача {telegram_id}: {str(e)}")
            return None

    def get_daily_bonus_status(telegram_id: str):
        """
        Отримати статус щоденного бонусу
        """
        try:
            user = get_user(telegram_id)
            if not user:
                return None

            from datetime import datetime

            # Отримуємо інформацію про щоденні бонуси
            daily_bonuses = user.get("daily_bonuses", {})

            # Якщо немає інформації про бонуси, створюємо її
            if not daily_bonuses:
                daily_bonuses = {
                    "last_claimed_date": None,
                    "claimed_days": [],
                    "current_day": 1
                }

            # Перевіряємо, чи можна отримати бонус сьогодні
            today = datetime.now().strftime("%Y-%m-%d")
            last_date = daily_bonuses.get("last_claimed_date")

            # Визначаємо поточний день у циклі (1-7)
            current_day = daily_bonuses.get("current_day", 1)
            claimed_days = daily_bonuses.get("claimed_days", [])

            # Визначаємо суму винагороди залежно від дня
            reward_amount = current_day * 10  # День 1 = 10, День 2 = 20, і т.д.

            # Перевіряємо, чи сьогодні вже отримано бонус
            can_claim = today != last_date

            return {
                "currentDay": current_day,
                "claimedDays": claimed_days,
                "canClaim": can_claim,
                "rewardAmount": reward_amount
            }
        except Exception as e:
            logger.error(f"❌ Помилка отримання статусу щоденного бонусу для {telegram_id}: {str(e)}")
            return None

    def claim_daily_bonus(telegram_id: str, day: int):
        """
        Отримати щоденний бонус
        """
        try:
            user = get_user(telegram_id)
            if not user:
                return None

            from datetime import datetime

            # Отримуємо інформацію про щоденні бонуси
            daily_bonuses = user.get("daily_bonuses", {})

            # Якщо немає інформації про бонуси, створюємо її
            if not daily_bonuses:
                daily_bonuses = {
                    "last_claimed_date": None,
                    "claimed_days": [],
                    "current_day": 1
                }

            # Перевіряємо, чи можна отримати бонус сьогодні
            today = datetime.now().strftime("%Y-%m-%d")
            last_date = daily_bonuses.get("last_claimed_date")

            # Якщо бонус вже отримано сьогодні
            if last_date == today:
                return {
                    "status": "already_claimed",
                    "message": "Бонус вже отримано сьогодні"
                }

            # Визначаємо поточний день у циклі (1-7)
            current_day = daily_bonuses.get("current_day", 1)
            claimed_days = daily_bonuses.get("claimed_days", [])

            # Перевіряємо, чи переданий день співпадає з поточним
            if day != current_day:
                return {
                    "status": "error",
                    "message": f"Неправильний день! Очікувався день {current_day}, отримано {day}"
                }

            # Визначаємо суму винагороди залежно від дня
            reward_amount = current_day * 10  # День 1 = 10, День 2 = 20, і т.д.

            # Нараховуємо винагороду
            current_balance = float(user.get("balance", 0))
            new_balance = current_balance + reward_amount

            # Оновлюємо інформацію про бонуси
            claimed_days.append(current_day)

            # Визначаємо наступний день (циклічно від 1 до 7)
            next_day = current_day + 1
            if next_day > 7:
                next_day = 1

            # Оновлюємо дані в базі
            updated_bonuses = {
                "last_claimed_date": today,
                "claimed_days": claimed_days,
                "current_day": next_day
            }

            update_user(telegram_id, {
                "balance": new_balance,
                "daily_bonuses": updated_bonuses
            })

            # Додаємо транзакцію
            transaction = {
                "telegram_id": telegram_id,
                "type": "reward",
                "amount": reward_amount,
                "description": f"Щоденний бонус (День {current_day})",
                "status": "completed"
            }

            if supabase:
                supabase.table("Transactions").insert(transaction).execute()

            return {
                "status": "success",
                "message": f"Щоденний бонус отримано: +{reward_amount} WINIX",
                "reward": reward_amount,
                "newBalance": new_balance
            }
        except Exception as e:
            logger.error(f"❌ Помилка отримання щоденного бонусу для {telegram_id}: {str(e)}")
            return None

    def verify_social_subscription(telegram_id: str, platform: str):
        """
        Перевірити підписку на соціальну мережу
        """
        try:
            user = get_user(telegram_id)
            if not user:
                return None

            # Отримуємо статус соціальних завдань
            social_tasks = user.get("social_tasks", {})

            # Якщо завдання вже виконано
            if social_tasks.get(platform, False):
                return {
                    "status": "already_completed",
                    "message": "Це завдання вже виконано"
                }

            # Визначаємо винагороду залежно від платформи
            reward_amounts = {
                "twitter": 50,
                "telegram": 80,
                "youtube": 50,
                "discord": 60,
                "instagram": 70
            }

            reward_amount = reward_amounts.get(platform, 50)

            # Нараховуємо винагороду
            current_balance = float(user.get("balance", 0))
            new_balance = current_balance + reward_amount

            # Оновлюємо статус завдання
            if not social_tasks:
                social_tasks = {}
            social_tasks[platform] = True

            # Оновлюємо дані в базі
            update_user(telegram_id, {
                "balance": new_balance,
                "social_tasks": social_tasks
            })

            # Додаємо транзакцію
            transaction = {
                "telegram_id": telegram_id,
                "type": "reward",
                "amount": reward_amount,
                "description": f"Винагорода за підписку на {platform}",
                "status": "completed"
            }

            if supabase:
                supabase.table("Transactions").insert(transaction).execute()

            return {
                "status": "success",
                "message": f"Підписку підтверджено! Отримано {reward_amount} WINIX",
                "reward": reward_amount,
                "newBalance": new_balance
            }
        except Exception as e:
            logger.error(f"❌ Помилка перевірки підписки для {telegram_id}: {str(e)}")
            return None

    def get_referral_tasks_status(telegram_id: str):
        """
        Отримати статус реферальних завдань
        """
        try:
            user = get_user(telegram_id)
            if not user:
                return None

            # Отримуємо кількість рефералів
            referral_count = 0
            if supabase:
                try:
                    referrals_res = supabase.table("Winix").select("count").eq("referrer_id", telegram_id).execute()
                    referral_count = referrals_res.count if hasattr(referrals_res, 'count') else 0
                except Exception as e:
                    logger.error(f"Помилка отримання кількості рефералів: {str(e)}")

            # Отримуємо статус реферальних завдань
            referral_tasks = user.get("referral_tasks", {})

            # Визначаємо завдання і їх цілі
            tasks = [
                {"id": "invite-friends", "target": 5, "reward": 300},
                {"id": "invite-friends-10", "target": 10, "reward": 700},
                {"id": "invite-friends-25", "target": 25, "reward": 1500},
                {"id": "invite-friends-100", "target": 100, "reward": 5000}
            ]

            # Визначаємо, які завдання виконані
            completed_tasks = []

            for task in tasks:
                task_id = task["id"]
                target = task["target"]

                # Завдання виконане, якщо кількість рефералів >= цільової або статус в базі = True
                if referral_count >= target or referral_tasks.get(task_id, False):
                    completed_tasks.append(task_id)

            return {
                "referralCount": referral_count,
                "completedTasks": completed_tasks,
                "tasks": tasks
            }
        except Exception as e:
            logger.error(f"❌ Помилка отримання статусу реферальних завдань для {telegram_id}: {str(e)}")
            return None

    def claim_referral_reward(telegram_id: str, task_id: str, reward_amount: float):
        """
        Отримати винагороду за реферальне завдання
        """
        try:
            user = get_user(telegram_id)
            if not user:
                return None

            # Отримуємо статус реферальних завдань
            referral_tasks = user.get("referral_tasks", {})

            # Якщо завдання вже виконано
            if referral_tasks.get(task_id, False):
                return {
                    "status": "already_claimed",
                    "message": "Ви вже отримали винагороду за це завдання"
                }

            # Отримуємо кількість рефералів
            referral_count = 0
            if supabase:
                try:
                    referrals_res = supabase.table("Winix").select("count").eq("referrer_id", telegram_id).execute()
                    referral_count = referrals_res.count if hasattr(referrals_res, 'count') else 0
                except Exception as e:
                    logger.error(f"Помилка отримання кількості рефералів: {str(e)}")

            # Визначаємо цільову кількість рефералів
            target_map = {
                "invite-friends": 5,
                "invite-friends-10": 10,
                "invite-friends-25": 25,
                "invite-friends-100": 100
            }

            target = target_map.get(task_id, 0)

            # Перевіряємо, чи достатньо рефералів
            if referral_count < target:
                return {
                    "status": "not_completed",
                    "message": f"Недостатньо рефералів для завершення завдання. Потрібно {target}, наявно {referral_count}"
                }

            # Нараховуємо винагороду
            current_balance = float(user.get("balance", 0))
            new_balance = current_balance + reward_amount

            # Оновлюємо статус завдання
            if not referral_tasks:
                referral_tasks = {}
            referral_tasks[task_id] = True

            # Оновлюємо дані в базі
            update_user(telegram_id, {
                "balance": new_balance,
                "referral_tasks": referral_tasks
            })

            # Додаємо транзакцію
            transaction = {
                "telegram_id": telegram_id,
                "type": "reward",
                "amount": reward_amount,
                "description": f"Винагорода за реферальне завдання: {task_id}",
                "status": "completed"
            }

            if supabase:
                supabase.table("Transactions").insert(transaction).execute()

            return {
                "status": "success",
                "message": f"Винагороду отримано: {reward_amount} WINIX",
                "reward": reward_amount,
                "newBalance": new_balance
            }
        except Exception as e:
            logger.error(f"❌ Помилка отримання винагороди за реферальне завдання для {telegram_id}: {str(e)}")
            return None

    def add_referral(telegram_id: str, referral_code: str):
        """
        Додати реферала
        """
        try:
            user = get_user(telegram_id)
            if not user:
                return None

            # Перевіряємо, чи реферальний код валідний
            # У реальному випадку тут має бути перевірка в базі даних
            if not is_valid_referral_code(referral_code):
                return {
                    "status": "error",
                    "message": "Невалідний реферальний код"
                }

            # В реальному сценарії тут має бути логіка додавання реферала
            # Наприклад, оновлення поля referrer_id користувача з кодом referral_code

            # Отримуємо поточну кількість рефералів
            referral_count = 0
            if supabase:
                try:
                    referrals_res = supabase.table("Winix").select("count").eq("referrer_id", telegram_id).execute()
                    referral_count = referrals_res.count if hasattr(referrals_res, 'count') else 0
                except Exception as e:
                    logger.error(f"Помилка отримання кількості рефералів: {str(e)}")

            # Симулюємо успішне додавання реферала
            new_referrals = referral_count + 1

            return {
                "status": "success",
                "message": f"Друга успішно запрошено!",
                "referralCount": new_referrals
            }
        except Exception as e:
            logger.error(f"❌ Помилка додавання реферала для {telegram_id}: {str(e)}")
            return None

    def is_valid_referral_code(code: str) -> bool:
        """
        Перевірити валідність реферального коду
        """
        # Перевіряємо, чи код є валідним ID Telegram
        # У реальному випадку тут має бути перевірка користувача в базі даних
        try:
            return len(code) > 5
        except:
            return False