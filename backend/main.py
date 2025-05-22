"""
Основний файл Flask застосунку для системи WINIX
Оптимізована версія з покращеною структурою, логуванням і обробкою помилок
"""

# Стандартні бібліотеки
import os
import sys
import logging
import json
import time
import uuid
from datetime import datetime
from pathlib import Path
import traceback

# Сторонні бібліотеки
from flask import Flask, render_template, request, jsonify, send_from_directory, session, g, abort
from flask_cors import CORS
from dotenv import load_dotenv
from flask_sqlalchemy import SQLAlchemy

# Завантажуємо змінні середовища
load_dotenv()

# Налаштування логування
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(levelname)s - %(name)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Додаємо директорію додатку до шляху Python
app_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.dirname(app_dir)
sys.path.insert(0, root_dir)
sys.path.insert(0, app_dir)

# Визначаємо базову директорію проекту
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_DIR = os.path.dirname(BACKEND_DIR)

# Додаємо директорію backend до шляху Python для імпортів
if BACKEND_DIR not in sys.path:
    sys.path.append(BACKEND_DIR)

# Імпорт ініціалізації бази даних
from database import db, init_db

# Перевірка валідності UUID
def is_valid_uuid(uuid_string):
    """Перевіряє, чи є рядок валідним UUID"""
    try:
        uuid_obj = uuid.UUID(str(uuid_string).strip())
        return True
    except (ValueError, AttributeError, TypeError):
        return False

def create_app(config_name=None):
    """Фабрика для створення застосунку Flask"""

    # Завантажуємо конфігурацію на початку функції
    from settings.config import get_config
    config = get_config()
    logger.info(f"Завантажена конфігурація: {type(config)}")

    if config is None:
        logger.critical("❌ Конфігурація не завантажена!")
        exit(1)

    # Ініціалізація Flask з абсолютними шляхами для шаблонів та статики
    app = Flask(
        __name__,
        template_folder=os.path.join(BASE_DIR, 'frontend'),
        static_folder=os.path.join(BASE_DIR, 'frontend'),
        static_url_path=''  # Порожній шлях дозволяє доступ до файлів напряму
    )

    # Завантажуємо конфігурацію
    try:
        app.config.from_object(config)
        # Секретний ключ для сесій
        app.secret_key = config.SECRET_KEY
        logger.info("Конфігурація успішно завантажена")
    except Exception as e:
        logger.error(f"Помилка завантаження конфігурації: {str(e)}")
        # Базові налаштування, якщо settings не знайдено
        app.secret_key = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')
        app.config['DEBUG'] = os.environ.get('FLASK_ENV') == 'development'

    # Налаштування бази даних
    app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'sqlite:///winix.db')
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

    # Ініціалізація SQLAlchemy з додатком
    init_db(app)

    # Налаштовуємо CORS
    setup_cors(app)

    # Налаштовуємо обробники запитів
    setup_request_handlers(app)

    # Додаємо health check endpoint
    add_health_check(app)

    # Реєструємо маршрути API
    register_api_routes(app)

    # Реєструємо діагностичні маршрути
    register_utility_routes(app)

    # Реєструємо маршрути для статичних файлів
    register_static_routes(app)

    # Реєструємо маршрути для HTML сторінок
    register_page_routes(app)

    # Налаштування маршрутів для стейкінгу (для сумісності)
    setup_staking_routes(app)

    # Налаштування маршрутів для туторіалу
    register_tutorial_routes(app)

    # Налаштовуємо обробники помилок
    register_error_handlers(app)

    # Додаємо обробник OPTIONS запитів для CORS preflight
    @app.route('/', defaults={'path': ''}, methods=['OPTIONS'])
    @app.route('/<path:path>', methods=['OPTIONS'])
    def handle_options(path):
        return '', 200

    # Додаємо after_request обробник для JS файлів і CORS заголовків
    @app.after_request
    def add_headers(response):
        # Налаштування MIME типу для JS файлів
        if request.path.endswith('.js'):
            response.headers['Content-Type'] = 'application/javascript'

        # Налаштування заголовків CORS для всіх відповідей
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
        response.headers[
            'Access-Control-Allow-Headers'] = 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Telegram-User-Id'
        response.headers['Access-Control-Allow-Credentials'] = 'true'
        response.headers['Access-Control-Max-Age'] = '86400'  # 24 години кешування preflight запитів

        # Налаштування заголовків безпеки
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-XSS-Protection'] = '1; mode=block'

        # Виправлена логіка для Telegram WebApp
        # Перевіряємо чи це запит з Telegram WebApp (різні способи детекції)
        is_telegram_webapp = (
            # Перевірка User-Agent
                (request.headers.get('User-Agent') and 'Telegram' in request.headers.get('User-Agent')) or
                # Перевірка Referer (Telegram WebApp може мати telegram.org в referer)
                (request.headers.get('Referer') and ('telegram.org' in request.headers.get(
                    'Referer') or 'web.telegram.org' in request.headers.get('Referer'))) or
                # Перевірка наявності tgWebAppData в URL (характерно для Telegram WebApp)
                (request.url and 'tgWebAppData' in request.url) or
                # Перевірка специфічних заголовків Telegram
                request.headers.get('X-Telegram-Bot-Api-Secret-Token') is not None
        )

        if is_telegram_webapp:
            # Для Telegram WebApp повністю видаляємо X-Frame-Options
            if 'X-Frame-Options' in response.headers:
                del response.headers['X-Frame-Options']
            # Додаємо CSP який дозволяє Telegram домени
            response.headers[
                'Content-Security-Policy'] = "frame-ancestors 'self' https://web.telegram.org https://telegram.org"
        else:
            # Для інших запитів встановлюємо SAMEORIGIN
            response.headers['X-Frame-Options'] = 'SAMEORIGIN'

        # Налаштування кешування
        if request.path.startswith('/api/'):
            # Для API запитів відключаємо кешування
            response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
            response.headers['Pragma'] = 'no-cache'
            response.headers['Expires'] = '0'
        else:
            # Для статичних файлів дозволяємо кешування
            response.headers['Cache-Control'] = 'public, max-age=3600'  # 1 година

        return response

    # Створення таблиць БД при запуску
    with app.app_context():
        db.create_all()
        logger.info("Таблиці бази даних створено")

    return app  # КРИТИЧНО ВАЖЛИВО - повертаємо створений app


