/**
 * Progress Animations - модуль для анімації прогресу завдань
 * Відповідає за:
 * - Візуальні ефекти для успішного виконання завдань
 * - Анімацію прогрес-барів та індикаторів
 * - Ефекти переходів між станами завдань
 * @version 3.0.0
 */

import { getLogger, LOG_CATEGORIES } from '../../utils/logger.js';
import { state, config } from './core.js';
import { createSuccessParticles } from '../../utils/dom.js';;

// Ініціалізуємо логер для модуля
const logger = getLogger('UI.Animations.Progress');

/**
 * Анімація успішного виконання завдання
 */
export function animateSuccessfulCompletion(taskId) {
    const taskElement = document.querySelector(`.task-item[data-task-id="${taskId}"]`);
    if (!taskElement) {
        logger.warn(`Не знайдено елемент завдання для анімації: ${taskId}`, 'animateSuccessfulCompletion', {
            category: LOG_CATEGORIES.ANIMATION
        });
        return;
    }

    // Додаємо клас для анімації
    taskElement.classList.add('success-pulse');

    logger.info(`Анімація успішного виконання завдання ${taskId}`, 'animateSuccessfulCompletion', {
        category: LOG_CATEGORIES.ANIMATION,
        details: { taskId, highQuality: state.highQualityEffects }
    });

    // Додаємо анімацію часток для потужних пристроїв
    if (state.highQualityEffects) {
        createSuccessParticles(taskElement);
    }

    // Видаляємо клас анімації через певний час
    setTimeout(() => {
        taskElement.classList.remove('success-pulse');
    }, 2000);
}

/**
 * Показати анімацію прогресу для завдання
 */
export function showProgressAnimation(taskId, progress) {
    const taskElement = document.querySelector(`.task-item[data-task-id="${taskId}"]`);
    if (!taskElement) {
        logger.warn(`Не знайдено елемент завдання для анімації прогресу: ${taskId}`, 'showProgressAnimation', {
            category: LOG_CATEGORIES.ANIMATION
        });
        return;
    }

    const progressBar = taskElement.querySelector('.progress-fill');
    if (progressBar) {
        // Зберігаємо поточне значення
        const currentWidth = parseFloat(progressBar.style.width) || 0;

        logger.info(`Анімація прогресу завдання ${taskId}: ${currentWidth}% -> ${progress}%`, 'showProgressAnimation', {
            category: LOG_CATEGORIES.ANIMATION,
            details: { taskId, currentProgress: currentWidth, newProgress: progress }
        });

        // Встановлюємо нове значення з анімацією
        progressBar.style.transition = 'width 1s cubic-bezier(0.1, 0.8, 0.2, 1)';
        progressBar.style.width = `${progress}%`;

        // Додаємо ефект пульсації якщо прогрес збільшився
        if (progress > currentWidth) {
            progressBar.classList.add('pulse');
            setTimeout(() => {
                progressBar.classList.remove('pulse');
            }, 1200);

            // Якщо прогрес більше 95%, додаємо ефект світіння
            if (progress > 95) {
                progressBar.classList.add('glow');
            } else {
                progressBar.classList.remove('glow');
            }
        }

        // Якщо прогрес досягнув 100%, додаткова анімація
        if (progress >= 100 && currentWidth < 100) {
            // Додаємо клас до батьківського елемента
            setTimeout(() => {
                taskElement.classList.add('completed');
                logger.info(`Завдання ${taskId} позначено як завершене`, 'showProgressAnimation', {
                    category: LOG_CATEGORIES.ANIMATION
                });
            }, 300);
        }
    }
}

/**
 * Анімація статусу завдання
 * @param {HTMLElement} element - Елемент завдання
 * @param {string} newStatus - Новий статус ('pending', 'started', 'completed', 'failed')
 */
