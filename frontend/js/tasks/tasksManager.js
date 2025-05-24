/**
 * Менеджер завдань для системи WINIX
 * Управління всіма типами завдань
 */

window.TasksManager = (function() {
    'use strict';

    console.log('[TasksManager] ===== ІНІЦІАЛІЗАЦІЯ МЕНЕДЖЕРА ЗАВДАНЬ =====');

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
        updateIntervalMs: window.TasksConstants?.TIMERS?.AUTO_CHECK_INTERVAL || 5 * 60 * 1000,
        taskTypes: ['social', 'limited', 'partner'],
        platforms: {
            telegram: {
                name: 'Telegram',
                color: '#0088cc',
                verificationRequired: true,
                svgIcon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M9 18.75L14.19 13.56L18.84 18.17L20.66 5.27L3.44 11.21L7.93 12.83L9.63 17.94L12.64 14.93" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>`
            },
            youtube: {
                name: 'YouTube',
                color: '#ff0000',
                verificationRequired: false,
                svgIcon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M22.54 6.42C22.4212 5.94541 22.1793 5.51057 21.8386 5.15941C21.498 4.80824 21.0707 4.55318 20.6 4.42C18.88 4 12 4 12 4C12 4 5.11999 4 3.39999 4.46C2.92924 4.59318 2.50197 4.84824 2.16134 5.19941C1.82071 5.55057 1.57878 5.98541 1.45999 6.46C1.14521 8.20556 0.991228 9.97631 0.999992 11.75C0.988771 13.537 1.14277 15.3213 1.45999 17.08C1.59096 17.5398 1.8383 17.9581 2.17814 18.2945C2.51797 18.6308 2.93881 18.8738 3.39999 19C5.11999 19.46 12 19.46 12 19.46C12 19.46 18.88 19.46 20.6 19C21.0707 18.8668 21.498 18.6118 21.8386 18.2606C22.1793 17.9094 22.4212 17.4746 22.54 17C22.8524 15.2676 23.0063 13.5103 23 11.75C23.0112 9.96295 22.8572 8.17863 22.54 6.42Z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    <path d="M9.75 15.02L15.5 11.75L9.75 8.47998V15.02Z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>`
            },
            twitter: {
                name: 'Twitter',
                color: '#1da1f2',
                verificationRequired: false,
                svgIcon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M23 3C22.0424 3.67548 20.9821 4.19211 19.86 4.53C19.2577 3.83751 18.4573 3.34669 17.567 3.12393C16.6767 2.90116 15.7395 2.9572 14.8821 3.28445C14.0247 3.61171 13.2884 4.1944 12.773 4.95372C12.2575 5.71303 11.9877 6.61234 12 7.53V8.53C10.2426 8.57557 8.50127 8.18581 6.93101 7.39545C5.36074 6.60508 4.01032 5.43864 3 4C3 4 -1 13 8 17C5.94053 18.398 3.48716 19.099 1 19C10 24 21 19 21 7.5C20.9991 7.22145 20.9723 6.94359 20.92 6.67C21.9406 5.66349 22.6608 4.39271 23 3Z" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>`
            },
            discord: {
                name: 'Discord',
                color: '#5865f2',
                verificationRequired: false,
                svgIcon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M20.317 4.3698C18.7873 3.71277 17.147 3.24851 15.4319 3C15.4007 2.99434 15.3695 3.00849 15.3534 3.03692C15.1424 3.38841 14.9087 3.8526 14.7451 4.21885C12.9004 3.95818 11.0652 3.95818 9.25832 4.21885C9.09465 3.84309 8.85248 3.38841 8.64057 3.03692C8.62449 3.00943 8.59328 2.99528 8.56205 3C6.84791 3.24755 5.20756 3.71183 3.67693 4.3698C3.66368 4.37547 3.65233 4.38492 3.64479 4.39719C0.533392 8.83772 -0.31895 13.1747 0.0992801 17.4585C0.101114 17.4791 0.11366 17.4987 0.130398 17.5113C2.18321 19.0003 4.17171 19.9038 6.12328 20.4965C6.15451 20.5065 6.18761 20.4955 6.20748 20.4701C6.66913 19.8532 7.08064 19.2023 7.43348 18.5183C7.4543 18.4795 7.43442 18.4331 7.39186 18.4192C6.73913 18.1855 6.1176 17.8982 5.51973 17.5703C5.47244 17.5443 5.46865 17.4767 5.51216 17.4459C5.63797 17.3564 5.76382 17.2627 5.88396 17.1681C5.90569 17.1506 5.93598 17.1469 5.96153 17.1579C9.88928 18.8719 14.1415 18.8719 18.023 17.1579C18.0485 17.146 18.0788 17.1497 18.1015 17.1672C18.2216 17.2617 18.3475 17.3564 18.4742 17.4459C18.5177 17.4767 18.5149 17.5443 18.4676 17.5703C17.8697 17.9054 17.2482 18.1855 16.5945 18.4183C16.552 18.4322 16.533 18.4795 16.5538 18.5183C16.9143 19.2014 17.3258 19.8523 17.7789 20.4692C17.7978 20.4955 17.8319 20.5065 17.8631 20.4965C19.8241 19.9038 21.8126 19.0003 23.8654 17.5113C23.8834 17.4987 23.8948 17.48 23.8967 17.4594C24.3971 12.4879 23.0585 8.1871 20.3482 4.39814C20.3416 4.38492 20.3303 4.37547 20.317 4.3698ZM8.02002 14.9175C6.8375 14.9175 5.86313 13.8705 5.86313 12.5847C5.86313 11.299 6.8186 10.252 8.02002 10.252C9.23087 10.252 10.1958 11.3085 10.1769 12.5847C10.1769 13.8705 9.22141 14.9175 8.02002 14.9175ZM15.9948 14.9175C14.8123 14.9175 13.838 13.8705 13.838 12.5847C13.838 11.299 14.7934 10.252 15.9948 10.252C17.2057 10.252 18.1706 11.3085 18.1517 12.5847C18.1517 13.8705 17.2057 14.9175 15.9948 14.9175Z" fill="white"/>
                </svg>`
            }
        }
    };

    // SVG іконки для винагород
    const rewardIcons = {
        winix: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="12" cy="12" r="9" stroke="#b366ff" stroke-width="1.5"/>
            <path d="M12 7V17M9 10H15M9 14H15" stroke="#b366ff" stroke-width="1.5" stroke-linecap="round"/>
        </svg>`,
        tickets: `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
            <path d="M2 9V7C2 6.44772 2.44772 6 3 6H21C21.5523 6 22 6.44772 22 7V9C20.8954 9 20 9.89543 20 11C20 12.1046 20.8954 13 22 13V15C22 15.5523 21.5523 16 21 16H3C2.44772 16 2 15.5523 2 15V13C3.10457 13 4 12.1046 4 11C4 9.89543 3.10457 9 2 9Z" stroke="#FFD700" stroke-width="1.5"/>
            <path d="M9 6V16" stroke="#FFD700" stroke-width="1.5" stroke-dasharray="2 2"/>
        </svg>`
    };

    // SVG іконка таймера
    const timerIcon = `<svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="12" cy="13" r="8" stroke="#FFD700" stroke-width="1.5" stroke-linecap="round"/>
        <path d="M12 9V13L14.5 15.5" stroke="#FFD700" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        <path d="M9 3H15" stroke="#FFD700" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;

    /**
     * Ініціалізація менеджера
     */
    async function init(userId) {
        console.log('[TasksManager] Початок ініціалізації');
        console.log('[TasksManager] User ID:', userId);

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
            console.log('[TasksManager] Менеджер успішно ініціалізовано');

        } catch (error) {
            console.error('[TasksManager] Помилка ініціалізації:', error);
            throw error;
        }
    }

    /**
     * Завантажити всі завдання
     */
    async function loadAllTasks() {
        console.log('[TasksManager] === ЗАВАНТАЖЕННЯ ВСІХ ЗАВДАНЬ ===');

        state.isLoading = true;
        window.TasksStore.actions.setTasksLoading(true);

        try {
            // Завантажуємо завдання з API
            const response = await window.TasksAPI.tasks.getList(state.userId, 'all');
            console.log('[TasksManager] Отримано завдання:', response);

            // Обробляємо та зберігаємо завдання по типах
            if (response.tasks) {
                processTasks(response.tasks);
            }

            state.lastUpdate = Date.now();
            console.log('[TasksManager] Завдання завантажено та оброблено');

            // Відстежуємо подію
            window.TasksServices?.Analytics?.trackEvent('Tasks', 'loaded', 'all', response.tasks ? Object.keys(response.tasks).length : 0);

        } catch (error) {
            console.error('[TasksManager] Помилка завантаження завдань:', error);
            window.TasksUtils.showToast('Помилка завантаження завдань', 'error');

            // Відстежуємо помилку
            window.TasksServices?.Analytics?.trackError(error, 'loadAllTasks');

        } finally {
            state.isLoading = false;
            window.TasksStore.actions.setTasksLoading(false);
        }
    }

    /**
     * Обробити завдання
     */
    function processTasks(tasksData) {
        console.log('[TasksManager] Обробка завдань...');

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

            // Перевіряємо валідність завдання
            const validation = window.TasksServices?.Validation?.validateTask(task);
            if (validation && !validation.valid) {
                console.error(`[TasksManager] Невалідне завдання ${taskId}:`, validation.errors);
                return;
            }

            // Перевіряємо чи завдання вже виконано
            if (window.TaskVerification?.isTaskCompleted(taskId)) {
                task.status = window.TasksConstants.TASK_STATUS.COMPLETED;
            }

            // Розподіляємо по типах
            const taskType = task.type || 'social';
            if (tasksByType[taskType]) {
                tasksByType[taskType].push(task);
            }

            console.log(`[TasksManager] Завдання ${taskId}:`, {
                тип: taskType,
                платформа: task.platform,
                статус: task.status
            });
        });

        // Зберігаємо в сторі
        Object.entries(tasksByType).forEach(([type, tasks]) => {
            window.TasksStore.actions.setTasks(type, tasks);
            console.log(`[TasksManager] Збережено ${tasks.length} завдань типу ${type}`);
        });

        // Оновлюємо UI
        updateTasksUI();
    }

    /**
     * Оновити UI завдань
     */
    function updateTasksUI() {
        console.log('[TasksManager] === ОНОВЛЕННЯ UI ЗАВДАНЬ ===');

        const currentTab = window.TasksStore.selectors.getCurrentTab();
        console.log('[TasksManager] Поточна вкладка:', currentTab);

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
        console.log('[TasksManager] Оновлення соціальних завдань');

        const container = document.getElementById('social-tab');
        if (!container) return;

        const tasks = window.TasksStore.getState().tasks.social;
        console.log(`[TasksManager] Знайдено ${Object.keys(tasks).length} соціальних завдань`);

        // Очищаємо контейнер
        container.innerHTML = '';

        // Перевіряємо чи є завдання
        if (Object.keys(tasks).length === 0) {
            container.innerHTML = '<div class="no-tasks">Немає доступних завдань</div>';
            return;
        }

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
        console.log('[TasksManager] Оновлення лімітованих завдань');

        const container = document.getElementById('limited-tab');
        if (!container) return;

        const tasks = window.TasksStore.getState().tasks.limited;
        console.log(`[TasksManager] Знайдено ${Object.keys(tasks).length} лімітованих завдань`);

        container.innerHTML = '';

        if (Object.keys(tasks).length === 0) {
            container.innerHTML = '<div class="no-tasks">Немає доступних завдань</div>';
            return;
        }

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
        console.log('[TasksManager] Оновлення партнерських завдань');

        const container = document.getElementById('partner-tab');
        if (!container) return;

        const tasks = window.TasksStore.getState().tasks.partner;
        console.log(`[TasksManager] Знайдено ${Object.keys(tasks).length} партнерських завдань`);

        container.innerHTML = '';

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
        console.log(`[TasksManager] Створення секції для ${platform}`);

        const section = document.createElement('div');
        section.className = 'platform-section';
        section.setAttribute('data-platform', platform);

        const platformInfo = config.platforms[platform] || {
            name: platform,
            svgIcon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="10" stroke="white" stroke-width="1.5"/>
                <circle cx="12" cy="12" r="3" fill="white"/>
            </svg>`
        };

        section.innerHTML = `
            <div class="platform-header">
                <div class="platform-info">
                    <span class="platform-icon">${platformInfo.svgIcon}</span>
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
        console.log(`[TasksManager] Створення секції для партнера ${partner}`);

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
        console.log(`[TasksManager] Створення картки завдання:`, task.id);

        const card = document.createElement('div');
        card.className = `task-card ${type}-task ${task.status || window.TasksConstants.TASK_STATUS.AVAILABLE}`;
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
        const platformInfo = config.platforms[task.platform] || {
            svgIcon: `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                <circle cx="12" cy="12" r="10" stroke="white" stroke-width="1.5"/>
                <circle cx="12" cy="12" r="3" fill="white"/>
            </svg>`,
            color: '#b366ff'
        };

        // Формуємо вміст картки
        let cardContent = `
            <div class="task-header">
                <div class="task-icon" style="background: ${platformInfo.color}">
                    ${platformInfo.svgIcon}
                </div>
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
                        ${rewardIcons.winix}
                        <span class="reward-text">${task.reward.winix} WINIX</span>
                    </div>
                `;
            }
            if (task.reward.tickets) {
                cardContent += `
                    <div class="reward-item">
                        ${rewardIcons.tickets}
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
                    <span class="timer-icon">${timerIcon}</span>
                    <span class="timer-text">Залишилось: <span class="time-remaining"></span></span>
                </div>
            `;
        }

        // Додаємо кнопку дії
        const buttonText = getTaskButtonText(task);
        const buttonClass = getTaskButtonClass(task);

        cardContent += `
            <button class="task-button ${buttonClass}" ${task.status === window.TasksConstants.TASK_STATUS.COMPLETED ? 'disabled' : ''}>
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
        const statuses = window.TasksConstants.TASK_STATUS;

        switch(task.status) {
            case statuses.COMPLETED:
                return `Виконано <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M5 12L10 17L20 7" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                </svg>`;
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

                // Оновлюємо статус в сторі
                const taskId = card.getAttribute('data-task-id');
                const taskType = card.getAttribute('data-task-type');
                window.TasksStore.actions.updateTaskStatus(
                    taskType,
                    taskId,
                    window.TasksConstants.TASK_STATUS.EXPIRED
                );

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
        console.log('[TasksManager] Налаштування автооновлення');

        // Очищаємо попередній інтервал
        if (state.updateInterval) {
            clearInterval(state.updateInterval);
        }

        state.updateInterval = setInterval(async () => {
            console.log('[TasksManager] Автоматичне оновлення завдань');
            await loadAllTasks();
        }, config.updateIntervalMs);

        console.log(`[TasksManager] Автооновлення налаштовано (кожні ${config.updateIntervalMs/1000/60} хв)`);
    }

    /**
     * Налаштувати обробники подій
     */
    function setupEventHandlers() {
        console.log('[TasksManager] Налаштування обробників подій');

        // Обробник перемикання вкладок
        document.addEventListener('tab-switched', (e) => {
            console.log('[TasksManager] Перемикання вкладки:', e.detail);
            updateTasksUI();
        });

        // Обробник виконання завдання
        document.addEventListener('task-completed', (e) => {
            console.log('[TasksManager] Завдання виконано:', e.detail);
            const { taskId, reward } = e.detail;

            // Оновлюємо статус в UI
            const card = document.querySelector(`[data-task-id="${taskId}"]`);
            if (card) {
                card.classList.remove('available', 'in_progress', 'verifying');
                card.classList.add('completed');

                const button = card.querySelector('.task-button');
                if (button) {
                    button.innerHTML = `Виконано <svg width="16" height="16" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                        <path d="M5 12L10 17L20 7" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
                    </svg>`;
                    button.disabled = true;
                }
            }

            // Відстежуємо подію
            window.TasksServices?.Analytics?.trackEvent('Tasks', 'completed', taskId, reward.winix);
        });

        // Підписка на зміни в Store
        window.TasksStore.subscribe((state, prevState, action) => {
            if (action.type === 'SET_CURRENT_TAB') {
                console.log('[TasksManager] Зміна вкладки через Store');
                updateTasksUI();
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

        const statuses = window.TasksConstants.TASK_STATUS;

        // Підраховуємо статистику
        config.taskTypes.forEach(type => {
            const tasks = Object.values(state.tasks[type] || {});
            stats.byType[type] = tasks.length;
            stats.total += tasks.length;

            tasks.forEach(task => {
                // Статус
                if (task.status === statuses.COMPLETED) {
                    stats.completed++;
                } else if (task.status === statuses.AVAILABLE) {
                    stats.available++;
                }

                // Платформа
                const platform = task.platform || 'other';
                stats.byPlatform[platform] = (stats.byPlatform[platform] || 0) + 1;

                // Винагороди (тільки для доступних)
                if (task.status === statuses.AVAILABLE && task.reward) {
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
        console.log('[TasksManager] Фільтрація завдань:', filter);

        state.currentFilter = filter;
        updateTasksUI();
    }

    /**
     * Оновити одне завдання
     */
    async function refreshTask(taskId) {
        console.log('[TasksManager] Оновлення завдання:', taskId);

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
            console.error('[TasksManager] Помилка оновлення завдання:', error);
        }
    }

    /**
     * Знищити менеджер
     */
    function destroy() {
        console.log('[TasksManager] === ЗНИЩЕННЯ МЕНЕДЖЕРА ===');

        // Очищаємо інтервал
        if (state.updateInterval) {
            clearInterval(state.updateInterval);
        }

        // Зберігаємо стан
        const stats = getTasksStatistics();
        console.log('[TasksManager] Фінальна статистика:', stats);

        console.log('[TasksManager] Менеджер знищено');
    }

    console.log('[TasksManager] Менеджер завдань готовий');

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

console.log('[TasksManager] Модуль експортовано глобально');