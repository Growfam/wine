"""
Модуль для зручного керування розіграшами WINIX.
Цей файл надає спрощений інтерфейс для адміністративних операцій з розіграшами.
"""
import os
import sys
import logging
import uuid
import requests
from datetime import datetime, timedelta, timezone
from typing import Dict, List, Optional, Union, Any, Tuple

# Налаштування логування
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Додаємо батьківську директорію до шляху для імпорту supabase_client
parent_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if parent_dir not in sys.path:
    sys.path.append(parent_dir)

try:
    from supabase_client import supabase, cache_get, cache_set, clear_cache
except ImportError as e:
    print(f"Помилка імпорту supabase_client: {e}")
    print(f"Пошук у: {parent_dir}")
    print(f"Доступні файли: {os.listdir(parent_dir)}")
    sys.exit(1)

# Константи
DEFAULT_API_URL = os.getenv("API_URL", "http://localhost:5000")
DEFAULT_ADMIN_ID = os.getenv("DEFAULT_ADMIN_ID", "")


class RaffleManager:
    """Клас для керування розіграшами"""

    def __init__(self, api_url: str = DEFAULT_API_URL, admin_id: str = DEFAULT_ADMIN_ID):
        """
        Ініціалізація менеджера розіграшів

        Args:
            api_url: URL API для взаємодії з розіграшами
            admin_id: ID адміністратора для авторизації
        """
        self.api_url = api_url
        self.admin_id = admin_id
        self.headers = {"X-Admin-Id": admin_id}

        # Валідація параметрів
        if not self.admin_id:
            logger.warning("Admin ID не вказано. Деякі функції можуть бути недоступні.")

    def _make_request(self, method: str, endpoint: str, data: Dict = None) -> Dict:
        """
        Виконує HTTP-запит до API

        Args:
            method: HTTP метод (GET, POST, PUT, DELETE)
            endpoint: Шлях до ендпоінту API
            data: Дані для відправки (для POST, PUT)

        Returns:
            Dict: Відповідь від API
        """
        url = f"{self.api_url}{endpoint}"

        try:
            if method.upper() == "GET":
                response = requests.get(url, headers=self.headers)
            elif method.upper() == "POST":
                response = requests.post(url, headers=self.headers, json=data)
            elif method.upper() == "PUT":
                response = requests.put(url, headers=self.headers, json=data)
            elif method.upper() == "DELETE":
                response = requests.delete(url, headers=self.headers)
            else:
                raise ValueError(f"Непідтримуваний HTTP метод: {method}")

            response.raise_for_status()
            return response.json()

        except requests.RequestException as e:
            logger.error(f"Помилка API запиту: {str(e)}")
            return {"status": "error", "message": f"Помилка API запиту: {str(e)}"}

    def get_all_raffles(self, status: Optional[str] = None) -> List[Dict]:
        """
        Отримати список всіх розіграшів

        Args:
            status: Фільтр за статусом (active, completed тощо)

        Returns:
            List[Dict]: Список розіграшів
        """
        endpoint = "/api/admin/raffles"
        if status:
            endpoint += f"?status={status}"

        response = self._make_request("GET", endpoint)

        if response.get("status") == "success":
            return response.get("data", [])
        else:
            logger.error(f"Помилка отримання розіграшів: {response.get('message')}")
            return []

    def get_active_raffles(self) -> List[Dict]:
        """
        Отримати список активних розіграшів

        Returns:
            List[Dict]: Список активних розіграшів
        """
        return self.get_all_raffles(status="active")

    def get_completed_raffles(self) -> List[Dict]:
        """
        Отримати список завершених розіграшів

        Returns:
            List[Dict]: Список завершених розіграшів
        """
        return self.get_all_raffles(status="completed")

    def get_raffle_details(self, raffle_id: str) -> Dict:
        """
        Отримати деталі конкретного розіграшу

        Args:
            raffle_id: ID розіграшу

        Returns:
            Dict: Деталі розіграшу
        """
        endpoint = f"/api/admin/raffles/{raffle_id}"
        response = self._make_request("GET", endpoint)

        if response.get("status") == "success":
            return response.get("data", {})
        else:
            logger.error(f"Помилка отримання деталей розіграшу: {response.get('message')}")
            return {}

    def get_raffle_participants(self, raffle_id: str) -> List[Dict]:
        """
        Отримати список учасників розіграшу

        Args:
            raffle_id: ID розіграшу

        Returns:
            List[Dict]: Список учасників розіграшу
        """
        endpoint = f"/api/admin/raffles/{raffle_id}/participants"
        response = self._make_request("GET", endpoint)

        if response.get("status") == "success":
            return response.get("data", [])
        else:
            logger.error(f"Помилка отримання учасників розіграшу: {response.get('message')}")
            return []

    def create_raffle(self,
                      title: str,
                      description: str,
                      prize_amount: float,
                      prize_currency: str = "WINIX",
                      entry_fee: int = 1,
                      winners_count: int = 1,
                      duration_hours: int = 24,
                      is_daily: bool = False,
                      image_url: str = "",
                      prize_distribution: Dict = None,
                      participation_reward: float = 0,
                      participation_reward_currency: str = "$Winix",
                      jackpot_mode: bool = False,
                      total_winix_pool: float = 0) -> Dict:
        """
        Створити новий розіграш

        Args:
            title: Назва розіграшу
            description: Опис розіграшу
            prize_amount: Сума призу
            prize_currency: Валюта призу (за замовчуванням WINIX)
            entry_fee: Вартість участі в жетонах
            winners_count: Кількість переможців
            duration_hours: Тривалість розіграшу в годинах
            is_daily: Чи є розіграш щоденним
            image_url: URL зображення розіграшу
            prize_distribution: Розподіл призів між переможцями
            participation_reward: Нагорода за саму участь
            participation_reward_currency: Валюта нагороди за участь
            jackpot_mode: Чи є це Jackpot розіграш
            total_winix_pool: Загальна сума токенів Winix в призовому фонді

        Returns:
            Dict: Результат створення розіграшу
        """
        # Встановлюємо час початку і завершення
        now = datetime.now(timezone.utc)
        start_time = now.isoformat()
        end_time = (now + timedelta(hours=duration_hours)).isoformat()

        # Формуємо дані розіграшу
        raffle_data = {
            "title": title,
            "description": description,
            "prize_amount": prize_amount,
            "prize_currency": prize_currency,
            "entry_fee": entry_fee,
            "winners_count": winners_count,
            "start_time": start_time,
            "end_time": end_time,
            "is_daily": is_daily,
            "image_url": image_url,
            "participation_reward": participation_reward,
            "participation_reward_currency": participation_reward_currency,
            "jackpot_mode": jackpot_mode,
            "total_winix_pool": total_winix_pool
        }

        # Додаємо розподіл призів, якщо вказано
        if prize_distribution:
            raffle_data["prize_distribution"] = prize_distribution

        # Відправляємо запит на створення
        endpoint = "/api/admin/raffles"
        response = self._make_request("POST", endpoint, raffle_data)

        if response.get("status") == "success":
            logger.info(f"Розіграш успішно створено: {title}")
            return response.get("data", {})
        else:
            logger.error(f"Помилка створення розіграшу: {response.get('message')}")
            return {"status": "error", "message": response.get('message')}

    def update_raffle(self, raffle_id: str, updated_data: Dict) -> Dict:
        """
        Оновити існуючий розіграш

        Args:
            raffle_id: ID розіграшу
            updated_data: Дані для оновлення

        Returns:
            Dict: Результат оновлення
        """
        endpoint = f"/api/admin/raffles/{raffle_id}"
        response = self._make_request("PUT", endpoint, updated_data)

        if response.get("status") == "success":
            logger.info(f"Розіграш {raffle_id} успішно оновлено")
            return response.get("data", {})
        else:
            logger.error(f"Помилка оновлення розіграшу: {response.get('message')}")
            return {"status": "error", "message": response.get('message')}

    def delete_raffle(self, raffle_id: str) -> Dict:
        """
        Видалити розіграш

        Args:
            raffle_id: ID розіграшу

        Returns:
            Dict: Результат видалення
        """
        endpoint = f"/api/admin/raffles/{raffle_id}"
        response = self._make_request("DELETE", endpoint)

        if response.get("status") == "success":
            logger.info(f"Розіграш {raffle_id} успішно видалено")
            return {"status": "success", "message": "Розіграш видалено"}
        else:
            logger.error(f"Помилка видалення розіграшу: {response.get('message')}")
            return {"status": "error", "message": response.get('message')}

    def finish_raffle(self, raffle_id: str) -> Dict:
        """
        Завершити розіграш і визначити переможців

        Args:
            raffle_id: ID розіграшу

        Returns:
            Dict: Результат завершення розіграшу
        """
        endpoint = f"/api/admin/raffles/{raffle_id}/finish"
        response = self._make_request("POST", endpoint)

        if response.get("status") == "success":
            logger.info(f"Розіграш {raffle_id} успішно завершено")
            return response
        else:
            logger.error(f"Помилка завершення розіграшу: {response.get('message')}")
            return {"status": "error", "message": response.get('message')}

    def check_expired_raffles(self) -> Dict:
        """
        Перевірити та автоматично завершити прострочені розіграші

        Returns:
            Dict: Результат перевірки
        """
        endpoint = "/api/admin/raffles/check-expired"
        response = self._make_request("POST", endpoint)

        if response.get("status") == "success":
            logger.info(f"Перевірку прострочених розіграшів виконано: {response.get('message')}")
            return response
        else:
            logger.error(f"Помилка перевірки прострочених розіграшів: {response.get('message')}")
            return {"status": "error", "message": response.get('message')}

    def direct_db_create_raffle(self, raffle_data: Dict) -> Dict:
        """
        Створити розіграш напряму через Supabase (без використання API)

        Args:
            raffle_data: Дані розіграшу

        Returns:
            Dict: Створений розіграш
        """
        try:
            # Генеруємо ID розіграшу, якщо не вказано
            if "id" not in raffle_data:
                raffle_data["id"] = str(uuid.uuid4())

            # Додаємо поточний час, якщо не вказано
            now = datetime.now(timezone.utc).isoformat()
            if "created_at" not in raffle_data:
                raffle_data["created_at"] = now
            if "updated_at" not in raffle_data:
                raffle_data["updated_at"] = now

            # Додаємо адміністратора, якщо не вказано
            if "created_by" not in raffle_data:
                raffle_data["created_by"] = self.admin_id

            # Встановлюємо початкову кількість учасників
            if "participants_count" not in raffle_data:
                raffle_data["participants_count"] = 0

            # Встановлюємо статус, якщо не вказано
            if "status" not in raffle_data:
                raffle_data["status"] = "active"

            # Створюємо запис у базі даних
            response = supabase.table("raffles").insert(raffle_data).execute()

            if response.data:
                logger.info(f"Розіграш успішно створено через базу даних: {raffle_data.get('title')}")

                # Очищаємо кеш активних розіграшів
                try:
                    clear_cache("active_raffles")
                except Exception as e:
                    logger.warning(f"Не вдалося очистити кеш активних розіграшів: {str(e)}")

                return response.data[0]
            else:
                logger.error("Помилка створення розіграшу через базу даних")
                return {"status": "error", "message": "Помилка створення розіграшу через базу даних"}

        except Exception as e:
            logger.error(f"Помилка прямого створення розіграшу: {str(e)}")
            return {"status": "error", "message": str(e)}


# Приклад використання
if __name__ == "__main__":
    # Отримуємо ADMIN_ID з середовища
    admin_id = os.getenv("ADMIN_ID")

    if not admin_id:
        print("Помилка: ADMIN_ID не вказано в середовищі")
        exit(1)

    # Створюємо екземпляр менеджера
    manager = RaffleManager(admin_id=admin_id)

    # Отримуємо статистику
    stats = manager.get_raffles_status()
    print(f"Активних розіграшів: {stats.get('active_raffles', 0)}")
    print(f"Завершених розіграшів: {stats.get('completed_raffles', 0)}")

    # Отримуємо список активних розіграшів
    active_raffles = manager.get_active_raffles()
    print(f"Активні розіграші ({len(active_raffles)}):")
    for raffle in active_raffles:
        print(f"- {raffle.get('title')} (ID: {raffle.get('id')})")