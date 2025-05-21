from models.referral import Referral
from models.direct_bonus import DirectBonus
from models.percentage_reward import PercentageReward
from models.activity import ReferralActivity
from models.draw import Draw, DrawParticipant
from database import db
from flask import current_app
from sqlalchemy import func, desc, and_, or_
from datetime import datetime, timedelta
import json
import logging

# Налаштування логування
logger = logging.getLogger(__name__)


class AnalyticsController:
    """
    Контролер для отримання аналітичних даних реферальної системи
    """

    @staticmethod
    def get_referrals_ranking(user_id, sort_by='earnings'):
        """
        Отримує рейтинг рефералів за різними критеріями

        Args:
            user_id (int): ID користувача
            sort_by (str, optional): Критерій сортування ('earnings', 'invites', 'draws', 'activity'). Defaults to 'earnings'.

        Returns:
            dict: Рейтинг рефералів
        """
        try:
            # Отримуємо всіх рефералів користувача
            referrals = Referral.query.filter_by(referrer_id=user_id).all()

            if not referrals:
                return {
                    'success': True,
                    'user_id': user_id,
                    'sort_by': sort_by,
                    'referrals': []
                }

            # Збираємо ID всіх рефералів
            referral_ids = [referral.referee_id for referral in referrals]

            # Формуємо результат
            result_referrals = []

            # В залежності від критерію сортування, додаємо відповідні дані
            if sort_by == 'earnings':
                # Отримуємо дані про заробітки від рефералів з бази даних
                for referral_id in referral_ids:
                    # Отримуємо суму відсоткових винагород
                    percentage_rewards = PercentageReward.query.filter_by(
                        user_id=user_id,
                        referral_id=referral_id
                    ).all()

                    earnings = sum(reward.reward_amount for reward in percentage_rewards)

                    # Додаємо прямий бонус, якщо він є
                    direct_bonus = DirectBonus.query.filter_by(
                        referrer_id=user_id,
                        referee_id=referral_id
                    ).first()

                    if direct_bonus:
                        earnings += direct_bonus.amount

                    result_referrals.append({
                        'id': f'WX{referral_id}',
                        'earnings': earnings,
                        'level': Referral.query.filter_by(referee_id=referral_id, referrer_id=user_id).first().level
                    })

                # Сортуємо за заробітками (від більшого до меншого)
                result_referrals.sort(key=lambda r: r['earnings'], reverse=True)

            elif sort_by == 'invites':
                # Отримуємо дані про кількість запрошених рефералами з бази даних
                for referral_id in referral_ids:
                    # Підраховуємо кількість рефералів, запрошених цим рефералом
                    invites_count = Referral.query.filter_by(referrer_id=referral_id).count()

                    result_referrals.append({
                        'id': f'WX{referral_id}',
                        'invites_count': invites_count,
                        'level': Referral.query.filter_by(referee_id=referral_id, referrer_id=user_id).first().level
                    })

                # Сортуємо за кількістю запрошених (від більшого до меншого)
                result_referrals.sort(key=lambda r: r['invites_count'], reverse=True)

            elif sort_by == 'draws':
                # Отримуємо дані про участь у розіграшах з бази даних
                for referral_id in referral_ids:
                    # Підраховуємо кількість участей у розіграшах
                    draws_participation = DrawParticipant.query.filter_by(user_id=referral_id).count()

                    result_referrals.append({
                        'id': f'WX{referral_id}',
                        'draws_participation': draws_participation,
                        'level': Referral.query.filter_by(referee_id=referral_id, referrer_id=user_id).first().level
                    })

                # Сортуємо за участю в розіграшах (від більшого до меншого)
                result_referrals.sort(key=lambda r: r['draws_participation'], reverse=True)

            elif sort_by == 'activity':
                # Отримуємо дані про активність рефералів з таблиці активності
                for referral_id in referral_ids:
                    activity = ReferralActivity.query.filter_by(user_id=referral_id).first()

                    if activity:
                        # Обчислюємо "рахунок" активності на основі реальних даних
                        activity_score = (
                                (activity.draws_participation * 2) +  # Кожна участь у розіграші = 2 бали
                                (activity.invited_referrals * 5)  # Кожен запрошений = 5 балів
                        )

                        # Додатковий бонус за активну участь у проекті (на основі last_updated)
                        if activity.last_updated:
                            days_since_last_activity = (datetime.utcnow() - activity.last_updated).days
                            if days_since_last_activity < 7:  # Якщо заходив протягом останнього тижня
                                activity_score += 10
                    else:
                        activity_score = 0

                    result_referrals.append({
                        'id': f'WX{referral_id}',
                        'activity_score': activity_score,
                        'level': Referral.query.filter_by(referee_id=referral_id, referrer_id=user_id).first().level,
                        'isActive': activity.is_active if activity else False
                    })

                # Сортуємо за активністю (від більшого до меншого)
                result_referrals.sort(key=lambda r: r['activity_score'], reverse=True)

            return {
                'success': True,
                'user_id': user_id,
                'sort_by': sort_by,
                'referrals': result_referrals
            }
        except Exception as e:
            current_app.logger.error(f"Error getting referrals ranking: {str(e)}")
            return {
                'success': False,
                'error': 'Failed to get referrals ranking',
                'details': str(e)
            }

    @staticmethod
    def get_top_referrals(user_id, limit=10, metric='earnings'):
        """
        Отримує топ-N рефералів за вказаним критерієм

        Args:
            user_id (int): ID користувача
            limit (int, optional): Кількість рефералів для включення в топ. Defaults to 10.
            metric (str, optional): Критерій для визначення топу ('earnings', 'invites', 'draws', 'activity'). Defaults to 'earnings'.

        Returns:
            dict: Топ-N рефералів
        """
        try:
            # Отримуємо рейтинг рефералів за вказаним критерієм
            ranking_result = AnalyticsController.get_referrals_ranking(user_id, sort_by=metric)

            if not ranking_result['success']:
                return ranking_result

            # Обмежуємо результат вказаним лімітом
            top_referrals = ranking_result['referrals'][:limit]

            return {
                'success': True,
                'user_id': user_id,
                'metric': metric,
                'limit': limit,
                'top_referrals': top_referrals
            }
        except Exception as e:
            current_app.logger.error(f"Error getting top referrals: {str(e)}")
            return {
                'success': False,
                'error': 'Failed to get top referrals',
                'details': str(e)
            }

    @staticmethod
    def get_total_earnings(user_id):
        """
        Отримує загальний заробіток від реферальної програми

        Args:
            user_id (int): ID користувача

        Returns:
            dict: Загальний заробіток
        """
        try:
            # Отримуємо суму прямих бонусів з бази даних
            direct_bonuses = DirectBonus.query.filter_by(referrer_id=user_id).all()
            direct_bonuses_total = sum(bonus.amount for bonus in direct_bonuses)

            # Отримуємо суму відсоткових винагород з бази даних
            percentage_rewards = PercentageReward.query.filter_by(user_id=user_id).all()
            percentage_rewards_total = sum(reward.reward_amount for reward in percentage_rewards)

            # Отримуємо суму винагород за бейджі з бази даних
            from models.badge import UserBadge
            badges = UserBadge.query.filter_by(user_id=user_id, claimed=True).all()
            badges_total = sum(badge.reward_amount for badge in badges)

            # Отримуємо суму винагород за завдання з бази даних
            from models.task import UserTask
            tasks = UserTask.query.filter_by(user_id=user_id, claimed=True).all()
            tasks_total = sum(task.reward_amount for task in tasks)

            # Загальний заробіток
            total_earnings = direct_bonuses_total + percentage_rewards_total + badges_total + tasks_total

            # Формуємо результат
            return {
                'success': True,
                'user_id': user_id,
                'total_earnings': total_earnings,
                'direct_bonuses': direct_bonuses_total,
                'percentage_rewards': percentage_rewards_total,
                'badges': badges_total,
                'tasks': tasks_total
            }
        except Exception as e:
            current_app.logger.error(f"Error getting total earnings: {str(e)}")
            return {
                'success': False,
                'error': 'Failed to get total earnings',
                'details': str(e)
            }

    @staticmethod
    def predict_earnings(user_id):
        """
        Отримує прогноз майбутніх заробітків від реферальної програми

        Args:
            user_id (int): ID користувача

        Returns:
            dict: Прогноз заробітків
        """
        try:
            # Отримуємо реальну історію заробітків за останні 6 місяців
            earnings_history = []
            now = datetime.utcnow()

            # Рахуємо заробітки за кожен з останніх 6 місяців
            for i in range(6):
                month_start = (now.replace(day=1) - timedelta(days=30 * i)).replace(hour=0, minute=0, second=0,
                                                                                    microsecond=0)
                month_end = (month_start.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(seconds=1)

                # Заробітки від прямих бонусів за цей місяць
                direct_bonuses = DirectBonus.query.filter(
                    DirectBonus.referrer_id == user_id,
                    DirectBonus.created_at >= month_start,
                    DirectBonus.created_at <= month_end
                ).all()
                month_direct_bonuses = sum(bonus.amount for bonus in direct_bonuses)

                # Заробітки від відсоткових винагород за цей місяць
                percentage_rewards = PercentageReward.query.filter(
                    PercentageReward.user_id == user_id,
                    PercentageReward.created_at >= month_start,
                    PercentageReward.created_at <= month_end
                ).all()
                month_percentage_rewards = sum(reward.reward_amount for reward in percentage_rewards)

                # Загальний заробіток за місяць
                month_total = month_direct_bonuses + month_percentage_rewards

                earnings_history.append({
                    'date': month_start.strftime('%Y-%m'),
                    'amount': month_total
                })

            # Сортуємо історію за датою (від найстарішої до найновішої)
            earnings_history.sort(key=lambda x: x['date'])

            # Розраховуємо середній щомісячний приріст на основі реальних даних
            if len(earnings_history) > 1 and earnings_history[0]['amount'] != earnings_history[-1]['amount']:
                # Обчислюємо середній приріст за місяць
                total_growth = earnings_history[-1]['amount'] - earnings_history[0]['amount']
                months_count = max(1, len(earnings_history) - 1)
                monthly_growth = total_growth / months_count
            else:
                # Якщо недостатньо даних для розрахунку, використовуємо значення за замовчуванням
                # Розраховуємо на основі кількості рефералів та середнього бонусу
                referral_count = Referral.query.filter_by(referrer_id=user_id).count()
                monthly_growth = referral_count * 10 + 50  # Припускаємо середній ріст

            # Останній місячний заробіток
            last_amount = earnings_history[-1]['amount'] if earnings_history else 0

            # Прогноз на наступні 3 місяці
            predictions = []
            for i in range(1, 4):
                next_month = (now + timedelta(days=30 * i)).replace(day=1)
                predicted_amount = last_amount + (monthly_growth * i)
                predictions.append({
                    'month': next_month.strftime('%Y-%m'),
                    'amount': int(max(0, predicted_amount))  # Не допускаємо від'ємні значення
                })

            # Формуємо результат
            return {
                'success': True,
                'user_id': user_id,
                'current_earnings': last_amount,
                'monthly_growth': monthly_growth,
                'predictions': predictions,
                'history': earnings_history
            }
        except Exception as e:
            current_app.logger.error(f"Error predicting earnings: {str(e)}")
            return {
                'success': False,
                'error': 'Failed to predict earnings',
                'details': str(e)
            }

    @staticmethod
    def get_earnings_roi(user_id):
        """
        Отримує рентабельність інвестицій (ROI) реферальної програми

        Args:
            user_id (int): ID користувача

        Returns:
            dict: Дані про рентабельність
        """
        try:
            # Отримуємо загальний заробіток
            total_earnings_result = AnalyticsController.get_total_earnings(user_id)

            if not total_earnings_result['success']:
                return total_earnings_result

            total_earnings = total_earnings_result['total_earnings']

            # Підраховуємо витрати на основі реальних даних
            # Тут ми можемо врахувати різні типи витрат (в залежності від бізнес-логіки проекту)

            # Витрати на просування (можна отримати з бази, якщо є така інформація)
            # Наразі використовуємо константу, але в реальному додатку це може бути таблиця marketing_expenses
            promotion_expenses = 0

            # Додаткові бонуси від користувача (якщо є така інформація)
            user_bonuses = 0

            # Інші витрати (якщо є така інформація)
            other_expenses = 0

            # Тут ви можете додати логіку для отримання реальних витрат з бази даних

            # Загальні витрати
            total_expenses = promotion_expenses + user_bonuses + other_expenses

            # Якщо витрати відсутні, встановлюємо мінімальне значення для уникнення ділення на нуль
            if total_expenses == 0:
                # Використовуємо кількість рефералів як базу для розрахунку витрат
                referrals_count = Referral.query.filter_by(referrer_id=user_id).count()
                if referrals_count > 0:
                    # Оцінюємо витрати як 10% від загального заробітку або 50 winix за реферала
                    estimated_expenses = max(total_earnings * 0.1, referrals_count * 50)
                    total_expenses = estimated_expenses
                else:
                    # Якщо немає рефералів, просто використовуємо мінімальне значення
                    total_expenses = 1

            # Розраховуємо ROI
            roi = ((total_earnings - total_expenses) / total_expenses) * 100

            # Формуємо результат
            return {
                'success': True,
                'user_id': user_id,
                'total_earnings': total_earnings,
                'total_expenses': total_expenses,
                'expenses': {
                    'promotion': promotion_expenses,
                    'bonuses': user_bonuses,
                    'other': other_expenses
                },
                'roi': roi
            }
        except Exception as e:
            current_app.logger.error(f"Error getting earnings ROI: {str(e)}")
            return {
                'success': False,
                'error': 'Failed to get earnings ROI',
                'details': str(e)
            }

    @staticmethod
    def get_earnings_distribution(user_id):
        """
        Отримує розподіл заробітку за категоріями

        Args:
            user_id (int): ID користувача

        Returns:
            dict: Розподіл заробітку
        """
        try:
            # Отримуємо дані про заробіток з різних джерел
            total_earnings_result = AnalyticsController.get_total_earnings(user_id)

            if not total_earnings_result['success']:
                return total_earnings_result

            # Формуємо дані для кругової діаграми
            distribution = [
                {
                    'category': 'Прямі бонуси',
                    'amount': total_earnings_result['direct_bonuses'],
                    'percentage': AnalyticsController._calculate_percentage(
                        total_earnings_result['direct_bonuses'],
                        total_earnings_result['total_earnings']
                    )
                },
                {
                    'category': 'Відсоткові винагороди',
                    'amount': total_earnings_result['percentage_rewards'],
                    'percentage': AnalyticsController._calculate_percentage(
                        total_earnings_result['percentage_rewards'],
                        total_earnings_result['total_earnings']
                    )
                },
                {
                    'category': 'Бейджі',
                    'amount': total_earnings_result['badges'],
                    'percentage': AnalyticsController._calculate_percentage(
                        total_earnings_result['badges'],
                        total_earnings_result['total_earnings']
                    )
                },
                {
                    'category': 'Завдання',
                    'amount': total_earnings_result['tasks'],
                    'percentage': AnalyticsController._calculate_percentage(
                        total_earnings_result['tasks'],
                        total_earnings_result['total_earnings']
                    )
                }
            ]

            # Формуємо результат
            return {
                'success': True,
                'user_id': user_id,
                'total_earnings': total_earnings_result['total_earnings'],
                'distribution': distribution
            }
        except Exception as e:
            current_app.logger.error(f"Error getting earnings distribution: {str(e)}")
            return {
                'success': False,
                'error': 'Failed to get earnings distribution',
                'details': str(e)
            }

    @staticmethod
    def _calculate_percentage(part, whole):
        """
        Розраховує відсоток від цілого

        Args:
            part (float): Частина
            whole (float): Ціле

        Returns:
            float: Відсоток
        """
        if whole == 0:
            return 0
        return round((part / whole) * 100, 2)