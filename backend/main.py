"""
Основний файл Flask застосунку для системи WINIX
Виправлена версія з підтримкою async/await та правильною ініціалізацією
🔥 WINIX Quests System Integration (відкладена ініціалізація) 🔥
"""

# Стандартні бібліотеки
import os
import sys
import logging
import json
import time
import uuid
import asyncio
from datetime import datetime, timezone

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

# 🎯 WINIX Quests System Integration з відкладеною ініціалізацією
WINIX_QUESTS_AVAILABLE = False
QUESTS_DIAGNOSTICS_AVAILABLE = False
winix = None
initialization_result = {"success_rate": 0, "message": "Not initialized"}
_winix_initialization_attempted = False

# Імпорт діагностичних функцій
try:
    from quests.routes import register_quests_routes, diagnose_quests_routes
    QUESTS_DIAGNOSTICS_AVAILABLE = True
    logger.info("✅ Діагностичні функції quests маршрутів завантажено")
except ImportError as e:
    logger.warning(f"⚠️ Діагностичні функції недоступні: {e}")
    register_quests_routes = None
    diagnose_quests_routes = None
    QUESTS_DIAGNOSTICS_AVAILABLE = False

def safe_diagnose_winix_import():
    """Безпечна діагностика WINIX імпорту без асинхронних операцій"""
    global WINIX_QUESTS_AVAILABLE, winix, initialization_result

    logger.info("🔍 === БЕЗПЕЧНА ДІАГНОСТИКА WINIX QUESTS ===")

    try:
        # Крок 1: Перевірка наявності модуля
        import importlib.util
        quests_spec = importlib.util.find_spec("quests")

        if quests_spec is None:
            logger.warning("❌ Модуль 'quests' не знайдено в sys.path")
            logger.info(f"📁 Поточні шляхи: {sys.path[:3]}...")
            return False

        logger.info("✅ Модуль 'quests' знайдено")

        # Крок 2: Базовий імпорт без ініціалізації
        try:
            # Імпортуємо тільки базовий модуль, без виконання async операцій
            import quests
            logger.info("✅ Базовий імпорт quests модуля успішний")

            # Перевіряємо наявність основних компонентів
            if hasattr(quests, '__version__'):
                logger.info(f"📦 Версія quests: {quests.__version__}")

            WINIX_QUESTS_AVAILABLE = True
            initialization_result = {"success_rate": 50, "message": "Basic import successful, full init pending"}
            return True

        except Exception as e:
            logger.error(f"❌ Помилка базового імпорту quests: {e}")
            logger.error(traceback.format_exc())
            return False

    except Exception as e:
        logger.error(f"💥 Критична помилка діагностики WINIX: {e}")
        logger.error(traceback.format_exc())
        return False

def lazy_initialize_winix():
    """Відкладена ініціалізація WINIX з обробкою event loop"""
    global winix, initialization_result, _winix_initialization_attempted

    if _winix_initialization_attempted:
        return WINIX_QUESTS_AVAILABLE

    _winix_initialization_attempted = True

    if not WINIX_QUESTS_AVAILABLE:
        logger.warning("⚠️ WINIX модуль недоступний для ініціалізації")
        return False

    try:
        logger.info("🚀 === ВІДКЛАДЕНА ІНІЦІАЛІЗАЦІЯ WINIX QUESTS SYSTEM ===")

        # Імпортуємо основні компоненти
        try:
            from quests import winix as winix_module
            winix = winix_module
            logger.info("✅ winix об'єкт завантажено")
        except ImportError as e:
            logger.error(f"❌ Не вдалося імпортувати winix об'єкт: {e}")
            return False

        # Перевіряємо доступні методи
        available_methods = []
        for method in ['register_routes', 'health_check', 'version']:
            if hasattr(winix, method):
                available_methods.append(method)
                logger.info(f"✅ winix.{method} доступний")

        # Оновлюємо результат ініціалізації
        success_rate = min(100, len(available_methods) * 30 + 10)  # Базово 10% + по 30% за метод
        initialization_result = {
            "success_rate": success_rate,
            "message": f"Lazy initialization completed with {len(available_methods)} methods",
            "available_methods": available_methods,
            "timestamp": datetime.now(timezone.utc).isoformat()
        }

        logger.info(f"🎉 WINIX System ініціалізовано! Оцінка: {success_rate}%")
        return True

    except Exception as e:
        logger.error(f"💥 Помилка відкладеної ініціалізації WINIX: {e}")
        logger.error(traceback.format_exc())
        initialization_result = {
            "success_rate": 0,
            "message": f"Lazy initialization error: {e}",
            "timestamp": datetime.now(timezone.utc).isoformat()
        }
        return False

