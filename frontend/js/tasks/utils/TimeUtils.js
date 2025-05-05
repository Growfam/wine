/**
 * TimeUtils - оптимізований модуль для роботи з часом та датами
 * Відповідає за:
 * - Ефективне форматування дат і часу
 * - Управління таймерами зворотного відліку
 * - Обробку відносного часу
 *
 * @version 3.0.0
 */

// Колекція таймерів з використанням Map для кращої продуктивності
const timers = new Map();

// Кеш DOM-елементів таймерів
const timerElements = new Map();

// Стан модуля
const state = {
    timerIdCounter: 0,       // Лічильник для генерації ID таймерів
    masterTimerId: null,     // ID головного таймера
    activeTimersCount: 0,    // Кількість активних таймерів
    lastUpdateTime: 0        // Час останнього оновлення
};

// Налаштування за замовчуванням
const config = {
    updateInterval: 1000,       // Інтервал оновлення в мс
    autoCleanup: true,          // Автоматичне очищення таймерів
    useLocalTimezone: true,     // Використовувати локальний часовий пояс
    adjustForTimezone: true     // Коригувати відображення за часовим поясом
};

/**
 * Ініціалізація модуля
 * @param {Object} options - Параметри конфігурації
 */
export function init(options = {}) {
    // Оновлюємо налаштування
    Object.assign(config, options);

    console.log("TimeUtils: Ініціалізація модуля");

    // Ініціалізуємо існуючі таймери на сторінці
    initExistingTimers();

    // Налаштовуємо обробники подій
    setupEventListeners();

    // Очищаємо ресурси при виході зі сторінки
    window.addEventListener('beforeunload', cleanup);
}

/**
 * Ініціалізація існуючих таймерів на сторінці
 */
function initExistingTimers() {
    // Знаходимо всі елементи з атрибутом data-end-date
    const timerElements = document.querySelectorAll('[data-end-date]:not([data-timer-initialized])');

    if (timerElements.length > 0) {
        console.log(`TimeUtils: Знайдено ${timerElements.length} таймерів на сторінці`);

        // Ініціалізуємо кожен таймер
        timerElements.forEach(element => {
            const endDate = element.getAttribute('data-end-date');
            const format = element.getAttribute('data-format') || 'short';
            const onComplete = element.getAttribute('data-on-complete');

            // Створюємо таймер для елемента
            createCountdown({
                element,
                endDate,
                format,
                onComplete: onComplete ? new Function(`return ${onComplete}`)() : null
            });

            // Позначаємо як ініціалізований
            element.setAttribute('data-timer-initialized', 'true');
        });
    }
}

/**
 * Налаштування обробників подій
 */
function setupEventListeners() {
    // Відстежуємо події додавання таймера
    document.addEventListener('countdown-added', function(event) {
        if (event.detail && event.detail.element) {
            createCountdown(event.detail);
        }
    });

    // Відстежуємо зміни в DOM для автоматичного очищення таймерів
    if (config.autoCleanup && window.MutationObserver) {
        setupDomObserver();
    }
}

/**
 * Налаштування спостерігача за DOM
 */
function setupDomObserver() {
    const observer = new MutationObserver(mutations => {
        mutations.forEach(mutation => {
            // Перевіряємо видалені вузли
            mutation.removedNodes.forEach(node => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    // Шукаємо таймери в видаленому вузлі
                    cleanupTimersForNode(node);
                }
            });
        });
    });

    // Спостерігаємо за всім документом
    observer.observe(document.body, {
        childList: true,
        subtree: true
    });
}

/**
 * Очищення таймерів для видаленого вузла
 * @param {Node} node - Видалений вузол
 */
function cleanupTimersForNode(node) {
    // Перевіряємо, чи вузол містить таймери
    if (node.hasAttribute && node.hasAttribute('data-timer-id')) {
        const timerId = parseInt(node.getAttribute('data-timer-id'));
        if (timerId && timers.has(timerId)) {
            stopCountdown(timerId);
        }
    }

    // Перевіряємо вкладені таймери
    if (node.querySelectorAll) {
        const nestedTimers = node.querySelectorAll('[data-timer-id]');
        nestedTimers.forEach(timer => {
            const timerId = parseInt(timer.getAttribute('data-timer-id'));
            if (timerId && timers.has(timerId)) {
                stopCountdown(timerId);
            }
        });
    }
}

/**
 * Запуск головного таймера
 */
