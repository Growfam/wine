/**
 * Display - функції для відображення таймерів
 * Відповідає за:
 * - Форматування часу для відображення
 * - Відображення таймерів різних форматів
 * - Парсинг та обробку дат
 *
 * @version 3.1.0
 */

import DOMUtils from '../../utils/DOMUtils.js';

/**
 * Форматування залишку часу
 * @param {number} timeLeft - Залишок часу в мс
 * @param {string} format - Формат відображення (short, full)
 * @returns {string} Відформатований час
 */
export function formatTimeLeft(timeLeft, format = 'short') {
    if (timeLeft <= 0) {
        return 'Закінчено';
    }

    // Обчислюємо компоненти часу
    const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

    // Короткий формат
    if (format === 'short') {
        if (days > 0) {
            return `${days}д ${hours}г`;
        } else if (hours > 0) {
            return `${hours}г ${minutes}хв`;
        } else {
            return `${minutes}хв ${seconds}с`;
        }
    }

    // Повний формат
    const parts = [];

    if (days > 0) {
        parts.push(`${days} ${pluralize(days, 'день', 'дні', 'днів')}`);
    }

    if (hours > 0 || days > 0) {
        parts.push(`${hours} ${pluralize(hours, 'година', 'години', 'годин')}`);
    }

    if (minutes > 0 || hours > 0 || days > 0) {
        parts.push(`${minutes} ${pluralize(minutes, 'хвилина', 'хвилини', 'хвилин')}`);
    }

    parts.push(`${seconds} ${pluralize(seconds, 'секунда', 'секунди', 'секунд')}`);

    return parts.join(' ');
}

/**
 * Перетворення різних форматів дати в об'єкт Date
 * @param {Date|string|number} date - Дата для парсингу
 * @returns {Date|null} Об'єкт Date або null
 */
export function parseDate(date) {
    if (!date) return null;

    // Якщо вже об'єкт Date
    if (date instanceof Date) {
        return new Date(date);
    }

    // Якщо число (timestamp)
    if (typeof date === 'number') {
        // Для Unix timestamp (секунди)
        if (date < 10000000000) {
            return new Date(date * 1000);
        }
        return new Date(date);
    }

    // Якщо рядок
    if (typeof date === 'string') {
        // Спочатку пробуємо стандартний парсинг
        const parsedDate = new Date(date);
        if (!isNaN(parsedDate.getTime())) {
            return parsedDate;
        }

        // Український формат дд.мм.рррр
        const uaMatch = date.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
        if (uaMatch) {
            const [_, day, month, year, hours = 0, minutes = 0, seconds = 0] = uaMatch;
            return new Date(
                parseInt(year),
                parseInt(month) - 1,
                parseInt(day),
                parseInt(hours),
                parseInt(minutes),
                parseInt(seconds)
            );
        }
    }

    return null;
}

/**
 * Склонення слова залежно від числа
 * @param {number} n - Число
 * @param {string} form1 - Форма для 1
 * @param {string} form2 - Форма для 2-4
 * @param {string} form5 - Форма для 5-9, 0
 * @returns {string} Правильна форма слова
 */
export function pluralize(n, form1, form2, form5) {
    n = Math.abs(n) % 100;
    const n1 = n % 10;

    if (n > 10 && n < 20) return form5;
    if (n1 > 1 && n1 < 5) return form2;
    if (n1 === 1) return form1;

    return form5;
}

/**
 * Визначення часового поясу користувача
 * @returns {number} Зміщення часового поясу в хвилинах
 */
export function getUserTimezoneOffset() {
    return new Date().getTimezoneOffset();
}

/**
 * Перевірка, чи дата є коректною
 * @param {number} year - Рік
 * @param {number} month - Місяць (1-12)
 * @param {number} day - День
 * @returns {boolean} Результат перевірки
 */
