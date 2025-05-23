from supabase_client import supabase
from datetime import datetime, timedelta
import json
import logging
import traceback

logger = logging.getLogger(__name__)


class AnalyticsController:
    """
    Контролер для отримання аналітичних даних реферальної системи
    """

    @staticmethod
    def get_referrals_ranking(user_id, sort_by='earnings'):
        """
        Отримує рейтинг рефералів за різними критеріями
        """
        try:
            user_id_str = str(user_id)
            logger.info(f"=== get_referrals_ranking START: user_id={user_id_str}, sort_by={sort_by} ===")

            # Отримуємо всіх рефералів користувача
            referrals_query = supabase.table("referrals").select("*").eq("referrer_id", user_id_str)
            referrals_result = referrals_query.execute()
            referrals = referrals_result.data or []

            logger.info(f"Знайдено {len(referrals)} рефералів")

            if not referrals:
                return {
                    'success': True,
                    'user_id': user_id_str,
                    'sort_by': sort_by,
                    'referrals': []
                }

            # Збираємо ID всіх рефералів
            referral_ids = [referral['referee_id'] for referral in referrals]
            logger.info(f"Referral IDs: {referral_ids[:5]}...")  # перші 5 для прикладу

            # Формуємо результат
            result_referrals = []

            if sort_by == 'earnings':
                # Отримуємо дані про заробітки від рефералів
                for referral_id in referral_ids:
                    total_earnings = 0

                    # Отримуємо суму відсоткових винагород
                    percentage_query = supabase.table("percentage_rewards").select("reward_amount").eq(
                        "user_id", user_id_str
                    ).eq("referral_id", referral_id)
                    percentage_result = percentage_query.execute()

                    for reward in percentage_result.data or []:
                        total_earnings += reward.get('reward_amount', 0)

                    logger.debug(f"Percentage rewards for {referral_id}: {len(percentage_result.data)} records")

                    # Додаємо прямий бонус
                    direct_query = supabase.table("direct_bonuses").select("amount").eq(
                        "referrer_id", user_id_str
                    ).eq("referee_id", referral_id)
                    direct_result = direct_query.execute()

                    if direct_result.data:
                        total_earnings += direct_result.data[0].get('amount', 0)
                        logger.debug(f"Direct bonus for {referral_id}: {direct_result.data[0].get('amount', 0)}")

                    # Знаходимо рівень реферала
                    referral_level = next(
                        (ref['level'] for ref in referrals if ref['referee_id'] == referral_id),
                        1
                    )

                    result_referrals.append({
                        'id': f'WX{referral_id}',
                        'earnings': total_earnings,
                        'level': referral_level
                    })

                # Сортуємо за заробітками
                result_referrals.sort(key=lambda r: r['earnings'], reverse=True)
                logger.info(
                    f"Sorted by earnings: top earner = {result_referrals[0]['earnings'] if result_referrals else 0}")

            elif sort_by == 'invites':
                # Отримуємо дані про кількість запрошених рефералами
                for referral_id in referral_ids:
                    invites_query = supabase.table("referrals").select("id").eq("referrer_id", referral_id)
                    invites_result = invites_query.execute()
                    invites_count = len(invites_result.data or [])

                    referral_level = next(
                        (ref['level'] for ref in referrals if ref['referee_id'] == referral_id),
                        1
                    )

                    result_referrals.append({
                        'id': f'WX{referral_id}',
                        'invites_count': invites_count,
                        'level': referral_level
                    })

                result_referrals.sort(key=lambda r: r['invites_count'], reverse=True)

            elif sort_by == 'draws':
                # Отримуємо дані про участь у розіграшах
                for referral_id in referral_ids:
                    draws_query = supabase.table("draw_participants").select("id").eq("user_id", referral_id)
                    draws_result = draws_query.execute()
                    draws_participation = len(draws_result.data or [])

                    referral_level = next(
                        (ref['level'] for ref in referrals if ref['referee_id'] == referral_id),
                        1
                    )

                    result_referrals.append({
                        'id': f'WX{referral_id}',
                        'draws_participation': draws_participation,
                        'level': referral_level
                    })

                result_referrals.sort(key=lambda r: r['draws_participation'], reverse=True)

            elif sort_by == 'activity':
                # Отримуємо дані про активність рефералів
                activities_query = supabase.table("referral_activities").select("*").in_("user_id", referral_ids)
                activities_result = activities_query.execute()
                activities_map = {act['user_id']: act for act in activities_result.data or []}

                for referral_id in referral_ids:
                    activity = activities_map.get(referral_id)
                    activity_score = 0

                    if activity:
                        # Рахуємо активність
                        activity_score = (
                                (activity.get('draws_participation', 0) * 2) +
                                (activity.get('invited_referrals', 0) * 5)
                        )

                        # Бонус за недавню активність
                        if activity.get('last_updated'):
                            try:
                                last_updated = datetime.fromisoformat(activity['last_updated'].replace('Z', '+00:00'))
                                days_since = (datetime.utcnow() - last_updated).days
                                if days_since < 7:
                                    activity_score += 10
                            except:
                                pass

                    referral_level = next(
                        (ref['level'] for ref in referrals if ref['referee_id'] == referral_id),
                        1
                    )

                    result_referrals.append({
                        'id': f'WX{referral_id}',
                        'activity_score': activity_score,
                        'level': referral_level,
                        'isActive': activity.get('is_active', False) if activity else False
                    })

                result_referrals.sort(key=lambda r: r['activity_score'], reverse=True)

            logger.info(f"=== get_referrals_ranking END: success, count={len(result_referrals)} ===")
            return {
                'success': True,
                'user_id': user_id_str,
                'sort_by': sort_by,
                'referrals': result_referrals
            }
        except Exception as e:
            error_details = traceback.format_exc()
            logger.error(f"Error getting referrals ranking: {str(e)}\n{error_details}")
            return {
                'success': False,
                'error': 'Failed to get referrals ranking',
                'details': str(e)
            }

    @staticmethod
    def get_total_earnings(user_id):
        """
        Отримує загальний заробіток від реферальної програми
        """
        try:
            user_id_str = str(user_id)
            logger.info(f"=== get_total_earnings START: user_id={user_id_str} ===")

            # Отримуємо суму прямих бонусів
            direct_query = supabase.table("direct_bonuses").select("amount").eq("referrer_id", user_id_str)
            direct_result = direct_query.execute()
            direct_bonuses_total = sum(bonus.get('amount', 0) for bonus in direct_result.data or [])
            logger.info(f"Прямі бонуси: {len(direct_result.data)} записів, сума = {direct_bonuses_total}")

            # Отримуємо суму відсоткових винагород
            percentage_query = supabase.table("percentage_rewards").select("reward_amount").eq("user_id", user_id_str)
            percentage_result = percentage_query.execute()
            percentage_rewards_total = sum(reward.get('reward_amount', 0) for reward in percentage_result.data or [])
            logger.info(
                f"Відсоткові винагороди: {len(percentage_result.data)} записів, сума = {percentage_rewards_total}")

            # Отримуємо суму винагород за бейджі
            badges_query = supabase.table("user_badges").select("reward_amount").eq("user_id", user_id_str).eq(
                "claimed", True)
            badges_result = badges_query.execute()
            badges_total = sum(badge.get('reward_amount', 0) for badge in badges_result.data or [])
            logger.info(f"Бейджі: {len(badges_result.data)} записів, сума = {badges_total}")

            # Отримуємо суму винагород за завдання
            tasks_query = supabase.table("user_tasks").select("reward_amount").eq("user_id", user_id_str).eq("claimed",
                                                                                                             True)
            tasks_result = tasks_query.execute()
            tasks_total = sum(task.get('reward_amount', 0) for task in tasks_result.data or [])
            logger.info(f"Завдання: {len(tasks_result.data)} записів, сума = {tasks_total}")

            # Загальний заробіток
            total_earnings = direct_bonuses_total + percentage_rewards_total + badges_total + tasks_total

            logger.info(f"=== get_total_earnings END: total = {total_earnings} ===")
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
            error_details = traceback.format_exc()
            logger.error(f"Error getting total earnings: {str(e)}\n{error_details}")
            return {
                'success': False,
                'error': 'Failed to get total earnings',
                'details': str(e)
            }

    @staticmethod
    def get_top_referrals(user_id, limit=10, metric='earnings'):
        """
        Отримує топ-N рефералів за вказаним критерієм
        """
        try:
            logger.info(f"=== get_top_referrals: user_id={user_id}, limit={limit}, metric={metric} ===")

            # Отримуємо рейтинг рефералів
            ranking_result = AnalyticsController.get_referrals_ranking(user_id, sort_by=metric)

            if not ranking_result['success']:
                return ranking_result

            # Обмежуємо результат вказаним лімітом
            top_referrals = ranking_result['referrals'][:limit]

            logger.info(f"=== get_top_referrals END: returning top {len(top_referrals)} referrals ===")
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
    def predict_earnings(user_id):
        """
        Отримує прогноз майбутніх заробітків від реферальної програми
        """
        try:
            user_id_str = str(user_id)
            logger.info(f"=== predict_earnings START: user_id={user_id_str} ===")

            # Отримуємо історію заробітків за останні 6 місяців
            earnings_history = []
            now = datetime.utcnow()

            for i in range(6):
                month_start = (now.replace(day=1) - timedelta(days=30 * i)).replace(hour=0, minute=0, second=0,
                                                                                    microsecond=0)
                month_end = (month_start.replace(day=28) + timedelta(days=4)).replace(day=1) - timedelta(seconds=1)

                month_earnings = 0

                # Прямі бонуси за місяць
                direct_query = supabase.table("direct_bonuses").select("amount, created_at").eq("referrer_id",
                                                                                                user_id_str)
                direct_result = direct_query.execute()

                for bonus in direct_result.data or []:
                    try:
                        bonus_date = datetime.fromisoformat(bonus['created_at'].replace('Z', '+00:00'))
                        if month_start <= bonus_date <= month_end:
                            month_earnings += bonus.get('amount', 0)
                    except:
                        pass

                # Відсоткові винагороди за місяць
                percentage_query = supabase.table("percentage_rewards").select("reward_amount, created_at").eq(
                    "user_id", user_id_str)
                percentage_result = percentage_query.execute()

                for reward in percentage_result.data or []:
                    try:
                        reward_date = datetime.fromisoformat(reward['created_at'].replace('Z', '+00:00'))
                        if month_start <= reward_date <= month_end:
                            month_earnings += reward.get('reward_amount', 0)
                    except:
                        pass

                earnings_history.append({
                    'date': month_start.strftime('%Y-%m'),
                    'amount': month_earnings
                })

            # Сортуємо історію за датою
            earnings_history.sort(key=lambda x: x['date'])

            # Розраховуємо середній приріст
            monthly_growth = 0
            if len(earnings_history) > 1:
                total_growth = earnings_history[-1]['amount'] - earnings_history[0]['amount']
                months_count = max(1, len(earnings_history) - 1)
                monthly_growth = total_growth / months_count
            else:
                # Базовий розрахунок на основі кількості рефералів
                referrals_query = supabase.table("referrals").select("id").eq("referrer_id", user_id_str)
                referrals_result = referrals_query.execute()
                referral_count = len(referrals_result.data or [])
                monthly_growth = referral_count * 10 + 50

            # Останній місячний заробіток
            last_amount = earnings_history[-1]['amount'] if earnings_history else 0

            # Прогноз на наступні 3 місяці
            predictions = []
            for i in range(1, 4):
                next_month = (now + timedelta(days=30 * i)).replace(day=1)
                predicted_amount = last_amount + (monthly_growth * i)
                predictions.append({
                    'month': next_month.strftime('%Y-%m'),
                    'amount': int(max(0, predicted_amount))
                })

            logger.info(f"=== predict_earnings END: monthly_growth={monthly_growth} ===")
            return {
                'success': True,
                'user_id': user_id_str,
                'current_earnings': last_amount,
                'monthly_growth': monthly_growth,
                'predictions': predictions,
                'history': earnings_history
            }
        except Exception as e:
            error_details = traceback.format_exc()
            logger.error(f"Error predicting earnings: {str(e)}\n{error_details}")
            return {
                'success': False,
                'error': 'Failed to predict earnings',
                'details': str(e)
            }

    @staticmethod
    def get_earnings_roi(user_id):
        """
        Отримує рентабельність інвестицій (ROI) реферальної програми
        """
        try:
            user_id_str = str(user_id)
            logger.info(f"=== get_earnings_roi START: user_id={user_id_str} ===")

            # Отримуємо загальний заробіток
            total_earnings_result = AnalyticsController.get_total_earnings(user_id)

            if not total_earnings_result['success']:
                return total_earnings_result

            total_earnings = total_earnings_result['total_earnings']

            # Базові витрати (можна адаптувати під вашу логіку)
            promotion_expenses = 0
            user_bonuses = 0
            other_expenses = 0

            # Оцінка витрат на основі кількості рефералів
            referrals_query = supabase.table("referrals").select("id").eq("referrer_id", user_id_str)
            referrals_result = referrals_query.execute()
            referrals_count = len(referrals_result.data or [])

            if referrals_count > 0:
                estimated_expenses = max(total_earnings * 0.1, referrals_count * 50)
                total_expenses = estimated_expenses
            else:
                total_expenses = 1

            # Розраховуємо ROI
            roi = ((total_earnings - total_expenses) / total_expenses) * 100

            logger.info(f"=== get_earnings_roi END: roi={roi:.2f}% ===")
            return {
                'success': True,
                'user_id': user_id_str,
                'total_earnings': total_earnings,
                'total_expenses': total_expenses,
                'expenses': {
                    'promotion': promotion_expenses,
                    'bonuses': user_bonuses,
                    'other': other_expenses
                },
                'roi': round(roi, 2)
            }
        except Exception as e:
            error_details = traceback.format_exc()
            logger.error(f"Error getting earnings ROI: {str(e)}\n{error_details}")
            return {
                'success': False,
                'error': 'Failed to get earnings ROI',
                'details': str(e)
            }

    @staticmethod
    def get_earnings_distribution(user_id):
        """
        Отримує розподіл заробітку за категоріями
        """
        try:
            user_id_str = str(user_id)
            logger.info(f"=== get_earnings_distribution START: user_id={user_id_str} ===")

            # Отримуємо дані про заробіток
            total_earnings_result = AnalyticsController.get_total_earnings(user_id)

            if not total_earnings_result['success']:
                return total_earnings_result

            # Формуємо дані для розподілу
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

            logger.info(f"=== get_earnings_distribution END: success ===")
            return {
                'success': True,
                'user_id': user_id_str,
                'total_earnings': total_earnings_result['total_earnings'],
                'distribution': distribution
            }
        except Exception as e:
            error_details = traceback.format_exc()
            logger.error(f"Error getting earnings distribution: {str(e)}\n{error_details}")
            return {
                'success': False,
                'error': 'Failed to get earnings distribution',
                'details': str(e)
            }

    @staticmethod
    def _calculate_percentage(part, whole):
        """
        Розраховує відсоток від цілого
        """
        if whole == 0:
            return 0
        return round((part / whole) * 100, 2)