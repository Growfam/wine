/**
 * Countdown - UI компонент для відображення таймера зворотного відліку
 * Відповідає за:
 * - Візуальне відображення таймерів
 * - Управління оновленням лічильників часу
 * - Обробку подій закінчення часу
 */

// Створюємо namespace для UI компонентів, якщо його ще немає
window.UI = window.UI || {};

window.UI.Countdown = (function() {
    // Приватні змінні модуля
    const countdowns = {};
    let countdownId = 0;

    /**
     * Ініціалізація модуля таймерів
     */
    function init() {
        console.log('UI.Countdown: Ініціалізація модуля таймерів');

        // Додаємо стилі для таймерів
        injectStyles();

        // Знаходимо всі елементи таймерів на сторінці та ініціалізуємо їх
        initializeExistingCountdowns();

        // Підписуємося на події для динамічного створення таймерів
        subscribeToEvents();
    }

    /**
     * Ініціалізація існуючих таймерів на сторінці
     */
    function initializeExistingCountdowns() {
        // Знаходимо всі елементи з атрибутом data-end-date
        const countdownElements = document.querySelectorAll('[data-end-date]');

        if (countdownElements.length > 0) {
            console.log(`UI.Countdown: Знайдено ${countdownElements.length} таймерів на сторінці`);

            // Ініціалізуємо кожен таймер
            countdownElements.forEach(element => {
                const endDate = element.getAttribute('data-end-date');
                const format = element.getAttribute('data-format') || 'short';
                const onComplete = element.getAttribute('data-on-complete') || null;

                createCountdown({
                    element,
                    endDate,
                    format,
                    onComplete
                });
            });
        }
    }

    /**
     * Підписка на події
     */
    function subscribeToEvents() {
        // Відстежуємо зміни в DOM для динамічно доданих таймерів
        document.addEventListener('countdown-added', function(event) {
            if (event.detail && event.detail.element) {
                createCountdown(event.detail);
            }
        });

        // Очищаємо всі таймери при виході зі сторінки
        window.addEventListener('beforeunload', function() {
            stopAllCountdowns();
        });
    }

    /**
     * Створення таймера зворотного відліку
     * @param {Object} options - Параметри таймера
     * @returns {number} ID таймера
     */
    function createCountdown(options) {
        const {
            element,
            endDate,
            format = 'short',
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
        if (!endDateTime) {
            console.error('UI.Countdown: Невірна кінцева дата для таймера:', endDate);
            return -1;
        }

        // Перевіряємо, чи не минула дата
        const now = new Date();
        if (endDateTime <= now) {
            // Якщо дата вже минула, відображаємо "Закінчено"
            targetElement.textContent = 'Закінчено';
            targetElement.classList.add('expired');

            // Викликаємо обробник завершення, якщо є
            if (typeof onComplete === 'function') {
                onComplete();
            } else if (typeof onComplete === 'string') {
                // Якщо onComplete - це ім'я функції, спробуємо її викликати
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

        // Генеруємо унікальний ID
        const id = ++countdownId;

        // Додаємо клас, якщо вказано
        if (className) {
            targetElement.classList.add(className);
        }

        // Додаємо клас таймера
        targetElement.classList.add('countdown-timer');

        // Зберігаємо функцію onComplete
        const completeCallback = typeof onComplete === 'function' ? onComplete : null;

        // Функція для обробки завершення таймера
        const handleComplete = () => {
            targetElement.textContent = 'Закінчено';
            targetElement.classList.add('expired');
            targetElement.classList.remove('active');

            // Викликаємо обробник, якщо є
            if (completeCallback) {
                completeCallback();
            } else if (typeof onComplete === 'string') {
                // Якщо onComplete - це ім'я функції, спробуємо її викликати
                try {
                    const completeFn = new Function(`return ${onComplete}`)();
                    if (typeof completeFn === 'function') {
                        completeFn();
                    }
                } catch (error) {
                    console.error('UI.Countdown: Помилка виклику функції onComplete:', error);
                }
            }

            // Видаляємо таймер з кешу
            delete countdowns[id];

            // Відправляємо подію про завершення
            targetElement.dispatchEvent(new CustomEvent('countdown-completed', {
                bubbles: true
            }));
        };

        // Функція для оновлення відображення
        const tickCallback = (formattedTime) => {
            targetElement.textContent = formattedTime;

            // Викликаємо обробник тіку, якщо є
            if (typeof onTick === 'function') {
                onTick(formattedTime);
            }
        };

        // Створюємо таймер, якщо доступний модуль часових утиліт
        if (window.TimeUtils) {
            const timerId = window.TimeUtils.createCountdown({
                endDate: endDateTime,
                onTick: tickCallback,
                onComplete: handleComplete,
                format
            });

            // Зберігаємо дані таймера
            countdowns[id] = {
                timerId,
                element: targetElement,
                endDate: endDateTime
            };

            // Додаємо клас активного таймера
            targetElement.classList.add('active');

            return id;
        } else {
            // Якщо модуль недоступний, створюємо простий таймер
            const intervalId = setInterval(() => {
                const now = new Date();
                const diff = endDateTime - now;

                if (diff <= 0) {
                    clearInterval(intervalId);
                    handleComplete();
                    return;
                }

                // Форматуємо час
                const formattedTime = formatTimeLeft(endDateTime, format);
                tickCallback(formattedTime);
            }, 1000);

            // Зберігаємо дані таймера
            countdowns[id] = {
                intervalId,
                element: targetElement,
                endDate: endDateTime
            };

            // Додаємо клас активного таймера
            targetElement.classList.add('active');

            // Виконуємо перше оновлення
            const formattedTime = formatTimeLeft(endDateTime, format);
            tickCallback(formattedTime);

            return id;
        }
    }

    /**
     * Зупинка таймера зворотного відліку
     * @param {number} id - ID таймера
     * @returns {boolean} Чи успішно зупинено
     */
    function stopCountdown(id) {
        if (!countdowns[id]) return false;

        const countdown = countdowns[id];

        if (countdown.timerId && window.TimeUtils) {
            // Якщо використовується модуль TimeUtils
            window.TimeUtils.stopCountdown(countdown.timerId);
        } else if (countdown.intervalId) {
            // Якщо використовується власний таймер
            clearInterval(countdown.intervalId);
        }

        // Видаляємо клас активного таймера
        if (countdown.element) {
            countdown.element.classList.remove('active');
        }

        // Видаляємо таймер з кешу
        delete countdowns[id];

        return true;
    }

    /**
     * Зупинка всіх таймерів
     */
    function stopAllCountdowns() {
        Object.keys(countdowns).forEach(id => {
            stopCountdown(parseInt(id));
        });
    }

    /**
     * Форматування залишку часу
     * @param {Date} endDate - Кінцева дата
     * @param {string} format - Формат відображення ('short', 'medium', 'full')
     * @returns {string} Відформатований залишок часу
     */
    function formatTimeLeft(endDate, format = 'short') {
        if (window.TimeUtils) {
            return window.TimeUtils.formatTimeLeft(endDate, {
                showSeconds: true,
                shortFormat: format === 'short',
                hideZeroUnits: format !== 'full'
            });
        }

        // Якщо модуль недоступний, реалізуємо просте форматування
        const now = new Date();
        let diffMs = endDate - now;

        // Якщо час вийшов
        if (diffMs <= 0) {
            return 'Закінчено';
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
        if (format === 'short') {
            if (days > 0) {
                return `${days}д ${hours}г`;
            } else if (hours > 0) {
                return `${hours}г ${minutes}хв`;
            } else {
                return `${minutes}хв ${seconds}с`;
            }
        } else {
            const parts = [];

            if (days > 0) {
                parts.push(`${days} д.`);
            }

            if (hours > 0 || days > 0) {
                parts.push(`${hours} год.`);
            }

            if (minutes > 0 || hours > 0 || days > 0) {
                parts.push(`${minutes} хв.`);
            }

            parts.push(`${seconds} сек.`);

            return parts.join(' ');
        }
    }

    /**
     * Перетворення різних форматів дати в об'єкт Date
     * @param {Date|string|number} date - Дата для парсингу
     * @returns {Date|null} Об'єкт Date або null
     */
    function parseDate(date) {
        if (window.TimeUtils && window.TimeUtils.parseDate) {
            return window.TimeUtils.parseDate(date);
        }

        // Якщо модуль недоступний, реалізуємо простий парсинг
        if (date instanceof Date) {
            return date;
        }

        if (typeof date === 'string') {
            // Перетворення рядка в Date
            const parsedDate = new Date(date);
            return isNaN(parsedDate.getTime()) ? null : parsedDate;
        }

        if (typeof date === 'number') {
            return new Date(date);
        }

        return null;
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
                animation: timer-pulse 2s infinite;
            }
            
            .countdown-timer.active {
                color: #FFD700;
            }
            
            .countdown-timer.expired {
                background-color: rgba(244, 67, 54, 0.1);
                color: #F44336;
                animation: expired-pulse 1s ease-out 3;
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
            
            /* Анімація закінчення часу */
            @keyframes expired-pulse {
                0% {
                    opacity: 0.5;
                }
                50% {
                    opacity: 1;
                }
                100% {
                    opacity: 0.5;
                }
            }
        `;

        // Додаємо стилі до документу
        document.head.appendChild(styleElement);
    }

    // Ініціалізуємо модуль при завантаженні
    document.addEventListener('DOMContentLoaded', init);

    // Публічний API модуля
    return {
        init,
        createCountdown,
        stopCountdown,
        stopAllCountdowns,
        formatTimeLeft
    };
})();