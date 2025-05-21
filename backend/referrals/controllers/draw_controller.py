from models.draw import Draw, DrawParticipant
from models.referral import Referral
from models.activity import ReferralActivity
from database import db
from flask import current_app
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy import func, desc, Integer
from datetime import datetime, timedelta
import logging

# Налаштування логування
logger = logging.getLogger(__name__)


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
            # Конвертуємо ID у рядок
            referral_id = str(referral_id)

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

            # Якщо немає участі, повертаємо порожній результат
            if not draw_participants:
                return {
                    'success': True,
                    'referralId': referral_id,
                    'totalParticipation': 0,
                    'winCount': 0,
                    'draws': []
                }

            # Збираємо ID розіграшів
            draw_ids = [participant.draw_id for participant in draw_participants]

            # Отримуємо дані про розіграші
            draws = []

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
                        'ticketsCount': 1  # За умовчанням 1 квиток на реферала
                    })

            # Підраховуємо загальну статистику
            total_participation = len(draws)
            win_count = sum(1 for draw in draws if draw['isWon'])

            # Оновлюємо активність реферала
            activity = ReferralActivity.query.filter_by(user_id=referral_id).first()
            if activity:
                if activity.draws_participation != total_participation:
                    activity.draws_participation = total_participation
                    activity.check_activity()
                    db.session.commit()
                    logger.info(f"Оновлено кількість участі в розіграшах для {referral_id}: {total_participation}")
            else:
                # Створюємо запис активності, якщо його немає
                new_activity = ReferralActivity(
                    user_id=referral_id,
                    draws_participation=total_participation
                )
                new_activity.check_activity()
                db.session.add(new_activity)
                db.session.commit()
                logger.info(f"Створено запис активності для {referral_id} з участю в розіграшах: {total_participation}")

            return {
                'success': True,
                'referralId': referral_id,
                'totalParticipation': total_participation,
                'winCount': win_count,
                'draws': draws
            }
        except SQLAlchemyError as e:
            db.session.rollback()
            logger.error(f"Database error getting referral draws: {str(e)}")
            return {
                'success': False,
                'error': 'Database error',
                'details': str(e)
            }
        except Exception as e:
            logger.error(f"Error getting referral draws: {str(e)}")
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
            # Конвертуємо ID у рядки
            referral_id = str(referral_id)
            draw_id = int(draw_id)

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

            # Підраховуємо загальну кількість учасників цього розіграшу
            total_participants = DrawParticipant.query.filter_by(draw_id=draw_id).count()

            # Отримуємо ID виграшного квитка (якщо є переможець)
            winning_ticket = None
            winner = DrawParticipant.query.filter_by(draw_id=draw_id, is_winner=True).first()
            if winner:
                winning_ticket = winner.id

            # Генеруємо список квитків (у реальній системі може бути окрема таблиця для квитків)
            # В даному випадку вважаємо, що ID участі = ID квитка
            ticket_numbers = [participation.id]

            return {
                'success': True,
                'drawId': draw_id,
                'referralId': referral_id,
                'date': draw.date.isoformat(),
                'name': draw.name,
                'ticketsCount': len(ticket_numbers),
                'ticketNumbers': ticket_numbers,
                'isWon': participation.is_winner,
                'prize': participation.prize_amount if participation.is_winner else 0,
                'totalParticipants': total_participants,
                'winningTicket': winning_ticket
            }
        except SQLAlchemyError as e:
            db.session.rollback()
            logger.error(f"Database error getting draw details: {str(e)}")
            return {
                'success': False,
                'error': 'Database error',
                'details': str(e)
            }
        except Exception as e:
            logger.error(f"Error getting draw details: {str(e)}")
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
            # Конвертуємо ID у рядок
            owner_id = str(owner_id)

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

                if 'startDate' in options and options['startDate']:
                    start_date = datetime.fromisoformat(options['startDate'].replace('Z', '+00:00'))
                    draws_query = draws_query.filter(Draw.date >= start_date)

                if 'endDate' in options and options['endDate']:
                    end_date = datetime.fromisoformat(options['endDate'].replace('Z', '+00:00'))
                    draws_query = draws_query.filter(Draw.date <= end_date)

                # Отримуємо ID розіграшів за вказаний період
                filtered_draws = draws_query.all()

                if not filtered_draws:
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

                filtered_draw_ids = [draw.id for draw in filtered_draws]

                # Фільтруємо участь за ID розіграшів
                query = query.filter(DrawParticipant.draw_id.in_(filtered_draw_ids))

            # Отримуємо всі записи участі
            participations = query.all()

            # Якщо немає участі за вказаний період
            if not participations:
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

            # Підраховуємо загальну статистику
            total_participation_count = len(participations)
            total_win_count = sum(1 for p in participations if p.is_winner)
            total_prize = sum(p.prize_amount for p in participations if p.is_winner)

            # Розраховуємо відсоток виграшів
            win_rate = (total_win_count / total_participation_count * 100) if total_participation_count > 0 else 0

            # Створюємо словник для участі кожного реферала
            referral_participation = {}

            # Групуємо участь за рефералами
            for participation in participations:
                if participation.user_id not in referral_participation:
                    referral_participation[participation.user_id] = {
                        'participations': [],
                        'winCount': 0,
                        'prizesSum': 0
                    }

                referral_participation[participation.user_id]['participations'].append(participation)

                if participation.is_winner:
                    referral_participation[participation.user_id]['winCount'] += 1
                    referral_participation[participation.user_id]['prizesSum'] += participation.prize_amount

            # Отримуємо статистику для кожного реферала
            referrals_stats = []
            for referral_id, stats in referral_participation.items():
                # Визначаємо дату останньої участі за id участі (найновіша має найбільший id)
                latest_participation = max(stats['participations'], key=lambda p: p.id)
                latest_draw = Draw.query.get(latest_participation.draw_id)

                referrals_stats.append({
                    'referralId': referral_id,
                    'participationCount': len(stats['participations']),
                    'winCount': stats['winCount'],
                    'totalPrize': stats['prizesSum'],
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
                'winRate': win_rate,  # у відсотках
                'referralsStats': referrals_stats,
                'period': {
                    'startDate': options.get('startDate'),
                    'endDate': options.get('endDate')
                }
            }
        except SQLAlchemyError as e:
            db.session.rollback()
            logger.error(f"Database error getting draws participation stats: {str(e)}")
            return {
                'success': False,
                'error': 'Database error',
                'details': str(e)
            }
        except Exception as e:
            logger.error(f"Error getting draws participation stats: {str(e)}")
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
            # Конвертуємо ID у рядок
            owner_id = str(owner_id)

            # Отримуємо ІД всіх рефералів цього власника
            referrals = Referral.query.filter_by(referrer_id=owner_id).all()

            if not referrals:
                return {
                    'success': True,
                    'ownerId': owner_id,
                    'totalDrawsCount': 0
                }

            # Збираємо ID всіх рефералів
            referral_ids = [referral.referee_id for referral in referrals]

            # Отримуємо унікальні ID розіграшів
            unique_draw_ids = db.session.query(DrawParticipant.draw_id).filter(
                DrawParticipant.user_id.in_(referral_ids)
            ).distinct().all()

            total_draws_count = len(unique_draw_ids)

            return {
                'success': True,
                'ownerId': owner_id,
                'totalDrawsCount': total_draws_count
            }
        except SQLAlchemyError as e:
            db.session.rollback()
            logger.error(f"Database error getting total draws count: {str(e)}")
            return {
                'success': False,
                'error': 'Database error',
                'details': str(e)
            }
        except Exception as e:
            logger.error(f"Error getting total draws count: {str(e)}")
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
            # Конвертуємо ID у рядок
            owner_id = str(owner_id)

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

            # Отримуємо дані про кількість участі кожного реферала
            referral_participation = {}

            # Виконуємо агрегатний запит для підрахунку кількості участі для кожного реферала
            for referral_id in referral_ids:
                # Підраховуємо кількість участі
                participation_count = DrawParticipant.query.filter_by(user_id=referral_id).count()

                # Підраховуємо кількість перемог
                win_count = DrawParticipant.query.filter_by(
                    user_id=referral_id,
                    is_winner=True
                ).count()

                # Підраховуємо суму призів
                wins = DrawParticipant.query.filter_by(
                    user_id=referral_id,
                    is_winner=True
                ).all()

                total_prize = sum(win.prize_amount for win in wins)

                # Отримуємо останню участь
                latest_participation = DrawParticipant.query.filter_by(
                    user_id=referral_id
                ).order_by(
                    desc(DrawParticipant.id)
                ).first()

                # Додаємо дані до словника, якщо є участь
                if participation_count > 0:
                    referral_participation[referral_id] = {
                        'participationCount': participation_count,
                        'winCount': win_count,
                        'totalPrize': total_prize,
                        'latestParticipation': latest_participation
                    }

            # Сортуємо рефералів за кількістю участі (від найбільшої до найменшої)
            sorted_referrals = sorted(
                referral_participation.items(),
                key=lambda x: x[1]['participationCount'],
                reverse=True
            )

            # Обмежуємо список до вказаного ліміту
            top_referrals = sorted_referrals[:limit]

            # Формуємо список найактивніших рефералів
            most_active = []
            for referral_id, stats in top_referrals:
                latest_participation = stats['latestParticipation']
                latest_draw = None
                if latest_participation:
                    latest_draw = Draw.query.get(latest_participation.draw_id)

                # Розраховуємо відсоток виграшів
                participation_count = stats['participationCount']
                win_count = stats['winCount']
                win_rate = (win_count / participation_count * 100) if participation_count > 0 and win_count > 0 else 0

                most_active.append({
                    'referralId': referral_id,
                    'participationCount': participation_count,
                    'winCount': win_count,
                    'winRate': win_rate,
                    'totalPrize': stats['totalPrize'],
                    'lastParticipationDate': latest_draw.date.isoformat() if latest_draw else None
                })

            return {
                'success': True,
                'ownerId': owner_id,
                'mostActive': most_active
            }
        except SQLAlchemyError as e:
            db.session.rollback()
            logger.error(f"Database error getting most active referrals: {str(e)}")
            return {
                'success': False,
                'error': 'Database error',
                'details': str(e)
            }
        except Exception as e:
            logger.error(f"Error getting most active referrals: {str(e)}")
            return {
                'success': False,
                'error': 'Failed to get most active referrals',
                'details': str(e)
            }