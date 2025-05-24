"""
Контролер авторизації для системи завдань WINIX
Обробка Telegram WebApp авторизації та JWT токенів
"""

import logging
from datetime import datetime, timezone
from typing import Dict, Any, Optional
from flask import request, jsonify

from ..utils.validators import validate_telegram_webapp_data, ValidationResult
from ..utils.decorators import generate_jwt_token, decode_jwt_token, AuthError
from ..models.user_quest import UserQuest, create_new_user

# Імпорт функцій роботи з БД
try:
    from supabase_client import get_user, create_user, update_user
except ImportError:
    try:
        from backend.supabase_client import get_user, create_user, update_user
    except ImportError:
        # Fallback для тестування
        def get_user(telegram_id):
            return None


        def create_user(telegram_id, username, referrer_id=None):
            return None


        def update_user(telegram_id, data):
            return None

logger = logging.getLogger(__name__)


class AuthController:
    """Контролер авторизації"""

    @staticmethod
    def validate_telegram_auth(init_data: str, timestamp: Optional[int] = None) -> Dict[str, Any]:
        """
        Валідація Telegram WebApp даних

        Args:
            init_data: initData з Telegram WebApp
            timestamp: Опціональний timestamp запиту

        Returns:
            Dict з результатом валідації
        """
        try:
            logger.info("=== ПОЧАТОК ВАЛІДАЦІЇ TELEGRAM AUTH ===")
            logger.info(f"Отримано init_data довжиною: {len(init_data) if init_data else 0}")

            if not init_data:
                logger.error("init_data пустий")
                return {
                    "valid": False,
                    "error": "init_data відсутній",
                    "code": "missing_init_data"
                }

            # Валідуємо Telegram дані
            validation_result = validate_telegram_webapp_data(init_data)

            if not validation_result.valid:
                logger.error(f"Валідація не пройдена: {validation_result.error}")
                return {
                    "valid": False,
                    "error": validation_result.error,
                    "code": "validation_failed"
                }

            user_data = validation_result.data.get('user')
            if not user_data:
                logger.error("Дані користувача відсутні після валідації")
                return {
                    "valid": False,
                    "error": "Дані користувача відсутні",
                    "code": "no_user_data"
                }

            logger.info(f"Валідація пройдена для користувача {user_data.get('id')}")

            # Отримуємо або створюємо користувача в БД
            try:
                db_user = AuthController._get_or_create_user(user_data)
                if not db_user:
                    logger.error("Не вдалося створити або отримати користувача з БД")
                    return {
                        "valid": False,
                        "error": "Помилка роботи з базою даних",
                        "code": "database_error"
                    }

                # Генеруємо JWT токен
                token = generate_jwt_token({
                    'telegram_id': user_data['id'],
                    'username': user_data.get('username', ''),
                    'first_name': user_data.get('first_name', ''),
                    'last_name': user_data.get('last_name', '')
                })

                logger.info(f"JWT токен згенеровано для користувача {user_data['id']}")

                # Формуємо відповідь
                response_data = {
                    "valid": True,
                    "user": {
                        "id": db_user.get('id') or user_data['id'],
                        "telegram_id": user_data['id'],
                        "username": user_data.get('username', ''),
                        "first_name": user_data.get('first_name', ''),
                        "last_name": user_data.get('last_name', ''),
                        "language_code": user_data.get('language_code', 'uk'),
                        "balance": {
                            "winix": float(db_user.get('balance', 0)),
                            "tickets": int(db_user.get('coins', 0)),
                            "flex": 0  # FLEX баланс рахується окремо
                        }
                    },
                    "token": token,
                    "expires_in": 86400  # 24 години
                }

                logger.info("=== ВАЛІДАЦІЯ TELEGRAM AUTH ЗАВЕРШЕНА УСПІШНО ===")
                return response_data

            except Exception as db_error:
                logger.error(f"Помилка роботи з БД: {db_error}", exc_info=True)
                return {
                    "valid": False,
                    "error": "Помилка бази даних",
                    "code": "database_error"
                }

        except Exception as e:
            logger.error(f"Неочікувана помилка валідації: {e}", exc_info=True)
            return {
                "valid": False,
                "error": "Внутрішня помилка сервера",
                "code": "internal_error"
            }

    @staticmethod
    def _get_or_create_user(telegram_user_data: Dict[str, Any]) -> Optional[Dict[str, Any]]:
        """
        Отримання або створення користувача в БД

        Args:
            telegram_user_data: Дані користувача з Telegram

        Returns:
            Дані користувача з БД або None
        """
        try:
            telegram_id = telegram_user_data['id']
            username = telegram_user_data.get('username', '')
            first_name = telegram_user_data.get('first_name', '')
            last_name = telegram_user_data.get('last_name', '')

            logger.info(f"Пошук користувача в БД: {telegram_id}")

            # Спробуємо знайти існуючого користувача
            existing_user = get_user(str(telegram_id))

            if existing_user:
                logger.info(f"Користувач знайдений в БД: {telegram_id}")

                # Оновимо дані користувача якщо вони змінились
                update_data = {}
                if username and existing_user.get('username') != username:
                    update_data['username'] = username
                if first_name and existing_user.get('first_name') != first_name:
                    update_data['first_name'] = first_name
                if last_name and existing_user.get('last_name') != last_name:
                    update_data['last_name'] = last_name

                # Оновлюємо час останньої активності
                update_data['updated_at'] = datetime.now(timezone.utc).isoformat()

                if update_data:
                    logger.info(f"Оновлення даних користувача {telegram_id}: {list(update_data.keys())}")
                    updated_user = update_user(str(telegram_id), update_data)
                    return updated_user if updated_user else existing_user

                return existing_user

            else:
                logger.info(f"Створення нового користувача: {telegram_id}")

                # Створюємо нового користувача
                # Можемо отримати referrer_id з start_param якщо є
                referrer_id = None  # TODO: отримати з start_param якщо потрібно

                new_user = create_user(
                    telegram_id=str(telegram_id),
                    username=username or f"user_{telegram_id}",
                    referrer_id=referrer_id
                )

                if new_user:
                    logger.info(f"Новий користувач створений: {telegram_id}")
                    return new_user
                else:
                    logger.error(f"Не вдалося створити користувача: {telegram_id}")
                    return None

        except Exception as e:
            logger.error(f"Помилка отримання/створення користувача: {e}", exc_info=True)
            return None

    @staticmethod
    def refresh_token(current_token: str) -> Dict[str, Any]:
        """
        Оновлення JWT токену

        Args:
            current_token: Поточний JWT токен

        Returns:
            Dict з новим токеном або помилкою
        """
        try:
            logger.info("=== ОНОВЛЕННЯ JWT ТОКЕНУ ===")

            if not current_token:
                logger.error("Токен для оновлення відсутній")
                return {
                    "success": False,
                    "error": "Токен відсутній",
                    "code": "missing_token"
                }

            # Декодуємо поточний токен (навіть якщо він застарів)
            try:
                # Спочатку спробуємо декодувати без перевірки терміну дії
                import jwt
                from ..utils.decorators import JWT_SECRET, JWT_ALGORITHM

                payload = jwt.decode(
                    current_token,
                    JWT_SECRET,
                    algorithms=[JWT_ALGORITHM],
                    options={"verify_exp": False}  # Не перевіряємо термін дії
                )

                user_id = payload.get('user_id')
                username = payload.get('username')

                if not user_id:
                    logger.error("user_id відсутній в токені")
                    return {
                        "success": False,
                        "error": "Невірний токен",
                        "code": "invalid_token"
                    }

                # Перевіряємо чи користувач ще існує в БД
                user = get_user(str(user_id))
                if not user:
                    logger.error(f"Користувач {user_id} не знайдений в БД")
                    return {
                        "success": False,
                        "error": "Користувач не знайдений",
                        "code": "user_not_found"
                    }

                # Генеруємо новий токен
                new_token = generate_jwt_token({
                    'telegram_id': user_id,
                    'username': username,
                    'first_name': user.get('first_name', ''),
                    'last_name': user.get('last_name', '')
                })

                logger.info(f"Новий токен згенеровано для користувача {user_id}")

                return {
                    "success": True,
                    "token": new_token,
                    "expires_in": 86400,
                    "user": {
                        "telegram_id": user_id,
                        "username": username
                    }
                }

            except jwt.InvalidTokenError as e:
                logger.error(f"Невірний токен для оновлення: {e}")
                return {
                    "success": False,
                    "error": "Невірний токен",
                    "code": "invalid_token"
                }

        except Exception as e:
            logger.error(f"Помилка оновлення токену: {e}", exc_info=True)
            return {
                "success": False,
                "error": "Внутрішня помилка сервера",
                "code": "internal_error"
            }

    @staticmethod
    def validate_token(token: str) -> Dict[str, Any]:
        """
        Валідація JWT токену

        Args:
            token: JWT токен для валідації

        Returns:
            Dict з результатом валідації
        """
        try:
            if not token:
                return {
                    "valid": False,
                    "error": "Токен відсутній",
                    "code": "missing_token"
                }

            # Декодуємо токен
            payload = decode_jwt_token(token)

            user_id = payload.get('user_id')
            if not user_id:
                return {
                    "valid": False,
                    "error": "Невірний токен",
                    "code": "invalid_token"
                }

            # Перевіряємо користувача в БД
            user = get_user(str(user_id))
            if not user:
                return {
                    "valid": False,
                    "error": "Користувач не знайдений",
                    "code": "user_not_found"
                }

            return {
                "valid": True,
                "user": {
                    "telegram_id": user_id,
                    "username": payload.get('username'),
                    "token_exp": payload.get('exp'),
                    "token_iat": payload.get('iat')
                }
            }

        except AuthError as e:
            return {
                "valid": False,
                "error": e.message,
                "code": "auth_error"
            }
        except Exception as e:
            logger.error(f"Помилка валідації токену: {e}", exc_info=True)
            return {
                "valid": False,
                "error": "Помилка валідації",
                "code": "validation_error"
            }

    @staticmethod
    def logout_user(token: str) -> Dict[str, Any]:
        """
        Вихід користувача (додавання токену в чорний список)

        Args:
            token: JWT токен користувача

        Returns:
            Dict з результатом операції
        """
        try:
            # TODO: Реалізувати чорний список токенів в Redis або БД
            # Поки що просто повертаємо успіх
            logger.info("Користувач вийшов з системи")

            return {
                "success": True,
                "message": "Успішний вихід"
            }

        except Exception as e:
            logger.error(f"Помилка виходу: {e}", exc_info=True)
            return {
                "success": False,
                "error": "Помилка виходу",
                "code": "logout_error"
            }


