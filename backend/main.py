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

# Ініціалізація SQLAlchemy
db = SQLAlchemy()

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
        static_folder=os.path.join(BASE_DIR, 'frontend')
    )

    # Завантажуємо конфігурацію
    from settings import current_config
    app.config.from_object(current_config)

    # Секретний ключ для сесій
    app.secret_key = current_config.SECRET_KEY

    # Налаштування бази даних
    app.config['SQLALCHEMY_DATABASE_URI'] = os.environ.get('DATABASE_URL', 'sqlite:///winix.db')
    app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

    # Ініціалізація SQLAlchemy з додатком
    db.init_app(app)

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

    # Створення таблиць БД при запуску
    with app.app_context():
        db.create_all()
        logger.info("Таблиці бази даних створено")

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
        # Функція регістрації маршрутів рефералів
        register_referrals_routes(app)
        log_registration_result("рефералів", True)
    except Exception as e:
        log_registration_result("рефералів", False, str(e))

    # Реєстрація маршрутів бейджів
    try:
        # Функція регістрації маршрутів бейджів
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


def register_referrals_routes(app):
    """
    Реєстрація маршрутів для реферальної системи

    Args:
        app: Екземпляр Flask додатку
    """
    from referrals.controllers.referral_controller import ReferralController
    from referrals.controllers.bonus_controller import BonusController
    from referrals.controllers.earnings_controller import EarningsController
    from referrals.controllers.activity_controller import ActivityController
    from referrals.controllers.analytics_controller import AnalyticsController

    # Маршрути для реферальних посилань
    @app.route('/api/referrals/link/<int:user_id>', methods=['GET'])
    def get_referral_link(user_id):
        """Отримання реферального посилання для користувача"""
        result = ReferralController.generate_referral_link(user_id)
        return jsonify(result)

    @app.route('/api/referrals/register', methods=['POST'])
    def register_referral():
        """Реєстрація нового реферала"""
        data = request.get_json()

        # Перевірка наявності необхідних полів
        if not data or 'referrer_id' not in data or 'referee_id' not in data:
            return jsonify({
                'success': False,
                'error': 'Missing required fields',
                'details': 'Both referrer_id and referee_id are required'
            }), 400

        referrer_id = data['referrer_id']
        referee_id = data['referee_id']

        result = ReferralController.register_referral(referrer_id, referee_id)

        # Якщо реєстрація успішна, автоматично нараховуємо бонус
        if result['success']:
            bonus_result = BonusController.award_direct_bonus(referrer_id, referee_id)
            result['bonus_awarded'] = bonus_result['success']
            if bonus_result['success']:
                result['bonus'] = bonus_result['bonus']

        return jsonify(result)

    # Маршрути для статистики рефералів
    @app.route('/api/referrals/stats/<int:user_id>', methods=['GET'])
    def get_referral_stats(user_id):
        """Отримання статистики рефералів користувача"""
        result = ReferralController.get_referral_structure(user_id)
        return jsonify(result)

    @app.route('/api/referrals/details/<int:referral_id>', methods=['GET'])
    def get_referral_details(referral_id):
        """Отримання детальної інформації про конкретного реферала"""
        # В цій демо-версії повертаємо заглушку
        return jsonify({
            'success': True,
            'id': referral_id,
            'registrationDate': '2024-04-15T09:45:00Z',
            'active': True,
            'earnings': 320,
            'referralCount': 3,
            'lastActivity': '2024-04-20T14:30:00Z'
        })

    # Маршрути для прямих бонусів
    @app.route('/api/referrals/bonus/direct', methods=['POST'])
    def award_direct_bonus():
        """Нарахування прямого бонусу за реферала"""
        data = request.get_json()

        # Перевірка наявності необхідних полів
        if not data or 'referrer_id' not in data or 'referee_id' not in data:
            return jsonify({
                'success': False,
                'error': 'Missing required fields',
                'details': 'Both referrer_id and referee_id are required'
            }), 400

        referrer_id = data['referrer_id']
        referee_id = data['referee_id']
        amount = data.get('amount', 50)  # За замовчуванням 50 winix

        result = BonusController.award_direct_bonus(referrer_id, referee_id, amount)
        return jsonify(result)

    @app.route('/api/referrals/bonus/history/<int:user_id>', methods=['GET'])
    def get_bonus_history(user_id):
        """Отримання історії прямих бонусів користувача"""
        result = BonusController.get_bonus_history(user_id)
        return jsonify(result)

    # Маршрути для заробітків рефералів
    @app.route('/api/referrals/earnings/<int:user_id>', methods=['GET', 'POST'])
    def get_referral_earnings(user_id):
        """Отримання даних про заробітки рефералів користувача"""
        # Отримання опцій з запиту (для POST) або з параметрів URL (для GET)
        if request.method == 'POST':
            options = request.get_json() or {}
        else:
            options = {
                'startDate': request.args.get('startDate'),
                'endDate': request.args.get('endDate'),
                'activeOnly': request.args.get('activeOnly') == 'true'
            }

        result = EarningsController.get_referral_earnings(user_id, options)
        return jsonify(result)

    @app.route('/api/referrals/earnings/detailed/<int:referral_id>', methods=['GET'])
    def get_detailed_earnings(referral_id):
        """Отримання детальних даних про заробітки конкретного реферала"""
        result = EarningsController.get_detailed_earnings(referral_id)
        return jsonify(result)

    @app.route('/api/referrals/earnings/summary/<int:user_id>', methods=['GET'])
    def get_earnings_summary(user_id):
        """Отримання зведеної інформації про заробітки"""
        result = EarningsController.get_earnings_summary(user_id)
        return jsonify(result)

    # Маршрути для відсоткових винагород
    @app.route('/api/referrals/reward/percentage', methods=['POST'])
    def calculate_percentage_reward():
        """Розрахунок і нарахування відсоткової винагороди"""
        data = request.get_json()

        # Перевірка наявності необхідних полів
        if not data or 'user_id' not in data or 'referral_id' not in data or 'amount' not in data or 'level' not in data:
            return jsonify({
                'success': False,
                'error': 'Missing required fields',
                'details': 'user_id, referral_id, amount, and level are required'
            }), 400

        user_id = data['user_id']
        referral_id = data['referral_id']
        amount = data['amount']
        level = data['level']

        result = EarningsController.calculate_percentage_reward(user_id, referral_id, amount, level)
        return jsonify(result)

    @app.route('/api/referrals/reward/history/<int:user_id>', methods=['GET'])
    def get_percentage_rewards(user_id):
        """Отримання історії відсоткових винагород"""
        # Отримання опцій з параметрів URL
        options = {
            'startDate': request.args.get('startDate'),
            'endDate': request.args.get('endDate'),
            'level': int(request.args.get('level')) if request.args.get('level') else None
        }

        result = EarningsController.get_percentage_rewards(user_id, options)
        return jsonify(result)

    # Маршрути для активності рефералів
    @app.route('/api/referrals/activity/<int:user_id>', methods=['GET', 'POST'])
    def get_referral_activity(user_id):
        """Отримання даних про активність рефералів користувача"""
        # Отримання опцій з запиту або з параметрів URL
        if request.method == 'POST':
            options = request.get_json() or {}
        else:
            options = {
                'startDate': request.args.get('startDate'),
                'endDate': request.args.get('endDate'),
                'level': int(request.args.get('level')) if request.args.get('level') else None,
                'activeOnly': request.args.get('activeOnly') == 'true'
            }

        result = ActivityController.get_referral_activity(user_id, options)
        return jsonify(result)

    @app.route('/api/referrals/activity/detailed/<int:referral_id>', methods=['GET'])
    def get_referral_detailed_activity(referral_id):
        """Отримання детальних даних про активність конкретного реферала"""
        result = ActivityController.get_referral_detailed_activity(referral_id)
        return jsonify(result)

    @app.route('/api/referrals/activity/summary/<int:user_id>', methods=['GET'])
    def get_activity_summary(user_id):
        """Отримання зведеної інформації про активність"""
        result = ActivityController.get_activity_summary(user_id)
        return jsonify(result)

    @app.route('/api/referrals/activity/update', methods=['POST'])
    def update_activity():
        """Оновлення активності реферала"""
        data = request.get_json()

        # Перевірка наявності необхідних полів
        if not data or 'user_id' not in data:
            return jsonify({
                'success': False,
                'error': 'Missing required fields',
                'details': 'user_id is required'
            }), 400

        user_id = data['user_id']
        draws_participation = data.get('draws_participation')
        invited_referrals = data.get('invited_referrals')

        result = ActivityController.update_activity(user_id, draws_participation, invited_referrals)
        return jsonify(result)

    @app.route('/api/referrals/activity/activate', methods=['POST'])
    def manually_activate_referral():
        """Ручна активація реферала"""
        data = request.get_json()

        # Перевірка наявності необхідних полів
        if not data or 'user_id' not in data or 'admin_id' not in data:
            return jsonify({
                'success': False,
                'error': 'Missing required fields',
                'details': 'user_id and admin_id are required'
            }), 400

        user_id = data['user_id']
        admin_id = data['admin_id']

        result = ActivityController.manually_activate(user_id, admin_id)
        return jsonify(result)

    # Маршрути для аналітики та рейтингу рефералів
    @app.route('/api/analytics/ranking/<int:user_id>', methods=['GET'])
    def get_referrals_ranking(user_id):
        """Отримання рейтингу рефералів"""
        sort_by = request.args.get('sortBy', 'earnings')

        result = AnalyticsController.get_referrals_ranking(user_id, sort_by=sort_by)
        return jsonify(result)

    @app.route('/api/analytics/top/<int:user_id>/<int:limit>', methods=['GET'])
    def get_top_referrals(user_id, limit):
        """Отримання топ-N рефералів"""
        metric = request.args.get('metric', 'earnings')

        result = AnalyticsController.get_top_referrals(user_id, limit=limit, metric=metric)
        return jsonify(result)

    @app.route('/api/analytics/earnings/total/<int:user_id>', methods=['GET'])
    def get_total_earnings(user_id):
        """Отримання загального заробітку"""
        result = AnalyticsController.get_total_earnings(user_id)
        return jsonify(result)

    @app.route('/api/analytics/earnings/predict/<int:user_id>', methods=['GET'])
    def predict_earnings(user_id):
        """Отримання прогнозу майбутніх заробітків"""
        result = AnalyticsController.predict_earnings(user_id)
        return jsonify(result)

    @app.route('/api/analytics/earnings/roi/<int:user_id>', methods=['GET'])
    def get_earnings_roi(user_id):
        """Отримання рентабельності реферальної програми"""
        result = AnalyticsController.get_earnings_roi(user_id)
        return jsonify(result)

    @app.route('/api/analytics/earnings/distribution/<int:user_id>', methods=['GET'])
    def get_earnings_distribution(user_id):
        """Отримання розподілу заробітку за категоріями"""
        result = AnalyticsController.get_earnings_distribution(user_id)
        return jsonify(result)

    logger.info("Маршрути для реферальної системи зареєстровано")
    return True


