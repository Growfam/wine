/**
 * formatters.js - Утилітарні функції для форматування даних
 */

import WinixRaffles from '../globals.js';

// Формати дати
const dateTimeFormat = new Intl.DateTimeFormat('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
});

/**
 * Форматування дати у зручний для відображення формат
 * @param {string|Date} timestamp - Відмітка часу або об'єкт Date
 * @returns {string} Відформатована дата
 */
export function formatDate(timestamp) {
    if (!timestamp) return '';

    try {
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) {
            return '';
        }
        return dateTimeFormat.format(date);
    } catch (error) {
        console.error('Помилка форматування дати:', error);
        return '';
    }
}

/**
 * Форматування валюти
 * @param {number} amount - Сума
 * @param {string} currency - Валюта (за замовчуванням 'WINIX')
 * @returns {string} Відформатована сума з валютою
 */
export function formatCurrency(amount, currency = 'WINIX') {
    return new Intl.NumberFormat('uk-UA').format(amount) + ' ' + currency;
}

/**
 * Додавання ведучого нуля до числа (для годин, хвилин тощо)
 * @param {number} num - Число для форматування
 * @returns {string} Число з ведучим нулем (якщо потрібно)
 */
export function padZero(num) {
    return num.toString().padStart(2, '0');
}

/**
 * Форматування списку місць для відображення
 * @param {Array<number>} places - Список місць
 * @returns {string} Відформатований текст місць
 */
export function formatPlaces(places) {
    if (!places || !Array.isArray(places) || places.length === 0) {
        return "Невідомо";
    }

    if (places.length === 1) {
        return `${places[0]} місце`;
    }

    // Шукаємо послідовні місця
    places.sort((a, b) => a - b);

    const ranges = [];
    let start = places[0];
    let end = places[0];

    for (let i = 1; i < places.length; i++) {
        if (places[i] === end + 1) {
            end = places[i];
        } else {
            if (start === end) {
                ranges.push(`${start}`);
            } else {
                ranges.push(`${start}-${end}`);
            }
            start = end = places[i];
        }
    }

    if (start === end) {
        ranges.push(`${start}`);
    } else {
        ranges.push(`${start}-${end}`);
    }

    return ranges.join(', ') + ' місця';
}

// Додаємо форматери в глобальний об'єкт для зворотної сумісності
WinixRaffles.utils.formatters = {
    formatDate,
    formatCurrency,
    padZero,
    formatPlaces
};

// Для зручного доступу додаємо форматери до utils
WinixRaffles.utils.formatDate = formatDate;
WinixRaffles.utils.formatCurrency = formatCurrency;
WinixRaffles.utils.padZero = padZero;
WinixRaffles.utils.formatPlaces = formatPlaces;

console.log("🎮 WINIX Raffles: Ініціалізація утиліт форматування");

// Експортуємо всі основні функції
export default {
    formatDate,
    formatCurrency,
    padZero,
    formatPlaces
};