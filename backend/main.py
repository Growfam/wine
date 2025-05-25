"""
Основний файл Flask застосунку для системи WINIX
Оптимізована версія з покращеною структурою, логуванням і обробкою помилок
🔥 WINIX Quests System Integration (детальна діагностика) 🔥
"""

# Стандартні бібліотеки
import os
import sys
import logging
import json
import time
import uuid
from datetime import datetime

import traceback

# Сторонні бібліотеки
from flask import Flask, render_template, request, jsonify, send_from_directory, g
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

# 🎯 WINIX Quests System Integration з детальною діагностикою
WINIX_QUESTS_AVAILABLE = False
winix = None
initialization_result = {"success_rate": 0, "message": "Not initialized"}

def diagnose_winix_import():
    """Детальна діагностика WINIX імпорту"""
    global WINIX_QUESTS_AVAILABLE, winix, initialization_result

    logger.info("🔍 === РОЗШИРЕНА ДІАГНОСТИКА WINIX QUESTS ===")

    try:
        # Крок 1: Перевірка наявності модуля
        import importlib.util
        quests_spec = importlib.util.find_spec("quests")

        if quests_spec is None:
            logger.error("❌ Модуль 'quests' не знайдено в sys.path")
            logger.info(f"📁 Поточні шляхи: {sys.path[:5]}...")  # Показуємо перші 5 шляхів
            return False

        logger.info("✅ Модуль 'quests' знайдено")

        # Крок 2: Імпорт основного winix об'єкта
        try:
            from quests import winix as winix_module
            winix = winix_module
            logger.info("✅ winix об'єкт імпортовано")
        except ImportError as e:
            logger.error(f"❌ Не вдалося імпортувати winix: {e}")
            return False

        # Крок 3: Перевірка необхідних атрибутів
        required_attrs = ['register_routes', 'health_check', 'version']
        available_attrs = []
        missing_attrs = []

        for attr in required_attrs:
            if hasattr(winix, attr):
                available_attrs.append(attr)
                logger.info(f"✅ winix.{attr} доступний")
            else:
                missing_attrs.append(attr)
                logger.warning(f"⚠️ winix.{attr} відсутній")

        # Показуємо всі доступні атрибути winix
        all_attrs = [attr for attr in dir(winix) if not attr.startswith('_')]
        logger.info(f"📊 Доступні атрибути winix: {all_attrs}")

        # Крок 4: Перевірка функцій ініціалізації
        init_functions = ['initialize_winix_quests', 'get_package_info', 'quick_test']
        for func_name in init_functions:
            try:
                func = getattr(sys.modules.get('quests', {}), func_name, None)
                if func:
                    logger.info(f"✅ {func_name} доступна")
                else:
                    logger.warning(f"⚠️ {func_name} відсутня")
            except Exception as e:
                logger.warning(f"⚠️ Помилка перевірки {func_name}: {e}")

        WINIX_QUESTS_AVAILABLE = True
        logger.info("🎉 WINIX Quests System готовий до використання!")
        return True

    except Exception as e:
        logger.error(f"💥 Критична помилка діагностики WINIX: {e}")
        logger.error(traceback.format_exc())
        return False

