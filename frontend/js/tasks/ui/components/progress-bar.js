/**
 * ProgressBar - оптимізований UI компонент для відображення прогрес-барів
 * Відповідає за:
 * - Ефективне відображення візуального прогресу
 * - Анімацію змін прогресу з мінімальним навантаженням
 * - Легкий API для інтеграції з будь-якими завданнями
 *
 * @version 3.0.0
 */

import DOMUtils from '../../utils/DOMUtils.js';

// Ініціалізуємо глобальний об'єкт UI, якщо його немає
window.UI = window.UI || {};

// Колекція прогрес-барів з використанням Map для кращої продуктивності
const progressBars = new Map();

// Лічильник для генерації унікальних ID
let barCounter = 0;

// Налаштування за замовчуванням
const config = {
    animationDuration: 500,     // Тривалість анімації в мс
    defaultStyle: 'default',    // Стиль за замовчуванням
    defaultSize: 'default',     // Розмір за замовчуванням
    autoClasses: true,          // Автоматичне додавання класів залежно від прогресу
    useTransition: true         // Використовувати CSS-переходи для анімації
};

// Прапорець активності модуля
let isActive = false;

// Зберігання посилань на обробники подій для подальшого очищення
const eventHandlers = {
    progressBarAdded: null,
    progressUpdated: null,
    beforeUnload: null,
    domReady: null
};

/**
 * Ініціалізація модуля прогрес-барів
 * @param {Object} options - Налаштування
 */
function init(options = {}) {
    // Якщо модуль вже активний, спочатку деактивуємо його
    if (isActive) {
        deactivate();
    }

    console.log('UI.ProgressBar: Ініціалізація модуля прогрес-барів');

    // Відмічаємо модуль як активний
    isActive = true;

    // Оновлюємо налаштування
    Object.assign(config, options);

    // Додаємо стилі, якщо потрібно
    injectStyles();

    // Ініціалізуємо існуючі прогрес-бари
    initializeExistingProgressBars();

    // Налаштовуємо обробники подій
    setupEventListeners();
}

/**
 * Додавання CSS стилів для прогрес-барів
 */
function injectStyles() {
    // Оптимізований CSS з мінімальною кількістю правил
    const css = `
        /* Контейнер прогрес-бару */
        .progress-bar-container {
            width: 100%;
            height: 0.625rem; /* 10px */
            background: rgba(10, 20, 40, 0.2);
            border-radius: 0.3125rem; /* 5px */
            overflow: hidden;
            position: relative;
        }
        
        /* Заповнення прогрес-бару */
        .progress-bar-fill {
            height: 100%;
            background: linear-gradient(90deg, #4eb5f7, #00C9A7);
            border-radius: 0.3125rem; /* 5px */
            transition: width ${config.animationDuration}ms cubic-bezier(0.1, 0.8, 0.2, 1);
            width: 0;
        }
        
        /* Розміри */
        .progress-bar-container.small {
            height: 0.375rem; /* 6px */
        }
        
        .progress-bar-container.large {
            height: 0.875rem; /* 14px */
        }
        
        /* Стилі */
        .progress-bar-container.success .progress-bar-fill {
            background: linear-gradient(90deg, #4CAF50, #2E7D32);
        }
        
        .progress-bar-container.warning .progress-bar-fill {
            background: linear-gradient(90deg, #FFC107, #FF9800);
        }
        
        .progress-bar-container.danger .progress-bar-fill {
            background: linear-gradient(90deg, #F44336, #D32F2F);
        }
        
        /* Анімації */
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
        
        /* Текстові мітки */
        .progress-text {
            display: flex;
            justify-content: space-between;
            font-size: 0.875rem; /* 14px */
            margin-bottom: 0.3125rem; /* 5px */
        }
        
        .progress-label {
            font-weight: bold;
        }
        
        .progress-value {
            opacity: 0.8;
        }
    `;

    // Використовуємо DOMUtils для ін'єкції стилів
    DOMUtils.injectStyles('progress-bar-styles', css);
}

/**
 * Ініціалізація існуючих прогрес-барів на сторінці
 */
