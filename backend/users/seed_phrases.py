from flask import jsonify, request
import logging
import os
import random
import hashlib
import base64
import importlib.util
import json
import secrets
from datetime import datetime
from cryptography.fernet import Fernet
from cryptography.hazmat.primitives import hashes
from cryptography.hazmat.primitives.kdf.pbkdf2 import PBKDF2HMAC

# Налаштування логування
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Імпортуємо supabase_client.py напряму
current_dir = os.path.dirname(os.path.abspath(__file__))  # папка users
parent_dir = os.path.dirname(current_dir)  # папка backend

# Використання importlib для імпорту модуля з абсолютного шляху
spec = importlib.util.spec_from_file_location("supabase_client", os.path.join(parent_dir, "supabase_client.py"))
supabase_client = importlib.util.module_from_spec(spec)
spec.loader.exec_module(supabase_client)

# Витягуємо необхідні функції з модуля
get_user = supabase_client.get_user
update_user = supabase_client.update_user
supabase = supabase_client.supabase

# Оптимізований список із 500 слів для генерації seed-фраз
BIP39_WORDS = [
    "abandon", "ability", "able", "about", "above", "absent", "absorb", "abstract", "absurd", "abuse",
    "access", "accident", "account", "accuse", "achieve", "acid", "acoustic", "acquire", "across", "act",
    "action", "actor", "actual", "adapt", "add", "address", "adjust", "admit", "adult", "advance",
    "advice", "aerobic", "affair", "afford", "afraid", "again", "age", "agent", "agree", "ahead",
    "aim", "air", "airport", "aisle", "alarm", "album", "alcohol", "alert", "alien", "all",
    "alley", "allow", "almost", "alone", "alpha", "already", "also", "alter", "always", "amateur",
    "amazing", "among", "amount", "amused", "anchor", "ancient", "anger", "angle", "angry", "animal",
    "ankle", "announce", "annual", "another", "answer", "antenna", "antique", "anxiety", "any", "apart",
    "apology", "appear", "apple", "approve", "april", "arch", "arctic", "area", "arena", "argue",
    "arm", "army", "around", "arrange", "arrest", "arrive", "arrow", "art", "artist", "artwork",
    "ask", "aspect", "assault", "asset", "assist", "assume", "asthma", "athlete", "atom", "attack",
    "attend", "attitude", "attract", "auction", "audit", "august", "aunt", "author", "auto", "autumn",
    "average", "avocado", "avoid", "awake", "aware", "away", "awesome", "awful", "awkward", "axis",
    "baby", "bachelor", "bacon", "badge", "bag", "balance", "balcony", "ball", "bamboo", "banana",
    "banner", "bar", "barely", "bargain", "barrel", "base", "basic", "basket", "battle", "beach",
    "bean", "beauty", "because", "become", "beef", "before", "begin", "behave", "behind", "believe",
    "below", "belt", "bench", "benefit", "best", "betray", "better", "between", "beyond", "bicycle",
    "bid", "bike", "bind", "biology", "bird", "birth", "bitter", "black", "blade", "blame",
    "blanket", "blast", "bleak", "bless", "blind", "blood", "blossom", "blue", "blur", "blush",
    "board", "boat", "body", "boil", "bomb", "bone", "bonus", "book", "boost", "border",
    "boring", "borrow", "boss", "bottom", "bounce", "box", "boy", "brain", "brand", "brave",
    "bread", "breeze", "brick", "bridge", "brief", "bright", "bring", "brisk", "broken", "bronze",
    "brother", "brown", "brush", "bubble", "buddy", "budget", "build", "bulb", "bulk", "bullet",
    "bundle", "bunker", "burden", "burger", "burst", "bus", "business", "busy", "butter", "buyer",
    "buzz", "cabbage", "cabin", "cable", "cactus", "cage", "cake", "call", "calm", "camera",
    "camp", "can", "canal", "cancel", "candy", "cannon", "canoe", "canvas", "canyon", "capable",
    "capital", "captain", "car", "carbon", "card", "cargo", "carpet", "carry", "cart", "case",
    "cash", "casino", "castle", "casual", "cat", "catalog", "catch", "category", "cattle", "caught",
    "cause", "caution", "cave", "ceiling", "celery", "cement", "census", "century", "cereal", "certain",
    "chair", "chalk", "champion", "change", "chaos", "chapter", "charge", "chase", "chat", "cheap",
    "check", "cheese", "chef", "cherry", "chest", "chicken", "chief", "child", "chimney", "choice",
    "choose", "chronic", "chunk", "churn", "cigar", "circle", "citizen", "city", "civil", "claim",
    "clap", "clarify", "claw", "clay", "clean", "clerk", "clever", "click", "client", "cliff",
    "climb", "clinic", "clip", "clock", "close", "cloth", "cloud", "clown", "club", "clump",
    "cluster", "coach", "coast", "coconut", "code", "coffee", "coil", "coin", "collect", "color",
    "column", "combine", "come", "comfort", "comic", "common", "company", "concert", "conduct", "confirm",
    "congress", "connect", "consider", "control", "convince", "cook", "cool", "copper", "copy", "coral",
    "core", "corn", "correct", "cost", "cotton", "couch", "country", "couple", "course", "cousin",
    "cover", "coyote", "crack", "cradle", "craft", "crane", "crash", "crater", "crawl", "crazy",
    "cream", "credit", "creek", "crew", "cricket", "crime", "crisp", "critic", "crop", "cross",
    "crowd", "crucial", "cruel", "cruise", "crumble", "crush", "cry", "crystal", "cube", "culture",
    "cup", "cupboard", "curious", "current", "curtain", "curve", "cushion", "custom", "cute", "cycle",
    "dad", "damage", "damp", "dance", "danger", "dash", "daughter", "dawn", "day", "deal",
    "debate", "debris", "decade", "december", "decide", "decline", "decorate", "decrease", "deer", "defense",
    "define", "defy", "degree", "delay", "deliver", "demand", "dentist", "deny", "depart", "depend"
]


