/**
 * APIConnectivity - модуль для надійної взаємодії з API
 *
 * Відповідає за:
 * - Перевірку доступності API та стабільності з'єднання
 * - Обробку запитів з повторними спробами
 * - Кешування відповідей
 * - Уніфіковану обробку помилок
 *
 * @version 3.2.0
 */

import errorHandler, { ERROR_LEVELS, ERROR_CATEGORIES } from './error-handler.js';
import cacheService from './CacheService.js';

// Створюємо обробник помилок для модуля
const moduleErrors = errorHandler.createModuleHandler('APIConnectivity');

// Таймери для очищення
const timers = {
    periodicCheck: null,
    cacheCleanup: null
};

// Обробники подій
const eventHandlers = {
    online: null,
    offline: null,
    domReady: null
};

// Статус ініціалізації
let isInitialized = false;

// Стан з'єднання
const state = {
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    apiAvailable: true,
    lastCheck: 0,
    failedEndpoints: {},
    pendingRequests: new Map(),
    requestHistory: {}
};

// Базова конфігурація
const config = {
    criticalEndpoints: ['api/ping', 'api/user/{userId}'],
    checkInterval: 60000,              // 1 хвилина
    checkTimeout: 5000,
    requestTimeout: 15000,
    maxRetries: 2,
    retryDelay: 1000,
    preventDuplicateRequests: true,
    duplicateRequestsLockTime: 5000,
    useResponseCaching: true,
    responseCacheTime: 300000,         // 5 хвилин
    debug: false
};

// Ключі для кешу
const CACHE_KEYS = {
    API_CHECK: 'api_availability_check',
    ENDPOINTS: 'api_endpoints_status',
    REQUEST_PREFIX: 'api_request_'
};

// Теги для кешу
const CACHE_TAGS = {
    API: 'api',
    REQUEST: 'api_request',
    STATUS: 'api_status',
    RESPONSE: 'api_response'
};

/**
 * Ініціалізація модуля
 * @param {Object} options - Налаштування
 */
function init(options = {}) {
    try {
        // Перевіряємо, чи вже ініціалізовано
        if (isInitialized) {
            moduleErrors.warning('Модуль вже ініціалізовано', 'init', {
                category: ERROR_CATEGORIES.INIT
            });
            return;
        }

        moduleErrors.info("Ініціалізація модуля", 'init', {
            category: ERROR_CATEGORIES.INIT
        });

        // Застосовуємо опції
        if (options && typeof options === 'object') {
            Object.assign(config, options);
        }

        // Створюємо обробники подій
        eventHandlers.online = handleOnline;
        eventHandlers.offline = handleOffline;

        // Додаємо обробники мережевих подій
        if (typeof window !== 'undefined') {
            window.addEventListener('online', eventHandlers.online);
            window.addEventListener('offline', eventHandlers.offline);
        }

        // Запускаємо перевірки та очищення кешу
        startPeriodicCheck();
        checkAPIAvailability();
        scheduleCleanup();

        isInitialized = true;
    } catch (error) {
        moduleErrors.critical(error, 'Критична помилка при ініціалізації модуля', {
            category: ERROR_CATEGORIES.INIT
        });
    }
}

/**
 * Планування очищення кешу
 */
function scheduleCleanup() {
    try {
        if (timers.cacheCleanup) {
            clearInterval(timers.cacheCleanup);
        }

        timers.cacheCleanup = setInterval(() => {
            // Замість власної реалізації використовуємо функцію очищення CacheService
            cacheService.cleanup();
        }, 300000);
    } catch (error) {
        moduleErrors.error(error, 'Помилка планування очищення кешу', {
            category: ERROR_CATEGORIES.LOGIC
        });
    }
}

/**
 * Обробник відновлення з'єднання
 */
function handleOnline() {
    try {
        state.isOnline = true;
        moduleErrors.info("З'єднання з мережею відновлено", 'handleOnline');

        // Відправляємо подію
        if (typeof document !== 'undefined') {
            document.dispatchEvent(new CustomEvent('api-connectivity-changed', {
                detail: { online: true }
            }));
        }

        // Перевіряємо API
        checkAPIAvailability();
    } catch (error) {
        moduleErrors.error(error, 'Помилка обробки відновлення з\'єднання', {
            category: ERROR_CATEGORIES.NETWORK
        });
    }
}

