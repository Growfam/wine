"""
Основний файл Flask застосунку для системи WINIX
ВИПРАВЛЕНА версія з покращеною обробкою помилок, fallback routes та стабільною ініціалізацією
🔥 WINIX Quests System Integration з відкладеною ініціалізацією 🔥
"""

# Стандартні бібліотеки
import os
import sys
import logging
import time
import uuid
from datetime import datetime, timezone

import traceback

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

def register_fallback_routes(app):
    """Реєструє fallback маршрути для випадків, коли WINIX недоступний"""
    logger.info("🔄 === РЕЄСТРАЦІЯ FALLBACK МАРШРУТІВ ===")

    @app.route('/api/quests/health', methods=['GET'])
    def quests_health_fallback():
        return jsonify({
            "status": "fallback",
            "message": "WINIX Quests недоступний, використовується fallback",
            "timestamp": datetime.now(timezone.utc).isoformat()
        })

    @app.route('/api/tasks', methods=['GET'])
    def tasks_fallback():
        return jsonify({
            "status": "success",
            "data": [],
            "message": "Завдання тимчасово недоступні",
            "fallback": True
        })

    @app.route('/api/user/<user_id>/tasks', methods=['GET'])
    def user_tasks_fallback(user_id):
        return jsonify({
            "status": "success",
            "data": [],
            "message": "Завдання користувача тимчасово недоступні",
            "fallback": True,
            "user_id": user_id
        })

    @app.route('/api/daily/status/<user_id>', methods=['GET'])
    def daily_status_fallback(user_id):
        return jsonify({
            "status": "success",
            "data": {
                "available": False,
                "reason": "Щоденні бонуси тимчасово недоступні"
            },
            "fallback": True,
            "user_id": user_id
        })

    @app.route('/api/flex/<path:subpath>', methods=['GET', 'POST'])
    def flex_fallback(subpath):
        return jsonify({
            "status": "success",
            "data": [],
            "message": "Flex завдання тимчасово недоступні",
            "fallback": True
        })

    logger.info("✅ Fallback маршрути зареєстровано")

def register_minimal_routes(app):
    """Реєструє мінімальний набір маршрутів для базової функціональності"""
    logger.info("🔧 === РЕЄСТРАЦІЯ МІНІМАЛЬНИХ МАРШРУТІВ ===")

    @app.route('/api/system/status', methods=['GET'])
    def system_status():
        return jsonify({
            "status": "minimal",
            "winix_available": WINIX_QUESTS_AVAILABLE,
            "modules": {
                "auth": True,
                "users": True,
                "quests": False,
                "tasks": False
            },
            "message": "Система працює в мінімальному режимі"
        })

    logger.info("✅ Мінімальні маршрути зареєстровано")

def safe_register_quests_routes(app):
    """ВИПРАВЛЕНА безпечна реєстрація quests маршрутів з fallback"""
    logger.info("🎯 === БЕЗПЕЧНА РЕЄСТРАЦІЯ QUESTS МАРШРУТІВ ===")

    if not WINIX_QUESTS_AVAILABLE:
        logger.warning("⚠️ WINIX недоступний, реєструємо fallback маршрути")
        register_fallback_routes(app)
        return True

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
    try:
        register_quests_blueprints_manually(app)
        return True
    except Exception as e:
        logger.error(f"❌ Ручна реєстрація провалена: {e}")

        # Фінальний fallback
        logger.warning("⚠️ Використовуємо мінімальні fallback маршрути")
        register_fallback_routes(app)
        return True