function initializeExistingProgressBars() {
    // Знаходимо всі контейнери прогрес-барів
    const containers = document.querySelectorAll('.progress-bar-container');

    if (containers.length > 0) {
        console.log(`UI.ProgressBar: Знайдено ${containers.length} прогрес-барів на сторінці`);

        // Ініціалізуємо кожен прогрес-бар
        containers.forEach(container => {
            // Перевіряємо, чи прогрес-бар вже ініціалізований
            if (container.hasAttribute('data-progress-id')) return;

            // Створюємо наповнення, якщо його немає
            if (!container.querySelector('.progress-bar-fill')) {
                const fill = document.createElement('div');
                fill.className = 'progress-bar-fill';

                // Отримуємо значення прогресу з атрибуту
                const progress = parseFloat(container.getAttribute('data-progress') || '0');
                fill.style.width = `${progress}%`;

                container.appendChild(fill);
            }

            // Генеруємо ID
            const id = ++barCounter;
            container.setAttribute('data-progress-id', id);

            // Зберігаємо прогрес-бар в колекції
            const fill = container.querySelector('.progress-bar-fill');
            progressBars.set(id, {
                container,
                fill,
                progress: parseFloat(fill.style.width) || 0,
                maxValue: 100,
                currentValue: parseFloat(fill.style.width) || 0
            });
        });
    }
}

/**
 * Налаштування обробників подій
 */
function setupEventListeners() {
    // Створюємо функції-обробники і зберігаємо посилання для подальшого видалення
    eventHandlers.progressBarAdded = function(event) {
        if (event.detail && event.detail.container) {
            createProgressBar(event.detail.container, event.detail.options);
        }
    };

    eventHandlers.progressUpdated = function(event) {
        if (event.detail && event.detail.id) {
            updateProgress(event.detail.id, event.detail.progress, event.detail.options);
        }
    };

    eventHandlers.beforeUnload = cleanup;

    // Відстежуємо події додавання прогрес-барів
    DOMUtils.addEvent(document, 'progress-bar-added', eventHandlers.progressBarAdded);

    // Відстежуємо події оновлення прогресу
    DOMUtils.addEvent(document, 'progress-updated', eventHandlers.progressUpdated);

    // Очищення ресурсів при виході зі сторінки
    DOMUtils.addEvent(window, 'beforeunload', eventHandlers.beforeUnload);
}

/**
 * Створення прогрес-бару
 * @param {HTMLElement|string} container - Контейнер або селектор
 * @param {Object} options - Параметри прогрес-бару
 * @returns {number} ID прогрес-бару
 */
function createProgressBar(container, options = {}) {
    // Перевіряємо активність модуля
    if (!isActive) {
        console.warn('UI.ProgressBar: Модуль не активний. Спочатку викличте init()');
        return -1;
    }

    // Знаходимо контейнер
    let containerElement;

    if (typeof container === 'string') {
        containerElement = document.querySelector(container);
    } else {
        containerElement = container;
    }

    if (!containerElement) {
        console.error('UI.ProgressBar: Не знайдено контейнер для прогрес-бару');
        return -1;
    }

    // Параметри за замовчуванням
    const {
        progress = 0,
        size = config.defaultSize,
        style = config.defaultStyle,
        showText = false,
        label = '',
        maxValue = 100,
        currentValue = 0,
        animated = true
    } = options;

    // Перевіряємо, чи є вже прогрес-бар в контейнері
    if (containerElement.hasAttribute('data-progress-id')) {
        // Якщо прогрес-бар вже є, оновлюємо його
        const id = parseInt(containerElement.getAttribute('data-progress-id'));
        if (progressBars.has(id)) {
            updateProgress(id, progress, options);
            return id;
        }
    }

    // Генеруємо новий ID
    const id = ++barCounter;

    // Додаємо класи до контейнера
    containerElement.classList.add('progress-bar-container');
    if (size !== 'default') {
        containerElement.classList.add(size);
    }
    if (style !== 'default') {
        containerElement.classList.add(style);
    }

    // Зберігаємо ID
    containerElement.setAttribute('data-progress-id', id);

    // Додаємо текстову мітку, якщо потрібно
    if (showText) {
        let textContainer;

        if (!containerElement.parentNode.querySelector('.progress-text')) {
            textContainer = document.createElement('div');
            textContainer.className = 'progress-text';
            containerElement.parentNode.insertBefore(textContainer, containerElement);
        } else {
            textContainer = containerElement.parentNode.querySelector('.progress-text');
        }

        textContainer.innerHTML = `
            <span class="progress-label">${DOMUtils.escapeHTML(label)}</span>
            <span class="progress-value">${currentValue}/${maxValue}</span>
        `;
    }

    // Створюємо заповнення прогрес-бару
    const progressFill = document.createElement('div');
    progressFill.className = 'progress-bar-fill';

    // Встановлюємо початковий прогрес
    const progressValue = Math.min(100, Math.max(0, progress));
    progressFill.style.width = `${progressValue}%`;

    // Додаємо анімацію, якщо потрібно
    if (animated) {
        progressFill.classList.add('glow');
    }

    // Додаємо заповнення в контейнер
    containerElement.appendChild(progressFill);

    // Зберігаємо прогрес-бар
    progressBars.set(id, {
        container: containerElement,
        fill: progressFill,
        progress: progressValue,
        maxValue,
        currentValue,
        options
    });

    return id;
}

