from models.direct_bonus import DirectBonus
from models.referral import Referral
from database import db
from flask import jsonify, current_app
from sqlalchemy.exc import SQLAlchemyError
from datetime import datetime
import logging
import traceback

# Налаштування додаткового логування
logger = logging.getLogger(__name__)


class BonusController:
    """
    Контролер для управління прямими бонусами за запрошення рефералів
    """

    @staticmethod
    def award_direct_bonus(referrer_id, referee_id, amount=50):
        """
        Нараховує прямий бонус за запрошення реферала

        Args:
            referrer_id (int): ID користувача, який отримує бонус
            referee_id (int): ID запрошеного користувача
            amount (int, optional): Сума бонусу. Defaults to 50.

        Returns:
            dict: Результат операції
        """
        try:
            # Перетворюємо ID в рядки для уникнення помилок типів
            referrer_id = str(referrer_id)
            referee_id = str(referee_id)

            current_app.logger.info(
                f"award_direct_bonus: Нарахування бонусу {referrer_id} -> {referee_id}, сума: {amount}")

            # Перевірка стану бази даних
            if db is None:
                current_app.logger.error("award_direct_bonus: Об'єкт db не ініціалізовано")
                return {
                    'success': False,
                    'error': 'Database not initialized',
                    'details': 'Database object is not properly initialized'
                }

            # Перевірка, чи існує реферальний зв'язок
            referral = Referral.query.filter_by(
                referrer_id=referrer_id,
                referee_id=referee_id,
                level=1
            ).first()

            if not referral:
                current_app.logger.warning(
                    f"award_direct_bonus: Реферальний зв'язок між {referrer_id} і {referee_id} не знайдено")

                # Спроба створити реферальний зв'язок, якщо його не існує
                try:
                    from referrals.controllers.referral_controller import ReferralController
                    current_app.logger.info(f"award_direct_bonus: Спроба створити реферальний зв'язок")

                    ref_result = ReferralController.register_referral(
                        referrer_id=referrer_id,
                        referee_id=referee_id
                    )

                    if not ref_result.get('success', False):
                        return {
                            'success': False,
                            'error': 'No referral relationship found and failed to create one',
                            'details': f'No level 1 referral link between referrer {referrer_id} and referee {referee_id}'
                        }

                    # Отримуємо створений зв'язок
                    referral = Referral.query.filter_by(
                        referrer_id=referrer_id,
                        referee_id=referee_id,
                        level=1
                    ).first()
                except ImportError:
                    current_app.logger.error("award_direct_bonus: Не вдалося імпортувати ReferralController")
                    return {
                        'success': False,
                        'error': 'No referral relationship found',
                        'details': f'No level 1 referral link between referrer {referrer_id} and referee {referee_id}'
                    }
                except Exception as e:
                    current_app.logger.error(f"award_direct_bonus: Помилка створення реферального зв'язку: {str(e)}")
                    return {
                        'success': False,
                        'error': 'Failed to create referral relationship',
                        'details': str(e)
                    }

            # Якщо все ще немає зв'язку, повертаємо помилку
            if not referral:
                return {
                    'success': False,
                    'error': 'No referral relationship found',
                    'details': f'No level 1 referral link between referrer {referrer_id} and referee {referee_id}'
                }

            # Перевірка, чи бонус вже був нарахований
            existing_bonus = DirectBonus.query.filter_by(referee_id=referee_id).first()
            if existing_bonus:
                current_app.logger.warning(
                    f"award_direct_bonus: Бонус вже нараховано: {existing_bonus.amount} для {existing_bonus.referrer_id}")
                return {
                    'success': False,
                    'error': 'Bonus already awarded for this referral',
                    'details': f'Bonus of {existing_bonus.amount} already awarded to referrer {existing_bonus.referrer_id}'
                }

            # Нарахування бонусу
            try:
                current_app.logger.info(
                    f"award_direct_bonus: Створення запису бонусу: {referrer_id} -> {referee_id}, сума: {amount}")
                new_bonus = DirectBonus(
                    referrer_id=referrer_id,
                    referee_id=referee_id,
                    amount=amount
                )
                db.session.add(new_bonus)
                db.session.commit()
                current_app.logger.info(f"award_direct_bonus: Бонус успішно нараховано")
            except SQLAlchemyError as e:
                db.session.rollback()
                current_app.logger.error(f"award_direct_bonus: Помилка збереження бонусу: {str(e)}")
                return {
                    'success': False,
                    'error': 'Database error during bonus award',
                    'details': str(e)
                }

            # Збереження транзакції в таблиці transactions
            try:
                # Імпортуємо supabase_client для запису транзакції
                from supabase_client import supabase
                if supabase:
                    transaction_data = {
                        "telegram_id": referrer_id,
                        "type": "referral_bonus",
                        "amount": amount,
                        "description": f"Реферальний бонус за користувача {referee_id}",
                        "status": "completed",
                        "created_at": datetime.now().isoformat(),
                        "updated_at": datetime.now().isoformat()
                    }
                    supabase.table("transactions").insert(transaction_data).execute()
                    current_app.logger.info(f"award_direct_bonus: Транзакцію записано в таблицю transactions")
            except ImportError:
                current_app.logger.warning("award_direct_bonus: Не вдалося імпортувати supabase_client")
            except Exception as e:
                current_app.logger.warning(f"award_direct_bonus: Помилка запису транзакції: {str(e)}")
                # Продовжуємо виконання, оскільки це не критична помилка

            return {
                'success': True,
                'message': 'Direct bonus successfully awarded',
                'bonus': new_bonus.to_dict()
            }
        except SQLAlchemyError as e:
            db.session.rollback()
            current_app.logger.error(f"Database error during bonus award: {str(e)}")
            current_app.logger.error(traceback.format_exc())
            return {
                'success': False,
                'error': 'Database error during bonus award',
                'details': str(e)
            }
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Error awarding direct bonus: {str(e)}")
            current_app.logger.error(traceback.format_exc())
            return {
                'success': False,
                'error': 'Failed to award direct bonus',
                'details': str(e)
            }

    @staticmethod
    def get_bonus_history(user_id):
        """
        Отримує історію нарахованих прямих бонусів для користувача

        Args:
            user_id (int): ID користувача

        Returns:
            dict: Історія нарахованих бонусів
        """
        try:
            # Перетворюємо ID в рядок для уникнення помилок типів
            user_id = str(user_id)

            # Отримання всіх бонусів, де користувач є реферером
            bonuses = DirectBonus.query.filter_by(referrer_id=user_id).all()

            # Підрахунок загальної суми бонусів
            total_amount = sum(bonus.amount for bonus in bonuses)

            # Форматування бонусів для відповіді
            formatted_bonuses = []
            for bonus in bonuses:
                formatted_bonus = {
                    'id': bonus.id,
                    'referrer_id': bonus.referrer_id,
                    'referee_id': bonus.referee_id,
                    'amount': bonus.amount,
                    'created_at': bonus.created_at.isoformat(),
                    # Додаткові дані для відображення на фронтенді
                    'referee_info': {
                        'id': f'WX{bonus.referee_id}',
                        'registrationDate': bonus.created_at.isoformat()
                    }
                }
                formatted_bonuses.append(formatted_bonus)

            return {
                'success': True,
                'user_id': user_id,
                'total_bonuses': len(bonuses),
                'total_amount': total_amount,
                'bonuses': formatted_bonuses
            }
        except Exception as e:
            current_app.logger.error(f"Error getting bonus history: {str(e)}")
            current_app.logger.error(traceback.format_exc())
            return {
                'success': False,
                'error': 'Failed to get bonus history',
                'details': str(e)
            }