from flask import Flask, render_template, request, jsonify, send_from_directory, session, g
from flask_cors import CORS
import os
import logging
import json
import uuid
import time
from datetime import datetime
from dotenv import load_dotenv
from supabase_client import get_user, update_user

# Імпортуємо модулі проєкту
from supabase_client import supabase, test_supabase_connection
from users import (
    verify_user, get_user_profile, get_user_balance, update_user_balance,
    claim_badge_reward, claim_newbie_bonus, get_user_settings,
    update_user_settings, update_user_password, get_user_seed_phrase
)
from staking import (
    get_user_staking, create_user_staking, update_user_staking,
    cancel_user_staking, finalize_user_staking, get_user_staking_history
)
from transactions import (
    get_user_transactions, add_user_transaction, create_send_transaction, create_receive_transaction
)
from referrals import (
    get_referral_tasks, claim_referral_reward, invite_referral
)
from quests import (
    get_daily_bonus_status, claim_daily_bonus, verify_subscription
)
from raffles import (
    get_active_raffles, get_user_raffles, participate_in_raffle
)
from badges import (
    get_available_badges, check_user_badges
)
from stats import (
    get_user_stats, get_leaderboard, get_system_stats
)
from admin import (
    admin_get_users, admin_get_user, admin_update_user, admin_create_transaction, admin_get_transactions
)
import i18n

from balance import (
    get_user_complete_balance, add_tokens, subtract_tokens,
    add_coins, subtract_coins, convert_coins_to_tokens,
    check_sufficient_funds
)

# Завантажуємо змінні середовища
load_dotenv()

# Налаштування логування
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Визначаємо базову директорію проекту
# Оскільки main.py знаходиться в backend/, переходимо на один рівень вгору
BACKEND_DIR = os.path.abspath(os.path.dirname(__file__))
BASE_DIR = os.path.dirname(BACKEND_DIR)

# Ініціалізація Flask з абсолютними шляхами для шаблонів та статики
app = Flask(__name__,
            template_folder=os.path.join(BASE_DIR, 'frontend'),  # Директорія для HTML-файлів
            static_folder=os.path.join(BASE_DIR, 'frontend'))  # Директорія для статичних файлів

# Секретний ключ для сесій
app.secret_key = os.getenv("FLASK_SECRET_KEY", "winix-secret-key")

# Додаємо CORS з максимально відкритими налаштуваннями
CORS(app, resources={r"/*": {"origins": "*"}},
     supports_credentials=True,
     expose_headers=["Content-Type", "X-CSRFToken"],
     allow_headers=["Content-Type", "X-Requested-With", "Authorization"])


# Проміжне ПЗ для логування запитів
@app.before_request
def log_request_info():
    g.start_time = time.time()
    logger.info(f"Отримано запит: {request.method} {request.path}")

    # Визначаємо мову користувача
    g.language = i18n.get_user_language()


@app.after_request
def log_response_info(response):
    execution_time = time.time() - g.start_time
    logger.info(f"Відповідь: {response.status_code} (час: {execution_time:.4f}s)")
    return response


# Маршрут для перевірки стану додатка
@app.route('/ping')
def ping():
    """Найпростіший маршрут для перевірки стану додатка"""
    return "pong"