function startMasterTimer() {
    if (state.masterTimerId !== null) return;

    // Використовуємо requestAnimationFrame для плавності
    function updateLoop(timestamp) {
        // Перевіряємо, чи минув інтервал оновлення
        const elapsed = timestamp - state.lastUpdateTime;

        if (elapsed >= config.updateInterval || state.lastUpdateTime === 0) {
            state.lastUpdateTime = timestamp;
            updateAllTimers();
        }

        // Продовжуємо цикл, якщо є активні таймери
        if (state.activeTimersCount > 0) {
            state.masterTimerId = requestAnimationFrame(updateLoop);
        } else {
            state.masterTimerId = null;
        }
    }

    // Запускаємо петлю оновлення
    state.masterTimerId = requestAnimationFrame(updateLoop);
    console.log('TimeUtils: Запущено головний таймер');
}

/**
 * Оновлення всіх активних таймерів
 */
function updateAllTimers() {
    const now = new Date();
    const expiredTimers = [];

    // Оновлюємо кожен таймер
    timers.forEach((timer, timerId) => {
        // Перевіряємо, чи елемент все ще в DOM
        if (!timer.element || !timer.element.isConnected) {
            expiredTimers.push(timerId);
            return;
        }

        const timeLeft = timer.endDate - now;

        // Перевіряємо, чи не закінчився час
        if (timeLeft <= 0) {
            expiredTimers.push(timerId);
            return;
        }

        // Оновлюємо лише якщо минув інтервал оновлення для цього таймера
        if (now - timer.lastUpdate >= timer.updateFrequency) {
            updateTimerDisplay(timerId);

            // Оновлюємо час останнього оновлення
            timer.lastUpdate = now;

            // Адаптуємо частоту оновлення
            timer.updateFrequency = calculateUpdateFrequency(timeLeft);
        }
    });

    // Обробляємо таймери, час яких закінчився
    expiredTimers.forEach(timerId => {
        handleExpiredTimer(timerId);
    });
}

/**
 * Розрахунок оптимальної частоти оновлення таймера
 * @param {number} timeLeft - Залишок часу в мс
 * @returns {number} Частота оновлення в мс
 */
export function calculateUpdateFrequency(timeLeft) {
    // Адаптуємо частоту оновлення залежно від залишку часу
    if (timeLeft > 24 * 60 * 60 * 1000) { // > 24 години
        return 60000; // 1 хвилина
    } else if (timeLeft > 60 * 60 * 1000) { // > 1 година
        return 30000; // 30 секунд
    } else if (timeLeft > 5 * 60 * 1000) { // > 5 хвилин
        return 10000; // 10 секунд
    } else if (timeLeft > 60 * 1000) { // > 1 хвилина
        return 1000; // 1 секунда
    } else {
        return 500; // 0.5 секунди для останньої хвилини
    }
}

/**
 * Оновлення відображення конкретного таймера
 * @param {number} timerId - ID таймера
 * @param {boolean} force - Примусове оновлення
 */
function updateTimerDisplay(timerId, force = false) {
    const timer = timers.get(timerId);
    if (!timer || !timer.element) return;

    const now = new Date();
    const timeLeft = timer.endDate - now;

    // Примусово оновлюємо або якщо минув інтервал оновлення
    if (force || now - timer.lastUpdate >= timer.updateFrequency) {
        // Форматуємо залишок часу
        const formattedTime = formatTimeLeft(timeLeft, timer.format);

        // Оновлюємо текст елемента
        timer.element.textContent = formattedTime;

        // Додаємо класи залежно від залишку часу
        updateTimerClasses(timer.element, timeLeft);

        // Викликаємо колбек оновлення
        if (typeof timer.onTick === 'function') {
            timer.onTick(formattedTime, timeLeft);
        }
    }
}

/**
 * Оновлення класів таймера
 * @param {HTMLElement} element - Елемент таймера
 * @param {number} timeLeft - Залишок часу
 */
function updateTimerClasses(element, timeLeft) {
    // Знімаємо класи станів
    element.classList.remove('warning', 'critical');

    // Додаємо класи залежно від залишку часу
    if (timeLeft < 60 * 1000) { // Менше хвилини
        element.classList.add('critical');
    } else if (timeLeft < 5 * 60 * 1000) { // Менше 5 хвилин
        element.classList.add('warning');
    }
}

/**
 * Обробка таймера, час якого закінчився
 * @param {number} timerId - ID таймера
 */
function handleExpiredTimer(timerId) {
    const timer = timers.get(timerId);
    if (!timer) return;

    // Оновлюємо елемент, щоб показати закінчення
    if (timer.element && timer.element.isConnected) {
        timer.element.textContent = 'Закінчено';
        timer.element.classList.remove('active', 'warning', 'critical');
        timer.element.classList.add('expired');

        // Генеруємо подію закінчення таймера
        timer.element.dispatchEvent(new CustomEvent('timer-expired', {
            bubbles: true,
            detail: { timerId }
        }));

        // Викликаємо колбек завершення
        if (typeof timer.onComplete === 'function') {
            timer.onComplete();
        }
    }

    // Видаляємо таймер і зв'язки з елементом
    timers.delete(timerId);
    timerElements.delete(timerId);
    state.activeTimersCount--;
}

