from flask import request, g
import logging
import os
import json

# Налаштування логування
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Шлях до папки з перекладами
TRANSLATIONS_PATH = os.path.join(os.path.dirname(__file__), 'translations')

# Доступні мови
AVAILABLE_LANGUAGES = {
    'uk': 'Українська',
    'en': 'English',
    'ru': 'Русский'
}

# Мова за замовчуванням
DEFAULT_LANGUAGE = 'uk'

# Словники перекладів для кожної мови
translations = {}


def load_translations():
    """
    Завантажує всі переклади з файлів
    """
    try:
        global translations

        # Створюємо папку з перекладами, якщо вона не існує
        if not os.path.exists(TRANSLATIONS_PATH):
            os.makedirs(TRANSLATIONS_PATH)
            logger.info(f"Створено папку з перекладами: {TRANSLATIONS_PATH}")

        # Завантажуємо переклади для кожної мови
        for lang_code in AVAILABLE_LANGUAGES.keys():
            translations[lang_code] = load_language_file(lang_code)

        logger.info(f"Завантажено переклади для мов: {', '.join(translations.keys())}")

    except Exception as e:
        logger.error(f"Помилка завантаження перекладів: {str(e)}")
        # Ініціалізуємо пустими словниками, якщо виникла помилка
        for lang_code in AVAILABLE_LANGUAGES.keys():
            if lang_code not in translations:
                translations[lang_code] = {}


def load_language_file(lang_code):
    """
    Завантажує файл перекладу для конкретної мови
    """
    try:
        file_path = os.path.join(TRANSLATIONS_PATH, f"{lang_code}.json")

        # Якщо файл не існує, створюємо порожній словник
        if not os.path.exists(file_path):
            return {}

        with open(file_path, 'r', encoding='utf-8') as file:
            return json.load(file)

    except Exception as e:
        logger.error(f"Помилка завантаження мовного файлу {lang_code}: {str(e)}")
        return {}


def save_language_file(lang_code, data):
    """
    Зберігає словник перекладів для конкретної мови у файл
    """
    try:
        file_path = os.path.join(TRANSLATIONS_PATH, f"{lang_code}.json")

        with open(file_path, 'w', encoding='utf-8') as file:
            json.dump(data, file, ensure_ascii=False, indent=2)

        logger.info(f"Збережено файл перекладу для мови {lang_code}")
        return True

    except Exception as e:
        logger.error(f"Помилка збереження мовного файлу {lang_code}: {str(e)}")
        return False


def get_user_language():
    """
    Визначає мову користувача на основі заголовків запиту або сесії
    """
    # Спочатку перевіряємо мову з заголовка X-User-Language
    lang = request.headers.get('X-User-Language')

    # Якщо немає, перевіряємо Accept-Language
    if not lang or lang not in AVAILABLE_LANGUAGES:
        accept_lang = request.headers.get('Accept-Language', '')

        # Парсимо заголовок Accept-Language
        for lang_part in accept_lang.split(','):
            lang_code = lang_part.split(';')[0].strip().lower()[:2]
            if lang_code in AVAILABLE_LANGUAGES:
                lang = lang_code
                break

    # Якщо і так не визначили, використовуємо мову за замовчуванням
    if not lang or lang not in AVAILABLE_LANGUAGES:
        lang = DEFAULT_LANGUAGE

    return lang


def get_text(key, lang=None, **kwargs):
    """
    Отримує переклад для ключа на вказаній мові
    """
    # Якщо мова не вказана, визначаємо з контексту запиту
    if not lang:
        lang = g.get('language', get_user_language())

    # Перевіряємо, чи існує переклад для даного ключа
    if lang in translations and key in translations[lang]:
        text = translations[lang][key]
    elif DEFAULT_LANGUAGE in translations and key in translations[DEFAULT_LANGUAGE]:
        # Якщо немає перекладу на вказаній мові, використовуємо мову за замовчуванням
        text = translations[DEFAULT_LANGUAGE][key]
    else:
        # Якщо перекладу немає взагалі, повертаємо сам ключ
        return key

    # Підставляємо параметри у текст, якщо вони є
    if kwargs:
        try:
            return text.format(**kwargs)
        except:
            return text

    return text


# Завантажуємо переклади при імпорті модуля
load_translations()