/**
 * LimitedRenderer - рендерер для лімітованих за часом завдань
 *
 * Відповідає за:
 * - Відображення лімітованих завдань з таймером
 * - Інтеграцію з системою таймерів
 * - Рендеринг специфічних елементів для лімітованих завдань
 */

import dependencyContainer from '../../utils/dependency-container.js';

// Приватні змінні модуля
const tasks = new Map(); // Зберігає посилання на активні завдання

// Залежності
let TimeUtils = null;
let DOMUtils = null;
let TaskCard = null;
let taskSystem = null;
let uiNotifications = null;

/**
 * Ініціалізація рендерера та отримання залежностей
 */
function initialize() {
    // Отримуємо TimeUtils з контейнера залежностей
    TimeUtils = dependencyContainer.resolve('TimeUtils');

    // Отримуємо DOMUtils з контейнера залежностей
    DOMUtils = dependencyContainer.resolve('DOMUtils');

    // Отримуємо TaskCard з контейнера залежностей
    TaskCard = dependencyContainer.resolve('TaskCard');

    // Отримуємо TaskSystem з контейнера залежностей
    taskSystem = dependencyContainer.resolve('TaskSystem') ||
                dependencyContainer.resolve('TaskManager');

    // Отримуємо сервіс сповіщень
    uiNotifications = dependencyContainer.resolve('UI.Notifications');

    // Реєструємо себе в контейнері залежностей
    dependencyContainer.register('LimitedRenderer', LimitedRenderer);
}

/**
 * Створення елементу лімітованого завдання
 * @param {Object} task - Модель завдання
 * @param {Object} progress - Прогрес виконання
 * @returns {HTMLElement} DOM елемент завдання
 */
export function render(task, progress) {
    // Ініціалізуємо рендерер, якщо ще не зроблено
    if (!TimeUtils || !DOMUtils) {
        initialize();
    }

    // Перевіряємо валідність даних
    if (!task || !task.id) {
        console.error('LimitedRenderer: Отримано некоректні дані завдання');
        return document.createElement('div');
    }

    // Базові опції для TaskCard
    const options = {
        customClass: 'limited-task',
        allowVerification: true
    };

    // Створюємо базову картку через TaskCard
    let taskElement;

    if (TaskCard) {
        taskElement = TaskCard.create(task, progress, options);
    } else {
        // Запасний варіант, якщо TaskCard недоступний
        taskElement = createFallbackElement(task, progress);
    }

    // Додаємо специфічні елементи для лімітованого завдання
    enhanceWithLimitedFeatures(taskElement, task, progress);

    // Зберігаємо посилання на елемент
    tasks.set(task.id, {
        element: taskElement,
        task: task,
        progress: progress
    });

    return taskElement;
}

/**
 * Створення запасного елемента, якщо TaskCard недоступний
 */
function createFallbackElement(task, progress) {
    const isCompleted = progress && progress.status === 'completed';
    const taskElement = document.createElement('div');
    taskElement.className = 'task-item limited-task';
    taskElement.dataset.taskId = task.id;
    taskElement.dataset.taskType = 'limited';

    // Наповнюємо базовим контентом
    if (DOMUtils && DOMUtils.escapeHTML) {
        taskElement.innerHTML = `
            <div class="task-header">
                <div class="task-title">${DOMUtils.escapeHTML(task.title)}</div>
                <div class="task-reward">${task.reward_amount} ${task.reward_type === 'tokens' ? '$WINIX' : 'жетонів'}</div>
            </div>
            <div class="task-description">${DOMUtils.escapeHTML(task.description)}</div>
            <div class="task-progress-container"></div>
            <div class="task-action"></div>
        `;
    } else {
        // Якщо DOMUtils недоступний, створюємо простий варіант
        taskElement.innerHTML = `
            <div class="task-header">
                <div class="task-title">${escapeHtml(task.title)}</div>
                <div class="task-reward">${task.reward_amount} ${task.reward_type === 'tokens' ? '$WINIX' : 'жетонів'}</div>
            </div>
            <div class="task-description">${escapeHtml(task.description)}</div>
            <div class="task-progress-container"></div>
            <div class="task-action"></div>
        `;
    }

    // Додаємо клас для завершеного завдання
    if (isCompleted) {
        taskElement.classList.add('completed');
    }

    return taskElement;
}

