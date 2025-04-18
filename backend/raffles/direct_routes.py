"""
Пряма реалізація маршрутів розіграшів без складних імпортів.
Це тимчасове рішення для забезпечення роботи API до повного виправлення імпортів.
"""

import logging
import json
import uuid
from datetime import datetime, timezone, timedelta
from flask import jsonify, request

# Налаштування логування
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(levelname)s - %(message)s')
logger = logging.getLogger(__name__)

# Імпорт Supabase напряму
try:
    import os
    from supabase import create_client

    SUPABASE_URL = os.getenv("SUPABASE_URL")
    SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY")

    supabase = create_client(SUPABASE_URL, SUPABASE_KEY)
    supabase_available = True
except Exception as e:
    logger.error(f"Не вдалося підключитися до Supabase: {str(e)}")
    supabase_available = False
    supabase = None


def register_direct_raffles_routes(app):
    """
    Реєстрація прямих маршрутів розіграшів без залежності від controllers.py
    """
    logger.info("Реєстрація прямих маршрутів розіграшів...")

    @app.route('/api/raffles', methods=['GET'])
    def api_get_active_raffles():
        """Отримання списку активних розіграшів"""
        try:
            logger.info("api_get_active_raffles: Запит отримано")

            if not supabase_available:
                return jsonify({
                    "status": "success",
                    "data": [],
                    "message": "Supabase недоступний, повертаємо порожній список"
                })

            # Отримуємо всі активні розіграші з бази даних
            response = supabase.table("raffles") \
                .select(
                "id,title,description,entry_fee,prize_amount,prize_currency,start_time,end_time,participants_count,winners_count,status,is_daily,image_url") \
                .eq("status", "active") \
                .order("is_daily", desc=True) \
                .order("end_time") \
                .execute()

            raffles_data = []

            if response.data:
                # Форматуємо дані для відповіді
                for raffle in response.data:
                    try:
                        # Конвертуємо час
                        start_time_ms = int(datetime.fromisoformat(
                            raffle.get("start_time", "").replace('Z', '+00:00')).timestamp() * 1000)
                        end_time_ms = int(datetime.fromisoformat(
                            raffle.get("end_time", "").replace('Z', '+00:00')).timestamp() * 1000)
                    except:
                        start_time_ms = 0
                        end_time_ms = 0

                    raffle_info = {
                        "id": raffle.get("id"),
                        "title": raffle.get("title", ""),
                        "description": raffle.get("description", ""),
                        "entry_fee": raffle.get("entry_fee", 1),
                        "prize_amount": raffle.get("prize_amount", 0),
                        "prize_currency": raffle.get("prize_currency", "WINIX"),
                        "start_time": start_time_ms,
                        "end_time": end_time_ms,
                        "participants_count": raffle.get("participants_count", 0),
                        "winners_count": raffle.get("winners_count", 1),
                        "status": raffle.get("status", "active"),
                        "is_daily": raffle.get("is_daily", False),
                        "image_url": raffle.get("image_url", "")
                    }

                    raffles_data.append(raffle_info)

            return jsonify({
                "status": "success",
                "data": raffles_data
            })

        except Exception as e:
            logger.error(f"api_get_active_raffles: помилка - {str(e)}")
            # Повертаємо порожній масив при помилці
            return jsonify({
                "status": "success",
                "data": [],
                "error": str(e)
            })

    @app.route('/api/raffles/<raffle_id>', methods=['GET'])
    def api_get_raffle_details(raffle_id):
        """Отримання деталей конкретного розіграшу"""
        try:
            logger.info(f"api_get_raffle_details: Запит отримано для {raffle_id}")

            # Перевірка валідності UUID
            try:
                uuid_obj = uuid.UUID(raffle_id)
                if str(uuid_obj) != raffle_id:
                    return jsonify({
                        "status": "error",
                        "message": f"Невалідний формат ID розіграшу: {raffle_id}",
                        "code": "invalid_raffle_id"
                    }), 400
            except:
                return jsonify({
                    "status": "error",
                    "message": f"Невалідний формат ID розіграшу: {raffle_id}",
                    "code": "invalid_raffle_id"
                }), 400

            if not supabase_available:
                return jsonify({
                    "status": "error",
                    "message": "Supabase недоступний",
                    "code": "database_unavailable"
                }), 500

            # Отримуємо розіграш з бази даних
            response = supabase.table("raffles").select("*").eq("id", raffle_id).execute()

            if not response.data:
                return jsonify({
                    "status": "error",
                    "message": f"Розіграш з ID {raffle_id} не знайдено",
                    "code": "raffle_not_found"
                }), 404

            raffle = response.data[0]

            # Форматуємо дані
            try:
                start_time_ms = int(
                    datetime.fromisoformat(raffle.get("start_time", "").replace('Z', '+00:00')).timestamp() * 1000)
                end_time_ms = int(
                    datetime.fromisoformat(raffle.get("end_time", "").replace('Z', '+00:00')).timestamp() * 1000)
                current_time_ms = int(datetime.now(timezone.utc).timestamp() * 1000)
                time_left_ms = max(0, end_time_ms - current_time_ms)
            except:
                start_time_ms = 0
                end_time_ms = 0
                time_left_ms = 0

            raffle_details = {
                "id": raffle.get("id"),
                "title": raffle.get("title", ""),
                "description": raffle.get("description", ""),
                "entry_fee": raffle.get("entry_fee", 1),
                "prize_amount": raffle.get("prize_amount", 0),
                "prize_currency": raffle.get("prize_currency", "WINIX"),
                "start_time": start_time_ms,
                "end_time": end_time_ms,
                "participants_count": raffle.get("participants_count", 0),
                "winners_count": raffle.get("winners_count", 1),
                "status": raffle.get("status", "active"),
                "is_daily": raffle.get("is_daily", False),
                "image_url": raffle.get("image_url", ""),
                "time_left": time_left_ms
            }

            return jsonify({
                "status": "success",
                "data": raffle_details
            })

        except Exception as e:
            logger.error(f"Помилка отримання деталей розіграшу {raffle_id}: {str(e)}")
            return jsonify({
                "status": "error",
                "message": f"Помилка отримання деталей розіграшу: {str(e)}",
                "code": "server_error"
            }), 500

    @app.route('/api/user/<telegram_id>/raffles', methods=['GET'])
    def api_get_user_raffles(telegram_id):
        """Отримання розіграшів, у яких бере участь користувач"""
        try:
            logger.info(f"api_get_user_raffles: Запит отримано для {telegram_id}")

            if not supabase_available:
                return jsonify({"status": "success", "data": []})

            # Отримуємо всі активні участі користувача
            participants_response = supabase.table("raffle_participants").select("*") \
                .eq("telegram_id", telegram_id) \
                .execute()

            if not participants_response.data:
                return jsonify({"status": "success", "data": []})

            # Отримуємо ID розіграшів
            raffle_ids = [p.get("raffle_id") for p in participants_response.data if p.get("raffle_id")]

            if not raffle_ids:
                return jsonify({"status": "success", "data": []})

            # Отримуємо дані розіграшів
            raffles_response = supabase.table("raffles").select("*").in_("id", raffle_ids).execute()

            if not raffles_response.data:
                return jsonify({"status": "success", "data": []})

            # Словник участей
            participations_by_raffle = {p.get("raffle_id"): p for p in participants_response.data if p.get("raffle_id")}

            # Формуємо дані
            user_raffles = []
            now = datetime.now(timezone.utc)

            for raffle in raffles_response.data:
                raffle_id = raffle.get("id")
                participation = participations_by_raffle.get(raffle_id)

                if not participation:
                    continue

                # Форматуємо час
                try:
                    end_time = datetime.fromisoformat(raffle.get("end_time", "").replace('Z', '+00:00'))
                    end_time_ms = int(end_time.timestamp() * 1000)

                    entry_time = datetime.fromisoformat(participation.get("entry_time", "").replace('Z', '+00:00'))
                    entry_time_ms = int(entry_time.timestamp() * 1000)
                except:
                    end_time_ms = 0
                    entry_time_ms = 0

                user_raffle = {
                    "raffle_id": raffle_id,
                    "title": raffle.get("title", ""),
                    "entry_fee": raffle.get("entry_fee", 1),
                    "prize_amount": raffle.get("prize_amount", 0),
                    "prize_currency": raffle.get("prize_currency", "WINIX"),
                    "participation_time": entry_time_ms,
                    "entry_count": participation.get("entry_count", 1),
                    "status": raffle.get("status", "active"),
                    "end_time": end_time_ms,
                    "is_daily": raffle.get("is_daily", False)
                }

                user_raffles.append(user_raffle)

            return jsonify({"status": "success", "data": user_raffles})

        except Exception as e:
            logger.error(f"Помилка отримання розіграшів користувача {telegram_id}: {str(e)}")
            # Повертаємо порожній масив при помилці
            return jsonify({
                "status": "success",
                "data": [],
                "error_details": str(e)
            })

    @app.route('/api/user/<telegram_id>/raffles-history', methods=['GET'])
    def api_get_user_raffles_history(telegram_id):
        """Отримання історії участі користувача в розіграшах"""
        try:
            logger.info(f"api_get_user_raffles_history: Запит отримано для {telegram_id}")

            if not supabase_available:
                return jsonify({"status": "success", "data": []})

            # Отримуємо всі участі користувача
            participants_response = supabase.table("raffle_participants") \
                .select("raffle_id,entry_count,status,entry_time") \
                .eq("telegram_id", telegram_id) \
                .order("entry_time", desc=True) \
                .limit(50) \
                .execute()

            if not participants_response.data:
                return jsonify({"status": "success", "data": []})

            # Отримуємо ID розіграшів
            raffle_ids = [p.get("raffle_id") for p in participants_response.data if p.get("raffle_id")]

            if not raffle_ids:
                return jsonify({"status": "success", "data": []})

            # Отримуємо дані розіграшів
            raffles_response = supabase.table("raffles") \
                .select("id,title,prize_amount,prize_currency,end_time,status,is_daily") \
                .in_("id", raffle_ids) \
                .execute()

            if not raffles_response.data:
                return jsonify({"status": "success", "data": []})

            # Словник розіграшів
            raffles_by_id = {r.get("id"): r for r in raffles_response.data if r.get("id")}

            # Отримуємо переможців
            winners_response = supabase.table("raffle_winners") \
                .select("*") \
                .eq("telegram_id", telegram_id) \
                .execute()

            winners_by_raffle = {w.get("raffle_id"): w for w in winners_response.data if
                                 w.get("raffle_id")} if winners_response.data else {}

            # Формуємо історію
            history = []

            for participation in participants_response.data:
                raffle_id = participation.get("raffle_id")
                if not raffle_id or raffle_id not in raffles_by_id:
                    continue

                raffle = raffles_by_id[raffle_id]

                # Пропускаємо активні розіграші
                if raffle.get("status") == "active":
                    continue

                # Визначаємо переможця
                is_winner = raffle_id in winners_by_raffle
                status = "won" if is_winner else "participated"

                # Форматуємо дату
                try:
                    end_time = datetime.fromisoformat(raffle.get("end_time", "").replace('Z', '+00:00'))
                    formatted_date = end_time.strftime("%d.%m.%Y")
                except:
                    formatted_date = "Дата невідома"

                # Формуємо результат
                if is_winner:
                    winner_data = winners_by_raffle[raffle_id]
                    prize_amount = winner_data.get("prize_amount", 0)
                    prize_currency = winner_data.get("prize_currency", "WINIX")
                    result = f"Ви виграли {prize_amount} {prize_currency}"
                    place = winner_data.get("place")
                else:
                    result = "Ви брали участь, але не виграли"
                    place = None

                history_entry = {
                    "raffle_id": raffle_id,
                    "date": formatted_date,
                    "prize": f"{raffle.get('prize_amount', 0)} {raffle.get('prize_currency', 'WINIX')}",
                    "result": result,
                    "status": status,
                    "entry_count": participation.get("entry_count", 1),
                    "title": raffle.get("title", ""),
                    "is_daily": raffle.get("is_daily", False)
                }

                history.append(history_entry)

            return jsonify({"status": "success", "data": history})

        except Exception as e:
            logger.error(f"api_get_user_raffles_history: помилка - {str(e)}")
            # Повертаємо порожній масив при помилці
            return jsonify({
                "status": "success",
                "data": [],
                "error_details": str(e)
            })

    @app.route('/api/user/<telegram_id>/participate-raffle', methods=['POST'])
    def api_participate_in_raffle(telegram_id):
        """Участь у розіграші"""
        try:
            logger.info(f"api_participate_in_raffle: Запит отримано для {telegram_id}")

            # Перевірка JSON
            if not request.is_json:
                return jsonify({
                    "status": "error",
                    "message": "Неверний формат запиту. Очікується JSON.",
                    "code": "invalid_request"
                }), 400

            data = request.json
            if not data or "raffle_id" not in data:
                return jsonify({
                    "status": "error",
                    "message": "Не вказано ID розіграшу",
                    "code": "missing_raffle_id"
                }), 400

            raffle_id = data.get("raffle_id")

            # Перевіряємо валідність UUID
            try:
                uuid_obj = uuid.UUID(str(raffle_id))
                if str(uuid_obj) != str(raffle_id):
                    return jsonify({
                        "status": "error",
                        "message": f"Невалідний формат ID розіграшу: {raffle_id}",
                        "code": "invalid_raffle_id"
                    }), 400
            except:
                return jsonify({
                    "status": "error",
                    "message": f"Невалідний формат ID розіграшу: {raffle_id}",
                    "code": "invalid_raffle_id"
                }), 400

            if not supabase_available:
                return jsonify({
                    "status": "error",
                    "message": "Сервіс розіграшів тимчасово недоступний",
                    "code": "service_unavailable"
                }), 503

            # Отримуємо дані користувача
            user_response = supabase.table("winix").select("*").eq("telegram_id", telegram_id).execute()

            if not user_response.data:
                return jsonify({
                    "status": "error",
                    "message": "Користувача не знайдено",
                    "code": "user_not_found"
                }), 404

            user = user_response.data[0]

            # Отримуємо дані розіграшу
            raffle_response = supabase.table("raffles").select("*").eq("id", raffle_id).execute()

            if not raffle_response.data:
                return jsonify({
                    "status": "error",
                    "message": f"Розіграш з ID {raffle_id} не знайдено",
                    "code": "raffle_not_found"
                }), 404

            raffle = raffle_response.data[0]

            # Перевіряємо, чи активний розіграш
            if raffle.get("status") != "active":
                return jsonify({
                    "status": "error",
                    "message": "Розіграш не є активним",
                    "code": "raffle_not_active"
                }), 400

            # Перевіряємо час розіграшу
            now = datetime.now(timezone.utc)
            try:
                end_time = datetime.fromisoformat(raffle.get("end_time", "").replace('Z', '+00:00'))
                if now >= end_time:
                    return jsonify({
                        "status": "error",
                        "message": "Розіграш вже завершено",
                        "code": "raffle_ended"
                    }), 400
            except:
                return jsonify({
                    "status": "error",
                    "message": "Некоректний формат часу завершення розіграшу",
                    "code": "invalid_time_format"
                }), 500

            # Отримуємо кількість жетонів
            entry_count = min(int(data.get("entry_count", 1)), 100)  # Обмеження до 100 жетонів
            entry_fee = raffle.get("entry_fee", 1)
            required_coins = entry_count * entry_fee

            # Перевіряємо, чи достатньо жетонів
            user_coins = int(user.get("coins", 0))
            if user_coins < required_coins:
                return jsonify({
                    "status": "error",
                    "message": f"Недостатньо жетонів. Потрібно: {required_coins}, наявно: {user_coins}",
                    "code": "insufficient_tokens"
                }), 400

            # Перевіряємо, чи користувач вже бере участь у розіграші
            participation_response = supabase.table("raffle_participants").select("*") \
                .eq("raffle_id", raffle_id) \
                .eq("telegram_id", telegram_id) \
                .execute()

            existing_entry_count = 0
            participation_id = None

            if participation_response.data:
                existing_entry = participation_response.data[0]
                existing_entry_count = existing_entry.get("entry_count", 0)
                participation_id = existing_entry.get("id")

            # Оновлюємо кількість учасників
            updated_participants_count = raffle.get("participants_count", 0)
            if not participation_response.data:
                updated_participants_count += 1

            # Виконуємо транзакцію
            now_str = now.isoformat()
            transaction_id = str(uuid.uuid4())

            transaction_data = {
                "id": transaction_id,
                "telegram_id": telegram_id,
                "type": "fee",
                "amount": -required_coins,
                "description": f"Участь у розіграші '{raffle.get('title')}'",
                "status": "completed",
                "raffle_id": raffle_id,
                "created_at": now_str,
                "previous_balance": user_coins
            }

            # Створюємо транзакцію
            supabase.table("transactions").insert(transaction_data).execute()

            # Оновлюємо баланс користувача
            new_coins_balance = user_coins - required_coins
            supabase.table("winix").update({"coins": new_coins_balance}).eq("telegram_id", telegram_id).execute()

            # Оновлюємо або створюємо запис участі
            if participation_response.data:
                new_entry_count = existing_entry_count + entry_count
                supabase.table("raffle_participants").update({"entry_count": new_entry_count}).eq("id",
                                                                                                  participation_id).execute()
            else:
                participation_data = {
                    "id": str(uuid.uuid4()),
                    "raffle_id": raffle_id,
                    "telegram_id": telegram_id,
                    "entry_time": now_str,
                    "entry_count": entry_count,
                    "status": "active"
                }
                supabase.table("raffle_participants").insert(participation_data).execute()

            # Оновлюємо кількість учасників у розіграші
            supabase.table("raffles").update({"participants_count": updated_participants_count}).eq("id",
                                                                                                    raffle_id).execute()

            # Оновлюємо лічильник участей
            participations_count = user.get("participations_count", 0) + 1
            supabase.table("winix").update({"participations_count": participations_count}).eq("telegram_id",
                                                                                              telegram_id).execute()

            # Формуємо відповідь
            total_entries = existing_entry_count + entry_count
            response_data = {
                "message": "Ви успішно взяли участь у розіграші",
                "entry_count": entry_count,
                "total_entries": total_entries,
                "new_coins_balance": new_coins_balance,
                "participations_count": participations_count,
                "raffle_type": "daily" if raffle.get("is_daily", False) else "main"
            }

            return jsonify({"status": "success", "data": response_data})

        except Exception as e:
            logger.error(f"Помилка участі в розіграші: {str(e)}")
            return jsonify({
                "status": "error",
                "message": f"Виникла помилка при участі в розіграші: {str(e)}",
                "code": "server_error"
            }), 500

    logger.info("Прямі маршрути розіграшів успішно зареєстровано")
    return True