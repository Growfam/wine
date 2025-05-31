/**
 * Менеджер завдань для системи WINIX
 * ОПТИМІЗОВАНА ВЕРСІЯ V3 - Без Virtual DOM, з централізованими утилітами
 */

window.TasksManager = (function() {
    'use strict';

    console.log('[TasksManager-V3] ===== ІНІЦІАЛІЗАЦІЯ ОПТИМІЗОВАНОГО МЕНЕДЖЕРА =====');

    // Використовуємо централізовані утиліти
    const { CacheManager, RequestManager, EventBus } = window;

    // Namespace для кешування
    const CACHE_NAMESPACE = CacheManager.NAMESPACES.TASKS;

    // RequestManager клієнт
    const apiClient = RequestManager.createClient('tasksManager');

    // EventBus namespace
    const eventBus = EventBus.createNamespace('tasks');

    // Мінімальний стан
    const state = {
        userId: null,
        isInitialized: false,
        currentFilter: 'all',
        renderQueue: new Set(),
        renderFrame: null,
        unsubscribeCallbacks: []
    };

    // Конфігурація
    const config = {
        taskTypes: ['social', 'limited', 'partner', 'daily'],
        updateIntervalMs: window.TasksConstants?.TIMERS?.AUTO_CHECK_INTERVAL || 5 * 60 * 1000,
        batchRenderDelay: 16 // 1 frame
    };

    /**
     * Ініціалізація менеджера
     */
    async function init(userId) {
        console.log('[TasksManager-V3] Початок ініціалізації');

        if (state.isInitialized) {
            console.log('[TasksManager-V3] Вже ініціалізовано');
            return;
        }

        state.userId = userId;

        try {
            // Завантажуємо кешовані завдання для швидкого старту
            const cachedTasks = CacheManager.get(CACHE_NAMESPACE, `all_${userId}`);
            if (cachedTasks) {
                processTasks(cachedTasks);
            }

            // Завантажуємо свіжі дані
            await loadAllTasks();

            // Налаштовуємо підписки
            setupEventSubscriptions();

            // Налаштовуємо періодичне оновлення
            setupPeriodicUpdate();

            // Ініціалізуємо модуль верифікації
            if (window.TaskVerification) {
                window.TaskVerification.init();
            }

            state.isInitialized = true;

            // Емітуємо подію готовності
            EventBus.emit('manager.tasks.ready', { userId });

            console.log('[TasksManager-V3] Менеджер ініціалізовано');

        } catch (error) {
            console.error('[TasksManager-V3] Помилка ініціалізації:', error);
            throw error;
        }
    }

    /**
     * Завантажити всі завдання
     */
    async function loadAllTasks(forceRefresh = false) {
        console.log('[TasksManager-V3] Завантаження завдань');

        const cacheKey = `all_${state.userId}`;

        // Перевіряємо кеш
        if (!forceRefresh) {
            const cached = CacheManager.get(CACHE_NAMESPACE, cacheKey);
            if (cached) {
                processTasks(cached);
                return;
            }
        }

        try {
            // API виклик через RequestManager
            const response = await apiClient.execute(
                cacheKey,
                () => window.TasksAPI.tasks.getList(state.userId, 'all'),
                { priority: 'normal', deduplicate: !forceRefresh }
            );

            if (response?.status === 'success' && response.data?.tasks) {
                // Кешуємо результат
                CacheManager.set(CACHE_NAMESPACE, cacheKey, response.data.tasks);

                // Обробляємо завдання
                processTasks(response.data.tasks);

                // Емітуємо подію завантаження
                EventBus.emit('tasks.loaded', { tasks: response.data.tasks });
            }

        } catch (error) {
            console.error('[TasksManager-V3] Помилка завантаження:', error);

            // Використовуємо кеш при помилці
            const fallback = CacheManager.get(CACHE_NAMESPACE, cacheKey);
            if (fallback) {
                processTasks(fallback);
            } else {
                window.TasksUtils.showToast('Помилка завантаження завдань', 'error');
            }
        }
    }

    /**
     * Обробити завдання
     */
    function processTasks(tasksData) {
        console.log('[TasksManager-V3] Обробка завдань');

        // Конвертуємо в правильний формат для Store
        const tasksByType = {
            social: {},
            limited: {},
            partner: {},
            daily: {}
        };

        // Обробляємо різні формати даних
        if (Array.isArray(tasksData)) {
            // Масив завдань
            tasksData.forEach(task => {
                const type = task.type || 'social';
                if (tasksByType[type]) {
                    tasksByType[type][task.id] = task;
                }
            });
        } else if (typeof tasksData === 'object') {
            // Вже згруповані по типах
            Object.entries(tasksData).forEach(([type, tasks]) => {
                if (tasksByType[type]) {
                    if (Array.isArray(tasks)) {
                        tasks.forEach(task => {
                            tasksByType[type][task.id] = task;
                        });
                    } else {
                        tasksByType[type] = tasks;
                    }
                }
            });
        }

        // Зберігаємо в Store
        Object.entries(tasksByType).forEach(([type, tasks]) => {
            window.TasksStore.actions.setTasks(type, tasks);
        });

        // Плануємо рендеринг
        scheduleRender();
    }

    /**
     * Планування рендерингу
     */
    function scheduleRender() {
        state.renderQueue.add(Date.now());

        if (!state.renderFrame) {
            state.renderFrame = requestAnimationFrame(() => {
                performRender();
                state.renderFrame = null;
            });
        }
    }

    /**
     * Виконання рендерингу
     */
    function performRender() {
        console.log('[TasksManager-V3] Рендеринг завдань');

        const currentTab = window.TasksStore?.selectors.getCurrentTab();

        switch(currentTab) {
            case 'social':
                renderSocialTasks();
                break;
            case 'limited':
                renderLimitedTasks();
                break;
            case 'partner':
                renderPartnerTasks();
                break;
        }

        state.renderQueue.clear();

        // Емітуємо подію завершення рендерингу
        EventBus.emit('tasks.rendered', { tab: currentTab });
    }

    /**
     * Рендеринг соціальних завдань
     */
    function renderSocialTasks() {
        const container = document.getElementById('social-tab');
        if (!container) return;

        const tasks = window.TasksStore.getState().tasks.social;

        if (Object.keys(tasks).length === 0) {
            container.innerHTML = '<div class="no-tasks">Немає доступних завдань</div>';
            return;
        }

        // Групуємо по платформах
        const tasksByPlatform = groupTasksByPlatform(tasks);

        // Створюємо HTML через template literals (швидше ніж DOM маніпуляції)
        const html = Object.entries(tasksByPlatform).map(([platform, platformTasks]) => `
            <div class="platform-section" data-platform="${platform}">
                <div class="platform-header">
                    <div class="platform-info">
                        <span class="platform-name">${getPlatformName(platform)}</span>
                        <span class="platform-count">${platformTasks.length} завдань</span>
                    </div>
                </div>
                <div class="platform-tasks">
                    ${platformTasks.map(task => createTaskCardHTML(task, 'social')).join('')}
                </div>
            </div>
        `).join('');

        container.innerHTML = html;

        // Оновлюємо таймери якщо є
        updateTaskTimers(container);
    }

    /**
     * Рендеринг лімітованих завдань
     */
    function renderLimitedTasks() {
        const container = document.getElementById('limited-tab');
        if (!container) return;

        const tasks = window.TasksStore.getState().tasks.limited;

        if (Object.keys(tasks).length === 0) {
            container.innerHTML = '<div class="no-tasks">Немає доступних завдань</div>';
            return;
        }

        // Сортуємо по часу закінчення
        const sortedTasks = Object.values(tasks).sort((a, b) => {
            return (a.expiresAt || Infinity) - (b.expiresAt || Infinity);
        });

        // Створюємо HTML
        const html = `
            <div class="tasks-container">
                ${sortedTasks.map(task => createTaskCardHTML(task, 'limited')).join('')}
            </div>
        `;

        container.innerHTML = html;

        // Оновлюємо таймери
        updateTaskTimers(container);
    }

    /**
     * Рендеринг партнерських завдань
     */
    function renderPartnerTasks() {
        const container = document.getElementById('partner-tab');
        if (!container) return;

        const tasks = window.TasksStore.getState().tasks.partner;

        if (Object.keys(tasks).length === 0) {
            container.innerHTML = '<div class="no-tasks">Немає доступних завдань</div>';
            return;
        }

        // Групуємо по партнерах
        const tasksByPartner = {};
        Object.values(tasks).forEach(task => {
            const partner = task.partner || 'Unknown';
            if (!tasksByPartner[partner]) {
                tasksByPartner[partner] = [];
            }
            tasksByPartner[partner].push(task);
        });

        // Створюємо HTML
        const html = Object.entries(tasksByPartner).map(([partner, partnerTasks]) => `
            <div class="partner-section" data-partner="${partner}">
                <div class="partner-header">
                    <div class="partner-info">
                        <span class="partner-name">${partner}</span>
                        <span class="partner-count">${partnerTasks.length} завдань</span>
                    </div>
                </div>
                <div class="partner-tasks">
                    ${partnerTasks.map(task => createTaskCardHTML(task, 'partner')).join('')}
                </div>
            </div>
        `).join('');

        container.innerHTML = html;
    }

    /**
     * Створення HTML картки завдання
     */
    function createTaskCardHTML(task, type) {
        const status = task.status || window.TasksConstants.TASK_STATUS.AVAILABLE;
        const buttonText = getTaskButtonText(task);
        const buttonClass = getTaskButtonClass(task);

        return `
            <div class="task-card ${type}-task ${status}" 
                 data-task-id="${task.id}"
                 data-task-type="${type}"
                 data-platform="${task.platform || ''}"
                 data-channel="${task.channelUsername || ''}"
                 data-action="${task.action || ''}"
                 data-url="${task.url || ''}">
                <div class="task-header">
                    <div class="task-info">
                        <h3 class="task-title">${task.title || 'Завдання'}</h3>
                        <p class="task-description">${task.description || ''}</p>
                    </div>
                </div>
                ${createTaskRewardsHTML(task.reward)}
                ${task.expiresAt ? createTaskTimerHTML(task.expiresAt) : ''}
                <button class="task-button ${buttonClass}" 
                        ${status === window.TasksConstants.TASK_STATUS.COMPLETED ? 'disabled' : ''}>
                    ${buttonText}
                </button>
            </div>
        `;
    }

    /**
     * Створення HTML винагород
     */
    function createTaskRewardsHTML(reward) {
        if (!reward) return '';

        const parts = [];

        if (reward.winix) {
            parts.push(`<div class="reward-item">${reward.winix} WINIX</div>`);
        }

        if (reward.tickets) {
            parts.push(`<div class="reward-item">${reward.tickets} TICKETS</div>`);
        }

        return parts.length > 0 ? `<div class="task-rewards">${parts.join('')}</div>` : '';
    }

    /**
     * Створення HTML таймера
     */
    function createTaskTimerHTML(expiresAt) {
        return `
            <div class="task-timer" data-expires="${expiresAt}">
                <span class="timer-label">Залишилось:</span>
                <span class="time-remaining">--:--:--</span>
            </div>
        `;
    }

    /**
     * Оновлення таймерів завдань
     */
    function updateTaskTimers(container) {
        const timers = container.querySelectorAll('.task-timer[data-expires]');
        if (timers.length === 0) return;

        const updateTimers = () => {
            const now = Date.now();

            timers.forEach(timer => {
                const expiresAt = parseInt(timer.getAttribute('data-expires'));
                const timeLeft = expiresAt - now;

                if (timeLeft <= 0) {
                    timer.querySelector('.time-remaining').textContent = 'Завершено';

                    // Оновлюємо статус в Store
                    const card = timer.closest('.task-card');
                    if (card) {
                        const taskId = card.getAttribute('data-task-id');
                        const taskType = card.getAttribute('data-task-type');

                        window.TasksStore.actions.updateTaskStatus(
                            taskType,
                            taskId,
                            window.TasksConstants.TASK_STATUS.EXPIRED
                        );
                    }
                } else {
                    const hours = Math.floor(timeLeft / (1000 * 60 * 60));
                    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
                    const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

                    timer.querySelector('.time-remaining').textContent =
                        `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                }
            });
        };

        // Оновлюємо одразу
        updateTimers();

        // Оновлюємо кожну секунду
        const intervalId = setInterval(updateTimers, 1000);

        // Зберігаємо для очищення
        state.unsubscribeCallbacks.push(() => clearInterval(intervalId));
    }

    /**
     * Групування завдань по платформах
     */
    function groupTasksByPlatform(tasks) {
        const grouped = {};

        Object.values(tasks).forEach(task => {
            const platform = task.platform || 'other';
            if (!grouped[platform]) {
                grouped[platform] = [];
            }
            grouped[platform].push(task);
        });

        return grouped;
    }

    /**
     * Отримати назву платформи
     */
    function getPlatformName(platform) {
        const platforms = window.TasksConstants?.SOCIAL_PLATFORMS || {};
        return platforms[platform]?.name || platform.charAt(0).toUpperCase() + platform.slice(1);
    }

    /**
     * Отримати текст кнопки
     */
    function getTaskButtonText(task) {
        const statuses = window.TasksConstants.TASK_STATUS;

        switch(task.status) {
            case statuses.COMPLETED:
                return 'Виконано ✓';
            case statuses.IN_PROGRESS:
                return 'В процесі...';
            case statuses.VERIFYING:
                return 'Перевірка...';
            case statuses.EXPIRED:
                return 'Завершено';
            case statuses.LOCKED:
                return 'Заблоковано';
            default:
                return task.buttonText || 'Виконати';
        }
    }

    /**
     * Отримати клас кнопки
     */
    function getTaskButtonClass(task) {
        const statuses = window.TasksConstants.TASK_STATUS;

        switch(task.status) {
            case statuses.COMPLETED:
                return 'button-completed';
            case statuses.IN_PROGRESS:
            case statuses.VERIFYING:
                return 'button-progress';
            case statuses.EXPIRED:
                return 'button-expired';
            case statuses.LOCKED:
                return 'button-locked';
            default:
                return 'button-available';
        }
    }

    /**
     * Налаштування підписок на події
     */
    function setupEventSubscriptions() {
        // Підписка на зміну вкладки
        const unsubTabChange = EventBus.on(EventBus.EVENTS.TAB_CHANGED, (data) => {
            if (['social', 'limited', 'partner'].includes(data.newTab)) {
                scheduleRender();
            }
        });

        // Підписка на оновлення завдань
        const unsubTaskUpdate = EventBus.on('tasks.refresh', () => {
            loadAllTasks(true);
        });

        // Підписка на завершення завдання
        const unsubTaskCompleted = EventBus.on(EventBus.EVENTS.TASK_COMPLETED, () => {
            scheduleRender();
        });

        // Делегування для кліків на завданнях
        document.addEventListener('click', handleTaskClick);

        // Оптимізація видимості
        document.addEventListener('visibilitychange', handleVisibilityChange);

        // Зберігаємо callbacks для відписки
        state.unsubscribeCallbacks.push(
            unsubTabChange,
            unsubTaskUpdate,
            unsubTaskCompleted,
            () => document.removeEventListener('click', handleTaskClick),
            () => document.removeEventListener('visibilitychange', handleVisibilityChange)
        );
    }

    /**
     * Обробка кліків на завданнях
     */
    const handleTaskClick = (e) => {
        const button = e.target.closest('.task-button');
        if (!button || button.disabled) return;

        const card = button.closest('.task-card');
        if (!card) return;

        const taskId = card.getAttribute('data-task-id');
        const taskType = card.getAttribute('data-task-type');
        const platform = card.getAttribute('data-platform');

        console.log('[TasksManager-V3] Клік на завдання:', { taskId, taskType, platform });

        // Делегуємо обробку
        handleTaskAction(taskId, taskType, platform);
    };

    /**
     * Обробка дій із завданнями
     */
    async function handleTaskAction(taskId, taskType, platform) {
        // Отримуємо завдання зі Store
        const task = window.TasksStore.getState().tasks[taskType]?.[taskId];

        if (!task) {
            console.error('[TasksManager-V3] Завдання не знайдено:', taskId);
            return;
        }

        // Перевіряємо статус
        if (task.status === 'completed') {
            window.TasksUtils.showToast('Це завдання вже виконано', 'info');
            return;
        }

        // Оновлюємо статус
        window.TasksStore.actions.updateTaskStatus(taskType, taskId, 'in_progress');

        // Відкриваємо URL якщо є
        if (task.url) {
            window.open(task.url, '_blank');
        }

        // Запускаємо верифікацію
        if (window.TaskVerification) {
            window.TaskVerification.addToQueue(taskId, taskType, platform, {
                channelUsername: task.channelUsername,
                action: task.action,
                url: task.url
            });
        }
    }

    /**
     * Обробка зміни видимості
     */
    const handleVisibilityChange = () => {
        if (!document.hidden && state.isInitialized) {
            // Оновлюємо якщо минуло багато часу
            const lastUpdate = CacheManager.get(CACHE_NAMESPACE, 'lastUpdateTime') || 0;
            if (Date.now() - lastUpdate > config.updateIntervalMs) {
                loadAllTasks();
            }
        }
    };

    /**
     * Налаштування періодичного оновлення
     */
    function setupPeriodicUpdate() {
        const intervalId = setInterval(() => {
            if (!document.hidden && isTasksTabActive()) {
                console.log('[TasksManager-V3] Періодичне оновлення');
                loadAllTasks();
            }
        }, config.updateIntervalMs);

        state.unsubscribeCallbacks.push(() => clearInterval(intervalId));
    }

    /**
     * Перевірка чи активна вкладка завдань
     */
    function isTasksTabActive() {
        const currentTab = window.TasksStore?.selectors.getCurrentTab();
        return ['social', 'limited', 'partner'].includes(currentTab);
    }

    /**
     * Оновити UI завдань
     */
    function updateTasksUI() {
        console.log('[TasksManager-V3] Зовнішній виклик updateTasksUI');
        scheduleRender();
    }

    /**
     * Отримати статистику
     */
    function getTasksStatistics() {
        const state = window.TasksStore.getState();
        const stats = {
            total: 0,
            completed: 0,
            available: 0,
            byType: {},
            byPlatform: {},
            totalRewards: { winix: 0, tickets: 0 }
        };

        const statuses = window.TasksConstants.TASK_STATUS;

        config.taskTypes.forEach(type => {
            const tasks = Object.values(state.tasks[type] || {});
            stats.byType[type] = tasks.length;
            stats.total += tasks.length;

            tasks.forEach(task => {
                if (task.status === statuses.COMPLETED) {
                    stats.completed++;
                } else if (task.status === statuses.AVAILABLE || !task.status) {
                    stats.available++;

                    if (task.reward) {
                        stats.totalRewards.winix += task.reward.winix || 0;
                        stats.totalRewards.tickets += task.reward.tickets || 0;
                    }
                }

                const platform = task.platform || 'other';
                stats.byPlatform[platform] = (stats.byPlatform[platform] || 0) + 1;
            });
        });

        return stats;
    }

    /**
     * Знищити менеджер
     */
    function destroy() {
        console.log('[TasksManager-V3] Знищення менеджера');

        // Скасовуємо pending рендеринг
        if (state.renderFrame) {
            cancelAnimationFrame(state.renderFrame);
        }

        // Відписуємось від всіх подій
        state.unsubscribeCallbacks.forEach(unsubscribe => {
            if (typeof unsubscribe === 'function') {
                unsubscribe();
            }
        });

        // Очищаємо стан
        state.isInitialized = false;
        state.renderQueue.clear();
        state.unsubscribeCallbacks = [];

        console.log('[TasksManager-V3] Менеджер знищено');
    }

    console.log('[TasksManager-V3] Менеджер готовий (Без Virtual DOM)');

    // Публічний API
    return {
        init,
        loadAllTasks,
        updateTasksUI,
        getTasksStatistics,
        destroy,

        // Для зовнішнього доступу
        getState: () => ({
            isInitialized: state.isInitialized,
            currentFilter: state.currentFilter,
            tasksCount: window.TasksStore?.getState().tasks || {}
        })
    };

})();

console.log('[TasksManager-V3] Модуль експортовано глобально');