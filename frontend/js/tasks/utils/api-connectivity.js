/**
 * API Connectivity Helpers - Набір функцій для забезпечення стабільного з'єднання з API
 * Оптимізована версія зі спрощеною обробкою помилок та без надмірних механізмів CORS
 */

window.APIConnectivity = (function() {
    // Стан з'єднання
    const state = {
        isOnline: navigator.onLine,
        apiAvailable: true,
        lastCheck: 0,
        failedEndpoints: {},
        successfulEndpoints: {},
        pendingRequests: new Map(), // Зберігаємо активні запити для запобігання дублюванню
        requestHistory: {}          // Історія успішних запитів для аналізу
    };

    // Конфігурація
    const config = {
        // Список критичних ендпоінтів для перевірки доступності API
        criticalEndpoints: [
            'api/ping',
            'api/user/{userId}'
        ],
        // Інтервал перевірки API у мілісекундах
        checkIntervalTime: 60000, // 1 хвилина
        // Таймаут для запитів перевірки
        checkTimeout: 5000,
        // Таймаут для звичайних запитів
        requestTimeout: 15000,
        // Максимальна кількість повторних спроб для запитів
        maxRetries: 2,
        // Початкова затримка між повторними спробами (мс)
        retryDelay: 1000,
        // Чи запобігати дублюванню паралельних запитів
        preventDuplicateRequests: true,
        // Час життя блокування паралельних запитів (мс)
        duplicateRequestsLockTime: 5000,
        // Чи використовувати кешування GET-запитів
        useResponseCaching: true,
        // Час життя кешу відповідей (мс)
        responseCacheTime: 300000, // 5 хвилин
        // Режим відлагодження
        debug: false
    };

    // Кеш відповідей API
    const responseCache = new Map();

    /**
     * Ініціалізація системи перевірки з'єднання
     * @param {Object} options - Налаштування
     */
    function init(options = {}) {
        console.log("APIConnectivity: Ініціалізація системи перевірки з'єднання");

        // Застосовуємо передані опції
        if (options && typeof options === 'object') {
            Object.keys(options).forEach(key => {
                if (key in config) {
                    config[key] = options[key];
                }
            });
        }

        // Додаємо обробники мережевих подій
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Запускаємо періодичну перевірку API
        startPeriodicCheck();

        // Початкова перевірка API
        checkAPIAvailability();

        // Очищаємо застарілі елементи кешу
        cleanupCache();
    }

    /**
     * Очищення застарілих елементів кешу відповідей
     */
    function cleanupCache() {
        if (!config.useResponseCaching) return;

        const now = Date.now();
        let cleanedCount = 0;

        // Очищаємо застарілі записи
        for (const [key, entry] of responseCache.entries()) {
            if (now > entry.expiresAt) {
                responseCache.delete(key);
                cleanedCount++;
            }
        }

        if (config.debug && cleanedCount > 0) {
            console.log(`APIConnectivity: Очищено ${cleanedCount} застарілих записів кешу`);
        }

        // Плануємо наступне очищення
        setTimeout(cleanupCache, 60000); // раз на хвилину
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
        const userId = getUserId();

        try {
            // Виконуємо простий запит до API
            const pingUrl = getApiUrl('api/ping');
            const response = await fetch(pingUrl, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                },
                timeout: config.checkTimeout
            });

            // Оновлюємо стан API
            const wasAvailable = state.apiAvailable;
            state.apiAvailable = response.ok;

            // Якщо стан змінився, відправляємо подію
            if (wasAvailable !== state.apiAvailable) {
                document.dispatchEvent(new CustomEvent('api-availability-changed', {
                    detail: { available: state.apiAvailable }
                }));
            }

            return state.apiAvailable;
        } catch (error) {
            console.error("APIConnectivity: Помилка перевірки API:", error);

            // У випадку помилки вважаємо, що API недоступний
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
     * Отримання стану API з'єднання
     * @returns {Object} Стан API з'єднання
     */
    function getConnectionState() {
        return {
            isOnline: state.isOnline,
            apiAvailable: state.apiAvailable,
            failedEndpoints: { ...state.failedEndpoints },
            successfulEndpoints: { ...state.successfulEndpoints },
            lastCheck: state.lastCheck,
            timeSinceLastCheck: Date.now() - state.lastCheck,
            pendingRequestsCount: state.pendingRequests.size,
            cacheSize: responseCache.size
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

    /**
     * Отримання базового URL API
     * @returns {string} Базовий URL API
     */
    function getApiBaseUrl() {
        // Спочатку перевіряємо налаштування WinixAPI
        if (window.WinixAPI && window.WinixAPI.config && window.WinixAPI.config.baseUrl) {
            // Видаляємо слеш в кінці, якщо є
            return window.WinixAPI.config.baseUrl.replace(/\/$/, '');
        }

        // Потім перевіряємо глобальну змінну
        if (window.API_BASE_URL) {
            return window.API_BASE_URL.replace(/\/$/, '');
        }

        // Якщо нічого не знайдено, використовуємо поточний домен
        return window.location.origin;
    }

    /**
     * Формування повного URL API
     * @param {string} endpoint - Ендпоінт
     * @returns {string} Повний URL API
     */
    function getApiUrl(endpoint) {
        // Видаляємо слеш на початку ендпоінту, якщо є
        const formattedEndpoint = endpoint.replace(/^\//, '');

        // Об'єднуємо базовий URL і ендпоінт
        return `${getApiBaseUrl()}/${formattedEndpoint}`;
    }

    /**
     * Отримання ID користувача з різних джерел
     * @returns {string|null} ID користувача або null
     */
    function getUserId() {
        // Функція для перевірки валідності ID
        function isValidId(id) {
            return id &&
                  typeof id === 'string' &&
                  id !== 'undefined' &&
                  id !== 'null' &&
                  id.length > 3;
        }

        // Масив функцій для отримання ID з різних джерел
        const idProviders = [
            // 1. Глобальна змінна USER_ID
            () => window.USER_ID,

            // 2. Telegram WebApp
            () => {
                if (window.Telegram && window.Telegram.WebApp &&
                    window.Telegram.WebApp.initDataUnsafe &&
                    window.Telegram.WebApp.initDataUnsafe.user) {
                    return window.Telegram.WebApp.initDataUnsafe.user.id.toString();
                }
                return null;
            },

            // 3. User data з localStorage
            () => {
                try {
                    const userData = localStorage.getItem('user_data');
                    if (userData) {
                        const parsed = JSON.parse(userData);
                        if (parsed && parsed.telegram_id) {
                            return parsed.telegram_id.toString();
                        }
                    }
                } catch (e) {}
                return null;
            },

            // 4. Telegram ID з localStorage
            () => {
                try {
                    return localStorage.getItem('telegram_user_id');
                } catch (e) {}
                return null;
            },

            // 5. DOM-елемент user-id
            () => {
                const userIdElement = document.getElementById('user-id');
                if (userIdElement && userIdElement.textContent) {
                    return userIdElement.textContent.trim();
                }
                return null;
            },

            // 6. URL-параметри
            () => {
                try {
                    const urlParams = new URLSearchParams(window.location.search);
                    return urlParams.get('id') || urlParams.get('user_id') || urlParams.get('telegram_id');
                } catch (e) {}
                return null;
            },

            // 7. WinixAPI, якщо доступний
            () => {
                if (window.WinixAPI && window.WinixAPI.getUserId) {
                    try {
                        return window.WinixAPI.getUserId();
                    } catch (e) {}
                }
                return null;
            }
        ];

        // Перебираємо всі джерела, поки не знайдемо валідний ID
        for (const provider of idProviders) {
            try {
                const id = provider();
                if (isValidId(id)) {
                    return id;
                }
            } catch (e) {
                // Ігноруємо помилки при спробі отримати ID
            }
        }

        // ID не знайдено в жодному джерелі
        return null;
    }

    /**
     * Виконання запиту до API з повторними спробами та обробкою помилок
     * @param {string} endpoint - Шлях до ендпоінту
     * @param {Object} options - Опції запиту
     * @returns {Promise<Object>} Результат запиту
     */
    async function apiRequest(endpoint, options = {}) {
        // Якщо пристрій офлайн, відразу повертаємо помилку
        if (!state.isOnline) {
            const error = new Error("Пристрій офлайн");
            error.code = "OFFLINE";
            throw error;
        }

        // Встановлюємо значення за замовчуванням
        const defaultOptions = {
            method: 'GET',
            data: null,
            timeout: config.requestTimeout,
            retries: config.maxRetries,
            retryDelay: config.retryDelay,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            useCache: config.useResponseCaching,
            preventDuplicates: config.preventDuplicateRequests
        };

        // Об'єднуємо з переданими опціями
        const requestOptions = { ...defaultOptions, ...options };

        // Формуємо повний URL
        const url = getApiUrl(endpoint);

        // Створюємо унікальний ключ для запиту
        const requestKey = `${requestOptions.method}_${url}_${JSON.stringify(requestOptions.data || {})}`;

        // Перевіряємо кеш для GET-запитів
        if (requestOptions.method === 'GET' && requestOptions.useCache && responseCache.has(requestKey)) {
            const cachedResponse = responseCache.get(requestKey);

            // Перевіряємо, чи кеш ще актуальний
            if (cachedResponse.expiresAt > Date.now()) {
                if (config.debug) {
                    console.log(`APIConnectivity: Повернуто кешовану відповідь для ${url}`);
                }
                return cachedResponse.data;
            } else {
                // Видаляємо застарілий кеш
                responseCache.delete(requestKey);
            }
        }

        // Перевіряємо, чи не виконується вже такий самий запит
        if (requestOptions.preventDuplicates && state.pendingRequests.has(requestKey)) {
            const pendingRequest = state.pendingRequests.get(requestKey);

            // Перевіряємо, чи запит не застарів
            if (Date.now() - pendingRequest.startTime < config.duplicateRequestsLockTime) {
                if (config.debug) {
                    console.log(`APIConnectivity: Виявлено дублюючий запит, очікування результату для ${url}`);
                }

                // Повертаємо результат вже запущеного запиту
                return pendingRequest.promise;
            } else {
                // Видаляємо застарілий запит
                state.pendingRequests.delete(requestKey);
            }
        }

        // Логуємо запит
        if (config.debug) {
            console.log(`APIConnectivity: Виконується запит ${requestOptions.method} ${url}`);
        }

        // Виконуємо запит з повторними спробами
        let attempt = 0;
        let lastError = null;
        let delayMs = requestOptions.retryDelay;

        // Створюємо проміс для запиту
        const requestPromise = (async () => {
            while (attempt <= requestOptions.retries) {
                try {
                    // Збільшуємо лічильник спроб
                    attempt++;

                    // Налаштування запиту
                    const fetchOptions = {
                        method: requestOptions.method,
                        headers: requestOptions.headers
                    };

                    // Додаємо тіло запиту для методів POST/PUT
                    if (requestOptions.data && (requestOptions.method === 'POST' || requestOptions.method === 'PUT')) {
                        fetchOptions.body = JSON.stringify(requestOptions.data);
                    }

                    // Створюємо AbortController для контролю таймауту
                    const controller = new AbortController();
                    fetchOptions.signal = controller.signal;

                    // Встановлюємо таймаут
                    const timeoutId = setTimeout(() => controller.abort(), requestOptions.timeout);

                    // Додаємо ID користувача в заголовок, якщо він є
                    const userId = getUserId();
                    if (userId) {
                        fetchOptions.headers['X-Telegram-User-Id'] = userId;
                    }

                    // Виконуємо запит
                    const response = await fetch(url, fetchOptions);

                    // Очищаємо таймаут
                    clearTimeout(timeoutId);

                    // Парсимо відповідь
                    let responseData;

                    // Для JSON-відповідей
                    if (response.headers.get('content-type')?.includes('application/json')) {
                        responseData = await response.json();
                    } else {
                        // Для інших типів відповідей
                        responseData = {
                            status: response.ok ? 'success' : 'error',
                            statusCode: response.status,
                            statusText: response.statusText,
                            data: await response.text()
                        };
                    }

                    // Додаємо HTTP статус до відповіді для зручності
                    responseData.httpStatus = response.status;

                    // Перевіряємо на помилки API
                    if (response.ok) {
                        // Зберігаємо успішну відповідь в кеш для GET-запитів
                        if (requestOptions.method === 'GET' && requestOptions.useCache) {
                            responseCache.set(requestKey, {
                                data: responseData,
                                expiresAt: Date.now() + config.responseCacheTime,
                                timestamp: Date.now()
                            });
                        }

                        // Зберігаємо статистику успішних запитів
                        if (!state.requestHistory[endpoint]) {
                            state.requestHistory[endpoint] = { success: 0, failure: 0 };
                        }
                        state.requestHistory[endpoint].success++;

                        return responseData;
                    } else {
                        // Обробляємо помилку від API
                        const errorMessage = responseData.message || response.statusText || 'Невідома помилка API';
                        const error = new Error(errorMessage);
                        error.response = responseData;
                        error.status = response.status;
                        error.code = "API_ERROR";

                        // Зберігаємо статистику невдалих запитів
                        if (!state.requestHistory[endpoint]) {
                            state.requestHistory[endpoint] = { success: 0, failure: 0 };
                        }
                        state.requestHistory[endpoint].failure++;

                        // Для 4xx помилок не робимо повторних спроб (крім 429 - Too Many Requests)
                        if (response.status >= 400 && response.status < 500 && response.status !== 429) {
                            throw error;
                        }

                        // Для інших помилок - виконуємо повторні спроби
                        lastError = error;
                    }
                } catch (error) {
                    // Обробляємо помилки fetch
                    lastError = error;

                    // Для деяких помилок не робимо повторних спроб
                    if (error.code === "API_ERROR" && error.status && error.status >= 400 && error.status < 500 && error.status !== 429) {
                        throw error;
                    }

                    // Зберігаємо статистику невдалих запитів
                    if (!state.requestHistory[endpoint]) {
                        state.requestHistory[endpoint] = { success: 0, failure: 0 };
                    }
                    state.requestHistory[endpoint].failure++;
                }

                // Якщо це остання спроба, вибиваємо помилку
                if (attempt > requestOptions.retries) {
                    break;
                }

                // Зачекаємо перед наступною спробою
                if (config.debug) {
                    console.log(`APIConnectivity: Спроба ${attempt} невдала, повторна спроба через ${delayMs}мс`);
                }

                await new Promise(resolve => setTimeout(resolve, delayMs));

                // Збільшуємо затримку для наступної спроби
                delayMs *= 1.5;
            }

            // Якщо всі спроби невдалі, викидаємо останню помилку
            throw lastError || new Error("Помилка запиту API");
        })();

        // Зберігаємо запит у список очікуючих
        if (requestOptions.preventDuplicates) {
            state.pendingRequests.set(requestKey, {
                promise: requestPromise,
                startTime: Date.now()
            });

            // Видаляємо запит із списку після завершення або по таймауту
            Promise.race([
                requestPromise,
                new Promise(resolve => setTimeout(resolve, config.duplicateRequestsLockTime))
            ]).finally(() => {
                state.pendingRequests.delete(requestKey);
            });
        }

        return requestPromise;
    }

    /**
     * Очищення кешу відповідей
     * @param {string} [endpoint] - Опціонально, конкретний ендпоінт для очищення
     * @returns {number} Кількість видалених записів
     */
    function clearResponseCache(endpoint) {
        let deletedCount = 0;

        if (endpoint) {
            // Видаляємо кеш тільки для вказаного ендпоінту
            for (const [key, _] of responseCache.entries()) {
                if (key.includes(endpoint)) {
                    responseCache.delete(key);
                    deletedCount++;
                }
            }
        } else {
            // Видаляємо весь кеш
            deletedCount = responseCache.size;
            responseCache.clear();
        }

        if (config.debug) {
            console.log(`APIConnectivity: Очищено ${deletedCount} записів кешу ${endpoint ? 'для ' + endpoint : ''}`);
        }

        return deletedCount;
    }

    /**
     * Отримання статистики запитів
     * @returns {Object} Статистика запитів
     */
    function getRequestStats() {
        const totalRequests = Object.values(state.requestHistory).reduce(
            (acc, curr) => {
                acc.success += curr.success;
                acc.failure += curr.failure;
                return acc;
            },
            { success: 0, failure: 0 }
        );

        return {
            byEndpoint: state.requestHistory,
            total: totalRequests,
            successRate: totalRequests.success + totalRequests.failure > 0
                ? (totalRequests.success / (totalRequests.success + totalRequests.failure)) * 100
                : 0,
            cacheSize: responseCache.size,
            pendingRequests: state.pendingRequests.size
        };
    }

    /**
     * Оновлення конфігурації
     * @param {Object} newConfig - Нові налаштування
     */
    function updateConfig(newConfig) {
        if (!newConfig || typeof newConfig !== 'object') return;

        Object.keys(newConfig).forEach(key => {
            if (key in config) {
                config[key] = newConfig[key];
            }
        });

        // Якщо змінився інтервал перевірки, перезапускаємо перевірку
        if ('checkIntervalTime' in newConfig) {
            startPeriodicCheck();
        }
    }

    // Встановлюємо початковий стан з'єднання
    state.isOnline = navigator.onLine;

    // Публічний API
    return {
        init,
        apiRequest,
        checkAPIAvailability,
        getConnectionState,
        resetFailureCounters,
        forceCheck,
        getUserId,
        clearResponseCache,
        getRequestStats,
        updateConfig,

        // Безпосередній доступ до стану
        isAPIAvailable: () => state.apiAvailable,
        isOnline: () => state.isOnline
    };
})();

// Ініціалізуємо систему при завантаженні сторінки
document.addEventListener('DOMContentLoaded', function() {
    window.APIConnectivity.init();
});