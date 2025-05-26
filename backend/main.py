"""
Основний файл Flask застосунку для системи WINIX
ВИПРАВЛЕНА версія БЕЗ fallback плутанини та з простою стабільною архітектурою
"""

# Стандартні бібліотеки
import os
import sys
import logging
import time
from datetime import datetime, timezone

# Сторонні бібліотеки
from flask import Flask, render_template, request, jsonify, g
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

# Додаємо директорії до шляху Python
app_dir = os.path.dirname(os.path.abspath(__file__))
root_dir = os.path.dirname(app_dir)
sys.path.insert(0, root_dir)
sys.path.insert(0, app_dir)

# Визначаємо базову директорію проекту
BACKEND_DIR = os.path.dirname(os.path.abspath(__file__))
BASE_DIR = os.path.dirname(BACKEND_DIR)

# Збереження часу запуску для uptime
start_time = time.time()


def setup_cors(app):
    """Налаштування CORS для продакшн з підтримкою Telegram WebApp"""

    # Дозволені origins для продакшн
    allowed_origins = [
        "https://web.telegram.org",  # Telegram WebApp
        "https://winixbot.com",
        "https://www.winixbot.com",
        "https://localhost:*",
        "http://localhost:*"
    ]

    # Для розробки додаємо wildcard
    if os.environ.get('FLASK_ENV') == 'development':
        allowed_origins.append("*")

    CORS(app,
         resources={r"/api/*": {"origins": allowed_origins}},
         supports_credentials=True,
         expose_headers=["Content-Type", "X-CSRFToken", "Authorization"],
         allow_headers=[
             "Content-Type",
             "X-Requested-With",
             "Authorization",
             "X-Telegram-User-Id",
             "Accept",
             "Origin",
             "Cache-Control",
             "X-Telegram-Bot-Api-Secret-Token",
             "X-Telegram-Init-Data"
         ])

    logger.info("✅ CORS налаштовано з підтримкою Telegram WebApp")


def setup_request_handlers(app):
    """Налаштування обробників запитів для логування"""

    @app.before_request
    def log_request_info():
        # Зберігаємо час початку запиту
        g.start_time = time.time()

        # Логуємо тільки важливі запити
        if request.path.startswith('/api/'):
            logger.info(f"📨 API запит: {request.method} {request.path}")

    @app.after_request
    def log_response_info(response):
        # Логуємо час виконання запиту тільки для API
        if hasattr(g, 'start_time') and request.path.startswith('/api/'):
            execution_time = time.time() - g.start_time
            if execution_time > 1.0:  # Логуємо тільки повільні запити
                logger.warning(f"📤 Повільний запит: {response.status_code} {request.path} (час: {execution_time:.4f}s)")
        return response


def add_health_check(app):
    """Додає endpoint для перевірки стану API та Railway health check"""

    @app.route('/health', methods=['GET', 'HEAD'])
    def railway_health_check():
        """Health check для Railway (корневий /health)"""
        return "OK", 200

    @app.route('/healthz', methods=['GET', 'HEAD'])
    def kubernetes_health_check():
        """Health check для Kubernetes"""
        return "OK", 200

    @app.route('/', methods=['GET'])
    def root_health_check():
        """Health check для кореневого шляху"""
        try:
            return jsonify({
                "status": "ok",
                "service": "WINIX API",
                "version": "2.0.0",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "uptime": int(time.time() - start_time)
            }), 200
        except Exception:
            return "OK", 200

    @app.route('/api/health', methods=['GET'])
    def api_health_check():
        """Health check для API"""
        try:
            # Перевіряємо підключення до Supabase
            try:
                from supabase_client import supabase
                # Простий запит для перевірки з'єднання
                response = supabase.table("winix").select("telegram_id").limit(1).execute()
                db_status = "ok" if response else "error"
            except Exception as e:
                logger.warning(f"DB health check failed: {e}")
                db_status = "error"

            health_data = {
                "status": "ok",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "service": "WINIX API",
                "version": "2.0.0",
                "uptime": int(time.time() - start_time),
                "components": {
                    "database": db_status,
                    "api": "ok"
                }
            }
            return jsonify(health_data), 200
        except Exception as e:
            logger.error(f"Health check error: {e}")
            return jsonify({
                "status": "error",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "service": "WINIX API",
                "error": str(e)
            }), 500

    @app.route('/api/ping', methods=['GET'])
    def api_ping():
        """Простий ping endpoint"""
        return jsonify({
            "status": "pong",
            "timestamp": int(time.time()),
            "server_time": datetime.now(timezone.utc).isoformat()
        }), 200

    @app.route('/ping', methods=['GET'])
    def ultra_simple_ping():
        """Ультра простий ping без JSON"""
        return "pong", 200

    @app.route('/status', methods=['GET'])
    def status_check():
        """Статус сервера"""
        return "RUNNING", 200