/**
 * Обробник втрати з'єднання
 */
function handleOffline() {
    try {
        state.isOnline = false;
        moduleErrors.warning("З'єднання з мережею втрачено", 'handleOffline');

        // Відправляємо подію
        if (typeof document !== 'undefined') {
            document.dispatchEvent(new CustomEvent('api-connectivity-changed', {
                detail: { online: false }
            }));
        }
    } catch (error) {
        moduleErrors.error(error, 'Помилка обробки втрати з\'єднання', {
            category: ERROR_CATEGORIES.NETWORK
        });
    }
}

/**
 * Запуск періодичної перевірки API
 */
function startPeriodicCheck() {
    try {
        if (timers.periodicCheck) {
            clearInterval(timers.periodicCheck);
            timers.periodicCheck = null;
        }

        timers.periodicCheck = setInterval(() => {
            if (state.isOnline) {
                checkAPIAvailability();
            }
        }, config.checkInterval);
    } catch (error) {
        moduleErrors.error(error, 'Помилка запуску періодичної перевірки', {
            category: ERROR_CATEGORIES.LOGIC
        });
    }
}

/**
 * Зупинка періодичної перевірки API
 */
function stopPeriodicCheck() {
    try {
        if (timers.periodicCheck) {
            clearInterval(timers.periodicCheck);
            timers.periodicCheck = null;
        }
    } catch (error) {
        moduleErrors.error(error, 'Помилка зупинки періодичної перевірки', {
            category: ERROR_CATEGORIES.LOGIC
        });
    }
}

/**
 * Перевірка доступності API
 * @returns {Promise<boolean>} Результат перевірки
 */
async function checkAPIAvailability() {
    try {
        if (!isInitialized || !state.isOnline) {
            return false;
        }

        // Запобігаємо частим перевіркам
        const now = Date.now();
        if (now - state.lastCheck < 10000) {
            // Використовуємо кешований результат
            const cachedResult = cacheService.get(CACHE_KEYS.API_CHECK);
            if (cachedResult !== null) {
                return cachedResult;
            }
            return state.apiAvailable;
        }

        state.lastCheck = now;

        // Виконуємо простий запит до API
        const pingUrl = getApiUrl('api/ping');
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), config.checkTimeout);

        const response = await fetch(pingUrl, {
            method: 'GET',
            headers: { 'Accept': 'application/json' },
            signal: controller.signal
        });

        clearTimeout(timeoutId);

        // Оновлюємо стан API
        const wasAvailable = state.apiAvailable;
        state.apiAvailable = response.ok;

        // Кешуємо результат перевірки з коротким часом життя
        cacheService.set(CACHE_KEYS.API_CHECK, state.apiAvailable, {
            ttl: 20000, // 20 секунд
            tags: [CACHE_TAGS.API, CACHE_TAGS.STATUS]
        });

        // Якщо стан змінився, відправляємо подію
        if (wasAvailable !== state.apiAvailable) {
            if (typeof document !== 'undefined') {
                document.dispatchEvent(new CustomEvent('api-availability-changed', {
                    detail: { available: state.apiAvailable }
                }));
            }
        }

        return state.apiAvailable;
    } catch (error) {
        // У випадку помилки вважаємо, що API недоступний
        const wasAvailable = state.apiAvailable;
        state.apiAvailable = false;

        moduleErrors.error(error, 'Помилка перевірки доступності API', {
            category: ERROR_CATEGORIES.API
        });

        // Кешуємо негативний результат з коротким часом життя
        cacheService.set(CACHE_KEYS.API_CHECK, false, {
            ttl: 10000, // 10 секунд
            tags: [CACHE_TAGS.API, CACHE_TAGS.STATUS]
        });

        // Якщо стан змінився, відправляємо подію
        if (wasAvailable && typeof document !== 'undefined') {
            document.dispatchEvent(new CustomEvent('api-availability-changed', {
                detail: { available: false }
            }));
        }

        return false;
    }
}

