/**
 * SocialTask - оптимізований компонент для соціальних завдань
 * Відповідає за:
 * - Створення та відображення соціальних завдань
 * - Безпечну взаємодію з соціальними мережами
 * - Оптимізований рендеринг для високої продуктивності
 * - Надійну перевірку автентифікації в соціальних сервісах
 */

window.SocialTask = (function() {
    // Константи та типи
    const STATUS = {
        IDLE: 'idle',
        LOADING: 'loading',
        COMPLETED: 'completed',
        ERROR: 'error',
        IN_PROGRESS: 'in_progress'
    };

    const AUTH_STATUS = {
        UNKNOWN: 'unknown',
        AUTHENTICATED: 'authenticated',
        NOT_AUTHENTICATED: 'not_authenticated',
        VERIFICATION_NEEDED: 'verification_needed'
    };

    // Налаштування безпеки для соціальних мереж
    const SAFE_DOMAINS = [
        't.me', 'telegram.me', 'telegram.org',
        'twitter.com', 'x.com',
        'facebook.com', 'fb.com',
        'instagram.com',
        'discord.gg', 'discord.com',
        'youtube.com', 'youtu.be',
        'linkedin.com',
        'tiktok.com',
        'reddit.com'
    ];

    // Приватні змінні модуля
    let authenticationStatus = {};
    let taskRenderers = new Map();
    let renderQueue = [];
    let isRendering = false;
    let taskDomElements = new Map();
    let taskStatuses = new Map();
    let pendingAuthResponses = new Map();

    // Кеш для рендерингу для оптимізації
    const renderedTasksCache = new Map();

    /**
     * Ініціалізація модуля
     */
    function init() {
        // Очистка змінних при ініціалізації
        authenticationStatus = {};
        taskRenderers.clear();
        renderQueue = [];
        isRendering = false;
        taskDomElements.clear();
        taskStatuses.clear();
        pendingAuthResponses.clear();
        renderedTasksCache.clear();

        // Завантаження статусів автентифікації з localStorage
        loadAuthStatus();

        // Запуск віртуалізованого рендерингу
        setupVirtualizedRendering();

        // Слухачі подій для обробки комунікації з соціальними мережами
        setupEventListeners();

        console.log('SocialTask: Модуль соціальних завдань ініціалізовано');
    }

    /**
     * Завантаження статусів автентифікації з localStorage
     */
    function loadAuthStatus() {
        try {
            const savedStatus = localStorage.getItem('social_auth_status');
            if (savedStatus) {
                authenticationStatus = JSON.parse(savedStatus);
                console.log('SocialTask: Статуси автентифікації завантажено');
            }
        } catch (error) {
            console.warn('SocialTask: Помилка завантаження статусів автентифікації', error);
            authenticationStatus = {};
        }
    }

    /**
     * Збереження статусів автентифікації в localStorage
     */
    function saveAuthStatus() {
        try {
            localStorage.setItem('social_auth_status', JSON.stringify(authenticationStatus));
        } catch (error) {
            console.warn('SocialTask: Помилка збереження статусів автентифікації', error);
        }
    }

    /**
     * Налаштування віртуалізованого рендерингу для оптимізації продуктивності
     */
    function setupVirtualizedRendering() {
        // Використовуємо Intersection Observer для відкладеного рендерингу
        if ('IntersectionObserver' in window) {
            const observerOptions = {
                root: null,
                rootMargin: '100px',
                threshold: 0.1
            };

            const taskObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const taskId = entry.target.dataset.taskId;

                        // Якщо завдання в черзі рендерингу, пріоритизуємо його
                        const queueIndex = renderQueue.findIndex(item => item.taskId === taskId);
                        if (queueIndex !== -1) {
                            const task = renderQueue.splice(queueIndex, 1)[0];
                            renderQueue.unshift(task);

                            // Запускаємо процес рендерингу, якщо ще не запущено
                            if (!isRendering) {
                                processRenderQueue();
                            }
                        }

                        // Припиняємо спостерігати за цим елементом
                        taskObserver.unobserve(entry.target);
                    }
                });
            }, observerOptions);

            // Зберігаємо Observer для використання в інших функціях
            window.SocialTask._taskObserver = taskObserver;
        } else {
            console.warn('SocialTask: IntersectionObserver не підтримується, оптимізація рендерингу вимкнена');
        }
    }

    /**
     * Налаштування слухачів подій
     */
    function setupEventListeners() {
        // Слухаємо події від соціальних мереж (через window.addEventListener)
        window.addEventListener('message', handleSocialNetworkMessage);

        // Слухаємо події життєвого циклу сторінки
        document.addEventListener('visibilitychange', handleVisibilityChange);

        // Реагуємо на події від TaskManager
        document.addEventListener('task-completed', handleTaskCompleted);
        document.addEventListener('auth-status-updated', handleAuthStatusUpdated);
    }

    /**
     * Обробка повідомлень від соціальних мереж
     */
    function handleSocialNetworkMessage(event) {
        // Перевіряємо, чи є origin у списку дозволених
        if (!isSafeDomain(event.origin)) {
            console.warn(`SocialTask: Отримано повідомлення з ненадійного джерела: ${event.origin}`);
            return;
        }

        try {
            // Перевіряємо, чи дані - об'єкт JSON
            if (typeof event.data !== 'object' || event.data === null) {
                return;
            }

            // Обробляємо повідомлення про автентифікацію
            if (event.data.type === 'social_auth_status') {
                const { network, status, userId } = event.data;

                if (network && status) {
                    // Оновлюємо статус автентифікації
                    authenticationStatus[network] = {
                        status: status,
                        userId: userId || null,
                        timestamp: Date.now()
                    };

                    // Зберігаємо оновлені статуси
                    saveAuthStatus();

                    // Оновлюємо пов'язані завдання
                    updateTasksByNetwork(network);

                    // Сповіщаємо очікуючі запити
                    if (pendingAuthResponses.has(network)) {
                        const callbacks = pendingAuthResponses.get(network);
                        callbacks.forEach(callback => callback(status === 'authenticated'));
                        pendingAuthResponses.delete(network);
                    }
                }
            }
        } catch (error) {
            console.error('SocialTask: Помилка при обробці повідомлення:', error);
        }
    }

    /**
     * Обробка зміни видимості сторінки
     */
    function handleVisibilityChange() {
        if (document.visibilityState === 'visible') {
            // При поверненні на сторінку оновлюємо статуси завдань
            refreshAllTasks();
        }
    }

    /**
     * Обробка події завершення завдання
     */
    function handleTaskCompleted(event) {
        const { taskId } = event.detail;

        // Оновлюємо відображення завдання
        refreshTaskDisplay(taskId);
    }

    /**
     * Обробка події оновлення статусу автентифікації
     */
    function handleAuthStatusUpdated(event) {
        const { network, status } = event.detail;

        if (network && status) {
            // Оновлюємо статус автентифікації
            authenticationStatus[network] = {
                ...authenticationStatus[network],
                status: status,
                timestamp: Date.now()
            };

            // Зберігаємо оновлені статуси
            saveAuthStatus();

            // Оновлюємо пов'язані завдання
            updateTasksByNetwork(network);
        }
    }

    /**
     * Перевірка, чи домен безпечний
     * @param {string} url - URL для перевірки
     * @returns {boolean} - Чи є домен безпечним
     */
    function isSafeDomain(url) {
        try {
            const domain = new URL(url).hostname.toLowerCase();
            return SAFE_DOMAINS.some(safeDomain => domain === safeDomain || domain.endsWith(`.${safeDomain}`));
        } catch (error) {
            console.error('SocialTask: Помилка перевірки домену:', error);
            return false;
        }
    }

    /**
     * Безпечна перевірка URL для відкриття
     * @param {string} url - URL для перевірки
     * @returns {string|null} - Безпечний URL або null, якщо URL небезпечний
     */
    function validateUrl(url) {
        try {
            // Перевіряємо, чи URL порожній або undefined
            if (!url) {
                console.warn('SocialTask: Порожній URL');
                return null;
            }

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
                console.warn(`SocialTask: Небезпечний протокол: ${urlObj.protocol}`);
                return null;
            }

            // Перевіряємо, чи домен у білому списку
            if (!isSafeDomain(normalizedUrl)) {
                console.warn(`SocialTask: Небезпечний домен: ${urlObj.hostname}`);
                return null;
            }

            // Додаткова перевірка на шкідливі параметри
            const dangerousParams = ['javascript', 'script', 'eval', 'vbscript'];
            for (const param of Object.values(Object.fromEntries(urlObj.searchParams))) {
                if (dangerousParams.some(dp => param.toLowerCase().includes(dp))) {
                    console.warn(`SocialTask: Виявлено потенційно небезпечний параметр: ${param}`);
                    return null;
                }
            }

            return normalizedUrl;
        } catch (error) {
            console.error('SocialTask: Помилка валідації URL:', error);
            return null;
        }
    }

    /**
     * Перевірка автентифікації в соціальній мережі
     * @param {string} network - Назва соціальної мережі
     * @returns {Promise<boolean>} - Чи автентифікований користувач
     */
    function checkAuthentication(network) {
        return new Promise((resolve) => {
            if (!network) {
                resolve(false);
                return;
            }

            // Якщо статус уже є і не застарів
            if (authenticationStatus[network] &&
                authenticationStatus[network].timestamp > Date.now() - 5 * 60 * 1000) {
                resolve(authenticationStatus[network].status === 'authenticated');
                return;
            }

            // Реєструємо callback для майбутньої відповіді
            if (!pendingAuthResponses.has(network)) {
                pendingAuthResponses.set(network, []);
            }

            pendingAuthResponses.get(network).push(resolve);

            // Запускаємо перевірку через TaskVerification, якщо він доступний
            if (window.TaskVerification && window.TaskVerification.checkSocialAuth) {
                window.TaskVerification.checkSocialAuth(network);
            } else {
                // Запасний варіант - просто вважаємо, що автентифікація відбулася
                setTimeout(() => {
                    resolve(true);

                    // Видаляємо з очікуючих запитів
                    if (pendingAuthResponses.has(network)) {
                        pendingAuthResponses.delete(network);
                    }
                }, 500);
            }

            // Встановлюємо таймаут для вирішення, якщо немає відповіді
            setTimeout(() => {
                if (pendingAuthResponses.has(network) &&
                    pendingAuthResponses.get(network).includes(resolve)) {
                    // Видаляємо цей колбек
                    const callbacks = pendingAuthResponses.get(network);
                    const index = callbacks.indexOf(resolve);
                    if (index !== -1) {
                        callbacks.splice(index, 1);
                    }

                    // Якщо колбеків більше немає, видаляємо ключ
                    if (callbacks.length === 0) {
                        pendingAuthResponses.delete(network);
                    }

                    // Вирішуємо проміс з негативною відповіддю
                    resolve(false);
                }
            }, 10000); // 10 секунд таймаут
        });
    }

    /**
     * Оновлення завдань за соціальною мережею
     * @param {string} network - Назва соціальної мережі
     */
    function updateTasksByNetwork(network) {
        // Знаходимо всі завдання, пов'язані з цією соціальною мережею
        const tasks = Array.from(taskDomElements.entries())
            .filter(([_, element]) => element.dataset.network === network)
            .map(([taskId]) => taskId);

        // Оновлюємо знайдені завдання
        tasks.forEach(taskId => refreshTaskDisplay(taskId));
    }

    /**
     * Обробка початку виконання завдання
     * @param {Object} task - Дані завдання
     * @returns {Promise<void>}
     */
    async function handleStartTask(task) {
        try {
            if (!task) {
                console.error('SocialTask: Неправильний об\'єкт завдання');
                return;
            }

            // Оновлюємо статус завдання
            taskStatuses.set(task.id, STATUS.LOADING);
            updateTaskStatus(task.id);

            // Перевіряємо, чи потрібна автентифікація
            if (task.network) {
                const isAuthenticated = await checkAuthentication(task.network);

                if (!isAuthenticated && task.auth_required !== false) {
                    // Якщо автентифікація потрібна, але не відбулася
                    taskStatuses.set(task.id, STATUS.ERROR);
                    updateTaskStatus(task.id);

                    showMessage('Вам потрібно авторизуватися в соціальній мережі для виконання завдання', 'error');
                    return;
                }
            }

            // Якщо є TaskManager, делегуємо обробку йому
            if (window.TaskManager && window.TaskManager.startTask) {
                window.TaskManager.startTask(task.id);
                return;
            }

            // Якщо є API, викликаємо його самостійно
            if (window.API) {
                const response = await window.API.post(`/quests/tasks/${task.id}/start`);

                if (!response.success) {
                    throw new Error(response.message || 'Помилка при старті завдання');
                }
            }

            // Якщо є URL дії, відкриваємо його
            if (task.action_url) {
                // Валідуємо URL перед відкриттям
                const safeUrl = validateUrl(task.action_url);

                if (safeUrl) {
                    // Відкриваємо URL в новому вікні з параметрами безпеки
                    const newWindow = window.open(safeUrl, '_blank', 'noopener,noreferrer');

                    // Додаткова перевірка після відкриття
                    if (newWindow) {
                        // Для додаткової безпеки видаляємо посилання на батьківське вікно
                        setTimeout(() => {
                            try {
                                if (newWindow.opener) {
                                    newWindow.opener = null;
                                }
                            } catch (e) {
                                // Ігноруємо помилки, які можуть виникнути через Same-Origin Policy
                            }
                        }, 100);
                    } else {
                        // Якщо вікно не відкрилося, показуємо повідомлення
                        showMessage('Перегляд вікна був заблокований. Будь ласка, дозвольте спливаючі вікна для цього сайту', 'error');
                    }
                } else {
                    showMessage('Неможливо відкрити це посилання через проблеми безпеки', 'error');
                }
            }

            // Оновлюємо статус завдання
            taskStatuses.set(task.id, STATUS.IN_PROGRESS);
            updateTaskStatus(task.id);

            // Відображаємо успішне повідомлення
            showMessage('Завдання розпочато! Виконайте необхідні дії.', 'success');
        } catch (error) {
            console.error('SocialTask: Помилка при старті завдання:', error);

            // Оновлюємо статус завдання
            taskStatuses.set(task.id, STATUS.ERROR);
            updateTaskStatus(task.id);

            // Відображаємо повідомлення про помилку
            showMessage('Сталася помилка при спробі розпочати завдання', 'error');
        }
    }

    /**
     * Обробник перевірки виконання завдання
     * @param {Object} task - Дані завдання
     * @returns {Promise<void>}
     */
    async function handleVerifyTask(task) {
        try {
            if (!task) {
                console.error('SocialTask: Неправильний об\'єкт завдання');
                return;
            }

            // Перевіряємо, чи завдання вже обробляється
            if (taskStatuses.get(task.id) === STATUS.LOADING) {
                console.warn('SocialTask: Завдання вже обробляється');
                return;
            }

            // Оновлюємо статус завдання
            taskStatuses.set(task.id, STATUS.LOADING);
            updateTaskStatus(task.id);

            // Якщо є TaskManager, делегуємо обробку йому
            if (window.TaskManager && window.TaskManager.verifyTask) {
                window.TaskManager.verifyTask(task.id);
                return;
            }

            // Показуємо індикатор завантаження на елементі завдання
            const taskElement = taskDomElements.get(task.id);
            if (taskElement) {
                const actionElement = taskElement.querySelector('.task-action');
                if (actionElement) {
                    // Зберігаємо оригінальний вміст
                    const originalContent = actionElement.innerHTML;
                    actionElement.setAttribute('data-original-content', originalContent);

                    // Замінюємо вміст на індикатор завантаження
                    actionElement.innerHTML = `
                        <div class="loading-indicator">
                            <div class="spinner"></div>
                            <span data-lang-key="earn.verifying">Перевірка...</span>
                        </div>
                    `;
                }
            }

            // Якщо є API, викликаємо його самостійно
            if (window.API) {
                const response = await window.API.post(`/quests/tasks/${task.id}/verify`);

                // Оновлюємо відображення завдання
                refreshTaskDisplay(task.id);

                if (response.success) {
                    // Відображаємо успішне повідомлення
                    showMessage(response.message || 'Завдання успішно виконано!', 'success');

                    // Якщо є винагорода, показуємо анімацію
                    if (response.reward) {
                        showRewardAnimation(response.reward);
                    }

                    // Оновлюємо статус завдання
                    taskStatuses.set(task.id, STATUS.COMPLETED);
                } else {
                    // Відображаємо помилку
                    showMessage(response.message || 'Не вдалося перевірити виконання завдання', 'error');

                    // Оновлюємо статус завдання
                    taskStatuses.set(task.id, STATUS.ERROR);
                }
            } else {
                // Симулюємо запит
                setTimeout(() => {
                    // Симулюємо успіх з ймовірністю 80%
                    const isSuccess = Math.random() < 0.8;

                    // Оновлюємо відображення завдання
                    refreshTaskDisplay(task.id);

                    if (isSuccess) {
                        // Відображаємо успішне повідомлення
                        showMessage('Завдання успішно виконано!', 'success');

                        // Симулюємо винагороду
                        const reward = {
                            type: Math.random() < 0.5 ? 'tokens' : 'coins',
                            amount: Math.floor(Math.random() * 50) + 10
                        };

                        // Показуємо анімацію винагороди
                        showRewardAnimation(reward);

                        // Оновлюємо статус завдання
                        taskStatuses.set(task.id, STATUS.COMPLETED);
                    } else {
                        // Відображаємо помилку
                        showMessage('Не вдалося перевірити виконання завдання', 'error');

                        // Оновлюємо статус завдання
                        taskStatuses.set(task.id, STATUS.ERROR);
                    }

                    // Оновлюємо статус завдання
                    updateTaskStatus(task.id);
                }, 1500);
            }
        } catch (error) {
            console.error('SocialTask: Помилка при перевірці завдання:', error);

            // Оновлюємо статус завдання
            taskStatuses.set(task.id, STATUS.ERROR);
            updateTaskStatus(task.id);

            // Відображаємо повідомлення про помилку
            showMessage('Сталася помилка при спробі перевірити завдання', 'error');

            // Оновлюємо відображення завдання
            refreshTaskDisplay(task.id);
        }
    }

    /**
     * Оновлення статусу завдання в інтерфейсі
     * @param {string} taskId - ID завдання
     */
    function updateTaskStatus(taskId) {
        const status = taskStatuses.get(taskId);
        const taskElement = taskDomElements.get(taskId);

        if (!taskElement || !status) return;

        // Оновлюємо класи елемента відповідно до статусу
        taskElement.classList.remove('loading', 'completed', 'error', 'in-progress');

        switch (status) {
            case STATUS.LOADING:
                taskElement.classList.add('loading');
                break;
            case STATUS.COMPLETED:
                taskElement.classList.add('completed');
                break;
            case STATUS.ERROR:
                taskElement.classList.add('error');
                break;
            case STATUS.IN_PROGRESS:
                taskElement.classList.add('in-progress');
                break;
        }

        // Оновлюємо відображення елементів управління
        const actionElement = taskElement.querySelector('.task-action');
        if (actionElement) {
            // Якщо завдання виконано, показуємо лише мітку "Виконано"
            if (status === STATUS.COMPLETED) {
                actionElement.innerHTML = '<div class="completed-label" data-lang-key="earn.completed">Виконано</div>';
            }
            // Якщо елемент завантажується, показуємо індикатор завантаження
            else if (status === STATUS.LOADING) {
                if (!actionElement.querySelector('.loading-indicator')) {
                    const originalContent = actionElement.getAttribute('data-original-content');

                    if (originalContent) {
                        // Запам'ятовуємо оригінальний вміст
                        actionElement.setAttribute('data-original-content', originalContent);
                    }

                    actionElement.innerHTML = `
                        <div class="loading-indicator">
                            <div class="spinner"></div>
                            <span data-lang-key="earn.verifying">Перевірка...</span>
                        </div>
                    `;
                }
            }
            // В інших випадках відновлюємо оригінальний вміст
            else {
                const originalContent = actionElement.getAttribute('data-original-content');

                if (originalContent) {
                    actionElement.innerHTML = originalContent;
                    actionElement.removeAttribute('data-original-content');

                    // Відновлюємо обробники подій
                    setupTaskEventListeners(taskElement, taskId);
                }
            }
        }
    }

    /**
     * Створення елементу соціального завдання
     * @param {Object} task - Об'єкт з даними завдання
     * @param {Object} progress - Об'єкт з прогресом користувача
     * @returns {HTMLElement} - DOM елемент завдання
     */
    function create(task, progress = null) {
        // Перевіряємо, чи є кеш для цього завдання
        const cacheKey = `${task.id}-${progress ? progress.status : 'null'}-${progress ? progress.progress_value : 0}`;

        if (renderedTasksCache.has(cacheKey)) {
            const cachedElement = renderedTasksCache.get(cacheKey).cloneNode(true);

            // Налаштовуємо обробники подій для клонованого елементу
            setupTaskEventListeners(cachedElement, task.id);

            // Зберігаємо посилання на DOM елемент
            taskDomElements.set(task.id, cachedElement);

            return cachedElement;
        }

        // Визначаємо поточний стан завдання
        const isCompleted = progress && progress.status === 'completed';
        const progressValue = progress ? progress.progress_value : 0;
        const progressPercent = task.target_value > 0
            ? Math.min(100, Math.round((progressValue / task.target_value) * 100))
            : 0;

        // Визначаємо тип соціальної мережі (якщо є)
        const networkMatch = task.action_url ? task.action_url.match(/\/\/(www\.)?([^\/]+)/) : null;
        const network = networkMatch ? detectNetwork(networkMatch[2]) : null;

        // Створюємо основний контейнер завдання
        const taskElement = document.createElement('div');
        taskElement.className = 'task-item';
        taskElement.dataset.taskId = task.id;
        taskElement.dataset.taskType = 'social';

        // Додаємо інформацію про соціальну мережу, якщо є
        if (network) {
            taskElement.dataset.network = network;
        }

        // Наповнюємо контент завдання з використанням шаблону
        taskElement.innerHTML = `
            <div class="task-header">
                <div class="task-title">${escapeHtml(task.title)}</div>
                ${isCompleted ? 
                  '<div class="completed-label" data-lang-key="earn.completed">Виконано</div>' : 
                  `<div class="task-reward">${task.reward_amount} <span class="token-symbol">${task.reward_type === 'tokens' ? '$WINIX' : 'жетонів'}</span></div>`
                }
            </div>
            <div class="task-description">${escapeHtml(task.description)}</div>
            ${task.target_value > 1 ? 
              `<div class="task-progress">
                   <div class="progress-text">${progressValue}/${task.target_value} ${task.progress_label || ''}</div>
                   <div class="progress-bar-container">
                       <div class="progress-fill" style="width: ${progressPercent}%;"></div>
                   </div>
               </div>` : ''
            }
            <div class="task-action">
                ${isCompleted ? 
                  '<div class="completed-label" data-lang-key="earn.completed">Виконано</div>' : 
                  `<button class="action-button" data-action="start" data-task-id="${task.id}" data-lang-key="earn.${task.action_type || 'start'}">${task.action_label || 'Виконати'}</button>
                   <button class="action-button verify-button" data-action="verify" data-task-id="${task.id}" data-lang-key="earn.verify">Перевірити</button>`
                }
            </div>
        `;

        // Налаштовуємо обробники подій
        setupTaskEventListeners(taskElement, task.id);

        // Зберігаємо посилання на DOM елемент
        taskDomElements.set(task.id, taskElement);

        // Зберігаємо завдання в кеші рендерингу
        renderedTasksCache.set(cacheKey, taskElement.cloneNode(true));

        // Запам'ятовуємо поточний статус завдання
        taskStatuses.set(task.id, isCompleted ? STATUS.COMPLETED : STATUS.IDLE);

        return taskElement;
    }

    /**
     * Налаштування обробників подій для елементу завдання
     * @param {HTMLElement} taskElement - Елемент завдання
     * @param {string} taskId - ID завдання
     */
    function setupTaskEventListeners(taskElement, taskId) {
        if (!taskElement || !taskId) return;

        const startButton = taskElement.querySelector('.action-button[data-action="start"]');
        const verifyButton = taskElement.querySelector('.action-button[data-action="verify"]');

        // Видаляємо існуючі обробники, щоб уникнути дублювання
        if (startButton) {
            startButton.replaceWith(startButton.cloneNode(true));
            const newStartButton = taskElement.querySelector('.action-button[data-action="start"]');

            if (newStartButton) {
                newStartButton.addEventListener('click', handleButtonClick);
            }
        }

        if (verifyButton) {
            verifyButton.replaceWith(verifyButton.cloneNode(true));
            const newVerifyButton = taskElement.querySelector('.action-button[data-action="verify"]');

            if (newVerifyButton) {
                newVerifyButton.addEventListener('click', handleButtonClick);
            }
        }

        // Функція-обробник кліків на кнопках
        function handleButtonClick(event) {
            event.preventDefault();
            event.stopPropagation();

            // Отримуємо завдання з TaskManager або знаходимо через селектор
            let task;

            if (window.TaskManager && window.TaskManager.findTaskById) {
                task = window.TaskManager.findTaskById(taskId);
            }

            if (!task) {
                // Шукаємо завдання за його ID у списку завдань
                const container = document.getElementById('social-tasks-container');
                if (container) {
                    const taskElements = container.querySelectorAll(`.task-item[data-task-id="${taskId}"]`);
                    if (taskElements.length > 0) {
                        // Знайшли елемент, пробуємо отримати дані з атрибутів
                        const taskElement = taskElements[0];
                        task = {
                            id: taskId,
                            type: 'social',
                            action_url: taskElement.getAttribute('data-action-url') || '',
                            network: taskElement.getAttribute('data-network') || null
                        };
                    }
                }
            }

            if (!task) {
                console.error(`SocialTask: Не вдалося знайти завдання з ID ${taskId}`);
                showMessage('Помилка: Завдання не знайдено', 'error');
                return;
            }

            // Визначаємо, яка дія була натиснута
            const action = event.target.getAttribute('data-action');

            if (action === 'start') {
                handleStartTask(task);
            } else if (action === 'verify') {
                handleVerifyTask(task);
            }
        }
    }

    /**
     * Оновлення відображення конкретного завдання
     * @param {string} taskId - ID завдання
     */
    function refreshTaskDisplay(taskId) {
        // Якщо є TaskManager, використовуємо його метод
        if (window.TaskManager && window.TaskManager.refreshTaskDisplay) {
            window.TaskManager.refreshTaskDisplay(taskId);
            return;
        }

        // Додаємо завдання в чергу рендерингу, якщо воно ще не там
        if (!renderQueue.some(item => item.taskId === taskId)) {
            renderQueue.push({
                taskId,
                priority: taskStatuses.get(taskId) === STATUS.LOADING ? 1 : 0,
                timestamp: Date.now()
            });

            // Запускаємо процес рендерингу, якщо він ще не запущений
            if (!isRendering) {
                processRenderQueue();
            }
        }
    }

    /**
     * Обробка черги рендерингу для оптимізації продуктивності
     */
    async function processRenderQueue() {
        if (isRendering || renderQueue.length === 0) {
            return;
        }

        isRendering = true;

        try {
            // Сортуємо чергу за пріоритетом та часом
            renderQueue.sort((a, b) => {
                if (a.priority !== b.priority) {
                    return b.priority - a.priority; // Вищий пріоритет спочатку
                }
                return a.timestamp - b.timestamp; // Раніше додані спочатку
            });

            // Обробляємо партіями для кращої продуктивності
            const batchSize = 5;
            const batch = renderQueue.splice(0, batchSize);

            // Обробляємо кожне завдання в партії
            for (const item of batch) {
                await refreshSingleTask(item.taskId);
            }

            // Перевіряємо, чи залишилися ще завдання в черзі
            if (renderQueue.length > 0) {
                // Продовжуємо обробку черги з невеликою затримкою
                setTimeout(processRenderQueue, 16); // Приблизно 1 кадр (60fps)
            } else {
                isRendering = false;
            }
        } catch (error) {
            console.error('SocialTask: Помилка при обробці черги рендерингу:', error);
            isRendering = false;

            // Повторюємо спробу через деякий час
            if (renderQueue.length > 0) {
                setTimeout(processRenderQueue, 1000);
            }
        }
    }

    /**
     * Оновлення одного завдання в черзі рендерингу
     * @param {string} taskId - ID завдання
     */
    async function refreshSingleTask(taskId) {
        // Знаходимо завдання в DOM
        const taskElement = taskDomElements.get(taskId);
        if (!taskElement) return;

        try {
            // Отримуємо актуальні дані
            let taskData, progressData;

            if (window.TaskManager) {
                // Отримуємо дані з TaskManager
                taskData = window.TaskManager.findTaskById ? window.TaskManager.findTaskById(taskId) : null;

                if (window.TaskProgress) {
                    progressData = window.TaskProgress.getTaskProgress ? window.TaskProgress.getTaskProgress(taskId) : null;
                } else {
                    progressData = window.TaskManager.userProgress ? window.TaskManager.userProgress[taskId] : null;
                }
            } else if (window.API) {
                // Робимо запит до API
                try {
                    const [tasksResponse, progressResponse] = await Promise.all([
                        window.API.get('/quests/tasks/social'),
                        window.API.get('/quests/user-progress')
                    ]);

                    if (tasksResponse.success && progressResponse.success) {
                        // Знаходимо потрібне завдання
                        taskData = tasksResponse.data.find(t => t.id === taskId);
                        progressData = progressResponse.data[taskId];
                    }
                } catch (apiError) {
                    console.error('SocialTask: Помилка при отриманні даних з API:', apiError);
                }
            }

            // Якщо дані отримані, оновлюємо елемент
            if (taskData) {
                // Створюємо новий елемент завдання
                const newTaskElement = create(taskData, progressData);

                // Замінюємо старий елемент
                taskElement.parentNode.replaceChild(newTaskElement, taskElement);

                // Оновлюємо посилання в мапі
                taskDomElements.set(taskId, newTaskElement);
            }
        } catch (error) {
            console.error(`SocialTask: Помилка при оновленні завдання ${taskId}:`, error);
        }
    }

    /**
     * Оновлення всіх завдань
     */
    function refreshAllTasks() {
        // Додаємо всі завдання в чергу рендерингу
        Array.from(taskDomElements.keys()).forEach(taskId => {
            refreshTaskDisplay(taskId);
        });
    }

    /**
     * Визначення соціальної мережі за URL
     * @param {string} domain - Домен з URL
     * @returns {string|null} - Назва соціальної мережі або null
     */
    function detectNetwork(domain) {
        if (!domain) return null;

        domain = domain.toLowerCase();

        if (domain.includes('telegram') || domain.includes('t.me')) {
            return 'telegram';
        } else if (domain.includes('twitter') || domain.includes('x.com')) {
            return 'twitter';
        } else if (domain.includes('facebook') || domain.includes('fb.com')) {
            return 'facebook';
        } else if (domain.includes('instagram')) {
            return 'instagram';
        } else if (domain.includes('discord')) {
            return 'discord';
        } else if (domain.includes('youtube') || domain.includes('youtu.be')) {
            return 'youtube';
        } else if (domain.includes('tiktok')) {
            return 'tiktok';
        } else if (domain.includes('linkedin')) {
            return 'linkedin';
        } else if (domain.includes('reddit')) {
            return 'reddit';
        } else {
            return null;
        }
    }

    /**
     * Показати анімацію отримання винагороди
     * @param {Object} reward - Дані винагороди
     */
    function showRewardAnimation(reward) {
        // Якщо є модуль анімацій, використовуємо його
        if (window.UI && window.UI.Animations && window.UI.Animations.showReward) {
            window.UI.Animations.showReward(reward);
            return;
        }

        // Якщо є TaskRewards, використовуємо його
        if (window.TaskRewards && window.TaskRewards.showRewardAnimation) {
            window.TaskRewards.showRewardAnimation(reward);
            return;
        }

        // Інакше робимо просту анімацію
        const rewardAmount = reward.amount;
        const rewardType = reward.type === 'tokens' ? '$WINIX' : 'жетонів';

        // Створюємо елемент анімації
        const animationElement = document.createElement('div');
        animationElement.className = 'reward-animation';
        animationElement.textContent = `+${rewardAmount} ${rewardType}`;

        // Додаємо до body
        document.body.appendChild(animationElement);

        // Запускаємо анімацію
        setTimeout(() => {
            animationElement.classList.add('show');

            // Видаляємо після завершення
            setTimeout(() => {
                animationElement.classList.remove('show');
                setTimeout(() => {
                    animationElement.remove();
                }, 300);
            }, 2000);
        }, 100);

        // Оновлюємо баланс користувача
        updateUserBalance(reward);
    }

    /**
     * Оновити баланс користувача
     * @param {Object} reward - Дані винагороди
     */
    function updateUserBalance(reward) {
        // Якщо є TaskRewards, використовуємо його
        if (window.TaskRewards && window.TaskRewards.updateBalance) {
            window.TaskRewards.updateBalance(reward);
            return;
        }

        if (reward.type === 'tokens') {
            const userTokensElement = document.getElementById('user-tokens');
            if (userTokensElement) {
                const currentBalance = parseFloat(userTokensElement.textContent) || 0;
                const newBalance = currentBalance + reward.amount;
                userTokensElement.textContent = newBalance.toFixed(2);
                userTokensElement.classList.add('highlight');
                setTimeout(() => {
                    userTokensElement.classList.remove('highlight');
                }, 2000);

                // Зберігаємо в localStorage
                try {
                    localStorage.setItem('userTokens', newBalance.toString());
                    localStorage.setItem('winix_balance', newBalance.toString());
                } catch (e) {
                    console.warn('SocialTask: Помилка збереження балансу токенів в localStorage:', e);
                }
            }
        } else if (reward.type === 'coins') {
            const userCoinsElement = document.getElementById('user-coins');
            if (userCoinsElement) {
                const currentBalance = parseInt(userCoinsElement.textContent) || 0;
                const newBalance = currentBalance + reward.amount;
                userCoinsElement.textContent = newBalance.toString();
                userCoinsElement.classList.add('highlight');
                setTimeout(() => {
                    userCoinsElement.classList.remove('highlight');
                }, 2000);

                // Зберігаємо в localStorage
                try {
                    localStorage.setItem('userCoins', newBalance.toString());
                    localStorage.setItem('winix_coins', newBalance.toString());
                } catch (e) {
                    console.warn('SocialTask: Помилка збереження балансу жетонів в localStorage:', e);
                }
            }
        }
    }

    /**
     * Показати повідомлення
     * @param {string} message - Текст повідомлення
     * @param {string} type - Тип повідомлення (info, success, error)
     */
    function showMessage(message, type = 'info') {
        // Якщо є компонент сповіщень, використовуємо його
        if (window.UI && window.UI.Notifications) {
            if (type === 'error') {
                window.UI.Notifications.showError(message);
            } else if (type === 'success') {
                window.UI.Notifications.showSuccess(message);
            } else {
                window.UI.Notifications.showInfo(message);
            }
            return;
        }

        // Інакше створюємо власне сповіщення
        // Перевіряємо, чи є контейнер для сповіщень
        let toastContainer = document.querySelector('.toast-container');

        if (!toastContainer) {
            // Створюємо контейнер, якщо його немає
            toastContainer = document.createElement('div');
            toastContainer.className = 'toast-container';
            document.body.appendChild(toastContainer);
        }

        // Створюємо елемент сповіщення
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;

        // Встановлюємо іконку залежно від типу
        let iconHTML = '';
        if (type === 'error') {
            iconHTML = '<span class="toast-icon">❌</span>';
        } else if (type === 'success') {
            iconHTML = '<span class="toast-icon">✅</span>';
        } else {
            iconHTML = '<span class="toast-icon">ℹ️</span>';
        }

        // Наповнюємо вміст
        toast.innerHTML = `
            ${iconHTML}
            <span class="toast-message">${escapeHtml(message)}</span>
            <button class="toast-close">&times;</button>
        `;

        // Додаємо обробник для кнопки закриття
        const closeButton = toast.querySelector('.toast-close');
        if (closeButton) {
            closeButton.addEventListener('click', () => {
                toast.classList.add('closing');
                setTimeout(() => {
                    toast.remove();
                }, 300);
            });
        }

        // Додаємо сповіщення до контейнера
        toastContainer.appendChild(toast);

        // Активуємо анімацію появи
        setTimeout(() => {
            toast.classList.add('active');
        }, 10);

        // Автоматично видаляємо сповіщення через 5 секунд
        setTimeout(() => {
            if (toast.parentElement) {
                toast.classList.add('closing');
                setTimeout(() => {
                    if (toast.parentElement) {
                        toast.remove();
                    }
                }, 300);
            }
        }, 5000);
    }

    /**
     * Функція для безпечного виведення HTML
     * @param {string} text - Текст для безпечного виведення
     * @returns {string} - Безпечний HTML
     */
    function escapeHtml(text) {
        if (!text) return '';

        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Публічний API модуля
    return {
        init,
        create,
        refreshTaskDisplay,
        refreshAllTasks,
        handleStartTask,
        handleVerifyTask,
        validateUrl,
        showMessage,
        checkAuthentication
    };
})();