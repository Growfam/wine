from flask import Flask, render_template, request, jsonify, send_from_directory, session, g
from flask_cors import CORS
import os
import logging
import json
import time
from datetime import datetime
from dotenv import load_dotenv

# Імпортуємо налаштування
from settings import current_config

# Імпортуємо клієнт для Supabase
from supabase_client import supabase, test_supabase_connection

# Імпортуємо модулі для реєстрації маршрутів
from auth.routes import register_auth_routes
from users.routes import register_user_routes
from wallet.routes import register_wallet_routes
from transactions.routes import register_transactions_routes
from raffles.routes import register_raffles_routes
from quests.routes import register_quests_routes
from referrals.routes import register_referrals_routes
from badges.routes import register_badges_routes
from admin.routes import register_admin_routes
from stats.routes import register_stats_routes
import i18n

# Залишаємо прямий імпорт для стейкінгу, щоб не порушувати його роботу
from staking.controllers import (
    get_user_staking,
    create_user_staking,
    update_user_staking,
    cancel_user_staking,
    finalize_user_staking,
    get_user_staking_history,
    calculate_staking_reward_api,
    reset_and_repair_staking,
    repair_user_staking,
    deep_repair_user_staking
)

# Імпортуємо модуль для обробки стандартних запитів для сумісності
from auth.controllers import verify_user
from users.controllers import (
    get_user_profile, get_user_balance, update_user_balance,
    claim_badge_reward, claim_newbie_bonus, get_user_settings,
    update_user_settings, update_user_password, get_user_seed_phrase
)

# Налаштування логування
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Визначаємо базову директорію проекту
BACKEND_DIR = os.path.abspath(os.path.dirname(__file__))
BASE_DIR = os.path.dirname(BACKEND_DIR)

# Ініціалізація Flask з абсолютними шляхами для шаблонів та статики
app = Flask(__name__,
            template_folder=os.path.join(BASE_DIR, 'frontend'),  # Директорія для HTML-файлів
            static_folder=os.path.join(BASE_DIR, 'frontend'))  # Директорія для статичних файлів

# Секретний ключ для сесій
app.secret_key = current_config.SECRET_KEY

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


# Реєстрація всіх маршрутів з модулів
register_auth_routes(app)
register_user_routes(app)
register_wallet_routes(app)
register_transactions_routes(app)
register_raffles_routes(app)
register_quests_routes(app)
register_referrals_routes(app)
register_badges_routes(app)
register_admin_routes(app)
register_stats_routes(app)


# Прямі маршрути для стейкінгу для збереження сумісності
@app.route('/api/user/<telegram_id>/staking', methods=['GET'])
def api_get_user_staking(telegram_id):
    """Отримання даних стейкінгу користувача"""
    return get_user_staking(telegram_id)


@app.route('/api/user/<telegram_id>/staking', methods=['POST'])
def api_create_user_staking(telegram_id):
    """Створення стейкінгу користувача"""
    return create_user_staking(telegram_id)


@app.route('/api/user/<telegram_id>/staking/<staking_id>', methods=['PUT'])
def api_update_user_staking(telegram_id, staking_id):
    """Оновлення стейкінгу користувача"""
    return update_user_staking(telegram_id, staking_id)


@app.route('/api/user/<telegram_id>/staking/<staking_id>/cancel', methods=['POST'])
def api_cancel_user_staking(telegram_id, staking_id):
    """Скасування стейкінгу користувача"""
    return cancel_user_staking(telegram_id, staking_id)


@app.route('/api/user/<telegram_id>/staking/<staking_id>/finalize', methods=['POST'])
def api_finalize_user_staking(telegram_id, staking_id):
    """Завершення стейкінгу і нарахування винагороди"""
    return finalize_user_staking(telegram_id, staking_id)


@app.route('/api/user/<telegram_id>/staking/history', methods=['GET'])
def api_get_user_staking_history(telegram_id):
    """Отримання історії стейкінгу"""
    return get_user_staking_history(telegram_id)


@app.route('/api/user/<telegram_id>/staking/calculate-reward', methods=['GET'])
def api_calculate_staking_reward(telegram_id):
    """Розрахунок очікуваної винагороди за стейкінг"""
    return calculate_staking_reward_api()


@app.route('/api/user/<telegram_id>/staking/repair', methods=['POST'])
def api_repair_user_staking(telegram_id):
    """Відновлення стану стейкінгу після помилок"""
    return repair_user_staking(telegram_id)


@app.route('/api/user/<telegram_id>/staking/reset-repair', methods=['POST'])
def api_reset_and_repair_staking(telegram_id):
    """Відновлення стану стейкінгу через reset_and_repair_staking"""
    try:
        # Перевірка даних запиту
        data = request.json or {}
        force = data.get('force', False)

        # Виклик функції відновлення
        return reset_and_repair_staking(telegram_id, force)
    except Exception as e:
        logger.error(f"api_reset_and_repair_staking: Помилка: {str(e)}")
        return jsonify({"status": "error", "message": "Помилка відновлення стейкінгу"}), 500


@app.route('/api/user/<telegram_id>/staking/deep-repair', methods=['POST'])
def api_deep_repair_user_staking(telegram_id):
    """Глибоке відновлення стану стейкінгу з перевіркою цілісності даних"""
    return deep_repair_user_staking(telegram_id)


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


# Маршрут для підтвердження завершення туторіалу
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


# Запуск застосунку
if __name__ == '__main__':
    port = int(os.environ.get("PORT", current_config.PORT))
    debug_mode = current_config.DEBUG
    app.run(debug=debug_mode, host='0.0.0.0', port=port)