/**
 * Отримання стану з'єднання
 * @returns {Object} Стан з'єднання
 */
function getConnectionState() {
    try {
        return {
            isOnline: state.isOnline,
            apiAvailable: state.apiAvailable,
            failedEndpoints: { ...state.failedEndpoints },
            lastCheck: state.lastCheck,
            timeSinceLastCheck: Date.now() - state.lastCheck,
            pendingRequestsCount: state.pendingRequests.size,
            cacheSize: cacheService.getStats().totalItems,
            isInitialized
        };
    } catch (error) {
        moduleErrors.error(error, 'Помилка отримання стану з\'єднання', {
            category: ERROR_CATEGORIES.LOGIC
        });
        return { error: true };
    }
}

/**
 * Скидання лічильників помилок
 */
function resetFailureCounters() {
    try {
        state.failedEndpoints = {};

        // Оновлюємо кешовані дані
        cacheService.set(CACHE_KEYS.ENDPOINTS, state.failedEndpoints, {
            tags: [CACHE_TAGS.API, CACHE_TAGS.STATUS]
        });
    } catch (error) {
        moduleErrors.error(error, 'Помилка скидання лічильників помилок', {
            category: ERROR_CATEGORIES.LOGIC
        });
    }
}

/**
 * Примусова перевірка з'єднання
 * @returns {Promise<boolean>} Результат перевірки
 */
function forceCheck() {
    try {
        state.lastCheck = 0;

        // Очищаємо кешований результат
        cacheService.remove(CACHE_KEYS.API_CHECK);

        return checkAPIAvailability();
    } catch (error) {
        moduleErrors.error(error, 'Помилка примусової перевірки', {
            category: ERROR_CATEGORIES.API
        });
        return Promise.resolve(false);
    }
}

/**
 * Отримання базового URL API
 * @returns {string} Базовий URL API
 */
function getApiBaseUrl() {
    try {
        if (typeof window !== 'undefined' && window.WinixAPI?.config?.baseUrl) {
            return window.WinixAPI.config.baseUrl.replace(/\/$/, '');
        }
        return typeof window !== 'undefined' ? window.location.origin : '';
    } catch (error) {
        moduleErrors.error(error, 'Помилка отримання базового URL', {
            category: ERROR_CATEGORIES.API
        });
        return '';
    }
}

/**
 * Формування повного URL API
 * @param {string} endpoint - Ендпоінт
 * @returns {string} Повний URL API
 */
