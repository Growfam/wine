"""
Модуль для реєстрації маршрутів API для реферальної системи.
Оптимізована версія з єдиною точкою входу та обробкою помилок.
"""
from flask import Blueprint, request, jsonify
import logging
from datetime import datetime
from referrals.controllers import (
    get_referral_code, get_user_referrals, use_referral_code,
    get_referral_tasks, claim_referral_reward, invite_referral,
    admin_process_pending_rewards
)

# Налаштування логування
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Створюємо Blueprint для реферальної системи
referrals_bp = Blueprint('referrals', __name__, url_prefix='/api')

# ВИПРАВЛЕНО: Визначаємо всі маршрути ДО їх реєстрації
@referrals_bp.route('/user/<telegram_id>/referral-code', methods=['GET'])
def api_get_referral_code(telegram_id):
    """Отримання реферального коду користувача"""
    return get_referral_code(telegram_id)

@referrals_bp.route('/user/<telegram_id>/referrals', methods=['GET'])
def api_get_user_referrals(telegram_id):
    """Отримання інформації про рефералів користувача"""
    return get_user_referrals(telegram_id)

@referrals_bp.route('/referrals/use-code', methods=['POST'])
def api_use_referral_code():
    """Використання реферального коду"""
    return use_referral_code()

# Маршрути для реферальних завдань
@referrals_bp.route('/user/<telegram_id>/referral-tasks', methods=['GET'])
def api_get_user_referral_tasks(telegram_id):
    """Отримання статусу реферальних завдань"""
    return get_referral_tasks(telegram_id)

@referrals_bp.route('/user/<telegram_id>/claim-referral-reward', methods=['POST'])
def api_claim_referral_reward(telegram_id):
    """Отримання винагороди за реферальне завдання"""
    return claim_referral_reward(telegram_id)

@referrals_bp.route('/user/<telegram_id>/invite-referral', methods=['POST'])
def api_invite_referral(telegram_id):
    """Запросити нового реферала"""
    return invite_referral(telegram_id)

# Адміністративні маршрути
@referrals_bp.route('/admin/referrals/process-pending', methods=['POST'])
def api_admin_process_pending_rewards():
    """Обробити всі очікуючі реферальні винагороди"""
    return admin_process_pending_rewards()

def register_referrals_routes(app):
    """
    Реєстрація всіх маршрутів для API реферальної системи.

    Args:
        app: Екземпляр Flask-додатку
    """
    logger.info("Реєстрація маршрутів API для реферальної системи")

    # ВИПРАВЛЕНО: Реєструємо Blueprint ПІСЛЯ визначення всіх маршрутів
    app.register_blueprint(referrals_bp)

    logger.info("Маршрути API для реферальної системи успішно зареєстровано")
    return True