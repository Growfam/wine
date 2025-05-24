"""
Контролери для API верифікації завдань
Flask endpoints для системи верифікації WINIX
"""

import logging
import json
from datetime import datetime, timezone
from flask import request, jsonify
from functools import wraps
from typing import Dict, Any, Optional

try:
    from .verification_service import verification_service
    from .telegram_service import telegram_service
except ImportError:
    try:
        from verification_service import verification_service
        from telegram_service import telegram_service
    except ImportError:
        verification_service = None
        telegram_service = None

try:
    from supabase_client import get_user, update_user
except ImportError:
    try:
        from backend.supabase_client import get_user, update_user
    except ImportError:
        get_user = None
        update_user = None

# Налаштування логування
logger = logging.getLogger(__name__)


def validate_user_id(f):
    """Декоратор для валідації user_id"""

    @wraps(f)
    def decorated_function(*args, **kwargs):
        user_id = kwargs.get('user_id') or request.view_args.get('user_id')

        if not user_id:
            return jsonify({
                'success': False,
                'error': 'user_id обов\'язковий',
                'code': 'MISSING_USER_ID'
            }), 400

        # Перевіряємо чи користувач існує
        if get_user:
            user = get_user(str(user_id))
            if not user:
                return jsonify({
                    'success': False,
                    'error': 'Користувач не знайдений',
                    'code': 'USER_NOT_FOUND'
                }), 404

        return f(*args, **kwargs)

    return decorated_function


def handle_verification_errors(f):
    """Декоратор для обробки помилок верифікації"""

    @wraps(f)
    def decorated_function(*args, **kwargs):
        try:
            return f(*args, **kwargs)
        except Exception as e:
            logger.error(f"❌ Помилка в {f.__name__}: {str(e)}")
            return jsonify({
                'success': False,
                'error': str(e),
                'code': 'VERIFICATION_ERROR'
            }), 500

    return decorated_function


@validate_user_id
@handle_verification_errors
def verify_telegram_subscription(user_id: str):
    """
    POST /api/verify/telegram/:user_id
    Верифікація Telegram підписки
    """
    logger.info(f"📱 Запит верифікації Telegram підписки для користувача {user_id}")

    if not telegram_service:
        return jsonify({
            'success': False,
            'error': 'Telegram сервіс недоступний',
            'code': 'TELEGRAM_SERVICE_UNAVAILABLE'
        }), 503

    try:
        data = request.get_json() or {}
        channel_username = data.get('channel_username', '')

        if not channel_username:
            return jsonify({
                'success': False,
                'error': 'channel_username обов\'язковий',
                'code': 'MISSING_CHANNEL'
            }), 400

        # Перевіряємо підписку
        result = telegram_service.check_channel_subscription_sync(user_id, channel_username)

        if result.get('subscribed', False):
            logger.info(f"✅ Користувач {user_id} підписаний на {channel_username}")

            # Можна тут нарахувати винагороду або зберегти результат
            return jsonify({
                'success': True,
                'verified': True,
                'channel': channel_username,
                'status': result.get('status'),
                'message': f'Підписка на {channel_username} підтверджена'
            })
        else:
            logger.info(f"❌ Користувач {user_id} не підписаний на {channel_username}")

            return jsonify({
                'success': False,
                'verified': False,
                'channel': channel_username,
                'error': result.get('error', 'Підписка не підтверджена'),
                'message': f'Підпишіться на {channel_username} та спробуйте знову'
            })

    except Exception as e:
        logger.error(f"❌ Помилка верифікації Telegram підписки: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e),
            'code': 'TELEGRAM_VERIFICATION_ERROR'
        }), 500


@validate_user_id
@handle_verification_errors
def check_bot_started(user_id: str):
    """
    GET /api/verify/check-bot/:user_id
    Перевірка запуску бота
    """
    logger.info(f"🤖 Перевірка запуску бота для користувача {user_id}")

    if not telegram_service:
        return jsonify({
            'success': False,
            'error': 'Telegram сервіс недоступний',
            'code': 'TELEGRAM_SERVICE_UNAVAILABLE'
        }), 503

    try:
        bot_started = telegram_service.check_bot_started_sync(user_id)

        if bot_started:
            logger.info(f"✅ Бот запущено користувачем {user_id}")
            return jsonify({
                'success': True,
                'bot_started': True,
                'message': 'Бот успішно запущено'
            })
        else:
            logger.info(f"❌ Бот не запущено користувачем {user_id}")
            return jsonify({
                'success': False,
                'bot_started': False,
                'message': 'Спочатку запустіть бота'
            })

    except Exception as e:
        logger.error(f"❌ Помилка перевірки бота: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e),
            'code': 'BOT_CHECK_ERROR'
        }), 500