def initialize_winix_with_diagnosis():
    """Ініціалізація WINIX з детальною діагностикою"""
    global initialization_result

    if not WINIX_QUESTS_AVAILABLE:
        logger.warning("⚠️ WINIX недоступний, пропускаємо ініціалізацію")
        return False

    try:
        logger.info("🚀 === ІНІЦІАЛІЗАЦІЯ WINIX QUESTS SYSTEM ===")

        # Спроба ініціалізації
        try:
            from quests import initialize_winix_quests
            logger.info("📦 Функція initialize_winix_quests знайдена")

            result = initialize_winix_quests()
            logger.info(f"📊 Результат ініціалізації: {result}")

            initialization_result = result

        except ImportError as e:
            logger.error(f"❌ Не вдалося імпортувати initialize_winix_quests: {e}")
            initialization_result = {"success_rate": 0, "message": f"Import error: {e}"}

        except Exception as e:
            logger.error(f"❌ Помилка виконання initialize_winix_quests: {e}")
            logger.error(traceback.format_exc())
            initialization_result = {"success_rate": 0, "message": f"Execution error: {e}"}

        # Аналіз результату
        success_rate = initialization_result.get('success_rate', 0)

        if success_rate >= 90:
            logger.info(f"🎉 WINIX System ініціалізовано ВІДМІННО! Оцінка: {success_rate:.1f}%")
            return True
        elif success_rate >= 70:
            logger.warning(f"⚠️ WINIX System ініціалізовано з попередженнями. Оцінка: {success_rate:.1f}%")
            return True
        elif success_rate > 0:
            logger.error(f"❌ WINIX System ініціалізовано з помилками. Оцінка: {success_rate:.1f}%")
            return True  # Все ще намагаємося працювати
        else:
            logger.error("💥 WINIX System не ініціалізовано")
            return False

    except Exception as e:
        logger.error(f"💥 Критична помилка ініціалізації WINIX: {e}")
        logger.error(traceback.format_exc())
        initialization_result = {"success_rate": 0, "message": f"Critical error: {e}"}
        return False

# Викликаємо діагностику при завантаженні модуля
diagnose_winix_import()

# Перевірка валідності UUID
def is_valid_uuid(uuid_string):
    """Перевіряє, чи є рядок валідним UUID"""
    try:
        uuid_obj = uuid.UUID(str(uuid_string).strip())
        return True
    except (ValueError, AttributeError, TypeError):
        return False

