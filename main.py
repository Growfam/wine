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
        # Отримуємо дані з запиту
        telegram_id = telegram_data.get('id')
        username = telegram_data.get('username', '')
        first_name = telegram_data.get('first_name', '')
        last_name = telegram_data.get('last_name', '')

        if not telegram_id:
            logger.error("Не вдалося отримати telegram_id з даних")
            return None

        # Перевіряємо, чи існує користувач у базі
        user = get_user(telegram_id)

        # Якщо користувача немає, створюємо його
        if not user:
            display_name = username or first_name
            logger.info(f"Створення нового користувача: {telegram_id} ({display_name})")
            user = create_user(telegram_id, display_name)

        return user
    except Exception as e:
        logger.error(f"Помилка авторизації користувача: {str(e)}")
        return None


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
            supabase.table("Winix").update({"page1_completed": True}).eq("telegram_id", user_id).execute()

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
            referrals_res = supabase.table("Winix").select("count").eq("referrer_id", telegram_id).execute()
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
            supabase.table("Winix").update({"badge_beginner": True}).eq("telegram_id", telegram_id).execute()

        if not badges["winner_completed"] and wins_count > 0:
            badges["winner_completed"] = True
            supabase.table("Winix").update({"badge_winner": True}).eq("telegram_id", telegram_id).execute()

        if not badges["rich_completed"] and balance >= 50000:
            badges["rich_completed"] = True
            supabase.table("Winix").update({"badge_rich": True}).eq("telegram_id", telegram_id).execute()

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

        supabase.table("Winix").update(updates).eq("telegram_id", telegram_id).execute()

        # Додаємо транзакцію
        transaction = {
            "telegram_id": telegram_id,
            "type": "reward",
            "amount": reward_amount,
            "description": f"Нагорода за бейдж '{badge_id}'",
            "status": "completed"
        }

        supabase.table("Transactions").insert(transaction).execute()

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

            supabase.table("Transactions").insert(transaction).execute()

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


# Запуск додатку
if __name__ == '__main__':
    port = int(os.environ.get("PORT", 8080))
    app.run(debug=False, host='0.0.0.0', port=port)