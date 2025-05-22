from supabase_client import supabase
from flask import current_app
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
            referral = supabase.table("referrals").select("*").eq("referee_id", referral_id).execute()
            if not referral.data:
                return {
                    'success': False,
                    'error': 'Referral not found',
                    'details': f'No referral with ID {referral_id}'
                }

            # Отримуємо список участі в розіграшах для цього реферала
            draw_participants = supabase.table("draw_participants").select("*").eq("user_id", referral_id).execute()

            # Якщо немає участі, повертаємо порожній результат
            if not draw_participants.data:
                return {
                    'success': True,
                    'referralId': referral_id,
                    'totalParticipation': 0,
                    'winCount': 0,
                    'draws': []
                }

            # Збираємо ID розіграшів
            draw_ids = [participant['draw_id'] for participant in draw_participants.data]

            # Отримуємо інформацію про всі розіграші, в яких брав участь реферал
            draw_info = supabase.table("draws").select("*").in_("id", draw_ids).execute()

            # Створюємо словник для швидкого пошуку розіграшів за ID
            draw_dict = {draw['id']: draw for draw in draw_info.data}

            # Об'єднуємо інформацію про розіграші з інформацією про участь
            draws = []
            for participant in draw_participants.data:
                draw = draw_dict.get(participant['draw_id'])
                if draw:
                    draws.append({
                        'drawId': participant['draw_id'],
                        'date': draw['date'],
                        'name': draw['name'],
                        'isWon': participant['is_winner'],
                        'prize': participant.get('prize_amount', 0),
                        'ticketsCount': 1  # За умовчанням 1 квиток на реферала
                    })

            # Підраховуємо загальну статистику
            total_participation = len(draws)
            win_count = sum(1 for draw in draws if draw['isWon'])

            # Оновлюємо активність реферала
            activity = supabase.table("referral_activities").select("*").eq("user_id", referral_id).execute()
            if activity.data:
                activity_data = activity.data[0]
                if activity_data['draws_participation'] != total_participation:
                    update_data = {
                        "draws_participation": total_participation,
                        "last_updated": datetime.utcnow().isoformat()
                    }

                    # Перевіряємо активність
                    if total_participation >= 3 or activity_data.get('invited_referrals', 0) >= 1:
                        update_data["is_active"] = True
                        if total_participation >= 3:
                            update_data["reason_for_activity"] = "draws_criteria"

                    supabase.table("referral_activities").update(update_data).eq("user_id", referral_id).execute()
                    logger.info(f"Оновлено кількість участі в розіграшах для {referral_id}: {total_participation}")
            else:
                # Створюємо запис активності, якщо його немає
                new_activity = {
                    "user_id": referral_id,
                    "draws_participation": total_participation,
                    "invited_referrals": 0,
                    "is_active": total_participation >= 3,
                    "reason_for_activity": "draws_criteria" if total_participation >= 3 else None,
                    "last_updated": datetime.utcnow().isoformat()
                }
                supabase.table("referral_activities").insert(new_activity).execute()
                logger.info(f"Створено запис активності для {referral_id} з участю в розіграшах: {total_participation}")

            return {
                'success': True,
                'referralId': referral_id,
                'totalParticipation': total_participation,
                'winCount': win_count,
                'draws': draws
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
            # Конвертуємо ID
            referral_id = str(referral_id)
            draw_id = int(draw_id)

            # Отримуємо запис про участь
            participation = supabase.table("draw_participants").select("*").eq(
                "user_id", referral_id
            ).eq("draw_id", draw_id).execute()

            if not participation.data:
                return {
                    'success': False,
                    'error': 'Participation not found',
                    'details': f'No participation record for referral {referral_id} in draw {draw_id}'
                }

            participation_data = participation.data[0]

            # Отримуємо інформацію про розіграш
            draw = supabase.table("draws").select("*").eq("id", draw_id).execute()
            if not draw.data:
                return {
                    'success': False,
                    'error': 'Draw not found',
                    'details': f'No draw with ID {draw_id}'
                }

            draw_data = draw.data[0]

            # Підраховуємо загальну кількість учасників цього розіграшу
            total_participants_result = supabase.table("draw_participants").select("id").eq("draw_id",
                                                                                            draw_id).execute()
            total_participants = len(total_participants_result.data)

            # Отримуємо ID виграшного квитка (якщо є переможець)
            winning_ticket = None
            winner = supabase.table("draw_participants").select("*").eq("draw_id", draw_id).eq("is_winner",
                                                                                               True).execute()
            if winner.data:
                winning_ticket = winner.data[0]['id']

            # Генеруємо список квитків (у реальній системі може бути окрема таблиця для квитків)
            # В даному випадку вважаємо, що ID участі = ID квитка
            ticket_numbers = [participation_data['id']]

            return {
                'success': True,
                'drawId': draw_id,
                'referralId': referral_id,
                'date': draw_data['date'],
                'name': draw_data['name'],
                'ticketsCount': len(ticket_numbers),
                'ticketNumbers': ticket_numbers,
                'isWon': participation_data['is_winner'],
                'prize': participation_data.get('prize_amount', 0) if participation_data['is_winner'] else 0,
                'totalParticipants': total_participants,
                'winningTicket': winning_ticket
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
            referrals = supabase.table("referrals").select("*").eq("referrer_id", owner_id).execute()

            if not referrals.data:
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
            referral_ids = [referral['referee_id'] for referral in referrals.data]

            # Базовий запит для всіх участей в розіграшах
            participations = supabase.table("draw_participants").select("*").in_("user_id", referral_ids).execute()

            # Якщо є фільтрація за датою, отримуємо відповідні розіграші
            if ('startDate' in options or 'endDate' in options) and participations.data:
                # Отримуємо відповідні розіграші
                draw_ids = list(set([p['draw_id'] for p in participations.data]))
                draws = supabase.table("draws").select("*").in_("id", draw_ids).execute()

                # Фільтруємо розіграші за датою
                filtered_draw_ids = []
                for draw in draws.data:
                    draw_date = datetime.fromisoformat(draw['date'].replace('Z', '+00:00'))

                    if 'startDate' in options and options['startDate']:
                        start_date = datetime.fromisoformat(options['startDate'].replace('Z', '+00:00'))
                        if draw_date < start_date:
                            continue

                    if 'endDate' in options and options['endDate']:
                        end_date = datetime.fromisoformat(options['endDate'].replace('Z', '+00:00'))
                        if draw_date > end_date:
                            continue

                    filtered_draw_ids.append(draw['id'])

                # Фільтруємо участь за ID розіграшів
                participations.data = [p for p in participations.data if p['draw_id'] in filtered_draw_ids]

            # Якщо немає участі за вказаний період
            if not participations.data:
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
            total_participation_count = len(participations.data)
            total_win_count = sum(1 for p in participations.data if p['is_winner'])
            total_prize = sum(p.get('prize_amount', 0) for p in participations.data if p['is_winner'])

            # Розраховуємо відсоток виграшів
            win_rate = (total_win_count / total_participation_count * 100) if total_participation_count > 0 else 0

            # Створюємо словник для участі кожного реферала
            referral_participation = {}

            # Групуємо участь за рефералами
            for participation in participations.data:
                if participation['user_id'] not in referral_participation:
                    referral_participation[participation['user_id']] = {
                        'participations': [],
                        'winCount': 0,
                        'prizesSum': 0
                    }

                referral_participation[participation['user_id']]['participations'].append(participation)

                if participation['is_winner']:
                    referral_participation[participation['user_id']]['winCount'] += 1
                    referral_participation[participation['user_id']]['prizesSum'] += participation.get('prize_amount',
                                                                                                       0)

            # Отримуємо всі розіграші для дат
            all_draw_ids = list(set([p['draw_id'] for p in participations.data]))
            all_draws = supabase.table("draws").select("*").in_("id", all_draw_ids).execute()
            draws_dict = {d['id']: d for d in all_draws.data}

            # Отримуємо статистику для кожного реферала
            referrals_stats = []
            for referral_id, stats in referral_participation.items():
                # Визначаємо дату останньої участі
                latest_participation = max(stats['participations'], key=lambda p: p['id'])
                latest_draw = draws_dict.get(latest_participation['draw_id'])

                referrals_stats.append({
                    'referralId': referral_id,
                    'participationCount': len(stats['participations']),
                    'winCount': stats['winCount'],
                    'totalPrize': stats['prizesSum'],
                    'lastParticipationDate': latest_draw['date'] if latest_draw else None
                })

            # Отримуємо загальну кількість унікальних розіграшів
            draw_ids = set(p['draw_id'] for p in participations.data)
            total_draws_count = len(draw_ids)

            return {
                'success': True,
                'ownerId': owner_id,
                'totalDrawsCount': total_draws_count,
                'totalParticipationCount': total_participation_count,
                'totalWinCount': total_win_count,
                'totalPrize': total_prize,
                'winRate': win_rate,
                'referralsStats': referrals_stats,
                'period': {
                    'startDate': options.get('startDate'),
                    'endDate': options.get('endDate')
                }
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
            referrals = supabase.table("referrals").select("*").eq("referrer_id", owner_id).execute()

            if not referrals.data:
                return {
                    'success': True,
                    'ownerId': owner_id,
                    'totalDrawsCount': 0
                }

            # Збираємо ID всіх рефералів
            referral_ids = [referral['referee_id'] for referral in referrals.data]

            # Отримуємо унікальні ID розіграшів
            participations = supabase.table("draw_participants").select("draw_id").in_("user_id",
                                                                                       referral_ids).execute()
            unique_draw_ids = set(p['draw_id'] for p in participations.data)
            total_draws_count = len(unique_draw_ids)

            return {
                'success': True,
                'ownerId': owner_id,
                'totalDrawsCount': total_draws_count
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
            referrals = supabase.table("referrals").select("*").eq("referrer_id", owner_id).execute()

            if not referrals.data:
                return {
                    'success': True,
                    'ownerId': owner_id,
                    'mostActive': []
                }

            # Збираємо ID всіх рефералів
            referral_ids = [referral['referee_id'] for referral in referrals.data]

            # Отримуємо дані про кількість участі кожного реферала
            referral_participation = {}

            # Отримуємо всі участі для рефералів
            all_participations = supabase.table("draw_participants").select("*").in_("user_id", referral_ids).execute()

            # Групуємо за рефералами
            for participation in all_participations.data:
                if participation['user_id'] not in referral_participation:
                    referral_participation[participation['user_id']] = {
                        'participationCount': 0,
                        'winCount': 0,
                        'totalPrize': 0,
                        'participations': []
                    }

                referral_participation[participation['user_id']]['participationCount'] += 1
                referral_participation[participation['user_id']]['participations'].append(participation)

                if participation['is_winner']:
                    referral_participation[participation['user_id']]['winCount'] += 1
                    referral_participation[participation['user_id']]['totalPrize'] += participation.get('prize_amount',
                                                                                                        0)

            # Сортуємо рефералів за кількістю участі (від найбільшої до найменшої)
            sorted_referrals = sorted(
                referral_participation.items(),
                key=lambda x: x[1]['participationCount'],
                reverse=True
            )

            # Обмежуємо список до вказаного ліміту
            top_referrals = sorted_referrals[:limit]

            # Отримуємо інформацію про розіграші для дат
            if top_referrals:
                all_draw_ids = []
                for _, stats in top_referrals:
                    for p in stats['participations']:
                        all_draw_ids.append(p['draw_id'])

                all_draw_ids = list(set(all_draw_ids))
                draws = supabase.table("draws").select("*").in_("id", all_draw_ids).execute()
                draws_dict = {d['id']: d for d in draws.data}
            else:
                draws_dict = {}

            # Формуємо список найактивніших рефералів
            most_active = []
            for referral_id, stats in top_referrals:
                # Визначаємо останню участь та дату
                latest_participation = max(stats['participations'], key=lambda p: p['id'])
                latest_draw = draws_dict.get(latest_participation['draw_id'])

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
                    'lastParticipationDate': latest_draw['date'] if latest_draw else None
                })

            return {
                'success': True,
                'ownerId': owner_id,
                'mostActive': most_active
            }
        except Exception as e:
            logger.error(f"Error getting most active referrals: {str(e)}")
            return {
                'success': False,
                'error': 'Failed to get most active referrals',
                'details': str(e)
            }