from . import controllers

# Експортуємо основні функції, щоб можна було імпортувати прямо з пакету
get_text = controllers.get_text
get_user_language = controllers.get_user_language
load_translations = controllers.load_translations
AVAILABLE_LANGUAGES = controllers.AVAILABLE_LANGUAGES