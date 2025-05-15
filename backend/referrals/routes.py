from flask import Blueprint, request, jsonify, current_app
from referrals.controllers import ReferralController, BonusController, EarningsController

referrals_bp = Blueprint('referrals', __name__)


# Маршрути для реферальних посилань
@referrals_bp.route('/api/referrals/link/<int:user_id>', methods=['GET'])
def get_referral_link(user_id):
    """Отримання реферального посилання для користувача"""
    result = ReferralController.generate_referral_link(user_id)
    return jsonify(result)


@referrals_bp.route('/api/referrals/register', methods=['POST'])
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
@referrals_bp.route('/api/referrals/stats/<int:user_id>', methods=['GET'])
def get_referral_stats(user_id):
    """Отримання статистики рефералів користувача"""
    result = ReferralController.get_referral_structure(user_id)
    return jsonify(result)


@referrals_bp.route('/api/referrals/details/<int:referral_id>', methods=['GET'])
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
@referrals_bp.route('/api/referrals/bonus/direct', methods=['POST'])
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


@referrals_bp.route('/api/referrals/bonus/history/<int:user_id>', methods=['GET'])
def get_bonus_history(user_id):
    """Отримання історії прямих бонусів користувача"""
    result = BonusController.get_bonus_history(user_id)
    return jsonify(result)


# Маршрути для заробітків рефералів
@referrals_bp.route('/api/referrals/earnings/<int:user_id>', methods=['GET', 'POST'])
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


@referrals_bp.route('/api/referrals/earnings/detailed/<int:referral_id>', methods=['GET'])
def get_detailed_earnings(referral_id):
    """Отримання детальних даних про заробітки конкретного реферала"""
    result = EarningsController.get_detailed_earnings(referral_id)
    return jsonify(result)


@referrals_bp.route('/api/referrals/earnings/summary/<int:user_id>', methods=['GET'])
def get_earnings_summary(user_id):
    """Отримання зведеної інформації про заробітки"""
    result = EarningsController.get_earnings_summary(user_id)
    return jsonify(result)


# Маршрути для відсоткових винагород
@referrals_bp.route('/api/referrals/reward/percentage', methods=['POST'])
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


@referrals_bp.route('/api/referrals/reward/history/<int:user_id>', methods=['GET'])
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


# Маршрути для активності рефералів (заглушки для початкової реалізації)
@referrals_bp.route('/api/referrals/activity/<int:user_id>', methods=['GET', 'POST'])
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

    from referrals.controllers import ActivityController
    result = ActivityController.get_referral_activity(user_id, options)
    return jsonify(result)


@referrals_bp.route('/api/referrals/activity/detailed/<int:referral_id>', methods=['GET'])
def get_referral_detailed_activity(referral_id):
    """Отримання детальних даних про активність конкретного реферала"""
    from referrals.controllers import ActivityController
    result = ActivityController.get_referral_detailed_activity(referral_id)
    return jsonify(result)


@referrals_bp.route('/api/referrals/activity/summary/<int:user_id>', methods=['GET'])
def get_activity_summary(user_id):
    """Отримання зведеної інформації про активність"""
    from referrals.controllers import ActivityController
    result = ActivityController.get_activity_summary(user_id)
    return jsonify(result)


@referrals_bp.route('/api/referrals/activity/update', methods=['POST'])
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

    from referrals.controllers import ActivityController
    result = ActivityController.update_activity(user_id, draws_participation, invited_referrals)
    return jsonify(result)


@referrals_bp.route('/api/referrals/activity/activate', methods=['POST'])
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

    from referrals.controllers import ActivityController
    result = ActivityController.manually_activate(user_id, admin_id)
    return jsonify(result)


# Ініціалізація Blueprint для маршрутів реферальної системи
def init_app(app):
    """Реєстрація blueprint в додатку Flask"""
    app.register_blueprint(referrals_bp)


# Маршрути для аналітики та рейтингу рефералів
@referrals_bp.route('/api/analytics/ranking/<int:user_id>', methods=['GET'])
def get_referrals_ranking(user_id):
    """Отримання рейтингу рефералів"""
    sort_by = request.args.get('sortBy', 'earnings')

    from referrals.controllers import AnalyticsController
    result = AnalyticsController.get_referrals_ranking(user_id, sort_by=sort_by)
    return jsonify(result)


@referrals_bp.route('/api/analytics/top/<int:user_id>/<int:limit>', methods=['GET'])
def get_top_referrals(user_id, limit):
    """Отримання топ-N рефералів"""
    metric = request.args.get('metric', 'earnings')

    from referrals.controllers import AnalyticsController
    result = AnalyticsController.get_top_referrals(user_id, limit=limit, metric=metric)
    return jsonify(result)


@referrals_bp.route('/api/analytics/earnings/total/<int:user_id>', methods=['GET'])
def get_total_earnings(user_id):
    """Отримання загального заробітку"""
    from referrals.controllers import AnalyticsController
    result = AnalyticsController.get_total_earnings(user_id)
    return jsonify(result)


@referrals_bp.route('/api/analytics/earnings/predict/<int:user_id>', methods=['GET'])
def predict_earnings(user_id):
    """Отримання прогнозу майбутніх заробітків"""
    from referrals.controllers import AnalyticsController
    result = AnalyticsController.predict_earnings(user_id)
    return jsonify(result)


@referrals_bp.route('/api/analytics/earnings/roi/<int:user_id>', methods=['GET'])
def get_earnings_roi(user_id):
    """Отримання рентабельності реферальної програми"""
    from referrals.controllers import AnalyticsController
    result = AnalyticsController.get_earnings_roi(user_id)
    return jsonify(result)


@referrals_bp.route('/api/analytics/earnings/distribution/<int:user_id>', methods=['GET'])
def get_earnings_distribution(user_id):
    """Отримання розподілу заробітку за категоріями"""
    from referrals.controllers import AnalyticsController
    result = AnalyticsController.get_earnings_distribution(user_id)
    return jsonify(result)