/**
 * TimeUtils - оптимізований модуль утиліт для роботи з часом
 * Відповідає за:
 * - Централізоване форматування дати та часу
 * - Управління таймерами зворотного відліку
 * - Обробку часових поясів та локалізацію
 * - Ефективне використання ресурсів для таймерів
 */

window.TimeUtils = (function() {
    // Приватні змінні та стан модуля
    const timers = {};            // Кеш активних таймерів
    let timerIdCounter = 0;       // Лічильник для генерації ID таймерів
    let masterTimerInterval = null; // Головний інтервал для всіх таймерів
    let masterTimerCount = 0;     // Кількість активних таймерів

    // Кеш DOM елементів таймерів
    const timerElements = new WeakMap();

    // Опції за замовчуванням
    const DEFAULT_OPTIONS = {
        updateInterval: 1000,      // Інтервал оновлення в мс
        autoCleanup: true,         // Автоматичне очищення таймерів
        useLocalTimezone: true,    // Використовувати локальний часовий пояс
        adjustForTimezone: true    // Коригувати відображення за часовим поясом
    };

    // Зберігання налаштувань
    const config = { ...DEFAULT_OPTIONS };

    // MutationObserver для відстеження видалення елементів з DOM
    let domObserver = null;

    /**
     * Ініціалізація модуля
     * @param {Object} options - Налаштування модуля
     */
    function init(options = {}) {
        // Оновлюємо налаштування
        Object.assign(config, options);

        // Ініціалізуємо спостерігач за DOM, якщо потрібно автоматичне очищення
        if (config.autoCleanup && window.MutationObserver) {
            setupDomObserver();
        }

        console.log('TimeUtils: Ініціалізація оптимізованого модуля TimeUtils');

        // Перевіряємо чи є активні таймери на сторінці
        initExistingTimers();
    }

    /**
     * Налаштування спостерігача за DOM для автоматичного очищення таймерів
     */
    function setupDomObserver() {
        // Якщо спостерігач вже існує, не створюємо новий
        if (domObserver) return;

        domObserver = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                // Перевіряємо видалені вузли
                if (mutation.removedNodes.length > 0) {
                    mutation.removedNodes.forEach(function(node) {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            // Шукаємо таймери в видаленому вузлі
                            cleanupTimersForNode(node);
                        }
                    });
                }
            });
        });

        // Починаємо спостереження за всім документом
        domObserver.observe(document.body, {
            childList: true,
            subtree: true
        });

        console.log('TimeUtils: Налаштовано автоматичне очищення таймерів');
    }

    /**
     * Очищення таймерів для видаленого вузла DOM
     * @param {Node} node - Вузол DOM
     */
    function cleanupTimersForNode(node) {
        // Якщо вузол сам є елементом таймера
        timerElements.forEach((elementRef, timerId) => {
            if (node.contains(elementRef) || node === elementRef) {
                stopCountdown(timerId);
                timerElements.delete(timerId);
            }
        });

        // Додаткова перевірка для всіх вкладених елементів з атрибутом data-timer-id
        if (node.querySelectorAll) {
            const timerNodes = node.querySelectorAll('[data-timer-id]');
            timerNodes.forEach(timerNode => {
                const timerId = timerNode.getAttribute('data-timer-id');
                if (timerId && timers[timerId]) {
                    stopCountdown(parseInt(timerId));
                }
            });
        }
    }

    /**
     * Ініціалізація існуючих таймерів на сторінці
     */
    function initExistingTimers() {
        // Знаходимо всі елементи з атрибутом data-end-date
        const timerElements = document.querySelectorAll('[data-end-date]');

        if (timerElements.length > 0) {
            console.log(`TimeUtils: Знайдено ${timerElements.length} елементів таймерів на сторінці`);

            // Ініціалізуємо кожен таймер
            timerElements.forEach(element => {
                const endDate = element.getAttribute('data-end-date');
                const format = element.getAttribute('data-format') || 'short';
                const onComplete = element.getAttribute('data-on-complete');

                // Створюємо таймер для цього елемента
                createCountdown({
                    element,
                    endDate,
                    format,
                    onComplete: onComplete ? new Function(`return ${onComplete}`)() : null
                });
            });
        }
    }

    /**
     * Управління головним таймером
     * @param {string} action - Дія ('start' або 'stop')
     */
    function manageMasterTimer(action) {
        if (action === 'start' && masterTimerInterval === null) {
            // Запускаємо головний таймер
            masterTimerInterval = setInterval(updateAllTimers, config.updateInterval);
            console.log('TimeUtils: Запущено головний таймер');
        } else if (action === 'stop' && masterTimerInterval !== null && masterTimerCount === 0) {
            // Зупиняємо головний таймер, якщо нема активних таймерів
            clearInterval(masterTimerInterval);
            masterTimerInterval = null;
            console.log('TimeUtils: Зупинено головний таймер');
        }
    }

    /**
     * Оновлення всіх активних таймерів
     */
    function updateAllTimers() {
        const now = new Date();
        const expiredTimers = [];

        // Оновлюємо кожен таймер
        Object.keys(timers).forEach(timerId => {
            const timer = timers[timerId];
            const timeLeft = timer.endDate - now;

            // Перевіряємо, чи не закінчився час
            if (timeLeft <= 0) {
                expiredTimers.push(timerId);
                return;
            }

            // Оновлюємо відображення таймера
            if (timer.elementRef && timer.elementRef.isConnected) {
                // Оптимізуємо інтервал оновлення на основі залишку часу
                if (timer.lastUpdate && now - timer.lastUpdate < timer.updateFrequency) {
                    return; // Пропускаємо оновлення для економії ресурсів
                }

                // Форматуємо залишок часу
                const formattedTime = formatTimeLeft(timer.endDate, timer.options);

                // Оновлюємо контент елемента
                timer.elementRef.textContent = formattedTime;

                // Викликаємо колбек оновлення, якщо він є
                if (typeof timer.onTick === 'function') {
                    timer.onTick(formattedTime, timeLeft);
                }

                // Оновлюємо час останнього оновлення
                timer.lastUpdate = now;

                // Оптимізуємо частоту оновлень залежно від залишку часу
                updateTimerFrequency(timer, timeLeft);
            } else if (!timer.elementRef || !timer.elementRef.isConnected) {
                // Таймер не прив'язаний до DOM або елемент видалено
                expiredTimers.push(timerId);
            }
        });

        // Обробляємо таймери, час яких вийшов
        expiredTimers.forEach(timerId => {
            handleExpiredTimer(timerId);
        });
    }

    /**
     * Оновлення частоти оновлення таймера в залежності від залишку часу
     * @param {Object} timer - Об'єкт таймера
     * @param {number} timeLeft - Залишок часу в мс
     */
    function updateTimerFrequency(timer, timeLeft) {
        // Встановлюємо частоту оновлення в залежності від залишку часу
        if (timeLeft > 24 * 60 * 60 * 1000) { // > 24 години
            timer.updateFrequency = 60000; // 1 хвилина
        } else if (timeLeft > 60 * 60 * 1000) { // > 1 година
            timer.updateFrequency = 30000; // 30 секунд
        } else if (timeLeft > 5 * 60 * 1000) { // > 5 хвилин
            timer.updateFrequency = 10000; // 10 секунд
        } else if (timeLeft > 60 * 1000) { // > 1 хвилина
            timer.updateFrequency = 1000; // 1 секунда
        } else {
            timer.updateFrequency = 500; // 0.5 секунди для останньої хвилини
        }
    }

    /**
     * Обробка таймера, час якого вийшов
     * @param {string} timerId - ID таймера
     */
    function handleExpiredTimer(timerId) {
        const timer = timers[timerId];
        if (!timer) return;

        // Оновлюємо елемент, щоб показати закінчення часу
        if (timer.elementRef && timer.elementRef.isConnected) {
            timer.elementRef.textContent = 'Закінчено';
            timer.elementRef.classList.add('expired');

            // Встановлюємо атрибут, що таймер закінчився
            timer.elementRef.setAttribute('data-timer-expired', 'true');

            // Викликаємо подію закінчення часу
            timer.elementRef.dispatchEvent(new CustomEvent('timer-expired', {
                bubbles: true,
                detail: { timerId }
            }));
        }

        // Викликаємо колбек завершення, якщо він є
        if (typeof timer.onComplete === 'function') {
            timer.onComplete();
        }

        // Видаляємо таймер
        delete timers[timerId];
        masterTimerCount--;

        // Якщо таймерів більше немає, зупиняємо головний таймер
        if (masterTimerCount === 0) {
            manageMasterTimer('stop');
        }
    }

    /**
     * Створення таймера зворотного відліку
     * @param {Object} options - Опції таймера
     * @returns {number} ID таймера
     */
    function createCountdown(options) {
        const {
            endDate,
            element,
            onTick,
            onComplete,
            format = 'short',
            updateFrequency = null
        } = options;

        // Перевіряємо наявність кінцевої дати
        const endDateTime = parseDate(endDate);
        if (!endDateTime) {
            console.error('TimeUtils: Невірна кінцева дата для таймера:', endDate);
            return -1;
        }

        // Перевіряємо, чи не минула дата
        const now = new Date();
        if (endDateTime <= now) {
            // Якщо відображаємо в DOM
            if (element) {
                const elementRef = typeof element === 'string' ? document.querySelector(element) : element;
                if (elementRef) {
                    elementRef.textContent = 'Закінчено';
                    elementRef.classList.add('expired');
                    elementRef.setAttribute('data-timer-expired', 'true');
                }
            }

            // Викликаємо колбек завершення, якщо він є
            if (typeof onComplete === 'function') {
                onComplete();
            }

            return -1;
        }

        // Генеруємо унікальний ID
        const timerId = ++timerIdCounter;

        // Отримуємо DOM елемент, якщо вказано
        let elementRef = null;
        if (element) {
            elementRef = typeof element === 'string' ? document.querySelector(element) : element;

            // Зберігаємо зв'язок між таймером та елементом
            if (elementRef) {
                timerElements.set(timerId, elementRef);

                // Додаємо атрибут для легкого пошуку
                elementRef.setAttribute('data-timer-id', timerId);
                elementRef.classList.add('countdown-timer');
                elementRef.classList.add('active');
            }
        }

        // Визначаємо оптимальну частоту оновлення
        const timeLeft = endDateTime - now;
        let initialUpdateFrequency = updateFrequency;

        if (!initialUpdateFrequency) {
            if (timeLeft > 24 * 60 * 60 * 1000) { // > 24 години
                initialUpdateFrequency = 60000; // 1 хвилина
            } else if (timeLeft > 60 * 60 * 1000) { // > 1 година
                initialUpdateFrequency = 30000; // 30 секунд
            } else if (timeLeft > 5 * 60 * 1000) { // > 5 хвилин
                initialUpdateFrequency = 10000; // 10 секунд
            } else if (timeLeft > 60 * 1000) { // > 1 хвилина
                initialUpdateFrequency = 1000; // 1 секунда
            } else {
                initialUpdateFrequency = 500; // 0.5 секунди для останньої хвилини
            }
        }

        // Зберігаємо інформацію про таймер
        timers[timerId] = {
            endDate: endDateTime,
            elementRef,
            onTick,
            onComplete,
            options: {
                showSeconds: true,
                shortFormat: format === 'short',
                hideZeroUnits: format !== 'full'
            },
            updateFrequency: initialUpdateFrequency,
            lastUpdate: null
        };

        // Збільшуємо лічильник таймерів
        masterTimerCount++;

        // Запускаємо головний таймер, якщо потрібно
        manageMasterTimer('start');

        // Форматуємо та відображаємо поточний час
        if (elementRef) {
            const formattedTime = formatTimeLeft(endDateTime, timers[timerId].options);
            elementRef.textContent = formattedTime;

            // Викликаємо колбек першого оновлення
            if (typeof onTick === 'function') {
                onTick(formattedTime, timeLeft);
            }
        }

        return timerId;
    }

    /**
     * Зупинка таймера зворотного відліку
     * @param {number} timerId - ID таймера
     * @returns {boolean} Результат операції
     */
    function stopCountdown(timerId) {
        const timer = timers[timerId];
        if (!timer) return false;

        // Видаляємо атрибути таймера з елемента
        if (timer.elementRef) {
            timer.elementRef.removeAttribute('data-timer-id');
            timer.elementRef.classList.remove('active');
            timerElements.delete(timerId);
        }

        // Видаляємо таймер зі списку
        delete timers[timerId];
        masterTimerCount--;

        // Якщо таймерів більше немає, зупиняємо головний таймер
        if (masterTimerCount === 0) {
            manageMasterTimer('stop');
        }

        return true;
    }

    /**
     * Зупинка всіх активних таймерів
     */
    function stopAllCountdowns() {
        Object.keys(timers).forEach(timerId => {
            stopCountdown(parseInt(timerId));
        });

        // Для надійності очищаємо все
        masterTimerCount = 0;
        manageMasterTimer('stop');
    }

    /**
     * Перетворення дати в об'єкт Date з урахуванням часового поясу
     * @param {Date|string|number} date - Дата для парсингу
     * @returns {Date|null} Об'єкт Date або null
     */
    function parseDate(date) {
        if (date instanceof Date) {
            return new Date(date);
        }

        if (typeof date === 'string') {
            // Спершу спробуємо ISO формат
            const isoDate = new Date(date);
            if (!isNaN(isoDate.getTime())) {
                return adjustForTimezone(isoDate);
            }

            // Спроба парсити український формат (дд.мм.рррр)
            const dateParts = date.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
            if (dateParts) {
                const [_, day, month, year, hours = 0, minutes = 0, seconds = 0] = dateParts;
                const parsedDate = new Date(
                    parseInt(year),
                    parseInt(month) - 1,
                    parseInt(day),
                    parseInt(hours),
                    parseInt(minutes),
                    parseInt(seconds)
                );
                return adjustForTimezone(parsedDate);
            }

            return null;
        }

        if (typeof date === 'number') {
            return new Date(date);
        }

        return null;
    }

    /**
     * Коригування дати з урахуванням часового поясу
     * @param {Date} date - Дата для коригування
     * @returns {Date} Скоригована дата
     */
    function adjustForTimezone(date) {
        if (!config.adjustForTimezone) return date;

        // Коригування не потрібне, якщо дата вже локальна
        return date;
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
     * Додавання нуля перед числом, якщо воно менше 10
     * @param {number} num - Число
     * @returns {string} Число з нулем, якщо потрібно
     */
    function padZero(num) {
        return num < 10 ? `0${num}` : num.toString();
    }

    /**
     * Визначення часового поясу користувача
     * @returns {number} Зміщення часового поясу в хвилинах
     */
    function getUserTimezoneOffset() {
        return new Date().getTimezoneOffset();
    }

    /**
     * Перевірка, чи істекла дата таймера
     * @param {number} timerId - ID таймера
     * @returns {boolean} true, якщо таймер істік
     */
    function isExpired(timerId) {
        const timer = timers[timerId];
        if (!timer) return true;

        const now = new Date();
        return timer.endDate <= now;
    }

    /**
     * Отримання залишку часу в мілісекундах
     * @param {number} timerId - ID таймера
     * @returns {number} Залишок часу в мс або -1, якщо таймер не знайдено
     */
    function getTimeLeft(timerId) {
        const timer = timers[timerId];
        if (!timer) return -1;

        const now = new Date();
        const timeLeft = timer.endDate - now;

        return Math.max(0, timeLeft);
    }

    // Очищення ресурсів при виході зі сторінки
    window.addEventListener('beforeunload', stopAllCountdowns);

    // Ініціалізація модуля при завантаженні сторінки
    document.addEventListener('DOMContentLoaded', init);

    // Публічний API модуля
    return {
        init,
        formatDate,
        formatTimeLeft,
        createCountdown,
        stopCountdown,
        stopAllCountdowns,
        getRelativeTimeString,
        parseDate,
        pluralize,
        getUserTimezoneOffset,
        getTimeLeft,
        isExpired
    };
})();