# Функції-обгортки для роутів
def validate_telegram_route():
    """Роут для валідації Telegram даних"""
    try:
        data = request.get_json()
        if not data:
            return jsonify({
                "valid": False,
                "error": "JSON дані відсутні",
                "code": "missing_json"
            }), 400

        init_data = data.get('initData')
        timestamp = data.get('timestamp')

        if not init_data:
            return jsonify({
                "valid": False,
                "error": "initData відсутній",
                "code": "missing_init_data"
            }), 400

        result = AuthController.validate_telegram_auth(init_data, timestamp)

        if result.get('valid'):
            return jsonify(result), 200
        else:
            return jsonify(result), 401

    except Exception as e:
        logger.error(f"Помилка в validate_telegram_route: {e}", exc_info=True)
        return jsonify({
            "valid": False,
            "error": "Внутрішня помилка сервера",
            "code": "internal_error"
        }), 500


def refresh_token_route():
    """Роут для оновлення токену"""
    try:
        # Отримуємо токен з заголовків
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            current_token = auth_header[7:]
        else:
            # Спробуємо з JSON
            data = request.get_json() or {}
            current_token = data.get('token')

        if not current_token:
            return jsonify({
                "success": False,
                "error": "Токен для оновлення відсутній",
                "code": "missing_token"
            }), 400

        result = AuthController.refresh_token(current_token)

        if result.get('success'):
            return jsonify(result), 200
        else:
            return jsonify(result), 401

    except Exception as e:
        logger.error(f"Помилка в refresh_token_route: {e}", exc_info=True)
        return jsonify({
            "success": False,
            "error": "Внутрішня помилка сервера",
            "code": "internal_error"
        }), 500


def validate_token_route():
    """Роут для валідації токену"""
    try:
        # Отримуємо токен
        auth_header = request.headers.get('Authorization')
        if auth_header and auth_header.startswith('Bearer '):
            token = auth_header[7:]
        else:
            data = request.get_json() or {}
            token = data.get('token')

        if not token:
            return jsonify({
                "valid": False,
                "error": "Токен відсутній",
                "code": "missing_token"
            }), 400

        result = AuthController.validate_token(token)

        if result.get('valid'):
            return jsonify(result), 200
        else:
            return jsonify(result), 401

    except Exception as e:
        logger.error(f"Помилка в validate_token_route: {e}", exc_info=True)
        return jsonify({
            "valid": False,
            "error": "Внутрішня помилка сервера",
            "code": "internal_error"
        }), 500


# Експорт
__all__ = [
    'AuthController',
    'validate_telegram_route',
    'refresh_token_route',
    'validate_token_route'
]