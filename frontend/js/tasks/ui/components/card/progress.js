/**
 * TaskCard.progress - модуль для роботи з відображенням прогресу в картці завдання
 *
 * Відповідає за:
 * - Відображення прогрес-бару завдання
 * - Оновлення стану виконання в інтерфейсі
 * - Анімацію змін прогресу
 */

import dependencyContainer from '../../../utils/dependency-container.js';
import { UI } from '../../../index.js';

// Стан модуля
const state = {
    initialized: false,
    progressElements: new Map(), // Зберігаємо зв'язок між ID завдань та елементами прогресу
    animationActive: false,      // Прапорець активності анімації
    defaultConfig: {
        useAnimation: true,      // Використовувати анімацію для оновлення
        className: 'task-progress', // Клас для елемента прогресу
        barClassName: 'progress-fill', // Клас для заповнення прогрес-бару
        size: 'default',         // Розмір: 'small', 'default', 'large'
        showText: true,          // Показувати текст прогресу
        showSteps: false,        // Показувати кроки прогресу
        format: null             // Функція для форматування тексту
    }
};

/**
 * Ініціалізація модуля
 * @returns {Object} API модуля
 */
export function init() {
    if (state.initialized) return exports;

    // Вивід інформації, якщо доступний логер
    const logger = dependencyContainer.resolve('Logger');
    if (logger && typeof logger.info === 'function') {
        logger.info('Ініціалізація модуля прогресу для карток завдань', 'TaskCard.progress');
    }

    state.initialized = true;
    return exports;
}

/**
 * Рендерінг елемента прогресу для завдання
 * @param {HTMLElement} container - Контейнер для прогресу
 * @param {Object} task - Дані завдання
 * @param {Object} progress - Прогрес виконання
 * @param {Object} options - Додаткові опції
 * @returns {HTMLElement} Елемент прогресу
 */
export function render(container, task, progress, options = {}) {
    if (!container || !task) return null;

    // Поєднуємо налаштування за замовчуванням і передані опції
    const config = { ...state.defaultConfig, ...options };

    // Встановлюємо значення прогресу
    const currentValue = progress?.progress_value || 0;
    const maxValue = task.target_value || 100;
    const percent = Math.min(100, Math.max(0, (currentValue / maxValue) * 100));

    // Перевіряємо, чи вже є елемент прогресу
    let progressElement = container.querySelector(`.${config.className}`);

    if (!progressElement) {
        // Створюємо новий елемент прогресу
        progressElement = document.createElement('div');
        progressElement.className = config.className;

        // Додаємо розмір, якщо вказано
        if (config.size !== 'default') {
            progressElement.classList.add(`${config.className}-${config.size}`);
        }

        // Додаємо ID завдання як атрибут
        progressElement.dataset.taskId = task.id;

        // Створюємо базову структуру
        if (config.showSteps) {
            // Створюємо покроковий прогрес
            createStepsProgress(progressElement, currentValue, maxValue, config);
        } else {
            // Створюємо звичайний прогрес-бар
            createProgressBar(progressElement, percent, config);
        }

        // Додаємо елемент до контейнера
        container.appendChild(progressElement);
    } else {
        // Оновлюємо існуючий елемент прогресу
        if (config.showSteps) {
            updateStepsProgress(progressElement, currentValue, maxValue, config);
        } else {
            updateProgressBar(progressElement, percent, config);
        }
    }

    // Зберігаємо зв'язок між ID завдання та елементом прогресу
    state.progressElements.set(task.id, {
        element: progressElement,
        container,
        config
    });

    return progressElement;
}

/**
 * Створення звичайного прогрес-бару
 * @param {HTMLElement} element - Елемент прогресу
 * @param {number} percent - Процент виконання
 * @param {Object} config - Налаштування
 */
