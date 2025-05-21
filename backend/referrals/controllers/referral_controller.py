from models.referral import Referral
from models.activity import ReferralActivity
from database import db
from flask import current_app
from sqlalchemy.exc import SQLAlchemyError
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

        Args:
            user_id (int): ID користувача

        Returns:
            dict: Словник з реферальним посиланням
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
            user_id_str = str(user_id)

            # Новий формат посилання: https://t.me/WINIX_Official_bot?start={user_id}
            referral_link = f"https://t.me/WINIX_Official_bot?start={user_id_str}"
            logger.info(f"generate_referral_link: Згенеровано посилання для користувача {user_id_str}: {referral_link}")

            # Повертаємо уніформну відповідь для фронтенду
            return {
                'success': True,
                'user_id': user_id_str,
                'referral_link': referral_link,
                'link': referral_link  # Додаємо поле 'link' для сумісності зі старим кодом
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

            # Перевірка, чи реферал вже зареєстрований (правило: користувач може бути рефералом тільки одного користувача)
            existing_referral = Referral.query.filter_by(referee_id=referee_id_str, level=1).first()
            if existing_referral:
                logger.warning(f"register_referral: Користувач {referee_id_str} вже зареєстрований як реферал "
                               f"для користувача {existing_referral.referrer_id}")
                return {
                    'success': False,
                    'error': 'User is already registered as a referral',
                    'details': f'Referee ID {referee_id_str} is already linked to referrer ID {existing_referral.referrer_id}'
                }

            # Перевірка, що користувач не реєструє себе як реферала
            if referrer_id_str == referee_id_str:
                logger.error(f"register_referral: Спроба зареєструвати себе як реферала. ID: {referrer_id_str}")
                return {
                    'success': False,
                    'error': 'User cannot refer themselves',
                    'details': 'Referrer ID and referee ID must be different'
                }

            # Використовуємо транзакцію для атомарності операцій
            try:
                # Створення запису про прямого реферала (1-й рівень)
                new_referral = Referral(referrer_id=referrer_id_str, referee_id=referee_id_str, level=1)
                db.session.add(new_referral)

                # Оновлюємо кількість запрошених для активності реферера
                referrer_activity = ReferralActivity.query.filter_by(user_id=referrer_id_str).first()
                if referrer_activity:
                    referrer_activity.invited_referrals += 1
                    # Перевіряємо активність на основі нових даних
                    referrer_activity.check_activity(min_draws=3, min_invites=1)
                else:
                    # Створюємо запис активності, якщо його не існує
                    referrer_activity = ReferralActivity(
                        user_id=referrer_id_str,
                        invited_referrals=1
                    )
                    # Перевіряємо активність
                    referrer_activity.check_activity(min_draws=3, min_invites=1)
                    db.session.add(referrer_activity)

                # Створюємо запис активності для нового реферала
                referee_activity = ReferralActivity(
                    user_id=referee_id_str,
                    invited_referrals=0,
                    draws_participation=0
                )
                db.session.add(referee_activity)

                # Знаходимо реферера для поточного реферера (якщо є), щоб створити зв'язок 2-го рівня
                higher_referral = Referral.query.filter_by(referee_id=referrer_id_str, level=1).first()
                if higher_referral and higher_referral.referrer_id != referee_id_str:  # Перевірка, щоб уникнути циклічних посилань
                    # Перевіряємо, чи вже існує такий зв'язок 2-го рівня
                    existing_lvl2 = Referral.query.filter_by(
                        referrer_id=higher_referral.referrer_id,
                        referee_id=referee_id_str,
                        level=2
                    ).first()

                    # Якщо зв'язок 2-го рівня ще не існує, створюємо його
                    if not existing_lvl2:
                        second_level_referral = Referral(
                            referrer_id=higher_referral.referrer_id,
                            referee_id=referee_id_str,
                            level=2
                        )
                        db.session.add(second_level_referral)
                        logger.info(
                            f"register_referral: Створено реферальний зв'язок 2-го рівня: {higher_referral.referrer_id} -> {referee_id_str}")

                # Зберігаємо всі зміни
                db.session.commit()
                logger.info(
                    f"register_referral: Успішно створено реферальний зв'язок між {referrer_id_str} та {referee_id_str}")

                return {
                    'success': True,
                    'message': 'Referral successfully registered',
                    'referral': new_referral.to_dict()
                }
            except SQLAlchemyError as e:
                db.session.rollback()
                error_details = traceback.format_exc()
                logger.error(f"register_referral: Помилка в транзакції: {str(e)}\n{error_details}")
                return {
                    'success': False,
                    'error': 'Database error during referral registration',
                    'details': str(e)
                }

        except SQLAlchemyError as e:
            db.session.rollback()
            error_details = traceback.format_exc()
            logger.error(f"Database error during referral registration: {str(e)}\n{error_details}")
            return {
                'success': False,
                'error': 'Database error during referral registration',
                'details': str(e)
            }
        except Exception as e:
            db.session.rollback()
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
                level1_referrals = Referral.query.filter_by(referrer_id=user_id_str, level=1).all()
                logger.debug(
                    f"get_referral_structure: Знайдено {len(level1_referrals)} рефералів 1-го рівня для {user_id_str}")

                # Отримання рефералів 2-го рівня
                level2_referrals = Referral.query.filter_by(referrer_id=user_id_str, level=2).all()
                logger.debug(
                    f"get_referral_structure: Знайдено {len(level2_referrals)} рефералів 2-го рівня для {user_id_str}")

                # Підрахунок активних рефералів на основі реальних даних з таблиці активності
                active_referrals = ReferralController._count_active_referrals(level1_referrals, level2_referrals)
                total_referrals = len(level1_referrals) + len(level2_referrals)

                # Розрахунок конверсії
                conversion_rate = 0
                if total_referrals > 0:
                    conversion_rate = active_referrals / total_referrals

                # Формування відповіді для фронтенду у форматі, який очікує клієнт
                return {
                    'success': True,
                    'user_id': user_id_str,  # Використовуємо формат, який очікує фронтенд
                    'referrals': {
                        'level1': [ReferralController._format_referral_data(ref) for ref in level1_referrals],
                        'level2': [ReferralController._format_referral_data(ref, with_referrer_id=True) for ref in
                                   level2_referrals]
                    },
                    'statistics': {
                        'totalReferrals': total_referrals,
                        'level1Count': len(level1_referrals),
                        'level2Count': len(level2_referrals),
                        'activeReferrals': active_referrals,
                        'inactiveReferrals': total_referrals - active_referrals,
                        'conversionRate': conversion_rate
                    }
                }
            except SQLAlchemyError as e:
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
            referral (Referral): Об'єкт реферала
            with_referrer_id (bool): Чи додавати referrerId до відповіді (для 2-го рівня)

        Returns:
            dict: Відформатовані дані про реферала
        """
        try:
            # Отримуємо реальні дані активності для цього реферала
            activity = ReferralActivity.query.filter_by(user_id=referral.referee_id).first()

            is_active = False
            if activity:
                # Перевіряємо активність на основі критеріїв
                # Критерій 1: Має мінімум 3 участі в розіграшах
                # Критерій 2: Запросив мінімум 1 реферала
                # Критерій 3: Заходив у додаток протягом останнього тижня
                min_draws = 3
                min_invites = 1
                is_inactive_by_time = False

                if activity.last_updated:
                    is_inactive_by_time = activity.last_updated < (datetime.utcnow() - timedelta(days=7))

                # Уніфікована логіка активності
                meets_draws_criteria = activity.draws_participation >= min_draws
                meets_invited_criteria = activity.invited_referrals >= min_invites

                is_active = (
                        activity.is_active and
                        (meets_draws_criteria or meets_invited_criteria) and
                        not is_inactive_by_time
                )

            # Завжди використовуємо формат, який очікує фронтенд
            result = {
                'id': f'WX{referral.referee_id}',  # Завжди додаємо префікс WX для фронтенду
                'rawId': str(referral.referee_id),  # Зберігаємо "сирий" ID для зручності бекенда
                'registrationDate': referral.created_at.isoformat(),  # Стандартний ISO формат для всіх дат
                'active': is_active
            }

            if with_referrer_id:
                # Знаходимо реферера 1-го рівня для цього реферала 2-го рівня
                try:
                    first_level_ref = Referral.query.filter_by(
                        referee_id=referral.referee_id,
                        level=1
                    ).first()

                    if first_level_ref:
                        result['referrerId'] = f'WX{first_level_ref.referrer_id}'  # Додаємо префікс WX
                        result['rawReferrerId'] = str(first_level_ref.referrer_id)  # Додаємо "сирий" ID реферера
                    else:
                        logger.warning(
                            f"_format_referral_data: Не знайдено реферера 1-го рівня для {referral.referee_id}")
                except Exception as e:
                    logger.error(f"_format_referral_data: Помилка пошуку реферера 1-го рівня: {str(e)}")

            return result
        except Exception as e:
            logger.error(f"_format_referral_data: Помилка форматування даних реферала {referral.id}: {str(e)}")
            # Повертаємо базову інформацію, щоб не втратити дані повністю
            return {
                'id': f'WX{referral.referee_id}',
                'rawId': str(referral.referee_id),
                'registrationDate': referral.created_at.isoformat() if hasattr(referral,
                                                                               'created_at') else datetime.utcnow().isoformat(),
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
            referral_ids = [ref.referee_id for ref in level1_referrals + level2_referrals]

            if not referral_ids:
                return 0

            # Оптимізація: при порожньому списку зразу повертаємо 0
            if not referral_ids:
                return 0

            # Запит до таблиці активності для пошуку активних рефералів
            one_week_ago = datetime.utcnow() - timedelta(days=7)

            # Критерії активності:
            # 1. Маркер is_active = True
            # 2. Був активний протягом останнього тижня
            # 3. Має достатньо участей у розіграшах або запрошених рефералів
            min_draws = 3
            min_invites = 1

            active_count = ReferralActivity.query.filter(
                ReferralActivity.user_id.in_(referral_ids),
                ReferralActivity.is_active == True,
                ReferralActivity.last_updated > one_week_ago,
                # Додаємо умову для критеріїв активності
                ((ReferralActivity.draws_participation >= min_draws) |
                 (ReferralActivity.invited_referrals >= min_invites))
            ).count()

            return active_count
        except Exception as e:
            logger.error(f"_count_active_referrals: Помилка підрахунку активних рефералів: {str(e)}")
            # Повертаємо 0, якщо виникла помилка
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
            # Повертаємо 0, якщо виникла помилка
            return 0