def setup_cors(app):
    """Налаштування CORS для API"""
    # Оновлена конфігурація CORS для кращої сумісності з реферальною системою
    CORS(app,
         resources={r"/*": {"origins": "*"}},
         supports_credentials=True,
         expose_headers=["Content-Type", "X-CSRFToken", "Authorization"],
         allow_headers=["Content-Type", "X-Requested-With", "Authorization",
                        "X-Telegram-User-Id", "Accept", "Origin", "Cache-Control"])
    logger.info("CORS налаштовано")


def setup_request_handlers(app):
    """Налаштування обробників запитів для логування та локалізації"""

    @app.before_request
    def log_request_info():
        # Зберігаємо час початку запиту
        g.start_time = time.time()
        logger.info(f"Отримано запит: {request.method} {request.path}")

        # Визначаємо мову користувача
        try:
            import i18n
            g.language = i18n.get_user_language()
        except ImportError:
            g.language = 'uk'  # Мова за замовчуванням
        except Exception as e:
            logger.warning(f"Помилка визначення мови: {str(e)}")
            g.language = 'uk'

    @app.after_request
    def log_response_info(response):
        # Логуємо час виконання запиту
        if hasattr(g, 'start_time'):
            execution_time = time.time() - g.start_time
            logger.info(f"Відповідь: {response.status_code} (час: {execution_time:.4f}s)")
        return response


def add_health_check(app):
    """Додає endpoint для перевірки стану API"""
    @app.route('/api/health', methods=['GET'])
    def health_check():
        """Перевірка стану API"""
        return jsonify({
            "status": "ok",
            "timestamp": datetime.utcnow().isoformat(),
            "service": "WINIX API"
        })


