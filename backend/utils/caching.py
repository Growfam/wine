from functools import wraps
from flask import current_app, request
import time
import json
import hashlib

# Простий in-memory кеш для тестування
_cache = {}


def cache_response(ttl=300):
    """
    Декоратор для кешування відповідей API

    Args:
        ttl (int): Час життя запису в кеші (в секундах)

    Returns:
        function: Декорована функція
    """

    def decorator(func):
        @wraps(func)
        def wrapper(*args, **kwargs):
            # Створення унікального ключа кешу, включаючи аргументи запиту
            cache_key = _generate_cache_key(func.__name__, args, kwargs, request)

            # Перевірка наявності в кеші
            if cache_key in _cache:
                entry = _cache[cache_key]
                if entry['expires'] > time.time():
                    current_app.logger.debug(f"Cache hit for {cache_key}")
                    return entry['data']

            # Виконання оригінальної функції
            result = func(*args, **kwargs)

            # Збереження результату в кеші
            _cache[cache_key] = {
                'data': result,
                'expires': time.time() + ttl
            }
            current_app.logger.debug(f"Cache set for {cache_key}")

            return result

        return wrapper

    return decorator


def invalidate_cache(prefix=None, user_id=None):
    """
    Інвалідує записи в кеші за префіксом або ID користувача

    Args:
        prefix (str, optional): Префікс ключів, які треба інвалідувати.
        user_id (int, optional): ID користувача, кеш якого треба інвалідувати.
    """
    global _cache
    keys_to_remove = []

    if prefix:
        keys_to_remove.extend([k for k in _cache if k.startswith(prefix)])

    if user_id:
        # Інвалідуємо всі ключі, які містять ID користувача
        user_id_str = str(user_id)
        keys_to_remove.extend([k for k in _cache if user_id_str in k])

    # Якщо не вказано ні префікса, ні ID користувача, інвалідуємо весь кеш
    if not prefix and not user_id:
        _cache = {}
        current_app.logger.debug("Invalidated all cache entries")
        return

    # Видаляємо знайдені ключі
    for key in set(keys_to_remove):  # Використовуємо set для видалення дублікатів
        if key in _cache:
            del _cache[key]

    current_app.logger.debug(f"Invalidated {len(keys_to_remove)} cache entries")


def _generate_cache_key(func_name, args, kwargs, request_obj=None):
    """
    Генерує унікальний ключ кешу

    Args:
        func_name (str): Назва функції
        args (tuple): Позиційні аргументи
        kwargs (dict): Іменовані аргументи
        request_obj (Request, optional): Об'єкт запиту Flask. Defaults to None.

    Returns:
        str: Унікальний ключ кешу
    """
    # Створюємо базовий ключ з назви функції та аргументів
    key_parts = [func_name]

    # Додаємо позиційні аргументи
    for arg in args:
        key_parts.append(str(arg))

    # Додаємо іменовані аргументи
    for k, v in sorted(kwargs.items()):
        key_parts.append(f"{k}:{v}")

    # Якщо це запит Flask, додаємо параметри запиту
    if request_obj:
        # Додаємо параметри URL
        for k, v in sorted(request_obj.args.items()):
            key_parts.append(f"url:{k}:{v}")

        # Додаємо параметри форми (для POST-запитів)
        if request_obj.method == 'POST' and request_obj.form:
            for k, v in sorted(request_obj.form.items()):
                key_parts.append(f"form:{k}:{v}")

    # Об'єднуємо всі частини і створюємо хеш
    key_str = ":".join(key_parts)
    return hashlib.md5(key_str.encode()).hexdigest()


def cache_query(model, query_func, ttl=300):
    """
    Кешує результати запиту до бази даних

    Args:
        model (db.Model): Модель SQLAlchemy
        query_func (function): Функція, яка виконує запит
        ttl (int, optional): Час життя запису в кеші (в секундах). Defaults to 300.

    Returns:
        mixed: Результат запиту
    """
    # Створюємо ключ кешу
    key_str = f"query:{model.__name__}:{hash(str(query_func))}"
    cache_key = hashlib.md5(key_str.encode()).hexdigest()

    # Перевірка наявності в кеші
    if cache_key in _cache:
        entry = _cache[cache_key]
        if entry['expires'] > time.time():
            current_app.logger.debug(f"Query cache hit for {model.__name__}")
            return entry['data']

    # Виконання запиту
    result = query_func()

    # Збереження результату в кеші
    _cache[cache_key] = {
        'data': result,
        'expires': time.time() + ttl
    }
    current_app.logger.debug(f"Query cache set for {model.__name__}")

    return result


def batch_update(func):
    """
    Декоратор для об'єднання декількох оновлень в одну транзакцію

    Args:
        func (function): Функція, яка виконує оновлення

    Returns:
        function: Декорована функція
    """

    @wraps(func)
    def wrapper(*args, **kwargs):
        try:
            # Запуск транзакції
            from main import db
            result = func(*args, **kwargs)
            db.session.commit()
            return result
        except Exception as e:
            # Відкат транзакції у випадку помилки
            from main import db
            db.session.rollback()
            current_app.logger.error(f"Error in batch update: {str(e)}")
            raise

    return wrapper


def optimize_query(query, model, fields=[]):
    """
    Оптимізує запит до бази даних

    Args:
        query (Query): Запит SQLAlchemy
        model (db.Model): Модель SQLAlchemy
        fields (list, optional): Список полів для вибірки. Defaults to [].

    Returns:
        Query: Оптимізований запит
    """
    from sqlalchemy.orm import joinedload

    # Якщо вказані конкретні поля, використовуємо їх
    if fields:
        query = query.with_entities(*[getattr(model, field) for field in fields])

    # Додаємо joinedload для зв'язаних об'єктів, якщо вони є
    for relationship in model.__mapper__.relationships:
        if relationship.lazy == 'dynamic':
            query = query.options(joinedload(relationship.key))

    return query