/**
 * TaskProgressManager - оптимізований модуль для керування прогресом завдань
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
        timeout: 10000, // 10 секунд максимум для ініціалізації
        synchronizeBonusProgress: true, // Синхронізація прогресу з бонусами
        rewardDeduplicationWindow: 5000 // 5 секунд для запобігання дублюванню винагород
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
        userProgress: {}, // Локальне сховище для прогресу
        dailyBonusProgress: null, // Стан щоденних бонусів
        userBalances: {
            tokens: null,
            coins: null
        },
        pendingOperations: {} // Очікуючі операції з прогресом
    };

    // Реєстр подій для уникнення дублювання
    const eventRegistry = new Set();

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

        // Перевіряємо стан DailyBonus, якщо він доступний
        synchronizeDailyBonusState();

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

                // Додаткові дії після ініціалізації конкретних модулів
                if (module.name === 'DailyBonus') {
                    synchronizeDailyBonusState();
                }
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
     * Синхронізація стану щоденних бонусів
     */
    function synchronizeDailyBonusState() {
        if (!config.synchronizeBonusProgress) return;

        // Перевіряємо, чи доступний модуль DailyBonus
        const dailyBonus = window.DailyBonus;
        if (!dailyBonus) return;

        // Отримуємо стан бонусів
        const bonusState = dailyBonus.getState ? dailyBonus.getState() : null;
        if (!bonusState || !bonusState.bonusData) return;

        // Зберігаємо стан для подальшого використання
        state.dailyBonusProgress = bonusState.bonusData;

        log('TaskProgressManager: Синхронізовано стан щоденних бонусів');
    }

    /**
     * Завантаження збереженого прогресу користувача
     */
    function loadSavedProgress() {
        try {
            // Спочатку пробуємо отримати з localStorage
            const savedProgress = localStorage.getItem('winix_task_progress');
            if (savedProgress) {
                try {
                    state.userProgress = JSON.parse(savedProgress);
                    log('TaskProgressManager: Завантажено збережений прогрес користувача');
                } catch (parseError) {
                    log('TaskProgressManager: Помилка при розборі збереженого прогресу:', parseError);
                    state.userProgress = {};
                }
            } else {
                state.userProgress = {};
            }

            // Завантажуємо баланси
            loadBalances();
        } catch (error) {
            log('TaskProgressManager: Помилка при завантаженні збереженого прогресу:', error);
            state.userProgress = {};
        }
    }

    /**
     * Завантаження балансів користувача
     */
    function loadBalances() {
        try {
            // Завантажуємо баланс токенів
            const tokensElement = document.getElementById('user-tokens');
            if (tokensElement) {
                state.userBalances.tokens = parseFloat(tokensElement.textContent) || 0;
            } else {
                // Спробуємо з localStorage
                const savedTokens = localStorage.getItem('winix_balance') || localStorage.getItem('userTokens');
                state.userBalances.tokens = savedTokens ? parseFloat(savedTokens) : null;
            }

            // Завантажуємо баланс жетонів
            const coinsElement = document.getElementById('user-coins');
            if (coinsElement) {
                state.userBalances.coins = parseInt(coinsElement.textContent) || 0;
            } else {
                // Спробуємо з localStorage
                const savedCoins = localStorage.getItem('winix_coins') || localStorage.getItem('userCoins');
                state.userBalances.coins = savedCoins ? parseInt(savedCoins) : null;
            }

            log('TaskProgressManager: Завантажено баланси користувача');
        } catch (error) {
            log('TaskProgressManager: Помилка при завантаженні балансів:', error);
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
                return updateTaskProgress(taskId, progressData);
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
            try {
                const externalProgress = window.TaskProgress.getUserProgress();
                if (externalProgress && typeof externalProgress === 'object') {
                    // Об'єднуємо з нашим прогресом
                    Object.assign(state.userProgress, externalProgress);
                    saveProgress();
                }
            } catch (error) {
                log('TaskProgressManager: Помилка при синхронізації прогресу з TaskProgress:', error);
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
        window.UI.Animations.initPageAnimations && window.UI.Animations.initPageAnimations();

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
                try {
                    window.UI.Animations.animateSuccessfulCompletion &&
                        window.UI.Animations.animateSuccessfulCompletion(event.detail.taskId);
                } catch (error) {
                    log('TaskProgressManager: Помилка при показі анімації завершення завдання:', error);
                }
            }

            // Оновлюємо статус завдання для запобігання повторним нагородам
            const { taskId } = event.detail;
            if (taskId && config.preventRewardDuplication) {
                const key = `task_${taskId}`;
                state.lastRewards[key] = Date.now();
            }

            // Оновлюємо прогрес
            if (taskId) {
                try {
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
                } catch (error) {
                    log('TaskProgressManager: Помилка при оновленні прогресу завдання:', error);
                }
            }
        });

        // Підписка на подію оновлення прогресу
        safeEventListener('task-progress-updated', (event) => {
            // Оновлюємо анімацію прогресу
            if (window.UI && window.UI.Animations && event.detail && event.detail.taskId) {
                try {
                    const progressData = event.detail.progressData;
                    if (progressData) {
                        const taskId = event.detail.taskId;
                        const targetValue = getTaskTargetValue(taskId);
                        const progress = Math.min(100, Math.floor((progressData.progress_value / targetValue) * 100));

                        window.UI.Animations.showProgressAnimation &&
                            window.UI.Animations.showProgressAnimation(taskId, progress);
                    }
                } catch (error) {
                    log('TaskProgressManager: Помилка при оновленні анімації прогресу:', error);
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
                try {
                    const result = event.detail.result;

                    if (result.success) {
                        window.UI.Notifications.showSuccess &&
                            window.UI.Notifications.showSuccess(result.message || 'Завдання успішно виконано!');
                    } else {
                        window.UI.Notifications.showError &&
                            window.UI.Notifications.showError(result.message || 'Не вдалося перевірити виконання завдання');
                    }
                } catch (error) {
                    log('TaskProgressManager: Помилка при показі повідомлення про результат верифікації:', error);
                }
            }

            // Якщо верифікація успішна, оновлюємо прогрес
            if (event.detail && event.detail.result && event.detail.result.success && event.detail.taskId) {
                try {
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
                } catch (error) {
                    log('TaskProgressManager: Помилка при оновленні прогресу після верифікації:', error);
                }
            }
        });

        // Підписка на подію оновлення балансу для запобігання дублюванню нагород
        safeEventListener('balance-updated', (event) => {
            if (config.preventRewardDuplication && event.detail) {
                try {
                    const { type, newBalance, source, operationId } = event.detail;

                    // Якщо джерело вже task_rewards, не робимо нічого
                    if (source === 'task_rewards') return;

                    // Зберігаємо останнє значення балансу та час
                    if (type && newBalance !== undefined) {
                        state.lastRewards[type] = newBalance;
                        state.lastRewardTime[type] = Date.now();

                        // Оновлюємо стан балансів
                        if (type === REWARD_TYPES.TOKENS) {
                            state.userBalances.tokens = newBalance;
                        } else if (type === REWARD_TYPES.COINS) {
                            state.userBalances.coins = newBalance;
                        }
                    }

                    // Додаємо операцію в реєстр для запобігання повторній обробці
                    if (operationId) {
                        state.lastRewards[operationId] = Date.now();
                    }
                } catch (error) {
                    log('TaskProgressManager: Помилка при обробці події оновлення балансу:', error);
                }
            }
        });

        // Підписка на подію отримання щоденного бонусу
        safeEventListener('daily-bonus-claimed', (event) => {
            if (event.detail) {
                try {
                    // Оновлюємо стан щоденних бонусів
                    if (config.synchronizeBonusProgress && window.DailyBonus && window.DailyBonus.getState) {
                        const bonusState = window.DailyBonus.getState();
                        if (bonusState && bonusState.bonusData) {
                            state.dailyBonusProgress = bonusState.bonusData;
                        }
                    }

                    // Якщо є винагорода, зберігаємо її в реєстрі
                    if (event.detail.reward) {
                        const rewardKey = `daily_bonus_${Date.now()}`;
                        state.lastRewards[rewardKey] = event.detail.reward;
                        state.lastRewardTime[rewardKey] = Date.now();

                        // Оновлюємо баланс токенів
                        if (state.userBalances.tokens !== null) {
                            state.userBalances.tokens += parseFloat(event.detail.reward);
                        }
                    }
                } catch (error) {
                    log('TaskProgressManager: Помилка при обробці події отримання щоденного бонусу:', error);
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
        if (!config.preventDuplicateEvents) {
            document.addEventListener(eventName, handler, options);
            return;
        }

        // Створюємо унікальний ключ для обробника
        const handlerKey = eventName + '_' + handler.toString();

        // Перевіряємо чи вже є такий обробник
        if (eventRegistry.has(handlerKey)) return;

        // Додаємо обробник
        document.addEventListener(eventName, handler, options);

        // Зберігаємо ключ
        eventRegistry.add(handlerKey);
        log(`TaskProgressManager: Додано обробник події ${eventName}`);
    }

    /**
     * Відправлення події з перевіркою на дублювання
     * @param {string} eventName - Назва події
     * @param {Object} detail - Дані події
     */
    function dispatchEvent(eventName, detail) {
        // Створюємо унікальний ID для події
        const eventId = detail && detail.id ? detail.id : `${eventName}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;

        // Додаємо ID до деталей події
        const eventDetail = {
            ...detail,
            eventId,
            timestamp: Date.now(),
            source: 'TaskProgressManager'
        };

        // Створюємо подію
        const event = new CustomEvent(eventName, { detail: eventDetail });

        // Відправляємо подію
        document.dispatchEvent(event);
        log(`TaskProgressManager: Відправлено подію ${eventName}`);
    }

    /**
     * Отримання цільового значення прогресу завдання
     * @param {string} taskId - ID завдання
     * @returns {number} Цільове значення
     */
    function getTaskTargetValue(taskId) {
        // Перевіряємо, чи існує прогрес для цього завдання
        const existingProgress = state.userProgress[taskId];
        if (existingProgress && existingProgress.max_progress) {
            return parseInt(existingProgress.max_progress) || 1;
        }

        // Спочатку пробуємо використати TaskVerification
        if (window.TaskVerification && window.TaskVerification.getTaskTargetValue) {
            try {
                const targetValue = window.TaskVerification.getTaskTargetValue(taskId);
                if (targetValue && !isNaN(targetValue)) {
                    return parseInt(targetValue) || 1;
                }
            } catch (error) {
                log('TaskProgressManager: Помилка при отриманні цільового значення через TaskVerification:', error);
            }
        }

        // Також пробуємо через TaskManager
        if (window.TaskManager && window.TaskManager.findTaskById) {
            try {
                const task = window.TaskManager.findTaskById(taskId);
                if (task && task.target_value) {
                    return parseInt(task.target_value) || 1;
                }
            } catch (error) {
                log('TaskProgressManager: Помилка при отриманні цільового значення через TaskManager:', error);
            }
        }

        // Альтернативний пошук через DOM
        try {
            const taskElement = document.querySelector(`.task-item[data-task-id="${taskId}"]`);
            if (taskElement) {
                // Пробуємо отримати цільове значення з атрибуту
                const targetAttr = taskElement.getAttribute('data-target-value');
                if (targetAttr) {
                    return parseInt(targetAttr) || 1;
                }
            }
        } catch (error) {
            log('TaskProgressManager: Помилка при отриманні цільового значення з DOM:', error);
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
     * Отримання стану щоденних бонусів
     * @returns {Object|null} Стан щоденних бонусів або null
     */
    function getDailyBonusProgress() {
        // Спочатку перевіряємо, чи є дані в локальному стані
        if (state.dailyBonusProgress) {
            return state.dailyBonusProgress;
        }

        // Якщо немає, спробуємо отримати через DailyBonus
        if (window.DailyBonus && window.DailyBonus.getState) {
            try {
                const bonusState = window.DailyBonus.getState();
                if (bonusState && bonusState.bonusData) {
                    state.dailyBonusProgress = bonusState.bonusData;
                    return state.dailyBonusProgress;
                }
            } catch (error) {
                log('TaskProgressManager: Помилка при отриманні стану щоденних бонусів:', error);
            }
        }

        return null;
    }

    /**
     * Оновлення прогресу завдання
     * @param {string} taskId - ID завдання
     * @param {Object} progressData - Дані прогресу
     */
    function updateTaskProgress(taskId, progressData) {
        if (!taskId || !progressData) return;

        // Перевіряємо, чи не виконується вже оновлення для цього завдання
        const operationKey = `update_${taskId}_${Date.now()}`;
        if (state.pendingOperations[taskId]) {
            log(`TaskProgressManager: Вже виконується оновлення для завдання ${taskId}`);

            // Запобігаємо втраті прогресу - зберігаємо найбільше значення
            if (progressData.progress_value && state.pendingOperations[taskId].progress_value) {
                const existingValue = parseFloat(state.pendingOperations[taskId].progress_value);
                const newValue = parseFloat(progressData.progress_value);
                if (newValue > existingValue) {
                    state.pendingOperations[taskId].progress_value = newValue;
                    log(`TaskProgressManager: Оновлено значення прогресу для завдання ${taskId}: ${newValue}`);
                }
            }

            return;
        }

        // Встановлюємо прапорець виконання операції
        state.pendingOperations[taskId] = {...progressData, operationKey};

        try {
            // Оновлюємо прогрес у локальному стані
            state.userProgress[taskId] = progressData;

            // Зберігаємо прогрес
            saveProgress();

            // Відправляємо подію про оновлення прогресу
            dispatchEvent('task-progress-updated', {
                taskId,
                progressData,
                source: 'TaskProgressManager',
                id: operationKey
            });

            // Якщо завдання виконано, відправляємо відповідну подію
            if (progressData.status === 'completed') {
                // Перевіряємо, чи не відправляли нещодавно цю подію
                const key = `task_${taskId}_completed`;
                const lastTime = state.lastRewards[key] || 0;
                const now = Date.now();

                if (!config.preventRewardDuplication || now - lastTime > config.rewardDeduplicationWindow) {
                    // Якщо пройшло достатньо часу або не потрібно запобігати дублюванню
                    state.lastRewards[key] = now;

                    dispatchEvent('task-completed', {
                        taskId,
                        progressData,
                        source: 'TaskProgressManager',
                        id: `complete_${taskId}_${now}`
                    });
                }
            }

            log(`TaskProgressManager: Оновлено прогрес для завдання ${taskId}`);
        } catch (error) {
            log(`TaskProgressManager: Помилка при оновленні прогресу для завдання ${taskId}:`, error);
        } finally {
            // Знімаємо прапорець виконання операції
            delete state.pendingOperations[taskId];
        }
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
     * Синхронізація балансів
     * @param {Object} balances - Баланси для синхронізації
     */
    function synchronizeBalances(balances) {
        if (!balances) return;

        try {
            // Оновлюємо баланси
            if ('tokens' in balances && balances.tokens !== null) {
                state.userBalances.tokens = parseFloat(balances.tokens);
            }

            if ('coins' in balances && balances.coins !== null) {
                state.userBalances.coins = parseInt(balances.coins);
            }

            log('TaskProgressManager: Синхронізовано баланси');
        } catch (error) {
            log('TaskProgressManager: Помилка при синхронізації балансів:', error);
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
        // Очищаємо реєстр подій
        eventRegistry.clear();

        // Очищаємо список останніх нагород
        state.lastRewards = {};
        state.lastRewardTime = {};

        // Очищаємо зареєстровані обробники подій
        state.eventsRegistered = {};

        // Очищаємо очікуючі операції
        state.pendingOperations = {};

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
        getDailyBonusProgress,
        synchronizeBalances,
        synchronizeDailyBonusState,
        REWARD_TYPES
    };
})();

// Автоматична ініціалізація модуля при завантаженні скрипту
document.addEventListener('DOMContentLoaded', () => {
    if (window.TaskProgressManager && !window.TaskProgressManager.initialized) {
        window.TaskProgressManager.init();
    }
});