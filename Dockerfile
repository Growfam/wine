FROM python:3.10-slim

WORKDIR /app

# Копіюємо файли залежностей
COPY requirements.txt .

# Встановлюємо залежності
RUN pip install --no-cache-dir -r requirements.txt

# Копіюємо весь проект
COPY . .

# Задаємо команду запуску
CMD ["python3", "backend/main.py"]