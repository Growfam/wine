/**
 * api.js - Сервіс для роботи з API розіграшів
 * Інтеграція з основним API системи
 * @version 1.1.1
 */

import WinixRaffles from '../globals.js';

// Покращена перевірка доступності основного API
const hasMainApi = () => {
    try {
        return window.WinixAPI &&
               typeof window.WinixAPI.apiRequest === 'function' &&
               typeof window.WinixAPI.getUserId === 'function';
    } catch (e) {
        console.error("🔌 Raffles API: Помилка перевірки головного API:", e);
        return false;
    }
};



// Константи для відстеження запитів (збільшені інтервали)
const REQUEST_THROTTLE = {
    '/raffles-history': 120000,     // 2 хвилини для історії розіграшів
    '/participate-raffle': 15000,   // 15 секунд для участі в розіграшах
    '/raffles': 30000,              // 30 секунд для списку розіграшів
    '/balance': 20000,              // 20 секунд для балансу
    '/refresh-token': 60000,        // 1 хвилина для оновлення токену
    'default': 15000                // 15 секунд для всіх інших
};

// Відстеження часу останніх запитів - ініціалізуємо об'єкт, щоб уникнути помилок
const _lastRequestTimes = {};

// Глобальна змінна для відстеження часу останнього запиту
let _lastRequestTime = Date.now(); // Ініціалізуємо поточним часом

// Активні запити
const _activeRequests = {};

// Кеш даних
const _cache = {
    activeRaffles: {data: null, timestamp: 0, ttl: 60000}, // 1 хвилина
    history: {data: null, timestamp: 0, ttl: 300000}, // 5 хвилин
    userData: {data: null, timestamp: 0, ttl: 120000} // 2 хвилини
};

/**
 * Отримати ID користувача
 * @returns {string|null} ID користувача або null
 */
export function getUserId() {
    // Використовуємо основний API, якщо доступний
    if (hasMainApi()) {
        try {
            return window.WinixAPI.getUserId();
        } catch (e) {
            console.warn("🔌 Raffles API: Помилка отримання ID з основного API:", e);
        }
    }

    // Резервна реалізація
    try {
        if (window.Telegram && window.Telegram.WebApp) {
            try {
                if (window.Telegram.WebApp.initDataUnsafe &&
                    window.Telegram.WebApp.initDataUnsafe.user &&
                    window.Telegram.WebApp.initDataUnsafe.user.id) {

                    const telegramId = String(window.Telegram.WebApp.initDataUnsafe.user.id);
                    return telegramId;
                }
            } catch (e) {
                console.warn("🔌 Raffles API: Помилка отримання ID з Telegram WebApp:", e);
            }
        }

        // Перевіряємо localStorage
        try {
            const localId = localStorage.getItem('telegram_user_id');
            if (localId && localId !== 'undefined' && localId !== 'null') return localId;
        } catch (e) {
            console.warn("🔌 Raffles API: Помилка отримання ID з localStorage:", e);
        }

        // Перевіряємо DOM елемент
        try {
            const userIdElement = document.getElementById('user-id');
            if (userIdElement && userIdElement.textContent) {
                const domId = userIdElement.textContent.trim();
                if (domId && domId !== 'undefined' && domId !== 'null') {
                    return domId;
                }
            }
        } catch (e) {
            console.warn("🔌 Raffles API: Помилка отримання ID з DOM:", e);
        }

        return null;
    } catch (error) {
        console.error("🔌 Raffles API: Критична помилка отримання ID користувача:", error);
        return null;
    }
}

/**
 * Отримання токену авторизації
 * @returns {string|null} Токен авторизації або null
 */
export function getAuthToken() {
    // Використовуємо основний API, якщо доступний
    if (hasMainApi() && typeof window.WinixAPI.getAuthToken === 'function') {
        try {
            const token = window.WinixAPI.getAuthToken();
            if (token) {
                console.log("🔑 Raffles API: Отримано токен з основного API");
                return token;
            }
        } catch (e) {
            console.warn("🔌 Raffles API: Помилка отримання токену з основного API:", e);
        }
    }

    // Резервний варіант - localStorage
    try {
        // Перевіряємо різні можливі ключі
        const possibleKeys = ['auth_token', 'token', 'accessToken'];
        for (const key of possibleKeys) {
            const token = localStorage.getItem(key);
            if (token && typeof token === 'string' && token.length > 5) {
                console.log(`🔑 Raffles API: Отримано токен з localStorage (ключ: ${key})`);
                return token;
            }
        }
    } catch (e) {
        console.warn("🔌 Raffles API: Помилка отримання токену з localStorage:", e);
    }

    console.warn("⚠️ Raffles API: Токен авторизації не знайдено");
    return null;
}

/**
 * Отримання правильного базового URL API
 * @returns {string} Базовий URL API
 */
