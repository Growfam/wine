"""
Сервіс для верифікації виконання завдань в системі WINIX.
Надає функціонал для перевірки та підтвердження соціальних дій,
відвідування сайтів, та інших активностей користувачів.
"""
import logging
import sys
import os
import json
import requests
import time
import re
from typing import Dict, Any, Optional, Tuple
from datetime import datetime

# Додаємо кореневу папку проекту до шляху
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
if parent_dir not in sys.path:
    sys.path.append(parent_dir)

# Імпорт моделей та інших залежностей
from models.task import UserTask, ACTION_TYPE_VISIT, ACTION_TYPE_FOLLOW, ACTION_TYPE_SHARE
from models.user_progress import UserProgress, STATUS_VERIFIED, STATUS_REJECTED
from utils.api_helpers import api_success, api_error
from supabase_client import supabase

# Імпорт сервісу для роботи з транзакціями
from utils.transaction_helpers import execute_balance_transaction

# Налаштування логування
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class VerificationService:
    """
    Сервіс для верифікації виконання завдань користувачами.
    """

    @staticmethod
    def verify_social_subscription(telegram_id: str, platform: str, username: Optional[str] = None, proof_url: Optional[str] = None) -> Tuple[bool, Optional[str], Dict[str, Any]]:
        """
        Верифікує підписку користувача на соціальну мережу.

        Args:
            telegram_id (str): Telegram ID користувача
            platform (str): Назва платформи (twitter, telegram, instagram, etc.)
            username (str, optional): Ім'я користувача на платформі
            proof_url (str, optional): URL-доказ підписки

        Returns:
            Tuple[bool, Optional[str], Dict[str, Any]]:
                (успіх, повідомлення про помилку, дані верифікації)
        """
        try:
            # Нормалізуємо назву платформи
            platform = platform.lower().strip()

            # Перевіряємо, чи підтримується платформа
            supported_platforms = ["twitter", "telegram", "instagram", "discord", "facebook", "youtube", "tiktok"]

            if platform not in supported_platforms:
                return False, f"Платформа {platform} не підтримується", {}

            # Дата верифікації
            verification_time = datetime.now().isoformat()

            # Підготовка даних для верифікації
            verification_data = {
                "platform": platform,
                "verification_time": verification_time,
                "verification_method": "manual",
                "verification_status": "completed"
            }

            # Додаємо додаткові дані, якщо вони є
            if username:
                verification_data["username"] = username

            if proof_url:
                verification_data["proof_url"] = proof_url

            # Перевіряємо, чи завдання вже верифіковане
            user_info = VerificationService.get_user_social_tasks(telegram_id)

            if platform in user_info and user_info[platform]:
                return False, f"Підписка на {platform} вже верифікована", verification_data

            # Позначаємо завдання як верифіковане
            return True, None, verification_data
        except Exception as e:
            logger.error(f"Помилка при верифікації підписки для користувача {telegram_id} на {platform}: {str(e)}")
            return False, f"Внутрішня помилка: {str(e)}", {}

    @staticmethod
    def verify_website_visit(telegram_id: str, website_url: str, proof_data: Optional[Dict[str, Any]] = None) -> Tuple[bool, Optional[str], Dict[str, Any]]:
        """
        Верифікує відвідування користувачем вебсайту.

        Args:
            telegram_id (str): Telegram ID користувача
            website_url (str): URL вебсайту
            proof_data (Dict[str, Any], optional): Дані для підтвердження відвідування

        Returns:
            Tuple[bool, Optional[str], Dict[str, Any]]:
                (успіх, повідомлення про помилку, дані верифікації)
        """
        try:
            # Нормалізуємо URL
            website_url = website_url.strip()

            # Перевіряємо, чи URL є валідним
            url_pattern = re.compile(
                r'^(?:http|https)://'  # http:// або https://
                r'(?:(?:[A-Z0-9](?:[A-Z0-9-]{0,61}[A-Z0-9])?\.)+(?:[A-Z]{2,6}\.?|[A-Z0-9-]{2,}\.?)|'  # домен
                r'localhost|'  # localhost
                r'\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})'  # або IP
                r'(?::\d+)?'  # опціональний порт
                r'(?:/?|[/?]\S+)$', re.IGNORECASE)

            if not url_pattern.match(website_url):
                return False, f"Невалідний URL: {website_url}", {}

            # Дата верифікації
            verification_time = datetime.now().isoformat()

            # Підготовка даних для верифікації
            verification_data = {
                "website_url": website_url,
                "verification_time": verification_time,
                "verification_method": "self_reported",
                "verification_status": "completed"
            }

            # Додаємо додаткові дані, якщо вони є
            if proof_data:
                verification_data.update(proof_data)

            return True, None, verification_data
        except Exception as e:
            logger.error(f"Помилка при верифікації відвідування сайту для користувача {telegram_id}: {str(e)}")
            return False, f"Внутрішня помилка: {str(e)}", {}

    @staticmethod
    def verify_custom_action(telegram_id: str, action_type: str, action_data: Dict[str, Any]) -> Tuple[bool, Optional[str], Dict[str, Any]]:
        """
        Верифікує виконання користувачем кастомної дії.

        Args:
            telegram_id (str): Telegram ID користувача
            action_type (str): Тип дії
            action_data (Dict[str, Any]): Дані для верифікації

        Returns:
            Tuple[bool, Optional[str], Dict[str, Any]]:
                (успіх, повідомлення про помилку, дані верифікації)
        """
        try:
            # Дата верифікації
            verification_time = datetime.now().isoformat()

            # Підготовка даних для верифікації
            verification_data = {
                "action_type": action_type,
                "verification_time": verification_time,
                "verification_method": "manual",
                "verification_status": "pending"  # Стан "очікує", потрібна подальша перевірка
            }

            # Додаємо додаткові дані, якщо вони є
            if action_data:
                verification_data.update(action_data)

            return True, None, verification_data
        except Exception as e:
            logger.error(f"Помилка при верифікації кастомної дії для користувача {telegram_id}: {str(e)}")
            return False, f"Внутрішня помилка: {str(e)}", {}

    @staticmethod
    def process_reward(telegram_id: str, task: Task, progress: UserProgress) -> Tuple[bool, Optional[str], Dict[str, Any]]:
        """
        Обробляє винагороду за виконання завдання.

        Args:
            telegram_id (str): Telegram ID користувача
            task (Task): Завдання, за яке видається винагорода
            progress (UserProgress): Прогрес виконання завдання

        Returns:
            Tuple[bool, Optional[str], Dict[str, Any]]:
                (успіх, повідомлення про помилку, дані транзакції)
        """
        try:
            # Перевіряємо, чи винагорода вже була видана
            if progress.reward_claimed:
                return False, "Винагорода вже була видана за це завдання", {}

            # Перевіряємо, чи завдання виконано
            if not progress.is_completed():
                return False, "Завдання не виконано", {}

            # Формуємо опис винагороди
            task_title = task.title[:50] + '...' if len(task.title) > 50 else task.title
            reward_description = f"Винагорода за завдання: {task_title}"

            # Визначаємо тип винагороди
            if task.reward_type == "tokens":
                # Винагорода в токенах WINIX
                result = execute_balance_transaction(
                    telegram_id=telegram_id,
                    amount=task.reward_amount,
                    type_name="task_reward",
                    description=reward_description
                )

                # Перевіряємо результат транзакції
                if result.get("status") != "success":
                    return False, f"Помилка видачі винагороди: {result.get('message', 'Невідома помилка')}", result

                # Позначаємо винагороду як видану
                progress.claim_reward()

                # Оновлюємо прогрес у базі даних
                update_response = supabase.table('user_progress').update(progress.to_dict()).eq('id', progress.id).execute()

                if not update_response.data or len(update_response.data) == 0:
                    logger.error("Не вдалося оновити статус отримання винагороди")
                    return False, "Не вдалося оновити статус отримання винагороди", result

                return True, None, result
            elif task.reward_type == "coins":
                # Для жетонів використовуємо іншу функцію транзакцій
                try:
                    from utils.transaction_helpers import execute_coin_transaction
                    result = execute_coin_transaction(
                        telegram_id=telegram_id,
                        amount=int(task.reward_amount),
                        type_name="task_reward",
                        description=reward_description
                    )
                except ImportError:
                    # Якщо функція недоступна, додаємо жетони як звичайну транзакцію
                    result = execute_balance_transaction(
                        telegram_id=telegram_id,
                        amount=task.reward_amount,
                        type_name="coin_reward",
                        description=f"Жетони за завдання: {task_title}"
                    )

                # Перевіряємо результат транзакції
                if result.get("status") != "success":
                    return False, f"Помилка видачі жетонів: {result.get('message', 'Невідома помилка')}", result

                # Позначаємо винагороду як видану
                progress.claim_reward()

                # Оновлюємо прогрес у базі даних
                update_response = supabase.table('user_progress').update(progress.to_dict()).eq('id', progress.id).execute()

                if not update_response.data or len(update_response.data) == 0:
                    logger.error("Не вдалося оновити статус отримання винагороди")
                    return False, "Не вдалося оновити статус отримання винагороди", result

                return True, None, result
            else:
                # Інші типи винагород
                logger.warning(f"Тип винагороди {task.reward_type} не підтримується")
                return False, f"Тип винагороди {task.reward_type} не підтримується", {}
        except Exception as e:
            logger.error(f"Помилка при обробці винагороди для користувача {telegram_id}: {str(e)}")
            return False, f"Внутрішня помилка: {str(e)}", {}

    @staticmethod
    def get_user_social_tasks(telegram_id: str) -> Dict[str, bool]:
        """
        Отримує статус соціальних завдань користувача.

        Args:
            telegram_id (str): Telegram ID користувача

        Returns:
            Dict[str, bool]: Словник статусів соціальних завдань
        """
        try:
            # Отримуємо користувача
            response = supabase.table("winix").select("social_tasks").eq("telegram_id", str(telegram_id)).execute()

            if not response.data or len(response.data) == 0:
                logger.warning(f"Користувача {telegram_id} не знайдено")
                return {}

            # Отримуємо статус соціальних завдань
            social_tasks = response.data[0].get("social_tasks", {})

            if not social_tasks:
                return {}

            return social_tasks
        except Exception as e:
            logger.error(f"Помилка при отриманні статусу соціальних завдань користувача {telegram_id}: {str(e)}")
            return {}

    @staticmethod
    def update_user_social_tasks(telegram_id: str, platform: str, completed: bool = True) -> bool:
        """
        Оновлює статус соціального завдання користувача.

        Args:
            telegram_id (str): Telegram ID користувача
            platform (str): Назва платформи
            completed (bool, optional): Статус виконання

        Returns:
            bool: True, якщо оновлення успішне, False у випадку помилки
        """
        try:
            # Нормалізуємо назву платформи
            platform = platform.lower().strip()

            # Отримуємо поточний статус соціальних завдань
            current_tasks = VerificationService.get_user_social_tasks(telegram_id)

            # Оновлюємо статус
            current_tasks[platform] = completed

            # Зберігаємо в базі даних
            response = supabase.table("winix").update({"social_tasks": current_tasks}).eq("telegram_id", str(telegram_id)).execute()

            if not response.data or len(response.data) == 0:
                logger.error(f"Не вдалося оновити статус соціальних завдань користувача {telegram_id}")
                return False

            logger.info(f"Статус соціального завдання {platform} для користувача {telegram_id} оновлено на {completed}")
            return True
        except Exception as e:
            logger.error(f"Помилка при оновленні статусу соціальних завдань користувача {telegram_id}: {str(e)}")
            return False