/**
 * Оновлення прогресу
 * @param {number} id - ID прогрес-бару
 * @param {number} progress - Новий прогрес (0-100)
 * @param {Object} options - Додаткові параметри
 * @returns {boolean} Успішність оновлення
 */
function updateProgress(id, progress, options = {}) {
    // Перевіряємо активність модуля
    if (!isActive) {
        console.warn('UI.ProgressBar: Модуль не активний. Спочатку викличте init()');
        return false;
    }

    // Перевіряємо наявність прогрес-бару
    if (!progressBars.has(id)) {
        console.warn(`UI.ProgressBar: Прогрес-бар з ID ${id} не знайдено`);
        return false;
    }

    const progressBar = progressBars.get(id);

    // Отримуємо параметри
    const {
        animated = true,
        pulse = true,
        maxValue,
        currentValue
    } = Object.assign({}, progressBar.options, options);

    // Обчислюємо нове значення
    let newProgress = progress;

    // Якщо передано maxValue і currentValue, обчислюємо прогрес
    if (maxValue !== undefined && currentValue !== undefined) {
        newProgress = Math.min(100, Math.max(0, (currentValue / maxValue) * 100));

        // Оновлюємо текстові мітки, якщо є
        updateProgressText(progressBar.container, currentValue, maxValue);

        // Зберігаємо нові значення
        progressBar.maxValue = maxValue;
        progressBar.currentValue = currentValue;
    } else {
        newProgress = Math.min(100, Math.max(0, progress));
    }

    // Перевіряємо, чи змінився прогрес
    if (newProgress === progressBar.progress) {
        return true;
    }

    // Зберігаємо старий прогрес для порівняння
    const oldProgress = progressBar.progress;

    // Оновлюємо прогрес
    progressBar.progress = newProgress;

    // Якщо потрібно використовувати CSS-переходи
    if (config.useTransition) {
        progressBar.fill.style.width = `${newProgress}%`;
    } else {
        // Без переходів для миттєвого оновлення
        progressBar.fill.style.transition = 'none';
        progressBar.fill.style.width = `${newProgress}%`;

        // Змушуємо браузер виконати reflow для застосування змін
        void progressBar.fill.offsetWidth;

        // Відновлюємо перехід для майбутніх оновлень
        progressBar.fill.style.transition = '';
    }

    // Додаємо анімацію пульсації, якщо прогрес збільшився
    if (animated && pulse && newProgress > oldProgress) {
        progressBar.fill.classList.add('pulse');
        setTimeout(() => {
            progressBar.fill.classList.remove('pulse');
        }, 1200);
    }

    // Оновлюємо стилі в залежності від прогресу, якщо потрібно
    if (config.autoClasses) {
        updateProgressBarClasses(progressBar.container, newProgress);
    }

    return true;
}

/**
 * Оновлення текстових міток прогрес-бару
 * @param {HTMLElement} container - Контейнер прогрес-бару
 * @param {number} currentValue - Поточне значення
 * @param {number} maxValue - Максимальне значення
 */
function updateProgressText(container, currentValue, maxValue) {
    const textContainer = container.parentNode.querySelector('.progress-text');
    if (!textContainer) return;

    const valueElement = textContainer.querySelector('.progress-value');
    if (valueElement) {
        valueElement.textContent = `${currentValue}/${maxValue}`;
    }
}

/**
 * Оновлення класів прогрес-бару в залежності від прогресу
 * @param {HTMLElement} container - Контейнер прогрес-бару
 * @param {number} progress - Значення прогресу
 */
