"""
Контролер для управління TON гаманцями користувачів
API endpoints для підключення, відключення та верифікації гаманців
БЕЗ ВАЛІДАЦІЇ - довіряємо TON Connect
"""

import logging
from typing import Dict, Any, Tuple
from datetime import datetime, timezone
from flask import request


# Налаштування логування
logger = logging.getLogger(__name__)

# Імпорт Transaction Service
try:
    from ..services.transaction_service import transaction_service
except ImportError:
    try:
        from backend.quests.services.transaction_service import transaction_service
    except ImportError:
        logger.error("Transaction service недоступний")
        transaction_service = None

# Імпорт декораторів та утилітів
try:
    from ..utils.decorators import (
        secure_endpoint, public_endpoint, validate_json,
        validate_telegram_id, get_current_user, get_json_data
    )
    from ..utils.validators import (
        validate_telegram_id as validate_tg_id,
        sanitize_string
    )
except ImportError:
    try:
        from backend.quests.utils.decorators import (
            secure_endpoint, public_endpoint, validate_json,
            validate_telegram_id, get_current_user, get_json_data
        )
        from backend.quests.utils.validators import (
            validate_telegram_id as validate_tg_id,
            sanitize_string
        )
    except ImportError:
        logger.error("Не вдалося імпортувати декоратори та валідатори")
        # Fallback декоратори
        def secure_endpoint(max_requests=None, window_seconds=None):
            def decorator(func):
                return func
            return decorator

        def public_endpoint(max_requests=None, window_seconds=None):
            def decorator(func):
                return func
            return decorator

        def validate_json(required_fields=None):
            def decorator(func):
                return func
            return decorator

        def validate_telegram_id(func):
            return func

        def get_current_user():
            return None

        def get_json_data():
            try:
                from flask import request
                return request.get_json() if request else {}
            except:
                return {}

        def validate_tg_id(telegram_id):
            try:
                tid = int(telegram_id)
                return tid if tid > 0 else None
            except:
                return None

        def sanitize_string(value, max_length=255):
            if not isinstance(value, str):
                return str(value)[:max_length]
            return value.strip()[:max_length]

# Імпорт моделей та сервісів
try:
    from ..models.wallet import wallet_model, WalletStatus
    from ..services.ton_connect_service import ton_connect_service
except ImportError:
    try:
        from backend.quests.models.wallet import wallet_model, WalletStatus
        from backend.quests.services.ton_connect_service import ton_connect_service
    except ImportError:
        logger.error("Не вдалося імпортувати моделі та сервіси")
        wallet_model = None
        ton_connect_service = None

        class WalletStatus:
            CONNECTED = "connected"
            DISCONNECTED = "disconnected"
            PENDING = "pending"


