from supabase_client import supabase
from flask import jsonify, current_app
from datetime import datetime
import logging

# Налаштування логування
logger = logging.getLogger(__name__)


class BonusController:
    """
    Контролер для управління прямими бонусами за запрошення рефералів
    """

    # Константа для розміру прямого бонусу
    DIRECT_BONUS_AMOUNT = 50  # 50 winix за запрошення реферала

    @staticmethod
    def award_direct_bonus(referrer_id, referee_id, amount=None):
        """
        Нараховує прямий бонус за запрошення реферала

        Args:
            referrer_id (int): ID користувача, який отримує бонус
            referee_id (int): ID запрошеного користувача
            amount (int, optional): Сума бонусу. Defaults to None (використовуватиметься стандартна сума).

        Returns:
            dict: Результат операції
        """
        try:
            # Якщо сума не вказана, використовуємо стандартну
            if amount is None:
                amount = BonusController.DIRECT_BONUS_AMOUNT

            # Конвертуємо ID в рядки для уніформності
            referrer_id_str = str(referrer_id)
            referee_id_str = str(referee_id)

            # Перевірка, чи існує реферальний зв'язок
            referral = supabase.table("referrals").select("*").eq(
                "referrer_id", referrer_id_str
            ).eq(
                "referee_id", referee_id_str
            ).eq("level", 1).execute()

            if not referral.data:
                logger.warning(
                    f"award_direct_bonus: Не знайдено реферальний зв'язок між {referrer_id_str} та {referee_id_str}")
                return {
                    'success': False,
                    'error': 'No referral relationship found',
                    'details': f'No level 1 referral link between referrer {referrer_id_str} and referee {referee_id_str}'
                }

            # Перевірка, чи бонус вже був нарахований
            existing_bonus = supabase.table("direct_bonuses").select("*").eq("referee_id", referee_id_str).execute()
            if existing_bonus.data:
                return {
                    'success': False,
                    'error': 'Bonus already awarded for this referral',
                    'details': f'Bonus of {existing_bonus.data[0]["amount"]} already awarded to referrer {existing_bonus.data[0]["referrer_id"]}'
                }

            # Нарахування бонусу
            new_bonus_data = {
                "referrer_id": referrer_id_str,
                "referee_id": referee_id_str,
                "amount": amount,
                "created_at": datetime.utcnow().isoformat()
            }
            new_bonus_result = supabase.table("direct_bonuses").insert(new_bonus_data).execute()

            # Оновлення балансу користувача
            try:
                # Отримуємо поточний баланс
                user_response = supabase.table("winix").select("balance").eq("telegram_id", referrer_id_str).execute()

                if user_response.data:
                    current_balance = float(user_response.data[0].get('balance', 0))
                    new_balance = current_balance + amount

                    # Оновлюємо баланс
                    supabase.table("winix").update({
                        "balance": new_balance,
                        "updated_at": datetime.utcnow().isoformat()
                    }).eq("telegram_id", referrer_id_str).execute()

                    logger.info(
                        f"Оновлення балансу для користувача {referrer_id_str}: {current_balance} -> {new_balance}")
                else:
                    logger.warning(f"Користувача {referrer_id_str} не знайдено в таблиці winix")

            except Exception as e:
                logger.error(f"Помилка при оновленні балансу: {str(e)}")

            # Запис транзакції
            try:
                transaction_data = {
                    "telegram_id": referrer_id_str,
                    "type": "referral_bonus",
                    "amount": amount,
                    "description": f"Бонус за запрошення реферала {referee_id_str}",
                    "status": "completed",
                    "created_at": datetime.utcnow().isoformat()
                }
                supabase.table("transactions").insert(transaction_data).execute()
            except Exception as e:
                logger.info(f"Запис транзакції не доданий: {str(e)}")

            logger.info(
                f"award_direct_bonus: Успішно нараховано бонус {amount} для {referrer_id_str} за реферала {referee_id_str}")

            return {
                'success': True,
                'message': 'Direct bonus successfully awarded',
                'bonus': {
                    'id': new_bonus_result.data[0]['id'] if new_bonus_result.data else None,
                    'referrer_id': referrer_id_str,
                    'referee_id': referee_id_str,
                    'amount': amount,
                    'created_at': new_bonus_data['created_at']
                }
            }
        except Exception as e:
            logger.error(f"Error awarding direct bonus: {str(e)}")
            return {
                'success': False,
                'error': 'Failed to award direct bonus',
                'details': str(e)
            }

    @staticmethod
    def get_bonus_history(user_id):
        """
        Отримує історію нарахованих прямих бонусів для користувача

        Args:
            user_id (int): ID користувача

        Returns:
            dict: Історія нарахованих бонусів
        """
        try:
            # Конвертуємо ID в рядок
            user_id_str = str(user_id)

            # Отримання всіх бонусів, де користувач є реферером
            bonuses = supabase.table("direct_bonuses").select("*").eq("referrer_id", user_id_str).execute()

            # Підрахунок загальної суми бонусів
            total_amount = sum(bonus['amount'] for bonus in bonuses.data)

            # Форматування бонусів для відповіді
            formatted_bonuses = []

            # Отримуємо імена рефералів одним запитом для оптимізації
            if bonuses.data:
                referee_ids = [bonus['referee_id'] for bonus in bonuses.data]
                users_response = supabase.table("winix").select("telegram_id, username").in_("telegram_id",
                                                                                             referee_ids).execute()

                # Створюємо мапу ID -> username
                user_map = {user['telegram_id']: user.get('username', 'User') for user in users_response.data}
            else:
                user_map = {}

            for bonus in bonuses.data:
                referee_info = {
                    'id': f'WX{bonus["referee_id"]}',
                    'username': user_map.get(bonus['referee_id'], 'User'),
                    'registrationDate': bonus['created_at']
                }

                formatted_bonus = {
                    'id': bonus.get('id'),
                    'referrer_id': bonus['referrer_id'],
                    'referee_id': bonus['referee_id'],
                    'amount': bonus['amount'],
                    'created_at': bonus['created_at'],
                    'referee_info': referee_info
                }
                formatted_bonuses.append(formatted_bonus)

            return {
                'success': True,
                'user_id': user_id_str,
                'total_bonuses': len(bonuses.data),
                'total_amount': total_amount,
                'bonuses': formatted_bonuses
            }
        except Exception as e:
            logger.error(f"Error getting bonus history: {str(e)}")
            return {
                'success': False,
                'error': 'Failed to get bonus history',
                'details': str(e)
            }