def safe_register_quests_routes(app):
    """Безпечна реєстрація quests маршрутів з покращеною діагностикою"""
    logger.info("🎯 === БЕЗПЕЧНА РЕЄСТРАЦІЯ QUESTS МАРШРУТІВ ===")

    if not WINIX_QUESTS_AVAILABLE:
        logger.warning("⚠️ WINIX недоступний, пропускаємо реєстрацію quests маршрутів")
        return False

    # Ініціалізуємо WINIX якщо ще не зробили
    lazy_initialize_winix()

    # Спочатку пробуємо через winix.register_routes
    if winix and hasattr(winix, 'register_routes'):
        try:
            logger.info("🔄 Спроба winix.register_routes...")
            result = winix.register_routes(app)
            if result:
                logger.info("✅ winix.register_routes успішно!")

                # Додаємо діагностику після успішної реєстрації
                if QUESTS_DIAGNOSTICS_AVAILABLE and diagnose_quests_routes:
                    try:
                        diagnosis = diagnose_quests_routes(app)
                        logger.info(f"📊 Діагностика: {diagnosis['quests_routes']} маршрутів системи завдань")

                        if diagnosis.get('recommendations'):
                            logger.warning("⚠️ Рекомендації діагностики:")
                            for rec in diagnosis['recommendations']:
                                logger.warning(f"   • {rec}")
                    except Exception as diag_e:
                        logger.warning(f"⚠️ Помилка діагностики: {diag_e}")

                return True
            else:
                logger.warning("⚠️ winix.register_routes повернув False")
        except Exception as e:
            logger.error(f"❌ winix.register_routes помилка: {e}")

            # Детальна діагностика помилки
            error_msg = str(e).lower()
            if "already registered" in error_msg:
                logger.error("🔴 ВИЯВЛЕНО КОНФЛІКТ BLUEPRINT!")
                if "auth" in error_msg:
                    logger.error("💡 Рішення: змініть назву Blueprint в auth_routes.py на 'quests_auth'")
                logger.error(f"📋 Повний текст помилки: {e}")

    # Fallback через пряму реєстрацію
    if register_quests_routes:
        try:
            logger.info("🔄 Спроба register_quests_routes...")
            result = register_quests_routes(app)

            if result:
                logger.info("✅ register_quests_routes успішно!")

                # Діагностика після fallback реєстрації
                if QUESTS_DIAGNOSTICS_AVAILABLE and diagnose_quests_routes:
                    try:
                        diagnosis = diagnose_quests_routes(app)
                        logger.info(f"📊 Fallback діагностика: {diagnosis['quests_routes']} маршрутів")

                        if diagnosis.get('duplicate_endpoints'):
                            logger.warning(f"⚠️ Знайдено {len(diagnosis['duplicate_endpoints'])} дублікатів endpoint'ів")

                        if diagnosis.get('blueprint_conflicts'):
                            logger.error(f"🔴 Конфлікти Blueprint'ів: {diagnosis['blueprint_conflicts']}")
                    except Exception as diag_e:
                        logger.warning(f"⚠️ Помилка fallback діагностики: {diag_e}")

                return True
            else:
                logger.error("❌ register_quests_routes повернув False")
        except Exception as e:
            logger.error(f"❌ register_quests_routes помилка: {e}")
            logger.error(f"📋 Тип помилки: {type(e).__name__}")

    # Останній fallback - ручна реєстрація
    logger.info("🔄 Спроба ручної реєстрації Blueprint'ів...")
    return register_quests_blueprints_manually(app)

def register_quests_routes_fallback(app):
    """Fallback реєстрація через quests.routes"""
    try:
        if register_quests_routes:
            return register_quests_routes(app)
        else:
            logger.warning("⚠️ register_quests_routes функція недоступна")
            return False
    except Exception as e:
        logger.error(f"Fallback register_quests_routes помилка: {e}")
        return False

