FROM python:3.11-slim

WORKDIR /app

# Встановлення системних залежностей
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    python3-dev \
    && rm -rf /var/lib/apt/lists/*

# Копіюємо requirements.txt і встановлюємо залежності
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Копіюємо весь проект
COPY . .

# Змінні середовища
ENV PYTHONUNBUFFERED=1
ENV PORT=8080

# Запуск через gunicorn або python (якщо gunicorn не спрацює)
CMD gunicorn --bind 0.0.0.0:$PORT "backend.main:app" || python backend/main.py