export function isValidDate(year, month, day) {
    // Перевіряємо межі
    if (year < 1900 || year > 2100 || month < 1 || month > 12 || day < 1 || day > 31) {
        return false;
    }

    // Перевіряємо кількість днів у місяці
    const daysInMonth = [31, (isLeapYear(year) ? 29 : 28), 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
    return day <= daysInMonth[month - 1];
}

/**
 * Перевірка високосного року
 * @param {number} year - Рік
 * @returns {boolean} Високосний рік чи ні
 */
export function isLeapYear(year) {
    return (year % 4 === 0 && year % 100 !== 0) || (year % 400 === 0);
}

/**
 * Створення простого таймера зворотнього відліку
 * @param {HTMLElement} element - DOM елемент для відображення
 * @param {string|Date} endDate - Кінцева дата
 * @param {Function} onComplete - Функція, яка викликається при завершенні
 * @returns {number} ID інтервалу для очистки
 */
export function createSimpleCountdown(element, endDate, onComplete) {
    // Парсимо кінцеву дату
    const endDateTime = parseDate(endDate);
    if (!endDateTime) return -1;

    // Початкове відображення
    updateSimpleTimerDisplay(element, endDateTime);

    // Створюємо інтервал для оновлення
    const intervalId = setInterval(() => {
        const now = new Date();
        const timeLeft = endDateTime - now;

        if (timeLeft <= 0) {
            // Таймер закінчився
            clearInterval(intervalId);
            element.textContent = 'Закінчено';
            element.classList.add('expired');

            // Викликаємо обробник завершення
            if (typeof onComplete === 'function') {
                onComplete();
            }
        } else {
            // Оновлюємо відображення
            updateSimpleTimerDisplay(element, endDateTime);
        }
    }, 1000);

    // Зберігаємо ID інтервалу для подальшого очищення
    element.dataset.timerId = intervalId;
    return intervalId;
}

/**
 * Оновлення відображення простого таймера
 * @param {HTMLElement} element - DOM елемент для відображення
 * @param {Date} endDate - Кінцева дата
 */
export function updateSimpleTimerDisplay(element, endDate) {
    const now = new Date();
    const timeLeft = endDate - now;

    if (timeLeft <= 0) {
        element.textContent = 'Закінчено';
        return;
    }

    element.textContent = formatTimeLeft(timeLeft, 'short');
}

/**
 * Додавання CSS стилів для таймерів
 */
export function injectTimerStyles() {
    const css = `
        /* Таймер зворотного відліку */
        .countdown-timer {
            display: inline-block;
            padding: 0.3125rem 0.625rem;
            border-radius: 0.625rem;
            font-weight: 600;
            transition: all 0.3s ease;
            position: relative;
        }
        
        .countdown-timer.active {
            color: #FFD700;
        }
        
        .countdown-timer.expired {
            color: #F44336;
        }
        
        .countdown-timer.expired-animation {
            animation: expired-pulse 0.5s ease-out 3;
        }
        
        .countdown-timer.warning {
            color: #FF9800;
        }
        
        .countdown-timer.critical {
            color: #FF5722;
            animation: critical-pulse 1s infinite;
        }
        
        @keyframes expired-pulse {
            0%, 100% { transform: scale(1); opacity: 0.7; }
            50% { transform: scale(1.1); opacity: 1; color: #FF0000; }
        }
        
        @keyframes critical-pulse {
            0%, 100% { transform: scale(1); }
            50% { transform: scale(1.05); }
        }
    `;

    DOMUtils.injectStyles('countdown-styles', css);
}

/**
 * Форматування дати у рядок
 * @param {Date} date - Дата для форматування
 * @param {string} format - Формат ('short', 'medium', 'long')
 * @returns {string} Відформатована дата
 */
export function formatDate(date, format = 'medium') {
    if (!date) return '';

    const d = parseDate(date);
    if (!d) return '';

    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();

    switch (format) {
        case 'short':
            return `${day}.${month}.${year}`;
        case 'medium':
            const hours = d.getHours().toString().padStart(2, '0');
            const minutes = d.getMinutes().toString().padStart(2, '0');
            return `${day}.${month}.${year} ${hours}:${minutes}`;
        case 'long':
            const monthNames = [
                'січня', 'лютого', 'березня', 'квітня', 'травня', 'червня',
                'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'
            ];
            return `${day} ${monthNames[d.getMonth()]} ${year} року`;
        default:
            return `${day}.${month}.${year}`;
    }
}

/**
 * Отримання відносного часу (наприклад, "5 хвилин тому")
 * @param {Date} date - Дата для порівняння
 * @returns {string} Відносний час
 */
export function getRelativeTime(date) {
    const d = parseDate(date);
    if (!d) return '';

    const now = new Date();
    const diff = Math.floor((now - d) / 1000); // різниця в секундах

    // В минулому
    if (diff >= 0) {
        if (diff < 60) return 'щойно';
        if (diff < 3600) {
            const minutes = Math.floor(diff / 60);
            return `${minutes} ${pluralize(minutes, 'хвилину', 'хвилини', 'хвилин')} тому`;
        }
        if (diff < 86400) {
            const hours = Math.floor(diff / 3600);
            return `${hours} ${pluralize(hours, 'годину', 'години', 'годин')} тому`;
        }
        if (diff < 604800) {
            const days = Math.floor(diff / 86400);
            return `${days} ${pluralize(days, 'день', 'дні', 'днів')} тому`;
        }
    }
    // В майбутньому
    else {
        const absDiff = Math.abs(diff);
        if (absDiff < 60) return 'через мить';
        if (absDiff < 3600) {
            const minutes = Math.floor(absDiff / 60);
            return `через ${minutes} ${pluralize(minutes, 'хвилину', 'хвилини', 'хвилин')}`;
        }
        if (absDiff < 86400) {
            const hours = Math.floor(absDiff / 3600);
            return `через ${hours} ${pluralize(hours, 'годину', 'години', 'годин')}`;
        }
        if (absDiff < 604800) {
            const days = Math.floor(absDiff / 86400);
            return `через ${days} ${pluralize(days, 'день', 'дні', 'днів')}`;
        }
    }

    // Для більших проміжків часу використовуємо звичайне форматування
    return formatDate(d, 'medium');
}