/**
 * SocialRenderer - рендерер для соціальних завдань
 *
 * Відповідає за:
 * - Відображення соціальних завдань
 * - Інтеграцію з системою перевірки соціальних мереж
 * - Оптимізоване відображення для високої продуктивності
 * @version 3.0.0
 */

import dependencyContainer from '../../utils/dependency-container.js';

// Типи соціальних мереж
export const SOCIAL_NETWORKS = {
    TELEGRAM: 'telegram',
    TWITTER: 'twitter',
    FACEBOOK: 'facebook',
    INSTAGRAM: 'instagram',
    DISCORD: 'discord',
    YOUTUBE: 'youtube',
    TIKTOK: 'tiktok',
    LINKEDIN: 'linkedin',
    REDDIT: 'reddit'
};

// Стани завдань
export const STATUS = {
    IDLE: 'idle',
    LOADING: 'loading',
    COMPLETED: 'completed',
    ERROR: 'error',
    IN_PROGRESS: 'in-progress',
    READY_TO_VERIFY: 'ready-to-verify'
};

// Кеш для елементів завдань
const taskElements = new Map();

// Віртуалізований рендеринг (черга оновлень)
const renderQueue = [];
let isRendering = false;

// Сервіси
let taskSystem = null;
let uiNotifications = null;

/**
 * Ініціалізація рендерера та отримання залежностей
 */
function initialize() {
    // Отримуємо TaskSystem з контейнера залежностей
    taskSystem = dependencyContainer.resolve('TaskSystem') ||
                dependencyContainer.resolve('TaskManager');

    // Отримуємо сервіс сповіщень
    uiNotifications = dependencyContainer.resolve('UI.Notifications');

    // Реєструємо себе в контейнері залежностей
    dependencyContainer.register('SocialRenderer', SocialRenderer);

    // Підписуємося на події
    document.addEventListener('DOMContentLoaded', () => {
        document.addEventListener('task-started', (event) => {
            if (event.detail && event.detail.taskId) {
                const taskElement = taskElements.get(event.detail.taskId);
                if (taskElement) {
                    updateTaskStatus(taskElement, STATUS.READY_TO_VERIFY);
                }
            }
        });

        document.addEventListener('task-completed', (event) => {
            if (event.detail && event.detail.taskId) {
                const taskElement = taskElements.get(event.detail.taskId);
                if (taskElement) {
                    updateTaskStatus(taskElement, STATUS.COMPLETED);
                }
            }
        });
    });
}

/**
 * Створення елементу соціального завдання
 * @param {Object} task - Модель завдання
 * @param {Object} progress - Прогрес виконання
 * @returns {HTMLElement} DOM елемент завдання
 */
export function render(task, progress) {
    // Ініціалізуємо рендерер, якщо ще не зроблено
    if (!taskSystem) {
        initialize();
    }

    // Перевіряємо валідність даних
    if (!task || !task.id) {
        console.error('SocialRenderer: Отримано некоректні дані завдання');
        return document.createElement('div');
    }

    // Визначаємо тип соціальної мережі
    const networkType = detectNetworkType(task);

    // Базові опції для TaskCard
    const options = {
        customClass: 'social-task',
        allowVerification: true
    };

    // Додаємо інформацію про соціальну мережу
    if (networkType) {
        options.networkType = networkType;
    }

    // Створюємо базову картку через TaskCard
    let taskElement;

    // Отримуємо TaskCard з контейнера залежностей
    const TaskCard = dependencyContainer.resolve('TaskCard');

    if (TaskCard && TaskCard.create) {
        taskElement = TaskCard.create(task, progress, options);

        // Додаємо атрибути для соціальної мережі
        if (networkType) {
            taskElement.dataset.network = networkType;
        }

        // Якщо є URL дії, безпечно додаємо його
        if (task.action_url && validateSocialUrl(task.action_url)) {
            taskElement.dataset.actionUrl = task.action_url;
        }
    } else {
        // Запасний варіант, якщо TaskCard недоступний
        taskElement = createFallbackElement(task, progress, networkType);
    }

    // Додаємо специфічні елементи для соціального завдання
    enhanceWithSocialFeatures(taskElement, task, progress, networkType);

    // Зберігаємо елемент у кеші
    taskElements.set(task.id, taskElement);

    return taskElement;
}

/**
 * Створення запасного елемента, якщо TaskCard недоступний
 */
