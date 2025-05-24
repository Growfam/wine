"""
Сервіс верифікації завдань WINIX
Обробка різних типів завдань та таймерів
"""

import logging
import time
import json
from datetime import datetime, timezone, timedelta
from typing import Dict, Any, Optional, List
from enum import Enum
import threading
from queue import Queue, Empty

try:
    from supabase_client import supabase, get_user, update_user
except ImportError:
    from backend.supabase_client import supabase, get_user, update_user

try:
    from .telegram_service import telegram_service
except ImportError:
    try:
        from telegram_service import telegram_service
    except ImportError:
        telegram_service = None

# Налаштування логування
logger = logging.getLogger(__name__)


class TaskType(Enum):
    """Типи завдань"""
    TELEGRAM_SUBSCRIBE = "telegram_subscribe"
    TELEGRAM_BOT_START = "telegram_bot_start"
    YOUTUBE_SUBSCRIBE = "youtube_subscribe"
    TWITTER_FOLLOW = "twitter_follow"
    DISCORD_JOIN = "discord_join"
    SOCIAL_SHARE = "social_share"
    LIMITED_TIME = "limited_time"
    PARTNER = "partner"


class VerificationStatus(Enum):
    """Статуси верифікації"""
    PENDING = "pending"
    IN_PROGRESS = "in_progress"
    WAITING = "waiting"
    COMPLETED = "completed"
    FAILED = "failed"
    EXPIRED = "expired"