function getApiUrl(endpoint) {
    try {
        const formattedEndpoint = endpoint.replace(/^\//, '');
        return `${getApiBaseUrl()}/${formattedEndpoint}`;
    } catch (error) {
        moduleErrors.error(error, 'Помилка формування URL API', {
            category: ERROR_CATEGORIES.API
        });
        return endpoint;
    }
}

/**
 * Отримання ID користувача
 * @returns {string|null} ID користувача
 */
function getUserId() {
    try {
        if (typeof window === 'undefined') return null;

        // Перевіряємо в кеші
        const cachedUserId = cacheService.get('user_id');
        if (cachedUserId) {
            return cachedUserId;
        }

        // Джерела ID
        const sources = [
            typeof window.getUserId === 'function' ? window.getUserId() : null,
            typeof window.WinixAPI?.getUserId === 'function' ? window.WinixAPI.getUserId() : null,
            window.localStorage?.getItem('telegram_user_id'),
            new URLSearchParams(window.location.search).get('id'),
            new URLSearchParams(window.location.search).get('user_id'),
            new URLSearchParams(window.location.search).get('telegram_id')
        ];

        // Перевіряємо кожне джерело
        for (const id of sources) {
            if (id && typeof id === 'string' && id !== 'undefined' && id !== 'null' && id.length > 3) {
                // Кешуємо ID користувача
                cacheService.set('user_id', id, {
                    ttl: 86400000, // 24 години
                    tags: ['user', 'auth']
                });
                return id;
            }
        }

        moduleErrors.warning('ID користувача не знайдено', 'getUserId', {
            category: ERROR_CATEGORIES.AUTH
        });
        return null;
    } catch (error) {
        moduleErrors.error(error, 'Помилка отримання ID користувача', {
            category: ERROR_CATEGORIES.AUTH
        });
        return null;
    }
}

/**
 * Форматування дати в UTC
 * @param {Date} date - Дата
 * @returns {string} Дата в ISO форматі
 */
function formatDateToUTC(date) {
    try {
        if (!date) date = new Date();
        return date.toISOString();
    } catch (error) {
        moduleErrors.error(error, 'Помилка форматування дати', {
            category: ERROR_CATEGORIES.LOGIC
        });
        return new Date().toISOString();
    }
}

/**
 * Парсинг ISO дати
 * @param {string} dateString - Рядок ISO дати
 * @returns {Date|null} Об'єкт Date
 */
function parseISODate(dateString) {
    try {
        if (!dateString) return null;
        return new Date(dateString);
    } catch (error) {
        moduleErrors.error(error, 'Помилка парсингу ISO дати', {
            category: ERROR_CATEGORIES.LOGIC
        });
        return null;
    }
}

/**
 * Виконання запиту до API
 * @param {string} endpoint - Ендпоінт
 * @param {Object} options - Налаштування запиту
 * @returns {Promise<Object>} Результат запиту
 */
async function apiRequest(endpoint, options = {}) {
    try {
        // Перевіряємо статус модуля
        if (!isInitialized) {
            const error = new Error('APIConnectivity не ініціалізовано');
            moduleErrors.error(error, 'Модуль не ініціалізовано', {
                category: ERROR_CATEGORIES.INIT
            });
            return Promise.reject(error);
        }

        // Перевіряємо з'єднання
        if (!state.isOnline) {
            const error = new Error('Пристрій офлайн');
            moduleErrors.warning(error, 'Неможливо виконати запит - пристрій офлайн', {
                category: ERROR_CATEGORIES.NETWORK
            });
            return Promise.reject(error);
        }

        // Налаштування запиту
        const requestOptions = {
            method: 'GET',
            data: null,
            timeout: config.requestTimeout,
            retries: config.maxRetries,
            retryDelay: config.retryDelay,
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
            },
            useCache: config.useResponseCaching,
            preventDuplicates: config.preventDuplicateRequests,
            ...options
        };

        // Формуємо URL і ключ для кешування
        const url = getApiUrl(endpoint);
        const requestKey = `${requestOptions.method}_${url}_${JSON.stringify(requestOptions.data || {})}`;
        const cacheKey = `${CACHE_KEYS.REQUEST_PREFIX}${requestKey.replace(/[^a-z0-9]/gi, '_')}`;

        // Перевіряємо кеш для GET запитів
        if (requestOptions.method === 'GET' && requestOptions.useCache) {
            const cachedData = cacheService.get(cacheKey);
            if (cachedData) {
                return cachedData;
            }
        }

        // Перевіряємо дублікати запитів
        if (requestOptions.preventDuplicates && state.pendingRequests.has(requestKey)) {
            const pending = state.pendingRequests.get(requestKey);
            if (Date.now() - pending.startTime < config.duplicateRequestsLockTime) {
                return pending.promise;
            }
            state.pendingRequests.delete(requestKey);
        }

        // Створюємо і зберігаємо проміс запиту
        const promise = executeRequest(endpoint, url, requestOptions, cacheKey);

        // Додаємо до списку очікуючих
        if (requestOptions.preventDuplicates) {
            state.pendingRequests.set(requestKey, {
                promise,
                startTime: Date.now()
            });

            // Видаляємо після завершення
            promise
                .then(() => state.pendingRequests.delete(requestKey))
                .catch(() => state.pendingRequests.delete(requestKey));
        }

        return promise;
    } catch (error) {
        moduleErrors.error(error, 'Критична помилка при створенні запиту', {
            category: ERROR_CATEGORIES.API
        });
        return Promise.reject(error);
    }
}

/**
 * Виконання запиту з повторними спробами
 * @param {string} endpoint - Ендпоінт
 * @param {string} url - Повний URL
 * @param {Object} options - Налаштування запиту
 * @param {string} cacheKey - Ключ для кешування
 * @returns {Promise<Object>} Результат запиту
 */
