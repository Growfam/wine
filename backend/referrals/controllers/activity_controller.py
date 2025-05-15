from models.activity import ReferralActivity
from models.referral import Referral
from main import db
from flask import current_app
from sqlalchemy.exc import SQLAlchemyError
from datetime import datetime


class ActivityController:
    """
    Контролер для управління активністю рефералів
    """

    @staticmethod
    def update_activity(user_id, draws_participation=None, invited_referrals=None):
        """
        Оновлює активність реферала

        Args:
            user_id (int): ID користувача (реферала)
            draws_participation (int, optional): Кількість участі у розіграшах. Defaults to None.
            invited_referrals (int, optional): Кількість запрошених рефералів. Defaults to None.

        Returns:
            dict: Результат операції
        """
        try:
            # Знаходимо запис активності або створюємо новий
            activity = ReferralActivity.query.filter_by(user_id=user_id).first()
            if activity is None:
                activity = ReferralActivity(user_id=user_id)
                db.session.add(activity)

            # Оновлюємо значення, якщо вони надані
            if draws_participation is not None:
                activity.draws_participation = draws_participation

            if invited_referrals is not None:
                activity.invited_referrals = invited_referrals

            # Перевіряємо активність
            activity.check_activity()

            db.session.commit()

            return {
                'success': True,
                'message': 'Activity updated successfully',
                'activity': activity.to_dict()
            }
        except SQLAlchemyError as e:
            db.session.rollback()
            current_app.logger.error(f"Database error during activity update: {str(e)}")
            return {
                'success': False,
                'error': 'Database error during activity update',
                'details': str(e)
            }
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Error updating activity: {str(e)}")
            return {
                'success': False,
                'error': 'Failed to update activity',
                'details': str(e)
            }

    @staticmethod
    def manually_activate(user_id, admin_id):
        """
        Вручну активує реферала

        Args:
            user_id (int): ID користувача (реферала)
            admin_id (int): ID адміністратора, який активує

        Returns:
            dict: Результат операції
        """
        try:
            # Знаходимо запис активності або створюємо новий
            activity = ReferralActivity.query.filter_by(user_id=user_id).first()
            if activity is None:
                activity = ReferralActivity(
                    user_id=user_id,
                    is_active=True,
                    reason_for_activity='manual_activation'
                )
                db.session.add(activity)
                activation_result = True
            else:
                activation_result = activity.activate_manually()

            db.session.commit()

            return {
                'success': True,
                'message': 'Referral manually activated' if activation_result else 'Referral already activated manually',
                'activity': activity.to_dict(),
                'admin_id': admin_id
            }
        except SQLAlchemyError as e:
            db.session.rollback()
            current_app.logger.error(f"Database error during manual activation: {str(e)}")
            return {
                'success': False,
                'error': 'Database error during manual activation',
                'details': str(e)
            }
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Error during manual activation: {str(e)}")
            return {
                'success': False,
                'error': 'Failed to manually activate referral',
                'details': str(e)
            }

    @staticmethod
    def get_referral_activity(user_id, options=None):
        """
        Отримує дані про активність рефералів користувача

        Args:
            user_id (int): ID користувача
            options (dict, optional): Додаткові опції для фільтрації.
                Може містити ключі: 'startDate', 'endDate', 'level', 'activeOnly'

        Returns:
            dict: Дані про активність рефералів
        """
        if options is None:
            options = {}

        try:
            # Отримання рефералів користувача
            level1_query = Referral.query.filter_by(referrer_id=user_id, level=1)
            level2_query = Referral.query.filter_by(referrer_id=user_id, level=2)

            # Фільтрація за рівнем, якщо вказано
            if 'level' in options and options['level'] in [1, 2]:
                if options['level'] == 1:
                    level2_query = db.session.query(Referral).filter_by(id=-1)  # Порожній запит
                else:
                    level1_query = db.session.query(Referral).filter_by(id=-1)  # Порожній запит

            level1_referrals = level1_query.all()
            level2_referrals = level2_query.all()

            # Збираємо ID всіх рефералів
            referral_ids = [ref.referee_id for ref in level1_referrals] + [ref.referee_id for ref in level2_referrals]

            # Отримуємо активність всіх рефералів
            activities = ReferralActivity.query.filter(ReferralActivity.user_id.in_(referral_ids)).all()

            # Створюємо мапу активності для швидкого доступу
            activity_map = {act.user_id: act for act in activities}

            # Підготовлюємо дані про активність рефералів
            level1_activities = []
            level2_activities = []

            # Заповнюємо дані про активність для рефералів 1-го рівня
            for referral in level1_referrals:
                activity_data = ActivityController._prepare_activity_data(
                    referral.referee_id,
                    activity_map.get(referral.referee_id)
                )

                # Фільтрація за активністю, якщо вказано
                if options.get('activeOnly', False) and not activity_data['isActive']:
                    continue

                level1_activities.append(activity_data)

            # Заповнюємо дані про активність для рефералів 2-го рівня
            for referral in level2_referrals:
                # Знаходимо реферера 1-го рівня для цього реферала 2-го рівня
                referrer_1lvl = Referral.query.filter_by(
                    referee_id=referral.referee_id,
                    level=1
                ).first()

                activity_data = ActivityController._prepare_activity_data(
                    referral.referee_id,
                    activity_map.get(referral.referee_id)
                )

                # Додаємо referrerId для рефералів 2-го рівня
                if referrer_1lvl:
                    activity_data['referrerId'] = f'WX{referrer_1lvl.referrer_id}'

                # Фільтрація за активністю, якщо вказано
                if options.get('activeOnly', False) and not activity_data['isActive']:
                    continue

                level2_activities.append(activity_data)

            return {
                'success': True,
                'userId': user_id,
                'timestamp': datetime.utcnow().isoformat(),
                'level1Activity': level1_activities,
                'level2Activity': level2_activities
            }
        except Exception as e:
            current_app.logger.error(f"Error getting referral activity: {str(e)}")
            return {
                'success': False,
                'error': 'Failed to get referral activity',
                'details': str(e)
            }

    @staticmethod
    def get_referral_detailed_activity(referral_id):
        """
        Отримує детальні дані про активність конкретного реферала

        Args:
            referral_id (int): ID реферала

        Returns:
            dict: Детальні дані про активність
        """
        try:
            # Отримуємо активність реферала
            activity = ReferralActivity.query.filter_by(user_id=referral_id).first()

            if not activity:
                # Якщо запис активності відсутній, повертаємо базові дані
                return {
                    'success': True,
                    'id': f'WX{referral_id}',
                    'timestamp': datetime.utcnow().isoformat(),
                    'drawsParticipation': 0,
                    'invitedReferrals': 0,
                    'lastActivityDate': None,
                    'isActive': False,
                    'manuallyActivated': False,
                    'meetsDrawsCriteria': False,
                    'meetsInvitedCriteria': False,
                    'reasonForActivity': None,
                    'drawsHistory': [],
                    'invitedReferralsList': [],
                    'manualActivationInfo': None
                }

            # Отримуємо дані для drawsHistory (в реальному додатку - з таблиці draw_participants)
            # Для тестування генеруємо моковані дані
            draws_history = []
            for i in range(activity.draws_participation):
                draws_history.append({
                    'drawId': f'DRAW{1000 + i}',
                    'date': (datetime.utcnow().replace(day=datetime.utcnow().day - (i + 1) * 7)).isoformat(),
                    'prizeName': ['Winix', 'Tokens', 'Bonus', 'Gift Card'][i % 4],
                    'prizeAmount': (i + 1) * 100 + 50
                })

            # Отримуємо дані для invitedReferralsList (в реальному додатку - з таблиці referrals)
            # Для тестування генеруємо моковані дані
            invited_referrals_list = []
            for i in range(activity.invited_referrals):
                invited_referrals_list.append({
                    'id': f'WX{3000 + i}',
                    'registrationDate': (
                        datetime.utcnow().replace(day=datetime.utcnow().day - (i + 1) * 10)).isoformat(),
                    'isActive': i % 3 != 0  # 2/3 запрошених активні
                })

            # Інформація про ручну активацію (якщо є)
            manual_activation_info = None
            if activity.reason_for_activity == 'manual_activation':
                manual_activation_info = {
                    'activatedBy': 'admin',
                    'activationDate': activity.last_updated.isoformat(),
                    'reason': 'Special program'
                }

            # Формуємо відповідь у форматі, очікуваному фронтендом
            meets_draws_criteria = activity.draws_participation >= 3
            meets_invited_criteria = activity.invited_referrals >= 1

            return {
                'success': True,
                'id': f'WX{referral_id}',
                'timestamp': datetime.utcnow().isoformat(),
                'drawsParticipation': activity.draws_participation,
                'invitedReferrals': activity.invited_referrals,
                'lastActivityDate': activity.last_updated.isoformat(),
                'isActive': activity.is_active,
                'manuallyActivated': activity.reason_for_activity == 'manual_activation',
                'meetsDrawsCriteria': meets_draws_criteria,
                'meetsInvitedCriteria': meets_invited_criteria,
                'reasonForActivity': activity.reason_for_activity,
                'drawsHistory': draws_history,
                'invitedReferralsList': invited_referrals_list,
                'manualActivationInfo': manual_activation_info
            }
        except Exception as e:
            current_app.logger.error(f"Error getting detailed activity: {str(e)}")
            return {
                'success': False,
                'error': 'Failed to get detailed activity',
                'details': str(e)
            }

    @staticmethod
    def get_activity_summary(user_id):
        """
        Отримує зведені дані про активність всіх рефералів користувача

        Args:
            user_id (int): ID користувача

        Returns:
            dict: Зведена інформація про активність
        """
        try:
            # Отримуємо дані про активність рефералів
            activity_result = ActivityController.get_referral_activity(user_id)

            if not activity_result['success']:
                return activity_result

            level1_activity = activity_result['level1Activity']
            level2_activity = activity_result['level2Activity']

            # Підраховуємо загальну кількість рефералів
            total_referrals = len(level1_activity) + len(level2_activity)

            # Підраховуємо кількість активних рефералів
            active_level1 = sum(1 for ref in level1_activity if ref['isActive'])
            active_level2 = sum(1 for ref in level2_activity if ref['isActive'])
            total_active = active_level1 + active_level2

            # Розраховуємо конверсію (відсоток активних рефералів)
            conversion_rate = total_active / total_referrals if total_referrals > 0 else 0

            # Підраховуємо кількість рефералів за причиною активності
            activity_reasons = {
                'draws_criteria': 0,
                'invited_criteria': 0,
                'both_criteria': 0,
                'manual_activation': 0
            }

            for activity in level1_activity + level2_activity:
                reason = activity.get('reasonForActivity')
                if reason in activity_reasons:
                    activity_reasons[reason] += 1

            return {
                'success': True,
                'userId': user_id,
                'timestamp': datetime.utcnow().isoformat(),
                'totalReferrals': total_referrals,
                'activeReferrals': total_active,
                'inactiveReferrals': total_referrals - total_active,
                'level1Total': len(level1_activity),
                'level1Active': active_level1,
                'level2Total': len(level2_activity),
                'level2Active': active_level2,
                'conversionRate': conversion_rate,
                'activityByReason': {
                    'drawsCriteria': activity_reasons['draws_criteria'],
                    'invitedCriteria': activity_reasons['invited_criteria'],
                    'bothCriteria': activity_reasons['both_criteria'],
                    'manualActivation': activity_reasons['manual_activation']
                }
            }
        except Exception as e:
            current_app.logger.error(f"Error getting activity summary: {str(e)}")
            return {
                'success': False,
                'error': 'Failed to get activity summary',
                'details': str(e)
            }

    @staticmethod
    def _prepare_activity_data(referral_id, activity):
        """
        Підготовлює дані про активність для відповіді API

        Args:
            referral_id (int): ID реферала
            activity (ReferralActivity): Об'єкт активності або None

        Returns:
            dict: Підготовлені дані про активність
        """
        if activity:
            last_activity_date = activity.last_updated.isoformat()
            meets_draws_criteria = activity.draws_participation >= 3
            meets_invited_criteria = activity.invited_referrals >= 1

            return {
                'id': f'WX{referral_id}',
                'drawsParticipation': activity.draws_participation,
                'invitedReferrals': activity.invited_referrals,
                'lastActivityDate': last_activity_date,
                'isActive': activity.is_active,
                'manuallyActivated': activity.reason_for_activity == 'manual_activation',
                'meetsDrawsCriteria': meets_draws_criteria,
                'meetsInvitedCriteria': meets_invited_criteria,
                'reasonForActivity': activity.reason_for_activity
            }
        else:
            # Якщо запис активності відсутній, повертаємо базові дані
            return {
                'id': f'WX{referral_id}',
                'drawsParticipation': 0,
                'invitedReferrals': 0,
                'lastActivityDate': None,
                'isActive': False,
                'manuallyActivated': False,
                'meetsDrawsCriteria': False,
                'meetsInvitedCriteria': False,
                'reasonForActivity': None
            }