def register_badges_routes(app):
    """
    Реєстрація маршрутів для бейджів та завдань

    Args:
        app: Екземпляр Flask додатку
    """
    from badges.controllers.badge_controller import BadgeController
    from badges.controllers.task_controller import TaskController

    # Маршрути для бейджів
    @app.route('/api/badges/<int:user_id>', methods=['GET'])
    def get_user_badges(user_id):
        """Отримання інформації про бейджі користувача"""
        result = BadgeController.get_user_badges(user_id)
        return jsonify(result)

    @app.route('/api/badges/check/<int:user_id>', methods=['POST'])
    def check_badges(user_id):
        """Перевірка та нарахування бейджів"""
        result = BadgeController.check_badges(user_id)
        return jsonify(result)

    @app.route('/api/badges/claim', methods=['POST'])
    def claim_badge_reward():
        """Отримання винагороди за бейдж"""
        data = request.get_json()

        # Перевірка наявності необхідних полів
        if not data or 'user_id' not in data or 'badge_type' not in data:
            return jsonify({
                'success': False,
                'error': 'Missing required fields',
                'details': 'user_id and badge_type are required'
            }), 400

        user_id = data['user_id']
        badge_type = data['badge_type']

        result = BadgeController.claim_badge_reward(user_id, badge_type)
        return jsonify(result)

    # Маршрути для завдань
    @app.route('/api/tasks/<int:user_id>', methods=['GET'])
    def get_user_tasks(user_id):
        """Отримання інформації про завдання користувача"""
        result = TaskController.get_user_tasks(user_id)
        return jsonify(result)

    @app.route('/api/tasks/update/<int:user_id>', methods=['POST'])
    def update_tasks(user_id):
        """Оновлення прогресу завдань"""
        result = TaskController.update_tasks(user_id)
        return jsonify(result)

    @app.route('/api/tasks/claim', methods=['POST'])
    def claim_task_reward():
        """Отримання винагороди за виконане завдання"""
        data = request.get_json()

        # Перевірка наявності необхідних полів
        if not data or 'user_id' not in data or 'task_type' not in data:
            return jsonify({
                'success': False,
                'error': 'Missing required fields',
                'details': 'user_id and task_type are required'
            }), 400

        user_id = data['user_id']
        task_type = data['task_type']

        result = TaskController.claim_task_reward(user_id, task_type)
        return jsonify(result)

    logger.info("Маршрути для бейджів та завдань зареєстровано")
    return True


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
            if os.path.exists(os.path.join(directory, filename)):
                return send_from_directory(directory, filename)
            else:
                logger.warning(f"Файл не знайдено: {directory}/{filename}")
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

    @app.route('/js/<path:filename>')
    def serve_js(filename):
        return serve_static_file(static_dirs['js'], filename)

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
    try:
        # Отримуємо порт з конфігурації або середовища
        port = int(os.environ.get("PORT", app.config.get("PORT", 5000)))
        debug_mode = app.config.get("DEBUG", False)

        # Виводимо інформацію про запуск
        logger.info(f"Запуск застосунку на порту {port}, режим налагодження: {debug_mode}")

        # Запускаємо застосунок
        app.run(debug=debug_mode, host='0.0.0.0', port=port)
    except Exception as e:
        logger.critical(f"Критична помилка запуску застосунку: {str(e)}")
        traceback.print_exc()