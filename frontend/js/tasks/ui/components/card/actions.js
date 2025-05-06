/**
 * TaskCard.actions - модуль для роботи з діями картки завдання
 *
 * Відповідає за:
 * - Налаштування кнопок дій
 * - Обробку взаємодії з елементами картки
 * - Оновлення статусу дій
 */

import dependencyContainer from '../../../utils/dependency-container.js';

// Отримання залежностей
let taskManager = null;
let uiNotifications = null;

/**
 * Ініціалізація модуля та отримання залежностей
 */
function initialize() {
    // Отримуємо TaskManager з контейнера залежностей
    taskManager = dependencyContainer.resolve('TaskManager') ||
                 dependencyContainer.resolve('TaskSystem');

    // Отримуємо сервіс сповіщень
    uiNotifications = dependencyContainer.resolve('UI.Notifications');

    // Реєструємо себе в контейнері залежностей
    dependencyContainer.register('TaskCardActions', exports);
}

/**
 * Налаштування кнопок дій для завдання
 * @param {HTMLElement} taskElement - Елемент картки
 * @param {Object} task - Дані завдання
 * @param {Object} progress - Прогрес виконання
 * @param {Object} options - Додаткові опції
 */
export function setupActionButtons(taskElement, task, progress, options = {}) {
    const actionContainer = taskElement.querySelector('.task-action');
    if (!actionContainer) return;

    const isCompleted = progress && progress.status === 'completed';
    const isExpired = task.end_date && new Date(task.end_date) <= new Date();

    // Для завершених завдань показуємо лише статус
    if (isCompleted) {
        actionContainer.innerHTML = '<div class="completed-label" data-lang-key="earn.completed">Виконано</div>';
        return;
    }

    // Для прострочених завдань показуємо відповідний статус
    if (isExpired) {
        actionContainer.innerHTML = '<div class="expired-label" data-lang-key="earn.expired">Закінчено</div>';
        return;
    }

    // Визначаємо, який статус у прогресу завдання
    const needsVerification = progress && (progress.status === 'started' || progress.status === 'ready_to_verify');

    // Якщо завдання потребує перевірки, додаємо кнопку "Перевірити"
    if (needsVerification) {
        const verifyBtn = createButton({
            className: 'action-button verify-button',
            action: 'verify',
            taskId: task.id,
            text: 'Перевірити',
            langKey: 'earn.verify'
        });

        verifyBtn.addEventListener('click', function(event) {
            event.preventDefault();
            handleVerifyTask(task.id);
        });

        actionContainer.appendChild(verifyBtn);
    }
    // Інакше додаємо кнопку "Виконати" / "Почати"
    else {
        const startBtn = createButton({
            className: 'action-button',
            action: 'start',
            taskId: task.id,
            text: task.action_label || 'Виконати',
            langKey: `earn.${task.action_type || 'start'}`
        });

        startBtn.addEventListener('click', function(event) {
            event.preventDefault();
            handleStartTask(task.id);
        });

        actionContainer.appendChild(startBtn);

        // Якщо дозволено перевірку, додаємо і кнопку "Перевірити"
        if (options.allowVerification) {
            const verifyBtn = createButton({
                className: 'action-button verify-button',
                action: 'verify',
                taskId: task.id,
                text: 'Перевірити',
                langKey: 'earn.verify'
            });

            verifyBtn.addEventListener('click', function(event) {
                event.preventDefault();
                handleVerifyTask(task.id);
            });

            actionContainer.appendChild(verifyBtn);
        }
    }
}

/**
 * Створення кнопки
 * @param {Object} options - Параметри кнопки
 * @returns {HTMLElement} Елемент кнопки
 */
function createButton(options) {
    const button = document.createElement('button');
    button.className = options.className || 'action-button';
    button.dataset.action = options.action;
    button.dataset.taskId = options.taskId;

    if (options.langKey) {
        button.setAttribute('data-lang-key', options.langKey);
    }

    button.textContent = options.text || 'Дія';

    return button;
}

