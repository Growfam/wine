from flask import Flask, render_template, request, jsonify, send_from_directory
from flask_cors import CORS
from supabase_client import get_user, create_user, update_balance, update_user, update_coins, check_and_update_badges
from supabase import create_client
from datetime import datetime
import os
import sys
from dotenv import load_dotenv
import logging


# Налаштування логування
logging.basicConfig(level=logging.DEBUG,
                    format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Завантажуємо .env (для локального тесту)
load_dotenv()

# Визначаємо базову директорію проекту
BASE_DIR = os.path.abspath(os.path.dirname(__file__))

# Ініціалізація Flask з абсолютними шляхами для шаблонів та статики
app = Flask(__name__,
            template_folder=os.path.join(BASE_DIR),  # Кореневий каталог для HTML
            static_folder=os.path.join(BASE_DIR, 'static'))  # Директорія для статичних файлів

# Додаємо CORS з максимально відкритими налаштуваннями
CORS(app, resources={r"/*": {"origins": "*"}},
     supports_credentials=True,
     expose_headers=["Content-Type", "X-CSRFToken"],
     allow_headers=["Content-Type", "X-Requested-With", "Authorization"])

# Підключення до Supabase
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY")

# Перевірка критичних змінних середовища
if not SUPABASE_URL or not SUPABASE_KEY:
    logger.error("CRITICAL: Не встановлено SUPABASE_URL або SUPABASE_ANON_KEY!")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)


# Допоміжна функція для перевірки авторизації
def verify_user(telegram_data):
    """
    Перевіряє дані Telegram WebApp та авторизує користувача
    """
    try:
        telegram_id = telegram_data.get('id')
        username = telegram_data.get('username', '')
        first_name = telegram_data.get('first_name', '')
        last_name = telegram_data.get('last_name', '')

        logger.info(f"Отримані дані Telegram: id={telegram_id}, username={username}, first_name={first_name}")

        # Додаткова перевірка ID на валідність і отримання з заголовків
        header_id = request.headers.get('X-Telegram-User-Id')
        if header_id:
            logger.info(f"Знайдено ID в заголовку: {header_id}")
            # Використовуємо ID з заголовка, якщо він не 12345678
            if header_id != "12345678":
                telegram_id = header_id
                logger.info(f"Використовуємо ID з заголовків: {telegram_id}")

        # Якщо ID досі не валідний, спробуємо інші способи визначення
        if not telegram_id or str(telegram_id) == "12345678":
            # В тестовому середовищі можемо використовувати тимчасовий ID
            test_mode = os.environ.get("FLASK_ENV") == "development"
            if test_mode:
                # Використовуємо якийсь унікальний ID для тестування
                import uuid
                telegram_id = f"test-{uuid.uuid4().hex[:8]}"
                logger.warning(f"Використовуємо тестовий ID: {telegram_id}")
            else:
                logger.error("Не вдалося отримати валідний telegram_id")
                # Не повертаємо None, спробуємо використати "12345678" як крайній випадок
                if not telegram_id:
                    telegram_id = "12345678"
                    logger.warning(f"Використовуємо стандартний тестовий ID: {telegram_id}")

        logger.info(f"Перевірка користувача з ID: {telegram_id}")

        # Перевіряємо наявність користувача у базі
        user = get_user(telegram_id)

        # Якщо користувача немає, створюємо його
        if not user:
            display_name = username or first_name or "WINIX User"
            logger.info(f"Створення нового користувача: {telegram_id} ({display_name})")
            user = create_user(telegram_id, display_name)

        return user

    except Exception as e:
        logger.error(f"Помилка авторизації користувача: {str(e)}")
        return None

# У верхній частині main.py додайте:
import json

@app.route('/api/debug', methods=['POST'])
def debug_data():
    """Ендпоінт для логування даних з клієнта."""
    data = request.json
    logger.info(f"DEBUG DATA: {json.dumps(data)}")
    return jsonify({"status": "ok"})

# Спеціальний маршрут для папки assets
@app.route('/assets/<path:filename>')
def serve_asset(filename):
    assets_dir = os.path.join(BASE_DIR, 'assets')
    try:
        return send_from_directory(assets_dir, filename)
    except Exception as e:
        logger.error(f"Error serving asset {filename}: {str(e)}")
        return jsonify({"error": f"Asset not found: {filename}"}), 404


