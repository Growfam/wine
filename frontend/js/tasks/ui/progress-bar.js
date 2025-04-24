/**
 * ProgressBar - UI компонент для відображення прогрес-барів
 * Відповідає за:
 * - Створення візуального прогрес-бару
 * - Анімацію зміни прогресу
 * - Підтримку різних стилів та розмірів
 */

// Створюємо namespace для UI компонентів, якщо його ще немає
window.UI = window.UI || {};

window.UI.ProgressBar = (function() {
    // Колекція прогрес-барів за ID
    const progressBars = {};
    let barCounter = 0;

    /**
     * Ініціалізація модуля прогрес-барів
     */
    function init() {
        console.log('UI.ProgressBar: Ініціалізація модуля прогрес-барів');

        // Додаємо стилі для прогрес-барів
        injectStyles();

        // Ініціалізуємо існуючі прогрес-бари
        initializeExistingProgressBars();

        // Підписуємося на події
        subscribeToEvents();
    }

    /**
     * Додавання стилів для прогрес-барів
     */
    function injectStyles() {
        // Перевіряємо, чи стилі вже додані
        if (document.getElementById('progress-bar-styles')) return;

        // Створюємо елемент стилів
        const styleElement = document.createElement('style');
        styleElement.id = 'progress-bar-styles';

        // Додаємо CSS для прогрес-барів
        styleElement.textContent = `
            /* Основні стилі для прогрес-барів */
            .progress-bar-container {
                width: 100%;
                height: 0.625rem; /* 10px */
                background: rgba(10, 20, 40, 0.5);
                border-radius: 0.3125rem; /* 5px */
                overflow: hidden;
                position: relative;
            }
            
            .progress-bar-fill {
                height: 100%;
                background: linear-gradient(90deg, #4eb5f7, #00C9A7);
                border-radius: 0.3125rem; /* 5px */
                transition: width 0.5s ease-out;
                position: relative;
            }
            
            /* Розміри прогрес-барів */
            .progress-bar-container.small {
                height: 0.375rem; /* 6px */
            }
            
            .progress-bar-container.large {
                height: 0.875rem; /* 14px */
            }
            
            /* Стилі прогрес-барів */
            .progress-bar-container.success .progress-bar-fill {
                background: linear-gradient(90deg, #4CAF50, #2E7D32);
            }
            
            .progress-bar-container.warning .progress-bar-fill {
                background: linear-gradient(90deg, #FFC107, #FF9800);
            }
            
            .progress-bar-container.danger .progress-bar-fill {
                background: linear-gradient(90deg, #F44336, #D32F2F);
            }
            
            /* Анімації для прогрес-барів */
            .progress-bar-fill.pulse {
                animation: progress-pulse 1s ease-out;
            }
            
            .progress-bar-fill.glow {
                animation: progress-glow 2s infinite;
            }
            
            @keyframes progress-pulse {
                0% {
                    box-shadow: 0 0 0 0 rgba(0, 201, 167, 0.5);
                }
                70% {
                    box-shadow: 0 0 0 10px rgba(0, 201, 167, 0);
                }
                100% {
                    box-shadow: 0 0 0 0 rgba(0, 201, 167, 0);
                }
            }
            
            @keyframes progress-glow {
                0% {
                    box-shadow: 0 0 5px rgba(0, 201, 167, 0.3);
                }
                50% {
                    box-shadow: 0 0 10px rgba(0, 201, 167, 0.5);
                }
                100% {
                    box-shadow: 0 0 5px rgba(0, 201, 167, 0.3);
                }
            }
            
            /* Текстові мітки для прогрес-барів */
            .progress-text {
                font-size: 0.875rem; /* 14px */
                color: #4eb5f7;
                margin-bottom: 0.3125rem; /* 5px */
                display: flex;
                justify-content: space-between;
            }
            
            .progress-text .progress-label {
                font-weight: bold;
            }
            
            .progress-text .progress-value {
                opacity: 0.8;
            }
            
            /* Прогрес-бар в завданнях */
            .task-progress .progress-bar-container {
                margin-top: 0.3125rem; /* 5px */
            }
        `;

        // Додаємо стилі до документу
        document.head.appendChild(styleElement);
    }

    /**
     * Ініціалізація існуючих прогрес-барів
     */
    function initializeExistingProgressBars() {
        // Знаходимо всі контейнери прогрес-барів
        const containers = document.querySelectorAll('.progress-bar-container');

        if (containers.length > 0) {
            console.log(`UI.ProgressBar: Знайдено ${containers.length} прогрес-барів на сторінці`);

            // Ініціалізуємо кожен прогрес-бар
            containers.forEach(container => {
                // Перевіряємо, чи є прогрес-бар всередині
                if (!container.querySelector('.progress-bar-fill')) {
                    // Якщо немає, створюємо його
                    const fill = document.createElement('div');
                    fill.className = 'progress-bar-fill';

                    // Отримуємо значення прогресу з атрибуту
                    const progress = parseFloat(container.getAttribute('data-progress') || '0');
                    fill.style.width = `${progress}%`;

                    container.appendChild(fill);
                }

                // Зберігаємо прогрес-бар в колекції
                const id = ++barCounter;
                container.setAttribute('data-progress-id', id);

                // Отримуємо елемент заповнення
                const fill = container.querySelector('.progress-bar-fill');

                // Зберігаємо прогрес-бар
                progressBars[id] = {
                    container,
                    fill,
                    progress: parseFloat(fill.style.width) || 0
                };
            });
        }
    }

    /**
     * Підписка на події
     */
    function subscribeToEvents() {
        // Відстежуємо зміни в DOM для динамічно доданих прогрес-барів
        document.addEventListener('progress-bar-added', function(event) {
            if (event.detail && event.detail.container) {
                createProgressBar(event.detail.container, event.detail.options);
            }
        });

        // Підписуємося на події оновлення прогресу
        document.addEventListener('progress-updated', function(event) {
            if (event.detail && event.detail.id) {
                updateProgress(event.detail.id, event.detail.progress, event.detail.options);
            }
        });
    }

    /**
     * Створення прогрес-бару
     * @param {HTMLElement|string} container - Контейнер або селектор для прогрес-бару
     * @param {Object} options - Параметри прогрес-бару
     * @returns {number} ID прогрес-бару
     */
    function createProgressBar(container, options = {}) {
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

        // Перевіряємо, чи контейнер вже має прогрес-бар
        if (containerElement.querySelector('.progress-bar-fill')) {
            // Якщо прогрес-бар вже є, оновлюємо його
            const id = containerElement.getAttribute('data-progress-id');
            if (id && progressBars[id]) {
                // Оновлюємо опції
                if (options.progress !== undefined) {
                    updateProgress(id, options.progress, options);
                }
                return parseInt(id);
            }
        }

        // Створюємо унікальний ID
        const id = ++barCounter;

        // Параметри за замовчуванням
        const {
            progress = 0,
            size = 'default',
            style = 'default',
            showText = false,
            label = '',
            maxValue = 100,
            currentValue = 0,
            animated = true
        } = options;

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

            // Перевіряємо, чи є текстовий контейнер
            if (!containerElement.parentNode.querySelector('.progress-text')) {
                textContainer = document.createElement('div');
                textContainer.className = 'progress-text';

                // Додаємо перед контейнером прогрес-бару
                containerElement.parentNode.insertBefore(textContainer, containerElement);
            } else {
                textContainer = containerElement.parentNode.querySelector('.progress-text');
            }

            // Заповнюємо текстовий контейнер
            textContainer.innerHTML = `
                <span class="progress-label">${label}</span>
                <span class="progress-value">${currentValue}/${maxValue}</span>
            `;
        }

        // Створюємо прогрес-бар
        const progressFill = document.createElement('div');
        progressFill.className = 'progress-bar-fill';

        // Встановлюємо початковий прогрес
        const progressValue = Math.min(100, Math.max(0, progress));
        progressFill.style.width = `${progressValue}%`;

        // Додаємо анімацію, якщо потрібно
        if (animated) {
            progressFill.classList.add('glow');
        }

        // Додаємо прогрес-бар в контейнер
        containerElement.appendChild(progressFill);

        // Зберігаємо прогрес-бар
        progressBars[id] = {
            container: containerElement,
            fill: progressFill,
            progress: progressValue,
            maxValue,
            currentValue,
            options
        };

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
        const progressBar = progressBars[id];

        if (!progressBar) {
            console.warn(`UI.ProgressBar: Прогрес-бар з ID ${id} не знайдено`);
            return false;
        }

        // Параметри за замовчуванням
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

            // Оновлюємо текстові мітки
            const textContainer = progressBar.container.parentNode.querySelector('.progress-text');
            if (textContainer) {
                const valueElement = textContainer.querySelector('.progress-value');
                if (valueElement) {
                    valueElement.textContent = `${currentValue}/${maxValue}`;
                }
            }
        } else {
            newProgress = Math.min(100, Math.max(0, progress));
        }

        // Перевіряємо, чи змінився прогрес
        if (newProgress === progressBar.progress) {
            return true;
        }

        // Зберігаємо старий прогрес
        const oldProgress = progressBar.progress;

        // Оновлюємо прогрес
        progressBar.progress = newProgress;
        progressBar.fill.style.width = `${newProgress}%`;

        // Оновлюємо збережені значення
        if (maxValue !== undefined) progressBar.maxValue = maxValue;
        if (currentValue !== undefined) progressBar.currentValue = currentValue;

        // Додаємо анімацію
        if (animated) {
            // Додаємо анімацію пульсації, якщо прогрес збільшився
            if (pulse && newProgress > oldProgress) {
                progressBar.fill.classList.add('pulse');

                // Видаляємо клас анімації через 1 секунду
                setTimeout(() => {
                    progressBar.fill.classList.remove('pulse');
                }, 1000);
            }
        }

        // Змінюємо стиль, якщо прогрес повний
        if (newProgress >= 100) {
            progressBar.container.classList.add('success');
            progressBar.fill.classList.remove('glow');
        } else if (newProgress >= 75) {
            progressBar.container.classList.remove('success', 'warning', 'danger');
        } else if (newProgress >= 25) {
            progressBar.container.classList.remove('success', 'danger');
            progressBar.container.classList.add('warning');
        } else {
            progressBar.container.classList.remove('success', 'warning');
            progressBar.container.classList.add('danger');
        }

        return true;
    }

    /**
     * Отримання прогресу
     * @param {number} id - ID прогрес-бару
     * @returns {number} Прогрес (0-100)
     */
    function getProgress(id) {
        const progressBar = progressBars[id];

        if (!progressBar) {
            console.warn(`UI.ProgressBar: Прогрес-бар з ID ${id} не знайдено`);
            return 0;
        }

        return progressBar.progress;
    }

    /**
     * Отримання всіх прогрес-барів
     * @returns {Object} Об'єкт з усіма прогрес-барами
     */
    function getAllProgressBars() {
        return progressBars;
    }

    /**
     * Видалення прогрес-бару
     * @param {number} id - ID прогрес-бару
     * @returns {boolean} Успішність видалення
     */
    function removeProgressBar(id) {
        const progressBar = progressBars[id];

        if (!progressBar) {
            console.warn(`UI.ProgressBar: Прогрес-бар з ID ${id} не знайдено`);
            return false;
        }

        // Видаляємо прогрес-бар з DOM
        progressBar.fill.remove();

        // Видаляємо атрибут ID
        progressBar.container.removeAttribute('data-progress-id');

        // Видаляємо з колекції
        delete progressBars[id];

        return true;
    }

    // Ініціалізуємо модуль при завантаженні
    document.addEventListener('DOMContentLoaded', init);

    // Публічний API модуля
    return {
        init,
        createProgressBar,
        updateProgress,
        getProgress,
        getAllProgressBars,
        removeProgressBar
    };
})();