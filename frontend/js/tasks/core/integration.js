/**
 * TaskIntegration - модуль для координації ініціалізації всіх компонентів системи завдань
 * Забезпечує правильний порядок ініціалізації та взаємодію між модулями
 */

window.TaskIntegration = (function() {
    // Стан ініціалізації модуля
    const state = {
        initialized: false,
        initStarted: false,
        modulesReady: {}
    };

    // Конфігурація модуля
    const config = {
        enableLogging: true,
        maxInitAttempts: 3
    };

    // Зберігаємо залежності модулів
    const dependencies = {
        'UI.Animations': ['StorageUtils', 'TimeUtils'],
        'TaskProgressManager': ['UI.Animations', 'UI.Notifications', 'UI.ProgressBar'],
        'TaskManager': ['TaskProgressManager', 'TaskRewards', 'TaskVerification']
    };

    // Список критичних модулів, які обов'язково повинні ініціалізуватися
    const criticalModules = [
        'TaskManager',
        'TaskProgressManager',
        'TaskRewards',
        'TaskVerification'
    ];

    /**
     * Ініціалізація системи інтеграції
     */
    function init() {
        if (state.initStarted) return;
        state.initStarted = true;

        log('TaskIntegration: Початок ініціалізації модулів');

        // Перевіряємо стан DOM
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', initModules);
        } else {
            initModules();
        }
    }

    /**
     * Ініціалізація модулів у правильному порядку
     */
    function initModules() {
        // Починаємо з утиліт і базових модулів
        initUtilitiesFirst();

        // Ініціалізуємо UI компоненти
        setTimeout(initUIComponents, 50);

        // Ініціалізуємо основні модулі системи завдань
        setTimeout(initCoreModules, 100);

        // Ініціалізуємо TaskManager останнім
        setTimeout(initTaskManager, 150);

        // Перевіряємо стан ініціалізації через деякий час
        setTimeout(checkInitialization, 500);
    }

    /**
     * Ініціалізація базових утиліт
     */
    function initUtilitiesFirst() {
        const utilities = [
            { name: 'TimeUtils', object: window.TimeUtils },
            { name: 'Formatters', object: window.Formatters },
            { name: 'Validators', object: window.Validators },
            { name: 'StorageUtils', object: window.StorageUtils }
        ];

        initModuleList(utilities);
    }

    /**
     * Ініціалізація UI компонентів
     */
    function initUIComponents() {
        // Перевіряємо, чи готові утиліти, які потрібні для UI компонентів
        if (!areDependenciesReady('UI.Animations')) {
            log('TaskIntegration: Утиліти ще не готові для ініціалізації UI.Animations, очікування...');
            setTimeout(initUIComponents, 50);
            return;
        }

        const uiComponents = [
            { name: 'UI.Animations', object: window.UI && window.UI.Animations },
            { name: 'UI.Notifications', object: window.UI && window.UI.Notifications },
            { name: 'UI.ProgressBar', object: window.UI && window.UI.ProgressBar },
            { name: 'UI.Countdown', object: window.UI && window.UI.Countdown }
        ];

        initModuleList(uiComponents);
    }

    /**
     * Ініціалізація основних модулів системи завдань
     */
    function initCoreModules() {
        // Перевіряємо, чи готові UI компоненти
        if (!areDependenciesReady('TaskProgressManager')) {
            log('TaskIntegration: UI компоненти ще не готові, очікування...');
            setTimeout(initCoreModules, 50);
            return;
        }

        const coreModules = [
            { name: 'TaskProgress', object: window.TaskProgress },
            { name: 'TaskRewards', object: window.TaskRewards },
            { name: 'TaskVerification', object: window.TaskVerification },
            { name: 'TaskProgressManager', object: window.TaskProgressManager }
        ];

        initModuleList(coreModules);
    }

    /**
     * Ініціалізація TaskManager після всіх інших модулів
     */
    function initTaskManager() {
        // Перевіряємо, чи готові всі необхідні модулі для TaskManager
        if (!areDependenciesReady('TaskManager')) {
            log('TaskIntegration: Основні модулі ще не готові для TaskManager, очікування...');
            setTimeout(initTaskManager, 50);
            return;
        }

        if (window.TaskManager && typeof window.TaskManager.init === 'function' && !state.modulesReady['TaskManager']) {
            try {
                window.TaskManager.init();
                state.modulesReady['TaskManager'] = true;
                log('TaskIntegration: TaskManager успішно ініціалізовано');
            } catch (error) {
                log('TaskIntegration: Помилка при ініціалізації TaskManager:', error);
            }
        }
    }

    /**
     * Ініціалізація списку модулів
     * @param {Array} modules - Список модулів для ініціалізації
     */
    function initModuleList(modules) {
        modules.forEach(module => {
            if (module.object && typeof module.object.init === 'function' && !state.modulesReady[module.name]) {
                try {
                    module.object.init();
                    state.modulesReady[module.name] = true;
                    log(`TaskIntegration: Модуль ${module.name} успішно ініціалізовано`);
                } catch (error) {
                    log(`TaskIntegration: Помилка при ініціалізації модуля ${module.name}:`, error);
                }
            } else if (module.object && !state.modulesReady[module.name]) {
                // Модуль існує, але не має методу init, вважаємо його ініціалізованим
                state.modulesReady[module.name] = true;
                log(`TaskIntegration: Модуль ${module.name} не має методу init, вважаємо його готовим`);
            }
        });
    }

    /**
     * Перевірка, чи готові всі залежності для модуля
     * @param {string} moduleName - Назва модуля
     * @returns {boolean} - Чи всі залежності готові
     */
    function areDependenciesReady(moduleName) {
        if (!dependencies[moduleName]) return true;

        return dependencies[moduleName].every(dep => state.modulesReady[dep]);
    }

    /**
     * Перевірка стану ініціалізації
     */
    function checkInitialization() {
        const allCriticalReady = criticalModules.every(module => state.modulesReady[module]);

        if (allCriticalReady) {
            state.initialized = true;
            log('TaskIntegration: Всі критичні модулі успішно ініціалізовано');

            // Відправляємо подію про успішну ініціалізацію
            const event = new CustomEvent('task-system-initialized', {
                detail: {
                    modules: Object.keys(state.modulesReady)
                }
            });
            document.dispatchEvent(event);
        } else {
            log('TaskIntegration: Деякі критичні модулі не вдалося ініціалізувати:',
                criticalModules.filter(m => !state.modulesReady[m]));

            // Спробуємо ще раз
            setTimeout(initModules, 200);
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

    // Ініціалізуємо модуль при завантаженні
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Публічний API
    return {
        init,
        getModuleState: () => ({ ...state.modulesReady }),
        isInitialized: () => state.initialized
    };
})();