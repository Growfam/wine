#!/usr/bin/env python3
"""
🔍 WINIX Redis Diagnostic Tool
Діагностичний скрипт для пошуку проблем з Redis конфігурацією

Розмістіть цей файл у папці backend/ та запустіть:
python redis_debug.py
"""

import os
import re
import sys
from pathlib import Path


class Colors:
    RED = '\033[91m'
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    PURPLE = '\033[95m'
    CYAN = '\033[96m'
    WHITE = '\033[97m'
    BOLD = '\033[1m'
    END = '\033[0m'


def print_header(text):
    print(f"\n{Colors.BOLD}{Colors.BLUE}{'=' * 60}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.BLUE}{text}{Colors.END}")
    print(f"{Colors.BOLD}{Colors.BLUE}{'=' * 60}{Colors.END}")


def print_step(step_num, description):
    print(f"\n{Colors.BOLD}{Colors.CYAN}КРОК {step_num}: {description}{Colors.END}")


def print_critical(text):
    print(f"{Colors.BOLD}{Colors.RED}🚨 КРИТИЧНО: {text}{Colors.END}")


def print_warning(text):
    print(f"{Colors.YELLOW}⚠️  УВАГА: {text}{Colors.END}")


def print_success(text):
    print(f"{Colors.GREEN}✅ {text}{Colors.END}")


def print_info(text):
    print(f"{Colors.CYAN}ℹ️  {text}{Colors.END}")


def check_environment():
    """Крок 1: Перевірка змінних оточення"""
    print_step(1, "Перевірка змінних оточення Redis")

    redis_vars = {
        'REDIS_HOST': os.getenv('REDIS_HOST'),
        'REDIS_PORT': os.getenv('REDIS_PORT'),
        'REDIS_PASSWORD': os.getenv('REDIS_PASSWORD'),
        'REDIS_URL': os.getenv('REDIS_URL'),
        'REDIS_DB': os.getenv('REDIS_DB'),
    }

    print("\n📋 Змінні оточення:")
    for var, value in redis_vars.items():
        if value:
            print(f"  {var} = '{value}'")
        else:
            print_warning(f"  {var} = НЕ ВСТАНОВЛЕНО")

    # Аналіз змінних
    problems = []

    redis_host = redis_vars['REDIS_HOST']
    redis_port = redis_vars['REDIS_PORT']

    if redis_host:
        if redis_host.isdigit():
            problems.append(f"REDIS_HOST є числом: '{redis_host}' (має бути строкою)")
            print_critical(f"REDIS_HOST є числом: '{redis_host}'")

    if redis_port:
        if not redis_port.isdigit():
            problems.append(f"REDIS_PORT не є числом: '{redis_port}'")
            print_critical(f"REDIS_PORT не є числом: '{redis_port}'")
            if '.' in redis_port or 'redis' in redis_port.lower():
                print_critical("Схоже що HOST і PORT переплутані!")

    if not problems:
        print_success("Змінні оточення виглядають правильно")

    return problems


def find_python_files():
    """Крок 2: Пошук всіх Python файлів"""
    print_step(2, "Пошук Python файлів з Redis кодом")

    python_files = []
    redis_files = []

    for root, dirs, files in os.walk('.'):
        # Ігноруємо __pycache__ та .git
        dirs[:] = [d for d in dirs if not d.startswith('.') and d != '__pycache__']

        for file in files:
            if file.endswith('.py'):
                filepath = os.path.join(root, file)
                python_files.append(filepath)

                # Перевіряємо чи містить Redis код
                try:
                    with open(filepath, 'r', encoding='utf-8') as f:
                        content = f.read().lower()
                        if any(keyword in content for keyword in
                               ['redis', 'celery_broker', 'broker_url']):
                            redis_files.append(filepath)
                except:
                    pass

    print(f"📁 Знайдено {len(python_files)} Python файлів")
    print(f"🔍 {len(redis_files)} файлів містять Redis код")

    if redis_files:
        print("\n📋 Файли з Redis кодом:")
        for file in redis_files[:10]:  # Показуємо перші 10
            print(f"  • {file}")
        if len(redis_files) > 10:
            print(f"  ... та ще {len(redis_files) - 10} файлів")

    return redis_files


