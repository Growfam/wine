/**
 * tasks-api.js - Єдиний модуль для всіх API-запитів WINIX
 * Виправлена версія з health check та кращою обробкою помилок
 * @version 1.3.0
 */

(function() {
    'use strict';
    let endpoint = ""; // Оголошення глобальної змінної
    console.log("🔌 API: Ініціалізація єдиного API модуля з health check");

    // ======== API-ШЛЯХИ ========

    // Константи API-шляхів для централізованого управління
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
    let _debugMode = false; // Вимкнено для продакшену

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

    // Мінімальний інтервал між однаковими запитами
    const REQUEST_THROTTLE = {
        '/user/': 8000,
        '/staking': 10000,
        '/balance': 6000,
        '/transactions': 15000,
        '/participate-raffle': 5000,
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

    // ======== HEALTH CHECK ФУНКЦІЇ ========

    /**
     * Перевірка здоров'я API
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
            const timeoutId = setTimeout(() => controller.abort(), 5000); // 5 секунд таймаут

            const response = await fetch(`${API_BASE_URL}/api/${API_PATHS.HEALTH}`, {
                method: 'GET',
                signal: controller.signal,
                headers: {
                    'Accept': 'application/json'
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
                return true;
            } else {
                throw new Error(`Health check failed: ${response.status}`);
            }

        } catch (error) {
            console.error("❌ API: Health check провалений:", error.message);

            _apiState.isHealthy = false;
            _apiState.consecutiveFailures++;
            _connectionState.isConnected = false;

            // Показуємо повідомлення користувачу
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
            banner.remove();
            console.log("✅ API: Повідомлення про недоступність приховано");
        }
    }

    /**
     * Запуск періодичної перевірки здоров'я
     */
    function startHealthCheck() {
        console.log("🏥 API: Запуск періодичної перевірки здоров'я");

        // Очищаємо попередній інтервал
        if (_apiState.healthCheckInterval) {
            clearInterval(_apiState.healthCheckInterval);
        }

        // Початкова перевірка
        checkApiHealth();

        // Періодична перевірка кожні 30 секунд
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
        // Якщо health check застарілий (більше 1 хвилини)
        const healthCheckAge = Date.now() - _apiState.lastHealthCheck;
        if (healthCheckAge > 60000 || !_apiState.isHealthy) {
            console.log("🔍 API: Перевіряємо готовність API...");
            const isHealthy = await checkApiHealth();

            if (!isHealthy) {
                throw new Error("Сервер недоступний. Спробуйте пізніше.");
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
     * Оновлення токену авторизації
     * @returns {Promise<string|null>} Новий токен або null
     */
    async function refreshToken() {
        // Перевіряємо готовність API
        try {
            await ensureApiReady();
        } catch (error) {
            console.error("🔌 API: Сервер недоступний для оновлення токену:", error);
            throw error;
        }

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
                    // Спеціальна обробка 400/401 помилок при оновленні токену
                    if (response.status === 400 || response.status === 401) {
                        console.warn("⚠️ API: Токен недійсний, очищаємо");
                        clearAuthToken();
                        throw new Error("Токен недійсний. Потрібна повторна авторизація");
                    }
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

                    // Зберігаємо в localStorage і використовуємо StorageUtils, якщо доступний
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
                if (safeIncludes(url, 'participate-raffle') && data) {
                    // Переконатися, що raffle_id - валідний рядок
                    if (data.raffle_id) {
                        // Перевірка формату UUID та конвертація
                        if (typeof data.raffle_id !== 'string') {
                            data.raffle_id = String(data.raffle_id);
                            console.log("🛠️ API: raffle_id конвертовано в рядок:", data.raffle_id);
                        }

                        // Перевірка формату UUID
                        if (!isValidUUID(data.raffle_id)) {
                            console.error(`❌ API: Невалідний UUID для розіграшу: ${data.raffle_id}`);
                            throw new Error(`Невалідний ідентифікатор розіграшу: ${data.raffle_id}`);
                        }
                    } else {
                        console.error("❌ API: Відсутній raffle_id в запиті участі в розіграші");
                        throw new Error("Відсутній ідентифікатор розіграшу");
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

            // Спеціальна обробка для 404 помилок в розіграшах
            if (response.status === 404 && safeIncludes(url, 'raffles')) {
                // Очищуємо кеш розіграшів, якщо такий є
                if (window.WinixRaffles && window.WinixRaffles.participation) {
                    window.WinixRaffles.participation.clearInvalidRaffleIds();
                }

                // Показуємо користувачу більш інформативне повідомлення
                if (typeof window.showToast === 'function') {
                    window.showToast('Розіграш не знайдено або вже завершено. Оновіть список розіграшів.', 'warning');
                }

                throw new Error("Розіграш не знайдено. ID може бути застарілим.");
            }

            // Обробка помилок 429 (too many requests)
            if (response.status === 429) {
                // Отримуємо рекомендований час очікування з заголовка або використовуємо стандартний
                const retryAfter = response.headers.get('Retry-After') || 30; // 30 секунд за замовчуванням

                // Визначаємо ендпоінт для блокування
                const endpointForBlocking = Object.keys(REQUEST_THROTTLE).find(key => safeIncludes(url, key)) || 'default';

                // Викликаємо функцію обробки rate limit
                handleRateLimiting(endpointForBlocking, parseInt(retryAfter));

                throw new Error(`Занадто багато запитів. Спробуйте через ${retryAfter} секунд.`);
            }

            // Обробка 500+ помилок
            if (response.status >= 500) {
                _connectionState.isConnected = false;
                _apiState.isHealthy = false;
                _apiState.consecutiveFailures++;

                throw new Error(`Сервер тимчасово недоступний (${response.status}). Спробуйте пізніше.`);
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
        if (!options.skipHealthCheck) {
            try {
                await ensureApiReady();
            } catch (error) {
                console.error("🔌 API: Сервер недоступний:", error);

                // Для критичних запитів показуємо помилку
                if (!options.suppressErrors) {
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
            // Визначаємо час очікування до розблокування
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

        // Перевірка невалідних ID розіграшів у URL
        if (safeIncludes(endpoint, 'raffles/') && !endpoint.endsWith('raffles') && !endpoint.endsWith('raffles/')) {
            const raffleIdMatch = endpoint.match(/raffles\/([^/?]+)/i);
            if (raffleIdMatch && raffleIdMatch[1]) {
                const raffleId = raffleIdMatch[1];
                if (!isValidUUID(raffleId)) {
                    console.error(`❌ API: Невалідний UUID в URL: ${raffleId}`);
                    return Promise.reject({
                        status: 'error',
                        message: 'Невалідний ідентифікатор розіграшу в URL',
                        code: 'invalid_raffle_id'
                    });
                }
            }
        }

        // Перевірка даних для участі в розіграші чи запиту деталей розіграшу
        if ((safeIncludes(endpoint, 'participate-raffle') || safeIncludes(endpoint, 'raffles/')) && data && data.raffle_id) {
            // Перевіряємо формат UUID
            if (typeof data.raffle_id !== 'string') {
                data.raffle_id = String(data.raffle_id);
                console.log("🛠️ API: raffle_id конвертовано в рядок:", data.raffle_id);
            }

            // Ретельна перевірка формату UUID
            if (!isValidUUID(data.raffle_id)) {
                console.error(`❌ API: Невалідний UUID: ${data.raffle_id}`);
                return Promise.reject({
                    status: 'error',
                    message: 'Невалідний ідентифікатор розіграшу'
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
            // ВИПРАВЛЕНО: Нормалізуємо endpoint для правильного формату і запобігаємо подвійним слешам
            const normalizedEndpoint = normalizeEndpoint(endpoint);

            // Забезпечуємо, що до URL не додаються неправильні параметри
            const hasQuery = safeIncludes(normalizedEndpoint, '?');

            // ВИПРАВЛЕНО: Додаємо кешобрейкер до URL (параметр t=timestamp)
            const timestamp = Date.now();

            // ВИПРАВЛЕНО: Формуємо повний URL з коректним шляхом і уникаємо подвійних слешів
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

        // Параметри запиту
        const requestOptions = {
            method: method,
            headers: headers,
            // ВИПРАВЛЕНО: Збільшуємо таймаут запитів, щоб уникнути помилок
            timeout: options.timeout || 20000 // 20 секунд
        };

        // Додаємо тіло запиту для POST/PUT/PATCH
        if (data && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
            // Перевірка та коригування raffle_id для запитів участі в розіграші
            if (safeIncludes(url, 'participate-raffle') && data) {
                // Переконатися, що raffle_id - валідний рядок
                if (data.raffle_id) {
                    // Перевірка формату UUID та конвертація
                    if (typeof data.raffle_id !== 'string') {
                        data.raffle_id = String(data.raffle_id);
                        console.log("🛠️ API: raffle_id конвертовано в рядок:", data.raffle_id);
                    }

                    // Перевірка формату UUID
                    if (!isValidUUID(data.raffle_id)) {
                        console.error(`❌ API: Невалідний UUID для розіграшу: ${data.raffle_id}`);
                        throw new Error(`Невалідний ідентифікатор розіграшу: ${data.raffle_id}`);
                    }
                } else {
                    console.error("❌ API: Відсутній raffle_id в запиті участі в розіграші");
                    throw new Error("Відсутній ідентифікатор розіграшу");
                }
            }
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

            // Виконуємо запит з контролем таймаута
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), requestOptions.timeout);

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
            if (fetchResponse.status === 401) {
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
                // Спеціальна обробка для щоденних бонусів
                if (safeIncludes(url, 'daily-bonus')) {
                    console.warn(`⚠️ API: Ендпоінт щоденного бонусу недоступний: ${url}`);

                    // Повертаємо помилку без fallback даних
                    return Promise.reject({
                        status: "error",
                        message: "Щоденні бонуси тимчасово недоступні",
                        httpStatus: 404,
                        endpoint: endpoint
                    });
                }

                // Спеціальна обробка для API ping
                if (safeIncludes(url, '/api/ping')) {
                    console.warn(`⚠️ API: Ping ендпоінт недоступний: ${url}`);
                    return {
                        status: "error",
                        message: "API ping недоступний",
                        source: "ping_404"
                    };
                }

                // Спеціальна обробка для розіграшів
                if (safeIncludes(url, 'raffles')) {
                    // Очищуємо кеш розіграшів, якщо такий є
                    if (window.WinixRaffles && window.WinixRaffles.participation) {
                        window.WinixRaffles.participation.clearInvalidRaffleIds();
                    }

                    // Витягуємо ідентифікатор розіграшу з URL
                    const raffleIdMatch = url.match(/raffles\/([^/?]+)/i);
                    if (raffleIdMatch && raffleIdMatch[1]) {
                        const raffleId = raffleIdMatch[1];

                        // Додаємо до списку невалідних
                        if (window.WinixRaffles && window.WinixRaffles.participation) {
                            window.WinixRaffles.participation.addInvalidRaffleId(raffleId);
                        }
                    }

                    // Показуємо користувачу більш інформативне повідомлення
                    if (typeof window.showToast === 'function') {
                        window.showToast('Розіграш не знайдено або вже завершено. Оновіть список розіграшів.', 'warning');
                    }

                    return Promise.reject({
                        status: 'error',
                        message: "Розіграш не знайдено. ID може бути застарілим.",
                        code: 'raffle_not_found',
                        httpStatus: 404
                    });
                }

                // Загальна обробка 404 помилок
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
                let errorData = {};

                try {
                    const errorJson = JSON.parse(errorResponse);
                    errorMessage = errorJson.message || `Помилка серверу: ${fetchResponse.status}`;
                    errorData = errorJson;
                } catch (e) {
                    errorMessage = `Помилка серверу: ${fetchResponse.status}`;
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
                // Збільшуємо лічильник невдалих спроб
                _connectionState.failedAttempts++;

                // Експоненційне збільшення часу очікування між спробами
                const backoffTime = Math.min(1000 * Math.pow(2, _connectionState.failedAttempts), 10000);

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

        // Скидаємо лічильники запитів кожні 10 хвилин
        if (now - _requestCounter.lastReset > 600000) {
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
                timeout: 15000,
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
                timeout: 10000
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
     * Відновлення з'єднання з сервером
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

    // ======== ЕКСПОРТ API ========

    // Експортуємо API шляхи для використання в інших модулях
    window.API_PATHS = API_PATHS;

    // Створюємо публічний API
    window.WinixAPI = {
        // Конфігурація
        config: {
            baseUrl: API_BASE_URL,
            version: '1.3.0',
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
            }
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

    console.log(`✅ API: Модуль успішно ініціалізовано з health check (URL: ${API_BASE_URL})`);
})();