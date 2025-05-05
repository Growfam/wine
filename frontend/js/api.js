/**
 * api.js - Єдиний модуль для всіх API-запитів WINIX
 * Оптимізована версія з простішою обробкою помилок
 * @version 2.1.0
 */

(function() {
    'use strict';
    console.log("🔌 API: Ініціалізація API модуля");

    // ======== API-ШЛЯХИ ========

    // Константи API-шляхів для централізованого управління
    const API_PATHS = {
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
        TRANSACTIONS: (userId) => `user/${userId}/transactions`,

        // Лідерборд
        LEADERBOARD: {
            REFERRALS: 'leaderboard/referrals',
            TASKS: 'leaderboard/tasks',
            POSITION: (userId) => `user/${userId}/leaderboard-position`
        }
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

    // Режим відлагодження
    let _debugMode = false;

    // Кешовані дані користувача
    let _userCache = null;
    let _userCacheTime = 0;
    const USER_CACHE_TTL = 300000; // 5 хвилин

    // Лічильник запитів
    let _requestCounter = {
        total: 0,
        errors: 0,
        current: 0,
        lastReset: Date.now()
    };

    // Токен автентифікації
    let _authToken = null;
    let _authTokenExpiry = 0;

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

            // 2. Спробуємо отримати токен з localStorage
            let token = localStorage.getItem('auth_token');
            let tokenExpiry = parseInt(localStorage.getItem('auth_token_expiry') || '0');

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

            // 3. Альтернативні джерела токену
            if (window.WinixConfig && window.WinixConfig.authToken) {
                _authToken = window.WinixConfig.authToken;
                return _authToken;
            }

            return null;
        } catch (e) {
            console.error("🔌 API: Критична помилка отримання токену:", e);
            return null;
        }
    }

    /**
     * Перевірка, чи рядок містить певний підрядок
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
        // Захист від undefined
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
     * Оновлення токену авторизації
     * @returns {Promise<string|null>} Новий токен або null
     */
    async function refreshToken() {
        try {
            // Отримуємо ID користувача
            const userId = getUserId();
            if (!userId) {
                throw new Error('ID користувача не знайдено');
            }

            console.log("🔄 API: Початок оновлення токену");

            // Виконуємо запит на оновлення токену
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
                    console.warn("🔌 API: Помилка збереження токену:", e);
                }

                console.log("✅ API: Токен успішно оновлено");

                // Відправляємо подію про оновлення токену
                document.dispatchEvent(new CustomEvent('token-refreshed', {
                    detail: { token: _authToken, expires_at: _authTokenExpiry }
                }));

                return _authToken;
            } else {
                throw new Error(data.message || "Помилка оновлення токену");
            }
        } catch (error) {
            console.error("❌ API: Помилка оновлення токену:", error);
            throw error;
        }
    }

    // ======== ФУНКЦІЇ API-ЗАПИТУ ========

    /**
     * Універсальна функція для виконання API-запитів
     * @param {string} endpoint - URL ендпоінту
     * @param {string} method - HTTP метод (GET, POST, PUT, DELETE)
     * @param {Object} data - Дані для відправки
     * @param {Object} options - Додаткові параметри
     * @returns {Promise<Object>} Результат запиту
     */
    async function apiRequest(endpoint, method = 'GET', data = null, options = {}) {
        try {
            // Захист від undefined endpoint
            if (!endpoint) {
                console.error("🔌 API: endpoint є undefined або null");
                return Promise.reject({
                    status: 'error',
                    message: 'Не вказано endpoint для запиту',
                    code: 'missing_endpoint'
                });
            }

            // Логування при відлагодженні
            if (_debugMode) {
                console.log(`🔌 API: Початок запиту ${method} до ${endpoint}`);
            }

            // Перевірка доступності мережі
            if (typeof navigator.onLine !== 'undefined' && !navigator.onLine) {
                return Promise.reject({
                    message: "Пристрій офлайн",
                    source: 'offline'
                });
            }

            // Формуємо URL запиту
            let url;

            // Переконуємося, що URL формується коректно
            if (safeIncludes(endpoint, 'http')) {
                // Endpoint вже є повним URL - використовуємо як є
                url = endpoint;
            } else {
                // Нормалізуємо endpoint для правильного формату
                const normalizedEndpoint = normalizeEndpoint(endpoint);

                // Забезпечуємо, що до URL не додаються неправильні параметри
                const hasQuery = safeIncludes(normalizedEndpoint, '?');

                // Формуємо повний URL з коректним шляхом
                url = `${API_BASE_URL}/${normalizedEndpoint}`
                    .replace(/([^:]\/)\/+/g, "$1"); // Видаляємо зайві послідовні слеші

                // Додаємо кешобрейкер до URL (параметр t=timestamp) тільки для GET запитів
                if (method === 'GET') {
                    url += (hasQuery ? '&' : '?') + `t=${Date.now()}`;
                }
            }

            // Заголовки запиту
            const headers = {
                'Content-Type': 'application/json',
                'Accept': 'application/json',
                ...(options.headers || {})
            };

            // Додаємо токен авторизації, якщо він є
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
                timeout: options.timeout || 20000 // 20 секунд
            };

            // Додаємо тіло запиту для POST/PUT/PATCH
            if (data && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
                requestOptions.body = JSON.stringify(data);
            }

            // Виконуємо запит з контролем таймаута
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), requestOptions.timeout);

            // Налаштовуємо сигнал
            requestOptions.signal = controller.signal;

            // Інкрементуємо лічильник запитів
            _requestCounter.total++;
            _requestCounter.current++;

            // Відображаємо індикатор завантаження
            if (!options.hideLoader && typeof window.showLoading === 'function') {
                window.showLoading();
            }

            // Виконуємо запит
            const response = await fetch(url, requestOptions);

            // Очищаємо таймаут
            clearTimeout(timeoutId);

            // Приховуємо індикатор завантаження
            if (!options.hideLoader && typeof window.hideLoading === 'function') {
                window.hideLoading();
            }

            // Зменшуємо лічильник поточних запитів
            _requestCounter.current = Math.max(0, _requestCounter.current - 1);

            // Спеціальна обробка для 401 (Unauthorized)
            if (response.status === 401) {
                console.warn("🔌 API: Помилка авторизації. Спроба оновлення токену...");

                try {
                    await refreshToken();

                    // Повторюємо запит з оновленим токеном
                    return apiRequest(endpoint, method, data, options);
                } catch (tokenError) {
                    console.error("🔌 API: Не вдалося оновити токен:", tokenError);

                    // Повертаємо оригінальну помилку
                    return Promise.reject({
                        status: 'error',
                        message: "Помилка авторизації. Спробуйте оновити сторінку.",
                        statusCode: 401
                    });
                }
            }

            // Перевіряємо HTTP статус
            if (!response.ok) {
                // Спробуємо отримати детальну інформацію про помилку
                let errorData = {};
                let errorMessage = `Помилка: ${response.status} ${response.statusText}`;

                try {
                    errorData = await response.json();
                    errorMessage = errorData.message || errorMessage;
                } catch (e) {
                    // Ігноруємо помилки парсингу JSON
                }

                // Повертаємо об'єкт з помилкою
                return Promise.reject({
                    status: 'error',
                    message: errorMessage,
                    statusCode: response.status,
                    data: errorData
                });
            }

            // Парсимо відповідь
            const responseData = await response.json();
            return responseData;

        } catch (error) {
            // Приховуємо індикатор завантаження
            if (!options.hideLoader && typeof window.hideLoading === 'function') {
                window.hideLoading();
            }

            // Збільшуємо лічильник помилок
            _requestCounter.errors++;

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

    // ======== ФУНКЦІЇ КОРИСТУВАЧА ========

    /**
     * Отримання даних користувача
     * @param {boolean} forceRefresh - Примусове оновлення, ігноруючи кеш
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
            throw new Error("ID користувача не знайдено");
        }

        try {
            const result = await apiRequest(API_PATHS.USER.DATA(id), 'GET', null, {
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
            // Додаємо параметр для запобігання кешуванню
            const endpoint = API_PATHS.USER.BALANCE(userId);

            // Робимо запит до сервера
            const response = await apiRequest(endpoint, 'GET', null, {
                suppressErrors: true,
                timeout: 5000
            });

            // Перевіряємо успішність відповіді
            if (response.status === 'success' && response.data) {
                // Зберігаємо баланс в localStorage
                try {
                    localStorage.setItem('userTokens', response.data.balance.toString());
                    localStorage.setItem('userCoins', response.data.coins.toString());
                    localStorage.setItem('winix_balance', response.data.balance.toString());
                    localStorage.setItem('winix_coins', response.data.coins.toString());
                    localStorage.setItem('winix_balance_update_time', Date.now().toString());
                } catch (e) {
                    console.warn("🔌 API: Помилка збереження балансу в localStorage:", e);
                }

                // Генеруємо подію оновлення балансу
                document.dispatchEvent(new CustomEvent('balance-updated', {
                    detail: {
                        newBalance: response.data.coins,
                        oldBalance: parseInt(localStorage.getItem('userCoins') || '0'),
                        source: 'api.js',
                        timestamp: Date.now()
                    }
                }));

                return response;
            }

            // Якщо відповідь з помилкою, повертаємо локальний баланс
            return {
                status: 'success',
                data: {
                    balance: parseFloat(localStorage.getItem('userTokens') || '0'),
                    coins: parseInt(localStorage.getItem('userCoins') || '0')
                },
                source: 'local_storage_fallback_after_error'
            };
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

    /**
     * Отримання лідерборду рефералів
     * @param {number} limit - Ліміт записів
     * @param {number} offset - Зміщення
     * @returns {Promise<Object>} Результат запиту
     */
    async function getLeaderboard(type = 'referrals', limit = 10, offset = 0) {
        try {
            const validTypes = ['referrals', 'tasks'];
            if (!validTypes.includes(type)) {
                type = 'referrals';
            }

            // Формуємо URL з параметрами
            const endpoint = `${API_PATHS.LEADERBOARD[type.toUpperCase()]}?limit=${limit}&offset=${offset}`;

            // Виконуємо запит
            const response = await apiRequest(endpoint, 'GET', null, {
                suppressErrors: true,
                timeout: 8000
            });

            return response;
        } catch (error) {
            console.error(`🔌 API: Помилка отримання лідерборду ${type}:`, error);

            // Повертаємо об'єкт з помилкою
            return {
                status: 'error',
                message: error.message || `Не вдалося отримати лідерборд ${type}`,
                data: { leaderboard: [] }
            };
        }
    }

    /**
     * Отримання позиції користувача в лідерборді
     * @param {string} type - Тип лідерборду
     * @returns {Promise<Object>} Результат запиту
     */
    async function getUserLeaderboardPosition(type = 'referrals') {
        try {
            const userId = getUserId();
            if (!userId) {
                throw new Error("ID користувача не знайдено");
            }

            // Формуємо URL з параметрами
            const endpoint = `${API_PATHS.LEADERBOARD.POSITION(userId)}?type=${type}`;

            // Виконуємо запит
            const response = await apiRequest(endpoint, 'GET', null, {
                suppressErrors: true,
                timeout: 5000
            });

            return response;
        } catch (error) {
            console.error(`🔌 API: Помилка отримання позиції в лідерборді ${type}:`, error);

            // Повертаємо об'єкт з помилкою
            return {
                status: 'error',
                message: error.message || `Не вдалося отримати позицію в лідерборді ${type}`,
                data: { position: null }
            };
        }
    }

    // ======== ФУНКЦІЇ ДЛЯ ОБРОБКИ ПОМИЛОК ========

    /**
     * Показати помилку користувачу
     * @param {string|Object} message - Повідомлення або об'єкт помилки
     * @param {string} type - Тип повідомлення (error, warning, info)
     */
    function showError(message, type = 'error') {
        // Отримуємо текст повідомлення
        let errorMessage = typeof message === 'string' ? message :
                          (message.message || 'Сталася невідома помилка');

        // Показуємо повідомлення користувачу
        if (typeof window.showToast === 'function') {
            window.showToast(errorMessage, type);
        } else if (type === 'error') {
            alert(errorMessage);
        } else {
            console.log(`${type.toUpperCase()}: ${errorMessage}`);
        }
    }

    /**
     * Форматування помилки для відображення
     * @param {Error|Object} error - Об'єкт помилки
     * @returns {string} Форматоване повідомлення
     */
    function formatErrorMessage(error) {
        if (!error) return 'Сталася невідома помилка';

        // Якщо це мережева помилка
        if (error.name === 'TypeError' || error.message?.includes('Network') || error.message?.includes('fetch')) {
            return 'Помилка з\'єднання з сервером. Перевірте інтернет-підключення.';
        }

        // Якщо це таймаут
        if (error.name === 'AbortError' || error.message?.includes('timeout')) {
            return 'Сервер не відповідає. Спробуйте пізніше.';
        }

        // Якщо це помилка авторизації
        if (error.statusCode === 401 || error.message?.includes('авторизац')) {
            return 'Помилка авторизації. Спробуйте оновити сторінку.';
        }

        // За замовчуванням повертаємо оригінальне повідомлення
        return error.message || 'Сталася помилка при виконанні запиту';
    }

    // ======== ЕКСПОРТ API ========

    // Експортуємо API шляхи для використання в інших модулях
    window.API_PATHS = API_PATHS;

    // Створюємо публічний API
    window.WinixAPI = {
        // Конфігурація
        config: {
            baseUrl: API_BASE_URL,
            version: '2.1.0',
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
        showError,
        formatErrorMessage,

        // Функції користувача
        getUserData,
        getBalance,

        // Функції лідерборду
        getLeaderboard,
        getUserLeaderboardPosition,

        // Константи API-шляхів
        paths: API_PATHS,

        // Функції для діагностики
        diagnostics: {
            getRequestStats: function() {
                return {..._requestCounter};
            },
            resetState: function() {
                _userCache = null;
                _userCacheTime = 0;
                _requestCounter = {
                    total: 0,
                    errors: 0,
                    current: 0,
                    lastReset: Date.now()
                };
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

    console.log(`✅ API: Модуль успішно ініціалізовано (URL: ${API_BASE_URL})`);
})();