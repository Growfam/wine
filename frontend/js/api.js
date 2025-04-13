/**
 * api.js - Єдиний модуль для всіх API-запитів WINIX
 * Оптимізована версія: централізоване управління запитами та кешуванням
 * @version 1.1.0
 */

(function() {
    'use strict';

    console.log("🔌 API: Ініціалізація єдиного API модуля");

    // ======== ПРИВАТНІ ЗМІННІ ========

    // Базовий URL - без /api на кінці!
    const API_BASE_URL = (() => {
        // Перевіряємо глобальний конфіг, якщо він існує
        if (window.WinixConfig && window.WinixConfig.apiBaseUrl) {
            // Видаляємо /api якщо він є на кінці
            let url = window.WinixConfig.apiBaseUrl;
            return url.endsWith('/api') ? url.slice(0, -4) : url;
        }

        // Визначаємо URL на основі поточного середовища
        const hostname = window.location.hostname;

        // Конкретні умови для локального середовища
        if (hostname === 'localhost' || hostname === '127.0.0.1') {
            // Локальне середовище - використовуємо порт 8080
            return `http://${hostname}:8080`;
        } else if (hostname.includes('testenv') || hostname.includes('staging')) {
            // Тестові середовища
            return `https://${hostname}`;
        } else {
            // Продакшн середовище
            return 'https://winixbot.com';
        }
    })();

    // Режим відлагодження
    let _debugMode = false;

    // Кешовані дані користувача
    let _userCache = null;
    let _userCacheTime = 0;
    const USER_CACHE_TTL = 300000; // 5 хвилин

    // Кешовані дані стейкінгу
    let _stakingCache = null;
    let _stakingCacheTime = 0;
    const STAKING_CACHE_TTL = 180000; // 3 хвилини

    // Запобігання рекурсивним викликам
    let _pendingRequests = {};
    let _activeEndpoints = new Set();

    // Відстеження запитів, щоб запобігти повторним викликам
    let _lastRequestsByEndpoint = {};

    // Мінімальний інтервал між однаковими запитами (збільшені інтервали)
    const REQUEST_THROTTLE = {
        '/user/': 5000,
        '/staking': 8000,
        '/balance': 5000,
        '/transactions': 15000,
        'default': 4000
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

    // Дані для емуляції - використовувати тільки для тестування
    const DUMMY_USER_DATA = {
        telegram_id: "7066583465",
        username: "WINIX User",
        balance: 100,
        coins: 5,
        notifications_enabled: true
    };

    // ======== ФУНКЦІЇ ДЛЯ РОБОТИ З ID КОРИСТУВАЧА ========

    /**
     * Отримати ID користувача з доступних джерел
     * @returns {string|null} ID користувача або null
     */
    function getUserId() {
        try {
            // Перевірка валідності ID
            function isValidId(id) {
                return id &&
                       id !== 'undefined' &&
                       id !== 'null' &&
                       id !== undefined &&
                       id !== null &&
                       typeof id !== 'function' &&
                       id.toString().trim() !== '';
            }

            // 1. Спочатку перевіряємо Telegram WebApp
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

            // 2. Перевіряємо localStorage
            try {
                const localId = localStorage.getItem('telegram_user_id');
                if (isValidId(localId)) {
                    return localId;
                }
            } catch (e) {
                console.warn("🔌 API: Помилка отримання ID з localStorage:", e);
            }

            // 3. Перевіряємо DOM елемент
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

            // 4. Перевіряємо URL параметри
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

            // 5. Якщо не знайдено і це сторінка налаштувань - використовуємо тестовий ID
            const isSettingsPage = window.location.pathname.includes('general.html');
            if (isSettingsPage) {
                const testId = "7066583465";
                try {
                    localStorage.setItem('telegram_user_id', testId);
                } catch (e) {}

                return testId;
            }

            // ID не знайдено
            return null;
        } catch (e) {
            console.error("🔌 API: Критична помилка отримання ID користувача:", e);
            return null;
        }
    }

    /**
     * Отримання токену авторизації
     * @returns {string|null} Токен авторизації або null
     */
    function getAuthToken() {
        try {
            // Перевіряємо наявність токену в пам'яті
            if (_authToken && _authTokenExpiry > Date.now()) {
                return _authToken;
            }

            // Спробуємо отримати токен з localStorage
            const token = localStorage.getItem('auth_token');
            if (token && typeof token === 'string' && token.length > 5) {
                // Перевіряємо термін дії, якщо є
                const expiryStr = localStorage.getItem('auth_token_expiry');
                if (expiryStr && parseInt(expiryStr) > Date.now()) {
                    _authToken = token;
                    _authTokenExpiry = parseInt(expiryStr);
                    return token;
                } else if (!expiryStr) {
                    // Якщо немає інформації про термін дії, все одно повертаємо токен
                    _authToken = token;
                    return token;
                }
            }

            // Альтернативні джерела токену
            // 1. Перевіряємо глобальний об'єкт конфігурації
            if (window.WinixConfig && window.WinixConfig.authToken) {
                _authToken = window.WinixConfig.authToken;
                return _authToken;
            }

            // 2. Перевіряємо URL-параметри
            try {
                const urlParams = new URLSearchParams(window.location.search);
                const urlToken = urlParams.get('token') || urlParams.get('auth_token');
                if (urlToken && urlToken.length > 5) {
                    // Зберігаємо знайдений токен
                    _authToken = urlToken;
                    localStorage.setItem('auth_token', urlToken);
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
     * Нормалізація API endpoint для уникнення проблем з URL
     * @param {string} endpoint - вхідний endpoint
     * @returns {string} нормалізований endpoint
     */
    function normalizeEndpoint(endpoint) {
        if (!endpoint) return 'api';

        // Видаляємо початковий слеш, якщо він є
        let cleanEndpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;

        // Перевіряємо, чи вже містить endpoint 'api'
        if (cleanEndpoint.startsWith('api/')) {
            return cleanEndpoint;
        } else if (cleanEndpoint.startsWith('api')) {
            return `api/${cleanEndpoint.substring(3)}`;
        } else {
            return `api/${cleanEndpoint}`;
        }
    }

    /**
     * Оновлення токену авторизації
     * @returns {Promise<string|null>} Новий токен або null
     */
   async function refreshToken() {
    // Перевіряємо, чи вже відбувається оновлення
    if (_pendingRequests['refresh-token']) {
        return _pendingRequests['refresh-token'];
    }

    // Створюємо проміс для відстеження запиту
    const refreshPromise = new Promise(async (resolve, reject) => {
        try {
            // Отримуємо ID користувача
            const userId = getUserId();
            if (!userId) {
                throw new Error("ID користувача не знайдено");
            }

            console.log("🔄 API: Початок оновлення токену");

            // Використовуємо rawApiRequest без токену, щоб уникнути рекурсії
            const response = await fetch(`${API_BASE_URL}/api/auth/refresh-token`, {
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
                throw new Error(`Помилка HTTP: ${response.status}`);
            }

            const data = await response.json();

            if (data && data.status === 'success' && data.token) {
                // Зберігаємо новий токен
                _authToken = data.token;

                // Визначаємо час закінчення токену
                if (data.expires_at) {
                    _authTokenExpiry = new Date(data.expires_at).getTime();
                } else if (data.expires_in) {
                    _authTokenExpiry = Date.now() + (data.expires_in * 1000);
                } else {
                    // За замовчуванням 24 години
                    _authTokenExpiry = Date.now() + (24 * 60 * 60 * 1000);
                }

                // Зберігаємо в localStorage
                try {
                    localStorage.setItem('auth_token', _authToken);
                    localStorage.setItem('auth_token_expiry', _authTokenExpiry.toString());
                } catch (e) {
                    console.warn("🔌 API: Помилка збереження токену в localStorage:", e);
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
            // Видаляємо запит зі списку активних
            delete _pendingRequests['refresh-token'];
        }
    });

    // Зберігаємо проміс для відстеження запиту
    _pendingRequests['refresh-token'] = refreshPromise;

    return refreshPromise;
}

    // ======== ФУНКЦІЇ API-ЗАПИТУ ========

    /**
     * Функція для примусового скидання зависаючих запитів
     * @returns {boolean} Чи було виконано скидання
     */
    function resetPendingRequests() {
        // Якщо є більше 3 активних запитів, потенційно маємо проблему
        if (_activeEndpoints.size > 3) {
            console.warn(`🔌 API: Виявлено ${_activeEndpoints.size} активних запитів, скидаємо стан`);
            _activeEndpoints.clear();
            _pendingRequests = {};
            return true;
        }
        return false;
    }

    /**
     * Безпосереднє виконання запиту без додаткової логіки
     * Використовується для уникнення рекурсії в деяких випадках
     * @param {string} url - URL запиту
     * @param {string} method - HTTP метод
     * @param {Object} data - Дані для відправки
     * @param {Object} options - Додаткові параметри
     * @returns {Promise<Object>} Результат запиту
     */
    async function rawApiRequest(url, method, data, options = {}) {
        try {
            // Показуємо індикатор завантаження
            if (!options.hideLoader) {
                if (typeof window.showLoading === 'function') {
                    window.showLoading();
                }
            }

            // Запит з таймаутом
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), options.timeout || 10000);

            // Заголовки
            const headers = {
                'Content-Type': 'application/json',
                ...(options.headers || {})
            };

            // Додаємо токен авторизації, якщо потрібно
            if (!options.skipTokenCheck) {
                const token = getAuthToken();
                if (token) {
                    headers['Authorization'] = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
                }
            }

            // Додаємо ID користувача, якщо він є
            const userId = getUserId();
            if (userId && !options.skipUserIdCheck) {
                headers['X-Telegram-User-Id'] = userId;
            }

            // Перевірка чи пристрій онлайн
            if (typeof navigator.onLine !== 'undefined' && !navigator.onLine) {
                throw new Error("Пристрій офлайн");
            }

            // Параметри запиту
            const requestOptions = {
                method: method,
                headers: headers,
                signal: controller.signal
            };

            // Додаємо тіло запиту для POST/PUT/PATCH
            if (data && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
                // Перевірка та коригування raffle_id для запитів участі в розіграші
if (cleanEndpoint.includes('participate-raffle') && data) {
    // Переконатися, що raffle_id - валідний рядок
    if (data.raffle_id) {
        // Перевірка формату UUID та конвертація
        if (typeof data.raffle_id !== 'string') {
            data.raffle_id = String(data.raffle_id);
            console.log("🛠️ API: raffle_id конвертовано в рядок:", data.raffle_id);
        }

        // Перевірка формату UUID
        if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(data.raffle_id)) {
            console.warn(`⚠️ API: Невалідний UUID для участі в розіграші: ${data.raffle_id}`);
        }
    } else {
        console.error("❌ API: Відсутній raffle_id в запиті участі в розіграші");
    }
}
                requestOptions.body = JSON.stringify(data);
            }

            // Виконуємо запит
            const response = await fetch(url, requestOptions);

            // Очищаємо таймаут
            clearTimeout(timeoutId);

            // Приховуємо індикатор завантаження
            if (!options.hideLoader) {
                if (typeof window.hideLoading === 'function') {
                    window.hideLoading();
                }
            }

            // Перевіряємо статус відповіді
            if (!response.ok) {
                throw new Error(`Помилка сервера: ${response.status}`);
            }

            // Парсимо відповідь як JSON
            return await response.json();
        } catch (error) {
            // Приховуємо індикатор завантаження
            if (!options.hideLoader) {
                if (typeof window.hideLoading === 'function') {
                    window.hideLoading();
                }
            }

            throw error;
        }
    }

    /**
     * Допоміжна функція для визначення мінімального інтервалу між запитами
     * @param {string} endpoint - URL ендпоінту
     * @returns {number} Мінімальний інтервал у мілісекундах
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
     * Універсальна функція для виконання API-запитів
     * @param {string} endpoint - URL ендпоінту
     * @param {string} method - HTTP метод (GET, POST, PUT, DELETE)
     * @param {Object} data - Дані для відправки
     * @param {Object} options - Додаткові параметри
     * @param {number} retries - Кількість повторних спроб
     * @returns {Promise<Object>} Результат запиту
     */
    async function apiRequest(endpoint, method = 'GET', data = null, options = {}, retries = 2) {
        try {
            // Перевіряємо, чи це запит до профілю користувача
            const isUserProfileRequest = endpoint.includes('/user/') &&
                                        !endpoint.includes('/staking') &&
                                        !endpoint.includes('/balance') &&
                                        !endpoint.includes('/claim');

            // Формуємо ключ для відстеження запитів
            const requestKey = `${method}:${endpoint}`;

            // Перевіряємо, чи не було такого ж запиту нещодавно
            const now = Date.now();
            const lastRequestTime = _lastRequestsByEndpoint[requestKey] || 0;
            const throttleTime = getThrottleTime(endpoint);

            // Перевіряємо частоту запитів
            if (now - lastRequestTime < throttleTime && !options.bypassThrottle) {
                console.warn(`🔌 API: Занадто частий запит до ${endpoint}, ігноруємо`);

                // Якщо є кеш для запитів даних користувача і запит не вимагає свіжих даних
                if (isUserProfileRequest && _userCache && !options.forceRefresh) {
                    return Promise.resolve({
                        status: 'success',
                        data: _userCache,
                        source: 'cache'
                    });
                }

                return Promise.reject({
                    message: "Занадто частий запит",
                    retryAfter: throttleTime - (now - lastRequestTime)
                });
            }

            // Оновлюємо відстеження запитів
            _lastRequestsByEndpoint[requestKey] = now;

            // Перевіряємо, чи цей запит вже виконується
            if (_activeEndpoints.has(endpoint) && !options.allowParallel) {
                console.warn(`🔌 API: Запит до ${endpoint} вже виконується`);

                // Якщо є кеш і запит не вимагає свіжих даних
                if (isUserProfileRequest && _userCache && !options.forceRefresh) {
                    return {
                        status: 'success',
                        data: _userCache,
                        source: 'cache_parallel'
                    };
                }

                // Створюємо новий запит тільки якщо це критично важливо
                if (!options.forceContinue) {
                    return Promise.reject({
                        message: "Запит вже виконується",
                        source: 'parallel'
                    });
                }
            }

            // Перевірка чи пристрій онлайн
            if (typeof navigator.onLine !== 'undefined' && !navigator.onLine) {
                console.warn("🔌 API: Пристрій офлайн, використовуємо кеш");

                // Якщо є кеш для запитів даних користувача
                if (isUserProfileRequest && _userCache) {
                    return {
                        status: 'success',
                        data: _userCache,
                        source: 'cache_offline'
                    };
                }

                return Promise.reject({
                    message: "Пристрій офлайн",
                    source: 'offline'
                });
            }

            // Додаємо запит до активних
            _activeEndpoints.add(endpoint);

            // Оновлюємо лічильник запитів
            _requestCounter.total++;
            _requestCounter.current++;

            // Скидаємо лічильник поточних запитів кожні 10 секунд
            if (now - _requestCounter.lastReset > 10000) {
                _requestCounter.current = 1;
                _requestCounter.lastReset = now;
            }

            // Якщо забагато запитів - уповільнюємося
            if (_requestCounter.current > 10 && !options.bypassThrottle) {
                console.warn(`🔌 API: Забагато запитів (${_requestCounter.current}), уповільнюємося`);
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            try {
                // Перевіряємо необхідність оновлення токену
                if (!options.skipTokenCheck && _authToken && _authTokenExpiry) {
                    // Оновлюємо токен, якщо він скоро закінчиться (менше 10 хвилин)
                    if (_authTokenExpiry < Date.now() + 600000 && !_pendingRequests['refresh-token']) {
                        try {
                            await refreshToken();
                        } catch (tokenError) {
                            console.warn("🔌 API: Помилка оновлення токену:", tokenError);
                        }
                    }
                }

                // Отримуємо ID користувача, якщо потрібно
                const userId = options.skipUserIdCheck ? null : getUserId();

                // Перевіряємо наявність ID (якщо потрібно)
                if (!userId && !options.skipUserIdCheck) {
                    throw new Error("ID користувача не знайдено");
                }

                // Додаємо мітку часу для запобігання кешуванню
                const timestamp = Date.now();

                // Формуємо URL запиту
                let url;

                // Перевіряємо, чи endpoint вже є повним URL
                if (endpoint.startsWith('http')) {
                    // Endpoint вже є повним URL - використовуємо як є
                    url = endpoint;
                } else {
                    // Нормалізуємо endpoint для правильного формату
                    const normalizedEndpoint = normalizeEndpoint(endpoint);

                    // Перевіряємо, чи є параметри запиту
                    const hasQuery = normalizedEndpoint.includes('?');

                    // Формуємо повний URL
                    url = `${API_BASE_URL}/${normalizedEndpoint}${hasQuery ? '&' : '?'}t=${timestamp}`;
                }

                // Логування запиту
                if (_debugMode) {
                    console.log(`🔄 Відправка ${method} запиту на ${url}`);
                    if (data) {
                        console.log(`📦 Дані запиту:`, data);
                    }
                }

                // Виконуємо запит з повторними спробами
                let response;
                let errorResponse;
                let lastError;

                // Спроби запиту з exponential backoff
                for (let attempt = 0; attempt < retries; attempt++) {
                    try {
                        // Виконуємо запит через rawApiRequest
                        response = await rawApiRequest(url, method, data, {
                            ...options,
                            timeout: options.timeout || 10000
                        });

                        // Якщо запит успішний, виходимо з циклу
                        if (response && response.status !== 'error') break;

                        // Зберігаємо останню помилку
                        errorResponse = response;
                        lastError = new Error(response.message || 'Помилка виконання запиту');

                        // Пауза перед наступною спробою
                        if (attempt < retries - 1) {
                            const delay = Math.pow(2, attempt) * 500; // Експоненційна затримка
                            await new Promise(resolve => setTimeout(resolve, delay));
                        }
                    } catch (fetchError) {
                        lastError = fetchError;

                        // Спеціальна обробка для 401 помилки - спроба оновити токен
                        if (fetchError.status === 401 && !options.skipTokenCheck && attempt === 0) {
                            try {
                                await refreshToken();
                                // Після оновлення токену продовжуємо
                                continue;
                            } catch (tokenError) {
                                console.warn("🔌 API: Помилка оновлення токену при 401:", tokenError);
                            }
                        }

                        // Останній шанс, повертаємо помилку
                        if (attempt === retries - 1) {
                            throw fetchError;
                        }

                        // Затримка перед наступною спробою
                        const delay = Math.pow(2, attempt) * 500;
                        await new Promise(resolve => setTimeout(resolve, delay));
                    }
                }

                // Обробка помилок після всіх спроб
                if (!response || response.status === 'error') {
                    throw lastError || new Error(errorResponse?.message || 'Помилка виконання запиту');
                }

                // Оновлюємо стан підключення при успішному запиті
                _connectionState.isConnected = true;
                _connectionState.lastSuccessTime = Date.now();
                _connectionState.failedAttempts = 0;

                // Якщо це запит даних користувача, оновлюємо кеш
                if (isUserProfileRequest && response.status === 'success' && response.data) {
                    _userCache = response.data;
                    _userCacheTime = now;

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

                        // Зберігаємо налаштування повідомлень
                        if (_userCache.notifications_enabled !== undefined) {
                            localStorage.setItem('notifications_enabled', _userCache.notifications_enabled.toString());
                        }

                        // Відправляємо подію оновлення даних користувача
                        document.dispatchEvent(new CustomEvent('user-data-updated', {
                            detail: _userCache,
                            source: 'api.js'
                        }));
                    } catch (e) {
                        console.warn("🔌 API: Помилка збереження даних в localStorage:", e);
                    }
                }

                // Якщо це запит стейкінгу, оновлюємо кеш
                if (endpoint.includes('/staking') && response.status === 'success' && response.data) {
                    _stakingCache = response.data;
                    _stakingCacheTime = now;

                    // Зберігаємо дані в localStorage
                    try {
                        localStorage.setItem('stakingData', JSON.stringify(_stakingCache));
                        localStorage.setItem('winix_staking', JSON.stringify(_stakingCache));
                    } catch (e) {
                        console.warn("🔌 API: Помилка збереження даних стейкінгу в localStorage:", e);
                    }
                }

                return response;
            } catch (error) {
                // Збільшуємо лічильник помилок
                _requestCounter.errors++;

                // Оновлюємо стан підключення при помилці
                _connectionState.failedAttempts++;

                // Скидаємо стан запиту
                _activeEndpoints.delete(endpoint);

                // Якщо запит тривав занадто довго, очищаємо інші потенційно зависаючі запити
                if (now - _lastRequestTime > 15000) {
                    resetPendingRequests();
                }

                // Обробка конкретних типів помилок
                console.error(`❌ API: Помилка запиту ${endpoint}:`, error.message);

                // Відправляємо подію про помилку
                document.dispatchEvent(new CustomEvent('api-error', {
                    detail: {
                        error,
                        endpoint,
                        method
                    }
                }));

                // Якщо це сторінка налаштувань і помилка з запитом профілю, повертаємо симульовані дані
                const isSettingsPage = window.location.pathname.includes('general.html');
                if (isUserProfileRequest && isSettingsPage) {
                    console.warn("🔌 API: Повертаємо симульовані дані для сторінки налаштувань");

                    // Використовуємо існуючий кеш або симулюємо відповідь
                    if (_userCache) {
                        return {
                            status: 'success',
                            data: _userCache,
                            source: 'cache_after_error'
                        };
                    }

                    return {
                        status: 'success',
                        data: DUMMY_USER_DATA,
                        source: 'simulated'
                    };
                }

                // Повертаємо об'єкт з помилкою, якщо вказано suppressErrors
                if (options.suppressErrors) {
                    return {
                        status: 'error',
                        message: error.message || 'Сталася помилка при виконанні запиту',
                        source: 'api_error'
                    };
                }

                throw error;
            } finally {
                // Видаляємо запит зі списку активних
                _activeEndpoints.delete(endpoint);
            }
        } catch (error) {
            console.error(`❌ API: Глобальна помилка запиту ${endpoint}:`, error);

            if (options.suppressErrors) {
                return {
                    status: 'error',
                    message: error.message || 'Сталася критична помилка при виконанні запиту',
                    source: 'global_error'
                };
            }

            throw error;
        }
    }

    // Додаємо автоматичне скидання старих запитів раз на хвилину
    setInterval(() => {
        const now = Date.now();

        // Якщо є запити, які виконуються більше 30 секунд, скидаємо їх
        let hasLongRunningRequests = false;
        for (const [key, time] of Object.entries(_lastRequestsByEndpoint)) {
            if (now - time > 30000) {
                hasLongRunningRequests = true;
                delete _lastRequestsByEndpoint[key];
                console.warn(`🔌 API: Скинуто старий запит: ${key}`);
            }
        }

        if (hasLongRunningRequests) {
            resetPendingRequests();
        }
    }, 60000);

    // ======== ФУНКЦІЇ КОРИСТУВАЧА ========

    /**
     * Отримання даних користувача
     * @param {boolean} forceRefresh - Примусово оновити
     * @returns {Promise<Object>} Дані користувача
     */
    async function getUserData(forceRefresh = false) {
        const isSettingsPage = window.location.pathname.includes('general.html');

        // Перевірка чи пристрій онлайн
        if (typeof navigator.onLine !== 'undefined' && !navigator.onLine && !forceRefresh) {
            console.warn("🔌 API: Пристрій офлайн, використовуємо кешовані дані");

            // Якщо є кешовані дані, повертаємо їх
            if (_userCache) {
                return {status: 'success', data: _userCache, source: 'cache_offline'};
            }

            // В офлайн режимі на сторінці налаштувань повертаємо симульовані дані
            if (isSettingsPage) {
                return {
                    status: 'success',
                    data: DUMMY_USER_DATA,
                    source: 'simulated_offline'
                };
            }

            // Створюємо базові дані з localStorage
            return {
                status: 'success',
                data: {
                    telegram_id: getUserId() || 'unknown',
                    balance: parseFloat(localStorage.getItem('userTokens') || '0'),
                    coins: parseInt(localStorage.getItem('userCoins') || '0')
                },
                source: 'local_storage_offline'
            };
        }

        // Використовуємо кеш, якщо можливо
        if (!forceRefresh && _userCache && (Date.now() - _userCacheTime < USER_CACHE_TTL)) {
            return {status: 'success', data: _userCache, source: 'cache'};
        }

        const id = getUserId();
        if (!id) {
            if (isSettingsPage) {
                // На сторінці налаштувань повертаємо симульовані дані
                return {
                    status: 'success',
                    data: DUMMY_USER_DATA,
                    source: 'simulated'
                };
            }
            throw new Error("ID користувача не знайдено");
        }

        try {
            const result = await apiRequest(`user/${id}`, 'GET', null, {
                timeout: 5000, // Зменшуємо таймаут для прискорення
                suppressErrors: isSettingsPage // На сторінці налаштувань не показуємо помилки
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

                    // Зберігаємо налаштування повідомлень
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

            // На сторінці налаштувань повертаємо симульовані дані при помилці
            if (isSettingsPage) {
                if (_userCache) {
                    return {status: 'success', data: _userCache, source: 'cache_after_error'};
                }

                return {
                    status: 'success',
                    data: DUMMY_USER_DATA,
                    source: 'simulated'
                };
            }

            // Якщо є кешовані дані, повертаємо їх
            if (_userCache) {
                return {status: 'success', data: _userCache, source: 'cache_after_error'};
            }

            // Створюємо базові дані з localStorage
            const localData = {
                telegram_id: id,
                balance: parseFloat(localStorage.getItem('userTokens') || '0'),
                coins: parseInt(localStorage.getItem('userCoins') || '0')
            };

            return {
                status: 'success',
                data: localData,
                source: 'local_storage_fallback'
            };
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

        // Перевірка чи пристрій онлайн
        if (typeof navigator.onLine !== 'undefined' && !navigator.onLine) {
            console.warn("🔌 API: Пристрій офлайн, використовуємо кешовані дані балансу");

            // Повертаємо дані з localStorage
            return {
                status: 'success',
                data: {
                    balance: parseFloat(localStorage.getItem('userTokens') || '0'),
                    coins: parseInt(localStorage.getItem('userCoins') || '0')
                },
                source: 'local_storage_offline'
            };
        }

        try {
            return await apiRequest(`user/${userId}/balance`);
        } catch (error) {
            console.error("🔌 API: Помилка отримання балансу:", error);

            // Повертаємо дані з localStorage при помилці
            return {
                status: 'success',
                data: {
                    balance: parseFloat(localStorage.getItem('userTokens') || '0'),
                    coins: parseInt(localStorage.getItem('userCoins') || '0')
                },
                source: 'local_storage_fallback'
            };
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

        // Використовуємо кеш, якщо можливо
        if (_stakingCache && (Date.now() - _stakingCacheTime < STAKING_CACHE_TTL)) {
            return {status: 'success', data: _stakingCache, source: 'cache'};
        }

        return apiRequest(`user/${userId}/staking`);
    }

    /**
     * Отримання історії стейкінгу
     */
    async function getStakingHistory() {
        const userId = getUserId();
        if (!userId) {
            throw new Error("ID користувача не знайдено");
        }

        return apiRequest(`user/${userId}/staking/history`);
    }

    /**
     * Створення нового стейкінгу
     * @param {number} amount - Сума стейкінгу
     * @param {number} period - Період стейкінгу в днях
     */
    async function createStaking(amount, period) {
        const userId = getUserId();
        if (!userId) {
            throw new Error("ID користувача не знайдено");
        }

        // Перевіряємо коректність параметрів
        if (isNaN(amount) || amount <= 0) {
            throw new Error("Сума стейкінгу має бути додатним числом");
        }

        if (![7, 14, 28].includes(period)) {
            throw new Error("Період стейкінгу може бути 7, 14 або 28 днів");
        }

        return apiRequest(`user/${userId}/staking`, 'POST', {
            stakingAmount: parseInt(amount),
            period: period
        });
    }

    /**
     * Додавання коштів до стейкінгу
     * @param {number} amount - Сума для додавання
     * @param {string} stakingId - ID стейкінгу (опціонально)
     */
    async function addToStaking(amount, stakingId = null) {
        const userId = getUserId();
        if (!userId) {
            throw new Error("ID користувача не знайдено");
        }

        // Перевіряємо коректність параметрів
        if (isNaN(amount) || amount <= 0) {
            throw new Error("Сума має бути додатним числом");
        }

        // Отримуємо ID стейкінгу, якщо не передано
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

        return apiRequest(`user/${userId}/staking/${targetStakingId}`, 'PUT', {
            additionalAmount: parseInt(amount)
        });
    }

    /**
     * Скасування стейкінгу
     * @param {string} stakingId - ID стейкінгу (опціонально)
     */
    async function cancelStaking(stakingId = null) {
        const userId = getUserId();
        if (!userId) {
            throw new Error("ID користувача не знайдено");
        }

        // Отримуємо ID стейкінгу, якщо не передано
        let targetStakingId = stakingId;
        if (!targetStakingId) {
            try {
                // Спробуємо отримати з API
                const stakingData = await getStakingData();
                if (stakingData.status === 'success' && stakingData.data && stakingData.data.hasActiveStaking) {
                    targetStakingId = stakingData.data.stakingId;
                } else {
                    // Спробуємо отримати з localStorage
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

        return apiRequest(`user/${userId}/staking/${targetStakingId}/cancel`, 'POST', {
            confirm: true,
            timestamp: Date.now()
        });
    }

    /**
     * Розрахунок очікуваної винагороди
     * @param {number} amount - Сума стейкінгу
     * @param {number} period - Період стейкінгу в днях
     */
    async function calculateExpectedReward(amount, period) {
        // Виконуємо локальний розрахунок, без звернення до API
        // Це набагато швидше і не створює зайвих запитів

        // Перевіряємо параметри
        amount = parseInt(amount) || 0;
        period = parseInt(period) || 14;

        if (amount <= 0) {
            return { status: 'success', data: { reward: 0 } };
        }

        if (![7, 14, 28].includes(period)) {
            period = 14; // За замовчуванням
        }

        // Відсотки винагороди
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
     * @param {number} limit - Кількість транзакцій
     */
    async function getTransactions(limit = 100) {
        // Перевіряємо наявність ID користувача
        const userId = getUserId();
        if (!userId) {
            return {
                status: 'error',
                message: 'ID користувача не знайдено'
            };
        }

        // Виконуємо запит до серверу
        try {
            return await apiRequest(`user/${userId}/transactions?limit=${limit}`, 'GET', null, {
                suppressErrors: true
            });
        } catch (error) {
            console.warn("🔌 API: Транзакції недоступні:", error);
            // Повертаємо порожній масив, оскільки API транзакцій може бути не реалізоване
            return {
                status: 'success',
                data: [], // Пустий масив
                message: 'Історія транзакцій тимчасово недоступна'
            };
        }
    }

    /**
     * Оновлення налаштувань користувача
     * @param {object} settings - Налаштування для оновлення
     */
    async function updateSettings(settings) {
        const userId = getUserId();
        if (!userId) {
            throw new Error("ID користувача не знайдено");
        }

        try {
            return await apiRequest(`user/${userId}/settings`, 'POST', settings);
        } catch (error) {
            console.error("🔌 API: Помилка оновлення налаштувань:", error);

            // Зберігаємо в localStorage навіть якщо API не спрацював
            if (settings.notifications_enabled !== undefined) {
                localStorage.setItem('notifications_enabled', settings.notifications_enabled.toString());
            }

            // Імітуємо успішну відповідь
            return {
                status: 'success',
                message: 'Налаштування збережено локально',
                source: 'local'
            };
        }
    }

    /**
     * Примусове очищення всіх активних запитів
     */
    function forceCleanupRequests() {
        _lastRequestsByEndpoint = {};
        _activeEndpoints.clear();
        _pendingRequests = {};
        console.log("🔌 API: Примусово очищено відстеження запитів");
        return true;
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
        if (_connectionState.failedAttempts > _connectionState.maxRetries) {
            console.error("❌ API: Досягнуто максимальної кількості спроб відновлення");
            return false;
        }

        console.log("🔄 API: Спроба відновлення з'єднання...");

        // Очищаємо стан запитів
        forceCleanupRequests();

        // Спроба оновити токен
        try {
            await refreshToken();
        } catch (error) {
            console.warn("⚠️ API: Не вдалося оновити токен:", error);
        }

        // Спроба отримати дані користувача
        try {
            await getUserData(true);

            // Успішне відновлення
            _connectionState.isConnected = true;
            _connectionState.lastSuccessTime = Date.now();
            _connectionState.failedAttempts = 0;

            console.log("✅ API: З'єднання успішно відновлено");
            return true;
        } catch (error) {
            console.error("❌ API: Помилка відновлення з'єднання:", error);
            return false;
        }
    }

    // ======== ЕКСПОРТ API ========

    // Створюємо публічний API
    window.WinixAPI = {
        // Конфігурація
        config: {
            baseUrl: API_BASE_URL,
            version: '1.1.0',
            environment: API_BASE_URL.includes('localhost') ? 'development' : 'production'
        },

        // Налаштування
        setDebugMode: function(debug) {
            _debugMode = debug;
            return this;
        },

        // Базові функції
        apiRequest,
        getUserId,
        getAuthToken,
        refreshToken,
        clearCache,
        forceCleanupRequests,
        reconnect,

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
        getTransactions
    };

    // Для зворотної сумісності
    window.apiRequest = apiRequest;
    window.getUserId = getUserId;

    // Обробники подій для відновлення з'єднання
    window.addEventListener('online', () => {
        console.log("🔄 API: З'єднання з мережею відновлено, спроба підключення");
        reconnect();
    });

    console.log(`✅ API: Модуль успішно ініціалізовано (URL: ${API_BASE_URL})`);
})();