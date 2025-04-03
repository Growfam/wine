import time
import random
import string
import uuid
from datetime import datetime
from flask import session

def get_current_time():
    """Повертає поточний час у форматі Unix timestamp"""
    return int(time.time())

def get_formatted_date(timestamp):
    """Форматує Unix timestamp у читабельну дату"""
    return datetime.fromtimestamp(timestamp).strftime("%d.%m.%Y %H:%M")

def generate_uuid():
    """Генерує унікальний UUID"""
    return str(uuid.uuid4())

def generate_random_id(length=10):
    """Генерує випадковий ідентифікатор вказаної довжини"""
    characters = string.ascii_letters + string.digits
    return ''.join(random.choice(characters) for _ in range(length))

def format_currency(amount, currency="WINIX"):
    """Форматує суму у вигляді валюти"""
    return f"{amount:.2f} {currency}"

def is_authenticated():
    """Перевіряє, чи користувач авторизований"""
    return 'user_id' in session and session['user_id'] is not None

def get_current_user_id():
    """Повертає ID поточного користувача з сесії"""
    return session.get('user_id')

def calculate_reward(amount, period):
    """Розраховує нагороду за стейкінг"""
    # Припустимо, що за кожен день стейкінгу користувач отримує 0.1% від суми
    daily_percentage = 0.001
    return amount * period * daily_percentage