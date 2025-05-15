from models.referral import Referral
from models.direct_bonus import DirectBonus
from models.percentage_reward import PercentageReward
from main import db
from flask import jsonify, current_app
from sqlalchemy.exc import SQLAlchemyError
from datetime import datetime
import random  # Для генерації тестових даних


class EarningsController:
    """
    Контролер для управління заробітками від реферальної системи
    """

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

            # Отримання даних про заробітки для рефералів 1-го рівня
            for referral in level1_referrals:
                # Рахуємо загальні заробітки реферала
                # В реальному проєкті тут можна використовувати дані з інших таблиць
                total_earnings = EarningsController._calculate_mock_earnings(referral.referee_id)

                # Перевіряємо активність (для прикладу, всі з непарним ID активні)
                is_active = (referral.referee_id % 2 == 1)

                # Фільтрація за активністю, якщо це вказано в опціях
                if options.get('activeOnly', False) and not is_active:
                    continue

                level1_data.append({
                    'id': f'WX{referral.referee_id}',
                    'active': is_active,
                    'totalEarnings': total_earnings,
                    'lastEarningDate': datetime.utcnow().isoformat()
                })

            # Отримання даних про заробітки для рефералів 2-го рівня
            for referral in level2_referrals:
                # Знаходимо реферера 1-го рівня для цього реферала 2-го рівня
                referrer_1lvl = Referral.query.filter_by(
                    referee_id=referral.referee_id,
                    level=1
                ).first()

                referrer_id = f'WX{referrer_1lvl.referrer_id}' if referrer_1lvl else None

                # Рахуємо загальні заробітки реферала
                total_earnings = EarningsController._calculate_mock_earnings(referral.referee_id)

                # Перевіряємо активність (для прикладу, всі з непарним ID активні)
                is_active = (referral.referee_id % 2 == 1)

                # Фільтрація за активністю, якщо це вказано в опціях
                if options.get('activeOnly', False) and not is_active:
                    continue

                level2_data.append({
                    'id': f'WX{referral.referee_id}',
                    'referrerId': referrer_id,
                    'active': is_active,
                    'totalEarnings': total_earnings,
                    'lastEarningDate': datetime.utcnow().isoformat()
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
            # У реальному додатку тут буде запит до бази даних
            # Для тестування повертаємо моковані дані
            total_earnings = EarningsController._calculate_mock_earnings(referral_id)
            period_earnings = int(total_earnings * 0.2)  # 20% від загальних для останнього періоду

            # Генеруємо випадкові дані про активність
            activities = [
                {
                    'date': (datetime.utcnow().replace(day=datetime.utcnow().day - 2)).isoformat(),
                    'type': 'game',
                    'amount': random.randint(50, 200)
                },
                {
                    'date': (datetime.utcnow().replace(day=datetime.utcnow().day - 5)).isoformat(),
                    'type': 'deposit',
                    'amount': random.randint(100, 500)
                },
                {
                    'date': (datetime.utcnow().replace(day=datetime.utcnow().day - 7)).isoformat(),
                    'type': 'game',
                    'amount': random.randint(30, 150)
                }
            ]

            return {
                'success': True,
                'referralId': referral_id,
                'totalEarnings': total_earnings,
                'periodEarnings': period_earnings,
                'lastEarningDate': datetime.utcnow().isoformat(),
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

            # Визначення відсоткової ставки
            rate = 0.1 if level == 1 else 0.05

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
            if 'startDate' in options:
                start_date = datetime.fromisoformat(options['startDate'])
                query = query.filter(PercentageReward.created_at >= start_date)

            # Фільтрація за датою кінця, якщо вказано
            if 'endDate' in options:
                end_date = datetime.fromisoformat(options['endDate'])
                query = query.filter(PercentageReward.created_at <= end_date)

            # Отримання результатів
            rewards = query.all()

            # Підрахунок загальної суми винагород
            total_amount = sum(reward.reward_amount for reward in rewards)

            # Групування винагород за рівнями
            level1_rewards = [r for r in rewards if r.level == 1]
            level2_rewards = [r for r in rewards if r.level == 2]

            # Підрахунок загальних сум для кожного рівня
            level1_total = sum(r.reward_amount for r in level1_rewards)
            level2_total = sum(r.reward_amount for r in level2_rewards)

            return {
                'success': True,
                'user_id': user_id,
                'total_rewards': len(rewards),
                'total_amount': total_amount,
                'level1_count': len(level1_rewards),
                'level1_total': level1_total,
                'level2_count': len(level2_rewards),
                'level2_total': level2_total,
                'rewards': [reward.to_dict() for reward in rewards]
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
            # Отримання даних про заробітки рефералів
            earnings_result = EarningsController.get_referral_earnings(user_id)

            # Отримання історії прямих бонусів
            from referrals.controllers.bonus_controller import BonusController
            bonus_result = BonusController.get_bonus_history(user_id)

            # Отримання історії відсоткових винагород
            rewards_result = EarningsController.get_percentage_rewards(user_id)

            # Якщо будь-який з запитів не вдався, повертаємо помилку
            if not all([
                earnings_result.get('success', False),
                bonus_result.get('success', False),
                rewards_result.get('success', False)
            ]):
                return {
                    'success': False,
                    'error': 'Failed to get complete earnings data',
                    'details': 'One or more data sources returned an error'
                }

            # Формування зведеного результату
            summary = {
                'success': True,
                'user_id': user_id,
                'total_earnings': {
                    'referrals': earnings_result['summary']['totalEarnings'],
                    'direct_bonuses': bonus_result['total_amount'],
                    'percentage_rewards': rewards_result['total_amount'],
                    'total': (
                            earnings_result['summary']['totalEarnings'] +
                            bonus_result['total_amount'] +
                            rewards_result['total_amount']
                    )
                },
                'referrals_count': {
                    'level1': earnings_result['summary']['level1Count'],
                    'level2': earnings_result['summary']['level2Count'],
                    'total': earnings_result['summary']['level1Count'] + earnings_result['summary']['level2Count']
                },
                'total_bonuses': bonus_result['total_bonuses'],
                'total_rewards': rewards_result['total_rewards']
            }

            return summary
        except Exception as e:
            current_app.logger.error(f"Error getting earnings summary: {str(e)}")
            return {
                'success': False,
                'error': 'Failed to get earnings summary',
                'details': str(e)
            }

    @staticmethod
    def _calculate_mock_earnings(user_id):
        """
        Допоміжний метод для генерації випадкових заробітків (для тестування)

        Args:
            user_id (int): ID користувача

        Returns:
            int: Сума заробітків
        """
        # Для простоти використовуємо ID користувача як основу для розрахунку
        base_earnings = user_id * 10
        return base_earnings + (user_id % 100) * 5