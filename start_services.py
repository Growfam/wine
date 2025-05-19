"""
Скрипт для запуску всіх сервісів WINIX
Веб-аппа та Telegram бота
"""

import os
import sys
import asyncio
import subprocess
import threading
import time
import logging
from dotenv import load_dotenv

# Завантажуємо змінні середовища
load_dotenv()

# Налаштування логування
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)


def run_flask_app():
    """Запускає Flask веб-аппу"""
    try:
        logger.info("Запуск Flask веб-аппу...")
        os.chdir('backend')
        subprocess.run([sys.executable, 'main.py'], check=True)
    except Exception as e:
        logger.error(f"Помилка запуску Flask: {str(e)}")


async def run_telegram_bot():
    """Запускає Telegram бота"""
    try:
        logger.info("Запуск Telegram бота...")

        # Імпортуємо та запускаємо бота
        sys.path.append(os.path.dirname(os.path.abspath(__file__)))
        from telegram_bot import main as bot_main

        await bot_main()
    except Exception as e:
        logger.error(f"Помилка запуску бота: {str(e)}")


def setup_webhook():
    """Налаштовує webhook для бота"""
    try:
        import requests

        bot_token = os.getenv('TELEGRAM_BOT_TOKEN')
        webhook_url = os.getenv('WEBHOOK_URL')
        use_webhook = os.getenv('USE_WEBHOOK', 'false').lower() == 'true'

        if use_webhook and webhook_url and bot_token:
            logger.info("Налаштування webhook...")

            # Встановлюємо webhook
            telegram_api_url = f"https://api.telegram.org/bot{bot_token}/setWebhook"

            response = requests.post(telegram_api_url, json={
                'url': f"{webhook_url}/telegram/webhook",
                'allowed_updates': ['message', 'callback_query']
            })

            if response.status_code == 200:
                result = response.json()
                if result.get('ok'):
                    logger.info("Webhook успішно налаштовано")
                else:
                    logger.error(f"Помилка налаштування webhook: {result}")
            else:
                logger.error(f"HTTP помилка: {response.status_code}")
        else:
            logger.info("Webhook не налаштований (використовується polling)")

    except Exception as e:
        logger.error(f"Помилка налаштування webhook: {str(e)}")


def main():
    """Основна функція запуску"""
    mode = os.getenv('RUN_MODE', 'both').lower()

    if mode == 'webapp':
        # Тільки веб-апп
        logger.info("Запуск в режимі тільки веб-апп")
        run_flask_app()

    elif mode == 'bot':
        # Тільки бот
        logger.info("Запуск в режимі тільки бот")
        asyncio.run(run_telegram_bot())

    elif mode == 'webhook':
        # Тільки веб-апп з webhook
        logger.info("Запуск в режимі webhook")
        setup_webhook()
        run_flask_app()

    else:
        # Обидва сервіси (за замовчуванням)
        logger.info("Запуск всіх сервісів...")

        # Налаштовуємо webhook якщо потрібно
        setup_webhook()

        use_webhook = os.getenv('USE_WEBHOOK', 'false').lower() == 'true'

        if use_webhook:
            # В режимі webhook тільки Flask
            run_flask_app()
        else:
            # В режимі polling - обидва сервіси
            # Запускаємо Flask в окремому потоці
            flask_thread = threading.Thread(target=run_flask_app)
            flask_thread.daemon = True
            flask_thread.start()

            # Даємо час Flask запуститися
            time.sleep(3)

            # Запускаємо бота в основному потоці
            asyncio.run(run_telegram_bot())


if __name__ == "__main__":
    main()