/**
 * Створення таймера зворотного відліку
 * @param {Object} options - Опції таймера
 * @returns {number} ID таймера
 */
export function createCountdown(options) {
    const {
        element,
        endDate,
        format = 'short',
        onTick,
        onComplete
    } = options;

    // Перевіряємо наявність елемента
    let targetElement = element;
    if (typeof element === 'string') {
        targetElement = document.querySelector(element);
    }

    if (!targetElement) {
        console.error('TimeUtils: Не знайдено елемент для таймера');
        return -1;
    }

    // Перевіряємо кінцеву дату
    const endDateTime = parseDate(endDate);
    if (!endDateTime || isNaN(endDateTime.getTime())) {
        console.error('TimeUtils: Невірна кінцева дата для таймера:', endDate);
        return -1;
    }

    // Перевіряємо, чи не минула дата
    const now = new Date();
    if (endDateTime <= now) {
        // Якщо дата вже минула
        targetElement.textContent = 'Закінчено';
        targetElement.classList.add('expired');

        // Викликаємо колбек завершення
        if (typeof onComplete === 'function') {
            onComplete();
        }

        return -1;
    }

    // Генеруємо унікальний ID
    const timerId = ++state.timerIdCounter;

    // Додаємо клас і атрибут до елемента
    targetElement.classList.add('countdown-timer', 'active');
    targetElement.setAttribute('data-timer-id', timerId);

    // Визначаємо частоту оновлення на основі залишку часу
    const timeLeft = endDateTime - now;
    const updateFrequency = calculateUpdateFrequency(timeLeft);

    // Зберігаємо інформацію про таймер
    timers.set(timerId, {
        endDate: endDateTime,
        element: targetElement,
        format,
        onTick,
        onComplete,
        updateFrequency,
        lastUpdate: now
    });

    // Кешуємо елемент для швидкого доступу
    timerElements.set(timerId, targetElement);

    // Збільшуємо лічильник активних таймерів
    state.activeTimersCount++;

    // Запускаємо головний таймер, якщо потрібно
    if (state.masterTimerId === null) {
        startMasterTimer();
    }

    // Форматуємо та відображаємо поточний час
    updateTimerDisplay(timerId, true);

    return timerId;
}

/**
 * Зупинка таймера зворотного відліку
 * @param {number} timerId - ID таймера
 * @returns {boolean} Успішність операції
 */
export function stopCountdown(timerId) {
    const timer = timers.get(timerId);
    if (!timer) return false;

    // Видаляємо зв'язок з DOM елементом
    if (timer.element) {
        timer.element.removeAttribute('data-timer-id');
        timer.element.classList.remove('active', 'warning', 'critical');
    }

    // Видаляємо таймер і зв'язки
    timers.delete(timerId);
    timerElements.delete(timerId);
    state.activeTimersCount--;

    return true;
}

/**
 * Зупинка всіх таймерів
 */
export function stopAllCountdowns() {
    // Зупиняємо всі таймери
    timers.forEach((_, timerId) => {
        stopCountdown(timerId);
    });

    // Очищаємо всі кешовані дані
    timers.clear();
    timerElements.clear();
    state.activeTimersCount = 0;

    // Зупиняємо головний таймер
    if (state.masterTimerId !== null) {
        cancelAnimationFrame(state.masterTimerId);
        state.masterTimerId = null;
    }
}

/**
 * Очищення ресурсів модуля
 */
export function cleanup() {
    stopAllCountdowns();
    console.log('TimeUtils: Ресурси модуля очищено');
}

/**
 * Форматування залишку часу
 * @param {number} timeLeft - Залишок часу в мс
 * @param {string} format - Формат відображення
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
 * Форматування дати у людино-зрозумілий рядок
 * @param {Date|string|number} date - Дата для форматування
 * @param {string} format - Формат (short, medium, long, time, datetime, relative)
 * @returns {string} Відформатований рядок дати
 */
