from flask import Flask, render_template, request, jsonify
import sqlite3

app = Flask(__name__)


# Ініціалізація бази даних для жетонів
def init_db():
    conn = sqlite3.connect('tokens.db')
    c = conn.cursor()
    # Створюємо таблицю з user_id як TEXT, tokens і page1_completed як INTEGER
    c.execute('''CREATE TABLE IF NOT EXISTS users 
                 (user_id TEXT PRIMARY KEY, tokens INTEGER DEFAULT 0, page1_completed INTEGER DEFAULT 0)''')
    conn.commit()
    conn.close()


# Головна сторінка (Сторінка 1)
@app.route('/')
def index():
    return render_template('original-index.html')


# Сторінка 2
@app.route('/page2')
def page2():
    return render_template('page2.html')


# API-ендпоінт для підтвердження і нарахування жетонів
@app.route('/confirm', methods=['POST'])
def confirm():
    # Отримуємо user_id із JSON-запиту від Telegram Web App
    data = request.get_json()
    if not data or 'user_id' not in data:
        return jsonify({"status": "error", "message": "Missing user_id"}), 400

    user_id = data['user_id']

    # Підключаємося до бази даних
    conn = sqlite3.connect('tokens.db')
    c = conn.cursor()

    # Додаємо користувача, якщо його ще немає
    c.execute('INSERT OR IGNORE INTO users (user_id, tokens, page1_completed) VALUES (?, 0, 0)', (user_id,))

    # Перевіряємо, чи користувач уже завершив сторінку 1
    c.execute('SELECT page1_completed FROM users WHERE user_id = ?', (user_id,))
    page1_completed = c.fetchone()[0]

    if page1_completed == 0:
        # Нараховуємо жетон і позначаємо сторінку 1 як завершену
        c.execute('UPDATE users SET tokens = tokens + 1, page1_completed = 1 WHERE user_id = ?', (user_id,))
        conn.commit()
    else:
        # Якщо сторінка вже завершена, не додаємо жетон повторно
        conn.close()
        return jsonify({"status": "already_completed", "message": "Жетон уже нараховано"}), 200

    # Отримуємо актуальну кількість жетонів
    c.execute('SELECT tokens FROM users WHERE user_id = ?', (user_id,))
    tokens = c.fetchone()[0]
    conn.close()

    return jsonify({"status": "success", "tokens": tokens})


if __name__ == '__main__':
    init_db()  # Ініціалізуємо базу даних при запуску
    app.run(debug=True, host='0.0.0.0', port=5050)  # Запускаємо сервер