def register_api_routes(app):
    """Реєстрація всіх API маршрутів"""
    # Функція для логування результату реєстрації маршрутів
    def log_registration_result(name, success, error=None):
        if success:
            logger.info(f"✅ Маршрути {name} успішно зареєстровано")
        else:
            logger.error(f"❌ Помилка реєстрації маршрутів {name}: {error}")
            if error:
                logger.error(traceback.format_exc())

    # Реєстрація маршрутів розіграшів
    try:
        from raffles.routes import register_raffles_routes
        success = register_raffles_routes(app)
        log_registration_result("розіграшів", success)
    except Exception as e:
        log_registration_result("розіграшів", False, str(e))

    # Реєстрація маршрутів авторизації
    try:
        from auth.routes import register_auth_routes
        register_auth_routes(app)
        log_registration_result("авторизації", True)
    except Exception as e:
        log_registration_result("авторизації", False, str(e))

    # Реєстрація маршрутів користувачів
    try:
        from users.routes import register_user_routes
        register_user_routes(app)
        log_registration_result("користувачів", True)
    except Exception as e:
        log_registration_result("користувачів", False, str(e))

    # Реєстрація маршрутів гаманця
    try:
        from wallet.routes import register_wallet_routes
        register_wallet_routes(app)
        log_registration_result("гаманця", True)
    except Exception as e:
        log_registration_result("гаманця", False, str(e))

    # Реєстрація маршрутів транзакцій
    try:
        from transactions.routes import register_transactions_routes
        register_transactions_routes(app)
        log_registration_result("транзакцій", True)
    except Exception as e:
        log_registration_result("транзакцій", False, str(e))

    # Реєстрація маршрутів завдань
    try:
        from quests.routes import register_quests_routes
        register_quests_routes(app)
        log_registration_result("завдань", True)
    except Exception as e:
        log_registration_result("завдань", False, str(e))

    # Реєстрація маршрутів рефералів
    try:
        from referrals.routes import referrals_bp
        app.register_blueprint(referrals_bp)
        log_registration_result("рефералів", True)
    except Exception as e:
        log_registration_result("рефералів", False, str(e))

    # Реєстрація маршрутів бейджів та завдань
    try:
        from badges.routes import badges_bp
        app.register_blueprint(badges_bp)
        log_registration_result("бейджів та завдань", True)
    except Exception as e:
        log_registration_result("бейджів та завдань", False, str(e))

    # Реєстрація маршрутів адміністратора
    try:
        from admin.routes import register_admin_routes
        register_admin_routes(app)
        log_registration_result("адміністратора", True)
    except Exception as e:
        log_registration_result("адміністратора", False, str(e))

    # Реєстрація маршрутів статистики
    try:
        from stats.routes import register_stats_routes
        register_stats_routes(app)
        log_registration_result("статистики", True)
    except Exception as e:
        log_registration_result("статистики", False, str(e))

    logger.info("Реєстрація API маршрутів завершена")

    # Реєстрація маршрутів Telegram webhook
    try:
        from telegram_webhook import register_telegram_routes
        register_telegram_routes(app)
        log_registration_result("Telegram webhook", True)
    except Exception as e:
        log_registration_result("Telegram webhook", False, str(e))

        # Реєстрація маршрутів Telegram API
        try:
            from telegram_api import register_telegram_api_routes
            register_telegram_api_routes(app)
            log_registration_result("Telegram API", True)
        except Exception as e:
            log_registration_result("Telegram API", False, str(e))


