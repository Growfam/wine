/**
 * API Core - базовий модуль для взаємодії з API сервером завдань
 *
 * Відповідає за:
 * - Базові функції для виконання запитів
 * - Визначення базового URL API
 * - Отримання ID користувача
 * - Конфігурація для API завдань
 *
 * @version 3.0.0
 */

// Базова конфігурація для API запитів завдань
export const CONFIG = {
    REQUEST_TIMEOUT: 15000,             // 15 секунд
    MAX_VERIFICATION_ATTEMPTS: 2,       // Кількість спроб
    RETRY_INTERVAL: 1000,               // Інтервал між спробами
    REQUEST_CACHE_TTL: 60000,           // Час життя кешу запитів (1 хвилина)
    API_PATHS: {
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
            VERIFICATION: (taskId) => `quests/tasks/${taskId}/verify`,
            PROGRESS: (taskId) => `quests/tasks/${taskId}/progress`
        },
        // Прогрес користувача
        USER_PROGRESS: (userId) => `user/${userId}/progress`,
        // Статус завдання користувача
        USER_TASK_STATUS: (userId, taskId) => `user/${userId}/tasks/${taskId}/status`,
    }
};

/**
 * Базовий клас для роботи з API завдань
 */
export class ApiCore {
    constructor() {
        this.baseUrl = this.detectBaseUrl();
        this.defaultRequestOptions = {
            timeout: CONFIG.REQUEST_TIMEOUT,
            maxRetries: CONFIG.MAX_VERIFICATION_ATTEMPTS,
            retryDelay: CONFIG.RETRY_INTERVAL
        };

        // Кеш запитів
        this.cache = new Map();
        this.cacheTimestamps = new Map();
    }

    /**
     * Визначення базового URL API
     * @returns {string} Базовий URL API
     */
    detectBaseUrl() {
        try {
            if (typeof window !== 'undefined') {
                // Спочатку перевіряємо WinixAPI
                if (window.WinixAPI && window.WinixAPI.config && window.WinixAPI.config.baseUrl) {
                    return window.WinixAPI.config.baseUrl.replace(/\/$/, '');
                }

                // Альтернативно визначаємо за поточним хостом
                const hostname = window.location.hostname;

                if (hostname === 'localhost' || hostname === '127.0.0.1') {
                    return `http://${hostname}:8080`;
                } else if (hostname.includes('testenv') || hostname.includes('staging')) {
                    return `https://${hostname}`;
                } else {
                    return 'https://winixbot.com';
                }

                // За замовчуванням використовуємо поточний origin
                return window.location.origin;
            }
            return '';
        } catch (error) {
            console.error('Помилка визначення базового URL:', error);
            return '';
        }
    }

    /**
     * Отримання ID користувача
     * @returns {string|null} ID користувача
     */
    getUserId() {
        try {
            if (typeof window === 'undefined') return null;

            // Спочатку перевіряємо глобальну функцію
            if (typeof window.getUserId === 'function') {
                const id = window.getUserId();
                if (this.isValidId(id)) return id;
            }

            // Перевіряємо WinixAPI
            if (window.WinixAPI && typeof window.WinixAPI.getUserId === 'function') {
                const id = window.WinixAPI.getUserId();
                if (this.isValidId(id)) return id;
            }

            // Перевіряємо localStorage
            if (window.localStorage) {
                const id = window.localStorage.getItem('telegram_user_id');
                if (this.isValidId(id)) return id;
            }

            // Перевіряємо URL параметри
            const urlParams = new URLSearchParams(window.location.search);
            const urlId = urlParams.get('id') || urlParams.get('user_id') || urlParams.get('telegram_id');
            if (this.isValidId(urlId)) return urlId;

            console.warn('ID користувача не знайдено');
            return null;
        } catch (error) {
            console.error('Помилка отримання ID користувача:', error);
            return null;
        }
    }

    /**
     * Перевірка валідності ID
     * @param {string} id - ID для перевірки
     * @returns {boolean} Результат перевірки
     */
    isValidId(id) {
        return id &&
               id !== 'undefined' &&
               id !== 'null' &&
               id !== undefined &&
               id !== null &&
               typeof id !== 'function' &&
               id.toString().trim() !== '';
    }