# Діагностичний маршрут для перевірки конфігурації
@app.route('/debug')
def debug():
    # Перевіряємо з'єднання з Supabase
    supabase_test = test_supabase_connection()

    # Перевіряємо шляхи до директорій
    assets_dir = os.path.join(BASE_DIR, 'frontend/assets')
    assets_exists = os.path.exists(assets_dir)

    chenel_dir = os.path.join(BASE_DIR, 'frontend/ChenelPNG')
    chenel_exists = os.path.exists(chenel_dir)

    static_dir = app.static_folder
    static_exists = os.path.exists(static_dir)

    template_dir = app.template_folder
    template_exists = os.path.exists(template_dir)

    # Перевіряємо наявність ключових файлів
    index_html_exists = os.path.exists(os.path.join(template_dir, 'index.html'))
    original_index_html_exists = os.path.exists(os.path.join(template_dir, 'original-index.html'))

    return jsonify({
        "status": "running",
        "environment": {
            "base_dir": BASE_DIR,
            "current_dir": os.getcwd(),
            "template_folder": template_dir,
            "template_folder_exists": template_exists,
            "static_folder": static_dir,
            "static_folder_exists": static_exists,
            "assets_folder": assets_dir,
            "assets_exists": assets_exists,
            "chenel_exists": chenel_exists,
            "index_html_exists": index_html_exists,
            "original_index_html_exists": original_index_html_exists,
            "supabase_test": supabase_test
        }
    })


# Маршрут для логування відладочних даних
@app.route('/api/debug', methods=['POST'])
def debug_data():
    """Ендпоінт для логування даних з клієнта."""
    data = request.json
    logger.info(f"DEBUG DATA: {json.dumps(data)}")
    return jsonify({"status": "ok"})


# Спеціальні маршрути для статичних файлів
@app.route('/assets/<path:filename>')
def serve_asset(filename):
    assets_dir = os.path.join(BASE_DIR, 'frontend/assets')
    try:
        return send_from_directory(assets_dir, filename)
    except Exception as e:
        logger.error(f"Error serving asset {filename}: {str(e)}")
        return jsonify({"error": f"Asset not found: {filename}"}), 404


@app.route('/ChenelPNG/<path:filename>')
def serve_chenel_png(filename):
    chenel_dir = os.path.join(BASE_DIR, 'frontend/ChenelPNG')
    try:
        return send_from_directory(chenel_dir, filename)
    except Exception as e:
        logger.error(f"Error serving ChenelPNG/{filename}: {str(e)}")
        return jsonify({"error": f"ChenelPNG file not found: {filename}"}), 404


@app.route('/js/<path:filename>')
def serve_js(filename):
    js_dir = os.path.join(BASE_DIR, 'frontend/js')
    try:
        return send_from_directory(js_dir, filename)
    except Exception as e:
        logger.error(f"Error serving js/{filename}: {str(e)}")
        return jsonify({"error": f"JS file not found: {filename}"}), 404


@app.route('/css/<path:filename>')
def serve_css(filename):
    css_dir = os.path.join(BASE_DIR, 'frontend/css')
    try:
        return send_from_directory(css_dir, filename)
    except Exception as e:
        logger.error(f"Error serving css/{filename}: {str(e)}")
        return jsonify({"error": f"CSS file not found: {filename}"}), 404


# Маршрути для HTML-файлів

@app.route('/')
def index():
    return render_template('index.html')


@app.route('/original-index')
def original_index():
    return render_template('original-index.html')


@app.route('/original-index.html')
def original_index_html():
    return render_template('original-index.html')


@app.route('/<path:filename>.html')
def serve_html(filename):
    try:
        return render_template(f'{filename}.html')
    except Exception as e:
        logger.error(f"Error rendering {filename}.html: {str(e)}")
        return jsonify({"error": str(e), "type": "template_error", "filename": filename}), 500


# Явні маршрути для основних сторінок
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


@app.route('/raffles')
def raffles():
    return render_template('raffles.html')


# API-маршрути для авторизації

@app.route('/api/auth', methods=['POST'])
def auth_user():
    """Авторизація користувача"""
    try:
        data = request.json
        logger.info(f"auth_user: Отримано запит на авторизацію: {data}")

        # Додаткова інформація для діагностики
        logger.info(f"auth_user: HTTP Headers: {dict(request.headers)}")

        user = verify_user(data)
        logger.info(f"auth_user: Результат verify_user: {user}")

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
            logger.error("auth_user: Помилка авторизації - verify_user повернув None")
            return jsonify({
                'status': 'error',
                'message': 'Помилка авторизації користувача'
            }), 401
    except Exception as e:
        logger.error(f"auth_user: Помилка в /api/auth: {str(e)}", exc_info=True)
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500