function getApiBaseUrl() {
    // Спочатку перевіряємо налаштування у локальному конфігу
    if (WinixRaffles && WinixRaffles.config && WinixRaffles.config.apiBaseUrl) {
        return WinixRaffles.config.apiBaseUrl;
    }

    // Перевіряємо глобальний конфіг
    if (window.WinixConfig && window.WinixConfig.apiBaseUrl) {
        // Переконуємося, що URL не закінчується на /api
        const url = window.WinixConfig.apiBaseUrl;
        return url.endsWith('/api') ? url.slice(0, -4) : url;
    }

    // Перевіряємо основний API
    if (hasMainApi() && window.WinixAPI.config && window.WinixAPI.config.baseUrl) {
        const baseUrl = window.WinixAPI.config.baseUrl;
        return baseUrl.endsWith('/api') ? baseUrl.slice(0, -4) : baseUrl;
    }

    // Визначаємо URL на основі поточного середовища
    const hostname = window.location.hostname;
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
}

/**
 * Перевірка і управління обмеженням частоти запитів
 * @param {string} endpoint - Endpoint API
 * @returns {boolean} Дозволено виконати запит
 */
function canMakeRequest(endpoint) {
    // Ініціалізуємо _lastRequestTimes, якщо він не визначений
    if (typeof _lastRequestTimes !== 'object') {
        window._lastRequestTimes = {};
    }

    const now = Date.now();

    // Визначаємо мінімальний інтервал для ендпоінту
    let throttleTime = REQUEST_THROTTLE.default;
    for (const key in REQUEST_THROTTLE) {
        if (endpoint.includes(key)) {
            throttleTime = REQUEST_THROTTLE[key];
            break;
        }
    }

    // Перевіряємо, коли був останній запит
    const lastRequestTime = _lastRequestTimes[endpoint] || 0;
    if (now - lastRequestTime < throttleTime) {
        console.warn(`🔌 Raffles API: Занадто частий запит до ${endpoint}, залишилось ${Math.ceil((throttleTime - (now - lastRequestTime))/1000)}с`);
        return false;
    }

    // Оновлюємо час останнього запиту
    _lastRequestTimes[endpoint] = now;
    _lastRequestTime = now; // Оновлюємо глобальну змінну
    return true;
}

/**
 * Очищення зависаючих запитів
 */
function cleanupHangingRequests() {
    const now = Date.now();
    for (const endpoint in _activeRequests) {
        if (now - _activeRequests[endpoint] > 30000) { // 30 секунд
            console.warn(`🔌 Raffles API: Виявлено зависаючий запит до ${endpoint}, очищаємо`);
            delete _activeRequests[endpoint];
        }
    }
}

/**
 * Примусове очищення всіх активних запитів
 */
export function forceCleanupRequests() {
    for (const endpoint in _activeRequests) {
        delete _activeRequests[endpoint];
    }
    console.log("🔌 Raffles API: Примусово очищено всі активні запити");
    return true;
}

/**
 * Оновлення токену авторизації
 * @returns {Promise<boolean>} Результат оновлення
 */
export async function refreshToken() {
    console.log("🔄 Raffles API: Починаємо оновлення токену");

    // Використовуємо основний API, якщо доступний
    if (hasMainApi() && typeof window.WinixAPI.refreshToken === 'function') {
        try {
            console.log("🔄 Raffles API: Спроба оновлення через основний API");
            const result = await window.WinixAPI.refreshToken();
            console.log("✅ Raffles API: Токен успішно оновлено через основний API");
            return true;
        } catch (e) {
            console.warn("⚠️ Raffles API: Помилка оновлення через основний API:", e);
            // Продовжуємо з нашою реалізацією
        }
    }

    // Власна реалізація
    try {
        const userId = getUserId();
        if (!userId) {
            throw new Error("ID користувача не знайдено");
        }

        const oldToken = getAuthToken() || '';
        console.log("🔄 Raffles API: Спроба власного оновлення токену");

        // Створюємо запит напряму
        const apiBaseUrl = getApiBaseUrl();
        const response = await fetch(`${apiBaseUrl}/api/auth/refresh-token`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                telegram_id: userId,
                token: oldToken
            })
        });

        if (!response.ok) {
            throw new Error(`Помилка HTTP: ${response.status}`);
        }

        const data = await response.json();

        if (data && data.status === 'success' && data.token) {
            console.log("✅ Raffles API: Токен успішно оновлено через власну реалізацію");
            localStorage.setItem('auth_token', data.token);

            // Встановлюємо термін дії
            if (data.expires_at) {
                localStorage.setItem('auth_token_expiry', new Date(data.expires_at).getTime().toString());
            } else if (data.expires_in) {
                localStorage.setItem('auth_token_expiry', (Date.now() + (data.expires_in * 1000)).toString());
            }

            return true;
        } else {
            throw new Error(data.message || "Не вдалося оновити токен");
        }
    } catch (error) {
        console.error("❌ Raffles API: Помилка оновлення токену:", error);
        return false;
    }
}

/**
 * Універсальна функція для виконання API-запитів
 * @param {string} endpoint - URL ендпоінту
 * @param {string} method - HTTP метод (GET, POST, PUT, DELETE)
 * @param {Object} data - Дані для відправки
 * @param {Object} options - Додаткові параметри
 * @returns {Promise<Object>} Результат запиту
 */