async function executeRequest(endpoint, url, options, cacheKey) {
    let attempt = 0;
    let lastError = null;
    let delayMs = options.retryDelay;

    while (attempt <= options.retries) {
        try {
            attempt++;

            // Налаштування запиту
            const fetchOptions = {
                method: options.method,
                headers: options.headers
            };

            // Додаємо тіло для POST/PUT
            if (options.data && (options.method === 'POST' || options.method === 'PUT')) {
                fetchOptions.body = JSON.stringify(prepareDateValues(options.data));
            }

            // Додаємо ID користувача в заголовок
            const userId = getUserId();
            if (userId) {
                fetchOptions.headers['X-User-Id'] = userId;
            }

            // Таймаут запиту
            const controller = new AbortController();
            fetchOptions.signal = controller.signal;
            const timeoutId = setTimeout(() => controller.abort(), options.timeout);

            // Виконуємо запит
            const response = await fetch(url, fetchOptions);
            clearTimeout(timeoutId);

            // Парсимо відповідь
            let data;
            const contentType = response.headers.get('content-type');

            if (contentType?.includes('application/json')) {
                data = await response.json();
                processISODates(data);
            } else {
                data = {
                    status: response.ok ? 'success' : 'error',
                    statusCode: response.status,
                    statusText: response.statusText,
                    data: await response.text()
                };
            }

            data.httpStatus = response.status;

            // Обробка успішної відповіді
            if (response.ok) {
                // Зберігаємо в кеш для GET
                if (options.method === 'GET' && options.useCache) {
                    // Визначаємо час життя кешу
                    let cacheTtl = config.responseCacheTime;

                    // Для критичних ендпоінтів знижуємо час життя
                    if (config.criticalEndpoints.some(critEndpoint =>
                        endpoint.includes(critEndpoint.replace('{userId}', getUserId() || ''))
                    )) {
                        cacheTtl = Math.min(cacheTtl, 60000); // Максимум 1 хвилина
                    }

                    cacheService.set(cacheKey, data, {
                        ttl: cacheTtl,
                        tags: [CACHE_TAGS.API, CACHE_TAGS.RESPONSE, `endpoint_${endpoint.split('/')[0]}`]
                    });
                }

                // Оновлюємо статистику
                updateRequestStats(endpoint, true);
                return data;
            } else {
                // Оновлюємо статистику помилок
                updateRequestStats(endpoint, false);

                // 4xx помилки (крім 429) не потребують повторних спроб
                if (response.status >= 400 && response.status < 500 && response.status !== 429) {
                    const error = new Error(data.message || response.statusText || 'Помилка API');
                    error.response = data;
                    error.status = response.status;

                    moduleErrors.error(error, `Помилка запиту (${response.status})`, {
                        category: ERROR_CATEGORIES.API,
                        details: { endpoint, status: response.status }
                    });

                    throw error;
                }

                // Інші помилки - продовжуємо спроби
                lastError = new Error(data.message || response.statusText || 'Помилка API');
                lastError.response = data;
                lastError.status = response.status;
            }
        } catch (error) {
            updateRequestStats(endpoint, false);
            lastError = error;

            // Перевіряємо тип помилки
            if (error.name === 'AbortError') {
                moduleErrors.warning(`Таймаут запиту до ${endpoint}`, 'executeRequest', {
                    category: ERROR_CATEGORIES.TIMEOUT
                });
                throw new Error('Таймаут запиту');
            }

            if (error.status && error.status >= 400 && error.status < 500 && error.status !== 429) {
                throw error;
            }

            moduleErrors.warning(`Помилка запиту до ${endpoint} (спроба ${attempt}/${options.retries + 1})`,
                'executeRequest', {
                category: ERROR_CATEGORIES.API
            });
        }

        // Якщо остання спроба - виходимо
        if (attempt > options.retries) {
            break;
        }

        // Затримка перед наступною спробою
        await new Promise(resolve => setTimeout(resolve, delayMs));
        delayMs *= 1.5;
    }

    // Всі спроби невдалі
    moduleErrors.error(lastError || new Error('Невідома помилка запиту'),
        `Вичерпано всі спроби запиту до ${endpoint}`, {
        category: ERROR_CATEGORIES.API
    });

    throw lastError || new Error('Помилка запиту API');
}