function updateProgressBarClasses(container, progress) {
    // Знімаємо всі стани
    container.classList.remove('success', 'warning', 'danger');

    // Додаємо клас в залежності від прогресу
    if (progress >= 100) {
        container.classList.add('success');
    } else if (progress >= 75) {
        // Не додаємо клас для звичайного прогресу (75-99%)
    } else if (progress >= 25) {
        container.classList.add('warning');
    } else {
        container.classList.add('danger');
    }
}

/**
 * Отримання прогресу
 * @param {number} id - ID прогрес-бару
 * @returns {number} Прогрес (0-100)
 */
function getProgress(id) {
    // Перевіряємо активність модуля
    if (!isActive) {
        console.warn('UI.ProgressBar: Модуль не активний. Спочатку викличте init()');
        return 0;
    }

    if (!progressBars.has(id)) {
        console.warn(`UI.ProgressBar: Прогрес-бар з ID ${id} не знайдено`);
        return 0;
    }

    return progressBars.get(id).progress;
}

/**
 * Отримання всіх прогрес-барів
 * @returns {Map} Колекція прогрес-барів
 */
function getAllProgressBars() {
    // Повертаємо копію карти, а не оригінал
    return new Map(progressBars);
}

/**
 * Видалення прогрес-бару
 * @param {number} id - ID прогрес-бару
 * @returns {boolean} Успішність видалення
 */
function removeProgressBar(id) {
    // Перевіряємо активність модуля
    if (!isActive) {
        console.warn('UI.ProgressBar: Модуль не активний. Спочатку викличте init()');
        return false;
    }

    if (!progressBars.has(id)) {
        console.warn(`UI.ProgressBar: Прогрес-бар з ID ${id} не знайдено`);
        return false;
    }

    const progressBar = progressBars.get(id);

    // Видаляємо заповнення з DOM
    if (progressBar.fill && progressBar.fill.parentNode) {
        progressBar.fill.remove();
    }

    // Видаляємо атрибут ID
    if (progressBar.container) {
        progressBar.container.removeAttribute('data-progress-id');
    }

    // Видаляємо з колекції
    progressBars.delete(id);

    return true;
}

/**
 * Очищення ресурсів модуля
 */
function cleanup() {
    // Якщо модуль не активний, нічого не робимо
    if (!isActive) return;

    // Видаляємо слухачі подій
    if (eventHandlers.progressBarAdded) {
        DOMUtils.removeEvent(document, 'progress-bar-added', eventHandlers.progressBarAdded);
    }

    if (eventHandlers.progressUpdated) {
        DOMUtils.removeEvent(document, 'progress-updated', eventHandlers.progressUpdated);
    }

    if (eventHandlers.beforeUnload) {
        DOMUtils.removeEvent(window, 'beforeunload', eventHandlers.beforeUnload);
    }

    // Очищаємо DOM-зв'язки для уникнення витоків пам'яті
    progressBars.forEach((progressBar, id) => {
        if (progressBar.container) {
            progressBar.container.removeAttribute('data-progress-id');
        }
        // Явно знищуємо посилання на DOM-елементи
        progressBar.container = null;
        progressBar.fill = null;
    });

    // Очищаємо всі прогрес-бари
    progressBars.clear();
    barCounter = 0;

    console.log('UI.ProgressBar: Ресурси модуля очищено');
}

/**
 * Деактивація модуля - публічний метод для зовнішнього контролю
 * життєвого циклу компонента
 */
function deactivate() {
    cleanup();

    // Встановлюємо прапорець деактивації
    const wasActive = isActive;
    isActive = false;

    // Видаляємо стилі, якщо вони є
    const stylesElement = document.getElementById('progress-bar-styles');
    if (stylesElement) {
        stylesElement.remove();
    }

    // Сповіщаємо про деактивацію
    if (wasActive) {
        document.dispatchEvent(new CustomEvent('progress-bar-deactivated'));
    }

    console.log('UI.ProgressBar: Модуль деактивовано');
}

// Ініціалізуємо модуль при завантаженні сторінки
eventHandlers.domReady = function() {
    // Перевіряємо, чи не було запущено ініціалізацію раніше
    if (!isActive) {
        init();
    }
};
DOMUtils.onDOMReady(eventHandlers.domReady);

// Публічний API модуля
const ProgressBar = {
    init,
    createProgressBar,
    updateProgress,
    getProgress,
    getAllProgressBars,
    removeProgressBar,
    cleanup,
    deactivate,
    isActive: () => isActive
};

// Експортуємо API
window.UI.ProgressBar = ProgressBar;

export default ProgressBar;