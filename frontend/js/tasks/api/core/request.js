/**
 * Сервіс для виконання HTTP запитів
 *
 * Відповідає за:
 * - Виконання HTTP запитів до API
 * - Обробку спроб повторного з'єднання
 * - Обробку помилок та таймаутів
 * - Інтеграцію з кешуванням
 *
 * @version 3.1.0
 */

import { CONFIG, API_ERROR_CODES } from './config.js';
import cacheService from './cache.js';

/**
 * Клас для виконання запитів до API
 */
export class RequestService {
    constructor() {
        this.baseUrl = this.detectBaseUrl();
        this.defaultRequestOptions = {
            timeout: CONFIG.REQUEST_TIMEOUT,
            maxRetries: CONFIG.MAX_VERIFICATION_ATTEMPTS,
            retryDelay: CONFIG.RETRY_INTERVAL
        };
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
        const cacheKey = cacheService.generateCacheKey(
            requestOptions.method,
            url,
            options.data || {}
        );

        // Перевіряємо кеш для GET запитів
        if (requestOptions.method === 'GET' && requestOptions.useCache !== false) {
            const cachedData = cacheService.getCachedData(cacheKey);
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
                        cacheService.cacheData(cacheKey, responseData);
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
            httpStatus: lastError?.response?.httpStatus || 0,
            errorCode: lastError?.name === 'AbortError' ? API_ERROR_CODES.TIMEOUT : API_ERROR_CODES.NETWORK_ERROR
        };
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

    /**
     * Обгортка для HTTP PUT запиту
     * @param {string} endpoint - Ендпоінт API
     * @param {Object} data - Дані для відправки
     * @param {Object} options - Опції запиту
     * @returns {Promise<Object>} Результат запиту
     */
    async put(endpoint, data, options = {}) {
        return this.request(endpoint, {
            ...options,
            method: 'PUT',
            data
        });
    }

    /**
     * Обгортка для HTTP DELETE запиту
     * @param {string} endpoint - Ендпоінт API
     * @param {Object} options - Опції запиту
     * @returns {Promise<Object>} Результат запиту
     */
    async delete(endpoint, options = {}) {
        return this.request(endpoint, {
            ...options,
            method: 'DELETE'
        });
    }
}

// Експортуємо єдиний екземпляр сервісу
export default new RequestService();