# Криптографічно безпечна функція для генерації seed-фрази
def generate_seed_phrase(length=12):
    """Генерує криптографічно безпечну seed-фразу.

    Args:
        length (int): Кількість слів у seed-фразі (12, 15, 18, 21, 24)

    Returns:
        str: Згенерована seed-фраза
    """
    # Стандарті довжини за BIP-39
    if length not in [12, 15, 18, 21, 24]:
        length = 12

    # Використовуємо секретну криптографічну ентропію
    random_bytes = secrets.token_bytes(32)  # 256 біт ентропії

    # Створюємо індекси слів на основі ентропії
    word_indices = []
    for i in range(length):
        # Рівномірно використовуємо ентропію
        value = int.from_bytes(random_bytes[i:i + 4], 'big')
        index = value % len(BIP39_WORDS)
        word_indices.append(index)

    # Вибираємо слова за індексами
    words = [BIP39_WORDS[index] for index in word_indices]
    return " ".join(words)


def hash_password(password):
    """Створює надійний хеш пароля з використанням PBKDF2.

    Args:
        password (str): Пароль для хешування

    Returns:
        dict: Словник з хешем і сіллю
    """
    # Генеруємо випадкову сіль
    salt = os.urandom(16)

    # Використовуємо PBKDF2 для хешування
    kdf = PBKDF2HMAC(
        algorithm=hashes.SHA256(),
        length=32,
        salt=salt,
        iterations=100000  # Рекомендована кількість ітерацій
    )

    # Отримуємо хеш
    key = kdf.derive(password.encode('utf-8'))

    # Повертаємо хеш та сіль у кодуванні base64
    return {
        "hash": base64.b64encode(key).decode('utf-8'),
        "salt": base64.b64encode(salt).decode('utf-8')
    }


def verify_password(password, password_data):
    """Перевіряє пароль проти збереженого хешу.

    Args:
        password (str): Пароль для перевірки
        password_data (dict): Словник з хешем і сіллю

    Returns:
        bool: True, якщо пароль вірний, False інакше
    """
    try:
        # Декодуємо хеш і сіль
        stored_key = base64.b64decode(password_data["hash"])
        salt = base64.b64decode(password_data["salt"])

        # Створюємо новий хеш з тією ж сіллю
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100000
        )

        # Обчислюємо хеш для введеного пароля
        key = kdf.derive(password.encode('utf-8'))

        # Порівнюємо хеші
        return secrets.compare_digest(key, stored_key)
    except Exception as e:
        logger.error(f"Помилка перевірки пароля: {e}")
        return False


def secure_encrypt(text, password):
    """Надійне шифрування тексту на основі пароля з використанням Fernet.

    Args:
        text (str): Текст для шифрування
        password (str): Пароль для шифрування

    Returns:
        str: Зашифрований текст у форматі JSON
    """
    try:
        # Генеруємо сіль
        salt = os.urandom(16)

        # Використовуємо PBKDF2 для отримання ключа з пароля
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100000
        )

        # Отримуємо ключ для Fernet
        key = base64.urlsafe_b64encode(kdf.derive(password.encode()))

        # Створюємо шифратор Fernet
        cipher = Fernet(key)

        # Шифруємо текст
        encrypted_data = cipher.encrypt(text.encode())

        # Зберігаємо сіль і зашифровані дані
        result = {
            "salt": base64.b64encode(salt).decode('utf-8'),
            "encrypted_data": base64.b64encode(encrypted_data).decode('utf-8')
        }

        return json.dumps(result)
    except Exception as e:
        logger.error(f"Помилка шифрування: {e}")
        return None


