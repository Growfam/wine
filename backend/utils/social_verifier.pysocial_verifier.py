"""
Утилітарний модуль для верифікації активності в соціальних мережах.
Надає функції для перевірки підписок, лайків та репостів у різних соціальних мережах.
"""
import logging
import requests
import re
import os
import json
import time
from typing import Dict, Any, Optional, Tuple, List

# Налаштування логування
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Константи для API
DEFAULT_TIMEOUT = 10  # секунд
MAX_RETRIES = 3
RETRY_DELAY = 2  # секунд

# Ключі API для соціальних мереж
TWITTER_API_KEY = os.getenv("TWITTER_API_KEY", "")
TWITTER_API_SECRET = os.getenv("TWITTER_API_SECRET", "")
TELEGRAM_BOT_TOKEN = os.getenv("TELEGRAM_BOT_TOKEN", "")


class SocialVerifier:
    """
    Клас для верифікації активності користувачів у соціальних мережах.
    Містить методи для перевірки різних типів активності.
    """

    @staticmethod
    def verify_telegram_subscription(user_id: str, channel_username: str) -> Tuple[bool, Optional[str]]:
        """
        Перевіряє підписку користувача на Telegram-канал.

        Args:
            user_id (str): Telegram ID користувача
            channel_username (str): Юзернейм каналу (без @)

        Returns:
            Tuple[bool, Optional[str]]: (результат, повідомлення про помилку)
        """
        if not TELEGRAM_BOT_TOKEN:
            logger.warning("TELEGRAM_BOT_TOKEN не налаштовано")
            return True, None  # Вважаємо успішним за замовчуванням, якщо немає API-ключа

        try:
            # Нормалізуємо юзернейм каналу
            channel_username = channel_username.lstrip('@')

            # Отримуємо інформацію про канал
            channel_info_url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/getChat?chat_id=@{channel_username}"

            response = requests.get(channel_info_url, timeout=DEFAULT_TIMEOUT)
            response.raise_for_status()

            channel_data = response.json()

            if not channel_data.get("ok"):
                return False, f"Не вдалося отримати інформацію про канал: {channel_data.get('description')}"

            chat_id = channel_data["result"]["id"]

            # Перевіряємо, чи користувач є учасником каналу
            check_member_url = f"https://api.telegram.org/bot{TELEGRAM_BOT_TOKEN}/getChatMember?chat_id={chat_id}&user_id={user_id}"

            response = requests.get(check_member_url, timeout=DEFAULT_TIMEOUT)
            response.raise_for_status()

            member_data = response.json()

            if not member_data.get("ok"):
                return False, f"Не вдалося перевірити підписку: {member_data.get('description')}"

            status = member_data["result"]["status"]

            # Успішні статуси: creator, administrator, member
            if status in ["creator", "administrator", "member"]:
                return True, None
            else:
                return False, f"Користувач не підписаний на канал. Статус: {status}"
        except requests.RequestException as e:
            logger.error(f"Помилка запиту до Telegram API: {str(e)}")
            return False, f"Помилка запиту до Telegram API: {str(e)}"
        except Exception as e:
            logger.error(f"Помилка при перевірці підписки на Telegram-канал: {str(e)}")
            return False, f"Помилка при перевірці підписки на Telegram-канал: {str(e)}"

    @staticmethod
    def verify_twitter_follow(username: str, target_username: str) -> Tuple[bool, Optional[str]]:
        """
        Перевіряє, чи користувач підписаний на Twitter-акаунт.

        Args:
            username (str): Юзернейм користувача
            target_username (str): Юзернейм цільового акаунта

        Returns:
            Tuple[bool, Optional[str]]: (результат, повідомлення про помилку)
        """
        if not TWITTER_API_KEY or not TWITTER_API_SECRET:
            logger.warning("Twitter API ключі не налаштовані")
            return True, None  # Вважаємо успішним за замовчуванням, якщо немає API-ключів

        try:
            # Отримуємо токен доступу
            auth_url = "https://api.twitter.com/oauth2/token"
            auth_data = {
                "grant_type": "client_credentials"
            }
            auth_headers = {
                "Authorization": f"Basic {TWITTER_API_KEY}:{TWITTER_API_SECRET}"
            }

            auth_response = requests.post(auth_url, data=auth_data, headers=auth_headers, timeout=DEFAULT_TIMEOUT)
            auth_response.raise_for_status()

            auth_data = auth_response.json()
            access_token = auth_data.get("access_token")

            if not access_token:
                return False, "Не вдалося отримати токен доступу до Twitter API"

            # Нормалізуємо юзернейми
            username = username.lstrip('@')
            target_username = target_username.lstrip('@')

            # Перевіряємо підписку
            relationship_url = f"https://api.twitter.com/1.1/friendships/show.json?source_screen_name={username}&target_screen_name={target_username}"
            headers = {
                "Authorization": f"Bearer {access_token}"
            }

            relationship_response = requests.get(relationship_url, headers=headers, timeout=DEFAULT_TIMEOUT)
            relationship_response.raise_for_status()

            relationship_data = relationship_response.json()

            if "relationship" not in relationship_data:
                return False, "Не вдалося отримати інформацію про підписку"

            source = relationship_data["relationship"].get("source", {})
            following = source.get("following", False)

            if following:
                return True, None
            else:
                return False, "Користувач не підписаний на цільовий акаунт"
        except requests.RequestException as e:
            logger.error(f"Помилка запиту до Twitter API: {str(e)}")
            return False, f"Помилка запиту до Twitter API: {str(e)}"
        except Exception as e:
            logger.error(f"Помилка при перевірці підписки на Twitter: {str(e)}")
            return False, f"Помилка при перевірці підписки на Twitter: {str(e)}"

    @staticmethod
    def verify_custom_proof(platform: str, proof_data: Dict[str, Any]) -> Tuple[bool, Optional[str]]:
        """
        Перевіряє користувацьке підтвердження активності у соціальній мережі.

        Args:
            platform (str): Назва платформи
            proof_data (Dict[str, Any]): Дані для верифікації

        Returns:
            Tuple[bool, Optional[str]]: (результат, повідомлення про помилку)
        """
        try:
            # Перевіряємо наявність скріншоту або URL
            proof_url = proof_data.get("proof_url")
            screenshot_url = proof_data.get("screenshot_url")

            if not proof_url and not screenshot_url:
                return False, "Необхідно надати URL доказу або скріншот"

            # В цій імплементації ми не робимо реальної перевірки, а просто приймаємо доказ
            # В реальному додатку тут має бути логіка перевірки доказів

            logger.info(f"Отримано доказ підписки на {platform}. Підтвердження прийнято.")
            return True, None
        except Exception as e:
            logger.error(f"Помилка при перевірці доказу для {platform}: {str(e)}")
            return False, f"Помилка при перевірці доказу: {str(e)}"

    @staticmethod
    def validate_social_media_url(url: str, platform: str) -> Tuple[bool, Optional[str]]:
        """
        Перевіряє, чи URL належить вказаній соціальній мережі.

        Args:
            url (str): URL для перевірки
            platform (str): Назва платформи

        Returns:
            Tuple[bool, Optional[str]]: (результат, повідомлення про помилку)
        """
        try:
            # Паттерни для різних соціальних мереж
            patterns = {
                "twitter": r"^https?:\/\/(www\.)?(twitter\.com|x\.com)\/[a-zA-Z0-9_]{1,15}",
                "telegram": r"^https?:\/\/(www\.)?(t\.me|telegram\.me)\/[a-zA-Z0-9_]{5,}",
                "instagram": r"^https?:\/\/(www\.)?instagram\.com\/[a-zA-Z0-9_.]{1,30}",
                "facebook": r"^https?:\/\/(www\.)?(facebook\.com|fb\.com)\/[a-zA-Z0-9.]{5,}",
                "youtube": r"^https?:\/\/(www\.)?(youtube\.com|youtu\.be)\/(@?[a-zA-Z0-9_-]{3,}|watch\?v=[a-zA-Z0-9_-]{11})",
                "discord": r"^https?:\/\/(www\.)?(discord\.gg|discord\.com\/invite)\/[a-zA-Z0-9]{5,}",
                "tiktok": r"^https?:\/\/(www\.)?(tiktok\.com)\/(@[a-zA-Z0-9_.]{2,})?"
            }

            # Перевіряємо, чи підтримується платформа
            if platform.lower() not in patterns:
                return False, f"Платформа {platform} не підтримується"

            # Перевіряємо URL за допомогою регулярного виразу
            pattern = patterns[platform.lower()]
            match = re.match(pattern, url)

            if match:
                return True, None
            else:
                return False, f"URL не відповідає формату {platform}"
        except Exception as e:
            logger.error(f"Помилка при валідації URL для {platform}: {str(e)}")
            return False, f"Помилка при валідації URL: {str(e)}"

    @staticmethod
    def extract_username_from_url(url: str, platform: str) -> Optional[str]:
        """
        Витягує юзернейм з URL соціальної мережі.

        Args:
            url (str): URL соціальної мережі
            platform (str): Назва платформи

        Returns:
            Optional[str]: Юзернейм або None
        """
        try:
            # Пайттерни для різних соціальних мереж
            patterns = {
                "twitter": r"twitter\.com\/([a-zA-Z0-9_]{1,15})",
                "x": r"x\.com\/([a-zA-Z0-9_]{1,15})",
                "telegram": r"t\.me\/([a-zA-Z0-9_]{5,})",
                "instagram": r"instagram\.com\/([a-zA-Z0-9_.]{1,30})",
                "facebook": r"facebook\.com\/([a-zA-Z0-9.]{5,})",
                "youtube": r"youtube\.com\/(@?[a-zA-Z0-9_-]{3,})",
                "discord": r"discord\.gg\/([a-zA-Z0-9]{5,})"
            }

            # Перевіряємо, чи підтримується платформа
            platform_key = platform.lower()
            if platform_key == "x":
                platform_key = "twitter"

            if platform_key not in patterns:
                return None

            # Використовуємо регулярний вираз для витягування юзернейма
            pattern = patterns[platform_key]
            match = re.search(pattern, url)

            if match:
                return match.group(1)
            else:
                return None
        except Exception as e:
            logger.error(f"Помилка при витягуванні юзернейма з URL для {platform}: {str(e)}")
            return None

    # Допоміжний метод для спроб запитів з повторами
    @staticmethod
    def _make_request_with_retry(url: str, method: str = "GET", headers: Dict[str, str] = None,
                                 data: Dict[str, Any] = None, max_retries: int = MAX_RETRIES,
                                 timeout: int = DEFAULT_TIMEOUT) -> Optional[requests.Response]:
        """
        Виконує HTTP-запит з повторними спробами у разі невдачі.

        Args:
            url (str): URL для запиту
            method (str): HTTP-метод (GET, POST, etc.)
            headers (Dict[str, str], optional): Заголовки запиту
            data (Dict[str, Any], optional): Дані для передачі
            max_retries (int, optional): Максимальна кількість спроб
            timeout (int, optional): Таймаут для запиту в секундах

        Returns:
            Optional[requests.Response]: Відповідь на запит або None
        """
        retries = 0
        while retries < max_retries:
            try:
                if method.upper() == "GET":
                    response = requests.get(url, headers=headers, timeout=timeout)
                elif method.upper() == "POST":
                    response = requests.post(url, headers=headers, json=data, timeout=timeout)
                else:
                    return None

                response.raise_for_status()
                return response
            except requests.RequestException as e:
                retries += 1
                logger.warning(f"Спроба {retries}/{max_retries} не вдалася: {str(e)}")

                if retries < max_retries:
                    time.sleep(RETRY_DELAY)
                else:
                    logger.error(f"Всі {max_retries} спроб не вдалися: {str(e)}")
                    return None

        return None