/**
 * TaskIntegration - модуль для інтеграції різних компонентів системи завдань
 * та вирішення конфліктів між ними
 */

window.TaskIntegration = (function() {
    // Список усіх модулів для ініціалізації в правильному порядку
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
        { name: 'TaskVerification', object: () => window.TaskVerification, state: false, priority: 4 },
        { name: 'TaskRewards', object: () => window.TaskRewards, state: false, priority: 4 },
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
        timeout: 10000 // 10 секунд максимум для ініціалізації
    };

    // Стан модуля
    const state = {
        initialized: false,
        startTime: 0,
        eventsRegistered: {},
        initAttempts: 0,
        maxInitAttempts: 3,
        isPageLoaded: false
    };

    // Реєстр подій для уникнення дублювання
    const eventRegistry = {};

    /**
     * Ініціалізація системи інтеграції
     * @param {Object} options - Налаштування
     */
    function init(options = {}) {
        if (state.initialized) return;

        // Об'єднуємо налаштування
        Object.assign(config, options);

        // Записуємо час початку ініціалізації
        state.startTime = performance.now();

        // Логуємо початок ініціалізації
        log('TaskIntegration: Початок ініціалізації системи завдань');

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

        // Підписуємося на події
        subscribeToEvents();

        // Вирішуємо конфлікти між модулями
        resolveModuleConflicts();

        // Встановлюємо обробник для сумісності компонентів
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

        log(`TaskIntegration: Спроба ініціалізації модулів (${state.initAttempts}/${state.maxInitAttempts})`);

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
                'UI.Animations', 'UI.Notifications', 'TaskProgress',
                'TaskVerification', 'TaskRewards', 'TaskManager'
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
            log('TaskIntegration: Досягнуто ліміт часу ініціалізації. Продовжуємо з доступними модулями.');
        }

        // Відправляємо подію про завершення ініціалізації
        dispatchEvent('task-system-initialized', {
            modulesInitialized: modules.filter(m => m.state).map(m => m.name),
            missingModules: modules.filter(m => !m.state).map(m => m.name),
            elapsedTime
        });

        // Логуємо результат ініціалізації
        log(`TaskIntegration: Ініціалізація завершена за ${Math.round(elapsedTime)}мс. Ініціалізовано ${modules.filter(m => m.state).length}/${modules.length} модулів.`);

        // Виконуємо фінальні налаштування
        if (config.useEnhancedAnimations) {
            applyEnhancedAnimations();
        }

        // Якщо всі модулі ініціалізовано успішно
        if (allInitialized) {
            log('TaskIntegration: Всі модулі успішно ініціалізовано');
        } else {
            log('TaskIntegration: Деякі модулі не вдалося ініціалізувати', modules.filter(m => !m.state).map(m => m.name));
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
                log(`TaskIntegration: Ініціалізовано модуль ${module.name}`);
            } catch (error) {
                log(`TaskIntegration: Помилка при ініціалізації модуля ${module.name}:`, error);
            }
        } else {
            // Якщо немає методу init, вважаємо що модуль вже ініціалізовано
            module.state = true;
            log(`TaskIntegration: Модуль ${module.name} не має методу init, вважаємо його ініціалізованим`);
        }
    }

    /**
     * Вирішення конфліктів між модулями
     */
    function resolveModuleConflicts() {
        // Вирішення конфлікту між TaskManager та іншими модулями компонентів завдань
        resolveTaskComponentsConflict();

        // Вирішення конфлікту між різними сповіщеннями
        resolveNotificationsConflict();

        // Виправлення проблем з подіями
        fixEventDuplicationIssues();
    }

    /**
     * Вирішення конфлікту між TaskManager та компонентами завдань
     */
    function resolveTaskComponentsConflict() {
        // Перевизначаємо метод startTask у компонентах, щоб вони використовували TaskManager
        ['SocialTask', 'LimitedTask', 'PartnerTask'].forEach(componentName => {
            const component = window[componentName];
            if (!component) return;

            // Зберігаємо оригінальний метод
            const originalStartTask = component.handleStartTask;

            // Перевизначаємо метод
            if (originalStartTask && window.TaskManager && window.TaskManager.startTask) {
                component.handleStartTask = function(task) {
                    // Використовуємо TaskManager.startTask замість власної реалізації
                    if (typeof task === 'object' && task.id) {
                        window.TaskManager.startTask(task.id);
                    } else if (typeof task === 'string') {
                        window.TaskManager.startTask(task);
                    } else {
                        // Якщо щось пішло не так, викликаємо оригінальний метод
                        originalStartTask.apply(component, arguments);
                    }
                };

                log(`TaskIntegration: Вирішено конфлікт handleStartTask у ${componentName}`);
            }

            // Так само для методу verifyTask
            const originalVerifyTask = component.handleVerifyTask;

            if (originalVerifyTask && window.TaskManager && window.TaskManager.verifyTask) {
                component.handleVerifyTask = function(task) {
                    // Використовуємо TaskManager.verifyTask замість власної реалізації
                    if (typeof task === 'object' && task.id) {
                        window.TaskManager.verifyTask(task.id);
                    } else if (typeof task === 'string') {
                        window.TaskManager.verifyTask(task);
                    } else {
                        // Якщо щось пішло не так, викликаємо оригінальний метод
                        originalVerifyTask.apply(component, arguments);
                    }
                };

                log(`TaskIntegration: Вирішено конфлікт handleVerifyTask у ${componentName}`);
            }
        });
    }

    /**
     * Вирішення конфлікту між різними сповіщеннями
     */
    function resolveNotificationsConflict() {
        // Перевіряємо наявність покращеного модуля сповіщень
        if (window.UI && window.UI.Notifications) {
            // Перевизначаємо методи showSuccessMessage і showErrorMessage в TaskManager
            if (window.TaskManager) {
                // Зберігаємо оригінальні методи
                const originalShowSuccess = window.TaskManager.showSuccessMessage;
                const originalShowError = window.TaskManager.showErrorMessage;

                // Перевизначаємо методи
                window.TaskManager.showSuccessMessage = function(message) {
                    // Використовуємо покращені сповіщення
                    window.UI.Notifications.showSuccess(message);
                };

                window.TaskManager.showErrorMessage = function(message) {
                    // Використовуємо покращені сповіщення
                    window.UI.Notifications.showError(message);
                };

                log('TaskIntegration: Вирішено конфлікт методів сповіщень у TaskManager');
            }

            // Перевизначаємо методи для DailyBonus
            if (window.DailyBonus) {
                // Зберігаємо оригінальні методи
                const originalShowSuccess = window.DailyBonus.showSuccessMessage;
                const originalShowError = window.DailyBonus.showErrorMessage;

                // Перевизначаємо методи
                window.DailyBonus.showSuccessMessage = function(message) {
                    // Використовуємо покращені сповіщення
                    window.UI.Notifications.showSuccess(message);
                };

                window.DailyBonus.showErrorMessage = function(message) {
                    // Використовуємо покращені сповіщення
                    window.UI.Notifications.showError(message);
                };

                log('TaskIntegration: Вирішено конфлікт методів сповіщень у DailyBonus');
            }
        }
    }

    /**
     * Виправлення проблем з дублюванням подій
     */
    function fixEventDuplicationIssues() {
        if (!config.preventDuplicateEvents) return;

        // Зберігаємо оригінальний метод addEventListener
        const originalAddEventListener = document.addEventListener;

        // Перевизначаємо метод addEventListener
        document.addEventListener = function(event, handler, options) {
            // Створюємо ключ для події та обробника
            const handlerKey = event + '_' + handler.toString();

            // Перевіряємо чи вже є така подія з таким обробником
            if (!eventRegistry[handlerKey]) {
                // Якщо немає, зберігаємо в реєстрі та додаємо обробник
                eventRegistry[handlerKey] = true;
                return originalAddEventListener.call(this, event, handler, options);
            }

            // Якщо вже є, пропускаємо
            return undefined;
        };

        log('TaskIntegration: Встановлено перехоплення дублювання подій');
    }

    /**
     * Налаштування сумісності між компонентами
     */
    function setupComponentsCompatibility() {
        // Перевіряємо наявність покращеного модуля анімацій
        if (window.UI && window.UI.Animations) {
            // Встановлюємо делегування для TaskRewards
            if (window.TaskRewards) {
                // Перевизначаємо метод showRewardAnimation
                window.TaskRewards.showRewardAnimation = function(reward) {
                    window.UI.Animations.showReward(reward);
                };

                log('TaskIntegration: Встановлено сумісність між TaskRewards та UI.Animations');
            }
        }

        // Перевіряємо наявність TaskVerification
        if (window.TaskVerification) {
            // Перевизначаємо метод verifyTask у TaskManager для використання TaskVerification
            if (window.TaskManager && window.TaskManager.verifyTask) {
                const originalVerifyTask = window.TaskManager.verifyTask;

                window.TaskManager.verifyTask = async function(taskId) {
                    return await window.TaskVerification.verifyTask(taskId);
                };

                log('TaskIntegration: Встановлено делегування верифікації від TaskManager до TaskVerification');
            }
        }
    }

    /**
     * Застосування покращених анімацій до існуючих елементів
     */
    function applyEnhancedAnimations() {
        if (!window.UI || !window.UI.Animations) return;

        // Викликаємо метод ініціалізації анімацій для всієї сторінки
        window.UI.Animations.initPageAnimations();

        log('TaskIntegration: Застосовано покращені анімації');
    }

    /**
     * Виконання чищення при виході зі сторінки
     */
    function cleanup() {
        // Очищення таймерів та інших ресурсів, якщо потрібно
        if (window.LimitedTask && window.LimitedTask.cleanup) {
            window.LimitedTask.cleanup();
        }

        // Очищення інших ресурсів
        if (window.UI && window.UI.Countdown) {
            window.UI.Countdown.stopAllCountdowns();
        }

        log('TaskIntegration: Виконано чищення ресурсів');
    }

    /**
     * Підписка на події системи
     */
    function subscribeToEvents() {
        // Підписка на подію завершення завдання
        safeEventListener('task-completed', (event) => {
            // Показуємо анімацію при завершенні завдання
            if (window.UI && window.UI.Animations && event.detail && event.detail.taskId) {
                window.UI.Animations.animateSuccessfulCompletion(event.detail.taskId);
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
        });

        // Підписка на подію перед виходом зі сторінки
        window.addEventListener('beforeunload', cleanup);

        log('TaskIntegration: Налаштовано обробники подій');
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
     * Логування з перевіркою налаштувань
     * @param  {...any} args - Аргументи для логування
     */
    function log(...args) {
        if (config.enableLogging) {
            console.log(...args);
        }
    }

    // Публічний API модуля
    return {
        init,
        cleanup,
        modules,
        getModuleState: (moduleName) => {
            const module = modules.find(m => m.name === moduleName);
            return module ? module.state : false;
        },
        initModule: (moduleName) => {
            const module = modules.find(m => m.name === moduleName);
            if (module) {
                initializeModule(module);
                return module.state;
            }
            return false;
        }
    };
})();

// Автоматична ініціалізація модуля при завантаженні скрипту
window.TaskIntegration.init();