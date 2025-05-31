/**
 * Менеджер завдань для системи WINIX
 * ОПТИМІЗОВАНА ВЕРСІЯ V2 - з віртуальним DOM та батчингом оновлень
 */

window.TasksManager = (function() {
    'use strict';

    console.log('[TasksManager-V2] ===== ІНІЦІАЛІЗАЦІЯ ОПТИМІЗОВАНОГО МЕНЕДЖЕРА =====');

    // Віртуальний DOM для ефективного рендерингу
    const VirtualDOM = {
        currentTree: null,

        createElement(type, props, ...children) {
            return {
                type,
                props: props || {},
                children: children.flat().filter(Boolean)
            };
        },

        diff(oldNode, newNode) {
            if (!oldNode) return { type: 'CREATE', newNode };
            if (!newNode) return { type: 'REMOVE' };
            if (oldNode.type !== newNode.type) return { type: 'REPLACE', newNode };

            if (typeof oldNode === 'string' || typeof newNode === 'string') {
                if (oldNode !== newNode) return { type: 'TEXT', newNode };
                return null;
            }

            const propsPatches = this.diffProps(oldNode.props, newNode.props);
            const childrenPatches = this.diffChildren(oldNode.children, newNode.children);

            if (propsPatches || childrenPatches.length > 0) {
                return { type: 'UPDATE', propsPatches, childrenPatches };
            }

            return null;
        },

        diffProps(oldProps, newProps) {
            const patches = {};
            let hasChanges = false;

            // Check for changed/new props
            for (const key in newProps) {
                if (oldProps[key] !== newProps[key]) {
                    patches[key] = newProps[key];
                    hasChanges = true;
                }
            }

            // Check for removed props
            for (const key in oldProps) {
                if (!(key in newProps)) {
                    patches[key] = undefined;
                    hasChanges = true;
                }
            }

            return hasChanges ? patches : null;
        },

        diffChildren(oldChildren, newChildren) {
            const patches = [];
            const maxLength = Math.max(oldChildren.length, newChildren.length);

            for (let i = 0; i < maxLength; i++) {
                const patch = this.diff(oldChildren[i], newChildren[i]);
                if (patch) patches.push({ index: i, patch });
            }

            return patches;
        },

        patch(domNode, patches) {
            if (!patches) return domNode;

            switch (patches.type) {
                case 'CREATE':
                    return this.createDOM(patches.newNode);

                case 'REMOVE':
                    domNode.remove();
                    return null;

                case 'REPLACE':
                    const newDomNode = this.createDOM(patches.newNode);
                    domNode.replaceWith(newDomNode);
                    return newDomNode;

                case 'TEXT':
                    domNode.textContent = patches.newNode;
                    return domNode;

                case 'UPDATE':
                    if (patches.propsPatches) {
                        this.patchProps(domNode, patches.propsPatches);
                    }
                    if (patches.childrenPatches) {
                        this.patchChildren(domNode, patches.childrenPatches);
                    }
                    return domNode;
            }
        },

        patchProps(domNode, propsPatches) {
            for (const key in propsPatches) {
                const value = propsPatches[key];

                if (key === 'className') {
                    domNode.className = value || '';
                } else if (key.startsWith('data-')) {
                    if (value === undefined) {
                        delete domNode.dataset[key.slice(5)];
                    } else {
                        domNode.dataset[key.slice(5)] = value;
                    }
                } else if (key === 'style' && typeof value === 'object') {
                    Object.assign(domNode.style, value);
                } else if (value === undefined) {
                    domNode.removeAttribute(key);
                } else {
                    domNode.setAttribute(key, value);
                }
            }
        },

        patchChildren(domNode, childrenPatches) {
            childrenPatches.forEach(({ index, patch }) => {
                const childNode = domNode.childNodes[index];
                this.patch(childNode, patch);
            });
        },

        createDOM(vNode) {
            if (typeof vNode === 'string') {
                return document.createTextNode(vNode);
            }

            const domNode = document.createElement(vNode.type);

            // Set props
            for (const key in vNode.props) {
                const value = vNode.props[key];
                if (key === 'className') {
                    domNode.className = value;
                } else if (key.startsWith('data-')) {
                    domNode.dataset[key.slice(5)] = value;
                } else if (key === 'style' && typeof value === 'object') {
                    Object.assign(domNode.style, value);
                } else {
                    domNode.setAttribute(key, value);
                }
            }

            // Append children
            vNode.children.forEach(child => {
                domNode.appendChild(this.createDOM(child));
            });

            return domNode;
        }
    };

    // Кеш менеджер для завдань
    const TasksCache = {
        cache: new Map(),
        ttl: 2 * 60 * 1000, // 2 хвилини

        set(key, data) {
            this.cache.set(key, {
                data,
                timestamp: Date.now()
            });
        },

        get(key) {
            const cached = this.cache.get(key);
            if (!cached) return null;

            if (Date.now() - cached.timestamp > this.ttl) {
                this.cache.delete(key);
                return null;
            }

            return cached.data;
        },

        invalidate(key) {
            this.cache.delete(key);
        },

        clear() {
            this.cache.clear();
        }
    };

    // Стан модуля
    const state = {
        userId: null,
        isInitialized: false,
        isLoading: false,
        currentFilter: 'all',
        updateInterval: null,
        lastUpdate: null,
        renderQueue: [],
        isRendering: false,
        domCache: new Map(),
        vdomTrees: new Map(),
        globalTaskTimer: null,
        taskTimers: new Map()
    };

    // Конфігурація
    const config = {
        updateIntervalMs: window.TasksConstants?.TIMERS?.AUTO_CHECK_INTERVAL || 5 * 60 * 1000,
        taskTypes: ['social', 'limited', 'partner', 'daily'],
        batchRenderDelay: 16, // 1 frame
        platforms: {
            telegram: {
                name: 'Telegram',
                color: '#0088cc',
                verificationRequired: true
            },
            youtube: {
                name: 'YouTube',
                color: '#ff0000',
                verificationRequired: false
            },
            twitter: {
                name: 'Twitter',
                color: '#1da1f2',
                verificationRequired: false
            },
            discord: {
                name: 'Discord',
                color: '#5865f2',
                verificationRequired: false
            }
        }
    };

    /**
     * Ініціалізація менеджера - ОПТИМІЗОВАНА
     */
    async function init(userId) {
        console.log('[TasksManager-V2] Початок ініціалізації');

        state.userId = userId;

        try {
            // Завантажуємо з кешу одразу якщо є
            const cachedTasks = TasksCache.get(`all_tasks_${userId}`);
            if (cachedTasks) {
                console.log('[TasksManager-V2] Використовуємо кешовані завдання');
                processTasks(cachedTasks);
            }

            // Завантажуємо свіжі дані асинхронно
            loadAllTasks();

            // Налаштовуємо глобальний таймер для всіх завдань
            setupGlobalTaskTimer();

            // Налаштовуємо автооновлення
            setupAutoUpdate();

            // Налаштовуємо обробники подій
            setupEventHandlers();

            // Ініціалізуємо модуль верифікації
            if (window.TaskVerification) {
                window.TaskVerification.init();
            }

            state.isInitialized = true;
            console.log('[TasksManager-V2] Менеджер успішно ініціалізовано');

        } catch (error) {
            console.error('[TasksManager-V2] Помилка ініціалізації:', error);
            throw error;
        }
    }

    /**
     * Завантажити всі завдання - ОПТИМІЗОВАНА
     */
    async function loadAllTasks() {
        console.log('[TasksManager-V2] === ЗАВАНТАЖЕННЯ ЗАВДАНЬ ===');

        if (!state.userId) {
            console.error('[TasksManager-V2] User ID відсутній');
            return;
        }

        // Використовуємо RequestQueue якщо доступний
        const requestKey = `tasks_list_${state.userId}`;

        try {
            const response = await (window.RequestQueue?.enqueue || (fn => fn()))(
                requestKey,
                () => window.TasksAPI.tasks.getList(state.userId, 'all')
            );

            if (response?.status === 'success' && response.data?.tasks) {
                // Кешуємо результат
                TasksCache.set(`all_tasks_${state.userId}`, response.data.tasks);

                // Обробляємо завдання
                processTasks(response.data.tasks);

                state.lastUpdate = Date.now();
            }

        } catch (error) {
            console.error('[TasksManager-V2] Помилка завантаження:', error);

            // Використовуємо кешовані дані якщо є
            const cached = TasksCache.get(`all_tasks_${state.userId}`);
            if (cached) {
                processTasks(cached);
            } else {
                window.TasksUtils.showToast('Помилка завантаження завдань', 'error');
            }
        }
    }

    /**
     * Обробити завдання - ОПТИМІЗОВАНА
     */
    function processTasks(tasksData) {
        console.log('[TasksManager-V2] Обробка завдань');

        // Конвертуємо в правильний формат для Store
        const tasksByType = {
            social: {},
            limited: {},
            partner: {},
            daily: {}
        };

        // Групуємо завдання по типах
        if (tasksData.social || tasksData.limited || tasksData.partner || tasksData.daily) {
            // Вже згруповані
            Object.entries(tasksData).forEach(([type, tasksList]) => {
                const tasksObject = {};

                if (Array.isArray(tasksList)) {
                    tasksList.forEach(task => {
                        task.type = task.type || type;
                        tasksObject[task.id] = task;
                    });
                } else if (typeof tasksList === 'object') {
                    Object.entries(tasksList).forEach(([id, task]) => {
                        task.type = type;
                        tasksObject[id] = task;
                    });
                }

                tasksByType[type] = tasksObject;
            });
        } else if (Array.isArray(tasksData)) {
            // Масив завдань
            tasksData.forEach(task => {
                const taskType = task.type || 'social';
                if (tasksByType[taskType]) {
                    tasksByType[taskType][task.id] = task;
                }
            });
        }

        // Зберігаємо в Store
        Object.entries(tasksByType).forEach(([type, tasks]) => {
            window.TasksStore.actions.setTasks(type, tasks);
        });

        // Плануємо оновлення UI через батчинг
        scheduleRender();
    }

    /**
     * Планування рендерингу через батчинг
     */
    function scheduleRender() {
        if (state.renderQueue.length === 0) {
            state.renderQueue.push(Date.now());
        }

        if (!state.isRendering) {
            state.isRendering = true;

            requestAnimationFrame(() => {
                performBatchRender();
            });
        }
    }

    /**
     * Виконання батч рендерингу
     */
    function performBatchRender() {
        console.log('[TasksManager-V2] Батч рендеринг');

        const currentTab = window.TasksStore.selectors.getCurrentTab();

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

        state.renderQueue = [];
        state.isRendering = false;
    }

    /**
     * Рендеринг соціальних завдань з віртуальним DOM
     */
    function renderSocialTasks() {
        console.log('[TasksManager-V2] Рендеринг соціальних завдань');

        const container = document.getElementById('social-tab');
        if (!container) return;

        const tasks = window.TasksStore.getState().tasks.social;

        // Створюємо віртуальне дерево
        const vdom = createSocialTasksVDOM(tasks);

        // Отримуємо попереднє дерево
        const oldVdom = state.vdomTrees.get('social');

        if (oldVdom) {
            // Diff і patch
            const patches = VirtualDOM.diff(oldVdom, vdom);
            if (patches) {
                VirtualDOM.patch(container, patches);
            }
        } else {
            // Перший рендер
            container.innerHTML = '';
            const dom = VirtualDOM.createDOM(vdom);
            container.appendChild(dom);
        }

        // Зберігаємо нове дерево
        state.vdomTrees.set('social', vdom);
    }

    /**
     * Створення віртуального DOM для соціальних завдань
     */
    function createSocialTasksVDOM(tasks) {
        const h = VirtualDOM.createElement;

        if (Object.keys(tasks).length === 0) {
            return h('div', { className: 'no-tasks' }, 'Немає доступних завдань');
        }

        // Групуємо по платформах
        const tasksByPlatform = groupTasksByPlatform(tasks);

        return h('div', { className: 'tasks-container' },
            ...Object.entries(tasksByPlatform).map(([platform, platformTasks]) =>
                createPlatformSectionVDOM(platform, platformTasks)
            )
        );
    }

    /**
     * Створення секції платформи для віртуального DOM
     */
    function createPlatformSectionVDOM(platform, tasks) {
        const h = VirtualDOM.createElement;
        const platformInfo = config.platforms[platform] || { name: platform };

        return h('div', {
            className: 'platform-section',
            'data-platform': platform
        },
            h('div', { className: 'platform-header' },
                h('div', { className: 'platform-info' },
                    h('span', { className: 'platform-name' }, platformInfo.name),
                    h('span', { className: 'platform-count' }, `${tasks.length} завдань`)
                )
            ),
            h('div', { className: 'platform-tasks' },
                ...tasks.map(task => createTaskCardVDOM(task, 'social'))
            )
        );
    }

    /**
     * Створення картки завдання для віртуального DOM
     */
    function createTaskCardVDOM(task, type) {
        const h = VirtualDOM.createElement;

        const status = task.status || window.TasksConstants.TASK_STATUS.AVAILABLE;
        const buttonText = getTaskButtonText(task);
        const buttonClass = getTaskButtonClass(task);

        return h('div', {
            className: `task-card ${type}-task ${status}`,
            'data-task-id': task.id,
            'data-task-type': type,
            'data-platform': task.platform || '',
            'data-channel': task.channelUsername || '',
            'data-action': task.action || '',
            'data-url': task.url || ''
        },
            h('div', { className: 'task-header' },
                h('div', { className: 'task-info' },
                    h('h3', { className: 'task-title' }, task.title || 'Завдання'),
                    h('p', { className: 'task-description' }, task.description || '')
                )
            ),
            createTaskRewardsVDOM(task.reward),
            h('button', {
                className: `task-button ${buttonClass}`,
                disabled: status === window.TasksConstants.TASK_STATUS.COMPLETED ? 'true' : undefined
            }, buttonText)
        );
    }

    /**
     * Створення блоку винагород для віртуального DOM
     */
    function createTaskRewardsVDOM(reward) {
        const h = VirtualDOM.createElement;

        if (!reward) return null;

        const rewards = [];

        if (reward.winix) {
            rewards.push(
                h('div', { className: 'reward-item' },
                    h('span', { className: 'reward-text' }, `${reward.winix} WINIX`)
                )
            );
        }

        if (reward.tickets) {
            rewards.push(
                h('div', { className: 'reward-item' },
                    h('span', { className: 'reward-text' }, `${reward.tickets} TICKETS`)
                )
            );
        }

        return h('div', { className: 'task-rewards' }, ...rewards);
    }

    /**
     * Рендеринг лімітованих завдань - ОПТИМІЗОВАНА
     */
    function renderLimitedTasks() {
        console.log('[TasksManager-V2] Рендеринг лімітованих завдань');

        const container = document.getElementById('limited-tab');
        if (!container) return;

        const tasks = window.TasksStore.getState().tasks.limited;

        // Створюємо віртуальне дерево
        const vdom = createLimitedTasksVDOM(tasks);

        // Diff і patch
        const oldVdom = state.vdomTrees.get('limited');

        if (oldVdom) {
            const patches = VirtualDOM.diff(oldVdom, vdom);
            if (patches) {
                VirtualDOM.patch(container, patches);
            }
        } else {
            container.innerHTML = '';
            const dom = VirtualDOM.createDOM(vdom);
            container.appendChild(dom);
        }

        state.vdomTrees.set('limited', vdom);
    }

    /**
     * Створення віртуального DOM для лімітованих завдань
     */
    function createLimitedTasksVDOM(tasks) {
        const h = VirtualDOM.createElement;

        if (Object.keys(tasks).length === 0) {
            return h('div', { className: 'no-tasks' }, 'Немає доступних завдань');
        }

        // Сортуємо по часу закінчення
        const sortedTasks = Object.values(tasks).sort((a, b) => {
            return (a.expiresAt || Infinity) - (b.expiresAt || Infinity);
        });

        return h('div', { className: 'tasks-container' },
            ...sortedTasks.map(task => createTaskCardVDOM(task, 'limited'))
        );
    }

    /**
     * Рендеринг партнерських завдань - ОПТИМІЗОВАНА
     */
    function renderPartnerTasks() {
        console.log('[TasksManager-V2] Рендеринг партнерських завдань');

        const container = document.getElementById('partner-tab');
        if (!container) return;

        const tasks = window.TasksStore.getState().tasks.partner;

        // Створюємо віртуальне дерево
        const vdom = createPartnerTasksVDOM(tasks);

        // Diff і patch
        const oldVdom = state.vdomTrees.get('partner');

        if (oldVdom) {
            const patches = VirtualDOM.diff(oldVdom, vdom);
            if (patches) {
                VirtualDOM.patch(container, patches);
            }
        } else {
            container.innerHTML = '';
            const dom = VirtualDOM.createDOM(vdom);
            container.appendChild(dom);
        }

        state.vdomTrees.set('partner', vdom);
    }

    /**
     * Створення віртуального DOM для партнерських завдань
     */
    function createPartnerTasksVDOM(tasks) {
        const h = VirtualDOM.createElement;

        if (Object.keys(tasks).length === 0) {
            return h('div', { className: 'no-tasks' }, 'Немає доступних завдань');
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

        return h('div', { className: 'tasks-container' },
            ...Object.entries(tasksByPartner).map(([partner, partnerTasks]) =>
                createPartnerSectionVDOM(partner, partnerTasks)
            )
        );
    }

    /**
     * Створення секції партнера для віртуального DOM
     */
    function createPartnerSectionVDOM(partner, tasks) {
        const h = VirtualDOM.createElement;

        return h('div', {
            className: 'partner-section',
            'data-partner': partner
        },
            h('div', { className: 'partner-header' },
                h('div', { className: 'partner-info' },
                    h('span', { className: 'partner-name' }, partner),
                    h('span', { className: 'partner-count' }, `${tasks.length} завдань`)
                )
            ),
            h('div', { className: 'partner-tasks' },
                ...tasks.map(task => createTaskCardVDOM(task, 'partner'))
            )
        );
    }

    /**
     * Налаштування глобального таймера для всіх завдань
     */
    function setupGlobalTaskTimer() {
        console.log('[TasksManager-V2] Налаштування глобального таймера');

        // Очищаємо старий таймер
        if (state.globalTaskTimer) {
            clearInterval(state.globalTaskTimer);
        }

        // Оновлюємо всі таймери раз в секунду
        state.globalTaskTimer = setInterval(() => {
            updateAllTimers();
        }, 1000);
    }

    /**
     * Оновлення всіх таймерів одночасно
     */
    function updateAllTimers() {
        const now = Date.now();
        let hasExpired = false;

        // Знаходимо всі елементи з таймерами
        const timerElements = document.querySelectorAll('.task-timer[data-expires]');

        timerElements.forEach(timerEl => {
            const expiresAt = parseInt(timerEl.getAttribute('data-expires'));
            const timeLeft = expiresAt - now;

            if (timeLeft <= 0) {
                // Завдання закінчилось
                const card = timerEl.closest('.task-card');
                if (card && !card.classList.contains('expired')) {
                    card.classList.add('expired');
                    hasExpired = true;

                    // Оновлюємо в Store
                    const taskId = card.getAttribute('data-task-id');
                    const taskType = card.getAttribute('data-task-type');

                    window.TasksStore.actions.updateTaskStatus(
                        taskType,
                        taskId,
                        window.TasksConstants.TASK_STATUS.EXPIRED
                    );
                }

                const timeSpan = timerEl.querySelector('.time-remaining');
                if (timeSpan) {
                    timeSpan.textContent = 'Завершено';
                }
            } else {
                // Оновлюємо таймер
                const hours = Math.floor(timeLeft / (1000 * 60 * 60));
                const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
                const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

                const timeSpan = timerEl.querySelector('.time-remaining');
                if (timeSpan) {
                    timeSpan.textContent = `${hours}:${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
                }
            }
        });

        // Якщо є завдання що закінчились - плануємо оновлення
        if (hasExpired) {
            scheduleRender();
        }
    }

    /**
     * Налаштування автооновлення - ОПТИМІЗОВАНА
     */
    function setupAutoUpdate() {
        console.log('[TasksManager-V2] Налаштування автооновлення');

        // Очищаємо попередній інтервал
        if (state.updateInterval) {
            clearInterval(state.updateInterval);
        }

        // Smart polling - оновлюємо тільки якщо вкладка активна
        state.updateInterval = setInterval(() => {
            if (!document.hidden && isTasksTabActive()) {
                console.log('[TasksManager-V2] Автоматичне оновлення завдань');
                loadAllTasks();
            }
        }, config.updateIntervalMs);
    }

    /**
     * Перевірка чи активна вкладка завдань
     */
    function isTasksTabActive() {
        const currentTab = window.TasksStore?.selectors.getCurrentTab();
        return ['social', 'limited', 'partner'].includes(currentTab);
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
     * Налаштування обробників подій - ОПТИМІЗОВАНА
     */
    function setupEventHandlers() {
        console.log('[TasksManager-V2] Налаштування обробників подій');

        // Видаляємо старі обробники
        document.removeEventListener('tab-switched', handleTabSwitch);
        document.removeEventListener('click', handleTaskClick);

        // Додаємо нові
        document.addEventListener('tab-switched', handleTabSwitch);
        document.addEventListener('click', handleTaskClick);

        // Оптимізована підписка на Store
        if (window.TasksStore) {
            const debouncedRender = window.TasksUtils.debounce(() => {
                scheduleRender();
            }, 100);

            window.TasksStore.subscribe((state, prevState, action) => {
                // Рендеримо тільки при змінах завдань
                if (action.type === 'SET_TASKS' || action.type === 'UPDATE_TASK_STATUS') {
                    debouncedRender();
                }
            });
        }

        // Оптимізація видимості
        document.addEventListener('visibilitychange', () => {
            if (document.hidden) {
                // Зупиняємо таймери при прихованій вкладці
                if (state.globalTaskTimer) {
                    clearInterval(state.globalTaskTimer);
                }
            } else {
                // Відновлюємо при поверненні
                setupGlobalTaskTimer();

                // Оновлюємо якщо пройшло багато часу
                if (state.lastUpdate && Date.now() - state.lastUpdate > 60000) {
                    loadAllTasks();
                }
            }
        });
    }

    /**
     * Обробка перемикання вкладок
     */
    const handleTabSwitch = window.TasksUtils.debounce((e) => {
        console.log('[TasksManager-V2] Перемикання вкладки:', e.detail);
        scheduleRender();
    }, 100);

    /**
     * Обробка кліків на завданнях
     */
    const handleTaskClick = (e) => {
        const button = e.target.closest('.task-button');
        if (!button) return;

        const card = button.closest('.task-card');
        if (!card) return;

        const taskId = card.getAttribute('data-task-id');
        const taskType = card.getAttribute('data-task-type');
        const platform = card.getAttribute('data-platform');

        console.log('[TasksManager-V2] Клік на завдання:', { taskId, taskType, platform });

        // Делегуємо обробку
        handleTaskAction(taskId, taskType, platform);
    };

    /**
     * Обробка дій із завданнями - ОПТИМІЗОВАНА
     */
    async function handleTaskAction(taskId, taskType, platform) {
        // Отримуємо завдання зі стору
        const state = window.TasksStore.getState();
        const task = state.tasks[taskType]?.[taskId];

        if (!task) {
            console.error('[TasksManager-V2] Завдання не знайдено:', taskId);
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

        // Запускаємо верифікацію якщо потрібно
        if (window.TaskVerification) {
            window.TaskVerification.addToQueue(taskId, taskType, platform, {
                channelUsername: task.channelUsername,
                action: task.action,
                url: task.url
            });
        }
    }

    /**
     * Оновити UI завдань - PUBLIC метод для зовнішніх викликів
     */
    function updateTasksUI() {
        console.log('[TasksManager-V2] Зовнішній виклик updateTasksUI');
        scheduleRender();
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

        config.taskTypes.forEach(type => {
            const tasks = Object.values(state.tasks[type] || {});
            stats.byType[type] = tasks.length;
            stats.total += tasks.length;

            tasks.forEach(task => {
                if (task.status === statuses.COMPLETED) {
                    stats.completed++;
                } else if (task.status === statuses.AVAILABLE) {
                    stats.available++;
                }

                const platform = task.platform || 'other';
                stats.byPlatform[platform] = (stats.byPlatform[platform] || 0) + 1;

                if (task.status === statuses.AVAILABLE && task.reward) {
                    stats.totalRewards.winix += task.reward.winix || 0;
                    stats.totalRewards.tickets += task.reward.tickets || 0;
                }
            });
        });

        return stats;
    }

    /**
     * Знищити менеджер
     */
    function destroy() {
        console.log('[TasksManager-V2] === ЗНИЩЕННЯ МЕНЕДЖЕРА ===');

        // Очищаємо таймери
        if (state.updateInterval) {
            clearInterval(state.updateInterval);
        }

        if (state.globalTaskTimer) {
            clearInterval(state.globalTaskTimer);
        }

        // Очищаємо кеш
        TasksCache.clear();
        state.vdomTrees.clear();
        state.domCache.clear();

        // Видаляємо обробники
        document.removeEventListener('tab-switched', handleTabSwitch);
        document.removeEventListener('click', handleTaskClick);

        console.log('[TasksManager-V2] Менеджер знищено');
    }

    console.log('[TasksManager-V2] Менеджер завдань готовий');

    // Публічний API
    return {
        init,
        loadAllTasks,
        updateTasksUI,
        getTasksStatistics,
        destroy
    };

})();

console.log('[TasksManager-V2] Модуль експортовано глобально');