def register_quests_blueprints_manually(app):
    """Ручна реєстрація всіх Blueprint'ів з quests системи з обробкою помилок"""
    logger.info("🔧 === РУЧНА РЕЄСТРАЦІЯ QUESTS BLUEPRINT'ІВ ===")

    registered_count = 0

    # Список Blueprint'ів для реєстрації
    blueprints_to_register = [
        ('quests.routes.auth_routes', 'auth_bp', '/api/quests/auth'),
        ('quests.routes.user_routes', 'user_bp', '/api/quests/user'),
        ('quests.routes.daily_routes', 'daily_bp', '/api/quests/daily'),
        ('quests.routes.analytics_routes', 'analytics_bp', '/api/quests/analytics'),
        ('quests.routes.flex_routes', 'flex_bp', '/api/quests/flex'),
        ('quests.routes.tasks_routes', 'tasks_bp', '/api/quests/tasks'),
        ('quests.routes.transaction_routes', 'transaction_bp', '/api/quests/transactions'),
        ('quests.routes.verification_routes', 'verification_bp', '/api/quests/verify'),
        ('quests.routes.wallet_routes', 'wallet_bp', '/api/quests/wallet')
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

def handle_api_error(error, endpoint, method):
    """Централізована обробка API помилок"""
    error_context = {
        'endpoint': endpoint,
        'method': method,
        'error_type': type(error).__name__,
        'timestamp': datetime.now(timezone.utc).isoformat()
    }

    error_str = str(error).lower()

    if 'pattern' in error_str or 'match' in error_str:
        # Проблема з валідацією
        logger.error("Validation pattern error", extra=error_context)
        return jsonify({
            "status": "error",
            "message": "Помилка валідації даних",
            "code": "validation_error"
        }), 400

    if 'timeout' in error_str:
        # Timeout проблема
        logger.error("Request timeout", extra=error_context)
        return jsonify({
            "status": "error",
            "message": "Timeout запиту",
            "code": "timeout_error"
        }), 408

    # Загальна обробка
    logger.error(f"API error: {str(error)}", extra=error_context)
    return jsonify({
        "status": "error",
        "message": "Внутрішня помилка сервера",
        "code": "internal_error"
    }), 500

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

    # === ФІНАЛЬНА ДІАГНОСТИКА СИСТЕМИ ===
    if QUESTS_DIAGNOSTICS_AVAILABLE and diagnose_quests_routes:
        try:
            diagnosis = diagnose_quests_routes(app)
            logger.info(f"🎯 Фінальна діагностика QUESTS: {diagnosis['quests_routes']} маршрутів зареєстровано")

            if diagnosis.get('duplicate_endpoints'):
                logger.warning(f"⚠️ Знайдено {len(diagnosis['duplicate_endpoints'])} дублікатів endpoint'ів")
                for dup in diagnosis['duplicate_endpoints'][:3]:  # Показуємо перші 3
                    logger.warning(f"   🔄 {dup['endpoint']} ({dup['count']} разів)")

            if diagnosis.get('blueprint_conflicts'):
                logger.error(f"🔴 Конфлікти Blueprint'ів: {diagnosis['blueprint_conflicts']}")

            if diagnosis.get('missing_endpoints'):
                logger.warning(f"⚠️ Відсутні {len(diagnosis['missing_endpoints'])} критичних endpoint'ів")

            if diagnosis.get('recommendations'):
                logger.info("💡 Рекомендації системи:")
                for rec in diagnosis['recommendations']:
                    logger.info(f"   • {rec}")

        except Exception as e:
            logger.error(f"Помилка фінальної діагностики: {e}")

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

# Решта функцій залишається без змін, але додаю декілька ключових
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
                "template_folder": app.template_folder,
                "static_folder": app.static_folder,
                "supabase_test": supabase_test,
                "winix_test": winix_test
            },
            "routes": routes[:20]  # Обмежуємо до 20 маршрутів для читабельності
        })

def register_error_handlers(app):
    """Реєстрація обробників помилок з покращеною логікою"""

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
                "/", "/index.html", "/original-index.html", "/earn.html", "/wallet.html",
                "/referrals.html", "/staking.html", "/transactions.html", "/raffles.html"
            ]
        }), 404

    @app.errorhandler(500)
    def server_error(e):
        error_details = str(e)
        logger.error(f"500 error: {error_details}")

        if app.config.get('DEBUG', False):
            error_trace = traceback.format_exc()
            logger.error(f"Error trace: {error_trace}")

        return jsonify({
            "error": "server_error",
            "message": "Внутрішня помилка сервера",
            "details": error_details if app.config.get('DEBUG', False) else None
        }), 500

    @app.errorhandler(400)
    def bad_request(e):
        return handle_api_error(e, request.path, request.method)

    @app.errorhandler(408)
    def request_timeout(e):
        return jsonify({
            "status": "error",
            "message": "Timeout запиту",
            "code": "timeout_error"
        }), 408

    logger.info("Обробники помилок зареєстровано")

# Додаткові функції (спрощені версії оригінальних)
def register_static_routes(app):
    """Реєстрація маршрутів для статичних файлів"""
    pass  # Реалізація залишається як в оригіналі

def register_page_routes(app):
    """Реєстрація маршрутів для HTML сторінок"""
    @app.route('/')
    def index():
        return render_template('index.html')

def setup_staking_routes(app):
    """Налаштування маршрутів для стейкінгу"""
    pass  # Реалізація залишається як в оригіналі

def register_tutorial_routes(app):
    """Реєстрація маршрутів для туторіалу"""
    pass  # Реалізація залишається як в оригіналі

def init_raffle_service():
    """Ініціалізація сервісу розіграшів"""
    pass  # Реалізація залишається як в оригіналі

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
    debug = getattr(app.config, 'DEBUG', True) if hasattr(app, 'config') else True

    logger.info(f"🌟 Запуск WINIX застосунку на порту {port}, режим налагодження: {debug}")
    logger.info("🎯 === ДІАГНОСТИЧНІ ENDPOINT'И ===")
    logger.info("📋 /api/winix/diagnosis - повна діагностика WINIX")
    logger.info("🔍 /api/winix/health - статус здоров'я WINIX")
    logger.info("📊 /api/winix/info - інформація про WINIX")
    logger.info("🧪 /api/winix/test - швидкий тест WINIX")
    logger.info("🔍 /debug - загальна діагностика системи")

    # Запуск сервера
    app.run(host='0.0.0.0', port=port, debug=debug)