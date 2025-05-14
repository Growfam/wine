/**
 * API Connectivity Helpers - Набір функцій для забезпечення стабільного з'єднання з API
 * Виявляє та вирішує проблеми з підключенням до API
 * Оптимізовано для системи щоденних бонусів і запобігання дублюванню запитів
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
        checkInterval: null,
        pendingRequests: new Map(), // Зберігаємо активні запити для запобігання дублюванню
        requestHistory: {},         // Історія успішних запитів для аналізу
        serverTimeOffset: 0         // Різниця між часом сервера і клієнта
    };

    // Конфігурація
    const config = {
        // Список критичних ендпоінтів для перевірки доступності API
        criticalEndpoints: [
            'api/ping',
            'api/user/{userId}',
            'api/user/{userId}/daily-bonus',
            'api/quests/tasks/social'
        ],
        // Інтервал перевірки API у мілісекундах
        checkIntervalTime: 60000, // 1 хвилина
        // Кількість послідовних помилок для переходу в режим fallback
        maxConsecutiveFailures: 3,
        // Таймаут для запитів перевірки
        checkTimeout: 5000,
        // Таймаут для звичайних запитів
        requestTimeout: 15000,
        // Максимальна кількість повторних спроб для запитів
        maxRetries: 2,
        // Початкова затримка між повторними спробами (мс)
        retryDelay: 1000,
        // Чи використовувати експоненційне збільшення затримки
        useExponentialBackoff: true,
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

        // Синхронізуємо час з сервером
        if (state.isOnline) {
            synchronizeServerTime();
        }

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
     * Синхронізація часу з сервером
     */
    async function synchronizeServerTime() {
        try {
            const startTime = Date.now();
            const response = await fetch(getApiBaseUrl() + '/api/ping?' + Date.now(), {
                method: 'GET',
                headers: {
                    'Accept': 'application/json'
                },
                timeout: config.checkTimeout
            });

            if (response.ok) {
                const data = await response.json();
                const endTime = Date.now();
                const roundTripTime = endTime - startTime;

                // Отримуємо час сервера
                if (data && data.timestamp) {
                    const serverTime = new Date(data.timestamp).getTime();
                    const clientTime = startTime + (roundTripTime / 2);

                    // Обчислюємо різницю
                    state.serverTimeOffset = serverTime - clientTime;

                    if (config.debug) {
                        console.log(`APIConnectivity: Синхронізовано час. Зміщення: ${state.serverTimeOffset}мс, RTT: ${roundTripTime}мс`);
                    }
                }
            }
        } catch (error) {
            console.warn("APIConnectivity: Помилка синхронізації часу:", error);
        }
    }

    /**
     * Отримання поточного часу сервера
     * @returns {number} Поточний час сервера у мілісекундах
     */
    function getServerTime() {
        return Date.now() + state.serverTimeOffset;
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

        // Синхронізуємо час
        synchronizeServerTime();
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
                    let url = getApiUrl(formattedEndpoint);

                    // Додаємо параметр для запобігання кешуванню
                    url += (url.includes('?') ? '&' : '?') + `_t=${Date.now()}`;

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
                            timestamp: now,
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
            timeSinceLastCheck: Date.now() - state.lastCheck,
            serverTimeOffset: state.serverTimeOffset,
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

            // 3. Telegram WebView Proxy
            () => {
                if (window.telegramWebviewProxy &&
                    window.telegramWebviewProxy.initDataUnsafe &&
                    window.telegramWebviewProxy.initDataUnsafe.user) {
                    return window.telegramWebviewProxy.initDataUnsafe.user.id.toString();
                }
                return null;
            },

            // 4. User data з localStorage
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

            // 5. Telegram ID з localStorage
            () => {
                try {
                    return localStorage.getItem('telegram_user_id');
                } catch (e) {}
                return null;
            },

            // 6. DOM-елемент user-id
            () => {
                const userIdElement = document.getElementById('user-id');
                if (userIdElement && userIdElement.textContent) {
                    return userIdElement.textContent.trim();
                }
                return null;
            },

            // 7. URL-параметри
            () => {
                try {
                    const urlParams = new URLSearchParams(window.location.search);
                    return urlParams.get('id') || urlParams.get('user_id') || urlParams.get('telegram_id');
                } catch (e) {}
                return null;
            },

            // 8. Глобальна функція getUserId
            () => {
                if (window.getUserId && typeof window.getUserId === 'function') {
                    try {
                        return window.getUserId();
                    } catch (e) {}
                }
                return null;
            },

            // 9. WinixAPI, якщо доступний
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
            if (requestOptions.data) {
                console.log("APIConnectivity: Дані запиту:", requestOptions.data);
            }
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

                            if (config.debug) {
                                console.log(`APIConnectivity: Кешовано відповідь для ${url}`);
                            }
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

                // Збільшуємо затримку для наступної спроби при експоненційному відтермінуванні
                if (config.useExponentialBackoff) {
                    delayMs *= 2;
                }
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

                if (config.debug) {
                    console.log(`APIConnectivity: Оновлено конфігурацію: ${key} = ${newConfig[key]}`);
                }
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
        isEndpointAvailable,
        setFallbackMode,
        getConnectionState,
        resetFailureCounters,
        forceCheck,
        getUserId,
        getServerTime,
        clearResponseCache,
        getRequestStats,
        updateConfig,
        synchronizeServerTime,

        // Безпосередній доступ до стану
        isFallbackMode: () => state.fallbackMode,
        isAPIAvailable: () => state.apiAvailable,
        isOnline: () => state.isOnline
    };
})();

// Ініціалізуємо систему при завантаженні сторінки
document.addEventListener('DOMContentLoaded', function() {
    // Ініціалізуємо тільки якщо цей модуль увімкнено
    window.APIConnectivity.init();
});