function createFallbackElement(task, progress, networkType) {
    const isCompleted = progress && progress.status === 'completed';
    const taskElement = document.createElement('div');
    taskElement.className = 'task-item social-task';
    taskElement.dataset.taskId = task.id;
    taskElement.dataset.taskType = 'social';

    if (networkType) {
        taskElement.dataset.network = networkType;
        taskElement.classList.add(`network-${networkType}`);
    }

    // Наповнюємо базовим контентом
    taskElement.innerHTML = `
        <div class="task-header">
            <div class="task-title">${escapeHtml(task.title)}</div>
            <div class="task-reward">${task.reward_amount} ${task.reward_type === 'tokens' ? '$WINIX' : 'жетонів'}</div>
        </div>
        <div class="task-description">${escapeHtml(task.description)}</div>
        <div class="task-progress-container"></div>
        <div class="task-action"></div>
    `;

    // Додаємо клас для завершеного завдання
    if (isCompleted) {
        taskElement.classList.add('completed');
    }

    return taskElement;
}

/**
 * Додавання специфічних елементів для соціального завдання
 */
function enhanceWithSocialFeatures(taskElement, task, progress, networkType) {
    // Додаємо іконку соціальної мережі, якщо відома
    if (networkType) {
        const headerElement = taskElement.querySelector('.task-header');
        if (headerElement) {
            const iconElement = document.createElement('div');
            iconElement.className = `social-network-icon ${networkType}-icon`;

            // Додаємо іконку перед заголовком
            if (headerElement.firstChild) {
                headerElement.insertBefore(iconElement, headerElement.firstChild);
            } else {
                headerElement.appendChild(iconElement);
            }
        }
    }

    // Додаємо інформацію про URL, якщо є
    if (task.action_url && validateSocialUrl(task.action_url)) {
        const infoElement = document.createElement('div');
        infoElement.className = 'social-url-info';

        // Безпечно форматуємо URL для відображення
        let displayUrl = '';
        try {
            const urlObj = new URL(task.action_url);
            displayUrl = urlObj.hostname;
        } catch (e) {
            displayUrl = 'social-site';
        }

        infoElement.innerHTML = `
            <span class="social-site-label">Посилання:</span> 
            <span class="social-site-domain">${escapeHtml(displayUrl)}</span>
        `;

        // Додаємо інформацію після кнопок дій
        taskElement.appendChild(infoElement);
    }

    // Встановлюємо початковий статус
    let initialStatus = STATUS.IDLE;
    if (progress) {
        switch (progress.status) {
            case 'completed':
                initialStatus = STATUS.COMPLETED;
                break;
            case 'started':
                initialStatus = STATUS.READY_TO_VERIFY;
                break;
            default:
                initialStatus = STATUS.IDLE;
        }
    }

    // Оновлюємо відображення статусу
    updateTaskStatus(taskElement, initialStatus);
}

/**
 * Визначення типу соціальної мережі за URL
 */
export function detectNetworkType(task) {
    if (!task.action_url) return null;

    const url = task.action_url.toLowerCase();

    if (url.includes('telegram') || url.includes('t.me')) {
        return SOCIAL_NETWORKS.TELEGRAM;
    } else if (url.includes('twitter') || url.includes('x.com')) {
        return SOCIAL_NETWORKS.TWITTER;
    } else if (url.includes('facebook') || url.includes('fb.com')) {
        return SOCIAL_NETWORKS.FACEBOOK;
    } else if (url.includes('instagram')) {
        return SOCIAL_NETWORKS.INSTAGRAM;
    } else if (url.includes('discord')) {
        return SOCIAL_NETWORKS.DISCORD;
    } else if (url.includes('youtube') || url.includes('youtu.be')) {
        return SOCIAL_NETWORKS.YOUTUBE;
    } else if (url.includes('tiktok')) {
        return SOCIAL_NETWORKS.TIKTOK;
    } else if (url.includes('linkedin')) {
        return SOCIAL_NETWORKS.LINKEDIN;
    } else if (url.includes('reddit')) {
        return SOCIAL_NETWORKS.REDDIT;
    }

    return null;
}

/**
 * Перевірка безпеки URL для соціальних мереж
 */
export function validateSocialUrl(url) {
    try {
        // Нормалізуємо URL
        let normalizedUrl = url.trim();

        // Додаємо https:// якщо URL не має протоколу
        if (!normalizedUrl.startsWith('http://') && !normalizedUrl.startsWith('https://')) {
            normalizedUrl = `https://${normalizedUrl}`;
        }

        // Перевіряємо валідність URL
        const urlObj = new URL(normalizedUrl);

        // Перевіряємо, чи схема є http або https
        if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') {
            return false;
        }

        return true;
    } catch (error) {
        return false;
    }
}

/**
 * Оновлення статусу завдання в інтерфейсі
 */
export function updateTaskStatus(taskElement, status) {
    if (!taskElement) return;

    // Оновлюємо класи елемента
    const statusClasses = ['loading', 'completed', 'error', 'in-progress', 'ready-to-verify'];
    statusClasses.forEach(cls => taskElement.classList.remove(cls));

    // Додаємо відповідний клас
    if (status) {
        taskElement.classList.add(status);
    }

    // Оновлюємо кнопки дій в залежності від статусу
    updateActionButtons(taskElement, status);
}