export function animateTaskStatusChange(element, newStatus) {
    if (!element) return;

    // Отримуємо поточний статус
    const currentStatus = element.dataset.status || 'pending';

    // Нічого не робимо, якщо статус не змінився
    if (currentStatus === newStatus) return;

    // Додаємо клас для анімації переходу
    element.classList.add('status-transition');

    // Оновлюємо статус
    element.dataset.status = newStatus;

    // Додаємо клас для нового статусу
    element.classList.remove(`status-${currentStatus}`);
    element.classList.add(`status-${newStatus}`);

    // Анімація відповідно до нового статусу
    switch (newStatus) {
        case 'completed':
            animateSuccessfulCompletion(element.dataset.taskId);
            break;

        case 'failed':
            // Анімація провалу завдання
            element.classList.add('failure-shake');
            setTimeout(() => {
                element.classList.remove('failure-shake');
            }, 1000);
            break;

        case 'started':
            // Анімація початку виконання
            element.classList.add('starting-pulse');
            setTimeout(() => {
                element.classList.remove('starting-pulse');
            }, 1000);
            break;
    }

    // Видаляємо клас анімації переходу після завершення
    setTimeout(() => {
        element.classList.remove('status-transition');
    }, 500);

    logger.info(`Анімація зміни статусу: ${currentStatus} -> ${newStatus}`, 'animateTaskStatusChange', {
        category: LOG_CATEGORIES.ANIMATION,
        details: { taskId: element.dataset.taskId, oldStatus: currentStatus, newStatus }
    });
}

/**
 * Анімація появи нових завдань
 * @param {Array} elements - Елементи завдань
 */
export function animateTasksAppear(elements) {
    if (!elements || !elements.length) return;

    // Затримки для послідовної анімації
    const baseDelay = 50;

    elements.forEach((element, index) => {
        // Початковий стан
        element.style.transform = 'translateY(20px)';
        element.style.opacity = '0';

        // Плавна поява з затримкою для кожного елемента
        setTimeout(() => {
            element.style.transition = 'transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1), opacity 0.3s ease';
            element.style.transform = 'translateY(0)';
            element.style.opacity = '1';

            // Додаємо ефект підсвічування на короткий час
            element.classList.add('highlight-new');

            // Видаляємо ефект через певний час
            setTimeout(() => {
                element.classList.remove('highlight-new');
            }, 1000);

        }, baseDelay * index);
    });

    logger.info(`Анімація появи ${elements.length} завдань`, 'animateTasksAppear', {
        category: LOG_CATEGORIES.ANIMATION
    });
}

/**
 * Анімація фільтрації списку завдань
 * @param {HTMLElement} container - Контейнер зі списком завдань
 * @param {Function} filterFunc - Функція фільтрації (приймає елемент, повертає boolean)
 */
export function animateTasksFiltering(container, filterFunc) {
    if (!container) return;

    // Отримуємо всі елементи завдань
    const taskElements = container.querySelectorAll('.task-item');
    if (!taskElements.length) return;

    // Масиви для сортування
    const showElements = [];
    const hideElements = [];

    // Розділяємо елементи за результатом фільтрації
    taskElements.forEach(element => {
        if (filterFunc(element)) {
            showElements.push(element);
        } else {
            hideElements.push(element);
        }
    });

    // Анімуємо приховання елементів
    hideElements.forEach(element => {
        element.style.transition = 'transform 0.3s ease, opacity 0.3s ease, height 0.3s ease';
        element.style.overflow = 'hidden';
        element.style.transform = 'scale(0.95)';
        element.style.opacity = '0';
        element.style.height = '0';
    });

    // Анімуємо появу елементів з затримкою
    setTimeout(() => {
        showElements.forEach((element, index) => {
            element.style.transition = 'transform 0.4s ease, opacity 0.4s ease, height 0.3s ease';
            element.style.transform = 'scale(1)';
            element.style.opacity = '1';
            element.style.height = '';
            element.style.overflow = '';
        });
    }, 300);

    logger.info(`Анімація фільтрації завдань: показано ${showElements.length}, приховано ${hideElements.length}`,
        'animateTasksFiltering', {
            category: LOG_CATEGORIES.ANIMATION
        }
    );
}

// Експортуємо публічне API модуля
export {
    animateSuccessfulCompletion,
    showProgressAnimation,
    animateTaskStatusChange,
    animateTasksAppear,
    animateTasksFiltering
};