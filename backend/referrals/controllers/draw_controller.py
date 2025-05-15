from models.draw import Draw, DrawParticipant
from models.referral import Referral
from main import db
from flask import current_app
from sqlalchemy.exc import SQLAlchemyError
from datetime import datetime
import random


class DrawController:
    """
    Контролер для керування розіграшами та участю рефералів у них
    """

    @staticmethod
    def get_referral_draws(referral_id):
        """
        Отримує дані про участь реферала у розіграшах

        Args:
            referral_id (int): ID реферала

        Returns:
            dict: Дані про участь у розіграшах
        """
        try:
            # Отримуємо реферала для перевірки його існування
            referral = Referral.query.filter_by(referee_id=referral_id).first()
            if not referral:
                return {
                    'success': False,
                    'error': 'Referral not found',
                    'details': f'No referral with ID {referral_id}'
                }

            # Отримуємо список участі в розіграшах для цього реферала
            draw_participants = DrawParticipant.query.filter_by(user_id=referral_id).all()

            # Збираємо ID розіграшів
            draw_ids = [participant.draw_id for participant in draw_participants]

            # Отримуємо дані про розіграші
            draws = []

            if draw_ids:
                # Отримуємо інформацію про всі розіграші, в яких брав участь реферал
                draw_info = Draw.query.filter(Draw.id.in_(draw_ids)).all()

                # Створюємо словник для швидкого пошуку розіграшів за ID
                draw_dict = {draw.id: draw for draw in draw_info}

                # Об'єднуємо інформацію про розіграші з інформацією про участь
                for participant in draw_participants:
                    draw = draw_dict.get(participant.draw_id)
                    if draw:
                        draws.append({
                            'drawId': participant.draw_id,
                            'date': draw.date.isoformat(),
                            'name': draw.name,
                            'isWon': participant.is_winner,
                            'prize': participant.prize_amount,
                            'ticketsCount': 1  # За замовчуванням 1 квиток
                        })

            # Підраховуємо загальну статистику
            total_participation = len(draws)
            win_count = sum(1 for draw in draws if draw['isWon'])

            return {
                'success': True,
                'referralId': referral_id,
                'totalParticipation': total_participation,
                'winCount': win_count,
                'draws': draws
            }
        except SQLAlchemyError as e:
            db.session.rollback()
            current_app.logger.error(f"Database error getting referral draws: {str(e)}")
            return {
                'success': False,
                'error': 'Database error',
                'details': str(e)
            }
        except Exception as e:
            current_app.logger.error(f"Error getting referral draws: {str(e)}")
            return {
                'success': False,
                'error': 'Failed to get referral draws',
                'details': str(e)
            }

    @staticmethod
    def get_draw_details(referral_id, draw_id):
        """
        Отримує детальні дані про участь реферала у конкретному розіграші

        Args:
            referral_id (int): ID реферала
            draw_id (int): ID розіграшу

        Returns:
            dict: Детальні дані про участь у розіграші
        """
        try:
            # Отримуємо запис про участь
            participation = DrawParticipant.query.filter_by(
                user_id=referral_id,
                draw_id=draw_id
            ).first()

            if not participation:
                return {
                    'success': False,
                    'error': 'Participation not found',
                    'details': f'No participation record for referral {referral_id} in draw {draw_id}'
                }

            # Отримуємо інформацію про розіграш
            draw = Draw.query.get(draw_id)
            if not draw:
                return {
                    'success': False,
                    'error': 'Draw not found',
                    'details': f'No draw with ID {draw_id}'
                }

            # Для цього API використовуємо моковані дані квитків, оскільки
            # в реальній системі можуть бути додаткові таблиці для квитків
            ticket_numbers = [1000 + random.randint(1, 9000) for _ in range(random.randint(1, 5))]

            # Підраховуємо загальну кількість учасників цього розіграшу
            total_participants = DrawParticipant.query.filter_by(draw_id=draw_id).count()

            # Отримуємо номер виграшного квитка (моковані дані)
            winning_ticket = 1000 + random.randint(1, 9000)

            return {
                'success': True,
                'drawId': draw_id,
                'referralId': referral_id,
                'date': draw.date.isoformat(),
                'name': draw.name,
                'ticketsCount': len(ticket_numbers),
                'ticketNumbers': ticket_numbers,
                'isWon': participation.is_winner,
                'prize': participation.prize_amount,
                'totalParticipants': total_participants,
                'winningTicket': winning_ticket
            }
        except SQLAlchemyError as e:
            db.session.rollback()
            current_app.logger.error(f"Database error getting draw details: {str(e)}")
            return {
                'success': False,
                'error': 'Database error',
                'details': str(e)
            }
        except Exception as e:
            current_app.logger.error(f"Error getting draw details: {str(e)}")
            return {
                'success': False,
                'error': 'Failed to get draw details',
                'details': str(e)
            }

    @staticmethod
    def get_draws_participation_stats(owner_id, options=None):
        """
        Отримує статистику участі рефералів у розіграшах за період

        Args:
            owner_id (int): ID власника рефералів
            options (dict, optional): Опції для фільтрації. Може містити
                startDate, endDate.

        Returns:
            dict: Статистика участі рефералів у розіграшах
        """
        if options is None:
            options = {}

        try:
            # Отримуємо ІД всіх рефералів цього власника
            referrals = Referral.query.filter_by(referrer_id=owner_id).all()

            if not referrals:
                return {
                    'success': True,
                    'ownerId': owner_id,
                    'totalDrawsCount': 0,
                    'totalParticipationCount': 0,
                    'totalWinCount': 0,
                    'totalPrize': 0,
                    'winRate': 0,
                    'referralsStats': [],
                    'period': {
                        'startDate': options.get('startDate'),
                        'endDate': options.get('endDate')
                    }
                }

            # Збираємо ID всіх рефералів
            referral_ids = [referral.referee_id for referral in referrals]

            # Базовий запит для всіх участей в розіграшах
            query = DrawParticipant.query.filter(
                DrawParticipant.user_id.in_(referral_ids)
            )

            # Додаємо фільтрацію за датою, якщо вказано
            if 'startDate' in options or 'endDate' in options:
                # Отримуємо відповідні розіграші з відповідними датами
                draws_query = Draw.query

                if 'startDate' in options:
                    start_date = datetime.fromisoformat(options['startDate'].replace('Z', '+00:00'))
                    draws_query = draws_query.filter(Draw.date >= start_date)

                if 'endDate' in options:
                    end_date = datetime.fromisoformat(options['endDate'].replace('Z', '+00:00'))
                    draws_query = draws_query.filter(Draw.date <= end_date)

                # Отримуємо ID розіграшів за вказаний період
                filtered_draws = draws_query.all()
                filtered_draw_ids = [draw.id for draw in filtered_draws]

                # Фільтруємо участь за ID розіграшів
                if filtered_draw_ids:
                    query = query.filter(DrawParticipant.draw_id.in_(filtered_draw_ids))
                else:
                    # Якщо немає розіграшів за вказаний період
                    return {
                        'success': True,
                        'ownerId': owner_id,
                        'totalDrawsCount': 0,
                        'totalParticipationCount': 0,
                        'totalWinCount': 0,
                        'totalPrize': 0,
                        'winRate': 0,
                        'referralsStats': [],
                        'period': {
                            'startDate': options.get('startDate'),
                            'endDate': options.get('endDate')
                        }
                    }

            # Отримуємо всі записи участі
            participations = query.all()

            # Підраховуємо загальну статистику
            total_participation_count = len(participations)
            total_win_count = sum(1 for p in participations if p.is_winner)
            total_prize = sum(p.prize_amount for p in participations if p.is_winner)

            # Розраховуємо відсоток виграшів
            win_rate = total_win_count / total_participation_count if total_participation_count > 0 else 0

            # Отримуємо статистику для кожного реферала
            referrals_stats = []
            for referral_id in referral_ids:
                # Фільтруємо участь для цього реферала
                referral_participations = [p for p in participations if p.user_id == referral_id]

                if referral_participations:
                    participation_count = len(referral_participations)
                    win_count = sum(1 for p in referral_participations if p.is_winner)
                    total_prize_referral = sum(p.prize_amount for p in referral_participations if p.is_winner)

                    # Отримуємо дату останньої участі
                    latest_participation = max(referral_participations, key=lambda p: p.id)
                    latest_draw = Draw.query.get(latest_participation.draw_id)

                    referrals_stats.append({
                        'referralId': referral_id,
                        'participationCount': participation_count,
                        'winCount': win_count,
                        'totalPrize': total_prize_referral,
                        'lastParticipationDate': latest_draw.date.isoformat() if latest_draw else None
                    })

            # Отримуємо загальну кількість унікальних розіграшів
            draw_ids = set(p.draw_id for p in participations)
            total_draws_count = len(draw_ids)

            return {
                'success': True,
                'ownerId': owner_id,
                'totalDrawsCount': total_draws_count,
                'totalParticipationCount': total_participation_count,
                'totalWinCount': total_win_count,
                'totalPrize': total_prize,
                'winRate': win_rate * 100,  # у відсотках
                'referralsStats': referrals_stats,
                'period': {
                    'startDate': options.get('startDate'),
                    'endDate': options.get('endDate')
                }
            }
        except SQLAlchemyError as e:
            db.session.rollback()
            current_app.logger.error(f"Database error getting draws participation stats: {str(e)}")
            return {
                'success': False,
                'error': 'Database error',
                'details': str(e)
            }
        except Exception as e:
            current_app.logger.error(f"Error getting draws participation stats: {str(e)}")
            return {
                'success': False,
                'error': 'Failed to get draws participation stats',
                'details': str(e)
            }

    @staticmethod
    def get_total_draws_count(owner_id):
        """
        Отримує загальну кількість розіграшів, у яких брали участь реферали

        Args:
            owner_id (int): ID власника рефералів

        Returns:
            dict: Загальна кількість розіграшів
        """
        try:
            # Отримуємо статистику, яка вже містить потрібні дані
            stats = DrawController.get_draws_participation_stats(owner_id)

            if not stats['success']:
                return stats

            return {
                'success': True,
                'ownerId': owner_id,
                'totalDrawsCount': stats['totalDrawsCount']
            }
        except Exception as e:
            current_app.logger.error(f"Error getting total draws count: {str(e)}")
            return {
                'success': False,
                'error': 'Failed to get total draws count',
                'details': str(e)
            }

    @staticmethod
    def get_most_active_in_draws(owner_id, limit=10):
        """
        Отримує список найактивніших рефералів за участю в розіграшах

        Args:
            owner_id (int): ID власника рефералів
            limit (int, optional): Кількість рефералів для включення в список. Defaults to 10.

        Returns:
            dict: Список найактивніших рефералів
        """
        try:
            # Отримуємо ІД всіх рефералів цього власника
            referrals = Referral.query.filter_by(referrer_id=owner_id).all()

            if not referrals:
                return {
                    'success': True,
                    'ownerId': owner_id,
                    'mostActive': []
                }

            # Збираємо ID всіх рефералів
            referral_ids = [referral.referee_id for referral in referrals]

            # Збираємо статистику про кожного реферала
            referrals_with_stats = []

            for referral_id in referral_ids:
                # Отримуємо записи участі для цього реферала
                participations = DrawParticipant.query.filter_by(user_id=referral_id).all()

                if participations:
                    participation_count = len(participations)
                    win_count = sum(1 for p in participations if p.is_winner)
                    total_prize = sum(p.prize_amount for p in participations if p.is_winner)

                    # Розраховуємо відсоток виграшів
                    win_rate = (win_count / participation_count) * 100 if participation_count > 0 else 0

                    # Отримуємо дату останньої участі
                    latest_participation = max(participations, key=lambda p: p.id)
                    latest_draw = Draw.query.get(latest_participation.draw_id)

                    referrals_with_stats.append({
                        'referralId': referral_id,
                        'participationCount': participation_count,
                        'winCount': win_count,
                        'winRate': win_rate,
                        'totalPrize': total_prize,
                        'lastParticipationDate': latest_draw.date.isoformat() if latest_draw else None
                    })

            # Сортуємо за кількістю участі (від найбільшої до найменшої)
            sorted_referrals = sorted(
                referrals_with_stats,
                key=lambda r: r['participationCount'],
                reverse=True
            )

            # Обмежуємо до вказаного ліміту
            return {
                'success': True,
                'ownerId': owner_id,
                'mostActive': sorted_referrals[:limit]
            }
        except SQLAlchemyError as e:
            db.session.rollback()
            current_app.logger.error(f"Database error getting most active referrals: {str(e)}")
            return {
                'success': False,
                'error': 'Database error',
                'details': str(e)
            }
        except Exception as e:
            current_app.logger.error(f"Error getting most active referrals: {str(e)}")
            return {
                'success': False,
                'error': 'Failed to get most active referrals',
                'details': str(e)
            }