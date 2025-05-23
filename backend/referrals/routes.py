from flask import Blueprint, request, jsonify, current_app
from referrals.controllers import (
    ReferralController,
    BonusController,
    EarningsController,
    ActivityController,
    AnalyticsController,
    DrawController,
    HistoryController
)
import logging
import traceback
import json

# Налаштування логування для детальнішого відстеження
logger = logging.getLogger(__name__)

# Створення Blueprint для реферальної системи
referrals_bp = Blueprint('referrals', __name__)


# Утиліта для уніфікованої обробки винятків
def handle_api_exceptions(func):
    """Декоратор для уніфікованої обробки винятків в API"""

    def wrapper(*args, **kwargs):
        try:
            return func(*args, **kwargs)
        except Exception as e:
            error_details = traceback.format_exc()
            error_id = f"e_{hash(str(e) + str(args) + str(kwargs)) % 10000}"
            logger.error(f"API Error [{error_id}]: {str(e)}\n{error_details}")

            # Розширений контекст для дебагу
            debug_info = {}
            if current_app.config.get('DEBUG', False):
                debug_info = {
                    'error_id': error_id,
                    'traceback': error_details,
                    'args': str(args),
                    'kwargs': str(kwargs)
                }

            return jsonify({
                'success': False,
                'error': 'Внутрішня помилка сервера',
                'message': str(e),
                'error_id': error_id,
                'debug': debug_info if debug_info else None
            }), 500

    # Збереження метаданих функції
    wrapper.__name__ = func.__name__
    return wrapper


# Валідація вхідних даних
def validate_referral_data(data, required_fields):
    """Валідує дані для API-запитів"""
    if not data:
        return False, "Відсутнє тіло запиту"

    missing_fields = [field for field in required_fields if field not in data]
    if missing_fields:
        return False, f"Відсутні обов'язкові поля: {', '.join(missing_fields)}"

    return True, ""


# Маршрути для реферальних посилань
@referrals_bp.route('/api/referrals/link/<user_id>', methods=['GET'])
@handle_api_exceptions
def get_referral_link(user_id):
    """Отримання реферального посилання для користувача"""
    logger.info(f"get_referral_link: Запит на отримання посилання для {user_id}")
    result = ReferralController.generate_referral_link(user_id)

    if not result.get('success', False):
        logger.warning(f"get_referral_link: Помилка генерації посилання для {user_id}: {result.get('error')}")
        return jsonify(result), 400

    return jsonify(result)


@referrals_bp.route('/api/referrals/register', methods=['POST'])
@handle_api_exceptions
def register_referral():
    """Реєстрація нового реферала"""
    data = request.get_json()
    logger.info(
        f"register_referral: Отримано запит на реєстрацію реферала: {json.dumps(data, default=str) if data else None}")

    # Валідація даних
    is_valid, error_message = validate_referral_data(data, ['referrer_id', 'referee_id'])
    if not is_valid:
        logger.warning(f"register_referral: Валідація не пройдена - {error_message}")
        return jsonify({
            'success': False,
            'error': 'Missing required fields',
            'details': error_message
        }), 400

    referrer_id = data['referrer_id']
    referee_id = data['referee_id']

    # Спроба реєстрації реферального зв'язку
    referral_result = ReferralController.register_referral(referrer_id, referee_id)

    # Якщо реєстрація не вдалася, повертаємо помилку
    if not referral_result.get('success', False):
        logger.warning(f"register_referral: Невдала реєстрація - {referral_result.get('error')}")
        return jsonify(referral_result), 400

    # Якщо реєстрація успішна, автоматично нараховуємо бонус
    if referral_result.get('success', False):
        logger.info(f"register_referral: Реферальний зв'язок успішно створено, нараховуємо бонус")
        bonus_result = BonusController.award_direct_bonus(
            referrer_id=referrer_id,
            referee_id=referee_id,
            amount=data.get('amount', 50)  # Дозволяємо вказати розмір бонусу
        )

        referral_result['bonus_awarded'] = bonus_result.get('success', False)

        if bonus_result.get('success', False):
            referral_result['bonus'] = bonus_result.get('bonus')
            logger.info(f"register_referral: Бонус успішно нараховано")
        else:
            logger.warning(f"register_referral: Проблема з нарахуванням бонусу - {bonus_result.get('error')}")
            # Додаємо інформацію про помилку бонусу
            referral_result['bonus_error'] = bonus_result.get('error')
            referral_result['bonus_details'] = bonus_result.get('details')

    return jsonify(referral_result)


