/**
 * APIConnectivity - оптимізований модуль для надійної взаємодії з API
 * Відповідає за:
 * - Перевірку доступності API та стабільності з'єднання
 * - Ефективну обробку запитів з повторними спробами
 * - Інтелектуальне кешування відповідей
 * - Обробку помилок та часових міток
 *
 * @version 2.0.0
 */

window.APIConnectivity = (function() {
    // Стан з'єднання - використовуємо більш компактну структуру
    const state = {
        isOnline: navigator.onLine,
        apiAvailable: true,
        lastCheck: 0,
        failedEndpoints: {},
        pendingRequests: new Map(),
        requestHistory: {}
    };

    // Оптимізована конфігурація з розумними значеннями за замовчуванням
    const config = {
        criticalEndpoints: ['api/ping', 'api/user/{userId}'],
        checkInterval: 60000,              // 1 хвилина
        checkTimeout: 5000,
        requestTimeout: 15000,
        maxRetries: 2,
        retryDelay: 1000,
        preventDuplicateRequests: true,
        duplicateRequestsLockTime: 5000,
        useResponseCaching: true,
        responseCacheTime: 300000,         // 5 хвилин
        debug: false
    };

    // Кеш відповідей з використанням Map для кращої продуктивності
    const responseCache = new Map();

    /**
     * Ініціалізація системи перевірки з'єднання
     * @param {Object} options - Налаштування
     */
    function init(options = {}) {
        console.log("APIConnectivity: Ініціалізація");

        // Застосовуємо передані опції
        if (options && typeof options === 'object') {
            Object.assign(config, options);
        }

        // Додаємо обробники мережевих подій
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);

        // Запускаємо періодичну перевірку API
        startPeriodicCheck();

        // Початкова перевірка API
        checkAPIAvailability();

        // Запускаємо періодичне очищення кешу
        scheduleCleanup();
    }

    /**
     * Періодичне очищення кешу відповідей
     */
    function scheduleCleanup() {
        // Очищаємо кеш кожні 5 хвилин
        setInterval(() => {
            cleanupCache();
        }, 300000);

        // Перше очищення
        cleanupCache();
    }

    /**
     * Очищення застарілих елементів кешу
     */
    function cleanupCache() {
        if (!config.useResponseCaching) return;

        const now = Date.now();
        let cleanedCount = 0;

        // Використовуємо Map.forEach для оптимальної продуктивності
        responseCache.forEach((entry, key) => {
            if (now > entry.expiresAt) {
                responseCache.delete(key);
                cleanedCount++;
            }
        });

        if (config.debug && cleanedCount > 0) {
            console.log(`APIConnectivity: Очищено ${cleanedCount} записів кешу`);
        }
    }

    /**
     * Обробник події відновлення з'єднання
     */
    function handleOnline() {
        state.isOnline = true;
        console.log("APIConnectivity: З'єднання з мережею відновлено");

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
        console.log("APIConnectivity: З'єднання з мережею втрачено");

        // Відправляємо подію
        document.dispatchEvent(new CustomEvent('api-connectivity-changed', {
            detail: { online: false }
        }));
    }

    /**
     * Запуск періодичної перевірки API
     */
    function startPeriodicCheck() {
        // Періодична перевірка
        setInterval(() => {
            if (state.isOnline) {
                checkAPIAvailability();
            }
        }, config.checkInterval);

        console.log(`APIConnectivity: Запущено періодичну перевірку (інтервал: ${config.checkInterval/1000}с)`);
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

        try {
            // Виконуємо простий запит до API
            const pingUrl = getApiUrl('api/ping');
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), config.checkTimeout);

            const response = await fetch(pingUrl, {
                method: 'GET',
                headers: { 'Accept': 'application/json' },
                signal: controller.signal
            });

            clearTimeout(timeoutId);

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
    }

    /**
     * Примусова перевірка з'єднання
     * @returns {Promise<boolean>} Результат перевірки
     */
    function forceCheck() {
        state.lastCheck = 0; // Скидаємо час останньої перевірки
        return checkAPIAvailability();
    }

    /**
     * Отримання базового URL API
     * @returns {string} Базовий URL API
     */
    function getApiBaseUrl() {
        // Спочатку перевіряємо налаштування WinixAPI
        if (window.WinixAPI?.config?.baseUrl) {
            return window.WinixAPI.config.baseUrl.replace(/\/$/, '');
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
        const formattedEndpoint = endpoint.replace(/^\//, '');
        return `${getApiBaseUrl()}/${formattedEndpoint}`;
    }

    /**
     * Отримання ID користувача з різних джерел
     * @returns {string|null} ID користувача або null
     */
    function getUserId() {
        // Спрощений алгоритм для отримання ID
        const sources = [
            // Функції
            typeof window.getUserId === 'function' ? window.getUserId() : null,
            typeof window.WinixAPI?.getUserId === 'function' ? window.WinixAPI.getUserId() : null,

            // Локальне сховище
            localStorage.getItem('telegram_user_id'),

            // URL параметри
            new URLSearchParams(window.location.search).get('id'),
            new URLSearchParams(window.location.search).get('user_id'),
            new URLSearchParams(window.location.search).get('telegram_id')
        ];

        // Повертаємо перше валідне значення
        for (const id of sources) {
            if (id && typeof id === 'string' && id !== 'undefined' && id !== 'null' && id.length > 3) {
                return id;
            }
        }

        return null;
    }

    /**
     * Перетворення дати в UTC формат ISO 8601
     * @param {Date} date - Дата для форматування
     * @returns {string} Дата в форматі ISO 8601 з UTC
     */
    function formatDateToUTC(date) {
        if (!date) date = new Date();
        return date.toISOString();
    }

    /**
     * Парсинг рядка ISO 8601 до об'єкту Date
     * @param {string} dateString - Рядок дати у форматі ISO 8601
     * @returns {Date} Об'єкт Date
     */
    function parseISODate(dateString) {
        if (!dateString) return null;
        try {
            return new Date(dateString);
        } catch (e) {
            return null;
        }
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
            throw new Error("Пристрій офлайн");
        }

        // Налаштування за замовчуванням
        const requestOptions = {
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
            preventDuplicates: config.preventDuplicateRequests,
            ...options
        };

        // Формуємо повний URL
        const url = getApiUrl(endpoint);

        // Створюємо унікальний ключ для запиту
        const requestKey = `${requestOptions.method}_${url}_${JSON.stringify(requestOptions.data || {})}`;

        // Перевіряємо кеш для GET-запитів
        if (requestOptions.method === 'GET' && requestOptions.useCache && responseCache.has(requestKey)) {
            const cachedResponse = responseCache.get(requestKey);

            if (cachedResponse.expiresAt > Date.now()) {
                if (config.debug) {
                    console.log(`APIConnectivity: Повернуто кешовану відповідь для ${url}`);
                }
                return cachedResponse.data;
            } else {
                responseCache.delete(requestKey);
            }
        }

        // Перевіряємо, чи не виконується вже такий самий запит
        if (requestOptions.preventDuplicates && state.pendingRequests.has(requestKey)) {
            const pendingRequest = state.pendingRequests.get(requestKey);

            if (Date.now() - pendingRequest.startTime < config.duplicateRequestsLockTime) {
                if (config.debug) {
                    console.log(`APIConnectivity: Дублюючий запит, очікуємо результату для ${url}`);
                }
                return pendingRequest.promise;
            } else {
                state.pendingRequests.delete(requestKey);
            }
        }

        // Створюємо проміс для запиту
        const requestPromise = executeRequest(endpoint, url, requestOptions, requestKey);

        // Зберігаємо запит у список очікуючих
        if (requestOptions.preventDuplicates) {
            state.pendingRequests.set(requestKey, {
                promise: requestPromise,
                startTime: Date.now()
            });

            // Видаляємо запит зі списку після завершення
            requestPromise
                .then(() => state.pendingRequests.delete(requestKey))
                .catch(() => state.pendingRequests.delete(requestKey));
        }

        return requestPromise;
    }

    /**
     * Виконання запиту з повторними спробами
     * @param {string} endpoint - Ендпоінт
     * @param {string} url - Повний URL
     * @param {Object} requestOptions - Опції запиту
     * @param {string} requestKey - Ключ для кешування
     * @returns {Promise<Object>} Результат запиту
     */
    async function executeRequest(endpoint, url, requestOptions, requestKey) {
        let attempt = 0;
        let lastError = null;
        let delayMs = requestOptions.retryDelay;

        while (attempt <= requestOptions.retries) {
            try {
                attempt++;

                // Налаштування запиту
                const fetchOptions = {
                    method: requestOptions.method,
                    headers: requestOptions.headers
                };

                // Додаємо тіло запиту для методів POST/PUT
                if (requestOptions.data && (requestOptions.method === 'POST' || requestOptions.method === 'PUT')) {
                    // Підготовка даних з коректним форматом дат
                    const preparedData = prepareDateValues(requestOptions.data);
                    fetchOptions.body = JSON.stringify(preparedData);
                }

                // Додаємо ID користувача в заголовок, якщо він є
                const userId = getUserId();
                if (userId) {
                    fetchOptions.headers['X-User-Id'] = userId;
                }

                // Таймаут для запиту
                const controller = new AbortController();
                fetchOptions.signal = controller.signal;
                const timeoutId = setTimeout(() => controller.abort(), requestOptions.timeout);

                // Виконуємо запит
                const response = await fetch(url, fetchOptions);
                clearTimeout(timeoutId);

                // Парсимо відповідь
                let responseData;
                const contentType = response.headers.get('content-type');

                if (contentType?.includes('application/json')) {
                    responseData = await response.json();
                    processISODates(responseData);
                } else {
                    responseData = {
                        status: response.ok ? 'success' : 'error',
                        statusCode: response.status,
                        statusText: response.statusText,
                        data: await response.text()
                    };
                }

                responseData.httpStatus = response.status;

                // Якщо відповідь успішна
                if (response.ok) {
                    // Зберігаємо в кеш для GET-запитів
                    if (requestOptions.method === 'GET' && requestOptions.useCache) {
                        responseCache.set(requestKey, {
                            data: responseData,
                            expiresAt: Date.now() + config.responseCacheTime,
                            timestamp: Date.now()
                        });
                    }

                    // Оновлюємо статистику
                    updateRequestStats(endpoint, true);

                    return responseData;
                } else {
                    // Оновлюємо статистику помилок
                    updateRequestStats(endpoint, false);

                    // Для 4xx помилок не робимо повторних спроб (крім 429 - Too Many Requests)
                    if (response.status >= 400 && response.status < 500 && response.status !== 429) {
                        const error = new Error(responseData.message || response.statusText || 'Помилка API');
                        error.response = responseData;
                        error.status = response.status;
                        throw error;
                    }

                    // Для інших помилок - продовжуємо повторні спроби
                    lastError = new Error(responseData.message || response.statusText || 'Помилка API');
                    lastError.response = responseData;
                    lastError.status = response.status;
                }
            } catch (error) {
                updateRequestStats(endpoint, false);
                lastError = error;

                // Деякі помилки не потребують повторних спроб
                if (error.name === 'AbortError') {
                    throw new Error('Таймаут запиту');
                }

                if (error.status && error.status >= 400 && error.status < 500 && error.status !== 429) {
                    throw error;
                }
            }

            // Якщо це була остання спроба, вибиваємо помилку
            if (attempt > requestOptions.retries) {
                break;
            }

            // Зачекаємо перед наступною спробою
            await new Promise(resolve => setTimeout(resolve, delayMs));
            delayMs *= 1.5; // Збільшуємо затримку для наступної спроби
        }

        // Якщо всі спроби невдалі
        throw lastError || new Error("Помилка запиту API");
    }

    /**
     * Підготовка дат у даних для запиту
     * @param {Object} data - Дані для підготовки
     * @returns {Object} Підготовлені дані
     */
    function prepareDateValues(data) {
        if (!data || typeof data !== 'object') return data;

        const preparedData = Array.isArray(data) ? [...data] : {...data};

        for (const key in preparedData) {
            if (preparedData[key] instanceof Date) {
                preparedData[key] = formatDateToUTC(preparedData[key]);
            } else if (typeof preparedData[key] === 'object' && preparedData[key] !== null) {
                preparedData[key] = prepareDateValues(preparedData[key]);
            }
        }

        return preparedData;
    }

    /**
     * Оновлення статистики запитів
     * @param {string} endpoint - Ендпоінт
     * @param {boolean} success - Успішність запиту
     */
    function updateRequestStats(endpoint, success) {
        if (!state.requestHistory[endpoint]) {
            state.requestHistory[endpoint] = { success: 0, failure: 0 };
        }

        if (success) {
            state.requestHistory[endpoint].success++;
        } else {
            state.requestHistory[endpoint].failure++;
        }
    }

    /**
     * Рекурсивна обробка дат в ISO форматі
     * @param {Object} obj - Об'єкт для обробки
     */
    function processISODates(obj) {
        if (!obj || typeof obj !== 'object') return;

        // ISO 8601 регулярний вираз (спрощений)
        const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?$/;

        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                const value = obj[key];

                if (typeof value === 'string' && isoDateRegex.test(value)) {
                    obj[key] = parseISODate(value);
                } else if (value && typeof value === 'object') {
                    processISODates(value);
                }
            }
        }
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
            responseCache.forEach((_, key) => {
                if (key.includes(endpoint)) {
                    responseCache.delete(key);
                    deletedCount++;
                }
            });
        } else {
            // Видаляємо весь кеш
            deletedCount = responseCache.size;
            responseCache.clear();
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

        const total = totalRequests.success + totalRequests.failure;

        return {
            byEndpoint: state.requestHistory,
            total: totalRequests,
            successRate: total > 0 ? (totalRequests.success / total) * 100 : 0,
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

        Object.assign(config, newConfig);

        // Якщо змінився інтервал перевірки, перезапускаємо перевірку
        if ('checkInterval' in newConfig) {
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
        formatDateToUTC,
        parseISODate,
        isAPIAvailable: () => state.apiAvailable,
        isOnline: () => state.isOnline
    };
})();

// Ініціалізуємо систему при завантаженні сторінки
document.addEventListener('DOMContentLoaded', function() {
    window.APIConnectivity.init();
});