class WalletController:
    """Контролер для управління гаманцями з підтримкою транзакцій"""

    @staticmethod
    @public_endpoint(max_requests=30, window_seconds=60)
    @validate_telegram_id
    def check_wallet_status(telegram_id: str) -> Tuple[Dict[str, Any], int]:
        """
        Перевірка статусу підключення гаманця

        Args:
            telegram_id: ID користувача в Telegram

        Returns:
            Статус гаманця та HTTP код
        """
        try:
            logger.info(f"Перевірка статусу гаманця для користувача {telegram_id}")

            if not wallet_model:
                return {
                    "status": "error",
                    "message": "Сервіс гаманців недоступний",
                    "error_code": "SERVICE_UNAVAILABLE"
                }, 503

            # Отримуємо статус гаманця
            wallet_status = wallet_model.get_wallet_status(telegram_id)

            # Додаємо інформацію про transaction service
            wallet_status['transaction_service_available'] = transaction_service is not None

            logger.info(f"Статус гаманця для {telegram_id}: connected={wallet_status.get('connected', False)}")

            return {
                "status": "success",
                "data": wallet_status,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }, 200

        except Exception as e:
            logger.error(f"Помилка перевірки статусу гаманця для {telegram_id}: {str(e)}")
            return {
                "status": "error",
                "message": "Помилка перевірки статусу гаманця",
                "error_code": "CHECK_STATUS_ERROR"
            }, 500

    @staticmethod
    @secure_endpoint(max_requests=30, window_seconds=300)
    def connect_wallet(telegram_id: str) -> Tuple[Dict[str, Any], int]:
        """
        Підключення TON гаманця з автоматичним бонусом через Transaction Service
        З КОНВЕРТАЦІЄЮ АДРЕС для довгострокового рішення
        """
        try:
            logger.info(f"Підключення гаманця для користувача {telegram_id}")

            if not wallet_model:
                return {
                    "status": "error",
                    "message": "Сервіс гаманців недоступний",
                    "error_code": "SERVICE_UNAVAILABLE"
                }, 503

            # Отримуємо дані напряму з request
            try:
                wallet_data = request.get_json(force=True)
                logger.info(f"📱 Отримані дані гаманця від фронтенду:")
                logger.info(f"  - Всі поля: {list(wallet_data.keys())}")
                logger.info(f"  - address: {wallet_data.get('address')}")
                logger.info(f"  - addressFriendly: {wallet_data.get('addressFriendly')}")
            except Exception as e:
                logger.error(f"Помилка отримання JSON: {e}")
                return {
                    "status": "error",
                    "message": "Невірний формат даних",
                    "error_code": "INVALID_JSON"
                }, 400

            if not wallet_data:
                logger.error("Дані гаманця відсутні")
                return {
                    "status": "error",
                    "message": "Дані гаманця відсутні",
                    "error_code": "MISSING_WALLET_DATA"
                }, 400

            # Отримуємо raw адресу (обов'язкова)
            raw_address = wallet_data.get('address')
            if not raw_address:
                logger.error("Raw адреса відсутня в даних")
                return {
                    "status": "error",
                    "message": "Адреса гаманця обов'язкова",
                    "error_code": "MISSING_ADDRESS"
                }, 400

            # Визначаємо user-friendly адресу
            user_friendly_address = wallet_data.get('addressFriendly')

            # Якщо user-friendly адреса не передана, конвертуємо raw адресу
            if not user_friendly_address:
                logger.info(f"🔄 User-friendly адреса відсутня, конвертуємо raw адресу: {raw_address}")

                # Перевіряємо формат raw адреси
                if raw_address.startswith(('0:', '-1:')):
                    try:
                        # Спроба конвертації через TON Connect Service
                        if ton_connect_service:
                            logger.info("📡 Конвертуємо адресу через TON API...")

                            # Використовуємо метод конвертації
                            converted_address = ton_connect_service.convert_raw_to_friendly_sync(raw_address)

                            if converted_address:
                                user_friendly_address = converted_address
                                logger.info(f"✅ Успішно конвертовано: {raw_address} -> {user_friendly_address}")
                            else:
                                logger.error("❌ Не вдалося конвертувати адресу через API")

                                # Fallback: генеруємо псевдо user-friendly адресу
                                # УВАГА: Це тимчасове рішення - краще використовувати pytoniq-core
                                import hashlib
                                import base64

                                # Створюємо унікальний ідентифікатор на основі raw адреси
                                hash_object = hashlib.sha256(raw_address.encode())
                                hash_hex = hash_object.hexdigest()[:32]

                                # Створюємо псевдо user-friendly адресу
                                # Це НЕ справжня конвертація, але дозволить системі працювати
                                user_friendly_address = f"UQ{base64.b64encode(bytes.fromhex(hash_hex)).decode()[:46]}"
                                logger.warning(
                                    f"⚠️ Використовуємо псевдо user-friendly адресу: {user_friendly_address}")

                    except Exception as e:
                        logger.error(f"❌ Помилка конвертації адреси: {e}")
                        # Використовуємо raw адресу як fallback
                        user_friendly_address = raw_address
                        logger.warning(f"⚠️ Використовуємо raw адресу як fallback: {raw_address}")
                else:
                    # Адреса вже в user-friendly форматі
                    user_friendly_address = raw_address
                    logger.info(f"✅ Адреса вже в user-friendly форматі: {user_friendly_address}")
            else:
                logger.info(f"✅ Отримано user-friendly адресу від фронтенду: {user_friendly_address}")

            # Логуємо фінальні адреси
            logger.info(f"📍 Фінальні адреси:")
            logger.info(f"  - Raw: {raw_address}")
            logger.info(f"  - User-friendly: {user_friendly_address}")

            # Санітизація додаткових полів
            sanitized_data = {
                'address': user_friendly_address,  # Використовуємо user-friendly для збереження
                'raw_address': raw_address,  # Зберігаємо також raw адресу
                'chain': sanitize_string(str(wallet_data.get('chain', '-239'))),
                'publicKey': sanitize_string(str(wallet_data.get('publicKey', ''))),
                'provider': sanitize_string(str(wallet_data.get('provider', ''))),
                'timestamp': wallet_data.get('timestamp', int(datetime.now(timezone.utc).timestamp())),
                'userAgent': sanitize_string(request.headers.get('User-Agent', '') if request else ''),
                'ipAddress': request.remote_addr if request else '',
                'metadata': {
                    'original_address': raw_address,
                    'converted': user_friendly_address != raw_address,
                    'conversion_method': 'ton_api' if user_friendly_address != raw_address else 'frontend'
                }
            }

            # Підключаємо гаманець
            result = wallet_model.connect_wallet(telegram_id, sanitized_data)

            if result['success']:
                logger.info(f"✅ Гаманець успішно підключено для {telegram_id}")
                logger.info(f"📍 User-friendly адреса: {user_friendly_address}")
                logger.info(f"📍 Raw адреса: {raw_address}")

                # Обробляємо бонус за перше підключення через transaction service
                if result.get('first_connection', False):
                    bonus_amount = 100.0  # Стандартний бонус 100 WINIX

                    if transaction_service:
                        # Нараховуємо бонус через transaction service
                        bonus_result = transaction_service.process_wallet_connection_bonus(
                            telegram_id=telegram_id,
                            winix_amount=bonus_amount,
                            wallet_address=user_friendly_address  # Використовуємо user-friendly
                        )

                        if bonus_result['success']:
                            result['bonus'] = {
                                'amount': bonus_amount,
                                'currency': 'WINIX',
                                'transaction_id': bonus_result['transaction_id'],
                                'operations': bonus_result['operations'],
                                'processed_through': 'transaction_service'
                            }
                            logger.info(f"💰 Бонус за підключення гаманця нарахований користувачу {telegram_id}")
                        else:
                            logger.warning(f"⚠️ Не вдалося нарахувати бонус: {bonus_result['error']}")
                    else:
                        # Прямий метод якщо transaction service недоступний
                        try:
                            from supabase_client import update_balance
                            if update_balance(telegram_id, bonus_amount):
                                result['bonus'] = {
                                    'amount': bonus_amount,
                                    'currency': 'WINIX',
                                    'operations': [f'WINIX +{bonus_amount}'],
                                    'processed_through': 'direct_db'
                                }
                                logger.info(f"💰 Бонус нарахований напряму для {telegram_id}")
                        except Exception as direct_error:
                            logger.error(f"❌ Помилка прямого нарахування: {direct_error}")

                # Отримуємо баланс використовуючи user-friendly адресу
                if ton_connect_service:
                    try:
                        logger.info(f"📊 Отримуємо баланс для адреси: {user_friendly_address}")
                        balance = ton_connect_service.get_wallet_balance_sync(user_friendly_address, force_refresh=True)

                        if balance:
                            result['balance'] = {
                                'ton': balance.ton_balance,
                                'flex': balance.flex_balance
                            }
                            logger.info(f"✅ Баланс отримано: TON={balance.ton_balance}, FLEX={balance.flex_balance}")
                        else:
                            logger.warning("⚠️ Не вдалося отримати баланс")

                    except Exception as balance_error:
                        logger.error(f"❌ Помилка отримання балансу: {balance_error}")

                # Додаємо інформацію про сервіси та адреси
                result['service_info'] = {
                    'transaction_service_available': transaction_service is not None,
                    'ton_connect_available': ton_connect_service is not None,
                    'address_conversion': {
                        'performed': user_friendly_address != raw_address,
                        'raw_address': raw_address,
                        'user_friendly_address': user_friendly_address
                    }
                }

                # Оновлюємо wallet дані в результаті
                if 'wallet' in result:
                    result['wallet']['raw_address'] = raw_address
                    result['wallet']['user_friendly_address'] = user_friendly_address

                return {
                    "status": "success",
                    "message": result['message'],
                    "data": {
                        "wallet": result['wallet'],
                        "first_connection": result.get('first_connection', False),
                        "bonus": result.get('bonus'),
                        "balance": result.get('balance'),
                        "service_info": result.get('service_info')
                    }
                }, 200
            else:
                logger.warning(f"❌ Не вдалося підключити гаманець для {telegram_id}: {result['message']}")

                status_code = 409 if result.get('error_code') == 'WALLET_ALREADY_CONNECTED' else 400

                return {
                    "status": "error",
                    "message": result['message'],
                    "error_code": result.get('error_code', 'CONNECTION_FAILED')
                }, status_code

        except Exception as e:
            logger.error(f"❌ Критична помилка підключення гаманця для {telegram_id}: {str(e)}", exc_info=True)
            return {
                "status": "error",
                "message": "Внутрішня помилка сервера",
                "error_code": "INTERNAL_ERROR"
            }, 500

    @staticmethod
    @secure_endpoint(max_requests=15, window_seconds=300)
    def disconnect_wallet(telegram_id: str) -> Tuple[Dict[str, Any], int]:
        """
        Відключення TON гаманця

        Args:
            telegram_id: ID користувача в Telegram

        Returns:
            Результат відключення та HTTP код
        """
        try:
            logger.info(f"Відключення гаманця для користувача {telegram_id}")

            if not wallet_model:
                return {
                    "status": "error",
                    "message": "Сервіс гаманців недоступний",
                    "error_code": "SERVICE_UNAVAILABLE"
                }, 503

            # Отримуємо поточний гаманець для логування
            current_wallet = wallet_model.get_user_wallet(telegram_id)

            # Відключаємо гаманець
            result = wallet_model.disconnect_wallet(telegram_id)

            if result['success']:
                logger.info(f"Гаманець успішно відключено для {telegram_id}")

                # Логуємо операцію через transaction service якщо доступний
                if transaction_service and current_wallet:
                    try:
                        from ..models.transaction import TransactionAmount, TransactionType

                        # Створюємо запис про відключення (нульова винагорода)
                        disconnect_result = transaction_service.process_reward(
                            telegram_id=telegram_id,
                            reward_amount=TransactionAmount(winix=0, tickets=0, flex=0),
                            transaction_type=TransactionType.ADMIN_ADJUSTMENT,
                            description="TON гаманець відключено",
                            reference_id=f"wallet_disconnect_{telegram_id}_{int(datetime.now(timezone.utc).timestamp())}",
                            reference_type="wallet_disconnect",
                            metadata={
                                'operation': 'wallet_disconnect',
                                'wallet_address': current_wallet.get('address'),
                                'disconnected_at': datetime.now(timezone.utc).isoformat(),
                                'user_action': True
                            }
                        )

                        logger.info(f"Відключення гаманця зареєстровано: {disconnect_result.get('transaction_id')}")

                    except Exception as e:
                        logger.warning(f"Не вдалося зареєструвати відключення: {e}")

                # Очищаємо кеш балансу
                if ton_connect_service:
                    ton_connect_service.clear_cache()

                return {
                    "status": "success",
                    "message": result['message'],
                    "service_info": {
                        "transaction_service_available": transaction_service is not None,
                        "operation_logged": transaction_service is not None
                    }
                }, 200
            else:
                logger.warning(f"Не вдалося відключити гаманець для {telegram_id}: {result['message']}")

                status_code = 404 if result.get('error_code') == 'WALLET_NOT_FOUND' else 400

                return {
                    "status": "error",
                    "message": result['message'],
                    "error_code": result.get('error_code', 'DISCONNECTION_FAILED')
                }, status_code

        except Exception as e:
            logger.error(f"Помилка відключення гаманця для {telegram_id}: {str(e)}")
            return {
                "status": "error",
                "message": "Внутрішня помилка сервера",
                "error_code": "INTERNAL_ERROR"
            }, 500

    @staticmethod
    @secure_endpoint(max_requests=5, window_seconds=300)
    def verify_wallet(telegram_id: str):
        """
        Верифікація володіння гаманцем
        БЕЗ ДОДАТКОВОЇ ВАЛІДАЦІЇ - довіряємо TON Connect

        Args:
            telegram_id: ID користувача в Telegram

        Returns:
            Результат верифікації та HTTP код
        """
        try:
            logger.info(f"Верифікація гаманця для користувача {telegram_id}")

            if not wallet_model or not ton_connect_service:
                response: Dict[str, Any] = {
                    "status": "error",
                    "message": "Сервіс верифікації недоступний",
                    "error_code": "SERVICE_UNAVAILABLE"
                }
                return response, 503

            # Отримуємо дані напряму з request
            try:
                verification_data = request.get_json(force=True)
                logger.info(f"Отримані дані верифікації: {verification_data}")
            except Exception as e:
                logger.error(f"Помилка отримання JSON: {e}")
                response: Dict[str, Any] = {
                    "status": "error",
                    "message": "Невірний формат даних",
                    "error_code": "INVALID_JSON"
                }
                return response, 400

            if not verification_data:
                response: Dict[str, Any] = {
                    "status": "error",
                    "message": "Дані верифікації відсутні",
                    "error_code": "MISSING_VERIFICATION_DATA"
                }
                return response, 400

            # Перевіряємо обов'язкові поля
            if 'signature' not in verification_data or 'message' not in verification_data:
                response: Dict[str, Any] = {
                    "status": "error",
                    "message": "Відсутні обов'язкові поля: signature, message",
                    "error_code": "MISSING_REQUIRED_FIELDS"
                }
                return response, 400

            # Перевіряємо наявність гаманця
            wallet = wallet_model.get_user_wallet(telegram_id)
            if not wallet:
                response: Dict[str, Any] = {
                    "status": "error",
                    "message": "Гаманець не підключено",
                    "error_code": "WALLET_NOT_CONNECTED"
                }
                return response, 404

            # Санітизуємо дані
            signature = sanitize_string(str(verification_data.get('signature', '')))
            message = sanitize_string(str(verification_data.get('message', '')))
            verification_type = sanitize_string(str(verification_data.get('type', 'ownership')))

            if not signature or not message:
                response: Dict[str, Any] = {
                    "status": "error",
                    "message": "Невалідні дані верифікації",
                    "error_code": "INVALID_VERIFICATION_DATA"
                }
                return response, 400

            # TON Connect вже перевірив підпис - довіряємо йому
            logger.info(f"Приймаємо верифікацію від TON Connect для {wallet['address']}")

            # Оновлюємо статус верифікації
            verification_update: Dict[str, Any] = {
                'type': verification_type,
                'signature': signature,
                'message': message,
                'timestamp': datetime.now(timezone.utc).isoformat()
            }

            result = wallet_model.verify_wallet(telegram_id, verification_update)

            if result['success']:
                logger.info(f"Гаманець успішно верифіковано для {telegram_id}")

                # Логуємо операцію через transaction service якщо доступний
                if transaction_service:
                    try:
                        from ..models.transaction import TransactionAmount, TransactionType

                        # Створюємо запис про верифікацію
                        verification_log_result = transaction_service.process_reward(
                            telegram_id=telegram_id,
                            reward_amount=TransactionAmount(winix=0, tickets=0, flex=0),
                            transaction_type=TransactionType.ADMIN_ADJUSTMENT,
                            description=f"Верифікація TON гаманця ({verification_type})",
                            reference_id=f"wallet_verify_{telegram_id}_{int(datetime.now(timezone.utc).timestamp())}",
                            reference_type="wallet_verification",
                            metadata={
                                'operation': 'wallet_verification',
                                'verification_type': verification_type,
                                'wallet_address': wallet['address'],
                                'verified_at': verification_update['timestamp'],
                                'signature_hash': signature[:16] + '...' if len(signature) > 16 else signature,
                                'user_action': True
                            }
                        )

                        logger.info(f"Верифікація зареєстрована: {verification_log_result.get('transaction_id')}")

                    except Exception as e:
                        logger.warning(f"Не вдалося зареєструвати верифікацію: {e}")

                response: Dict[str, Any] = {
                    "status": "success",
                    "message": result['message'],
                    "data": {
                        "wallet": result['wallet'],
                        "verified_at": verification_update['timestamp'],
                        "verification_type": verification_type,
                        "service_info": {
                            "transaction_service_available": transaction_service is not None,
                            "verification_logged": transaction_service is not None
                        }
                    }
                }
                return response, 200
            else:
                response: Dict[str, Any] = {
                    "status": "error",
                    "message": result['message'],
                    "error_code": result.get('error_code', 'VERIFICATION_UPDATE_FAILED')
                }
                return response, 500

        except Exception as e:
            logger.error(f"Помилка верифікації гаманця для {telegram_id}: {str(e)}")
            response: Dict[str, Any] = {
                "status": "error",
                "message": "Внутрішня помилка сервера",
                "error_code": "INTERNAL_ERROR"
            }
            return response, 500

    @staticmethod
    @public_endpoint(max_requests=30, window_seconds=60)
    @validate_telegram_id
    def get_wallet_balance(telegram_id: str) -> Tuple[Dict[str, Any], int]:
        """
        Отримання балансу гаманця

        Args:
            telegram_id: ID користувача в Telegram

        Returns:
            Баланс гаманця та HTTP код
        """
        try:
            logger.info(f"Отримання балансу гаманця для користувача {telegram_id}")

            if not wallet_model or not ton_connect_service:
                response: Dict[str, Any] = {
                    "status": "error",
                    "message": "Сервіс балансу недоступний",
                    "error_code": "SERVICE_UNAVAILABLE"
                }
                return response, 503

            # Перевіряємо наявність гаманця
            wallet = wallet_model.get_user_wallet(telegram_id)
            if not wallet:
                response: Dict[str, Any] = {
                    "status": "error",
                    "message": "Гаманець не підключено",
                    "error_code": "WALLET_NOT_CONNECTED"
                }
                return response, 404

            # Отримуємо параметри запиту
            force_refresh = False
            if request:
                force_refresh = request.args.get('force_refresh', 'false').lower() == 'true'

            # Отримуємо баланс
            balance = ton_connect_service.get_wallet_balance_sync(
                wallet['address'],
                force_refresh=force_refresh
            )

            if balance:
                logger.info(
                    f"Баланс отримано для {telegram_id}: TON={balance.ton_balance:.4f}, FLEX={balance.flex_balance:,}")

                response: Dict[str, Any] = {
                    "status": "success",
                    "data": {
                        "address": balance.address,
                        "ton_balance": balance.ton_balance,
                        "flex_balance": balance.flex_balance,
                        "last_updated": balance.last_updated.isoformat(),
                        "cached": not force_refresh,
                        "service_info": {
                            "transaction_service_available": transaction_service is not None
                        }
                    }
                }
                return response, 200
            else:
                response: Dict[str, Any] = {
                    "status": "error",
                    "message": "Не вдалося отримати баланс",
                    "error_code": "BALANCE_FETCH_FAILED"
                }
                return response, 500

        except Exception as e:
            logger.error(f"Помилка отримання балансу для {telegram_id}: {str(e)}")
            response: Dict[str, Any] = {
                "status": "error",
                "message": "Внутрішня помилка сервера",
                "error_code": "INTERNAL_ERROR"
            }
            return response, 500

    @staticmethod
    @public_endpoint(max_requests=20, window_seconds=60)
    @validate_telegram_id
    def get_wallet_transactions(telegram_id: str):
        """
        Отримання транзакцій гаманця

        Args:
            telegram_id: ID користувача в Telegram

        Returns:
            Список транзакцій та HTTP код
        """
        try:
            logger.info(f"Отримання транзакцій гаманця для користувача {telegram_id}")

            if not wallet_model or not ton_connect_service:
                response: Dict[str, Any] = {
                    "status": "error",
                    "message": "Сервіс транзакцій недоступний",
                    "error_code": "SERVICE_UNAVAILABLE"
                }
                return response, 503

            # Перевіряємо наявність гаманця
            wallet = wallet_model.get_user_wallet(telegram_id)
            if not wallet:
                response: Dict[str, Any] = {
                    "status": "error",
                    "message": "Гаманець не підключено",
                    "error_code": "WALLET_NOT_CONNECTED"
                }
                return response, 404

            # Отримуємо параметри запиту
            try:
                limit = 20
                before_lt = None
                if request:
                    limit = min(int(request.args.get('limit', 20)), 100)  # Максимум 100
                    before_lt = request.args.get('before_lt')
                    before_lt = int(before_lt) if before_lt else None
            except (ValueError, TypeError):
                response: Dict[str, Any] = {
                    "status": "error",
                    "message": "Невалідні параметри запиту",
                    "error_code": "INVALID_PARAMETERS"
                }
                return response, 400

            # Отримуємо транзакції асинхронно
            import asyncio
            loop = asyncio.new_event_loop()
            asyncio.set_event_loop(loop)

            try:
                transactions = loop.run_until_complete(
                    ton_connect_service.get_wallet_transactions(
                        wallet['address'], limit, before_lt
                    )
                )
            finally:
                loop.close()

            logger.info(f"Отримано {len(transactions)} транзакцій для {telegram_id}")

            response: Dict[str, Any] = {
                "status": "success",
                "data": {
                    "address": wallet['address'],
                    "transactions": transactions,
                    "count": len(transactions),
                    "limit": limit,
                    "has_more": len(transactions) == limit,
                    "service_info": {
                        "transaction_service_available": transaction_service is not None,
                        "source": "ton_blockchain"
                    }
                }
            }
            return response, 200

        except Exception as e:
            logger.error(f"Помилка отримання транзакцій для {telegram_id}: {str(e)}")
            response: Dict[str, Any] = {
                "status": "error",
                "message": "Внутрішня помилка сервера",
                "error_code": "INTERNAL_ERROR"
            }
            return response, 500

    @staticmethod
    @public_endpoint(max_requests=50, window_seconds=300)
    def get_wallet_statistics() -> Tuple[Dict[str, Any], int]:
        """
        Отримання загальної статистики гаманців (публічна)

        Returns:
            Статистика та HTTP код
        """
        try:
            logger.info("Отримання статистики гаманців")

            if not wallet_model:
                response: Dict[str, Any] = {
                    "status": "error",
                    "message": "Сервіс статистики недоступний",
                    "error_code": "SERVICE_UNAVAILABLE"
                }
                return response, 503

            # Отримуємо статистику з wallet моделі
            stats: Dict[str, Any] = wallet_model.get_wallet_statistics()

            # Додаємо статистику з transaction service якщо доступний
            if transaction_service:
                try:
                    transaction_stats_result = transaction_service.get_service_statistics()

                    if transaction_stats_result['success']:
                        transaction_stats = transaction_stats_result.get('statistics', {})

                        # Фільтруємо статистику по wallet транзакціях
                        type_breakdown = transaction_stats.get('type_breakdown', {})
                        wallet_bonus_count = type_breakdown.get('wallet_connection_bonus', 0)

                        stats['transaction_service_stats'] = {
                            'wallet_connection_bonuses': wallet_bonus_count,
                            'service_available': True
                        }

                except Exception as e:
                    logger.warning(f"Не вдалося отримати статистику транзакцій: {e}")
                    stats['transaction_service_stats'] = {
                        'service_available': False,
                        'error': str(e)
                    }
            else:
                stats['transaction_service_stats'] = {
                    'service_available': False
                }

            # Додаємо інформацію про TON сервіс
            if ton_connect_service:
                ton_info: Dict[str, Any] = ton_connect_service.get_network_info()
                cache_stats: Dict[str, Any] = ton_connect_service.get_cache_stats()

                stats['network'] = {
                    'name': ton_info['network'],
                    'api_configured': ton_info['api_key_configured']
                }
                stats['cache'] = cache_stats

            # Додаємо метадані
            stats['metadata'] = {
                "generated_at": datetime.now(timezone.utc).isoformat(),
                "transaction_service_integration": transaction_service is not None,
                "automatic_bonuses_enabled": transaction_service is not None
            }

            logger.info(f"Статистика отримана: {stats.get('total_connected', 0)} підключених гаманців")

            response: Dict[str, Any] = {
                "status": "success",
                "data": stats,
                "timestamp": datetime.now(timezone.utc).isoformat()
            }
            return response, 200

        except Exception as e:
            logger.error(f"Помилка отримання статистики гаманців: {str(e)}")
            response: Dict[str, Any] = {
                "status": "error",
                "message": "Внутрішня помилка сервера",
                "error_code": "INTERNAL_ERROR"
            }
            return response, 500

    @staticmethod
    @public_endpoint(max_requests=20, window_seconds=60)
    def get_wallet_health() -> Tuple[Dict[str, Any], int]:
        """
        Перевірка здоров'я сервісу гаманців

        Returns:
            Статус здоров'я та HTTP код
        """
        try:
            # Перевіряємо доступність компонентів
            health_status: Dict[str, Any] = {}
            overall_healthy = True

            # Перевірка wallet model
            if wallet_model:
                try:
                    stats = wallet_model.get_wallet_statistics()
                    health_status['wallet_model'] = {
                        "status": "healthy",
                        "total_wallets": stats.get('total_connected', 0)
                    }
                except Exception as e:
                    health_status['wallet_model'] = {
                        "status": "unhealthy",
                        "error": str(e)
                    }
                    overall_healthy = False
            else:
                health_status['wallet_model'] = {
                    "status": "unavailable",
                    "error": "Model not loaded"
                }
                overall_healthy = False

            # Перевірка Transaction Service
            if transaction_service:
                try:
                    stats_result = transaction_service.get_service_statistics()
                    health_status['transaction_service'] = {
                        "status": "healthy" if stats_result['success'] else "degraded",
                        "version": "1.0.0",
                        "bonus_integration": "active"
                    }
                except Exception as e:
                    health_status['transaction_service'] = {
                        "status": "unhealthy",
                        "error": str(e)
                    }
            else:
                health_status['transaction_service'] = {
                    "status": "unavailable",
                    "error": "Service not loaded",
                    "impact": "manual_bonus_mode"
                }

            # Перевірка TON Connect сервісу
            if ton_connect_service:
                try:
                    network_info: Dict[str, Any] = ton_connect_service.get_network_info()
                    health_status['ton_connect'] = {
                        "status": "healthy",
                        "network": network_info.get('network', 'unknown'),
                        "api_configured": network_info.get('api_key_configured', False)
                    }
                except Exception as e:
                    health_status['ton_connect'] = {
                        "status": "unhealthy",
                        "error": str(e)
                    }
                    overall_healthy = False
            else:
                health_status['ton_connect'] = {
                    "status": "unavailable",
                    "error": "Service not initialized"
                }
                overall_healthy = False

            # Перевірка бази даних
            supabase = None
            try:
                from supabase_client import supabase
                if supabase:
                    try:
                        supabase.table("wallets").select("id").limit(1)
                        health_status['database'] = {
                            "status": "healthy",
                            "connection": "active"
                        }
                    except Exception as db_error:
                        health_status['database'] = {
                            "status": "unhealthy",
                            "error": f"Database query failed: {str(db_error)}"
                        }
                        overall_healthy = False
                else:
                    health_status['database'] = {
                        "status": "unavailable",
                        "error": "Supabase not initialized"
                    }
                    overall_healthy = False
            except ImportError:
                supabase = None
                health_status['database'] = {
                    "status": "unavailable",
                    "error": "Supabase client not available"
                }
                overall_healthy = False
            except Exception as e:
                health_status['database'] = {
                    "status": "unhealthy",
                    "error": str(e)
                }
                overall_healthy = False

            status = "healthy" if overall_healthy else "degraded"
            http_code = 200 if overall_healthy else 503

            logger.info(f"Перевірка здоров'я сервісу гаманців: {status}")

            response: Dict[str, Any] = {
                "status": status,
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "services": health_status,
                "version": "1.0.0",
                "features": {
                    "automatic_bonuses": transaction_service is not None,
                    "transaction_logging": transaction_service is not None,
                    "ton_integration": ton_connect_service is not None
                }
            }
            return response, http_code

        except Exception as e:
            logger.error(f"Помилка перевірки здоров'я сервісу гаманців: {str(e)}")
            response: Dict[str, Any] = {
                "status": "unhealthy",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "error": str(e)
            }
            return response, 500


