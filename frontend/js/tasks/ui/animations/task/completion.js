/**
 * Completion - модуль для анімацій завершення завдань
 * Відповідає за:
 * - Спеціальні ефекти при успішному завершенні завдання
 * - Анімації переходів між станами завдань
 * - Ефекти святкування успіху
 * @version 3.0.0
 */

import { getLogger, LOG_CATEGORIES } from '../../../utils/logger.js';
import { state } from '../core.js';
import { createSuccessParticles } from '../effects/particles.js';
import { highlightElement, pulseElement } from '../effects/transitions.js';

// Ініціалізуємо логер для модуля
const logger = getLogger('UI.Animations.Task.Completion');

/**
 * Анімація успішного виконання завдання
 * @param {string} taskId - ID завдання
 * @param {Object} options - Додаткові опції
 * @returns {boolean} Успішність виконання анімації
 */
export function animateTaskCompletion(taskId, options = {}) {
    // Знаходимо елемент завдання
    const taskElement = document.querySelector(`.task-item[data-task-id="${taskId}"]`);

    if (!taskElement) {
        logger.warn(`Не знайдено елемент завдання для анімації: ${taskId}`, 'animateTaskCompletion', {
            category: LOG_CATEGORIES.ANIMATION
        });
        return false;
    }

    // Налаштування за замовчуванням
    const settings = {
        showParticles: state.highQualityEffects,
        highlight: true,
        pulse: true,
        ...options
    };

    logger.info(`Анімація успішного виконання завдання ${taskId}`, 'animateTaskCompletion', {
        category: LOG_CATEGORIES.ANIMATION,
        details: { taskId, options: settings }
    });

    try {
        // Додаємо клас для анімації
        taskElement.classList.add('task-completed');

        // Додаємо ефект пульсації
        if (settings.pulse) {
            pulseElement(taskElement, 1.03, 800);
        }

        // Додаємо ефект підсвічування
        if (settings.highlight) {
            highlightElement(taskElement, 'rgba(0, 201, 167, 0.6)', 1500);
        }

        // Додаємо анімацію часток для потужних пристроїв
        if (settings.showParticles) {
            setTimeout(() => {
                createSuccessParticles(taskElement, {
                    count: 12,
                    duration: [800, 1500]
                });
            }, 300);
        }

        // Знаходимо іконку статусу і анімуємо її
        const statusIcon = taskElement.querySelector('.task-status-icon');
        if (statusIcon) {
            statusIcon.classList.add('animate-success');

            // Видаляємо клас анімації після завершення
            setTimeout(() => {
                statusIcon.classList.remove('animate-success');
            }, 1500);
        }

        // Оновлюємо текст статусу, якщо є
        const statusText = taskElement.querySelector('.task-status-text');
        if (statusText) {
            // Зберігаємо попередній текст
            const originalText = statusText.textContent;

            // Встановлюємо новий текст з анімацією
            statusText.style.transition = 'opacity 0.3s ease';
            statusText.style.opacity = '0';

            setTimeout(() => {
                statusText.textContent = 'Виконано';
                statusText.style.opacity = '1';

                // Якщо потрібно повернути назад
                if (settings.revertStatusText) {
                    setTimeout(() => {
                        statusText.style.opacity = '0';
                        setTimeout(() => {
                            statusText.textContent = originalText;
                            statusText.style.opacity = '1';
                        }, 300);
                    }, 2000);
                }
            }, 300);
        }

        // Генеруємо подію завершення анімації
        setTimeout(() => {
            taskElement.dispatchEvent(new CustomEvent('completion-animation-ended', {
                bubbles: true,
                detail: { taskId }
            }));
        }, 1500);

        return true;
    } catch (error) {
        logger.error(error, `Помилка анімації завершення завдання ${taskId}`, {
            category: LOG_CATEGORIES.ANIMATION
        });
        return false;
    }
}

/**
 * Анімація помилки при виконанні завдання
 * @param {string} taskId - ID завдання
 * @param {Object} options - Додаткові опції
 * @returns {boolean} Успішність виконання анімації
 */
export function animateTaskError(taskId, options = {}) {
    // Знаходимо елемент завдання
    const taskElement = document.querySelector(`.task-item[data-task-id="${taskId}"]`);

    if (!taskElement) {
        logger.warn(`Не знайдено елемент завдання для анімації помилки: ${taskId}`, 'animateTaskError', {
            category: LOG_CATEGORIES.ANIMATION
        });
        return false;
    }

    // Налаштування за замовчуванням
    const settings = {
        highlight: true,
        shake: true,
        ...options
    };

    logger.info(`Анімація помилки завдання ${taskId}`, 'animateTaskError', {
        category: LOG_CATEGORIES.ANIMATION,
        details: { taskId, options: settings }
    });

    try {
        // Додаємо клас для анімації
        taskElement.classList.add('task-error');

        // Додаємо ефект підсвічування червоним
        if (settings.highlight) {
            highlightElement(taskElement, 'rgba(255, 82, 82, 0.6)', 1200);
        }

        // Додаємо ефект тремтіння
        if (settings.shake) {
            taskElement.classList.add('shake-animation');

            // Видаляємо клас анімації після завершення
            setTimeout(() => {
                taskElement.classList.remove('shake-animation');
            }, 1000);
        }

        // Знаходимо іконку статусу і анімуємо її
        const statusIcon = taskElement.querySelector('.task-status-icon');
        if (statusIcon) {
            statusIcon.classList.add('animate-error');

            // Видаляємо клас анімації після завершення
            setTimeout(() => {
                statusIcon.classList.remove('animate-error');
            }, 1200);
        }

        // Оновлюємо текст статусу, якщо є
        const statusText = taskElement.querySelector('.task-status-text');
        if (statusText) {
            // Зберігаємо попередній текст
            const originalText = statusText.textContent;

            // Встановлюємо новий текст з анімацією
            statusText.style.transition = 'opacity 0.3s ease';
            statusText.style.opacity = '0';

            setTimeout(() => {
                statusText.textContent = 'Помилка';
                statusText.style.color = '#FF5252';
                statusText.style.opacity = '1';

                // Повертаємо назад через деякий час
                setTimeout(() => {
                    statusText.style.opacity = '0';
                    setTimeout(() => {
                        statusText.textContent = originalText;
                        statusText.style.color = '';
                        statusText.style.opacity = '1';
                    }, 300);
                }, 2000);
            }, 300);
        }

        return true;
    } catch (error) {
        logger.error(error, `Помилка анімації помилки завдання ${taskId}`, {
            category: LOG_CATEGORIES.ANIMATION
        });
        return false;
    }
}