# Маршрут для ChenelPNG папки
@app.route('/ChenelPNG/<path:filename>')
def serve_chenel_png(filename):
    chenel_dir = os.path.join(BASE_DIR, 'ChenelPNG')
    try:
        return send_from_directory(chenel_dir, filename)
    except Exception as e:
        logger.error(f"Error serving ChenelPNG/{filename}: {str(e)}")
        return jsonify({"error": f"ChenelPNG file not found: {filename}"}), 404


# Маршрут для компонентів
@app.route('/components/<path:filename>')
def serve_component(filename):
    components_dir = os.path.join(BASE_DIR, 'components')
    try:
        return send_from_directory(components_dir, filename)
    except Exception as e:
        logger.error(f"Error serving component {filename}: {str(e)}")
        return jsonify({"error": f"Component not found: {filename}"}), 404


# Діагностичний маршрут для перевірки конфігурації
@app.route('/debug')
def debug():
    assets_dir = os.path.join(BASE_DIR, 'assets')
    assets_exists = os.path.exists(assets_dir)

    chenel_dir = os.path.join(BASE_DIR, 'ChenelPNG')
    chenel_exists = os.path.exists(chenel_dir)

    components_dir = os.path.join(BASE_DIR, 'components')
    components_exists = os.path.exists(components_dir)

    static_dir = os.path.join(BASE_DIR, 'static')
    static_exists = os.path.exists(static_dir)

    assets_files = []
    if assets_exists:
        try:
            assets_files = os.listdir(assets_dir)
        except Exception as e:
            assets_files = [f"Error listing assets: {str(e)}"]

    return jsonify({
        "status": "running",
        "environment": {
            "base_dir": BASE_DIR,
            "current_dir": os.getcwd(),
            "files_in_root": os.listdir(BASE_DIR),
            "template_folder": app.template_folder,
            "static_folder": app.static_folder,
            "assets_folder": assets_dir,
            "assets_exists": assets_exists,
            "assets_files": assets_files,
            "chenel_exists": chenel_exists,
            "components_exists": components_exists,
            "static_exists": static_exists,
            "supabase_configured": bool(SUPABASE_URL and SUPABASE_KEY),
            "python_version": sys.version
        }
    })


# Головна сторінка
@app.route('/')
def index():
    try:
        return render_template('index.html')
    except Exception as e:
        logger.error(f"Error rendering index.html: {str(e)}")
        return jsonify({"error": str(e), "type": "template_error"}), 500


# Явні маршрути для всіх HTML-файлів
@app.route('/<path:filename>.html')
def serve_html(filename):
    try:
        return render_template(f'{filename}.html')
    except Exception as e:
        logger.error(f"Error rendering {filename}.html: {str(e)}")
        return jsonify({"error": str(e), "type": "template_error", "filename": filename}), 500


# Додаткові явні маршрути для основних сторінок
@app.route('/earn')
def earn():
    return render_template('earn.html')


@app.route('/wallet')
def wallet():
    return render_template('wallet.html')


@app.route('/referrals')
def referrals():
    return render_template('referrals.html')


@app.route('/profile')
def profile():
    return render_template('profile.html')


@app.route('/general')
def general():
    return render_template('general.html')


@app.route('/folder')
def folder():
    return render_template('folder.html')


@app.route('/staking')
def staking():
    return render_template('staking.html')


@app.route('/staking-details')
def staking_details():
    return render_template('staking-details.html')


@app.route('/transactions')
def transactions():
    return render_template('transactions.html')


@app.route('/send')
def send():
    return render_template('send.html')


@app.route('/receive')
def receive():
    return render_template('receive.html')