export async function apiRequest(endpoint, method = 'GET', data = null, options = {}) {
    // Якщо endpoint починається з "/", видаляємо цей символ
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint.substring(1) : endpoint;

    // Перевіряємо, чи можна виконати запит (обмеження частоти)
    if (!options.bypassThrottle && !canMakeRequest(cleanEndpoint)) {
        // Перевіряємо, чи є кешовані дані
        const cacheKey = getCacheKeyFromEndpoint(cleanEndpoint);
        if (cacheKey && _cache[cacheKey] && _cache[cacheKey].data) {
            console.log(`🔌 Raffles API: Повертаємо кешовані дані для ${cleanEndpoint} через обмеження частоти`);
            return {
                status: 'success',
                data: _cache[cacheKey].data,
                source: 'cache_throttled'
            };
        }

        return {
            status: 'error',
            message: 'Занадто частий запит',
            source: 'throttled'
        };
    }

    // Перевіряємо, чи запит вже виконується
    if (_activeRequests[cleanEndpoint] && !options.allowParallel) {
        console.warn(`🔌 Raffles API: Запит до ${cleanEndpoint} вже виконується`);

        // Перевіряємо, чи є кешовані дані
        const cacheKey = getCacheKeyFromEndpoint(cleanEndpoint);
        if (cacheKey && _cache[cacheKey] && _cache[cacheKey].data) {
            console.log(`🔌 Raffles API: Повертаємо кешовані дані для ${cleanEndpoint} через паралельний запит`);
            return {
                status: 'success',
                data: _cache[cacheKey].data,
                source: 'cache_parallel'
            };
        }

        return {
            status: 'error',
            message: 'Запит вже виконується',
            source: 'parallel'
        };
    }

    // Якщо пристрій офлайн, одразу повертаємо помилку
    if (typeof navigator.onLine !== 'undefined' && !navigator.onLine && !options.bypassOfflineCheck) {
        console.warn("🔌 Raffles API: Пристрій офлайн, запит не виконано");

        // Повертаємо кешовані дані, якщо такі є
        const cacheKey = getCacheKeyFromEndpoint(cleanEndpoint);
        if (cacheKey && _cache[cacheKey] && _cache[cacheKey].data) {
            console.log(`🔌 Raffles API: Повертаємо кешовані дані для ${cleanEndpoint} в офлайн режимі`);
            return {
                status: 'success',
                data: _cache[cacheKey].data,
                source: 'cache_offline'
            };
        }

        return {
            status: 'error',
            message: 'Пристрій офлайн',
            source: 'offline'
        };
    }

    // Очищаємо зависаючі запити
    cleanupHangingRequests();

    // Позначаємо запит як активний
    _activeRequests[cleanEndpoint] = Date.now();
    _lastRequestTime = Date.now(); // Оновлюємо глобальну змінну

    // Якщо основний API доступний і опція useMainAPI не false, використовуємо його
    if (hasMainApi() && options.useMainAPI !== false) {
        try {
            // Оновлюємо токен перед важливими запитами
            if (cleanEndpoint.includes('history') || cleanEndpoint.includes('participate')) {
                try {
                    await refreshToken();
                } catch (tokenError) {
                    console.warn("🔌 Raffles API: Помилка оновлення токену перед запитом:", tokenError);
                }
            }

            const response = await window.WinixAPI.apiRequest(cleanEndpoint, method, data, options);

            // Кешуємо результат, якщо потрібно
            cacheResponse(cleanEndpoint, response);

            // Видаляємо запит з активних
            delete _activeRequests[cleanEndpoint];

            return response;
        } catch (mainApiError) {
            console.warn("🔌 Raffles API: Помилка в основному API, використовуємо резервний:", mainApiError);

            // Отримуємо кешовані дані у випадку помилки
            const cacheKey = getCacheKeyFromEndpoint(cleanEndpoint);
            if (cacheKey && _cache[cacheKey] && _cache[cacheKey].data) {
                console.log(`🔌 Raffles API: Повертаємо кешовані дані для ${cleanEndpoint} після помилки основного API`);

                // Видаляємо запит з активних
                delete _activeRequests[cleanEndpoint];

                return {
                    status: 'success',
                    data: _cache[cacheKey].data,
                    source: 'cache_after_main_api_error'
                };
            }

            // Якщо кеш не знайдено, продовжуємо з нашою реалізацією
        }
    }

    // Резервна реалізація API запиту
    try {
        // Використовуємо централізоване відображення лоадера
        if (!options.hideLoader && WinixRaffles && WinixRaffles.loader) {
            WinixRaffles.loader.show(options.loaderMessage || 'Завантаження...', `raffles-api-${cleanEndpoint}`);
        }

        // Формуємо базовий URL API
        const apiBaseUrl = getApiBaseUrl();

        // Додаємо мітку часу для запобігання кешуванню
        const timestamp = Date.now();
        const hasQuery = cleanEndpoint.includes('?');

        // Формуємо URL
        // Перевіряємо, чи endpoint вже містить 'api/'
        let urlEndpoint = cleanEndpoint;
        if (urlEndpoint.startsWith('api/')) {
            urlEndpoint = urlEndpoint.substring(4);
        }

        // Формуємо повний URL
        let apiUrlBase = apiBaseUrl;
        // Видаляємо дублікат /api якщо він є
        if (apiUrlBase.endsWith('/api') && urlEndpoint.startsWith('api/')) {
            urlEndpoint = urlEndpoint.substring(4);
        } else if (apiUrlBase.endsWith('/api') && urlEndpoint.startsWith('/api/')) {
            urlEndpoint = urlEndpoint.substring(5);
        }

        // Переконуємося, що URL не має подвійних слешів
        if (apiUrlBase.endsWith('/') && urlEndpoint.startsWith('/')) {
            urlEndpoint = urlEndpoint.substring(1);
        } else if (!apiUrlBase.endsWith('/') && !urlEndpoint.startsWith('/')) {
            apiUrlBase += '/';
        }

        const url = `${apiUrlBase}${urlEndpoint}${hasQuery ? '&' : '?'}t=${timestamp}`;

        // Отримуємо ID користувача
        const userId = getUserId();

        // Отримуємо токен авторизації
        const authToken = getAuthToken();

        // Готуємо заголовки
        const headers = {
            'Content-Type': 'application/json',
            ...(options.headers || {})
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
        const timeoutId = setTimeout(() => controller.abort(), timeout);

        try {
            // Виконуємо запит
            const response = await fetch(url, requestOptions);

            // Очищаємо таймаут
            clearTimeout(timeoutId);

            // Приховуємо індикатор завантаження
            if (!options.hideLoader && WinixRaffles && WinixRaffles.loader) {
                WinixRaffles.loader.hide(`raffles-api-${cleanEndpoint}`);
            }

            // Обробляємо відповідь
            if (!response.ok) {
                throw new Error(`Помилка сервера: ${response.status} ${response.statusText}`);
            }

            // Парсимо відповідь
            const jsonData = await response.json();

            // Кешуємо результат, якщо потрібно
            cacheResponse(cleanEndpoint, jsonData);

            // Видаляємо запит з активних
            delete _activeRequests[cleanEndpoint];

            return jsonData;
        } catch (error) {
            // Перевіряємо, чи запит був скасований через таймаут
            if (error.name === 'AbortError') {
                throw new Error('Час очікування запиту вичерпано');
            }

            throw error;
        }
    } catch (error) {
        console.error(`❌ Raffles API: Помилка запиту ${endpoint}:`, error);

        // Приховуємо індикатор завантаження
        if (!options.hideLoader && WinixRaffles && WinixRaffles.loader) {
            WinixRaffles.loader.hide(`raffles-api-${cleanEndpoint}`);
        }

        // Обробка 401 помилки - спроба оновити токен
        if (error.status === 401 ||
            (error.message && error.message.includes('401')) ||
            (error.message && error.message.includes('Unauthorized'))) {

            console.warn("🔄 Raffles API: Отримано помилку 401, спроба оновити токен");

            // Перевіряємо, що це не повторний запит після вже спробованого оновлення токену
            if (!options.after401) {
                try {
                    const refreshed = await refreshToken();

                    if (refreshed) {
                        console.log("🔄 Raffles API: Токен оновлено, повторюємо запит");

                        // Повторюємо запит з новим токеном
                        return await apiRequest(endpoint, method, data, {
                            ...options,
                            after401: true  // Запобігання рекурсії
                        });
                    } else {
                        console.warn("⚠️ Raffles API: Не вдалося оновити токен");
                    }
                } catch (refreshError) {
                    console.error("❌ Raffles API: Помилка при спробі оновити токен:", refreshError);
                }
            } else {
                console.warn("⚠️ Raffles API: Повторна помилка 401 навіть після оновлення токену");
            }
        }

        // Обробка 429 помилки - занадто багато запитів
        if (error.status === 429 ||
            (error.message && error.message.includes('429')) ||
            (error.message && error.message.includes('Too Many Requests'))) {

            console.warn(`🔄 Raffles API: Обмеження частоти запитів (429) для ${endpoint}`);

            // Показуємо користувачу повідомлення
            if (WinixRaffles && WinixRaffles.ui && WinixRaffles.ui.showToast) {
                WinixRaffles.ui.showToast(
                    "Занадто багато запитів. Спробуйте знову через кілька секунд.",
                    "warning"
                );
            }

            // Додаємо затримку перед наступним запитом
            const retryDelay = 5000; // 5 секунд

            // Зберігаємо інформацію про необхідність затримки
            _lastRequestsByEndpoint[endpoint] = Date.now() + retryDelay;

            // Отримуємо кешовані дані якщо є
            const cacheKey = getCacheKeyFromEndpoint(cleanEndpoint);
            if (cacheKey && _cache[cacheKey] && _cache[cacheKey].data) {
                console.log(`🔌 Raffles API: Повертаємо кешовані дані для ${cleanEndpoint} через обмеження запитів`);
                // Видаляємо запит з активних
                delete _activeRequests[cleanEndpoint];

                return {
                    status: 'success',
                    data: _cache[cacheKey].data,
                    source: 'cache_rate_limited',
                    retry_after: retryDelay
                };
            }
        }

        // Генеруємо подію про помилку API
        if (WinixRaffles && WinixRaffles.events) {
            WinixRaffles.events.emit('api-error', {
                error: error,
                endpoint: endpoint,
                method: method
            });
        }

        // Отримуємо кешовані дані у випадку помилки
        const cacheKey = getCacheKeyFromEndpoint(cleanEndpoint);
        if (cacheKey && _cache[cacheKey] && _cache[cacheKey].data) {
            console.log(`🔌 Raffles API: Повертаємо кешовані дані для ${cleanEndpoint} після помилки запиту`);
            return {
                status: 'success',
                data: _cache[cacheKey].data,
                source: 'cache_after_error'
            };
        }

        // Видаляємо запит з активних
        delete _activeRequests[cleanEndpoint];

        // Повертаємо об'єкт з помилкою
        return {
            status: 'error',
            message: error.message || 'Сталася помилка при виконанні запиту',
            source: 'raffles_api',
            error: error
        };
    }
}

/**
 * Визначення ключа кешу на основі endpoint
 * @param {string} endpoint - Endpoint запиту
 * @returns {string|null} Ключ кешу або null
 */
function getCacheKeyFromEndpoint(endpoint) {
    if (endpoint.includes('raffles') && !endpoint.includes('history')) {
        return 'activeRaffles';
    } else if (endpoint.includes('history')) {
        return 'history';
    } else if (endpoint.includes('user')) {
        return 'userData';
    }
    return null;
}

/**
 * Кешування відповіді API
 * @param {string} endpoint - Endpoint запиту
 * @param {Object} response - Відповідь API
 */
function cacheResponse(endpoint, response) {
    if (!response || response.status !== 'success' || !response.data) return;

    const cacheKey = getCacheKeyFromEndpoint(endpoint);
    if (!cacheKey) return;

    _cache[cacheKey] = {
        data: response.data,
        timestamp: Date.now(),
        ttl: _cache[cacheKey]?.ttl || 60000
    };
}

/**
 * Очищення кешу
 * @param {string} [cacheKey] - Ключ кешу для очищення (якщо не вказано, очищується весь кеш)
 */
export function clearCache(cacheKey) {
    if (cacheKey && _cache[cacheKey]) {
        _cache[cacheKey].data = null;
        _cache[cacheKey].timestamp = 0;
        console.log(`🔌 Raffles API: Кеш ${cacheKey} очищено`);
    } else {
        for (const key in _cache) {
            _cache[key].data = null;
            _cache[key].timestamp = 0;
        }
        console.log("🔌 Raffles API: Весь кеш очищено");
    }
}

/**
 * Отримання даних користувача
 * @param {boolean} forceRefresh - Примусове оновлення даних
 * @returns {Promise<Object>} Проміс з даними користувача
 */
export async function getUserData(forceRefresh = false) {
    // Перевірка чи пристрій онлайн
    if (typeof navigator.onLine !== 'undefined' && !navigator.onLine && !forceRefresh) {
        console.warn("🔌 Raffles API: Пристрій офлайн, використовуємо кешовані дані користувача");

        // Якщо є кешовані дані, повертаємо їх
        if (_cache.userData && _cache.userData.data) {
            return {
                status: 'success',
                data: _cache.userData.data,
                source: 'cache_offline'
            };
        }

        // Повертаємо базові дані з localStorage
        return {
            status: 'success',
            data: {
                telegram_id: getUserId() || 'unknown',
                balance: parseFloat(localStorage.getItem('userTokens') || '0'),
                coins: parseInt(localStorage.getItem('userCoins') || '0')
            },
            source: 'localStorage_offline'
        };
    }

    // Використовуємо основний API, якщо доступний
    if (hasMainApi()) {
        try {
            // Оновлюємо токен перед запитом
            await refreshToken();

            const result = await window.WinixAPI.getUserData(forceRefresh);

            // Виправлена версія - змінено resultData на result.data
if (result && result.status === 'success' && result.data) {
    // Оновлюємо localStorage
    if (result.data.balance !== undefined) {
        localStorage.setItem('userTokens', result.data.balance.toString());
        localStorage.setItem('winix_balance', result.data.balance.toString());
    }

    if (result.data.coins !== undefined) {
        localStorage.setItem('userCoins', result.data.coins.toString());
        localStorage.setItem('winix_coins', result.data.coins.toString());
    }

    // Оновлюємо елементи інтерфейсу напряму
    setTimeout(() => {
        try {
            // Оновлюємо елементи з ID
            const tokensElement = document.getElementById('user-tokens');
            const coinsElement = document.getElementById('user-coins');

            if (tokensElement && result.data.balance !== undefined) {
                tokensElement.textContent = result.data.balance;
            }

            if (coinsElement && result.data.coins !== undefined) {
                coinsElement.textContent = result.data.coins;
            }

            console.log("✅ Raffles API: Оновлено відображення балансу на сторінці");
        } catch (uiError) {
            console.error("❌ Raffles API: Помилка оновлення інтерфейсу:", uiError);
        }
    }, 100);


                // Відправляємо подію для інших модулів
                document.dispatchEvent(new CustomEvent('balance-updated', {
                    detail: {
                        balance: resultData.balance,
                        coins: resultData.coins,
                        source: 'raffles-api'
                    }
                }));
            }

            // Кешуємо результат
            if (result.status === 'success' && result.data) {
                _cache.userData = {
                    data: result.data,
                    timestamp: Date.now(),
                    ttl: _cache.userData?.ttl || 120000
                };
            }

            return result;
        } catch (e) {
            console.warn("🔌 Raffles API: Помилка отримання даних користувача з основного API:", e);

            // Якщо є кешовані дані, повертаємо їх
            if (_cache.userData && _cache.userData.data) {
                return {
                    status: 'success',
                    data: _cache.userData.data,
                    source: 'cache_after_error'
                };
            }
        }
    }

    try {
        const userId = getUserId();
        if (!userId) {
            return {
                status: 'error',
                message: 'ID користувача не знайдено'
            };
        }

        // Перевіряємо кеш, якщо не потрібне примусове оновлення
        if (!forceRefresh && _cache.userData && _cache.userData.data &&
            (Date.now() - _cache.userData.timestamp) < _cache.userData.ttl) {
            return {
                status: 'success',
                data: _cache.userData.data,
                source: 'cache'
            };
        }

        return await apiRequest(`user/${userId}`, 'GET', null, {
            useMainAPI: false, // Не використовувати основний API для уникнення рекурсії
            bypassThrottle: forceRefresh, // Ігноруємо обмеження частоти для примусового оновлення
            timeout: 5000 // Коротший таймаут
        });
    } catch (error) {
        console.error("🔌 Raffles API: Помилка отримання даних користувача:", error);

        // Якщо є кешовані дані, повертаємо їх
        if (_cache.userData && _cache.userData.data) {
            return {
                status: 'success',
                data: _cache.userData.data,
                source: 'cache_after_error'
            };
        }

        // Повертаємо базові дані з localStorage
        return {
            status: 'success',
            data: {
                telegram_id: getUserId() || 'unknown',
                balance: parseFloat(localStorage.getItem('userTokens') || '0'),
                coins: parseInt(localStorage.getItem('userCoins') || '0')
            },
            source: 'localStorage_fallback',
            message: 'Помилка отримання даних користувача: ' + error.message
        };
    }
}

/**
 * Отримання балансу користувача
 * @param {boolean} forceRefresh - Примусове оновлення даних
 * @returns {Promise<Object>} Баланс користувача
 */
export async function getBalance(forceRefresh = false) {
    // Перевірка чи пристрій онлайн
    if (typeof navigator.onLine !== 'undefined' && !navigator.onLine && !forceRefresh) {
        console.warn("🔌 Raffles API: Пристрій офлайн, використовуємо кешовані дані балансу");

        // Повертаємо базові дані з localStorage
        return {
            status: 'success',
            data: {
                balance: parseFloat(localStorage.getItem('userTokens') || '0'),
                coins: parseInt(localStorage.getItem('userCoins') || '0')
            },
            source: 'localStorage_offline'
        };
    }

    // Використовуємо основний API, якщо доступний
    if (hasMainApi()) {
        try {
            // Оновлюємо токен перед запитом
            await refreshToken();

            return await window.WinixAPI.getBalance(forceRefresh);
        } catch (e) {
            console.warn("🔌 Raffles API: Помилка отримання балансу з основного API:", e);
        }
    }

    try {
        const userId = getUserId();
        if (!userId) {
            return {
                status: 'error',
                message: 'ID користувача не знайдено'
            };
        }

        return await apiRequest(`user/${userId}/balance`, 'GET', null, {
            useMainAPI: false, // Не використовувати основний API для уникнення рекурсії
            bypassThrottle: forceRefresh,
            timeout: 5000 // Коротший таймаут
        });
    } catch (error) {
        console.error("🔌 Raffles API: Помилка отримання балансу користувача:", error);

        // Повертаємо дані з localStorage при помилці
        return {
            status: 'success',
            data: {
                balance: parseFloat(localStorage.getItem('userTokens') || '0'),
                coins: parseInt(localStorage.getItem('userCoins') || '0')
            },
            source: 'localStorage_fallback',
            message: 'Помилка отримання балансу: ' + error.message
        };
    }
}

// Спеціальні функції для розіграшів, які відсутні в основному API

/**
 * Отримання активних розіграшів
 * @param {boolean} forceRefresh - Примусове оновлення
 * @returns {Promise<Array>} Список активних розіграшів
 */
export async function getActiveRaffles(forceRefresh = false) {
    // Перевірка чи пристрій онлайн
    if (typeof navigator.onLine !== 'undefined' && !navigator.onLine && !forceRefresh) {
        console.warn("🔌 Raffles API: Пристрій офлайн, використовуємо кешовані дані розіграшів");

        // Якщо є кешовані дані, повертаємо їх
        if (_cache.activeRaffles && _cache.activeRaffles.data) {
            return _cache.activeRaffles.data;
        }

        // Якщо кешу немає, повертаємо порожній масив
        return [];
    }

    // Перевіряємо кеш, якщо не потрібне примусове оновлення
    if (!forceRefresh && _cache.activeRaffles && _cache.activeRaffles.data &&
        (Date.now() - _cache.activeRaffles.timestamp) < _cache.activeRaffles.ttl) {
        return _cache.activeRaffles.data;
    }

    try {
        // Оновлюємо токен перед запитом
        await refreshToken();

        const response = await apiRequest('raffles', 'GET', null, {
            timeout: 10000, // Зменшуємо таймаут для прискорення
            loaderMessage: 'Завантаження розіграшів...',
            bypassThrottle: forceRefresh
        });

        if (response && response.status === 'success') {
            const resultData = Array.isArray(response.data) ? response.data : [];

            // Оновлюємо кеш
            _cache.activeRaffles = {
                data: resultData,
                timestamp: Date.now(),
                ttl: _cache.activeRaffles?.ttl || 60000
            };

            return resultData;
        }

        // Якщо є помилка, але є кешовані дані, повертаємо їх
        if (_cache.activeRaffles && _cache.activeRaffles.data) {
            console.warn("🔌 Raffles API: Використовуємо кешовані дані розіграшів після помилки");
            return _cache.activeRaffles.data;
        }

        // Інакше повертаємо порожній масив
        return [];
    } catch (error) {
        console.error('Помилка отримання активних розіграшів:', error);

        // Якщо є кешовані дані, повертаємо їх
        if (_cache.activeRaffles && _cache.activeRaffles.data) {
            console.warn("🔌 Raffles API: Використовуємо кешовані дані розіграшів після помилки");
            return _cache.activeRaffles.data;
        }

        return [];
    }
}

/**
 * Отримання історії розіграшів
 * @param {Object} filters - Фільтри для запиту
 * @param {boolean} forceRefresh - Примусове оновлення
 * @returns {Promise<Array>} Список історії розіграшів
 */
export async function getRafflesHistory(filters = {}, forceRefresh = false) {
    // Перевірка чи пристрій онлайн
    if (typeof navigator.onLine !== 'undefined' && !navigator.onLine && !forceRefresh) {
        console.warn("🔌 Raffles API: Пристрій офлайн, використовуємо кешовані дані історії");

        // Якщо є кешовані дані, повертаємо їх
        if (_cache.history && _cache.history.data) {
            return _cache.history.data;
        }

        // Якщо кешу немає, повертаємо порожній масив
        return [];
    }

    // Перевіряємо кеш, якщо не потрібне примусове оновлення і немає фільтрів
    if (!forceRefresh && !Object.keys(filters).length && _cache.history && _cache.history.data &&
        (Date.now() - _cache.history.timestamp) < _cache.history.ttl) {
        return _cache.history.data;
    }

    try {
        const userId = getUserId();
        if (!userId) {
            throw new Error('ID користувача не знайдено');
        }

        // Оновлюємо токен перед запитом історії
        console.log("🔄 Raffles API: Оновлюємо токен перед запитом історії");
        const tokenRefreshed = await refreshToken();

        if (!tokenRefreshed) {
            console.warn("⚠️ Raffles API: Не вдалося оновити токен перед запитом історії");
        }

        // Формуємо параметри запиту
        let queryParams = '';
        if (filters.type && filters.type !== 'all') {
            queryParams += `&type=${filters.type}`;
        }
        if (filters.status && filters.status !== 'all') {
            queryParams += `&status=${filters.status}`;
        }
        if (filters.period && filters.period !== 'all') {
            queryParams += `&period=${filters.period}`;
        }

        // Додаємо параметри до URL, якщо вони є
        const url = queryParams
            ? `user/${userId}/raffles-history?${queryParams.substring(1)}`
            : `user/${userId}/raffles-history`;

        const response = await apiRequest(url, 'GET', null, {
            timeout: 15000, // Збільшуємо таймаут для історії
            loaderMessage: 'Завантаження історії розіграшів...',
            bypassThrottle: forceRefresh,
            after401: false // Дозволяємо обробку 401 помилки
        });

        if (response && response.status === 'success') {
            const resultData = Array.isArray(response.data) ? response.data : [];

            // Оновлюємо кеш тільки якщо немає фільтрів або це примусове оновлення
            if (!Object.keys(filters).length || forceRefresh) {
                _cache.history = {
                    data: resultData,
                    timestamp: Date.now(),
                    ttl: _cache.history?.ttl || 600000
                };
            }

            return resultData;
        }

        // Якщо є помилка, але є кешовані дані, повертаємо їх
        if (_cache.history && _cache.history.data) {
            console.warn("🔌 Raffles API: Використовуємо кешовані дані історії після помилки");
            return _cache.history.data;
        }

        return [];
    } catch (error) {
        console.error('Помилка отримання історії розіграшів:', error);

        // Якщо є кешовані дані, повертаємо їх
        if (_cache.history && _cache.history.data) {
            console.warn("🔌 Raffles API: Використовуємо кешовані дані історії після помилки");
            return _cache.history.data;
        }

        return [];
    }
}

/**
 * Участь у розіграші
 * @param {string} raffleId - ID розіграшу
 * @param {number} entryCount - Кількість жетонів для участі
 * @returns {Promise<Object>} Результат участі
 */
export async function participateInRaffle(raffleId, entryCount = 1) {
    try {
        // Перевірка чи пристрій онлайн
        if (typeof navigator.onLine !== 'undefined' && !navigator.onLine) {
            return {
                status: 'error',
                message: 'Не вдалося взяти участь: пристрій офлайн',
                source: 'offline'
            };
        }

        const userId = getUserId();
        if (!userId) {
            throw new Error('ID користувача не знайдено');
        }

        // Перевіряємо коректність entryCount
        if (isNaN(entryCount) || entryCount <= 0) {
            throw new Error('Кількість жетонів повинна бути більшою за нуль');
        }

        // Оновлюємо токен перед важливим запитом
        await refreshToken();

        const response = await apiRequest(`user/${userId}/participate-raffle`, 'POST', {
            raffle_id: raffleId,
            entry_count: entryCount
        }, {
            timeout: 15000, // Збільшуємо таймаут для важливої операції
            loaderMessage: 'Беремо участь у розіграші...'
        });

        if (response && response.status === 'success') {
            // Оновлюємо кеш розіграшів після успішної участі
            clearCache('activeRaffles');

            // Оновлюємо баланс користувача
            if (hasMainApi()) {
                try {
                    await window.WinixAPI.getBalance(true);
                } catch (e) {
                    console.warn("🔌 Raffles API: Помилка оновлення балансу після участі:", e);
                }
            } else {
                // Або оновлюємо баланс через власний API
                await getBalance(true);
            }

            // Оновлюємо дані користувача
            clearCache('userData');

            return {
                status: 'success',
                message: response.data?.message || 'Ви успішно взяли участь у розіграші',
                data: response.data
            };
        }

        throw new Error(response.message || 'Помилка участі в розіграші');
    } catch (error) {
        console.error(`Помилка участі в розіграші ${raffleId}:`, error);
        return {
            status: 'error',
            message: error.message || 'Помилка участі в розіграші'
        };
    }
}

/**
 * Отримання бонусу новачка
 * @returns {Promise<Object>} Результат отримання бонусу
 */
export async function claimNewbieBonus() {
    try {
        // Перевірка чи пристрій онлайн
        if (typeof navigator.onLine !== 'undefined' && !navigator.onLine) {
            return {
                status: 'error',
                message: 'Не вдалося отримати бонус: пристрій офлайн',
                source: 'offline'
            };
        }

        const userId = getUserId();
        if (!userId) {
            throw new Error('ID користувача не знайдено');
        }

        // Оновлюємо токен перед важливим запитом
        await refreshToken();

        const response = await apiRequest(`user/${userId}/claim-newbie-bonus`, 'POST', null, {
            timeout: 10000,
            loaderMessage: 'Отримуємо бонус новачка...'
        });

        if (response && (response.status === 'success' || response.status === 'already_claimed')) {
            // Оновлюємо баланс користувача
            if (hasMainApi()) {
                try {
                    await window.WinixAPI.getBalance(true);
                } catch (e) {
                    console.warn("🔌 Raffles API: Помилка оновлення балансу після отримання бонусу:", e);
                }
            } else {
                // Або оновлюємо баланс через власний API
                await getBalance(true);
            }

            // Оновлюємо дані користувача
            clearCache('userData');

            return {
                status: response.status,
                message: response.message || 'Бонус новачка успішно отримано',
                data: response.data
            };
        }

        throw new Error(response.message || 'Помилка отримання бонусу новачка');
    } catch (error) {
        console.error('Помилка отримання бонусу новачка:', error);
        return {
            status: 'error',
            message: error.message || 'Помилка отримання бонусу новачка'
        };
    }
}

// Створюємо об'єкт з API функціями для модуля розіграшів
const rafflesAPI = {
    // Основні функції
    apiRequest,
    getUserId,
    getAuthToken,
    getUserData,
    getBalance,
    forceCleanupRequests,
    clearCache,
    refreshToken,

    // Специфічні функції для розіграшів
    getActiveRaffles,
    getRafflesHistory,
    participateInRaffle,
    claimNewbieBonus,

    // Конфігурація
    config: {
        baseUrl: getApiBaseUrl(),
        throttle: REQUEST_THROTTLE
    },

    // Метадані
    _version: '1.1.1',
    _type: 'raffles'
};

// Розширюємо основний API новими функціями, якщо він існує
if (hasMainApi()) {
    // Додаємо до основного API всі нові функції, яких там немає
    Object.keys(rafflesAPI).forEach(key => {
        if (!window.WinixAPI[key] &&
            key !== 'apiRequest' &&
            key !== 'getUserId' &&
            key !== 'getAuthToken') {
            window.WinixAPI[key] = rafflesAPI[key];
        }
    });

    // Додаємо об'єкт raffles в основний API
    window.WinixAPI.raffles = rafflesAPI;

    console.log("🔌 Raffles API: Успішно розширено основний API системи");
} else {
    // Якщо основний API не існує, створюємо глобальний об'єкт для API розіграшів
    window.WinixRafflesAPI = rafflesAPI;
    console.log("🔌 Raffles API: Створено окремий API для розіграшів (основний API не знайдено)");
}

// Додаємо API в глобальний об'єкт розіграшів для використання в інших модулях
if (WinixRaffles) {
    WinixRaffles.api = rafflesAPI;
}

// Обробник події онлайн/офлайн
window.addEventListener('online', () => {
    console.log("🔌 Raffles API: З'єднання з мережею відновлено");

    // Автоматично оновлюємо кеш при відновленні з'єднання
    setTimeout(() => {
        getActiveRaffles(true).then(() => {
            console.log("🔌 Raffles API: Кеш розіграшів оновлено після відновлення з'єднання");
        }).catch(e => {
            console.warn("🔌 Raffles API: Помилка оновлення кешу розіграшів:", e);
        });
    }, 1000);
});

window.addEventListener('offline', () => {
    console.warn("🔌 Raffles API: З'єднання з мережею втрачено");
});

console.log("🔌 Raffles API: Ініціалізацію завершено");

// Експортуємо API як основний експорт
export default rafflesAPI;