/**
 * TaskIntegration - вдосконалений модуль для координації ініціалізації всіх компонентів системи завдань
 * Забезпечує:
 * - Узгоджену ініціалізацію модулів без конфліктів
 * - Виявлення та вирішення конфліктів з TaskProgressManager
 * - Автоматичне відновлення при помилках ініціалізації
 * - Діагностику проблем взаємодії між модулями
 */

window.TaskIntegration = (function() {
    // Стан ініціалізації модуля з розширеним відстеженням
    const state = {
        initialized: false,
        initStarted: false,
        moduleStates: {},
        failedModules: [],
        initializationTimestamps: {},
        lastError: null,
        initStartTime: 0,
        initEndTime: 0,
        taskManagerStatus: 'pending', // 'pending', 'initializing', 'ready', 'failed'
        taskProgressManagerStatus: 'pending', // 'pending', 'initializing', 'ready', 'failed'
        conflictResolutionApplied: false
    };

    // Конфігурація модуля з розширеними налаштуваннями
    const config = {
        enableLogging: true,
        detailedLogging: false, // Розширене логування для діагностики
        maxInitAttempts: 3,
        initTimeout: 10000, // 10 секунд максимум на ініціалізацію
        autoResolveConflicts: true, // Автоматично вирішувати конфлікти
        preferredManager: 'TaskProgressManager', // 'TaskProgressManager' або 'TaskManager' - який модуль має пріоритет
        safeMode: false, // Режим підвищеної надійності (повільніше, але надійніше)
        autoRetryOnFailure: true, // Автоматично повторювати ініціалізацію при помилках
        monitorDomMutations: true, // Відстежувати зміни DOM для динамічного оновлення
        fallbackUserMode: true    // ВИПРАВЛЕНО: Режим роботи з невідомим ID користувача
    };

    // Зберігаємо залежності модулів з пріоритетами
    const dependencies = {
        'UI.Animations': { deps: ['StorageUtils', 'TimeUtils'], priority: 1 },
        'UI.Notifications': { deps: [], priority: 1 },
        'UI.ProgressBar': { deps: [], priority: 2 },
        'TaskProgressManager': { deps: ['UI.Animations', 'UI.Notifications', 'UI.ProgressBar'], priority: 3 },
        'TaskRewards': { deps: [], priority: 3 },
        'TaskVerification': { deps: [], priority: 3 },
        'TaskManager': { deps: ['TaskProgressManager', 'TaskRewards', 'TaskVerification'], priority: 4 }
    };

    // Список критичних модулів, які обов'язково повинні ініціалізуватися
    const criticalModules = [
        'TaskManager',
        'TaskProgressManager',
        'TaskRewards',
        'TaskVerification'
    ];

    // Мапа інтерфейсів між модулями - для автоматичного вирішення конфліктів
    const moduleInterfaces = {
        'TaskProgressManager': {
            'provides': ['updateTaskProgress', 'getTaskProgress', 'resetTaskProgress'],
            'consumes': ['TaskRewards.updateBalance', 'UI.Animations.showProgressAnimation']
        },
        'TaskManager': {
            'provides': ['loadTasks', 'findTaskById', 'startTask', 'verifyTask'],
            'consumes': ['TaskProgressManager.updateTaskProgress', 'TaskRewards.updateBalance', 'TaskVerification.verifyTask']
        },
        'TaskVerification': {
            'provides': ['verifyTask', 'getTaskType', 'getTaskTargetValue'],
            'consumes': ['TaskRewards.updateBalance']
        },
        'TaskRewards': {
            'provides': ['updateBalance', 'showRewardAnimation', 'normalizeReward'],
            'consumes': []
        }
    };

    // Зберігаємо оригінальні реалізації функцій для відновлення при конфліктах
    const originalImplementations = {};

    /**
     * Безпечне отримання ID користувача з обробкою помилок
     * @returns {Object} Результат отримання ID користувача
     */
    function safeGetUserId() {
        try {
            // Спробуємо отримати ID користувача через звичайну функцію getUserId
            if (typeof window.getUserId === 'function') {
                const userId = window.getUserId();
                if (userId) {
                    return { success: true, userId: userId };
                }
            }

            // Спробуємо знайти ID в localStorage
            try {
                const storedId = localStorage.getItem('telegram_user_id');
                if (storedId && storedId !== 'undefined' && storedId !== 'null') {
                    return { success: true, userId: storedId, source: 'localStorage' };
                }
            } catch (e) {
                // Ігноруємо помилки localStorage
            }

            // Спробуємо отримати з DOM
            try {
                const userIdElement = document.getElementById('user-id');
                if (userIdElement && userIdElement.textContent) {
                    const userId = userIdElement.textContent.trim();
                    if (userId) {
                        return { success: true, userId: userId, source: 'DOM' };
                    }
                }
            } catch (e) {
                // Ігноруємо помилки DOM
            }

            // Спробуємо отримати з URL-параметрів
            try {
                const urlParams = new URLSearchParams(window.location.search);
                const id = urlParams.get('id') || urlParams.get('user_id') || urlParams.get('telegram_id');
                if (id) {
                    return { success: true, userId: id, source: 'URL' };
                }
            } catch (e) {
                // Ігноруємо помилки URL
            }

            // Не знайдено ID користувача
            return {
                success: false,
                error: 'ID користувача не знайдено',
                fallbackAvailable: config.fallbackUserMode,
                requiresAuth: true
            };
        } catch (error) {
            return {
                success: false,
                error: error.message || 'Помилка отримання ID користувача',
                originalError: error,
                fallbackAvailable: config.fallbackUserMode,
                requiresAuth: true
            };
        }
    }

    /**
     * Ініціалізація системи інтеграції з розширеною діагностикою
     * @param {Object} options - Опції ініціалізації
     */
    function init(options = {}) {
        // Якщо ініціалізація вже почалася, не запускаємо знову
        if (state.initStarted) {
            log('TaskIntegration: Ініціалізація вже розпочата');
            return;
        }

        // Оновлюємо конфігурацію користувацькими налаштуваннями
        Object.assign(config, options);

        state.initStarted = true;
        state.initStartTime = performance.now();

        log('TaskIntegration: Початок ініціалізації модулів системи завдань');

        // Налаштування обробників помилок для відстеження проблем
        setupErrorHandlers();

        // Перевіряємо, чи вже існує TaskProgressManager для вирішення конфліктів
        checkProgressManagerConflict();

        // Перевіряємо стан DOM
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', startInitializationProcess);
        } else {
            startInitializationProcess();
        }
    }

    /**
     * Налаштування розширених обробників помилок
     */
    function setupErrorHandlers() {
        // Глобальний обробник помилок для відстеження проблем в модулях
        if (!window.onerror) {
            window.onerror = function(message, source, lineno, colno, error) {
                if (source && (source.includes('task-manager') || source.includes('tasks/core'))) {
                    state.lastError = {
                        message,
                        source,
                        lineno,
                        colno,
                        error,
                        timestamp: Date.now()
                    };

                    logError('Виявлено помилку в модулі завдань:', error || message);

                    // Відправляємо подію про помилку
                    document.dispatchEvent(new CustomEvent('task-system-error', {
                        detail: state.lastError
                    }));

                    // Автоматичне відновлення при критичних помилках
                    if (config.autoRetryOnFailure && criticalModules.some(m => source.includes(m.toLowerCase()))) {
                        setTimeout(() => {
                            log('TaskIntegration: Спроба відновлення після помилки...');
                            recoverFailedModules();
                        }, 1000);
                    }
                }

                // Не блокуємо стандартну обробку помилок
                return false;
            };
        }

        // ВИПРАВЛЕНО: Покращений обробник неопрацьованих промісів
        window.addEventListener('unhandledrejection', function(event) {
            // Якщо помилка пов'язана з ID користувача
            if (event.reason && (event.reason.message === 'ID користувача не знайдено' ||
                event.reason.message === 'Error: ID користувача не знайдено')) {

                // Запобігаємо поширенню помилки в консоль
                event.preventDefault();

                logError('Оброблено помилку з ID користувача:', event.reason.message);

                // Відправляємо подію про помилку авторизації
                document.dispatchEvent(new CustomEvent('auth-required', {
                    detail: {
                        message: 'Для доступу до цієї функції необхідно авторизуватися',
                        source: event.reason.stack || 'unknown'
                    }
                }));

                return;
            }

            // Обробка інших помилок у модулях завдань
            if (event.reason && event.reason.stack &&
                (event.reason.stack.includes('task-manager') || event.reason.stack.includes('tasks/core'))) {

                state.lastError = {
                    message: event.reason.message,
                    error: event.reason,
                    stack: event.reason.stack,
                    timestamp: Date.now(),
                    type: 'promise'
                };

                logError('Невідловлена помилка промісу в модулі завдань:', event.reason);

                // Відправляємо подію про помилку
                document.dispatchEvent(new CustomEvent('task-system-promise-error', {
                    detail: state.lastError
                }));
            }
        });
    }

    /**
     * Перевірка конфлікту з TaskProgressManager
     */
    function checkProgressManagerConflict() {
        // Перевіряємо існування обох модулів
        const hasTaskManager = typeof window.TaskManager !== 'undefined';
        const hasProgressManager = typeof window.TaskProgressManager !== 'undefined';

        // Якщо обидва модулі існують, перевіряємо наявність конфлікту
        if (hasTaskManager && hasProgressManager) {
            log('TaskIntegration: Виявлено обидва модулі (TaskManager і TaskProgressManager)');

            // Перевіряємо, чи TaskProgressManager вже ініціалізовано
            const progressManagerInitialized = window.TaskProgressManager.initialized !== false;

            if (progressManagerInitialized) {
                log('TaskIntegration: TaskProgressManager вже ініціалізовано, налаштовуємо інтеграцію');
                state.taskProgressManagerStatus = 'ready';

                // Якщо налаштовано автоматичне вирішення конфліктів
                if (config.autoResolveConflicts) {
                    resolveManagerConflicts();
                }
            }
        }
    }

    /**
     * Вирішення конфліктів між TaskManager та TaskProgressManager
     */
    function resolveManagerConflicts() {
        if (state.conflictResolutionApplied) return;

        log('TaskIntegration: Застосування стратегії вирішення конфліктів між модулями...');

        // Визначаємо пріоритетний модуль на основі конфігурації
        const primaryManager = config.preferredManager === 'TaskProgressManager' ?
            window.TaskProgressManager : window.TaskManager;

        const secondaryManager = config.preferredManager === 'TaskProgressManager' ?
            window.TaskManager : window.TaskProgressManager;

        // Зберігаємо оригінальні реалізації для відновлення
        if (primaryManager && typeof primaryManager.updateTaskProgress === 'function') {
            originalImplementations.primaryUpdateTaskProgress = primaryManager.updateTaskProgress;
        }

        if (secondaryManager && typeof secondaryManager.updateTaskProgress === 'function') {
            originalImplementations.secondaryUpdateTaskProgress = secondaryManager.updateTaskProgress;
        }

        // TaskProgressManager має пріоритет для оновлення прогресу
        if (window.TaskProgressManager && window.TaskManager) {
            // Переконуємося, що один метод updateTaskProgress делегується іншому
            // для запобігання дублюванню дій
            if (window.TaskManager.updateTaskProgress !== window.TaskProgressManager.updateTaskProgress) {
                const originalTaskManagerUpdate = window.TaskManager.updateTaskProgress;

                // Перевизначаємо метод у TaskManager, щоб він делегував виклик до TaskProgressManager
                window.TaskManager.updateTaskProgress = function(taskId, progressData) {
                    // Логуємо делегування у режимі детального логування
                    if (config.detailedLogging) {
                        log(`TaskIntegration: Делегування updateTaskProgress від TaskManager до TaskProgressManager для ${taskId}`);
                    }

                    try {
                        // Викликаємо метод TaskProgressManager
                        const result = window.TaskProgressManager.updateTaskProgress(taskId, progressData);

                        // В безпечному режимі також викликаємо оригінальний метод TaskManager
                        if (config.safeMode) {
                            try {
                                originalTaskManagerUpdate.call(window.TaskManager, taskId, progressData);
                            } catch (e) {
                                // Ігноруємо помилки в безпечному режимі
                            }
                        }

                        return result;
                    } catch (error) {
                        logError('Помилка при делегуванні updateTaskProgress:', error);

                        // У випадку помилки, використовуємо оригінальний метод TaskManager
                        return originalTaskManagerUpdate.call(window.TaskManager, taskId, progressData);
                    }
                };

                log('TaskIntegration: Налаштовано делегування updateTaskProgress між модулями');
            }

            // Узгодження даних завдань між модулями
            synchronizeTaskData();
        }

        state.conflictResolutionApplied = true;
    }

    /**
     * Синхронізація даних завдань між модулями
     */
    function synchronizeTaskData() {
        // Синхронізуємо константи між модулями
        if (window.TaskProgressManager && window.TaskProgressManager.REWARD_TYPES &&
            window.TaskManager && window.TaskManager.REWARD_TYPES) {

            // Створюємо об'єднані типи винагород
            const mergedRewardTypes = {
                ...window.TaskProgressManager.REWARD_TYPES,
                ...window.TaskManager.REWARD_TYPES
            };

            // Встановлюємо узгоджені типи винагород для обох модулів
            window.TaskProgressManager.REWARD_TYPES = mergedRewardTypes;
            window.TaskManager.REWARD_TYPES = mergedRewardTypes;

            log('TaskIntegration: Типи винагород синхронізовано між модулями');
        }

        // Синхронізуємо getTaskProgress, якщо це потрібно
        if (window.TaskProgressManager && typeof window.TaskProgressManager.getTaskProgress === 'function' &&
            window.TaskManager && typeof window.TaskManager.getTaskProgress !== 'function') {

            window.TaskManager.getTaskProgress = function(taskId) {
                return window.TaskProgressManager.getTaskProgress(taskId);
            };

            log('TaskIntegration: Метод getTaskProgress пропагований з TaskProgressManager до TaskManager');
        }
    }

    /**
     * Запуск процесу ініціалізації модулів
     */
    function startInitializationProcess() {
        // Запускаємо ініціалізацію модулів у потрібному порядку
        initModulesInOrder();

        // Встановлюємо таймаут для перевірки стану ініціалізації
        setTimeout(checkInitializationStatus, 500);

        // Встановлюємо загальний таймаут ініціалізації
        setTimeout(function() {
            if (!state.initialized) {
                log('TaskIntegration: Перевищено час очікування ініціалізації. Перевірка стану...');
                finalizeInitialization(true);
            }
        }, config.initTimeout);
    }

    /**
     * Ініціалізація модулів у правильному порядку на основі залежностей
     */
    function initModulesInOrder() {
        try {
            log('TaskIntegration: Початок ініціалізації модулів у пріоритетному порядку');

            // Отримуємо список модулів, відсортований за пріоритетом
            const modulesToInit = getSortedModules();

            // Ініціалізуємо модулі відповідно до їх пріоритету
            for (const moduleName of modulesToInit) {
                initializeModule(moduleName);
            }
        } catch (error) {
            logError('Помилка при ініціалізації модулів:', error);
        }
    }

    /**
     * Отримання відсортованого списку модулів за пріоритетом
     * @returns {Array} Відсортований список модулів
     */
    function getSortedModules() {
        // Створюємо список модулів з пріоритетами
        const modulesList = Object.keys(dependencies).map(name => ({
            name,
            priority: dependencies[name].priority || 999,
            deps: dependencies[name].deps || []
        }));

        // Сортуємо за пріоритетом (нижчий пріоритет = раніше ініціалізується)
        return modulesList
            .sort((a, b) => a.priority - b.priority)
            .map(m => m.name);
    }

    /**
     * Ініціалізація конкретного модуля з перевіркою залежностей
     * @param {string} moduleName - Назва модуля
     * @returns {boolean} Результат ініціалізації
     */
    function initializeModule(moduleName) {
        // Якщо модуль вже ініціалізовано, пропускаємо
        if (state.moduleStates[moduleName] === 'ready') {
            return true;
        }

        // Відзначаємо, що ініціалізація почалася
        state.moduleStates[moduleName] = 'initializing';
        state.initializationTimestamps[moduleName] = performance.now();

        // Спеціальна обробка для TaskProgressManager
        if (moduleName === 'TaskProgressManager') {
            state.taskProgressManagerStatus = 'initializing';
        }

        // Спеціальна обробка для TaskManager
        if (moduleName === 'TaskManager') {
            state.taskManagerStatus = 'initializing';
        }

        try {
            // Отримуємо посилання на модуль
            const moduleObj = getModuleObject(moduleName);

            // Якщо модуль не існує, позначаємо як невдалий
            if (!moduleObj) {
                state.moduleStates[moduleName] = 'not_found';
                state.failedModules.push(moduleName);
                return false;
            }

            // Перевіряємо, чи всі залежності ініціалізовані
            const dependenciesReady = checkDependenciesReady(moduleName);

            if (!dependenciesReady) {
                if (config.detailedLogging) {
                    log(`TaskIntegration: Очікуємо залежності для модуля ${moduleName}`);
                }

                // Якщо не всі залежності готові, відкладаємо ініціалізацію
                setTimeout(() => {
                    if (state.moduleStates[moduleName] !== 'ready') {
                        initializeModule(moduleName);
                    }
                }, 100);

                return false;
            }

            // Якщо у модуля є метод init, викликаємо його
            if (typeof moduleObj.init === 'function') {
                moduleObj.init();
                state.moduleStates[moduleName] = 'ready';

                // Оновлюємо статус для спеціальних модулів
                if (moduleName === 'TaskProgressManager') {
                    state.taskProgressManagerStatus = 'ready';
                } else if (moduleName === 'TaskManager') {
                    state.taskManagerStatus = 'ready';
                }

                log(`TaskIntegration: Модуль ${moduleName} успішно ініціалізовано`);

                // Вирішуємо конфлікти після ініціалізації критичних модулів
                if ((moduleName === 'TaskProgressManager' || moduleName === 'TaskManager') &&
                    state.taskProgressManagerStatus === 'ready' &&
                    state.taskManagerStatus === 'ready' &&
                    config.autoResolveConflicts &&
                    !state.conflictResolutionApplied) {

                    resolveManagerConflicts();
                }

                return true;
            } else {
                // Якщо немає методу init, вважаємо що модуль вже ініціалізовано
                state.moduleStates[moduleName] = 'ready';
                log(`TaskIntegration: Модуль ${moduleName} не має методу init, вважаємо його готовим`);
                return true;
            }
        } catch (error) {
            logError(`Помилка при ініціалізації модуля ${moduleName}:`, error);

            state.moduleStates[moduleName] = 'failed';
            state.failedModules.push(moduleName);

            // Оновлюємо статус для спеціальних модулів
            if (moduleName === 'TaskProgressManager') {
                state.taskProgressManagerStatus = 'failed';
            } else if (moduleName === 'TaskManager') {
                state.taskManagerStatus = 'failed';
            }

            // Створюємо інформативну подію про помилку
            document.dispatchEvent(new CustomEvent('module-initialization-error', {
                detail: {
                    module: moduleName,
                    error: error,
                    timestamp: Date.now()
                }
            }));

            return false;
        }
    }

    /**
     * Отримання об'єкта модуля за його назвою
     * @param {string} moduleName - Назва модуля
     * @returns {Object|null} Об'єкт модуля або null
     */
    function getModuleObject(moduleName) {
        // Обробка спеціальних випадків для вкладених модулів
        if (moduleName.includes('.')) {
            const parts = moduleName.split('.');
            let obj = window;

            for (const part of parts) {
                if (obj && obj[part]) {
                    obj = obj[part];
                } else {
                    return null;
                }
            }

            return obj;
        }

        // Звичайний випадок
        return window[moduleName];
    }

    /**
     * Перевірка готовності всіх залежностей модуля
     * @param {string} moduleName - Назва модуля
     * @returns {boolean} Чи всі залежності готові
     */
    function checkDependenciesReady(moduleName) {
        // Отримуємо список залежностей
        const deps = dependencies[moduleName]?.deps || [];

        // Якщо немає залежностей, повертаємо true
        if (deps.length === 0) {
            return true;
        }

        // Перевіряємо статус кожної залежності
        return deps.every(dep => state.moduleStates[dep] === 'ready');
    }

    /**
     * Перевірка статусу ініціалізації всіх модулів
     */
    function checkInitializationStatus() {
        // Отримуємо список критичних модулів, які не ініціалізовано
        const pendingCriticalModules = criticalModules.filter(
            m => state.moduleStates[m] !== 'ready' && state.moduleStates[m] !== 'not_found'
        );

        if (pendingCriticalModules.length === 0) {
            // Всі критичні модулі ініціалізовано або недоступні
            finalizeInitialization();
        } else if (pendingCriticalModules.length > 0) {
            // Ще є модулі, які чекають ініціалізації
            log(`TaskIntegration: Очікуємо ініціалізації модулів: ${pendingCriticalModules.join(', ')}`);

            // Повторюємо перевірку через 300мс
            setTimeout(checkInitializationStatus, 300);
        }
    }

    /**
     * Завершення процесу ініціалізації
     * @param {boolean} timedOut - Чи відбувся таймаут
     */
    function finalizeInitialization(timedOut = false) {
        // Якщо вже ініціалізовано, не виконуємо повторно
        if (state.initialized) return;

        // Визначаємо успішність ініціалізації
        const allCriticalReady = criticalModules.every(
            m => state.moduleStates[m] === 'ready' || state.moduleStates[m] === 'not_found'
        );

        // Фіксуємо час завершення
        state.initEndTime = performance.now();
        const initDuration = state.initEndTime - state.initStartTime;

        state.initialized = true;

        // Запускаємо додаткові операції після ініціалізації
        if (allCriticalReady) {
            log(`TaskIntegration: Всі критичні модулі успішно ініціалізовано за ${Math.round(initDuration)}мс`);

            // Застосовуємо додаткові налаштування якщо потрібно
            if (config.autoResolveConflicts && !state.conflictResolutionApplied) {
                resolveManagerConflicts();
            }

            // Виправляємо проблеми з отриманням ID користувача у всіх модулях
            fixUserIdIssues();

            // Відправляємо подію про успішну ініціалізацію
            document.dispatchEvent(new CustomEvent('task-system-initialized', {
                detail: {
                    modules: Object.keys(state.moduleStates).filter(m => state.moduleStates[m] === 'ready'),
                    initTime: Math.round(initDuration),
                    timestamp: Date.now()
                }
            }));
        } else {
            // Якщо є невдалі критичні модулі, спробуємо їх відновити
            const failedCritical = criticalModules.filter(m => state.moduleStates[m] === 'failed');

            if (failedCritical.length > 0) {
                logError(`TaskIntegration: Не вдалося ініціалізувати критичні модулі: ${failedCritical.join(', ')}`);

                // В автоматичному режимі спробуємо відновити
                if (config.autoRetryOnFailure) {
                    log('TaskIntegration: Спроба відновлення невдалих модулів...');
                    recoverFailedModules();
                }
            }

            // Якщо досягнуто таймаут ініціалізації
            if (timedOut) {
                log(`TaskIntegration: Ініціалізація завершена по таймауту за ${Math.round(initDuration)}мс`);

                // Відправляємо подію про часткову ініціалізацію
                document.dispatchEvent(new CustomEvent('task-system-partial-init', {
                    detail: {
                        modules: Object.keys(state.moduleStates).filter(m => state.moduleStates[m] === 'ready'),
                        failed: Object.keys(state.moduleStates).filter(m => state.moduleStates[m] === 'failed'),
                        notFound: Object.keys(state.moduleStates).filter(m => state.moduleStates[m] === 'not_found'),
                        initTime: Math.round(initDuration),
                        timestamp: Date.now(),
                        timedOut: true
                    }
                }));
            }
        }
    }

    /**
     * ВИПРАВЛЕНО: Виправляє проблеми з ID користувача у всіх модулях
     */
    function fixUserIdIssues() {
        try {
            // Виправляємо функцію connectToExternalService, якщо вона існує
            if (typeof window.connectToExternalService === 'function') {
                const originalConnectFn = window.connectToExternalService;
                window.connectToExternalService = async function(serviceType) {
                    try {
                        // Використовуємо безпечне отримання ID
                        const userIdResult = safeGetUserId();
                        if (!userIdResult.success) {
                            return {
                                status: 'error',
                                message: 'Необхідно авторизуватися для підключення до зовнішнього сервісу',
                                code: 'NO_USER_ID'
                            };
                        }

                        // Викликаємо оригінальну функцію з отриманим ID
                        return await originalConnectFn(serviceType);
                    } catch (error) {
                        // Не даємо помилці пробитися назовні
                        console.error('Integration: Помилка підключення до зовнішнього сервісу:', error);
                        return {
                            status: 'error',
                            message: 'Помилка підключення: ' + (error.message || 'Невідома помилка'),
                            code: 'CONNECTION_ERROR'
                        };
                    }
                };
                log('TaskIntegration: Виправлено функцію connectToExternalService');
            }

            // Можливі інші виправлення для інших функцій, які викликають помилки з ID...

        } catch (error) {
            logError('Помилка при виправленні проблем з ID користувача:', error);
        }
    }

    /**
     * Спроба відновлення невдалих модулів
     */
    function recoverFailedModules() {
        // Отримуємо список невдалих критичних модулів
        const failedCritical = criticalModules.filter(m => state.moduleStates[m] === 'failed');

        if (failedCritical.length === 0) return;

        log(`TaskIntegration: Спроба відновлення модулів: ${failedCritical.join(', ')}`);

        // Спробуємо ще раз ініціалізувати кожен модуль
        for (const moduleName of failedCritical) {
            try {
                // Скидаємо стан модуля
                state.moduleStates[moduleName] = 'pending';

                // Видаляємо з списку невдалих
                const index = state.failedModules.indexOf(moduleName);
                if (index > -1) {
                    state.failedModules.splice(index, 1);
                }

                // Спробуємо ініціалізувати знову
                initializeModule(moduleName);
            } catch (error) {
                logError(`Помилка при спробі відновлення модуля ${moduleName}:`, error);
            }
        }
    }

    /**
     * Загальна діагностика системи завдань
     * @returns {Object} Діагностична інформація
     */
    function diagnoseTaskSystem() {
        const results = {
            status: state.initialized ? 'initialized' : 'initializing',
            moduleStates: { ...state.moduleStates },
            failedModules: [...state.failedModules],
            initTime: state.initEndTime - state.initStartTime,
            lastError: state.lastError,
            conflicts: {
                detected: state.taskProgressManagerStatus === 'ready' && state.taskManagerStatus === 'ready',
                resolved: state.conflictResolutionApplied
            },
            apiStatus: checkApiAvailability(),
            // ДОДАНО: Перевірка ID користувача
            userIdCheck: safeGetUserId()
        };

        // Додаємо інформацію про доступні компоненти та їх версії
        results.components = getComponentVersions();

        // Виконуємо базову перевірку API
        testApiConnections(results);

        return results;
    }

    /**
     * Перевірка доступності API та його модулів
     * @returns {Object} Стан API
     */
    function checkApiAvailability() {
        return {
            apiModuleLoaded: typeof window.API !== 'undefined',
            winixApiLoaded: typeof window.WinixAPI !== 'undefined',
            apiRequestAvailable: typeof window.apiRequest === 'function',
            apiPathsAvailable: typeof window.API_PATHS !== 'undefined',
            isUserAuthenticated: typeof window.getUserId === 'function' ? !!window.getUserId() : false
        };
    }

    /**
     * Отримання інформації про версії компонентів
     * @returns {Object} Версії компонентів
     */
    function getComponentVersions() {
        const versions = {};

        // Перевіряємо основні модулі на наявність версій
        const componentsToCheck = [
            'TaskManager', 'TaskProgressManager', 'TaskVerification',
            'TaskRewards', 'WinixAPI', 'Core'
        ];

        for (const component of componentsToCheck) {
            if (window[component]) {
                versions[component] = window[component].VERSION ||
                                     window[component].version ||
                                     'unknown';
            }
        }

        return versions;
    }

    /**
     * Тестування з'єднання з API для діагностики
     * @param {Object} results - Об'єкт результатів діагностики
     */
    function testApiConnections(results) {
        try {
            // Додаємо заготовку для результатів тестування
            results.apiTests = {
                status: 'pending',
                details: {}
            };

            // Асинхронно виконуємо тести
            Promise.resolve().then(async () => {
                // Перевіряємо доступність API
                if (typeof window.API === 'undefined') {
                    results.apiTests.status = 'api_not_available';
                    return;
                }

                // Перевіряємо базовий URL API
                let apiBaseUrl = '';

                if (window.WinixAPI && window.WinixAPI.config && window.WinixAPI.config.baseUrl) {
                    apiBaseUrl = window.WinixAPI.config.baseUrl;
                } else if (window.API_BASE_URL) {
                    apiBaseUrl = window.API_BASE_URL;
                }

                results.apiTests.details.baseUrl = apiBaseUrl;

                // Пробуємо виконати найпростіший запит
                try {
                    if (window.TaskVerification && typeof window.TaskVerification.testApiConnection === 'function') {
                        const apiTest = await window.TaskVerification.testApiConnection();
                        results.apiTests.details.connectionTest = apiTest;
                        results.apiTests.status = apiTest.success ? 'connected' : 'connection_failed';
                    } else {
                        results.apiTests.status = 'test_not_available';
                    }
                } catch (error) {
                    results.apiTests.details.testError = {
                        message: error.message,
                        name: error.name
                    };
                    results.apiTests.status = 'test_error';
                }

                // Оновлюємо діагностичні дані
                document.dispatchEvent(new CustomEvent('task-system-diagnostics-updated', {
                    detail: results
                }));
            });
        } catch (error) {
            results.apiTests = {
                status: 'error',
                error: error.message
            };
        }
    }

    /**
     * Виведення логів з перевіркою налаштувань
     * @param  {...any} args - Аргументи для логування
     */
    function log(...args) {
        if (config.enableLogging) {
            console.log(...args);
        }
    }

    /**
     * Виведення помилок з додатковою інформацією
     * @param  {...any} args - Аргументи для логування помилок
     */
    function logError(...args) {
        console.error(...args);

        // В детальному режимі додаємо стек виклику
        if (config.detailedLogging) {
            console.trace('Стек виклику:');
        }
    }

    /**
     * Скидання стану інтеграції для повторної ініціалізації
     */
    function reset() {
        // Скидаємо основні прапорці стану
        state.initialized = false;
        state.initStarted = false;
        state.failedModules = [];
        state.moduleStates = {};
        state.initStartTime = 0;
        state.initEndTime = 0;
        state.conflictResolutionApplied = false;

        // Скидаємо стани ключових модулів
        state.taskManagerStatus = 'pending';
        state.taskProgressManagerStatus = 'pending';

        log('TaskIntegration: Стан інтеграції скинуто');

        return true;
    }

    // Ініціалізуємо модуль при завантаженні скрипту, якщо вказано в конфігурації
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Публічний API
    return {
        init,
        diagnoseTaskSystem,
        reset,
        resolveManagerConflicts,
        getModuleState: () => ({ ...state.moduleStates }),
        isInitialized: () => state.initialized,
        getInitializationState: () => ({
            initialized: state.initialized,
            failedModules: [...state.failedModules],
            initTime: state.initEndTime - state.initStartTime
        }),
        // ДОДАНО: Додали нову функцію для безпечного отримання ID користувача
        safeGetUserId
    };
})();