from supabase_client import supabase
from flask import current_app
from datetime import datetime, timedelta
import logging
import sys
import os

# Додаємо шлях до utils
sys.path.insert(0, os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'utils'))
try:
    from date_utils import parse_datetime, format_datetime
except ImportError:
    # Fallback функції якщо не вдалося імпортувати
    def parse_datetime(date_string):
        if not date_string:
            return None
        try:
            # Очищаємо мілісекунди
            if '.' in date_string:
                date_parts = date_string.split('.')
                if len(date_parts) > 1:
                    # Обрізаємо мілісекунди до 6 цифр
                    ms_part = date_parts[1][:6].ljust(6, '0')
                    date_string = f"{date_parts[0]}.{ms_part}"
                    if 'Z' in date_parts[1]:
                        date_string += 'Z'

            # Пробуємо різні формати
            for suffix in ['Z', '+00:00', '']:
                try:
                    test_string = date_string.rstrip('Z').rstrip('+00:00') + suffix
                    return datetime.fromisoformat(test_string.replace('Z', '+00:00'))
                except:
                    continue

            # Якщо нічого не вийшло, повертаємо поточну дату
            return datetime.utcnow()
        except:
            return datetime.utcnow()


    def format_datetime(dt):
        if not dt:
            return None
        if isinstance(dt, str):
            return dt
        return dt.isoformat()

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
            # Конвертуємо user_id в рядок
            user_id_str = str(user_id)

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
                referral_events = HistoryController._get_referral_registration_events(user_id_str, {
                    'startDate': start_date_obj,
                    'endDate': end_date_obj
                })
                all_events.extend(referral_events)

            # Додаємо події прямих бонусів
            if not history_type or history_type == 'bonus':
                bonus_events = HistoryController._get_direct_bonus_events(user_id_str, {
                    'startDate': start_date_obj,
                    'endDate': end_date_obj
                })
                all_events.extend(bonus_events)

            # Додаємо події відсоткових винагород
            if not history_type or history_type == 'reward':
                reward_events = HistoryController._get_percentage_reward_events(user_id_str, {
                    'startDate': start_date_obj,
                    'endDate': end_date_obj
                })
                all_events.extend(reward_events)

            # Додаємо події бейджів
            if not history_type or history_type == 'badge':
                badge_events = HistoryController._get_badge_events(user_id_str, {
                    'startDate': start_date_obj,
                    'endDate': end_date_obj
                })
                all_events.extend(badge_events)

            # Додаємо події виконання завдань
            if not history_type or history_type == 'task':
                task_events = HistoryController._get_task_events(user_id_str, {
                    'startDate': start_date_obj,
                    'endDate': end_date_obj
                })
                all_events.extend(task_events)

            # Додаємо події участі в розіграшах
            if not history_type or history_type == 'draw':
                draw_events = HistoryController._get_draw_events(user_id_str, {
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
                    'user_id': user_id_str,
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
                try:
                    event_date = parse_datetime(event.get('timestamp'))
                    date_key = event_date.strftime('%Y-%m-%d')
                    summary['eventsByDate'][date_key] = summary['eventsByDate'].get(date_key, 0) + 1
                except Exception as e:
                    logger.warning(f"Error parsing event date: {str(e)}")

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
            logger.error(f"Error getting referral activity summary: {str(e)}")
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
                key=lambda e: parse_datetime(e.get('timestamp')) or datetime.min
            )

            # Агрегуємо дані по періодах
            period_data = {}

            for event in sorted_history:
                # Отримуємо дату події
                event_date = parse_datetime(event.get('timestamp'))
                if not event_date:
                    continue

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
            logger.error(f"Error getting referral activity trend: {str(e)}")
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
            user_id (str): ID користувача
            options (dict, optional): Опції для фільтрації

        Returns:
            list: Список подій реєстрації рефералів
        """
        if options is None:
            options = {}

        events = []

        try:
            # Отримуємо всі реферали користувача
            referrals = supabase.table("referrals").select("*").eq("referrer_id", user_id).execute()

            # Отримуємо імена рефералів одним запитом
            if referrals.data:
                referee_ids = [ref['referee_id'] for ref in referrals.data]
                users_response = supabase.table("winix").select("telegram_id, username").in_("telegram_id",
                                                                                             referee_ids).execute()
                user_map = {user['telegram_id']: user.get('username', f'User {user["telegram_id"]}') for user in
                            users_response.data}
            else:
                user_map = {}

            for referral in referrals.data:
                # Перевіряємо фільтрацію за датою
                created_at = parse_datetime(referral['created_at'])
                if not HistoryController._filter_by_date(created_at, options):
                    continue

                # Отримуємо базові дані про реферала
                referee_username = user_map.get(referral['referee_id'], f'User {referral["referee_id"]}')

                # Створюємо запис події
                event = {
                    'id': f'referral_{referral["id"]}',
                    'userId': user_id,
                    'type': 'referral',
                    'timestamp': referral['created_at'],
                    'referralId': referral['referee_id'],
                    'level': referral['level'],
                    'description': f"Реєстрація реферала {referee_username} (рівень {referral['level']})"
                }

                events.append(event)
        except Exception as e:
            logger.error(f"Error getting referral registration events: {str(e)}")

        return events

    @staticmethod
    def _get_direct_bonus_events(user_id, options=None):
        """
        Отримує події прямих бонусів

        Args:
            user_id (str): ID користувача
            options (dict, optional): Опції для фільтрації

        Returns:
            list: Список подій прямих бонусів
        """
        if options is None:
            options = {}

        events = []

        try:
            # Отримуємо всі прямі бонуси користувача
            bonuses = supabase.table("direct_bonuses").select("*").eq("referrer_id", user_id).execute()

            # Отримуємо імена рефералів одним запитом
            if bonuses.data:
                referee_ids = [bonus['referee_id'] for bonus in bonuses.data]
                users_response = supabase.table("winix").select("telegram_id, username").in_("telegram_id",
                                                                                             referee_ids).execute()
                user_map = {user['telegram_id']: user.get('username', f'User {user["telegram_id"]}') for user in
                            users_response.data}
            else:
                user_map = {}

            for bonus in bonuses.data:
                # Перевіряємо фільтрацію за датою
                created_at = parse_datetime(bonus['created_at'])
                if not HistoryController._filter_by_date(created_at, options):
                    continue

                # Отримуємо базові дані про реферала
                referee_username = user_map.get(bonus['referee_id'], f'User {bonus["referee_id"]}')

                # Створюємо запис події
                event = {
                    'id': f'bonus_{bonus["id"]}',
                    'userId': user_id,
                    'type': 'bonus',
                    'timestamp': bonus['created_at'],
                    'referralId': bonus['referee_id'],
                    'amount': bonus['amount'],
                    'description': f"Прямий бонус за реферала {referee_username}"
                }

                events.append(event)
        except Exception as e:
            logger.error(f"Error getting direct bonus events: {str(e)}")

        return events

    @staticmethod
    def _get_percentage_reward_events(user_id, options=None):
        """
        Отримує події відсоткових винагород

        Args:
            user_id (str): ID користувача
            options (dict, optional): Опції для фільтрації

        Returns:
            list: Список подій відсоткових винагород
        """
        if options is None:
            options = {}

        events = []

        try:
            # Отримуємо всі відсоткові винагороди користувача
            rewards = supabase.table("percentage_rewards").select("*").eq("user_id", user_id).execute()

            # Отримуємо імена рефералів одним запитом
            if rewards.data:
                referral_ids = [reward['referral_id'] for reward in rewards.data]
                users_response = supabase.table("winix").select("telegram_id, username").in_("telegram_id",
                                                                                             referral_ids).execute()
                user_map = {user['telegram_id']: user.get('username', f'User {user["telegram_id"]}') for user in
                            users_response.data}
            else:
                user_map = {}

            for reward in rewards.data:
                # Перевіряємо фільтрацію за датою
                created_at = parse_datetime(reward['created_at'])
                if not HistoryController._filter_by_date(created_at, options):
                    continue

                # Отримуємо базові дані про реферала
                referral_username = user_map.get(reward['referral_id'], f'User {reward["referral_id"]}')

                # Створюємо запис події
                event = {
                    'id': f'reward_{reward["id"]}',
                    'userId': user_id,
                    'type': 'reward',
                    'timestamp': reward['created_at'],
                    'referralId': reward['referral_id'],
                    'amount': reward['reward_amount'],
                    'description': f"Відсоткова винагорода ({int(reward['rate'] * 100)}%) від активності реферала {referral_username}",
                    'level': reward['level'],
                    'baseAmount': reward['base_amount']
                }

                events.append(event)
        except Exception as e:
            logger.error(f"Error getting percentage reward events: {str(e)}")

        return events

    @staticmethod
    def _get_badge_events(user_id, options=None):
        """
        Отримує події отримання бейджів

        Args:
            user_id (str): ID користувача
            options (dict, optional): Опції для фільтрації

        Returns:
            list: Список подій отримання бейджів
        """
        if options is None:
            options = {}

        events = []

        try:
            # Отримуємо всі бейджі користувача
            badges = supabase.table("user_badges").select("*").eq("user_id", user_id).execute()

            for badge in badges.data:
                # Перевіряємо фільтрацію за датою
                earned_at = parse_datetime(badge['earned_at'])
                if not HistoryController._filter_by_date(earned_at, options):
                    continue

                # Переклад типів бейджів для опису
                badge_names = {
                    'BRONZE': 'бронзовий',
                    'SILVER': 'срібний',
                    'GOLD': 'золотий',
                    'PLATINUM': 'платиновий'
                }
                badge_name = badge_names.get(badge['badge_type'], badge['badge_type'])

                # Створюємо запис події
                event = {
                    'id': f'badge_{badge["id"]}',
                    'userId': user_id,
                    'type': 'badge',
                    'timestamp': badge['earned_at'],
                    'badgeType': badge['badge_type'],
                    'amount': badge['reward_amount'],
                    'description': f'Отримано {badge_name} бейдж',
                    'claimed': badge['claimed']
                }

                events.append(event)
        except Exception as e:
            logger.error(f"Error getting badge events: {str(e)}")

        return events

    @staticmethod
    def _get_task_events(user_id, options=None):
        """
        Отримує події виконання завдань

        Args:
            user_id (str): ID користувача
            options (dict, optional): Опції для фільтрації

        Returns:
            list: Список подій виконання завдань
        """
        if options is None:
            options = {}

        events = []

        try:
            # Отримуємо всі завдання користувача
            tasks = supabase.table("user_tasks").select("*").eq("user_id", user_id).eq("completed", True).execute()

            for task in tasks.data:
                # Для завдань використовуємо дату завершення або останнього оновлення
                task_date_str = task.get('completed_at') or task.get('last_updated')
                if not task_date_str:
                    continue

                task_date = parse_datetime(task_date_str)
                if not task_date:
                    continue

                # Перевіряємо фільтрацію за датою
                if not HistoryController._filter_by_date(task_date, options):
                    continue

                # Створюємо опис залежно від типу завдання
                if task['task_type'] == 'REFERRAL_COUNT':
                    description = 'Виконано завдання з запрошення 100 рефералів'
                elif task['task_type'] == 'ACTIVE_REFERRALS':
                    description = 'Виконано завдання із залучення 50 активних рефералів'
                else:
                    description = f'Виконано завдання {task["task_type"]}'

                # Створюємо запис події
                event = {
                    'id': f'task_{task["id"]}',
                    'userId': user_id,
                    'type': 'task',
                    'timestamp': task_date_str,
                    'taskType': task['task_type'],
                    'amount': task['reward_amount'],
                    'description': description,
                    'claimed': task['claimed']
                }

                events.append(event)
        except Exception as e:
            logger.error(f"Error getting task events: {str(e)}")

        return events

    @staticmethod
    def _get_draw_events(user_id, options=None):
        """
        Отримує події участі рефералів у розіграшах

        Args:
            user_id (str): ID користувача
            options (dict, optional): Опції для фільтрації

        Returns:
            list: Список подій участі в розіграшах
        """
        if options is None:
            options = {}

        events = []

        try:
            # Отримуємо ІД всіх рефералів цього користувача
            referrals = supabase.table("referrals").select("*").eq("referrer_id", user_id).execute()
            referral_ids = [ref['referee_id'] for ref in referrals.data]

            # Якщо немає рефералів, повертаємо порожній список
            if not referral_ids:
                return events

            # Отримуємо всі участі в розіграшах для рефералів
            participations = supabase.table("draw_participants").select("*").in_("user_id", referral_ids).execute()

            # Отримуємо інформацію про всі розіграші
            if participations.data:
                draw_ids = list(set([p['draw_id'] for p in participations.data]))
                draws_result = supabase.table("draws").select("*").in_("id", draw_ids).execute()
                draws = {d['id']: d for d in draws_result.data}

                # Отримуємо імена рефералів
                users_response = supabase.table("winix").select("telegram_id, username").in_("telegram_id",
                                                                                             referral_ids).execute()
                user_map = {user['telegram_id']: user.get('username', f'User {user["telegram_id"]}') for user in
                            users_response.data}
            else:
                draws = {}
                user_map = {}

            # Створюємо події для кожної участі
            for participation in participations.data:
                # Отримуємо дані розіграшу
                draw = draws.get(participation['draw_id'])
                if not draw:
                    continue

                # Перевіряємо фільтрацію за датою
                draw_date = parse_datetime(draw['date'])
                if not HistoryController._filter_by_date(draw_date, options):
                    continue

                # Отримуємо дані про реферала
                referral_username = user_map.get(participation['user_id'], f'User {participation["user_id"]}')

                # Визначаємо опис події та статус виграшу
                if participation['is_winner']:
                    description = f"Реферал {referral_username} виграв у розіграші '{draw['name']}'"
                else:
                    description = f"Реферал {referral_username} взяв участь у розіграші '{draw['name']}'"

                # Створюємо запис події
                event = {
                    'id': f'draw_{participation["id"]}',
                    'userId': user_id,
                    'type': 'draw',
                    'timestamp': draw['date'],
                    'drawId': participation['draw_id'],
                    'won': participation['is_winner'],
                    'amount': participation.get('prize_amount', 0) if participation['is_winner'] else 0,
                    'description': description,
                    'referralId': participation['user_id'],
                    'drawName': draw['name']
                }

                events.append(event)
        except Exception as e:
            logger.error(f"Error getting draw events: {str(e)}")

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