function createProgressBar(element, percent, config) {
    // Створюємо контейнер прогрес-бару
    const progressBar = document.createElement('div');
    progressBar.className = 'progress-bar';

    // Створюємо заповнення прогрес-бару
    const progressFill = document.createElement('div');
    progressFill.className = config.barClassName;
    progressFill.style.width = `${percent}%`;

    // Додаємо елементи
    progressBar.appendChild(progressFill);
    element.appendChild(progressBar);

    // Додаємо текст, якщо потрібно
    if (config.showText) {
        const progressText = document.createElement('div');
        progressText.className = 'progress-text';

        // Форматуємо текст, якщо є функція форматування
        const text = typeof config.format === 'function'
            ? config.format(percent)
            : `${Math.round(percent)}%`;

        progressText.textContent = text;
        element.appendChild(progressText);
    }
}

/**
 * Оновлення звичайного прогрес-бару
 * @param {HTMLElement} element - Елемент прогресу
 * @param {number} percent - Процент виконання
 * @param {Object} config - Налаштування
 */
function updateProgressBar(element, percent, config) {
    // Знаходимо заповнення прогрес-бару
    const progressFill = element.querySelector(`.${config.barClassName}`);
    if (!progressFill) return;

    // Зберігаємо поточне значення для порівняння
    const currentWidth = parseFloat(progressFill.style.width) || 0;

    // Якщо значення змінилося, оновлюємо
    if (percent !== currentWidth) {
        // Анімація, якщо дозволено
        if (config.useAnimation && UI && UI.Animations) {
            animateProgress(progressFill, currentWidth, percent);
        } else {
            progressFill.style.width = `${percent}%`;
        }

        // Оновлюємо текст, якщо потрібно
        if (config.showText) {
            const progressText = element.querySelector('.progress-text');
            if (progressText) {
                // Форматуємо текст, якщо є функція форматування
                const text = typeof config.format === 'function'
                    ? config.format(percent)
                    : `${Math.round(percent)}%`;

                progressText.textContent = text;
            }
        }

        // Додаємо клас завершення, якщо прогрес досяг 100%
        if (percent >= 100 && currentWidth < 100) {
            element.classList.add('completed');

            // Додаємо ефект світіння до прогрес-бару
            progressFill.classList.add('glow');
        } else if (percent < 100) {
            element.classList.remove('completed');
            progressFill.classList.remove('glow');
        }
    }
}

/**
 * Створення покрокового прогресу
 * @param {HTMLElement} element - Елемент прогресу
 * @param {number} currentValue - Поточне значення
 * @param {number} maxValue - Максимальне значення
 * @param {Object} config - Налаштування
 */
function createStepsProgress(element, currentValue, maxValue, config) {
    // Створюємо контейнер кроків
    const stepsContainer = document.createElement('div');
    stepsContainer.className = 'progress-steps';

    // Додаємо кроки
    for (let i = 0; i < maxValue; i++) {
        const step = document.createElement('div');
        step.className = 'progress-step';

        // Додаємо клас для виконаного кроку
        if (i < currentValue) {
            step.classList.add('completed');
        }

        // Додаємо номер кроку, якщо потрібно
        if (config.showStepNumbers) {
            step.dataset.step = (i + 1).toString();
        }

        stepsContainer.appendChild(step);
    }

    // Додаємо контейнер кроків
    element.appendChild(stepsContainer);

    // Додаємо текст, якщо потрібно
    if (config.showText) {
        const progressText = document.createElement('div');
        progressText.className = 'progress-text';
        progressText.textContent = `${currentValue}/${maxValue}`;
        element.appendChild(progressText);
    }
}

/**
 * Оновлення покрокового прогресу
 * @param {HTMLElement} element - Елемент прогресу
 * @param {number} currentValue - Поточне значення
 * @param {number} maxValue - Максимальне значення
 * @param {Object} config - Налаштування
 */
