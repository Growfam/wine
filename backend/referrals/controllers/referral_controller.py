from supabase_client import supabase
from datetime import datetime, timedelta
import logging
import traceback

logger = logging.getLogger(__name__)


class ReferralController:
    """
    Контролер для управління реферальними зв'язками
    """

    @staticmethod
    def generate_referral_link(user_id):
        """
        Генерує реферальне посилання для користувача
        """
        try:
            if not user_id:
                logger.error(f"generate_referral_link: Передано порожній user_id")
                return {
                    'success': False,
                    'error': 'Invalid user ID',
                    'details': 'User ID cannot be empty'
                }

            user_id_str = str(user_id)
            referral_link = f"https://t.me/WINIX_Official_bot?start={user_id_str}"
            logger.info(f"generate_referral_link: Згенеровано посилання для користувача {user_id_str}: {referral_link}")

            return {
                'success': True,
                'user_id': user_id_str,
                'referral_link': referral_link,
                'link': referral_link
            }
        except Exception as e:
            error_details = traceback.format_exc()
            logger.error(f"Помилка генерації реферального посилання: {str(e)}\n{error_details}")
            return {
                'success': False,
                'error': 'Failed to generate referral link',
                'details': str(e)
            }

    @staticmethod
    def register_referral(referrer_id, referee_id):
        """
        Реєструє нового реферала і створює реферальний зв'язок
        """
        try:
            if not referrer_id or not referee_id:
                logger.error(f"register_referral: Відсутні обов'язкові параметри. "
                             f"referrer_id={referrer_id}, referee_id={referee_id}")
                return {
                    'success': False,
                    'error': 'Missing required parameters',
                    'details': 'Both referrer_id and referee_id must be provided'
                }

            referrer_id_str = str(referrer_id)
            referee_id_str = str(referee_id)

            # Перевірка, чи реферал вже зареєстрований
            existing_referral = supabase.table("referrals").select("*").eq("referee_id", referee_id_str).eq("level",
                                                                                                            1).execute()
            if existing_referral.data:
                logger.warning(f"register_referral: Користувач {referee_id_str} вже зареєстрований як реферал")
                return {
                    'success': False,
                    'error': 'User is already registered as a referral',
                    'details': f'Referee ID {referee_id_str} is already linked'
                }

            # Перевірка самореєстрації
            if referrer_id_str == referee_id_str:
                logger.error(f"register_referral: Спроба зареєструвати себе як реферала. ID: {referrer_id_str}")
                return {
                    'success': False,
                    'error': 'User cannot refer themselves',
                    'details': 'Referrer ID and referee ID must be different'
                }

            try:
                # Створення запису про прямого реферала (1-й рівень)
                new_referral_data = {
                    "referrer_id": referrer_id_str,
                    "referee_id": referee_id_str,
                    "level": 1,
                    "created_at": datetime.utcnow().isoformat()
                }
                new_referral_result = supabase.table("referrals").insert(new_referral_data).execute()

                # Оновлюємо активність реферера
                ReferralController._update_referrer_activity(referrer_id_str)

                # Створюємо активність для нового реферала
                ReferralController._create_referee_activity(referee_id_str)

                # Створюємо зв'язок 2-го рівня якщо є
                ReferralController._create_second_level_referral(referrer_id_str, referee_id_str)

                logger.info(
                    f"register_referral: Успішно створено реферальний зв'язок між {referrer_id_str} та {referee_id_str}")

                return {
                    'success': True,
                    'message': 'Referral successfully registered',
                    'referral': {
                        'id': new_referral_result.data[0]['id'] if new_referral_result.data else None,
                        'referrer_id': referrer_id_str,
                        'referee_id': referee_id_str,
                        'level': 1,
                        'created_at': new_referral_data['created_at']
                    }
                }
            except Exception as e:
                error_details = traceback.format_exc()
                logger.error(f"register_referral: Помилка в транзакції: {str(e)}\n{error_details}")
                return {
                    'success': False,
                    'error': 'Database error during referral registration',
                    'details': str(e)
                }

        except Exception as e:
            error_details = traceback.format_exc()
            logger.error(f"Error registering referral: {str(e)}\n{error_details}")
            return {
                'success': False,
                'error': 'Failed to register referral',
                'details': str(e)
            }

    @staticmethod
    def get_referral_structure(user_id):
        """
        Отримує структуру рефералів користувача (1-го та 2-го рівнів)
        """
        try:
            if not user_id:
                logger.error(f"get_referral_structure: Передано порожній user_id")
                return {
                    'success': False,
                    'error': 'Invalid user ID',
                    'details': 'User ID cannot be empty'
                }

            user_id_str = str(user_id)
            logger.info(f"=== get_referral_structure START for user_id: {user_id_str} ===")

            try:
                # Отримання рефералів 1-го рівня
                logger.info(f"Запитуємо рефералів 1-го рівня для {user_id_str}")
                level1_query = supabase.table("referrals").select("*").eq("referrer_id", user_id_str).eq("level", 1)
                level1_result = level1_query.execute()
                level1_referrals = level1_result.data or []
                logger.info(f"Знайдено {len(level1_referrals)} рефералів 1-го рівня")

                # Отримання рефералів 2-го рівня
                logger.info(f"Запитуємо рефералів 2-го рівня для {user_id_str}")
                level2_query = supabase.table("referrals").select("*").eq("referrer_id", user_id_str).eq("level", 2)
                level2_result = level2_query.execute()
                level2_referrals = level2_result.data or []
                logger.info(f"Знайдено {len(level2_referrals)} рефералів 2-го рівня")

                # Отримуємо ID всіх рефералів для запиту активностей
                all_referral_ids = []
                for ref in level1_referrals + level2_referrals:
                    all_referral_ids.append(ref['referee_id'])

                logger.info(f"Всього унікальних ID рефералів: {len(set(all_referral_ids))}")

                # Отримуємо дані про активність всіх рефералів одним запитом
                activities_map = {}
                if all_referral_ids:
                    logger.info(f"Запитуємо активності для {len(all_referral_ids)} рефералів")
                    activities_query = supabase.table("referral_activities").select("*").in_("user_id",
                                                                                             all_referral_ids)
                    activities_result = activities_query.execute()

                    for activity in activities_result.data or []:
                        activities_map[activity['user_id']] = activity

                    logger.info(f"Знайдено {len(activities_map)} записів активності")

                # Отримуємо імена користувачів
                users_map = {}
                if all_referral_ids:
                    logger.info(f"Запитуємо дані користувачів")
                    users_query = supabase.table("winix").select("telegram_id, username").in_("telegram_id",
                                                                                              all_referral_ids)
                    users_result = users_query.execute()

                    for user in users_result.data or []:
                        users_map[user['telegram_id']] = user.get('username', 'User')

                    logger.info(f"Знайдено {len(users_map)} користувачів")

                # Форматуємо дані рефералів 1-го рівня
                formatted_level1 = []
                active_level1 = 0
                for ref in level1_referrals:
                    formatted_ref = ReferralController._format_referral_with_activity(
                        ref,
                        activities_map.get(ref['referee_id']),
                        users_map.get(ref['referee_id'], 'User')
                    )
                    formatted_level1.append(formatted_ref)
                    if formatted_ref['active']:
                        active_level1 += 1

                # Форматуємо дані рефералів 2-го рівня
                formatted_level2 = []
                active_level2 = 0
                for ref in level2_referrals:
                    formatted_ref = ReferralController._format_referral_with_activity(
                        ref,
                        activities_map.get(ref['referee_id']),
                        users_map.get(ref['referee_id'], 'User'),
                        with_referrer_id=True
                    )
                    formatted_level2.append(formatted_ref)
                    if formatted_ref['active']:
                        active_level2 += 1

                # Загальна статистика
                total_referrals = len(level1_referrals) + len(level2_referrals)
                total_active = active_level1 + active_level2
                conversion_rate = (total_active / total_referrals * 100) if total_referrals > 0 else 0

                result = {
                    'success': True,
                    'user_id': user_id_str,
                    'referrals': {
                        'level1': formatted_level1,
                        'level2': formatted_level2
                    },
                    'statistics': {
                        'totalReferrals': total_referrals,
                        'level1Count': len(level1_referrals),
                        'level2Count': len(level2_referrals),
                        'activeReferrals': total_active,
                        'inactiveReferrals': total_referrals - total_active,
                        'conversionRate': round(conversion_rate, 2)
                    }
                }

                logger.info(f"=== get_referral_structure END: success, total={total_referrals} ===")
                return result

            except Exception as e:
                error_details = traceback.format_exc()
                logger.error(f"get_referral_structure: Помилка бази даних: {str(e)}\n{error_details}")
                return {
                    'success': False,
                    'error': 'Database error retrieving referral structure',
                    'details': str(e)
                }
        except Exception as e:
            error_details = traceback.format_exc()
            logger.error(f"Error getting referral structure: {str(e)}\n{error_details}")
            return {
                'success': False,
                'error': 'Failed to get referral structure',
                'details': str(e)
            }

    @staticmethod
    def _format_referral_with_activity(referral, activity, username, with_referrer_id=False):
        """
        Форматує дані реферала з урахуванням активності
        """
        try:
            # Визначаємо активність
            is_active = False
            if activity:
                # Перевіряємо критерії активності
                meets_draws = activity.get('draws_participation', 0) >= 3
                meets_invites = activity.get('invited_referrals', 0) >= 1

                # Перевіряємо давність активності
                is_recent = True
                if activity.get('last_updated'):
                    try:
                        last_updated = datetime.fromisoformat(activity['last_updated'].replace('Z', '+00:00'))
                        is_recent = last_updated > (datetime.utcnow() - timedelta(days=7))
                    except:
                        pass

                is_active = activity.get('is_active', False) and (meets_draws or meets_invites) and is_recent

            result = {
                'id': f'WX{referral["referee_id"]}',
                'rawId': str(referral['referee_id']),
                'username': username,
                'registrationDate': referral['created_at'],
                'active': is_active,
                'drawsParticipation': activity.get('draws_participation', 0) if activity else 0,
                'invitedReferrals': activity.get('invited_referrals', 0) if activity else 0
            }

            if with_referrer_id:
                # Для рефералів 2-го рівня знаходимо проміжного реферера
                try:
                    first_level_query = supabase.table("referrals").select("referrer_id").eq(
                        "referee_id", referral['referee_id']
                    ).eq("level", 1)
                    first_level_result = first_level_query.execute()

                    if first_level_result.data:
                        result['referrerId'] = f'WX{first_level_result.data[0]["referrer_id"]}'
                        result['rawReferrerId'] = str(first_level_result.data[0]['referrer_id'])
                except Exception as e:
                    logger.error(f"Помилка пошуку проміжного реферера: {str(e)}")

            return result
        except Exception as e:
            logger.error(f"_format_referral_with_activity error: {str(e)}")
            return {
                'id': f'WX{referral["referee_id"]}',
                'rawId': str(referral['referee_id']),
                'username': 'User',
                'registrationDate': referral.get('created_at', datetime.utcnow().isoformat()),
                'active': False,
                'error': str(e)
            }

    @staticmethod
    def _update_referrer_activity(referrer_id):
        """Оновлює активність реферера після додавання нового реферала"""
        try:
            activity_query = supabase.table("referral_activities").select("*").eq("user_id", referrer_id)
            activity_result = activity_query.execute()

            if activity_result.data:
                # Оновлюємо існуючий запис
                current_activity = activity_result.data[0]
                new_invited_count = current_activity.get('invited_referrals', 0) + 1

                update_data = {
                    "invited_referrals": new_invited_count,
                    "last_updated": datetime.utcnow().isoformat()
                }

                # Перевіряємо критерії активності
                if new_invited_count >= 1 or current_activity.get('draws_participation', 0) >= 3:
                    update_data["is_active"] = True
                    if new_invited_count >= 1:
                        update_data["reason_for_activity"] = "invited_criteria"

                supabase.table("referral_activities").update(update_data).eq("user_id", referrer_id).execute()
                logger.info(f"Оновлено активність реферера {referrer_id}: invited_referrals = {new_invited_count}")
            else:
                # Створюємо новий запис
                new_activity_data = {
                    "user_id": referrer_id,
                    "invited_referrals": 1,
                    "draws_participation": 0,
                    "is_active": True,
                    "reason_for_activity": "invited_criteria",
                    "last_updated": datetime.utcnow().isoformat()
                }
                supabase.table("referral_activities").insert(new_activity_data).execute()
                logger.info(f"Створено запис активності для реферера {referrer_id}")
        except Exception as e:
            logger.error(f"Помилка оновлення активності реферера: {str(e)}")

    @staticmethod
    def _create_referee_activity(referee_id):
        """Створює початковий запис активності для нового реферала"""
        try:
            referee_activity_data = {
                "user_id": referee_id,
                "invited_referrals": 0,
                "draws_participation": 0,
                "is_active": False,
                "last_updated": datetime.utcnow().isoformat()
            }
            supabase.table("referral_activities").insert(referee_activity_data).execute()
            logger.info(f"Створено запис активності для нового реферала {referee_id}")
        except Exception as e:
            logger.error(f"Помилка створення активності реферала: {str(e)}")

    @staticmethod
    def _create_second_level_referral(referrer_id, referee_id):
        """Створює зв'язок 2-го рівня якщо є"""
        try:
            # Шукаємо хто запросив поточного реферера
            higher_query = supabase.table("referrals").select("referrer_id").eq("referee_id", referrer_id).eq("level",
                                                                                                              1)
            higher_result = higher_query.execute()

            if higher_result.data:
                higher_referrer_id = higher_result.data[0]['referrer_id']

                # Перевіряємо чи не створить це циклічний зв'язок
                if higher_referrer_id != referee_id:
                    # Перевіряємо чи вже існує такий зв'язок
                    existing_query = supabase.table("referrals").select("id").eq(
                        "referrer_id", higher_referrer_id
                    ).eq("referee_id", referee_id).eq("level", 2)
                    existing_result = existing_query.execute()

                    if not existing_result.data:
                        second_level_data = {
                            "referrer_id": higher_referrer_id,
                            "referee_id": referee_id,
                            "level": 2,
                            "created_at": datetime.utcnow().isoformat()
                        }
                        supabase.table("referrals").insert(second_level_data).execute()
                        logger.info(f"Створено реферальний зв'язок 2-го рівня: {higher_referrer_id} -> {referee_id}")
        except Exception as e:
            logger.error(f"Помилка створення зв'язку 2-го рівня: {str(e)}")