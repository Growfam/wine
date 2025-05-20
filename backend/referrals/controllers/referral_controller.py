from models.referral import Referral
from database import db
from flask import current_app
from sqlalchemy.exc import SQLAlchemyError
import logging
import os
import sys
import traceback

# Налаштування додаткового логування
logger = logging.getLogger(__name__)


class ReferralController:
    """
    Контролер для управління реферальними зв'язками
    """

    @staticmethod
    def generate_referral_link(user_id):
        """
        Генерує реферальне посилання для користувача

        Args:
            user_id (int): ID користувача

        Returns:
            dict: Словник з реферальним посиланням
        """
        try:
            # Перетворюємо ID в рядок для уникнення помилок типів
            user_id = str(user_id)

            # Новий формат посилання: https://t.me/WINIX_Official_bot?start={user_id}
            referral_link = f"https://t.me/WINIX_Official_bot?start={user_id}"
            return {
                'success': True,
                'user_id': user_id,
                'referral_link': referral_link
            }
        except Exception as e:
            current_app.logger.error(f"Error generating referral link: {str(e)}")
            current_app.logger.error(traceback.format_exc())
            return {
                'success': False,
                'error': 'Failed to generate referral link',
                'details': str(e)
            }

    @staticmethod
    def register_referral(referrer_id, referee_id):
        """
        Реєструє нового реферала і створює реферальний зв'язок

        Args:
            referrer_id (int): ID користувача-реферера
            referee_id (int): ID нового користувача-реферала

        Returns:
            dict: Результат операції
        """
        try:
            # Перетворюємо ID в рядки для уникнення помилок типів
            referrer_id = str(referrer_id)
            referee_id = str(referee_id)

            current_app.logger.info(
                f"register_referral: Початок реєстрації реферального зв'язку: {referrer_id} -> {referee_id}")

            # Перевірка стану бази даних
            if db is None:
                current_app.logger.error("register_referral: Об'єкт db не ініціалізовано")
                return {
                    'success': False,
                    'error': 'Database not initialized',
                    'details': 'Database object is not properly initialized'
                }

            # Перевірка, чи реферал вже зареєстрований
            existing_referral = Referral.query.filter_by(referee_id=referee_id).first()
            if existing_referral:
                current_app.logger.warning(
                    f"register_referral: Користувач {referee_id} вже зареєстрований як реферал для {existing_referral.referrer_id}")
                return {
                    'success': False,
                    'error': 'User is already registered as a referral',
                    'details': f'Referee ID {referee_id} is already linked to referrer ID {existing_referral.referrer_id}'
                }

            # Перевірка, що користувач не реєструє себе як реферала
            if referrer_id == referee_id:
                current_app.logger.warning(f"register_referral: Спроба самореферальства: {referrer_id}")
                return {
                    'success': False,
                    'error': 'User cannot refer themselves',
                    'details': 'Referrer ID and referee ID must be different'
                }

            # Створення запису про прямого реферала (1-й рівень)
            try:
                current_app.logger.info(
                    f"register_referral: Створення запису про реферала 1-го рівня: {referrer_id} -> {referee_id}")
                new_referral = Referral(referrer_id=referrer_id, referee_id=referee_id, level=1)
                db.session.add(new_referral)
                db.session.flush()  # Flush без commit для перевірки помилок
                current_app.logger.info(f"register_referral: Запис про реферала 1-го рівня успішно створено")
            except SQLAlchemyError as e:
                db.session.rollback()
                current_app.logger.error(
                    f"register_referral: Помилка створення запису про реферала 1-го рівня: {str(e)}")
                return {
                    'success': False,
                    'error': 'Database error during referral creation',
                    'details': str(e)
                }

            # Знаходимо реферера для поточного реферера (якщо є), щоб створити зв'язок 2-го рівня
            try:
                higher_referral = Referral.query.filter_by(referee_id=referrer_id).first()
                if higher_referral:
                    current_app.logger.info(
                        f"register_referral: Знайдено реферала 2-го рівня: {higher_referral.referrer_id} -> {referee_id}")
                    # Створення запису про реферала 2-го рівня
                    second_level_referral = Referral(
                        referrer_id=higher_referral.referrer_id,
                        referee_id=referee_id,
                        level=2
                    )
                    db.session.add(second_level_referral)
                    db.session.flush()
                    current_app.logger.info(f"register_referral: Запис про реферала 2-го рівня успішно створено")
            except SQLAlchemyError as e:
                db.session.rollback()
                current_app.logger.error(
                    f"register_referral: Помилка створення запису про реферала 2-го рівня: {str(e)}")
                return {
                    'success': False,
                    'error': 'Database error during second level referral creation',
                    'details': str(e)
                }

            # Зберігаємо всі зміни в базі даних
            try:
                db.session.commit()
                current_app.logger.info(f"register_referral: Всі зміни успішно збережено в базі даних")
            except SQLAlchemyError as e:
                db.session.rollback()
                current_app.logger.error(f"register_referral: Помилка збереження змін: {str(e)}")
                return {
                    'success': False,
                    'error': 'Database error during commit',
                    'details': str(e)
                }

            current_app.logger.info(
                f"register_referral: Реферальний зв'язок {referrer_id} -> {referee_id} успішно зареєстровано")
            return {
                'success': True,
                'message': 'Referral successfully registered',
                'referral': new_referral.to_dict()
            }
        except SQLAlchemyError as e:
            db.session.rollback()
            current_app.logger.error(f"Database error during referral registration: {str(e)}")
            current_app.logger.error(traceback.format_exc())
            return {
                'success': False,
                'error': 'Database error during referral registration',
                'details': str(e)
            }
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Error registering referral: {str(e)}")
            current_app.logger.error(traceback.format_exc())
            return {
                'success': False,
                'error': 'Failed to register referral',
                'details': str(e)
            }

    @staticmethod
    def get_referral_structure(user_id):
        """
        Отримує структуру рефералів користувача (1-го та 2-го рівнів)

        Args:
            user_id (int): ID користувача

        Returns:
            dict: Структура рефералів користувача
        """
        try:
            # Перетворюємо ID в рядок для уникнення помилок типів
            user_id = str(user_id)

            # Отримання рефералів 1-го рівня
            level1_referrals = Referral.query.filter_by(referrer_id=user_id, level=1).all()

            # Отримання рефералів 2-го рівня
            level2_referrals = Referral.query.filter_by(referrer_id=user_id, level=2).all()

            # Формування відповіді для фронтенду
            return {
                'success': True,
                'user': {
                    'id': user_id,
                    'registrationDate': '2024-01-15T10:30:00Z'  # У реальному додатку беремо з БД
                },
                'referrals': {
                    'level1': [ReferralController._format_referral_data(ref) for ref in level1_referrals],
                    'level2': [ReferralController._format_referral_data(ref, with_referrer_id=True) for ref in
                               level2_referrals]
                },
                'statistics': {
                    'totalReferrals': len(level1_referrals) + len(level2_referrals),
                    'level1Count': len(level1_referrals),
                    'level2Count': len(level2_referrals),
                    'activeReferrals': ReferralController._count_active_referrals(level1_referrals, level2_referrals),
                    'inactiveReferrals': len(level1_referrals) + len(level2_referrals) -
                                         ReferralController._count_active_referrals(level1_referrals, level2_referrals),
                    'conversionRate': ReferralController._calculate_conversion_rate(level1_referrals, level2_referrals)
                }
            }
        except Exception as e:
            current_app.logger.error(f"Error getting referral structure: {str(e)}")
            current_app.logger.error(traceback.format_exc())
            return {
                'success': False,
                'error': 'Failed to get referral structure',
                'details': str(e)
            }

    @staticmethod
    def _format_referral_data(referral, with_referrer_id=False):
        """
        Форматує дані про реферала у формат, який очікує фронтенд

        Args:
            referral (Referral): Об'єкт реферала
            with_referrer_id (bool): Чи додавати referrerId до відповіді (для 2-го рівня)

        Returns:
            dict: Відформатовані дані про реферала
        """
        # У реальній системі ці дані будуть братися з бази даних
        is_active = (int(referral.referee_id) % 2 == 1)  # Для прикладу: непарні ID активні

        result = {
            'id': f'WX{referral.referee_id}',
            'registrationDate': referral.created_at.isoformat(),
            'active': is_active
        }

        if with_referrer_id:
            # Знаходимо реферера 1-го рівня для цього реферала 2-го рівня
            first_level_ref = Referral.query.filter_by(
                referee_id=referral.referee_id,
                level=1
            ).first()

            if first_level_ref:
                result['referrerId'] = f'WX{first_level_ref.referrer_id}'

        return result

    @staticmethod
    def _count_active_referrals(level1_referrals, level2_referrals):
        """
        Підраховує кількість активних рефералів

        Args:
            level1_referrals (list): Список рефералів 1-го рівня
            level2_referrals (list): Список рефералів 2-го рівня

        Returns:
            int: Кількість активних рефералів
        """
        # У реальній системі активність визначатиметься за даними з бази
        try:
            active_level1 = sum(1 for ref in level1_referrals if int(ref.referee_id) % 2 == 1)
            active_level2 = sum(1 for ref in level2_referrals if int(ref.referee_id) % 2 == 1)
            return active_level1 + active_level2
        except (ValueError, TypeError) as e:
            current_app.logger.error(f"Error counting active referrals: {str(e)}")
            # Запобіжний механізм на випадок помилок перетворення типів
            return 0

    @staticmethod
    def _calculate_conversion_rate(level1_referrals, level2_referrals):
        """
        Розраховує конверсію (відсоток активних рефералів)

        Args:
            level1_referrals (list): Список рефералів 1-го рівня
            level2_referrals (list): Список рефералів 2-го рівня

        Returns:
            float: Конверсія від 0 до 1
        """
        total = len(level1_referrals) + len(level2_referrals)
        if total == 0:
            return 0

        active = ReferralController._count_active_referrals(level1_referrals, level2_referrals)
        return active / total