function updateStepsProgress(element, currentValue, maxValue, config) {
    // Знаходимо всі кроки
    const steps = element.querySelectorAll('.progress-step');
    if (!steps.length) return;

    // Оновлюємо стан кроків
    steps.forEach((step, index) => {
        if (index < currentValue) {
            step.classList.add('completed');
        } else {
            step.classList.remove('completed');
        }
    });

    // Оновлюємо текст, якщо потрібно
    if (config.showText) {
        const progressText = element.querySelector('.progress-text');
        if (progressText) {
            progressText.textContent = `${currentValue}/${maxValue}`;
        }
    }

    // Додаємо клас завершення, якщо прогрес досяг максимуму
    if (currentValue >= maxValue) {
        element.classList.add('completed');
    } else {
        element.classList.remove('completed');
    }
}

/**
 * Анімація зміни прогресу
 * @param {HTMLElement} element - Елемент заповнення прогрес-бару
 * @param {number} fromPercent - Початковий процент
 * @param {number} toPercent - Кінцевий процент
 */
function animateProgress(element, fromPercent, toPercent) {
    // Перевіряємо доступність модуля анімацій
    if (UI && UI.Animations && typeof UI.Animations.animateNumber === 'function') {
        // Використовуємо анімацію через модуль анімацій
        UI.Animations.animateNumber(null, fromPercent, toPercent, {
            duration: 800,
            easing: 'easeOutQuad',
            onUpdate: (value) => {
                element.style.width = `${value}%`;
            }
        });
    } else {
        // Запасний варіант - проста анімація
        element.style.transition = 'width 0.8s cubic-bezier(0.1, 0.8, 0.2, 1)';
        element.style.width = `${toPercent}%`;

        // Додаємо клас пульсації, якщо прогрес збільшився
        if (toPercent > fromPercent) {
            element.classList.add('pulse');
            setTimeout(() => {
                element.classList.remove('pulse');
            }, 1000);
        }
    }
}

/**
 * Оновлення прогресу для завдання
 * @param {string} taskId - ID завдання
 * @param {number} progress - Новий прогрес (процент або значення)
 * @param {Object} options - Додаткові опції
 * @returns {boolean} Успішність оновлення
 */
export function updateProgress(taskId, progress, options = {}) {
    // Перевіряємо, чи є такий елемент прогресу
    if (!state.progressElements.has(taskId)) return false;

    const { element, config } = state.progressElements.get(taskId);
    if (!element) return false;

    // Оновлений конфіг
    const updatedConfig = { ...config, ...options };

    // Визначаємо тип прогресу
    const isSteps = updatedConfig.showSteps || element.querySelector('.progress-steps');

    // Оновлюємо відповідно до типу
    if (isSteps) {
        // Для покрокового прогресу
        updateStepsProgress(
            element,
            progress,
            updatedConfig.maxValue || parseInt(element.querySelector('.progress-text')?.textContent.split('/')[1]) || 100,
            updatedConfig
        );
    } else {
        // Для звичайного прогрес-бару
        updateProgressBar(element, progress, updatedConfig);
    }

    return true;
}

/**
 * Отримання елемента прогресу для завдання
 * @param {string} taskId - ID завдання
 * @returns {HTMLElement|null} Елемент прогресу
 */
export function getProgressElement(taskId) {
    if (!state.progressElements.has(taskId)) return null;
    return state.progressElements.get(taskId).element;
}

/**
 * Оновлення всіх елементів прогресу з додатковими опціями
 * @param {Object} options - Опції для всіх елементів
 */
export function updateAllProgress(options = {}) {
    state.progressElements.forEach((data, taskId) => {
        const { element, config } = data;
        const progress = parseFloat(element.querySelector(`.${config.barClassName}`)?.style.width) || 0;
        updateProgress(taskId, progress, options);
    });
}

/**
 * Очищення ресурсів модуля
 */
export function cleanup() {
    state.progressElements.clear();
}

// Автоматична ініціалізація
setTimeout(init, 0);

// Публічний API модуля
const exports = {
    render,
    updateProgress,
    getProgressElement,
    updateAllProgress,
    cleanup,
    init
};

export default exports;