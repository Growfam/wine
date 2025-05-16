"""
Модуль для ініціалізації бази даних
"""
from flask_sqlalchemy import SQLAlchemy

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
    db.init_app(app)
    return db