# Маршрути для статистики рефералів
@referrals_bp.route('/api/referrals/stats/<user_id>', methods=['GET'])
@handle_api_exceptions
def get_referral_stats(user_id):
    """Отримання статистики рефералів користувача"""
    logger.info(f"get_referral_stats: Запит на отримання статистики для {user_id}")

    # Додаємо обробку додаткових параметрів
    include_inactive = request.args.get('include_inactive', 'true').lower() == 'true'

    # Можна розширити функціонал для різних форматів даних
    result = ReferralController.get_referral_structure(user_id)

    # Фільтрація неактивних рефералів, якщо потрібно
    if not include_inactive and result.get('success', False):
        try:
            # Фільтруємо неактивних рефералів першого рівня
            result['referrals']['level1'] = [ref for ref in result['referrals']['level1'] if ref.get('active', False)]

            # Фільтруємо неактивних рефералів другого рівня
            result['referrals']['level2'] = [ref for ref in result['referrals']['level2'] if ref.get('active', False)]

            # Оновлюємо статистику
            result['statistics']['totalReferrals'] = len(result['referrals']['level1']) + len(
                result['referrals']['level2'])
            result['statistics']['level1Count'] = len(result['referrals']['level1'])
            result['statistics']['level2Count'] = len(result['referrals']['level2'])

            logger.info(f"get_referral_stats: Застосовано фільтрацію неактивних рефералів")
        except Exception as e:
            logger.warning(f"get_referral_stats: Помилка фільтрації неактивних рефералів: {str(e)}")

    # Визначаємо код статусу відповіді
    status_code = 200 if result.get('success', False) else 400
    return jsonify(result), status_code


@referrals_bp.route('/api/referrals/details/<referral_id>', methods=['GET'])
@handle_api_exceptions
def get_referral_details(referral_id):
    """Отримання детальної інформації про конкретного реферала"""
    logger.info(f"get_referral_details: Запит на отримання деталей для реферала {referral_id}")

    # Обробляємо формат ідентифікатора (з або без 'WX')
    try:
        if referral_id.startswith('WX'):
            real_id = referral_id[2:]  # Видаляємо 'WX' з початку
        else:
            real_id = referral_id

        # Перевірка на валідність ID
        real_id = int(real_id)  # Конвертуємо в число для валідації
    except (ValueError, AttributeError) as e:
        logger.error(f"get_referral_details: Невалідний ID реферала: {referral_id} - {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Invalid referral ID',
            'details': f'Cannot process referral ID: {referral_id}'
        }), 400

    # В цій демо-версії повертаємо заглушку
    # В реальній системі тут буде запит до бази даних або сервісу
    try:
        # Додаткова логіка для отримання даних з різних джерел
        # Можна об'єднати дані з кількох контролерів
        activity_result = ActivityController.get_referral_detailed_activity(real_id)
        earnings_result = EarningsController.get_detailed_earnings(real_id)
        draw_history = DrawController.get_referral_draws(real_id)

        # Об'єднуємо результати в один об'єкт
        response = {
            'success': True,
            'id': referral_id,
            'rawId': str(real_id),
            'registrationDate': '2024-04-15T09:45:00Z',
            'active': True,
            'earnings': earnings_result.get('totalEarnings', 320) if earnings_result.get('success', False) else 320,
            'referralCount': 3,
            'lastActivity': '2024-04-20T14:30:00Z',
            'activityDetails': activity_result if activity_result.get('success', False) else None,
            'drawsHistory': draw_history if draw_history.get('success', False) else None
        }

        return jsonify(response)
    except Exception as e:
        logger.error(f"get_referral_details: Помилка отримання даних: {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Failed to get referral details',
            'details': str(e)
        }), 500


