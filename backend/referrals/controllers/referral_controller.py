from models.referral import Referral
from database import db
from flask import current_app
from sqlalchemy.exc import SQLAlchemyError
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

            # Конвертуємо ID в рядок, якщо потрібно
            user_id = str(user_id)

            # Новий формат посилання: https://t.me/WINIX_Official_bot?start={user_id}
            referral_link = f"https://t.me/WINIX_Official_bot?start={user_id}"
            logger.info(f"generate_referral_link: Згенеровано посилання для користувача {user_id}: {referral_link}")

            return {
                'success': True,
                'user_id': user_id,
                'referral_link': referral_link
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

            # Конвертуємо ID в цілі числа, якщо вони були передані як рядки
            if isinstance(referrer_id, str):
                try:
                    referrer_id = int(referrer_id)
                except ValueError:
                    logger.warning(
                        f"register_referral: Не вдалося конвертувати referrer_id '{referrer_id}' до int. Використовуємо як є.")

            if isinstance(referee_id, str):
                try:
                    referee_id = int(referee_id)
                except ValueError:
                    logger.warning(
                        f"register_referral: Не вдалося конвертувати referee_id '{referee_id}' до int. Використовуємо як є.")

            # Перевірка, чи реферал вже зареєстрований
            existing_referral = Referral.query.filter_by(referee_id=referee_id).first()
            if existing_referral:
                logger.warning(f"register_referral: Користувач {referee_id} вже зареєстрований як реферал "
                               f"для користувача {existing_referral.referrer_id}")
                return {
                    'success': False,
                    'error': 'User is already registered as a referral',
                    'details': f'Referee ID {referee_id} is already linked to referrer ID {existing_referral.referrer_id}'
                }

            # Перевірка, що користувач не реєструє себе як реферала
            if referrer_id == referee_id:
                logger.error(f"register_referral: Спроба зареєструвати себе як реферала. ID: {referrer_id}")
                return {
                    'success': False,
                    'error': 'User cannot refer themselves',
                    'details': 'Referrer ID and referee ID must be different'
                }

            # Використовуємо транзакцію для атомарності операцій
            try:
                # Створення запису про прямого реферала (1-й рівень)
                new_referral = Referral(referrer_id=referrer_id, referee_id=referee_id, level=1)
                db.session.add(new_referral)

                # Знаходимо реферера для поточного реферера (якщо є), щоб створити зв'язок 2-го рівня
                higher_referral = Referral.query.filter_by(referee_id=referrer_id).first()
                if higher_referral:
                    # Створення запису про реферала 2-го рівня
                    second_level_referral = Referral(
                        referrer_id=higher_referral.referrer_id,
                        referee_id=referee_id,
                        level=2
                    )
                    db.session.add(second_level_referral)
                    logger.info(
                        f"register_referral: Створено реферальний зв'язок 2-го рівня: {higher_referral.referrer_id} -> {referee_id}")

                db.session.commit()
                logger.info(
                    f"register_referral: Успішно створено реферальний зв'язок між {referrer_id} та {referee_id}")

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

            # Конвертуємо ID в ціле число, якщо воно було передано як рядок
            if isinstance(user_id, str):
                try:
                    user_id = int(user_id)
                except ValueError:
                    logger.warning(
                        f"get_referral_structure: Не вдалося конвертувати user_id '{user_id}' до int. Використовуємо як є.")

            try:
                # Отримання рефералів 1-го рівня
                level1_referrals = Referral.query.filter_by(referrer_id=user_id, level=1).all()
                logger.debug(
                    f"get_referral_structure: Знайдено {len(level1_referrals)} рефералів 1-го рівня для {user_id}")

                # Отримання рефералів 2-го рівня
                level2_referrals = Referral.query.filter_by(referrer_id=user_id, level=2).all()
                logger.debug(
                    f"get_referral_structure: Знайдено {len(level2_referrals)} рефералів 2-го рівня для {user_id}")

                # Підрахунок активних рефералів
                active_referrals = ReferralController._count_active_referrals(level1_referrals, level2_referrals)
                total_referrals = len(level1_referrals) + len(level2_referrals)

                # Формування відповіді для фронтенду
                return {
                    'success': True,
                    'user': {
                        'id': user_id,
                        'registrationDate': '2024-01-15T10:30:00Z'  # У реальному додатку беремо з БД
                    },
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
                        'conversionRate': ReferralController._calculate_conversion_rate(level1_referrals,
                                                                                        level2_referrals)
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
            # У реальній системі ці дані будуть братися з бази даних або інших моделей
            is_active = (referral.referee_id % 2 == 1)  # Для прикладу: непарні ID активні

            result = {
                'id': f'WX{referral.referee_id}',
                'rawId': str(referral.referee_id),  # Додаємо "сирий" ID для зручності бекенда
                'registrationDate': referral.created_at.isoformat(),
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
                        result['referrerId'] = f'WX{first_level_ref.referrer_id}'
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
                'error': f"Помилка форматування: {str(e)}"
            }

    @staticmethod
    def _count_active_referrals(level1_referrals, level2_referrals):
        """
        Підраховує кількість активних рефералів

        Args:
            level1_referrals (list): Список рефералів 1-го рівня
            level2_referrals (list): Список рефералів 2-го рівня

        Returns:
            int: Кількість активних рефералів
        """
        try:
            # У реальній системі активність визначатиметься за даними з бази або іншої моделі
            active_level1 = sum(1 for ref in level1_referrals if ref.referee_id % 2 == 1)
            active_level2 = sum(1 for ref in level2_referrals if ref.referee_id % 2 == 1)

            return active_level1 + active_level2
        except Exception as e:
            logger.error(f"_count_active_referrals: Помилка підрахунку активних рефералів: {str(e)}")
            # Повертаємо 0, якщо виникла помилка
            return 0

    @staticmethod
    def _calculate_conversion_rate(level1_referrals, level2_referrals):
        """
        Розраховує конверсію (відсоток активних рефералів)

        Args:
            level1_referrals (list): Список рефералів 1-го рівня
            level2_referrals (list): Список рефералів 2-го рівня

        Returns:
            float: Конверсія від 0 до 1
        """
        try:
            total = len(level1_referrals) + len(level2_referrals)
            if total == 0:
                return 0

            active = ReferralController._count_active_referrals(level1_referrals, level2_referrals)
            return active / total
        except Exception as e:
            logger.error(f"_calculate_conversion_rate: Помилка розрахунку конверсії: {str(e)}")
            # Повертаємо 0, якщо виникла помилка
            return 0