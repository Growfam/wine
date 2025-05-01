/**
 * API Connectivity Helpers - Набір функцій для забезпечення стабільного з'єднання з API
 * Виявляє та вирішує проблеми з підключенням до API
 */

window.APIConnectivity = (function() {
    // Стан з'єднання
    const state = {
        isOnline: navigator.onLine,
        apiAvailable: true,
        lastCheck: 0,
        failedEndpoints: {},
        successfulEndpoints: {},
        fallbackMode: false,
        checkInterval: null
    };

    // Конфігурація
    const config = {
        // Список критичних ендпоінтів для перевірки доступності API
        criticalEndpoints: [
            'api/ping',
            'api/user/{userId}',
            'api/user/{userId}/daily-bonus',
            'api/quests/tasks/partners'
        ],
        // Інтервал перевірки API у мілісекундах
        checkIntervalTime: 60000, // 1 хвилина
        // Кількість послідовних помилок для переходу в режим fallback
        maxConsecutiveFailures: 3,
        // Таймаут для запитів перевірки
        checkTimeout: 5000,
        // Режим відлагодження
        debug: false
    };

    /**
     * Ініціалізація системи перевірки з'єднання
     */
    function init() {
        console.log("APIConnectivity: Ініціалізація системи перевірки з'єднання");

        // Додаємо обробники мережевих подій
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Запускаємо періодичну перевірку API
        startPeriodicCheck();

        // Початкова перевірка API
        checkAPIAvailability();
    }

    /**
     * Обробник події відновлення з'єднання
     */
    function handleOnline() {
        state.isOnline = true;
        console.log("APIConnectivity: Пристрій відновив з'єднання з мережею");

        // Відправляємо подію
        document.dispatchEvent(new CustomEvent('api-connectivity-changed', {
            detail: { online: true }
        }));

        // Перевіряємо доступність API
        checkAPIAvailability();
    }

    /**
     * Обробник події втрати з'єднання
     */
    function handleOffline() {
        state.isOnline = false;
        console.log("APIConnectivity: Пристрій втратив з'єднання з мережею");

        // Відправляємо подію
        document.dispatchEvent(new CustomEvent('api-connectivity-changed', {
            detail: { online: false }
        }));
    }

    /**
     * Запуск періодичної перевірки API
     */
    function startPeriodicCheck() {
        // Зупиняємо попередню перевірку, якщо вона є
        if (state.checkInterval) {
            clearInterval(state.checkInterval);
        }

        // Запускаємо нову періодичну перевірку
        state.checkInterval = setInterval(() => {
            if (state.isOnline) {
                checkAPIAvailability();
            }
        }, config.checkIntervalTime);

        console.log(`APIConnectivity: Запущено періодичну перевірку (інтервал: ${config.checkIntervalTime/1000}с)`);
    }

    /**
     * Перевірка доступності API
     * @returns {Promise<boolean>} Результат перевірки
     */
    async function checkAPIAvailability() {
        // Якщо пристрій офлайн, не виконуємо перевірку
        if (!state.isOnline) {
            return false;
        }

        // Запобігаємо частим перевіркам
        const now = Date.now();
        if (now - state.lastCheck < 10000) { // Не частіше ніж раз на 10 секунд
            return state.apiAvailable;
        }

        state.lastCheck = now;

        // Отримуємо ID користувача для перевірки
        const userId = window.getUserId ? window.getUserId() : null;

        try {
            // Функція для перевірки одного ендпоінту
            async function checkEndpoint(endpoint) {
                // Замінюємо placeholder userId, якщо потрібно
                const formattedEndpoint = userId ?
                    endpoint.replace('{userId}', userId) :
                    endpoint;

                try {
                    if (config.debug) {
                        console.log(`APIConnectivity: Перевірка ендпоінту ${formattedEndpoint}`);
                    }

                    // Створюємо URL для запиту
                    let url;

                    // Визначаємо базовий URL
                    if (window.WinixAPI && window.WinixAPI.config && window.WinixAPI.config.baseUrl) {
                        url = `${window.WinixAPI.config.baseUrl}/${formattedEndpoint}`;
                    } else if (window.API_BASE_URL) {
                        url = `${window.API_BASE_URL}/${formattedEndpoint}`;
                    } else {
                        url = `https://winixbot.com/${formattedEndpoint}`;
                    }

                    // Додаємо параметр для запобігання кешуванню
                    url += `?_t=${Date.now()}`;

                    // Виконуємо запит з обмеженим таймаутом
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), config.checkTimeout);

                    const response = await fetch(url, {
                        method: 'GET',
                        headers: {
                            'Accept': 'application/json'
                        },
                        signal: controller.signal
                    });

                    // Очищаємо таймаут
                    clearTimeout(timeoutId);

                    // Перевіряємо статус відповіді
                    const success = response.ok || response.status === 404; // 404 може бути валідною відповіддю для неіснуючого ресурсу

                    // Оновлюємо стан ендпоінту
                    if (success) {
                        // Скидаємо лічильник помилок
                        delete state.failedEndpoints[endpoint];

                        // Додаємо до успішних ендпоінтів
                        state.successfulEndpoints[endpoint] = {
                            timestamp: Date.now(),
                            status: response.status
                        };
                    } else {
                        // Збільшуємо лічильник помилок
                        state.failedEndpoints[endpoint] = (state.failedEndpoints[endpoint] || 0) + 1;

                        console.warn(`APIConnectivity: Помилка перевірки ендпоінту ${formattedEndpoint}: ${response.status}`);
                    }

                    return success;
                } catch (error) {
                    // Збільшуємо лічильник помилок
                    state.failedEndpoints[endpoint] = (state.failedEndpoints[endpoint] || 0) + 1;

                    console.error(`APIConnectivity: Помилка перевірки ендпоінту ${formattedEndpoint}:`, error);
                    return false;
                }
            }

            // Перевіряємо всі критичні ендпоінти
            const results = await Promise.all(config.criticalEndpoints.map(checkEndpoint));

            // Визначаємо загальну доступність API
            // API вважається доступним, якщо хоча б 50% ендпоінтів працюють
            const successCount = results.filter(Boolean).length;
            const successRate = successCount / config.criticalEndpoints.length;

            const wasAvailable = state.apiAvailable;
            state.apiAvailable = successRate >= 0.5;

            // Перевіряємо критичні помилки
            const hasCriticalFailures = Object.values(state.failedEndpoints).some(count => count >= config.maxConsecutiveFailures);

            // Якщо є критичні помилки, вмикаємо режим fallback
            if (hasCriticalFailures && !state.fallbackMode) {
                console.warn("APIConnectivity: Виявлено критичні помилки API, вмикаємо режим fallback");
                state.fallbackMode = true;

                // Відправляємо подію про перехід у режим fallback
                document.dispatchEvent(new CustomEvent('api-fallback-mode-changed', {
                    detail: { enabled: true }
                }));
            }

            // Якщо API стан змінився, відправляємо подію
            if (wasAvailable !== state.apiAvailable) {
                console.log(`APIConnectivity: Стан API змінився на ${state.apiAvailable ? 'доступний' : 'недоступний'}`);

                document.dispatchEvent(new CustomEvent('api-availability-changed', {
                    detail: {
                        available: state.apiAvailable,
                        successRate: successRate
                    }
                }));

                // Якщо API став доступним і був увімкнений режим fallback, вимикаємо його
                if (state.apiAvailable && state.fallbackMode) {
                    console.log("APIConnectivity: API знову доступний, вимикаємо режим fallback");
                    state.fallbackMode = false;

                    // Відправляємо подію про вимкнення режиму fallback
                    document.dispatchEvent(new CustomEvent('api-fallback-mode-changed', {
                        detail: { enabled: false }
                    }));

                    // Очищаємо лічильники помилок
                    state.failedEndpoints = {};
                }
            }

            if (config.debug) {
                console.log(`APIConnectivity: Перевірка завершена, успішність: ${Math.round(successRate * 100)}%`);
            }

            return state.apiAvailable;
        } catch (error) {
            console.error("APIConnectivity: Критична помилка перевірки API:", error);

            // У випадку критичної помилки вважаємо, що API недоступний
            const wasAvailable = state.apiAvailable;
            state.apiAvailable = false;

            // Якщо стан змінився, відправляємо подію
            if (wasAvailable) {
                document.dispatchEvent(new CustomEvent('api-availability-changed', {
                    detail: { available: false }
                }));
            }

            return false;
        }
    }

    /**
     * Примусовий перехід у fallback режим
     * @param {boolean} enable - Увімкнути (true) або вимкнути (false) режим
     */
    function setFallbackMode(enable) {
        if (state.fallbackMode !== enable) {
            state.fallbackMode = enable;
            console.log(`APIConnectivity: ${enable ? 'Увімкнено' : 'Вимкнено'} режим fallback вручну`);

            // Відправляємо подію
            document.dispatchEvent(new CustomEvent('api-fallback-mode-changed', {
                detail: { enabled: enable, manual: true }
            }));
        }
    }

    /**
     * Перевірка чи працює конкретний ендпоінт
     * @param {string} endpoint - Ендпоінт для перевірки
     * @returns {boolean} Результат перевірки
     */
    function isEndpointAvailable(endpoint) {
        // Спочатку перевіряємо загальну доступність API
        if (!state.apiAvailable) {
            return false;
        }

        // Якщо ендпоінт нещодавно позначено як працюючий, повертаємо true
        if (state.successfulEndpoints[endpoint]) {
            const age = Date.now() - state.successfulEndpoints[endpoint].timestamp;
            if (age < config.checkIntervalTime * 2) {
                return true;
            }
        }

        // Якщо ендпоінт має критичні помилки, повертаємо false
        if (state.failedEndpoints[endpoint] >= config.maxConsecutiveFailures) {
            return false;
        }

        // За замовчуванням вважаємо, що ендпоінт доступний
        return true;
    }

    /**
     * Отримання стану API з'єднання
     * @returns {Object} Стан API з'єднання
     */
    function getConnectionState() {
        return {
            isOnline: state.isOnline,
            apiAvailable: state.apiAvailable,
            failedEndpoints: { ...state.failedEndpoints },
            successfulEndpoints: { ...state.successfulEndpoints },
            fallbackMode: state.fallbackMode,
            lastCheck: state.lastCheck,
            timeSinceLastCheck: Date.now() - state.lastCheck
        };
    }

    /**
     * Скидання лічильників помилок
     */
    function resetFailureCounters() {
        state.failedEndpoints = {};
        console.log("APIConnectivity: Лічильники помилок скинуто");
    }

    /**
     * Примусова перевірка з'єднання
     * @returns {Promise<boolean>} Результат перевірки
     */
    function forceCheck() {
        console.log("APIConnectivity: Примусова перевірка з'єднання");
        state.lastCheck = 0; // Скидаємо час останньої перевірки
        return checkAPIAvailability();
    }

    // Встановлюємо початковий стан з'єднання
    state.isOnline = navigator.onLine;

    // Публічний API
    return {
        init,
        checkAPIAvailability,
        isEndpointAvailable,
        setFallbackMode,
        getConnectionState,
        resetFailureCounters,
        forceCheck,
        isFallbackMode: () => state.fallbackMode,
        isAPIAvailable: () => state.apiAvailable,
        isOnline: () => state.isOnline,

        // Налаштування
        setCheckInterval: (interval) => {
            config.checkIntervalTime = interval;
            startPeriodicCheck(); // Перезапускаємо з новим інтервалом
        },
        setDebugMode: (debug) => { config.debug = debug; },
        setCriticalEndpoints: (endpoints) => { config.criticalEndpoints = endpoints; }
    };
})();

// Ініціалізуємо систему при завантаженні сторінки
document.addEventListener('DOMContentLoaded', function() {
    // Ініціалізуємо тільки якщо цей модуль увімкнено
    if (localStorage.getItem('enable_api_connectivity') !== 'false') {
        window.APIConnectivity.init();
    }
});