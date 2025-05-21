from models.referral import Referral
from models.direct_bonus import DirectBonus
from models.percentage_reward import PercentageReward
from models.activity import ReferralActivity
from database import db
from flask import jsonify, current_app
from sqlalchemy.exc import SQLAlchemyError
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
            # Отримання рефералів 1-го рівня
            level1_query = Referral.query.filter_by(referrer_id=user_id, level=1)
            level1_referrals = level1_query.all()

            # Отримання рефералів 2-го рівня
            level2_query = Referral.query.filter_by(referrer_id=user_id, level=2)
            level2_referrals = level2_query.all()

            # Підготовка структури для відповіді
            level1_data = []
            level2_data = []

            # Отримання всіх ID рефералів для оптимізації запитів
            level1_ids = [ref.referee_id for ref in level1_referrals]
            level2_ids = [ref.referee_id for ref in level2_referrals]
            all_referral_ids = level1_ids + level2_ids

            # Отримання даних про активність всіх рефералів одним запитом
            activities = {}
            if all_referral_ids:
                activity_records = ReferralActivity.query.filter(ReferralActivity.user_id.in_(all_referral_ids)).all()
                activities = {act.user_id: act for act in activity_records}

            # Отримання всіх винагород за рефералів
            reward_records = PercentageReward.query.filter_by(user_id=user_id).all()
            rewards_by_referral = {}
            for reward in reward_records:
                if reward.referral_id not in rewards_by_referral:
                    rewards_by_referral[reward.referral_id] = 0
                rewards_by_referral[reward.referral_id] += reward.reward_amount

            # Отримання даних про заробітки для рефералів 1-го рівня
            for referral in level1_referrals:
                # Отримуємо дані про активність
                activity = activities.get(referral.referee_id)
                is_active = False
                if activity:
                    # Перевірка активності за критеріями
                    is_active = activity.is_active and (
                            activity.last_updated > datetime.utcnow() - timedelta(days=7)
                    )

                # Рахуємо загальні заробітки реферала
                total_earnings = rewards_by_referral.get(referral.referee_id, 0)

                # Фільтрація за активністю, якщо це вказано в опціях
                if options.get('activeOnly', False) and not is_active:
                    continue

                level1_data.append({
                    'id': f'WX{referral.referee_id}',
                    'active': is_active,
                    'totalEarnings': total_earnings,
                    'lastEarningDate': activity.last_updated.isoformat() if activity and activity.last_updated else datetime.utcnow().isoformat()
                })

            # Отримання даних про заробітки для рефералів 2-го рівня
            for referral in level2_referrals:
                # Знаходимо реферера 1-го рівня для цього реферала 2-го рівня
                referrer_1lvl = Referral.query.filter_by(
                    referee_id=referral.referee_id,
                    level=1
                ).first()

                referrer_id = f'WX{referrer_1lvl.referrer_id}' if referrer_1lvl else None

                # Отримуємо дані про активність
                activity = activities.get(referral.referee_id)
                is_active = False
                if activity:
                    # Перевірка активності за критеріями
                    is_active = activity.is_active and (
                            activity.last_updated > datetime.utcnow() - timedelta(days=7)
                    )

                # Рахуємо загальні заробітки реферала
                total_earnings = rewards_by_referral.get(referral.referee_id, 0)

                # Фільтрація за активністю, якщо це вказано в опціях
                if options.get('activeOnly', False) and not is_active:
                    continue

                level2_data.append({
                    'id': f'WX{referral.referee_id}',
                    'referrerId': referrer_id,
                    'active': is_active,
                    'totalEarnings': total_earnings,
                    'lastEarningDate': activity.last_updated.isoformat() if activity and activity.last_updated else datetime.utcnow().isoformat()
                })

            # Підраховуємо загальні заробітки
            level1_total_earnings = sum(ref['totalEarnings'] for ref in level1_data)
            level2_total_earnings = sum(ref['totalEarnings'] for ref in level2_data)

            return {
                'success': True,
                'userId': user_id,
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
            # Перевіряємо існування реферала
            referral_exists = Referral.query.filter_by(referee_id=referral_id).first()
            if not referral_exists:
                return {
                    'success': False,
                    'error': 'Referral not found',
                    'details': f'No referral with ID {referral_id}'
                }

            # Отримуємо всі винагороди, пов'язані з цим рефералом
            referral_rewards = PercentageReward.query.filter_by(referral_id=referral_id).all()

            # Сумуємо винагороди за весь період
            total_earnings = sum(reward.reward_amount for reward in referral_rewards)

            # Рахуємо винагороди за останній місяць
            one_month_ago = datetime.utcnow() - timedelta(days=30)
            period_earnings = sum(
                reward.reward_amount for reward in referral_rewards
                if reward.created_at > one_month_ago
            )

            # Групуємо активності за типами для відображення
            activities = []

            # Додаємо транзакції з винагородами, відсортовані за датою
            for reward in sorted(referral_rewards, key=lambda x: x.created_at, reverse=True)[
                          :10]:  # Останні 10 транзакцій
                activities.append({
                    'date': reward.created_at.isoformat(),
                    'type': 'reward',
                    'amount': reward.reward_amount
                })

            # Додаємо дані про участь у розіграшах, якщо вони є
            try:
                from models.draw import DrawParticipant, Draw
                draw_participations = DrawParticipant.query.filter_by(user_id=referral_id).order_by(
                    DrawParticipant.id.desc()).limit(5).all()

                for participation in draw_participations:
                    draw = Draw.query.get(participation.draw_id)
                    if draw:
                        activities.append({
                            'date': draw.date.isoformat(),
                            'type': 'draw',
                            'amount': participation.prize_amount if participation.is_winner else 0,
                            'drawName': draw.name
                        })
            except Exception as e:
                logger.warning(f"Помилка при отриманні даних про розіграші: {str(e)}")

            # Сортуємо всі активності за датою (від найновіших)
            activities.sort(key=lambda x: x['date'], reverse=True)

            return {
                'success': True,
                'referralId': referral_id,
                'totalEarnings': total_earnings,
                'periodEarnings': period_earnings,
                'lastEarningDate': referral_rewards[
                    -1].created_at.isoformat() if referral_rewards else datetime.utcnow().isoformat(),
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

            # Перевірка існування реферального зв'язку
            referral = Referral.query.filter_by(
                referrer_id=user_id,
                referee_id=referral_id,
                level=level
            ).first()

            if not referral:
                return {
                    'success': False,
                    'error': 'No referral relationship found',
                    'details': f'No level {level} referral link between referrer {user_id} and referee {referral_id}'
                }

            # Визначення відсоткової ставки на основі рівня
            rate = EarningsController.LEVEL_1_REWARD_RATE if level == 1 else EarningsController.LEVEL_2_REWARD_RATE

            # Розрахунок суми винагороди
            reward_amount = int(amount * rate)

            # Створення запису про винагороду
            reward = PercentageReward(
                user_id=user_id,
                referral_id=referral_id,
                level=level,
                rate=rate,
                base_amount=amount,
                reward_amount=reward_amount
            )

            db.session.add(reward)

            # Оновлення балансу користувача
            try:
                from users.controllers import update_user_balance

                # Нарахування винагороди до балансу
                balance_update = {
                    "balance": f"balance + {reward_amount}"  # SQL вираз для збільшення балансу
                }

                update_result = update_user_balance(user_id, balance_update)
                logger.info(f"Оновлення балансу для користувача {user_id}: {update_result}")

            except ImportError:
                # Якщо функція недоступна, оновлюємо безпосередньо через Supabase
                try:
                    from supabase_client import supabase

                    # Отримуємо поточний баланс
                    response = supabase.table("winix").select("balance").eq("telegram_id", user_id).execute()

                    if response.data:
                        current_balance = float(response.data[0].get('balance', 0))
                        new_balance = current_balance + reward_amount

                        # Оновлюємо баланс
                        supabase.table("winix").update({"balance": new_balance}).eq("telegram_id", user_id).execute()
                except ImportError:
                    logger.warning(f"Не вдалося імпортувати supabase_client для оновлення балансу")
                except Exception as e:
                    logger.error(f"Помилка при оновленні балансу через Supabase: {str(e)}")

            # Запис транзакції
            try:
                transaction_data = {
                    "telegram_id": user_id,
                    "type": "percentage_reward",
                    "amount": reward_amount,
                    "description": f"Відсоткова винагорода ({int(rate * 100)}%) від активності реферала {referral_id}",
                    "status": "completed",
                    "created_at": datetime.now().isoformat()
                }

                # Спочатку через db.session
                from models.transaction import Transaction
                new_transaction = Transaction(**transaction_data)
                db.session.add(new_transaction)
            except ImportError:
                # Якщо модель Transaction недоступна, використовуємо Supabase
                try:
                    from supabase_client import supabase
                    supabase.table("transactions").insert(transaction_data).execute()
                except:
                    logger.info("Запис транзакції не доданий - таблиця або клієнт недоступні")

            db.session.commit()

            return {
                'success': True,
                'message': 'Percentage reward successfully calculated and awarded',
                'reward': reward.to_dict()
            }
        except SQLAlchemyError as e:
            db.session.rollback()
            current_app.logger.error(f"Database error during reward calculation: {str(e)}")
            return {
                'success': False,
                'error': 'Database error during reward calculation',
                'details': str(e)
            }
        except Exception as e:
            db.session.rollback()
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
            # Базовий запит
            query = PercentageReward.query.filter_by(user_id=user_id)

            # Фільтрація за рівнем, якщо вказано
            if 'level' in options:
                query = query.filter_by(level=options['level'])

            # Фільтрація за датою початку, якщо вказано
            if 'startDate' in options and options['startDate']:
                start_date = datetime.fromisoformat(options['startDate'].replace('Z', '+00:00'))
                query = query.filter(PercentageReward.created_at >= start_date)

            # Фільтрація за датою кінця, якщо вказано
            if 'endDate' in options and options['endDate']:
                end_date = datetime.fromisoformat(options['endDate'].replace('Z', '+00:00'))
                query = query.filter(PercentageReward.created_at <= end_date)

            # Отримання результатів, відсортованих за датою (найновіші спочатку)
            rewards = query.order_by(PercentageReward.created_at.desc()).all()

            # Підрахунок загальної суми винагород
            total_amount = sum(reward.reward_amount for reward in rewards)

            # Групування винагород за рівнями
            level1_rewards = [r for r in rewards if r.level == 1]
            level2_rewards = [r for r in rewards if r.level == 2]

            # Підрахунок загальних сум для кожного рівня
            level1_total = sum(r.reward_amount for r in level1_rewards)
            level2_total = sum(r.reward_amount for r in level2_rewards)

            # Додаємо деталі про рефералів
            detailed_rewards = []
            referral_ids = [r.referral_id for r in rewards]

            # Оптимізований запит для отримання імен рефералів
            referee_names = {}
            try:
                from supabase_client import supabase
                # Отримуємо імена користувачів за один запит
                if referral_ids:
                    response = supabase.table("winix").select("telegram_id, username").in_("telegram_id",
                                                                                           referral_ids).execute()
                    if response.data:
                        for user_data in response.data:
                            referee_names[str(user_data.get('telegram_id'))] = user_data.get('username')
            except:
                logger.info("Не вдалося отримати імена користувачів")

            # Форматуємо винагороди для відповіді
            for reward in rewards:
                reward_data = reward.to_dict()

                # Додаємо ім'я реферала, якщо воно доступне
                referee_id = str(reward.referral_id)
                if referee_id in referee_names:
                    reward_data['referee_name'] = referee_names[referee_id]

                detailed_rewards.append(reward_data)

            return {
                'success': True,
                'user_id': user_id,
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
            # Отримання прямих бонусів
            direct_bonuses = DirectBonus.query.filter_by(referrer_id=user_id).all()
            direct_bonuses_total = sum(bonus.amount for bonus in direct_bonuses)

            # Отримання відсоткових винагород
            percentage_rewards = PercentageReward.query.filter_by(user_id=user_id).all()
            percentage_rewards_total = sum(reward.reward_amount for reward in percentage_rewards)

            # Підрахунок кількості рефералів
            level1_count = Referral.query.filter_by(referrer_id=user_id, level=1).count()
            level2_count = Referral.query.filter_by(referrer_id=user_id, level=2).count()

            # Загальний заробіток від рефералів
            referrals_earnings = direct_bonuses_total + percentage_rewards_total

            # Додаткова статистика: заробіток за останній місяць
            one_month_ago = datetime.utcnow() - timedelta(days=30)
            recent_rewards = [
                r for r in percentage_rewards
                if r.created_at > one_month_ago
            ]
            recent_bonuses = [
                b for b in direct_bonuses
                if b.created_at > one_month_ago
            ]

            recent_earnings = (
                    sum(r.reward_amount for r in recent_rewards) +
                    sum(b.amount for b in recent_bonuses)
            )

            # Формування зведеної інформації
            summary = {
                'success': True,
                'user_id': user_id,
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
                'total_bonuses': len(direct_bonuses),
                'total_rewards': len(percentage_rewards)
            }

            return summary
        except Exception as e:
            current_app.logger.error(f"Error getting earnings summary: {str(e)}")
            return {
                'success': False,
                'error': 'Failed to get earnings summary',
                'details': str(e)
            }