export function formatDate(date, format = 'medium') {
    // Конвертуємо вхідне значення у Date
    const dateObj = parseDate(date);
    if (!dateObj) return 'Невірна дата';

    // Функція для додавання нуля перед числом
    const padZero = (num) => String(num).padStart(2, '0');

    // Форматування відповідно до обраного формату
    switch (format) {
        case 'short':
            return `${padZero(dateObj.getDate())}.${padZero(dateObj.getMonth() + 1)}.${dateObj.getFullYear()}`;

        case 'time':
            return `${padZero(dateObj.getHours())}:${padZero(dateObj.getMinutes())}`;

        case 'datetime':
            return `${padZero(dateObj.getDate())}.${padZero(dateObj.getMonth() + 1)}.${dateObj.getFullYear()} ${padZero(dateObj.getHours())}:${padZero(dateObj.getMinutes())}`;

        case 'relative':
            return getRelativeTimeString(dateObj);

        case 'long':
            try {
                return dateObj.toLocaleDateString('uk-UA', {
                    weekday: 'long',
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric'
                });
            } catch (e) {
                // Запасний варіант, якщо toLocaleDateString недоступний
                const months = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня',
                              'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
                return `${dateObj.getDate()} ${months[dateObj.getMonth()]} ${dateObj.getFullYear()} р.`;
            }

        case 'medium':
        default:
            try {
                return dateObj.toLocaleDateString('uk-UA');
            } catch (e) {
                // Запасний варіант
                return `${padZero(dateObj.getDate())}.${padZero(dateObj.getMonth() + 1)}.${dateObj.getFullYear()}`;
            }
    }
}

/**
 * Отримання відносного часу у зручному форматі
 * @param {Date} date - Дата для порівняння
 * @returns {string} Відносний час
 */
export function getRelativeTimeString(date) {
    const now = new Date();
    const diffMs = now - date;

    // Конвертуємо різницю в секунди
    const diffSec = Math.floor(diffMs / 1000);

    // В майбутньому
    if (diffSec < 0) {
        const absDiff = Math.abs(diffSec);

        if (absDiff < 60) {
            return 'через кілька секунд';
        } else if (absDiff < 3600) {
            const minutes = Math.floor(absDiff / 60);
            return `через ${minutes} ${pluralize(minutes, 'хвилину', 'хвилини', 'хвилин')}`;
        } else if (absDiff < 86400) {
            const hours = Math.floor(absDiff / 3600);
            return `через ${hours} ${pluralize(hours, 'годину', 'години', 'годин')}`;
        } else if (absDiff < 604800) {
            const days = Math.floor(absDiff / 86400);
            return `через ${days} ${pluralize(days, 'день', 'дні', 'днів')}`;
        } else {
            return formatDate(date, 'short');
        }
    }

    // В минулому
    if (diffSec < 60) {
        return 'щойно';
    } else if (diffSec < 3600) {
        const minutes = Math.floor(diffSec / 60);
        return `${minutes} ${pluralize(minutes, 'хвилину', 'хвилини', 'хвилин')} тому`;
    } else if (diffSec < 86400) {
        const hours = Math.floor(diffSec / 3600);
        return `${hours} ${pluralize(hours, 'годину', 'години', 'годин')} тому`;
    } else if (diffSec < 604800) {
        const days = Math.floor(diffSec / 86400);
        return `${days} ${pluralize(days, 'день', 'дні', 'днів')} тому`;
    } else if (diffSec < 2592000) {
        const weeks = Math.floor(diffSec / 604800);
        return `${weeks} ${pluralize(weeks, 'тиждень', 'тижні', 'тижнів')} тому`;
    } else if (diffSec < 31536000) {
        const months = Math.floor(diffSec / 2592000);
        return `${months} ${pluralize(months, 'місяць', 'місяці', 'місяців')} тому`;
    } else {
        const years = Math.floor(diffSec / 31536000);
        return `${years} ${pluralize(years, 'рік', 'роки', 'років')} тому`;
    }
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
 * Перевірка, чи закінчився час таймера
 * @param {number} timerId - ID таймера
 * @returns {boolean} Чи закінчився час
 */
export function isExpired(timerId) {
    const timer = timers.get(timerId);
    if (!timer) return true;

    const now = new Date();
    return timer.endDate <= now;
}

/**
 * Отримання залишку часу в мс
 * @param {number} timerId - ID таймера
 * @returns {number} Залишок часу в мс
 */
export function getTimeLeft(timerId) {
    const timer = timers.get(timerId);
    if (!timer) return -1;

    const now = new Date();
    const timeLeft = timer.endDate - now;

    return Math.max(0, timeLeft);
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

export default {
    init,
    formatDate,
    formatTimeLeft,
    createCountdown,
    createSimpleCountdown,
    stopCountdown,
    stopAllCountdowns,
    getRelativeTimeString,
    parseDate,
    pluralize,
    getUserTimezoneOffset,
    getTimeLeft,
    isExpired,
    isValidDate,
    isLeapYear,
    cleanup
};