def scan_for_critical_issues(redis_files):
    """Крок 3: Пошук критичних проблем"""
    print_step(3, "Сканування критичних проблем HOST/PORT")

    critical_patterns = [
        (r'int\s*\(\s*os\.getenv\s*\(\s*["\']REDIS_HOST["\']',
         "int() викликається для REDIS_HOST"),

        (r'redis_port\s*=\s*.*REDIS_HOST',
         "REDIS_HOST присвоюється змінній port"),

        (r'redis_host\s*=\s*.*REDIS_PORT',
         "REDIS_PORT присвоюється змінній host"),

        (r'int\s*\(\s*[^)]*redis\.railway\.internal',
         "redis.railway.internal передається в int()"),

        (r'Redis\s*\([^)]*host\s*=\s*[^,)]*6379',
         "Порт 6379 передається як host"),

        (r'Redis\s*\([^)]*port\s*=\s*[^,)]*railway',
         "railway.internal передається як port"),
    ]

    critical_issues = []

    for filepath in redis_files:
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
                lines = content.split('\n')

                for line_num, line in enumerate(lines, 1):
                    for pattern, description in critical_patterns:
                        if re.search(pattern, line, re.IGNORECASE):
                            issue = {
                                'file': filepath,
                                'line': line_num,
                                'code': line.strip(),
                                'problem': description
                            }
                            critical_issues.append(issue)
                            print_critical(f"{filepath}:{line_num}")
                            print(f"    Проблема: {description}")
                            print(f"    Код: {line.strip()}")

        except Exception as e:
            print_warning(f"Не вдалося прочитати {filepath}: {e}")

    if not critical_issues:
        print_success("Критичних проблем не знайдено!")
    else:
        print(f"\n{Colors.RED}Знайдено {len(critical_issues)} критичних проблем!{Colors.END}")

    return critical_issues


def scan_suspicious_code(redis_files):
    """Крок 4: Пошук підозрілого коду"""
    print_step(4, "Пошук підозрілих конструкцій")

    suspicious_patterns = [
        (r'int\s*\(\s*os\.getenv\s*\([^)]*HOST[^)]*\)',
         "int() з HOST змінною"),

        (r'redis\.Redis\s*\([^)]*\)',
         "Створення Redis з'єднання"),

        (r'port\s*=\s*int\s*\([^)]*\)',
         "Конвертація port в int"),

        (r'host\s*=\s*os\.getenv',
         "Отримання host з env"),
    ]

    suspicious_issues = []

    for filepath in redis_files:
        try:
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
                lines = content.split('\n')

                for line_num, line in enumerate(lines, 1):
                    for pattern, description in suspicious_patterns:
                        if re.search(pattern, line, re.IGNORECASE):
                            issue = {
                                'file': filepath,
                                'line': line_num,
                                'code': line.strip(),
                                'description': description
                            }
                            suspicious_issues.append(issue)

        except Exception as e:
            continue

    if suspicious_issues:
        print(f"\n⚠️  Знайдено {len(suspicious_issues)} підозрілих місць:")
        for issue in suspicious_issues[:10]:  # Показуємо перші 10
            print(f"  📁 {issue['file']}:{issue['line']}")
            print(f"     {issue['description']}: {issue['code']}")

        if len(suspicious_issues) > 10:
            print(f"  ... та ще {len(suspicious_issues) - 10} місць")
    else:
        print_success("Підозрілих конструкцій не знайдено")

    return suspicious_issues


def check_specific_files():
    """Крок 5: Перевірка конкретних проблемних файлів"""
    print_step(5, "Перевірка ключових файлів")

    key_files = [
        'quests/utils/cache.py',
        'settings/config.py',
        'main.py',
        'celery.py',
        'settings/__init__.py'
    ]

    for filepath in key_files:
        if os.path.exists(filepath):
            print(f"\n🔍 Аналіз файлу: {filepath}")
            analyze_file_detailed(filepath)
        else:
            print_warning(f"Файл не знайдено: {filepath}")


def analyze_file_detailed(filepath):
    """Детальний аналіз конкретного файлу"""
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            lines = f.readlines()

        redis_lines = []
        problem_lines = []

        for i, line in enumerate(lines, 1):
            line_clean = line.strip()
            line_lower = line.lower()

            # Шукаємо Redis код
            if any(keyword in line_lower for keyword in ['redis', 'broker_url']):
                redis_lines.append((i, line_clean))

            # Шукаємо проблеми
            if ('int(' in line and 'host' in line_lower) or \
                    ('redis.railway.internal' in line and 'int(' in line):
                problem_lines.append((i, line_clean))

        if redis_lines:
            print(f"  📋 Знайдено {len(redis_lines)} ліній з Redis:")
            for line_num, line_content in redis_lines[:5]:
                print(f"    {line_num}: {line_content}")

        if problem_lines:
            print_critical(f"Знайдено {len(problem_lines)} проблемних ліній:")
            for line_num, line_content in problem_lines:
                print(f"    {line_num}: {line_content}")

        if not redis_lines and not problem_lines:
            print_info("Redis код не знайдено")

    except Exception as e:
        print_warning(f"Помилка читання файлу: {e}")


