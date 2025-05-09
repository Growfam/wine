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
    # Ініціалізація Flask з абсолютними шляхами для шаблонів та статики
    app = Flask(
        __name__,
        template_folder=os.path.join(BASE_DIR, 'frontend'),
        static_folder=os.path.join(BASE_DIR, 'frontend'),
        static_url_path=''  # Важливо для правильної обробки статичних файлів
    )

    # Завантажуємо конфігурацію
    from settings import current_config
    app.config.from_object(current_config)

    # Секретний ключ для сесій
    app.secret_key = current_config.SECRET_KEY

    # Налаштовуємо CORS
    setup_cors(app)

    # Налаштовуємо обробники запитів
    setup_request_handlers(app)

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

    # Додаємо обробник для MIME-типів
    @app.after_request
    def add_mime_types(response):
        # Виправлений обробник MIME-типів - перевіряємо шлях, а не поточний MIME-тип
        path = request.path
        if path.endswith('.js'):
            # Встановлюємо правильний MIME-тип для JavaScript файлів
            response.headers['Content-Type'] = 'application/javascript; charset=utf-8'
        elif path.endswith('.css'):
            # Встановлюємо правильний MIME-тип для CSS файлів
            response.headers['Content-Type'] = 'text/css; charset=utf-8'
        elif path.endswith('.json'):
            # Встановлюємо правильний MIME-тип для JSON файлів
            response.headers['Content-Type'] = 'application/json; charset=utf-8'

        # Додаємо заголовки для запобігання кешування в режимі розробки
        if app.config.get('DEBUG', False):
            response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
            response.headers['Pragma'] = 'no-cache'
            response.headers['Expires'] = '0'

        return response

    return app


def setup_cors(app):
    """Налаштування CORS для API"""
    CORS(app,
         resources={r"/*": {"origins": "*"}},
         supports_credentials=True,
         expose_headers=["Content-Type", "X-CSRFToken"],
         allow_headers=["Content-Type", "X-Requested-With", "Authorization", "X-Telegram-User-Id"])
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
        from referrals.routes import register_referrals_routes
        register_referrals_routes(app)
        log_registration_result("рефералів", True)
    except Exception as e:
        log_registration_result("рефералів", False, str(e))

    # Реєстрація маршрутів бейджів
    try:
        from badges.routes import register_badges_routes
        register_badges_routes(app)
        log_registration_result("бейджів", True)
    except Exception as e:
        log_registration_result("бейджів", False, str(e))

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


def register_utility_routes(app):
    """Реєстрація діагностичних та утилітарних маршрутів"""
    # Імпорт необхідних компонентів
    try:
        from supabase_client import test_supabase_connection, supabase
    except ImportError:
        test_supabase_connection = lambda: {"status": "error", "message": "Функція недоступна"}
        supabase = None

    @app.route('/ping')
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

    # Обробник для логування помилок з клієнта
    @app.route('/api/log/error', methods=['POST', 'OPTIONS'])
    def log_client_error():
        """Ендпоінт для логування помилок з клієнта"""
        # Обробка OPTIONS запитів для CORS preflight
        if request.method == 'OPTIONS':
            response = app.make_default_options_response()
            response.headers.add('Access-Control-Allow-Origin', '*')
            response.headers.add('Access-Control-Allow-Methods', 'POST')
            response.headers.add('Access-Control-Allow-Headers', 'Content-Type')
            return response

        try:
            error_data = request.json
            if not error_data:
                return jsonify({"success": False, "message": "Дані відсутні"}), 400

            # Логуємо помилку
            logger.error(f"Помилка клієнта: {json.dumps(error_data)}")

            # Якщо це помилка модуля, логуємо додаткові деталі
            if error_data.get('type') == 'module_error':
                logger.error(f"MODULE ERROR: {error_data.get('module')} - {error_data.get('error')}")

            return jsonify({"success": True, "message": "Помилка зареєстрована"})
        except Exception as e:
            logger.exception(f"Помилка при логуванні помилки клієнта: {str(e)}")
            return jsonify({"success": False, "message": "Внутрішня помилка сервера"}), 500

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

        # Перевіряємо JS файли, які викликають проблеми
        js_dir = os.path.join(BASE_DIR, 'frontend/js')
        settings_js_path = os.path.join(js_dir, 'tasks/config/settings.js')
        ui_index_js_path = os.path.join(js_dir, 'tasks/ui/index.js')
        daily_bonus_js_path = os.path.join(js_dir, 'tasks/api/models/daily-bonus.js')

        settings_js_exists = os.path.exists(settings_js_path)
        ui_index_js_exists = os.path.exists(ui_index_js_path)
        daily_bonus_js_exists = os.path.exists(daily_bonus_js_path)

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
                "supabase_test": supabase_test,
                "problem_js_files": {
                    "settings_js": {
                        "path": settings_js_path,
                        "exists": settings_js_exists
                    },
                    "ui_index_js": {
                        "path": ui_index_js_path,
                        "exists": ui_index_js_exists
                    },
                    "daily_bonus_js": {
                        "path": daily_bonus_js_path,
                        "exists": daily_bonus_js_exists
                    }
                }
            },
            "routes": routes[:20]  # Обмежуємо до 20 маршрутів для читабельності
        })

    @app.route('/api/debug', methods=['POST'])
    def debug_data():
        """Ендпоінт для логування даних з клієнта."""
        data = request.json
        logger.info(f"DEBUG DATA: {json.dumps(data)}")
        return jsonify({"status": "ok"})


