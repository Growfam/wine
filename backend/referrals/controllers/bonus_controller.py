from models.direct_bonus import DirectBonus
from models.referral import Referral
from database import db
from flask import jsonify, current_app
from sqlalchemy.exc import SQLAlchemyError
from datetime import datetime


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
            # Перевірка, чи існує реферальний зв'язок
            referral = Referral.query.filter_by(
                referrer_id=referrer_id,
                referee_id=referee_id,
                level=1
            ).first()

            if not referral:
                return {
                    'success': False,
                    'error': 'No referral relationship found',
                    'details': f'No level 1 referral link between referrer {referrer_id} and referee {referee_id}'
                }

            # Перевірка, чи бонус вже був нарахований
            existing_bonus = DirectBonus.query.filter_by(referee_id=referee_id).first()
            if existing_bonus:
                return {
                    'success': False,
                    'error': 'Bonus already awarded for this referral',
                    'details': f'Bonus of {existing_bonus.amount} already awarded to referrer {existing_bonus.referrer_id}'
                }

            # Нарахування бонусу
            new_bonus = DirectBonus(
                referrer_id=referrer_id,
                referee_id=referee_id,
                amount=amount
            )
            db.session.add(new_bonus)
            db.session.commit()

            return {
                'success': True,
                'message': 'Direct bonus successfully awarded',
                'bonus': new_bonus.to_dict()
            }
        except SQLAlchemyError as e:
            db.session.rollback()
            current_app.logger.error(f"Database error during bonus award: {str(e)}")
            return {
                'success': False,
                'error': 'Database error during bonus award',
                'details': str(e)
            }
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Error awarding direct bonus: {str(e)}")
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
            return {
                'success': False,
                'error': 'Failed to get bonus history',
                'details': str(e)
            }