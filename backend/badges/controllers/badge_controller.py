from models.badge import UserBadge
from models.referral import Referral
from database import db
from flask import current_app
from sqlalchemy.exc import SQLAlchemyError
from datetime import datetime


class BadgeController:
    """
    Контролер для управління бейджами
    """

    # Константи порогів для отримання бейджів
    BADGE_THRESHOLDS = {
        'BRONZE': 25,  # 25 рефералів - бронзова медаль
        'SILVER': 50,  # 50 рефералів - срібна медаль
        'GOLD': 100,  # 100 рефералів - золота медаль
        'PLATINUM': 500  # 500 рефералів - платинова медаль
    }

    # Константи винагород за бейджі
    BADGE_REWARDS = {
        'BRONZE': 2500,  # 2500 winix за бронзову медаль
        'SILVER': 5000,  # 5000 winix за срібну медаль
        'GOLD': 10000,  # 10000 winix за золоту медаль
        'PLATINUM': 20000  # 20000 winix за платинову медаль
    }

    @staticmethod
    def check_badges(user_id):
        """
        Перевіряє бейджі користувача і нараховує нові, якщо досягнуто відповідних порогів

        Args:
            user_id (int): ID користувача

        Returns:
            dict: Результат перевірки бейджів
        """
        try:
            # Отримуємо загальну кількість рефералів користувача
            referrals_count = Referral.query.filter_by(referrer_id=user_id).count()

            # Отримуємо всі існуючі бейджі користувача
            existing_badges = UserBadge.query.filter_by(user_id=user_id).all()
            existing_badge_types = set(badge.badge_type for badge in existing_badges)

            # Перевіряємо досягнення нових бейджів
            new_badges = []

            for badge_type, threshold in BadgeController.BADGE_THRESHOLDS.items():
                if referrals_count >= threshold and badge_type not in existing_badge_types:
                    # Створюємо новий бейдж
                    new_badge = UserBadge(
                        user_id=user_id,
                        badge_type=badge_type,
                        reward_amount=BadgeController.BADGE_REWARDS[badge_type]
                    )
                    db.session.add(new_badge)
                    new_badges.append(new_badge)

            # Зберігаємо зміни в базі даних
            if new_badges:
                db.session.commit()

            # Формуємо відповідь
            return {
                'success': True,
                'user_id': user_id,
                'total_referrals': referrals_count,
                'existing_badges': [badge.to_dict() for badge in existing_badges],
                'new_badges': [badge.to_dict() for badge in new_badges]
            }
        except SQLAlchemyError as e:
            db.session.rollback()
            current_app.logger.error(f"Database error during badge check: {str(e)}")
            return {
                'success': False,
                'error': 'Database error during badge check',
                'details': str(e)
            }
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Error checking badges: {str(e)}")
            return {
                'success': False,
                'error': 'Failed to check badges',
                'details': str(e)
            }

    @staticmethod
    def get_user_badges(user_id):
        """
        Отримує всі бейджі користувача

        Args:
            user_id (int): ID користувача

        Returns:
            dict: Інформація про бейджі користувача
        """
        try:
            # Отримуємо загальну кількість рефералів користувача
            referrals_count = Referral.query.filter_by(referrer_id=user_id).count()

            # Отримуємо всі бейджі користувача
            badges = UserBadge.query.filter_by(user_id=user_id).all()

            # Формуємо список доступних, але ще не отриманих бейджів
            existing_badge_types = set(badge.badge_type for badge in badges)
            available_badges = []

            for badge_type, threshold in BadgeController.BADGE_THRESHOLDS.items():
                if badge_type not in existing_badge_types:
                    available_badges.append({
                        'badge_type': badge_type,
                        'threshold': threshold,
                        'reward_amount': BadgeController.BADGE_REWARDS[badge_type],
                        'progress': min(referrals_count, threshold),
                        'completion_percentage': min(100,
                                                     int((referrals_count / threshold) * 100)) if threshold > 0 else 0
                    })

            return {
                'success': True,
                'user_id': user_id,
                'total_referrals': referrals_count,
                'badges': [badge.to_dict() for badge in badges],
                'available_badges': available_badges
            }
        except Exception as e:
            current_app.logger.error(f"Error getting user badges: {str(e)}")
            return {
                'success': False,
                'error': 'Failed to get user badges',
                'details': str(e)
            }

    @staticmethod
    def claim_badge_reward(user_id, badge_type):
        """
        Отримує винагороду за бейдж

        Args:
            user_id (int): ID користувача
            badge_type (str): Тип бейджа

        Returns:
            dict: Результат отримання винагороди
        """
        try:
            # Перевіряємо, чи є такий бейдж у користувача
            badge = UserBadge.query.filter_by(
                user_id=user_id,
                badge_type=badge_type
            ).first()

            if not badge:
                return {
                    'success': False,
                    'error': 'Badge not found',
                    'details': f'User {user_id} does not have badge {badge_type}'
                }

            # Перевіряємо, чи не була вже отримана винагорода
            if badge.claimed:
                return {
                    'success': False,
                    'error': 'Reward already claimed',
                    'details': f'Reward for badge {badge_type} has already been claimed'
                }

            # Отримуємо винагороду
            badge.claim_reward()
            db.session.commit()

            # В реальному додатку тут буде код для нарахування валюти користувачу

            return {
                'success': True,
                'message': 'Badge reward successfully claimed',
                'badge': badge.to_dict(),
                'reward_amount': badge.reward_amount
            }
        except SQLAlchemyError as e:
            db.session.rollback()
            current_app.logger.error(f"Database error during badge reward claim: {str(e)}")
            return {
                'success': False,
                'error': 'Database error during badge reward claim',
                'details': str(e)
            }
        except Exception as e:
            db.session.rollback()
            current_app.logger.error(f"Error claiming badge reward: {str(e)}")
            return {
                'success': False,
                'error': 'Failed to claim badge reward',
                'details': str(e)
            }