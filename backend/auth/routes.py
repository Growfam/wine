from flask import request, jsonify
import logging
import jwt
from datetime import datetime, timezone, timedelta
from . import controllers

# Налаштування логування
logging.basicConfig(level=logging.INFO,
                    format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Змінено імпорт для правильної роботи в Docker/Railway
from settings.config import JWT_SECRET, JWT_ALGORITHM


def register_auth_routes(app):
    @app.route('/api/auth', methods=['POST'])
    def auth_user():
        """Авторизація користувача"""
        try:
            data = request.json
            logger.info(f"auth_user: Отримано запит на авторизацію: {data}")

            # Додаткова інформація для діагностики
            logger.info(f"auth_user: HTTP Headers: {dict(request.headers)}")

            user = controllers.verify_user(data)
            logger.info(f"auth_user: Результат verify_user: {user}")

            if user:
                from datetime import datetime, timezone

                # Визначаємо, чи це новий користувач (для відображення вітального повідомлення)
                is_new_user = False
                if user.get('created_at'):
                    try:
                        created_at = datetime.fromisoformat(user['created_at'].replace('Z', '+00:00'))
                        is_new_user = (datetime.now(timezone.utc) - created_at).total_seconds() < 60
                    except (ValueError, TypeError):
                        # Обробка помилок парсингу дати
                        logger.warning(f"Помилка при визначенні часу створення користувача")

                return jsonify({
                    'status': 'success',
                    'data': {
                        'telegram_id': user.get('telegram_id'),
                        'username': user.get('username'),
                        'balance': user.get('balance', 0),
                        'coins': user.get('coins', 0),
                        'is_new_user': is_new_user
                    }
                })
            else:
                logger.error("auth_user: Помилка авторизації - verify_user повернув None")
                return jsonify({
                    'status': 'error',
                    'message': 'Помилка авторизації користувача'
                }), 401
        except Exception as e:
            logger.error(f"auth_user: Помилка в /api/auth: {str(e)}", exc_info=True)
            return jsonify({
                'status': 'error',
                'message': str(e)
            }), 500

    @app.route('/api/auth/refresh-token', methods=['POST'])
    def refresh_token():
        """Оновлення JWT токену авторизації"""
        try:
            # Перевіряємо наявність токена в заголовках
            auth_header = request.headers.get("Authorization")
            if not auth_header or not auth_header.startswith("Bearer "):
                # Спробуємо отримати токен з тіла запиту
                data = request.json or {}
                if 'token' in data and data['token']:
                    token = data['token']
                    logger.info("refresh_token: Отримано токен з тіла запиту")
                else:
                    logger.warning("refresh_token: Відсутній токен у заголовку та тілі запиту")
                    return jsonify({
                        "status": "error",
                        "message": "Необхідний токен авторизації"
                    }), 401
            else:
                # Отримуємо токен з заголовка
                token = auth_header.split(" ")[1]

            # Додаткова перевірка формату токена
            if not token or len(token) < 10:
                logger.warning("refresh_token: Токен надто короткий або відсутній")
                return jsonify({
                    "status": "error",
                    "message": "Недійсний формат токена"
                }), 401

            try:
                # Спробуємо декодувати токен для отримання ID користувача
                try:
                    payload = jwt.decode(token, JWT_SECRET, algorithms=[JWT_ALGORITHM])
                except jwt.PyJWTError as jwt_error:
                    logger.warning(f"refresh_token: Помилка декодування JWT: {str(jwt_error)}")
                    return jsonify({
                        "status": "error",
                        "message": "Невалідний токен авторизації: " + str(jwt_error)
                    }), 401

                user_id = payload.get("user_id")

                if not user_id:
                    logger.warning("refresh_token: Невалідний токен (user_id відсутній)")
                    return jsonify({
                        "status": "error",
                        "message": "Невалідний токен (відсутній ID користувача)"
                    }), 401

                # Перевіряємо наявність користувача через controllers
                if controllers.get_user_data(user_id) is None:
                    logger.warning(f"refresh_token: Користувача {user_id} не знайдено через controllers")

                    # Спробуємо отримати користувача з Supabase напряму
                    try:
                        from supabase_client import get_user
                        supabase_user = get_user(user_id)
                        if not supabase_user:
                            logger.warning(f"refresh_token: Користувача {user_id} також не знайдено в Supabase")
                            return jsonify({
                                "status": "error",
                                "message": "Користувача не знайдено"
                            }), 404

                        logger.info(f"refresh_token: Користувача {user_id} знайдено в Supabase")
                    except Exception as supabase_error:
                        logger.error(f"refresh_token: Помилка пошуку в Supabase: {str(supabase_error)}")
                        return jsonify({
                            "status": "error",
                            "message": "Користувача не знайдено"
                        }), 404

                # Якщо ми дійшли сюди, користувач існує (через controllers або Supabase)
                # Створюємо новий токен з оновленим терміном дії
                expiration = datetime.now(timezone.utc) + timedelta(days=7)

                # Додаємо додаткові дані в токен для безпеки
                token_data = {
                    "user_id": user_id,
                    "exp": expiration,
                    "iat": datetime.now(timezone.utc),
                    "type": "access"
                }

                try:
                    new_token = jwt.encode(token_data, JWT_SECRET, algorithm=JWT_ALGORITHM)
                except Exception as encode_error:
                    logger.error(f"refresh_token: Помилка кодування токена: {str(encode_error)}")
                    return jsonify({
                        "status": "error",
                        "message": "Помилка генерації нового токена"
                    }), 500

                logger.info(f"refresh_token: Токен успішно оновлено для {user_id}")
                return jsonify({
                    "status": "success",
                    "token": new_token,
                    "expires_at": expiration.isoformat()
                })
            except jwt.ExpiredSignatureError:
                logger.warning("refresh_token: Токен протерміновано")
                return jsonify({
                    "status": "error",
                    "message": "Термін дії токена минув, потрібна повторна авторизація"
                }), 401
            except jwt.InvalidTokenError:
                logger.warning("refresh_token: Невалідний токен")
                return jsonify({
                    "status": "error",
                    "message": "Недійсний токен авторизації"
                }), 401
        except Exception as e:
            logger.error(f"refresh_token: Помилка: {str(e)}", exc_info=True)
            return jsonify({
                "status": "error",
                "message": "Помилка сервера при оновленні токену",
                "details": str(e)
            }), 500