# Маршрути для прямих бонусів
@referrals_bp.route('/api/referrals/bonus/direct', methods=['POST'])
@handle_api_exceptions
def award_direct_bonus():
    """Нарахування прямого бонусу за реферала"""
    data = request.get_json()
    logger.info(f"award_direct_bonus: Запит на нарахування бонусу: {json.dumps(data, default=str) if data else None}")

    # Валідація даних
    is_valid, error_message = validate_referral_data(data, ['referrer_id', 'referee_id'])
    if not is_valid:
        logger.warning(f"award_direct_bonus: Валідація не пройдена - {error_message}")
        return jsonify({
            'success': False,
            'error': 'Missing required fields',
            'details': error_message
        }), 400

    referrer_id = data['referrer_id']
    referee_id = data['referee_id']
    amount = data.get('amount', 50)  # За замовчуванням 50 winix

    # Додаткова валідація суми
    try:
        amount = float(amount)
        if amount <= 0:
            logger.warning(f"award_direct_bonus: Невалідна сума бонусу: {amount}")
            return jsonify({
                'success': False,
                'error': 'Invalid bonus amount',
                'details': 'Bonus amount must be greater than 0'
            }), 400
    except (ValueError, TypeError):
        logger.warning(f"award_direct_bonus: Невалідний тип суми бонусу: {amount}")
        return jsonify({
            'success': False,
            'error': 'Invalid bonus amount type',
            'details': 'Bonus amount must be a number'
        }), 400

    result = BonusController.award_direct_bonus(referrer_id, referee_id, amount)

    # Визначаємо код статусу відповіді
    status_code = 200 if result.get('success', False) else 400
    return jsonify(result), status_code


@referrals_bp.route('/api/referrals/bonus/history/<user_id>', methods=['GET'])
@handle_api_exceptions
def get_bonus_history(user_id):
    """Отримання історії прямих бонусів користувача"""
    logger.info(f"get_bonus_history: Запит на отримання історії бонусів для {user_id}")

    # Параметри фільтрації
    start_date = request.args.get('start_date')
    end_date = request.args.get('end_date')

    # Додаємо опції фільтрації, якщо вони є
    options = {}
    if start_date:
        options['start_date'] = start_date
    if end_date:
        options['end_date'] = end_date

    result = BonusController.get_bonus_history(user_id)

    # Визначаємо код статусу відповіді
    status_code = 200 if result.get('success', False) else 400
    return jsonify(result), status_code


# Маршрути для заробітків рефералів
@referrals_bp.route('/api/referrals/earnings/<user_id>', methods=['GET', 'POST'])
@handle_api_exceptions
def get_referral_earnings(user_id):
    """Отримання даних про заробітки рефералів користувача"""
    logger.info(f"get_referral_earnings: Запит на отримання заробітків для {user_id}")

    # Отримання опцій з запиту (для POST) або з параметрів URL (для GET)
    if request.method == 'POST':
        data = request.get_json() or {}
        logger.info(f"get_referral_earnings: Отримано POST-запит з даними: {json.dumps(data, default=str)}")
        options = data
    else:
        # Параметри фільтрації
        options = {
            'startDate': request.args.get('startDate'),
            'endDate': request.args.get('endDate'),
            'activeOnly': request.args.get('activeOnly') == 'true'
        }
        logger.info(f"get_referral_earnings: Отримано GET-запит з опціями: {json.dumps(options, default=str)}")

    result = EarningsController.get_referral_earnings(user_id, options)

    # Визначаємо код статусу відповіді
    status_code = 200 if result.get('success', False) else 400
    return jsonify(result), status_code


@referrals_bp.route('/api/referrals/earnings/detailed/<referral_id>', methods=['GET'])
@handle_api_exceptions
def get_detailed_earnings(referral_id):
    """Отримання детальних даних про заробітки конкретного реферала"""
    logger.info(f"get_detailed_earnings: Запит на отримання детальних заробітків для {referral_id}")

    # Обробляємо формат ідентифікатора (з або без 'WX')
    try:
        if isinstance(referral_id, str) and referral_id.startswith('WX'):
            real_id = referral_id[2:]  # Видаляємо 'WX' з початку
        else:
            real_id = referral_id
    except (ValueError, AttributeError) as e:
        logger.error(f"get_detailed_earnings: Невалідний ID реферала: {referral_id} - {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Invalid referral ID',
            'details': f'Cannot process referral ID: {referral_id}'
        }), 400

    result = EarningsController.get_detailed_earnings(real_id)

    # Визначаємо код статусу відповіді
    status_code = 200 if result.get('success', False) else 400
    return jsonify(result), status_code


@referrals_bp.route('/api/referrals/earnings/summary/<user_id>', methods=['GET'])
@handle_api_exceptions
def get_earnings_summary(user_id):
    """Отримання зведеної інформації про заробітки"""
    logger.info(f"get_earnings_summary: Запит на отримання зведених даних для {user_id}")
    result = EarningsController.get_earnings_summary(user_id)

    # Визначаємо код статусу відповіді
    status_code = 200 if result.get('success', False) else 400
    return jsonify(result), status_code