def register_utility_routes(app):
    """Реєстрація діагностичних та утилітарних маршрутів"""
    # Імпорт необхідних компонентів
    try:
        from supabase_client import test_supabase_connection, supabase
    except ImportError:
        test_supabase_connection = lambda: {"status": "error", "message": "Функція недоступна"}
        supabase = None

    @app.route('/api/ping')
    def ping():
        """Найпростіший маршрут для перевірки стану додатка"""
        return "pong"

    # Додаємо тестовий шлях для перевірки маршрутів розіграшів
    @app.route('/api/raffles-test')
    def api_raffles_test():
        """Тестовий шлях для перевірки маршрутів розіграшів"""
        return jsonify({
            "status": "success",
            "message": "Тестовий маршрут розіграшів працює"
        })

    @app.route('/debug')
    def debug():
        """Діагностичний маршрут для перевірки конфігурації"""
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
        raffles_html_exists = os.path.exists(os.path.join(template_dir, 'raffles.html'))

        # Отримуємо список зареєстрованих маршрутів
        routes = []
        for rule in app.url_map.iter_rules():
            routes.append({
                "endpoint": rule.endpoint,
                "methods": list(rule.methods),
                "path": str(rule)
            })

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
                "raffles_html_exists": raffles_html_exists,
                "supabase_test": supabase_test
            },
            "routes": routes[:20]  # Обмежуємо до 20 маршрутів для читабельності
        })

    @app.route('/api/debug', methods=['POST'])
    def debug_data():
        """Ендпоінт для логування даних з клієнта."""
        data = request.json
        logger.info(f"DEBUG DATA: {json.dumps(data)}")
        return jsonify({"status": "ok"})

    # Додаємо новий діагностичний ендпоінт для JS файлів
    @app.route('/debug/js-files')
    def debug_js_files():
        """Діагностичний ендпоінт для перевірки JS файлів"""
        js_dir = os.path.join(BASE_DIR, 'frontend/js')
        referrals_dir = os.path.join(js_dir, 'referrals')
        api_dir = os.path.join(referrals_dir, 'api') if os.path.exists(referrals_dir) else None

        result = {
            'js_dir_exists': os.path.exists(js_dir),
            'js_files': [],
            'referrals_dir_exists': os.path.exists(referrals_dir),
            'referrals_files': [],
            'api_dir_exists': os.path.exists(api_dir) if api_dir else False,
            'api_files': []
        }

        if os.path.exists(js_dir):
            result['js_files'] = os.listdir(js_dir)

        if os.path.exists(referrals_dir):
            result['referrals_files'] = os.listdir(referrals_dir)

        if api_dir and os.path.exists(api_dir):
            result['api_files'] = os.listdir(api_dir)

        return jsonify(result)

    # Новий діагностичний ендпоінт для тестування CORS
    @app.route('/api/cors-test', methods=['GET', 'POST', 'OPTIONS'])
    def cors_test():
        """Ендпоінт для тестування налаштувань CORS"""
        if request.method == 'OPTIONS':
            return '', 200

        method = request.method
        headers = dict(request.headers)
        data = request.json if request.is_json else None

        return jsonify({
            "status": "success",
            "method": method,
            "headers": headers,
            "data": data,
            "timestamp": datetime.utcnow().isoformat()
        })


def register_static_routes(app):
    """Реєстрація маршрутів для статичних файлів"""
    static_dirs = {
        'assets': os.path.join(BASE_DIR, 'frontend/assets'),
        'ChenelPNG': os.path.join(BASE_DIR, 'frontend/ChenelPNG'),
        'js': os.path.join(BASE_DIR, 'frontend/js'),
        'css': os.path.join(BASE_DIR, 'frontend/css')
    }

    # Покращена функція для обробки статичних файлів
    def serve_static_file(directory, filename):
        try:
            # Повний шлях до файлу
            full_path = os.path.join(directory, filename)
            logger.info(f"Запит на статичний файл: {full_path}")

            # Перевірка існування файлу
            if os.path.exists(full_path):
                logger.info(f"Файл знайдено: {full_path}")

                # Визначення MIME типу для JS файлів
                mimetype = None
                if filename.endswith('.js'):
                    mimetype = 'application/javascript'

                return send_from_directory(directory, filename, mimetype=mimetype)
            else:
                logger.warning(f"Файл не знайдено: {directory}/{filename}")

                # Перевіряємо, чи є файл з .js розширенням
                if not filename.endswith('.js') and os.path.exists(f"{full_path}.js"):
                    logger.info(f"Знайдено файл з .js розширенням: {full_path}.js")
                    return send_from_directory(directory, f"{filename}.js", mimetype='application/javascript')

                return jsonify({"error": f"Файл не знайдено: {filename}"}), 404
        except Exception as e:
            logger.error(f"Помилка видачі статичного файлу {filename}: {str(e)}")
            return jsonify({"error": f"Помилка видачі файлу: {filename}"}), 500

    # Реєстрація маршрутів для кожної директорії
    @app.route('/assets/<path:filename>')
    def serve_asset(filename):
        return serve_static_file(static_dirs['assets'], filename)

    @app.route('/ChenelPNG/<path:filename>')
    def serve_chenel_png(filename):
        return serve_static_file(static_dirs['ChenelPNG'], filename)

    # Покращений обробник для JS файлів
    @app.route('/js/<path:filename>')
    def serve_js(filename):
        # Надаємо більше інформації про запит для відлагодження
        logger.info(f"JS файл запитано: {filename}")
        return serve_static_file(static_dirs['js'], filename)

    # Додаємо спеціальні маршрути для модулів реферальної системи
    @app.route('/js/referrals/api/<path:filename>')
    def serve_referrals_api_js(filename):
        referrals_api_dir = os.path.join(static_dirs['js'], 'referrals/api')
        logger.info(f"Запит JS API файлу реферальної системи: {filename}")
        return serve_static_file(referrals_api_dir, filename)

    @app.route('/js/referrals/constants/<path:filename>')
    def serve_referrals_constants_js(filename):
        referrals_constants_dir = os.path.join(static_dirs['js'], 'referrals/constants')
        logger.info(f"Запит JS константи реферальної системи: {filename}")
        return serve_static_file(referrals_constants_dir, filename)

    @app.route('/js/referrals/utils/<path:filename>')
    def serve_referrals_utils_js(filename):
        referrals_utils_dir = os.path.join(static_dirs['js'], 'referrals/utils')
        logger.info(f"Запит JS утиліти реферальної системи: {filename}")
        return serve_static_file(referrals_utils_dir, filename)

    @app.route('/css/<path:filename>')
    def serve_css(filename):
        return serve_static_file(static_dirs['css'], filename)

    logger.info("Маршрути для статичних файлів зареєстровано")


