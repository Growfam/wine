"""
Модуль налаштувань WINIX
"""

from .config import (
    Config,
    DevelopmentConfig,
    ProductionConfig,
    TestingConfig,
    get_config
)

# Створюємо екземпляр конфігурації при імпорті для використання в інших модулях
current_config = get_config()