from flask import Flask, render_template, request, jsonify
from supabase_client import get_user, create_user, update_balance
from supabase import create_client
import os
from dotenv import load_dotenv

# Завантажуємо .env (для локального тесту)
load_dotenv()

# Ініціалізація Flask з налаштуванням для пошуку шаблонів у кореневій директорії
app = Flask(__name__, template_folder='./', static_folder='./static')

# Підключення до Supabase
SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_ANON_KEY")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# Головна сторінка (наприклад, сторінка 1)
@app.route('/')
def index():
    return render_template('index.html')

# Сторінка 2
@app.route('/page2')
def page2():
    return render_template('page2.html')

# API для нарахування жетонів
@app.route('/confirm', methods=['POST'])
def confirm():
    data = request.get_json()

    if not data or 'user_id' not in data:
        return jsonify({"status": "error", "message": "Missing user_id"}), 400

    user_id = str(data['user_id'])

    # Отримуємо користувача
    user = get_user(user_id)

    # Якщо користувача немає — створюємо
    if not user:
        user = create_user(user_id, username="unknown")

    # Якщо ще не завершив сторінку 1
    if not user.get("page1_completed", False):
        update_balance(user_id, 1)

        # Позначаємо, що сторінка 1 завершена
        supabase.table("Winix").update({"page1_completed": True}).eq("telegram_id", user_id).execute()

        updated_user = get_user(user_id)
        return jsonify({"status": "success", "tokens": updated_user["balance"]})

    else:
        return jsonify({"status": "already_completed", "message": "Жетон уже нараховано"})

# Запуск додатку
if __name__ == '__main__':
    app.run(debug=True, host='0.0.0.0', port=int(os.environ.get("PORT", 5050)))