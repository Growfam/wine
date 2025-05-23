from supabase_client import supabase
from datetime import datetime, timedelta
import logging
import traceback

# Додаткове логування для відстеження детальних помилок
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
            # Валідація user_id
            if not user_id:
                logger.error(f"generate_referral_link: Передано порожній user_id")
                return {
                    'success': False,
                    'error': 'Invalid user ID',
                    'details': 'User ID cannot be empty'
                }

            # Конвертуємо ID в рядок для уніформності
            user_id_str = str(user_id)  # ← ЦЯ СТРОКА ПОВИННА БУТИ ТУТ

            # Новий формат посилання
            referral_link = f"https://t.me/WINIX_Official_bot?start={user_id_str}"
            logger.info(f"generate_referral_link: Згенеровано посилання для користувача {user_id_str}: {referral_link}")

            # Повертаємо уніформну відповідь для фронтенду
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

        Args:
            referrer_id (int): ID користувача-реферера
            referee_id (int): ID нового користувача-реферала

        Returns:
            dict: Результат операції
        """
        try:
            # Валідація вхідних даних
            if not referrer_id or not referee_id:
                logger.error(f"register_referral: Відсутні обов'язкові параметри. "
                             f"referrer_id={referrer_id}, referee_id={referee_id}")
                return {
                    'success': False,
                    'error': 'Missing required parameters',
                    'details': 'Both referrer_id and referee_id must be provided'
                }

            # Конвертуємо ID в рядки для уніформності
            referrer_id_str = str(referrer_id)
            referee_id_str = str(referee_id)

            # Перевірка, чи реферал вже зареєстрований
            existing_referral = supabase.table("referrals").select("*").eq("referee_id", referee_id_str).eq("level",
                                                                                                            1).execute()
            if existing_referral.data:
                logger.warning(f"register_referral: Користувач {referee_id_str} вже зареєстрований як реферал "
                               f"для користувача {existing_referral.data[0]['referrer_id']}")
                return {
                    'success': False,
                    'error': 'User is already registered as a referral',
                    'details': f'Referee ID {referee_id_str} is already linked to referrer ID {existing_referral.data[0]["referrer_id"]}'
                }

            # Перевірка, що користувач не реєструє себе як реферала
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

                # Оновлюємо кількість запрошених для активності реферера
                referrer_activity = supabase.table("referral_activities").select("*").eq("user_id",
                                                                                         referrer_id_str).execute()

                if referrer_activity.data:
                    # Оновлюємо існуючий запис
                    current_invited = referrer_activity.data[0].get('invited_referrals', 0)
                    update_data = {
                        "invited_referrals": current_invited + 1,
                        "last_updated": datetime.utcnow().isoformat()
                    }

                    # Перевіряємо активність на основі нових даних
                    draws_participation = referrer_activity.data[0].get('draws_participation', 0)
                    if (current_invited + 1) >= 1 or draws_participation >= 3:
                        update_data["is_active"] = True
                        update_data["reason_for_activity"] = "invited_criteria" if (
                                                                                               current_invited + 1) >= 1 else "draws_criteria"

                    supabase.table("referral_activities").update(update_data).eq("user_id", referrer_id_str).execute()
                else:
                    # Створюємо новий запис активності
                    new_activity_data = {
                        "user_id": referrer_id_str,
                        "invited_referrals": 1,
                        "draws_participation": 0,
                        "is_active": True,  # Активний, бо вже запросив 1 реферала
                        "reason_for_activity": "invited_criteria",
                        "last_updated": datetime.utcnow().isoformat()
                    }
                    supabase.table("referral_activities").insert(new_activity_data).execute()

                # Створюємо запис активності для нового реферала
                referee_activity_data = {
                    "user_id": referee_id_str,
                    "invited_referrals": 0,
                    "draws_participation": 0,
                    "is_active": False,
                    "last_updated": datetime.utcnow().isoformat()
                }
                supabase.table("referral_activities").insert(referee_activity_data).execute()

                # Знаходимо реферера для поточного реферера (якщо є), щоб створити зв'язок 2-го рівня
                higher_referral = supabase.table("referrals").select("*").eq("referee_id", referrer_id_str).eq("level",
                                                                                                               1).execute()

                if higher_referral.data and higher_referral.data[0]['referrer_id'] != referee_id_str:
                    # Перевіряємо, чи вже існує такий зв'язок 2-го рівня
                    existing_lvl2 = supabase.table("referrals").select("*").eq(
                        "referrer_id", higher_referral.data[0]['referrer_id']
                    ).eq(
                        "referee_id", referee_id_str
                    ).eq("level", 2).execute()

                    # Якщо зв'язок 2-го рівня ще не існує, створюємо його
                    if not existing_lvl2.data:
                        second_level_referral_data = {
                            "referrer_id": higher_referral.data[0]['referrer_id'],
                            "referee_id": referee_id_str,
                            "level": 2,
                            "created_at": datetime.utcnow().isoformat()
                        }
                        supabase.table("referrals").insert(second_level_referral_data).execute()
                        logger.info(
                            f"register_referral: Створено реферальний зв'язок 2-го рівня: {higher_referral.data[0]['referrer_id']} -> {referee_id_str}")

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

        Args:
            user_id (int): ID користувача

        Returns:
            dict: Структура рефералів користувача
        """
        try:
            # Валідація user_id
            if not user_id:
                logger.error(f"get_referral_structure: Передано порожній user_id")
                return {
                    'success': False,
                    'error': 'Invalid user ID',
                    'details': 'User ID cannot be empty'
                }

            # Конвертуємо ID в рядок для уніформності
            user_id_str = str(user_id)

            try:
                # Отримання рефералів 1-го рівня
                level1_referrals = supabase.table("referrals").select("*").eq("referrer_id", user_id_str).eq("level",
                                                                                                             1).execute()
                logger.debug(
                    f"get_referral_structure: Знайдено {len(level1_referrals.data)} рефералів 1-го рівня для {user_id_str}")

                # Отримання рефералів 2-го рівня
                level2_referrals = supabase.table("referrals").select("*").eq("referrer_id", user_id_str).eq("level",
                                                                                                             2).execute()
                logger.debug(
                    f"get_referral_structure: Знайдено {len(level2_referrals.data)} рефералів 2-го рівня для {user_id_str}")

                # Підрахунок активних рефералів на основі реальних даних з таблиці активності
                active_referrals = ReferralController._count_active_referrals(level1_referrals.data,
                                                                              level2_referrals.data)
                total_referrals = len(level1_referrals.data) + len(level2_referrals.data)

                # Розрахунок конверсії
                conversion_rate = 0
                if total_referrals > 0:
                    conversion_rate = active_referrals / total_referrals

                # Формування відповіді для фронтенду у форматі, який очікує клієнт
                return {
                    'success': True,
                    'user_id': user_id_str,
                    'referrals': {
                        'level1': [ReferralController._format_referral_data(ref) for ref in level1_referrals.data],
                        'level2': [ReferralController._format_referral_data(ref, with_referrer_id=True) for ref in
                                   level2_referrals.data]
                    },
                    'statistics': {
                        'totalReferrals': total_referrals,
                        'level1Count': len(level1_referrals.data),
                        'level2Count': len(level2_referrals.data),
                        'activeReferrals': active_referrals,
                        'inactiveReferrals': total_referrals - active_referrals,
                        'conversionRate': conversion_rate
                    }
                }
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
    def _format_referral_data(referral, with_referrer_id=False):
        """
        Форматує дані про реферала у формат, який очікує фронтенд

        Args:
            referral (dict): Об'єкт реферала
            with_referrer_id (bool): Чи додавати referrerId до відповіді (для 2-го рівня)

        Returns:
            dict: Відформатовані дані про реферала
        """
        try:
            # Отримуємо реальні дані активності для цього реферала
            activity = supabase.table("referral_activities").select("*").eq("user_id", referral['referee_id']).execute()

            is_active = False
            if activity.data:
                activity_data = activity.data[0]
                # Перевіряємо активність на основі критеріїв
                min_draws = 3
                min_invites = 1
                is_inactive_by_time = False

                if activity_data.get('last_updated'):
                    last_updated = datetime.fromisoformat(activity_data['last_updated'].replace('Z', '+00:00'))
                    is_inactive_by_time = last_updated < (datetime.utcnow() - timedelta(days=7))

                # Уніфікована логіка активності
                meets_draws_criteria = activity_data.get('draws_participation', 0) >= min_draws
                meets_invited_criteria = activity_data.get('invited_referrals', 0) >= min_invites

                is_active = (
                        activity_data.get('is_active', False) and
                        (meets_draws_criteria or meets_invited_criteria) and
                        not is_inactive_by_time
                )

            # Завжди використовуємо формат, який очікує фронтенд
            result = {
                'id': f'WX{referral["referee_id"]}',  # Завжди додаємо префікс WX для фронтенду
                'rawId': str(referral['referee_id']),  # Зберігаємо "сирий" ID для зручності бекенда
                'registrationDate': referral['created_at'],  # Стандартний ISO формат для всіх дат
                'active': is_active
            }

            if with_referrer_id:
                # Знаходимо реферера 1-го рівня для цього реферала 2-го рівня
                try:
                    first_level_ref = supabase.table("referrals").select("*").eq(
                        "referee_id", referral['referee_id']
                    ).eq("level", 1).execute()

                    if first_level_ref.data:
                        result['referrerId'] = f'WX{first_level_ref.data[0]["referrer_id"]}'  # Додаємо префікс WX
                        result['rawReferrerId'] = str(
                            first_level_ref.data[0]['referrer_id'])  # Додаємо "сирий" ID реферера
                    else:
                        logger.warning(
                            f"_format_referral_data: Не знайдено реферера 1-го рівня для {referral['referee_id']}")
                except Exception as e:
                    logger.error(f"_format_referral_data: Помилка пошуку реферера 1-го рівня: {str(e)}")

            return result
        except Exception as e:
            logger.error(
                f"_format_referral_data: Помилка форматування даних реферала {referral.get('id', 'unknown')}: {str(e)}")
            # Повертаємо базову інформацію, щоб не втратити дані повністю
            return {
                'id': f'WX{referral["referee_id"]}',
                'rawId': str(referral['referee_id']),
                'registrationDate': referral.get('created_at', datetime.utcnow().isoformat()),
                'active': False,
                'error': f"Помилка форматування: {str(e)}"
            }

    @staticmethod
    def _count_active_referrals(level1_referrals, level2_referrals):
        """
        Підраховує кількість активних рефералів на основі реальних даних

        Args:
            level1_referrals (list): Список рефералів 1-го рівня
            level2_referrals (list): Список рефералів 2-го рівня

        Returns:
            int: Кількість активних рефералів
        """
        try:
            # Збираємо всі ID рефералів
            referral_ids = [ref['referee_id'] for ref in level1_referrals + level2_referrals]

            if not referral_ids:
                return 0

            # Отримуємо активності для всіх рефералів одним запитом
            activities = supabase.table("referral_activities").select("*").in_("user_id", referral_ids).execute()

            active_count = 0
            one_week_ago = datetime.utcnow() - timedelta(days=7)
            min_draws = 3
            min_invites = 1

            for activity in activities.data:
                # Перевіряємо всі критерії активності
                if not activity.get('is_active', False):
                    continue

                # Перевіряємо час останньої активності
                if activity.get('last_updated'):
                    last_updated = datetime.fromisoformat(activity['last_updated'].replace('Z', '+00:00'))
                    if last_updated < one_week_ago:
                        continue

                # Перевіряємо критерії активності
                meets_draws = activity.get('draws_participation', 0) >= min_draws
                meets_invites = activity.get('invited_referrals', 0) >= min_invites

                if meets_draws or meets_invites:
                    active_count += 1

            return active_count
        except Exception as e:
            logger.error(f"_count_active_referrals: Помилка підрахунку активних рефералів: {str(e)}")
            return 0

    @staticmethod
    def _calculate_conversion_rate(active_referrals, total_referrals):
        """
        Розраховує конверсію (відсоток активних рефералів)

        Args:
            active_referrals (int): Кількість активних рефералів
            total_referrals (int): Загальна кількість рефералів

        Returns:
            float: Конверсія від 0 до 1
        """
        try:
            if total_referrals == 0:
                return 0

            return active_referrals / total_referrals
        except Exception as e:
            logger.error(f"_calculate_conversion_rate: Помилка розрахунку конверсії: {str(e)}")
            return 0