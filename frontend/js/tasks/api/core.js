/**
 * API Core - базовий модуль для взаємодії з API сервером
 *
 * Відповідає за:
 * - Базові функції для виконання запитів
 * - Визначення базового URL API
 * - Отримання ID користувача
 */

import errorHandler, { ERROR_LEVELS, ERROR_CATEGORIES } from '../utils/Logger.js';

// Створюємо обробник помилок для модуля
const moduleErrors = errorHandler.createModuleHandler('ApiCore');

// Базова конфігурація для API запитів
export const CONFIG = {
  REQUEST_TIMEOUT: 15000,             // 15 секунд
  MAX_VERIFICATION_ATTEMPTS: 2,       // Кількість спроб
  RETRY_INTERVAL: 1000,               // Інтервал між спробами
  API_PATHS: {}                       // Буде заповнено з config/task-types.js
};

/**
 * Базовий клас для API запитів
 */
export class ApiCore {
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
        if (window.WinixAPI && window.WinixAPI.config && window.WinixAPI.config.baseUrl) {
          return window.WinixAPI.config.baseUrl.replace(/\/$/, '');
        }
        return window.location.origin;
      }
      return '';
    } catch (error) {
      moduleErrors.error(error, 'Помилка визначення базового URL', {
        category: ERROR_CATEGORIES.INIT
      });
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
   * Виконання запиту з повторними спробами
   * @param {string} url - URL запиту
   * @param {Object} options - Опції запиту
   * @returns {Promise<Object>} Результат запиту
   */
  async fetchWithRetry(url, options = {}) {
    const requestOptions = {
      ...this.defaultRequestOptions,
      ...options
    };

    let attempt = 0;
    let lastError = null;
    let delayMs = requestOptions.retryDelay;

    // Формуємо повний URL
    const fullUrl = url.startsWith('http') ? url : `${this.baseUrl}/${url.replace(/^\//, '')}`;

    // Додаємо заголовки
    if (!requestOptions.headers) {
      requestOptions.headers = {};
    }

    if (!requestOptions.headers['Content-Type']) {
      requestOptions.headers['Content-Type'] = 'application/json';
    }

    // Додаємо ID користувача
    const userId = this.getUserId();
    if (userId) {
      requestOptions.headers['X-User-Id'] = userId;
    }

    // Спроби запиту
    while (attempt <= requestOptions.maxRetries) {
      try {
        attempt++;

        // Додаємо обробку таймауту
        const controller = new AbortController();
        const signal = controller.signal;
        const timeoutId = setTimeout(() => controller.abort(), requestOptions.timeout);

        const response = await fetch(fullUrl, {
          ...requestOptions,
          signal
        });

        // Очищаємо таймер
        clearTimeout(timeoutId);

        // Парсимо відповідь
        let data;
        try {
          data = await response.json();
        } catch (jsonError) {
          data = {
            status: response.ok ? 'success' : 'error',
            message: response.statusText
          };
        }

        // Додаємо HTTP статус
        data.httpStatus = response.status;

        if (response.ok) {
          return data;
        } else {
          // 4xx помилки (крім 429) не потребують повторних спроб
          if (response.status >= 400 && response.status < 500 && response.status !== 429) {
            throw new Error(data.message || response.statusText || 'Помилка API');
          }

          // Інші помилки - повторюємо спроби
          lastError = new Error(data.message || response.statusText || 'Помилка API');
        }
      } catch (error) {
        lastError = error;

        // Перевіряємо на AbortError (таймаут)
        if (error.name === 'AbortError') {
          moduleErrors.warning(`Таймаут запиту до ${url}`, 'fetchWithRetry', {
            category: ERROR_CATEGORIES.TIMEOUT
          });
        } else {
          moduleErrors.warning(`Помилка запиту до ${url} (спроба ${attempt}/${requestOptions.maxRetries + 1})`, 'fetchWithRetry', {
            category: ERROR_CATEGORIES.API
          });
        }
      }

      // Якщо це остання спроба, виходимо з циклу
      if (attempt > requestOptions.maxRetries) {
        break;
      }

      // Затримка перед наступною спробою
      await new Promise(resolve => setTimeout(resolve, delayMs));
      delayMs *= 1.5; // Збільшуємо затримку для наступної спроби
    }

    // Всі спроби невдалі
    moduleErrors.error(lastError, `Вичерпано всі спроби запиту до ${url}`, {
      category: ERROR_CATEGORIES.API
    });

    return {
      status: 'error',
      message: lastError?.message || 'Не вдалося виконати запит до сервера',
      error: lastError
    };
  }
}

export default new ApiCore();