def register_static_routes(app):
    """Реєстрація маршрутів для статичних файлів"""
    static_dirs = {
        'assets': os.path.join(BASE_DIR, 'frontend/assets'),
        'ChenelPNG': os.path.join(BASE_DIR, 'frontend/ChenelPNG'),
        'js': os.path.join(BASE_DIR, 'frontend/js'),
        'css': os.path.join(BASE_DIR, 'frontend/css')
    }

    # Функція для обробки статичних файлів
    def serve_static_file(directory, filename):
        try:
            file_path = os.path.join(directory, filename)
            logger.info(f"Шукаю статичний файл: {file_path}")

            if os.path.exists(file_path):
                logger.info(f"Файл знайдено: {file_path}")
                return send_from_directory(directory, filename)
            else:
                logger.warning(f"Файл не знайдено: {file_path}")
                abort(404)
        except Exception as e:
            logger.error(f"Помилка видачі статичного файлу {filename}: {str(e)}")
            logger.exception(e)  # Повний стек помилки для налагодження
            abort(500)

    # Реєстрація маршрутів для кожної директорії
    @app.route('/assets/<path:filename>')
    def serve_asset(filename):
        return serve_static_file(static_dirs['assets'], filename)

    @app.route('/ChenelPNG/<path:filename>')
    def serve_chenel_png(filename):
        return serve_static_file(static_dirs['ChenelPNG'], filename)

    # Спеціальне обслуговування JS файлів
    @app.route('/js/<path:filename>')
    def serve_js(filename):
        try:
            file_path = os.path.join(static_dirs['js'], filename)
            logger.info(f"Шукаю JS файл: {file_path}")

            if os.path.exists(file_path):
                logger.info(f"JS файл знайдено: {file_path}")
                response = send_from_directory(static_dirs['js'], filename)
                response.headers['Content-Type'] = 'application/javascript; charset=utf-8'
                return response
            else:
                logger.warning(f"JS файл не знайдено: {file_path}")
                abort(404)
        except Exception as e:
            logger.error(f"Помилка видачі JS файлу {filename}: {str(e)}")
            logger.exception(e)  # Повний стек помилки для налагодження
            abort(500)

    # Обробка запитів з доменним шляхом (для перехоплення повного URL)
    @app.route('/winixbot.com/js/<path:filename>')
    def serve_domained_js(filename):
        return serve_js(filename)

    @app.route('/css/<path:filename>')
    def serve_css(filename):
        try:
            file_path = os.path.join(static_dirs['css'], filename)
            logger.info(f"Шукаю CSS файл: {file_path}")

            if os.path.exists(file_path):
                logger.info(f"CSS файл знайдено: {file_path}")
                response = send_from_directory(static_dirs['css'], filename)
                response.headers['Content-Type'] = 'text/css; charset=utf-8'
                return response
            else:
                logger.warning(f"CSS файл не знайдено: {file_path}")
                abort(404)
        except Exception as e:
            logger.error(f"Помилка видачі CSS файлу {filename}: {str(e)}")
            logger.exception(e)
            abort(500)

    # Обробка запитів з доменним шляхом для CSS
    @app.route('/winixbot.com/css/<path:filename>')
    def serve_domained_css(filename):
        return serve_css(filename)

    # Додаємо загальний обробник для будь-яких статичних файлів
    @app.route('/<path:filename>')
    def serve_any_static(filename):
        # Перевіряємо, чи це файл типу, який ми знаємо як обробляти
        if filename.endswith('.js'):
            return serve_js(filename)
        elif filename.endswith('.css'):
            return serve_css(filename)
        elif filename.startswith('assets/'):
            return serve_asset(filename[7:])
        elif filename.startswith('ChenelPNG/'):
            return serve_chenel_png(filename[10:])

        # Якщо ніде не знайдено, шукаємо в кореневій статичній директорії
        try:
            return app.send_static_file(filename)
        except Exception:
            abort(404)

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
                <script src="/js/api.js"></script>
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

        logger.info("Маршрути для стейкінгу зареєстровано")
    except ImportError as e:
        logger.warning(f"Неможливо налаштувати маршрути стейкінгу: модуль не знайдено - {str(e)}")
    except Exception as e:
        logger.error(f"Помилка налаштування маршрутів стейкінгу: {str(e)}")


