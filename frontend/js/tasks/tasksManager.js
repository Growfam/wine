/**
 * Менеджер завдань для системи WINIX
 * Управління всіма типами завдань
 */

window.TasksManager = (function() {
    'use strict';

    console.log('📋 [TasksManager] ===== ІНІЦІАЛІЗАЦІЯ МЕНЕДЖЕРА ЗАВДАНЬ =====');

    // Стан модуля
    const state = {
        userId: null,
        isInitialized: false,
        isLoading: false,
        currentFilter: 'all',
        updateInterval: null,
        lastUpdate: null
    };

    // Конфігурація
    const config = {
        updateIntervalMs: 5 * 60 * 1000, // 5 хвилин
        taskTypes: ['social', 'limited', 'partner'],
        platforms: {
            telegram: { icon: '📱', name: 'Telegram', color: '#0088cc' },
            youtube: { icon: '📺', name: 'YouTube', color: '#ff0000' },
            twitter: { icon: '🐦', name: 'Twitter', color: '#1da1f2' },
            discord: { icon: '💬', name: 'Discord', color: '#5865f2' }
        }
    };

    /**
     * Ініціалізація менеджера
     */
    async function init(userId) {
        console.log('🚀 [TasksManager] Початок ініціалізації');
        console.log('👤 [TasksManager] User ID:', userId);

        state.userId = userId;

        try {
            // Завантажуємо завдання
            await loadAllTasks();

            // Налаштовуємо автооновлення
            setupAutoUpdate();

            // Налаштовуємо обробники подій
            setupEventHandlers();

            // Ініціалізуємо модуль верифікації
            if (window.TaskVerification) {
                window.TaskVerification.init();
            }

            state.isInitialized = true;
            console.log('✅ [TasksManager] Менеджер успішно ініціалізовано');

        } catch (error) {
            console.error('❌ [TasksManager] Помилка ініціалізації:', error);
            throw error;
        }
    }

    /**
     * Завантажити всі завдання
     */
    async function loadAllTasks() {
        console.log('📂 [TasksManager] === ЗАВАНТАЖЕННЯ ВСІХ ЗАВДАНЬ ===');

        state.isLoading = true;
        window.TasksStore.actions.setTasksLoading(true);

        try {
            // Завантажуємо завдання з API
            const response = await window.TasksAPI.tasks.getList(state.userId, 'all');
            console.log('✅ [TasksManager] Отримано завдання:', response);

            // Обробляємо та зберігаємо завдання по типах
            if (response.tasks) {
                processTasks(response.tasks);
            }

            state.lastUpdate = Date.now();
            console.log('✅ [TasksManager] Завдання завантажено та оброблено');

        } catch (error) {
            console.error('❌ [TasksManager] Помилка завантаження завдань:', error);
            window.TasksUtils.showToast('Помилка завантаження завдань', 'error');

        } finally {
            state.isLoading = false;
            window.TasksStore.actions.setTasksLoading(false);
        }
    }

    /**
     * Обробити завдання
     */
    function processTasks(tasksData) {
        console.log('🔄 [TasksManager] Обробка завдань...');

        // Розподіляємо завдання по типах
        const tasksByType = {
            social: [],
            limited: [],
            partner: []
        };

        // Обробляємо кожне завдання
        Object.entries(tasksData).forEach(([taskId, task]) => {
            // Додаємо ID до об'єкта завдання
            task.id = taskId;

            // Перевіряємо чи завдання вже виконано
            if (window.TaskVerification?.isTaskCompleted(taskId)) {
                task.status = 'completed';
            }

            // Розподіляємо по типах
            const taskType = task.type || 'social';
            if (tasksByType[taskType]) {
                tasksByType[taskType].push(task);
            }

            console.log(`📋 [TasksManager] Завдання ${taskId}:`, {
                тип: taskType,
                платформа: task.platform,
                статус: task.status
            });
        });

        // Зберігаємо в сторі
        Object.entries(tasksByType).forEach(([type, tasks]) => {
            window.TasksStore.actions.setTasks(type, tasks);
            console.log(`✅ [TasksManager] Збережено ${tasks.length} завдань типу ${type}`);
        });

        // Оновлюємо UI
        updateTasksUI();
    }

    /**
     * Оновити UI завдань
     */
    function updateTasksUI() {
        console.log('🔄 [TasksManager] === ОНОВЛЕННЯ UI ЗАВДАНЬ ===');

        const currentTab = window.TasksStore.selectors.getCurrentTab();
        console.log('📑 [TasksManager] Поточна вкладка:', currentTab);

        // Оновлюємо відповідну вкладку
        switch(currentTab) {
            case 'social':
                updateSocialTasks();
                break;
            case 'limited':
                updateLimitedTasks();
                break;
            case 'partner':
                updatePartnerTasks();
                break;
        }
    }

    /**
     * Оновити соціальні завдання
     */
    function updateSocialTasks() {
        console.log('📱 [TasksManager] Оновлення соціальних завдань');

        const container = document.getElementById('social-tab');
        if (!container) return;

        const tasks = window.TasksStore.getState().tasks.social;
        console.log(`📊 [TasksManager] Знайдено ${Object.keys(tasks).length} соціальних завдань`);

        // Очищаємо контейнер
        container.innerHTML = '';

        // Групуємо завдання по платформах
        const tasksByPlatform = groupTasksByPlatform(tasks);

        // Створюємо секції для кожної платформи
        Object.entries(tasksByPlatform).forEach(([platform, platformTasks]) => {
            const section = createPlatformSection(platform, platformTasks);
            container.appendChild(section);
        });
    }

    /**
     * Оновити лімітовані завдання
     */
    function updateLimitedTasks() {
        console.log('⏰ [TasksManager] Оновлення лімітованих завдань');

        const container = document.getElementById('limited-tab');
        if (!container) return;

        const tasks = window.TasksStore.getState().tasks.limited;
        console.log(`📊 [TasksManager] Знайдено ${Object.keys(tasks).length} лімітованих завдань`);

        container.innerHTML = '';

        // Сортуємо по часу закінчення
        const sortedTasks = Object.values(tasks).sort((a, b) => {
            return (a.expiresAt || Infinity) - (b.expiresAt || Infinity);
        });

        // Створюємо картки завдань
        sortedTasks.forEach(task => {
            const card = createTaskCard(task, 'limited');
            container.appendChild(card);
        });
    }

    /**
     * Оновити партнерські завдання
     */
    function updatePartnerTasks() {
        console.log('🤝 [TasksManager] Оновлення партнерських завдань');

        const container = document.getElementById('partner-tab');
        if (!container) return;

        const tasks = window.TasksStore.getState().tasks.partner;
        console.log(`📊 [TasksManager] Знайдено ${Object.keys(tasks).length} партнерських завдань`);

        container.innerHTML = '';

        // Групуємо по партнерах
        const tasksByPartner = {};
        Object.values(tasks).forEach(task => {
            const partner = task.partner || 'Unknown';
            if (!tasksByPartner[partner]) {
                tasksByPartner[partner] = [];
            }
            tasksByPartner[partner].push(task);
        });

        // Створюємо секції для кожного партнера
        Object.entries(tasksByPartner).forEach(([partner, partnerTasks]) => {
            const section = createPartnerSection(partner, partnerTasks);
            container.appendChild(section);
        });
    }

    /**
     * Групувати завдання по платформах
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
     * Створити секцію платформи
     */
    function createPlatformSection(platform, tasks) {
        console.log(`🏗️ [TasksManager] Створення секції для ${platform}`);

        const section = document.createElement('div');
        section.className = 'platform-section';
        section.setAttribute('data-platform', platform);

        const platformInfo = config.platforms[platform] || { icon: '🌐', name: platform };

        section.innerHTML = `
            <div class="platform-header">
                <div class="platform-info">
                    <span class="platform-icon">${platformInfo.icon}</span>
                    <span class="platform-name">${platformInfo.name}</span>
                    <span class="platform-count">${tasks.length} завдань</span>
                </div>
            </div>
            <div class="platform-tasks"></div>
        `;

        const tasksContainer = section.querySelector('.platform-tasks');

        // Додаємо картки завдань
        tasks.forEach(task => {
            const card = createTaskCard(task, 'social');
            tasksContainer.appendChild(card);
        });

        return section;
    }

    /**
     * Створити секцію партнера
     */
    function createPartnerSection(partner, tasks) {
        console.log(`🏗️ [TasksManager] Створення секції для партнера ${partner}`);

        const section = document.createElement('div');
        section.className = 'partner-section';
        section.setAttribute('data-partner', partner);

        section.innerHTML = `
            <div class="partner-header">
                <div class="partner-info">
                    <span class="partner-name">${partner}</span>
                    <span class="partner-count">${tasks.length} завдань</span>
                </div>
            </div>
            <div class="partner-tasks"></div>
        `;

        const tasksContainer = section.querySelector('.partner-tasks');

        // Додаємо картки завдань
        tasks.forEach(task => {
            const card = createTaskCard(task, 'partner');
            tasksContainer.appendChild(card);
        });

        return section;
    }

    /**
     * Створити картку завдання
     */
    function createTaskCard(task, type) {
        console.log(`🎨 [TasksManager] Створення картки завдання:`, task.id);

        const card = document.createElement('div');
        card.className = `task-card ${type}-task ${task.status || 'available'}`;
        card.setAttribute('data-task-id', task.id);
        card.setAttribute('data-task-type', type);
        card.setAttribute('data-platform', task.platform || '');

        // Додаткові атрибути для верифікації
        if (task.channelUsername) {
            card.setAttribute('data-channel', task.channelUsername);
        }
        if (task.action) {
            card.setAttribute('data-action', task.action);
        }
        if (task.url) {
            card.setAttribute('data-url', task.url);
        }

        // Визначаємо іконку платформи
        const platformInfo = config.platforms[task.platform] || { icon: '🌐' };

        // Формуємо вміст картки
        let cardContent = `
            <div class="task-header">
                <div class="task-icon">${platformInfo.icon}</div>
                <div class="task-info">
                    <h3 class="task-title">${task.title || 'Завдання'}</h3>
                    <p class="task-description">${task.description || ''}</p>
                </div>
            </div>
            <div class="task-rewards">
        `;

        // Додаємо винагороди
        if (task.reward) {
            if (task.reward.winix) {
                cardContent += `
                    <div class="reward-item">
                        <span class="reward-icon">💎</span>
                        <span class="reward-text">${task.reward.winix} WINIX</span>
                    </div>
                `;
            }
            if (task.reward.tickets) {
                cardContent += `
                    <div class="reward-item">
                        <span class="reward-icon">🎟️</span>
                        <span class="reward-text">${task.reward.tickets} TICKETS</span>
                    </div>
                `;
            }
        }

        cardContent += '</div>';

        // Додаємо таймер для лімітованих завдань
        if (type === 'limited' && task.expiresAt) {
            cardContent += `
                <div class="task-timer" data-expires="${task.expiresAt}">
                    <span class="timer-icon">⏰</span>
                    <span class="timer-text">Залишилось: <span class="time-remaining"></span></span>
                </div>
            `;
        }

        // Додаємо кнопку дії
        const buttonText = getTaskButtonText(task);
        const buttonClass = getTaskButtonClass(task);

        cardContent += `
            <button class="task-button ${buttonClass}" ${task.status === 'completed' ? 'disabled' : ''}>
                ${buttonText}
            </button>
        `;

        card.innerHTML = cardContent;

        // Запускаємо таймер якщо потрібно
        if (type === 'limited' && task.expiresAt) {
            startTaskTimer(card, task.expiresAt);
        }

        return card;
    }

    /**
     * Отримати текст кнопки
     */
    function getTaskButtonText(task) {
        switch(task.status) {
            case 'completed':
                return 'Виконано ✓';
            case 'in_progress':
                return 'В процесі...';
            case 'expired':
                return 'Завершено';
            default:
                return task.buttonText || 'Виконати';
        }
    }

    /**
     * Отримати клас кнопки
     */
    function getTaskButtonClass(task) {
        switch(task.status) {
            case 'completed':
                return 'button-completed';
            case 'in_progress':
                return 'button-progress';
            case 'expired':
                return 'button-expired';
            default:
                return 'button-available';
        }
    }

    /**
     * Запустити таймер завдання
     */
    function startTaskTimer(card, expiresAt) {
        const timerElement = card.querySelector('.time-remaining');
        if (!timerElement) return;

        const updateTimer = () => {
            const now = Date.now();
            const timeLeft = expiresAt - now;

            if (timeLeft <= 0) {
                timerElement.textContent = 'Завершено';
                card.classList.add('expired');
                clearInterval(timerId);
                return;
            }

            const hours = Math.floor(timeLeft / (1000 * 60 * 60));
            const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
            const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

            timerElement.textContent = `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
        };

        updateTimer();
        const timerId = setInterval(updateTimer, 1000);
    }

    /**
     * Налаштувати автооновлення
     */
    function setupAutoUpdate() {
        console.log('⏰ [TasksManager] Налаштування автооновлення');

        // Очищаємо попередній інтервал
        if (state.updateInterval) {
            clearInterval(state.updateInterval);
        }

        state.updateInterval = setInterval(async () => {
            console.log('🔄 [TasksManager] Автоматичне оновлення завдань');
            await loadAllTasks();
        }, config.updateIntervalMs);

        console.log(`✅ [TasksManager] Автооновлення налаштовано (кожні ${config.updateIntervalMs/1000/60} хв)`);
    }

    /**
     * Налаштувати обробники подій
     */
    function setupEventHandlers() {
        console.log('🎯 [TasksManager] Налаштування обробників подій');

        // Обробник перемикання вкладок
        document.addEventListener('tab-switched', (e) => {
            console.log('📑 [TasksManager] Перемикання вкладки:', e.detail);
            updateTasksUI();
        });

        // Обробник виконання завдання
        document.addEventListener('task-completed', (e) => {
            console.log('✅ [TasksManager] Завдання виконано:', e.detail);
            const { taskId, reward } = e.detail;

            // Оновлюємо статус в UI
            const card = document.querySelector(`[data-task-id="${taskId}"]`);
            if (card) {
                card.classList.remove('available', 'in_progress');
                card.classList.add('completed');

                const button = card.querySelector('.task-button');
                if (button) {
                    button.textContent = 'Виконано ✓';
                    button.disabled = true;
                }
            }
        });

        // Обробник оновлення балансу
        const unsubscribe = window.TasksStore.subscribe((state, prevState, action) => {
            if (action.type === 'UPDATE_BALANCE') {
                console.log('💰 [TasksManager] Баланс оновлено');
                // Можна додати додаткову логіку при оновленні балансу
            }
        });
    }

    /**
     * Отримати статистику завдань
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

        // Підраховуємо статистику
        config.taskTypes.forEach(type => {
            const tasks = Object.values(state.tasks[type] || {});
            stats.byType[type] = tasks.length;
            stats.total += tasks.length;

            tasks.forEach(task => {
                // Статус
                if (task.status === 'completed') {
                    stats.completed++;
                } else if (task.status !== 'expired') {
                    stats.available++;
                }

                // Платформа
                const platform = task.platform || 'other';
                stats.byPlatform[platform] = (stats.byPlatform[platform] || 0) + 1;

                // Винагороди (тільки для доступних)
                if (task.status !== 'completed' && task.status !== 'expired' && task.reward) {
                    stats.totalRewards.winix += task.reward.winix || 0;
                    stats.totalRewards.tickets += task.reward.tickets || 0;
                }
            });
        });

        return stats;
    }

    /**
     * Фільтрувати завдання
     */
    function filterTasks(filter) {
        console.log('🔍 [TasksManager] Фільтрація завдань:', filter);

        state.currentFilter = filter;
        updateTasksUI();
    }

    /**
     * Оновити одне завдання
     */
    async function refreshTask(taskId) {
        console.log('🔄 [TasksManager] Оновлення завдання:', taskId);

        try {
            const response = await window.TasksAPI.tasks.getList(state.userId, 'single', { taskId });

            if (response.task) {
                // Знаходимо тип завдання
                const taskType = response.task.type || 'social';

                // Оновлюємо в сторі
                window.TasksStore.actions.updateTaskStatus(
                    taskType,
                    taskId,
                    response.task.status
                );

                // Оновлюємо UI
                updateTasksUI();
            }
        } catch (error) {
            console.error('❌ [TasksManager] Помилка оновлення завдання:', error);
        }
    }

    /**
     * Знищити менеджер
     */
    function destroy() {
        console.log('🗑️ [TasksManager] === ЗНИЩЕННЯ МЕНЕДЖЕРА ===');

        // Очищаємо інтервал
        if (state.updateInterval) {
            clearInterval(state.updateInterval);
        }

        // Зберігаємо стан
        const stats = getTasksStatistics();
        console.log('📊 [TasksManager] Фінальна статистика:', stats);

        console.log('✅ [TasksManager] Менеджер знищено');
    }

    console.log('✅ [TasksManager] Менеджер завдань готовий');

    // Публічний API
    return {
        init,
        loadAllTasks,
        updateTasksUI,
        filterTasks,
        refreshTask,
        getTasksStatistics,
        destroy
    };

})();

console.log('✅ [TasksManager] Модуль експортовано глобально');