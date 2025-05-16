from models.referral import Referral
from models.direct_bonus import DirectBonus
from models.percentage_reward import PercentageReward
from models.activity import ReferralActivity
from models.draw import Draw, DrawParticipant
from database import db
from flask import current_app
from sqlalchemy import func, desc
from datetime import datetime, timedelta
import json


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
                # Отримуємо дані про заробітки рефералів
                # В реальному додатку - з іншої таблиці
                for referral_id in referral_ids:
                    earnings = AnalyticsController._get_mock_earnings(referral_id)
                    result_referrals.append({
                        'id': f'WX{referral_id}',
                        'earnings': earnings,
                        'level': Referral.query.filter_by(referee_id=referral_id, referrer_id=user_id).first().level
                    })

                # Сортуємо за заробітками (від більшого до меншого)
                result_referrals.sort(key=lambda r: r['earnings'], reverse=True)

            elif sort_by == 'invites':
                # Отримуємо дані про кількість запрошених рефералами
                # В реальному додатку - підрахунок з таблиці referrals
                for referral_id in referral_ids:
                    invites_count = Referral.query.filter_by(referrer_id=referral_id).count()
                    result_referrals.append({
                        'id': f'WX{referral_id}',
                        'invites_count': invites_count,
                        'level': Referral.query.filter_by(referee_id=referral_id, referrer_id=user_id).first().level
                    })

                # Сортуємо за кількістю запрошених (від більшого до меншого)
                result_referrals.sort(key=lambda r: r['invites_count'], reverse=True)

            elif sort_by == 'draws':
                # Отримуємо дані про участь у розіграшах
                # В реальному додатку - підрахунок з таблиці draw_participants
                for referral_id in referral_ids:
                    draws_participation = DrawParticipant.query.filter_by(user_id=referral_id).count()
                    result_referrals.append({
                        'id': f'WX{referral_id}',
                        'draws_participation': draws_participation,
                        'level': Referral.query.filter_by(referee_id=referral_id, referrer_id=user_id).first().level
                    })

                # Сортуємо за участю в розіграшах (від більшого до меншого)
                result_referrals.sort(key=lambda r: r['draws_participation'], reverse=True)

            elif sort_by == 'activity':
                # Отримуємо дані про активність рефералів
                # В реальному додатку - з таблиці активності
                for referral_id in referral_ids:
                    activity = ReferralActivity.query.filter_by(user_id=referral_id).first()
                    activity_score = 0

                    if activity:
                        # Обчислюємо "рахунок" активності
                        activity_score = (
                                (activity.draws_participation * 2) +  # Кожна участь у розіграші = 2 бали
                                (activity.invited_referrals * 5)  # Кожен запрошений = 5 балів
                        )

                    result_referrals.append({
                        'id': f'WX{referral_id}',
                        'activity_score': activity_score,
                        'level': Referral.query.filter_by(referee_id=referral_id, referrer_id=user_id).first().level
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
            # Отримуємо суму прямих бонусів
            direct_bonuses = DirectBonus.query.filter_by(referrer_id=user_id).all()
            direct_bonuses_total = sum(bonus.amount for bonus in direct_bonuses)

            # Отримуємо суму відсоткових винагород
            percentage_rewards = PercentageReward.query.filter_by(user_id=user_id).all()
            percentage_rewards_total = sum(reward.reward_amount for reward in percentage_rewards)

            # Отримуємо суму винагород за бейджі (в реальному додатку - з таблиці бейджів)
            from models.badge import UserBadge
            badges = UserBadge.query.filter_by(user_id=user_id, claimed=True).all()
            badges_total = sum(badge.reward_amount for badge in badges)

            # Отримуємо суму винагород за завдання (в реальному додатку - з таблиці завдань)
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
            # Отримуємо історію заробітків
            earnings_history = AnalyticsController._get_earnings_history(user_id)

            # Розраховуємо середній щомісячний приріст
            if len(earnings_history) > 1:
                # Обчислюємо середній приріст за місяць
                total_growth = earnings_history[-1]['amount'] - earnings_history[0]['amount']
                months_count = max(1, len(earnings_history) - 1)
                monthly_growth = total_growth / months_count
            else:
                # Якщо недостатньо даних, використовуємо значення за замовчуванням
                monthly_growth = 100  # Припустимо, що зростання становить 100 winix на місяць

            # Прогноз на наступні 3 місяці
            last_amount = earnings_history[-1]['amount'] if earnings_history else 0
            predictions = []

            for i in range(1, 4):
                predicted_amount = last_amount + (monthly_growth * i)
                predictions.append({
                    'month': i,
                    'amount': int(predicted_amount)
                })

            # Формуємо результат
            return {
                'success': True,
                'user_id': user_id,
                'current_earnings': last_amount,
                'monthly_growth': monthly_growth,
                'predictions': predictions
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

            # Отримуємо дані про витрати (в реальному додатку - з інших таблиць)
            # Для прикладу використовуємо моковані дані
            expenses = {
                'promotion': 1000,  # Витрати на просування реферального посилання
                'bonuses': 500,  # Додаткові бонуси, які користувач надав рефералам
                'other': 200  # Інші витрати
            }

            total_expenses = sum(expenses.values())

            # Розраховуємо ROI
            roi = 0
            if total_expenses > 0:
                roi = ((total_earnings - total_expenses) / total_expenses) * 100

            # Формуємо результат
            return {
                'success': True,
                'user_id': user_id,
                'total_earnings': total_earnings,
                'total_expenses': total_expenses,
                'expenses': expenses,
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
    def _get_mock_earnings(referral_id):
        """
        Генерує моковані дані про заробітки реферала (для тестування)

        Args:
            referral_id (int): ID реферала

        Returns:
            int: Сума заробітків
        """
        # Для прикладу використовуємо ID реферала для генерації випадкового значення
        return referral_id * 10 + (referral_id % 100) * 5

    @staticmethod
    def _get_earnings_history(user_id):
        """
        Отримує історію заробітків користувача (для прогнозування)

        Args:
            user_id (int): ID користувача

        Returns:
            list: Історія заробітків
        """
        # В реальному додатку це буде запит до бази даних
        # Для прикладу генеруємо моковані дані

        # Останні 6 місяців
        current_date = datetime.utcnow()
        history = []

        # Базовий заробіток
        base_amount = user_id * 100

        for i in range(6):
            month_date = current_date - timedelta(days=30 * (5 - i))

            # Генеруємо заробіток для кожного місяця з невеликим зростанням
            amount = base_amount + (i * 150) + (i * i * 10)

            history.append({
                'date': month_date.strftime('%Y-%m'),
                'amount': amount
            })

        return history

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