def register_core_routes(app):
    """Реєстрація основних маршрутів системи"""

    logger.info("🛣️ === РЕЄСТРАЦІЯ ОСНОВНИХ МАРШРУТІВ ===")

    # Збираємо всі успішні реєстрації
    registered_successfully = []
    registration_errors = []

    # 1. Реєстрація маршрутів авторизації (ОБОВ'ЯЗКОВО)
    try:
        from auth.routes import register_auth_routes
        register_auth_routes(app)
        registered_successfully.append("Auth")
        logger.info("✅ Auth routes зареєстровано успішно")
    except Exception as e:
        registration_errors.append(f"Auth: {e}")
        logger.error(f"❌ КРИТИЧНА ПОМИЛКА: Не вдалося зареєструвати auth routes: {e}")
        # Це критична помилка - без auth система не працює
        raise

    # 2. Реєстрація маршрутів користувачів (ОБОВ'ЯЗКОВО)
    try:
        from users.routes import register_user_routes
        register_user_routes(app)
        registered_successfully.append("Users")
        logger.info("✅ Users routes зареєстровано успішно")
    except Exception as e:
        registration_errors.append(f"Users: {e}")
        logger.error(f"❌ КРИТИЧНА ПОМИЛКА: Не вдалося зареєструвати users routes: {e}")
        # Це критична помилка - без users система не працює
        raise

    # 3. Реєстрація маршрутів гаманця
    try:
        from wallet.routes import register_wallet_routes
        register_wallet_routes(app)
        registered_successfully.append("Wallet")
    except Exception as e:
        registration_errors.append(f"Wallet: {e}")
        logger.warning(f"⚠️ Не вдалося зареєструвати wallet routes: {e}")

    # 4. Реєстрація маршрутів транзакцій
    try:
        from transactions.routes import register_transactions_routes
        register_transactions_routes(app)
        registered_successfully.append("Transactions")
    except Exception as e:
        registration_errors.append(f"Transactions: {e}")
        logger.warning(f"⚠️ Не вдалося зареєструвати transactions routes: {e}")

    # 5. Реєстрація маршрутів рефералів
    try:
        from referrals.routes import referrals_bp
        app.register_blueprint(referrals_bp, url_prefix='/api/referrals')
        registered_successfully.append("Referrals")
    except Exception as e:
        registration_errors.append(f"Referrals: {e}")
        logger.warning(f"⚠️ Не вдалося зареєструвати referrals routes: {e}")

    # 6. Реєстрація маршрутів бейджів та завдань
    try:
        from badges.routes import badges_bp
        app.register_blueprint(badges_bp, url_prefix='/api')
        registered_successfully.append("Badges")
    except Exception as e:
        registration_errors.append(f"Badges: {e}")
        logger.warning(f"⚠️ Не вдалося зареєструвати badges routes: {e}")

    # 7. Реєстрація маршрутів розіграшів
    try:
        from raffles.routes import register_raffles_routes
        if register_raffles_routes(app):
            registered_successfully.append("Raffles")
        else:
            registration_errors.append("Raffles: returned False")
    except Exception as e:
        registration_errors.append(f"Raffles: {e}")
        logger.warning(f"⚠️ Не вдалося зареєструвати raffles routes: {e}")

    # 8. Реєстрація маршрутів адміністратора
    try:
        from admin.routes import register_admin_routes
        register_admin_routes(app)
        registered_successfully.append("Admin")
    except Exception as e:
        registration_errors.append(f"Admin: {e}")
        logger.warning(f"⚠️ Не вдалося зареєструвати admin routes: {e}")

    # 9. Реєстрація маршрутів статистики
    try:
        from stats.routes import register_stats_routes
        register_stats_routes(app)
        registered_successfully.append("Stats")
    except Exception as e:
        registration_errors.append(f"Stats: {e}")
        logger.warning(f"⚠️ Не вдалося зареєструвати stats routes: {e}")

    # 10. Реєстрація Telegram webhook
    try:
        from telegram_webhook import register_telegram_routes
        register_telegram_routes(app)
        registered_successfully.append("Telegram Webhook")
    except Exception as e:
        registration_errors.append(f"Telegram Webhook: {e}")
        logger.warning(f"⚠️ Не вдалося зареєструвати telegram webhook routes: {e}")

    # 11. Реєстрація Telegram API
    try:
        from telegram_api import register_telegram_api_routes
        register_telegram_api_routes(app)
        registered_successfully.append("Telegram API")
    except Exception as e:
        registration_errors.append(f"Telegram API: {e}")
        logger.warning(f"⚠️ Не вдалося зареєструвати telegram api routes: {e}")

    # 📊 ПІДСУМОК РЕЄСТРАЦІЇ
    logger.info("📊 === ПІДСУМОК РЕЄСТРАЦІЇ МАРШРУТІВ ===")
    logger.info(f"✅ Успішно зареєстровано ({len(registered_successfully)}):")
    for system in registered_successfully:
        logger.info(f"   🟢 {system}")

    if registration_errors:
        logger.warning(f"❌ Помилки реєстрації ({len(registration_errors)}):")
        for error in registration_errors:
            logger.warning(f"   🔴 {error}")

    # Рахуємо загальну кількість маршрутів
    total_routes = len(list(app.url_map.iter_rules()))
    api_routes = len([r for r in app.url_map.iter_rules() if r.rule.startswith('/api/')])

    logger.info(f"📋 Загальна статистика маршрутів:")
    logger.info(f"   📍 Всього маршрутів: {total_routes}")
    logger.info(f"   🔗 API маршрутів: {api_routes}")
    logger.info(f"   🎯 Системи зареєстровано: {len(registered_successfully)}")

    # Критична перевірка
    if api_routes == 0:
        logger.error("💥 КРИТИЧНА ПОМИЛКА: НІ ОДНОГО API МАРШРУТУ НЕ ЗАРЕЄСТРОВАНО!")
        raise RuntimeError("Не вдалося зареєструвати API маршрути")

    if len(registered_successfully) < 2:  # Принаймні Auth + Users
        logger.error("💥 КРИТИЧНА ПОМИЛКА: НЕ ЗАРЕЄСТРОВАНО КРИТИЧНІ СИСТЕМИ!")
        raise RuntimeError("Не вдалося зареєструвати критичні системи")

    logger.info("🎉 Реєстрація основних маршрутів завершена успішно!")
    return True