class VerificationService:
    """Основний сервіс верифікації завдань"""

    def __init__(self):
        """Ініціалізація сервісу"""
        self.verification_queue = Queue()
        self.active_verifications = {}
        self.task_timers = {}
        self.is_processing = False

        # Конфігурація таймерів (в секундах)
        self.timer_config = {
            TaskType.YOUTUBE_SUBSCRIBE: 15,  # 15 секунд
            TaskType.TWITTER_FOLLOW: 15,  # 15 секунд
            TaskType.DISCORD_JOIN: 20,  # 20 секунд
            TaskType.SOCIAL_SHARE: 10,  # 10 секунд
            TaskType.PARTNER: 30,  # 30 секунд
            TaskType.LIMITED_TIME: 5  # 5 секунд для тестових
        }

        # Максимальна кількість спроб
        self.max_retries = 3

        # Запускаємо обробник черги
        self._start_queue_processor()

        logger.info("✅ VerificationService ініціалізовано")

    def _start_queue_processor(self):
        """Запускає обробник черги верифікацій"""

        def process_queue():
            while True:
                try:
                    if not self.verification_queue.empty():
                        self._process_next_verification()
                    time.sleep(1)  # Перевірка кожну секунду
                except Exception as e:
                    logger.error(f"❌ Помилка в обробнику черги: {str(e)}")
                    time.sleep(5)  # Пауза при помилці

        thread = threading.Thread(target=process_queue, daemon=True)
        thread.start()
        logger.info("🔄 Обробник черги верифікацій запущено")

    def start_task_verification(self, user_id: str, task_id: str, task_type: str,
                                task_data: Dict[str, Any]) -> Dict[str, Any]:
        """
        Починає верифікацію завдання

        Args:
            user_id: ID користувача
            task_id: ID завдання
            task_type: Тип завдання
            task_data: Дані завдання

        Returns:
            Dict з результатом початку верифікації
        """
        try:
            logger.info(f"🚀 Початок верифікації завдання {task_id} для користувача {user_id}")

            # Створюємо запис верифікації
            verification_id = f"{user_id}_{task_id}_{int(time.time())}"

            verification = {
                'id': verification_id,
                'user_id': user_id,
                'task_id': task_id,
                'task_type': task_type,
                'task_data': task_data,
                'status': VerificationStatus.IN_PROGRESS.value,
                'started_at': datetime.now(timezone.utc).isoformat(),
                'attempts': 0,
                'timer_required': self._requires_timer(task_type)
            }

            # Зберігаємо в активних верифікаціях
            self.active_verifications[verification_id] = verification

            # Зберігаємо початок завдання в БД
            self._save_task_start(user_id, task_id, task_type, task_data)

            # Визначаємо тип обробки
            if verification['timer_required']:
                return self._start_timer_verification(verification)
            else:
                return self._start_instant_verification(verification)

        except Exception as e:
            logger.error(f"❌ Помилка початку верифікації: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'message': 'Помилка початку верифікації'
            }

    def _requires_timer(self, task_type: str) -> bool:
        """Перевіряє чи потрібен таймер для типу завдання"""
        try:
            task_enum = TaskType(task_type)
            return task_enum in self.timer_config
        except ValueError:
            return False

    def _start_timer_verification(self, verification: Dict[str, Any]) -> Dict[str, Any]:
        """Запускає верифікацію з таймером"""
        task_type_enum = TaskType(verification['task_type'])
        timer_duration = self.timer_config.get(task_type_enum, 15)

        # Встановлюємо таймер
        verification['timer_end'] = (
                datetime.now(timezone.utc) + timedelta(seconds=timer_duration)
        ).isoformat()
        verification['status'] = VerificationStatus.WAITING.value

        # Зберігаємо таймер
        self.task_timers[verification['id']] = {
            'end_time': verification['timer_end'],
            'duration': timer_duration,
            'verification_id': verification['id']
        }

        logger.info(f"⏱️ Встановлено таймер {timer_duration}с для завдання {verification['task_id']}")

        return {
            'success': True,
            'verification_id': verification['id'],
            'status': 'waiting',
            'timer_duration': timer_duration,
            'timer_end': verification['timer_end'],
            'message': f'Зачекайте {timer_duration} секунд перед перевіркою'
        }

    def _start_instant_verification(self, verification: Dict[str, Any]) -> Dict[str, Any]:
        """Запускає миттєву верифікацію (Telegram)"""
        # Додаємо в чергу для обробки
        self.verification_queue.put(verification)

        logger.info(f"📥 Завдання {verification['task_id']} додано в чергу верифікації")

        return {
            'success': True,
            'verification_id': verification['id'],
            'status': 'in_progress',
            'message': 'Верифікація в процесі...'
        }

    def check_verification_status(self, user_id: str, task_id: str) -> Dict[str, Any]:
        """
        Перевіряє статус верифікації завдання

        Args:
            user_id: ID користувача
            task_id: ID завдання

        Returns:
            Dict зі статусом верифікації
        """
        try:
            # Шукаємо активну верифікацію
            verification = None
            for ver_id, ver_data in self.active_verifications.items():
                if ver_data['user_id'] == user_id and ver_data['task_id'] == task_id:
                    verification = ver_data
                    break

            if not verification:
                # Перевіряємо в БД чи завдання вже виконано
                if self._is_task_completed(user_id, task_id):
                    return {
                        'success': True,
                        'status': 'completed',
                        'message': 'Завдання вже виконано'
                    }
                else:
                    return {
                        'success': False,
                        'status': 'not_found',
                        'message': 'Верифікація не знайдена'
                    }

            # Перевіряємо таймер якщо є
            if verification['status'] == VerificationStatus.WAITING.value:
                if self._check_timer_completion(verification['id']):
                    # Таймер завершено, можна перевіряти
                    verification['status'] = VerificationStatus.PENDING.value
                    self.verification_queue.put(verification)

                    return {
                        'success': True,
                        'status': 'ready_for_check',
                        'message': 'Готово до перевірки'
                    }
                else:
                    # Таймер ще йде
                    timer_info = self.task_timers.get(verification['id'], {})
                    end_time = datetime.fromisoformat(timer_info.get('end_time', ''))
                    remaining = (end_time - datetime.now(timezone.utc)).total_seconds()

                    return {
                        'success': True,
                        'status': 'waiting',
                        'remaining_time': max(0, int(remaining)),
                        'message': f'Залишилось {max(0, int(remaining))} секунд'
                    }

            return {
                'success': True,
                'status': verification['status'],
                'message': self._get_status_message(verification['status'])
            }

        except Exception as e:
            logger.error(f"❌ Помилка перевірки статусу: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'message': 'Помилка перевірки статусу'
            }

    def complete_verification(self, user_id: str, task_id: str) -> Dict[str, Any]:
        """
        Завершує верифікацію завдання

        Args:
            user_id: ID користувача
            task_id: ID завдання

        Returns:
            Dict з результатом завершення
        """
        try:
            logger.info(f"✅ Завершення верифікації завдання {task_id} для користувача {user_id}")

            # Знаходимо активну верифікацію
            verification = None
            verification_id = None

            for ver_id, ver_data in self.active_verifications.items():
                if ver_data['user_id'] == user_id and ver_data['task_id'] == task_id:
                    verification = ver_data
                    verification_id = ver_id
                    break

            if not verification:
                return {
                    'success': False,
                    'error': 'Активна верифікація не знайдена',
                    'message': 'Спочатку почніть виконання завдання'
                }

            # Перевіряємо чи можна завершувати
            if verification['status'] == VerificationStatus.WAITING.value:
                if not self._check_timer_completion(verification_id):
                    timer_info = self.task_timers.get(verification_id, {})
                    end_time = datetime.fromisoformat(timer_info.get('end_time', ''))
                    remaining = (end_time - datetime.now(timezone.utc)).total_seconds()

                    return {
                        'success': False,
                        'error': 'Таймер ще не завершився',
                        'remaining_time': max(0, int(remaining)),
                        'message': f'Зачекайте ще {max(0, int(remaining))} секунд'
                    }

            # Виконуємо верифікацію
            result = self._perform_verification(verification)

            if result['success']:
                # Завершуємо верифікацію
                self._complete_verification_success(verification, result)

                return {
                    'success': True,
                    'verified': True,
                    'reward': result.get('reward', {}),
                    'message': 'Завдання успішно виконано!'
                }
            else:
                # Збільшуємо кількість спроб
                verification['attempts'] += 1

                if verification['attempts'] >= self.max_retries:
                    self._complete_verification_failure(verification, result.get('error', 'Максимум спроб досягнуто'))
                    return {
                        'success': False,
                        'error': 'Максимум спроб досягнуто',
                        'message': 'Спробуйте пізніше'
                    }
                else:
                    return {
                        'success': False,
                        'error': result.get('error', 'Верифікація не пройдена'),
                        'attempts_left': self.max_retries - verification['attempts'],
                        'message': result.get('message', 'Спробуйте ще раз')
                    }

        except Exception as e:
            logger.error(f"❌ Помилка завершення верифікації: {str(e)}")
            return {
                'success': False,
                'error': str(e),
                'message': 'Помилка завершення верифікації'
            }

    def _perform_verification(self, verification: Dict[str, Any]) -> Dict[str, Any]:
        """Виконує конкретну верифікацію в залежності від типу"""
        task_type = verification['task_type']
        task_data = verification['task_data']
        user_id = verification['user_id']

        logger.info(f"🔍 Виконання верифікації типу {task_type}")

        try:
            if task_type == TaskType.TELEGRAM_SUBSCRIBE.value:
                return self._verify_telegram_subscription(user_id, task_data)
            elif task_type == TaskType.TELEGRAM_BOT_START.value:
                return self._verify_bot_start(user_id)
            elif task_type in [TaskType.YOUTUBE_SUBSCRIBE.value, TaskType.TWITTER_FOLLOW.value,
                               TaskType.DISCORD_JOIN.value, TaskType.SOCIAL_SHARE.value]:
                return self._verify_social_task(user_id, task_type, task_data)
            else:
                return {
                    'success': False,
                    'error': f'Невідомий тип завдання: {task_type}'
                }

        except Exception as e:
            logger.error(f"❌ Помилка виконання верифікації: {str(e)}")
            return {
                'success': False,
                'error': str(e)
            }

    def _verify_telegram_subscription(self, user_id: str, task_data: Dict[str, Any]) -> Dict[str, Any]:
        """Верифікація підписки на Telegram канал"""
        if not telegram_service:
            return {
                'success': False,
                'error': 'Telegram сервіс недоступний'
            }

        channel_username = task_data.get('channel_username', '')
        if not channel_username:
            return {
                'success': False,
                'error': 'Не вказано канал для перевірки'
            }

        # Перевіряємо підписку
        result = telegram_service.check_channel_subscription_sync(user_id, channel_username)

        if result.get('subscribed', False):
            # Розраховуємо винагороду
            reward = self._calculate_reward(TaskType.TELEGRAM_SUBSCRIBE.value, task_data)

            return {
                'success': True,
                'verified': True,
                'reward': reward,
                'channel': channel_username
            }
        else:
            return {
                'success': False,
                'error': result.get('error', 'Підписка не підтверджена'),
                'message': f'Підпишіться на {channel_username} та спробуйте знову'
            }

    def _verify_bot_start(self, user_id: str) -> Dict[str, Any]:
        """Верифікація запуску бота"""
        if not telegram_service:
            return {
                'success': False,
                'error': 'Telegram сервіс недоступний'
            }

        if telegram_service.check_bot_started_sync(user_id):
            reward = self._calculate_reward(TaskType.TELEGRAM_BOT_START.value, {})

            return {
                'success': True,
                'verified': True,
                'reward': reward
            }
        else:
            return {
                'success': False,
                'error': 'Бот не запущено',
                'message': 'Спочатку запустіть бота'
            }

    def _verify_social_task(self, user_id: str, task_type: str, task_data: Dict[str, Any]) -> Dict[str, Any]:
        """Верифікація соціальних завдань (за таймером)"""
        # Для соціальних завдань ми довіряємо таймеру
        # В реальному проекті тут могла б бути інтеграція з API соцмереж

        reward = self._calculate_reward(task_type, task_data)

        return {
            'success': True,
            'verified': True,
            'reward': reward,
            'verification_method': 'timer_based'
        }

    def _calculate_reward(self, task_type: str, task_data: Dict[str, Any]) -> Dict[str, Any]:
        """Розраховує винагороду за завдання"""
        # Базові винагороди
        base_rewards = {
            TaskType.TELEGRAM_SUBSCRIBE.value: {'winix': 100, 'tickets': 1},
            TaskType.TELEGRAM_BOT_START.value: {'winix': 50, 'tickets': 0},
            TaskType.YOUTUBE_SUBSCRIBE.value: {'winix': 150, 'tickets': 1},
            TaskType.TWITTER_FOLLOW.value: {'winix': 100, 'tickets': 1},
            TaskType.DISCORD_JOIN.value: {'winix': 200, 'tickets': 2},
            TaskType.SOCIAL_SHARE.value: {'winix': 75, 'tickets': 0},
            TaskType.PARTNER.value: {'winix': 300, 'tickets': 3},
            TaskType.LIMITED_TIME.value: {'winix': 500, 'tickets': 5}
        }

        base_reward = base_rewards.get(task_type, {'winix': 50, 'tickets': 0})

        # Модифікатори з task_data
        multiplier = task_data.get('reward_multiplier', 1.0)
        bonus_winix = task_data.get('bonus_winix', 0)
        bonus_tickets = task_data.get('bonus_tickets', 0)

        final_reward = {
            'winix': int(base_reward['winix'] * multiplier) + bonus_winix,
            'tickets': int(base_reward['tickets'] * multiplier) + bonus_tickets
        }

        return final_reward

    def _complete_verification_success(self, verification: Dict[str, Any], result: Dict[str, Any]):
        """Завершує успішну верифікацію"""
        verification['status'] = VerificationStatus.COMPLETED.value
        verification['completed_at'] = datetime.now(timezone.utc).isoformat()
        verification['result'] = result

        # Нараховуємо винагороду
        reward = result.get('reward', {})
        if reward:
            self._award_reward(verification['user_id'], verification['task_id'], reward)

        # Зберігаємо в БД
        self._save_task_completion(verification)

        # Видаляємо з активних
        self._cleanup_verification(verification['id'])

        logger.info(f"✅ Верифікація {verification['task_id']} успішно завершена")

    def _complete_verification_failure(self, verification: Dict[str, Any], error: str):
        """Завершує невдалу верифікацію"""
        verification['status'] = VerificationStatus.FAILED.value
        verification['failed_at'] = datetime.now(timezone.utc).isoformat()
        verification['error'] = error

        # Видаляємо з активних
        self._cleanup_verification(verification['id'])

        logger.warning(f"❌ Верифікація {verification['task_id']} завершилась невдачею: {error}")

    def _award_reward(self, user_id: str, task_id: str, reward: Dict[str, Any]):
        """Нараховує винагороду користувачу"""
        try:
            from users.controllers import update_user_balance

            # Нараховуємо WINIX
            if reward.get('winix', 0) > 0:
                update_user_balance(user_id, {'balance': reward['winix']})
                logger.info(f"💰 Нараховано {reward['winix']} WINIX користувачу {user_id}")

            # Нараховуємо квитки (якщо є система квитків)
            if reward.get('tickets', 0) > 0:
                # В майбутньому тут буде логіка нарахування квитків
                logger.info(f"🎫 Нараховано {reward['tickets']} квитків користувачу {user_id}")

        except Exception as e:
            logger.error(f"❌ Помилка нарахування винагороди: {str(e)}")

    def _check_timer_completion(self, verification_id: str) -> bool:
        """Перевіряє чи завершився таймер"""
        timer = self.task_timers.get(verification_id)
        if not timer:
            return True

        end_time = datetime.fromisoformat(timer['end_time'])
        return datetime.now(timezone.utc) >= end_time

    def _cleanup_verification(self, verification_id: str):
        """Очищує ресурси верифікації"""
        self.active_verifications.pop(verification_id, None)
        self.task_timers.pop(verification_id, None)

    def _save_task_start(self, user_id: str, task_id: str, task_type: str, task_data: Dict[str, Any]):
        """Зберігає початок виконання завдання в БД"""
        try:
            if not supabase:
                return

            data = {
                'user_id': user_id,
                'task_id': task_id,
                'task_type': task_type,
                'task_data': json.dumps(task_data),
                'status': 'started',
                'started_at': datetime.now(timezone.utc).isoformat()
            }

            supabase.table('task_progress').insert(data).execute()

        except Exception as e:
            logger.error(f"❌ Помилка збереження початку завдання: {str(e)}")

    def _save_task_completion(self, verification: Dict[str, Any]):
        """Зберігає завершення завдання в БД"""
        try:
            if not supabase:
                return

            # Оновлюємо запис в task_progress
            supabase.table('task_progress').update({
                'status': 'completed',
                'completed_at': verification.get('completed_at'),
                'result': json.dumps(verification.get('result', {}))
            }).eq('user_id', verification['user_id']).eq('task_id', verification['task_id']).execute()

            # Створюємо запис в completed_tasks
            completion_data = {
                'user_id': verification['user_id'],
                'task_id': verification['task_id'],
                'task_type': verification['task_type'],
                'completed_at': verification.get('completed_at'),
                'reward': json.dumps(verification.get('result', {}).get('reward', {}))
            }

            supabase.table('completed_tasks').insert(completion_data).execute()

        except Exception as e:
            logger.error(f"❌ Помилка збереження завершення завдання: {str(e)}")

    def _is_task_completed(self, user_id: str, task_id: str) -> bool:
        """Перевіряє чи завдання вже виконано"""
        try:
            if not supabase:
                return False

            result = supabase.table('completed_tasks').select('id').eq('user_id', user_id).eq('task_id',
                                                                                              task_id).execute()
            return len(result.data) > 0

        except Exception as e:
            logger.error(f"❌ Помилка перевірки завершення завдання: {str(e)}")
            return False

    def _process_next_verification(self):
        """Обробляє наступну верифікацію з черги"""
        try:
            verification = self.verification_queue.get(timeout=1)

            logger.info(f"🔄 Обробка верифікації з черги: {verification['task_id']}")

            result = self._perform_verification(verification)

            if result['success']:
                self._complete_verification_success(verification, result)
            else:
                verification['attempts'] += 1
                if verification['attempts'] >= self.max_retries:
                    self._complete_verification_failure(verification, result.get('error', 'Максимум спроб'))
                else:
                    # Додаємо назад в чергу для повторної спроби
                    time.sleep(2)  # Пауза перед повторною спробою
                    self.verification_queue.put(verification)

        except Empty:
            pass  # Черга порожня
        except Exception as e:
            logger.error(f"❌ Помилка обробки черги: {str(e)}")

    def _get_status_message(self, status: str) -> str:
        """Повертає повідомлення для статусу"""
        messages = {
            VerificationStatus.PENDING.value: 'Очікує обробки',
            VerificationStatus.IN_PROGRESS.value: 'Верифікація в процесі',
            VerificationStatus.WAITING.value: 'Очікування завершення таймеру',
            VerificationStatus.COMPLETED.value: 'Завдання виконано',
            VerificationStatus.FAILED.value: 'Верифікація не пройдена',
            VerificationStatus.EXPIRED.value: 'Термін верифікації вийшов'
        }

        return messages.get(status, 'Невідомий статус')

    def get_verification_statistics(self) -> Dict[str, Any]:
        """Повертає статистику верифікацій"""
        return {
            'active_verifications': len(self.active_verifications),
            'queue_length': self.verification_queue.qsize(),
            'active_timers': len(self.task_timers),
            'timer_config': {task_type.value: duration for task_type, duration in self.timer_config.items()}
        }

    def cleanup_expired_verifications(self):
        """Очищає застарілі верифікації"""
        current_time = datetime.now(timezone.utc)
        expired_ids = []

        for ver_id, verification in self.active_verifications.items():
            started_at = datetime.fromisoformat(verification['started_at'])
            if (current_time - started_at).total_seconds() > 3600:  # 1 година
                expired_ids.append(ver_id)

        for ver_id in expired_ids:
            verification = self.active_verifications[ver_id]
            verification['status'] = VerificationStatus.EXPIRED.value
            self._cleanup_verification(ver_id)
            logger.info(f"🧹 Видалено застарілу верифікацію: {ver_id}")


# Глобальний екземпляр сервісу
verification_service = VerificationService()