/**
 * Оновлення кнопок дій залежно від статусу
 */
function updateActionButtons(taskElement, status) {
    const actionContainer = taskElement.querySelector('.task-action');
    if (!actionContainer) return;

    const taskId = taskElement.dataset.taskId;

    // Визначаємо, який вміст показувати залежно від статусу
    switch (status) {
        case STATUS.COMPLETED:
            actionContainer.innerHTML = '<div class="completed-label" data-lang-key="earn.completed">Виконано</div>';
            break;

        case STATUS.LOADING:
            actionContainer.innerHTML = `
                <div class="loading-indicator">
                    <div class="spinner"></div>
                    <span data-lang-key="earn.verifying">Перевірка...</span>
                </div>
            `;
            break;

        case STATUS.ERROR:
            // Показуємо кнопку "Виконати" з можливістю повторної спроби
            actionContainer.innerHTML = `
                <button class="action-button" data-action="start" data-task-id="${taskId}" data-lang-key="earn.retry">Спробувати знову</button>
            `;
            setupButtonHandlers(taskElement);
            break;

        case STATUS.READY_TO_VERIFY:
            // Показуємо кнопку "Перевірити"
            actionContainer.innerHTML = `
                <button class="action-button verify-button" data-action="verify" data-task-id="${taskId}" data-lang-key="earn.verify">Перевірити</button>
            `;
            setupButtonHandlers(taskElement);
            break;

        default:
            // Показуємо стандартну кнопку "Виконати"
            actionContainer.innerHTML = `
                <button class="action-button" data-action="start" data-task-id="${taskId}" data-lang-key="earn.start">Виконати</button>
            `;
            setupButtonHandlers(taskElement);
            break;
    }
}

/**
 * Налаштування обробників подій для кнопок
 */
function setupButtonHandlers(taskElement) {
    if (!taskElement) return;

    const taskId = taskElement.dataset.taskId;
    const startButton = taskElement.querySelector('.action-button[data-action="start"]');
    const verifyButton = taskElement.querySelector('.action-button[data-action="verify"]');

    // Обробник для кнопки "Виконати"
    if (startButton) {
        startButton.addEventListener('click', function(event) {
            event.preventDefault();
            event.stopPropagation();

            // Спочатку змінюємо вигляд кнопки
            updateTaskStatus(taskElement, STATUS.LOADING);

            // Отримуємо TaskSystem з контейнера, якщо ще не отримано
            if (!taskSystem) {
                taskSystem = dependencyContainer.resolve('TaskSystem') ||
                            dependencyContainer.resolve('TaskManager');
            }

            // Викликаємо TaskSystem, якщо доступний
            if (taskSystem && typeof taskSystem.startTask === 'function') {
                taskSystem.startTask(taskId);
            } else if (window.TaskManager && window.TaskManager.startTask) {
                // Для зворотної сумісності
                window.TaskManager.startTask(taskId);
            } else if (window.SocialTask && window.SocialTask.handleStartTask) {
                // Спроба використати старий інтерфейс
                const task = { id: taskId, action_url: taskElement.dataset.actionUrl };
                window.SocialTask.handleStartTask(task);
            } else {
                // Запасний варіант - відкриваємо URL безпосередньо
                const actionUrl = taskElement.dataset.actionUrl;
                if (actionUrl && validateSocialUrl(actionUrl)) {
                    window.open(actionUrl, '_blank', 'noopener,noreferrer');
                }

                // Оновлюємо статус
                setTimeout(() => {
                    updateTaskStatus(taskElement, STATUS.READY_TO_VERIFY);
                }, 1000);
            }
        });
    }

    // Обробник для кнопки "Перевірити"
    if (verifyButton) {
        verifyButton.addEventListener('click', function(event) {
            event.preventDefault();
            event.stopPropagation();

            // Спочатку змінюємо вигляд кнопки
            updateTaskStatus(taskElement, STATUS.LOADING);

            // Отримуємо TaskSystem з контейнера, якщо ще не отримано
            if (!taskSystem) {
                taskSystem = dependencyContainer.resolve('TaskSystem') ||
                            dependencyContainer.resolve('TaskManager');
            }

            // Викликаємо TaskSystem, якщо доступний
            if (taskSystem && typeof taskSystem.verifyTask === 'function') {
                taskSystem.verifyTask(taskId);
            } else if (window.TaskManager && window.TaskManager.verifyTask) {
                // Для зворотної сумісності
                window.TaskManager.verifyTask(taskId);
            } else if (window.SocialTask && window.SocialTask.handleVerifyTask) {
                // Спроба використати старий інтерфейс
                const task = { id: taskId, action_url: taskElement.dataset.actionUrl };
                window.SocialTask.handleVerifyTask(task);
            } else {
                // Запасний варіант - симуляція
                setTimeout(() => {
                    const success = Math.random() > 0.3; // 70% успіху
                    if (success) {
                        updateTaskStatus(taskElement, STATUS.COMPLETED);
                        showSuccessMessage('Завдання успішно виконано!');
                    } else {
                        updateTaskStatus(taskElement, STATUS.ERROR);
                        showErrorMessage('Не вдалося перевірити виконання завдання');
                    }
                }, 1500);
            }
        });
    }
}