@validate_user_id
@handle_verification_errors
def verify_social_task(user_id: str, platform: str):
    """
    POST /api/verify/social/:user_id/:platform
    Верифікація соціальних завдань
    """
    logger.info(f"🌐 Запит верифікації соціального завдання {platform} для користувача {user_id}")

    if not verification_service:
        return jsonify({
            'success': False,
            'error': 'Сервіс верифікації недоступний',
            'code': 'VERIFICATION_SERVICE_UNAVAILABLE'
        }), 503

    try:
        data = request.get_json() or {}
        task_id = data.get('task_id', '')
        task_data = data.get('task_data', {})

        if not task_id:
            return jsonify({
                'success': False,
                'error': 'task_id обов\'язковий',
                'code': 'MISSING_TASK_ID'
            }), 400

        # Визначаємо тип завдання на основі платформи
        platform_task_types = {
            'youtube': 'youtube_subscribe',
            'twitter': 'twitter_follow',
            'discord': 'discord_join',
            'telegram': 'telegram_subscribe'
        }

        task_type = platform_task_types.get(platform.lower())
        if not task_type:
            return jsonify({
                'success': False,
                'error': f'Невідома платформа: {platform}',
                'code': 'UNKNOWN_PLATFORM'
            }), 400

        # Запускаємо верифікацію
        result = verification_service.start_task_verification(
            user_id=user_id,
            task_id=task_id,
            task_type=task_type,
            task_data=task_data
        )

        if result['success']:
            return jsonify(result)
        else:
            return jsonify(result), 400

    except Exception as e:
        logger.error(f"❌ Помилка верифікації соціального завдання: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e),
            'code': 'SOCIAL_VERIFICATION_ERROR'
        }), 500


@validate_user_id
@handle_verification_errors
def start_task_verification(user_id: str, task_id: str):
    """
    POST /api/verify/start/:user_id/:task_id
    Початок верифікації завдання
    """
    logger.info(f"🚀 Початок верифікації завдання {task_id} для користувача {user_id}")

    if not verification_service:
        return jsonify({
            'success': False,
            'error': 'Сервіс верифікації недоступний',
            'code': 'VERIFICATION_SERVICE_UNAVAILABLE'
        }), 503

    try:
        data = request.get_json() or {}
        task_type = data.get('task_type', '')
        task_data = data.get('task_data', {})

        if not task_type:
            return jsonify({
                'success': False,
                'error': 'task_type обов\'язковий',
                'code': 'MISSING_TASK_TYPE'
            }), 400

        # Запускаємо верифікацію
        result = verification_service.start_task_verification(
            user_id=user_id,
            task_id=task_id,
            task_type=task_type,
            task_data=task_data
        )

        return jsonify(result)

    except Exception as e:
        logger.error(f"❌ Помилка початку верифікації: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e),
            'code': 'START_VERIFICATION_ERROR'
        }), 500


@validate_user_id
@handle_verification_errors
def check_verification_status(user_id: str, task_id: str):
    """
    GET /api/verify/status/:user_id/:task_id
    Перевірка статусу верифікації
    """
    logger.info(f"📊 Перевірка статусу верифікації завдання {task_id} для користувача {user_id}")

    if not verification_service:
        return jsonify({
            'success': False,
            'error': 'Сервіс верифікації недоступний',
            'code': 'VERIFICATION_SERVICE_UNAVAILABLE'
        }), 503

    try:
        result = verification_service.check_verification_status(user_id, task_id)
        return jsonify(result)

    except Exception as e:
        logger.error(f"❌ Помилка перевірки статусу: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e),
            'code': 'STATUS_CHECK_ERROR'
        }), 500


@validate_user_id
@handle_verification_errors
def complete_verification(user_id: str, task_id: str):
    """
    POST /api/verify/complete/:user_id/:task_id
    Завершення верифікації завдання
    """
    logger.info(f"✅ Завершення верифікації завдання {task_id} для користувача {user_id}")

    if not verification_service:
        return jsonify({
            'success': False,
            'error': 'Сервіс верифікації недоступний',
            'code': 'VERIFICATION_SERVICE_UNAVAILABLE'
        }), 503

    try:
        result = verification_service.complete_verification(user_id, task_id)

        if result['success']:
            return jsonify(result)
        else:
            status_code = 400
            if 'remaining_time' in result:
                status_code = 425  # Too Early
            elif 'attempts_left' in result:
                status_code = 409  # Conflict

            return jsonify(result), status_code

    except Exception as e:
        logger.error(f"❌ Помилка завершення верифікації: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e),
            'code': 'COMPLETE_VERIFICATION_ERROR'
        }), 500


@handle_verification_errors
def get_verification_statistics():
    """
    GET /api/verify/statistics
    Статистика системи верифікації
    """
    logger.info("📈 Запит статистики верифікації")

    if not verification_service:
        return jsonify({
            'success': False,
            'error': 'Сервіс верифікації недоступний',
            'code': 'VERIFICATION_SERVICE_UNAVAILABLE'
        }), 503

    try:
        stats = verification_service.get_verification_statistics()

        # Додаємо інформацію про Telegram бота
        bot_info = None
        if telegram_service:
            bot_info = telegram_service.get_bot_info_sync()

        return jsonify({
            'success': True,
            'statistics': stats,
            'bot_info': bot_info,
            'timestamp': datetime.now(timezone.utc).isoformat()
        })

    except Exception as e:
        logger.error(f"❌ Помилка отримання статистики: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e),
            'code': 'STATISTICS_ERROR'
        }), 500