def setup_winix_routes(app):
    """Налаштування WINIX маршрутів з діагностикою"""

    logger.info("🛠️ Налаштування WINIX маршрутів...")

    @app.route('/api/winix/health', methods=['GET'])
    def winix_health_check():
        """Health check для WINIX Quests System з діагностикою"""
        try:
            health_data = {
                "winix_available": WINIX_QUESTS_AVAILABLE,
                "initialization_result": initialization_result,
                "timestamp": datetime.utcnow().isoformat()
            }

            if WINIX_QUESTS_AVAILABLE and winix:
                try:
                    if hasattr(winix, 'health_check'):
                        logger.info("🔍 Викликаємо winix.health_check()")
                        health = winix.health_check()
                        health_data["winix_health"] = health
                        logger.info(f"✅ Health check результат: {health}")
                    else:
                        logger.warning("⚠️ winix.health_check() недоступний")
                        health_data["winix_health"] = {"status": "method_unavailable"}

                except Exception as e:
                    logger.error(f"❌ Помилка health_check: {e}")
                    health_data["winix_health"] = {"status": "error", "error": str(e)}
            else:
                health_data["winix_health"] = {"status": "unavailable"}

            return jsonify({
                "status": "ok",
                **health_data
            })

        except Exception as e:
            logger.error(f"💥 Критична помилка health check: {e}")
            return jsonify({
                "status": "error",
                "error": str(e),
                "winix_available": WINIX_QUESTS_AVAILABLE
            }), 500

    @app.route('/api/winix/info', methods=['GET'])
    def winix_info():
        """Інформація про WINIX Quests System"""
        try:
            info_data = {
                "winix_available": WINIX_QUESTS_AVAILABLE,
                "initialization_result": initialization_result
            }

            if WINIX_QUESTS_AVAILABLE:
                try:
                    from quests import get_package_info
                    info = get_package_info()
                    info_data.update(info)
                    logger.info(f"📦 Package info: {info}")
                except (ImportError, AttributeError) as e:
                    logger.warning(f"⚠️ get_package_info недоступна: {e}")
                    info_data.update({
                        "name": "WINIX Quests",
                        "version": getattr(winix, 'version', 'unknown'),
                        "status": "info_unavailable"
                    })
            else:
                info_data.update({
                    "name": "WINIX Quests (Unavailable)",
                    "version": "0.0.0",
                    "status": "unavailable"
                })

            return jsonify(info_data)

        except Exception as e:
            logger.error(f"💥 Помилка winix info: {e}")
            return jsonify({
                "status": "error",
                "error": str(e)
            }), 500

    @app.route('/api/winix/test', methods=['GET'])
    def winix_quick_test():
        """Швидкий тест WINIX системи"""
        try:
            test_data = {
                "winix_available": WINIX_QUESTS_AVAILABLE,
                "initialization_result": initialization_result,
                "timestamp": datetime.utcnow().isoformat()
            }

            if WINIX_QUESTS_AVAILABLE:
                try:
                    from quests import quick_test
                    logger.info("🧪 Запускаємо quick_test()")
                    test_result = quick_test()
                    test_data["test_results"] = test_result
                    logger.info(f"✅ Test результат: {test_result}")
                except (ImportError, AttributeError) as e:
                    logger.warning(f"⚠️ quick_test недоступний: {e}")
                    test_data["test_results"] = {
                        "status": "test_unavailable",
                        "message": str(e)
                    }
            else:
                test_data["test_results"] = {
                    "status": "winix_unavailable"
                }

            return jsonify({
                "status": "success",
                **test_data
            })

        except Exception as e:
            logger.error(f"💥 Помилка winix test: {e}")
            return jsonify({
                "status": "error",
                "error": str(e)
            }), 500

    @app.route('/api/winix/diagnosis', methods=['GET'])
    def winix_diagnosis():
        """Повна діагностика WINIX системи"""
        diagnosis = {
            "timestamp": datetime.utcnow().isoformat(),
            "winix_available": WINIX_QUESTS_AVAILABLE,
            "initialization_result": initialization_result,
            "winix_object": None,
            "available_methods": [],
            "services_status": {},
            "models_status": {}
        }

        if WINIX_QUESTS_AVAILABLE and winix:
            # Інформація про winix об'єкт
            diagnosis["winix_object"] = {
                "type": str(type(winix)),
                "attributes": [attr for attr in dir(winix) if not attr.startswith('_')]
            }

            # Доступні методи
            for method in ['health_check', 'register_routes', 'version']:
                diagnosis["available_methods"].append({
                    "method": method,
                    "available": hasattr(winix, method)
                })

            # Статус сервісів
            if hasattr(winix, 'services'):
                for service_name, service in winix.services.items():
                    diagnosis["services_status"][service_name] = {
                        "available": service is not None,
                        "type": str(type(service)) if service else None
                    }

            # Статус моделей
            if hasattr(winix, 'models'):
                diagnosis["models_status"] = "Available"
            else:
                diagnosis["models_status"] = "Not available"

        return jsonify(diagnosis)

    logger.info("✅ WINIX маршрути налаштовано")