/**
 * Оновлення відображення конкретного завдання
 */
export function refreshTaskDisplay(taskId) {
    // Отримуємо TaskSystem з контейнера, якщо ще не отримано
    if (!taskSystem) {
        taskSystem = dependencyContainer.resolve('TaskSystem') ||
                    dependencyContainer.resolve('TaskManager');
    }

    // Якщо є TaskSystem, делегуємо обробку йому
    if (taskSystem && typeof taskSystem.refreshTaskDisplay === 'function') {
        taskSystem.refreshTaskDisplay(taskId);
        return;
    }

    // Додаємо завдання в чергу рендерингу
    if (!renderQueue.includes(taskId)) {
        renderQueue.push(taskId);

        // Запускаємо процес рендерингу, якщо він ще не запущений
        if (!isRendering) {
            processRenderQueue();
        }
    }
}

/**
 * Обробка черги рендерингу для оптимізації продуктивності
 */
function processRenderQueue() {
    if (isRendering || renderQueue.length === 0) {
        return;
    }

    isRendering = true;

    // Беремо перше завдання з черги
    const taskId = renderQueue.shift();

    // Оновлюємо це завдання
    refreshSingleTask(taskId)
        .finally(() => {
            // Запускаємо обробку наступного завдання або завершуємо процес
            if (renderQueue.length > 0) {
                setTimeout(processRenderQueue, 16); // ~60 fps
            } else {
                isRendering = false;
            }
        });
}

/**
 * Оновлення одного завдання
 */
async function refreshSingleTask(taskId) {
    const taskElement = taskElements.get(taskId);
    if (!taskElement) return;

    try {
        // Намагаємося отримати актуальні дані про завдання
        let task, progress;

        // Отримуємо TaskSystem з контейнера, якщо ще не отримано
        if (!taskSystem) {
            taskSystem = dependencyContainer.resolve('TaskSystem') ||
                        dependencyContainer.resolve('TaskManager');
        }

        // Спроба отримати дані через TaskSystem
        if (taskSystem) {
            if (typeof taskSystem.findTaskById === 'function') {
                task = taskSystem.findTaskById(taskId);
            }

            if (typeof taskSystem.getTaskProgress === 'function') {
                progress = taskSystem.getTaskProgress(taskId);
            }
        }

        // Якщо даних немає, спробуємо використати дані з data-атрибутів
        if (!task) {
            task = {
                id: taskId,
                type: 'social',
                action_url: taskElement.dataset.actionUrl,
                network: taskElement.dataset.network
            };
        }

        // Визначаємо статус на основі наявних даних
        let status = STATUS.IDLE;

        if (progress) {
            switch (progress.status) {
                case 'completed':
                    status = STATUS.COMPLETED;
                    break;
                case 'started':
                    status = STATUS.READY_TO_VERIFY;
                    break;
                case 'error':
                    status = STATUS.ERROR;
                    break;
                case 'in_progress':
                    status = STATUS.IN_PROGRESS;
                    break;
            }
        }

        // Оновлюємо відображення статусу
        updateTaskStatus(taskElement, status);
    } catch (error) {
        console.error(`SocialRenderer: Помилка при оновленні завдання ${taskId}:`, error);
    }
}

/**
 * Оновлення всіх завдань
 */
export function refreshAllTasks() {
    // Додаємо всі завдання в чергу рендерингу
    taskElements.forEach((_, taskId) => {
        refreshTaskDisplay(taskId);
    });
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

// Створюємо об'єкт для експорту
const SocialRenderer = {
    render,
    refreshTaskDisplay,
    refreshAllTasks,
    updateTaskStatus,
    detectNetworkType,
    validateSocialUrl,
    SOCIAL_NETWORKS,
    STATUS,
    initialize
};

// Для зворотної сумісності зі старим кодом
window.SocialRenderer = SocialRenderer;

// Автоматична ініціалізація при завантаженні модуля
setTimeout(initialize, 0);

// Експортуємо за замовчуванням
export default SocialRenderer;