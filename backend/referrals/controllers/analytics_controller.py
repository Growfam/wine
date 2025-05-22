from supabase_client import supabase
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
            user_id_str = str(user_id)

            # Отримуємо всіх рефералів користувача
            referrals = supabase.table("referrals").select("*").eq("referrer_id", user_id_str).execute()

            if not referrals.data:
                return {
                    'success': True,
                    'user_id': user_id_str,
                    'sort_by': sort_by,
                    'referrals': []
                }

            # Збираємо ID всіх рефералів
            referral_ids = [referral['referee_id'] for referral in referrals.data]

            # Формуємо результат
            result_referrals = []

            # В залежності від критерію сортування, додаємо відповідні дані
            if sort_by == 'earnings':
                # Отримуємо дані про заробітки від рефералів з бази даних
                for referral_id in referral_ids:
                    # Отримуємо суму відсоткових винагород
                    percentage_rewards = supabase.table("percentage_rewards").select("*").eq(
                        "user_id", user_id_str
                    ).eq("referral_id", referral_id).execute()

                    earnings = sum(reward['reward_amount'] for reward in percentage_rewards.data)

                    # Додаємо прямий бонус, якщо він є
                    direct_bonus = supabase.table("direct_bonuses").select("*").eq(
                        "referrer_id", user_id_str
                    ).eq("referee_id", referral_id).execute()

                    if direct_bonus.data:
                        earnings += direct_bonus.data[0]['amount']

                    # Знаходимо рівень реферала
                    referral_level = next((ref['level'] for ref in referrals.data if ref['referee_id'] == referral_id),
                                          1)

                    result_referrals.append({
                        'id': f'WX{referral_id}',
                        'earnings': earnings,
                        'level': referral_level
                    })

                # Сортуємо за заробітками (від більшого до меншого)
                result_referrals.sort(key=lambda r: r['earnings'], reverse=True)

            elif sort_by == 'invites':
                # Отримуємо дані про кількість запрошених рефералами з бази даних
                for referral_id in referral_ids:
                    # Підраховуємо кількість рефералів, запрошених цим рефералом
                    invites_count = len(
                        supabase.table("referrals").select("*").eq("referrer_id", referral_id).execute().data)

                    # Знаходимо рівень реферала
                    referral_level = next((ref['level'] for ref in referrals.data if ref['referee_id'] == referral_id),
                                          1)

                    result_referrals.append({
                        'id': f'WX{referral_id}',
                        'invites_count': invites_count,
                        'level': referral_level
                    })

                # Сортуємо за кількістю запрошених (від більшого до меншого)
                result_referrals.sort(key=lambda r: r['invites_count'], reverse=True)

            elif sort_by == 'draws':
                # Отримуємо дані про участь у розіграшах з бази даних
                for referral_id in referral_ids:
                    # Підраховуємо кількість участей у розіграшах
                    draws_participation = len(
                        supabase.table("draw_participants").select("*").eq("user_id", referral_id).execute().data)

                    # Знаходимо рівень реферала
                    referral_level = next((ref['level'] for ref in referrals.data if ref['referee_id'] == referral_id),
                                          1)

                    result_referrals.append({
                        'id': f'WX{referral_id}',
                        'draws_participation': draws_participation,
                        'level': referral_level
                    })

                # Сортуємо за участю в розіграшах (від більшого до меншого)
                result_referrals.sort(key=lambda r: r['draws_participation'], reverse=True)

            elif sort_by == 'activity':
                # Отримуємо дані про активність рефералів з таблиці активності
                for referral_id in referral_ids:
                    activity_result = supabase.table("referral_activities").select("*").eq("user_id",
                                                                                           referral_id).execute()

                    if activity_result.data:
                        activity = activity_result.data[0]
                        # Обчислюємо "рахунок" активності на основі реальних даних
                        activity_score = (
                                (activity['draws_participation'] * 2) +  # Кожна участь у розіграші = 2 бали
                                (activity['invited_referrals'] * 5)  # Кожен запрошений = 5 балів
                        )

                        # Додатковий бонус за активну участь у проекті
                        if activity.get('last_updated'):
                            last_updated = datetime.fromisoformat(activity['last_updated'].replace('Z', '+00:00'))
                            days_since_last_activity = (datetime.utcnow() - last_updated).days
                            if days_since_last_activity < 7:  # Якщо заходив протягом останнього тижня
                                activity_score += 10
                    else:
                        activity_score = 0

                    # Знаходимо рівень реферала
                    referral_level = next((ref['level'] for ref in referrals.data if ref['referee_id'] == referral_id),
                                          1)

                    result_referrals.append({
                        'id': f'WX{referral_id}',
                        'activity_score': activity_score,
                        'level': referral_level,
                        'isActive': activity.get('is_active', False) if activity_result.data else False
                    })

                # Сортуємо за активністю (від більшого до меншого)
                result_referrals.sort(key=lambda r: r['activity_score'], reverse=True)

            return {
                'success': True,
                'user_id': user_id_str,
                'sort_by': sort_by,
                'referrals': result_referrals
            }
        except Exception as e:
            logger.error(f"Error getting referrals ranking: {str(e)}")
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
                'user_id': str(user_id),
                'metric': metric,
                'limit': limit,
                'top_referrals': top_referrals
            }
        except Exception as e:
            logger.error(f"Error getting top referrals: {str(e)}")
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
            user_id_str = str(user_id)

            # Отримуємо суму прямих бонусів з бази даних
            direct_bonuses = supabase.table("direct_bonuses").select("*").eq("referrer_id", user_id_str).execute()
            direct_bonuses_total = sum(bonus['amount'] for bonus in direct_bonuses.data)

            # Отримуємо суму відсоткових винагород з бази даних
            percentage_rewards = supabase.table("percentage_rewards").select("*").eq("user_id", user_id_str).execute()
            percentage_rewards_total = sum(reward['reward_amount'] for reward in percentage_rewards.data)

            # Отримуємо суму винагород за бейджі з бази даних
            badges = supabase.table("user_badges").select("*").eq("user_id", user_id_str).eq("claimed", True).execute()
            badges_total = sum(badge['reward_amount'] for badge in badges.data)

            # Отримуємо суму винагород за завдання з бази даних
            tasks = supabase.table("user_tasks").select("*").eq("user_id", user_id_str).eq("claimed", True).execute()
            tasks_total = sum(task['reward_amount'] for task in tasks.data)

            # Загальний заробіток
            total_earnings = direct_bonuses_total + percentage_rewards_total + badges_total + tasks_total

            # Формуємо результат
            return {
                'success': True,
                'user_id': user_id_str,
                'total_earnings': total_earnings,
                'direct_bonuses': direct_bonuses_total,
                'percentage_rewards': percentage_rewards_total,
                'badges': badges_total,
                'tasks': tasks_total
            }
        except Exception as e:
            logger.error(f"Error getting total earnings: {str(e)}")
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
            user_id_str = str(user_id)

            # Отримуємо реальну історію заробітків за останні 6 місяців
            earnings_history = []
            now = datetime.utcnow()

            # Рахуємо заробітки за кожен з останніх 6 місяців
            for i in range(6):
                month_start = (now.replace(day=1) - timedelta(days=30 * i)).replace(hour=0, minute=0, second=0,
                                                                                    microsecond=0)
                month_end = (month_start.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(seconds=1)

                # Заробітки від прямих бонусів за цей місяць
                month_direct_bonuses = 0
                direct_bonuses = supabase.table("direct_bonuses").select("*").eq("referrer_id", user_id_str).execute()
                for bonus in direct_bonuses.data:
                    bonus_date = datetime.fromisoformat(bonus['created_at'].replace('Z', '+00:00'))
                    if month_start <= bonus_date <= month_end:
                        month_direct_bonuses += bonus['amount']

                # Заробітки від відсоткових винагород за цей місяць
                month_percentage_rewards = 0
                percentage_rewards = supabase.table("percentage_rewards").select("*").eq("user_id",
                                                                                         user_id_str).execute()
                for reward in percentage_rewards.data:
                    reward_date = datetime.fromisoformat(reward['created_at'].replace('Z', '+00:00'))
                    if month_start <= reward_date <= month_end:
                        month_percentage_rewards += reward['reward_amount']

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
                referral_count = len(
                    supabase.table("referrals").select("*").eq("referrer_id", user_id_str).execute().data)
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
                'user_id': user_id_str,
                'current_earnings': last_amount,
                'monthly_growth': monthly_growth,
                'predictions': predictions,
                'history': earnings_history
            }
        except Exception as e:
            logger.error(f"Error predicting earnings: {str(e)}")
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
            promotion_expenses = 0

            # Додаткові бонуси від користувача (якщо є така інформація)
            user_bonuses = 0

            # Інші витрати (якщо є така інформація)
            other_expenses = 0

            # Загальні витрати
            total_expenses = promotion_expenses + user_bonuses + other_expenses

            # Якщо витрати відсутні, встановлюємо мінімальне значення для уникнення ділення на нуль
            if total_expenses == 0:
                # Використовуємо кількість рефералів як базу для розрахунку витрат
                referrals_count = len(
                    supabase.table("referrals").select("*").eq("referrer_id", str(user_id)).execute().data)
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
                'user_id': str(user_id),
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
            logger.error(f"Error getting earnings ROI: {str(e)}")
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
                'user_id': str(user_id),
                'total_earnings': total_earnings_result['total_earnings'],
                'distribution': distribution
            }
        except Exception as e:
            logger.error(f"Error getting earnings distribution: {str(e)}")
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