# Маршрути для відсоткових винагород
@referrals_bp.route('/api/referrals/reward/percentage', methods=['POST'])
@handle_api_exceptions
def calculate_percentage_reward():
    """Розрахунок і нарахування відсоткової винагороди"""
    data = request.get_json()
    logger.info(
        f"calculate_percentage_reward: Запит на розрахунок відсоткової винагороди: {json.dumps(data, default=str) if data else None}")

    # Валідація даних
    is_valid, error_message = validate_referral_data(
        data, ['user_id', 'referral_id', 'amount', 'level'])
    if not is_valid:
        logger.warning(f"calculate_percentage_reward: Валідація не пройдена - {error_message}")
        return jsonify({
            'success': False,
            'error': 'Missing required fields',
            'details': error_message
        }), 400

    user_id = data['user_id']
    referral_id = data['referral_id']
    amount = data['amount']
    level = data['level']

    # Додаткова валідація амаунт та рівня
    try:
        amount = float(amount)
        if amount <= 0:
            return jsonify({
                'success': False,
                'error': 'Invalid amount',
                'details': 'Amount must be greater than 0'
            }), 400
    except (ValueError, TypeError):
        return jsonify({
            'success': False,
            'error': 'Invalid amount type',
            'details': 'Amount must be a number'
        }), 400

    try:
        level = int(level)
        if level not in [1, 2]:
            return jsonify({
                'success': False,
                'error': 'Invalid level',
                'details': 'Level must be 1 or 2'
            }), 400
    except (ValueError, TypeError):
        return jsonify({
            'success': False,
            'error': 'Invalid level type',
            'details': 'Level must be a number'
        }), 400

    result = EarningsController.calculate_percentage_reward(user_id, referral_id, amount, level)

    # Визначаємо код статусу відповіді
    status_code = 200 if result.get('success', False) else 400
    return jsonify(result), status_code


@referrals_bp.route('/api/referrals/reward/history/<user_id>', methods=['GET'])
@handle_api_exceptions
def get_percentage_rewards(user_id):
    """Отримання історії відсоткових винагород"""
    logger.info(f"get_percentage_rewards: Запит на отримання історії відсоткових винагород для {user_id}")

    # Отримання опцій з параметрів URL
    options = {
        'startDate': request.args.get('startDate'),
        'endDate': request.args.get('endDate'),
        'level': int(request.args.get('level')) if request.args.get('level') else None
    }
    logger.info(f"get_percentage_rewards: Параметри фільтрації: {json.dumps(options, default=str)}")

    result = EarningsController.get_percentage_rewards(user_id, options)

    # Визначаємо код статусу відповіді
    status_code = 200 if result.get('success', False) else 400
    return jsonify(result), status_code


# Маршрути для активності рефералів
@referrals_bp.route('/api/referrals/activity/<user_id>', methods=['GET', 'POST'])
@handle_api_exceptions
def get_referral_activity(user_id):
    """Отримання даних про активність рефералів користувача"""
    logger.info(f"get_referral_activity: Запит на отримання активності рефералів для {user_id}")

    # Отримання опцій з запиту або з параметрів URL
    if request.method == 'POST':
        data = request.get_json() or {}
        logger.info(f"get_referral_activity: Отримано POST-запит з даними: {json.dumps(data, default=str)}")
        options = data
    else:
        # Параметри фільтрації
        options = {
            'startDate': request.args.get('startDate'),
            'endDate': request.args.get('endDate'),
            'level': int(request.args.get('level')) if request.args.get('level') else None,
            'activeOnly': request.args.get('activeOnly') == 'true'
        }
        logger.info(f"get_referral_activity: Отримано GET-запит з опціями: {json.dumps(options, default=str)}")

    result = ActivityController.get_referral_activity(user_id, options)

    # Визначаємо код статусу відповіді
    status_code = 200 if result.get('success', False) else 400
    return jsonify(result), status_code


@referrals_bp.route('/api/referrals/activity/detailed/<referral_id>', methods=['GET'])
@handle_api_exceptions
def get_referral_detailed_activity(referral_id):
    """Отримання детальних даних про активність конкретного реферала"""
    logger.info(f"get_referral_detailed_activity: Запит на отримання детальної активності для {referral_id}")

    # Обробляємо формат ідентифікатора (з або без 'WX')
    try:
        if isinstance(referral_id, str) and referral_id.startswith('WX'):
            real_id = referral_id[2:]  # Видаляємо 'WX' з початку
        else:
            real_id = referral_id
    except (ValueError, AttributeError) as e:
        logger.error(f"get_referral_detailed_activity: Невалідний ID реферала: {referral_id} - {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Invalid referral ID',
            'details': f'Cannot process referral ID: {referral_id}'
        }), 400

    result = ActivityController.get_referral_detailed_activity(real_id)

    # Визначаємо код статусу відповіді
    status_code = 200 if result.get('success', False) else 400
    return jsonify(result), status_code