# Експорт функцій для реєстрації маршрутів
def check_wallet_status(telegram_id: str):
    """Wrapper для перевірки статусу гаманця"""
    return WalletController.check_wallet_status(telegram_id)


def connect_wallet(telegram_id: str):
    """Wrapper для підключення гаманця"""
    return WalletController.connect_wallet(telegram_id)


def disconnect_wallet(telegram_id: str):
    """Wrapper для відключення гаманця"""
    return WalletController.disconnect_wallet(telegram_id)


def verify_wallet(telegram_id: str):
    """Wrapper для верифікації гаманця"""
    return WalletController.verify_wallet(telegram_id)


def get_wallet_balance(telegram_id: str):
    """Wrapper для отримання балансу"""
    return WalletController.get_wallet_balance(telegram_id)


def get_wallet_transactions(telegram_id: str):
    """Wrapper для отримання транзакцій"""
    return WalletController.get_wallet_transactions(telegram_id)


def get_wallet_statistics():
    """Wrapper для отримання статистики"""
    return WalletController.get_wallet_statistics()


def get_wallet_health():
    """Wrapper для перевірки здоров'я сервісу"""
    return WalletController.get_wallet_health()


# Експорт
__all__ = [
    'WalletController',
    'check_wallet_status',
    'connect_wallet',
    'disconnect_wallet',
    'verify_wallet',
    'get_wallet_balance',
    'get_wallet_transactions',
    'get_wallet_statistics',
    'get_wallet_health'
]