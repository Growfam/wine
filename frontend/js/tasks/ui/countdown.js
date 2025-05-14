/**
 * Countdown - оптимізований UI компонент для відображення таймера зворотного відліку
 * Відповідає за:
 * - Візуальне відображення таймерів з покращеною анімацією
 * - Інтеграцію з централізованою системою таймерів
 * - Застосування стилів та обробку подій таймерів
 */

// Створюємо namespace для UI компонентів, якщо його ще немає
window.UI = window.UI || {};

window.UI.Countdown = (function() {
    // Кеш таймерів з їх DOM-елементами
    const countdownElements = new Map();

    // Опції за замовчуванням
    const DEFAULT_OPTIONS = {
        defaultFormat: 'short',
        injectStyles: true,
        observeDomChanges: true,
        animateExpiration: true
    };

    // Конфігурація компонента
    const config = { ...DEFAULT_OPTIONS };

    // MutationObserver для відстеження змін у DOM
    let domObserver = null;

    /**
     * Ініціалізація модуля таймерів
     * @param {Object} options - Налаштування
     */
    function init(options = {}) {
        // Оновлюємо конфігурацію модуля
        Object.assign(config, options);

        console.log('UI.Countdown: Ініціалізація оптимізованого модуля таймерів');

        // Додаємо стилі для таймерів, якщо потрібно
        if (config.injectStyles) {
            injectStyles();
        }

        // Перевіряємо наявність основного модуля TimeUtils
        if (!window.TimeUtils) {
            console.warn('UI.Countdown: Модуль TimeUtils не виявлено. Деякі функції можуть працювати некоректно.');
        }

        // Знаходимо всі існуючі таймери на сторінці та ініціалізуємо їх
        initializeExistingCountdowns();

        // Налаштовуємо спостерігач за DOM, якщо потрібно
        if (config.observeDomChanges && window.MutationObserver) {
            setupDomObserver();
        }

        // Підписуємося на події для динамічного створення таймерів
        subscribeToEvents();
    }

    /**
     * Ініціалізація існуючих таймерів на сторінці
     */
    function initializeExistingCountdowns() {
        // Знаходимо всі елементи з атрибутом data-end-date
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

                // Позначаємо елемент як ініціалізований
                element.setAttribute('data-timer-initialized', 'true');
            });
        }
    }

    /**
     * Налаштування спостерігача за DOM
     */
    function setupDomObserver() {
        // Якщо спостерігач вже існує, не створюємо новий
        if (domObserver) return;

        domObserver = new MutationObserver(function(mutations) {
            mutations.forEach(function(mutation) {
                // Перевіряємо додані вузли на наявність таймерів
                if (mutation.addedNodes.length > 0) {
                    mutation.addedNodes.forEach(function(node) {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            // Перевіряємо, чи є це елемент таймера
                            if (node.hasAttribute && node.hasAttribute('data-end-date') && !node.hasAttribute('data-timer-initialized')) {
                                initializeTimerElement(node);
                            }

                            // Шукаємо вкладені таймери
                            if (node.querySelectorAll) {
                                const timerNodes = node.querySelectorAll('[data-end-date]:not([data-timer-initialized])');
                                timerNodes.forEach(initializeTimerElement);
                            }
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

        console.log('UI.Countdown: Налаштовано спостереження за DOM для автоматичної ініціалізації таймерів');
    }

    /**
     * Ініціалізація елемента таймера
     * @param {HTMLElement} element - DOM-елемент таймера
     */
    function initializeTimerElement(element) {
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

        // Позначаємо елемент як ініціалізований
        element.setAttribute('data-timer-initialized', 'true');
    }

    /**
     * Підписка на події
     */
    function subscribeToEvents() {
        // Відстежуємо події додавання таймера
        document.addEventListener('countdown-added', function(event) {
            if (event.detail && event.detail.element) {
                createCountdown(event.detail);
            }
        });

        // Відстежуємо події закінчення таймера
        document.addEventListener('timer-expired', function(event) {
            if (event.detail && event.detail.timerId) {
                const element = document.querySelector(`[data-timer-id="${event.detail.timerId}"]`);
                if (element && config.animateExpiration) {
                    animateExpiration(element);
                }
            }
        });

        // Очищаємо ресурси при виході зі сторінки
        window.addEventListener('beforeunload', function() {
            cleanup();
        });
    }

    /**
     * Анімація закінчення таймера
     * @param {HTMLElement} element - DOM-елемент таймера
     */
    function animateExpiration(element) {
        // Додаємо клас для анімації
        element.classList.add('expired-animation');

        // Видаляємо клас після завершення анімації
        setTimeout(() => {
            element.classList.remove('expired-animation');
        }, 2000);
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
        const endDateTime = window.TimeUtils ? window.TimeUtils.parseDate(endDate) : new Date(endDate);
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

            // Викликаємо обробник завершення, якщо є
            if (typeof onComplete === 'function') {
                onComplete();
            } else if (typeof onComplete === 'string') {
                try {
                    const completeFn = new Function(`return ${onComplete}`)();
                    if (typeof completeFn === 'function') {
                        completeFn();
                    }
                } catch (error) {
                    console.error('UI.Countdown: Помилка виклику функції onComplete:', error);
                }
            }

            return -1;
        }

        // Додаємо клас таймера
        targetElement.classList.add('countdown-timer');
        if (className) {
            targetElement.classList.add(className);
        }

        // Створюємо таймер через TimeUtils, якщо він доступний
        if (window.TimeUtils) {
            // Функція обробки тіку таймера
            const tickHandler = function(formattedTime, timeLeft) {
                // Викликаємо власний обробник, якщо є
                if (typeof onTick === 'function') {
                    onTick(formattedTime, timeLeft);
                }

                // Викликаємо подію оновлення таймера
                targetElement.dispatchEvent(new CustomEvent('countdown-tick', {
                    bubbles: true,
                    detail: {
                        formattedTime,
                        timeLeft,
                        element: targetElement
                    }
                }));
            };

            // Функція обробки завершення таймера
            const completeHandler = function() {
                // Викликаємо власний обробник завершення
                if (typeof onComplete === 'function') {
                    onComplete();
                } else if (typeof onComplete === 'string') {
                    try {
                        const completeFn = new Function(`return ${onComplete}`)();
                        if (typeof completeFn === 'function') {
                            completeFn();
                        }
                    } catch (error) {
                        console.error('UI.Countdown: Помилка виклику функції onComplete:', error);
                    }
                }
            };

            // Створюємо таймер через TimeUtils
            const timerId = window.TimeUtils.createCountdown({
                endDate: endDateTime,
                element: targetElement,
                onTick: tickHandler,
                onComplete: completeHandler,
                format
            });

            // Зберігаємо зв'язок між ID таймера та елементом
            if (timerId > 0) {
                countdownElements.set(timerId, targetElement);
            }

            return timerId;
        } else {
            // Запасний варіант, якщо TimeUtils недоступний
            console.warn('UI.Countdown: Модуль TimeUtils недоступний, створюємо простий таймер');

            // Генеруємо унікальний ID для таймера
            const timerId = Date.now();

            // Форматуємо поточний час
            const formatTime = function() {
                const now = new Date();
                const diff = endDateTime - now;

                if (diff <= 0) {
                    clearInterval(intervalId);
                    targetElement.textContent = 'Закінчено';
                    targetElement.classList.add('expired');

                    // Викликаємо обробник завершення
                    if (typeof onComplete === 'function') {
                        onComplete();
                    }

                    // Викликаємо подію закінчення таймера
                    targetElement.dispatchEvent(new CustomEvent('countdown-completed', {
                        bubbles: true,
                        detail: {
                            element: targetElement
                        }
                    }));

                    return;
                }

                // Обчислюємо час
                const days = Math.floor(diff / (1000 * 60 * 60 * 24));
                const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
                const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((diff % (1000 * 60)) / 1000);

                // Форматуємо відображення
                let formattedTime;
                if (format === 'short') {
                    if (days > 0) {
                        formattedTime = `${days}д ${hours}г`;
                    } else if (hours > 0) {
                        formattedTime = `${hours}г ${minutes}хв`;
                    } else {
                        formattedTime = `${minutes}хв ${seconds}с`;
                    }
                } else {
                    const parts = [];

                    if (days > 0) parts.push(`${days} дн.`);
                    if (hours > 0 || days > 0) parts.push(`${hours} год.`);
                    if (minutes > 0 || hours > 0 || days > 0) parts.push(`${minutes} хв.`);
                    parts.push(`${seconds} сек.`);

                    formattedTime = parts.join(' ');
                }

                // Оновлюємо елемент
                targetElement.textContent = formattedTime;

                // Викликаємо обробник тіку
                if (typeof onTick === 'function') {
                    onTick(formattedTime, diff);
                }

                // Викликаємо подію оновлення таймера
                targetElement.dispatchEvent(new CustomEvent('countdown-tick', {
                    bubbles: true,
                    detail: {
                        formattedTime,
                        timeLeft: diff,
                        element: targetElement
                    }
                }));
            };

            // Перше форматування
            formatTime();

            // Оновлюємо кожну секунду
            const intervalId = setInterval(formatTime, 1000);

            // Зберігаємо дані таймера
            countdownElements.set(timerId, {
                element: targetElement,
                intervalId
            });

            // Додаємо атрибут для зручного пошуку
            targetElement.setAttribute('data-fallback-timer-id', timerId);

            return timerId;
        }
    }

    /**
     * Зупинка таймера зворотного відліку
     * @param {number} timerId - ID таймера
     * @returns {boolean} Чи успішно зупинено
     */
    function stopCountdown(timerId) {
        // Перевіряємо наявність TimeUtils
        if (window.TimeUtils) {
            const result = window.TimeUtils.stopCountdown(timerId);

            // Видаляємо з нашого кешу
            if (countdownElements.has(timerId)) {
                countdownElements.delete(timerId);
            }

            return result;
        } else {
            // Запасний варіант
            const timerData = countdownElements.get(timerId);
            if (!timerData) return false;

            // Очищаємо інтервал
            if (timerData.intervalId) {
                clearInterval(timerData.intervalId);
            }

            // Очищаємо дані елемента
            if (timerData.element) {
                timerData.element.removeAttribute('data-fallback-timer-id');
                timerData.element.classList.remove('active');
            }

            // Видаляємо з кешу
            countdownElements.delete(timerId);

            return true;
        }
    }

    /**
     * Зупинка всіх таймерів
     */
    function stopAllCountdowns() {
        // Використовуємо TimeUtils, якщо доступний
        if (window.TimeUtils) {
            window.TimeUtils.stopAllCountdowns();
        } else {
            // Запасний варіант
            countdownElements.forEach((timerData, timerId) => {
                if (timerData.intervalId) {
                    clearInterval(timerData.intervalId);
                }

                if (timerData.element) {
                    timerData.element.removeAttribute('data-fallback-timer-id');
                    timerData.element.classList.remove('active');
                }
            });
        }

        // Очищаємо кеш
        countdownElements.clear();
    }

    /**
     * Додавання стилів для таймерів
     */
    function injectStyles() {
        // Перевіряємо, чи стилі вже додані
        if (document.getElementById('countdown-styles')) return;

        // Створюємо елемент стилів
        const styleElement = document.createElement('style');
        styleElement.id = 'countdown-styles';

        // Додаємо CSS для таймерів
        styleElement.textContent = `
            /* Основні стилі для таймерів */
            .countdown-timer {
                display: inline-block;
                padding: 0.3125rem 0.625rem;
                border-radius: 0.625rem;
                font-weight: 600;
                transition: all 0.3s ease;
                position: relative;
                overflow: hidden;
            }
            
            .countdown-timer.active {
                color: #FFD700;
                animation: timer-pulse 2s infinite;
            }
            
            .countdown-timer.expired {
                background-color: rgba(244, 67, 54, 0.1);
                color: #F44336;
            }
            
            /* Анімація пульсації таймера */
            @keyframes timer-pulse {
                0% {
                    color: #FFD700;
                }
                50% {
                    color: #FFA500;
                }
                100% {
                    color: #FFD700;
                }
            }
            
            /* Покращена анімація закінчення часу */
            .countdown-timer.expired-animation {
                animation: expired-pulse 0.5s ease-out 3;
            }
            
            @keyframes expired-pulse {
                0% {
                    transform: scale(1);
                    opacity: 0.7;
                }
                50% {
                    transform: scale(1.1);
                    opacity: 1;
                    color: #FF0000;
                }
                100% {
                    transform: scale(1);
                    opacity: 0.7;
                }
            }
            
            /* Додаткові стилі для різних станів таймерів */
            .countdown-timer.warning {
                color: #FF9800;
            }
            
            .countdown-timer.critical {
                color: #FF5722;
                animation: critical-pulse 1s infinite;
            }
            
            @keyframes critical-pulse {
                0% {
                    transform: scale(1);
                }
                50% {
                    transform: scale(1.05);
                }
                100% {
                    transform: scale(1);
                }
            }
        `;

        // Додаємо стилі до документу
        document.head.appendChild(styleElement);
    }

    /**
     * Оновлення всіх таймерів (для ситуацій, коли таймери потрібно перемалювати)
     */
    function refreshAllCountdowns() {
        // Якщо доступний TimeUtils, використовуємо його
        if (window.TimeUtils) {
            // TimeUtils автоматично оновлює всі таймери
            return;
        }

        // Запасний варіант - оновлюємо всі наші таймери
        countdownElements.forEach((timerData, timerId) => {
            if (timerData.element && timerData.element.isConnected) {
                // Елемент все ще в DOM, перемальовуємо
                updateCountdownDisplay(timerId);
            } else {
                // Елемент видалено з DOM, зупиняємо таймер
                stopCountdown(timerId);
            }
        });
    }

    /**
     * Оновлення відображення конкретного таймера
     * @param {number} timerId - ID таймера
     */
    function updateCountdownDisplay(timerId) {
        const timerData = countdownElements.get(timerId);
        if (!timerData || !timerData.element || !timerData.element.isConnected) return;

        // Форматуємо час
        const now = new Date();
        const endDate = new Date(timerData.element.getAttribute('data-end-date'));
        const diff = endDate - now;

        // Перевіряємо, чи не закінчився час
        if (diff <= 0) {
            timerData.element.textContent = 'Закінчено';
            timerData.element.classList.add('expired');
            return;
        }

        // Обчислюємо і відображаємо час
        const days = Math.floor(diff / (1000 * 60 * 60 * 24));
        const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
        const seconds = Math.floor((diff % (1000 * 60)) / 1000);

        // Форматуємо відображення
        const format = timerData.element.getAttribute('data-format') || 'short';
        let formattedTime;

        if (format === 'short') {
            if (days > 0) {
                formattedTime = `${days}д ${hours}г`;
            } else if (hours > 0) {
                formattedTime = `${hours}г ${minutes}хв`;
            } else {
                formattedTime = `${minutes}хв ${seconds}с`;
            }
        } else {
            const parts = [];

            if (days > 0) parts.push(`${days} дн.`);
            if (hours > 0 || days > 0) parts.push(`${hours} год.`);
            if (minutes > 0 || hours > 0 || days > 0) parts.push(`${minutes} хв.`);
            parts.push(`${seconds} сек.`);

            formattedTime = parts.join(' ');
        }

        // Оновлюємо елемент
        timerData.element.textContent = formattedTime;

        // Додаємо класи для попередження
        if (diff < 60 * 1000) { // Менше хвилини
            timerData.element.classList.add('critical');
            timerData.element.classList.remove('warning');
        } else if (diff < 5 * 60 * 1000) { // Менше 5 хвилин
            timerData.element.classList.add('warning');
            timerData.element.classList.remove('critical');
        } else {
            timerData.element.classList.remove('warning', 'critical');
        }
    }

    /**
     * Очищення ресурсів модуля
     */
    function cleanup() {
        // Зупиняємо всі таймери
        stopAllCountdowns();

        // Відключаємо спостерігач за DOM
        if (domObserver) {
            domObserver.disconnect();
            domObserver = null;
        }

        console.log('UI.Countdown: Ресурси модуля очищено');
    }

    // Публічний API модуля
    return {
        init,
        createCountdown,
        stopCountdown,
        stopAllCountdowns,
        refreshAllCountdowns,
        updateCountdownDisplay,
        cleanup
    };
})();