def register_utility_routes(app):
    """Реєстрація діагностичних та утилітарних маршрутів"""

    @app.route('/debug')
    def debug():
        """Діагностичний маршрут для перевірки конфігурації"""
        # Перевіряємо з'єднання з Supabase
        try:
            from supabase_client import test_supabase_connection
            supabase_test = test_supabase_connection()
        except ImportError:
            supabase_test = {"status": "error", "message": "Функція недоступна"}

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
                "template_folder": app.template_folder,
                "static_folder": app.static_folder,
                "supabase_test": supabase_test
            },
            "routes": routes[:20]  # Обмежуємо до 20 маршрутів для читабельності
        })


def register_error_handlers(app):
    """Реєстрація обробників помилок"""

    @app.errorhandler(404)
    def page_not_found(e):
        logger.error(f"404 error: {request.path}")

        # Перевірка чи це API запит
        is_api_request = request.path.startswith('/api/')

        if is_api_request:
            # Для API запитів - JSON відповідь
            return jsonify({
                "status": "error",
                "message": f"Ресурс не знайдено: {request.path}",
                "code": "not_found"
            }), 404

        # Для HTML сторінок
        return jsonify({
            "error": "not_found",
            "message": f"Сторінка не знайдена: {request.path}",
            "available_routes": [
                "/", "/index.html", "/api/health", "/api/ping"
            ]
        }), 404

    @app.errorhandler(500)
    def server_error(e):
        error_details = str(e)
        logger.error(f"500 error: {error_details}")

        return jsonify({
            "error": "server_error",
            "message": "Внутрішня помилка сервера",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }), 500

    @app.errorhandler(400)
    def bad_request(e):
        return jsonify({
            "status": "error",
            "message": "Невірний запит",
            "code": "bad_request"
        }), 400

    logger.info("✅ Обробники помилок зареєстровано")