/**
 * Додавання специфічних елементів для лімітованого завдання
 */
function enhanceWithLimitedFeatures(taskElement, task, progress) {
    // Перевіряємо кінцеву дату і розраховуємо статус
    let isExpired = false;

    if (task.end_date) {
        let endDate;

        // Парсимо дату з використанням TimeUtils, якщо доступний
        if (TimeUtils && TimeUtils.parseDate) {
            endDate = TimeUtils.parseDate(task.end_date);
        } else {
            // Запасний варіант
            endDate = new Date(task.end_date);
        }

        // Перевіряємо, чи не закінчився термін
        const now = new Date();
        isExpired = endDate <= now;

        // Якщо термін не закінчився і завдання не виконане, додаємо таймер
        const isCompleted = progress && progress.status === 'completed';

        if (!isExpired && !isCompleted) {
            addCountdownTimer(taskElement, task);
        } else if (isExpired) {
            // Додаємо позначку про закінчення терміну
            taskElement.classList.add('expired');

            // Знаходимо або створюємо контейнер для таймера
            let timerContainer = taskElement.querySelector('.timer-container');

            if (!timerContainer) {
                timerContainer = document.createElement('div');
                timerContainer.className = 'timer-container expired';

                // Додаємо контейнер після заголовка
                const headerElement = taskElement.querySelector('.task-header');
                if (headerElement) {
                    headerElement.appendChild(timerContainer);
                }
            }

            timerContainer.innerHTML = `
                <span class="timer-icon"></span>
                <span data-lang-key="earn.expired">Закінчено</span>
            `;
        }
    }
}

/**
 * Додавання таймера зворотного відліку
 */
function addCountdownTimer(taskElement, task) {
    if (!task.end_date) return;

    // Створюємо контейнер для таймера
    const timerContainer = document.createElement('div');
    timerContainer.className = 'timer-container';

    // Створюємо елемент відліку
    const timerElement = document.createElement('span');
    timerElement.className = 'timer-value';
    timerElement.dataset.endDate = task.end_date;
    timerElement.dataset.format = 'short';

    // Додаємо іконку
    const timerIcon = document.createElement('span');
    timerIcon.className = 'timer-icon';

    // Складаємо все разом
    timerContainer.appendChild(timerIcon);
    timerContainer.appendChild(timerElement);

    // Додаємо контейнер після заголовка
    const headerElement = taskElement.querySelector('.task-header');
    if (headerElement) {
        headerElement.appendChild(timerContainer);
    }

    // Ініціалізуємо таймер
    initializeTimer(task.id, timerElement);
}

/**
 * Ініціалізація таймера
 */
function initializeTimer(taskId, timerElement) {
    // Отримуємо кінцеву дату
    const endDate = timerElement.getAttribute('data-end-date');
    if (!endDate) return;

    // Перевіряємо, чи доступний TimeUtils
    if (!TimeUtils) {
        // Спроба отримати з контейнера, якщо ще не отримано
        TimeUtils = dependencyContainer.resolve('TimeUtils');

        // Якщо все ще недоступний, виходимо
        if (!TimeUtils) {
            console.error('LimitedRenderer: TimeUtils недоступний для створення таймера');
            return;
        }
    }

    // Функція, що викликається при закінченні часу
    const onTimerComplete = function() {
        const taskData = tasks.get(taskId);
        if (taskData && taskData.element) {
            taskData.element.classList.add('expired');
            refreshTaskDisplay(taskId);
        }
    };

    // Використовуємо TimeUtils для створення таймера
    TimeUtils.createCountdown({
        element: timerElement,
        endDate: endDate,
        format: 'short',
        onComplete: onTimerComplete
    });
}

/**
 * Оновлення відображення завдання
 */