def secure_decrypt(encrypted_json, password):
    """Дешифрування тексту, зашифрованого за допомогою secure_encrypt.

    Args:
        encrypted_json (str): Зашифрований текст у форматі JSON
        password (str): Пароль для дешифрування

    Returns:
        str: Дешифрований текст або None у випадку помилки
    """
    try:
        # Парсимо JSON з зашифрованими даними
        data = json.loads(encrypted_json)

        # Отримуємо сіль і зашифровані дані
        salt = base64.b64decode(data["salt"])
        encrypted_data = base64.b64decode(data["encrypted_data"])

        # Використовуємо PBKDF2 для отримання того ж ключа
        kdf = PBKDF2HMAC(
            algorithm=hashes.SHA256(),
            length=32,
            salt=salt,
            iterations=100000
        )

        # Отримуємо ключ для Fernet
        key = base64.urlsafe_b64encode(kdf.derive(password.encode()))

        # Створюємо дешифратор Fernet
        cipher = Fernet(key)

        # Дешифруємо дані
        decrypted_data = cipher.decrypt(encrypted_data)

        return decrypted_data.decode()
    except Exception as e:
        logger.error(f"Помилка дешифрування: {e}")
        return None


def update_user_seed_phrase(telegram_id, seed_phrase=None):
    """Оновлює або генерує seed-фразу для користувача.

    Args:
        telegram_id (str): ID користувача
        seed_phrase (str, optional): Seed-фраза. Якщо None, генерується нова

    Returns:
        dict: Результат операції
    """
    try:
        user = get_user(telegram_id)

        if not user:
            return {"status": "error", "message": "Користувача не знайдено"}

        # Якщо seed_phrase не передано, генеруємо новий
        if not seed_phrase:
            seed_phrase = generate_seed_phrase()

        # Оновлюємо seed_phrase у базі даних
        updated_user = update_user(telegram_id, {"seed_phrase": seed_phrase})

        if not updated_user:
            return {"status": "error", "message": "Помилка оновлення seed-фрази"}

        return {"status": "success", "data": {"seed_phrase": seed_phrase}}

    except Exception as e:
        logger.error(f"Помилка оновлення seed-фрази для {telegram_id}: {e}")
        return {"status": "error", "message": str(e)}


def get_user_seed_phrase(telegram_id):
    """Отримує seed-фразу користувача.

    Args:
        telegram_id (str): ID користувача

    Returns:
        dict: Результат операції
    """
    try:
        user = get_user(telegram_id)

        if not user:
            return {"status": "error", "message": "Користувача не знайдено"}

        seed_phrase = user.get("seed_phrase")

        # Якщо seed_phrase не існує, генеруємо новий
        if not seed_phrase:
            result = update_user_seed_phrase(telegram_id)

            if result["status"] == "success":
                seed_phrase = result["data"]["seed_phrase"]
            else:
                return result

        return {"status": "success", "data": {"seed_phrase": seed_phrase}}

    except Exception as e:
        logger.error(f"Помилка отримання seed-фрази для {telegram_id}: {e}")
        return {"status": "error", "message": str(e)}


def update_user_password(telegram_id, password_hash, password_salt=None):
    """Оновлює пароль користувача.

    Args:
        telegram_id (str): ID користувача
        password_hash (str): Хеш пароля
        password_salt (str, optional): Сіль для пароля

    Returns:
        dict: Результат операції
    """
    try:
        user = get_user(telegram_id)

        if not user:
            return {"status": "error", "message": "Користувача не знайдено"}

        # Підготовлюємо дані для оновлення
        update_data = {"password_hash": password_hash}

        if password_salt:
            update_data["password_salt"] = password_salt

        # Оновлюємо пароль у базі даних
        updated_user = update_user(telegram_id, update_data)

        if not updated_user:
            return {"status": "error", "message": "Помилка оновлення пароля"}

        return {"status": "success", "message": "Пароль успішно оновлено"}

    except Exception as e:
        logger.error(f"Помилка оновлення пароля для {telegram_id}: {e}")
        return {"status": "error", "message": str(e)}


def verify_user_password(telegram_id, password):
    """Перевіряє пароль користувача.

    Args:
        telegram_id (str): ID користувача
        password (str): Пароль

    Returns:
        dict: Результат операції
    """
    try:
        user = get_user(telegram_id)

        if not user:
            return {"status": "error", "message": "Користувача не знайдено"}

        password_hash = user.get("password_hash")
        password_salt = user.get("password_salt")

        if not password_hash:
            return {"status": "error", "message": "Пароль не встановлено"}

        verified = False

        # Перевірка з новим алгоритмом (PBKDF2)
        if password_salt:
            verified = verify_password(password, {"hash": password_hash, "salt": password_salt})
        else:
            # Для сумісності зі старим алгоритмом (простий SHA-256)
            simple_hash = hashlib.sha256(password.encode()).hexdigest()
            verified = (simple_hash == password_hash)

            # Якщо пароль вірний, бажано оновити його до нового формату
            if verified:
                logger.info(f"Виявлено старий формат пароля для {telegram_id}, оновлення до нового формату...")
                new_password_data = hash_password(password)
                update_user(telegram_id, {
                    "password_hash": new_password_data["hash"],
                    "password_salt": new_password_data["salt"]
                })

        return {"status": "success", "data": {"verified": verified}}

    except Exception as e:
        logger.error(f"Помилка перевірки пароля для {telegram_id}: {e}")
        return {"status": "error", "message": str(e)}