@app.route('/confirm', methods=['POST'])
def confirm():
    """Підтвердження завершення туторіалу і нарахування жетонів"""
    try:
        data = request.get_json()

        if not data or 'user_id' not in data:
            return jsonify({"status": "error", "message": "Missing user_id"}), 400

        user_id = str(data['user_id'])
        logger.info(f"Processing confirm for user_id: {user_id}")

        # API запит до /api/user/<telegram_id> для отримання користувача
        response, status_code = get_user_profile(user_id)

        if status_code != 200:
            return response, status_code

        user_data = response.json.get('data', {})

        # Перевіряємо, чи користувач вже завершив сторінку 1
        if not user_data.get("page1_completed", False):
            # Нараховуємо 1 токен
            update_data = {"balance": user_data.get("balance", 0) + 1, "page1_completed": True}
            update_response, update_status = update_user_balance(user_id, {"balance": update_data["balance"]})

            if update_status != 200:
                return update_response, update_status

            # Оновлюємо статус завершення сторінки
            supabase.table("winix").update({"page1_completed": True}).eq("telegram_id", user_id).execute()

            return jsonify({"status": "success", "tokens": update_data["balance"]})
        else:
            return jsonify({"status": "already_completed", "message": "Жетон уже нараховано"})
    except Exception as e:
        logger.error(f"Error in confirm endpoint: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500


# API-маршрути для роботи з користувачами

@app.route('/api/user/<telegram_id>', methods=['GET'])
def api_get_user_profile(telegram_id):
    """Отримання даних користувача"""
    return get_user_profile(telegram_id)


@app.route('/api/user/<telegram_id>/balance', methods=['GET'])
def api_get_user_balance(telegram_id):
    """Отримання балансу користувача"""
    return get_user_balance(telegram_id)


@app.route('/api/user/<telegram_id>/balance', methods=['POST'])
def api_update_user_balance(telegram_id):
    """Оновлення балансу користувача"""
    return update_user_balance(telegram_id, request.json)


@app.route('/api/user/<telegram_id>/claim-badge-reward', methods=['POST'])
def api_claim_badge_reward(telegram_id):
    """Отримання нагороди за бейдж"""
    return claim_badge_reward(telegram_id, request.json)


@app.route('/api/user/<telegram_id>/claim-newbie-bonus', methods=['POST'])
def api_claim_newbie_bonus(telegram_id):
    """Отримання бонусу новачка"""
    return claim_newbie_bonus(telegram_id)


@app.route('/api/user/<telegram_id>/settings', methods=['GET'])
def api_get_user_settings(telegram_id):
    """Отримання налаштувань користувача"""
    return get_user_settings(telegram_id)


@app.route('/api/user/<telegram_id>/settings', methods=['POST'])
def api_update_user_settings(telegram_id):
    """Оновлення налаштувань користувача"""
    return update_user_settings(telegram_id, request.json)


@app.route('/api/user/<telegram_id>/password', methods=['POST'])
def api_update_user_password(telegram_id):
    """Оновлення пароля користувача"""
    return update_user_password(telegram_id, request.json)


@app.route('/api/user/<telegram_id>/seed-phrase', methods=['GET'])
def api_get_user_seed_phrase(telegram_id):
    """Отримання seed-фрази користувача"""
    return get_user_seed_phrase(telegram_id)


# API-маршрути для стейкінгу

@app.route('/api/user/<telegram_id>/staking', methods=['GET'])
def api_get_user_staking(telegram_id):
    """Отримання даних стейкінгу користувача"""
    return get_user_staking(telegram_id)


@app.route('/api/user/<telegram_id>/staking', methods=['POST'])
def api_create_user_staking(telegram_id):
    """Створення стейкінгу користувача"""
    return create_user_staking(telegram_id, request.json)


@app.route('/api/user/<telegram_id>/staking/<staking_id>', methods=['PUT'])
def api_update_user_staking(telegram_id, staking_id):
    """Оновлення стейкінгу користувача"""
    return update_user_staking(telegram_id, staking_id, request.json)


@app.route('/api/user/<telegram_id>/staking/<staking_id>/cancel', methods=['POST'])
def api_cancel_user_staking(telegram_id, staking_id):
    """Скасування стейкінгу користувача"""
    return cancel_user_staking(telegram_id, staking_id, request.json or {})


@app.route('/api/user/<telegram_id>/staking/<staking_id>/finalize', methods=['POST'])
def api_finalize_user_staking(telegram_id, staking_id):
    """Завершення стейкінгу і нарахування винагороди"""
    return finalize_user_staking(telegram_id, staking_id, request.json or {})


@app.route('/api/user/<telegram_id>/staking/history', methods=['GET'])
def api_get_user_staking_history(telegram_id):
    """Отримання історії стейкінгу"""
    return get_user_staking_history(telegram_id)


# API-маршрути для транзакцій

@app.route('/api/user/<telegram_id>/transactions', methods=['GET'])
def api_get_user_transactions(telegram_id):
    """Отримання транзакцій користувача"""
    return get_user_transactions(telegram_id)


@app.route('/api/user/<telegram_id>/transaction', methods=['POST'])
def api_add_user_transaction(telegram_id):
    """Додавання нової транзакції"""
    return add_user_transaction(telegram_id, request.json)


@app.route('/api/user/<telegram_id>/send', methods=['POST'])
def api_send_transaction(telegram_id):
    """Створення транзакції надсилання коштів"""
    data = request.json
    if not data or 'to_address' not in data or 'amount' not in data:
        return jsonify({"status": "error", "message": "Відсутні необхідні дані"}), 400

    return create_send_transaction(telegram_id, data['to_address'], data['amount'])


@app.route('/api/user/<telegram_id>/receive', methods=['POST'])
def api_receive_transaction(telegram_id):
    """Створення транзакції отримання коштів"""
    data = request.json
    if not data or 'from_address' not in data or 'amount' not in data:
        return jsonify({"status": "error", "message": "Відсутні необхідні дані"}), 400

    return create_receive_transaction(telegram_id, data['from_address'], data['amount'])


# API-маршрути для рефералів

@app.route('/api/user/<telegram_id>/referral-tasks', methods=['GET'])
def api_get_referral_tasks(telegram_id):
    """Отримання статусу реферальних завдань"""
    return get_referral_tasks(telegram_id)


@app.route('/api/user/<telegram_id>/claim-referral-reward', methods=['POST'])
def api_claim_referral_reward(telegram_id):
    """Отримання винагороди за реферальне завдання"""
    return claim_referral_reward(telegram_id, request.json)


@app.route('/api/user/<telegram_id>/invite-referral', methods=['POST'])
def api_invite_referral(telegram_id):
    """Запросити нового реферала"""
    return invite_referral(telegram_id, request.json)


# API-маршрути для квестів і щоденних бонусів

@app.route('/api/user/<telegram_id>/daily-bonus', methods=['GET'])
def api_get_daily_bonus_status(telegram_id):
    """Отримання статусу щоденного бонусу"""
    return get_daily_bonus_status(telegram_id)


@app.route('/api/user/<telegram_id>/claim-daily-bonus', methods=['POST'])
def api_claim_daily_bonus(telegram_id):
    """Отримання щоденного бонусу"""
    return claim_daily_bonus(telegram_id, request.json)


@app.route('/api/user/<telegram_id>/verify-subscription', methods=['POST'])
def api_verify_subscription(telegram_id):
    """Перевірка підписки на соціальну мережу"""
    return verify_subscription(telegram_id, request.json)


# API-маршрути для розіграшів

@app.route('/api/raffles', methods=['GET'])
def api_get_active_raffles():
    """Отримання списку активних розіграшів"""
    return get_active_raffles()


@app.route('/api/user/<telegram_id>/raffles', methods=['GET'])
def api_get_user_raffles(telegram_id):
    """Отримання розіграшів, у яких бере участь користувач"""
    return get_user_raffles(telegram_id)


@app.route('/api/user/<telegram_id>/participate-raffle', methods=['POST'])
def api_participate_in_raffle(telegram_id):
    """Участь у розіграші"""
    return participate_in_raffle(telegram_id, request.json)


# API-маршрути для бейджів

@app.route('/api/user/<telegram_id>/badges', methods=['GET'])
def api_get_available_badges(telegram_id):
    """Отримання інформації про доступні бейджі користувача"""
    return get_available_badges(telegram_id)


# API-маршрути для статистики

@app.route('/api/user/<telegram_id>/stats', methods=['GET'])
def api_get_user_stats(telegram_id):
    """Отримання статистики користувача"""
    return get_user_stats(telegram_id)


@app.route('/api/leaderboard', methods=['GET'])
def api_get_leaderboard():
    """Отримання списку лідерів за балансом"""
    return get_leaderboard()


@app.route('/api/stats', methods=['GET'])
def api_get_system_stats():
    """Отримання загальної статистики системи"""
    return get_system_stats()


# API-маршрути для адміністраторів

@app.route('/api/admin/users', methods=['GET'])
def api_admin_get_users():
    """Отримання списку користувачів (тільки для адміністраторів)"""
    return admin_get_users()


@app.route('/api/admin/users/<user_id>', methods=['GET'])
def api_admin_get_user(user_id):
    """Отримання даних конкретного користувача (тільки для адміністраторів)"""
    return admin_get_user(user_id)


@app.route('/api/admin/users/<user_id>', methods=['PUT'])
def api_admin_update_user(user_id):
    """Оновлення даних конкретного користувача (тільки для адміністраторів)"""
    return admin_update_user(user_id, request.json)


@app.route('/api/admin/users/<user_id>/transaction', methods=['POST'])
def api_admin_create_transaction(user_id):
    """Створення транзакції для користувача (тільки для адміністраторів)"""
    return admin_create_transaction(user_id, request.json)


@app.route('/api/admin/transactions', methods=['GET'])
def api_admin_get_transactions():
    """Отримання останніх транзакцій (тільки для адміністраторів)"""
    return admin_get_transactions()


# Обробники помилок

@app.errorhandler(404)
def page_not_found(e):
    logger.error(f"404 error: {request.path}")
    return jsonify({
        "error": "not_found",
        "message": f"Сторінка не знайдена: {request.path}",
        "available_routes": [
            "/", "/index.html", "/original-index.html", "/earn.html", "/wallet.html",
            "/referrals.html", "/staking.html", "/transactions.html"
        ]
    }), 404


@app.errorhandler(500)
def server_error(e):
    logger.error(f"500 error: {str(e)}")
    return jsonify({
        "error": "server_error",
        "message": "Внутрішня помилка сервера",
        "details": str(e)
    }), 500

# Обробники Balance

@app.route('/api/user/<telegram_id>/complete-balance', methods=['GET'])
def api_get_user_complete_balance(telegram_id):
    """Отримання повної інформації про баланс користувача"""
    return get_user_complete_balance(telegram_id)

@app.route('/api/user/<telegram_id>/add-tokens', methods=['POST'])
def api_add_tokens(telegram_id):
    """Додавання токенів до балансу користувача"""
    return add_tokens(telegram_id, request.json)

@app.route('/api/user/<telegram_id>/subtract-tokens', methods=['POST'])
def api_subtract_tokens(telegram_id):
    """Віднімання токенів з балансу користувача"""
    return subtract_tokens(telegram_id, request.json)

@app.route('/api/user/<telegram_id>/add-coins', methods=['POST'])
def api_add_coins(telegram_id):
    """Додавання жетонів до балансу користувача"""
    return add_coins(telegram_id, request.json)

@app.route('/api/user/<telegram_id>/subtract-coins', methods=['POST'])
def api_subtract_coins(telegram_id):
    """Віднімання жетонів з балансу користувача"""
    return subtract_coins(telegram_id, request.json)

@app.route('/api/user/<telegram_id>/convert-coins', methods=['POST'])
def api_convert_coins_to_tokens(telegram_id):
    """Конвертація жетонів у токени"""
    return convert_coins_to_tokens(telegram_id, request.json)

@app.route('/api/user/<telegram_id>/check-funds', methods=['POST'])
def api_check_sufficient_funds(telegram_id):
    """Перевірка достатності коштів для транзакції"""
    return check_sufficient_funds(telegram_id, request.json)


# API-маршрут для відновлення стейкінгу
@app.route('/api/user/<telegram_id>/staking/repair', methods=['POST'])
def api_repair_user_staking(telegram_id):
    """Відновлення стану стейкінгу після помилок"""
    try:
        # Перевірка даних запиту
        data = request.json or {}
        force = data.get('force', False)

        # Виклик функції відновлення
        from staking import reset_and_repair_staking
        return reset_and_repair_staking(telegram_id, force)
    except Exception as e:
        logger.error(f"api_repair_user_staking: Помилка: {str(e)}")
        return jsonify({"status": "error", "message": "Помилка відновлення стейкінгу"}), 500


# Додатковий маршрут для більш глибокого відновлення
@app.route('/api/user/<telegram_id>/staking/deep-repair', methods=['POST'])
def api_deep_repair_user_staking(telegram_id):
    """Глибоке відновлення стану стейкінгу з перевіркою цілісності даних"""
    try:
        # Перевірка даних запиту
        data = request.json or {}

        # Отримуємо користувача
        user = get_user(telegram_id)
        if not user:
            return jsonify({"status": "error", "message": "Користувача не знайдено"}), 404

        # Створюємо пустий об'єкт стейкінгу
        empty_staking = {
            "hasActiveStaking": False,
            "status": "cancelled",
            "stakingAmount": 0,
            "period": 0,
            "rewardPercent": 0,
            "expectedReward": 0,
            "remainingDays": 0
        }

        # Оновлюємо одночасно баланс і всі дані стейкінгу
        balance_adjustment = data.get('balance_adjustment', 0)
        current_balance = float(user.get("balance", 0))
        new_balance = current_balance + float(balance_adjustment)

        # Оновлюємо дані користувача
        result = update_user(telegram_id, {
            "balance": new_balance,
            "staking_data": empty_staking,
            "staking_history": []  # Повне скидання історії
        })

        if not result:
            return jsonify({"status": "error", "message": "Помилка глибокого відновлення"}), 500

        # Додаємо інформативну транзакцію
        if balance_adjustment != 0:
            try:
                transaction = {
                    "telegram_id": telegram_id,
                    "type": "system",
                    "amount": balance_adjustment,
                    "description": f"Системне коригування балансу при глибокому відновленні",
                    "status": "completed"
                }

                supabase.table("transactions").insert(transaction).execute()
            except Exception as e:
                logger.error(f"api_deep_repair_user_staking: Помилка при створенні транзакції: {str(e)}")

        return jsonify({
            "status": "success",
            "message": "Глибоке відновлення стейкінгу успішно завершено",
            "data": {
                "previous_balance": current_balance,
                "new_balance": new_balance,
                "adjustment": balance_adjustment
            }
        })

    except Exception as e:
        logger.error(f"api_deep_repair_user_staking: Помилка: {str(e)}")
        return jsonify({"status": "error", "message": "Помилка глибокого відновлення"}), 500

# Запуск застосунку
if __name__ == '__main__':
    port = int(os.environ.get("PORT", 8080))
    debug_mode = os.environ.get("FLASK_ENV") == "development"
    app.run(debug=debug_mode, host='0.0.0.0', port=port)