@referrals_bp.route('/api/referrals/activity/summary/<user_id>', methods=['GET'])
@handle_api_exceptions
def get_activity_summary(user_id):
    """Отримання зведеної інформації про активність"""
    logger.info(f"get_activity_summary: Запит на отримання зведеної інформації про активність для {user_id}")
    result = ActivityController.get_activity_summary(user_id)

    # Визначаємо код статусу відповіді
    status_code = 200 if result.get('success', False) else 400
    return jsonify(result), status_code


@referrals_bp.route('/api/referrals/activity/update', methods=['POST'])
@handle_api_exceptions
def update_activity():
    """Оновлення активності реферала"""
    data = request.get_json()
    logger.info(f"update_activity: Запит на оновлення активності: {json.dumps(data, default=str) if data else None}")

    # Валідація даних
    is_valid, error_message = validate_referral_data(data, ['user_id'])
    if not is_valid:
        logger.warning(f"update_activity: Валідація не пройдена - {error_message}")
        return jsonify({
            'success': False,
            'error': 'Missing required fields',
            'details': error_message
        }), 400

    user_id = data['user_id']
    draws_participation = data.get('draws_participation')
    invited_referrals = data.get('invited_referrals')

    result = ActivityController.update_activity(user_id, draws_participation, invited_referrals)

    # Визначаємо код статусу відповіді
    status_code = 200 if result.get('success', False) else 400
    return jsonify(result), status_code


@referrals_bp.route('/api/referrals/activity/activate', methods=['POST'])
@handle_api_exceptions
def manually_activate_referral():
    """Ручна активація реферала"""
    data = request.get_json()
    logger.info(
        f"manually_activate_referral: Запит на ручну активацію: {json.dumps(data, default=str) if data else None}")

    # Валідація даних
    is_valid, error_message = validate_referral_data(data, ['user_id', 'admin_id'])
    if not is_valid:
        logger.warning(f"manually_activate_referral: Валідація не пройдена - {error_message}")
        return jsonify({
            'success': False,
            'error': 'Missing required fields',
            'details': error_message
        }), 400

    user_id = data['user_id']
    admin_id = data['admin_id']

    result = ActivityController.manually_activate(user_id, admin_id)

    # Визначаємо код статусу відповіді
    status_code = 200 if result.get('success', False) else 400
    return jsonify(result), status_code


# Додані маршрути для розіграшів
@referrals_bp.route('/api/referrals/draws/<referral_id>', methods=['GET'])
@handle_api_exceptions
def get_referral_draws(referral_id):
    """Отримує дані про участь реферала у розіграшах"""
    logger.info(f"get_referral_draws: Запит на отримання даних розіграшів для {referral_id}")

    # Обробляємо формат ідентифікатора (з або без 'WX')
    try:
        if isinstance(referral_id, str) and referral_id.startswith('WX'):
            real_id = referral_id[2:]  # Видаляємо 'WX' з початку
        else:
            real_id = referral_id
    except (ValueError, AttributeError) as e:
        logger.error(f"get_referral_draws: Невалідний ID реферала: {referral_id} - {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Invalid referral ID',
            'details': f'Cannot process referral ID: {referral_id}'
        }), 400

    result = DrawController.get_referral_draws(real_id)

    # Визначаємо код статусу відповіді
    status_code = 200 if result.get('success', False) else 400
    return jsonify(result), status_code


@referrals_bp.route('/api/referrals/draws/details/<referral_id>/<draw_id>', methods=['GET'])
@handle_api_exceptions
def get_draw_details(referral_id, draw_id):
    """Отримує детальні дані про участь реферала у конкретному розіграші"""
    logger.info(f"get_draw_details: Запит на отримання деталей розіграшу {draw_id} для реферала {referral_id}")

    # Обробляємо формат ідентифікатора реферала (з або без 'WX')
    try:
        if isinstance(referral_id, str) and referral_id.startswith('WX'):
            real_referral_id = referral_id[2:]  # Видаляємо 'WX' з початку
        else:
            real_referral_id = referral_id
    except (ValueError, AttributeError) as e:
        logger.error(f"get_draw_details: Невалідний ID реферала: {referral_id} - {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Invalid referral ID',
            'details': f'Cannot process referral ID: {referral_id}'
        }), 400

    # Валідація ID розіграшу
    try:
        draw_id = int(draw_id)
    except (ValueError, TypeError) as e:
        logger.error(f"get_draw_details: Невалідний ID розіграшу: {draw_id} - {str(e)}")
        return jsonify({
            'success': False,
            'error': 'Invalid draw ID',
            'details': f'Draw ID must be a number: {draw_id}'
        }), 400

    result = DrawController.get_draw_details(real_referral_id, draw_id)

    # Визначаємо код статусу відповіді
    status_code = 200 if result.get('success', False) else 400
    return jsonify(result), status_code


