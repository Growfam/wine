from flask import Blueprint, request, jsonify, current_app
from badges.controllers import BadgeController, TaskController

badges_bp = Blueprint('badges', __name__)


# Маршрути для бейджів
@badges_bp.route('/api/badges/<int:user_id>', methods=['GET'])
def get_user_badges(user_id):
    """Отримання інформації про бейджі користувача"""
    result = BadgeController.get_user_badges(user_id)
    return jsonify(result)


@badges_bp.route('/api/badges/check/<int:user_id>', methods=['POST'])
def check_badges(user_id):
    """Перевірка та нарахування бейджів"""
    result = BadgeController.check_badges(user_id)
    return jsonify(result)


@badges_bp.route('/api/badges/claim', methods=['POST'])
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
@badges_bp.route('/api/tasks/<int:user_id>', methods=['GET'])
def get_user_tasks(user_id):
    """Отримання інформації про завдання користувача"""
    result = TaskController.get_user_tasks(user_id)
    return jsonify(result)


@badges_bp.route('/api/tasks/update/<int:user_id>', methods=['POST'])
def update_tasks(user_id):
    """Оновлення прогресу завдань"""
    result = TaskController.update_tasks(user_id)
    return jsonify(result)


@badges_bp.route('/api/tasks/claim', methods=['POST'])
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


# Ініціалізація Blueprint для маршрутів бейджів та завдань
def init_app(app):
    """Реєстрація blueprint в додатку Flask"""
    app.register_blueprint(badges_bp)