def register_static_routes(app):
    """Реєстрація маршрутів для статичних файлів"""

    # Кореневий маршрут вже додано в add_health_check
    # Тут додаємо інші статичні маршрути

    @app.route('/favicon.ico')
    def favicon():
        """Favicon"""
        try:
            return app.send_static_file('favicon.ico')
        except Exception:
            return '', 204

    @app.route('/robots.txt')
    def robots_txt():
        """Robots.txt"""
        return '''User-agent: *
Disallow: /api/
Allow: /''', 200, {'Content-Type': 'text/plain'}

    # Статичні HTML файли
    static_pages = ['index.html', 'earn.html', 'wallet.html', 'referrals.html',
                   'staking.html', 'transactions.html', 'raffles.html']

    for page in static_pages:
        @app.route(f'/{page}')
        def serve_static_page(page=page):
            try:
                return render_template(page)
            except Exception as e:
                logger.warning(f"Не вдалося завантажити {page}: {e}")
                return jsonify({
                    "message": f"WINIX - {page} не знайдено",
                    "service": "WINIX Backend API",
                    "version": "2.0.0"
                }), 404


def create_app():
    """Фабрика для створення застосунку Flask"""

    logger.info("🏭 === СТВОРЕННЯ FLASK ЗАСТОСУНКУ ===")

    # Завантажуємо конфігурацію
    try:
        from settings.config import get_config
        config = get_config()
        logger.info(f"✅ Завантажена конфігурація: {type(config)}")
    except ImportError as e:
        logger.warning(f"⚠️ Не вдалося завантажити config: {e}")
        config = None

    # Ініціалізація Flask з абсолютними шляхами
    app = Flask(
        __name__,
        template_folder=os.path.join(BASE_DIR, 'frontend'),
        static_folder=os.path.join(BASE_DIR, 'frontend'),
        static_url_path=''
    )
    logger.info("✅ Flask застосунок створено")

    # Завантажуємо конфігурацію
    try:
        if config:
            app.config.from_object(config)
            app.secret_key = config.SECRET_KEY
            logger.info("✅ Конфігурація успішно завантажена")
        else:
            raise Exception("Config is None")
    except Exception as e:
        logger.warning(f"⚠️ Використовуємо базові налаштування: {str(e)}")
        # Базові налаштування
        app.secret_key = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')
        app.config['DEBUG'] = os.environ.get('FLASK_ENV') == 'development'

    # Налаштування бази даних
    app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'sqlite:///winix.db')
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

    # Налаштовуємо CORS
    setup_cors(app)

    # Налаштовуємо обробники запитів
    setup_request_handlers(app)

    # Додаємо health check endpoint
    add_health_check(app)

    # 🎯 РЕЄСТРУЄМО ОСНОВНІ МАРШРУТИ
    register_core_routes(app)

    # Реєструємо діагностичні маршрути
    register_utility_routes(app)

    # Реєструємо маршрути для статичних файлів
    register_static_routes(app)

    # Налаштовуємо обробники помилок
    register_error_handlers(app)

    # Додаємо обробник OPTIONS запитів для CORS preflight
    @app.route('/', defaults={'path': ''}, methods=['OPTIONS'])
    @app.route('/<path:path>', methods=['OPTIONS'])
    def handle_options(path):
        response = app.make_default_options_response()
        response.headers['Access-Control-Allow-Origin'] = '*'
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Content-Type, Authorization, X-Telegram-User-Id, Origin, Accept'
        response.headers['Access-Control-Max-Age'] = '86400'
        return response

    # Додаємо after_request обробник для JS файлів і CORS заголовків
    @app.after_request
    def add_headers(response):
        # Налаштування MIME типу для JS файлів
        if request.path.endswith('.js'):
            response.headers['Content-Type'] = 'application/javascript'

        # Налаштування заголовків CORS для всіх відповідей
        origin = request.headers.get('Origin')
        if origin:
            # Дозволяємо запити з Telegram WebApp та інших довірених джерел
            allowed_origins = [
                'https://web.telegram.org',
                'https://winixbot.com',
                'https://www.winixbot.com'
            ]

            if any(origin.startswith(allowed) for allowed in allowed_origins) or 'localhost' in origin:
                response.headers['Access-Control-Allow-Origin'] = origin
            else:
                response.headers['Access-Control-Allow-Origin'] = '*'
        else:
            response.headers['Access-Control-Allow-Origin'] = '*'

        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
        response.headers['Access-Control-Allow-Headers'] = 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Telegram-User-Id, X-Telegram-Init-Data'
        response.headers['Access-Control-Allow-Credentials'] = 'true'
        response.headers['Access-Control-Max-Age'] = '86400'

        # Налаштування заголовків безпеки
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-XSS-Protection'] = '1; mode=block'

        # CSP заголовки тільки для HTML сторінок
        if not request.path.startswith('/api/'):
            response.headers['Content-Security-Policy'] = (
                "default-src 'self' 'unsafe-inline' 'unsafe-eval' *; "
                "img-src 'self' data: https: http: *; "
                "style-src 'self' 'unsafe-inline' *; "
                "script-src 'self' 'unsafe-inline' 'unsafe-eval' *; "
                "frame-ancestors 'self' https://web.telegram.org https://telegram.org *; "
                "connect-src 'self' https: wss: *"
            )

        # Налаштування кешування
        if request.path.startswith('/api/'):
            # Для API запитів відключаємо кешування
            response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
            response.headers['Pragma'] = 'no-cache'
            response.headers['Expires'] = '0'
        else:
            # Для статичних файлів дозволяємо кешування
            response.headers['Cache-Control'] = 'public, max-age=3600'

        return response

    logger.info("🏁 Flask застосунок готовий")
    return app