@referrals_bp.route('/api/referrals/draws/stats/<owner_id>', methods=['GET'])
@handle_api_exceptions
def get_draws_participation_stats(owner_id):
    """Отримує статистику участі рефералів у розіграшах за період"""
    logger.info(f"get_draws_participation_stats: Запит на отримання статистики участі в розіграшах для {owner_id}")

    # Параметри фільтрації
    options = {
        'startDate': request.args.get('startDate'),
        'endDate': request.args.get('endDate')
    }
    logger.info(f"get_draws_participation_stats: Параметри фільтрації: {json.dumps(options, default=str)}")

    result = DrawController.get_draws_participation_stats(owner_id, options)

    # Визначаємо код статусу відповіді
    status_code = 200 if result.get('success', False) else 400
    return jsonify(result), status_code


@referrals_bp.route('/api/referrals/draws/count/<owner_id>', methods=['GET'])
@handle_api_exceptions
def get_total_draws_count(owner_id):
    """Отримує загальну кількість розіграшів, у яких брали участь реферали"""
    logger.info(f"get_total_draws_count: Запит на отримання кількості розіграшів для {owner_id}")
    result = DrawController.get_total_draws_count(owner_id)

    # Визначаємо код статусу відповіді
    status_code = 200 if result.get('success', False) else 400
    return jsonify(result), status_code


@referrals_bp.route('/api/referrals/draws/active/<owner_id>', methods=['GET'])
@handle_api_exceptions
def get_most_active_in_draws(owner_id):
    """Отримує список найактивніших рефералів за участю в розіграшах"""
    logger.info(f"get_most_active_in_draws: Запит на отримання найактивніших рефералів для {owner_id}")

    # Параметр ліміту
    try:
        limit = int(request.args.get('limit', 10))
    except (ValueError, TypeError):
        logger.warning(f"get_most_active_in_draws: Невалідний параметр limit: {request.args.get('limit')}")
        limit = 10

    result = DrawController.get_most_active_in_draws(owner_id, limit)

    # Визначаємо код статусу відповіді
    status_code = 200 if result.get('success', False) else 400
    return jsonify(result), status_code


# Додані маршрути для історії реферальної активності
@referrals_bp.route('/api/referrals/history/<user_id>', methods=['GET'])
@handle_api_exceptions
def get_referral_history(user_id):
    """Отримує повну історію реферальної активності користувача"""
    logger.info(f"get_referral_history: Запит на отримання історії для {user_id}")

    # Параметри фільтрації
    try:
        options = {
            'startDate': request.args.get('startDate'),
            'endDate': request.args.get('endDate'),
            'limit': int(request.args.get('limit')) if request.args.get('limit') else None,
            'type': request.args.get('type')
        }
        logger.info(f"get_referral_history: Параметри фільтрації: {json.dumps(options, default=str)}")
    except (ValueError, TypeError) as e:
        logger.warning(f"get_referral_history: Невалідні параметри: {str(e)}")
        options = {}

    # Перевіряємо, чи HistoryController є методом або класом
    if hasattr(HistoryController, 'get_referral_history'):
        result = HistoryController.get_referral_history(user_id, options)
    else:
        # Запасний варіант, якщо контролер недоступний
        result = {
            'success': False,
            'error': 'HistoryController недоступний',
            'history': []
        }

    # Визначаємо код статусу відповіді
    status_code = 200 if result.get('success', False) else 400
    return jsonify(result), status_code