export function refreshTaskDisplay(taskId) {
    // Отримуємо TaskSystem з контейнера залежностей, якщо ще не отримано
    if (!taskSystem) {
        taskSystem = dependencyContainer.resolve('TaskSystem') ||
                    dependencyContainer.resolve('TaskManager');
    }

    // Якщо є TaskSystem, делегуємо обробку йому
    if (taskSystem && typeof taskSystem.refreshTaskDisplay === 'function') {
        taskSystem.refreshTaskDisplay(taskId);
        return;
    }

    // Якщо є TaskManager, делегуємо обробку йому (для зворотної сумісності)
    if (window.TaskManager && window.TaskManager.refreshTaskDisplay) {
        window.TaskManager.refreshTaskDisplay(taskId);
        return;
    }

    // Інакше робимо власне оновлення
    const taskData = tasks.get(taskId);
    if (!taskData) return;

    // Дістаємо актуальні дані
    const task = taskData.task;
    const progress = taskData.progress;

    // Повторно рендеримо завдання
    const newElement = render(task, progress);

    // Замінюємо старий елемент новим
    if (taskData.element && taskData.element.parentNode) {
        taskData.element.parentNode.replaceChild(newElement, taskData.element);
    }

    // Оновлюємо посилання на елемент
    taskData.element = newElement;
    tasks.set(taskId, taskData);
}

/**
 * Показати повідомлення про успіх
 */
function showSuccessMessage(message) {
    // Отримуємо сервіс сповіщень з контейнера, якщо ще не отримано
    if (!uiNotifications) {
        uiNotifications = dependencyContainer.resolve('UI.Notifications');
    }

    if (uiNotifications && typeof uiNotifications.showSuccess === 'function') {
        uiNotifications.showSuccess(message);
    } else if (window.UI && window.UI.Notifications && window.UI.Notifications.showSuccess) {
        window.UI.Notifications.showSuccess(message);
    } else if (typeof window.showToast === 'function') {
        window.showToast(message, 'success');
    } else {
        alert(message);
    }
}

/**
 * Показати повідомлення про помилку
 */
function showErrorMessage(message) {
    // Отримуємо сервіс сповіщень з контейнера, якщо ще не отримано
    if (!uiNotifications) {
        uiNotifications = dependencyContainer.resolve('UI.Notifications');
    }

    if (uiNotifications && typeof uiNotifications.showError === 'function') {
        uiNotifications.showError(message);
    } else if (window.UI && window.UI.Notifications && window.UI.Notifications.showError) {
        window.UI.Notifications.showError(message);
    } else if (typeof window.showToast === 'function') {
        window.showToast(message, 'error');
    } else {
        alert(message);
    }
}

/**
 * Функція для безпечного виведення HTML
 */
function escapeHtml(text) {
    if (!text) return '';

    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

/**
 * Очищення ресурсів
 */
export function cleanup() {
    // Отримуємо DOMUtils з контейнера залежностей, якщо ще не отримано
    if (!DOMUtils) {
        DOMUtils = dependencyContainer.resolve('DOMUtils');
    }

    // Очищаємо таймери
    tasks.forEach((taskData) => {
        const timerElement = taskData.element.querySelector('.timer-value');
        if (timerElement && timerElement.dataset.timerId) {
            clearInterval(parseInt(timerElement.dataset.timerId));
        }
    });

    // Очищаємо карту завдань
    tasks.clear();
}

// Підписуємося на подію виходу зі сторінки
if (DOMUtils && DOMUtils.addEvent) {
    DOMUtils.addEvent(window, 'beforeunload', cleanup);
} else {
    // Запасний варіант
    window.addEventListener('beforeunload', cleanup);
}

// Публічний API
const LimitedRenderer = {
    render,
    refreshTaskDisplay,
    cleanup,
    initialize
};

// Для зворотньої сумісності зі старим кодом
window.LimitedRenderer = LimitedRenderer;

// Автоматична ініціалізація при завантаженні модуля
setTimeout(initialize, 0);

export default LimitedRenderer;