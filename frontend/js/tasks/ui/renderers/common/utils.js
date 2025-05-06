/**
 * Утиліти для модуля ProgressBar
 * Відповідає за:
 * - Управління стилями
 * - Обробку DOM елементів
 * - Допоміжні функції для прогрес-барів
 *
 * @version 3.0.0
 */

// Прапорець для відстеження додавання стилів
let stylesInjected = false;

/**
 * Ін'єкція CSS стилів для прогрес-барів
 */
export function injectStyles() {
    // Перевіряємо, чи стилі вже додані
    if (stylesInjected || document.getElementById('progress-bar-styles')) {
        return;
    }

    // Спрощені CSS стилі для прогрес-барів
    const css = `
        .progress-bar-container {
            width: 100%;
            height: 0.625rem;
            background: rgba(10, 20, 40, 0.2);
            border-radius: 0.3125rem;
            overflow: hidden;
            position: relative;
        }
        
        .progress-bar-fill {
            height: 100%;
            background: linear-gradient(90deg, #4eb5f7, #00C9A7);
            border-radius: 0.3125rem;
            transition: width 500ms cubic-bezier(0.1, 0.8, 0.2, 1);
            width: 0;
        }
        
        .progress-bar-container.small { height: 0.375rem; }
        .progress-bar-container.large { height: 0.875rem; }
        
        .progress-bar-container.success .progress-bar-fill {
            background: linear-gradient(90deg, #4CAF50, #2E7D32);
        }
        
        .progress-bar-container.warning .progress-bar-fill {
            background: linear-gradient(90deg, #FFC107, #FF9800);
        }
        
        .progress-bar-container.danger .progress-bar-fill {
            background: linear-gradient(90deg, #F44336, #D32F2F);
        }
        
        @keyframes progress-pulse {
            0% { box-shadow: 0 0 0 0 rgba(0, 201, 167, 0.5); }
            70% { box-shadow: 0 0 0 10px rgba(0, 201, 167, 0); }
            100% { box-shadow: 0 0 0 0 rgba(0, 201, 167, 0); }
        }
        
        .progress-bar-fill.pulse {
            animation: progress-pulse 1.2s ease-out;
        }
        
        .progress-bar-fill.glow {
            box-shadow: 0 0 8px rgba(0, 201, 167, 0.6);
        }
        
        .progress-text {
            display: flex;
            justify-content: space-between;
            font-size: 0.875rem;
            margin-bottom: 0.3125rem;
        }
        
        .progress-label { font-weight: bold; }
        .progress-value { opacity: 0.8; }
    `;

    // Створюємо елемент стилів
    const styleElement = document.createElement('style');
    styleElement.id = 'progress-bar-styles';
    styleElement.textContent = css;
    document.head.appendChild(styleElement);

    // Відмічаємо, що стилі додано
    stylesInjected = true;

    console.log('ProgressBar: CSS стилі додано');
}

/**
 * Додавання обробника події з можливістю відкладеного виконання
 * @param {HTMLElement} element - Елемент для додавання обробника
 * @param {string} eventType - Тип події
 * @param {Function} handler - Функція-обробник
 * @param {Object} options - Додаткові опції
 */
export function addEvent(element, eventType, handler, options = {}) {
    // Параметри за замовчуванням
    const {
        debounce = 0,     // Час затримки в мс
        once = false,     // Одноразовий обробник
        passive = false,  // Пасивний обробник
        capture = false   // Фаза перехоплення
    } = options;

    let finalHandler = handler;
    let timeoutId;

    // Застосовуємо debounce, якщо потрібно
    if (debounce > 0) {
        finalHandler = function(...args) {
            clearTimeout(timeoutId);
            timeoutId = setTimeout(() => {
                handler.apply(this, args);
            }, debounce);
        };
    }

    // Додаємо обробник до елемента
    element.addEventListener(eventType, finalHandler, {
        once,
        passive,
        capture
    });

    // Повертаємо функцію для видалення обробника
    return function() {
        element.removeEventListener(eventType, finalHandler, {
            capture
        });

        // Очищаємо таймер, якщо є
        if (timeoutId) {
            clearTimeout(timeoutId);
        }
    };
}

/**
 * Видалення обробника події
 * @param {HTMLElement} element - Елемент для видалення обробника
 * @param {string} eventType - Тип події
 * @param {Function} handler - Функція-обробник
 * @param {boolean} capture - Фаза перехоплення
 */
export function removeEvent(element, eventType, handler, capture = false) {
    if (element && element.removeEventListener) {
        element.removeEventListener(eventType, handler, { capture });
    }
}

/**
 * Запуск функції після завантаження DOM
 * @param {Function} callback - Функція для виконання
 */
export function onDOMReady(callback) {
    // Якщо DOM вже завантажений
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        setTimeout(callback, 1);
        return;
    }

    // Таймер для обмеження часу очікування
    let timeoutId = null;

    // Функція для виконання
    const readyHandler = () => {
        // Очищаємо таймер
        if (timeoutId) {
            clearTimeout(timeoutId);
        }

        // Видаляємо обробники
        document.removeEventListener('DOMContentLoaded', readyHandler);
        window.removeEventListener('load', readyHandler);

        // Викликаємо колбек
        callback();
    };

    // Додаємо обробники подій
    document.addEventListener('DOMContentLoaded', readyHandler);
    window.addEventListener('load', readyHandler);

    // Додаємо таймер для обмеження часу очікування (5 секунд)
    timeoutId = setTimeout(readyHandler, 5000);
}

/**
 * Відкладене виконання функції
 * @param {Function} func - Функція для виконання
 * @param {number} wait - Час затримки в мс
 */
export function debounce(func, wait) {
    let timeout;
    return function(...args) {
        const context = this;
        clearTimeout(timeout);
        timeout = setTimeout(() => func.apply(context, args), wait);
    };
}

// Експортуємо функції
export default {
    injectStyles,
    addEvent,
    removeEvent,
    onDOMReady,
    debounce
};