/**
 * TimeUtils - модуль утиліт для роботи з часом
 * Надає:
 * - Форматування відображення дати та часу
 * - Функціональність таймерів зворотного відліку
 * - Утиліти для роботи з інтервалами часу
 */

window.TimeUtils = (function() {
    // Кеш активних таймерів
    const timers = {};
    let timerIdCounter = 0;

    /**
     * Форматування дати у людино-зрозумілий рядок
     * @param {Date|string|number} date - Дата для форматування
     * @param {string} format - Формат (short, medium, long, relative)
     * @returns {string} Відформатований рядок дати
     */
    function formatDate(date, format = 'medium') {
        // Конвертуємо вхідне значення у Date
        const dateObj = parseDate(date);
        if (!dateObj) return 'Невірна дата';

        switch (format) {
            case 'short':
                return `${padZero(dateObj.getDate())}.${padZero(dateObj.getMonth() + 1)}.${dateObj.getFullYear()}`;

            case 'long':
                return dateObj.toLocaleDateString('uk-UA', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });

            case 'time':
                return `${padZero(dateObj.getHours())}:${padZero(dateObj.getMinutes())}`;

            case 'datetime':
                return `${padZero(dateObj.getDate())}.${padZero(dateObj.getMonth() + 1)}.${dateObj.getFullYear()} ${padZero(dateObj.getHours())}:${padZero(dateObj.getMinutes())}`;

            case 'relative':
                return getRelativeTimeString(dateObj);

            case 'medium':
            default:
                return dateObj.toLocaleDateString('uk-UA');
        }
    }

    /**
     * Форматування залишку часу
     * @param {Date|string|number} endDate - Кінцева дата
     * @param {Object} options - Опції форматування
     * @returns {string} Відформатований залишок часу
     */
    function formatTimeLeft(endDate, options = {}) {
        const {
            showSeconds = true,
            shortFormat = false,
            hideZeroUnits = true
        } = options;

        // Конвертуємо кінцеву дату
        const endDateTime = parseDate(endDate);
        if (!endDateTime) return 'Невірна дата';

        // Поточний час
        const now = new Date();

        // Обчислюємо різницю в мілісекундах
        let diffMs = endDateTime - now;

        // Якщо дата вже минула
        if (diffMs <= 0) {
            return shortFormat ? '0с' : 'Закінчено';
        }

        // Обчислюємо дні, години, хвилини, секунди
        const days = Math.floor(diffMs / (1000 * 60 * 60 * 24));
        diffMs %= (1000 * 60 * 60 * 24);

        const hours = Math.floor(diffMs / (1000 * 60 * 60));
        diffMs %= (1000 * 60 * 60);

        const minutes = Math.floor(diffMs / (1000 * 60));
        diffMs %= (1000 * 60);

        const seconds = Math.floor(diffMs / 1000);

        // Форматуємо вивід
        const parts = [];

        // Додаємо дні, якщо є
        if (days > 0 || (!hideZeroUnits && days === 0 && (shortFormat || parts.length > 0))) {
            parts.push(shortFormat ? `${days}д` : `${days} ${pluralize(days, 'день', 'дні', 'днів')}`);
        }

        // Додаємо години, якщо є
        if (hours > 0 || (!hideZeroUnits && hours === 0 && (shortFormat || parts.length > 0))) {
            parts.push(shortFormat ? `${hours}г` : `${hours} ${pluralize(hours, 'година', 'години', 'годин')}`);
        }

        // Додаємо хвилини, якщо є або якщо немає більших одиниць
        if (minutes > 0 || days === 0 && hours === 0 || (!hideZeroUnits && minutes === 0 && (shortFormat || parts.length > 0))) {
            parts.push(shortFormat ? `${minutes}хв` : `${minutes} ${pluralize(minutes, 'хвилина', 'хвилини', 'хвилин')}`);
        }

        // Додаємо секунди, якщо потрібно
        if (showSeconds && (seconds > 0 || parts.length === 0 || (!hideZeroUnits && seconds === 0 && parts.length > 0))) {
            parts.push(shortFormat ? `${seconds}с` : `${seconds} ${pluralize(seconds, 'секунда', 'секунди', 'секунд')}`);
        }

        // З'єднуємо частини
        return parts.join(shortFormat ? ' ' : ' ');
    }

    /**
     * Створення таймера зворотного відліку
     * @param {Object} options - Опції таймера
     * @returns {number} ID таймера
     */
    function createCountdown(options) {
        const {
            endDate,
            onTick,
            onComplete,
            tickInterval = 1000,
            element = null,
            format = 'short'
        } = options;

        // Генеруємо унікальний ID для таймера
        const timerId = ++timerIdCounter;

        // Перевіряємо, чи правильна кінцева дата
        const endDateTime = parseDate(endDate);
        if (!endDateTime) {
            console.error('Невірна кінцева дата для таймера:', endDate);
            return -1;
        }

        // Функція оновлення таймера
        const updateTimer = () => {
            const now = new Date();
            const timeLeft = endDateTime - now;

            // Якщо час вийшов
            if (timeLeft <= 0) {
                // Викликаємо функцію завершення, якщо є
                if (typeof onComplete === 'function') {
                    onComplete();
                }

                // Оновлюємо елемент, якщо він є
                if (element && element instanceof HTMLElement) {
                    element.textContent = 'Закінчено';
                    element.classList.add('expired');
                }

                // Очищаємо таймер
                clearInterval(timers[timerId].intervalId);
                delete timers[timerId];

                return;
            }

            // Форматуємо залишок часу
            const formattedTime = formatTimeLeft(endDateTime, {
                showSeconds: true,
                shortFormat: format === 'short',
                hideZeroUnits: format !== 'full'
            });

            // Викликаємо функцію тіка, якщо є
            if (typeof onTick === 'function') {
                onTick(formattedTime, timeLeft);
            }

            // Оновлюємо елемент, якщо він є
            if (element && element instanceof HTMLElement) {
                element.textContent = formattedTime;
            }
        };

        // Запускаємо таймер
        const intervalId = setInterval(updateTimer, tickInterval);

        // Зберігаємо інформацію про таймер
        timers[timerId] = {
            intervalId,
            endDate: endDateTime,
            element
        };

        // Виконуємо перше оновлення
        updateTimer();

        return timerId;
    }

    /**
     * Зупинка таймера зворотного відліку
     * @param {number} timerId - ID таймера
     * @returns {boolean} Чи успішно зупинено
     */
    function stopCountdown(timerId) {
        if (!timers[timerId]) return false;

        clearInterval(timers[timerId].intervalId);
        delete timers[timerId];

        return true;
    }

    /**
     * Перезапуск таймера зворотного відліку
     * @param {number} timerId - ID таймера
     * @param {Date|string|number} newEndDate - Нова кінцева дата
     * @returns {boolean} Чи успішно перезапущено
     */
    function restartCountdown(timerId, newEndDate) {
        if (!timers[timerId]) return false;

        const timerInfo = timers[timerId];

        // Зупиняємо поточний таймер
        clearInterval(timerInfo.intervalId);

        // Новий кінцевий час
        const endDateTime = newEndDate ? parseDate(newEndDate) : timerInfo.endDate;

        // Перевіряємо кінцеву дату
        if (!endDateTime) {
            console.error('Невірна кінцева дата для перезапуску таймера:', newEndDate);
            delete timers[timerId];
            return false;
        }

        return true;
    }

    /**
     * Зупинка всіх таймерів
     */
    function stopAllCountdowns() {
        Object.keys(timers).forEach(timerId => {
            clearInterval(timers[timerId].intervalId);
        });

        // Очищаємо об'єкт таймерів
        Object.keys(timers).forEach(key => {
            delete timers[key];
        });
    }

    /**
     * Отримання відносного часу у зручному форматі
     * @param {Date} date - Дата для порівняння
     * @returns {string} Відносний час
     */
    function getRelativeTimeString(date) {
        const now = new Date();
        const diffMs = now - date;

        // Конвертуємо різницю в секунди
        const diffSec = Math.floor(diffMs / 1000);

        // Менше хвилини
        if (diffSec < 60) {
            return 'щойно';
        }

        // Менше години
        if (diffSec < 3600) {
            const minutes = Math.floor(diffSec / 60);
            return `${minutes} ${pluralize(minutes, 'хвилину', 'хвилини', 'хвилин')} тому`;
        }

        // Менше доби
        if (diffSec < 86400) {
            const hours = Math.floor(diffSec / 3600);
            return `${hours} ${pluralize(hours, 'годину', 'години', 'годин')} тому`;
        }

        // Менше тижня
        if (diffSec < 604800) {
            const days = Math.floor(diffSec / 86400);
            return `${days} ${pluralize(days, 'день', 'дні', 'днів')} тому`;
        }

        // Менше місяця
        if (diffSec < 2592000) {
            const weeks = Math.floor(diffSec / 604800);
            return `${weeks} ${pluralize(weeks, 'тиждень', 'тижні', 'тижнів')} тому`;
        }

        // Менше року
        if (diffSec < 31536000) {
            const months = Math.floor(diffSec / 2592000);
            return `${months} ${pluralize(months, 'місяць', 'місяці', 'місяців')} тому`;
        }

        // Більше року
        const years = Math.floor(diffSec / 31536000);
        return `${years} ${pluralize(years, 'рік', 'роки', 'років')} тому`;
    }

    /**
     * Склонення слова залежно від числа
     * @param {number} number - Число
     * @param {string} one - Форма для 1
     * @param {string} few - Форма для 2-4
     * @param {string} many - Форма для 5-20
     * @returns {string} Правильна форма слова
     */
    function pluralize(number, one, few, many) {
        if (number % 10 === 1 && number % 100 !== 11) {
            return one;
        } else if ([2, 3, 4].includes(number % 10) && ![12, 13, 14].includes(number % 100)) {
            return few;
        } else {
            return many;
        }
    }

    /**
     * Перетворення різних форматів дати в об'єкт Date
     * @param {Date|string|number} date - Дата для парсингу
     * @returns {Date|null} Об'єкт Date або null
     */
    function parseDate(date) {
        if (date instanceof Date) {
            return date;
        }

        if (typeof date === 'string') {
            // Перевіряємо ISO формат
            const parsedDate = new Date(date);
            if (!isNaN(parsedDate.getTime())) {
                return parsedDate;
            }

            // Спроба парсити український формат дати (дд.мм.рррр)
            const dateParts = date.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})$/);
            if (dateParts) {
                return new Date(parseInt(dateParts[3]), parseInt(dateParts[2]) - 1, parseInt(dateParts[1]));
            }

            return null;
        }

        if (typeof date === 'number') {
            return new Date(date);
        }

        return null;
    }

    /**
     * Додавання нуля перед числом, якщо воно менше 10
     * @param {number} num - Число
     * @returns {string} Число з нулем, якщо потрібно
     */
    function padZero(num) {
        return num < 10 ? `0${num}` : num.toString();
    }

    // Публічний API модуля
    return {
        formatDate,
        formatTimeLeft,
        createCountdown,
        stopCountdown,
        restartCountdown,
        stopAllCountdowns,
        getRelativeTimeString,
        pluralize,
        parseDate
    };
})();