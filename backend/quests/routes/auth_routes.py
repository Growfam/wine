"""
Міст авторизації для системи завдань WINIX
Файл: backend/quests/routes/auth_routes.py (замінити існуючий)

Цей файл просто перенаправляє всі запити на основну систему авторизації
"""

import logging
from flask import Blueprint, jsonify

logger = logging.getLogger(__name__)

# Створюємо Blueprint для сумісності
auth_bp = Blueprint('winix_auth_bridge', __name__, url_prefix='/api/quests/auth')


@auth_bp.route('/info', methods=['GET'])
def auth_info():
    """Інформація про систему авторизації"""
    return jsonify({
        'status': 'info',
        'message': 'Система завдань використовує основну авторизацію WINIX',
        'auth_endpoints': {
            'authenticate': '/api/auth/telegram',
            'refresh': '/api/auth/refresh',
            'validate': '/api/auth/validate',
            'status': '/api/auth/status',
            'logout': '/api/auth/logout'
        },
        'deprecated_notice': 'Цей endpoint застарілий. Використовуйте /api/auth/* замість /api/quests/auth/*'
    }), 200


# Функція реєстрації (для сумісності)
def register_auth_routes(app):
    """Реєстрація auth маршрутів (для сумісності)"""
    app.register_blueprint(auth_bp)
    logger.info("✅ Quest auth bridge зареєстровано (перенаправлення на основну систему)")
    return True


# Експорт для сумісності
__all__ = ['auth_bp', 'register_auth_routes']