# API для нарахування жетонів
@app.route('/confirm', methods=['POST'])
def confirm():
    try:
        data = request.get_json()

        if not data or 'user_id' not in data:
            return jsonify({"status": "error", "message": "Missing user_id"}), 400

        user_id = str(data['user_id'])
        logger.info(f"Processing confirm for user_id: {user_id}")

        # Отримуємо користувача
        user = get_user(user_id)

        # Якщо користувача немає — створюємо
        if not user:
            logger.info(f"Creating new user with id: {user_id}")
            user = create_user(user_id, username="unknown")

        # Якщо ще не завершив сторінку 1
        if not user.get("page1_completed", False):
            logger.info(f"User {user_id} completing page1, awarding token")
            update_balance(user_id, 1)

            # Позначаємо, що сторінка 1 завершена
            supabase.table("winix").update({"page1_completed": True}).eq("telegram_id", user_id).execute()

            updated_user = get_user(user_id)
            return jsonify({"status": "success", "tokens": updated_user["balance"]})
        else:
            logger.info(f"User {user_id} already completed page1")
            return jsonify({"status": "already_completed", "message": "Жетон уже нараховано"})
    except Exception as e:
        logger.error(f"Error in confirm endpoint: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500


# API для авторизації користувача
@app.route('/api/auth', methods=['POST'])
def auth_user():
    try:
        data = request.json
        logger.info(f"Отримано запит на авторизацію: {data}")

        user = verify_user(data)

        if user:
            # Визначаємо, чи це новий користувач (для відображення вітального повідомлення)
            is_new_user = user.get('created_at') and (datetime.now() - datetime.fromisoformat(
                user['created_at'].replace('Z', '+00:00'))).total_seconds() < 60

            return jsonify({
                'status': 'success',
                'data': {
                    'telegram_id': user.get('telegram_id'),
                    'username': user.get('username'),
                    'balance': user.get('balance', 0),
                    'coins': user.get('coins', 0),
                    'is_new_user': is_new_user
                }
            })
        else:
            return jsonify({
                'status': 'error',
                'message': 'Помилка авторизації користувача'
            }), 401
    except Exception as e:
        logger.error(f"Помилка в /api/auth: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


# Тестовий API-ендпоінт
@app.route('/api/test', methods=['GET'])
def api_test():
    return jsonify({
        "status": "ok",
        "message": "API працює коректно",
        "version": "1.0.0"
    })


@app.errorhandler(404)
def page_not_found(e):
    logger.error(f"404 error: {request.path}")
    return jsonify({
        "error": "not_found",
        "message": f"Сторінка не знайдена: {request.path}",
        "available_routes": [
            "/", "/index.html", "/earn.html", "/wallet.html",
            "/referrals.html", "/original-index.html", "/debug"
        ]
    }), 404


# Обробник помилок 500
@app.errorhandler(500)
def server_error(e):
    logger.error(f"500 error: {str(e)}")
    return jsonify({
        "error": "server_error",
        "message": "Внутрішня помилка сервера",
        "details": str(e)
    }), 500


# Отримання даних користувача
@app.route('/api/user/<telegram_id>', methods=['GET'])
def get_user_data(telegram_id):
    try:
        # Отримуємо користувача з Supabase
        user = get_user(telegram_id)

        if not user:
            return jsonify({"status": "error", "message": "Користувача не знайдено"}), 404

        # Отримуємо кількість рефералів (приклад запиту)
        referrals_count = 0
        referral_earnings = 0
        try:
            # У реальному випадку ви б рахували це з бази даних
            referrals_res = supabase.table("winix").select("count").eq("referrer_id", telegram_id).execute()
            referrals_count = referrals_res.count if hasattr(referrals_res, 'count') else 0

            # Тут можна додати логіку обчислення заробітку від рефералів
            referral_earnings = referrals_count * 127.37  # Приклад формули
        except Exception as e:
            logger.error(f"Помилка отримання даних рефералів: {str(e)}")

        # Перевіряємо, які бейджі має користувач
        badges = {
            "winner_completed": user.get("badge_winner", False),
            "beginner_completed": user.get("badge_beginner", False),
            "rich_completed": user.get("badge_rich", False)
        }

        # Перевіряємо умови отримання бейджів на основі статистики
        participations_count = user.get("participations_count", 0)
        wins_count = user.get("wins_count", 0)
        balance = float(user.get("balance", 0))

        # Автоматично позначаємо бейдж, якщо умови виконані
        if not badges["beginner_completed"] and participations_count >= 5:
            badges["beginner_completed"] = True
            supabase.table("winix").update({"badge_beginner": True}).eq("telegram_id", telegram_id).execute()

        if not badges["winner_completed"] and wins_count > 0:
            badges["winner_completed"] = True
            supabase.table("winix").update({"badge_winner": True}).eq("telegram_id", telegram_id).execute()

        if not badges["rich_completed"] and balance >= 50000:
            badges["rich_completed"] = True
            supabase.table("winix").update({"badge_rich": True}).eq("telegram_id", telegram_id).execute()

        # Формуємо дані для відповіді
        user_data = {
            "id": user["telegram_id"],
            "username": user.get("username", "WINIX User"),
            "balance": float(user.get("balance", 0)),
            "coins": int(user.get("coins", 250)),  # Тепер береться з бази даних
            "page1_completed": user.get("page1_completed", False),
            "referrals_count": referrals_count,
            "referral_earnings": referral_earnings,
            "completed_tasks": 7,  # В майбутньому це має бути окреме поле в базі
            "total_raffles": 3,  # В майбутньому це має бути окреме поле в базі
            "participationsCount": participations_count,
            "winsCount": wins_count,
            "badges": badges,
            "newbie_bonus_claimed": user.get("newbie_bonus_claimed", False)
        }

        return jsonify({"status": "success", "data": user_data})
    except Exception as e:
        logger.error(f"Помилка отримання даних користувача {telegram_id}: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500


# Ендпоінт для отримання нагороди за бейдж
@app.route('/api/user/<telegram_id>/claim-badge-reward', methods=['POST'])
def claim_badge_reward(telegram_id):
    try:
        data = request.get_json()

        if not data or 'badge_id' not in data:
            return jsonify({"status": "error", "message": "Відсутній ідентифікатор бейджа"}), 400

        badge_id = data['badge_id']

        # Отримуємо користувача
        user = get_user(telegram_id)

        if not user:
            return jsonify({"status": "error", "message": "Користувача не знайдено"}), 404

        # Перевіряємо, чи бейдж вже отримано
        badge_field = f"badge_{badge_id}"
        reward_field = f"badge_{badge_id}_reward_claimed"

        if not user.get(badge_field, False):
            return jsonify({"status": "error", "message": "Умови отримання бейджа не виконані"}), 400

        if user.get(reward_field, False):
            return jsonify({"status": "already_claimed", "message": "Нагороду за цей бейдж вже отримано"}), 200

        # Визначаємо суму нагороди
        reward_amounts = {
            "winner": 2500,
            "beginner": 1000,
            "rich": 5000
        }

        reward_amount = reward_amounts.get(badge_id, 0)

        if reward_amount == 0:
            return jsonify({"status": "error", "message": "Невідомий бейдж"}), 400

        # Нараховуємо нагороду
        current_balance = float(user.get("balance", 0))
        new_balance = current_balance + reward_amount

        # Оновлюємо баланс і позначаємо нагороду як отриману
        updates = {
            "balance": new_balance,
            reward_field: True
        }

        supabase.table("winix").update(updates).eq("telegram_id", telegram_id).execute()

        # Додаємо транзакцію
        transaction = {
            "telegram_id": telegram_id,
            "type": "reward",
            "amount": reward_amount,
            "description": f"Нагорода за бейдж '{badge_id}'",
            "status": "completed"
        }

        supabase.table("transactions").insert(transaction).execute()

        return jsonify({
            "status": "success",
            "message": f"Нагороду в розмірі {reward_amount} WINIX за бейдж успішно отримано",
            "data": {
                "badge_id": badge_id,
                "reward_amount": reward_amount,
                "new_balance": new_balance
            }
        })

    except Exception as e:
        logger.error(f"Помилка видачі нагороди за бейдж для {telegram_id}: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500


# API для отримання бонусу новачка
@app.route('/api/user/<telegram_id>/claim-newbie-bonus', methods=['POST'])
def claim_newbie_bonus(telegram_id):
    try:
        user = get_user(telegram_id)

        if not user:
            return jsonify({
                'status': 'error',
                'message': 'Користувача не знайдено'
            }), 404

        # Перевіряємо, чи вже отримано бонус
        if user.get('newbie_bonus_claimed', False):
            return jsonify({
                'status': 'already_claimed',
                'message': 'Бонус новачка вже було отримано'
            })

        # Нараховуємо бонус (150 WINIX)
        bonus_amount = 150
        current_balance = float(user.get('balance', 0))
        new_balance = current_balance + bonus_amount

        # Оновлюємо дані користувача
        updated_user = update_user(telegram_id, {
            'balance': new_balance,
            'newbie_bonus_claimed': True
        })

        if updated_user:
            # Додаємо транзакцію
            transaction = {
                "telegram_id": telegram_id,
                "type": "reward",
                "amount": bonus_amount,
                "description": "Бонус новачка",
                "status": "completed"
            }

            supabase.table("transactions").insert(transaction).execute()

            return jsonify({
                'status': 'success',
                'message': f'Ви отримали {bonus_amount} WINIX як бонус новачка!',
                'data': {
                    'amount': bonus_amount,
                    'newBalance': new_balance
                }
            })
        else:
            return jsonify({
                'status': 'error',
                'message': 'Помилка нарахування бонусу'
            }), 500
    except Exception as e:
        logger.error(f"Помилка в /api/user/{telegram_id}/claim-newbie-bonus: {str(e)}")
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


# Додайте ці ендпоінти до вашого файлу main.py

# Ендпоінти для сторінки налаштувань (general.html)

@app.route('/api/user/<telegram_id>/settings', methods=['GET'])
def get_user_settings(telegram_id):
    """Отримати налаштування користувача"""
    try:
        # Отримуємо користувача
        user = get_user(telegram_id)

        if not user:
            return jsonify({"status": "error", "message": "Користувача не знайдено"}), 404

        # Формуємо дані з налаштуваннями
        settings = {
            "username": user.get("username", "WINIX User"),
            "avatar_id": user.get("avatar_id"),
            "avatar_url": user.get("avatar_url"),
            "language": user.get("language", "uk"),
            "password_hash": user.get("password_hash"),
            "notifications_enabled": user.get("notifications_enabled", True)
        }

        return jsonify({"status": "success", "data": settings})
    except Exception as e:
        logger.error(f"Помилка отримання налаштувань користувача {telegram_id}: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route('/api/user/<telegram_id>/settings', methods=['POST'])
def update_user_settings(telegram_id):
    """Оновити налаштування користувача"""
    try:
        data = request.json

        # Отримуємо користувача
        user = get_user(telegram_id)

        if not user:
            return jsonify({"status": "error", "message": "Користувача не знайдено"}), 404

        # Перевіряємо, які поля оновлюються
        allowed_fields = ["username", "avatar_id", "avatar_url", "language", "notifications_enabled"]
        updates = {k: v for k, v in data.items() if k in allowed_fields}

        # Оновлюємо дані в базі
        updated_user = update_user(telegram_id, updates)

        if not updated_user:
            return jsonify({"status": "error", "message": "Помилка оновлення налаштувань"}), 500

        return jsonify({"status": "success", "message": "Налаштування успішно оновлено"})
    except Exception as e:
        logger.error(f"Помилка оновлення налаштувань користувача {telegram_id}: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route('/api/user/<telegram_id>/password', methods=['POST'])
def update_user_password(telegram_id):
    """Оновити пароль користувача"""
    try:
        data = request.json

        if not data or "password_hash" not in data:
            return jsonify({"status": "error", "message": "Відсутній хеш пароля"}), 400

        # Отримуємо користувача
        user = get_user(telegram_id)

        if not user:
            return jsonify({"status": "error", "message": "Користувача не знайдено"}), 404

        # Оновлюємо пароль
        updated_user = update_user(telegram_id, {"password_hash": data["password_hash"]})

        if not updated_user:
            return jsonify({"status": "error", "message": "Помилка оновлення пароля"}), 500

        return jsonify({"status": "success", "message": "Пароль успішно оновлено"})
    except Exception as e:
        logger.error(f"Помилка оновлення пароля користувача {telegram_id}: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route('/api/user/<telegram_id>/seed-phrase', methods=['GET'])
def get_user_seed_phrase(telegram_id):
    """Отримати seed-фразу користувача"""
    try:
        # Отримуємо користувача
        user = get_user(telegram_id)

        if not user:
            return jsonify({"status": "error", "message": "Користувача не знайдено"}), 404

        # Генеруємо або отримуємо seed-фразу
        seed_phrase = user.get("seed_phrase")

        # Якщо seed-фрази немає, генеруємо її
        if not seed_phrase:
            # Список слів для seed-фрази
            seed_words = [
                "abandon", "ability", "able", "about", "above", "absent", "absorb", "abstract", "absurd", "abuse",
                "access", "accident", "account", "accuse", "achieve", "acid", "acoustic", "acquire", "across", "act",
                "solve", "notable", "quick", "pluck", "tribe", "dinosaur", "cereal", "casino", "rail", "media",
                "final", "curve"
            ]

            import random
            # Генеруємо seed-фразу на основі telegram_id
            random.seed(int(telegram_id) if telegram_id.isdigit() else hash(telegram_id))
            seed_phrase = " ".join(random.sample(seed_words, 12))

            # Зберігаємо seed-фразу в базі
            update_user(telegram_id, {"seed_phrase": seed_phrase})

        return jsonify({
            "status": "success",
            "data": {
                "seed_phrase": seed_phrase
            }
        })
    except Exception as e:
        logger.error(f"Помилка отримання seed-фрази користувача {telegram_id}: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500


# Ендпоінти для сторінки завдань (earn.html)

@app.route('/api/user/<telegram_id>/daily-bonus', methods=['GET'])
def get_daily_bonus_status(telegram_id):
    """Отримати статус щоденного бонусу"""
    try:
        # Отримуємо користувача
        user = get_user(telegram_id)

        if not user:
            return jsonify({"status": "error", "message": "Користувача не знайдено"}), 404

        from datetime import datetime, timedelta

        # Отримуємо інформацію про щоденні бонуси
        daily_bonuses = user.get("daily_bonuses", {})

        # Якщо немає інформації про бонуси, створюємо її
        if not daily_bonuses:
            daily_bonuses = {
                "last_claimed_date": None,
                "claimed_days": [],
                "current_day": 1
            }

        # Перевіряємо, чи можна отримати бонус сьогодні
        today = datetime.now().strftime("%Y-%m-%d")
        last_date = daily_bonuses.get("last_claimed_date")

        # Якщо це перший бонус або минув день
        if not last_date or last_date != today:
            # Визначаємо поточний день у циклі (1-7)
            current_day = daily_bonuses.get("current_day", 1)
            claimed_days = daily_bonuses.get("claimed_days", [])

            # Визначаємо суму винагороди залежно від дня
            reward_amount = current_day * 10  # День 1 = 10, День 2 = 20, і т.д.

            # Перевіряємо, чи сьогодні вже отримано бонус
            can_claim = today != last_date

            return jsonify({
                "status": "success",
                "currentDay": current_day,
                "claimedDays": claimed_days,
                "canClaim": can_claim,
                "rewardAmount": reward_amount
            })
        else:
            # Бонус вже отримано сьогодні
            return jsonify({
                "status": "success",
                "currentDay": daily_bonuses.get("current_day", 1),
                "claimedDays": daily_bonuses.get("claimed_days", []),
                "canClaim": False,
                "message": "Бонус вже отримано сьогодні"
            })
    except Exception as e:
        logger.error(f"Помилка отримання статусу щоденного бонусу для {telegram_id}: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route('/api/user/<telegram_id>/claim-daily-bonus', methods=['POST'])
def claim_daily_bonus(telegram_id):
    """Отримати щоденний бонус"""
    try:
        data = request.json
        day = data.get("day", 1) if data else 1

        # Отримуємо користувача
        user = get_user(telegram_id)

        if not user:
            return jsonify({"status": "error", "message": "Користувача не знайдено"}), 404

        from datetime import datetime, timedelta

        # Отримуємо інформацію про щоденні бонуси
        daily_bonuses = user.get("daily_bonuses", {})

        # Якщо немає інформації про бонуси, створюємо її
        if not daily_bonuses:
            daily_bonuses = {
                "last_claimed_date": None,
                "claimed_days": [],
                "current_day": 1
            }

        # Перевіряємо, чи можна отримати бонус сьогодні
        today = datetime.now().strftime("%Y-%m-%d")
        last_date = daily_bonuses.get("last_claimed_date")

        # Якщо бонус вже отримано сьогодні
        if last_date == today:
            return jsonify({
                "status": "already_claimed",
                "message": "Бонус вже отримано сьогодні"
            })

        # Визначаємо поточний день у циклі (1-7)
        current_day = daily_bonuses.get("current_day", 1)
        claimed_days = daily_bonuses.get("claimed_days", [])

        # Перевіряємо, чи переданий день співпадає з поточним
        if day != current_day:
            return jsonify({
                "status": "error",
                "message": f"Неправильний день! Очікувався день {current_day}, отримано {day}"
            }), 400

        # Визначаємо суму винагороди залежно від дня
        reward_amount = current_day * 10  # День 1 = 10, День 2 = 20, і т.д.

        # Нараховуємо винагороду
        current_balance = float(user.get("balance", 0))
        new_balance = current_balance + reward_amount

        # Оновлюємо інформацію про бонуси
        claimed_days.append(current_day)

        # Визначаємо наступний день (циклічно від 1 до 7)
        next_day = current_day + 1
        if next_day > 7:
            next_day = 1

        # Оновлюємо дані в базі
        updated_bonuses = {
            "last_claimed_date": today,
            "claimed_days": claimed_days,
            "current_day": next_day
        }

        update_user(telegram_id, {
            "balance": new_balance,
            "daily_bonuses": updated_bonuses
        })

        # Додаємо транзакцію
        transaction = {
            "telegram_id": telegram_id,
            "type": "reward",
            "amount": reward_amount,
            "description": f"Щоденний бонус (День {current_day})",
            "status": "completed"
        }

        supabase.table("transactions").insert(transaction).execute()

        return jsonify({
            "status": "success",
            "message": f"Щоденний бонус отримано: +{reward_amount} WINIX",
            "reward": reward_amount,
            "newBalance": new_balance
        })
    except Exception as e:
        logger.error(f"Помилка отримання щоденного бонусу для {telegram_id}: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route('/api/user/<telegram_id>/verify-subscription', methods=['POST'])
def verify_subscription(telegram_id):
    """Перевірити підписку на соціальну мережу"""
    try:
        data = request.json

        if not data or "platform" not in data:
            return jsonify({"status": "error", "message": "Відсутня платформа"}), 400

        platform = data["platform"]

        # Отримуємо користувача
        user = get_user(telegram_id)

        if not user:
            return jsonify({"status": "error", "message": "Користувача не знайдено"}), 404

        # Отримуємо статус соціальних завдань
        social_tasks = user.get("social_tasks", {})

        # Якщо завдання вже виконано
        if social_tasks.get(platform, False):
            return jsonify({
                "status": "already_completed",
                "message": "Це завдання вже виконано"
            })

        # Визначаємо винагороду залежно від платформи
        reward_amounts = {
            "twitter": 50,
            "telegram": 80,
            "youtube": 50,
            "discord": 60,
            "instagram": 70
        }

        reward_amount = reward_amounts.get(platform, 50)

        # Нараховуємо винагороду
        current_balance = float(user.get("balance", 0))
        new_balance = current_balance + reward_amount

        # Оновлюємо статус завдання
        if not social_tasks:
            social_tasks = {}
        social_tasks[platform] = True

        # Оновлюємо дані в базі
        update_user(telegram_id, {
            "balance": new_balance,
            "social_tasks": social_tasks
        })

        # Додаємо транзакцію
        transaction = {
            "telegram_id": telegram_id,
            "type": "reward",
            "amount": reward_amount,
            "description": f"Винагорода за підписку на {platform}",
            "status": "completed"
        }

        supabase.table("transactions").insert(transaction).execute()

        return jsonify({
            "status": "success",
            "message": f"Підписку підтверджено! Отримано {reward_amount} WINIX",
            "reward": reward_amount,
            "newBalance": new_balance
        })
    except Exception as e:
        logger.error(f"Помилка перевірки підписки для {telegram_id}: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route('/api/user/<telegram_id>/referral-tasks', methods=['GET'])
def get_referral_tasks(telegram_id):
    """Отримати статус реферальних завдань"""
    try:
        # Отримуємо користувача
        user = get_user(telegram_id)

        if not user:
            return jsonify({"status": "error", "message": "Користувача не знайдено"}), 404

        # Отримуємо кількість рефералів
        try:
            referrals_res = supabase.table("winix").select("count").eq("referrer_id", telegram_id).execute()
            referral_count = referrals_res.count if hasattr(referrals_res, 'count') else 0
        except Exception as e:
            logger.error(f"Помилка отримання кількості рефералів: {str(e)}")
            referral_count = 0

        # Отримуємо статус реферальних завдань
        referral_tasks = user.get("referral_tasks", {})

        # Визначаємо завдання і їх цілі
        tasks = [
            {"id": "invite-friends", "target": 5, "reward": 300},
            {"id": "invite-friends-10", "target": 10, "reward": 700},
            {"id": "invite-friends-25", "target": 25, "reward": 1500},
            {"id": "invite-friends-100", "target": 100, "reward": 5000}
        ]

        # Визначаємо, які завдання виконані
        completed_tasks = []

        for task in tasks:
            task_id = task["id"]
            target = task["target"]

            # Завдання виконане, якщо кількість рефералів >= цільової або статус в базі = True
            if referral_count >= target or referral_tasks.get(task_id, False):
                completed_tasks.append(task_id)

        return jsonify({
            "status": "success",
            "referralCount": referral_count,
            "completedTasks": completed_tasks,
            "tasks": tasks
        })
    except Exception as e:
        logger.error(f"Помилка отримання статусу реферальних завдань для {telegram_id}: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route('/api/user/<telegram_id>/claim-referral-reward', methods=['POST'])
def claim_referral_reward(telegram_id):
    """Отримати винагороду за реферальне завдання"""
    try:
        data = request.json

        if not data or "taskId" not in data or "reward" not in data:
            return jsonify({"status": "error", "message": "Відсутні необхідні дані"}), 400

        task_id = data["taskId"]
        reward_amount = float(data["reward"])

        # Отримуємо користувача
        user = get_user(telegram_id)

        if not user:
            return jsonify({"status": "error", "message": "Користувача не знайдено"}), 404

        # Отримуємо кількість рефералів і статус завдань
        try:
            referrals_res = supabase.table("winix").select("count").eq("referrer_id", telegram_id).execute()
            referral_count = referrals_res.count if hasattr(referrals_res, 'count') else 0
        except Exception as e:
            logger.error(f"Помилка отримання кількості рефералів: {str(e)}")
            referral_count = 0

        referral_tasks = user.get("referral_tasks", {})

        # Визначаємо цільову кількість рефералів
        target_map = {
            "invite-friends": 5,
            "invite-friends-10": 10,
            "invite-friends-25": 25,
            "invite-friends-100": 100
        }

        target = target_map.get(task_id, 0)

        # Перевіряємо, чи завдання вже виконане
        if referral_tasks.get(task_id, False):
            return jsonify({
                "status": "already_claimed",
                "message": "Ви вже отримали винагороду за це завдання"
            })

        # Перевіряємо, чи достатньо рефералів
        if referral_count < target:
            return jsonify({
                "status": "not_completed",
                "message": f"Недостатньо рефералів для завершення завдання. Потрібно {target}, наявно {referral_count}"
            }), 400

        # Нараховуємо винагороду
        current_balance = float(user.get("balance", 0))
        new_balance = current_balance + reward_amount

        # Оновлюємо статус завдання
        if not referral_tasks:
            referral_tasks = {}
        referral_tasks[task_id] = True

        # Оновлюємо дані в базі
        update_user(telegram_id, {
            "balance": new_balance,
            "referral_tasks": referral_tasks
        })

        # Додаємо транзакцію
        transaction = {
            "telegram_id": telegram_id,
            "type": "reward",
            "amount": reward_amount,
            "description": f"Винагорода за реферальне завдання: {task_id}",
            "status": "completed"
        }

        supabase.table("transactions").insert(transaction).execute()

        return jsonify({
            "status": "success",
            "message": f"Винагороду отримано: {reward_amount} WINIX",
            "reward": reward_amount,
            "newBalance": new_balance
        })
    except Exception as e:
        logger.error(f"Помилка отримання винагороди за реферальне завдання для {telegram_id}: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500


@app.route('/api/user/<telegram_id>/invite-referral', methods=['POST'])
def invite_referral(telegram_id):
    """Запросити нового реферала"""
    try:
        data = request.json

        if not data or "referralCode" not in data:
            return jsonify({"status": "error", "message": "Відсутній реферальний код"}), 400

        referral_code = data["referralCode"]

        # Отримуємо користувача
        user = get_user(telegram_id)

        if not user:
            return jsonify({"status": "error", "message": "Користувача не знайдено"}), 404

        # Перевіряємо, чи реферальний код валідний
        # Це має бути функція, яка перевіряє, чи такий користувач існує
        if not is_valid_referral_code(referral_code):
            return jsonify({
                "status": "error",
                "message": "Невалідний реферальний код"
            }), 400

        # Отримуємо поточну кількість рефералів
        try:
            referrals_res = supabase.table("winix").select("count").eq("referrer_id", telegram_id).execute()
            current_referrals = referrals_res.count if hasattr(referrals_res, 'count') else 0
        except Exception as e:
            logger.error(f"Помилка отримання кількості рефералів: {str(e)}")
            current_referrals = 0

        # Додаємо нового реферала
        new_referrals = current_referrals + 1

        # В реальному сценарії тут має бути логіка додавання реферала
        # Зараз просто симулюємо успішне додавання

        return jsonify({
            "status": "success",
            "message": f"Друга успішно запрошено!",
            "referralCount": new_referrals
        })
    except Exception as e:
        logger.error(f"Помилка запрошення реферала для {telegram_id}: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500


# Допоміжна функція для перевірки валідності реферального коду
def is_valid_referral_code(code):
    # Перевіряємо, чи код є валідним ID Telegram
    # У реальному випадку тут має бути перевірка користувача в базі даних
    try:
        return len(code) > 5
    except:
        return False

    from flask import request, jsonify
    from supabase_client import get_user, create_user

    @app.route("/api/auth", methods=["POST"])
    def auth_user():
        data = request.json
        print("📥 AUTH: Прийшов запит:", data)

        telegram_id = data.get("id")
        username = data.get("username", "")

        if not telegram_id:
            return jsonify({"status": "error", "message": "немає telegram_id"}), 400

        user = get_user(telegram_id)
        if not user:
            created = create_user(telegram_id, username)
            print(f"✅ Створено юзера: {created}")
        else:
            print(f"ℹ️ Юзер уже існує: {telegram_id}")

        return jsonify({"status": "success", "data": data})

# Запуск додатку
if __name__ == '__main__':
    port = int(os.environ.get("PORT", 8080))
    app.run(debug=False, host='0.0.0.0', port=port)