def register_quests_blueprints_manually(app):
    """Ручна реєстрація всіх Blueprint'ів з quests системи з обробкою помилок"""
    logger.info("🔧 === РУЧНА РЕЄСТРАЦІЯ QUESTS BLUEPRINT'ІВ ===")

    registered_count = 0

    # Список Blueprint'ів для реєстрації
    blueprints_to_register = [
        ('quests.routes.user_routes', 'user_bp', '/api/user'),
        ('quests.routes.daily_routes', 'daily_bp', '/api/daily'),
        ('quests.routes.analytics_routes', 'analytics_bp', '/api/analytics'),
        ('quests.routes.flex_routes', 'flex_bp', '/api/flex'),
        ('quests.routes.tasks_routes', 'tasks_bp', '/api/tasks'),
        ('quests.routes.transaction_routes', 'transaction_bp', '/api/transactions'),
        ('quests.routes.verification_routes', 'verification_bp', '/api/verify'),
        ('quests.routes.wallet_routes', 'wallet_bp', '/api/wallet')
    ]

    for module_name, blueprint_name, url_prefix in blueprints_to_register:
        try:
            logger.info(f"🔄 Реєструємо {module_name}.{blueprint_name}...")

            # Імпортуємо модуль
            module = __import__(module_name, fromlist=[blueprint_name])

            # Отримуємо Blueprint
            blueprint = getattr(module, blueprint_name)

            # Реєструємо з префіксом
            app.register_blueprint(blueprint, url_prefix=url_prefix)

            logger.info(f"✅ {blueprint_name} зареєстровано з префіксом {url_prefix}")
            registered_count += 1

        except Exception as e:
            logger.error(f"❌ Помилка реєстрації {module_name}.{blueprint_name}: {e}")
            if "already registered" in str(e).lower():
                logger.error(f"🔴 Blueprint конфлікт: {blueprint_name}")

    logger.info(f"📊 Ручна реєстрація завершена: {registered_count} Blueprint'ів")
    return registered_count > 0

