"""
Маршрути для автентифікації користувачів.
Включає функціонал авторизації та оновлення JWT токенів.
"""

from flask import request, jsonify, g
import logging
import jwt
import traceback
from datetime import datetime, timezone, timedelta
from . import controllers

# Налаштування логування
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("auth_routes")

# Імпортуємо змінні конфігурації
try:
    from backend.settings.config import JWT_SECRET, JWT_ALGORITHM
except ImportError:
    from settings.config import JWT_SECRET, JWT_ALGORITHM

# Константи
TOKEN_VALIDITY_DAYS = 7
REFRESH_TOKEN_VALIDITY_DAYS = 30
DEBUG_MODE = True  # Встановіть False для продакшену


def extract_token_from_request():
    """Отримує токен з різних джерел у запиті"""
    # Спочатку перевіряємо заголовок Authorization
    auth_header = request.headers.get("Authorization")
    if auth_header and auth_header.startswith("Bearer "):
        return auth_header.split(" ")[1]

    # Перевіряємо тіло запиту
    data = request.get_json(silent=True) or {}
    if 'token' in data and data['token']:
        return data['token']

    return None


def extract_user_id_from_request():
    """Отримує Telegram ID користувача з різних джерел у запиті"""
    # Перевіряємо заголовок X-Telegram-User-Id
    header_id = request.headers.get('X-Telegram-User-Id')
    if header_id:
        return str(header_id)

    # Перевіряємо тіло запиту
    data = request.get_json(silent=True) or {}
    if 'telegram_id' in data and data['telegram_id']:
        return str(data['telegram_id'])
    if 'id' in data and data['id']:
        return str(data['id'])

    return None


def create_jwt_token(user_id, expiration_days=TOKEN_VALIDITY_DAYS, token_type="access"):
    """Створює новий JWT токен"""
    try:
        expiration = datetime.now(timezone.utc) + timedelta(days=expiration_days)

        token_data = {
            "user_id": str(user_id),
            "exp": expiration,
            "iat": datetime.now(timezone.utc),
            "type": token_type
        }

        token = jwt.encode(token_data, JWT_SECRET, algorithm=JWT_ALGORITHM)

        return {
            "token": token,
            "expires_at": expiration.isoformat()
        }
    except Exception as e:
        logger.error(f"Помилка створення JWT токена: {str(e)}")
        return None


