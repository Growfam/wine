# Winix Реферальна Система - Backend

Бекенд для реферальної системи Winix, що дозволяє користувачам запрошувати нових учасників та отримувати за це винагороду. Система включає дворівневу структуру рефералів, різні типи винагород (прямі бонуси, відсоткові нарахування).

## Технічний стек

- **Мова програмування**: Python
- **Фреймворк**: Flask
- **База даних**: SQL (з використанням SQLAlchemy ORM)
- **API**: REST JSON
- **Аутентифікація**: Токен-базована

## Структура проекту

```
/
├── app.py                # Основний файл додатку
├── models/               # Моделі бази даних
│   ├── __init__.py
│   ├── referral.py       # Модель реферальних зв'язків
│   ├── direct_bonus.py   # Модель прямих бонусів
│   └── percentage_reward.py  # Модель відсоткових винагород
├── referrals/            # Логіка реферальної системи
│   ├── __init__.py
│   ├── routes.py         # Маршрути API
│   └── controllers/      # Контролери
│       ├── __init__.py
│       ├── referral_controller.py  # Контролер реферальних зв'язків
│       ├── bonus_controller.py     # Контролер бонусів
│       └── earnings_controller.py  # Контролер заробітків
└── utils/                # Утилітарні функції
    ├── __init__.py
    └── caching.py        # Функції кешування
```

## Налаштування

### Вимоги

- Python 3.8+
- Pip (менеджер пакетів Python)
- SQLite для розробки (або MySQL/PostgreSQL для виробничого середовища)

### Встановлення

1. Клонувати репозиторій:
   ```
   git clone <repository-url>
   cd winix-referral-backend
   ```

2. Налаштувати віртуальне середовище:
   ```
   python -m venv venv
   source venv/bin/activate  # На Windows: venv\Scripts\activate
   ```

3. Встановити залежності:
   ```
   pip install -r requirements.txt
   ```

4. Налаштувати змінні середовища:
   ```
   # Створити файл .env
   DATABASE_URL=sqlite:///winix.db
   FLASK_ENV=development
   ```

5. Запустити додаток:
   ```
   python app.py
   ```

## API Ендпоінти

### Реферальні посилання
- `GET /api/referrals/link/{user_id}` - Отримання реферального посилання
- `POST /api/referrals/register` - Реєстрація нового реферала

### Статистика рефералів
- `GET /api/referrals/stats/{user_id}` - Отримання загальної статистики рефералів
- `GET /api/referrals/details/{referral_id}` - Отримання деталей реферала

### Бонуси
- `POST /api/referrals/bonus/direct` - Нарахування прямого бонусу
- `GET /api/referrals/bonus/history/{user_id}` - Історія прямих бонусів

### Заробітки
- `GET/POST /api/referrals/earnings/{user_id}` - Заробітки рефералів
- `GET /api/referrals/earnings/detailed/{referral_id}` - Детальні заробітки реферала
- `GET /api/referrals/earnings/summary/{user_id}` - Зведена інформація про заробітки

### Відсоткові винагороди
- `POST /api/referrals/reward/percentage` - Нарахування відсоткової винагороди
- `GET /api/referrals/reward/history/{user_id}` - Історія відсоткових винагород

## Автори

- Команда розробки Winix

## Ліцензія

Цей проект є власністю Winix і не підлягає розповсюдженню без дозволу.