def register_tutorial_routes(app):
    """Реєстрація маршрутів для туторіалу"""
    try:
        # Імпорт необхідних компонентів
        from users.controllers import get_user_profile, update_user_balance
        from supabase_client import supabase

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

        logger.info("Маршрути для туторіалу зареєстровано")
    except ImportError as e:
        logger.warning(f"Неможливо налаштувати маршрути туторіалу: модуль не знайдено - {str(e)}")
    except Exception as e:
        logger.error(f"Помилка налаштування маршрутів туторіалу: {str(e)}")


def register_error_handlers(app):
    """Реєстрація обробників помилок"""

    @app.errorhandler(404)
    def page_not_found(e):
        # Перевірка чи це запит на статичні JS/CSS файли
        if request.path.endswith('.js') or request.path.endswith('.css'):
            logger.error(f"404 статичний файл не знайдено: {request.path}")

            if request.path.endswith('.js'):
                return "// Файл не знайдено", 404, {'Content-Type': 'application/javascript; charset=utf-8'}
            else:
                return "/* Файл не знайдено */", 404, {'Content-Type': 'text/css; charset=utf-8'}

        logger.error(f"404 маршрут не знайдено: {request.path}")

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
        logger.error(f"500 помилка: {error_details}")

        # В режимі розробки включаємо трейс помилки
        if app.config.get('DEBUG', False):
            error_trace = traceback.format_exc()
            logger.error(f"Error trace: {error_trace}")

        # Перевірка чи це запит на статичні JS/CSS файли
        if request.path.endswith('.js'):
            logger.error(f"500 помилка для JS файлу: {request.path}")
            return f"// Помилка сервера при обробці JavaScript файлу: {error_details}", 500, {'Content-Type': 'application/javascript; charset=utf-8'}
        elif request.path.endswith('.css'):
            logger.error(f"500 помилка для CSS файлу: {request.path}")
            return f"/* Помилка сервера при обробці CSS файлу: {error_details} */", 500, {'Content-Type': 'text/css; charset=utf-8'}

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
    try:
        # Отримуємо порт з конфігурації або середовища
        port = int(os.environ.get("PORT", app.config.get("PORT", 8080)))
        debug_mode = app.config.get("DEBUG", False)

        # Виводимо інформацію про запуск
        logger.info(f"Запуск застосунку на порту {port}, режим налагодження: {debug_mode}")

        # Запускаємо застосунок
        app.run(debug=debug_mode, host='0.0.0.0', port=port)
    except Exception as e:
        logger.critical(f"Критична помилка запуску застосунку: {str(e)}")
        traceback.print_exc()