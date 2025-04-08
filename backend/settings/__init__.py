from .config import (
    Config,
    DevelopmentConfig,
    ProductionConfig,
    TestingConfig,
    get_config
)

# Створюємо екземпляр конфігурації при імпорті для використання
current_config = get_config()