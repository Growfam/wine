from models.referral import Referral
from models.direct_bonus import DirectBonus
from models.percentage_reward import PercentageReward
from models.activity import ReferralActivity
from models.badge import UserBadge
from models.task import UserTask
from models.draw import DrawParticipant, Draw
from database import db
from flask import current_app
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy import and_, or_, desc
from datetime import datetime, timedelta
import logging

# Налаштування логування
logger = logging.getLogger(__name__)

class HistoryController:
    """
    Контролер для керування історією реферальної активності
    """

    @staticmethod
    def get_referral_history(user_id, options=None):
        """
        Отримує повну історію реферальної активності користувача

        Args:
            user_id (int): ID користувача
            options (dict, optional): Опції для фільтрації. Може містити
                startDate, endDate, limit, type.

        Returns:
            dict: Історія реферальної активності
        """
        options = options or {}

        # Безпечна обробка параметрів
        start_date = options.get('startDate')
        end_date = options.get('endDate')
        limit = options.get('limit')
        history_type = options.get('type')

        try:
            # Конвертуємо user_id в числовий формат, якщо потрібно
            if isinstance(user_id, str):
                try:
                    user_id = int(user_id)
                except ValueError:
                    logger.warning(f"get_referral_history: Невалідний формат user_id: {user_id}")
                    return {
                        'success': False,
                        'error': 'Invalid user ID format',
                        'history': []
                    }

            # Перевіряємо limit
            if limit is not None:
                try:
                    limit = int(limit)
                    if limit > 100:
                        limit = 100
                    elif limit < 1:
                        limit = 10
                except (ValueError, TypeError):
                    limit = 20
            else:
                limit = 20

            # Обробка дат, якщо вони передані
            start_date_obj = None
            end_date_obj = None

            if start_date:
                try:
                    start_date_obj = datetime.fromisoformat(start_date.replace('Z', '+00:00'))
                except ValueError:
                    logger.warning(f"get_referral_history: Невалідний формат startDate: {start_date}")

            if end_date:
                try:
                    end_date_obj = datetime.fromisoformat(end_date.replace('Z', '+00:00'))
                except ValueError:
                    logger.warning(f"get_referral_history: Невалідний формат endDate: {end_date}")

            # Збираємо всі події з різних джерел
            all_events = []

            # Додаємо події реєстрації рефералів
            if not history_type or history_type == 'referral':
                referral_events = HistoryController._get_referral_registration_events(user_id, {
                    'startDate': start_date_obj,
                    'endDate': end_date_obj
                })
                all_events.extend(referral_events)

            # Додаємо події прямих бонусів
            if not history_type or history_type == 'bonus':
                bonus_events = HistoryController._get_direct_bonus_events(user_id, {
                    'startDate': start_date_obj,
                    'endDate': end_date_obj
                })
                all_events.extend(bonus_events)

            # Додаємо події відсоткових винагород
            if not history_type or history_type == 'reward':
                reward_events = HistoryController._get_percentage_reward_events(user_id, {
                    'startDate': start_date_obj,
                    'endDate': end_date_obj
                })
                all_events.extend(reward_events)

            # Додаємо події бейджів
            if not history_type or history_type == 'badge':
                badge_events = HistoryController._get_badge_events(user_id, {
                    'startDate': start_date_obj,
                    'endDate': end_date_obj
                })
                all_events.extend(badge_events)

            # Додаємо події виконання завдань
            if not history_type or history_type == 'task':
                task_events = HistoryController._get_task_events(user_id, {
                    'startDate': start_date_obj,
                    'endDate': end_date_obj
                })
                all_events.extend(task_events)

            # Додаємо події участі в розіграшах
            if not history_type or history_type == 'draw':
                draw_events = HistoryController._get_draw_events(user_id, {
                    'startDate': start_date_obj,
                    'endDate': end_date_obj
                })
                all_events.extend(draw_events)

            # Сортуємо всі події за датою (найновіші спочатку)
            all_events.sort(key=lambda e: e.get('timestamp', ''), reverse=True)

            # Обмежуємо кількість подій, якщо вказано ліміт
            if limit and len(all_events) > limit:
                all_events = all_events[:limit]

            # Формуємо фінальний результат
            return {
                'success': True,
                'history': all_events,
                'meta': {
                    'user_id': user_id,
                    'total_events': len(all_events),
                    'limit': limit,
                    'type': history_type,
                    'filters': {
                        'startDate': start_date,
                        'endDate': end_date
                    }
                }
            }
        except Exception as e:
            # Записуємо в лог та повертаємо помилку
            logger.error(f"Error getting referral history: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'history': []
            }

    @staticmethod
    def get_referral_event_history(user_id, event_type, options=None):
        """
        Отримує історію конкретного типу реферальної активності

        Args:
            user_id (int): ID користувача
            event_type (str): Тип подій для фільтрації
            options (dict, optional): Додаткові опції для фільтрації

        Returns:
            dict: Масив подій вказаного типу
        """
        if options is None:
            options = {}

        # Додаємо фільтрацію за типом
        options['type'] = event_type

        # Використовуємо загальну функцію отримання історії
        return HistoryController.get_referral_history(user_id, options)

    @staticmethod
    def get_referral_activity_summary(user_id, options=None):
        """
        Отримує агреговану статистику реферальної активності за період

        Args:
            user_id (int): ID користувача
            options (dict, optional): Опції для фільтрації. Може містити
                startDate, endDate

        Returns:
            dict: Агрегована статистика
        """
        if options is None:
            options = {}

        try:
            # Отримуємо повну історію за вказаний період
            history_result = HistoryController.get_referral_history(user_id, options)

            if not history_result['success']:
                return history_result

            history = history_result['history']

            # Ініціалізуємо структуру для статистики
            summary = {
                'totalEvents': len(history),
                'referralsRegistered': 0,
                'directBonusEarned': 0,
                'percentageRewardsEarned': 0,
                'badgesEarned': 0,
                'tasksCompleted': 0,
                'drawsParticipated': 0,
                'drawsWon': 0,
                'totalEarnings': 0,
                'eventsByDate': {},
                'eventsByType': {}
            }

            # Проходимо по всім подіям та агрегуємо статистику
            for event in history:
                event_type = event.get('type', '')

                # Рахуємо події за типом
                summary['eventsByType'][event_type] = summary['eventsByType'].get(event_type, 0) + 1

                # Рахуємо події за датою
                event_date = datetime.fromisoformat(event.get('timestamp').replace('Z', '+00:00'))
                date_key = event_date.strftime('%Y-%m-%d')
                summary['eventsByDate'][date_key] = summary['eventsByDate'].get(date_key, 0) + 1

                # Рахуємо специфічні метрики залежно від типу події
                if event_type == 'referral':
                    summary['referralsRegistered'] += 1

                elif event_type == 'bonus':
                    amount = event.get('amount', 0)
                    summary['directBonusEarned'] += amount
                    summary['totalEarnings'] += amount

                elif event_type == 'reward':
                    amount = event.get('amount', 0)
                    summary['percentageRewardsEarned'] += amount
                    summary['totalEarnings'] += amount

                elif event_type == 'badge':
                    summary['badgesEarned'] += 1
                    amount = event.get('amount', 0)
                    summary['totalEarnings'] += amount

                elif event_type == 'task':
                    summary['tasksCompleted'] += 1
                    amount = event.get('amount', 0)
                    summary['totalEarnings'] += amount

                elif event_type == 'draw':
                    summary['drawsParticipated'] += 1
                    if event.get('won', False):
                        summary['drawsWon'] += 1
                        amount = event.get('amount', 0)
                        summary['totalEarnings'] += amount

            return {
                'success': True,
                'userId': user_id,
                'summary': summary,
                'period': {
                    'startDate': options.get('startDate'),
                    'endDate': options.get('endDate')
                }
            }
        except Exception as e:
            current_app.logger.error(f"Error getting referral activity summary: {str(e)}")
            return {
                'success': False,
                'error': 'Failed to get referral activity summary',
                'details': str(e)
            }

    @staticmethod
    def get_referral_activity_trend(user_id, period='monthly', options=None):
        """
        Отримує статистику реферальної активності по періодах

        Args:
            user_id (int): ID користувача
            period (str): Період ('daily', 'weekly', 'monthly')
            options (dict, optional): Додаткові опції для фільтрації

        Returns:
            dict: Масив з агрегованою статистикою по періодах
        """
        if options is None:
            options = {}

        try:
            # Отримуємо повну історію
            history_result = HistoryController.get_referral_history(user_id, options)

            if not history_result['success']:
                return history_result

            history = history_result['history']

            # Сортуємо історію за датою (від найстарішої до найновішої)
            sorted_history = sorted(
                history,
                key=lambda e: datetime.fromisoformat(e.get('timestamp').replace('Z', '+00:00'))
            )

            # Агрегуємо дані по періодах
            period_data = {}

            for event in sorted_history:
                # Отримуємо дату події
                event_date = datetime.fromisoformat(event.get('timestamp').replace('Z', '+00:00'))

                # Визначаємо ключ періоду
                period_key = HistoryController._get_period_key(event_date, period)

                # Ініціалізуємо дані для періоду, якщо вони ще не існують
                if period_key not in period_data:
                    period_data[period_key] = {
                        'period': period_key,
                        'referralsRegistered': 0,
                        'directBonusEarned': 0,
                        'percentageRewardsEarned': 0,
                        'badgesEarned': 0,
                        'tasksCompleted': 0,
                        'drawsParticipated': 0,
                        'drawsWon': 0,
                        'totalEarnings': 0,
                        'eventCount': 0
                    }

                # Інкрементуємо лічильник подій
                period_data[period_key]['eventCount'] += 1

                # Оновлюємо специфічні метрики залежно від типу події
                event_type = event.get('type', '')

                if event_type == 'referral':
                    period_data[period_key]['referralsRegistered'] += 1

                elif event_type == 'bonus':
                    amount = event.get('amount', 0)
                    period_data[period_key]['directBonusEarned'] += amount
                    period_data[period_key]['totalEarnings'] += amount

                elif event_type == 'reward':
                    amount = event.get('amount', 0)
                    period_data[period_key]['percentageRewardsEarned'] += amount
                    period_data[period_key]['totalEarnings'] += amount

                elif event_type == 'badge':
                    period_data[period_key]['badgesEarned'] += 1
                    amount = event.get('amount', 0)
                    period_data[period_key]['totalEarnings'] += amount

                elif event_type == 'task':
                    period_data[period_key]['tasksCompleted'] += 1
                    amount = event.get('amount', 0)
                    period_data[period_key]['totalEarnings'] += amount

                elif event_type == 'draw':
                    period_data[period_key]['drawsParticipated'] += 1
                    if event.get('won', False):
                        period_data[period_key]['drawsWon'] += 1
                        amount = event.get('amount', 0)
                        period_data[period_key]['totalEarnings'] += amount

            # Перетворюємо словник в масив для зручності використання
            trend_data = list(period_data.values())

            # Сортуємо за періодом (від найдавнішого до найновішого)
            trend_data.sort(key=lambda item: item['period'])

            return {
                'success': True,
                'userId': user_id,
                'period': period,
                'trendData': trend_data
            }
        except Exception as e:
            current_app.logger.error(f"Error getting referral activity trend: {str(e)}")
            return {
                'success': False,
                'error': 'Failed to get referral activity trend',
                'details': str(e)
            }

    @staticmethod
    def _get_referral_registration_events(user_id, options=None):
        """
        Отримує події реєстрації рефералів

        Args:
            user_id (int): ID користувача
            options (dict, optional): Опції для фільтрації

        Returns:
            list: Список подій реєстрації рефералів
        """
        if options is None:
            options = {}

        events = []

        # Отримуємо всі реферали користувача
        referrals = Referral.query.filter_by(referrer_id=user_id).all()

        for referral in referrals:
            # Перевіряємо фільтрацію за датою
            if not HistoryController._filter_by_date(referral.created_at, options):
                continue

            # Отримуємо базові дані про реферала
            referee_data = None
            try:
                from supabase_client import supabase
                response = supabase.table("winix").select("username").eq("telegram_id", referral.referee_id).execute()
                if response.data:
                    referee_data = {
                        'username': response.data[0].get('username', f'User {referral.referee_id}')
                    }
            except:
                pass

            # Створюємо запис події
            event = {
                'id': f'referral_{referral.id}',
                'userId': user_id,
                'type': 'referral',
                'timestamp': referral.created_at.isoformat(),
                'referralId': referral.referee_id,
                'level': referral.level,
                'description': f"Реєстрація реферала {referee_data['username'] if referee_data else referral.referee_id} (рівень {referral.level})"
            }

            events.append(event)

        return events

    @staticmethod
    def _get_direct_bonus_events(user_id, options=None):
        """
        Отримує події прямих бонусів

        Args:
            user_id (int): ID користувача
            options (dict, optional): Опції для фільтрації

        Returns:
            list: Список подій прямих бонусів
        """
        if options is None:
            options = {}

        events = []

        # Отримуємо всі прямі бонуси користувача
        bonuses = DirectBonus.query.filter_by(referrer_id=user_id).all()

        for bonus in bonuses:
            # Перевіряємо фільтрацію за датою
            if not HistoryController._filter_by_date(bonus.created_at, options):
                continue

            # Отримуємо базові дані про реферала
            referee_data = None
            try:
                from supabase_client import supabase
                response = supabase.table("winix").select("username").eq("telegram_id", bonus.referee_id).execute()
                if response.data:
                    referee_data = {
                        'username': response.data[0].get('username', f'User {bonus.referee_id}')
                    }
            except:
                pass

            # Створюємо запис події
            event = {
                'id': f'bonus_{bonus.id}',
                'userId': user_id,
                'type': 'bonus',
                'timestamp': bonus.created_at.isoformat(),
                'referralId': bonus.referee_id,
                'amount': bonus.amount,
                'description': f"Прямий бонус за реферала {referee_data['username'] if referee_data else bonus.referee_id}"
            }

            events.append(event)

        return events

    @staticmethod
    def _get_percentage_reward_events(user_id, options=None):
        """
        Отримує події відсоткових винагород

        Args:
            user_id (int): ID користувача
            options (dict, optional): Опції для фільтрації

        Returns:
            list: Список подій відсоткових винагород
        """
        if options is None:
            options = {}

        events = []

        # Отримуємо всі відсоткові винагороди користувача
        rewards = PercentageReward.query.filter_by(user_id=user_id).all()

        for reward in rewards:
            # Перевіряємо фільтрацію за датою
            if not HistoryController._filter_by_date(reward.created_at, options):
                continue

            # Отримуємо базові дані про реферала
            referral_data = None
            try:
                from supabase_client import supabase
                response = supabase.table("winix").select("username").eq("telegram_id", reward.referral_id).execute()
                if response.data:
                    referral_data = {
                        'username': response.data[0].get('username', f'User {reward.referral_id}')
                    }
            except:
                pass

            # Створюємо запис події
            event = {
                'id': f'reward_{reward.id}',
                'userId': user_id,
                'type': 'reward',
                'timestamp': reward.created_at.isoformat(),
                'referralId': reward.referral_id,
                'amount': reward.reward_amount,
                'description': f"Відсоткова винагорода ({int(reward.rate * 100)}%) від активності реферала {referral_data['username'] if referral_data else reward.referral_id}",
                'level': reward.level,
                'baseAmount': reward.base_amount
            }

            events.append(event)

        return events

    @staticmethod
    def _get_badge_events(user_id, options=None):
        """
        Отримує події отримання бейджів

        Args:
            user_id (int): ID користувача
            options (dict, optional): Опції для фільтрації

        Returns:
            list: Список подій отримання бейджів
        """
        if options is None:
            options = {}

        events = []

        # Отримуємо всі бейджі користувача
        badges = UserBadge.query.filter_by(user_id=user_id).all()

        for badge in badges:
            # Перевіряємо фільтрацію за датою
            if not HistoryController._filter_by_date(badge.earned_at, options):
                continue

            # Переклад типів бейджів для опису
            badge_names = {
                'BRONZE': 'бронзовий',
                'SILVER': 'срібний',
                'GOLD': 'золотий',
                'PLATINUM': 'платиновий'
            }
            badge_name = badge_names.get(badge.badge_type, badge.badge_type)

            # Створюємо запис події
            event = {
                'id': f'badge_{badge.id}',
                'userId': user_id,
                'type': 'badge',
                'timestamp': badge.earned_at.isoformat(),
                'badgeType': badge.badge_type,
                'amount': badge.reward_amount,
                'description': f'Отримано {badge_name} бейдж',
                'claimed': badge.claimed
            }

            events.append(event)

        return events

    @staticmethod
    def _get_task_events(user_id, options=None):
        """
        Отримує події виконання завдань

        Args:
            user_id (int): ID користувача
            options (dict, optional): Опції для фільтрації

        Returns:
            list: Список подій виконання завдань
        """
        if options is None:
            options = {}

        events = []

        # Отримуємо всі завдання користувача
        tasks = UserTask.query.filter_by(user_id=user_id, completed=True).all()

        for task in tasks:
            # Для завдань використовуємо дату завершення або останнього оновлення
            task_date = task.completed_at if task.completed_at else task.last_updated

            # Перевіряємо фільтрацію за датою
            if not HistoryController._filter_by_date(task_date, options):
                continue

            # Створюємо опис залежно від типу завдання
            if task.task_type == 'REFERRAL_COUNT':
                description = 'Виконано завдання з запрошення 100 рефералів'
            elif task.task_type == 'ACTIVE_REFERRALS':
                description = 'Виконано завдання із залучення 50 активних рефералів'
            else:
                description = f'Виконано завдання {task.task_type}'

            # Створюємо запис події
            event = {
                'id': f'task_{task.id}',
                'userId': user_id,
                'type': 'task',
                'timestamp': task_date.isoformat(),
                'taskType': task.task_type,
                'amount': task.reward_amount,
                'description': description,
                'claimed': task.claimed
            }

            events.append(event)

        return events

    @staticmethod
    def _get_draw_events(user_id, options=None):
        """
        Отримує події участі рефералів у розіграшах

        Args:
            user_id (int): ID користувача
            options (dict, optional): Опції для фільтрації

        Returns:
            list: Список подій участі в розіграшах
        """
        if options is None:
            options = {}

        events = []

        # Отримуємо ІД всіх рефералів цього користувача
        referrals = Referral.query.filter_by(referrer_id=user_id).all()
        referral_ids = [ref.referee_id for ref in referrals]

        # Якщо немає рефералів, повертаємо порожній список
        if not referral_ids:
            return events

        # Отримуємо всі участі в розіграшах для рефералів
        participations = DrawParticipant.query.filter(DrawParticipant.user_id.in_(referral_ids)).all()

        # Отримуємо інформацію про всі розіграші
        draw_ids = [p.draw_id for p in participations]
        draws = {}
        if draw_ids:
            draw_results = Draw.query.filter(Draw.id.in_(draw_ids)).all()
            draws = {d.id: d for d in draw_results}

        # Створюємо події для кожної участі
        for participation in participations:
            # Отримуємо дані розіграшу
            draw = draws.get(participation.draw_id)
            if not draw:
                continue

            # Перевіряємо фільтрацію за датою
            if not HistoryController._filter_by_date(draw.date, options):
                continue

            # Отримуємо дані про реферала
            referral_data = None
            try:
                from supabase_client import supabase
                response = supabase.table("winix").select("username").eq("telegram_id", participation.user_id).execute()
                if response.data:
                    referral_data = {
                        'username': response.data[0].get('username', f'User {participation.user_id}')
                    }
            except:
                pass

            # Визначаємо опис події та статус виграшу
            if participation.is_winner:
                description = f"Реферал {referral_data['username'] if referral_data else participation.user_id} виграв у розіграші '{draw.name}'"
            else:
                description = f"Реферал {referral_data['username'] if referral_data else participation.user_id} взяв участь у розіграші '{draw.name}'"

            # Створюємо запис події
            event = {
                'id': f'draw_{participation.id}',
                'userId': user_id,
                'type': 'draw',
                'timestamp': draw.date.isoformat(),
                'drawId': participation.draw_id,
                'won': participation.is_winner,
                'amount': participation.prize_amount if participation.is_winner else 0,
                'description': description,
                'referralId': participation.user_id,
                'drawName': draw.name
            }

            events.append(event)

        return events

    @staticmethod
    def _filter_by_date(date, options):
        """
        Перевіряє, чи відповідає дата фільтрам опцій

        Args:
            date (datetime): Дата для перевірки
            options (dict): Опції з фільтрами

        Returns:
            bool: True, якщо дата підходить під фільтри, інакше False
        """
        # Якщо дата або опції не вказані, пропускаємо фільтрацію
        if not date or not options:
            return True

        # Перевіряємо фільтр startDate
        if 'startDate' in options and options['startDate']:
            if date < options['startDate']:
                return False

        # Перевіряємо фільтр endDate
        if 'endDate' in options and options['endDate']:
            if date > options['endDate']:
                return False

        return True

    @staticmethod
    def _get_period_key(date, period_type):
        """
        Визначає ключ періоду для дати

        Args:
            date (datetime): Дата
            period_type (str): Тип періоду ('daily', 'weekly', 'monthly')

        Returns:
            str: Ключ періоду
        """
        if period_type == 'daily':
            return date.strftime('%Y-%m-%d')
        elif period_type == 'weekly':
            # Визначаємо номер тижня в році
            year = date.year
            week = date.isocalendar()[1]
            return f"{year}-W{week:02d}"
        elif period_type == 'monthly':
            return date.strftime('%Y-%m')
        else:
            # За замовчуванням - щомісячно
            return date.strftime('%Y-%m')