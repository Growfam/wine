"""
Скрипт для перевірки реєстрації маршрутів API розіграшів
"""
import logging
import sys
import os

# Додаємо базовий шлях до проекту
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BASE_DIR)

# Налаштування логування
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(name)s - %(message)s'
)
logger = logging.getLogger(__name__)


def check_routes():
    """Перевірка реєстрації маршрутів розіграшів"""
    try:
        # Створюємо тестовий застосунок Flask
        from flask import Flask
        app = Flask(__name__)

        # Імпортуємо функцію реєстрації маршрутів
        try:
            from raffles.routes import register_raffles_routes
            logger.info("Успішно імпортовано register_raffles_routes")
        except ImportError as e:
            logger.error(f"Помилка імпорту register_raffles_routes: {str(e)}")
            return False

        # Реєструємо маршрути
        try:
            register_raffles_routes(app)
            logger.info("Успішно зареєстровано маршрути розіграшів")
        except Exception as e:
            logger.error(f"Помилка реєстрації маршрутів: {str(e)}")
            return False

        # Виводимо список зареєстрованих маршрутів
        raffle_routes = []
        for rule in app.url_map.iter_rules():
            if 'raffles' in str(rule):
                raffle_routes.append({
                    "endpoint": rule.endpoint,
                    "methods": list(rule.methods),
                    "path": str(rule)
                })

        logger.info(f"Зареєстровано {len(raffle_routes)} маршрутів розіграшів:")
        for route in raffle_routes:
            logger.info(f"  {route['path']} - {', '.join(route['methods'])}")

        return True
    except Exception as e:
        logger.error(f"Критична помилка під час перевірки маршрутів: {str(e)}")
        return False


if __name__ == "__main__":
    success = check_routes()
    sys.exit(0 if success else 1)