/**
 * Обробка початку виконання завдання
 * @param {string} taskId - ID завдання
 */
export function handleStartTask(taskId) {
    // Ініціалізуємо модуль при першому використанні
    if (!taskManager) {
        initialize();
    }

    // Отримуємо елемент завдання
    const taskElement = document.querySelector(`.task-item[data-task-id="${taskId}"]`);
    if (!taskElement) return;

    // Оновлюємо відображення (показуємо індикатор завантаження)
    updateActionStatus(taskElement, 'loading');

    // Викликаємо TaskManager для запуску завдання
    if (taskManager && typeof taskManager.startTask === 'function') {
        taskManager.startTask(taskId)
            .then(response => {
                // Обробляємо успішну відповідь
                if (response.success) {
                    showSuccessMessage(response.message || 'Завдання успішно активовано');

                    // Якщо є URL дії, відкриваємо його у новому вікні
                    if (response.action_url) {
                        window.open(response.action_url, '_blank', 'noopener,noreferrer');
                    }

                    // Оновлюємо статус для перевірки
                    updateActionStatus(taskElement, 'ready-to-verify');
                } else {
                    // Обробляємо помилку
                    showErrorMessage(response.message || 'Помилка запуску завдання');
                    updateActionStatus(taskElement, 'error');
                }
            })
            .catch(error => {
                // Обробляємо помилку
                showErrorMessage('Помилка запуску завдання');
                updateActionStatus(taskElement, 'error');
                console.error('Помилка запуску завдання:', error);
            });
    } else {
        // Якщо TaskManager недоступний, повертаємо звичайний стан
        showErrorMessage('TaskManager недоступний');
        updateActionStatus(taskElement, 'error');
    }
}

/**
 * Обробка перевірки виконання завдання
 * @param {string} taskId - ID завдання
 */
export function handleVerifyTask(taskId) {
    // Ініціалізуємо модуль при першому використанні
    if (!taskManager) {
        initialize();
    }

    // Отримуємо елемент завдання
    const taskElement = document.querySelector(`.task-item[data-task-id="${taskId}"]`);
    if (!taskElement) return;

    // Оновлюємо відображення (показуємо індикатор завантаження)
    updateActionStatus(taskElement, 'loading');

    // Викликаємо TaskManager для перевірки завдання
    if (taskManager && typeof taskManager.verifyTask === 'function') {
        taskManager.verifyTask(taskId)
            .then(response => {
                if (response.success) {
                    // Обробляємо успішну відповідь
                    showSuccessMessage(response.message || 'Завдання успішно виконано');
                    updateActionStatus(taskElement, 'completed');

                    // Якщо є винагорода, показуємо її
                    if (response.reward && window.RewardBadge) {
                        window.RewardBadge.showAnimation(response.reward);
                    }
                } else {
                    // Обробляємо помилку
                    showErrorMessage(response.message || 'Помилка перевірки завдання');
                    updateActionStatus(taskElement, 'error');
                }
            })
            .catch(error => {
                // Обробляємо помилку
                showErrorMessage('Помилка перевірки завдання');
                updateActionStatus(taskElement, 'error');
                console.error('Помилка перевірки завдання:', error);
            });
    } else {
        // Якщо TaskManager недоступний, повертаємо звичайний стан
        showErrorMessage('TaskManager недоступний');
        updateActionStatus(taskElement, 'ready-to-verify');
    }
}

/**
 * Оновлення елементу дій відповідно до статусу
 * @param {HTMLElement} taskElement - Елемент завдання
 * @param {string} status - Новий статус
 */
