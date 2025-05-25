#!/usr/bin/env python3
"""
🔍 Production Redis Debug Script
Перевірка різниць між локальним та production кодом
"""

import os


def check_cache_file():
    """Детальна перевірка файлу cache.py"""
    print("🔍 === ДЕТАЛЬНА ПЕРЕВІРКА CACHE.PY ===")

    cache_file = "quests/utils/cache.py"

    if not os.path.exists(cache_file):
        print("❌ Файл cache.py не знайдено!")
        return

    with open(cache_file, 'r', encoding='utf-8') as f:
        lines = f.readlines()

    print(f"📁 Файл: {cache_file}")
    print(f"📏 Всього ліній: {len(lines)}")

    # Перевіряємо лінії 525-535 (навколо 529)
    print("\n🔍 ЛІНІЇ 525-535 (навколо проблемної лінії 529):")
    for i in range(524, min(535, len(lines))):
        line_num = i + 1
        line_content = lines[i].rstrip()

        # Підсвічуємо Redis код
        if any(keyword in line_content.lower() for keyword in ['redis', 'host', 'port']):
            print(f"🔍 {line_num:3d}: {line_content}")
        else:
            print(f"   {line_num:3d}: {line_content}")

    # Перевіряємо лінії 700-710 (навколо 703)
    print("\n🔍 ЛІНІЇ 700-710 (навколо проблемної лінії 703):")
    for i in range(699, min(710, len(lines))):
        if i < len(lines):
            line_num = i + 1
            line_content = lines[i].rstrip()

            if any(keyword in line_content.lower() for keyword in ['cache_manager', 'cachemanager']):
                print(f"🔍 {line_num:3d}: {line_content}")
            else:
                print(f"   {line_num:3d}: {line_content}")


def search_problematic_patterns():
    """Пошук всіх потенційно проблемних патернів"""
    print("\n🔍 === ПОШУК ПРОБЛЕМНИХ ПАТЕРНІВ ===")

    cache_file = "quests/utils/cache.py"

    with open(cache_file, 'r', encoding='utf-8') as f:
        content = f.read()
        lines = content.split('\n')

    # Патерни що можуть бути проблемними на production
    patterns_to_check = [
        "int(os.getenv('REDIS_HOST'",
        "int(redis_host",
        "_load_config",
        "CacheManager()",
        "redis_port=int",
        "redis_host=os.getenv",
    ]

    for pattern in patterns_to_check:
        for i, line in enumerate(lines):
            if pattern in line:
                print(f"🔍 Знайдено '{pattern}' на лінії {i + 1}:")
                print(f"    {line.strip()}")


def check_environment_loading():
    """Перевірка як завантажуються змінні оточення"""
    print("\n🔍 === ПЕРЕВІРКА ЗАВАНТАЖЕННЯ ENV ===")

    # Перевіряємо чи є .env файл
    env_files = ['.env', '../.env', '.env.local', '.env.production']

    for env_file in env_files:
        if os.path.exists(env_file):
            print(f"✅ Знайдено: {env_file}")
            try:
                with open(env_file, 'r') as f:
                    content = f.read()
                    if 'REDIS' in content:
                        print(f"🔍 Redis змінні в {env_file}:")
                        for line in content.split('\n'):
                            if 'REDIS' in line and not line.startswith('#'):
                                print(f"    {line}")
            except:
                pass
        else:
            print(f"⚠️ Не знайдено: {env_file}")


def check_deployment_differences():
    """Перевірка можливих відмінностей у deployment"""
    print("\n🔍 === ПЕРЕВІРКА DEPLOYMENT ВІДМІННОСТЕЙ ===")

    # Перевіряємо Dockerfile
    if os.path.exists('../Dockerfile'):
        print("✅ Знайдено Dockerfile")
        with open('../Dockerfile', 'r') as f:
            content = f.read()
            if 'REDIS' in content:
                print("🔍 Redis згадки в Dockerfile:")
                for line in content.split('\n'):
                    if 'REDIS' in line:
                        print(f"    {line}")

    # Перевіряємо requirements.txt
    if os.path.exists('requirements.txt'):
        print("✅ Знайдено requirements.txt")
        with open('requirements.txt', 'r') as f:
            content = f.read()
            redis_deps = [line for line in content.split('\n') if 'redis' in line.lower()]
            if redis_deps:
                print("🔍 Redis залежності:")
                for dep in redis_deps:
                    print(f"    {dep}")

    # Перевіряємо railway.json або подібні
    config_files = ['railway.json', 'railway.toml', 'Procfile']
    for config_file in config_files:
        if os.path.exists(config_file):
            print(f"✅ Знайдено: {config_file}")


def main():
    print("🚀 === PRODUCTION REDIS DEBUG ===")
    print("Перевірка різниць між локальним та production кодом\n")

    check_cache_file()
    search_problematic_patterns()
    check_environment_loading()
    check_deployment_differences()

    print("\n" + "=" * 60)
    print("📊 ВИСНОВКИ:")
    print("✅ Локальний код виглядає правильно")
    print("❓ Проблема може бути в:")
    print("   1. Старій версії коду на Railway")
    print("   2. Різних змінних оточення на production")
    print("   3. Іншій версії requirements.txt")
    print("   4. Кешованому коді на Railway")

    print("\n🔧 РЕКОМЕНДАЦІЇ:")
    print("   1. Перезавантажте Railway deployment")
    print("   2. Перевірте змінні оточення на Railway")
    print("   3. Очистіть build cache на Railway")
    print("   4. Порівняйте код локально vs Railway")


if __name__ == "__main__":
    main()