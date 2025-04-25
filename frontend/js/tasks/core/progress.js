/**
 * TaskProgressManager - оптимізований модуль для керування прогресом завдань
 * Перероблено з оригінального TaskIntegration для уникнення конфлікту імен
 * Відповідає за:
 * - Відстеження прогресу виконання завдань
 * - Запобігання дублюванню винагород
 * - Коректну комунікацію між модулями через події
 */

window.TaskProgressManager = (function() {
    // Типи винагород
    const REWARD_TYPES = {
        TOKENS: 'tokens',
        COINS: 'coins'
    };

    // Список модулів, з якими взаємодіє прогрес
    const modules = [
        { name: 'UI.Animations', object: () => window.UI && window.UI.Animations, state: false, priority: 1 },
        { name: 'UI.Notifications', object: () => window.UI && window.UI.Notifications, state: false, priority: 1 },
        { name: 'UI.ProgressBar', object: () => window.UI && window.UI.ProgressBar, state: false, priority: 2 },
        { name: 'UI.Countdown', object: () => window.UI && window.UI.Countdown, state: false, priority: 2 },
        { name: 'TimeUtils', object: () => window.TimeUtils, state: false, priority: 3 },
        { name: 'Formatters', object: () => window.Formatters, state: false, priority: 3 },
        { name: 'Validators', object: () => window.Validators, state: false, priority: 3 },
        { name: 'StorageUtils', object: () => window.StorageUtils, state: false, priority: 3 },
        { name: 'TaskProgress', object: () => window.TaskProgress, state: false, priority: 4 },
        { name: 'TaskRewards', object: () => window.TaskRewards, state: false, priority: 4 },
        { name: 'TaskVerification', object: () => window.TaskVerification, state: false, priority: 4 },
        { name: 'DailyBonus', object: () => window.DailyBonus, state: false, priority: 5 },
        { name: 'Leaderboard', object: () => window.Leaderboard, state: false, priority: 5 },
        { name: 'SocialTask', object: () => window.SocialTask, state: false, priority: 5 },
        { name: 'LimitedTask', object: () => window.LimitedTask, state: false, priority: 5 },
        { name: 'PartnerTask', object: () => window.PartnerTask, state: false, priority: 5 },
        { name: 'TaskManager', object: () => window.TaskManager, state: false, priority: 6 }
    ];

    // Конфігурація модуля
    const config = {
        enableLogging: true,
        useEnhancedAnimations: true,
        enforceInitOrder: true,
        preventDuplicateEvents: true,
        preventRewardDuplication: true,
        timeout: 10000 // 10 секунд максимум для ініціалізації
    };

    // Стан модуля
    const state = {
        initialized: false,
        startTime: 0,
        eventsRegistered: {},
        initAttempts: 0,
        maxInitAttempts: 3,
        isPageLoaded: false,
        lastRewards: {}, // Зберігаємо останні нагороди, щоб запобігти дублюванню
        lastRewardTime: {},
        userProgress: {} // Локальне сховище для прогресу
    };

    // Реєстр подій для уникнення дублювання
    const eventRegistry = {};

    /**
     * Ініціалізація системи керування прогресом
     * @param {Object} options - Налаштування
     */
    function init(options = {}) {
        if (state.initialized) return;

        // Об'єднуємо налаштування
        Object.assign(config, options);

        // Записуємо час початку ініціалізації
        state.startTime = performance.now();

        // Логуємо початок ініціалізації
        log('TaskProgressManager: Початок ініціалізації системи керування прогресом');

        // Додаємо слухачі події завантаження сторінки
        document.addEventListener('DOMContentLoaded', () => {
            state.isPageLoaded = true;
            initializeModules();
        });

        // Якщо DOM вже завантажено, починаємо ініціалізацію
        if (document.readyState === 'interactive' || document.readyState === 'complete') {
            state.isPageLoaded = true;
            initializeModules();
        }

        // Перевірка на наявність TaskIntegration і уникнення конфліктів
        if (window.TaskIntegration) {
            log('TaskProgressManager: Виявлено TaskIntegration, налаштовуємо взаємодію');
        }

        // Завантажуємо збережений прогрес
        loadSavedProgress();

        // Підписуємося на події
        subscribeToEvents();

        // Налаштування взаємодії з компонентами
        setupComponentsCompatibility();

        // Встановлюємо стан ініціалізації
        state.initialized = true;
    }

    /**
     * Ініціалізація всіх модулів у правильному порядку
     */
    function initializeModules() {
        if (!state.isPageLoaded) return;

        // Збільшуємо лічильник спроб
        state.initAttempts++;

        log(`TaskProgressManager: Спроба ініціалізації модулів (${state.initAttempts}/${state.maxInitAttempts})`);

        // Сортуємо модулі за пріоритетом (нижче число - вищий пріоритет)
        const sortedModules = [...modules].sort((a, b) => a.priority - b.priority);

        // Ініціалізуємо модулі у правильному порядку
        sortedModules.forEach(module => {
            initializeModule(module);
        });

        // Перевіряємо чи всі модулі ініціалізовано
        const allInitialized = modules.every(module => module.state);
        const mandatoryInitialized = modules
            .filter(module => [
                'TaskProgress', 'TaskVerification', 'TaskRewards', 'TaskManager'
            ].includes(module.name))
            .every(module => module.state);

        // Якщо не всі обов'язкові модулі ініціалізовано і є ще спроби
        if (!mandatoryInitialized && state.initAttempts < state.maxInitAttempts) {
            // Плануємо повторну спробу
            setTimeout(initializeModules, 500);
            return;
        }

        // Перевіряємо чи закінчився час очікування
        const elapsedTime = performance.now() - state.startTime;
        if (elapsedTime >= config.timeout) {
            log('TaskProgressManager: Досягнуто ліміт часу ініціалізації. Продовжуємо з доступними модулями.');
        }

        // Відправляємо подію про завершення ініціалізації
        dispatchEvent('task-progress-manager-initialized', {
            modulesInitialized: modules.filter(m => m.state).map(m => m.name),
            missingModules: modules.filter(m => !m.state).map(m => m.name),
            elapsedTime
        });

        // Логуємо результат ініціалізації
        log(`TaskProgressManager: Ініціалізація завершена за ${Math.round(elapsedTime)}мс. Ініціалізовано ${modules.filter(m => m.state).length}/${modules.length} модулів.`);

        // Виконуємо фінальні налаштування
        if (config.useEnhancedAnimations) {
            applyEnhancedAnimations();
        }

        // Якщо всі модулі ініціалізовано успішно
        if (allInitialized) {
            log('TaskProgressManager: Всі модулі успішно ініціалізовано');
        } else {
            log('TaskProgressManager: Деякі модулі не вдалося ініціалізувати', modules.filter(m => !m.state).map(m => m.name));
        }
    }

    /**
     * Ініціалізація конкретного модуля
     * @param {Object} module - Інформація про модуль
     */
    function initializeModule(module) {
        // Якщо модуль вже ініціалізовано
        if (module.state) return;

        // Отримуємо об'єкт модуля
        const moduleObj = module.object();

        // Якщо модуль недоступний
        if (!moduleObj) {
            return;
        }

        // Якщо у модуля є метод init, викликаємо його
        if (typeof moduleObj.init === 'function') {
            try {
                moduleObj.init();
                module.state = true;
                log(`TaskProgressManager: Ініціалізовано модуль ${module.name}`);
            } catch (error) {
                log(`TaskProgressManager: Помилка при ініціалізації модуля ${module.name}:`, error);
            }
        } else {
            // Якщо немає методу init, вважаємо що модуль вже ініціалізовано
            module.state = true;
            log(`TaskProgressManager: Модуль ${module.name} не має методу init, вважаємо його ініціалізованим`);
        }
    }

    /**
     * Завантаження збереженого прогресу користувача
     */
    function loadSavedProgress() {
        try {
            // Спочатку пробуємо отримати з localStorage
            const savedProgress = localStorage.getItem('winix_task_progress');
            if (savedProgress) {
                state.userProgress = JSON.parse(savedProgress);
                log('TaskProgressManager: Завантажено збережений прогрес користувача');
            } else {
                state.userProgress = {};
            }
        } catch (error) {
            log('TaskProgressManager: Помилка при завантаженні збереженого прогресу:', error);
            state.userProgress = {};
        }
    }

    /**
     * Збереження прогресу користувача
     */
    function saveProgress() {
        try {
            localStorage.setItem('winix_task_progress', JSON.stringify(state.userProgress));
        } catch (error) {
            log('TaskProgressManager: Помилка при збереженні прогресу:', error);
        }
    }

    /**
     * Вирішення конфліктів з типами винагород
     */
    function resolveRewardTypeConflict() {
        // Перевіряємо наявність TaskRewards
        if (window.TaskRewards && window.TaskRewards.REWARD_TYPES) {
            // Синхронізуємо типи винагород між модулями
            if (window.TaskManager) {
                window.TaskManager.REWARD_TYPES = window.TaskRewards.REWARD_TYPES;
            }

            if (window.TaskVerification) {
                window.TaskVerification.REWARD_TYPES = window.TaskRewards.REWARD_TYPES;
            }

            log('TaskProgressManager: Синхронізовано типи винагород між модулями');
        }
    }

    /**
     * Налаштування сумісності між компонентами
     */
    function setupComponentsCompatibility() {
        // Покращений алгоритм делегування
        setupCentralizedProgressHandling();

        // Вирішення конфлікту з типами винагород
        resolveRewardTypeConflict();

        // Інтеграція з TaskManager, якщо він доступний
        integrateWithTaskManager();
    }

    /**
     * Інтеграція з TaskManager
     */
    function integrateWithTaskManager() {
        if (!window.TaskManager) return;

        // Додаємо метод для отримання прогресу завдань
        if (!window.TaskManager.getTaskProgress) {
            window.TaskManager.getTaskProgress = function(taskId) {
                return getTaskProgress(taskId);
            };
        }

        // Додаємо метод для оновлення прогресу завдання
        if (!window.TaskManager.updateTaskProgress) {
            window.TaskManager.updateTaskProgress = function(taskId, progressData) {
                updateTaskProgress(taskId, progressData);
            };
        }

        log('TaskProgressManager: Інтегровано з TaskManager');
    }

    /**
     * Налаштування централізованої обробки прогресу
     */
    function setupCentralizedProgressHandling() {
        // Перевіряємо наявність TaskProgress
        if (!window.TaskProgress) return;

        // Якщо модуль прогресу має власний метод отримання прогресу,
        // синхронізуємо дані між модулями
        if (typeof window.TaskProgress.getUserProgress === 'function') {
            const externalProgress = window.TaskProgress.getUserProgress();
            if (externalProgress && typeof externalProgress === 'object') {
                // Об'єднуємо з нашим прогресом
                Object.assign(state.userProgress, externalProgress);
                saveProgress();
            }
        }

        // Перевизначаємо метод оновлення прогресу
        if (typeof window.TaskProgress.updateTaskProgress === 'function') {
            const originalUpdateProgress = window.TaskProgress.updateTaskProgress;

            window.TaskProgress.updateTaskProgress = function(taskId, progressData) {
                // Оновлюємо локальний прогрес
                updateTaskProgress(taskId, progressData);

                // Викликаємо оригінальний метод
                return originalUpdateProgress.call(window.TaskProgress, taskId, progressData);
            };
        } else {
            // Якщо метод не існує, додаємо його
            window.TaskProgress.updateTaskProgress = updateTaskProgress;
        }

        // Додаємо метод отримання прогресу
        if (typeof window.TaskProgress.getTaskProgress !== 'function') {
            window.TaskProgress.getTaskProgress = getTaskProgress;
        }

        // Додаємо метод отримання всього прогресу
        if (typeof window.TaskProgress.getUserProgress !== 'function') {
            window.TaskProgress.getUserProgress = getUserProgress;
        }

        log('TaskProgressManager: Налаштовано централізоване керування прогресом');
    }

    /**
     * Застосування покращених анімацій до існуючих елементів
     */
    function applyEnhancedAnimations() {
        if (!window.UI || !window.UI.Animations) return;

        // Перевіряємо, чи не було вже викликано TaskIntegration
        if (window.TaskIntegration && window.TaskIntegration.applyEnhancedAnimations) {
            // Не дублюємо виклик, якщо вже є TaskIntegration
            return;
        }

        // Викликаємо метод ініціалізації анімацій для всієї сторінки
        window.UI.Animations.initPageAnimations();

        log('TaskProgressManager: Застосовано покращені анімації');
    }

    /**
     * Підписка на події системи
     */
    function subscribeToEvents() {
        // Перевіряємо, чи вже підписався TaskIntegration
        if (window.TaskIntegration) {
            // Якщо так, реєструємо тільки унікальні обробники, які не дублюють функціональність
            log('TaskProgressManager: Використовуємо обмежену підписку на події для уникнення конфліктів з TaskIntegration');

            // Підписка на подію оновлення прогресу
            safeEventListener('task-progress-updated', (event) => {
                // Оновлюємо локальний прогрес
                if (event.detail && event.detail.taskId && event.detail.progressData) {
                    const { taskId, progressData } = event.detail;
                    state.userProgress[taskId] = progressData;
                    saveProgress();
                }
            });

            return;
        }

        // Якщо TaskIntegration не виявлено, виконуємо повну підписку на події

        // Підписка на подію завершення завдання
        safeEventListener('task-completed', (event) => {
            // Показуємо анімацію при завершенні завдання
            if (window.UI && window.UI.Animations && event.detail && event.detail.taskId) {
                window.UI.Animations.animateSuccessfulCompletion(event.detail.taskId);
            }

            // Оновлюємо статус завдання для запобігання повторним нагородам
            const { taskId } = event.detail;
            if (taskId && config.preventRewardDuplication) {
                const key = `task_${taskId}`;
                state.lastRewards[key] = Date.now();
            }

            // Оновлюємо прогрес
            if (taskId) {
                // Отримуємо цільове значення завдання
                const targetValue = getTaskTargetValue(taskId);

                // Оновлюємо або створюємо запис прогресу
                state.userProgress[taskId] = {
                    status: 'completed',
                    progress_value: targetValue,
                    completion_date: new Date().toISOString()
                };

                // Зберігаємо оновлений прогрес
                saveProgress();
            }
        });

        // Підписка на подію оновлення прогресу
        safeEventListener('task-progress-updated', (event) => {
            // Оновлюємо анімацію прогресу
            if (window.UI && window.UI.Animations && event.detail && event.detail.taskId) {
                const progressData = event.detail.progressData;
                if (progressData) {
                    const progress = Math.min(100, Math.floor((progressData.progress_value / getTaskTargetValue(event.detail.taskId)) * 100));
                    window.UI.Animations.showProgressAnimation(event.detail.taskId, progress);
                }
            }

            // Оновлюємо локальний прогрес
            if (event.detail && event.detail.taskId && event.detail.progressData) {
                const { taskId, progressData } = event.detail;
                state.userProgress[taskId] = progressData;
                saveProgress();
            }
        });

        // Підписка на подію результату верифікації
        safeEventListener('task-verification-result', (event) => {
            // Показуємо повідомлення про результат верифікації
            if (window.UI && window.UI.Notifications && event.detail && event.detail.result) {
                const result = event.detail.result;

                if (result.success) {
                    window.UI.Notifications.showSuccess(result.message || 'Завдання успішно виконано!');
                } else {
                    window.UI.Notifications.showError(result.message || 'Не вдалося перевірити виконання завдання');
                }
            }

            // Якщо верифікація успішна, оновлюємо прогрес
            if (event.detail && event.detail.result && event.detail.result.success && event.detail.taskId) {
                const { taskId } = event.detail;

                // Отримуємо цільове значення завдання
                const targetValue = getTaskTargetValue(taskId);

                // Оновлюємо прогрес до завершеного стану
                state.userProgress[taskId] = {
                    status: 'completed',
                    progress_value: targetValue,
                    completion_date: new Date().toISOString()
                };

                // Зберігаємо оновлений прогрес
                saveProgress();
            }
        });

        // Підписка на подію оновлення балансу для запобігання дублюванню нагород
        safeEventListener('balance-updated', (event) => {
            if (config.preventRewardDuplication && event.detail) {
                const { type, newBalance, source } = event.detail;

                // Якщо джерело вже task_rewards, не робимо нічого
                if (source === 'task_rewards') return;

                // Зберігаємо останнє значення балансу
                if (type && newBalance !== undefined) {
                    state.lastRewards[type] = newBalance;
                    state.lastRewardTime[type] = Date.now();
                }
            }
        });

        log('TaskProgressManager: Налаштовано обробники подій');
    }

    /**
     * Додавання обробника події з перевіркою на дублювання
     * @param {string} eventName - Назва події
     * @param {Function} handler - Обробник події
     * @param {Object} options - Опції події
     */
    function safeEventListener(eventName, handler, options) {
        // Створюємо унікальний ключ для обробника
        const handlerKey = eventName + '_' + handler.toString();

        // Перевіряємо чи вже є такий обробник
        if (state.eventsRegistered[handlerKey]) return;

        // Додаємо обробник
        document.addEventListener(eventName, handler, options);

        // Зберігаємо ключ
        state.eventsRegistered[handlerKey] = true;
    }

    /**
     * Відправлення події з перевіркою на дублювання
     * @param {string} eventName - Назва події
     * @param {Object} detail - Дані події
     */
    function dispatchEvent(eventName, detail) {
        // Створюємо подію
        const event = new CustomEvent(eventName, { detail });

        // Відправляємо подію
        document.dispatchEvent(event);
    }

    /**
     * Отримання цільового значення прогресу завдання
     * @param {string} taskId - ID завдання
     * @returns {number} Цільове значення
     */
    function getTaskTargetValue(taskId) {
        // Спочатку пробуємо використати TaskVerification
        if (window.TaskVerification && window.TaskVerification.getTaskTargetValue) {
            return window.TaskVerification.getTaskTargetValue(taskId);
        }

        // Також пробуємо через TaskManager
        if (window.TaskManager && window.TaskManager.findTaskById) {
            const task = window.TaskManager.findTaskById(taskId);
            if (task && task.target_value) {
                return parseInt(task.target_value) || 1;
            }
        }

        // Альтернативний пошук через DOM
        const taskElement = document.querySelector(`.task-item[data-task-id="${taskId}"]`);
        if (!taskElement) return 1;

        // Пробуємо отримати цільове значення з атрибуту
        const targetAttr = taskElement.getAttribute('data-target-value');
        if (targetAttr) {
            return parseInt(targetAttr) || 1;
        }

        // За замовчуванням повертаємо 1
        return 1;
    }

    /**
     * Отримання прогресу для конкретного завдання
     * @param {string} taskId - ID завдання
     * @returns {Object|null} Прогрес завдання або null, якщо його немає
     */
    function getTaskProgress(taskId) {
        return state.userProgress[taskId] || null;
    }

    /**
     * Отримання всього прогресу користувача
     * @returns {Object} Прогрес користувача
     */
    function getUserProgress() {
        return state.userProgress;
    }

    /**
     * Оновлення прогресу завдання
     * @param {string} taskId - ID завдання
     * @param {Object} progressData - Дані прогресу
     */
    function updateTaskProgress(taskId, progressData) {
        if (!taskId || !progressData) return;

        // Оновлюємо прогрес у локальному стані
        state.userProgress[taskId] = progressData;

        // Зберігаємо прогрес
        saveProgress();

        // Відправляємо подію про оновлення прогресу
        dispatchEvent('task-progress-updated', {
            taskId,
            progressData,
            source: 'TaskProgressManager'
        });

        // Якщо завдання виконано, відправляємо відповідну подію
        if (progressData.status === 'completed') {
            // Перевіряємо, чи не відправляли нещодавно цю подію
            const key = `task_${taskId}_completed`;
            const lastTime = state.lastRewards[key] || 0;
            const now = Date.now();

            if (!config.preventRewardDuplication || now - lastTime > 5000) {
                // Якщо пройшло більше 5 секунд або не потрібно запобігати дублюванню
                state.lastRewards[key] = now;

                dispatchEvent('task-completed', {
                    taskId,
                    progressData,
                    source: 'TaskProgressManager'
                });
            }
        }

        log(`TaskProgressManager: Оновлено прогрес для завдання ${taskId}`);
    }

    /**
     * Скидання прогресу для завдання
     * @param {string} taskId - ID завдання
     */
    function resetTaskProgress(taskId) {
        if (state.userProgress[taskId]) {
            delete state.userProgress[taskId];
            saveProgress();

            // Відправляємо подію скидання прогресу
            dispatchEvent('task-progress-reset', {
                taskId,
                timestamp: Date.now()
            });

            log(`TaskProgressManager: Скинуто прогрес для завдання ${taskId}`);
        }
    }

    /**
     * Логування з перевіркою налаштувань
     * @param  {...any} args - Аргументи для логування
     */
    function log(...args) {
        if (config.enableLogging) {
            console.log(...args);
        }
    }

    /**
     * Скидання накопичених даних і стану
     */
    function resetState() {
        // Очищаємо реєстри подій
        Object.keys(eventRegistry).forEach(key => delete eventRegistry[key]);

        // Очищаємо список останніх нагород
        state.lastRewards = {};
        state.lastRewardTime = {};

        // Очищаємо зареєстровані обробники подій
        state.eventsRegistered = {};

        log('TaskProgressManager: Стан модуля скинуто');
    }

    // Публічний API модуля
    return {
        init,
        getTaskProgress,
        getUserProgress,
        updateTaskProgress,
        resetTaskProgress,
        resetState,
        getTaskTargetValue,
        REWARD_TYPES
    };
})();

// Автоматична ініціалізація модуля при завантаженні скрипту
document.addEventListener('DOMContentLoaded', () => {
    if (window.TaskProgressManager && !window.TaskProgressManager.isInitialized) {
        window.TaskProgressManager.init();
    }
});