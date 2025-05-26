/**
api.js - Єдиний модуль для всіх API-запитів WINIX
 * Виправлена версія з health check та кращою обробкою помилок для ПРОДАКШН
 * @version 1.4.0
 */

(function() {
    'use strict';
    let endpoint = ""; // Оголошення глобальної змінної
    console.log("🔌 API: Ініціалізація єдиного API модуля з health check для продакшн");

    // ======== API-ШЛЯХИ ========

    // Константи API-шляхів для централізованого управління
    const API_PATHS = {
        // Health check
        HEALTH: 'health',
        PING: 'ping',
        CORS_TEST: 'cors-test',

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

    // ВИПРАВЛЕНО: Базовий URL для продакшн
    const API_BASE_URL = (() => {
        // ПРІОРИТЕТ 1: Перевіряємо глобальний конфіг
        if (window.WinixConfig && window.WinixConfig.apiBaseUrl) {
            let url = window.WinixConfig.apiBaseUrl;
            return url.endsWith('/api') ? url.slice(0, -4) : url;
        }

        // ПРІОРИТЕТ 2: Перевіряємо URL параметри для розробки
        try {
            const urlParams = new URLSearchParams(window.location.search);
            const devServer = urlParams.get('dev_server') || urlParams.get('api_url');
            if (devServer) {
                console.log('🔧 API: Використовується dev сервер з URL:', devServer);
                return devServer;
            }
        } catch (e) {
            console.warn('⚠️ API: Помилка читання URL параметрів:', e);
        }

        // ПРІОРИТЕТ 3: Визначаємо середовище
        const hostname = window.location.hostname;
        const isLocalhost = hostname === 'localhost' || hostname === '127.0.0.1';
        const isLocalIP = /^192\.168\.|^10\.|^172\.(1[6-9]|2[0-9]|3[0-1])\./.test(hostname);

        // Перевіряємо localStorage для збереженого dev URL
        try {
            const savedDevUrl = localStorage.getItem('winix_dev_api_url');
            if (savedDevUrl && (isLocalhost || isLocalIP || hostname.includes('ngrok'))) {
                console.log('🔧 API: Використовується збережений dev URL:', savedDevUrl);
                return savedDevUrl;
            }
        } catch (e) {
            console.warn('⚠️ API: Помилка читання dev URL з localStorage:', e);
        }

        // Локальне середовище
        if (isLocalhost) {
            return `http://${hostname}:8080`;
        }

        // Локальна мережа
        if (isLocalIP) {
            return `http://${hostname}:8080`;
        }

        // Розробка через ngrok або подібні тунелі
        if (hostname.includes('ngrok') || hostname.includes('localtunnel')) {
            return `https://${hostname}`;
        }

        // Тестові середовища
        if (hostname.includes('testenv') || hostname.includes('staging')) {
            return `https://${hostname}`;
        }

        // ПРОДАКШН: За замовчуванням використовуємо winixbot.com
        console.log('🌐 API: Використовується продакшн сервер winixbot.com');
        return 'https://winixbot.com';
    })();

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
    let _debugMode = API_BASE_URL.includes('localhost') || API_BASE_URL.includes('127.0.0.1');

    // Кешовані дані користувача
    let _userCache = null;
    let _userCacheTime = 0;
    const USER_CACHE_TTL = 300000; // 5 хвилин

    // Кешовані дані стейкінгу
    let _stakingCache = null;
    let _stakingCacheTime = 0;
    const STAKING_CACHE_TTL = 180000; // 3 хвилини

    // Управління запитами
    let _pendingRequests = {};
    let _activeEndpoints = new Set();
    let _blockedEndpoints = {}; // Новий об'єкт для управління блокованими ендпоінтами

    // Відстеження запитів, щоб запобігти повторним викликам
    let _lastRequestsByEndpoint = {};

    // ВИПРАВЛЕНО: Збільшені інтервали для продакшн
    const REQUEST_THROTTLE = {
        '/user/': 5000,        // 5 секунд замість 8
        '/staking': 8000,      // 8 секунд замість 10
        '/balance': 4000,      // 4 секунди замість 6
        '/transactions': 10000, // 10 секунд замість 15
        '/participate-raffle': 3000, // 3 секунди замість 5
        '/health': 2000,       // 2 секунди для health check
        '/ping': 1000,         // 1 секунда для ping
        'default': 3000        // 3 секунди замість 5
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

    // ======== HEALTH CHECK ФУНКЦІЇ ========

    /**
     * ВИПРАВЛЕНО: Перевірка здоров'я API з збільшеними таймаутами для продакшн
     */
    async function checkApiHealth() {
        if (_apiState.healthCheckInProgress) {
            console.log("🔌 API: Health check вже виконується");
            return _apiState.isHealthy;
        }

        _apiState.healthCheckInProgress = true;
        console.log("🏥 API: Перевірка здоров'я API...");

        try {
            const controller = new AbortController();

            // ВИПРАВЛЕНО: Збільшений таймаут для продакшн
            const timeout = API_BASE_URL.includes('localhost') ? 5000 : 15000; // 15 секунд для продакшн
            const timeoutId = setTimeout(() => controller.abort(), timeout);

            const response = await fetch(`${API_BASE_URL}/api/${API_PATHS.HEALTH}`, {
                method: 'GET',
                signal: controller.signal,
                headers: {
                    'Accept': 'application/json',
                    'Cache-Control': 'no-cache'
                }
            });

            clearTimeout(timeoutId);

            if (response.ok) {
                const data = await response.json().catch(() => ({ status: 'ok' }));

                _apiState.isHealthy = true;
                _apiState.lastHealthCheck = Date.now();
                _apiState.consecutiveFailures = 0;
                _connectionState.isConnected = true;
                _connectionState.lastSuccessTime = Date.now();

                console.log("✅ API: Сервер здоровий", data);

                // Приховуємо повідомлення про недоступність якщо воно було
                hideServerUnavailableMessage();

                return true;
            } else {
                throw new Error(`Health check failed: ${response.status} ${response.statusText}`);
            }

        } catch (error) {
            console.error("❌ API: Health check провалений:", error.message);

            _apiState.isHealthy = false;
            _apiState.consecutiveFailures++;
            _connectionState.isConnected = false;

            // Спеціальна обробка для різних типів помилок
            if (error.name === 'AbortError') {
                console.error("⏰ API: Health check timeout - сервер занадто повільно відповідає");
            } else if (error.message.includes('NetworkError') || error.message.includes('Failed to fetch')) {
                console.error("🌐 API: Мережева помилка - перевірте з'єднання з інтернетом");
            } else if (error.message.includes('CORS')) {
                console.error("🔒 API: CORS помилка - проблема з налаштуваннями сервера");
            }

            // Показуємо повідомлення користувачу тільки після кількох невдач
            if (_apiState.consecutiveFailures >= _apiState.maxFailures) {
                showServerUnavailableMessage();
            }

            return false;
        } finally {
            _apiState.healthCheckInProgress = false;
        }
    }

    /**
     * ВИПРАВЛЕНО: Показати повідомлення про недоступність сервера
     */
    function showServerUnavailableMessage() {
        console.warn("⚠️ API: Показуємо повідомлення про недоступність сервера");

        // Показуємо banner користувачу
        let banner = document.getElementById('server-unavailable-banner');
        if (!banner) {
            banner = document.createElement('div');
            banner.id = 'server-unavailable-banner';
            banner.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                right: 0;
                background: linear-gradient(135deg, #e74c3c, #c0392b);
                color: white;
                text-align: center;
                padding: 15px;
                z-index: 10000;
                font-size: 14px;
                font-weight: 500;
                border-bottom: 3px solid #a93226;
                box-shadow: 0 2px 10px rgba(0,0,0,0.3);
                animation: slideDown 0.5s ease-out;
            `;

            // Додаємо CSS анімацію
            if (!document.getElementById('banner-styles')) {
                const style = document.createElement('style');
                style.id = 'banner-styles';
                style.textContent = `
                    @keyframes slideDown {
                        from { transform: translateY(-100%); opacity: 0; }
                        to { transform: translateY(0); opacity: 1; }
                    }
                `;
                document.head.appendChild(style);
            }

            banner.innerHTML = `
                <div style="font-size: 16px; margin-bottom: 5px;">⚠️ Сервер тимчасово недоступний</div>
                <div style="font-size: 12px; opacity: 0.9;">
                    Перевіряємо з'єднання... Спробуйте оновити сторінку
                </div>
                <div style="font-size: 11px; margin-top: 5px; opacity: 0.8;">
                    Помилок підряд: ${_apiState.consecutiveFailures}
                </div>
            `;
            document.body.insertBefore(banner, document.body.firstChild);
        } else {
            // Оновлюємо існуючий banner
            banner.querySelector('div:last-child').textContent = `Помилок підряд: ${_apiState.consecutiveFailures}`;
        }

        // Вібрація якщо доступна
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
            banner.style.animation = 'slideDown 0.5s ease-out reverse';
            setTimeout(() => banner.remove(), 500);
            console.log("✅ API: Повідомлення про недоступність приховано");
        }
    }

    /**
     * ВИПРАВЛЕНО: Запуск періодичної перевірки здоров'я з адаптивними інтервалами
     */
    function startHealthCheck() {
        console.log("🏥 API: Запуск періодичної перевірки здоров'я");

        // Очищаємо попередній інтервал
        if (_apiState.healthCheckInterval) {
            clearInterval(_apiState.healthCheckInterval);
        }

        // Початкова перевірка
        checkApiHealth();

        // ВИПРАВЛЕНО: Адаптивні інтервали в залежності від стану
        function scheduleNextCheck() {
            // Визначаємо інтервал на основі стану здоров'я
            let interval;
            if (_apiState.isHealthy && _apiState.consecutiveFailures === 0) {
                interval = 60000; // 1 хвилина якщо все добре
            } else if (_apiState.consecutiveFailures < 3) {
                interval = 30000; // 30 секунд при невеликих проблемах
            } else {
                interval = 15000; // 15 секунд при серйозних проблемах
            }

            setTimeout(async () => {
                const isHealthy = await checkApiHealth();
                scheduleNextCheck(); // Плануємо наступну перевірку
            }, interval);
        }

        scheduleNextCheck();
    }

    /**
     * ВИПРАВЛЕНО: Перевірка готовності API перед запитом з кращою логікою та fallback
     */
    async function ensureApiReady() {
        // Якщо health check застарілий (більше 2 хвилин для продакшн)
        const healthCheckAge = Date.now() - _apiState.lastHealthCheck;
        const maxAge = API_BASE_URL.includes('localhost') ? 60000 : 120000; // 2 хвилини для продакшн

        if (healthCheckAge > maxAge || !_apiState.isHealthy) {
            console.log("🔍 API: Перевіряємо готовність API...");
            const isHealthy = await checkApiHealth();

            if (!isHealthy) {
                // НОВОЕ: Для продакшн не блокуємо запити, а просто попереджаємо
                if (!API_BASE_URL.includes('localhost')) {
                    console.warn("⚠️ API: Health check провалений, але продовжуємо роботу для продакшн");
                    _apiState.isHealthy = true; // Примусово встановлюємо як здоровий для продакшн
                    return true;
                } else {
                    throw new Error("Сервер недоступний. Перевірте з'єднання з інтернетом та спробуйте пізніше.");
                }
            }
        }

        return true;
    }

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
            const now = Date.now();

            // 1. Перевіряємо наявність токену в пам'яті
            if (_authToken && _authTokenExpiry > now) {
                return _authToken;
            }

            // 2. Спробуємо отримати токен через StorageUtils, якщо доступний
            let token = null;
            let tokenExpiry = 0;

            if (window.StorageUtils) {
                token = window.StorageUtils.getItem('auth_token');
                tokenExpiry = parseInt(window.StorageUtils.getItem('auth_token_expiry') || '0');
            } else {
                // 3. Спробуємо отримати токен з localStorage
                token = localStorage.getItem('auth_token');
                tokenExpiry = parseInt(localStorage.getItem('auth_token_expiry') || '0');
            }

            if (token && typeof token === 'string' && token.length > 5) {
                if (tokenExpiry > now) {
                    _authToken = token;
                    _authTokenExpiry = tokenExpiry;
                    return token;
                }

                // Токен застарів, але зберігаємо його для запиту оновлення
                if (!_authToken) {
                    _authToken = token;
                }
            }

            // 4. Альтернативні джерела токену
            if (window.WinixConfig && window.WinixConfig.authToken) {
                _authToken = window.WinixConfig.authToken;
                return _authToken;
            }

            // 5. Перевіряємо URL-параметри
            try {
                const urlParams = new URLSearchParams(window.location.search);
                const urlToken = urlParams.get('token') || urlParams.get('auth_token');
                if (urlToken && urlToken.length > 5) {
                    // Зберігаємо знайдений токен
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
     * ВИПРАВЛЕНО: Безпечна перевірка, чи містить рядок певний підрядок
     * @param {string|undefined} str - Рядок для перевірки
     * @param {string} substring - Підрядок, який шукаємо
     * @returns {boolean} Результат перевірки
     */
    function safeIncludes(str, substring) {
        // Безпечна перевірка includes з обробкою undefined
        if (!str || typeof str !== 'string') return false;
        return str.includes(substring);
    }

    /**
     * Нормалізація API endpoint для уникнення проблем з URL
     * @param {string} endpoint - вхідний endpoint
     * @returns {string} нормалізований endpoint
     */
    function normalizeEndpoint(endpoint) {
        // ВИПРАВЛЕНО: Додаємо захист від undefined
        if (!endpoint) return 'api';

        // Перевіряємо, чи endpoint є функцією і викликаємо її, якщо це так
        if (typeof endpoint === 'function') {
            try {
                endpoint = endpoint();
                // Якщо функція повернула undefined або null
                if (!endpoint) return 'api';
            } catch (e) {
                console.error("🔌 API: Помилка виклику endpoint функції:", e);
                return 'api';
            }
        }

        // Перетворюємо endpoint на рядок, якщо це ще не рядок
        endpoint = String(endpoint);

        // Видаляємо слеш на початку, якщо він є
        let cleanEndpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;

        // Видаляємо слеш в кінці, якщо він є
        if (cleanEndpoint.endsWith('/') && cleanEndpoint.length > 1) {
            cleanEndpoint = cleanEndpoint.substring(0, cleanEndpoint.length - 1);
        }

        // Перевіряємо, чи починається шлях з 'api/'
        if (cleanEndpoint.startsWith('api/')) {
            return cleanEndpoint;
        } else if (cleanEndpoint === 'api') {
            // Якщо це просто 'api', повертаємо без змін
            return cleanEndpoint;
        } else if (cleanEndpoint.startsWith('api')) {
            // Якщо починається з 'api' але без слешу після
            return `api/${cleanEndpoint.substring(3)}`;
        } else {
            // В усіх інших випадках додаємо 'api/' на початок
            return `api/${cleanEndpoint}`;
        }
    }

    /**
     * Перевірка валідності UUID
     * @param {string} id - ID для перевірки
     * @returns {boolean} Результат перевірки
     */
    function isValidUUID(id) {
        if (!id || typeof id !== 'string') return false;

        // Нормалізуємо ID
        const normalized = id.trim().toLowerCase();

        // Підтримка різних форматів UUID
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
     * ВИПРАВЛЕНО: Оновлення токену авторизації з покращеною обробкою помилок та fallback
     * @returns {Promise<string|null>} Новий токен або null
     */
    async function refreshToken() {
        // ВИПРАВЛЕНО: Для refresh token не робимо строгу перевірку API ready
        // Це може створити циклічну залежність
        console.log("🔄 API: Початок оновлення токену (пропускаємо health check)");

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

                // ВИПРАВЛЕНО: Збільшений таймаут для продакшн та fallback режим
                const timeout = API_BASE_URL.includes('localhost') ? 10000 : 30000; // 30 секунд для продакшн
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), timeout);

                try {
                    const response = await fetch(`${API_BASE_URL}/${normalizeEndpoint(API_PATHS.AUTH.REFRESH_TOKEN)}`, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'X-Telegram-User-Id': userId,
                            'Accept': 'application/json',
                            'Cache-Control': 'no-cache'
                        },
                        body: JSON.stringify({
                            telegram_id: userId,
                            token: _authToken || ''
                        }),
                        signal: controller.signal
                    });

                    clearTimeout(timeoutId);

                    if (!response.ok) {
                        // Спеціальна обробка 400/401 помилок при оновленні токену
                        if (response.status === 400 || response.status === 401) {
                            console.warn("⚠️ API: Токен недійсний, очищаємо");
                            clearAuthToken();
                            throw new Error("Токен недійсний. Потрібна повторна авторизація");
                        }

                        // НОВОЕ: Для 404 помилок в продакшн показуємо більш м'яке повідомлення
                        if (response.status === 404 && !API_BASE_URL.includes('localhost')) {
                            console.warn("⚠️ API: Endpoint refresh-token не знайдено, можливо сервер ще не готовий");
                            throw new Error("Сервіс автентифікації тимчасово недоступний");
                        }

                        throw new Error(`Помилка HTTP: ${response.status} ${response.statusText}`);
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

                        // Відправляємо подію про оновлення токену
                        document.dispatchEvent(new CustomEvent('token-refreshed', {
                            detail: { token: _authToken, expires_at: _authTokenExpiry }
                        }));

                        resolve(_authToken);
                    } else {
                        throw new Error(data.message || "Помилка оновлення токену");
                    }
                } catch (fetchError) {
                    clearTimeout(timeoutId);

                    // НОВОЕ: Детальна обробка різних типів помилок
                    if (fetchError.name === 'AbortError') {
                        throw new Error("Timeout при оновленні токену - сервер занадто повільно відповідає");
                    } else if (fetchError.message && fetchError.message.includes('NetworkError')) {
                        throw new Error("Мережева помилка при оновленні токену");
                    } else if (fetchError.message && fetchError.message.includes('CORS')) {
                        throw new Error("CORS помилка при оновленні токену");
                    } else {
                        throw fetchError;
                    }
                }
            } catch (error) {
                console.error("❌ API: Помилка оновлення токену:", error);

                // НОВОЕ: Для продакшн не показуємо технічні деталі користувачу
                if (!API_BASE_URL.includes('localhost') && typeof window.showToast === 'function') {
                    window.showToast('Проблема з автентифікацією. Спробуйте перезавантажити сторінку.', 'warning');
                }

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

        // Відправляємо подію про очищення токену
        document.dispatchEvent(new CustomEvent('token-cleared'));
    }

    // ======== ФУНКЦІЇ API-ЗАПИТУ ========

    /**
     * Функція для примусового скидання зависаючих запитів
     * @returns {boolean} Чи було виконано скидання
     */
    function resetPendingRequests() {
        // Якщо є більше 5 активних запитів, потенційно маємо проблему
        if (_activeEndpoints.size > 5) {
            console.warn(`🔌 API: Виявлено ${_activeEndpoints.size} активних запитів, скидаємо стан`);
            _activeEndpoints.clear();
            _pendingRequests = {};
            return true;
        }
        return false;
    }

    /**
     * Допоміжна функція для визначення мінімального інтервалу між запитами
     * @param {string} endpoint - URL ендпоінту
     * @returns {number} Мінімальний інтервал у мілісекундах
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
     * Функція обробки обмеження запитів (rate limiting)
     * @param {string} endpoint - URL ендпоінту
     * @param {number} retryAfter - Час очікування в секундах
     */
    function handleRateLimiting(endpoint, retryAfter) {
        console.log(`⏳ Rate limiting: Очікування ${retryAfter}с для ${endpoint}`);

        // Якщо є активне очікування для цього ендпоінту, очищаємо його
        if (_blockedEndpoints[endpoint] && _blockedEndpoints[endpoint].timeoutId) {
            clearTimeout(_blockedEndpoints[endpoint].timeoutId);
        }

        // Заплануйте повторний запит через вказаний час
        const retryTimeoutId = setTimeout(() => {
            console.log(`✅ Термін очікування для ${endpoint} закінчився, дозволяємо запити`);
            // Очистіть блокування для цього ендпоінту
            delete _blockedEndpoints[endpoint];

            // Відправте повідомлення, що інтерфейс готовий продовжити роботу
            if (typeof window.showToast === 'function') {
                window.showToast('З\'єднання відновлено. Ви можете продовжити користування застосунком.', 'success');
            }
        }, retryAfter * 1000);

        // Зберегіть інформацію про блокування
        _blockedEndpoints[endpoint] = {
            until: Date.now() + (retryAfter * 1000),
            timeoutId: retryTimeoutId
        };
    }

    /**
     * Перевірка чи endpoint заблокований через rate limit
     * @param {string} endpoint - URL ендпоінту
     * @returns {boolean} Результат перевірки
     */
    function isEndpointBlocked(endpoint) {
        // ВИПРАВЛЕНО: Захист від undefined для endpoint
        if (!endpoint) return false;

        // Перевіряємо чи є блокування для цього ендпоінту або для глобальних запитів
        const isBlocked = Object.keys(_blockedEndpoints).some(key => {
            // Якщо це прямий збіг або глобальне блокування "default"
            if ((safeIncludes(endpoint, key) || key === 'default') &&
                _blockedEndpoints[key].until > Date.now()) {
                return true;
            }
            return false;
        });

        return isBlocked;
    }

    /**
     * ВИПРАВЛЕНО: Універсальна функція для виконання API-запитів з покращеною логікою для продакшн
     * @param {string} endpoint - URL ендпоінту
     * @param {string} method - HTTP метод (GET, POST, PUT, DELETE)
     * @param {Object} data - Дані для відправки
     * @param {Object} options - Додаткові параметри
     * @param {number} retries - Кількість повторних спроб
     * @returns {Promise<Object>} Результат запиту
     */
    async function apiRequest(endpoint, method = 'GET', data = null, options = {}, retries = 3) {
        try {
            // ВИПРАВЛЕНО: Захист від undefined endpoint
            if (!endpoint) {
                console.error("🔌 API: endpoint є undefined або null");
                return Promise.reject({
                    status: 'error',
                    message: 'Не вказано endpoint для запиту',
                    code: 'missing_endpoint'
                });
            }

            // Перевірка готовності API перед запитом (тільки для важливих запитів)
            if (!options.skipHealthCheck && !safeIncludes(endpoint, 'ping') && !safeIncludes(endpoint, 'health') && !safeIncludes(endpoint, 'cors-test')) {
                try {
                    await ensureApiReady();
                } catch (error) {
                    console.error("🔌 API: Сервер недоступний:", error);

                    // НОВОЕ: Emergency режим для критичних запитів
                    const isCriticalEndpoint = safeIncludes(endpoint, 'auth') ||
                                             safeIncludes(endpoint, 'refresh-token') ||
                                             safeIncludes(endpoint, 'user') ||
                                             safeIncludes(endpoint, 'balance');

                    if (isCriticalEndpoint && !API_BASE_URL.includes('localhost')) {
                        console.warn("🚨 API: Emergency режим для критичного запиту:", endpoint);
                        // Пропускаємо health check для критичних запитів в продакшн
                    } else if (!options.suppressErrors) {
                        return Promise.reject({
                            status: 'error',
                            message: error.message,
                            code: 'server_unavailable'
                        });
                    }
                }
            }

            // Логування при відлагодженні
            if (_debugMode) {
                console.log(`🔌 API: Початок запиту ${method} до ${endpoint}`);
            }

            // Перевірка глобального блокування через rate limit
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

            // Формуємо URL запиту
            let url;

            // Переконуємося, що URL формується коректно
            if (safeIncludes(endpoint, 'http')) {
                // Endpoint вже є повним URL - використовуємо як є
                url = endpoint;
            } else {
                // ВИПРАВЛЕНО: Нормалізуємо endpoint для правильного формату
                const normalizedEndpoint = normalizeEndpoint(endpoint);

                // Забезпечуємо, що до URL не додаються неправильні параметри
                const hasQuery = safeIncludes(normalizedEndpoint, '?');

                // ВИПРАВЛЕНО: Додаємо кешобрейкер до URL (параметр t=timestamp)
                const timestamp = Date.now();

                // ВИПРАВЛЕНО: Формуємо повний URL з коректним шляхом
                url = `${API_BASE_URL}/${normalizedEndpoint}`
                    .replace(/([^:]\/)\/+/g, "$1") // Видаляємо зайві послідовні слеші
                    + (hasQuery ? '&' : '?') + `t=${timestamp}`; // Додаємо кешобрейкер
            }

            // Перевірка на пристрій офлайн
            if (typeof navigator.onLine !== 'undefined' && !navigator.onLine) {
                return Promise.reject({
                    message: "Пристрій офлайн",
                    source: 'offline'
                });
            }

            // Заголовки запиту
            const headers = {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                'Cache-Control': 'no-cache',
                ...(options.headers || {})
            };

            // Переконуємося, що токен авторизації додається коректно
            if (!options.skipTokenCheck) {
                const token = getAuthToken();
                if (token) {
                    headers['Authorization'] = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
                }
            }

            // Додаємо ID користувача, якщо він є
            const userId = options.skipUserIdCheck ? null : getUserId();
            if (userId && !options.skipUserIdCheck) {
                headers['X-Telegram-User-Id'] = userId;
            }

            // ВИПРАВЛЕНО: Збільшені таймаути для продакшн
            const timeout = options.timeout || (API_BASE_URL.includes('localhost') ? 15000 : 30000); // 30 секунд для продакшн

            // Параметри запиту
            const requestOptions = {
                method: method,
                headers: headers,
                timeout: timeout
            };

            // Додаємо тіло запиту для POST/PUT/PATCH
            if (data && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
                requestOptions.body = JSON.stringify(data);
            }

            // НОВЕ: Перевірка паралельних запитів для критичних ендпоінтів
            if (!options.allowParallel && safeIncludes(endpoint, 'participate-raffle')) {
                // Якщо ендпоінт вже активний, відхиляємо запит
                if (_activeEndpoints.has(endpoint)) {
                    return Promise.reject({
                        status: 'error',
                        message: 'Зачекайте завершення попереднього запиту',
                        code: 'concurrent_request'
                    });
                }

                // Додаємо ендпоінт до активних
                _activeEndpoints.add(endpoint);
            }

            // Спроби виконати запит
            let response;
            let lastError;

            try {
                // Інкрементуємо лічильник запитів
                _requestCounter.total++;
                _requestCounter.current++;

                // Відображаємо індикатор завантаження
                if (!options.hideLoader && typeof window.showLoading === 'function') {
                    window.showLoading();
                }

                // ВИПРАВЛЕНО: Виконуємо запит з контролем таймаута
                const controller = new AbortController();
                const timeoutId = setTimeout(() => controller.abort(), timeout);

                // Налаштовуємо сигнал
                requestOptions.signal = controller.signal;

                // Виконуємо запит
                const fetchResponse = await fetch(url, requestOptions);

                // Очищаємо таймаут
                clearTimeout(timeoutId);

                // Приховуємо індикатор завантаження
                if (!options.hideLoader && typeof window.hideLoading === 'function') {
                    window.hideLoading();
                }

                // Обробка спеціальних статус-кодів
                if (fetchResponse.status === 429) {
                    // Too Many Requests - отримуємо час очікування з заголовка
                    const retryAfter = fetchResponse.headers.get('Retry-After') || 30; // секунд

                    // Викликаємо функцію блокування ендпоінту
                    const endpointKey = Object.keys(REQUEST_THROTTLE).find(key => safeIncludes(endpoint, key)) || 'default';
                    handleRateLimiting(endpointKey, parseInt(retryAfter));

                    throw new Error(`Занадто багато запитів. Спробуйте через ${retryAfter} секунд.`);
                }

                // Спеціальна обробка для 401 (Unauthorized) - спроба оновити токен
                if (fetchResponse.status === 401 && !safeIncludes(endpoint, 'refresh-token')) {
                    console.warn("🔌 API: Помилка авторизації. Спроба оновлення токену...");

                    // Якщо залишились спроби, спробуємо оновити токен і повторити запит
                    if (retries > 0) {
                        try {
                            await refreshToken();

                            // Повторюємо запит з оновленим токеном
                            return apiRequest(endpoint, method, data, options, retries - 1);
                        } catch (tokenError) {
                            console.error("🔌 API: Не вдалося оновити токен:", tokenError);
                            clearAuthToken(); // Очищаємо недійсний токен
                        }
                    }
                }

                // Обробка 500+ помилок
                if (fetchResponse.status >= 500) {
                    _connectionState.isConnected = false;
                    _apiState.isHealthy = false;
                    _apiState.consecutiveFailures++;

                    // Показуємо banner про недоступність сервера
                    if (_apiState.consecutiveFailures >= _apiState.maxFailures) {
                        showServerUnavailableMessage();
                    }

                    throw new Error(`Сервер тимчасово недоступний (${fetchResponse.status}). Спробуйте пізніше.`);
                }

                // ВИПРАВЛЕНО: Покращена обробка 404 помилок
                if (fetchResponse.status === 404) {
                    console.warn(`⚠️ API: Ресурс не знайдено: ${url}`);
                    return Promise.reject({
                        status: "error",
                        message: "Ресурс не знайдено",
                        httpStatus: 404,
                        endpoint: endpoint
                    });
                }

                // Перевірка HTTP статусу
                if (!fetchResponse.ok) {
                    // Додаємо більше інформації про помилку
                    const errorResponse = await fetchResponse.text();
                    let errorMessage;

                    try {
                        const errorJson = JSON.parse(errorResponse);
                        errorMessage = errorJson.message || `Помилка серверу: ${fetchResponse.status}`;
                    } catch (e) {
                        errorMessage = `Помилка серверу: ${fetchResponse.status} ${fetchResponse.statusText}`;
                    }

                    throw new Error(errorMessage);
                }

                // Парсимо відповідь
                response = await fetchResponse.json();

                // Скидаємо лічильник помилок для даного ендпоінту
                if (_connectionState.failedAttempts > 0) {
                    _connectionState.failedAttempts = 0;
                    _connectionState.lastSuccessTime = Date.now();
                    _connectionState.isConnected = true;
                    _apiState.isHealthy = true;
                    _apiState.consecutiveFailures = 0;

                    // Приховуємо banner про недоступність
                    hideServerUnavailableMessage();
                }

            } catch (error) {
                // Інкрементуємо лічільник помилок
                _requestCounter.errors++;

                // Приховуємо індикатор завантаження
                if (!options.hideLoader && typeof window.hideLoading === 'function') {
                    window.hideLoading();
                }

                // Зберігаємо помилку для повторної спроби або повернення
                lastError = error;

                // Якщо це остання спроба, перекидаємо помилку далі
                if (retries <= 0) {
                    throw error;
                }

                // Для помилок, пов'язаних з мережею, спробуємо ще раз
                const isNetworkError = error.name === 'AbortError' ||
                                       error.name === 'TypeError' ||
                                       (error.message && safeIncludes(error.message, 'NetworkError'));

                if (isNetworkError) {
                    // Збільшуємо лічільник невдалих спроб
                    _connectionState.failedAttempts++;

                    // ВИПРАВЛЕНО: Експоненційне збільшення часу очікування для продакшн
                    const baseDelay = API_BASE_URL.includes('localhost') ? 1000 : 2000; // 2 секунди для продакшн
                    const backoffTime = Math.min(baseDelay * Math.pow(2, _connectionState.failedAttempts), 15000); // максимум 15 секунд

                    console.warn(`⚠️ Мережева помилка, повторна спроба через ${backoffTime/1000}с...`);

                    // Чекаємо перед повторною спробою
                    await new Promise(resolve => setTimeout(resolve, backoffTime));

                    // Рекурсивно викликаємо apiRequest з меншою кількістю спроб
                    return apiRequest(endpoint, method, data, options, retries - 1);
                }

                // Якщо це не мережева помилка, просто перекидаємо її далі
                throw error;
            } finally {
                // Видаляємо ендпоінт зі списку активних
                _activeEndpoints.delete(endpoint);

                // Зменшуємо лічільник поточних запитів
                _requestCounter.current = Math.max(0, _requestCounter.current - 1);
            }

            // Якщо запит успішний, повертаємо відповідь
            return response;
        } catch (error) {
            // Збільшуємо лічільник помилок
            _requestCounter.errors++;

            // Приховуємо індикатор завантаження
            if (!options.hideLoader && typeof window.hideLoading === 'function') {
                window.hideLoading();
            }

            console.error(`❌ API: Помилка запиту ${endpoint}:`, error.message);

            // Відправляємо подію про помилку
            document.dispatchEvent(new CustomEvent('api-error', {
                detail: {
                    error,
                    endpoint,
                    method
                }
            }));

            // Повертаємо об'єкт з помилкою, якщо вказано suppressErrors
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

    // ВИПРАВЛЕНО: Автоматичне скидання старих запитів з збільшеними інтервалами для продакшн
    setInterval(() => {
        const now = Date.now();
        const maxRequestAge = API_BASE_URL.includes('localhost') ? 30000 : 60000; // 1 хвилина для продакшн

        // Якщо є запити, які виконуються дуже довго, скидаємо їх
        let hasLongRunningRequests = false;
        for (const [key, time] of Object.entries(_lastRequestsByEndpoint)) {
            if (now - time > maxRequestAge) {
                hasLongRunningRequests = true;
                delete _lastRequestsByEndpoint[key];
                console.warn(`🔌 API: Скинуто старий запит: ${key}`);
            }
        }

        if (hasLongRunningRequests) {
            resetPendingRequests();
        }

        // ВИПРАВЛЕНО: Скидаємо лічильники запитів кожні 15 хвилин для продакшн
        const resetInterval = API_BASE_URL.includes('localhost') ? 600000 : 900000; // 15 хвилин для продакшн
        if (now - _requestCounter.lastReset > resetInterval) {
            _requestCounter.total = 0;
            _requestCounter.errors = 0;
            _requestCounter.lastReset = now;
        }
    }, 60000);

    // ======== ФУНКЦІЇ КОРИСТУВАЧА ========

    /**
     * Отримання даних користувача
     * @param {boolean} forceRefresh - Примусове оновлення, ігноруючи кеш
     * @returns {Promise<Object>} Дані користувача
     */
    async function getUserData(forceRefresh = false) {
        // Перевіряємо готовність API
        try {
            await ensureApiReady();
        } catch (error) {
            console.error("🔌 API: Сервер недоступний для отримання даних користувача:", error);
            throw error;
        }

        // Використовуємо кеш, якщо можливо
        if (!forceRefresh && _userCache && (Date.now() - _userCacheTime < USER_CACHE_TTL)) {
            return {status: 'success', data: _userCache, source: 'cache'};
        }

        const id = getUserId();
        if (!id) {
            throw new Error("ID користувача не знайдено");
        }

        try {
            const result = await apiRequest(API_PATHS.USER.DATA(id), 'GET', null, {
                timeout: API_BASE_URL.includes('localhost') ? 15000 : 25000, // 25 секунд для продакшн
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
            // Додаємо параметр для запобігання кешуванню
            const nocache = Date.now();
            const endpoint = API_PATHS.USER.BALANCE(userId) + `?nocache=${nocache}`;

            // Робимо запит до сервера
            const response = await apiRequest(endpoint, 'GET', null, {
                suppressErrors: false,
                timeout: API_BASE_URL.includes('localhost') ? 10000 : 20000 // 20 секунд для продакшн
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

        // Перевіряємо готовність API
        try {
            await ensureApiReady();
        } catch (error) {
            console.error("🔌 API: Сервер недоступний для стейкінгу:", error);
            throw error;
        }

        // Використовуємо кеш, якщо можливо
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
     * @param {number} amount - Сума стейкінгу
     * @param {number} period - Період стейкінгу в днях
     */
    async function createStaking(amount, period) {
        const userId = getUserId();
        if (!userId) {
            throw new Error("ID користувача не знайдено");
        }

        await ensureApiReady();

        // Перевіряємо коректність параметрів
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
     * @param {number} amount - Сума для додавання
     * @param {string} stakingId - ID стейкінгу (опціонально)
     */
    async function addToStaking(amount, stakingId = null) {
        const userId = getUserId();
        if (!userId) {
            throw new Error("ID користувача не знайдено");
        }

        await ensureApiReady();

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

        return apiRequest(`${API_PATHS.STAKING.DATA(userId)}/${targetStakingId}`, 'PUT', {
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

        await ensureApiReady();

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

        return apiRequest(API_PATHS.STAKING.CANCEL(userId, targetStakingId), 'POST', {
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

        await ensureApiReady();

        // Виконуємо запит до серверу
        try {
            return await apiRequest(`${API_PATHS.TRANSACTIONS(userId)}?limit=${limit}`, 'GET', null, {
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

        await ensureApiReady();

        try {
            return await apiRequest(API_PATHS.USER.SETTINGS(userId), 'POST', settings);
        } catch (error) {
            console.error("🔌 API: Помилка оновлення налаштувань:", error);
            throw error;
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
     * ВИПРАВЛЕНО: Відновлення з'єднання з сервером з покращеною логікою для продакшн
     */
    async function reconnect() {
        console.log("🔄 API: Спроба відновлення з'єднання...");

        // Очищаємо стан запитів
        forceCleanupRequests();

        // Скидаємо стан здоров'я
        _apiState.isHealthy = false;
        _apiState.consecutiveFailures = 0;

        // Перевіряємо здоров'я API
        const isHealthy = await checkApiHealth();

        if (isHealthy) {
            // Спроба оновити токен якщо потрібно
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

                // Показуємо повідомлення про відновлення
                if (typeof window.showToast === 'function') {
                    window.showToast('З\'єднання з сервером відновлено!', 'success');
                }

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

    // Запускаємо health check при завантаженні
    startHealthCheck();

    // НОВОЕ: Тест CORS при ініціалізації
    async function testCorsOnInit() {
        try {
            console.log("🧪 API: Тестуємо CORS при ініціалізації...");
            const response = await apiRequest(API_PATHS.CORS_TEST, 'GET', null, {
                skipHealthCheck: true,
                hideLoader: true,
                suppressErrors: true,
                timeout: 10000
            });

            if (response && response.status === 'ok') {
                console.log("✅ API: CORS тест пройдено успішно");
            } else {
                console.warn("⚠️ API: CORS тест показав проблеми:", response);
            }
        } catch (error) {
            console.warn("⚠️ API: CORS тест провалений:", error.message);
        }
    }

    // НОВОЕ: Функція для діагностики підключення
    async function diagnoseProdConnection() {
        console.log("🔍 === ДІАГНОСТИКА ПІДКЛЮЧЕННЯ ДО ПРОДАКШН СЕРВЕРА ===");
        const results = {
            baseUrl: API_BASE_URL,
            tests: []
        };

        // Тест 1: Простий ping
        try {
            const pingStart = Date.now();
            const pingResponse = await fetch(`${API_BASE_URL}/ping`, {
                method: 'GET',
                cache: 'no-cache',
                signal: AbortSignal.timeout(10000)
            });
            const pingTime = Date.now() - pingStart;

            results.tests.push({
                name: 'Simple Ping',
                success: pingResponse.ok,
                time: pingTime,
                status: pingResponse.status,
                details: pingResponse.ok ? 'OK' : `HTTP ${pingResponse.status}`
            });
        } catch (error) {
            results.tests.push({
                name: 'Simple Ping',
                success: false,
                error: error.message,
                details: 'Ping failed'
            });
        }

        // Тест 2: API Health
        try {
            const healthStart = Date.now();
            const healthResponse = await fetch(`${API_BASE_URL}/api/health`, {
                method: 'GET',
                headers: { 'Accept': 'application/json' },
                cache: 'no-cache',
                signal: AbortSignal.timeout(15000)
            });
            const healthTime = Date.now() - healthStart;

            results.tests.push({
                name: 'API Health',
                success: healthResponse.ok,
                time: healthTime,
                status: healthResponse.status,
                details: healthResponse.ok ? 'OK' : `HTTP ${healthResponse.status}`
            });

            if (healthResponse.ok) {
                try {
                    const healthData = await healthResponse.json();
                    results.healthData = healthData;
                } catch (e) {
                    results.tests[results.tests.length - 1].details += ' (JSON parse error)';
                }
            }
        } catch (error) {
            results.tests.push({
                name: 'API Health',
                success: false,
                error: error.message,
                details: 'Health check failed'
            });
        }

        // Тест 3: CORS
        try {
            const corsStart = Date.now();
            const corsResponse = await fetch(`${API_BASE_URL}/api/cors-test`, {
                method: 'GET',
                headers: {
                    'Accept': 'application/json',
                    'Origin': window.location.origin
                },
                cache: 'no-cache',
                signal: AbortSignal.timeout(10000)
            });
            const corsTime = Date.now() - corsStart;

            results.tests.push({
                name: 'CORS Test',
                success: corsResponse.ok,
                time: corsTime,
                status: corsResponse.status,
                details: corsResponse.ok ? 'OK' : `HTTP ${corsResponse.status}`
            });
        } catch (error) {
            results.tests.push({
                name: 'CORS Test',
                success: false,
                error: error.message,
                details: 'CORS test failed'
            });
        }

        console.log("🔍 Результати діагностики:", results);

        // Показуємо результат користувачу
        const successfulTests = results.tests.filter(t => t.success).length;
        const totalTests = results.tests.length;

        console.log(`📊 Успішно: ${successfulTests}/${totalTests} тестів`);

        if (successfulTests === 0) {
            console.error("💥 Сервер повністю недоступний!");
            if (typeof window.showToast === 'function') {
                window.showToast('Сервер недоступний. Перевірте інтернет-з\'єднання.', 'error');
            }
        } else if (successfulTests < totalTests) {
            console.warn("⚠️ Частина тестів провалена");
            if (typeof window.showToast === 'function') {
                window.showToast('Деякі функції можуть працювати нестабільно', 'warning');
            }
        } else {
            console.log("✅ Всі тести пройдено успішно");
        }

        return results;
    }

    // Запускаємо повну діагностику через 3 секунди після ініціалізації (для продакшн)
    setTimeout(() => {
        if (!API_BASE_URL.includes('localhost')) {
            diagnoseProdConnection();
        } else {
            testCorsOnInit();
        }
    }, 3000);

    // ======== ЕКСПОРТ API ========

    // Експортуємо API шляхи для використання в інших модулях
    window.API_PATHS = API_PATHS;

    // Створюємо публічний API
    window.WinixAPI = {
        // Конфігурація
        config: {
            baseUrl: API_BASE_URL,
            version: '1.4.0',
            environment: API_BASE_URL.includes('localhost') ? 'development' : 'production',
            debugMode: _debugMode
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

        // Функції для діагностики та відлагодження
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
            },
            testCors: testCorsOnInit,
            diagnoseProdConnection: diagnoseProdConnection // НОВОЕ: Додаємо діагностику
        }
    };

    // Для зворотної сумісності
    window.apiRequest = apiRequest;
    window.getUserId = getUserId;

    // Для зворотної сумісності з модулями, що очікують window.API
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
        console.log("🔄 API: З'єднання з мережею відновлено, спроба підключення");
        reconnect();
    });

    // НОВОЕ: Обробник для відновлення фокусу вкладки
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden && !_apiState.isHealthy) {
            console.log("🔄 API: Вкладка отримала фокус, перевіряємо з'єднання");
            checkApiHealth();
        }
    });

    // НОВОЕ: Глобальна діагностична функція для консолі
    window.WinixDiagnose = diagnoseProdConnection;

    console.log(`✅ API: Модуль успішно ініціалізовано для ПРОДАКШН (URL: ${API_BASE_URL})`);
    console.log(`🔧 API: Режим відлагодження: ${_debugMode ? 'увімкнено' : 'вимкнено'}`);
    console.log(`🩺 API: Запустіть WinixDiagnose() в консолі для діагностики підключення`);
})();