@referrals_bp.route('/api/referrals/history/event/<user_id>/<event_type>', methods=['GET'])
@handle_api_exceptions
def get_referral_event_history(user_id, event_type):
    """Отримує історію конкретного типу реферальної активності"""
    logger.info(f"get_referral_event_history: Запит на отримання історії типу {event_type} для {user_id}")

    # Валідація типу події
    valid_event_types = ['referral', 'bonus', 'reward', 'badge', 'task', 'draw']
    if event_type not in valid_event_types:
        logger.warning(f"get_referral_event_history: Невалідний тип події: {event_type}")
        return jsonify({
            'success': False,
            'error': 'Invalid event type',
            'details': f'Event type must be one of: {", ".join(valid_event_types)}'
        }), 400

    # Параметри фільтрації
    try:
        options = {
            'startDate': request.args.get('startDate'),
            'endDate': request.args.get('endDate'),
            'limit': int(request.args.get('limit')) if request.args.get('limit') else None
        }
        logger.info(f"get_referral_event_history: Параметри фільтрації: {json.dumps(options, default=str)}")
    except (ValueError, TypeError) as e:
        logger.warning(f"get_referral_event_history: Невалідні параметри: {str(e)}")
        options = {}

    result = HistoryController.get_referral_event_history(user_id, event_type, options)

    # Визначаємо код статусу відповіді
    status_code = 200 if result.get('success', False) else 400
    return jsonify(result), status_code


@referrals_bp.route('/api/referrals/history/summary/<user_id>', methods=['GET'])
@handle_api_exceptions
def get_referral_activity_summary(user_id):
    """Отримує агреговану статистику реферальної активності за період"""
    logger.info(f"get_referral_activity_summary: Запит на отримання зведеної статистики для {user_id}")

    # Параметри фільтрації
    options = {
        'startDate': request.args.get('startDate'),
        'endDate': request.args.get('endDate')
    }
    logger.info(f"get_referral_activity_summary: Параметри фільтрації: {json.dumps(options, default=str)}")

    result = HistoryController.get_referral_activity_summary(user_id, options)

    # Визначаємо код статусу відповіді
    status_code = 200 if result.get('success', False) else 400
    return jsonify(result), status_code


@referrals_bp.route('/api/referrals/history/trend/<user_id>/<period>', methods=['GET'])
@handle_api_exceptions
def get_referral_activity_trend(user_id, period):
    """Отримує статистику реферальної активності по періодах"""
    logger.info(f"get_referral_activity_trend: Запит на отримання тренду для {user_id} за період {period}")

    # Валідація періоду
    valid_periods = ['daily', 'weekly', 'monthly']
    if period not in valid_periods:
        logger.warning(f"get_referral_activity_trend: Невалідний період: {period}")
        return jsonify({
            'success': False,
            'error': 'Invalid period',
            'details': f'Period must be one of: {", ".join(valid_periods)}'
        }), 400

    # Параметри фільтрації
    try:
        options = {
            'startDate': request.args.get('startDate'),
            'endDate': request.args.get('endDate'),
            'limit': int(request.args.get('limit')) if request.args.get('limit') else None
        }
        logger.info(f"get_referral_activity_trend: Параметри фільтрації: {json.dumps(options, default=str)}")
    except (ValueError, TypeError) as e:
        logger.warning(f"get_referral_activity_trend: Невалідні параметри: {str(e)}")
        options = {}

    result = HistoryController.get_referral_activity_trend(user_id, period, options)

    # Визначаємо код статусу відповіді
    status_code = 200 if result.get('success', False) else 400
    return jsonify(result), status_code


# Маршрути для аналітики та рейтингу рефералів
@referrals_bp.route('/api/analytics/ranking/<user_id>', methods=['GET'])
@handle_api_exceptions
def get_referrals_ranking(user_id):
    """Отримання рейтингу рефералів"""
    logger.info(f"get_referrals_ranking: Запит на отримання рейтингу для {user_id}")

    # Параметр сортування
    sort_by = request.args.get('sortBy', 'earnings')

    # Валідація параметра сортування
    valid_sort_by = ['earnings', 'invites', 'draws', 'activity']
    if sort_by not in valid_sort_by:
        logger.warning(f"get_referrals_ranking: Невалідний параметр sortBy: {sort_by}")
        return jsonify({
            'success': False,
            'error': 'Invalid sortBy parameter',
            'details': f'sortBy must be one of: {", ".join(valid_sort_by)}'
        }), 400

    result = AnalyticsController.get_referrals_ranking(user_id, sort_by=sort_by)

    # Визначаємо код статусу відповіді
    status_code = 200 if result.get('success', False) else 400
    return jsonify(result), status_code