/**
 * Підготовка дат у даних
 * @param {Object} data - Дані для підготовки
 * @returns {Object} Підготовлені дані
 */
function prepareDateValues(data) {
    try {
        if (!data || typeof data !== 'object') return data;

        const prepared = Array.isArray(data) ? [...data] : {...data};

        for (const key in prepared) {
            if (prepared[key] instanceof Date) {
                prepared[key] = formatDateToUTC(prepared[key]);
            } else if (typeof prepared[key] === 'object' && prepared[key] !== null) {
                prepared[key] = prepareDateValues(prepared[key]);
            }
        }

        return prepared;
    } catch (error) {
        moduleErrors.error(error, 'Помилка підготовки дат', {
            category: ERROR_CATEGORIES.LOGIC
        });
        return data;
    }
}

/**
 * Оновлення статистики запитів
 * @param {string} endpoint - Ендпоінт
 * @param {boolean} success - Успішність запиту
 */
function updateRequestStats(endpoint, success) {
    try {
        if (!state.requestHistory[endpoint]) {
            state.requestHistory[endpoint] = { success: 0, failure: 0 };
        }

        if (success) {
            state.requestHistory[endpoint].success++;
        } else {
            state.requestHistory[endpoint].failure++;
        }

        // Оновлюємо кешовані дані статистики
        cacheService.set('api_stats', state.requestHistory, {
            tags: [CACHE_TAGS.API, 'stats']
        });
    } catch (error) {
        moduleErrors.warning(error, 'Помилка оновлення статистики', {
            category: ERROR_CATEGORIES.LOGIC
        });
    }
}

/**
 * Обробка ISO дат в об'єкті
 * @param {Object} obj - Об'єкт для обробки
 */
function processISODates(obj) {
    try {
        if (!obj || typeof obj !== 'object') return;

        const isoDateRegex = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:?\d{2})?$/;

        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                const value = obj[key];

                if (typeof value === 'string' && isoDateRegex.test(value)) {
                    obj[key] = parseISODate(value);
                } else if (value && typeof value === 'object') {
                    processISODates(value);
                }
            }
        }
    } catch (error) {
        moduleErrors.warning(error, 'Помилка обробки ISO дат', {
            category: ERROR_CATEGORIES.LOGIC
        });
    }
}

/**
 * Очищення кешу відповідей
 * @param {string} [endpoint] - Опціонально, ендпоінт для очищення
 * @returns {number} Кількість видалених записів
 */
function clearResponseCache(endpoint) {
    try {
        if (endpoint) {
            // Для конкретного ендпоінту
            return cacheService.removeMany(key =>
                key.startsWith(CACHE_KEYS.REQUEST_PREFIX) && key.includes(endpoint));
        } else {
            // Для всього кешу відповідей
            return cacheService.removeByTags(CACHE_TAGS.RESPONSE);
        }
    } catch (error) {
        moduleErrors.error(error, 'Помилка очищення кешу', {
            category: ERROR_CATEGORIES.LOGIC
        });
        return 0;
    }
}

/**
 * Отримання статистики запитів
 * @returns {Object} Статистика
 */
function getRequestStats() {
    try {
        const totalRequests = Object.values(state.requestHistory).reduce(
            (acc, curr) => {
                acc.success += curr.success;
                acc.failure += curr.failure;
                return acc;
            },
            { success: 0, failure: 0 }
        );

        const total = totalRequests.success + totalRequests.failure;

        // Отримуємо статистику кешу
        const cacheStats = cacheService.getStats();

        return {
            byEndpoint: state.requestHistory,
            total: totalRequests,
            successRate: total > 0 ? (totalRequests.success / total) * 100 : 0,
            cacheSize: cacheStats.totalItems,
            cacheByTags: cacheStats.tagStats,
            pendingRequests: state.pendingRequests.size
        };
    } catch (error) {
        moduleErrors.error(error, 'Помилка отримання статистики', {
            category: ERROR_CATEGORIES.LOGIC
        });
        return { error: true };
    }
}

