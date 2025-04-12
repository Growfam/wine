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
        let date;
        if (timestamp instanceof Date) {
            date = timestamp;
        } else {
            date = new Date(timestamp);
        }

        if (isNaN(date.getTime())) {
            console.warn("Невалідна дата:", timestamp);
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
    try {
        // Перевіряємо, що amount є числом
        const numAmount = Number(amount);
        if (isNaN(numAmount)) {
            return '0 ' + currency;
        }

        return new Intl.NumberFormat('uk-UA').format(numAmount) + ' ' + currency;
    } catch (error) {
        console.error('Помилка форматування валюти:', error);
        return '0 ' + currency;
    }
}

/**
 * Форматування числа з використанням роздільників
 * @param {number} num - Число для форматування
 * @returns {string} Відформатоване число
 */
export function formatNumber(num) {
    try {
        // Перевіряємо, що num є числом
        const number = Number(num);
        if (isNaN(number)) {
            return '0';
        }

        return new Intl.NumberFormat('uk-UA').format(number);
    } catch (error) {
        console.error('Помилка форматування числа:', error);
        return '0';
    }
}

/**
 * Додавання ведучого нуля до числа (для годин, хвилин тощо)
 * @param {number} num - Число для форматування
 * @returns {string} Число з ведучим нулем (якщо потрібно)
 */
export function padZero(num) {
    try {
        // Перевіряємо, що num є числом
        const number = Number(num);
        if (isNaN(number)) {
            return '00';
        }

        return number.toString().padStart(2, '0');
    } catch (error) {
        console.error('Помилка додавання ведучого нуля:', error);
        return '00';
    }
}

/**
 * Форматування списку місць для відображення
 * @param {Array<number>} places - Список місць
 * @returns {string} Відформатований текст місць
 */
export function formatPlaces(places) {
    try {
        if (!places || !Array.isArray(places) || places.length === 0) {
            return "Невідомо";
        }

        // Фільтруємо невалідні значення
        const validPlaces = places.filter(place => !isNaN(Number(place)));

        if (validPlaces.length === 0) {
            return "Невідомо";
        }

        if (validPlaces.length === 1) {
            return `${validPlaces[0]} місце`;
        }

        // Шукаємо послідовні місця
        validPlaces.sort((a, b) => Number(a) - Number(b));

        const ranges = [];
        let start = validPlaces[0];
        let end = validPlaces[0];

        for (let i = 1; i < validPlaces.length; i++) {
            if (validPlaces[i] === end + 1) {
                end = validPlaces[i];
            } else {
                if (start === end) {
                    ranges.push(`${start}`);
                } else {
                    ranges.push(`${start}-${end}`);
                }
                start = end = validPlaces[i];
            }
        }

        if (start === end) {
            ranges.push(`${start}`);
        } else {
            ranges.push(`${start}-${end}`);
        }

        return ranges.join(', ') + ' місця';
    } catch (error) {
        console.error('Помилка форматування місць:', error);
        return "Невідомо";
    }
}

/**
 * Форматування часу, що залишився (для таймерів)
 * @param {number} timeLeftMs - Час у мілісекундах
 * @param {string} format - Формат ('short', 'full')
 * @returns {Object} Об'єкт з відформатованими значеннями
 */
export function formatTimeLeft(timeLeftMs, format = 'full') {
    try {
        // Перевіряємо вхідні дані
        const timeLeft = Number(timeLeftMs);

        if (isNaN(timeLeft) || timeLeft <= 0) {
            return {
                days: '00',
                hours: '00',
                minutes: '00',
                seconds: '00',
                text: 'Завершено'
            };
        }

        // Розрахунок компонентів часу
        const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
        const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

        // Форматування тексту в залежності від формату
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
    } catch (error) {
        console.error('Помилка форматування часу:', error);
        return {
            days: '00',
            hours: '00',
            minutes: '00',
            seconds: '00',
            text: 'Помилка'
        };
    }
}

/**
 * Розрахунок прогресу за часом
 * @param {Date|string} startTime - Час початку
 * @param {Date|string} endTime - Час завершення
 * @returns {number} Відсоток прогресу (0-100)
 */
export function calculateProgressByTime(startTime, endTime) {
    try {
        if (!startTime || !endTime) {
            return 0;
        }

        // Перетворюємо дати у timestamp
        let start, end;

        if (startTime instanceof Date) {
            start = startTime.getTime();
        } else {
            const startDate = new Date(startTime);
            if (isNaN(startDate.getTime())) {
                console.warn('Невалідна дата початку:', startTime);
                return 0;
            }
            start = startDate.getTime();
        }

        if (endTime instanceof Date) {
            end = endTime.getTime();
        } else {
            const endDate = new Date(endTime);
            if (isNaN(endDate.getTime())) {
                console.warn('Невалідна дата завершення:', endTime);
                return 0;
            }
            end = endDate.getTime();
        }

        // Перевіряємо логіку дат
        if (end <= start) {
            console.warn('Дата завершення повинна бути пізніше за дату початку');
            return 0;
        }

        const now = Date.now();
        const totalDuration = end - start;

        // Перевіряємо на валідність тривалості
        if (totalDuration <= 0) {
            return 0;
        }

        // Розраховуємо скільки часу пройшло
        const elapsed = now - start;

        // Обмежуємо прогрес від 0 до 100%
        if (elapsed <= 0) return 0;
        if (elapsed >= totalDuration) return 100;

        const progress = (elapsed / totalDuration) * 100;

        // Округляємо до цілого числа
        return Math.round(progress);
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
    try {
        // Перевіряємо вхідні дані
        if (!prizeDistribution || typeof prizeDistribution !== 'object') {
            return '<div class="prize-item"><span class="prize-place">Інформація відсутня</span></div>';
        }

        // Перевіряємо, чи є хоч якісь дані
        const keys = Object.keys(prizeDistribution);
        if (keys.length === 0) {
            return '<div class="prize-item"><span class="prize-place">Інформація відсутня</span></div>';
        }

        let html = '';

        // Створюємо масив місць з валідними числовими ключами
        const places = keys
            .filter(key => !isNaN(parseInt(key)))
            .map(key => parseInt(key))
            .sort((a, b) => a - b);

        if (places.length === 0) {
            return '<div class="prize-item"><span class="prize-place">Інформація відсутня</span></div>';
        }

        // Групуємо місця з однаковими призами
        const groupedPrizes = {};

        places.forEach(place => {
            const prize = prizeDistribution[place];
            if (!prize) return;

            // Перевіряємо, що prize має валідний формат
            const amount = prize.amount !== undefined ? prize.amount :
                           (typeof prize === 'number' ? prize : 0);
            const currency = prize.currency || 'WINIX';

            if (amount === 0) return;

            const key = `${amount}-${currency}`;

            if (!groupedPrizes[key]) {
                groupedPrizes[key] = {
                    amount,
                    currency,
                    places: []
                };
            }

            groupedPrizes[key].places.push(place);
        });

        // Якщо нема валідних призів
        if (Object.keys(groupedPrizes).length === 0) {
            return '<div class="prize-item"><span class="prize-place">Інформація відсутня</span></div>';
        }

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
    } catch (error) {
        console.error('Помилка генерації HTML для розподілу призів:', error);
        return '<div class="prize-item"><span class="prize-place">Помилка відображення</span></div>';
    }
}

// Додаємо форматери в глобальний об'єкт для зворотної сумісності
if (WinixRaffles && WinixRaffles.utils) {
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
}

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