export function updateActionStatus(taskElement, status) {
    const actionContainer = taskElement.querySelector('.task-action');
    if (!actionContainer) return;

    const taskId = taskElement.dataset.taskId;

    // Оновлюємо класи елемента
    taskElement.classList.remove('loading', 'completed', 'error', 'in-progress', 'ready-to-verify', 'expired');
    if (status) {
        taskElement.classList.add(status);
    }

    // Оновлюємо вміст елемента дій відповідно до статусу
    switch (status) {
        case 'completed':
            actionContainer.innerHTML = '<div class="completed-label" data-lang-key="earn.completed">Виконано</div>';
            break;

        case 'loading':
            actionContainer.innerHTML = `
                <div class="loading-indicator">
                    <div class="spinner"></div>
                    <span data-lang-key="earn.verifying">Перевірка...</span>
                </div>
            `;
            break;

        case 'ready-to-verify':
            actionContainer.innerHTML = `
                <button class="action-button verify-button" data-action="verify" data-task-id="${taskId}" data-lang-key="earn.verify">Перевірити</button>
            `;
            // Відновлюємо обробники подій
            const verifyBtn = actionContainer.querySelector('.verify-button');
            if (verifyBtn) {
                verifyBtn.addEventListener('click', function(event) {
                    event.preventDefault();
                    handleVerifyTask(taskId);
                });
            }
            break;

        case 'expired':
            actionContainer.innerHTML = '<div class="expired-label" data-lang-key="earn.expired">Закінчено</div>';
            break;

        case 'error':
            // Показуємо кнопку для повторної спроби
            actionContainer.innerHTML = `
                <button class="action-button" data-action="start" data-task-id="${taskId}" data-lang-key="earn.retry">Спробувати знову</button>
            `;
            // Відновлюємо обробники подій
            const retryBtn = actionContainer.querySelector('.action-button');
            if (retryBtn) {
                retryBtn.addEventListener('click', function(event) {
                    event.preventDefault();
                    handleStartTask(taskId);
                });
            }
            break;

        default:
            // Базовий статус - кнопка "Виконати"
            actionContainer.innerHTML = `
                <button class="action-button" data-action="start" data-task-id="${taskId}" data-lang-key="earn.start">Виконати</button>
            `;
            // Відновлюємо обробники подій
            const startBtn = actionContainer.querySelector('.action-button');
            if (startBtn) {
                startBtn.addEventListener('click', function(event) {
                    event.preventDefault();
                    handleStartTask(taskId);
                });
            }
            break;
    }
}

/**
 * Показати повідомлення про успіх
 * @param {string} message - Повідомлення
 */
function showSuccessMessage(message) {
    // Ініціалізуємо модуль при першому використанні
    if (!uiNotifications) {
        initialize();
    }

    // Використовуємо UI.Notifications, якщо доступно
    if (uiNotifications && typeof uiNotifications.showSuccess === 'function') {
        uiNotifications.showSuccess(message);
    } else if (window.UI && window.UI.Notifications && window.UI.Notifications.showSuccess) {
        window.UI.Notifications.showSuccess(message);
    } else if (typeof window.showToast === 'function') {
        window.showToast(message, false);
    } else {
        // Запасний варіант
        console.log('Успіх:', message);
    }
}

/**
 * Показати повідомлення про помилку
 * @param {string} message - Повідомлення
 */
function showErrorMessage(message) {
    // Ініціалізуємо модуль при першому використанні
    if (!uiNotifications) {
        initialize();
    }

    // Використовуємо UI.Notifications, якщо доступно
    if (uiNotifications && typeof uiNotifications.showError === 'function') {
        uiNotifications.showError(message);
    } else if (window.UI && window.UI.Notifications && window.UI.Notifications.showError) {
        window.UI.Notifications.showError(message);
    } else if (typeof window.showToast === 'function') {
        window.showToast(message, true);
    } else {
        // Запасний варіант
        console.error('Помилка:', message);
    }
}

// Автоматична ініціалізація при першому імпорті
setTimeout(initialize, 0);

// Експорт всіх функцій
const exports = {
    setupActionButtons,
    handleStartTask,
    handleVerifyTask,
    updateActionStatus,
    initialize
};

export default exports;