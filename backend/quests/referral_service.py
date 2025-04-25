"""
Сервіс для роботи з реферальною системою в WINIX.
Надає функціонал для управління реферальними запрошеннями та винагородами.
"""
import logging
import sys
import os
import random
import string
from typing import List, Dict, Any, Optional, Tuple
from datetime import datetime

# Додаємо кореневу папку проекту до шляху
current_dir = os.path.dirname(os.path.abspath(__file__))
parent_dir = os.path.dirname(current_dir)
if parent_dir not in sys.path:
    sys.path.append(parent_dir)

# Імпорт моделей та інших залежностей
from models.referral import Referral, REWARD_STATUS_PENDING, REWARD_STATUS_PAID
from utils.transaction_helpers import execute_balance_transaction
from supabase_client import supabase

# Налаштування логування
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)


class ReferralService:
    """
    Сервіс для роботи з реферальною системою.
    Надає методи для управління реферальними запрошеннями та винагородами.
    """

    # Розмір винагороди за реферала
    DEFAULT_REFERRAL_REWARD = 50.0

    @staticmethod
    def generate_referral_code(length: int = 8) -> str:
        """
        Генерує унікальний реферальний код.

        Args:
            length (int, optional): Довжина коду

        Returns:
            str: Згенерований реферальний код
        """
        chars = string.ascii_uppercase + string.digits
        code = ''.join(random.choice(chars) for _ in range(length))
        return code

    @staticmethod
    def get_user_referral_code(telegram_id: str) -> Optional[str]:
        """
        Отримує реферальний код користувача.

        Args:
            telegram_id (str): Telegram ID користувача

        Returns:
            Optional[str]: Реферальний код або None
        """
        try:
            # Отримуємо дані користувача
            response = supabase.table("winix").select("referral_code").eq("telegram_id", str(telegram_id)).execute()

            if not response.data or len(response.data) == 0:
                logger.warning(f"Користувача {telegram_id} не знайдено")
                return None

            referral_code = response.data[0].get("referral_code")

            # Якщо код не існує, генеруємо новий
            if not referral_code:
                referral_code = ReferralService.generate_referral_code()

                # Зберігаємо новий код
                update_response = supabase.table("winix").update({"referral_code": referral_code}).eq("telegram_id",
                                                                                                      str(telegram_id)).execute()

                if not update_response.data or len(update_response.data) == 0:
                    logger.error(f"Не вдалося оновити реферальний код для користувача {telegram_id}")
                    return None

            logger.info(f"Отримано реферальний код для користувача {telegram_id}: {referral_code}")
            return referral_code
        except Exception as e:
            logger.error(f"Помилка при отриманні реферального коду для користувача {telegram_id}: {str(e)}")
            return None

    @staticmethod
    def get_user_by_referral_code(referral_code: str) -> Optional[Dict[str, Any]]:
        """
        Отримує користувача за реферальним кодом.

        Args:
            referral_code (str): Реферальний код

        Returns:
            Optional[Dict[str, Any]]: Дані користувача або None
        """
        try:
            # Отримуємо користувача за кодом
            response = supabase.table("winix").select("telegram_id,username,referral_code").eq("referral_code",
                                                                                               referral_code).execute()

            if not response.data or len(response.data) == 0:
                logger.warning(f"Користувача з реферальним кодом {referral_code} не знайдено")
                return None

            user_data = response.data[0]

            logger.info(f"Знайдено користувача з реферальним кодом {referral_code}: {user_data.get('telegram_id')}")
            return user_data
        except Exception as e:
            logger.error(f"Помилка при отриманні користувача за реферальним кодом {referral_code}: {str(e)}")
            return None

    @staticmethod
    def create_referral(referrer_id: str, referee_id: str, reward_amount: Optional[float] = None) -> Optional[Referral]:
        """
        Створює новий реферальний запис.

        Args:
            referrer_id (str): Telegram ID користувача, який запросив
            referee_id (str): Telegram ID запрошеного користувача
            reward_amount (float, optional): Сума винагороди за реферала

        Returns:
            Optional[Referral]: Створений реферальний запис або None
        """
        try:
            # Перевіряємо, чи не намагається користувач запросити сам себе
            if str(referrer_id) == str(referee_id):
                logger.warning(f"Користувач {referrer_id} намагається запросити сам себе")
                return None

            # Перевіряємо, чи вже існує такий реферальний запис
            existing_response = supabase.table("referrals").select("*").eq("referee_id", str(referee_id)).execute()

            if existing_response.data and len(existing_response.data) > 0:
                logger.warning(f"Реферальний запис для користувача {referee_id} вже існує")
                referral = Referral.from_dict(existing_response.data[0])
                return referral

            # Визначаємо суму винагороди
            if reward_amount is None:
                reward_amount = ReferralService.DEFAULT_REFERRAL_REWARD

            # Створюємо новий реферальний запис
            referral = Referral(
                referrer_id=referrer_id,
                referee_id=referee_id,
                reward_amount=reward_amount
            )

            # Зберігаємо в базі даних
            response = supabase.table("referrals").insert(referral.to_dict()).execute()

            if not response.data or len(response.data) == 0:
                logger.error("Не вдалося створити реферальний запис")
                return None

            logger.info(f"Створено новий реферальний запис: {referrer_id} запросив {referee_id}")

            # Оновлюємо дані користувача, якщо він новий
            ReferralService.update_user_referrer(referee_id, referrer_id)

            return referral
        except Exception as e:
            logger.error(f"Помилка при створенні реферального запису: {str(e)}")
            return None

    @staticmethod
    def update_user_referrer(telegram_id: str, referrer_id: str) -> bool:
        """
        Оновлює дані про того, хто запросив користувача.

        Args:
            telegram_id (str): Telegram ID користувача
            referrer_id (str): Telegram ID користувача, який запросив

        Returns:
            bool: True, якщо оновлення успішне, False у випадку помилки
        """
        try:
            # Отримуємо дані користувача
            response = supabase.table("winix").select("referrer_id").eq("telegram_id", str(telegram_id)).execute()

            if not response.data or len(response.data) == 0:
                logger.warning(f"Користувача {telegram_id} не знайдено")
                return False

            # Перевіряємо, чи вже є реферер
            current_referrer = response.data[0].get("referrer_id")

            if current_referrer:
                logger.info(f"Користувач {telegram_id} вже має реферера: {current_referrer}")
                return False

            # Оновлюємо реферера
            update_response = supabase.table("winix").update({"referrer_id": str(referrer_id)}).eq("telegram_id",
                                                                                                   str(telegram_id)).execute()

            if not update_response.data or len(update_response.data) == 0:
                logger.error(f"Не вдалося оновити реферера для користувача {telegram_id}")
                return False

            logger.info(f"Оновлено реферера для користувача {telegram_id}: {referrer_id}")
            return True
        except Exception as e:
            logger.error(f"Помилка при оновленні реферера для користувача {telegram_id}: {str(e)}")
            return False

    @staticmethod
    def get_user_referrals(referrer_id: str) -> Dict[str, Any]:
        """
        Отримує інформацію про рефералів користувача.

        Args:
            referrer_id (str): Telegram ID користувача

        Returns:
            Dict[str, Any]: Інформація про рефералів
        """
        try:
            # Отримуємо реферальні записи
            response = supabase.table("referrals").select("*").eq("referrer_id", str(referrer_id)).execute()

            # Ініціалізуємо об'єкт зі статистикою
            referrals_stats = {
                "total_count": 0,
                "pending_count": 0,
                "paid_count": 0,
                "total_earned": 0.0,
                "referrals": []
            }

            if not response.data:
                logger.info(f"Користувач {referrer_id} не має рефералів")
                return referrals_stats

            # Наповнюємо статистику
            referrals = []
            for referral_data in response.data:
                referral = Referral.from_dict(referral_data)

                # Додаємо до загальної статистики
                referrals_stats["total_count"] += 1

                if referral.status == REWARD_STATUS_PENDING:
                    referrals_stats["pending_count"] += 1
                elif referral.status == REWARD_STATUS_PAID:
                    referrals_stats["paid_count"] += 1
                    referrals_stats["total_earned"] += referral.reward_amount

                # Отримуємо дані реферала
                referee_response = supabase.table("winix").select("username").eq("telegram_id",
                                                                                 str(referral.referee_id)).execute()

                referee_username = "Користувач"
                if referee_response.data and len(referee_response.data) > 0:
                    referee_username = referee_response.data[0].get("username", "Користувач")

                # Додаємо реферала до списку
                referrals.append({
                    "id": referral.id,
                    "referee_id": referral.referee_id,
                    "referee_username": referee_username,
                    "status": referral.status,
                    "reward_amount": referral.reward_amount,
                    "created_at": referral.created_at.isoformat() if isinstance(referral.created_at,
                                                                                datetime) else referral.created_at,
                    "reward_paid_at": referral.reward_paid_at.isoformat() if isinstance(referral.reward_paid_at,
                                                                                        datetime) and referral.reward_paid_at else None
                })

            # Сортуємо рефералів за датою (спочатку найновіші)
            referrals.sort(key=lambda x: x["created_at"], reverse=True)

            referrals_stats["referrals"] = referrals

            logger.info(f"Отримано {referrals_stats['total_count']} рефералів для користувача {referrer_id}")
            return referrals_stats
        except Exception as e:
            logger.error(f"Помилка при отриманні рефералів для користувача {referrer_id}: {str(e)}")
            return {
                "total_count": 0,
                "pending_count": 0,
                "paid_count": 0,
                "total_earned": 0.0,
                "referrals": [],
                "error": str(e)
            }

    @staticmethod
    def process_referral_reward(referral_id: str) -> Tuple[bool, Optional[str], Dict[str, Any]]:
        """
        Обробляє винагороду за реферала.

        Args:
            referral_id (str): ID реферального запису

        Returns:
            Tuple[bool, Optional[str], Dict[str, Any]]:
                (успіх, повідомлення про помилку, дані транзакції)
        """
        try:
            # Отримуємо реферальний запис
            response = supabase.table("referrals").select("*").eq("id", referral_id).execute()

            if not response.data or len(response.data) == 0:
                logger.error(f"Реферальний запис {referral_id} не знайдено")
                return False, f"Реферальний запис {referral_id} не знайдено", {}

            # Створюємо об'єкт реферального запису
            referral = Referral.from_dict(response.data[0])

            # Перевіряємо, чи винагорода вже виплачена
            if referral.is_paid():
                logger.warning(f"Винагорода за реферал {referral_id} вже виплачена")
                return False, "Винагорода вже виплачена", {}

            # Виконуємо транзакцію для нарахування винагороди
            reward_description = f"Реферальна винагорода за запрошення користувача"

            result = execute_balance_transaction(
                telegram_id=referral.referrer_id,
                amount=referral.reward_amount,
                type_name="referral_reward",
                description=reward_description
            )

            # Перевіряємо результат транзакції
            if result.get("status") != "success":
                logger.error(f"Помилка видачі реферальної винагороди: {result.get('message', 'Невідома помилка')}")
                return False, f"Помилка видачі винагороди: {result.get('message', 'Невідома помилка')}", result

            # Оновлюємо статус реферального запису
            referral.pay_reward()

            # Зберігаємо оновлений запис
            update_response = supabase.table("referrals").update(referral.to_dict()).eq("id", referral_id).execute()

            if not update_response.data or len(update_response.data) == 0:
                logger.error(f"Не вдалося оновити реферальний запис {referral_id}")
                return False, "Не вдалося оновити статус реферального запису", result

            logger.info(f"Успішно виплачено реферальну винагороду за запис {referral_id}")
            return True, None, result
        except Exception as e:
            logger.error(f"Помилка при обробці реферальної винагороди для запису {referral_id}: {str(e)}")
            return False, f"Внутрішня помилка: {str(e)}", {}

    @staticmethod
    def process_all_pending_rewards() -> Dict[str, Any]:
        """
        Обробляє всі очікуючі реферальні винагороди.

        Returns:
            Dict[str, Any]: Статистика обробки винагород
        """
        try:
            # Отримуємо всі очікуючі реферальні записи
            response = supabase.table("referrals").select("*").eq("status", REWARD_STATUS_PENDING).execute()

            if not response.data:
                logger.info("Немає очікуючих реферальних винагород")
                return {
                    "success": True,
                    "processed_count": 0,
                    "failed_count": 0,
                    "total_amount": 0.0,
                    "details": []
                }

            # Обробляємо кожен запис
            processed_count = 0
            failed_count = 0
            total_amount = 0.0
            details = []

            for referral_data in response.data:
                referral = Referral.from_dict(referral_data)

                # Обробляємо винагороду
                success, error_message, transaction_data = ReferralService.process_referral_reward(referral.id)

                # Зберігаємо результат
                result = {
                    "referral_id": referral.id,
                    "referrer_id": referral.referrer_id,
                    "referee_id": referral.referee_id,
                    "amount": referral.reward_amount,
                    "success": success
                }

                if success:
                    processed_count += 1
                    total_amount += referral.reward_amount
                else:
                    failed_count += 1
                    result["error"] = error_message

                details.append(result)

            logger.info(f"Оброблено {processed_count} реферальних винагород, невдалих: {failed_count}")

            return {
                "success": True,
                "processed_count": processed_count,
                "failed_count": failed_count,
                "total_amount": total_amount,
                "details": details
            }
        except Exception as e:
            logger.error(f"Помилка при обробці очікуючих реферальних винагород: {str(e)}")
            return {
                "success": False,
                "error": str(e),
                "processed_count": 0,
                "failed_count": 0,
                "total_amount": 0.0,
                "details": []
            }