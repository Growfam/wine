from flask import jsonify, request
import logging
import os
import random
import hashlib
import base64
import importlib.util
from datetime import datetime

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


def generate_seed_phrase(telegram_id=None, length=12):
    """Генерує seed-фразу для користувача."""
    # Якщо довжина не стандартна BIP-39, використовуємо 12 слів за замовчуванням
    if length not in [12, 15, 18, 21, 24]:
        length = 12

    # Якщо передано telegram_id, використовуємо його як seed для відтворюваності
    if telegram_id:
        try:
            seed_value = int(telegram_id) if str(telegram_id).isdigit() else hash(str(telegram_id))
            random.seed(seed_value)
        except (ValueError, TypeError):
            logger.warning(f"Помилка при використанні telegram_id як seed: {telegram_id}")
            pass  # Якщо проблема з telegram_id, використовуємо випадковий seed

    # Вибираємо випадкові слова
    seed_words = random.sample(BIP39_WORDS, length)
    return " ".join(seed_words)


def hash_password(password):
    """Створює простий хеш пароля з використанням SHA256."""
    salt = os.urandom(16)
    password_bytes = password.encode('utf-8')

    # Комбінуємо пароль і сіль
    salted_password = password_bytes + salt

    # Створюємо хеш
    password_hash = hashlib.sha256(salted_password).hexdigest()

    # Повертаємо хеш та сіль у кодуванні base64
    return {
        "hash": password_hash,
        "salt": base64.b64encode(salt).decode('utf-8')
    }


def verify_password(password, password_data):
    """Перевіряє пароль проти збереженого хешу."""
    try:
        # Декодуємо сіль
        salt = base64.b64decode(password_data["salt"])

        # Комбінуємо новий пароль з сіллю
        password_bytes = password.encode('utf-8')
        salted_password = password_bytes + salt

        # Створюємо хеш
        password_hash = hashlib.sha256(salted_password).hexdigest()

        # Порівнюємо з збереженим хешем
        return password_hash == password_data["hash"]
    except Exception as e:
        logger.error(f"Помилка перевірки пароля: {e}")
        return False


def simple_encrypt(text, password):
    """Просте шифрування тексту на основі пароля."""
    # Це проста реалізація. В ідеалі слід використовувати бібліотеку для криптографії
    key = hashlib.sha256(password.encode()).digest()
    result = bytearray()

    for i, char in enumerate(text.encode()):
        key_char = key[i % len(key)]
        encrypted_char = (char + key_char) % 256
        result.append(encrypted_char)

    return base64.b64encode(result).decode()


def simple_decrypt(encrypted_text, password):
    """Просте дешифрування тексту на основі пароля."""
    try:
        # Це проста реалізація. В ідеалі слід використовувати бібліотеку для криптографії
        key = hashlib.sha256(password.encode()).digest()
        encrypted_bytes = base64.b64decode(encrypted_text)
        result = bytearray()

        for i, char in enumerate(encrypted_bytes):
            key_char = key[i % len(key)]
            decrypted_char = (char - key_char) % 256
            result.append(decrypted_char)

        return result.decode()
    except Exception as e:
        logger.error(f"Помилка дешифрування: {e}")
        return None


def update_user_seed_phrase(telegram_id, seed_phrase=None):
    """Оновлює або генерує seed-фразу для користувача."""
    try:
        user = get_user(telegram_id)

        if not user:
            return {"status": "error", "message": "Користувача не знайдено"}

        # Якщо seed_phrase не передано, генеруємо новий
        if not seed_phrase:
            seed_phrase = generate_seed_phrase(telegram_id)

        # Оновлюємо seed_phrase у базі даних
        updated_user = update_user(telegram_id, {"seed_phrase": seed_phrase})

        if not updated_user:
            return {"status": "error", "message": "Помилка оновлення seed-фрази"}

        return {"status": "success", "data": {"seed_phrase": seed_phrase}}

    except Exception as e:
        logger.error(f"Помилка оновлення seed-фрази для {telegram_id}: {e}")
        return {"status": "error", "message": str(e)}


def get_user_seed_phrase(telegram_id):
    """Отримує seed-фразу користувача."""
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
    """Оновлює пароль користувача."""
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
    """Перевіряє пароль користувача."""
    try:
        user = get_user(telegram_id)

        if not user:
            return {"status": "error", "message": "Користувача не знайдено"}

        password_hash = user.get("password_hash")
        password_salt = user.get("password_salt")

        if not password_hash:
            return {"status": "error", "message": "Пароль не встановлено"}

        # Проста перевірка для сумісності
        if password_salt:
            # Розширена перевірка з сіллю
            if verify_password(password, {"hash": password_hash, "salt": password_salt}):
                return {"status": "success", "data": {"verified": True}}
        else:
            # Базова перевірка без солі (для сумісності)
            simple_hash = hashlib.sha256(password.encode()).hexdigest()
            if simple_hash == password_hash:
                return {"status": "success", "data": {"verified": True}}

        return {"status": "success", "data": {"verified": False}}

    except Exception as e:
        logger.error(f"Помилка перевірки пароля для {telegram_id}: {e}")
        return {"status": "error", "message": str(e)}