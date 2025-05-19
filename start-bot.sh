#!/bin/bash

echo "🚀 Запуск WINIX Telegram Bot..."

# Перевіряємо чи існує Node.js
if ! command -v node &> /dev/null; then
    echo "❌ Node.js не встановлено. Встановіть Node.js спершу."
    exit 1
fi

# Перевіряємо чи існує npm
if ! command -v npm &> /dev/null; then
    echo "❌ npm не встановлено. Встановіть npm спершу."
    exit 1
fi

# Переходимо в папку бота
cd telegram-bot

# Перевіряємо чи встановлені залежності
if [ ! -d "node_modules" ]; then
    echo "📦 Встановлення залежностей..."
    npm install
fi

# Запускаємо бота
echo "🤖 Запускаємо бота..."
npm start

# Якщо бот завершився з помилкою
if [ $? -ne 0 ]; then
    echo "❌ Бот завершився з помилкою"
    exit 1
fi