# Викликаємо тільки безпечну діагностику при завантаженні модуля
safe_diagnose_winix_import()

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
            # Ініціалізуємо WINIX при першому запиті якщо ще не зробили
            if WINIX_QUESTS_AVAILABLE:
                lazy_initialize_winix()

            health_data = {
                "winix_available": WINIX_QUESTS_AVAILABLE,
                "initialization_result": initialization_result,
                "timestamp": datetime.now(timezone.utc).isoformat()
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
            # Ініціалізуємо WINIX при першому запиті якщо ще не зробили
            if WINIX_QUESTS_AVAILABLE:
                lazy_initialize_winix()

            info_data = {
                "winix_available": WINIX_QUESTS_AVAILABLE,
                "initialization_result": initialization_result
            }

            if WINIX_QUESTS_AVAILABLE:
                try:
                    import quests
                    if hasattr(quests, 'get_package_info'):
                        info = quests.get_package_info()
                        info_data.update(info)
                        logger.info(f"📦 Package info: {info}")
                    else:
                        info_data.update({
                            "name": "WINIX Quests",
                            "version": getattr(quests, '__version__', 'unknown'),
                            "status": "info_basic"
                        })
                except Exception as e:
                    logger.warning(f"⚠️ get_package_info помилка: {e}")
                    info_data.update({
                        "name": "WINIX Quests",
                        "version": "unknown",
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
            # Ініціалізуємо WINIX при першому запиті якщо ще не зробили
            if WINIX_QUESTS_AVAILABLE:
                lazy_initialize_winix()

            test_data = {
                "winix_available": WINIX_QUESTS_AVAILABLE,
                "initialization_result": initialization_result,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }

            if WINIX_QUESTS_AVAILABLE:
                try:
                    import quests
                    if hasattr(quests, 'quick_test'):
                        logger.info("🧪 Запускаємо quick_test()")
                        test_result = quests.quick_test()
                        test_data["test_results"] = test_result
                        logger.info(f"✅ Test результат: {test_result}")
                    else:
                        test_data["test_results"] = {
                            "status": "test_method_unavailable",
                            "message": "quick_test method not found"
                        }
                except Exception as e:
                    logger.warning(f"⚠️ quick_test помилка: {e}")
                    test_data["test_results"] = {
                        "status": "test_error",
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
        # Ініціалізуємо WINIX при першому запиті якщо ще не зробили
        if WINIX_QUESTS_AVAILABLE:
            lazy_initialize_winix()

        diagnosis = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
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
                try:
                    for service_name, service in winix.services.items():
                        diagnosis["services_status"][service_name] = {
                            "available": service is not None,
                            "type": str(type(service)) if service else None
                        }
                except Exception as e:
                    diagnosis["services_status"] = {"error": str(e)}

            # Статус моделей
            if hasattr(winix, 'models'):
                diagnosis["models_status"] = "Available"
            else:
                diagnosis["models_status"] = "Not available"

        return jsonify(diagnosis)

    @app.route('/api/winix/routes-diagnosis', methods=['GET'])
    def winix_routes_diagnosis():
        """Детальна діагностика маршрутів системи завдань"""
        try:
            if not QUESTS_DIAGNOSTICS_AVAILABLE:
                return jsonify({
                    "status": "error",
                    "message": "Діагностика маршрутів недоступна",
                    "quests_available": WINIX_QUESTS_AVAILABLE,
                    "diagnostics_available": QUESTS_DIAGNOSTICS_AVAILABLE
                }), 503

            # Виконуємо діагностику
            diagnosis = diagnose_quests_routes(app)

            # Додаємо додаткову інформацію
            diagnosis.update({
                "winix_available": WINIX_QUESTS_AVAILABLE,
                "diagnostics_available": QUESTS_DIAGNOSTICS_AVAILABLE,
                "initialization_result": initialization_result,
                "timestamp": datetime.now(timezone.utc).isoformat()
            })

            return jsonify({
                "status": "success",
                "diagnosis": diagnosis
            }), 200

        except Exception as e:
            logger.error(f"💥 Помилка діагностики маршрутів: {e}")
            return jsonify({
                "status": "error",
                "message": str(e),
                "error_type": type(e).__name__,
                "diagnostics_available": QUESTS_DIAGNOSTICS_AVAILABLE
            }), 500

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

    # 🔥 ЗАВЖДИ налаштовуємо WINIX маршрути (незалежно від доступності)
    setup_winix_routes(app)

    # 🎯 РЕЄСТРУЄМО МАРШРУТИ API (ВИПРАВЛЕНА ЛОГІКА)
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


        # Визначаємо дозволені origins
        origin = request.headers.get('Origin')

        # Список дозволених доменів
        allowed_origins = [
            'https://winixbot.com',
            'https://web.telegram.org',
            'http://localhost:8080',
            'http://localhost:3000',
            'http://127.0.0.1:8080'
        ]

        # Перевіряємо origin
        if origin in allowed_origins:
            response.headers['Access-Control-Allow-Origin'] = origin
        else:
            # Для розробки можна дозволити всі origins, але БЕЗ credentials
            response.headers['Access-Control-Allow-Origin'] = '*'
            # Видаляємо credentials для wildcard origin
            response.headers.pop('Access-Control-Allow-Credentials', None)

        # CORS заголовки
        response.headers['Access-Control-Allow-Methods'] = 'GET, POST, PUT, DELETE, OPTIONS'
        response.headers[
            'Access-Control-Allow-Headers'] = 'Origin, X-Requested-With, Content-Type, Accept, Authorization, X-Telegram-User-Id'

        # Credentials тільки для конкретних origins
        if origin in allowed_origins:
            response.headers['Access-Control-Allow-Credentials'] = 'true'

        response.headers['Access-Control-Max-Age'] = '86400'

        # Налаштування MIME типу для JS файлів
        if request.path.endswith('.js'):
            response.headers['Content-Type'] = 'application/javascript'

        # Налаштування заголовків безпеки
        response.headers['X-Content-Type-Options'] = 'nosniff'
        response.headers['X-XSS-Protection'] = '1; mode=block'

        # Content-Security-Policy для Telegram
        response.headers[
            'Content-Security-Policy'] = "frame-ancestors 'self' https://web.telegram.org https://telegram.org *"

        # Налаштування кешування
        if request.path.startswith('/api/'):
            response.headers['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
            response.headers['Pragma'] = 'no-cache'
            response.headers['Expires'] = '0'
        else:
            response.headers['Cache-Control'] = 'public, max-age=3600'

        return response

    logger.info("🏁 Flask app створено і готово до повернення")
    return app

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
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "service": "WINIX API",
            "winix_available": WINIX_QUESTS_AVAILABLE,
            "initialization_result": initialization_result
        }

        # Додаємо інформацію про WINIX якщо доступний
        if WINIX_QUESTS_AVAILABLE:
            # Спробуємо відкладену ініціалізацію
            lazy_initialize_winix()

            if winix:
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
                health_data["winix"] = {"available": False, "status": "not_initialized"}
        else:
            health_data["winix"] = {"available": False}

        return jsonify(health_data)

    # Простий health check окремо
    @app.route('/health', methods=['GET'])
    def simple_health():
        return 'OK', 200


def register_api_routes(app):
    """Реєстрація всіх API маршрутів з покращеною логікою"""

    logger.info("🛣️ === РЕЄСТРАЦІЯ API МАРШРУТІВ (БЕЗПЕЧНА ВЕРСІЯ) ===")

    def log_registration_result(name, success, error=None):
        if success:
            logger.info(f"✅ Маршрути {name} успішно зареєстровано")
        else:
            logger.error(f"❌ Помилка реєстрації маршрутів {name}: {error}")

    # Збираємо всі успішні реєстрації
    registered_successfully = []
    registration_errors = []

    # 🔥 1. ПРІОРИТЕТ: WINIX/QUESTS МАРШРУТИ (безпечно)
    try:
        logger.info("🎯 === ПОЧАТОК РЕЄСТРАЦІЇ WINIX/QUESTS МАРШРУТІВ ===")

        if safe_register_quests_routes(app):
            registered_successfully.append("WINIX/Quests System")
        else:
            registration_errors.append("WINIX/Quests: Safe registration failed")

    except Exception as e:
        logger.error(f"❌ Критична помилка реєстрації WINIX: {e}")
        registration_errors.append(f"WINIX/Quests: Critical error: {e}")

    # 🔥 2. ОСНОВНІ СИСТЕМНІ МАРШРУТИ (з оригінального коду)

    # Реєстрація маршрутів розіграшів
    try:
        from raffles.routes import register_raffles_routes
        if register_raffles_routes(app):
            registered_successfully.append("Raffles")
        else:
            registration_errors.append("Raffles: returned False")
    except Exception as e:
        registration_errors.append(f"Raffles: {e}")

    # Реєстрація маршрутів авторизації (оригінальних)
    try:
        from auth.routes import register_auth_routes
        register_auth_routes(app)
        registered_successfully.append("Auth (original)")
    except Exception as e:
        registration_errors.append(f"Auth (original): {e}")

    # Реєстрація маршрутів користувачів (оригінальних)
    try:
        from users.routes import register_user_routes
        register_user_routes(app)
        registered_successfully.append("Users (original)")
    except Exception as e:
        registration_errors.append(f"Users (original): {e}")

    # Реєстрація маршрутів гаманця (оригінальних)
    try:
        from wallet.routes import register_wallet_routes
        register_wallet_routes(app)
        registered_successfully.append("Wallet (original)")
    except Exception as e:
        registration_errors.append(f"Wallet (original): {e}")

    # Реєстрація маршрутів транзакцій
    try:
        from transactions.routes import register_transactions_routes
        register_transactions_routes(app)
        registered_successfully.append("Transactions")
    except Exception as e:
        registration_errors.append(f"Transactions: {e}")

    # Реєстрація маршрутів рефералів
    try:
        from referrals.routes import referrals_bp
        app.register_blueprint(referrals_bp, url_prefix='/api/referrals')
        registered_successfully.append("Referrals")
    except Exception as e:
        registration_errors.append(f"Referrals: {e}")

    # Реєстрація маршрутів бейджів та завдань
    try:
        from badges.routes import badges_bp
        app.register_blueprint(badges_bp, url_prefix='/api')
        registered_successfully.append("Badges")
    except Exception as e:
        registration_errors.append(f"Badges: {e}")

    # Реєстрація маршрутів адміністратора
    try:
        from admin.routes import register_admin_routes
        register_admin_routes(app)
        registered_successfully.append("Admin")
    except Exception as e:
        registration_errors.append(f"Admin: {e}")

    # Реєстрація маршрутів статистики
    try:
        from stats.routes import register_stats_routes
        register_stats_routes(app)
        registered_successfully.append("Stats")
    except Exception as e:
        registration_errors.append(f"Stats: {e}")

    # Реєстрація маршрутів Telegram webhook
    try:
        from telegram_webhook import register_telegram_routes
        register_telegram_routes(app)
        registered_successfully.append("Telegram Webhook")
    except Exception as e:
        registration_errors.append(f"Telegram Webhook: {e}")

    # Реєстрація маршрутів Telegram API
    try:
        from telegram_api import register_telegram_api_routes
        register_telegram_api_routes(app)
        registered_successfully.append("Telegram API")
    except Exception as e:
        registration_errors.append(f"Telegram API: {e}")

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
    logger.info(f"   🎯 Системи зареєстровано: {len(registered_successfully)}/{len(registered_successfully) + len(registration_errors)}")

    # Критична перевірка
    if api_routes == 0:
        logger.error("💥 КРИТИЧНА ПОМИЛКА: НІ ОДНОГО API МАРШРУТУ НЕ ЗАРЕЄСТРОВАНО!")
        return False

    if len(registered_successfully) == 0:
        logger.error("💥 КРИТИЧНА ПОМИЛКА: НІ ОДНОЇ СИСТЕМИ НЕ ЗАРЕЄСТРОВАНО!")
        return False

    logger.info("🎉 Реєстрація API маршрутів завершена успішно!")
    return True


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
            "diagnostics_available": QUESTS_DIAGNOSTICS_AVAILABLE,
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
            "timestamp": datetime.now(timezone.utc).isoformat()
        })

    # 🔍 ДІАГНОСТИЧНИЙ ENDPOINT ДЛЯ ПЕРЕВІРКИ МАРШРУТІВ
    @app.route('/debug/routes', methods=['GET'])
    def debug_routes():
        """Діагностичний endpoint для перевірки всіх маршрутів"""
        routes = []
        for rule in app.url_map.iter_rules():
            routes.append({
                'endpoint': rule.endpoint,
                'methods': list(rule.methods - {'HEAD', 'OPTIONS'}),
                'rule': str(rule)
            })

        api_routes = [r for r in routes if r['rule'].startswith('/api/')]
        critical_routes = [r for r in api_routes if any(keyword in r['rule'] for keyword in [
            'auth/validate-telegram', 'user/profile', 'daily/status', 'flex/', 'tasks/'
        ])]

        return jsonify({
            "total_routes": len(routes),
            "api_routes_count": len(api_routes),
            "critical_routes_count": len(critical_routes),
            "critical_routes": critical_routes[:10],  # Показуємо перші 10
            "all_api_routes": api_routes,
            "sample_routes": routes[:20]  # Загальна вибірка
        })

    @app.route('/debug/quests-routes')
    def debug_quests_routes():
        """Діагностичний ендпоінт для перевірки quests маршрутів"""
        try:
            routes_analysis = {
                "winix_available": WINIX_QUESTS_AVAILABLE,
                "diagnostics_available": QUESTS_DIAGNOSTICS_AVAILABLE,
                "total_routes": len(list(app.url_map.iter_rules())),
                "quests_routes": 0,
                "routes_by_prefix": {},
                "blueprint_conflicts": [],
                "critical_endpoints": {}
            }

            # Аналізуємо маршрути
            quests_prefixes = ['/api/auth/', '/api/user/', '/api/daily/', '/api/analytics/',
                              '/api/flex/', '/api/tasks/', '/api/transactions/', '/api/verify/', '/api/wallet/']

            for rule in app.url_map.iter_rules():
                rule_str = str(rule.rule)

                for prefix in quests_prefixes:
                    if prefix in rule_str:
                        routes_analysis["quests_routes"] += 1
                        prefix_name = prefix.replace('/api/', '').replace('/', '')

                        if prefix_name not in routes_analysis["routes_by_prefix"]:
                            routes_analysis["routes_by_prefix"][prefix_name] = 0
                        routes_analysis["routes_by_prefix"][prefix_name] += 1
                        break

            # Перевіряємо критичні endpoint'и
            critical_checks = {
                "auth_validate": any('/api/auth/validate-telegram' in str(rule.rule) for rule in app.url_map.iter_rules()),
                "user_profile": any('/api/user/profile/' in str(rule.rule) for rule in app.url_map.iter_rules()),
                "daily_status": any('/api/daily/status/' in str(rule.rule) for rule in app.url_map.iter_rules()),
                "winix_health": any('/api/winix/health' in str(rule.rule) for rule in app.url_map.iter_rules())
            }
            routes_analysis["critical_endpoints"] = critical_checks

            # Якщо діагностика доступна, додаємо детальну інформацію
            if QUESTS_DIAGNOSTICS_AVAILABLE and diagnose_quests_routes:
                detailed_diagnosis = diagnose_quests_routes(app)
                routes_analysis["detailed_diagnosis"] = detailed_diagnosis

            return jsonify(routes_analysis)

        except Exception as e:
            logger.error(f"Помилка debug quests routes: {str(e)}")
            return jsonify({
                "error": str(e),
                "winix_available": WINIX_QUESTS_AVAILABLE,
                "diagnostics_available": QUESTS_DIAGNOSTICS_AVAILABLE
            }), 500


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

    @app.route('/api/auth/refresh-token', methods=['POST', 'OPTIONS'])
    def refresh_token_fallback():
        """Фолбек обробник для refresh token"""
        if request.method == 'OPTIONS':
            return '', 200

        try:
            # Спробуємо використати quests auth якщо доступний
            from quests.routes.auth_routes import refresh_token as quests_refresh
            return quests_refresh()
        except ImportError:
            # Якщо quests недоступний, використовуємо базову логіку
            try:
                from auth.controllers import refresh_user_token
                return refresh_user_token()
            except ImportError:
                logger.error("❌ Жоден обробник refresh token не знайдено")
                return jsonify({
                    'status': 'error',
                    'message': 'Refresh token endpoint not configured'
                }), 501

    @app.route('/telegram/webhook', methods=['POST', 'GET'])
    def telegram_webhook_fallback():
        """Фолбек обробник для Telegram webhook"""
        if request.method == 'POST':
            try:
                # Перенаправляємо на правильний маршрут якщо він існує
                from telegram_webhook import telegram_webhook as webhook_handler
                return webhook_handler()
            except ImportError:
                logger.warning("⚠️ Telegram webhook handler не знайдено")
                return jsonify({'ok': False, 'error': 'Webhook handler not found'}), 404
        else:
            # GET запит - повертаємо інформацію про webhook
            return jsonify({
                'status': 'webhook endpoint',
                'method': 'POST required',
                'info': 'Send Telegram updates here'
            })

    @app.route('/api/auth/refresh-token', methods=['POST', 'OPTIONS'])
    def refresh_token_fallback():
        """Фолбек обробник для refresh token"""
        if request.method == 'OPTIONS':
            return '', 200

        try:
            # Спробуємо використати quests auth якщо доступний
            from quests.routes.auth_routes import refresh_token as quests_refresh
            return quests_refresh()
        except ImportError:
            # Якщо quests недоступний, використовуємо базову логіку
            try:
                from auth.controllers import refresh_user_token
                return refresh_user_token()
            except ImportError:
                logger.error("❌ Жоден обробник refresh token не знайдено")
                return jsonify({
                    'status': 'error',
                    'message': 'Refresh token endpoint not configured'
                }), 501

    @app.route('/telegram/webhook', methods=['POST', 'GET'])
    def telegram_webhook_fallback():
        """Фолбек обробник для Telegram webhook"""
        if request.method == 'POST':
            try:
                # Перенаправляємо на правильний маршрут якщо він існує
                from telegram_webhook import telegram_webhook as webhook_handler
                return webhook_handler()
            except ImportError:
                logger.warning("⚠️ Telegram webhook handler не знайдено")
                return jsonify({'ok': False, 'error': 'Webhook handler not found'}), 404
        else:
            # GET запит - повертаємо інформацію про webhook
            return jsonify({
                'status': 'webhook endpoint',
                'method': 'POST required',
                'info': 'Send Telegram updates here'
            })


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
        logger.info("🚀 WINIX Quests System доступний для відкладеної ініціалізації!")
        logger.info(f"📊 Поточний стан: {initialization_result}")
    else:
        logger.warning("⚠️ Запуск без WINIX Quests System - буде використана базова функціональність")

    # Визначення порту
    port = int(os.environ.get('PORT', 8080))

    # Безпечне отримання DEBUG
    debug = False


    logger.info(f"🌟 Запуск WINIX застосунку на порту {port}, режим налагодження: {debug}")
    logger.info("🎯 === ДІАГНОСТИЧНІ ENDPOINT'И ===")
    logger.info("📋 /api/winix/diagnosis - повна діагностика WINIX")
    logger.info("🔍 /api/winix/health - статус здоров'я WINIX")
    logger.info("📊 /api/winix/info - інформація про WINIX")
    logger.info("🧪 /api/winix/test - швидкий тест WINIX")
    logger.info("🧪 /api/winix/routes-diagnosis - діагностика quests маршрутів")
    logger.info("🔍 /debug/routes - перевірка всіх маршрутів")
    logger.info("🔍 /debug/quests-routes - аналіз quests маршрутів")

    # Запуск сервера
    app.run(host='0.0.0.0', port=port, debug=debug)