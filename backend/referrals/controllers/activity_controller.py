from supabase_client import supabase
from datetime import datetime, timedelta
import logging
import traceback

# Налаштування логування
logger = logging.getLogger(__name__)


class ActivityController:
    """
    Контролер для управління активністю рефералів
    """

    # Константи критеріїв активності
    MIN_DRAWS_PARTICIPATION = 3  # Мінімум участей в розіграшах для активності
    MIN_INVITED_REFERRALS = 1  # Мінімум запрошених рефералів для активності
    INACTIVE_DAYS_THRESHOLD = 7  # Кількість днів відсутності для неактивності

    @staticmethod
    def update_activity(user_id, draws_participation=None, invited_referrals=None):
        """
        Оновлює активність реферала

        Args:
            user_id (int): ID користувача (реферала)
            draws_participation (int, optional): Кількість участі у розіграшах. Defaults to None.
            invited_referrals (int, optional): Кількість запрошених рефералів. Defaults to None.

        Returns:
            dict: Результат операції
        """
        try:
            # Конвертуємо ID в рядок для уніформності
            user_id_str = str(user_id)
            logger.info(f"=== update_activity START for user_id={user_id_str} ===")

            # Знаходимо запис активності
            activity_query = supabase.table("referral_activities").select("*").eq("user_id", user_id_str)
            activity_result = activity_query.execute()
            logger.info(f"Знайдено записів активності: {len(activity_result.data or [])}")

            if activity_result.data:
                # Оновлюємо існуючий запис
                activity = activity_result.data[0]
                update_data = {
                    "last_updated": datetime.utcnow().isoformat()
                }

                # Оновлюємо значення, якщо вони надані
                if draws_participation is not None:
                    update_data["draws_participation"] = draws_participation
                else:
                    draws_participation = activity.get('draws_participation', 0)

                if invited_referrals is not None:
                    update_data["invited_referrals"] = invited_referrals
                else:
                    invited_referrals = activity.get('invited_referrals', 0)

                # Перевіряємо активність з використанням реальних критеріїв
                meets_draws = draws_participation >= ActivityController.MIN_DRAWS_PARTICIPATION
                meets_invites = invited_referrals >= ActivityController.MIN_INVITED_REFERRALS

                if meets_draws or meets_invites:
                    update_data["is_active"] = True
                    if meets_draws and meets_invites:
                        update_data["reason_for_activity"] = "both_criteria"
                    elif meets_draws:
                        update_data["reason_for_activity"] = "draws_criteria"
                    else:
                        update_data["reason_for_activity"] = "invited_criteria"
                else:
                    update_data["is_active"] = False
                    update_data["reason_for_activity"] = None

                logger.info(f"Оновлюємо активність: {update_data}")
                update_result = supabase.table("referral_activities").update(update_data).eq("user_id",
                                                                                             user_id_str).execute()

                # Отримуємо оновлені дані
                updated_activity = supabase.table("referral_activities").select("*").eq("user_id",
                                                                                        user_id_str).execute()

                logger.info(f"=== update_activity END: success ===")
                return {
                    'success': True,
                    'message': 'Activity updated successfully',
                    'activity': updated_activity.data[0] if updated_activity.data else None
                }
            else:
                # Створюємо новий запис
                new_activity_data = {
                    "user_id": user_id_str,
                    "draws_participation": draws_participation or 0,
                    "invited_referrals": invited_referrals or 0,
                    "is_active": False,
                    "last_updated": datetime.utcnow().isoformat()
                }

                # Перевіряємо активність
                meets_draws = new_activity_data["draws_participation"] >= ActivityController.MIN_DRAWS_PARTICIPATION
                meets_invites = new_activity_data["invited_referrals"] >= ActivityController.MIN_INVITED_REFERRALS

                if meets_draws or meets_invites:
                    new_activity_data["is_active"] = True
                    if meets_draws and meets_invites:
                        new_activity_data["reason_for_activity"] = "both_criteria"
                    elif meets_draws:
                        new_activity_data["reason_for_activity"] = "draws_criteria"
                    else:
                        new_activity_data["reason_for_activity"] = "invited_criteria"

                logger.info(f"Створюємо нову активність: {new_activity_data}")
                result = supabase.table("referral_activities").insert(new_activity_data).execute()

                logger.info(f"=== update_activity END: new activity created ===")
                return {
                    'success': True,
                    'message': 'Activity created successfully',
                    'activity': result.data[0] if result.data else None
                }

        except Exception as e:
            error_details = traceback.format_exc()
            logger.error(f"Error updating activity: {str(e)}\n{error_details}")
            return {
                'success': False,
                'error': 'Failed to update activity',
                'details': str(e)
            }

    @staticmethod
    def manually_activate(user_id, admin_id):
        """
        Вручну активує реферала

        Args:
            user_id (int): ID користувача (реферала)
            admin_id (int): ID адміністратора, який активує

        Returns:
            dict: Результат операції
        """
        try:
            # Конвертуємо ID в рядок для уніформності
            user_id_str = str(user_id)
            admin_id_str = str(admin_id)
            logger.info(f"=== manually_activate: user={user_id_str}, admin={admin_id_str} ===")

            # Знаходимо запис активності
            activity_result = supabase.table("referral_activities").select("*").eq("user_id", user_id_str).execute()

            if activity_result.data:
                # Оновлюємо існуючий запис
                update_data = {
                    "is_active": True,
                    "reason_for_activity": "manual_activation",
                    "last_updated": datetime.utcnow().isoformat()
                }

                supabase.table("referral_activities").update(update_data).eq("user_id", user_id_str).execute()
                activation_result = True
            else:
                # Створюємо новий запис
                new_activity_data = {
                    "user_id": user_id_str,
                    "is_active": True,
                    "reason_for_activity": "manual_activation",
                    "draws_participation": 0,
                    "invited_referrals": 0,
                    "last_updated": datetime.utcnow().isoformat()
                }
                supabase.table("referral_activities").insert(new_activity_data).execute()
                activation_result = True

            # Отримуємо оновлені дані
            updated_activity = supabase.table("referral_activities").select("*").eq("user_id", user_id_str).execute()

            # Логуємо хто активував для аудиту
            logger.info(f"User {user_id_str} manually activated by admin {admin_id_str}")

            return {
                'success': True,
                'message': 'Referral manually activated',
                'activity': updated_activity.data[0] if updated_activity.data else None,
                'admin_id': admin_id_str
            }
        except Exception as e:
            logger.error(f"Error during manual activation: {str(e)}")
            return {
                'success': False,
                'error': 'Failed to manually activate referral',
                'details': str(e)
            }

    @staticmethod
    def get_referral_activity(user_id, options=None):
        """
        Отримує дані про активність рефералів користувача

        Args:
            user_id (int): ID користувача
            options (dict, optional): Додаткові опції для фільтрації.
                Може містити ключі: 'startDate', 'endDate', 'level', 'activeOnly'

        Returns:
            dict: Дані про активність рефералів
        """
        if options is None:
            options = {}

        try:
            # Конвертуємо ID в рядок для уніформності
            user_id_str = str(user_id)
            logger.info(f"=== get_referral_activity START for user_id={user_id_str} ===")
            logger.info(f"Options: {options}")

            # Отримання рефералів користувача
            level1_query = supabase.table("referrals").select("*").eq("referrer_id", user_id_str).eq("level", 1)
            level2_query = supabase.table("referrals").select("*").eq("referrer_id", user_id_str).eq("level", 2)

            # Фільтрація за рівнем, якщо вказано
            if 'level' in options and options['level'] in [1, 2]:
                if options['level'] == 1:
                    level2_referrals = []
                    level1_referrals = level1_query.execute().data or []
                else:
                    level1_referrals = []
                    level2_referrals = level2_query.execute().data or []
            else:
                level1_referrals = level1_query.execute().data or []
                level2_referrals = level2_query.execute().data or []

            logger.info(f"Знайдено рефералів: L1={len(level1_referrals)}, L2={len(level2_referrals)}")

            # Збираємо всі ID рефералів
            referral_ids = [ref['referee_id'] for ref in level1_referrals] + [ref['referee_id'] for ref in
                                                                              level2_referrals]

            # Оптимізація: якщо нема рефералів, повертаємо пусту відповідь
            if not referral_ids:
                logger.info("Немає рефералів для цього користувача")
                return {
                    'success': True,
                    'userId': user_id_str,
                    'timestamp': datetime.utcnow().isoformat(),
                    'level1Activity': [],
                    'level2Activity': []
                }

            # Отримуємо активність всіх рефералів
            logger.info(f"Запитуємо активності для {len(referral_ids)} рефералів")
            activities_query = supabase.table("referral_activities").select("*").in_("user_id", referral_ids)
            activities_result = activities_query.execute()
            logger.info(f"Знайдено {len(activities_result.data or [])} записів активності")

            # Створюємо мапу активності для швидкого доступу
            activity_map = {act['user_id']: act for act in activities_result.data or []}

            # Підготовлюємо дані про активність рефералів
            level1_activities = []
            level2_activities = []

            # Заповнюємо дані про активність для рефералів 1-го рівня
            for referral in level1_referrals:
                activity_data = ActivityController._prepare_activity_data(
                    referral['referee_id'],
                    activity_map.get(referral['referee_id'])
                )

                # Фільтрація за активністю, якщо вказано
                if options.get('activeOnly', False) and not activity_data['isActive']:
                    continue

                level1_activities.append(activity_data)

            # Заповнюємо дані про активність для рефералів 2-го рівня
            for referral in level2_referrals:
                activity_data = ActivityController._prepare_activity_data(
                    referral['referee_id'],
                    activity_map.get(referral['referee_id'])
                )

                # Додаємо referrerId для рефералів 2-го рівня
                # Знаходимо реферера 1-го рівня для цього реферала 2-го рівня
                referrer_1lvl_query = supabase.table("referrals").select("referrer_id").eq(
                    "referee_id", referral['referee_id']
                ).eq("level", 1)
                referrer_1lvl = referrer_1lvl_query.execute()

                if referrer_1lvl.data:
                    activity_data['referrerId'] = f'WX{referrer_1lvl.data[0]["referrer_id"]}'

                # Фільтрація за активністю, якщо вказано
                if options.get('activeOnly', False) and not activity_data['isActive']:
                    continue

                level2_activities.append(activity_data)

            logger.info(f"=== get_referral_activity END: L1={len(level1_activities)}, L2={len(level2_activities)} ===")
            return {
                'success': True,
                'userId': user_id_str,
                'timestamp': datetime.utcnow().isoformat(),
                'level1Activity': level1_activities,
                'level2Activity': level2_activities
            }
        except Exception as e:
            error_details = traceback.format_exc()
            logger.error(f"Error getting referral activity: {str(e)}\n{error_details}")
            return {
                'success': False,
                'error': 'Failed to get referral activity',
                'details': str(e)
            }

    @staticmethod
    def get_referral_detailed_activity(referral_id):
        """
        Отримує детальні дані про активність конкретного реферала

        Args:
            referral_id (int): ID реферала

        Returns:
            dict: Детальні дані про активність
        """
        try:
            # Конвертуємо ID в рядок для уніформності
            referral_id_str = str(referral_id)
            logger.info(f"=== get_referral_detailed_activity START for referral_id={referral_id_str} ===")

            # Отримуємо активність реферала
            activity_query = supabase.table("referral_activities").select("*").eq("user_id", referral_id_str)
            activity_result = activity_query.execute()
            activity = activity_result.data[0] if activity_result.data else None

            if not activity:
                logger.info(f"Активність не знайдена для реферала {referral_id_str}, повертаємо базові дані")
                # Якщо запис активності відсутній, повертаємо базові дані
                return {
                    'success': True,
                    'id': f'WX{referral_id_str}',
                    'timestamp': datetime.utcnow().isoformat(),
                    'drawsParticipation': 0,
                    'invitedReferrals': 0,
                    'lastActivityDate': None,
                    'isActive': False,
                    'manuallyActivated': False,
                    'meetsDrawsCriteria': False,
                    'meetsInvitedCriteria': False,
                    'reasonForActivity': None,
                    'drawsHistory': [],
                    'invitedReferralsList': [],
                    'manualActivationInfo': None
                }

            logger.info(
                f"Знайдено активність: draws={activity['draws_participation']}, invites={activity['invited_referrals']}")

            # Отримуємо дані для drawsHistory
            draws_query = supabase.table("draw_participants").select("*").eq("user_id", referral_id_str)
            draws_participations = draws_query.execute()
            logger.info(f"Знайдено {len(draws_participations.data or [])} участей в розіграшах")

            draws_history = []
            for participation in draws_participations.data or []:
                draw_query = supabase.table("draws").select("*").eq("id", participation['draw_id'])
                draw = draw_query.execute()
                if draw.data:
                    draws_history.append({
                        'drawId': f'DRAW{draw.data[0]["id"]}',
                        'date': draw.data[0]['date'],
                        'prizeName': draw.data[0]['name'],
                        'prizeAmount': participation['prize_amount'] if participation['is_winner'] else 0,
                        'isWinner': participation.get('is_winner', False)
                    })

            # Отримуємо дані для invitedReferralsList
            invited_query = supabase.table("referrals").select("*").eq("referrer_id", referral_id_str).eq("level", 1)
            invited_referrals = invited_query.execute()
            logger.info(f"Знайдено {len(invited_referrals.data or [])} запрошених рефералів")

            invited_referrals_list = []
            for invited in invited_referrals.data or []:
                # Перевіряємо активність запрошеного реферала
                invited_activity_query = supabase.table("referral_activities").select("*").eq("user_id",
                                                                                              invited['referee_id'])
                invited_activity = invited_activity_query.execute()
                is_active = False

                if invited_activity.data:
                    is_active = invited_activity.data[0].get('is_active', False)

                invited_referrals_list.append({
                    'id': f'WX{invited["referee_id"]}',
                    'registrationDate': invited['created_at'],
                    'isActive': is_active
                })

            # Інформація про ручну активацію (якщо є)
            manual_activation_info = None
            if activity.get('reason_for_activity') == 'manual_activation':
                manual_activation_info = {
                    'activatedBy': 'admin',
                    'activationDate': activity['last_updated'],
                    'reason': 'Manual activation by administrator'
                }

            # Формуємо відповідь у форматі, очікуваному фронтендом
            meets_draws_criteria = activity['draws_participation'] >= ActivityController.MIN_DRAWS_PARTICIPATION
            meets_invited_criteria = activity['invited_referrals'] >= ActivityController.MIN_INVITED_REFERRALS

            # Уніфікована логіка перевірки активності
            is_inactive_by_time = False
            if activity.get('last_updated'):
                try:
                    last_updated = datetime.fromisoformat(activity['last_updated'].replace('Z', '+00:00'))
                    is_inactive_by_time = last_updated < (
                                datetime.utcnow() - timedelta(days=ActivityController.INACTIVE_DAYS_THRESHOLD))
                except:
                    pass

            is_active = (
                    activity.get('is_active', False) and
                    (meets_draws_criteria or meets_invited_criteria) and
                    not is_inactive_by_time
            )

            result = {
                'success': True,
                'id': f'WX{referral_id_str}',
                'timestamp': datetime.utcnow().isoformat(),
                'drawsParticipation': activity['draws_participation'],
                'invitedReferrals': activity['invited_referrals'],
                'lastActivityDate': activity['last_updated'],
                'isActive': is_active,
                'manuallyActivated': activity.get('reason_for_activity') == 'manual_activation',
                'meetsDrawsCriteria': meets_draws_criteria,
                'meetsInvitedCriteria': meets_invited_criteria,
                'reasonForActivity': activity.get('reason_for_activity'),
                'drawsHistory': draws_history,
                'invitedReferralsList': invited_referrals_list,
                'manualActivationInfo': manual_activation_info
            }

            logger.info(f"=== get_referral_detailed_activity END: success ===")
            return result

        except Exception as e:
            error_details = traceback.format_exc()
            logger.error(f"Error getting detailed activity: {str(e)}\n{error_details}")
            return {
                'success': False,
                'error': 'Failed to get detailed activity',
                'details': str(e)
            }

    @staticmethod
    def get_activity_summary(user_id):
        """
        Отримує зведені дані про активність всіх рефералів користувача

        Args:
            user_id (int): ID користувача

        Returns:
            dict: Зведена інформація про активність
        """
        try:
            # Конвертуємо ID в рядок для уніформності
            user_id_str = str(user_id)
            logger.info(f"=== get_activity_summary START for user_id={user_id_str} ===")

            # Отримуємо дані про активність рефералів
            activity_result = ActivityController.get_referral_activity(user_id_str)

            if not activity_result['success']:
                return activity_result

            level1_activity = activity_result['level1Activity']
            level2_activity = activity_result['level2Activity']

            # Підраховуємо загальну кількість рефералів
            total_referrals = len(level1_activity) + len(level2_activity)

            # Підраховуємо кількість активних рефералів
            active_level1 = sum(1 for ref in level1_activity if ref['isActive'])
            active_level2 = sum(1 for ref in level2_activity if ref['isActive'])
            total_active = active_level1 + active_level2

            # Розраховуємо конверсію (відсоток активних рефералів)
            conversion_rate = (total_active / total_referrals * 100) if total_referrals > 0 else 0

            # Підраховуємо кількість рефералів за причиною активності
            activity_reasons = {
                'draws_criteria': 0,
                'invited_criteria': 0,
                'both_criteria': 0,
                'manual_activation': 0
            }

            for activity in level1_activity + level2_activity:
                reason = activity.get('reasonForActivity')
                if reason in activity_reasons:
                    activity_reasons[reason] += 1

            result = {
                'success': True,
                'userId': user_id_str,
                'timestamp': datetime.utcnow().isoformat(),
                'totalReferrals': total_referrals,
                'activeReferrals': total_active,
                'inactiveReferrals': total_referrals - total_active,
                'level1Total': len(level1_activity),
                'level1Active': active_level1,
                'level2Total': len(level2_activity),
                'level2Active': active_level2,
                'conversionRate': round(conversion_rate, 2),
                'activityByReason': {
                    'drawsCriteria': activity_reasons['draws_criteria'],
                    'invitedCriteria': activity_reasons['invited_criteria'],
                    'bothCriteria': activity_reasons['both_criteria'],
                    'manualActivation': activity_reasons['manual_activation']
                }
            }

            logger.info(f"=== get_activity_summary END: total={total_referrals}, active={total_active} ===")
            return result

        except Exception as e:
            error_details = traceback.format_exc()
            logger.error(f"Error getting activity summary: {str(e)}\n{error_details}")
            return {
                'success': False,
                'error': 'Failed to get activity summary',
                'details': str(e)
            }

    @staticmethod
    def _prepare_activity_data(referral_id, activity):
        """
        Підготовлює дані про активність для відповіді API

        Args:
            referral_id (int): ID реферала
            activity (dict): Об'єкт активності або None

        Returns:
            dict: Підготовлені дані про активність
        """
        # Конвертуємо ID в рядок для уніформності
        referral_id_str = str(referral_id)

        if activity:
            # Перевірка активності за реальними критеріями
            meets_draws_criteria = activity['draws_participation'] >= ActivityController.MIN_DRAWS_PARTICIPATION
            meets_invited_criteria = activity['invited_referrals'] >= ActivityController.MIN_INVITED_REFERRALS

            # Додаткова перевірка на неактивність за часом
            is_inactive_by_time = False
            if activity.get('last_updated'):
                try:
                    last_updated = datetime.fromisoformat(activity['last_updated'].replace('Z', '+00:00'))
                    is_inactive_by_time = last_updated < (
                                datetime.utcnow() - timedelta(days=ActivityController.INACTIVE_DAYS_THRESHOLD))
                except:
                    pass

            # Уніфікована логіка активності
            is_active = (
                    activity.get('is_active', False) and
                    (meets_draws_criteria or meets_invited_criteria) and
                    not is_inactive_by_time
            )

            # Форматуємо відповідь у форматі, який очікує фронтенд
            return {
                'id': f'WX{referral_id_str}',
                'drawsParticipation': activity['draws_participation'],
                'invitedReferrals': activity['invited_referrals'],
                'lastActivityDate': activity['last_updated'],
                'isActive': is_active,
                'manuallyActivated': activity.get('reason_for_activity') == 'manual_activation',
                'meetsDrawsCriteria': meets_draws_criteria,
                'meetsInvitedCriteria': meets_invited_criteria,
                'reasonForActivity': activity.get('reason_for_activity')
            }
        else:
            # Якщо запис активності відсутній, повертаємо базові дані
            return {
                'id': f'WX{referral_id_str}',
                'drawsParticipation': 0,
                'invitedReferrals': 0,
                'lastActivityDate': None,
                'isActive': False,
                'manuallyActivated': False,
                'meetsDrawsCriteria': False,
                'meetsInvitedCriteria': False,
                'reasonForActivity': None
            }

    @staticmethod
    def ensure_activities_exist(user_id):
        """
        Переконується що записи активності існують для всіх рефералів

        Args:
            user_id (int): ID користувача

        Returns:
            int: Кількість створених записів
        """
        try:
            user_id_str = str(user_id)
            logger.info(f"=== ensure_activities_exist START for user_id={user_id_str} ===")

            # Отримуємо всіх рефералів
            referrals_query = supabase.table("referrals").select("referee_id").eq("referrer_id", user_id_str)
            referrals_result = referrals_query.execute()
            logger.info(f"Знайдено {len(referrals_result.data or [])} рефералів")

            created_count = 0
            for referral in referrals_result.data or []:
                referee_id = referral['referee_id']

                # Перевіряємо чи існує запис активності
                activity_query = supabase.table("referral_activities").select("id").eq("user_id", referee_id)
                activity_result = activity_query.execute()

                if not activity_result.data:
                    # Створюємо запис
                    new_activity = {
                        "user_id": referee_id,
                        "draws_participation": 0,
                        "invited_referrals": 0,
                        "is_active": False,
                        "last_updated": datetime.utcnow().isoformat()
                    }
                    supabase.table("referral_activities").insert(new_activity).execute()
                    created_count += 1
                    logger.info(f"Створено запис активності для {referee_id}")

            # Також перевіряємо активність самого користувача
            user_activity_query = supabase.table("referral_activities").select("id").eq("user_id", user_id_str)
            user_activity_result = user_activity_query.execute()

            if not user_activity_result.data:
                # Рахуємо скільки рефералів запросив цей користувач
                user_referrals_count = len(referrals_result.data or [])

                new_user_activity = {
                    "user_id": user_id_str,
                    "draws_participation": 0,
                    "invited_referrals": user_referrals_count,
                    "is_active": user_referrals_count >= ActivityController.MIN_INVITED_REFERRALS,
                    "reason_for_activity": "invited_criteria" if user_referrals_count >= ActivityController.MIN_INVITED_REFERRALS else None,
                    "last_updated": datetime.utcnow().isoformat()
                }
                supabase.table("referral_activities").insert(new_user_activity).execute()
                created_count += 1
                logger.info(f"Створено запис активності для самого користувача {user_id_str}")

            logger.info(f"=== ensure_activities_exist END: створено {created_count} записів ===")
            return created_count

        except Exception as e:
            error_details = traceback.format_exc()
            logger.error(f"Error in ensure_activities_exist: {str(e)}\n{error_details}")
            return 0

    @staticmethod
    def sync_activity_with_real_data(user_id):
        """
        Синхронізує записи активності з реальними даними з інших таблиць

        Args:
            user_id (int): ID користувача для синхронізації його рефералів

        Returns:
            dict: Результат синхронізації
        """
        try:
            user_id_str = str(user_id)
            logger.info(f"=== sync_activity_with_real_data START for user_id={user_id_str} ===")

            # Спочатку переконуємося що всі записи існують
            created = ActivityController.ensure_activities_exist(user_id)
            logger.info(f"Створено {created} нових записів активності")

            # Отримуємо всіх рефералів
            referrals_query = supabase.table("referrals").select("referee_id").eq("referrer_id", user_id_str)
            referrals_result = referrals_query.execute()

            synced_count = 0
            for referral in referrals_result.data or []:
                referee_id = referral['referee_id']

                # Рахуємо реальну кількість участей в розіграшах
                draws_query = supabase.table("draw_participants").select("id").eq("user_id", referee_id)
                draws_result = draws_query.execute()
                real_draws_count = len(draws_result.data or [])

                # Рахуємо реальну кількість запрошених
                invites_query = supabase.table("referrals").select("id").eq("referrer_id", referee_id).eq("level", 1)
                invites_result = invites_query.execute()
                real_invites_count = len(invites_result.data or [])

                # Оновлюємо активність з реальними даними
                ActivityController.update_activity(
                    referee_id,
                    draws_participation=real_draws_count,
                    invited_referrals=real_invites_count
                )
                synced_count += 1

                logger.info(
                    f"Синхронізовано активність для {referee_id}: draws={real_draws_count}, invites={real_invites_count}")

            logger.info(f"=== sync_activity_with_real_data END: синхронізовано {synced_count} записів ===")
            return {
                'success': True,
                'created': created,
                'synced': synced_count,
                'message': f'Successfully synced {synced_count} activity records'
            }

        except Exception as e:
            error_details = traceback.format_exc()
            logger.error(f"Error in sync_activity_with_real_data: {str(e)}\n{error_details}")
            return {
                'success': False,
                'error': 'Failed to sync activity data',
                'details': str(e)
            }