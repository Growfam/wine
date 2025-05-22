from supabase_client import supabase
from flask import jsonify, current_app
from datetime import datetime, timedelta
import logging

# Налаштування логування
logger = logging.getLogger(__name__)


class EarningsController:
    """
    Контролер для управління заробітками від реферальної системи
    """

    # Константи для відсоткових винагород
    LEVEL_1_REWARD_RATE = 0.1  # 10% для рефералів 1-го рівня
    LEVEL_2_REWARD_RATE = 0.05  # 5% для рефералів 2-го рівня

    @staticmethod
    def get_referral_earnings(user_id, options=None):
        """
        Отримує дані про заробітки рефералів користувача

        Args:
            user_id (int): ID користувача
            options (dict, optional): Додаткові опції для фільтрації.
                Може містити ключі: 'startDate', 'endDate', 'activeOnly'

        Returns:
            dict: Дані про заробітки рефералів
        """
        if options is None:
            options = {}

        try:
            user_id_str = str(user_id)

            # Отримання рефералів 1-го та 2-го рівня
            level1_referrals = supabase.table("referrals").select("*").eq("referrer_id", user_id_str).eq("level",
                                                                                                         1).execute()
            level2_referrals = supabase.table("referrals").select("*").eq("referrer_id", user_id_str).eq("level",
                                                                                                         2).execute()

            # Підготовка структури для відповіді
            level1_data = []
            level2_data = []

            # Отримання всіх ID рефералів для оптимізації запитів
            level1_ids = [ref['referee_id'] for ref in level1_referrals.data]
            level2_ids = [ref['referee_id'] for ref in level2_referrals.data]
            all_referral_ids = level1_ids + level2_ids

            # Отримання даних про активність всіх рефералів одним запитом
            activities = {}
            if all_referral_ids:
                activity_records = supabase.table("referral_activities").select("*").in_("user_id",
                                                                                         all_referral_ids).execute()
                activities = {act['user_id']: act for act in activity_records.data}

            # Отримання всіх винагород за рефералів
            reward_records = supabase.table("percentage_rewards").select("*").eq("user_id", user_id_str).execute()
            rewards_by_referral = {}
            for reward in reward_records.data:
                if reward['referral_id'] not in rewards_by_referral:
                    rewards_by_referral[reward['referral_id']] = 0
                rewards_by_referral[reward['referral_id']] += reward['reward_amount']

            # Отримання даних про заробітки для рефералів 1-го рівня
            for referral in level1_referrals.data:
                # Отримуємо дані про активність
                activity = activities.get(referral['referee_id'])
                is_active = False
                if activity:
                    # Перевірка активності за критеріями
                    is_active = activity.get('is_active', False)
                    if activity.get('last_updated'):
                        last_updated = datetime.fromisoformat(activity['last_updated'].replace('Z', '+00:00'))
                        is_active = is_active and (last_updated > datetime.utcnow() - timedelta(days=7))

                # Рахуємо загальні заробітки реферала
                total_earnings = rewards_by_referral.get(referral['referee_id'], 0)

                # Фільтрація за активністю, якщо це вказано в опціях
                if options.get('activeOnly', False) and not is_active:
                    continue

                level1_data.append({
                    'id': f'WX{referral["referee_id"]}',
                    'active': is_active,
                    'totalEarnings': total_earnings,
                    'lastEarningDate': activity.get('last_updated',
                                                    datetime.utcnow().isoformat()) if activity else datetime.utcnow().isoformat()
                })

            # Отримання даних про заробітки для рефералів 2-го рівня
            for referral in level2_referrals.data:
                # Знаходимо реферера 1-го рівня для цього реферала 2-го рівня
                referrer_1lvl = supabase.table("referrals").select("*").eq(
                    "referee_id", referral['referee_id']
                ).eq("level", 1).execute()

                referrer_id = f'WX{referrer_1lvl.data[0]["referrer_id"]}' if referrer_1lvl.data else None

                # Отримуємо дані про активність
                activity = activities.get(referral['referee_id'])
                is_active = False
                if activity:
                    # Перевірка активності за критеріями
                    is_active = activity.get('is_active', False)
                    if activity.get('last_updated'):
                        last_updated = datetime.fromisoformat(activity['last_updated'].replace('Z', '+00:00'))
                        is_active = is_active and (last_updated > datetime.utcnow() - timedelta(days=7))

                # Рахуємо загальні заробітки реферала
                total_earnings = rewards_by_referral.get(referral['referee_id'], 0)

                # Фільтрація за активністю, якщо це вказано в опціях
                if options.get('activeOnly', False) and not is_active:
                    continue

                level2_data.append({
                    'id': f'WX{referral["referee_id"]}',
                    'referrerId': referrer_id,
                    'active': is_active,
                    'totalEarnings': total_earnings,
                    'lastEarningDate': activity.get('last_updated',
                                                    datetime.utcnow().isoformat()) if activity else datetime.utcnow().isoformat()
                })

            # Підраховуємо загальні заробітки
            level1_total_earnings = sum(ref['totalEarnings'] for ref in level1_data)
            level2_total_earnings = sum(ref['totalEarnings'] for ref in level2_data)

            return {
                'success': True,
                'userId': user_id_str,
                'timestamp': datetime.utcnow().isoformat(),
                'summary': {
                    'level1Count': len(level1_data),
                    'level2Count': len(level2_data),
                    'level1TotalEarnings': level1_total_earnings,
                    'level2TotalEarnings': level2_total_earnings,
                    'totalEarnings': level1_total_earnings + level2_total_earnings
                },
                'level1Referrals': level1_data,
                'level2Referrals': level2_data
            }
        except Exception as e:
            current_app.logger.error(f"Error getting referral earnings: {str(e)}")
            return {
                'success': False,
                'error': 'Failed to get referral earnings',
                'details': str(e)
            }

    @staticmethod
    def get_detailed_earnings(referral_id):
        """
        Отримує детальні дані про заробітки конкретного реферала

        Args:
            referral_id (int): ID реферала

        Returns:
            dict: Детальні дані про заробітки
        """
        try:
            referral_id_str = str(referral_id)

            # Перевіряємо існування реферала
            referral_exists = supabase.table("referrals").select("*").eq("referee_id", referral_id_str).execute()
            if not referral_exists.data:
                return {
                    'success': False,
                    'error': 'Referral not found',
                    'details': f'No referral with ID {referral_id_str}'
                }

            # Отримуємо всі винагороди, пов'язані з цим рефералом
            referral_rewards = supabase.table("percentage_rewards").select("*").eq("referral_id",
                                                                                   referral_id_str).execute()

            # Сумуємо винагороди за весь період
            total_earnings = sum(reward['reward_amount'] for reward in referral_rewards.data)

            # Рахуємо винагороди за останній місяць
            one_month_ago = datetime.utcnow() - timedelta(days=30)
            period_earnings = 0
            for reward in referral_rewards.data:
                reward_date = datetime.fromisoformat(reward['created_at'].replace('Z', '+00:00'))
                if reward_date > one_month_ago:
                    period_earnings += reward['reward_amount']

            # Групуємо активності за типами для відображення
            activities = []

            # Додаємо транзакції з винагородами, відсортовані за датою
            sorted_rewards = sorted(referral_rewards.data, key=lambda x: x['created_at'], reverse=True)[:10]
            for reward in sorted_rewards:
                activities.append({
                    'date': reward['created_at'],
                    'type': 'reward',
                    'amount': reward['reward_amount']
                })

            # Додаємо дані про участь у розіграшах, якщо вони є
            try:
                draw_participations = supabase.table("draw_participants").select("*").eq("user_id",
                                                                                         referral_id_str).order("id",
                                                                                                                desc=True).limit(
                    5).execute()

                for participation in draw_participations.data:
                    draw = supabase.table("draws").select("*").eq("id", participation['draw_id']).execute()
                    if draw.data:
                        activities.append({
                            'date': draw.data[0]['date'],
                            'type': 'draw',
                            'amount': participation['prize_amount'] if participation['is_winner'] else 0,
                            'drawName': draw.data[0]['name']
                        })
            except Exception as e:
                logger.warning(f"Помилка при отриманні даних про розіграші: {str(e)}")

            # Сортуємо всі активності за датою (від найновіших)
            activities.sort(key=lambda x: x['date'], reverse=True)

            return {
                'success': True,
                'referralId': referral_id_str,
                'totalEarnings': total_earnings,
                'periodEarnings': period_earnings,
                'lastEarningDate': referral_rewards.data[-1][
                    'created_at'] if referral_rewards.data else datetime.utcnow().isoformat(),
                'activities': activities
            }
        except Exception as e:
            current_app.logger.error(f"Error getting detailed earnings: {str(e)}")
            return {
                'success': False,
                'error': 'Failed to get detailed earnings',
                'details': str(e)
            }

    @staticmethod
    def calculate_percentage_reward(user_id, referral_id, amount, level):
        """
        Розраховує та нараховує відсоткову винагороду від заробітку реферала

        Args:
            user_id (int): ID користувача, який отримує винагороду
            referral_id (int): ID реферала, від заробітку якого нараховується винагорода
            amount (int): Сума заробітку реферала
            level (int): Рівень реферала (1 або 2)

        Returns:
            dict: Результат операції
        """
        try:
            # Перевірка коректності рівня
            if level not in [1, 2]:
                return {
                    'success': False,
                    'error': 'Invalid referral level',
                    'details': 'Level must be 1 or 2'
                }

            user_id_str = str(user_id)
            referral_id_str = str(referral_id)

            # Перевірка існування реферального зв'язку
            referral = supabase.table("referrals").select("*").eq(
                "referrer_id", user_id_str
            ).eq(
                "referee_id", referral_id_str
            ).eq("level", level).execute()

            if not referral.data:
                return {
                    'success': False,
                    'error': 'No referral relationship found',
                    'details': f'No level {level} referral link between referrer {user_id_str} and referee {referral_id_str}'
                }

            # Визначення відсоткової ставки на основі рівня
            rate = EarningsController.LEVEL_1_REWARD_RATE if level == 1 else EarningsController.LEVEL_2_REWARD_RATE

            # Розрахунок суми винагороди
            reward_amount = int(amount * rate)

            # Створення запису про винагороду
            reward_data = {
                "user_id": user_id_str,
                "referral_id": referral_id_str,
                "level": level,
                "rate": rate,
                "base_amount": amount,
                "reward_amount": reward_amount,
                "created_at": datetime.utcnow().isoformat()
            }
            reward_result = supabase.table("percentage_rewards").insert(reward_data).execute()

            # Оновлення балансу користувача
            try:
                # Отримуємо поточний баланс
                user_response = supabase.table("winix").select("balance").eq("telegram_id", user_id_str).execute()

                if user_response.data:
                    current_balance = float(user_response.data[0].get('balance', 0))
                    new_balance = current_balance + reward_amount

                    # Оновлюємо баланс
                    supabase.table("winix").update({
                        "balance": new_balance,
                        "updated_at": datetime.utcnow().isoformat()
                    }).eq("telegram_id", user_id_str).execute()

                    logger.info(f"Оновлення балансу для користувача {user_id_str}: {current_balance} -> {new_balance}")
                else:
                    logger.warning(f"Користувача {user_id_str} не знайдено в таблиці winix")

            except Exception as e:
                logger.error(f"Помилка при оновленні балансу: {str(e)}")

            # Запис транзакції
            try:
                transaction_data = {
                    "telegram_id": user_id_str,
                    "type": "percentage_reward",
                    "amount": reward_amount,
                    "description": f"Відсоткова винагорода ({int(rate * 100)}%) від активності реферала {referral_id_str}",
                    "status": "completed",
                    "created_at": datetime.utcnow().isoformat()
                }
                supabase.table("transactions").insert(transaction_data).execute()
            except Exception as e:
                logger.info(f"Запис транзакції не доданий: {str(e)}")

            return {
                'success': True,
                'message': 'Percentage reward successfully calculated and awarded',
                'reward': {
                    'id': reward_result.data[0]['id'] if reward_result.data else None,
                    'user_id': user_id_str,
                    'referral_id': referral_id_str,
                    'level': level,
                    'rate': rate,
                    'base_amount': amount,
                    'reward_amount': reward_amount,
                    'created_at': reward_data['created_at']
                }
            }
        except Exception as e:
            current_app.logger.error(f"Error calculating percentage reward: {str(e)}")
            return {
                'success': False,
                'error': 'Failed to calculate percentage reward',
                'details': str(e)
            }

    @staticmethod
    def get_percentage_rewards(user_id, options=None):
        """
        Отримує історію відсоткових винагород користувача

        Args:
            user_id (int): ID користувача
            options (dict, optional): Додаткові опції для фільтрації.
                Може містити ключі: 'startDate', 'endDate', 'level'

        Returns:
            dict: Історія відсоткових винагород
        """
        if options is None:
            options = {}

        try:
            user_id_str = str(user_id)

            # Базовий запит
            query = supabase.table("percentage_rewards").select("*").eq("user_id", user_id_str)

            # Фільтрація за рівнем, якщо вказано
            if 'level' in options:
                query = query.eq("level", options['level'])

            # Отримання результатів
            rewards_result = query.execute()
            rewards = rewards_result.data

            # Фільтрація за датою, якщо вказано
            if 'startDate' in options and options['startDate']:
                start_date = datetime.fromisoformat(options['startDate'].replace('Z', '+00:00'))
                rewards = [r for r in rewards if
                           datetime.fromisoformat(r['created_at'].replace('Z', '+00:00')) >= start_date]

            if 'endDate' in options and options['endDate']:
                end_date = datetime.fromisoformat(options['endDate'].replace('Z', '+00:00'))
                rewards = [r for r in rewards if
                           datetime.fromisoformat(r['created_at'].replace('Z', '+00:00')) <= end_date]

            # Сортування за датою (найновіші спочатку)
            rewards.sort(key=lambda x: x['created_at'], reverse=True)

            # Підрахунок загальної суми винагород
            total_amount = sum(reward['reward_amount'] for reward in rewards)

            # Групування винагород за рівнями
            level1_rewards = [r for r in rewards if r['level'] == 1]
            level2_rewards = [r for r in rewards if r['level'] == 2]

            # Підрахунок загальних сум для кожного рівня
            level1_total = sum(r['reward_amount'] for r in level1_rewards)
            level2_total = sum(r['reward_amount'] for r in level2_rewards)

            # Додаємо деталі про рефералів
            detailed_rewards = []

            # Оптимізований запит для отримання імен рефералів
            if rewards:
                referral_ids = list(set([r['referral_id'] for r in rewards]))
                users_response = supabase.table("winix").select("telegram_id, username").in_("telegram_id",
                                                                                             referral_ids).execute()
                referee_names = {user['telegram_id']: user.get('username', 'User') for user in users_response.data}
            else:
                referee_names = {}

            # Форматуємо винагороди для відповіді
            for reward in rewards:
                reward_data = {
                    'id': reward.get('id'),
                    'user_id': reward['user_id'],
                    'referral_id': reward['referral_id'],
                    'level': reward['level'],
                    'rate': reward['rate'],
                    'base_amount': reward['base_amount'],
                    'reward_amount': reward['reward_amount'],
                    'created_at': reward['created_at']
                }

                # Додаємо ім'я реферала, якщо воно доступне
                if reward['referral_id'] in referee_names:
                    reward_data['referee_name'] = referee_names[reward['referral_id']]

                detailed_rewards.append(reward_data)

            return {
                'success': True,
                'user_id': user_id_str,
                'total_rewards': len(rewards),
                'total_amount': total_amount,
                'level1_count': len(level1_rewards),
                'level1_total': level1_total,
                'level2_count': len(level2_rewards),
                'level2_total': level2_total,
                'rewards': detailed_rewards
            }
        except Exception as e:
            current_app.logger.error(f"Error getting percentage rewards: {str(e)}")
            return {
                'success': False,
                'error': 'Failed to get percentage rewards',
                'details': str(e)
            }

    @staticmethod
    def get_earnings_summary(user_id):
        """
        Отримує зведену інформацію про всі заробітки від реферальної системи

        Args:
            user_id (int): ID користувача

        Returns:
            dict: Зведена інформація про заробітки
        """
        try:
            user_id_str = str(user_id)

            # Отримання прямих бонусів
            direct_bonuses = supabase.table("direct_bonuses").select("*").eq("referrer_id", user_id_str).execute()
            direct_bonuses_total = sum(bonus['amount'] for bonus in direct_bonuses.data)

            # Отримання відсоткових винагород
            percentage_rewards = supabase.table("percentage_rewards").select("*").eq("user_id", user_id_str).execute()
            percentage_rewards_total = sum(reward['reward_amount'] for reward in percentage_rewards.data)

            # Підрахунок кількості рефералів
            level1_count = len(
                supabase.table("referrals").select("*").eq("referrer_id", user_id_str).eq("level", 1).execute().data)
            level2_count = len(
                supabase.table("referrals").select("*").eq("referrer_id", user_id_str).eq("level", 2).execute().data)

            # Загальний заробіток від рефералів
            referrals_earnings = direct_bonuses_total + percentage_rewards_total

            # Додаткова статистика: заробіток за останній місяць
            one_month_ago = datetime.utcnow() - timedelta(days=30)
            recent_rewards = 0
            recent_bonuses = 0

            for reward in percentage_rewards.data:
                reward_date = datetime.fromisoformat(reward['created_at'].replace('Z', '+00:00'))
                if reward_date > one_month_ago:
                    recent_rewards += reward['reward_amount']

            for bonus in direct_bonuses.data:
                bonus_date = datetime.fromisoformat(bonus['created_at'].replace('Z', '+00:00'))
                if bonus_date > one_month_ago:
                    recent_bonuses += bonus['amount']

            recent_earnings = recent_rewards + recent_bonuses

            # Формування зведеної інформації
            summary = {
                'success': True,
                'user_id': user_id_str,
                'total_earnings': {
                    'direct_bonuses': direct_bonuses_total,
                    'percentage_rewards': percentage_rewards_total,
                    'total': referrals_earnings
                },
                'referrals_count': {
                    'level1': level1_count,
                    'level2': level2_count,
                    'total': level1_count + level2_count
                },
                'recent_earnings': {
                    'period': '30 днів',
                    'amount': recent_earnings
                },
                'total_bonuses': len(direct_bonuses.data),
                'total_rewards': len(percentage_rewards.data)
            }

            return summary
        except Exception as e:
            current_app.logger.error(f"Error getting earnings summary: {str(e)}")
            return {
                'success': False,
                'error': 'Failed to get earnings summary',
                'details': str(e)
            }