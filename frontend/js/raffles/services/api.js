/**
 * raffles-api.js - Спеціалізований модуль для API розіграшів WINIX
 * Працює паралельно з основним WinixAPI, але відповідає лише за функціональність розіграшів
 */

// Використовуємо IIFE для ізоляції змінних
(function() {
    'use strict';

    console.log("🎲 Raffles API: Ініціалізація модуля");

    // ======== ПРИВАТНІ ЗМІННІ ========

    const API_BASE_URL = '/api';

    // Дані авторизації
    let _token = null;
    let _userId = null;
    // Видалена невикористана змінна _userData

    // Кешування даних
    let _cachedResponses = {};
    let _cacheTTL = 300000; // 5 хвилин

    // Відстеження запитів
    let _lastRequestTime = 0;
    let _requestsInProgress = {};

    // Обмеження запитів
    const REQUEST_THROTTLE = {
        '/raffles-history': 15000,      // 15 секунд для історії розіграшів
        '/participate-raffle': 3000,    // 3 секунди для участі в розіграшах
        'default': 2000                 // 2 секунди для всіх інших
    };

    // Максимальна кількість паралельних запитів
    const PARALLEL_REQUESTS_LIMIT = 5;

    // Таймаути для запитів
    let _requestTimeouts = {};

    // Режим налагодження
    let _debugMode = false;

    // ======== ДОПОМІЖНІ ФУНКЦІЇ ========

    /**
     * Отримати час обмеження для ендпоінту
     * @param {string} endpoint - URL ендпоінту
     * @returns {number} - Час обмеження в мілісекундах
     */
    function getThrottleTime(endpoint) {
        for (const key in REQUEST_THROTTLE) {
            if (endpoint.includes(key)) {
                return REQUEST_THROTTLE[key];
            }
        }
        return REQUEST_THROTTLE.default;
    }

    /**
     * Отримати ID користувача з усіх можливих джерел
     * @returns {string|null} - ID користувача
     */
    function getUserId() {
        // 1. Використовуємо кешований ID, якщо він є
        if (_userId) {
            return _userId;
        }

        // 2. Спробуємо отримати ID із старого API
        if (window.WinixAPI && typeof window.WinixAPI.getUserId === 'function') {
            const legacyId = window.WinixAPI.getUserId();
            if (legacyId) {
                _userId = legacyId;
                return _userId;
            }
        }

        // 3. Перевіряємо Telegram WebApp
        if (window.Telegram && window.Telegram.WebApp) {
            try {
                if (window.Telegram.WebApp.initDataUnsafe &&
                    window.Telegram.WebApp.initDataUnsafe.user &&
                    window.Telegram.WebApp.initDataUnsafe.user.id) {

                    _userId = window.Telegram.WebApp.initDataUnsafe.user.id.toString();
                    return _userId;
                }
            } catch (e) {
                console.warn("🎲 Raffles API: Помилка отримання ID з Telegram WebApp:", e);
            }
        }

        // 4. Перевіряємо localStorage
        try {
            const localId = localStorage.getItem('telegram_user_id');
            if (localId) {
                _userId = localId;
                return _userId;
            }
        } catch (e) {}

        // ID не знайдено
        return null;
    }

    /**
     * Отримання токену авторизації
     * @returns {string|null} - Токен авторизації
     */
    function getAuthToken() {
        // 1. Використовуємо кешований токен, якщо він є
        if (_token) {
            return _token;
        }

        // 2. Спробуємо отримати токен з localStorage
        try {
            _token = localStorage.getItem('auth_token');
            return _token;
        } catch (e) {}

        return null;
    }

    /**
     * Кешування відповіді
     * @param {string} key - Ключ кешу
     * @param {Object} data - Дані для кешування
     */
    function cacheResponse(key, data) {
        _cachedResponses[key] = {
            data: data,
            timestamp: Date.now()
        };
    }

    /**
     * Отримання кешованої відповіді
     * @param {string} key - Ключ кешу
     * @returns {Object|null} - Кешована відповідь або null
     */
    function getCachedResponse(key) {
        const cached = _cachedResponses[key];
        if (cached && (Date.now() - cached.timestamp) < _cacheTTL) {
            if (_debugMode) {
                console.log(`🎲 Raffles API: Використовую кешовану відповідь для ${key}`);
            }
            return {
                ...cached.data,
                source: 'cache'
            };
        }
        return null;
    }

    /**
     * Встановлення таймауту для запиту
     * @param {string} requestKey - Ключ запиту
     * @param {AbortController} controller - Контролер для переривання запиту
     * @param {number} timeout - Час очікування в мілісекундах
     */
    function setRequestTimeout(requestKey, controller, timeout) {
        if (_requestTimeouts[requestKey]) {
            clearTimeout(_requestTimeouts[requestKey]);
        }

        _requestTimeouts[requestKey] = setTimeout(() => {
            controller.abort();
            delete _requestTimeouts[requestKey];
            delete _requestsInProgress[requestKey];
            console.warn(`🎲 Raffles API: Таймаут запиту ${requestKey}`);
        }, timeout);
    }

    /**
     * Очищення таймауту запиту
     * @param {string} requestKey - Ключ запиту
     */
    function clearRequestTimeout(requestKey) {
        if (_requestTimeouts[requestKey]) {
            clearTimeout(_requestTimeouts[requestKey]);
            delete _requestTimeouts[requestKey];
        }
    }

    // ======== ОСНОВНА ФУНКЦІЯ API ЗАПИТУ ========

    /**
     * Універсальна функція для виконання API-запитів до системи розіграшів
     * @param {string} endpoint - URL ендпоінту
     * @param {string} method - HTTP метод (GET, POST, PUT, DELETE)
     * @param {Object} data - Дані для відправки
     * @param {Object} options - Додаткові параметри
     * @returns {Promise<Object>} - Результат запиту
     */
    async function apiRequest(endpoint, method = 'GET', data = null, options = {}) {
        try {
            // Перевіряємо наявність ендпоінту
            if (!endpoint) {
                return Promise.reject({
                    status: 'error',
                    message: 'Ендпоінт не вказано',
                    source: 'validation'
                });
            }

            // Нормалізуємо метод
            method = method.toUpperCase();

            // Формуємо ключі для відстеження запитів
            const requestKey = `${method}:${endpoint}:${JSON.stringify(data || {})}`;
            // Видалена невикористана змінна requestEndpointKey

            // Перевіряємо обмеження частоти запитів
            const now = Date.now();
            const timeSinceLastRequest = now - _lastRequestTime;
            const throttleTime = getThrottleTime(endpoint);

            if (timeSinceLastRequest < throttleTime && !options.ignoreThrottle) {
                console.warn(`🎲 Raffles API: Занадто частий запит до ${endpoint}, минуло ${timeSinceLastRequest}ms`);

                // Спеціальна обробка для історії розіграшів
                if (endpoint.includes('/raffles-history')) {
                    console.log("🎲 Raffles API: Повертаю порожній масив для занадто частого запиту історії розіграшів");
                    return Promise.resolve({
                        status: 'success',
                        data: [],
                        source: 'throttle_fallback'
                    });
                }

                // Повертаємо помилку для інших запитів
                return Promise.reject({
                    status: 'error',
                    source: 'throttle',
                    message: "Занадто частий запит",
                    retryAfter: throttleTime - timeSinceLastRequest,
                    endpoint: endpoint
                });
            }

            // Оновлюємо час останнього запиту
            _lastRequestTime = now;

            // Перевіряємо кеш для GET запитів
            if (method === 'GET' && !options.bypassCache) {
                const cachedResponse = getCachedResponse(requestKey);
                if (cachedResponse) {
                    return cachedResponse;
                }
            }

            // Перевіряємо, чи цей запит уже в процесі виконання
            if (_requestsInProgress[requestKey] && !options.allowParallel) {
                console.warn(`🎲 Raffles API: Дублікат запиту виявлено: ${endpoint}`);
                return Promise.reject({
                    status: 'error',
                    source: 'duplicate',
                    message: "Запит вже виконується",
                    endpoint: endpoint
                });
            }

            // Перевіряємо ліміт паралельних запитів
            const activeRequestsCount = Object.keys(_requestsInProgress).length;
            if (activeRequestsCount >= PARALLEL_REQUESTS_LIMIT && !options.allowParallel) {
                console.warn(`🎲 Raffles API: Досягнуто ліміт паралельних запитів (${PARALLEL_REQUESTS_LIMIT})`);
                return Promise.reject({
                    status: 'error',
                    source: 'parallel_limit',
                    message: "Досягнуто ліміт паралельних запитів",
                    endpoint: endpoint
                });
            }

            // Позначаємо запит як виконуваний
            _requestsInProgress[requestKey] = true;

            // Отримуємо ID користувача
            const userId = getUserId();

            // Отримуємо токен авторизації
            const authToken = getAuthToken();

            // Додаємо мітку часу для запобігання кешуванню
            const timestamp = Date.now();
            const hasQuery = endpoint.includes('?');
            const url = `${API_BASE_URL}${endpoint}${hasQuery ? '&' : '?'}t=${timestamp}`;

            // Готуємо заголовки
            const headers = {
                'Content-Type': 'application/json',
                ...options.headers
            };

            // Додаємо ID користувача і токен авторизації, якщо вони є
            if (userId) {
                headers['X-Telegram-User-Id'] = userId;
            }

            if (authToken) {
                headers['Authorization'] = authToken.startsWith('Bearer ') ?
                    authToken : `Bearer ${authToken}`;
            }

            // Готуємо параметри запиту
            const requestOptions = {
                method: method,
                headers: headers,
                mode: 'cors',
                cache: 'no-cache',
                credentials: 'same-origin',
                redirect: 'follow',
                referrerPolicy: 'no-referrer'
            };

            // Додаємо тіло запиту для POST, PUT, PATCH
            if (data && ['POST', 'PUT', 'PATCH'].includes(method)) {
                requestOptions.body = JSON.stringify(data);
            }

            // Створюємо контролер для таймауту
            const controller = new AbortController();
            requestOptions.signal = controller.signal;

            // Встановлюємо таймаут
            const timeout = options.timeout || 10000;
            setRequestTimeout(requestKey, controller, timeout);

            // Показуємо індикатор завантаження
            if (!options.hideLoader) {
                if (typeof window.showLoading === 'function') {
                    window.showLoading('Завантаження розіграшів...');
                }
            }

            try {
                // Виконуємо запит
                const response = await fetch(url, requestOptions);

                // Обробляємо відповідь
                if (!response.ok) {
                    // Спеціальна обробка для історії розіграшів при помилках сервера
                    if (endpoint.includes('/raffles-history') && response.status >= 500) {
                        console.warn(`🎲 Raffles API: Помилка сервера при запиті історії розіграшів, повертаю порожній масив`);
                        return {
                            status: 'success',
                            data: [],
                            source: 'error_fallback'
                        };
                    }

                    throw new Error(`Помилка сервера: ${response.status}`);
                }

                // Парсимо відповідь
                const jsonData = await response.json();

                // Кешуємо відповідь для GET запитів
                if (method === 'GET') {
                    cacheResponse(requestKey, jsonData);
                }

                return jsonData;
            } catch (error) {
                // Обробка спеціальних помилок для розіграшів
                if (endpoint.includes('/raffles-history')) {
                    console.warn(`🎲 Raffles API: Помилка при запиті історії розіграшів: ${error.message}, повертаю порожній масив`);
                    return {
                        status: 'success',
                        data: [],
                        source: 'error_fallback'
                    };
                }

                throw error;
            } finally {
                // Знімаємо таймаут і прапорець виконання
                clearRequestTimeout(requestKey);
                delete _requestsInProgress[requestKey];

                // Приховуємо індикатор завантаження
                if (!options.hideLoader) {
                    if (typeof window.hideLoading === 'function') {
                        window.hideLoading();
                    }
                }
            }
        } catch (error) {
            console.error(`🎲 Raffles API: Помилка запиту ${endpoint}:`, error.message);

            // Генеруємо подію про помилку API
            document.dispatchEvent(new CustomEvent('raffles-api-error', {
                detail: {
                    error: error,
                    endpoint: endpoint,
                    method: method
                }
            }));

            // Повертаємо об'єкт з помилкою
            return {
                status: 'error',
                message: error.message || 'Сталася помилка при виконанні запиту',
                source: error.source || 'unknown'
            };
        }
    }

    // ======== СПЕЦІАЛІЗОВАНІ ФУНКЦІЇ ДЛЯ РОЗІГРАШІВ ========

    /**
     * Отримання списку активних розіграшів
     * @param {Object} params - Параметри запиту
     * @returns {Promise<Object>} - Список розіграшів
     */
    async function getRaffles(params = {}) {
        try {
            const queryParams = new URLSearchParams();

            // Додаємо параметри запиту
            if (params.page) queryParams.append('page', params.page);
            if (params.limit) queryParams.append('limit', params.limit);
            if (params.status) queryParams.append('status', params.status);

            const endpoint = `/raffles${queryParams.toString() ? '?' + queryParams.toString() : ''}`;

            return await apiRequest(endpoint, 'GET', null, {
                timeout: 8000,
                bypassCache: params.forceRefresh
            });
        } catch (error) {
            console.error("🎲 Raffles API: Помилка отримання списку розіграшів:", error);
            return {
                status: 'error',
                message: 'Не вдалося отримати список розіграшів'
            };
        }
    }

    /**
     * Отримання деталей розіграшу
     * @param {string} raffleId - ID розіграшу
     * @returns {Promise<Object>} - Деталі розіграшу
     */
    async function getRaffleDetails(raffleId) {
        try {
            if (!raffleId) {
                throw new Error("ID розіграшу не вказано");
            }

            return await apiRequest(`/raffles/${raffleId}`, 'GET', null, {
                timeout: 8000
            });
        } catch (error) {
            console.error(`🎲 Raffles API: Помилка отримання деталей розіграшу ${raffleId}:`, error);
            return {
                status: 'error',
                message: 'Не вдалося отримати деталі розіграшу'
            };
        }
    }

    /**
     * Отримання історії розіграшів користувача
     * @param {Object} params - Параметри запиту
     * @returns {Promise<Object>} - Історія розіграшів
     */
    async function getRafflesHistory(params = {}) {
        try {
            const userId = getUserId();
            if (!userId) {
                throw new Error("ID користувача не знайдено");
            }

            const queryParams = new URLSearchParams();

            // Додаємо параметри запиту
            if (params.page) queryParams.append('page', params.page);
            if (params.limit) queryParams.append('limit', params.limit);
            if (params.status) queryParams.append('status', params.status);

            const endpoint = `/raffles-history${queryParams.toString() ? '?' + queryParams.toString() : ''}`;

            return await apiRequest(endpoint, 'GET', null, {
                timeout: 10000,
                bypassCache: params.forceRefresh
            });
        } catch (error) {
            console.error("🎲 Raffles API: Помилка отримання історії розіграшів:", error);
            return {
                status: 'success',  // Повертаємо успіх з порожнім масивом для сумісності
                data: [],
                source: 'error_handler'
            };
        }
    }

    /**
     * Участь у розіграші
     * @param {string} raffleId - ID розіграшу
     * @param {Object} participationData - Дані для участі
     * @returns {Promise<Object>} - Результат участі
     */
    async function participateInRaffle(raffleId, participationData = {}) {
        try {
            const userId = getUserId();
            if (!userId) {
                throw new Error("ID користувача не знайдено");
            }

            if (!raffleId) {
                throw new Error("ID розіграшу не вказано");
            }

            // Формуємо дані для участі
            const data = {
                telegram_id: userId,
                ...participationData
            };

            return await apiRequest(`/participate-raffle/${raffleId}`, 'POST', data, {
                timeout: 8000
            });
        } catch (error) {
            console.error(`🎲 Raffles API: Помилка участі в розіграші ${raffleId}:`, error);
            return {
                status: 'error',
                message: 'Не вдалося взяти участь у розіграші'
            };
        }
    }

    /**
     * Отримання переможців розіграшу
     * @param {string} raffleId - ID розіграшу
     * @returns {Promise<Object>} - Список переможців
     */
    async function getRaffleWinners(raffleId) {
        try {
            if (!raffleId) {
                throw new Error("ID розіграшу не вказано");
            }

            return await apiRequest(`/raffles/${raffleId}/winners`, 'GET', null, {
                timeout: 8000
            });
        } catch (error) {
            console.error(`🎲 Raffles API: Помилка отримання переможців розіграшу ${raffleId}:`, error);
            return {
                status: 'error',
                message: 'Не вдалося отримати переможців розіграшу'
            };
        }
    }

    // ======== СЛУЖБОВІ ФУНКЦІЇ ========

    /**
     * Ініціалізація модуля API розіграшів
     * @param {Object} config - Конфігурація
     * @returns {Promise<boolean>} - Результат ініціалізації
     */
    async function init(config = {}) {
        try {
            console.log("🎲 Raffles API: Початок ініціалізації");

            // Встановлюємо режим налагодження
            if (typeof config.debugMode !== 'undefined') {
                _debugMode = config.debugMode;
            }

            // Отримуємо ID користувача з усіх можливих джерел
            _userId = getUserId();

            if (!_userId) {
                console.warn("🎲 Raffles API: ID користувача не знайдено, пробуємо інші джерела");

                // Перевіряємо старий API
                if (window.WinixAPI && typeof window.WinixAPI.getUserId === 'function') {
                    _userId = window.WinixAPI.getUserId();
                    if (_userId) {
                        console.log(`🎲 Raffles API: Отримано ID користувача з WinixAPI: ${_userId}`);
                    }
                }

                // Якщо ID все ще не знайдено, беремо з localStorage
                if (!_userId) {
                    _userId = localStorage.getItem('telegram_user_id');
                    if (_userId) {
                        console.log(`🎲 Raffles API: Отримано ID користувача з localStorage: ${_userId}`);
                    }
                }
            }

            // Отримуємо токен авторизації
            _token = getAuthToken();

            // Виконуємо тестовий запит для перевірки з'єднання
            try {
                const response = await apiRequest('/raffles', 'GET', null, {
                    timeout: 5000,
                    hideLoader: true,
                });

                if (response.status === 'success') {
                    console.log("🎲 Raffles API: Успішно ініціалізовано, з'єднання встановлено");

                    // Генеруємо подію про успішну ініціалізацію
                    document.dispatchEvent(new CustomEvent('raffles-api-ready', {
                        detail: { success: true }
                    }));

                    return true;
                } else {
                    console.warn("🎲 Raffles API: Ініціалізовано, але тестовий запит невдалий:", response.message);

                    // Генеруємо подію про часткову ініціалізацію
                    document.dispatchEvent(new CustomEvent('raffles-api-ready', {
                        detail: { success: true, warning: true, message: response.message }
                    }));

                    return true; // Все одно повертаємо успіх, бо API може працювати
                }
            } catch (error) {
                console.warn("🎲 Raffles API: Тестовий запит невдалий, але ініціалізація продовжена:", error.message);

                // Генеруємо подію про ініціалізацію з попередженням
                document.dispatchEvent(new CustomEvent('raffles-api-ready', {
                    detail: { success: true, warning: true, message: error.message }
                }));

                return true; // Все одно повертаємо успіх, ініціалізація виконана
            }
        } catch (error) {
            console.error("🎲 Raffles API: Помилка ініціалізації:", error);

            // Генеруємо подію про помилку ініціалізації
            document.dispatchEvent(new CustomEvent('raffles-api-error', {
                detail: { error: error, message: 'Помилка ініціалізації API розіграшів' }
            }));

            return false;
        }
    }

    /**
     * Очищення кешу API
     * @param {string} pattern - Шаблон для очищення конкретних ключів
     */
    function clearCache(pattern = null) {
        if (pattern) {
            // Очищення за шаблоном
            const keysToDelete = [];
            for (const key in _cachedResponses) {
                if (key.includes(pattern)) {
                    keysToDelete.push(key);
                }
            }

            keysToDelete.forEach(key => {
                delete _cachedResponses[key];
            });

            console.log(`🎲 Raffles API: Очищено ${keysToDelete.length} записів кешу за шаблоном "${pattern}"`);
        } else {
            // Очищення всього кешу
            _cachedResponses = {};
            console.log("🎲 Raffles API: Очищено весь кеш");
        }
    }

    /**
     * Примусове очищення всіх активних запитів
     * @returns {number} - Кількість очищених запитів
     */
    function forceCleanupRequests() {
        const count = Object.keys(_requestsInProgress).length;

        // Очищення активних запитів
        _requestsInProgress = {};

        // Очищення таймаутів
        for (const key in _requestTimeouts) {
            clearTimeout(_requestTimeouts[key]);
            delete _requestTimeouts[key];
        }

        console.log(`🎲 Raffles API: Примусово очищено ${count} активних запитів`);
        return count;
    }

    // ======== ПУБЛІЧНИЙ API ========

    // Створюємо публічний API
    window.RafflesAPI = {
        // Основні функції
        init,
        apiRequest,
        getUserId,
        clearCache,
        forceCleanupRequests,

        // Функції розіграшів
        getRaffles,
        getRaffleDetails,
        getRafflesHistory,
        participateInRaffle,
        getRaffleWinners,

        // Налаштування
        setDebugMode: function(debug) {
            _debugMode = debug;
            console.log(`🎲 Raffles API: Режим налагодження ${debug ? 'увімкнено' : 'вимкнено'}`);
            return this;
        }
    };

    // ======== АВТОМАТИЧНА ІНІЦІАЛІЗАЦІЯ ========

    // Ініціалізуємо API при завантаженні DOM
    document.addEventListener('DOMContentLoaded', function() {
        console.log("🎲 Raffles API: DOMContentLoaded, автоматична ініціалізація");

        // Затримка для гарантії, що старий API вже ініціалізований
        setTimeout(() => {
            init().then(success => {
                if (success) {
                    console.log("🎲 Raffles API: Автоініціалізація успішна");
                } else {
                    console.warn("🎲 Raffles API: Автоініціалізація з попередженнями");
                }
            }).catch(error => {
                console.error("🎲 Raffles API: Помилка автоініціалізації:", error);
            });
        }, 500);
    });

    // Якщо DOM вже завантажено
    if (document.readyState === 'interactive' || document.readyState === 'complete') {
        console.log("🎲 Raffles API: Документ вже завантажено, запускаємо ініціалізацію");

        // Затримка для гарантії, що старий API вже ініціалізований
        setTimeout(() => {
            init().then(success => {
                if (success) {
                    console.log("🎲 Raffles API: Ініціалізація успішна");
                } else {
                    console.warn("🎲 Raffles API: Ініціалізація з попередженнями");
                }
            }).catch(error => {
                console.error("🎲 Raffles API: Помилка ініціалізації:", error);
            });
        }, 500);
    }

    console.log("✅ Raffles API: Модуль успішно завантажено");
})();