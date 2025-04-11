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

const dateOnlyFormat = new Intl.DateTimeFormat('uk-UA', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric'
});

const timeOnlyFormat = new Intl.DateTimeFormat('uk-UA', {
    hour: '2-digit',
    minute: '2-digit'
});

/**
 * Форматування дати у зручний для відображення формат
 * @param {string|Date} timestamp - Відмітка часу або об'єкт Date
 * @param {string} format - Формат дати ('full', 'date', 'time')
 * @returns {string} Відформатована дата
 */
export function formatDate(timestamp, format = 'full') {
    if (!timestamp) return '';

    try {
        const date = new Date(timestamp);
        if (isNaN(date.getTime())) {
            return '';
        }

        switch (format) {
            case 'date':
                return dateOnlyFormat.format(date);
            case 'time':
                return timeOnlyFormat.format(date);
            case 'full':
            default:
                return dateTimeFormat.format(date);
        }
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
    if (isNaN(amount)) {
        return '0 ' + currency;
    }
    return new Intl.NumberFormat('uk-UA').format(amount) + ' ' + currency;
}

/**
 * Форматування числа з використанням роздільників
 * @param {number} num - Число для форматування
 * @returns {string} Відформатоване число
 */
export function formatNumber(num) {
    if (isNaN(num)) {
        return '0';
    }
    return new Intl.NumberFormat('uk-UA').format(num);
}

/**
 * Додавання ведучого нуля до числа (для годин, хвилин тощо)
 * @param {number} num - Число для форматування
 * @returns {string} Число з ведучим нулем (якщо потрібно)
 */
export function padZero(num) {
    if (isNaN(num)) {
        return '00';
    }
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

/**
 * Форматування часу, що залишився (для таймерів)
 * @param {number} timeLeftMs - Час у мілісекундах
 * @param {string} format - Формат ('short', 'full')
 * @returns {Object} Об'єкт з відформатованими значеннями
 */
export function formatTimeLeft(timeLeftMs, format = 'full') {
    if (timeLeftMs <= 0) {
        return {
            days: '00',
            hours: '00',
            minutes: '00',
            seconds: '00',
            text: 'Завершено'
        };
    }

    const days = Math.floor(timeLeftMs / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeLeftMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeLeftMs % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeLeftMs % (1000 * 60)) / 1000);

    let text = '';
    if (format === 'short') {
        if (days > 0) {
            text = `${days}д ${hours}г`;
        } else {
            text = `${hours}г ${minutes}хв`;
        }
    } else {
        if (days > 0) {
            text = `${days} днів ${padZero(hours)}:${padZero(minutes)}`;
        } else {
            text = `${padZero(hours)}:${padZero(minutes)}:${padZero(seconds)}`;
        }
    }

    return {
        days: padZero(days),
        hours: padZero(hours),
        minutes: padZero(minutes),
        seconds: padZero(seconds),
        text
    };
}

/**
 * Розрахунок прогресу за часом
 * @param {Date|string} startTime - Час початку
 * @param {Date|string} endTime - Час завершення
 * @returns {number} Відсоток прогресу (0-100)
 */
export function calculateProgressByTime(startTime, endTime) {
    if (!startTime || !endTime) {
        return 0;
    }

    try {
        const now = Date.now();
        const start = new Date(startTime).getTime();
        const end = new Date(endTime).getTime();

        if (isNaN(start) || isNaN(end)) {
            return 0;
        }

        const totalDuration = end - start;
        if (totalDuration <= 0) {
            return 0;
        }

        const elapsed = now - start;
        return Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
    } catch (error) {
        console.error("Помилка розрахунку прогресу:", error);
        return 0;
    }
}

/**
 * Генерація HTML для розподілу призів
 * @param {Object} prizeDistribution - Об'єкт з розподілом призів
 * @returns {string} - HTML-розмітка
 */
export function generatePrizeDistributionHTML(prizeDistribution) {
    if (!prizeDistribution || typeof prizeDistribution !== 'object' || Object.keys(prizeDistribution).length === 0) {
        return '<div class="prize-item"><span class="prize-place">Інформація відсутня</span></div>';
    }

    let html = '';
    const places = Object.keys(prizeDistribution).sort((a, b) => parseInt(a) - parseInt(b));

    // Групуємо місця з однаковими призами
    const groupedPrizes = {};

    places.forEach(place => {
        const prize = prizeDistribution[place];
        if (!prize) return;

        const key = `${prize.amount}-${prize.currency}`;

        if (!groupedPrizes[key]) {
            groupedPrizes[key] = {
                amount: prize.amount,
                currency: prize.currency,
                places: []
            };
        }

        groupedPrizes[key].places.push(parseInt(place));
    });

    // Створюємо HTML для кожної групи призів
    for (const key in groupedPrizes) {
        const group = groupedPrizes[key];
        const placesText = formatPlaces(group.places);

        html += `
            <div class="prize-item">
                <span class="prize-place">${placesText}:</span>
                <span class="prize-value">${group.amount} ${group.currency}</span>
            </div>
        `;
    }

    return html;
}

// Додаємо форматери в глобальний об'єкт для зворотної сумісності
WinixRaffles.utils.formatters = {
    formatDate,
    formatCurrency,
    formatNumber,
    padZero,
    formatPlaces,
    formatTimeLeft,
    calculateProgressByTime,
    generatePrizeDistributionHTML
};

// Для зручного доступу додаємо форматери до utils
Object.assign(WinixRaffles.utils, WinixRaffles.utils.formatters);

console.log("🎮 WINIX Raffles: Ініціалізація утиліт форматування");

// Експортуємо всі основні функції
export default {
    formatDate,
    formatCurrency,
    formatNumber,
    padZero,
    formatPlaces,
    formatTimeLeft,
    calculateProgressByTime,
    generatePrizeDistributionHTML
};