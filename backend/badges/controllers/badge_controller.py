from supabase_client import supabase
from flask import current_app
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
            user_id_str = str(user_id)

            # Отримуємо загальну кількість рефералів користувача
            referrals_result = supabase.table("referrals").select("*").eq("referrer_id", user_id_str).execute()
            referrals_count = len(referrals_result.data)

            # Отримуємо всі існуючі бейджі користувача
            existing_badges_result = supabase.table("user_badges").select("*").eq("user_id", user_id_str).execute()
            existing_badges = existing_badges_result.data
            existing_badge_types = set(badge['badge_type'] for badge in existing_badges)

            # Перевіряємо досягнення нових бейджів
            new_badges = []

            for badge_type, threshold in BadgeController.BADGE_THRESHOLDS.items():
                if referrals_count >= threshold and badge_type not in existing_badge_types:
                    # Створюємо новий бейдж
                    new_badge_data = {
                        "user_id": user_id_str,
                        "badge_type": badge_type,
                        "reward_amount": BadgeController.BADGE_REWARDS[badge_type],
                        "earned_at": datetime.utcnow().isoformat(),
                        "claimed": False
                    }

                    result = supabase.table("user_badges").insert(new_badge_data).execute()
                    if result.data:
                        new_badges.append(result.data[0])

            # Формуємо відповідь
            return {
                'success': True,
                'user_id': user_id_str,
                'total_referrals': referrals_count,
                'existing_badges': existing_badges,
                'new_badges': new_badges
            }
        except Exception as e:
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
            user_id_str = str(user_id)

            # Отримуємо загальну кількість рефералів користувача
            referrals_result = supabase.table("referrals").select("*").eq("referrer_id", user_id_str).execute()
            referrals_count = len(referrals_result.data)

            # Отримуємо всі бейджі користувача
            badges_result = supabase.table("user_badges").select("*").eq("user_id", user_id_str).execute()
            badges = badges_result.data

            # Формуємо список доступних, але ще не отриманих бейджів
            existing_badge_types = set(badge['badge_type'] for badge in badges)
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
                'user_id': user_id_str,
                'total_referrals': referrals_count,
                'badges': badges,
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
            user_id_str = str(user_id)

            # Перевіряємо, чи є такий бейдж у користувача
            badge_result = supabase.table("user_badges").select("*").eq(
                "user_id", user_id_str
            ).eq("badge_type", badge_type).execute()

            if not badge_result.data:
                return {
                    'success': False,
                    'error': 'Badge not found',
                    'details': f'User {user_id_str} does not have badge {badge_type}'
                }

            badge = badge_result.data[0]

            # Перевіряємо, чи не була вже отримана винагорода
            if badge['claimed']:
                return {
                    'success': False,
                    'error': 'Reward already claimed',
                    'details': f'Reward for badge {badge_type} has already been claimed'
                }

            # Оновлюємо статус отримання винагороди
            update_result = supabase.table("user_badges").update({
                "claimed": True,
                "claimed_at": datetime.utcnow().isoformat()
            }).eq("id", badge['id']).execute()

            if not update_result.data:
                return {
                    'success': False,
                    'error': 'Failed to update badge status',
                    'details': 'Database error while updating badge'
                }

            # Оновлюємо баланс користувача
            try:
                # Отримуємо поточний баланс
                user_response = supabase.table("winix").select("balance").eq("telegram_id", user_id_str).execute()

                if user_response.data:
                    current_balance = float(user_response.data[0].get('balance', 0))
                    new_balance = current_balance + badge['reward_amount']

                    # Оновлюємо баланс
                    supabase.table("winix").update({
                        "balance": new_balance,
                        "updated_at": datetime.utcnow().isoformat()
                    }).eq("telegram_id", user_id_str).execute()

                    # Записуємо транзакцію
                    transaction_data = {
                        "telegram_id": user_id_str,
                        "type": "badge_reward",
                        "amount": badge['reward_amount'],
                        "description": f"Винагорода за {badge_type} бейдж",
                        "status": "completed",
                        "created_at": datetime.utcnow().isoformat()
                    }
                    supabase.table("transactions").insert(transaction_data).execute()

                    current_app.logger.info(
                        f"Badge reward claimed: user {user_id_str}, badge {badge_type}, amount {badge['reward_amount']}")
            except Exception as e:
                current_app.logger.error(f"Error updating user balance: {str(e)}")

            # Отримуємо оновлені дані бейджа
            updated_badge = supabase.table("user_badges").select("*").eq("id", badge['id']).execute()

            return {
                'success': True,
                'message': 'Badge reward successfully claimed',
                'badge': updated_badge.data[0] if updated_badge.data else badge,
                'reward_amount': badge['reward_amount']
            }
        except Exception as e:
            current_app.logger.error(f"Error claiming badge reward: {str(e)}")
            return {
                'success': False,
                'error': 'Failed to claim badge reward',
                'details': str(e)
            }