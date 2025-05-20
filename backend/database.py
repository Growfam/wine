"""
Модуль для ініціалізації бази даних
"""
from flask_sqlalchemy import SQLAlchemy
import logging
import os

# Налаштування логування
logger = logging.getLogger(__name__)

# Ініціалізація SQLAlchemy
db = SQLAlchemy()


def init_db(app):
    """
    Ініціалізує підключення до бази даних

    Args:
        app: Екземпляр Flask додатку

    Returns:
        SQLAlchemy: Ініціалізований екземпляр SQLAlchemy
    """
    try:
        # Встановлення конфігурації підключення до бази даних
        if 'SQLALCHEMY_DATABASE_URI' not in app.config:
            app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'sqlite:///winix.db')

        if 'SQLALCHEMY_TRACK_MODIFICATIONS' not in app.config:
            app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

        # Ініціалізація бази даних з додатком
        db.init_app(app)

        # Створення всіх таблиць в контексті додатку
        with app.app_context():
            # Перевірка з'єднання
            engine = db.engine
            try:
                connection = engine.connect()
                connection.close()
                logger.info("Успішне з'єднання з базою даних")
            except Exception as e:
                logger.error(f"Помилка з'єднання з базою даних: {str(e)}")
                raise

            # Створення таблиць
            try:
                db.create_all()
                logger.info("Таблиці бази даних створено або вони вже існують")
            except Exception as e:
                logger.error(f"Помилка створення таблиць: {str(e)}")
                raise

        logger.info("База даних успішно ініціалізована")
        return db
    except Exception as e:
        logger.error(f"Помилка ініціалізації бази даних: {str(e)}")
        raise