    /**
     * Виконання запиту з кешуванням та повторними спробами
     * @param {string} endpoint - Ендпоінт API
     * @param {Object} options - Опції запиту
     * @returns {Promise<Object>} Результат запиту
     */
    async request(endpoint, options = {}) {
        const requestOptions = {
            ...this.defaultRequestOptions,
            ...options,
            method: options.method || 'GET'
        };

        // Визначаємо URL
        const url = endpoint.startsWith('http') ? endpoint : `${this.baseUrl}/${endpoint.replace(/^\//, '')}`;

        // Унікальний ключ запиту для кешування
        const cacheKey = `${requestOptions.method}_${url}_${JSON.stringify(options.data || {})}`;

        // Перевіряємо кеш для GET запитів
        if (requestOptions.method === 'GET' && requestOptions.useCache !== false) {
            const cachedData = this.getCachedData(cacheKey);
            if (cachedData) return cachedData;
        }

        let attempt = 0;
        let lastError = null;

        while (attempt <= requestOptions.maxRetries) {
            try {
                attempt++;

                // Підготовка параметрів запиту
                const fetchOptions = {
                    method: requestOptions.method,
                    headers: {
                        'Content-Type': 'application/json',
                        'Accept': 'application/json',
                        ...requestOptions.headers
                    }
                };

                // Додаємо ID користувача в заголовок
                const userId = this.getUserId();
                if (userId) {
                    fetchOptions.headers['X-User-Id'] = userId;
                }

                // Додаємо тіло запиту для POST/PUT/PATCH
                if (options.data && ['POST', 'PUT', 'PATCH'].includes(requestOptions.method)) {
                    fetchOptions.body = JSON.stringify(options.data);
                }

                // Виконуємо запит з таймаутом
                const controller = new AbortController();
                fetchOptions.signal = controller.signal;
                const timeoutId = setTimeout(() => controller.abort(), requestOptions.timeout);

                const response = await fetch(url, fetchOptions);
                clearTimeout(timeoutId);

                let responseData;
                try {
                    responseData = await response.json();
                } catch (e) {
                    responseData = {
                        status: response.ok ? 'success' : 'error',
                        message: response.statusText || 'Помилка парсингу відповіді'
                    };
                }

                // Додаємо HTTP статус
                responseData.httpStatus = response.status;

                if (response.ok) {
                    // Кешуємо результат для GET запитів
                    if (requestOptions.method === 'GET' && requestOptions.useCache !== false) {
                        this.cacheData(cacheKey, responseData);
                    }
                    return responseData;
                }

                // 4xx помилки (крім 429 - rate limit) не потребують повторних спроб
                if (response.status >= 400 && response.status < 500 && response.status !== 429) {
                    throw new Error(responseData.message || 'Помилка запиту');
                }

                lastError = new Error(responseData.message || 'Помилка запиту');
                lastError.response = responseData;
            } catch (error) {
                lastError = error;

                // Якщо це помилка таймауту, логуємо та продовжуємо спроби
                if (error.name === 'AbortError') {
                    console.warn(`Таймаут запиту до ${endpoint} (спроба ${attempt}/${requestOptions.maxRetries + 1})`);
                    continue;
                }

                // Якщо це клієнтська помилка, припиняємо спроби
                if (error.response && error.response.httpStatus >= 400 && error.response.httpStatus < 500) {
                    break;
                }

                console.warn(`Помилка запиту до ${endpoint} (спроба ${attempt}/${requestOptions.maxRetries + 1}):`, error.message);
            }

            // Остання спроба - виходимо
            if (attempt > requestOptions.maxRetries) break;

            // Затримка перед наступною спробою
            await new Promise(resolve => setTimeout(resolve, requestOptions.retryDelay * Math.pow(1.5, attempt - 1)));
        }

        // Всі спроби вичерпано
        console.error(`Не вдалося виконати запит до ${endpoint} після ${attempt} спроб`);
        return {
            status: 'error',
            message: lastError?.message || 'Не вдалося виконати запит до сервера',
            httpStatus: lastError?.response?.httpStatus || 0
        };
    }

    /**
     * Отримання даних з кешу
     * @param {string} key - Ключ кешу
     * @returns {Object|null} Кешовані дані або null
     */
    getCachedData(key) {
        // Перевіряємо наявність даних та їх актуальність
        if (this.cache.has(key) && this.cacheTimestamps.has(key)) {
            const timestamp = this.cacheTimestamps.get(key);
            // Перевіряємо, чи не застарів кеш
            if (Date.now() - timestamp < CONFIG.REQUEST_CACHE_TTL) {
                return this.cache.get(key);
            }
        }
        return null;
    }

    /**
     * Збереження даних у кеш
     * @param {string} key - Ключ кешу
     * @param {Object} data - Дані для кешування
     */
    cacheData(key, data) {
        this.cache.set(key, data);
        this.cacheTimestamps.set(key, Date.now());

        // Обмежуємо розмір кешу
        if (this.cache.size > 100) {
            // Знаходимо найстаріший ключ
            let oldestKey = null;
            let oldestTime = Date.now();

            for (const [k, time] of this.cacheTimestamps.entries()) {
                if (time < oldestTime) {
                    oldestTime = time;
                    oldestKey = k;
                }
            }

            // Видаляємо найстаріший запис
            if (oldestKey) {
                this.cache.delete(oldestKey);
                this.cacheTimestamps.delete(oldestKey);
            }
        }
    }

    /**
     * Очищення кешу
     * @param {string} [keyPattern] - Опціональний патерн ключа для вибіркового очищення
     */
    clearCache(keyPattern) {
        if (keyPattern) {
            // Очищаємо вибірково за патерном
            for (const key of this.cache.keys()) {
                if (key.includes(keyPattern)) {
                    this.cache.delete(key);
                    this.cacheTimestamps.delete(key);
                }
            }
        } else {
            // Очищаємо весь кеш
            this.cache.clear();
            this.cacheTimestamps.clear();
        }
    }

    /**
     * Обгортка для HTTP GET запиту
     * @param {string} endpoint - Ендпоінт API
     * @param {Object} options - Опції запиту
     * @returns {Promise<Object>} Результат запиту
     */
    async get(endpoint, options = {}) {
        return this.request(endpoint, {
            ...options,
            method: 'GET'
        });
    }

    /**
     * Обгортка для HTTP POST запиту
     * @param {string} endpoint - Ендпоінт API
     * @param {Object} data - Дані для відправки
     * @param {Object} options - Опції запиту
     * @returns {Promise<Object>} Результат запиту
     */
    async post(endpoint, data, options = {}) {
        return this.request(endpoint, {
            ...options,
            method: 'POST',
            data
        });
    }
}

// Експортуємо готовий екземпляр для використання
export default new ApiCore();