@referrals_bp.route('/api/analytics/top/<user_id>/<int:limit>', methods=['GET'])
@handle_api_exceptions
def get_top_referrals(user_id, limit):
    """Отримання топ-N рефералів"""
    logger.info(f"get_top_referrals: Запит на отримання топ-{limit} рефералів для {user_id}")

    # Валідація ліміту
    if limit <= 0 or limit > 100:
        logger.warning(f"get_top_referrals: Невалідний ліміт: {limit}")
        return jsonify({
            'success': False,
            'error': 'Invalid limit',
            'details': 'Limit must be between 1 and 100'
        }), 400

    # Параметр метрики
    metric = request.args.get('metric', 'earnings')

    # Валідація параметра метрики
    valid_metrics = ['earnings', 'invites', 'draws', 'activity']
    if metric not in valid_metrics:
        logger.warning(f"get_top_referrals: Невалідна метрика: {metric}")
        return jsonify({
            'success': False,
            'error': 'Invalid metric parameter',
            'details': f'metric must be one of: {", ".join(valid_metrics)}'
        }), 400

    result = AnalyticsController.get_top_referrals(user_id, limit=limit, metric=metric)

    # Визначаємо код статусу відповіді
    status_code = 200 if result.get('success', False) else 400
    return jsonify(result), status_code


@referrals_bp.route('/api/analytics/earnings/total/<user_id>', methods=['GET'])
@handle_api_exceptions
def get_total_earnings(user_id):
    """Отримання загального заробітку"""
    logger.info(f"get_total_earnings: Запит на отримання загального заробітку для {user_id}")
    result = AnalyticsController.get_total_earnings(user_id)

    # Визначаємо код статусу відповіді
    status_code = 200 if result.get('success', False) else 400
    return jsonify(result), status_code


@referrals_bp.route('/api/analytics/earnings/predict/<user_id>', methods=['GET'])
@handle_api_exceptions
def predict_earnings(user_id):
    """Отримання прогнозу майбутніх заробітків"""
    logger.info(f"predict_earnings: Запит на отримання прогнозу заробітків для {user_id}")
    result = AnalyticsController.predict_earnings(user_id)

    # Визначаємо код статусу відповіді
    status_code = 200 if result.get('success', False) else 400
    return jsonify(result), status_code


@referrals_bp.route('/api/analytics/earnings/roi/<user_id>', methods=['GET'])
@handle_api_exceptions
def get_earnings_roi(user_id):
    """Отримання рентабельності реферальної програми"""
    logger.info(f"get_earnings_roi: Запит на отримання ROI для {user_id}")
    result = AnalyticsController.get_earnings_roi(user_id)

    # Визначаємо код статусу відповіді
    status_code = 200 if result.get('success', False) else 400
    return jsonify(result), status_code


@referrals_bp.route('/api/analytics/earnings/distribution/<user_id>', methods=['GET'])
@handle_api_exceptions
def get_earnings_distribution(user_id):
    """Отримання розподілу заробітку за категоріями"""
    logger.info(f"get_earnings_distribution: Запит на отримання розподілу заробітку для {user_id}")
    result = AnalyticsController.get_earnings_distribution(user_id)

    # Визначаємо код статусу відповіді
    status_code = 200 if result.get('success', False) else 400
    return jsonify(result), status_code


@referrals_bp.route('/api/referrals/initialize/<user_id>', methods=['POST'])
@handle_api_exceptions
def initialize_user_data(user_id):
    """Ініціалізує всі необхідні дані для користувача"""
    from utils.data_initializer import DataInitializer

    logger.info(f"Запит на ініціалізацію даних для користувача {user_id}")
    result = DataInitializer.initialize_user_data(user_id)

    status_code = 200 if result.get('success', False) else 400
    return jsonify(result), status_code


@referrals_bp.route('/api/referrals/fix-all', methods=['POST'])
@handle_api_exceptions
def fix_all_users():
    """Виправляє дані для всіх користувачів (тільки для адміністраторів)"""
    from utils.data_initializer import DataInitializer

    # Тут можна додати перевірку прав адміністратора

    logger.info("Запит на виправлення даних для всіх користувачів")
    result = DataInitializer.fix_all_users()

    status_code = 200 if result.get('success', False) else 400
    return jsonify(result), status_code


# Ініціалізація Blueprint для маршрутів реферальної системи
def init_app(app):
    """Реєстрація blueprint в додатку Flask"""
    # Інформація про відключення лімітів запитів (якщо це налаштовано в середовищі)
    rate_limiting_disabled = app.config.get('DISABLE_RATE_LIMITING', False)
    if rate_limiting_disabled:
        logger.info("📢 Обмеження швидкості запитів відключено")

    logger.info("📢 Початок реєстрації маршрутів розіграшів")

    # Реєстрація Blueprint
    app.register_blueprint(referrals_bp)

    logger.info("✅ Маршрути для розіграшів успішно зареєстровано")
    return True