/**
 * api.js - Єдиний модуль для всіх API-запитів WINIX
 * ВИПРАВЛЕНА версія БЕЗ undefined проблем та з правильною ініціалізацією
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

        // Користувацькі шляхи
        USER: {
            DATA: (userId) => `user/${userId}`,
            BALANCE: (userId) => `user/${userId}/balance`,
            SETTINGS: (userId) => `user/${userId}/settings`
        },

        // Авторизація
        AUTH: {
            LOGIN: 'auth',
            REFRESH_TOKEN: 'auth/refresh-token',
            VALIDATE: 'auth/validate'
        }
    };

    // ======== ПРИВАТНІ ЗМІННІ ========

    // Базовий URL API
    const API_BASE_URL = (() => {
        // Перевіряємо глобальний конфіг
        if (window.WinixConfig && window.WinixConfig.apiBaseUrl) {
            let url = window.WinixConfig.apiBaseUrl;
            return url.endsWith('/api') ? url.slice(0, -4) : url;
        }

        // Визначаємо URL на основі поточного середовища
        const hostname = window.location.hostname;

        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            return `http://${hostname}:8080`;
        } else if (hostname.includes('testenv') || hostname.includes('staging')) {
            return `https://${hostname}`;
        } else {
            return 'https://winixbot.com';
        }
    })();

    // Стан API
    let _apiState = {
        isHealthy: false,
        lastHealthCheck: 0,
        consecutiveFailures: 0,
        maxFailures: 3
    };

    // Кешовані дані
    let _userCache = null;
    let _userCacheTime = 0;
    const USER_CACHE_TTL = 300000; // 5 хвилин

    // Управління запитами
    let _pendingRequests = new Map();
    let _requestCounter = {
        total: 0,
        errors: 0,
        lastReset: Date.now()
    };

    // Стан з'єднання
    let _connectionState = {
        isConnected: true,
        lastSuccessTime: Date.now(),
        failedAttempts: 0
    };

    // Токен автентифікації
    let _authToken = null;
    let _authTokenExpiry = 0;

    // ======== ФУНКЦІЇ ДЛЯ РОБОТИ З ID КОРИСТУВАЧА ========

    /**
     * ВИПРАВЛЕНА функція отримання ID користувача
     * НАЙВАЖЛИВІША ФУНКЦІЯ - тут виправлено undefined проблему
     */
    function getUserId() {
        try {
            console.log("🔍 API: getUserId - початок отримання ID");

            // Функція перевірки валідності ID
            function isValidId(id) {
                if (!id) return false;
                if (typeof id === 'function') return false;
                if (id === 'undefined' || id === 'null') return false;

                const idStr = String(id).trim();
                if (!idStr || idStr === '' || idStr === 'undefined' || idStr === 'null') return false;

                // Перевіряємо що це число
                const idNum = parseInt(idStr);
                if (isNaN(idNum) || idNum <= 0) return false;

                console.log(`✅ API: Валідний ID знайдено: ${idStr}`);
                return true;
            }

            // 1. ПРІОРИТЕТ: Telegram WebApp (найнадійніше джерело)
            if (window.Telegram && window.Telegram.WebApp) {
                console.log("🔍 API: Перевірка Telegram WebApp...");

                // Чекаємо готовності WebApp
                if (window.Telegram.WebApp.initDataUnsafe &&
                    window.Telegram.WebApp.initDataUnsafe.user &&
                    window.Telegram.WebApp.initDataUnsafe.user.id) {

                    const tgUserId = window.Telegram.WebApp.initDataUnsafe.user.id;
                    console.log(`🔍 API: Telegram WebApp ID: ${tgUserId}`);

                    if (isValidId(tgUserId)) {
                        const validId = String(tgUserId);

                        // Зберігаємо в localStorage для майбутніх використань
                        try {
                            localStorage.setItem('telegram_user_id', validId);
                            console.log(`💾 API: ID збережено в localStorage: ${validId}`);
                        } catch (e) {
                            console.warn("⚠️ API: Не вдалося зберегти в localStorage:", e);
                        }

                        return validId;
                    }
                }
            }

            // 2. localStorage (якщо Telegram недоступний)
            console.log("🔍 API: Перевірка localStorage...");
            try {
                const localId = localStorage.getItem('telegram_user_id');
                if (isValidId(localId)) {
                    console.log(`💾 API: ID з localStorage: ${localId}`);
                    return String(localId);
                }
            } catch (e) {
                console.warn("⚠️ API: Помилка читання localStorage:", e);
            }

            // 3. DOM елемент (fallback)
            console.log("🔍 API: Перевірка DOM елемента...");
            try {
                const userIdElement = document.getElementById('user-id');
                if (userIdElement && userIdElement.textContent) {
                    const domId = userIdElement.textContent.trim();
                    if (isValidId(domId)) {
                        console.log(`🏷️ API: ID з DOM: ${domId}`);

                        // Зберігаємо в localStorage
                        try {
                            localStorage.setItem('telegram_user_id', domId);
                        } catch (e) {}

                        return String(domId);
                    }
                }
            } catch (e) {
                console.warn("⚠️ API: Помилка читання DOM:", e);
            }

            // 4. URL параметри (останній fallback)
            console.log("🔍 API: Перевірка URL параметрів...");
            try {
                const urlParams = new URLSearchParams(window.location.search);
                const urlId = urlParams.get('id') || urlParams.get('user_id') || urlParams.get('telegram_id');
                if (isValidId(urlId)) {
                    console.log(`🔗 API: ID з URL: ${urlId}`);

                    // Зберігаємо в localStorage
                    try {
                        localStorage.setItem('telegram_user_id', urlId);
                    } catch (e) {}

                    return String(urlId);
                }
            } catch (e) {
                console.warn("⚠️ API: Помилка читання URL:", e);
            }

            // ID не знайдено
            console.error("❌ API: Жодне валідне джерело ID не знайдено");
            return null;

        } catch (e) {
            console.error("💥 API: Критична помилка отримання ID користувача:", e);
            return null;
        }
    }

    /**
     * Чекання готовності Telegram WebApp
     */
    function waitForTelegramReady(timeout = 5000) {
        return new Promise((resolve) => {
            const startTime = Date.now();

            function checkTelegram() {
                if (window.Telegram &&
                    window.Telegram.WebApp &&
                    window.Telegram.WebApp.initDataUnsafe &&
                    window.Telegram.WebApp.initDataUnsafe.user) {

                    console.log("✅ API: Telegram WebApp готовий");
                    resolve(true);
                    return;
                }

                if (Date.now() - startTime > timeout) {
                    console.warn("⚠️ API: Timeout очікування Telegram WebApp");
                    resolve(false);
                    return;
                }

                setTimeout(checkTelegram, 100);
            }

            checkTelegram();
        });
    }

    /**
     * Отримання токену авторизації
     */
    function getAuthToken() {
        try {
            const now = Date.now();

            // Перевіряємо наявність токену в пам'яті
            if (_authToken && _authTokenExpiry > now) {
                return _authToken;
            }

            // Спробуємо отримати токен з localStorage
            let token = null;
            let tokenExpiry = 0;

            try {
                token = localStorage.getItem('auth_token');
                tokenExpiry = parseInt(localStorage.getItem('auth_token_expiry') || '0');
            } catch (e) {
                console.warn("⚠️ API: Помилка читання токену з localStorage:", e);
            }

            if (token && typeof token === 'string' && token.length > 5) {
                if (tokenExpiry > now) {
                    _authToken = token;
                    _authTokenExpiry = tokenExpiry;
                    return token;
                }
            }

            return null;
        } catch (e) {
            console.error("💥 API: Критична помилка отримання токену:", e);
            return null;
        }
    }

    /**
     * Нормалізація API endpoint
     */
    function normalizeEndpoint(endpoint) {
        if (!endpoint) return 'api';

        // Перетворюємо endpoint на рядок
        endpoint = String(endpoint);

        // Видаляємо слеш на початку
        let cleanEndpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;

        // Видаляємо слеш в кінці
        if (cleanEndpoint.endsWith('/') && cleanEndpoint.length > 1) {
            cleanEndpoint = cleanEndpoint.substring(0, cleanEndpoint.length - 1);
        }

        // Додаємо 'api/' на початок якщо потрібно
        if (!cleanEndpoint.startsWith('api/')) {
            cleanEndpoint = cleanEndpoint === 'api' ? cleanEndpoint : `api/${cleanEndpoint}`;
        }

        return cleanEndpoint;
    }

    // ======== API HEALTH CHECK ========

    /**
     * Перевірка здоров'я API
     */
    async function checkApiHealth() {
        console.log('🏥 API: Перевірка здоров\'я API сервера');

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

                console.log('✅ API: Сервер здоровий');
                return true;
            } else {
                throw new Error(`Health check failed: ${response.status}`);
            }

        } catch (error) {
            console.warn('⚠️ API: Сервер недоступний:', error.message);
            _apiState.isHealthy = false;
            _apiState.consecutiveFailures++;
            _connectionState.isConnected = false;

            return false;
        }
    }

    /**
     * Оновлення токену авторизації
     */
    async function refreshToken() {
        // Перевіряємо, чи вже відбувається оновлення
        if (_pendingRequests.has('refresh-token')) {
            return _pendingRequests.get('refresh-token');
        }

        const refreshPromise = new Promise(async (resolve, reject) => {
            try {
                const userId = getUserId();
                if (!userId) {
                    throw new Error("ID користувача не знайдено");
                }

                console.log("🔄 API: Початок оновлення токену");

                const response = await fetch(`${API_BASE_URL}/${normalizeEndpoint(API_PATHS.AUTH.REFRESH_TOKEN)}`, {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'X-Telegram-User-Id': userId
                    },
                    body: JSON.stringify({
                        telegram_id: userId,
                        token: _authToken || ''
                    })
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
                    } else {
                        _authTokenExpiry = Date.now() + (24 * 60 * 60 * 1000);
                    }

                    // Зберігаємо в localStorage
                    try {
                        localStorage.setItem('auth_token', _authToken);
                        localStorage.setItem('auth_token_expiry', _authTokenExpiry.toString());
                    } catch (e) {
                        console.warn("⚠️ API: Помилка збереження токену:", e);
                    }

                    console.log("✅ API: Токен успішно оновлено");

                    // Відправляємо подію про оновлення токену
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
                _pendingRequests.delete('refresh-token');
            }
        });

        _pendingRequests.set('refresh-token', refreshPromise);
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
            localStorage.removeItem('auth_token');
            localStorage.removeItem('auth_token_expiry');
        } catch (e) {
            console.warn("⚠️ API: Помилка очищення токену:", e);
        }

        document.dispatchEvent(new CustomEvent('token-cleared'));
    }

    // ======== ОСНОВНІ API ФУНКЦІЇ ========

    /**
     * ВИПРАВЛЕНА універсальна функція для виконання API-запитів
     */
    async function apiRequest(endpoint, method = 'GET', data = null, options = {}) {
        // КРИТИЧНО ВАЖЛИВА ПЕРЕВІРКА
        if (!endpoint) {
            console.error("❌ API: endpoint є undefined або null");
            throw new Error('Не вказано endpoint для запиту');
        }

        try {
            console.log(`🔌 API: Початок запиту ${method} до ${endpoint}`);

            // Формуємо URL запиту
            const normalizedEndpoint = normalizeEndpoint(endpoint);
            const timestamp = Date.now();
            const url = `${API_BASE_URL}/${normalizedEndpoint}?t=${timestamp}`;

            console.log(`🔗 API: URL запиту: ${url}`);

            // Заголовки запиту
            const headers = {
                'Content-Type': 'application/json',
                ...(options.headers || {})
            };

            // Додаємо токен авторизації
            if (!options.skipTokenCheck) {
                const token = getAuthToken();
                if (token) {
                    headers['Authorization'] = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
                }
            }

            // КРИТИЧНО ВАЖЛИВО: Додаємо ID користувача
            const userId = getUserId();
            if (userId && !options.skipUserIdCheck) {
                headers['X-Telegram-User-Id'] = userId;
                console.log(`👤 API: Додано ID користувача в заголовок: ${userId}`);
            } else if (!userId) {
                console.warn("⚠️ API: ID користувача недоступний для запиту");
            }

            // Параметри запиту
            const requestOptions = {
                method: method,
                headers: headers,
                timeout: options.timeout || 10000
            };

            // Додаємо тіло запиту для POST/PUT/PATCH
            if (data && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
                requestOptions.body = JSON.stringify(data);
            }

            // Показуємо індикатор завантаження
            if (!options.hideLoader && typeof window.showLoading === 'function') {
                window.showLoading();
            }

            // Виконуємо запит
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), requestOptions.timeout);
            requestOptions.signal = controller.signal;

            const response = await fetch(url, requestOptions);
            clearTimeout(timeoutId);

            // Приховуємо індикатор завантаження
            if (!options.hideLoader && typeof window.hideLoading === 'function') {
                window.hideLoading();
            }

            // Обробка спеціальних статус-кодів
            if (response.status === 401) {
                console.warn("🔌 API: Помилка авторизації. Спроба оновлення токену...");

                try {
                    await refreshToken();
                    // Повторюємо запит з оновленим токеном (тільки одну спробу)
                    if (!options._retryAttempt) {
                        options._retryAttempt = true;
                        return apiRequest(endpoint, method, data, options);
                    }
                } catch (tokenError) {
                    console.error("🔌 API: Не вдалося оновити токен:", tokenError);
                    clearAuthToken();
                }
            }

            if (!response.ok) {
                throw new Error(`Помилка сервера: ${response.status}`);
            }

            // Парсимо відповідь
            const result = await response.json();

            // Інкрементуємо лічильники
            _requestCounter.total++;
            _connectionState.isConnected = true;
            _connectionState.lastSuccessTime = Date.now();

            return result;

        } catch (error) {
            console.error(`❌ API: Помилка запиту ${endpoint}:`, error.message);

            // Приховуємо індикатор завантаження
            if (!options.hideLoader && typeof window.hideLoading === 'function') {
                window.hideLoading();
            }

            _requestCounter.errors++;
            _connectionState.isConnected = false;

            // Відправляємо подію про помилку
            document.dispatchEvent(new CustomEvent('api-error', {
                detail: { error, endpoint, method }
            }));

            throw error;
        }
    }

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
                timeout: 15000
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
                } catch (e) {
                    console.warn("⚠️ API: Помилка збереження даних в localStorage:", e);
                }
            }

            return result;
        } catch (error) {
            console.error("❌ API: Помилка отримання даних користувача:", error);
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
                timeout: 10000
            });

            return response;

        } catch (error) {
            console.error("❌ API: Помилка отримання балансу:", error);
            throw error;
        }
    }

    /**
     * Очищення кешу API
     */
    function clearCache() {
        _userCache = null;
        _userCacheTime = 0;
        console.log("🧹 API: Кеш очищено");
    }

    // ======== ІНІЦІАЛІЗАЦІЯ ========

    /**
     * Ініціалізація API модуля
     */
    async function initializeAPI() {
        console.log("🚀 API: Початок ініціалізації");

        try {
            // Чекаємо готовності Telegram WebApp
            console.log("⏳ API: Очікування готовності Telegram WebApp...");
            await waitForTelegramReady();

            // Перевіряємо здоров'я API
            await checkApiHealth();

            // Перевіряємо ID користувача
            const userId = getUserId();
            if (userId) {
                console.log(`✅ API: Ініціалізація завершена. ID користувача: ${userId}`);
            } else {
                console.warn("⚠️ API: Ініціалізація завершена, але ID користувача не знайдено");
            }

            return true;
        } catch (error) {
            console.error("❌ API: Помилка ініціалізації:", error);
            return false;
        }
    }

    // ======== ПУБЛІЧНИЙ API ========

    // Створюємо публічний API
    window.WinixAPI = {
        // Конфігурація
        config: {
            baseUrl: API_BASE_URL,
            version: '2.0.0'
        },

        // Ініціалізація
        initialize: initializeAPI,

        // Health check
        checkApiHealth,
        isApiHealthy: () => _apiState.isHealthy,

        // Базові функції
        apiRequest,
        getUserId,
        getAuthToken,
        clearAuthToken,
        refreshToken,
        clearCache,

        // Функції користувача
        getUserData,
        getBalance,

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
            }
        }
    };

    // Для зворотної сумісності
    window.apiRequest = apiRequest;
    window.getUserId = getUserId;

    // Автоматична ініціалізація при завантаженні DOM
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', initializeAPI);
    } else {
        // Документ вже завантажений
        setTimeout(initializeAPI, 100);
    }

    console.log(`✅ API: Модуль успішно завантажено (URL: ${API_BASE_URL})`);
})();