def register_page_routes(app):
    """Реєстрація маршрутів для HTML сторінок"""

    # Основні маршрути
    @app.route('/')
    def index():
        return render_template('index.html')

    @app.route('/original-index')
    def original_index():
        try:
            return render_template('original-index.html')
        except Exception as e:
            logger.error(f"Помилка рендерингу original-index.html: {str(e)}")
            # Повертаємо базову сторінку якщо оригінал відсутній
            return render_template('index.html')

    @app.route('/original-index.html')
    def original_index_html():
        try:
            return render_template('original-index.html')
        except Exception as e:
            logger.error(f"Помилка рендерингу original-index.html: {str(e)}")
            return render_template('index.html')

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
        try:
            return render_template('raffles.html')
        except Exception as e:
            logger.error(f"Помилка рендерингу raffles.html: {str(e)}")
            # Повертаємо базову HTML-сторінку якщо файл не знайдено
            return """
            <!DOCTYPE html>
            <html>
            <head>
                <title>WINIX Розіграші</title>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <link rel="stylesheet" href="/css/style.css">
            </head>
            <body>
                <h1>WINIX Розіграші</h1>
                <p>Сторінка розіграшів завантажується...</p>
                <script src="/js/tasks-api.js"></script>
                <script src="/js/core.js"></script>
                <script src="/js/raffles/init.js"></script>
                <script src="/js/raffles/index.js"></script>
            </body>
            </html>
            """

    # Маршрут для всіх інших HTML файлів
    @app.route('/<path:filename>.html')
    def serve_html(filename):
        try:
            return render_template(f'{filename}.html')
        except Exception as e:
            logger.error(f"Помилка рендерингу {filename}.html: {str(e)}")
            return jsonify({"error": str(e), "type": "template_error", "filename": filename}), 500

    logger.info("Маршрути для HTML сторінок зареєстровано")


def setup_staking_routes(app):
    """Налаштування маршрутів для стейкінгу (для зворотної сумісності)"""
    try:
        # Імпорт контролерів стейкінгу
        from staking.controllers import (
            get_user_staking, create_user_staking, update_user_staking,
            cancel_user_staking, finalize_user_staking, get_user_staking_history,
            calculate_staking_reward_api, reset_and_repair_staking,
            repair_user_staking, deep_repair_user_staking
        )

        # Реєстрація прямих маршрутів для стейкінгу (для сумісності)
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

        logger.info("✅ Маршрути для стейкінгу зареєстровано")
    except ImportError as e:
        logger.warning(f"Неможливо налаштувати маршрути стейкінгу: модуль не знайдено - {str(e)}")
    except Exception as e:
        logger.error(f"Помилка налаштування маршрутів стейкінгу: {str(e)}")


def register_tutorial_routes(app):
    """Реєстрація маршрутів для туторіалу"""
    try:
        # Імпорт необхідних компонентів
        from users.controllers import get_user_profile, update_user_balance

        try:
            from supabase_client import supabase
        except ImportError:
            supabase = None

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
                    if supabase:
                        supabase.table("winix").update({"page1_completed": True}).eq("telegram_id", user_id).execute()

                    return jsonify({"status": "success", "tokens": update_data["balance"]})
                else:
                    return jsonify({"status": "already_completed", "message": "Жетон уже нараховано"})
            except Exception as e:
                logger.error(f"Error in confirm endpoint: {str(e)}")
                return jsonify({"status": "error", "message": str(e)}), 500

        logger.info("Маршрути для туторіалу зареєстровано")
    except ImportError as e:
        logger.warning(f"Неможливо налаштувати маршрути туторіалу: модуль не знайдено - {str(e)}")
    except Exception as e:
        logger.error(f"Помилка налаштування маршрутів туторіалу: {str(e)}")


