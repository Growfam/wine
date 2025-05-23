from supabase_client import supabase
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


class DataInitializer:
    """Клас для ініціалізації відсутніх даних в системі"""

    @staticmethod
    def initialize_user_data(user_id):
        """Ініціалізує всі необхідні дані для користувача"""
        user_id_str = str(user_id)
        logger.info(f"Ініціалізація даних для користувача {user_id_str}")

        results = {
            'activities_created': 0,
            'badges_checked': False,
            'tasks_initialized': False,
            'errors': []
        }

        try:
            # 1. Ініціалізуємо активності для всіх рефералів
            referrals = supabase.table("referrals").select("*").eq("referrer_id", user_id_str).execute()

            for referral in referrals.data:
                referee_id = referral['referee_id']

                # Перевіряємо, чи існує запис активності
                existing = supabase.table("referral_activities").select("*").eq("user_id", referee_id).execute()

                if not existing.data:
                    # Створюємо новий запис
                    new_activity = {
                        "user_id": referee_id,
                        "draws_participation": 0,
                        "invited_referrals": 0,
                        "is_active": False,
                        "last_updated": datetime.utcnow().isoformat()
                    }

                    try:
                        supabase.table("referral_activities").insert(new_activity).execute()
                        results['activities_created'] += 1
                        logger.info(f"Створено запис активності для реферала {referee_id}")
                    except Exception as e:
                        logger.error(f"Помилка створення активності для {referee_id}: {str(e)}")
                        results['errors'].append(f"Activity for {referee_id}: {str(e)}")

            # 2. Ініціалізуємо бейджі
            try:
                from badges.controllers.badge_controller import BadgeController
                badge_result = BadgeController.check_badges(user_id)
                results['badges_checked'] = badge_result.get('success', False)
                logger.info(f"Перевірка бейджів: {badge_result}")
            except Exception as e:
                logger.error(f"Помилка перевірки бейджів: {str(e)}")
                results['errors'].append(f"Badges: {str(e)}")

            # 3. Ініціалізуємо завдання
            try:
                from badges.controllers.task_controller import TaskController
                task_result = TaskController.init_user_tasks(user_id)
                results['tasks_initialized'] = task_result.get('success', False)
                logger.info(f"Ініціалізація завдань: {task_result}")
            except Exception as e:
                logger.error(f"Помилка ініціалізації завдань: {str(e)}")
                results['errors'].append(f"Tasks: {str(e)}")

            # 4. Оновлюємо кількість запрошених для referrer
            referrer_count = len(referrals.data)
            referrer_activity = supabase.table("referral_activities").select("*").eq("user_id", user_id_str).execute()

            if not referrer_activity.data:
                # Створюємо запис для самого referrer
                new_activity = {
                    "user_id": user_id_str,
                    "draws_participation": 0,
                    "invited_referrals": referrer_count,
                    "is_active": referrer_count >= 1,
                    "reason_for_activity": "invited_criteria" if referrer_count >= 1 else None,
                    "last_updated": datetime.utcnow().isoformat()
                }
                supabase.table("referral_activities").insert(new_activity).execute()
                logger.info(f"Створено запис активності для referrer {user_id_str}")
            else:
                # Оновлюємо існуючий запис
                update_data = {
                    "invited_referrals": referrer_count,
                    "is_active": referrer_count >= 1 or referrer_activity.data[0].get('draws_participation', 0) >= 3,
                    "last_updated": datetime.utcnow().isoformat()
                }
                if referrer_count >= 1:
                    update_data["reason_for_activity"] = "invited_criteria"

                supabase.table("referral_activities").update(update_data).eq("user_id", user_id_str).execute()
                logger.info(f"Оновлено запис активності для referrer {user_id_str}")

            return {
                'success': True,
                'user_id': user_id_str,
                'results': results
            }

        except Exception as e:
            logger.error(f"Критична помилка ініціалізації: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'results': results
            }

    @staticmethod
    def fix_all_users():
        """Виправляє дані для всіх користувачів в системі"""
        try:
            # Отримуємо всіх унікальних referrer'ів
            referrers = supabase.table("referrals").select("referrer_id").execute()
            unique_referrers = list(set([r['referrer_id'] for r in referrers.data]))

            logger.info(f"Знайдено {len(unique_referrers)} унікальних referrer'ів")

            results = []
            for referrer_id in unique_referrers:
                result = DataInitializer.initialize_user_data(referrer_id)
                results.append(result)

            successful = sum(1 for r in results if r.get('success', False))

            return {
                'success': True,
                'total_users': len(unique_referrers),
                'successful': successful,
                'failed': len(unique_referrers) - successful,
                'details': results
            }

        except Exception as e:
            logger.error(f"Помилка виправлення даних: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }