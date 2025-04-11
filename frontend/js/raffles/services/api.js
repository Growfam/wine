/**
 * api.js - Централізований сервіс для роботи з API
 * Відповідає за всі запити до сервера та управління відповідями
 */

import WinixRaffles from '../globals.js';
import { showToast } from '../utils/ui-helpers.js';

// Базовий URL для API-запитів
const API_BASE_URL = WinixRaffles.config.apiBaseUrl || '/api';

// Дані авторизації
let _token = null;
let _userId = null;

// Відстеження запитів
let _lastRequestTime = 0;
let _requestsInProgress = {};

// Обмеження запитів (throttling)
const REQUEST_THROTTLE = {
    '/raffles-history': 15000,      // 15 секунд для історії розіграшів
    '/participate-raffle': 3000,    // 3 секунди для участі в розіграшах
    'default': 2000                 // 2 секунди для всіх інших
};

// Максимальна кількість паралельних запитів
const PARALLEL_REQUESTS_LIMIT = 5;

// Таймаути для запитів
let _requestTimeouts = {};

// Кеш відповідей для GET запитів
let _responseCache = {};

// Максимальний час життя кешу
const DEFAULT_CACHE_TTL = 5 * 60 * 1000; // 5 хвилин

/**
 * Отримати ID користувача з усіх можливих джерел
 * @returns {string|null} ID користувача або null, якщо не знайдено
 */
export function getUserId() {
    // 1. Використовуємо кешований ID, якщо він є
    if (_userId) {
        return _userId;
    }

    // 2. Перевіряємо Telegram WebApp
    if (window.Telegram && window.Telegram.WebApp) {
        try {
            if (window.Telegram.WebApp.initDataUnsafe &&
                window.Telegram.WebApp.initDataUnsafe.user &&
                window.Telegram.WebApp.initDataUnsafe.user.id) {

                _userId = window.Telegram.WebApp.initDataUnsafe.user.id.toString();
                return _userId;
            }
        } catch (e) {
            console.warn("🔌 API: Помилка отримання ID з Telegram WebApp:", e);
        }
    }

    // 3. Перевіряємо localStorage
    try {
        const localId = localStorage.getItem('telegram_user_id');
        if (localId) {
            _userId = localId;
            return _userId;
        }
    } catch (e) {
        // Ігноруємо помилки localStorage
    }

    // 4. Перевіряємо глобальний об'єкт конфігурації
    if (window.WinixConfig && window.WinixConfig.userId) {
        _userId = window.WinixConfig.userId.toString();
        return _userId;
    }

    // ID не знайдено
    return null;
}

/**
 * Отримання токену авторизації
 * @returns {string|null} Токен авторизації або null, якщо не знайдено
 */
export function getAuthToken() {
    // 1. Використовуємо кешований токен, якщо він є
    if (_token) {
        return _token;
    }

    // 2. Спробуємо отримати токен з localStorage
    try {
        _token = localStorage.getItem('auth_token');
        return _token;
    } catch (e) {
        // Ігноруємо помилки localStorage
    }

    // 3. Перевіряємо глобальний об'єкт конфігурації
    if (window.WinixConfig && window.WinixConfig.authToken) {
        _token = window.WinixConfig.authToken;
        return _token;
    }

    return null;
}

/**
 * Отримання ID адміністратора (для адмін-функцій)
 * @returns {string|null} ID адміністратора або null
 */
export function getAdminId() {
    try {
        // 1. Перевіряємо наявність ID адміністратора в localStorage
        const adminId = localStorage.getItem('admin_user_id');
        if (adminId) {
            return adminId;
        }

        // 2. Перевіряємо наявність адмін-прав в Telegram WebApp
        if (window.Telegram && window.Telegram.WebApp &&
            window.Telegram.WebApp.initDataUnsafe &&
            window.Telegram.WebApp.initDataUnsafe.user &&
            window.Telegram.WebApp.initDataUnsafe.user.is_admin) {

            return window.Telegram.WebApp.initDataUnsafe.user.id.toString();
        }

        // 3. Перевіряємо глобальний об'єкт конфігурації
        if (window.WinixConfig && window.WinixConfig.isAdmin) {
            return getUserId();
        }

        return null;
    } catch (e) {
        console.warn("🔌 API: Помилка отримання ID адміністратора:", e);
        return null;
    }
}

/**
 * Отримати час обмеження для ендпоінту
 * @param {string} endpoint - URL ендпоінту
 * @returns {number} Час обмеження в мілісекундах
 * @private
 */
function _getThrottleTime(endpoint) {
    for (const key in REQUEST_THROTTLE) {
        if (endpoint.includes(key)) {
            return REQUEST_THROTTLE[key];
        }
    }
    return REQUEST_THROTTLE.default;
}

/**
 * Перевірка кешу для запиту
 * @param {string} cacheKey - Ключ кешу
 * @returns {Object|null} Дані з кешу або null
 * @private
 */
function _checkCache(cacheKey) {
    const cachedItem = _responseCache[cacheKey];
    if (!cachedItem) return null;

    const now = Date.now();
    if (now > cachedItem.expires) {
        // Кеш застарів, видаляємо його
        delete _responseCache[cacheKey];
        return null;
    }

    return cachedItem.data;
}

/**
 * Додавання відповіді в кеш
 * @param {string} cacheKey - Ключ кешу
 * @param {Object} data - Дані для кешування
 * @param {number} ttl - Час життя кешу в мілісекундах
 * @private
 */
function _addToCache(cacheKey, data, ttl = DEFAULT_CACHE_TTL) {
    _responseCache[cacheKey] = {
        data,
        created: Date.now(),
        expires: Date.now() + ttl
    };

    // Очищення старих записів, якщо кеш занадто великий
    const cacheSize = Object.keys(_responseCache).length;
    if (cacheSize > 50) {
        _cleanupCache();
    }
}

/**
 * Очищення застарілих елементів кешу
 * @private
 */
function _cleanupCache() {
    const now = Date.now();
    let count = 0;

    // Видаляємо застарілі елементи
    Object.keys(_responseCache).forEach(key => {
        if (_responseCache[key].expires < now) {
            delete _responseCache[key];
            count++;
        }
    });

    // Якщо все ще забагато записів, видаляємо найстаріші
    const remainingSize = Object.keys(_responseCache).length;
    if (remainingSize > 30) {
        const sortedEntries = Object.entries(_responseCache)
            .sort(([, a], [, b]) => a.created - b.created);

        // Видаляємо 10 найстаріших записів
        sortedEntries.slice(0, 10).forEach(([key]) => {
            delete _responseCache[key];
            count++;
        });
    }

    console.log(`🧹 API: Очищено ${count} застарілих або надлишкових записів кешу`);
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

        // Перевіряємо обмеження частоти запитів
        const now = Date.now();
        const timeSinceLastRequest = now - _lastRequestTime;
        const throttleTime = _getThrottleTime(endpoint);

        if (timeSinceLastRequest < throttleTime && !options.ignoreThrottle) {
            console.warn(`🔌 API: Занадто частий запит до ${endpoint}, минуло ${timeSinceLastRequest}ms`);

            // Спеціальна обробка для історії розіграшів
            if (endpoint.includes('/raffles-history')) {
                console.log("🔌 API: Повертаю порожній масив для занадто частого запиту історії розіграшів");
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
            const cachedData = _checkCache(requestKey);
            if (cachedData) {
                return { ...cachedData, source: 'cache' };
            }
        }

        // Перевіряємо, чи цей запит уже в процесі виконання
        if (_requestsInProgress[requestKey] && !options.allowParallel) {
            console.warn(`🔌 API: Дублікат запиту виявлено: ${endpoint}`);
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
            console.warn(`🔌 API: Досягнуто ліміт паралельних запитів (${PARALLEL_REQUESTS_LIMIT})`);
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

        // Додаємо ID адміністратора, якщо доступний
        const adminId = getAdminId();
        if (adminId) {
            headers['X-Admin-User-Id'] = adminId;
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
        const timeoutId = setTimeout(() => {
            controller.abort();
            delete _requestTimeouts[requestKey];
            delete _requestsInProgress[requestKey];
            console.warn(`🔌 API: Таймаут запиту ${requestKey}`);
        }, timeout);

        _requestTimeouts[requestKey] = timeoutId;

        // Показуємо індикатор завантаження
        if (!options.hideLoader) {
            // Використовуємо централізоване управління лоадером
            WinixRaffles.loader.show('Завантаження...', `api-${requestKey}`);
        }

        try {
            // Виконуємо запит
            const response = await fetch(url, requestOptions);

            // Обробляємо відповідь
            if (!response.ok) {
                // Спеціальна обробка для історії розіграшів при помилках сервера
                if (endpoint.includes('/raffles-history') && response.status >= 500) {
                    console.warn(`🔌 API: Помилка сервера при запиті історії розіграшів, повертаю порожній масив`);
                    return {
                        status: 'success',
                        data: [],
                        source: 'error_fallback'
                    };
                }

                throw new Error(`Помилка сервера: ${response.status} ${response.statusText}`);
            }

            // Парсимо відповідь
            const jsonData = await response.json();

            // Кешуємо відповідь для GET запитів
            if (method === 'GET' && !options.noCache) {
                const cacheTTL = options.cacheTTL || DEFAULT_CACHE_TTL;
                _addToCache(requestKey, jsonData, cacheTTL);
            }

            // Повертаємо відповідь
            return jsonData;
        } catch (error) {
            // Обробка спеціальних помилок для розіграшів
            if (endpoint.includes('/raffles-history')) {
                console.warn(`🔌 API: Помилка при запиті історії розіграшів: ${error.message}, повертаю порожній масив`);
                return {
                    status: 'success',
                    data: [],
                    source: 'error_fallback'
                };
            }

            throw error;
        } finally {
            // Знімаємо таймаут і прапорець виконання
            if (_requestTimeouts[requestKey]) {
                clearTimeout(_requestTimeouts[requestKey]);
                delete _requestTimeouts[requestKey];
            }
            delete _requestsInProgress[requestKey];

            // Приховуємо індикатор завантаження
            if (!options.hideLoader) {
                WinixRaffles.loader.hide(`api-${requestKey}`);
            }
        }
    } catch (error) {
        console.error(`🔌 API: Помилка запиту ${endpoint}:`, error.message);

        // Генеруємо подію про помилку API
        WinixRaffles.events.emit('api-error', {
            error: error,
            endpoint: endpoint,
            method: method
        });

        // Повертаємо об'єкт з помилкою
        return {
            status: 'error',
            message: error.message || 'Сталася помилка при виконанні запиту',
            source: error.source || 'unknown'
        };
    }
}

/**
 * Примусове очищення всіх активних запитів
 * @returns {number} Кількість очищених запитів
 */
export function forceCleanupRequests() {
    const count = Object.keys(_requestsInProgress).length;

    // Очищення активних запитів
    _requestsInProgress = {};

    // Очищення таймаутів
    for (const key in _requestTimeouts) {
        clearTimeout(_requestTimeouts[key]);
        delete _requestTimeouts[key];
    }

    console.log(`🔌 API: Примусово очищено ${count} активних запитів`);
    return count;
}

/**
 * Отримання даних користувача з сервера
 * @param {boolean} forceRefresh - Примусове оновлення даних
 * @returns {Promise<Object>} Дані користувача
 */
export async function getUserData(forceRefresh = false) {
    const userId = getUserId();
    if (!userId) {
        return {
            status: 'error',
            message: 'ID користувача не знайдено'
        };
    }

    return await apiRequest(`/user/${userId}`, 'GET', null, {
        bypassCache: forceRefresh,
        cacheTTL: 5 * 60 * 1000 // 5 хвилин
    });
}

/**
 * Отримання балансу користувача
 * @param {boolean} forceRefresh - Примусове оновлення даних
 * @returns {Promise<Object>} Баланс користувача
 */
export async function getBalance(forceRefresh = false) {
    const userId = getUserId();
    if (!userId) {
        return {
            status: 'error',
            message: 'ID користувача не знайдено'
        };
    }

    return await apiRequest(`/user/${userId}/balance`, 'GET', null, {
        bypassCache: forceRefresh,
        cacheTTL: 2 * 60 * 1000 // 2 хвилини
    });
}

/**
 * Оновлення кешу API
 * @param {string} type - Тип даних для оновлення ('all', 'user', 'raffles')
 */
export function invalidateCache(type = 'all') {
    let count = 0;

    if (type === 'all') {
        // Очищаємо весь кеш
        count = Object.keys(_responseCache).length;
        _responseCache = {};
    } else {
        // Очищаємо кеш певного типу
        Object.keys(_responseCache).forEach(key => {
            if ((type === 'user' && key.includes('/user/')) ||
                (type === 'raffles' && key.includes('/raffles'))) {
                delete _responseCache[key];
                count++;
            }
        });
    }

    console.log(`🧹 API: Очищено ${count} записів кешу типу "${type}"`);
    return count;
}

/**
 * Отримання статистики використання API
 * @returns {Object} Статистика запитів
 */
export function getApiStats() {
    return {
        activeRequests: Object.keys(_requestsInProgress).length,
        cacheSize: Object.keys(_responseCache).length,
        lastRequestTime: _lastRequestTime,
        throttleSettings: REQUEST_THROTTLE,
    };
}

/**
 * Створення об'єкту для API
 */
const api = {
    // Основні функції
    apiRequest,
    getUserId,
    getAuthToken,
    getAdminId,
    forceCleanupRequests,

    // Функції для роботи з користувачем
    getUserData,
    getBalance,

    // Функції управління кешем
    invalidateCache,
    getApiStats,

    // Конфігурація
    config: {
        baseUrl: API_BASE_URL,
        throttle: REQUEST_THROTTLE,
        parallelLimit: PARALLEL_REQUESTS_LIMIT
    }
};

// Додаємо в глобальний об'єкт для зворотної сумісності
WinixRaffles.api = api;

// Для повної зворотної сумісності додаємо в window
window.WinixAPI = api;

console.log("🔌 API: Ініціалізація централізованого API сервісу");

// Експортуємо API як основний експорт
export default api;