/**
 * Оновлення конфігурації
 * @param {Object} newConfig - Нові налаштування
 * @returns {Object} Поточна конфігурація
 */
function updateConfig(newConfig) {
    try {
        if (!newConfig || typeof newConfig !== 'object') return {...config};

        Object.assign(config, newConfig);

        // Перезапускаємо перевірку при зміні інтервалу
        if ('checkInterval' in newConfig && isInitialized) {
            startPeriodicCheck();
        }

        return {...config};
    } catch (error) {
        moduleErrors.error(error, 'Помилка оновлення конфігурації', {
            category: ERROR_CATEGORIES.LOGIC
        });
        return {...config};
    }
}

/**
 * Повне очищення ресурсів модуля
 */
function destroy() {
    try {
        if (!isInitialized) return;

        // Очищення таймерів
        if (timers.periodicCheck) {
            clearInterval(timers.periodicCheck);
            timers.periodicCheck = null;
        }

        if (timers.cacheCleanup) {
            clearInterval(timers.cacheCleanup);
            timers.cacheCleanup = null;
        }

        // Видалення обробників подій
        if (typeof window !== 'undefined') {
            if (eventHandlers.online) {
                window.removeEventListener('online', eventHandlers.online);
                eventHandlers.online = null;
            }

            if (eventHandlers.offline) {
                window.removeEventListener('offline', eventHandlers.offline);
                eventHandlers.offline = null;
            }

            if (eventHandlers.domReady) {
                document.removeEventListener('DOMContentLoaded', eventHandlers.domReady);
                eventHandlers.domReady = null;
            }
        }

        // Очищення стану
        state.pendingRequests.clear();
        state.failedEndpoints = {};
        state.requestHistory = {};

        // Очищення кешу API
        cacheService.removeByTags(CACHE_TAGS.API);

        isInitialized = false;
    } catch (error) {
        moduleErrors.error(error, 'Помилка деактивації модуля', {
            category: ERROR_CATEGORIES.LOGIC
        });
    }
}

/**
 * Призупинення модуля
 */
function pause() {
    try {
        if (!isInitialized) return;

        if (timers.periodicCheck) {
            clearInterval(timers.periodicCheck);
            timers.periodicCheck = null;
        }

        if (timers.cacheCleanup) {
            clearInterval(timers.cacheCleanup);
            timers.cacheCleanup = null;
        }
    } catch (error) {
        moduleErrors.error(error, 'Помилка призупинення модуля', {
            category: ERROR_CATEGORIES.LOGIC
        });
    }
}

/**
 * Відновлення роботи модуля
 */
function resume() {
    try {
        if (!isInitialized) {
            moduleErrors.warning('Модуль не ініціалізовано', 'resume');
            return;
        }

        startPeriodicCheck();
        scheduleCleanup();
    } catch (error) {
        moduleErrors.error(error, 'Помилка відновлення модуля', {
            category: ERROR_CATEGORIES.LOGIC
        });
    }
}

// Одразу встановлюємо початковий стан з'єднання
state.isOnline = typeof navigator !== 'undefined' ? navigator.onLine : true;

// Створюємо обробник для автоматичної ініціалізації
eventHandlers.domReady = function() {
    if (!isInitialized) {
        init();
    }
};

// Додаємо автоматичну ініціалізацію при завантаженні документа
if (typeof document !== 'undefined') {
    document.addEventListener('DOMContentLoaded', eventHandlers.domReady);
}

// Публічний API
const APIConnectivity = {
    init,
    apiRequest,
    checkAPIAvailability,
    getConnectionState,
    resetFailureCounters,
    forceCheck,
    getUserId,
    clearResponseCache,
    getRequestStats,
    updateConfig,
    formatDateToUTC,
    parseISODate,
    isAPIAvailable: () => state.apiAvailable,
    isOnline: () => state.isOnline,
    destroy,
    pause,
    resume,
    isInitiated: () => isInitialized
};

// Експортуємо об'єкт
if (typeof window !== 'undefined') {
    window.APIConnectivity = APIConnectivity;
}

export default APIConnectivity;