def register_auth_routes(app):
    """Реєстрація маршрутів автентифікації"""

    @app.route('/api/auth', methods=['POST'])
    def auth_user():
        """Автентифікація користувача через Telegram дані"""
        start_time = datetime.now()
        request_id = f"auth_{int(start_time.timestamp())}"

        try:
            data = request.json or {}
            client_ip = request.remote_addr
            user_agent = request.headers.get('User-Agent', 'Unknown')

            logger.info(f"[{request_id}] Запит автентифікації від {client_ip} ({user_agent[:30]}...)")

            if DEBUG_MODE:
                logger.debug(f"[{request_id}] Заголовки: {dict(request.headers)}")
                logger.debug(f"[{request_id}] Тіло запиту: {data}")

            # Отримуємо користувача
            user = controllers.verify_user(data)

            if not user:
                logger.warning(f"[{request_id}] Помилка верифікації користувача")
                return jsonify({
                    'status': 'error',
                    'message': 'Помилка автентифікації користувача',
                    'request_id': request_id
                }), 401

            # Створюємо JWT токен
            token_result = create_jwt_token(user.get('telegram_id'))
            if not token_result:
                logger.error(f"[{request_id}] Помилка створення токена")
                return jsonify({
                    'status': 'error',
                    'message': 'Помилка створення токена автентифікації',
                    'request_id': request_id
                }), 500

            # Визначаємо, чи це новий користувач
            is_new_user = False
            if user.get('created_at'):
                try:
                    created_at = datetime.fromisoformat(user['created_at'].replace('Z', '+00:00'))
                    is_new_user = (datetime.now(timezone.utc) - created_at).total_seconds() < 60
                except (ValueError, TypeError):
                    logger.warning(f"[{request_id}] Помилка при визначенні часу створення користувача")

            # Формуємо відповідь
            response = {
                'status': 'success',
                'token': token_result['token'],
                'expires_at': token_result['expires_at'],
                'data': {
                    'telegram_id': user.get('telegram_id'),
                    'username': user.get('username'),
                    'balance': user.get('balance', 0),
                    'coins': user.get('coins', 0),
                    'is_new_user': is_new_user
                },
                'request_id': request_id
            }

            # Логування часу виконання
            execution_time = (datetime.now() - start_time).total_seconds()
            logger.info(
                f"[{request_id}] Успішна автентифікація користувача {user.get('telegram_id')} за {execution_time:.4f}с")

            return jsonify(response)
        except Exception as e:
            # Детальне логування помилки
            logger.error(f"[{request_id}] Критична помилка в auth_user: {str(e)}")
            if DEBUG_MODE:
                logger.error(traceback.format_exc())

            return jsonify({
                'status': 'error',
                'message': f"Внутрішня помилка сервера: {str(e) if DEBUG_MODE else 'Зверніться до адміністратора'}",
                'request_id': request_id
            }), 500

    @app.route('/api/auth/refresh-token', methods=['POST'])
    def refresh_token():
        """Оновлення JWT токену автентифікації"""
        start_time = datetime.now()
        request_id = f"refresh_{int(start_time.timestamp())}"

        try:
            client_ip = request.remote_addr
            user_agent = request.headers.get('User-Agent', 'Unknown')

            logger.info(f"[{request_id}] Запит оновлення токена від {client_ip} ({user_agent[:30]}...)")

            # Отримуємо дані з різних джерел
            request_data = request.get_json(silent=True) or {}

            if DEBUG_MODE:
                logger.debug(f"[{request_id}] Заголовки: {dict(request.headers)}")
                logger.debug(f"[{request_id}] Тіло запиту: {request_data}")

            # Отримуємо ID користувача
            user_id = extract_user_id_from_request()

            if not user_id:
                logger.warning(f"[{request_id}] ID користувача не знайдено у запиті")
                return jsonify({
                    "status": "error",
                    "message": "ID користувача не знайдено у запиті",
                    "request_id": request_id
                }), 400

            # Перевіримо існування користувача
            user = controllers.get_user_data(user_id)

            if not user:
                logger.warning(f"[{request_id}] Користувача {user_id} не знайдено")

                # Спробуємо отримати користувача напряму з Supabase
                try:
                    from supabase_client import get_user
                    supabase_user = get_user(user_id)
                    if not supabase_user:
                        logger.warning(f"[{request_id}] Користувача {user_id} також не знайдено в Supabase")
                        return jsonify({
                            "status": "error",
                            "message": "Користувача не знайдено",
                            "request_id": request_id
                        }), 404

                    user = supabase_user
                    logger.info(f"[{request_id}] Користувача {user_id} знайдено в Supabase")
                except Exception as e:
                    logger.error(f"[{request_id}] Помилка пошуку в Supabase: {str(e)}")
                    return jsonify({
                        "status": "error",
                        "message": "Не вдалося отримати дані користувача",
                        "request_id": request_id
                    }), 500

            # Отримуємо поточний токен
            token = extract_token_from_request()

            # Якщо токен відсутній, створюємо новий
            if not token:
                logger.info(f"[{request_id}] Токен відсутній, створюємо новий для {user_id}")
                token_result = create_jwt_token(user_id)

                if not token_result:
                    return jsonify({
                        "status": "error",
                        "message": "Помилка створення нового токена",
                        "request_id": request_id
                    }), 500

                # Логування часу виконання
                execution_time = (datetime.now() - start_time).total_seconds()
                logger.info(f"[{request_id}] Створено новий токен для {user_id} за {execution_time:.4f}с")

                return jsonify({
                    "status": "success",
                    "token": token_result["token"],
                    "expires_at": token_result["expires_at"],
                    "message": "Новий токен створено",
                    "request_id": request_id
                })

            # Перевіряємо чи валідний токен
            try:
                logger.debug(f"[{request_id}] Спроба декодування токена для {user_id}")
                payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])

                token_user_id = payload.get("user_id")

                # Перевіряємо, чи ID в токені відповідає запитаному ID
                if token_user_id != user_id:
                    logger.warning(
                        f"[{request_id}] ID в токені ({token_user_id}) не відповідає запитаному ID ({user_id})")
                    # Все одно дозволяємо оновлення, але користуватися буде ID з токена
                    user_id = token_user_id

                    # Повторно перевіряємо існування користувача
                    user = controllers.get_user_data(user_id)
                    if not user:
                        return jsonify({
                            "status": "error",
                            "message": "Користувача з ID в токені не знайдено",
                            "request_id": request_id
                        }), 404
            except jwt.ExpiredSignatureError:
                logger.info(f"[{request_id}] Токен протерміновано для {user_id}")
                # Створюємо новий токен, оскільки ми вже перевірили існування користувача
                token_result = create_jwt_token(user_id)

                if not token_result:
                    return jsonify({
                        "status": "error",
                        "message": "Помилка створення нового токена після закінчення терміну дії",
                        "request_id": request_id
                    }), 500

                return jsonify({
                    "status": "success",
                    "token": token_result["token"],
                    "expires_at": token_result["expires_at"],
                    "message": "Термін дії токена минув, створено новий",
                    "request_id": request_id
                })
            except jwt.InvalidTokenError as e:
                logger.warning(f"[{request_id}] Невалідний токен для {user_id}: {str(e)}")
                # Створюємо новий токен, оскільки поточний недійсний
                token_result = create_jwt_token(user_id)

                if not token_result:
                    return jsonify({
                        "status": "error",
                        "message": "Помилка створення нового токена після виявлення недійсного",
                        "request_id": request_id
                    }), 500

                return jsonify({
                    "status": "success",
                    "token": token_result["token"],
                    "expires_at": token_result["expires_at"],
                    "message": "Недійсний токен, створено новий",
                    "request_id": request_id
                })

            # Якщо ми дійшли сюди, токен валідний, але ми все одно створюємо новий
            logger.info(f"[{request_id}] Оновлюємо дійсний токен для {user_id}")
            token_result = create_jwt_token(user_id)

            if not token_result:
                return jsonify({
                    "status": "error",
                    "message": "Помилка оновлення токена",
                    "request_id": request_id
                }), 500

            # Логування часу виконання
            execution_time = (datetime.now() - start_time).total_seconds()
            logger.info(f"[{request_id}] Успішно оновлено токен для {user_id} за {execution_time:.4f}с")

            return jsonify({
                "status": "success",
                "token": token_result["token"],
                "expires_at": token_result["expires_at"],
                "request_id": request_id
            })
        except Exception as e:
            # Детальне логування помилки
            logger.error(f"[{request_id}] Критична помилка в refresh_token: {str(e)}")
            if DEBUG_MODE:
                logger.error(traceback.format_exc())

            return jsonify({
                "status": "error",
                "message": f"Внутрішня помилка сервера: {str(e) if DEBUG_MODE else 'Зверніться до адміністратора'}",
                "request_id": request_id
            }), 500

    # Додаємо тестовий ендпоінт для перевірки роботи автентифікації
    @app.route('/api/auth/test', methods=['GET'])
    def auth_test():
        """Тестовий ендпоінт для перевірки роботи автентифікації"""
        # Простий ендпоінт, який повертає інформацію про запит
        token = extract_token_from_request()
        user_id = extract_user_id_from_request()

        return jsonify({
            "status": "success",
            "message": "Тестовий ендпоінт автентифікації",
            "received": {
                "token": bool(token),
                "user_id": user_id,
                "headers": dict(request.headers),
                "timestamp": datetime.now().isoformat()
            }
        })