# Створення та ініціалізація застосунку
logger.info("🚀 === ПОЧАТОК ІНІЦІАЛІЗАЦІЇ ЗАСТОСУНКУ ===")
app = create_app()

# Запуск застосунку
if __name__ == '__main__':
    # Додайте перевірку на None
    if app is None:
        logger.critical("❌ Додаток не ініціалізовано!")
        exit(1)

    # Визначення порту для Railway
    port = int(os.environ.get('PORT', 8080))
    host = os.environ.get('HOST', '0.0.0.0')

    # Безпечне отримання DEBUG
    debug = getattr(app.config, 'DEBUG', False) if hasattr(app, 'config') else False

    # Для Railway вимкнемо debug в продакшн
    if os.environ.get('RAILWAY_ENVIRONMENT'):
        debug = False
        logger.info("🚂 Railway environment detected, debug mode disabled")

    logger.info(f"🌟 Запуск WINIX застосунку на {host}:{port}, режим налагодження: {debug}")
    logger.info("🎯 === ОСНОВНІ ENDPOINT'И ===")
    logger.info("📋 /health - Railway health check")
    logger.info("📋 /api/health - детальний health check")
    logger.info("🔍 /api/ping - простий ping")
    logger.info("🔐 /api/auth - авторизація користувача")
    logger.info("👤 /api/user/<id> - дані користувача")
    logger.info("🔍 /debug - загальна діагностика системи")

    try:
        # Запуск сервера з обробкою помилок
        app.run(host=host, port=port, debug=debug, threaded=True)
    except Exception as e:
        logger.critical(f"💥 Критична помилка запуску сервера: {e}")
        exit(1)