def generate_fixes(critical_issues):
    """Крок 6: Генерація виправлень"""
    print_step(6, "Рекомендації для виправлення")

    if not critical_issues:
        print_success("Виправлення не потрібні!")
        return

    print("\n🛠️ Рекомендовані виправлення:")

    # Групуємо проблеми за файлами
    files_with_issues = {}
    for issue in critical_issues:
        filepath = issue['file']
        if filepath not in files_with_issues:
            files_with_issues[filepath] = []
        files_with_issues[filepath].append(issue)

    for filepath, issues in files_with_issues.items():
        print(f"\n📁 {filepath}:")
        for issue in issues:
            print(f"  🔧 Лінія {issue['line']}: {issue['problem']}")
            print(f"     Поточний код: {issue['code']}")

            # Пропонуємо виправлення
            suggested_fix = suggest_fix(issue['code'], issue['problem'])
            if suggested_fix:
                print(f"     {Colors.GREEN}Виправлення: {suggested_fix}{Colors.END}")


def suggest_fix(code, problem):
    """Пропозиція виправлення для конкретної проблеми"""

    if "int() викликається для REDIS_HOST" in problem:
        return "redis_host = os.getenv('REDIS_HOST', 'localhost')"

    elif "REDIS_HOST присвоюється змінній port" in problem:
        return "redis_port = int(os.getenv('REDIS_PORT', '6379'))"

    elif "redis.railway.internal передається в int()" in problem:
        return "Використовуйте REDIS_PORT замість REDIS_HOST"

    elif "6379 передається як host" in problem:
        return "Redis(host='redis.railway.internal', port=6379)"

    return "Перевірте документацію Redis"


def main():
    """Головна функція діагностики"""
    print_header("🔍 WINIX REDIS DIAGNOSTIC TOOL")
    print_info("Аналіз Redis конфігурації проекту WINIX")
    print_info(f"Робоча директорія: {os.getcwd()}")

    # Перевіряємо що ми в правильній директорії
    if not os.path.exists('quests') and not os.path.exists('main.py'):
        print_critical("Схоже що ви не в директорії backend/")
        print_info("Перейдіть в директорію backend/ та запустіть скрипт знову")
        sys.exit(1)

    problems = []

    # Крок 1: Змінні оточення
    env_problems = check_environment()
    problems.extend(env_problems)

    # Крок 2: Пошук файлів
    redis_files = find_python_files()

    # Крок 3: Критичні проблеми
    critical_issues = scan_for_critical_issues(redis_files)
    problems.extend(critical_issues)

    # Крок 4: Підозрілий код
    suspicious_issues = scan_suspicious_code(redis_files)

    # Крок 5: Ключові файли
    check_specific_files()

    # Крок 6: Виправлення
    generate_fixes(critical_issues)

    # Підсумок
    print_header("📊 ПІДСУМОК ДІАГНОСТИКИ")

    if critical_issues:
        print_critical(f"Знайдено {len(critical_issues)} критичних проблем")
        print("🚨 ЦЕ ПОЯСНЮЄ ЧОМУ WINIX QUESTS НЕДОСТУПНИЙ!")
    else:
        print_success("Критичних проблем не знайдено")

    if suspicious_issues:
        print_warning(f"Знайдено {len(suspicious_issues)} підозрілих місць")

    print(f"\n📋 Проаналізовано {len(redis_files)} файлів з Redis кодом")

    if critical_issues:
        print(f"\n{Colors.BOLD}{Colors.RED}НАСТУПНІ КРОКИ:{Colors.END}")
        print("1. Виправте критичні проблеми у вказаних файлах")
        print("2. Перезапустіть додаток")
        print("3. Перевірте що WINIX Quests тепер доступний")
    else:
        print(f"\n{Colors.BOLD}{Colors.GREEN}ВСЕ ГАРАЗД З REDIS КОНФІГУРАЦІЄЮ!{Colors.END}")
        print("Проблема може бути в іншому місці.")


if __name__ == "__main__":
    main()