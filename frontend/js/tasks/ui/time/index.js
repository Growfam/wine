/**
 * Time - централізований модуль для роботи з часом та таймерами
 * Об'єднує функціональність countdown.js та display.js
 *
 * @version 3.1.0
 */

// Імпортуємо основні функції з модуля countdown.js
import {
    init,
    createCountdown,
    stopCountdown,
    stopAllCountdowns,
    calculateUpdateFrequency,
    updateTimerDisplay,
    isExpired,
    getTimeLeft,
    cleanup
} from './countdown.js';

// Імпортуємо функції відображення з модуля display.js
import {
    formatTimeLeft,
    parseDate,
    pluralize,
    getUserTimezoneOffset,
    isValidDate,
    isLeapYear,
    createSimpleCountdown,
    updateSimpleTimerDisplay,
    injectTimerStyles,
    formatDate,
    getRelativeTime
} from './display.js';

// При імпорті модуля автоматично ін'єктуємо стилі
injectTimerStyles();

/**
 * Автоматична ініціалізація модуля при завантаженні сторінки
 */
document.addEventListener('DOMContentLoaded', function() {
    init();
});

/**
 * Перевірка поточного часу
 * @returns {Date} Поточна дата та час
 */
function getCurrentTime() {
    return new Date();
}

/**
 * Додавання часу до дати
 * @param {Date} date - Початкова дата
 * @param {Object} duration - Тривалість (days, hours, minutes, seconds)
 * @returns {Date} Нова дата
 */
function addTime(date, duration = {}) {
    const result = new Date(date);

    if (duration.days) result.setDate(result.getDate() + duration.days);
    if (duration.hours) result.setHours(result.getHours() + duration.hours);
    if (duration.minutes) result.setMinutes(result.getMinutes() + duration.minutes);
    if (duration.seconds) result.setSeconds(result.getSeconds() + duration.seconds);

    return result;
}

/**
 * Віднімання часу від дати
 * @param {Date} date - Початкова дата
 * @param {Object} duration - Тривалість (days, hours, minutes, seconds)
 * @returns {Date} Нова дата
 */
function subtractTime(date, duration = {}) {
    return addTime(date, {
        days: -1 * (duration.days || 0),
        hours: -1 * (duration.hours || 0),
        minutes: -1 * (duration.minutes || 0),
        seconds: -1 * (duration.seconds || 0)
    });
}

/**
 * Розрахунок різниці між датами
 * @param {Date} date1 - Перша дата
 * @param {Date} date2 - Друга дата
 * @returns {Object} Різниця у форматі {days, hours, minutes, seconds}
 */
function dateDifference(date1, date2) {
    const diff = Math.abs(date2 - date1);

    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((diff % (1000 * 60)) / 1000);

    return { days, hours, minutes, seconds };
}

// Експортуємо всі функції
export default {
    // Основні функції таймерів
    init,
    createCountdown,
    stopCountdown,
    stopAllCountdowns,
    isExpired,
    getTimeLeft,

    // Функції відображення
    formatTimeLeft,
    parseDate,
    formatDate,
    getRelativeTime,

    // Утиліти для роботи з датами
    getCurrentTime,
    addTime,
    subtractTime,
    dateDifference,
    isValidDate,
    isLeapYear,
    pluralize,
    getUserTimezoneOffset,

    // Прості таймери
    createSimpleCountdown,

    // Службові функції
    cleanup
};