/**
 * Анімація для закінчення терміну дії завдання
 * @param {string} taskId - ID завдання
 * @param {Object} options - Додаткові опції
 * @returns {boolean} Успішність виконання анімації
 */
export function animateTaskExpiration(taskId, options = {}) {
    // Знаходимо елемент завдання
    const taskElement = document.querySelector(`.task-item[data-task-id="${taskId}"]`);

    if (!taskElement) {
        logger.warn(`Не знайдено елемент завдання для анімації закінчення: ${taskId}`, 'animateTaskExpiration', {
            category: LOG_CATEGORIES.ANIMATION
        });
        return false;
    }

    // Налаштування за замовчуванням
    const settings = {
        fade: true,
        ...options
    };

    logger.info(`Анімація закінчення терміну дії завдання ${taskId}`, 'animateTaskExpiration', {
        category: LOG_CATEGORIES.ANIMATION,
        details: { taskId, options: settings }
    });

    try {
        // Додаємо клас для анімації
        taskElement.classList.add('task-expired');

        // Додаємо ефект затухання
        if (settings.fade) {
            taskElement.style.transition = 'opacity 1s ease, transform 1s ease';
            taskElement.style.opacity = '0.7';
            taskElement.style.transform = 'scale(0.98)';

            // Повертаємо нормальний вигляд після затухання
            setTimeout(() => {
                taskElement.style.opacity = '1';
                taskElement.style.transform = 'scale(1)';
            }, 1000);
        }

        // Знаходимо таймер, якщо є, і змінюємо його вигляд
        const timerElement = taskElement.querySelector('.timer-container');
        if (timerElement) {
            timerElement.classList.add('expired');

            const timerValue = timerElement.querySelector('.timer-value');
            if (timerValue) {
                timerValue.textContent = 'Закінчено';
            }
        }

        // Знаходимо контейнер дій і змінюємо його вміст
        const actionContainer = taskElement.querySelector('.task-action');
        if (actionContainer) {
            actionContainer.innerHTML = '<div class="expired-label" data-lang-key="earn.expired">Закінчено</div>';
        }

        return true;
    } catch (error) {
        logger.error(error, `Помилка анімації закінчення терміну завдання ${taskId}`, {
            category: LOG_CATEGORIES.ANIMATION
        });
        return false;
    }
}

/**
 * Анімація початку виконання завдання
 * @param {string} taskId - ID завдання
 * @param {Object} options - Додаткові опції
 * @returns {boolean} Успішність виконання анімації
 */
export function animateTaskStart(taskId, options = {}) {
    // Знаходимо елемент завдання
    const taskElement = document.querySelector(`.task-item[data-task-id="${taskId}"]`);

    if (!taskElement) {
        logger.warn(`Не знайдено елемент завдання для анімації старту: ${taskId}`, 'animateTaskStart', {
            category: LOG_CATEGORIES.ANIMATION
        });
        return false;
    }

    // Налаштування за замовчуванням
    const settings = {
        pulse: true,
        highlight: true,
        ...options
    };

    logger.info(`Анімація початку виконання завдання ${taskId}`, 'animateTaskStart', {
        category: LOG_CATEGORIES.ANIMATION,
        details: { taskId, options: settings }
    });

    try {
        // Додаємо клас для анімації
        taskElement.classList.add('task-in-progress');

        // Додаємо ефект пульсації
        if (settings.pulse) {
            pulseElement(taskElement, 1.02, 600);
        }

        // Додаємо ефект підсвічування
        if (settings.highlight) {
            highlightElement(taskElement, 'rgba(78, 181, 247, 0.6)', 1000);
        }

        // Знаходимо контейнер дій і змінюємо його вміст
        const actionContainer = taskElement.querySelector('.task-action');
        if (actionContainer) {
            actionContainer.innerHTML = `
                <button class="action-button verify-button" data-action="verify" data-task-id="${taskId}" data-lang-key="earn.verify">Перевірити</button>
            `;

            // Додаємо обробник для кнопки
            const verifyButton = actionContainer.querySelector('.verify-button');
            if (verifyButton) {
                verifyButton.addEventListener('click', function(event) {
                    event.preventDefault();

                    // Викликаємо метод перевірки, якщо доступний
                    if (window.TaskManager && typeof window.TaskManager.verifyTask === 'function') {
                        window.TaskManager.verifyTask(taskId);
                    }
                });
            }
        }

        return true;
    } catch (error) {
        logger.error(error, `Помилка анімації початку виконання завдання ${taskId}`, {
            category: LOG_CATEGORIES.ANIMATION
        });
        return false;
    }
}

// Експортуємо публічне API модуля
export {
    animateTaskCompletion,
    animateTaskError,
    animateTaskExpiration,
    animateTaskStart
};