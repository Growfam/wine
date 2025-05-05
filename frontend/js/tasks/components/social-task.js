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
        IN_PROGRESS: 'in_progress',
        READY_TO_VERIFY: 'ready_to_verify' // Додаємо новий стан для відображення кнопки перевірки
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
    let moduleInitialized = false;

    // Індикатор використання мок-даних
    const mockDataStatus = {
        authentication: false,
        verification: false,
        socialNetworkData: false
    };

    // Функція для логування використання мок-даних
    function logMockDataUsage(dataType, reason) {
        mockDataStatus[dataType] = true;
        console.warn(`SocialTask: Використання ТЕСТОВИХ даних для [${dataType}]. Причина: ${reason}`);

        // Додаємо детальний запис у консоль розробника
        if (console.groupCollapsed) {
            console.groupCollapsed(`%cМОК-ДАНІ SocialTask [${dataType}]`, 'background: #FFF3CD; color: #856404; padding: 2px 5px; border-radius: 3px;');
            console.info(`Причина: ${reason}`);
            console.info(`Час: ${new Date().toLocaleTimeString()}`);
            console.trace('Стек виклику');
            console.groupEnd();
        }
    }

    // Перевірка доступності API
    function isApiAvailable() {
        return window.API && typeof window.API.get === 'function' && typeof window.API.post === 'function';
    }

    // Перевірка, чи є користувач авторизованим
    function isUserAuthenticated() {
        // Перевірка через API, якщо доступне
        if (isApiAvailable() && window.API.isAuthenticated) {
            return window.API.isAuthenticated();
        }

        // Перевірка через TaskIntegration, якщо доступний
        if (window.TaskIntegration && window.TaskIntegration.safeGetUserId) {
            const result = window.TaskIntegration.safeGetUserId();
            return result.success;
        }

        // Перевірка через localStorage або інші маркери авторизації
        const hasAuthToken = localStorage.getItem('auth_token') || localStorage.getItem('user_token');
        const hasUserData = localStorage.getItem('user_data');

        return Boolean(hasAuthToken || hasUserData);
    }

    // Кеш для рендерингу для оптимізації
    const renderedTasksCache = new Map();

    /**
     * Безпечне отримання ID користувача
     * @returns {string|null} ID користувача або null
     */
    function safeGetUserId() {
        try {
            // Спочатку спробуємо отримати ID через TaskIntegration
            if (window.TaskIntegration && window.TaskIntegration.safeGetUserId) {
                const result = window.TaskIntegration.safeGetUserId();
                if (result.success) {
                    return result.userId;
                }
            }

            // Потім через window.getUserId, якщо функція доступна
            if (typeof window.getUserId === 'function') {
                const userId = window.getUserId();
                if (userId) {
                    return userId;
                }
            }

            // Спробуємо отримати з localStorage
            const storedId = localStorage.getItem('telegram_user_id');
            if (storedId && storedId !== 'undefined' && storedId !== 'null') {
                return storedId;
            }

            // Спробуємо отримати з DOM
            const userIdElement = document.getElementById('user-id');
            if (userIdElement && userIdElement.textContent) {
                return userIdElement.textContent.trim();
            }

            // Не знайдено ID
            return null;
        } catch (error) {
            console.error('SocialTask: Помилка отримання ID користувача:', error);
            return null;
        }
    }

    /**
     * Перевірка готовності DOM
     * @returns {boolean} Чи готовий DOM
     */
    function isDomReady() {
        return document.readyState === 'complete' || document.readyState === 'interactive';
    }

    /**
     * Ініціалізація модуля
     */
    function init() {
        console.log('SocialTask: Початок ініціалізації модуля');

        // Перевіряємо, чи модуль вже ініціалізовано
        if (moduleInitialized) {
            console.log('SocialTask: Модуль вже ініціалізовано');
            return;
        }

        // Перевіряємо готовність DOM
        if (!isDomReady()) {
            console.log('SocialTask: DOM ще не готовий, відкладаємо ініціалізацію');
            document.addEventListener('DOMContentLoaded', function() {
                setTimeout(init, 100);
            });
            return;
        }

        // Виконуємо діагностику перед ініціалізацією
        diagnoseEnvironment();

        try {
            // Очистка змінних при ініціалізації
            authenticationStatus = {};
            taskRenderers.clear();
            renderQueue = [];
            isRendering = false;
            taskDomElements.clear();
            taskStatuses.clear();
            pendingAuthResponses.clear();
            renderedTasksCache.clear();

            // Скидаємо стан використання мок-даних
            Object.keys(mockDataStatus).forEach(key => {
                mockDataStatus[key] = false;
            });

            // Завантаження статусів автентифікації з localStorage
            loadAuthStatus();

            // Запуск віртуалізованого рендерингу
            setupVirtualizedRendering();

            // Слухачі подій для обробки комунікації з соціальними мережами
            setupEventListeners();

            // Позначаємо, що модуль ініціалізовано
            moduleInitialized = true;

            console.log('SocialTask: Модуль соціальних завдань ініціалізовано');

            // Відправляємо подію про готовність модуля
            document.dispatchEvent(new CustomEvent('social-task-ready', {
                detail: { timestamp: Date.now() }
            }));
        } catch (error) {
            console.error('SocialTask: Помилка ініціалізації модуля:', error);
            // Спробуємо ще раз через деякий час, якщо виникла помилка
            setTimeout(function() {
                if (!moduleInitialized) {
                    console.log('SocialTask: Повторна спроба ініціалізації після помилки');
                    init();
                }
            }, 1000);
        }
    }

    /**
     * Діагностика середовища перед ініціалізацією
     */
    function diagnoseEnvironment() {
        console.log('SocialTask: Діагностика середовища перед ініціалізацією');
        console.log('document.readyState =', document.readyState);
        console.log('window.API доступний?', !!window.API);
        console.log('window.TaskManager доступний?', !!window.TaskManager);
        console.log('window.TaskProgressManager доступний?', !!window.TaskProgressManager);
        console.log('window.TaskIntegration доступний?', !!window.TaskIntegration);

        // Перевіряємо ID користувача
        const userId = safeGetUserId();
        console.log('ID користувача доступний?', !!userId);
    }

    /**
     * Завантаження статусів автентифікації з localStorage
     */
    function loadAuthStatus() {
        try {
            const savedStatus = localStorage.getItem('social_auth_status');
            if (savedStatus) {
                authenticationStatus = JSON.parse(savedStatus);
                console.log('SocialTask: Статуси автентифікації завантажено з localStorage');
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

        // ДОДАНО: Слухаємо подію оновлення ID користувача
        document.addEventListener('user-id-updated', handleUserIdUpdated);
    }

    /**
     * ДОДАНО: Обробка події оновлення ID користувача
     */
    function handleUserIdUpdated(event) {
        if (event.detail && event.detail.userId) {
            console.log('SocialTask: Отримано оновлення ID користувача:', event.detail.userId);

            // Оновлюємо відображення завдань
            refreshAllTasks();
        }
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

            // Перевіряємо наявність ID користувача
            const userId = safeGetUserId();
            if (!userId) {
                console.warn('SocialTask: ID користувача не знайдено при перевірці автентифікації');

                // Якщо немає ID користувача і не в режимі мок-даних, неможливо автентифікуватися
                if (!mockDataStatus.authentication) {
                    resolve(false);
                    return;
                }
            }

            // Якщо API недоступне або користувач не авторизований, використовуємо мок-дані
            if (!isApiAvailable() || !isUserAuthenticated()) {
                const reason = !isApiAvailable() ? 'API недоступне' : 'Користувач не авторизований';
                logMockDataUsage('authentication', reason);

                // Симулюємо успішну автентифікацію
                setTimeout(() => {
                    resolve(true);
                }, 500);
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
                // Запасний варіант - використовуємо мок-дані для автентифікації
                logMockDataUsage('authentication', 'TaskVerification недоступний');

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

                    // Логуємо використання мок-даних через таймаут
                    logMockDataUsage('authentication', 'Таймаут очікування відповіді');

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

            // Перевіряємо ID користувача
            const userId = safeGetUserId();
            if (!userId && !mockDataStatus.authentication) {
                // Якщо ID немає, і не в режимі мок-даних, показуємо повідомлення
                showMessage('Необхідно авторизуватися для виконання завдання', 'error');

                // Відправляємо подію про необхідність авторизації
                document.dispatchEvent(new CustomEvent('auth-required', {
                    detail: {
                        message: 'Для доступу до завдань необхідно авторизуватися',
                        taskId: task.id
                    }
                }));

                // Оновлюємо статус на помилку
                taskStatuses.set(task.id, STATUS.ERROR);
                updateTaskStatus(task.id);
                return;
            }

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

            // Якщо є API та користувач авторизований, викликаємо його самостійно
            if (isApiAvailable() && isUserAuthenticated()) {
                try {
                    const response = await window.API.post(`quests/tasks/${task.id}/start`)

                    if (!response.success) {
                        throw new Error(response.message || 'Помилка при старті завдання');
                    }
                } catch (error) {
                    console.error('SocialTask: Помилка API при старті завдання:', error);
                    // Продовжуємо виконання, щоб відкрити URL
                }
            } else {
                // Логуємо використання мок-даних для соц. мереж
                const reason = !isApiAvailable() ? 'API недоступне' : 'Користувач не авторизований';
                logMockDataUsage('socialNetworkData', reason);
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

            // ВИПРАВЛЕНО: Оновлюємо статус на READY_TO_VERIFY замість IN_PROGRESS
            taskStatuses.set(task.id, STATUS.READY_TO_VERIFY);
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

            // Перевіряємо ID користувача
            const userId = safeGetUserId();
            if (!userId && !mockDataStatus.verification) {
                // Якщо ID немає, і не в режимі мок-даних, показуємо повідомлення
                showMessage('Необхідно авторизуватися для перевірки завдання', 'error');

                // Відправляємо подію про необхідність авторизації
                document.dispatchEvent(new CustomEvent('auth-required', {
                    detail: {
                        message: 'Для доступу до завдань необхідно авторизуватися',
                        taskId: task.id
                    }
                }));

                // Оновлюємо статус на помилку
                taskStatuses.set(task.id, STATUS.ERROR);
                updateTaskStatus(task.id);
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

            // Перевіряємо наявність API та авторизації користувача
            if (isApiAvailable() && isUserAuthenticated()) {
                try {
                    const response = await window.API.post(`quests/tasks/${task.id}/verify`)

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
                } catch (error) {
                    console.error('SocialTask: Помилка API при перевірці завдання:', error);

                    // Логуємо використання мок-даних для верифікації
                    logMockDataUsage('verification', 'Помилка API при верифікації');

                    // Виконуємо симуляцію верифікації як запасний варіант
                    simulateVerification(task);
                }
            } else {
                // Логуємо використання мок-даних для верифікації
                const reason = !isApiAvailable() ? 'API недоступне' : 'Користувач не авторизований';
                logMockDataUsage('verification', reason);

                // Симулюємо верифікацію
                simulateVerification(task);
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
     * Симуляція верифікації завдання
     * @param {Object} task - Дані завдання
     */
    function simulateVerification(task) {
        // Затримка для імітації запиту
        setTimeout(() => {
            // Симулюємо успіх з ймовірністю 80%
            const isSuccess = Math.random() < 0.8;

            // Оновлюємо відображення завдання
            refreshTaskDisplay(task.id);

            if (isSuccess) {
                // Відображаємо успішне повідомлення
                showMessage('Завдання успішно виконано! (Демонстраційний режим)', 'success');

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
                showMessage('Не вдалося перевірити виконання завдання (Демонстраційний режим)', 'error');

                // Оновлюємо статус завдання
                taskStatuses.set(task.id, STATUS.ERROR);
            }

            // Оновлюємо статус завдання
            updateTaskStatus(task.id);
        }, 1500);
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
        taskElement.classList.remove('loading', 'completed', 'error', 'in-progress', 'ready-to-verify');

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
            case STATUS.READY_TO_VERIFY:
                taskElement.classList.add('ready-to-verify');
                break;
        }

        // ВИПРАВЛЕНО: Оновлюємо відображення кнопок залежно від статусу
        const actionElement = taskElement.querySelector('.task-action');
        if (actionElement) {
            // Якщо завдання виконано, показуємо лише мітку "Виконано"
            if (status === STATUS.COMPLETED) {
                actionElement.innerHTML = '<div class="completed-label" data-lang-key="earn.completed">Виконано</div>';
            }
            // Якщо елемент завантажується, показуємо індикатор завантаження
            else if (status === STATUS.LOADING) {
                if (!actionElement.querySelector('.loading-indicator')) {
                    actionElement.innerHTML = `
                        <div class="loading-indicator">
                            <div class="spinner"></div>
                            <span data-lang-key="earn.verifying">Перевірка...</span>
                        </div>
                    `;
                }
            }
            // ВИПРАВЛЕНО: Якщо готове до перевірки, показуємо тільки кнопку "Перевірити"
            else if (status === STATUS.READY_TO_VERIFY) {
                actionElement.innerHTML = `
                    <button class="action-button verify-button" data-action="verify" data-task-id="${taskId}" data-lang-key="earn.verify">Перевірити</button>
                `;
                // Відновлюємо обробники подій
                setupTaskEventListeners(taskElement, taskId);
            }
            // В інших випадках показуємо кнопку "Виконати"
            else {
                actionElement.innerHTML = `
                    <button class="action-button" data-action="start" data-task-id="${taskId}" data-lang-key="earn.start">Виконати</button>
                `;
                // Відновлюємо обробники подій
                setupTaskEventListeners(taskElement, taskId);
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
        // Перевіряємо наявність необхідних полів в завданні
        if (!task || !task.id) {
            console.error('SocialTask: Неможливо створити завдання без ID');
            return document.createElement('div');
        }

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

        // ВИПРАВЛЕНО: Визначаємо початковий статус задачі
        let initialStatus = STATUS.IDLE;
        if (progress) {
            switch (progress.status) {
                case 'completed':
                    initialStatus = STATUS.COMPLETED;
                    break;
                case 'started':
                    initialStatus = STATUS.READY_TO_VERIFY;  // Після старту показуємо кнопку перевірки
                    break;
                default:
                    initialStatus = STATUS.IDLE;
            }
        }

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

        // Додаємо дані action_url, якщо є
        if (task.action_url) {
            taskElement.dataset.actionUrl = task.action_url;
        }

        // Додаємо індикатор мок-даних, якщо потрібно
        if ((mockDataStatus.authentication || mockDataStatus.verification || mockDataStatus.socialNetworkData) &&
            window.TaskManager && window.TaskManager.isApiAvailable &&
            !window.TaskManager.isApiAvailable()) {
            taskElement.classList.add('mock-data-mode');
        }

        // ВИПРАВЛЕНО: Відображення кнопок залежно від статусу
        let buttonHtml = '';
        if (isCompleted) {
            buttonHtml = '<div class="completed-label" data-lang-key="earn.completed">Виконано</div>';
        } else if (initialStatus === STATUS.READY_TO_VERIFY) {
            buttonHtml = `<button class="action-button verify-button" data-action="verify" data-task-id="${task.id}" data-lang-key="earn.verify">Перевірити</button>`;
        } else {
            buttonHtml = `<button class="action-button" data-action="start" data-task-id="${task.id}" data-lang-key="earn.${task.action_type || 'start'}">${task.action_label || 'Виконати'}</button>`;
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
                ${buttonHtml}
            </div>
            ${(mockDataStatus.authentication || mockDataStatus.verification || mockDataStatus.socialNetworkData) ? 
              '<div class="mock-data-badge" title="Використовуються тестові дані">⚠️ Демо</div>' : ''}
        `;

        // Налаштовуємо обробники подій
        setupTaskEventListeners(taskElement, task.id);

        // Зберігаємо посилання на DOM елемент
        taskDomElements.set(task.id, taskElement);

        // Зберігаємо завдання в кеші рендерингу
        renderedTasksCache.set(cacheKey, taskElement.cloneNode(true));

        // Запам'ятовуємо поточний статус завдання
        taskStatuses.set(task.id, initialStatus);

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
                const container = taskElement.closest('.task-container') ||
                                 document.getElementById('social-tasks-container') ||
                                 document.getElementById('referral-tasks-container');

                if (container) {
                    // Знайшли елемент, пробуємо отримати дані з атрибутів
                    task = {
                        id: taskId,
                        type: 'social',
                        action_url: taskElement.dataset.actionUrl || '',
                        network: taskElement.dataset.network || null
                    };
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
            } else if (isApiAvailable() && isUserAuthenticated()) {
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
                    logMockDataUsage('socialNetworkData', 'Помилка API при оновленні відображення');
                    // Продовжуємо використовувати поточні дані завдання
                }
            } else {
                // Логуємо використання мок-даних для соц. мереж
                const reason = !isApiAvailable() ? 'API недоступне' : 'Користувач не авторизований';
                logMockDataUsage('socialNetworkData', `${reason} при оновленні відображення`);
            }

            // Якщо дані отримані, оновлюємо елемент
            if (taskData) {
                // Створюємо новий елемент завдання
                const newTaskElement = create(taskData, progressData);

                // Замінюємо старий елемент
                if (taskElement.parentNode) {
                    taskElement.parentNode.replaceChild(newTaskElement, taskElement);
                }

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

        // Якщо є WinixCore, використовуємо його
        if (window.WinixCore && window.WinixCore.updateLocalBalance) {
            window.WinixCore.updateLocalBalance(
                reward.type === 'coins' ? reward.amount : 0,
                'SocialTask',
                true
            );
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

        // ВИПРАВЛЕНО: Використовуємо SVG іконки з winix-icons.css
        let iconHTML = '';
        if (type === 'error') {
            iconHTML = '<span class="premium-notification-icon icon-error"></span>';
        } else if (type === 'success') {
            iconHTML = '<span class="premium-notification-icon icon-success"></span>';
        } else {
            iconHTML = '<span class="premium-notification-icon icon-info"></span>';
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

    /**
     * Діагностична функція для перевірки стану компонента
     * @returns {Object} - Об'єкт з діагностичною інформацією
     */
    function diagnostics() {
        return {
            initialized: moduleInitialized,
            tasksRegistered: taskDomElements.size,
            mockDataStatus,
            taskStatuses: Array.from(taskStatuses.entries()).reduce((acc, [id, status]) => {
                acc[id] = status;
                return acc;
            }, {}),
            renderQueueLength: renderQueue.length,
            authStatus: authenticationStatus,
            userId: safeGetUserId(),
            domReady: isDomReady()
        };
    }

    // ДОДАНО: Відкладена ініціалізація при завантаженні сторінки
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', function() {
            // Відкладаємо ініціалізацію, щоб дати час іншим модулям завантажитися
            setTimeout(init, 100);
        });
    } else {
        // Якщо DOM вже завантажено, ініціалізуємо з невеликою затримкою
        setTimeout(init, 100);
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
        checkAuthentication,
        // Для діагностики
        isUsingMockData: (type) => mockDataStatus[type] || false,
        mockDataStatus,
        diagnostics
    };
})();