@handle_verification_errors
def cleanup_expired_verifications():
    """
    POST /api/verify/cleanup
    Очищення застарілих верифікацій
    """
    logger.info("🧹 Запит очищення застарілих верифікацій")

    if not verification_service:
        return jsonify({
            'success': False,
            'error': 'Сервіс верифікації недоступний',
            'code': 'VERIFICATION_SERVICE_UNAVAILABLE'
        }), 503

    try:
        verification_service.cleanup_expired_verifications()

        return jsonify({
            'success': True,
            'message': 'Застарілі верифікації очищено',
            'timestamp': datetime.now(timezone.utc).isoformat()
        })

    except Exception as e:
        logger.error(f"❌ Помилка очищення: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e),
            'code': 'CLEANUP_ERROR'
        }), 500


def get_telegram_bot_info():
    """
    GET /api/verify/bot-info
    Інформація про Telegram бота
    """
    logger.info("ℹ️ Запит інформації про бота")

    if not telegram_service:
        return jsonify({
            'success': False,
            'error': 'Telegram сервіс недоступний',
            'code': 'TELEGRAM_SERVICE_UNAVAILABLE'
        }), 503

    try:
        bot_info = telegram_service.get_bot_info_sync()

        if bot_info:
            return jsonify({
                'success': True,
                'bot_info': bot_info,
                'bot_username': telegram_service.bot_username,
                'available': True
            })
        else:
            return jsonify({
                'success': False,
                'error': 'Не вдалося отримати інформацію про бота',
                'available': False
            })

    except Exception as e:
        logger.error(f"❌ Помилка отримання інформації про бота: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e),
            'code': 'BOT_INFO_ERROR'
        }), 500


# Допоміжні функції для роботи з завданнями
@validate_user_id
@handle_verification_errors
def get_user_completed_tasks(user_id: str):
    """
    GET /api/verify/completed/:user_id
    Отримання списку виконаних завдань користувача
    """
    logger.info(f"📋 Запит виконаних завдань для користувача {user_id}")

    try:
        # Імпортуємо supabase для запиту
        try:
            from supabase_client import supabase
        except ImportError:
            from backend.supabase_client import supabase

        if not supabase:
            return jsonify({
                'success': False,
                'error': 'База даних недоступна',
                'code': 'DATABASE_UNAVAILABLE'
            }), 503

        # Отримуємо виконані завдання
        result = supabase.table('completed_tasks').select('*').eq('user_id', user_id).execute()

        completed_tasks = []
        for task in result.data:
            completed_tasks.append({
                'task_id': task['task_id'],
                'task_type': task['task_type'],
                'completed_at': task['completed_at'],
                'reward': json.loads(task.get('reward', '{}'))
            })

        return jsonify({
            'success': True,
            'completed_tasks': completed_tasks,
            'total_count': len(completed_tasks)
        })

    except Exception as e:
        logger.error(f"❌ Помилка отримання виконаних завдань: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e),
            'code': 'COMPLETED_TASKS_ERROR'
        }), 500


@validate_user_id
@handle_verification_errors
def check_task_completion(user_id: str, task_id: str):
    """
    GET /api/verify/check/:user_id/:task_id
    Перевірка чи завдання виконано
    """
    logger.info(f"🔍 Перевірка виконання завдання {task_id} для користувача {user_id}")

    try:
        # Імпортуємо supabase для запиту
        try:
            from supabase_client import supabase
        except ImportError:
            from backend.supabase_client import supabase

        if not supabase:
            return jsonify({
                'success': False,
                'error': 'База даних недоступна',
                'code': 'DATABASE_UNAVAILABLE'
            }), 503

        # Перевіряємо чи завдання виконано
        result = supabase.table('completed_tasks').select('*').eq('user_id', user_id).eq('task_id', task_id).execute()

        is_completed = len(result.data) > 0

        response_data = {
            'success': True,
            'task_id': task_id,
            'user_id': user_id,
            'is_completed': is_completed
        }

        if is_completed:
            task_data = result.data[0]
            response_data.update({
                'completed_at': task_data['completed_at'],
                'reward': json.loads(task_data.get('reward', '{}'))
            })

        return jsonify(response_data)

    except Exception as e:
        logger.error(f"❌ Помилка перевірки завдання: {str(e)}")
        return jsonify({
            'success': False,
            'error': str(e),
            'code': 'TASK_CHECK_ERROR'
        }), 500


# Функції для експорту
__all__ = [
    'verify_telegram_subscription',
    'check_bot_started',
    'verify_social_task',
    'start_task_verification',
    'check_verification_status',
    'complete_verification',
    'get_verification_statistics',
    'cleanup_expired_verifications',
    'get_telegram_bot_info',
    'get_user_completed_tasks',
    'check_task_completion'
]