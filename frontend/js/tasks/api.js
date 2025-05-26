/**
 * api.js - Єдиний модуль для всіх API-запитів WINIX
 * ВИПРАВЛЕНА ВЕРСІЯ з покращеним health check та fallback механізмами
 * @version 2.0.0
 */

(function() {
    'use strict';
    console.log("🔌 API: Ініціалізація ВИПРАВЛЕНОГО API модуля");

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
            REFRESH_TOKEN: 'auth/refresh-token'
        },

        // Транзакції
        TRANSACTIONS: (userId) => `user/${userId}/transactions`
    };

    // ======== ПРИВАТНІ ЗМІННІ ========

    // Базовий URL
    const API_BASE_URL = (() => {
        if (window.WinixConfig && window.WinixConfig.apiBaseUrl) {
            let url = window.WinixConfig.apiBaseUrl;
            return url.endsWith('/api') ? url.slice(0, -4) : url;
        }

        const hostname = window.location.hostname;
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return `http://${hostname}:8080`;
        } else if (hostname.includes('testenv') || hostname.includes('staging')) {
            return `https://${hostname}`;
        } else {
            return 'https://winixbot.com';
        }
    })();

    // Стан API - ЗМЕНШЕНА АГРЕСИВНІСТЬ
    let _apiState = {
        isHealthy: null, // null = невідомо, true = здоровий, false = нездоровий
        lastHealthCheck: 0,
        healthCheckInterval: null,
        healthCheckInProgress: false,
        consecutiveFailures: 0,
        maxFailures: 5, // Збільшено для меншої чутливості
        healthCheckEnabled: true // Додано можливість вимикати health check
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
        maxRetries: 3
    };

    // Токен автентифікації
    let _authToken = null;
    let _authTokenExpiry = 0;

    // ======== HEALTH CHECK ФУНКЦІЇ (ПОКРАЩЕНІ) ========

    /**
     * М'яка перевірка здоров'я API без блокування
     */
    async function checkApiHealth() {
        if (_apiState.healthCheckInProgress || !_apiState.healthCheckEnabled) {
            return _apiState.isHealthy !== false; // Повертаємо true якщо не знаємо або здоровий
        }

        _apiState.healthCheckInProgress = true;
        console.log("🏥 API: Перевірка здоров'я сервера");

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 3000); // Скорочено до 3 секунд

            const response = await fetch(`${API_BASE_URL}/api/${API_PATHS.HEALTH}`, {
                method: 'GET',
                signal: controller.signal,
                headers: {
                    'Accept': 'application/json'
                }
            });

            clearTimeout(timeoutId);

            const isHealthy = response.ok;
            _apiState.isHealthy = isHealthy;
            _apiState.lastHealthCheck = Date.now();

            if (isHealthy) {
                console.log("✅ API: Сервер здоровий");
                _apiState.consecutiveFailures = 0;
                _connectionState.isConnected = true;
                _connectionState.lastSuccessTime = Date.now();
                hideServerUnavailableMessage();
            } else {
                console.warn(`⚠️ API: Сервер повернув статус ${response.status}`);
                _apiState.consecutiveFailures++;
            }

            return isHealthy;

        } catch (error) {
            console.warn("⚠️ API: Health check неуспішний:", error.message);

            _apiState.isHealthy = false;
            _apiState.consecutiveFailures++;
            _connectionState.isConnected = false;

            // Показуємо повідомлення тільки при критичній кількості помилок
            if (_apiState.consecutiveFailures >= _apiState.maxFailures) {
                showServerUnavailableMessage();
            }

            return false;
        } finally {
            _apiState.healthCheckInProgress = false;
        }
    }

    /**
     * Показати м'яке повідомлення про недоступність сервера
     */
    function showServerUnavailableMessage() {
        console.warn("⚠️ API: Показуємо м'яке повідомлення про недоступність сервера");

        let banner = document.getElementById('server-unavailable-banner');
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'server-unavailable-banner';
            banner.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                background: linear-gradient(135deg, #f39c12, #e67e22);
                color: white;
                text-align: center;
                padding: 10px;
                z-index: 10000;
                font-size: 13px;
                font-weight: 500;
                border-bottom: 2px solid #d35400;
                transition: transform 0.3s ease;
            `;
            banner.innerHTML = `
                <div>⚠️ Сповільнене з'єднання з сервером. Працюємо над покращенням...</div>
                <div style="font-size: 11px; margin-top: 3px; opacity: 0.9;">
                    Функціональність може бути обмежена
                </div>
            `;
            document.body.insertBefore(banner, document.body.firstChild);
        }
    }

    /**
     * Приховати повідомлення про недоступність сервера
     */
    function hideServerUnavailableMessage() {
        const banner = document.getElementById('server-unavailable-banner');
        if (banner) {
            banner.remove();
            console.log("✅ API: Повідомлення про недоступність приховано");
        }
    }

    /**
     * Запуск періодичної перевірки здоров'я (менш агресивний)
     */
    function startHealthCheck() {
        console.log("🏥 API: Запуск м'якої перевірки здоров'я");

        if (_apiState.healthCheckInterval) {
            clearInterval(_apiState.healthCheckInterval);
        }

        // Початкова перевірка через 2 секунди
        setTimeout(() => {
            checkApiHealth();
        }, 2000);

        // Періодична перевірка кожні 60 секунд (збільшено)
        _apiState.healthCheckInterval = setInterval(async () => {
            if (_apiState.healthCheckEnabled) {
                const isHealthy = await checkApiHealth();

                if (isHealthy && _apiState.consecutiveFailures === 0) {
                    hideServerUnavailableMessage();
                }
            }
        }, 60000); // 1 хвилина замість 30 секунд
    }

    /**
     * НЕ блокуюча перевірка готовності API
     */
    async function ensureApiReady() {
        // Якщо health check вимкнено, вважаємо що API готовий
        if (!_apiState.healthCheckEnabled) {
            return true;
        }

        // Якщо нещодавно перевіряли і все добре, не перевіряємо знову
        const healthCheckAge = Date.now() - _apiState.lastHealthCheck;
        if (_apiState.isHealthy === true && healthCheckAge < 120000) { // 2 хвилини
            return true;
        }

        // Якщо здоров'я невідоме або застаріле, перевіряємо
        if (_apiState.isHealthy === null || healthCheckAge > 300000) { // 5 хвилин
            console.log("🔍 API: Перевіряємо готовність API...");
            const isHealthy = await checkApiHealth();

            // НЕ БЛОКУЄМО запити навіть якщо health check неуспішний
            if (!isHealthy) {
                console.warn("⚠️ API: Health check неуспішний, але продовжуємо роботу");
            }
        }

        return true; // Завжди повертаємо true щоб не блокувати запити
    }

    // ======== ФУНКЦІЇ ДЛЯ РОБОТИ З ID КОРИСТУВАЧА ========

    /**
     * Отримати ID користувача з доступних джерел
     */
    function getUserId() {
        try {
            function isValidId(id) {
                return id &&
                       id !== 'undefined' &&
                       id !== 'null' &&
                       id !== undefined &&
                       id !== null &&
                       typeof id !== 'function' &&
                       id.toString().trim() !== '';
            }

            // 1. Telegram WebApp
            if (window.Telegram && window.Telegram.WebApp) {
                try {
                    if (window.Telegram.WebApp.initDataUnsafe &&
                        window.Telegram.WebApp.initDataUnsafe.user &&
                        window.Telegram.WebApp.initDataUnsafe.user.id) {

                        const tgUserId = window.Telegram.WebApp.initDataUnsafe.user.id.toString();

                        if (isValidId(tgUserId)) {
                            try {
                                localStorage.setItem('telegram_user_id', tgUserId);
                            } catch (e) {}
                            return tgUserId;
                        }
                    }
                } catch (e) {
                    console.warn("🔌 API: Помилка отримання ID з Telegram WebApp:", e);
                }
            }

            // 2. localStorage
            try {
                const localId = localStorage.getItem('telegram_user_id');
                if (isValidId(localId)) {
                    return localId;
                }
            } catch (e) {
                console.warn("🔌 API: Помилка отримання ID з localStorage:", e);
            }

            // 3. DOM елемент
            try {
                const userIdElement = document.getElementById('user-id');
                if (userIdElement && userIdElement.textContent) {
                    const domId = userIdElement.textContent.trim();
                    if (isValidId(domId)) {
                        try {
                            localStorage.setItem('telegram_user_id', domId);
                        } catch (e) {}
                        return domId;
                    }
                }
            } catch (e) {
                console.warn("🔌 API: Помилка отримання ID з DOM:", e);
            }

            // 4. URL параметри
            try {
                const urlParams = new URLSearchParams(window.location.search);
                const urlId = urlParams.get('id') || urlParams.get('user_id') || urlParams.get('telegram_id');
                if (isValidId(urlId)) {
                    try {
                        localStorage.setItem('telegram_user_id', urlId);
                    } catch (e) {}
                    return urlId;
                }
            } catch (e) {
                console.warn("🔌 API: Помилка отримання ID з URL:", e);
            }

            return null;
        } catch (e) {
            console.error("🔌 API: Критична помилка отримання ID користувача:", e);
            return null;
        }
    }

    /**
     * Отримання токену авторизації
     */
    function getAuthToken() {
        try {
            const now = Date.now();

            // 1. Перевіряємо токен в пам'яті
            if (_authToken && _authTokenExpiry > now) {
                return _authToken;
            }

            // 2. Спробуємо отримати токен через StorageUtils
            let token = null;
            let tokenExpiry = 0;

            if (window.StorageUtils) {
                token = window.StorageUtils.getItem('auth_token');
                tokenExpiry = parseInt(window.StorageUtils.getItem('auth_token_expiry') || '0');
            } else {
                // 3. localStorage
                token = localStorage.getItem('auth_token');
                tokenExpiry = parseInt(localStorage.getItem('auth_token_expiry') || '0');
            }

            if (token && typeof token === 'string' && token.length > 5) {
                if (tokenExpiry > now) {
                    _authToken = token;
                    _authTokenExpiry = tokenExpiry;
                    return token;
                }

                // Токен застарів, але зберігаємо його
                if (!_authToken) {
                    _authToken = token;
                }
            }

            // 4. Альтернативні джерела
            if (window.WinixConfig && window.WinixConfig.authToken) {
                _authToken = window.WinixConfig.authToken;
                return _authToken;
            }

            // 5. URL-параметри
            try {
                const urlParams = new URLSearchParams(window.location.search);
                const urlToken = urlParams.get('token') || urlParams.get('auth_token');
                if (urlToken && urlToken.length > 5) {
                    _authToken = urlToken;

                    if (window.StorageUtils) {
                        window.StorageUtils.setItem('auth_token', urlToken);
                    } else {
                        localStorage.setItem('auth_token', urlToken);
                    }

                    return urlToken;
                }
            } catch (e) {
                console.warn("🔌 API: Помилка отримання токену з URL:", e);
            }

            return null;
        } catch (e) {
            console.error("🔌 API: Критична помилка отримання токену:", e);
            return null;
        }
    }

    /**
     * Безпечна перевірка includes
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

        if (typeof endpoint === 'function') {
            try {
                endpoint = endpoint();
                if (!endpoint) return 'api';
            } catch (e) {
                console.error("🔌 API: Помилка виклику endpoint функції:", e);
                return 'api';
            }
        }

        endpoint = String(endpoint);
        let cleanEndpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;

        if (cleanEndpoint.endsWith('/') && cleanEndpoint.length > 1) {
            cleanEndpoint = cleanEndpoint.substring(0, cleanEndpoint.length - 1);
        }

        if (cleanEndpoint.startsWith('api/')) {
            return cleanEndpoint;
        } else if (cleanEndpoint === 'api') {
            return cleanEndpoint;
        } else if (cleanEndpoint.startsWith('api')) {
            return `api/${cleanEndpoint.substring(3)}`;
        } else {
            return `api/${cleanEndpoint}`;
        }
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

    /**
     * ПОКРАЩЕНЕ оновлення токену авторизації
     */
    async function refreshToken() {
        // НЕ перевіряємо готовність API щоб уникнути блокування
        console.log("🔄 API: Початок оновлення токену");

        // Перевіряємо, чи вже відбувається оновлення
        if (_pendingRequests['refresh-token']) {
            return _pendingRequests['refresh-token'];
        }

        const refreshPromise = new Promise(async (resolve, reject) => {
            try {
                const userId = getUserId();
                if (!userId) {
                    throw new Error("ID користувача не знайдено");
                }

                console.log("🔄 API: Виконання запиту оновлення токену");

                // Виконуємо запит БЕЗ перевірки health check
                const response = await fetch(`${API_BASE_URL}/${normalizeEndpoint(API_PATHS.AUTH.REFRESH_TOKEN)}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Telegram-User-Id': userId
                    },
                    body: JSON.stringify({
                        telegram_id: userId,
                        token: _authToken || ''
                    }),
                    timeout: 10000
                });

                if (!response.ok) {
                    if (response.status === 400 || response.status === 401) {
                        console.warn("⚠️ API: Токен недійсний, очищаємо");
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

                    // Зберігаємо токен
                    try {
                        if (window.StorageUtils) {
                            window.StorageUtils.setItem('auth_token', _authToken, {
                                persist: true,
                                expires: _authTokenExpiry - Date.now()
                            });
                            window.StorageUtils.setItem('auth_token_expiry', _authTokenExpiry.toString(), {
                                persist: true,
                                expires: _authTokenExpiry - Date.now()
                            });
                        } else {
                            localStorage.setItem('auth_token', _authToken);
                            localStorage.setItem('auth_token_expiry', _authTokenExpiry.toString());
                        }
                    } catch (e) {
                        console.warn("🔌 API: Помилка збереження токену:", e);
                    }

                    console.log("✅ API: Токен успішно оновлено");

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
        console.log("🗑️ API: Очищення токену авторизації");

        _authToken = null;
        _authTokenExpiry = 0;

        try {
            if (window.StorageUtils) {
                window.StorageUtils.removeItem('auth_token');
                window.StorageUtils.removeItem('auth_token_expiry');
            } else {
                localStorage.removeItem('auth_token');
                localStorage.removeItem('auth_token_expiry');
            }
        } catch (e) {
            console.warn("🔌 API: Помилка очищення токену:", e);
        }

        document.dispatchEvent(new CustomEvent('token-cleared'));
    }

    // ======== ПОКРАЩЕНІ ФУНКЦІЇ API-ЗАПИТУ ========

    /**
     * ПОКРАЩЕНА універсальна функція для виконання API-запитів
     */
    async function apiRequest(endpoint, method = 'GET', data = null, options = {}, retries = 2) {
        try {
            if (!endpoint) {
                console.error("🔌 API: endpoint є undefined або null");
                return Promise.reject({
                    status: 'error',
                    message: 'Не вказано endpoint для запиту',
                    code: 'missing_endpoint'
                });
            }

            // ВИДАЛЕНО блокуючу перевірку здоров'я API
            // Тепер завжди пробуємо виконати запит

            if (_debugMode) {
                console.log(`🔌 API: Запит ${method} до ${endpoint}`);
            }

            const telegramId = getUserId();
            if (!telegramId) {
                console.error("❌ API: Немає Telegram ID для запиту");
                throw new Error('No Telegram ID');
            }

            // Формуємо URL
            let url;
            if (safeIncludes(endpoint, 'http')) {
                url = endpoint;
            } else {
                const normalizedEndpoint = normalizeEndpoint(endpoint);
                const hasQuery = safeIncludes(normalizedEndpoint, '?');
                const timestamp = Date.now();

                url = `${API_BASE_URL}/${normalizedEndpoint}`
                    .replace(/([^:]\/)\/+/g, "$1")
                    + (hasQuery ? '&' : '?') + `t=${timestamp}`;
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

            // ID користувача
            if (!options.skipUserIdCheck) {
                headers['X-Telegram-User-Id'] = telegramId;
            }

            // Параметри запиту
            const requestOptions = {
                method: method,
                headers: headers,
                timeout: options.timeout || 15000 // Збільшено таймаут
            };

            // Тіло запиту
            if (data && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
                requestOptions.body = JSON.stringify(data);
            }

            // Показуємо індикатор завантаження
            if (!options.hideLoader && typeof window.showLoading === 'function') {
                window.showLoading();
            }

            let response;
            let lastError;

            // Виконуємо запит з retry логікою
            for (let attempt = 1; attempt <= retries + 1; attempt++) {
                try {
                    if (attempt > 1) {
                        const delay = Math.min(1000 * Math.pow(1.5, attempt - 1), 5000);
                        console.log(`⏳ API: Затримка ${delay}мс перед спробою ${attempt}`);
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }

                    // Контрол таймауту
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), requestOptions.timeout);
                    requestOptions.signal = controller.signal;

                    const fetchResponse = await fetch(url, requestOptions);
                    clearTimeout(timeoutId);

                    // Спеціальна обробка 401 - спроба оновити токен
                    if (fetchResponse.status === 401 && attempt === 1) {
                        console.warn("🔌 API: Помилка авторизації, спроба оновлення токену...");
                        try {
                            await refreshToken();
                            // Оновлюємо токен в заголовках для наступної спроби
                            const newToken = getAuthToken();
                            if (newToken) {
                                headers['Authorization'] = newToken.startsWith('Bearer ') ? newToken : `Bearer ${newToken}`;
                            }
                            continue; // Повторюємо запит з новим токеном
                        } catch (tokenError) {
                            console.error("🔌 API: Не вдалося оновити токен:", tokenError);
                            clearAuthToken();
                        }
                    }

                    // Перевірка статусу
                    if (!fetchResponse.ok) {
                        throw new Error(`HTTP ${fetchResponse.status}: ${fetchResponse.statusText}`);
                    }

                    // Парсимо відповідь
                    response = await fetchResponse.json();

                    // Успішний запит
                    _connectionState.isConnected = true;
                    _connectionState.lastSuccessTime = Date.now();
                    _connectionState.failedAttempts = 0;
                    _apiState.consecutiveFailures = Math.max(0, _apiState.consecutiveFailures - 1);

                    // Оновлюємо стан здоров'я при успішному запиті
                    if (_apiState.isHealthy !== true) {
                        _apiState.isHealthy = true;
                        hideServerUnavailableMessage();
                    }

                    break; // Виходимо з циклу retry

                } catch (error) {
                    lastError = error;
                    console.warn(`⚠️ API: Спроба ${attempt}/${retries + 1} неуспішна:`, error.message);

                    // Оновлюємо лічильники помилок
                    _connectionState.failedAttempts++;
                    _apiState.consecutiveFailures++;

                    // Для останньої спроби не чекаємо
                    if (attempt === retries + 1) {
                        break;
                    }
                }
            }

            // Приховуємо індикатор завантаження
            if (!options.hideLoader && typeof window.hideLoading === 'function') {
                window.hideLoading();
            }

            // Якщо всі спроби неуспішні
            if (!response) {
                // Оновлюємо стан здоров'я
                if (_apiState.consecutiveFailures >= _apiState.maxFailures) {
                    _apiState.isHealthy = false;
                    showServerUnavailableMessage();
                }

                if (options.suppressErrors) {
                    return {
                        status: 'error',
                        message: lastError?.message || 'Невідома помилка',
                        source: 'api_error'
                    };
                }

                throw lastError || new Error('Всі спроби запиту неуспішні');
            }

            return response;

        } catch (error) {
            // Приховуємо індикатор завантаження
            if (!options.hideLoader && typeof window.hideLoading === 'function') {
                window.hideLoading();
            }

            console.error(`❌ API: Помилка запиту ${endpoint}:`, error.message);

            // Відправляємо подію про помилку
            document.dispatchEvent(new CustomEvent('api-error', {
                detail: { error, endpoint, method }
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

    // ======== ФУНКЦІЇ КОРИСТУВАЧА ========

    /**
     * Отримання даних користувача
     */
    async function getUserData(forceRefresh = false) {
        // Використовуємо кеш якщо можливо
        if (!forceRefresh && _userCache && (Date.now() - _userCacheTime < USER_CACHE_TTL)) {
            return {status: 'success', data: _userCache, source: 'cache'};
        }

        const id = getUserId();
        if (!id) {
            throw new Error("ID користувача не знайдено");
        }

        try {
            const result = await apiRequest(API_PATHS.USER.DATA(id), 'GET', null, {
                timeout: 10000,
                suppressErrors: false
            });

            // Оновлюємо кеш
            if (result.status === 'success' && result.data) {
                _userCache = result.data;
                _userCacheTime = Date.now();

                // Зберігаємо дані в localStorage
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
                        localStorage.setItem('notifications_enabled', _userCache.notifications_enabled.toString());
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
            const nocache = Date.now();
            const endpoint = API_PATHS.USER.BALANCE(userId) + `?nocache=${nocache}`;

            const response = await apiRequest(endpoint, 'GET', null, {
                suppressErrors: false,
                timeout: 8000
            });

            return response;

        } catch (error) {
            console.error("🔌 API: Помилка отримання балансу:", error);
            throw error;
        }
    }

    // ======== ФУНКЦІЇ ДЛЯ СТЕЙКІНГУ ========

    /**
     * Отримання даних стейкінгу
     */
    async function getStakingData() {
        const userId = getUserId();
        if (!userId) {
            throw new Error("ID користувача не знайдено");
        }

        // Використовуємо кеш якщо можливо
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

        if (isNaN(amount) || amount <= 0) {
            throw new Error("Сума має бути додатним числом");
        }

        let targetStakingId = stakingId;
        if (!targetStakingId) {
            try {
                const stakingData = await getStakingData();
                if (stakingData.status !== 'success' || !stakingData.data || !stakingData.data.hasActiveStaking) {
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

        let targetStakingId = stakingId;
        if (!targetStakingId) {
            try {
                const stakingData = await getStakingData();
                if (stakingData.status === 'success' && stakingData.data && stakingData.data.hasActiveStaking) {
                    targetStakingId = stakingData.data.stakingId;
                } else {
                    const stakingDataStr = localStorage.getItem('stakingData') || localStorage.getItem('winix_staking');
                    if (stakingDataStr) {
                        try {
                            const localData = JSON.parse(stakingDataStr);
                            if (localData && localData.stakingId) {
                                targetStakingId = localData.stakingId;
                            }
                        } catch (e) {
                            console.warn("🔌 API: Помилка парсингу даних стейкінгу з localStorage:", e);
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
        console.log("🔌 API: Кеш очищено");
    }

    /**
     * Примусове очищення всіх активних запитів
     */
    function forceCleanupRequests() {
        _activeEndpoints.clear();
        _pendingRequests = {};
        console.log("🔌 API: Примусово очищено відстеження запитів");
        return true;
    }

    /**
     * Відновлення з'єднання з сервером
     */
    async function reconnect() {
        console.log("🔄 API: Спроба відновлення з'єднання...");

        forceCleanupRequests();
        _apiState.isHealthy = null;
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

    // ======== ІНІЦІАЛІЗАЦІЯ ========

    // М'який запуск health check
    startHealthCheck();

    // ======== ЕКСПОРТ API ========

    window.API_PATHS = API_PATHS;

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
        isApiHealthy: () => _apiState.isHealthy === true,
        enableHealthCheck: () => { _apiState.healthCheckEnabled = true; },
        disableHealthCheck: () => { _apiState.healthCheckEnabled = false; },

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
            resetState: function() {
                _activeEndpoints.clear();
                _pendingRequests = {};
                _connectionState.failedAttempts = 0;
                _apiState.consecutiveFailures = 0;
                _apiState.isHealthy = null;
                return true;
            }
        }
    };

    // Для зворотної сумісності
    window.apiRequest = apiRequest;
    window.getUserId = getUserId;

    window.API = {
        get: function(endpoint, options = {}) {
            return window.WinixAPI.apiRequest(endpoint, 'GET', null, options);
        },
        post: function(endpoint, data = null, options = {}) {
            return window.WinixAPI.apiRequest(endpoint, 'POST', data, options);
        }
    };

    // Обробники подій для відновлення з'єднання
    window.addEventListener('online', () => {
        console.log("🔄 API: З'єднання з мережею відновлено");
        reconnect();
    });

    console.log(`✅ API: ВИПРАВЛЕНИЙ модуль успішно ініціалізовано (URL: ${API_BASE_URL})`);
})();