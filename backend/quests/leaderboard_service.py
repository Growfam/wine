"""
Сервіс для роботи з лідербордами в системі WINIX.
Надає функціонал для отримання та управління рейтингами користувачів.
"""
import logging
import sys
import os
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime, timedelta

# Додаємо кореневу папку проекту до шляху
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
if parent_dir not in sys.path:
    sys.path.append(parent_dir)

# Імпорт залежностей
from supabase_client import supabase, cached

# Налаштування логування
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class LeaderboardService:
    """
    Сервіс для роботи з лідербордами.
    Надає методи для отримання різних рейтингів користувачів.
    """

    @staticmethod
    @cached(timeout=300)  # Кешуємо на 5 хвилин
    def get_referrals_leaderboard(limit: int = 10, offset: int = 0) -> List[Dict[str, Any]]:
        """
        Отримує рейтинг користувачів за кількістю запрошених.

        Args:
            limit (int, optional): Максимальна кількість результатів
            offset (int, optional): Зміщення для пагінації

        Returns:
            List[Dict[str, Any]]: Список користувачів з їх статистикою рефералів
        """
        try:
            # Перевіряємо правильність вхідних параметрів
            if limit <= 0 or limit > 100:
                logger.warning(f"Невалідний параметр limit: {limit}, використовуємо значення за замовчуванням 10")
                limit = 10

            if offset < 0:
                logger.warning(f"Невалідний параметр offset: {offset}, використовуємо значення за замовчуванням 0")
                offset = 0

            # Запит до бази даних
            # Використовуємо функцію SQL для підрахунку рефералів
            try:
                response = supabase.rpc('get_referrals_leaderboard', {
                    'result_limit': limit,
                    'result_offset': offset
                }).execute()

                if not response.data:
                    logger.info("Лідерборд рефералів не має записів")
                    return []

                leaderboard = response.data

                # Додаємо поле reward для кожного запису лідерборду (бали за запрошених)
                for entry in leaderboard:
                    # За кожного реферала нараховується 50 одиниць винагороди
                    referrals_count = entry.get("referrals_count", 0)
                    entry["reward"] = referrals_count * 50

                logger.info(f"Отримано {len(leaderboard)} записів з лідерборду рефералів")
                return leaderboard
            except Exception as e:
                logger.error(f"Помилка при виконанні SQL-функції get_referrals_leaderboard: {str(e)}")
                raise

        except Exception as e:
            logger.error(f"Помилка при отриманні лідерборду рефералів: {str(e)}")

            # Запасний варіант, якщо функція SQL недоступна
            try:
                # Отримуємо всіх користувачів
                users_response = supabase.table("winix").select("telegram_id,username,referral_code").execute()

                if not users_response.data:
                    return []

                # Отримуємо статистику рефералів для кожного користувача
                leaderboard = []
                for user in users_response.data:
                    telegram_id = user.get("telegram_id")
                    if not telegram_id:
                        continue

                    # Рахуємо кількість рефералів
                    referrals_count_response = supabase.table("referrals").select("count").eq("referrer_id", str(telegram_id)).execute()

                    referrals_count = referrals_count_response.count if hasattr(referrals_count_response, 'count') else 0

                    # Додаємо запис до лідерборду
                    leaderboard.append({
                        "id": telegram_id,  # ВИПРАВЛЕНО: Змінено поле "telegram_id" на "id" для сумісності з фронтендом
                        "username": user.get("username", "Користувач"),
                        "referrals_count": referrals_count,
                        "referral_code": user.get("referral_code", ""),
                        "reward": referrals_count * 50  # За кожного реферала 50 одиниць винагороди
                    })

                # Сортуємо за кількістю рефералів (спочатку найбільше)
                leaderboard = sorted(leaderboard, key=lambda x: x.get("referrals_count", 0), reverse=True)

                # Застосовуємо ліміт та зміщення
                if offset < len(leaderboard):
                    end_index = min(offset + limit, len(leaderboard))
                    leaderboard = leaderboard[offset:end_index]
                else:
                    leaderboard = []

                logger.info(f"Отримано {len(leaderboard)} записів з лідерборду рефералів (запасний метод)")
                return leaderboard
            except Exception as inner_e:
                logger.error(f"Помилка при використанні запасного методу для лідерборду рефералів: {str(inner_e)}")
                return []

    @staticmethod
    @cached(timeout=300)  # Кешуємо на 5 хвилин
    def get_tasks_leaderboard(limit: int = 10, offset: int = 0, days: int = 30) -> List[Dict[str, Any]]:
        """
        Отримує рейтинг користувачів за кількістю виконаних завдань.

        Args:
            limit (int, optional): Максимальна кількість результатів
            offset (int, optional): Зміщення для пагінації
            days (int, optional): Кількість днів для обмеження періоду

        Returns:
            List[Dict[str, Any]]: Список користувачів з їх статистикою завдань
        """
        try:
            # Перевіряємо правильність вхідних параметрів
            if limit <= 0 or limit > 100:
                logger.warning(f"Невалідний параметр limit: {limit}, використовуємо значення за замовчуванням 10")
                limit = 10

            if offset < 0:
                logger.warning(f"Невалідний параметр offset: {offset}, використовуємо значення за замовчуванням 0")
                offset = 0

            if days <= 0 or days > 365:
                logger.warning(f"Невалідний параметр days: {days}, використовуємо значення за замовчуванням 30")
                days = 30

            # Визначаємо дату початку періоду
            start_date = (datetime.now() - timedelta(days=days)).isoformat()

            # Запит до бази даних
            # Використовуємо функцію SQL для отримання статистики завдань
            try:
                response = supabase.rpc('get_tasks_leaderboard', {
                    'result_limit': limit,
                    'result_offset': offset,
                    'start_date': start_date
                }).execute()

                if not response.data:
                    logger.info("Лідерборд завдань не має записів")
                    return []

                leaderboard = response.data

                # Додаємо поле reward для кожного запису лідерборду (бали за виконані завдання)
                for entry in leaderboard:
                    # За кожне завдання нараховується 30 одиниць винагороди
                    tasks_completed = entry.get("tasks_completed", 0)
                    entry["reward"] = tasks_completed * 30
                    # ВИПРАВЛЕНО: Змінено поле "telegram_id" на "id" для сумісності з фронтендом
                    entry["id"] = entry.pop("telegram_id") if "telegram_id" in entry else None

                logger.info(f"Отримано {len(leaderboard)} записів з лідерборду завдань")
                return leaderboard
            except Exception as e:
                logger.error(f"Помилка при виконанні SQL-функції get_tasks_leaderboard: {str(e)}")
                raise

        except Exception as e:
            logger.error(f"Помилка при отриманні лідерборду завдань: {str(e)}")

            # Запасний варіант, якщо функція SQL недоступна
            try:
                # Отримуємо всі завершені завдання
                start_date_obj = datetime.now() - timedelta(days=days)
                start_date_str = start_date_obj.isoformat()

                progress_response = supabase.table("user_progress") \
                    .select("telegram_id,task_id,status,completion_date") \
                    .gte("completion_date", start_date_str) \
                    .in_("status", ["completed", "verified"]) \
                    .execute()

                if not progress_response.data:
                    return []

                # Підраховуємо кількість завершених завдань для кожного користувача
                user_tasks = {}
                for progress in progress_response.data:
                    telegram_id = progress.get("telegram_id")
                    if telegram_id not in user_tasks:
                        user_tasks[telegram_id] = 0
                    user_tasks[telegram_id] += 1

                # Отримуємо дані користувачів
                user_ids = list(user_tasks.keys())
                if not user_ids:
                    return []

                users_response = supabase.table("winix").select("telegram_id,username").in_("telegram_id", user_ids).execute()

                users_dict = {}
                if users_response.data:
                    for user in users_response.data:
                        telegram_id = user.get("telegram_id")
                        if telegram_id:
                            users_dict[telegram_id] = user

                # Формуємо лідерборд
                leaderboard = []
                for telegram_id, tasks_count in user_tasks.items():
                    user_data = users_dict.get(telegram_id, {"username": "Користувач"})
                    leaderboard.append({
                        "id": telegram_id,  # ВИПРАВЛЕНО: Змінено поле для сумісності з фронтендом
                        "username": user_data.get("username", "Користувач"),
                        "tasks_completed": tasks_count,
                        "reward": tasks_count * 30  # За кожне завдання 30 одиниць винагороди
                    })

                # Сортуємо за кількістю завдань (спочатку найбільше)
                leaderboard = sorted(leaderboard, key=lambda x: x.get("tasks_completed", 0), reverse=True)

                # Застосовуємо ліміт та зміщення
                if offset < len(leaderboard):
                    end_index = min(offset + limit, len(leaderboard))
                    leaderboard = leaderboard[offset:end_index]
                else:
                    leaderboard = []

                logger.info(f"Отримано {len(leaderboard)} записів з лідерборду завдань (запасний метод)")
                return leaderboard
            except Exception as inner_e:
                logger.error(f"Помилка при використанні запасного методу для лідерборду завдань: {str(inner_e)}")
                return []

    @staticmethod
    @cached(timeout=300)  # Кешуємо на 5 хвилин
    def get_balance_leaderboard(limit: int = 10, offset: int = 0) -> List[Dict[str, Any]]:
        """
        Отримує рейтинг користувачів за балансом.

        Args:
            limit (int, optional): Максимальна кількість результатів
            offset (int, optional): Зміщення для пагінації

        Returns:
            List[Dict[str, Any]]: Список користувачів з їх балансом
        """
        try:
            # Перевіряємо правильність вхідних параметрів
            if limit <= 0 or limit > 100:
                logger.warning(f"Невалідний параметр limit: {limit}, використовуємо значення за замовчуванням 10")
                limit = 10

            if offset < 0:
                logger.warning(f"Невалідний параметр offset: {offset}, використовуємо значення за замовчуванням 0")
                offset = 0

            # Запит до бази даних
            response = supabase.table("winix") \
                .select("telegram_id,username,balance") \
                .order("balance", desc=True) \
                .limit(limit) \
                .offset(offset) \
                .execute()

            if not response.data:
                logger.info("Лідерборд балансу не має записів")
                return []

            # Перетворення формату даних для сумісності з інтерфейсом
            leaderboard = []
            for user in response.data:
                leaderboard.append({
                    "id": user.get("telegram_id"),  # ВИПРАВЛЕНО: Змінено поле для сумісності з фронтендом
                    "username": user.get("username", "Користувач"),
                    "balance": user.get("balance", 0),
                    "reward": user.get("balance", 0)  # Балас з поля reward для сумісності з іншими лідербордами
                })

            logger.info(f"Отримано {len(leaderboard)} записів з лідерборду балансу")
            return leaderboard
        except Exception as e:
            logger.error(f"Помилка при отриманні лідерборду балансу: {str(e)}")
            return []

    @staticmethod
    def get_user_position(telegram_id: str, leaderboard_type: str = "referrals") -> Dict[str, Any]:
        """
        Отримує позицію користувача в лідерборді.

        Args:
            telegram_id (str): Telegram ID користувача
            leaderboard_type (str, optional): Тип лідерборду (referrals, tasks, balance)

        Returns:
            Dict[str, Any]: Дані про позицію користувача
        """
        try:
            # Перевіряємо, що telegram_id не є None
            if not telegram_id:
                return {
                    "position": None,
                    "total": 0,
                    "telegram_id": str(telegram_id),
                    "error": "Невалідний telegram_id"
                }

            # Реалізуємо для кожного типу лідерборду
            if leaderboard_type == "referrals":
                # Отримуємо повний лідерборд
                full_leaderboard = LeaderboardService.get_referrals_leaderboard(limit=1000, offset=0)

                # Знаходимо позицію користувача
                for i, entry in enumerate(full_leaderboard):
                    if entry.get("id") == telegram_id or entry.get("telegram_id") == telegram_id:
                        return {
                            "position": i + 1,
                            "total": len(full_leaderboard),
                            "telegram_id": telegram_id,
                            "referrals_count": entry.get("referrals_count", 0)
                        }

                # Якщо користувача немає в лідерборді, отримуємо його дані окремо
                user_response = supabase.table("winix").select("referral_code").eq("telegram_id", str(telegram_id)).execute()

                if not user_response.data or len(user_response.data) == 0:
                    return {
                        "position": None,
                        "total": len(full_leaderboard),
                        "telegram_id": telegram_id,
                        "referrals_count": 0
                    }

                # Рахуємо кількість рефералів
                referrals_count_response = supabase.table("referrals").select("count").eq("referrer_id", str(telegram_id)).execute()

                referrals_count = referrals_count_response.count if hasattr(referrals_count_response, 'count') else 0

                return {
                    "position": None,  # Користувач не входить до ТОП
                    "total": len(full_leaderboard),
                    "telegram_id": telegram_id,
                    "referrals_count": referrals_count
                }
            elif leaderboard_type == "tasks":
                # Отримуємо повний лідерборд
                full_leaderboard = LeaderboardService.get_tasks_leaderboard(limit=1000, offset=0)

                # Знаходимо позицію користувача
                for i, entry in enumerate(full_leaderboard):
                    if entry.get("id") == telegram_id or entry.get("telegram_id") == telegram_id:
                        return {
                            "position": i + 1,
                            "total": len(full_leaderboard),
                            "telegram_id": telegram_id,
                            "tasks_completed": entry.get("tasks_completed", 0)
                        }

                # Якщо користувача немає в лідерборді, рахуємо його завдання окремо
                progress_response = supabase.table("user_progress") \
                    .select("count") \
                    .eq("telegram_id", str(telegram_id)) \
                    .in_("status", ["completed", "verified"]) \
                    .execute()

                tasks_count = progress_response.count if hasattr(progress_response, 'count') else 0

                return {
                    "position": None,  # Користувач не входить до ТОП
                    "total": len(full_leaderboard),
                    "telegram_id": telegram_id,
                    "tasks_completed": tasks_count
                }
            elif leaderboard_type == "balance":
                # Отримуємо дані користувача
                user_response = supabase.table("winix").select("balance").eq("telegram_id", str(telegram_id)).execute()

                if not user_response.data or len(user_response.data) == 0:
                    return {
                        "position": None,
                        "total": 0,
                        "telegram_id": telegram_id,
                        "balance": 0
                    }

                user_balance = user_response.data[0].get("balance", 0)

                # Рахуємо кількість користувачів з більшим балансом
                position_response = supabase.table("winix").select("count").gt("balance", user_balance).execute()

                position = (position_response.count if hasattr(position_response, 'count') else 0) + 1

                # Рахуємо загальну кількість користувачів
                total_response = supabase.table("winix").select("count").execute()

                total = total_response.count if hasattr(total_response, 'count') else 0

                return {
                    "position": position,
                    "total": total,
                    "telegram_id": telegram_id,
                    "balance": user_balance
                }
            else:
                # Непідтримуваний тип лідерборду
                logger.warning(f"Непідтримуваний тип лідерборду: {leaderboard_type}")
                return {
                    "position": None,
                    "total": 0,
                    "telegram_id": telegram_id,
                    "error": f"Непідтримуваний тип лідерборду: {leaderboard_type}"
                }
        except Exception as e:
            logger.error(
                f"Помилка при отриманні позиції користувача {telegram_id} в лідерборді {leaderboard_type}: {str(e)}")
            return {
                "position": None,
                "total": 0,
                "telegram_id": telegram_id,
                "error": str(e)
            }