def register_error_handlers(app):
    """Реєстрація обробників помилок"""

    @app.errorhandler(404)
    def page_not_found(e):
        logger.error(f"404 error: {request.path}")

        # Перевірка чи це API запит
        is_api_request = request.path.startswith('/api/')

        # Спеціальна обробка для API маршрутів розіграшів
        if is_api_request and ('/raffles' in request.path or '/raffle' in request.path):
            logger.error(f"API 404 для розіграшу: {request.path}")

            # Повертаємо порожній масив для запитів на отримання розіграшів
            if request.path == '/api/raffles' or request.path.endswith('/raffles'):
                return jsonify({
                    "status": "success",
                    "data": [],
                    "message": "Дані не знайдено (404 помилка)"
                })

            # Для інших API розіграшів
            return jsonify({
                "status": "error",
                "message": f"Ресурс не знайдено: {request.path}",
                "code": "not_found"
            }), 404

        # Спеціальна обробка для шляхів API з можливою помилкою UUID
        if '/api/raffles/' in request.path:
            # Перевірка, чи містить шлях потенційно короткий UUID
            parts = request.path.split('/')
            for part in parts:
                if part and len(part) < 36 and not part.startswith('api'):
                    logger.error(f"Виявлено потенційно невалідний UUID: {part}")
                    return jsonify({
                        "error": "invalid_raffle_id",
                        "message": "Невалідний ідентифікатор розіграшу",
                        "details": "ID розіграшу має бути у форматі UUID"
                    }), 400

        # Для звичайних API запитів
        if is_api_request:
            return jsonify({
                "status": "error",
                "message": f"Ресурс не знайдено: {request.path}"
            }), 404

        # Для HTML сторінок
        return jsonify({
            "error": "not_found",
            "message": f"Сторінка не знайдена: {request.path}",
            "available_routes": [
                "/", "/index.html", "/original-index.html", "/earn.html", "/wallet.html",
                "/referrals.html", "/staking.html", "/transactions.html", "/raffles.html"
            ]
        }), 404

    @app.errorhandler(500)
    def server_error(e):
        error_details = str(e)
        logger.error(f"500 error: {error_details}")

        # В режимі розробки включаємо трейс помилки
        if app.config.get('DEBUG', False):
            error_trace = traceback.format_exc()
            logger.error(f"Error trace: {error_trace}")

        return jsonify({
            "error": "server_error",
            "message": "Внутрішня помилка сервера",
            "details": error_details if app.config.get('DEBUG', False) else None
        }), 500

    logger.info("Обробники помилок зареєстровано")


def init_raffle_service():
    """Ініціалізація сервісу розіграшів, якщо він налаштований"""
    try:
        # Перевіряємо, чи потрібно запускати сервіс розіграшів
        auto_start = os.getenv("AUTO_START_RAFFLE_SERVICE", "false").lower() == "true"

        if auto_start:
            try:
                from raffles.raffle_service import start_raffle_service

                if start_raffle_service():
                    logger.info("Сервіс розіграшів успішно запущено")
                else:
                    logger.warning("Не вдалося запустити сервіс розіграшів")
            except ImportError:
                logger.info("Модуль сервісу розіграшів не знайдено")
            except Exception as e:
                logger.error(f"Помилка запуску сервісу розіграшів: {str(e)}")
    except Exception as e:
        logger.error(f"Помилка ініціалізації сервісу розіграшів: {str(e)}")


# Створення та ініціалізація застосунку
app = create_app()

# Запускаємо сервіс розіграшів, якщо налаштовано
init_raffle_service()

# Запуск застосунку
if __name__ == '__main__':
    # Додайте перевірку на None
    if app is None:
        logger.critical("❌ Додаток не ініціалізовано!")
        exit(1)

    # Визначення порту
    port = int(os.environ.get('PORT', 8080))

    # Безпечне отримання DEBUG
    debug = getattr(app.config, 'DEBUG', True) if hasattr(app, 'config') else True

    logger.info(f"Запуск застосунку на порту {port}, режим налагодження: {debug}")

    # Запуск сервера
    app.run(host='0.0.0.0', port=port, debug=debug)