def create_app(config_name=None):
    """Фабрика для створення застосунку Flask з діагностикою"""

    logger.info("🏭 === СТВОРЕННЯ FLASK ЗАСТОСУНКУ ===")

    # Завантажуємо конфігурацію на початку функції
    try:
        from settings.config import get_config
        config = get_config()
        logger.info(f"✅ Завантажена конфігурація: {type(config)}")
    except ImportError as e:
        logger.warning(f"⚠️ Не вдалося завантажити config: {e}")
        config = None

    if config is None:
        logger.warning("⚠️ Використовуємо базову конфігурацію")

    # Ініціалізація Flask з абсолютними шляхами для шаблонів та статики
    app = Flask(
        __name__,
        template_folder=os.path.join(BASE_DIR, 'frontend'),
        static_folder=os.path.join(BASE_DIR, 'frontend'),
        static_url_path=''  # Порожній шлях дозволяє доступ до файлів напряму
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

    # 🔥 ІНІЦІАЛІЗУЄМО WINIX QUESTS SYSTEM з діагностикою
    try:
        logger.info("🎯 === ПОЧАТОК ІНІЦІАЛІЗАЦІЇ WINIX ===")
        winix_initialized = initialize_winix_with_diagnosis()

        if winix_initialized:
            logger.info("🎉 WINIX Quests System ініціалізовано!")
        else:
            logger.warning("⚠️ WINIX працює в обмеженому режимі")

        # Завжди налаштовуємо маршрути (з fallback функціональністю)
        setup_winix_routes(app)

    except Exception as e:
        logger.error(f"💥 Критична помилка ініціалізації WINIX: {e}")
        logger.error(traceback.format_exc())
        # Все одно налаштовуємо fallback маршрути
        setup_winix_routes(app)

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
        response.headers['Access-Control-Allow-Headers'] = 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Telegram-User-Id'
        response.headers['Access-Control-Allow-Credentials'] = 'true'
        response.headers['Access-Control-Max-Age'] = '86400'  # 24 години кешування preflight запитів

        # Налаштування заголовків безпеки
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-XSS-Protection'] = '1; mode=block'

        # ПОВНІСТЮ ВИДАЛЯЄМО X-Frame-Options для підтримки Telegram WebApp
        # НЕ встановлюємо жодних X-Frame-Options заголовків

        # Замість X-Frame-Options використовуємо Content-Security-Policy
        response.headers['Content-Security-Policy'] = "frame-ancestors 'self' https://web.telegram.org https://telegram.org *"

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

    logger.info("🏁 Flask застосунок готовий")
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
    logger.info("✅ CORS налаштовано")


def setup_request_handlers(app):
    """Налаштування обробників запитів для логування та локалізації"""

    @app.before_request
    def log_request_info():
        # Зберігаємо час початку запиту
        g.start_time = time.time()
        logger.info(f"📨 Отримано запит: {request.method} {request.path}")

        # 🎯 WINIX Analytics Middleware (безпечна версія)
        if WINIX_QUESTS_AVAILABLE and request.path.startswith('/api/'):
            try:
                # Якщо це API запит до WINIX маршрутів
                if any(part in request.path for part in [
                    'daily', 'flex', 'tasks', 'transactions', 'verify', 'wallet', 'winix'
                ]):
                    try:
                        from supabase_client import create_analytics_event

                        # Отримуємо user_id з заголовків або шляху
                        user_id = request.headers.get('X-Telegram-User-Id')
                        if not user_id and '/user/' in request.path:
                            # Витягуємо з URL
                            parts = request.path.split('/')
                            try:
                                user_idx = parts.index('user') + 1
                                if user_idx < len(parts):
                                    user_id = parts[user_idx]
                            except (ValueError, IndexError):
                                pass

                        if user_id:
                            create_analytics_event(
                                telegram_id=user_id,
                                event_type="api_request",
                                event_data={
                                    "path": request.path,
                                    "method": request.method,
                                    "ip": request.remote_addr,
                                    "user_agent": request.headers.get('User-Agent', '')[:100]
                                }
                            )
                    except ImportError:
                        pass  # supabase_client недоступний
            except Exception as e:
                # Не блокуємо запит через помилки аналітики
                logger.debug(f"WINIX analytics error: {e}")

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
            logger.info(f"📤 Відповідь: {response.status_code} (час: {execution_time:.4f}s)")
        return response


def add_health_check(app):
    """Додає endpoint для перевірки стану API"""
    @app.route('/api/health', methods=['GET'])
    def health_check():
        """Перевірка стану API"""
        health_data = {
            "status": "ok",
            "timestamp": datetime.utcnow().isoformat(),
            "service": "WINIX API",
            "winix_available": WINIX_QUESTS_AVAILABLE,
            "initialization_result": initialization_result
        }

        # Додаємо інформацію про WINIX якщо доступний
        if WINIX_QUESTS_AVAILABLE and winix:
            try:
                if hasattr(winix, 'health_check'):
                    winix_health = winix.health_check()
                    health_data["winix"] = {
                        "available": True,
                        "components": {
                            name: status.get('loaded', False) if isinstance(status, dict) else status
                            for name, status in winix_health.get('components', {}).items()
                        }
                    }
                else:
                    health_data["winix"] = {"available": True, "status": "basic"}
            except Exception as e:
                health_data["winix"] = {
                    "available": False,
                    "error": str(e)
                }
        else:
            health_data["winix"] = {"available": False}

        return jsonify(health_data)


def register_api_routes(app):
    """Реєстрація всіх API маршрутів з детальним логуванням"""
    # Функція для логування результату реєстрації маршрутів
    def log_registration_result(name, success, error=None):
        if success:
            logger.info(f"✅ Маршрути {name} успішно зареєстровано")
        else:
            logger.error(f"❌ Помилка реєстрації маршрутів {name}: {error}")
            if error:
                logger.error(traceback.format_exc())

    logger.info("🛣️ === РЕЄСТРАЦІЯ API МАРШРУТІВ ===")

    # 🔥 СПРОБА реєстрації WINIX Quests маршрутів!
    if WINIX_QUESTS_AVAILABLE and winix:
        try:
            logger.info("🎯 Намагаємося зареєструвати WINIX маршрути...")

            if hasattr(winix, 'register_routes'):
                logger.info("📦 winix.register_routes знайдено")
                success = winix.register_routes(app)
                logger.info(f"📊 Результат реєстрації: {success}")
                log_registration_result("WINIX Quests", success)

                if success:
                    logger.info("🎯 WINIX Quests маршрути активні!")
                    # Логуємо кількість зареєстрованих маршрутів
                    winix_routes_count = 0
                    for rule in app.url_map.iter_rules():
                        if any(path in rule.rule for path in [
                            '/api/auth/', '/api/user/', '/api/daily/',
                            '/api/analytics/', '/api/flex/', '/api/tasks/',
                            '/api/transactions/', '/api/verify/', '/api/wallet/'
                        ]):
                            winix_routes_count += 1
                    logger.info(f"📊 WINIX Quests: {winix_routes_count} маршрутів зареєстровано")
                else:
                    logger.error("❌ winix.register_routes повернув False")
            else:
                logger.warning("⚠️ winix.register_routes не знайдено")
                log_registration_result("WINIX Quests", False, "register_routes method not found")
        except Exception as e:
            logger.error(f"💥 Помилка реєстрації WINIX маршрутів: {e}")
            logger.error(traceback.format_exc())
            log_registration_result("WINIX Quests", False, str(e))
    else:
        logger.warning("⚠️ WINIX Quests недоступний, використовуємо старі маршрути")
        # Fallback до старих quests маршрутів
        try:
            from quests.routes import register_quests_routes
            register_quests_routes(app)
            log_registration_result("завдань (legacy)", True)
        except Exception as e:
            log_registration_result("завдань (legacy)", False, str(e))

    # Решта маршрутів...
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

    # Реєстрація маршрутів рефералів
    try:
        from referrals.routes import referrals_bp
        app.register_blueprint(referrals_bp, url_prefix='/api/referrals')
        log_registration_result("рефералів", True)
    except Exception as e:
        log_registration_result("рефералів", False, str(e))

    # Реєстрація маршрутів бейджів та завдань
    try:
        from badges.routes import badges_bp
        app.register_blueprint(badges_bp, url_prefix='/api')
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

    logger.info("✅ Реєстрація API маршрутів завершена")

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
        from supabase_client import test_supabase_connection, supabase, test_winix_integration
    except ImportError:
        test_supabase_connection = lambda: {"status": "error", "message": "Функція недоступна"}
        test_winix_integration = lambda: {"status": "error", "message": "Функція недоступна"}
        supabase = None

    @app.route('/api/ping')
    def ping():
        """Найпростіший маршрут для перевірки стану додатка"""
        return "pong"

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

        # 🎯 Додаємо перевірку WINIX
        winix_test = {}
        if WINIX_QUESTS_AVAILABLE:
            try:
                winix_test = test_winix_integration()
            except:
                winix_test = {"status": "error", "message": "WINIX тест недоступний"}
        else:
            winix_test = {"status": "unavailable", "message": "WINIX не завантажено"}

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
            "winix_available": WINIX_QUESTS_AVAILABLE,
            "initialization_result": initialization_result,
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
                "winix_test": winix_test
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


# Решта функцій залишається без змін
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
logger.info("🚀 === ПОЧАТОК ІНІЦІАЛІЗАЦІЇ ЗАСТОСУНКУ ===")
app = create_app()

# 🎯 Фінальна перевірка WINIX після створення app
if WINIX_QUESTS_AVAILABLE and winix:
    try:
        logger.info("🔍 === ФІНАЛЬНА ПЕРЕВІРКА WINIX ===")

        # Фінальна перевірка стану системи
        if hasattr(winix, 'health_check'):
            health = winix.health_check()
            components = health.get('components', {})
            components_active = sum(1 for status in components.values() if
                                  (status.get('loaded', False) if isinstance(status, dict) else status))
            total_components = len(components)
            logger.info(f"🔍 Фінальна перевірка WINIX: компонентів активно {components_active}/{total_components}")

            if total_components > 0:
                if components_active == total_components:
                    logger.info("🎉 ВСІ WINIX КОМПОНЕНТИ АКТИВНІ!")
                elif components_active >= total_components * 0.8:
                    logger.warning(f"⚠️ Більшість WINIX компонентів активні ({components_active}/{total_components})")
                else:
                    logger.error(f"❌ Багато WINIX компонентів неактивні ({components_active}/{total_components})")
            else:
                logger.warning("⚠️ Немає інформації про компоненти WINIX")
        else:
            logger.info("🎯 WINIX доступний, але health_check метод відсутній")

        # Додаткова перевірка services
        if hasattr(winix, 'services'):
            services_count = len([s for s in winix.services.values() if s is not None])
            total_services = len(winix.services)
            logger.info(f"🔧 WINIX сервіси: {services_count}/{total_services} активних")

    except Exception as e:
        logger.error(f"💥 Помилка фінальної перевірки WINIX: {e}")
        logger.error(traceback.format_exc())

# Запускаємо сервіс розіграшів, якщо налаштовано
init_raffle_service()

# Запуск застосунку
if __name__ == '__main__':
    # Додайте перевірку на None
    if app is None:
        logger.critical("❌ Додаток не ініціалізовано!")
        exit(1)

    # Остання перевірка WINIX перед запуском
    if WINIX_QUESTS_AVAILABLE:
        logger.info("🚀 WINIX Quests System готовий до роботи!")
        logger.info(f"📊 Ініціалізація result: {initialization_result}")
    else:
        logger.warning("⚠️ Запуск без WINIX Quests System")

    # Визначення порту
    port = int(os.environ.get('PORT', 8080))

    # Безпечне отримання DEBUG
    debug = getattr(app.config, 'DEBUG', True) if hasattr(app, 'config') else True

    logger.info(f"🌟 Запуск WINIX застосунку на порту {port}, режим налагодження: {debug}")
    logger.info("🎯 === ДОДАТКОВІ ДІАГНОСТИЧНІ ENDPOINT'И ===")
    logger.info("📋 /api/winix/diagnosis - повна діагностика WINIX")
    logger.info("🔍 /api/winix/health - статус здоров'я WINIX")
    logger.info("📊 /api/winix/info - інформація про WINIX")
    logger.info("🧪 /api/winix/test - швидкий тест WINIX")

    # Запуск сервера
    app.run(host='0.0.0.0', port=port, debug=debug)