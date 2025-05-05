/**
 * Countdown - оптимізований UI компонент для відображення таймерів зворотного відліку
 * Відповідає за:
 * - Ефективне управління таймерами з мінімальним споживанням ресурсів
 * - Синхронізоване оновлення всіх таймерів
 * - Коректну обробку подій життєвого циклу
 * @version 2.0.0
 */

window.UI = window.UI || {};

window.UI.Countdown = (function() {
    // Колекція таймерів з використанням Map для кращої продуктивності
    const countdownTimers = new Map();

    // Кеш DOM-елементів для швидкого доступу
    const timerElements = new Map();

    // Лічильник для генерації унікальних ID
    let timerIdCounter = 0;

    // Стан і конфігурація
    const state = {
        masterTimerId: null,      // ID головного таймера
        activeTimersCount: 0,     // Кількість активних таймерів
        lastUpdateTime: 0         // Час останнього оновлення
    };

    // Налаштування за замовчуванням
    const config = {
        updateInterval: 1000,     // Базовий інтервал оновлення (мс)
        adaptiveUpdates: true,    // Адаптивні оновлення залежно від залишку часу
        defaultFormat: 'short',   // Формат за замовчуванням
        injectStyles: true,       // Додавати CSS стилі
        animateExpiration: true   // Анімувати закінчення таймера
    };

    /**
     * Ініціалізація модуля
     * @param {Object} options - Налаштування
     */
    function init(options = {}) {
        // Оновлюємо конфігурацію
        Object.assign(config, options);

        console.log('UI.Countdown: Ініціалізація модуля таймерів');

        // Додаємо стилі, якщо потрібно
        if (config.injectStyles) {
            injectStyles();
        }

        // Ініціалізуємо існуючі таймери
        initializeExistingCountdowns();

        // Підписуємось на події
        setupEventListeners();

        // Очищаємо ресурси при виході зі сторінки
        window.addEventListener('beforeunload', cleanup);
    }

    /**
     * Додавання CSS стилів для таймерів
     */
    function injectStyles() {
        // Перевіряємо, чи стилі вже додані
        if (document.getElementById('countdown-styles')) return;

        const styleElement = document.createElement('style');
        styleElement.id = 'countdown-styles';

        // Спрощені та оптимізовані стилі
        styleElement.textContent = `
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

        document.head.appendChild(styleElement);
    }

    /**
     * Ініціалізація існуючих таймерів на сторінці
     */
    function initializeExistingCountdowns() {
        const timerElements = document.querySelectorAll('[data-end-date]:not([data-timer-initialized])');

        if (timerElements.length > 0) {
            console.log(`UI.Countdown: Знайдено ${timerElements.length} таймерів на сторінці`);

            // Ініціалізуємо кожен таймер
            timerElements.forEach(element => {
                const endDate = element.getAttribute('data-end-date');
                const format = element.getAttribute('data-format') || config.defaultFormat;
                const onComplete = element.getAttribute('data-on-complete') || null;
                const className = element.getAttribute('data-timer-class') || null;

                // Ініціалізуємо таймер
                createCountdown({
                    element,
                    endDate,
                    format,
                    onComplete: onComplete ? new Function(`return ${onComplete}`)() : null,
                    className
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
        // Підписка на події додавання таймера
        document.addEventListener('countdown-added', function(event) {
            if (event.detail && event.detail.element) {
                createCountdown(event.detail);
            }
        });

        // Підписка наDOM-зміни для автоматичного очищення таймерів
        if (window.MutationObserver) {
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
        const timers = node.querySelectorAll('[data-timer-id]');

        if (timers.length) {
            timers.forEach(timer => {
                const timerId = parseInt(timer.getAttribute('data-timer-id'));
                if (timerId && countdownTimers.has(timerId)) {
                    stopCountdown(timerId);
                }
            });
        }

        // Перевіряємо, чи сам вузол є таймером
        if (node.hasAttribute && node.hasAttribute('data-timer-id')) {
            const timerId = parseInt(node.getAttribute('data-timer-id'));
            if (timerId && countdownTimers.has(timerId)) {
                stopCountdown(timerId);
            }
        }
    }

    /**
     * Створення таймера зворотного відліку
     * @param {Object} options - Опції таймера
     * @returns {number} ID таймера
     */
    function createCountdown(options) {
        const {
            element,
            endDate,
            format = config.defaultFormat,
            onTick,
            onComplete,
            className = null
        } = options;

        // Перевіряємо наявність елемента
        let targetElement = element;
        if (typeof element === 'string') {
            targetElement = document.querySelector(element);
        }

        if (!targetElement) {
            console.error('UI.Countdown: Не знайдено елемент для таймера');
            return -1;
        }

        // Перевіряємо правильність дати
        const endDateTime = parseDate(endDate);
        if (!endDateTime || isNaN(endDateTime.getTime())) {
            console.error('UI.Countdown: Невірна кінцева дата для таймера:', endDate);
            return -1;
        }

        // Перевіряємо, чи не минула дата
        const now = new Date();
        if (endDateTime <= now) {
            // Якщо дата вже минула
            targetElement.textContent = 'Закінчено';
            targetElement.classList.add('expired');
            targetElement.setAttribute('data-timer-expired', 'true');

            // Викликаємо обробник завершення
            if (typeof onComplete === 'function') {
                onComplete();
            }

            return -1;
        }

        // Створюємо унікальний ID
        const timerId = ++timerIdCounter;

        // Додаємо класи до елемента
        targetElement.classList.add('countdown-timer');
        targetElement.classList.add('active');

        if (className) {
            targetElement.classList.add(className);
        }

        // Зберігаємо ID в атрибуті
        targetElement.setAttribute('data-timer-id', timerId);

        // Визначаємо частоту оновлення залежно від залишку часу
        const timeLeft = endDateTime - now;
        const updateFrequency = calculateUpdateFrequency(timeLeft);

        // Зберігаємо інформацію про таймер
        countdownTimers.set(timerId, {
            endDate: endDateTime,
            element: targetElement,
            onTick,
            onComplete,
            format,
            updateFrequency,
            lastUpdate: now
        });

        // Кешуємо елемент для швидкого доступу
        timerElements.set(timerId, targetElement);

        // Збільшуємо лічильник активних таймерів
        state.activeTimersCount++;

        // Запускаємо головний таймер, якщо він не запущений
        startMasterTimer();

        // Відразу форматуємо та відображаємо час
        updateTimerDisplay(timerId, true);

        return timerId;
    }

    /**
     * Розрахунок оптимальної частоти оновлення таймера
     * @param {number} timeLeft - Залишок часу в мс
     * @returns {number} Частота оновлення в мс
     */
    function calculateUpdateFrequency(timeLeft) {
        if (!config.adaptiveUpdates) {
            return config.updateInterval;
        }

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
     * Запуск головного таймера
     */
    function startMasterTimer() {
        if (state.masterTimerId !== null) return;

        // Використовуємо requestAnimationFrame для плавних оновлень
        function updateLoop(timestamp) {
            // Оновлюємо базовий таймер кожні updateInterval мс
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
        console.log('UI.Countdown: Запущено головний таймер');
    }

    /**
     * Оновлення всіх активних таймерів
     */
    function updateAllTimers() {
        const now = new Date();
        const expiredTimers = [];

        // Оновлюємо кожен таймер з використанням Map.forEach для швидкодії
        countdownTimers.forEach((timer, timerId) => {
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

            // Оновлюємо тільки якщо минув інтервал оновлення для цього таймера
            if (now - timer.lastUpdate >= timer.updateFrequency) {
                updateTimerDisplay(timerId);

                // Оновлюємо частоту оновлення
                timer.updateFrequency = calculateUpdateFrequency(timeLeft);
                timer.lastUpdate = now;
            }
        });

        // Обробляємо таймери, час яких закінчився
        expiredTimers.forEach(timerId => {
            handleExpiredTimer(timerId);
        });
    }

    /**
     * Оновлення відображення конкретного таймера
     * @param {number} timerId - ID таймера
     * @param {boolean} force - Примусове оновлення
     */
    function updateTimerDisplay(timerId, force = false) {
        const timer = countdownTimers.get(timerId);
        if (!timer || !timer.element) return;

        const now = new Date();
        const timeLeft = timer.endDate - now;

        // Примусово оновлюємо або якщо минув інтервал оновлення
        if (force || now - timer.lastUpdate >= timer.updateFrequency) {
            // Форматуємо залишок часу
            const formattedTime = formatTimeRemaining(timeLeft, timer.format);

            // Оновлюємо текст елемента
            timer.element.textContent = formattedTime;

            // Додаємо класи залежно від залишку часу
            updateTimerClasses(timer.element, timeLeft);

            // Викликаємо колбек оновлення
            if (typeof timer.onTick === 'function') {
                timer.onTick(formattedTime, timeLeft);
            }

            // Оновлюємо час останнього оновлення
            timer.lastUpdate = now;
        }
    }

    /**
     * Оновлення класів таймера залежно від залишку часу
     * @param {HTMLElement} element - Елемент таймера
     * @param {number} timeLeft - Залишок часу в мс
     */
    function updateTimerClasses(element, timeLeft) {
        // Знімаємо всі стани
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
        const timer = countdownTimers.get(timerId);
        if (!timer) return;

        // Оновлюємо елемент, щоб показати закінчення
        if (timer.element && timer.element.isConnected) {
            timer.element.textContent = 'Закінчено';
            timer.element.classList.remove('active', 'warning', 'critical');
            timer.element.classList.add('expired');
            timer.element.setAttribute('data-timer-expired', 'true');

            // Додаємо анімацію, якщо потрібно
            if (config.animateExpiration) {
                timer.element.classList.add('expired-animation');
                setTimeout(() => {
                    if (timer.element && timer.element.isConnected) {
                        timer.element.classList.remove('expired-animation');
                    }
                }, 2000);
            }

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

        // Видаляємо таймер
        countdownTimers.delete(timerId);
        timerElements.delete(timerId);
        state.activeTimersCount--;
    }

    /**
     * Зупинка таймера зворотного відліку
     * @param {number} timerId - ID таймера
     * @returns {boolean} Успішність операції
     */
    function stopCountdown(timerId) {
        const timer = countdownTimers.get(timerId);
        if (!timer) return false;

        // Видаляємо зв'язок з DOM елементом
        if (timer.element) {
            timer.element.removeAttribute('data-timer-id');
            timer.element.classList.remove('active', 'warning', 'critical');
        }

        // Видаляємо таймер
        countdownTimers.delete(timerId);
        timerElements.delete(timerId);
        state.activeTimersCount--;

        return true;
    }

    /**
     * Зупинка всіх таймерів
     */
    function stopAllCountdowns() {
        countdownTimers.forEach((_, timerId) => {
            stopCountdown(timerId);
        });

        // Очищаємо всі кешовані дані
        countdownTimers.clear();
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
    function cleanup() {
        stopAllCountdowns();
        console.log('UI.Countdown: Ресурси модуля очищено');
    }

    /**
     * Форматування залишку часу
     * @param {number} timeLeft - Залишок часу в мс
     * @param {string} format - Формат відображення (short, full)
     * @returns {string} Відформатований час
     */
    function formatTimeRemaining(timeLeft, format) {
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
        else {
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
    }

    /**
     * Склонення слова залежно від числа
     * @param {number} n - Число
     * @param {string} form1 - Форма для 1
     * @param {string} form2 - Форма для 2-4
     * @param {string} form5 - Форма для 5-9, 0
     * @returns {string} Правильна форма слова
     */
    function pluralize(n, form1, form2, form5) {
        n = Math.abs(n) % 100;
        const n1 = n % 10;

        if (n > 10 && n < 20) return form5;
        if (n1 > 1 && n1 < 5) return form2;
        if (n1 === 1) return form1;

        return form5;
    }

    /**
     * Парсинг дати
     * @param {Date|string} date - Дата для парсингу
     * @returns {Date|null} Об'єкт Date або null
     */
    function parseDate(date) {
        if (date instanceof Date) {
            return new Date(date);
        }

        if (typeof date === 'string') {
            // Спочатку пробуємо ISO формат
            const isoDate = new Date(date);
            if (!isNaN(isoDate.getTime())) {
                return isoDate;
            }

            // Пробуємо формат дд.мм.рррр
            const dateParts = date.match(/^(\d{1,2})\.(\d{1,2})\.(\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
            if (dateParts) {
                const [_, day, month, year, hours = 0, minutes = 0, seconds = 0] = dateParts;
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

    // Публічний API (спрощено)
    return {
        init,
        createCountdown,
        stopCountdown,
        stopAllCountdowns,
        formatTimeRemaining,
        parseDate
    };
})();