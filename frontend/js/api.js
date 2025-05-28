/**
 * api.js - Єдиний модуль для всіх API-запитів WINIX
 * Повністю виправлена версія з блокуванням undefined запитів
 * @version 2.0.0
 */

(function() {
    'use strict';

    console.log("🔌 API: Ініціалізація єдиного API модуля (v2.0.0)");

    // ======== КРИТИЧНІ ПЕРЕВІРКИ НА ПОЧАТКУ ========

    // Блокуємо виконання якщо немає Telegram WebApp
    if (!window.Telegram || !window.Telegram.WebApp) {
        console.error("❌ API: КРИТИЧНА ПОМИЛКА - Telegram WebApp недоступний!");
        return;
    }

    // Перевіряємо наявність User ID
    let initialUserId = null;
    const checkUserId = () => {
        // Спроба 1: Глобальна змінна
        if (window._WINIX_USER_ID && window._WINIX_USER_ID !== 'undefined') {
            return window._WINIX_USER_ID;
        }

        // Спроба 2: Telegram WebApp
        if (window.Telegram?.WebApp?.initDataUnsafe?.user?.id) {
            const id = window.Telegram.WebApp.initDataUnsafe.user.id.toString();
            window._WINIX_USER_ID = id;
            return id;
        }

        // Спроба 3: localStorage
        const storedId = localStorage.getItem('telegram_user_id');
        if (storedId && storedId !== 'undefined' && storedId !== 'null') {
            window._WINIX_USER_ID = storedId;
            return storedId;
        }

        return null;
    };

    initialUserId = checkUserId();

    if (!initialUserId) {
        console.warn("⚠️ API: User ID ще не доступний, чекаємо...");

        // Чекаємо на User ID максимум 5 секунд
        let waitAttempts = 0;
        const waitInterval = setInterval(() => {
            initialUserId = checkUserId();
            waitAttempts++;

            if (initialUserId) {
                clearInterval(waitInterval);
                console.log("✅ API: User ID отримано після очікування:", initialUserId);
                initializeAPI();
            } else if (waitAttempts > 50) { // 5 секунд
                clearInterval(waitInterval);
                console.error("❌ API: Не вдалося отримати User ID після 5 секунд очікування");
            }
        }, 100);

        // Якщо ID вже є, ініціалізуємо одразу
        if (initialUserId) {
            clearInterval(waitInterval);
            initializeAPI();
        }
    } else {
        console.log("✅ API: User ID доступний одразу:", initialUserId);
        initializeAPI();
    }

    function initializeAPI() {
        // ======== API-ШЛЯХИ ========

        const API_PATHS = {
            // Health check
            HEALTH: 'health',
            PING: 'ping',

            // Завдання
            TASKS: {
                ALL: 'quests/tasks',
                BY_TYPE: (type) => `quests/tasks/${type}`,
                SOCIAL: 'quests/tasks/social',
                LIMITED: 'quests/tasks/limited',
                PARTNER: 'quests/tasks/partner',
                REFERRAL: 'quests/tasks/referral',
                DETAILS: (taskId) => `quests/tasks/${taskId}/details`,
                START: (taskId) => `quests/tasks/${taskId}/start`,
                VERIFY: (taskId) => `quests/tasks/${taskId}/verify`,
                PROGRESS: (taskId) => `quests/tasks/${taskId}/progress`
            },

            // Користувацькі шляхи
            USER: {
                DATA: (userId) => `user/${userId}`,
                BALANCE: (userId) => `user/${userId}/balance`,
                TASKS: (userId) => `user/${userId}/tasks`,
                PROGRESS: (userId) => `user/${userId}/progress`,
                TASK_STATUS: (userId, taskId) => `user/${userId}/tasks/${taskId}/status`,
                SETTINGS: (userId) => `user/${userId}/settings`
            },

            // Щоденні бонуси
            DAILY_BONUS: {
                STATUS: (userId) => `user/${userId}/daily-bonus`,
                CLAIM: (userId) => `user/${userId}/claim-daily-bonus`,
                STREAK: (userId) => `user/${userId}/claim-streak-bonus`,
                HISTORY: (userId) => `user/${userId}/bonus-history`
            },

            // Стейкінг
            STAKING: {
                DATA: (userId) => `user/${userId}/staking`,
                HISTORY: (userId) => `user/${userId}/staking/history`,
                CANCEL: (userId, stakingId) => `user/${userId}/staking/${stakingId}/cancel`
            },

            // Інші
            AUTH: {
                TELEGRAM: 'auth/telegram',
                REFRESH_TOKEN: 'auth/refresh-token'
            },

            // Wallet
            WALLET: {
                STATUS: (userId) => `wallet/${userId}/status`,
                CONNECT: (userId) => `wallet/${userId}/connect`,
                VERIFY: (userId) => `wallet/${userId}/verify`
            },

            // Транзакції
            TRANSACTIONS: (userId) => `user/${userId}/transactions`
        };

        // ======== ПРИВАТНІ ЗМІННІ ========

        const API_BASE_URL = 'https://winixbot.com';

        // Стан API
        let _apiState = {
            isHealthy: false,
            lastHealthCheck: 0,
            healthCheckInterval: null,
            healthCheckInProgress: false,
            consecutiveFailures: 0,
            maxFailures: 3
        };

        // Режим відлагодження
        let _debugMode = false;

        // Кешовані дані
        let _userCache = null;
        let _userCacheTime = 0;
        const USER_CACHE_TTL = 300000; // 5 хвилин

        let _stakingCache = null;
        let _stakingCacheTime = 0;
        const STAKING_CACHE_TTL = 180000; // 3 хвилини

        // Управління запитами
        let _pendingRequests = {};
        let _activeEndpoints = new Set();
        let _blockedEndpoints = {};
        let _lastRequestsByEndpoint = {};

        // Інтервали між запитами
        const REQUEST_THROTTLE = {
            '/user/': 8000,
            '/staking': 10000,
            '/balance': 6000,
            '/transactions': 15000,
            '/participate-raffle': 5000,
            '/wallet/': 2000,
            'default': 5000
        };

        // Лічильник запитів
        let _requestCounter = {
            total: 0,
            errors: 0,
            current: 0,
            lastReset: Date.now()
        };

        // Стан з'єднання
        let _connectionState = {
            isConnected: true,
            lastSuccessTime: Date.now(),
            failedAttempts: 0,
            maxRetries: 5
        };

        // Токен автентифікації
        let _authToken = null;
        let _authTokenExpiry = 0;

        // ======== ДОПОМІЖНІ ФУНКЦІЇ ========

        /**
         * Перевірка валідності ID
         */
        function isValidId(id) {
            return id &&
                   id !== 'undefined' &&
                   id !== 'null' &&
                   id !== undefined &&
                   id !== null &&
                   typeof id !== 'function' &&
                   id.toString().trim() !== '' &&
                   !id.toString().includes('function') &&
                   !id.toString().includes('=>') &&
                   /^\d+$/.test(id.toString());
        }

        /**
         * Отримати ID користувача з доступних джерел
         * @returns {string|null} ID користувача або null
         */
        function getUserId() {
            try {
                // 1. Перевіряємо глобальну змінну
                if (window._WINIX_USER_ID && isValidId(window._WINIX_USER_ID)) {
                    return window._WINIX_USER_ID;
                }

                // 2. Перевіряємо Telegram WebApp
                if (window.Telegram?.WebApp?.initDataUnsafe?.user?.id) {
                    const tgUserId = window.Telegram.WebApp.initDataUnsafe.user.id.toString();

                    if (isValidId(tgUserId)) {
                        window._WINIX_USER_ID = tgUserId;

                        try {
                            localStorage.setItem('telegram_user_id', tgUserId);
                        } catch (e) {
                            console.warn("🔌 API: Помилка збереження ID в localStorage:", e);
                        }

                        return tgUserId;
                    }
                }

                // 3. Перевіряємо localStorage
                try {
                    const localId = localStorage.getItem('telegram_user_id');
                    if (isValidId(localId)) {
                        window._WINIX_USER_ID = localId;
                        return localId;
                    }
                } catch (e) {
                    console.warn("🔌 API: Помилка отримання ID з localStorage:", e);
                }

                // 4. Перевіряємо DOM елемент
                try {
                    const userIdElement = document.getElementById('user-id');
                    if (userIdElement?.textContent) {
                        const domId = userIdElement.textContent.trim();
                        if (isValidId(domId)) {
                            window._WINIX_USER_ID = domId;

                            try {
                                localStorage.setItem('telegram_user_id', domId);
                            } catch (e) {}

                            return domId;
                        }
                    }
                } catch (e) {
                    console.warn("🔌 API: Помилка отримання ID з DOM:", e);
                }

                // ID не знайдено
                console.error("❌ API: ID користувача не знайдено!");
                return null;

            } catch (e) {
                console.error("🔌 API: Критична помилка отримання ID користувача:", e);
                return null;
            }
        }

        /**
         * Безпечна перевірка, чи містить рядок певний підрядок
         */
        function safeIncludes(str, substring) {
            if (!str || typeof str !== 'string') return false;
            return str.includes(substring);
        }

        /**
         * Нормалізація API endpoint
         */
        function normalizeEndpoint(endpoint) {
            if (!endpoint) return 'api';

            // Якщо endpoint є функцією, викликаємо її
            if (typeof endpoint === 'function') {
                try {
                    endpoint = endpoint();
                    if (!endpoint) return 'api';
                } catch (e) {
                    console.error("🔌 API: Помилка виклику endpoint функції:", e);
                    return 'api';
                }
            }

            // Перетворюємо на рядок
            endpoint = String(endpoint);

            // Видаляємо початковий слеш
            let cleanEndpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;

            // Видаляємо кінцевий слеш
            if (cleanEndpoint.endsWith('/') && cleanEndpoint.length > 1) {
                cleanEndpoint = cleanEndpoint.substring(0, cleanEndpoint.length - 1);
            }

            // Додаємо api/ якщо потрібно
            if (!cleanEndpoint.startsWith('api/') && cleanEndpoint !== 'api') {
                cleanEndpoint = 'api/' + cleanEndpoint;
            }

            return cleanEndpoint;
        }

        /**
         * Перевірка валідності UUID
         */
        function isValidUUID(id) {
            if (!id || typeof id !== 'string') return false;

            const normalized = id.trim().toLowerCase();
            const patterns = {
                standard: /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i,
                noHyphens: /^[0-9a-f]{32}$/i,
                braced: /^\{[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}\}$/i
            };

            return patterns.standard.test(normalized) ||
                   patterns.noHyphens.test(normalized) ||
                   patterns.braced.test(normalized);
        }

        // ======== HEALTH CHECK ФУНКЦІЇ ========

        /**
         * Перевірка здоров'я API
         */
        async function checkApiHealth() {
            if (_apiState.healthCheckInProgress) {
                return _apiState.isHealthy;
            }

            _apiState.healthCheckInProgress = true;

            try {
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), 5000);

                const response = await fetch(`${API_BASE_URL}/api/${API_PATHS.HEALTH}`, {
                    method: 'GET',
                    signal: controller.signal,
                    headers: {
                        'Accept': 'application/json'
                    }
                });

                clearTimeout(timeoutId);

                if (response.ok) {
                    _apiState.isHealthy = true;
                    _apiState.lastHealthCheck = Date.now();
                    _apiState.consecutiveFailures = 0;
                    _connectionState.isConnected = true;
                    _connectionState.lastSuccessTime = Date.now();

                    hideServerUnavailableMessage();
                    return true;
                } else {
                    throw new Error(`Health check failed: ${response.status}`);
                }

            } catch (error) {
                console.error("❌ API: Health check провалений:", error.message);

                _apiState.isHealthy = false;
                _apiState.consecutiveFailures++;
                _connectionState.isConnected = false;

                if (_apiState.consecutiveFailures >= _apiState.maxFailures) {
                    showServerUnavailableMessage();
                }

                return false;
            } finally {
                _apiState.healthCheckInProgress = false;
            }
        }

        /**
         * Показати повідомлення про недоступність сервера
         */
        function showServerUnavailableMessage() {
            let banner = document.getElementById('server-unavailable-banner');
            if (!banner) {
                banner = document.createElement('div');
                banner.id = 'server-unavailable-banner';
                banner.style.cssText = `
                    position: fixed;
                    top: 0;
                    left: 0;
                    right: 0;
                    background: #e74c3c;
                    color: white;
                    text-align: center;
                    padding: 15px;
                    z-index: 10000;
                    font-size: 14px;
                    font-weight: 500;
                    border-bottom: 3px solid #c0392b;
                `;
                banner.innerHTML = `
                    <div>⚠️ Сервер тимчасово недоступний. Спробуйте пізніше.</div>
                    <div style="font-size: 12px; margin-top: 5px; opacity: 0.9;">
                        Ми працюємо над вирішенням проблеми
                    </div>
                `;
                document.body.insertBefore(banner, document.body.firstChild);
            }

            if (navigator.vibrate) {
                navigator.vibrate([200, 100, 200]);
            }
        }

        /**
         * Приховати повідомлення про недоступність сервера
         */
        function hideServerUnavailableMessage() {
            const banner = document.getElementById('server-unavailable-banner');
            if (banner) {
                banner.remove();
            }
        }

        /**
         * Запуск періодичної перевірки здоров'я
         */
        function startHealthCheck() {
            if (_apiState.healthCheckInterval) {
                clearInterval(_apiState.healthCheckInterval);
            }

            checkApiHealth();

            _apiState.healthCheckInterval = setInterval(async () => {
                const isHealthy = await checkApiHealth();

                if (isHealthy && _apiState.consecutiveFailures === 0) {
                    hideServerUnavailableMessage();
                }
            }, 30000);
        }

        /**
         * Перевірка готовності API перед запитом
         */
        async function ensureApiReady() {
            // Швидка перевірка - якщо недавно перевіряли і все ок
            if (_apiState.isHealthy && (Date.now() - _apiState.lastHealthCheck < 60000)) {
                return true;
            }

            return await checkApiHealth();
        }

        // ======== TOKEN MANAGEMENT ========

        /**
         * Отримання токену авторизації
         */
        function getAuthToken() {
            try {
                const now = Date.now();

                // Перевіряємо токен в пам'яті
                if (_authToken && _authTokenExpiry > now) {
                    return _authToken;
                }

                // Отримуємо з localStorage
                let token = localStorage.getItem('auth_token');
                let tokenExpiry = parseInt(localStorage.getItem('auth_token_expiry') || '0');

                if (token && typeof token === 'string' && token.length > 5) {
                    if (tokenExpiry > now) {
                        _authToken = token;
                        _authTokenExpiry = tokenExpiry;
                        return token;
                    }
                }

                return null;
            } catch (e) {
                console.error("🔌 API: Критична помилка отримання токену:", e);
                return null;
            }
        }

        /**
         * Оновлення токену авторизації
         */
        async function refreshToken() {
            if (_pendingRequests['refresh-token']) {
                return _pendingRequests['refresh-token'];
            }

            const refreshPromise = new Promise(async (resolve, reject) => {
                try {
                    const userId = getUserId();

                    if (!userId) {
                        throw new Error("ID користувача не знайдено");
                    }

                    const requestBody = {
                        telegram_id: userId,
                        token: _authToken || '',
                        user_id: userId
                    };

                    const currentToken = getAuthToken();

                    const response = await fetch(`${API_BASE_URL}/${normalizeEndpoint(API_PATHS.AUTH.REFRESH_TOKEN)}`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Telegram-User-Id': userId,
                            ...(currentToken ? { 'Authorization': `Bearer ${currentToken}` } : {})
                        },
                        body: JSON.stringify(requestBody)
                    });

                    if (!response.ok) {
                        if (response.status === 400 || response.status === 401) {
                            clearAuthToken();
                            throw new Error("Токен недійсний. Потрібна повторна авторизація");
                        }
                        throw new Error(`Помилка HTTP: ${response.status}`);
                    }

                    const data = await response.json();

                    if (data && data.status === 'success' && data.token) {
                        _authToken = data.token;

                        if (data.expires_at) {
                            _authTokenExpiry = new Date(data.expires_at).getTime();
                        } else if (data.expires_in) {
                            _authTokenExpiry = Date.now() + (data.expires_in * 1000);
                        } else {
                            _authTokenExpiry = Date.now() + (24 * 60 * 60 * 1000);
                        }

                        try {
                            localStorage.setItem('auth_token', _authToken);
                            localStorage.setItem('auth_token_expiry', _authTokenExpiry.toString());
                        } catch (e) {
                            console.warn("🔌 API: Помилка збереження токену:", e);
                        }

                        document.dispatchEvent(new CustomEvent('token-refreshed', {
                            detail: { token: _authToken, expires_at: _authTokenExpiry }
                        }));

                        resolve(_authToken);
                    } else {
                        throw new Error(data.message || "Помилка оновлення токену");
                    }
                } catch (error) {
                    console.error("❌ API: Помилка оновлення токену:", error);
                    reject(error);
                } finally {
                    delete _pendingRequests['refresh-token'];
                }
            });

            _pendingRequests['refresh-token'] = refreshPromise;
            return refreshPromise;
        }

        /**
         * Очистити токен авторизації
         */
        function clearAuthToken() {
            _authToken = null;
            _authTokenExpiry = 0;

            try {
                localStorage.removeItem('auth_token');
                localStorage.removeItem('auth_token_expiry');
            } catch (e) {
                console.warn("🔌 API: Помилка очищення токену:", e);
            }

            document.dispatchEvent(new CustomEvent('token-cleared'));
        }

        // ======== RATE LIMITING ========

        /**
         * Отримати час throttle для endpoint
         */
        function getThrottleTime(endpoint) {
            for (const key in REQUEST_THROTTLE) {
                if (safeIncludes(endpoint, key)) {
                    return REQUEST_THROTTLE[key];
                }
            }
            return REQUEST_THROTTLE.default;
        }

        /**
         * Обробка rate limiting
         */
        function handleRateLimiting(endpoint, retryAfter) {
            console.log(`⏳ Rate limiting: Очікування ${retryAfter}с для ${endpoint}`);

            if (_blockedEndpoints[endpoint]?.timeoutId) {
                clearTimeout(_blockedEndpoints[endpoint].timeoutId);
            }

            const retryTimeoutId = setTimeout(() => {
                console.log(`✅ Термін очікування для ${endpoint} закінчився`);
                delete _blockedEndpoints[endpoint];

                if (typeof window.showToast === 'function') {
                    window.showToast('З\'єднання відновлено', 'success');
                }
            }, retryAfter * 1000);

            _blockedEndpoints[endpoint] = {
                until: Date.now() + (retryAfter * 1000),
                timeoutId: retryTimeoutId
            };
        }

        /**
         * Перевірка чи endpoint заблокований
         */
        function isEndpointBlocked(endpoint) {
            if (!endpoint) return false;

            return Object.keys(_blockedEndpoints).some(key => {
                if ((safeIncludes(endpoint, key) || key === 'default') &&
                    _blockedEndpoints[key].until > Date.now()) {
                    return true;
                }
                return false;
            });
        }

        // ======== ОСНОВНА ФУНКЦІЯ API ЗАПИТУ ========

        /**
         * Універсальна функція для виконання API-запитів
         */
        async function apiRequest(endpoint, method = 'GET', data = null, options = {}, retries = 2) {
            try {
                // КРИТИЧНО: Блокуємо запити з undefined
                if (!endpoint || endpoint.includes('undefined')) {
                    console.error("🔌 API: БЛОКОВАНО запит з undefined:", endpoint);
                    return Promise.reject({
                        status: 'error',
                        message: 'Невалідний endpoint з undefined',
                        code: 'invalid_endpoint'
                    });
                }

                // Перевіряємо User ID
                const userId = getUserId();
                if (!userId) {
                    console.error("🔌 API: Немає User ID для запиту");
                    return Promise.reject({
                        status: 'error',
                        message: 'User ID не знайдено',
                        code: 'no_user_id'
                    });
                }

                // Перевірка готовності API
                if (!options.skipHealthCheck) {
                    try {
                        await ensureApiReady();
                    } catch (error) {
                        console.error("🔌 API: Сервер недоступний:", error);

                        if (!options.suppressErrors) {
                            return Promise.reject({
                                status: 'error',
                                message: error.message,
                                code: 'server_unavailable'
                            });
                        }
                    }
                }

                // Перевірка rate limiting
                if (!options.bypassThrottle && isEndpointBlocked(endpoint)) {
                    const blockedKey = Object.keys(_blockedEndpoints).find(key =>
                        safeIncludes(endpoint, key) || key === 'default');

                    if (blockedKey) {
                        const waitTime = Math.ceil((_blockedEndpoints[blockedKey].until - Date.now()) / 1000);

                        return Promise.reject({
                            status: 'error',
                            message: `Занадто багато запитів. Спробуйте через ${waitTime} секунд.`,
                            code: 'rate_limited',
                            retryAfter: waitTime
                        });
                    }
                }

                // Формуємо URL
                let url;
                if (safeIncludes(endpoint, 'http')) {
                    url = endpoint;
                } else {
                    const normalizedEndpoint = normalizeEndpoint(endpoint);
                    url = `${API_BASE_URL}/${normalizedEndpoint}`.replace(/([^:]\/)\/+/g, "$1");

                    // Додаємо timestamp для GET запитів
                    if (method === 'GET') {
                        const hasQuery = safeIncludes(url, '?');
                        const timestamp = Math.floor(Date.now() / 1000);
                        url += (hasQuery ? '&' : '?') + `t=${timestamp}`;
                    }
                }

                // Заголовки
                const headers = {
                    'Content-Type': 'application/json',
                    ...(options.headers || {})
                };

                // Токен авторизації
                if (!options.skipTokenCheck) {
                    const token = getAuthToken();
                    if (token) {
                        headers['Authorization'] = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
                    }
                }

                // User ID в заголовках
                if (!options.skipUserIdCheck) {
                    headers['X-Telegram-User-Id'] = userId;
                }

                // Параметри запиту
                const requestOptions = {
                    method: method,
                    headers: headers,
                    timeout: options.timeout || 20000
                };

                // Тіло запиту
                if (data && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
                    requestOptions.body = JSON.stringify(data);
                }

                // Перевірка паралельних запитів
                if (!options.allowParallel && _activeEndpoints.has(endpoint)) {
                    return Promise.reject({
                        status: 'error',
                        message: 'Зачекайте завершення попереднього запиту',
                        code: 'concurrent_request'
                    });
                }

                // Додаємо до активних
                _activeEndpoints.add(endpoint);

                // Спеціальна затримка для wallet запитів
                if (endpoint.includes('wallet/')) {
                    const now = Date.now();
                    const lastWalletRequest = window._lastWalletRequestTime || 0;
                    const timeSince = now - lastWalletRequest;

                    if (timeSince < 2000) {
                        const waitTime = 2000 - timeSince;
                        await new Promise(resolve => setTimeout(resolve, waitTime));
                    }

                    window._lastWalletRequestTime = Date.now();
                }

                let lastError = null;

                try {
                    _requestCounter.total++;
                    _requestCounter.current++;

                    // Показуємо індикатор завантаження
                    if (!options.hideLoader && typeof window.showLoading === 'function') {
                        window.showLoading();
                    }

                    // Виконуємо запит
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), requestOptions.timeout);

                    requestOptions.signal = controller.signal;

                    const fetchResponse = await fetch(url, requestOptions);

                    clearTimeout(timeoutId);

                    // Читаємо відповідь
                    let response;
                    try {
                        const contentType = fetchResponse.headers.get('content-type');

                        if (contentType && contentType.includes('application/json')) {
                            response = await fetchResponse.json();
                        } else {
                            const responseText = await fetchResponse.text();
                            response = { message: responseText };
                        }
                    } catch (error) {
                        console.error('❌ API: Помилка читання відповіді:', error);
                        response = { message: 'Помилка читання відповіді' };
                    }

                    // Приховуємо індикатор
                    if (!options.hideLoader && typeof window.hideLoading === 'function') {
                        window.hideLoading();
                    }

                    // Обробка помилок
                    if (!fetchResponse.ok) {
                        // 401 - спроба оновити токен
                        if (fetchResponse.status === 401 && retries > 0) {
                            console.warn("🔌 API: Помилка авторизації, оновлюємо токен...");

                            try {
                                await refreshToken();
                                return apiRequest(endpoint, method, data, options, retries - 1);
                            } catch (tokenError) {
                                console.error("🔌 API: Не вдалося оновити токен:", tokenError);
                                clearAuthToken();
                            }
                        }

                        // 404 - спеціальні випадки
                        if (fetchResponse.status === 404) {
                            if (safeIncludes(url, 'daily-bonus')) {
                                return Promise.reject({
                                    status: "error",
                                    message: "Щоденні бонуси тимчасово недоступні",
                                    httpStatus: 404,
                                    endpoint: endpoint
                                });
                            }

                            if (safeIncludes(url, '/api/ping')) {
                                return {
                                    status: "error",
                                    message: "API ping недоступний",
                                    source: "ping_404"
                                };
                            }

                            return Promise.reject({
                                status: "error",
                                message: "Ресурс не знайдено",
                                httpStatus: 404,
                                endpoint: endpoint
                            });
                        }

                        // 429 - rate limiting
                        if (fetchResponse.status === 429) {
                            const retryAfter = fetchResponse.headers.get('Retry-After') || 30;
                            const endpointKey = Object.keys(REQUEST_THROTTLE).find(key =>
                                safeIncludes(endpoint, key)) || 'default';
                            handleRateLimiting(endpointKey, parseInt(retryAfter));
                            throw new Error(`Занадто багато запитів. Спробуйте через ${retryAfter} секунд.`);
                        }

                        // 500+ - серверні помилки
                        if (fetchResponse.status >= 500) {
                            _connectionState.isConnected = false;
                            _apiState.isHealthy = false;
                            _apiState.consecutiveFailures++;

                            if (_apiState.consecutiveFailures >= _apiState.maxFailures) {
                                showServerUnavailableMessage();
                            }

                            throw new Error(`Сервер тимчасово недоступний (${fetchResponse.status})`);
                        }

                        const errorMessage = response.message || response.error ||
                                           `Помилка серверу: ${fetchResponse.status}`;
                        throw new Error(errorMessage);
                    }

                    // Успішна відповідь
                    _connectionState.failedAttempts = 0;
                    _connectionState.lastSuccessTime = Date.now();
                    _connectionState.isConnected = true;
                    _apiState.isHealthy = true;
                    _apiState.consecutiveFailures = 0;

                    hideServerUnavailableMessage();

                    return response;

                } catch (error) {
                    _requestCounter.errors++;

                    if (!options.hideLoader && typeof window.hideLoading === 'function') {
                        window.hideLoading();
                    }

                    lastError = error;

                    // Якщо це остання спроба
                    if (retries <= 0) {
                        throw error;
                    }

                    // Для мережевих помилок - повторна спроба
                    const isNetworkError = error.name === 'AbortError' ||
                                          error.name === 'TypeError' ||
                                          (error.message && safeIncludes(error.message, 'NetworkError'));

                    if (isNetworkError) {
                        _connectionState.failedAttempts++;

                        const backoffTime = Math.min(1000 * Math.pow(2, _connectionState.failedAttempts), 10000);

                        console.warn(`⚠️ Мережева помилка, спроба через ${backoffTime/1000}с...`);

                        await new Promise(resolve => setTimeout(resolve, backoffTime));

                        return apiRequest(endpoint, method, data, options, retries - 1);
                    }

                    throw error;
                } finally {
                    _activeEndpoints.delete(endpoint);
                    _requestCounter.current = Math.max(0, _requestCounter.current - 1);
                }

            } catch (error) {
                _requestCounter.errors++;

                if (!options.hideLoader && typeof window.hideLoading === 'function') {
                    window.hideLoading();
                }

                console.error(`❌ API: Помилка запиту ${endpoint}:`, error.message);

                document.dispatchEvent(new CustomEvent('api-error', {
                    detail: {
                        error,
                        endpoint,
                        method
                    }
                }));

                if (options.suppressErrors) {
                    return {
                        status: 'error',
                        message: error.message || 'Сталася помилка при виконанні запиту',
                        source: 'api_error'
                    };
                }

                throw error;
            }
        }

        /**
         * Примусове очищення запитів
         */
        function forceCleanupRequests() {
            _lastRequestsByEndpoint = {};
            _activeEndpoints.clear();
            _pendingRequests = {};
            console.log("🔌 API: Примусово очищено відстеження запитів");
            return true;
        }

        // ======== ФУНКЦІЇ КОРИСТУВАЧА ========

        /**
         * Отримання даних користувача
         */
        async function getUserData(forceRefresh = false) {
            try {
                await ensureApiReady();
            } catch (error) {
                console.error("🔌 API: Сервер недоступний для отримання даних користувача:", error);
                throw error;
            }

            // Використовуємо кеш
            if (!forceRefresh && _userCache && (Date.now() - _userCacheTime < USER_CACHE_TTL)) {
                return {status: 'success', data: _userCache, source: 'cache'};
            }

            const id = getUserId();
            if (!id) {
                throw new Error("ID користувача не знайдено");
            }

            try {
                const result = await apiRequest(API_PATHS.USER.DATA(id), 'GET', null, {
                    timeout: 15000,
                    suppressErrors: false
                });

                // Оновлюємо кеш
                if (result.status === 'success' && result.data) {
                    _userCache = result.data;
                    _userCacheTime = Date.now();

                    // Зберігаємо в localStorage
                    try {
                        if (_userCache.balance !== undefined) {
                            localStorage.setItem('userTokens', _userCache.balance.toString());
                            localStorage.setItem('winix_balance', _userCache.balance.toString());
                        }

                        if (_userCache.coins !== undefined) {
                            localStorage.setItem('userCoins', _userCache.coins.toString());
                            localStorage.setItem('winix_coins', _userCache.coins.toString());
                        }

                        if (_userCache.notifications_enabled !== undefined) {
                            localStorage.setItem('notifications_enabled',
                                _userCache.notifications_enabled.toString());
                        }
                    } catch (e) {
                        console.warn("🔌 API: Помилка збереження даних в localStorage:", e);
                    }
                }

                return result;
            } catch (error) {
                console.error("🔌 API: Помилка отримання даних користувача:", error);
                throw error;
            }
        }

        /**
         * Отримання балансу користувача
         */
        async function getBalance() {
            const userId = getUserId();
            if (!userId) {
                throw new Error("ID користувача не знайдено");
            }

            try {
                await ensureApiReady();
            } catch (error) {
                console.error("🔌 API: Сервер недоступний для отримання балансу:", error);
                throw error;
            }

            try {
                const nocache = Date.now();
                const endpoint = API_PATHS.USER.BALANCE(userId) + `?nocache=${nocache}`;

                const response = await apiRequest(endpoint, 'GET', null, {
                    suppressErrors: false,
                    timeout: 10000
                });

                return response;

            } catch (error) {
                console.error("🔌 API: Помилка отримання балансу:", error);
                throw error;
            }
        }

        // ======== ФУНКЦІЇ СТЕЙКІНГУ ========

        /**
         * Отримання даних стейкінгу
         */
        async function getStakingData() {
            const userId = getUserId();
            if (!userId) {
                throw new Error("ID користувача не знайдено");
            }

            try {
                await ensureApiReady();
            } catch (error) {
                console.error("🔌 API: Сервер недоступний для стейкінгу:", error);
                throw error;
            }

            if (_stakingCache && (Date.now() - _stakingCacheTime < STAKING_CACHE_TTL)) {
                return {status: 'success', data: _stakingCache, source: 'cache'};
            }

            return apiRequest(API_PATHS.STAKING.DATA(userId));
        }

        /**
         * Отримання історії стейкінгу
         */
        async function getStakingHistory() {
            const userId = getUserId();
            if (!userId) {
                throw new Error("ID користувача не знайдено");
            }

            await ensureApiReady();
            return apiRequest(API_PATHS.STAKING.HISTORY(userId));
        }

        /**
         * Створення нового стейкінгу
         */
        async function createStaking(amount, period) {
            const userId = getUserId();
            if (!userId) {
                throw new Error("ID користувача не знайдено");
            }

            await ensureApiReady();

            if (isNaN(amount) || amount <= 0) {
                throw new Error("Сума стейкінгу має бути додатним числом");
            }

            if (![7, 14, 28].includes(period)) {
                throw new Error("Період стейкінгу може бути 7, 14 або 28 днів");
            }

            return apiRequest(API_PATHS.STAKING.DATA(userId), 'POST', {
                stakingAmount: parseInt(amount),
                period: period
            });
        }

        /**
         * Додавання коштів до стейкінгу
         */
        async function addToStaking(amount, stakingId = null) {
            const userId = getUserId();
            if (!userId) {
                throw new Error("ID користувача не знайдено");
            }

            await ensureApiReady();

            if (isNaN(amount) || amount <= 0) {
                throw new Error("Сума має бути додатним числом");
            }

            let targetStakingId = stakingId;
            if (!targetStakingId) {
                try {
                    const stakingData = await getStakingData();
                    if (stakingData.status !== 'success' || !stakingData.data ||
                        !stakingData.data.hasActiveStaking) {
                        throw new Error("У вас немає активного стейкінгу");
                    }
                    targetStakingId = stakingData.data.stakingId;
                } catch (error) {
                    throw new Error("Не вдалося отримати ID стейкінгу: " + error.message);
                }
            }

            return apiRequest(`${API_PATHS.STAKING.DATA(userId)}/${targetStakingId}`, 'PUT', {
                additionalAmount: parseInt(amount)
            });
        }

        /**
         * Скасування стейкінгу
         */
        async function cancelStaking(stakingId = null) {
            const userId = getUserId();
            if (!userId) {
                throw new Error("ID користувача не знайдено");
            }

            await ensureApiReady();

            let targetStakingId = stakingId;
            if (!targetStakingId) {
                try {
                    const stakingData = await getStakingData();
                    if (stakingData.status === 'success' && stakingData.data &&
                        stakingData.data.hasActiveStaking) {
                        targetStakingId = stakingData.data.stakingId;
                    } else {
                        const stakingDataStr = localStorage.getItem('stakingData') ||
                                               localStorage.getItem('winix_staking');
                        if (stakingDataStr) {
                            try {
                                const localData = JSON.parse(stakingDataStr);
                                if (localData && localData.stakingId) {
                                    targetStakingId = localData.stakingId;
                                }
                            } catch (e) {
                                console.warn("🔌 API: Помилка парсингу даних стейкінгу:", e);
                            }
                        }
                    }

                    if (!targetStakingId) {
                        throw new Error("Не вдалося отримати ID стейкінгу");
                    }
                } catch (error) {
                    throw new Error("Не вдалося отримати ID стейкінгу: " + error.message);
                }
            }

            return apiRequest(API_PATHS.STAKING.CANCEL(userId, targetStakingId), 'POST', {
                confirm: true,
                timestamp: Date.now()
            });
        }

        /**
         * Розрахунок очікуваної винагороди
         */
        async function calculateExpectedReward(amount, period) {
            amount = parseInt(amount) || 0;
            period = parseInt(period) || 14;

            if (amount <= 0) {
                return { status: 'success', data: { reward: 0 } };
            }

            if (![7, 14, 28].includes(period)) {
                period = 14;
            }

            const rewardRates = { 7: 4, 14: 9, 28: 15 };
            const rewardPercent = rewardRates[period] || 9;
            const reward = (amount * rewardPercent) / 100;

            return {
                status: 'success',
                data: {
                    reward: parseFloat(reward.toFixed(2)),
                    rewardPercent: rewardPercent,
                    amount: amount,
                    period: period,
                    source: 'local_calculation'
                }
            };
        }

        /**
         * Отримання транзакцій користувача
         */
        async function getTransactions(limit = 100) {
            const userId = getUserId();
            if (!userId) {
                return {
                    status: 'error',
                    message: 'ID користувача не знайдено'
                };
            }

            await ensureApiReady();

            try {
                return await apiRequest(`${API_PATHS.TRANSACTIONS(userId)}?limit=${limit}`, 'GET', null, {
                    suppressErrors: true
                });
            } catch (error) {
                console.warn("🔌 API: Транзакції недоступні:", error);
                return {
                    status: 'success',
                    data: [],
                    message: 'Історія транзакцій тимчасово недоступна'
                };
            }
        }

        /**
         * Оновлення налаштувань користувача
         */
        async function updateSettings(settings) {
            const userId = getUserId();
            if (!userId) {
                throw new Error("ID користувача не знайдено");
            }

            await ensureApiReady();

            try {
                return await apiRequest(API_PATHS.USER.SETTINGS(userId), 'POST', settings);
            } catch (error) {
                console.error("🔌 API: Помилка оновлення налаштувань:", error);
                throw error;
            }
        }

        /**
         * Очищення кешу API
         */
        function clearCache() {
            _userCache = null;
            _userCacheTime = 0;
            _stakingCache = null;
            _stakingCacheTime = 0;
            _lastRequestsByEndpoint = {};
            console.log("🔌 API: Кеш очищено");
        }

        /**
         * Відновлення з'єднання з сервером
         */
        async function reconnect() {
            console.log("🔄 API: Спроба відновлення з'єднання...");

            forceCleanupRequests();

            _apiState.isHealthy = false;
            _apiState.consecutiveFailures = 0;

            const isHealthy = await checkApiHealth();

            if (isHealthy) {
                try {
                    await refreshToken();
                } catch (error) {
                    console.warn("⚠️ API: Не вдалося оновити токен:", error);
                }

                try {
                    await getUserData(true);

                    _connectionState.isConnected = true;
                    _connectionState.lastSuccessTime = Date.now();
                    _connectionState.failedAttempts = 0;

                    console.log("✅ API: З'єднання успішно відновлено");
                    return true;
                } catch (error) {
                    console.error("❌ API: Помилка відновлення з'єднання:", error);
                    return false;
                }
            } else {
                console.error("❌ API: Сервер все ще недоступний");
                return false;
            }
        }

        // ======== АВТОМАТИЧНЕ ОЧИЩЕННЯ ========

        setInterval(() => {
            const now = Date.now();

            // Очищення старих запитів
            let hasLongRunningRequests = false;
            for (const [key, time] of Object.entries(_lastRequestsByEndpoint)) {
                if (now - time > 30000) {
                    hasLongRunningRequests = true;
                    delete _lastRequestsByEndpoint[key];
                    console.warn(`🔌 API: Скинуто старий запит: ${key}`);
                }
            }

            if (hasLongRunningRequests) {
                forceCleanupRequests();
            }

            // Скидання лічильників
            if (now - _requestCounter.lastReset > 600000) {
                _requestCounter.total = 0;
                _requestCounter.errors = 0;
                _requestCounter.lastReset = now;
            }
        }, 60000);

        // ======== ІНІЦІАЛІЗАЦІЯ ========

        // Запускаємо health check
        startHealthCheck();

        // ======== ЕКСПОРТ API ========

        // Експортуємо API шляхи
        window.API_PATHS = API_PATHS;

        // Створюємо публічний API
        window.WinixAPI = {
            // Конфігурація
            config: {
                baseUrl: API_BASE_URL,
                version: '2.0.0',
                environment: API_BASE_URL.includes('localhost') ? 'development' : 'production'
            },

            // Налаштування
            setDebugMode: function(debug) {
                _debugMode = debug;
                return this;
            },

            // Health check
            checkApiHealth,
            ensureApiReady,
            isApiHealthy: () => _apiState.isHealthy,

            // Базові функції
            apiRequest,
            getUserId,
            getAuthToken,
            clearAuthToken,
            refreshToken,
            clearCache,
            forceCleanupRequests,
            reconnect,
            isValidUUID,
            safeIncludes,

            // Функції користувача
            getUserData,
            getBalance,
            updateSettings,

            // Функції стейкінгу
            getStakingData,
            getStakingHistory,
            createStaking,
            addToStaking,
            cancelStaking,
            calculateExpectedReward,

            // Функції транзакцій
            getTransactions,

            // Константи API-шляхів
            paths: API_PATHS,

            // Функції для діагностики
            diagnostics: {
                getRequestStats: function() {
                    return {..._requestCounter};
                },
                getConnectionState: function() {
                    return {..._connectionState};
                },
                getApiState: function() {
                    return {..._apiState};
                },
                getActiveEndpoints: function() {
                    return Array.from(_activeEndpoints);
                },
                getBlockedEndpoints: function() {
                    return {..._blockedEndpoints};
                },
                clearBlockedEndpoints: function() {
                    for (const key in _blockedEndpoints) {
                        if (_blockedEndpoints[key].timeoutId) {
                            clearTimeout(_blockedEndpoints[key].timeoutId);
                        }
                    }
                    _blockedEndpoints = {};
                    return true;
                },
                resetState: function() {
                    _activeEndpoints.clear();
                    _pendingRequests = {};
                    _lastRequestsByEndpoint = {};
                    for (const key in _blockedEndpoints) {
                        if (_blockedEndpoints[key].timeoutId) {
                            clearTimeout(_blockedEndpoints[key].timeoutId);
                        }
                    }
                    _blockedEndpoints = {};
                    _connectionState.failedAttempts = 0;
                    _apiState.consecutiveFailures = 0;
                    _apiState.isHealthy = false;
                    return true;
                }
            }
        };

        // Для зворотної сумісності
        window.apiRequest = apiRequest;
        window.getUserId = getUserId;

        // Для модулів, що очікують window.API
        window.API = {
            get: function(endpoint, options = {}) {
                return window.WinixAPI.apiRequest(endpoint, 'GET', null, options);
            },
            post: function(endpoint, data = null, options = {}) {
                return window.WinixAPI.apiRequest(endpoint, 'POST', data, options);
            }
        };

        // Обробники подій
        window.addEventListener('online', () => {
            console.log("🔄 API: З'єднання з мережею відновлено");
            reconnect();
        });

        // Генеруємо подію про готовність
        console.log('🚀 WinixAPI: Генеруємо подію готовності');
        setTimeout(() => {
            document.dispatchEvent(new CustomEvent('winix-api-ready', {
                detail: {
                    version: '2.0.0',
                    userId: window._WINIX_USER_ID
                }
            }));
        }, 10);

        // Позначаємо модуль як готовий
        if (window.WinixInit) {
            window.WinixInit.checkModule('api');
        }

        // Розблоковуємо систему якщо є функція
        if (window._unlockWinixSystem && window._WINIX_USER_ID) {
            window._unlockWinixSystem(window._WINIX_USER_ID);
        }

        console.log(`✅ API: Модуль успішно ініціалізовано (URL: ${API_BASE_URL}, User ID: ${window._WINIX_USER_ID})`);
    }
})();