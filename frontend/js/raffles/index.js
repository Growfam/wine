/**
 * index.js - Головний інтеграційний модуль для всіх функцій розіграшів
 * Використовує модульну архітектуру з мінімальною зв'язністю між компонентами
 * Версія: 1.1.0
 */

import WinixRaffles from './globals.js';

/**
 * Константи для налаштування системи
 */
const CONFIG = Object.freeze({
  // Таймаути (мс)
  TIMEOUTS: {
    INITIALIZATION: 10000,     // Максимальний час очікування ініціалізації модуля
    RETRY_DELAY: 2000,         // Затримка перед повторною спробою
    DEPENDENCIES_CHECK: 500,   // Інтервал перевірки залежностей
  },
  // Кількість спроб
  MAX_RETRIES: 3,
  // Налаштування API
  API: {
    BASE_URL: '/api',
    MIN_REQUEST_INTERVAL: 300, // Мінімальний інтервал між запитами (мс)
    TIMEOUT: 30000,            // Таймаут запиту (30 секунд)
    CACHE_TTL: 300000,         // Час життя кешу (5 хвилин)
  },
  // Режим відлагодження
  DEBUG: false,
});

/**
 * Утиліти для перевірки середовища та додаткових функцій
 */
const Utils = {
  /**
   * Перевірка підтримки необхідних API у браузері
   * @returns {Object} Об'єкт з результатами перевірки
   */
  checkBrowserSupport() {
    const support = {
      fetch: typeof fetch !== 'undefined',
      promise: typeof Promise !== 'undefined',
      localStorage: (() => {
        try {
          localStorage.setItem('test', 'test');
          localStorage.removeItem('test');
          return true;
        } catch (e) {
          return false;
        }
      })(),
      sessionStorage: (() => {
        try {
          sessionStorage.setItem('test', 'test');
          sessionStorage.removeItem('test');
          return true;
        } catch (e) {
          return false;
        }
      })(),
      async: typeof async function() {} !== 'undefined',
      webCrypto: typeof window.crypto !== 'undefined' && typeof window.crypto.getRandomValues !== 'undefined',
    };

    support.compatible = support.fetch && support.promise && support.localStorage;

    return support;
  },

  /**
   * Генерація унікального ідентифікатора
   * @returns {string} Унікальний ідентифікатор
   */
  generateUniqueId() {
    // Використовуємо WebCrypto, якщо доступно, інакше - простий підхід з Date
    if (window.crypto && window.crypto.getRandomValues) {
      const buffer = new Uint32Array(4);
      window.crypto.getRandomValues(buffer);
      return Array.from(buffer).map(num => num.toString(16)).join('-');
    } else {
      return 'id-' + Date.now() + '-' + Math.random().toString(36).substr(2, 9);
    }
  },

  /**
   * Безпечне виконання функції з обробкою помилок
   * @param {Function} fn - Функція для виконання
   * @param {any} defaultValue - Значення за замовчуванням у випадку помилки
   * @param {string} errorContext - Контекст помилки для логування
   * @returns {any} Результат виконання або значення за замовчуванням
   */
  safeExecute(fn, defaultValue = null, errorContext = 'Невідомий контекст') {
    try {
      return fn();
    } catch (error) {
      console.error(`Помилка у контексті "${errorContext}":`, error);
      return defaultValue;
    }
  },

  /**
   * Затримка виконання на вказаний час
   * @param {number} ms - Час затримки у мілісекундах
   * @returns {Promise<void>} Проміс, який резолвиться після затримки
   */
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  /**
   * Форматування дати у зручний для відображення формат
   * @param {Date|string|number} date - Дата для форматування
   * @param {boolean} includeTime - Включити час у форматування
   * @returns {string} Відформатована дата
   */
  formatDate(date, includeTime = true) {
    try {
      const dateObj = date instanceof Date ? date : new Date(date);

      if (isNaN(dateObj.getTime())) {
        return 'Невідома дата';
      }

      const day = String(dateObj.getDate()).padStart(2, '0');
      const month = String(dateObj.getMonth() + 1).padStart(2, '0');
      const year = dateObj.getFullYear();

      if (!includeTime) {
        return `${day}.${month}.${year}`;
      }

      const hours = String(dateObj.getHours()).padStart(2, '0');
      const minutes = String(dateObj.getMinutes()).padStart(2, '0');

      return `${day}.${month}.${year} ${hours}:${minutes}`;
    } catch (error) {
      console.error('Помилка форматування дати:', error);
      return 'Невідома дата';
    }
  },

  /**
   * Безпечне отримання даних з localStorage з обробкою помилок
   * @param {string} key - Ключ для отримання даних
   * @param {any} defaultValue - Значення за замовчуванням
   * @returns {any} Отримані дані або значення за замовчуванням
   */
  getFromStorage(key, defaultValue = null) {
    try {
      const value = localStorage.getItem(key);
      if (value === null) return defaultValue;

      try {
        // Спроба розпарсити як JSON
        return JSON.parse(value);
      } catch {
        // Якщо не JSON, повертаємо як є
        return value;
      }
    } catch (error) {
      console.warn(`Помилка при доступі до localStorage для ключа ${key}:`, error);
      return defaultValue;
    }
  },

  /**
   * Безпечне збереження даних у localStorage з обробкою помилок
   * @param {string} key - Ключ для збереження
   * @param {any} value - Значення для збереження
   * @returns {boolean} Успішність операції
   */
  saveToStorage(key, value) {
    try {
      const valueToStore = typeof value === 'object' ? JSON.stringify(value) : value;
      localStorage.setItem(key, valueToStore);
      return true;
    } catch (error) {
      console.warn(`Помилка при збереженні в localStorage для ключа ${key}:`, error);
      return false;
    }
  },

  /**
   * Отримує інформацію про користувача з різних джерел (Telegram, localStorage)
   * @returns {Object} Інформація про користувача
   */
  getUserInfo() {
    const userInfo = {
      id: null,
      firstName: null,
      lastName: null,
      username: null,
      source: 'unknown'
    };

    // Спроба отримати з Telegram WebApp
    if (window.Telegram && window.Telegram.WebApp && window.Telegram.WebApp.initDataUnsafe) {
      const tgUser = window.Telegram.WebApp.initDataUnsafe.user;
      if (tgUser) {
        userInfo.id = tgUser.id.toString();
        userInfo.firstName = tgUser.first_name || null;
        userInfo.lastName = tgUser.last_name || null;
        userInfo.username = tgUser.username || null;
        userInfo.source = 'telegram';
        return userInfo;
      }
    }

    // Спроба отримати з localStorage
    userInfo.id = this.getFromStorage('telegram_user_id', null);
    userInfo.firstName = this.getFromStorage('user_first_name', null);
    userInfo.source = userInfo.id ? 'localStorage' : 'unknown';

    return userInfo;
  }
};

/**
 * Розширена служба API для роботи з бекендом
 * Включає кешування, перевірку стану мережі та повторні спроби
 */
const ApiService = {
  _baseUrl: CONFIG.API.BASE_URL,
  _requestTimeout: CONFIG.API.TIMEOUT,
  _lastRequestTime: 0,
  _minRequestInterval: CONFIG.API.MIN_REQUEST_INTERVAL,
  _pendingRequests: new Map(),
  _retryQueue: [],
  _online: true,
  _processingRetries: false,

  /**
   * Ініціалізація API сервісу
   */
  init: function() {
    this._baseUrl = WinixRaffles.config.apiBaseUrl || CONFIG.API.BASE_URL;
    this._setupEventListeners();

    // Перевіряємо стан мережі
    this._online = WinixRaffles.network.isOnline();

    return this;
  },

  /**
   * Налаштування слухачів подій
   * @private
   */
  _setupEventListeners: function() {
    // Відстежуємо зміни стану мережі
    WinixRaffles.events.on('network-status-changed', (data) => {
      this._online = data.online;

      if (data.online) {
        WinixRaffles.logger.log('API Service: З\'єднання відновлено, обробка відкладених запитів...');
        this._processRetryQueue();
      } else {
        WinixRaffles.logger.warn('API Service: З\'єднання втрачено, запити будуть відкладені');
      }
    });

    // Обробляємо події онлайн/офлайн від браузера як додатковий рівень захисту
    window.addEventListener('online', () => {
      if (!this._online) {
        this._online = true;
        WinixRaffles.events.emit('network-status-changed', { online: true, forced: false });
      }
    });

    window.addEventListener('offline', () => {
      if (this._online) {
        this._online = false;
        WinixRaffles.events.emit('network-status-changed', { online: false, forced: false });
      }
    });
  },

  /**
   * Обробка черги відкладених запитів
   * @private
   */
  _processRetryQueue: async function() {
    if (this._processingRetries || this._retryQueue.length === 0 || !this._online) {
      return;
    }

    this._processingRetries = true;
    WinixRaffles.logger.log(`API Service: Обробка ${this._retryQueue.length} відкладених запитів`);

    while (this._retryQueue.length > 0 && this._online) {
      const request = this._retryQueue.shift();

      try {
        WinixRaffles.logger.debug('API Service: Повторна спроба запиту до ' + request.endpoint);
        const result = await this.request(
          request.endpoint,
          request.options,
          request.loaderId
        );

        if (request.resolve) {
          request.resolve(result);
        }
      } catch (error) {
        WinixRaffles.logger.error('API Service: Помилка повторної спроби запиту:', error);

        if (request.reject) {
          request.reject(error);
        }
      }

      // Невелика затримка між запитами для уникнення перевантаження
      await Utils.delay(300);
    }

    this._processingRetries = false;
  },

  /**
   * Генерація унікального ідентифікатора запиту
   * @returns {string} Унікальний ідентифікатор
   * @private
   */
  _generateRequestId: function() {
    return Utils.generateUniqueId();
  },

  /**
   * Скасування запиту за його ідентифікатором
   * @param {string} requestId - Ідентифікатор запиту для скасування
   * @returns {boolean} Результат скасування
   */
  cancelRequest: function(requestId) {
    if (!this._pendingRequests.has(requestId)) {
      return false;
    }

    const request = this._pendingRequests.get(requestId);
    if (request.controller) {
      request.controller.abort();
    }

    this._pendingRequests.delete(requestId);
    return true;
  },

  /**
   * Базова функція для HTTP запитів з розширеними можливостями
   * @param {string} endpoint - Кінцева точка API
   * @param {Object} options - Опції запиту
   * @param {string} loaderId - Ідентифікатор для лоадера
   * @param {Object} retryOptions - Опції для повторних спроб
   * @returns {Promise<any>} Результат запиту
   */
  async request(endpoint, options = {}, loaderId = null, retryOptions = { retries: 2, delay: 1000 }) {
    // Створюємо унікальний ідентифікатор для цього запиту
    const requestId = this._generateRequestId();

    // Перевіряємо наявність мережевого з'єднання
    if (!this._online) {
      WinixRaffles.logger.warn(`API Service: Немає з'єднання, запит до ${endpoint} відкладено`);

      // Додаємо запит до черги на повторення
      return new Promise((resolve, reject) => {
        this._retryQueue.push({
          endpoint,
          options,
          loaderId,
          resolve,
          reject,
          timestamp: Date.now()
        });
      });
    }

    // Обмежуємо частоту запитів
    const now = Date.now();
    const timeSinceLastRequest = now - this._lastRequestTime;

    if (timeSinceLastRequest < this._minRequestInterval) {
      const waitTime = this._minRequestInterval - timeSinceLastRequest;
      WinixRaffles.logger.debug(`API Service: Затримка запиту на ${waitTime}мс`);
      await Utils.delay(waitTime);
    }

    this._lastRequestTime = Date.now();

    // Показуємо індикатор завантаження, якщо вказано loaderId
    if (loaderId) {
      WinixRaffles.loader.show('Завантаження даних...', loaderId);
    }

    // Створюємо контролер для можливості скасування запиту
    const controller = new AbortController();
    let timeoutId = null;

    // Зберігаємо інформацію про запит
    this._pendingRequests.set(requestId, {
      endpoint,
      controller,
      timestamp: Date.now()
    });

    try {
      // Встановлюємо таймаут для запиту
      timeoutId = setTimeout(() => controller.abort(), this._requestTimeout);

      const url = `${this._baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

      const defaultOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json',
          'X-Request-ID': requestId
        },
        signal: controller.signal
      };

      // Об'єднуємо опції користувача з дефолтними
      const requestOptions = {
        ...defaultOptions,
        ...options,
        headers: {
          ...defaultOptions.headers,
          ...(options.headers || {})
        }
      };

      // Перетворюємо тіло запиту в JSON, якщо це об'єкт
      if (requestOptions.body && typeof requestOptions.body === 'object') {
        requestOptions.body = JSON.stringify(requestOptions.body);
      }

      // Додаємо заголовки для кешування на стороні браузера
      if (options.method === 'GET' && options.cache !== 'no-store') {
        requestOptions.headers['Cache-Control'] = 'max-age=60';
      }

      // Виконуємо запит
      const response = await fetch(url, requestOptions);

      // Видаляємо запит з відстежуваних
      this._pendingRequests.delete(requestId);

      // Очищаємо таймаут, оскільки запит завершено
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }

      // Перевіряємо статус відповіді
      if (!response.ok) {
        // Намагаємось отримати детальну інформацію про помилку
        let errorData;
        try {
          errorData = await response.json();
        } catch (e) {
          errorData = { message: response.statusText };
        }

        const error = {
          status: response.status,
          message: errorData.message || response.statusText,
          data: errorData,
          requestId
        };

        // Якщо сервер недоступний і є спроби для повторення
        if ((response.status >= 500 || response.status === 0) && retryOptions.retries > 0) {
          WinixRaffles.logger.warn(`API Service: Помилка сервера (${response.status}), повторна спроба через ${retryOptions.delay}мс`);

          await Utils.delay(retryOptions.delay);

          return this.request(
            endpoint,
            options,
            loaderId,
            {
              retries: retryOptions.retries - 1,
              delay: retryOptions.delay * 1.5
            }
          );
        }

        throw error;
      }

      // Перевіряємо, чи є вміст у відповіді
      const contentType = response.headers.get('content-type');
      let result;

      if (contentType && contentType.includes('application/json')) {
        result = await response.json();
      } else {
        result = await response.text();
      }

      // Створюємо подію про успішний запит
      WinixRaffles.events.emit('api-request-success', {
        endpoint,
        requestId,
        timestamp: Date.now()
      });

      return result;
    } catch (error) {
      // Видаляємо запит з відстежуваних
      this._pendingRequests.delete(requestId);

      // Перевіряємо, чи помилка пов'язана з таймаутом або скасуванням
      if (error.name === 'AbortError') {
        const customError = new Error('Запит перервано через таймаут або скасування');
        customError.code = 'REQUEST_ABORTED';
        customError.requestId = requestId;
        throw customError;
      }

      // Якщо це помилка мережі і є спроби для повторення
      if ((error instanceof TypeError || error.message === 'Failed to fetch') && retryOptions.retries > 0) {
        WinixRaffles.logger.warn(`API Service: Помилка мережі, повторна спроба через ${retryOptions.delay}мс`);

        // Затримка перед повторною спробою
        await Utils.delay(retryOptions.delay);

        return this.request(
          endpoint,
          options,
          loaderId,
          {
            retries: retryOptions.retries - 1,
            delay: retryOptions.delay * 1.5
          }
        );
      }

      // Логуємо помилку і перекидаємо далі
      WinixRaffles.logger.error(`API Service: Помилка запиту до ${endpoint}:`, error);

      // Створюємо подію про невдалий запит
      WinixRaffles.events.emit('api-request-error', {
        endpoint,
        requestId,
        error: error.message,
        timestamp: Date.now()
      });

      throw error;
    } finally {
      // Завжди приховуємо індикатор завантаження
      if (loaderId) {
        WinixRaffles.loader.hide(loaderId);
      }

      // Очищаємо таймаут, якщо він ще активний
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    }
  },

  /**
   * Виконання GET запиту з оптимізованим кешуванням
   * @param {string} endpoint - Кінцева точка API
   * @param {Object} params - Параметри запиту
   * @param {string} loaderId - Ідентифікатор для лоадера
   * @param {Object} options - Додаткові опції запиту
   * @returns {Promise<any>} Результат запиту
   */
  async get(endpoint, params = {}, loaderId = null, options = {}) {
    // Формуємо ключ кешу на основі URL та параметрів
    const cacheKey = `api:${endpoint}:${JSON.stringify(params)}`;

    // Перевіряємо кеш, якщо не вказано force і дозволено кешування
    if (!options.force && options.useCache !== false) {
      const cachedData = WinixRaffles.cache.get(cacheKey);
      if (cachedData) {
        return cachedData;
      }
    }

    // Додаємо параметри запиту до URL
    const url = new URL(endpoint, window.location.origin);
    Object.keys(params).forEach(key => {
      url.searchParams.append(key, params[key]);
    });

    try {
      const result = await this.request(
        url.pathname + url.search,
        { method: 'GET', ...options },
        loaderId
      );

      // Зберігаємо результат у кеш, якщо потрібно
      if (options.useCache !== false) {
        const ttl = options.cacheTTL || CONFIG.API.CACHE_TTL;
        WinixRaffles.cache.set(cacheKey, result, ttl);
      }

      return result;
    } catch (error) {
      // Для некритичного контенту повертаємо кешовані дані, якщо вони є,
      // навіть якщо запит не вдався і була вказана опція force
      if (options.fallbackToCache && options.force) {
        const cachedData = WinixRaffles.cache.get(cacheKey);
        if (cachedData) {
          WinixRaffles.logger.warn(`API Service: Використовуємо кешовані дані для ${endpoint} через помилку запиту`);
          return cachedData;
        }
      }

      throw error;
    }
  },

  /**
   * Виконання POST запиту
   * @param {string} endpoint - Кінцева точка API
   * @param {Object} data - Дані для відправлення
   * @param {string} loaderId - Ідентифікатор для лоадера
   * @param {Object} options - Додаткові опції запиту
   * @returns {Promise<any>} Результат запиту
   */
  async post(endpoint, data = {}, loaderId = null, options = {}) {
    return this.request(endpoint, {
      method: 'POST',
      body: data,
      ...options
    }, loaderId);
  },

  /**
   * Виконання PUT запиту
   * @param {string} endpoint - Кінцева точка API
   * @param {Object} data - Дані для відправлення
   * @param {string} loaderId - Ідентифікатор для лоадера
   * @param {Object} options - Додаткові опції запиту
   * @returns {Promise<any>} Результат запиту
   */
  async put(endpoint, data = {}, loaderId = null, options = {}) {
    return this.request(endpoint, {
      method: 'PUT',
      body: data,
      ...options
    }, loaderId);
  },

  /**
   * Виконання DELETE запиту
   * @param {string} endpoint - Кінцева точка API
   * @param {Object} data - Опціональні дані для відправлення
   * @param {string} loaderId - Ідентифікатор для лоадера
   * @param {Object} options - Додаткові опції запиту
   * @returns {Promise<any>} Результат запиту
   */
  async delete(endpoint, data = null, loaderId = null, options = {}) {
    const requestOptions = {
      method: 'DELETE',
      ...options
    };

    if (data) {
      requestOptions.body = data;
    }

    return this.request(endpoint, requestOptions, loaderId);
  },

  /**
   * Пакетне виконання запитів
   * @param {Array<Object>} requests - Масив об'єктів запитів
   * @param {string} loaderId - Ідентифікатор для лоадера
   * @returns {Promise<Array<any>>} Масив результатів запитів
   */
  async batch(requests, loaderId = null) {
    if (!Array.isArray(requests) || requests.length === 0) {
      return [];
    }

    if (loaderId) {
      WinixRaffles.loader.show('Завантаження даних...', loaderId);
    }

    try {
      // Виконуємо запити паралельно, але з обмеженням швидкості
      const results = [];

      for (let i = 0; i < requests.length; i++) {
        const request = requests[i];
        const { method = 'GET', endpoint, params, data, options } = request;

        try {
          let result;

          switch (method.toUpperCase()) {
            case 'GET':
              result = await this.get(endpoint, params || {}, null, options);
              break;
            case 'POST':
              result = await this.post(endpoint, data || {}, null, options);
              break;
            case 'PUT':
              result = await this.put(endpoint, data || {}, null, options);
              break;
            case 'DELETE':
              result = await this.delete(endpoint, data || {}, null, options);
              break;
            default:
              throw new Error(`Непідтримуваний метод: ${method}`);
          }

          results.push({ success: true, data: result, index: i });
        } catch (error) {
          results.push({ success: false, error, index: i });
        }

        // Затримка між запитами для уникнення перевантаження
        if (i < requests.length - 1) {
          await Utils.delay(this._minRequestInterval);
        }
      }

      return results;
    } finally {
      if (loaderId) {
        WinixRaffles.loader.hide(loaderId);
      }
    }
  },

  /**
   * Отримання даних користувача з розширеними опціями
   * @param {boolean} force - Примусове оновлення даних
   * @param {Object} options - Додаткові опції запиту
   * @returns {Promise<Object>} Дані користувача
   */
  async getUserData(force = false, options = {}) {
    const cacheKey = 'user-data';

    // Перевіряємо кеш, якщо не потрібне примусове оновлення
    if (!force) {
      const cachedData = WinixRaffles.cache.get(cacheKey);
      if (cachedData) {
        return cachedData;
      }
    }

    try {
      // Додаємо користувацький ID в параметри запиту, якщо він є
      const userInfo = Utils.getUserInfo();
      const params = {};

      if (userInfo.id) {
        params.userId = userInfo.id;
      }

      const userData = await this.get('/user/profile', params, 'get-user-data', options);

      // Зберігаємо основні дані для швидкого доступу
      if (userData && userData.id) {
        Utils.saveToStorage('user_id', userData.id);
        Utils.saveToStorage('user_first_name', userData.firstName || '');
        Utils.saveToStorage('user_is_admin', userData.isAdmin || false);
      }

      // Зберігаємо дані в кеш на 5 хвилин
      WinixRaffles.cache.set(cacheKey, userData, CONFIG.API.CACHE_TTL);

      // Повідомляємо про оновлення даних користувача
      WinixRaffles.events.emit('user-data-updated', userData);

      return userData;
    } catch (error) {
      WinixRaffles.logger.error('Помилка отримання даних користувача:', error);

      // У разі помилки повертаємо кешовані дані, якщо вони є
      const cachedData = WinixRaffles.cache.get(cacheKey);
      if (cachedData) {
        WinixRaffles.logger.warn('Використовуємо кешовані дані користувача через помилку');
        return cachedData;
      }

      throw error;
    }
  },

  /**
   * Отримати список активних розіграшів
   * @param {boolean} force - Примусове оновлення даних
   * @returns {Promise<Array>} Список активних розіграшів
   */
  async getActiveRaffles(force = false) {
    return this.get('/raffles/active', {}, 'get-active-raffles', {
      force,
      cacheTTL: 180000, // 3 хвилини
      fallbackToCache: true
    });
  },

  /**
   * Отримати історію розіграшів
   * @param {number} page - Сторінка (починається з 1)
   * @param {number} limit - Кількість записів на сторінку
   * @param {boolean} force - Примусове оновлення даних
   * @returns {Promise<Object>} Історія розіграшів з пагінацією
   */
  async getRafflesHistory(page = 1, limit = 10, force = false) {
    return this.get('/raffles/history', { page, limit }, 'get-raffles-history', {
      force,
      cacheTTL: 300000, // 5 хвилин
      fallbackToCache: true
    });
  },

  /**
   * Отримати деталі розіграшу
   * @param {string} raffleId - ID розіграшу
   * @param {boolean} force - Примусове оновлення даних
   * @returns {Promise<Object>} Деталі розіграшу
   */
  async getRaffleDetails(raffleId, force = false) {
    return this.get(`/raffles/${raffleId}`, {}, `get-raffle-${raffleId}`, {
      force,
      cacheTTL: 180000, // 3 хвилини
      fallbackToCache: true
    });
  },

  /**
   * Взяти участь у розіграші
   * @param {string} raffleId - ID розіграшу
   * @param {number} tokens - Кількість токенів
   * @returns {Promise<Object>} Результат участі
   */
  async joinRaffle(raffleId, tokens = 1) {
    return this.post('/raffles/join', {
      raffleId,
      tokens
    }, `join-raffle-${raffleId}`);
  },

  /**
   * Отримати статистику користувача
   * @param {boolean} force - Примусове оновлення даних
   * @returns {Promise<Object>} Статистика користувача
   */
  async getUserStats(force = false) {
    return this.get('/user/stats', {}, 'get-user-stats', {
      force,
      cacheTTL: 300000, // 5 хвилин
      fallbackToCache: true
    });
  }
};

/**
 * UIComponents - Модуль з компонентами інтерфейсу
 */
const UIComponents = {
  /**
   * Ініціалізація компонентів UI
   */
  init: function() {
    WinixRaffles.logger.log('Ініціалізація UI компонентів');

    // Підготовка компонентів сторінки
    this._prepareComponents();

    // Встановлення обробників подій для компонентів
    this._setupEventListeners();

    return this;
  },

  /**
   * Підготовка компонентів інтерфейсу
   * @private
   */
  _prepareComponents: function() {
    // Перевіряємо і створюємо необхідні елементи, якщо вони відсутні
    if (!document.getElementById('loading-spinner')) {
      const spinner = document.createElement('div');
      spinner.id = 'loading-spinner';
      spinner.innerHTML = `
        <div class="spinner-inner"></div>
        <div id="loading-spinner-text" style="color: white; margin-top: 10px; text-align: center;"></div>
      `;
      document.body.appendChild(spinner);
    }

    if (!document.getElementById('toast-message')) {
      const toast = document.createElement('div');
      toast.id = 'toast-message';
      document.body.appendChild(toast);
    }
  },

  /**
   * Встановлення обробників подій
   * @private
   */
  _setupEventListeners: function() {
    // Обробники для модальних вікон
    const closeButtons = document.querySelectorAll('.modal-close');
    closeButtons.forEach(button => {
      button.addEventListener('click', (e) => {
        const modal = e.target.closest('.raffle-modal');
        if (modal) {
          this.closeModal(modal.id);
        }
      });
    });

    // Обробники для кнопок "Всі" в модальних вікнах
    const allButtonsMain = document.getElementById('main-all-tokens-btn');
    if (allButtonsMain) {
      allButtonsMain.addEventListener('click', () => {
        const input = document.getElementById('main-token-amount');
        const balance = parseInt(document.getElementById('user-coins')?.textContent) || 0;
        if (input) input.value = balance;
        this._updateJoinButtonText('main');
      });
    }

    const allButtonsDaily = document.getElementById('daily-all-tokens-btn');
    if (allButtonsDaily) {
      allButtonsDaily.addEventListener('click', () => {
        const input = document.getElementById('daily-token-amount');
        const balance = parseInt(document.getElementById('user-coins')?.textContent) || 0;
        if (input) input.value = balance;
        this._updateJoinButtonText('daily');
      });
    }

    // Обробники для зміни кількості токенів
    const mainTokenInput = document.getElementById('main-token-amount');
    if (mainTokenInput) {
      mainTokenInput.addEventListener('input', () => this._updateJoinButtonText('main'));
    }

    const dailyTokenInput = document.getElementById('daily-token-amount');
    if (dailyTokenInput) {
      dailyTokenInput.addEventListener('input', () => this._updateJoinButtonText('daily'));
    }

    // Обробники для кнопок участі в розіграші
    const mainJoinBtn = document.getElementById('main-join-btn');
    if (mainJoinBtn) {
      mainJoinBtn.addEventListener('click', () => this._handleRaffleJoin('main'));
    }

    const dailyJoinBtn = document.getElementById('daily-join-btn');
    if (dailyJoinBtn) {
      dailyJoinBtn.addEventListener('click', () => this._handleRaffleJoin('daily'));
    }
  },

  /**
   * Оновлення тексту на кнопці участі
   * @param {string} type - Тип розіграшу ('main' або 'daily')
   * @private
   */
  _updateJoinButtonText: function(type) {
    const input = document.getElementById(`${type}-token-amount`);
    const button = document.getElementById(`${type}-join-btn`);

    if (input && button) {
      const amount = parseInt(input.value) || 1;
      button.textContent = `Взяти участь за ${amount} ${this._getTokensText(amount)}`;
    }
  },

  /**
   * Отримання правильної форми слова "жетон"
   * @param {number} count - Кількість
   * @returns {string} Правильна форма слова
   * @private
   */
  _getTokensText: function(count) {
    if (count % 10 === 1 && count % 100 !== 11) {
      return 'жетон';
    } else if ([2, 3, 4].includes(count % 10) && ![12, 13, 14].includes(count % 100)) {
      return 'жетони';
    } else {
      return 'жетонів';
    }
  },

  /**
   * Обробка події участі в розіграші
   * @param {string} type - Тип розіграшу ('main' або 'daily')
   * @private
   */
  _handleRaffleJoin: function(type) {
    const input = document.getElementById(`${type}-token-amount`);
    const button = document.getElementById(`${type}-join-btn`);

    if (!input || !button) {
      this.showToast('Помилка інтерфейсу. Спробуйте оновити сторінку.', 'error');
      return;
    }

    const amount = parseInt(input.value) || 0;
    if (amount <= 0) {
      this.showToast('Будь ласка, введіть коректну кількість жетонів', 'warning');
      return;
    }

    const balance = parseInt(document.getElementById('user-coins')?.textContent) || 0;
    if (amount > balance) {
      this.showToast('Недостатньо жетонів для участі', 'error');
      return;
    }

    const raffleId = button.getAttribute('data-raffle-id');
    if (!raffleId) {
      this.showToast('ID розіграшу не знайдено', 'error');
      return;
    }

    // Відправляємо запит на сервер
    this.showConfirm(
      `Ви впевнені, що бажаєте взяти участь у розіграші за ${amount} ${this._getTokensText(amount)}?`,
      () => {
        // Викликаємо подію спроби участі в розіграші
        WinixRaffles.events.emit('raffle-join-attempt', {
          raffleId,
          type,
          tokens: amount
        });

        // Закриваємо модальне вікно
        this.closeModal(`${type}-raffle-modal`);
      }
    );
  },

  /**
   * Показати повідомлення користувачу
   * @param {string} message - Текст повідомлення
   * @param {string} type - Тип повідомлення ('success', 'error', 'warning', 'info')
   */
  showToast: function(message, type = 'info') {
    if (typeof window.showToast === 'function') {
      window.showToast(message, type);
      return;
    }

    const toast = document.getElementById('toast-message');
    if (!toast) {
      console.warn('Елемент toast-message не знайдено');
      return;
    }

    toast.textContent = message || '';
    toast.className = 'toast-message';

    if (type) {
      toast.classList.add(type);
    }

    // Додаємо клас для показу
    setTimeout(() => toast.classList.add('show'), 10);

    // Ховаємо повідомлення після затримки
    setTimeout(() => {
      toast.classList.remove('show');
    }, 3000);
  },

  /**
   * Показати діалог підтвердження
   * @param {string} message - Текст повідомлення
   * @param {Function} onConfirm - Функція, яка виконується при підтвердженні
   * @param {Function} onCancel - Функція, яка виконується при скасуванні
   */
  showConfirm: function(message, onConfirm, onCancel) {
    if (typeof window.showConfirm === 'function') {
      window.showConfirm(message, onConfirm, onCancel);
      return;
    }

    if (confirm(message)) {
      if (typeof onConfirm === 'function') onConfirm();
    } else {
      if (typeof onCancel === 'function') onCancel();
    }
  },

  /**
   * Відкрити модальне вікно
   * @param {string} modalId - ID модального вікна
   */
  openModal: function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.add('open');
      document.body.style.overflow = 'hidden';
    }
  },

  /**
   * Закрити модальне вікно
   * @param {string} modalId - ID модального вікна
   */
  closeModal: function(modalId) {
    const modal = document.getElementById(modalId);
    if (modal) {
      modal.classList.remove('open');
      document.body.style.overflow = '';
    }
  },

  /**
   * Закрити всі модальні вікна
   */
  closeAllModals: function() {
    const modals = document.querySelectorAll('.raffle-modal');
    modals.forEach(modal => {
      modal.classList.remove('open');
    });
    document.body.style.overflow = '';
  },

  /**
   * Оновити таймер для розіграшу
   * @param {string} elementId - ID елемента, в якому розміщений таймер
   * @param {Date|string|number} endTime - Час завершення розіграшу
   */
  updateTimer: function(elementId, endTime) {
    const timerContainer = document.getElementById(elementId);
    if (!timerContainer) return;

    const endDate = new Date(endTime);
    if (isNaN(endDate.getTime())) {
      timerContainer.innerHTML = '<div class="timer-error">Некоректна дата</div>';
      return;
    }

    const updateTimerValues = () => {
      const now = new Date();
      const diff = endDate - now;

      if (diff <= 0) {
        // Таймер завершено
        timerContainer.innerHTML = '<div class="timer-completed">Розіграш завершено</div>';
        return false;
      }

      // Розраховуємо дні, години, хвилини, секунди
      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((diff % (1000 * 60)) / 1000);

      // Оновлюємо HTML
      timerContainer.innerHTML = `
        <div class="timer-container">
          <div class="timer-block">
            <div class="timer-value">${days}</div>
            <div class="timer-label">днів</div>
          </div>
          <div class="timer-block">
            <div class="timer-value">${hours.toString().padStart(2, '0')}</div>
            <div class="timer-label">годин</div>
          </div>
          <div class="timer-block">
            <div class="timer-value">${minutes.toString().padStart(2, '0')}</div>
            <div class="timer-label">хвилин</div>
          </div>
          <div class="timer-block">
            <div class="timer-value">${seconds.toString().padStart(2, '0')}</div>
            <div class="timer-label">секунд</div>
          </div>
        </div>
      `;

      return true;
    };

    // Перше оновлення
    if (updateTimerValues()) {
      // Якщо таймер ще активний, встановлюємо інтервал
      const timerId = setInterval(() => {
        if (!updateTimerValues()) {
          clearInterval(timerId);
        }
      }, 1000);

      // Зберігаємо ID інтервалу для можливості очищення
      timerContainer.dataset.timerId = timerId;
    }
  },

  /**
   * Очистити таймер
   * @param {string} elementId - ID елемента таймера
   */
  clearTimer: function(elementId) {
    const timerContainer = document.getElementById(elementId);
    if (timerContainer && timerContainer.dataset.timerId) {
      clearInterval(parseInt(timerContainer.dataset.timerId));
      delete timerContainer.dataset.timerId;
    }
  },

  /**
   * Оновити прогрес-бар
   * @param {string} elementId - ID елемента прогрес-бару
   * @param {number} current - Поточне значення
   * @param {number} max - Максимальне значення
   */
  updateProgressBar: function(elementId, current, max) {
    const progressBar = document.getElementById(elementId);
    if (!progressBar) return;

    const progress = progressBar.querySelector('.progress');
    if (!progress) return;

    const percentage = max > 0 ? Math.min(100, (current / max) * 100) : 0;
    progress.style.width = `${percentage}%`;
  },

  /**
   * Показати заглушку в контейнері
   * @param {string} containerId - ID контейнера
   * @param {string} type - Тип заглушки ('loading', 'empty', 'error')
   * @param {string} message - Повідомлення
   * @param {string} subMessage - Додаткове повідомлення
   */
  showPlaceholder: function(containerId, type = 'loading', message = '', subMessage = '') {
    const container = document.getElementById(containerId);
    if (!container) return;

    let html = '';

    switch (type) {
      case 'loading':
        html = `
          <div class="loading-placeholder">
            <div class="loading-spinner"></div>
            <div class="loading-text">${message || 'Завантаження...'}</div>
            ${subMessage ? `<div class="loading-subtext">${subMessage}</div>` : ''}
          </div>
        `;
        break;

      case 'empty':
        html = `
          <div class="empty-history">
            <div class="empty-history-icon">📊</div>
            <h3>${message || 'Немає даних'}</h3>
            ${subMessage ? `<p>${subMessage}</p>` : ''}
          </div>
        `;
        break;

      case 'error':
        html = `
          <div class="empty-history">
            <div class="empty-history-icon">⚠️</div>
            <h3>${message || 'Помилка завантаження'}</h3>
            ${subMessage ? `<p>${subMessage}</p>` : ''}
            <button onclick="window.location.reload()">Оновити сторінку</button>
          </div>
        `;
        break;
    }

    container.innerHTML = html;
  },

  /**
   * Скинути стан компонентів
   */
  resetState: function() {
    // Закрити всі модальні вікна
    this.closeAllModals();

    // Очистити всі таймери
    const timerContainers = document.querySelectorAll('[data-timer-id]');
    timerContainers.forEach(container => {
      if (container.dataset.timerId) {
        clearInterval(parseInt(container.dataset.timerId));
        delete container.dataset.timerId;
      }
    });
  }
};

/**
 * Реєстрація основних модулів системи
 */
function registerSystemModules() {
  // Реєструємо API сервіс
  WinixRaffles.registerModule('api', ApiService);

  // Реєструємо UI компоненти
  WinixRaffles.registerModule('uiComponents', UIComponents);

  // Тут реєстрація інших модулів
  // Наприклад:
  // WinixRaffles.registerModule('activeRaffles', ActiveRafflesModule);
  // WinixRaffles.registerModule('history', HistoryModule);
  // WinixRaffles.registerModule('stats', StatsModule);
}

/**
 * Перевірка критичних залежностей
 * @returns {Promise<boolean>} Результат перевірки
 */
async function checkDependencies() {
  // Перевіряємо підтримку браузера
  const browserSupport = Utils.checkBrowserSupport();
  if (!browserSupport.compatible) {
    console.error('Браузер не підтримує необхідні API:', browserSupport);
    return false;
  }

  // Перевіряємо наявність WinixAPI і WinixAuth
  let apiLoaded = window.WinixAPI && typeof window.WinixAPI.apiRequest === 'function';
  let authLoaded = window.WinixAuth && typeof window.WinixAuth.getUserData === 'function';

  if (!apiLoaded || !authLoaded) {
    console.log('Очікування завантаження API та Auth модулів...');

    // Чекаємо максимум 10 секунд
    const maxAttempts = 20;
    const checkInterval = 500;

    for (let i = 0; i < maxAttempts; i++) {
      await Utils.delay(checkInterval);

      apiLoaded = window.WinixAPI && typeof window.WinixAPI.apiRequest === 'function';
      authLoaded = window.WinixAuth && typeof window.WinixAuth.getUserData === 'function';

      if (apiLoaded && authLoaded) {
        console.log('API та Auth модулі успішно завантажені');
        return true;
      }
    }

    console.warn('Не вдалося завантажити API та Auth модулі, продовжуємо з обмеженою функціональністю');
    return true; // Продовжуємо, але з обмеженнями
  }

  return true;
}

/**
 * Допоміжна функція для безпечного отримання DOM елементів
 * @param {string} selector - CSS селектор
 * @param {Element} parent - Батьківський елемент (опціонально)
 * @returns {Element|null} Знайдений елемент або null
 */
function safeQuerySelector(selector, parent = document) {
  try {
    return parent.querySelector(selector);
  } catch (error) {
    console.error(`Помилка при пошуку елемента "${selector}":`, error);
    return null;
  }
}

/**
 * Клас для управління модулями розіграшів і забезпечення єдиної точки входу
 */
class RafflesModule {
  constructor() {
    // Прапорець ініціалізації
    this._initialized = false;

    // Об'єкт для відстеження процесу ініціалізації
    this._initialization = {
      inProgress: false,
      timer: null,
      attempts: 0,
      maxAttempts: CONFIG.MAX_RETRIES
    };

    // Прапорець наявності адмін прав
    this._isAdmin = false;

    // Карта для відстеження активних компонентів
    this._activeComponents = new Map();

    // Відстеження станів вкладок
    this._tabs = {
      current: 'active',
      history: {
        loaded: false,
        page: 1
      },
      stats: {
        loaded: false
      }
    };

    // Карта для відстеження інтервалів та таймерів
    this._timers = new Map();
  }

  /**
   * Налаштування початкових обробників подій
   * @private
   */
  _setupInitialEventListeners() {
    // Обробник події завантаження DOM
    document.addEventListener('DOMContentLoaded', () => {
      // Перевіряємо стан ініціалізації
      if (!this._initialized && !this._initialization.inProgress) {
        this.init().catch(error => {
          console.error('Помилка ініціалізації модуля розіграшів:', error);
        });
      }
    });

    // Обробник події оновлення даних користувача
    WinixRaffles.events.on('user-data-updated', (userData) => {
      if (userData && userData.isAdmin) {
        this._isAdmin = true;
        WinixRaffles.logger.log('Виявлено адміністраторські права');

        // Ініціалізуємо адміністративний модуль
        if (document.getElementById('admin-raffles-container')) {
          const adminModule = WinixRaffles.getModule('admin');
          if (adminModule) {
            adminModule.init().catch(error => {
              WinixRaffles.logger.error('Помилка ініціалізації адмін модуля:', error);
            });
          }
        }
      }
    });

    // Обробник для події спроби участі в розіграші
    WinixRaffles.events.on('raffle-join-attempt', async (data) => {
      try {
        const api = WinixRaffles.getModule('api');
        const uiComponents = WinixRaffles.getModule('uiComponents');

        if (!api || !uiComponents) throw new Error('Необхідні модулі не знайдено');

        uiComponents.showToast('Обробка запиту на участь...', 'info');

        const result = await api.joinRaffle(data.raffleId, data.tokens);

        // Оновлюємо дані користувача для оновлення балансу
        await api.getUserData(true);

        uiComponents.showToast('Ви успішно взяли участь у розіграші!', 'success');

        // Оновлюємо відображення розіграшу
        this._updateRaffleParticipation(data.raffleId, result);
      } catch (error) {
        const uiComponents = WinixRaffles.getModule('uiComponents');
        if (uiComponents) {
          uiComponents.showToast(
            `Помилка при участі в розіграші: ${error.message || 'Невідома помилка'}`,
            'error'
          );
        }
      }
    });

    // Обробники подій для Telegram WebApp
    document.addEventListener('telegram-ready', () => {
      WinixRaffles.logger.log('Telegram WebApp готовий, оновлюємо дані користувача');

      // Якщо модуль уже ініціалізовано, оновлюємо дані користувача
      if (this._initialized) {
        const api = WinixRaffles.getModule('api');
        if (api) {
          api.getUserData(true).catch(error => {
            WinixRaffles.logger.warn('Помилка при оновленні даних користувача після Telegram init:', error);
          });
        }
      }
    });

    // Слухачі подій для мережевих змін
    window.addEventListener('online', () => {
      const networkService = WinixRaffles.network;
      if (networkService && typeof networkService.isOnline === 'function' && !networkService.isOnline()) {
        WinixRaffles.events.emit('network-status-changed', { online: true, forced: false });
      }
    });

    window.addEventListener('offline', () => {
      const networkService = WinixRaffles.network;
      if (networkService && typeof networkService.isOnline === 'function' && networkService.isOnline()) {
        WinixRaffles.events.emit('network-status-changed', { online: false, forced: false });
      }
    });
  }

  /**
   * Оновлення інформації про участь у розіграші
   * @param {string} raffleId - ID розіграшу
   * @param {Object} result - Результат від API
   * @private
   */
  _updateRaffleParticipation(raffleId, result) {
    // Оновлюємо дані в інтерфейсі
    const api = WinixRaffles.getModule('api');

    if (api) {
      // Оновлюємо дані активних розіграшів
      api.getActiveRaffles(true).then(raffles => {
        this._renderActiveRaffles(raffles);
      }).catch(error => {
        WinixRaffles.logger.error('Помилка при оновленні активних розіграшів після участі:', error);
      });
    }
  }

  /**
   * Відображення активних розіграшів
   * @param {Array} raffles - Масив розіграшів
   * @private
   */
  _renderActiveRaffles(raffles) {
    // Оновлюємо елементи інтерфейсу відповідно до отриманих даних
    if (!raffles || !Array.isArray(raffles) || raffles.length === 0) {
      // Показуємо заглушку, якщо розіграшів немає
      const uiComponents = WinixRaffles.getModule('uiComponents');
      if (uiComponents) {
        uiComponents.showPlaceholder(
          'active-raffles',
          'empty',
          'Немає активних розіграшів',
          'Наразі нема доступних розіграшів. Спробуйте пізніше.'
        );
      }
      return;
    }

    // Тут буде додатковий код для відображення розіграшів, який має бути реалізований
    // у відповідному модулі (ActiveRafflesModule)
    const activeModule = WinixRaffles.getModule('activeRaffles');
    if (activeModule && typeof activeModule.displayRaffles === 'function') {
      activeModule.displayRaffles(raffles);
    } else {
      WinixRaffles.logger.warn('Модуль активних розіграшів не знайдено або не має методу displayRaffles');
    }
  }

  /**
   * Ініціалізація функцій переключення вкладок
   * @private
   */
  _initTabSwitching() {
    // Обробники подій для перемикання вкладок
    const tabButtons = document.querySelectorAll('.tab-button');
    if (tabButtons.length > 0) {
      tabButtons.forEach(button => {
        button.addEventListener('click', () => {
          const tabName = button.getAttribute('data-tab');
          if (tabName) {
            this.switchTab(tabName);
          }
        });
      });
    }
  }

  /**
   * Ініціалізація всіх модулів розіграшів
   * @param {boolean} forceInit - Примусова ініціалізація, навіть якщо вже ініціалізовано
   * @returns {Promise<RafflesModule>} Екземпляр модуля
   */
  async init(forceInit = false) {
    // Якщо вже ініціалізовано і не потрібна примусова ініціалізація
    if (this._initialized && !forceInit) {
      WinixRaffles.logger.warn('Модуль розіграшів уже ініціалізовано');
      return this;
    }

    // Якщо ініціалізація вже в процесі
    if (this._initialization.inProgress) {
      WinixRaffles.logger.warn('Ініціалізація вже в процесі, очікуємо завершення');
      return new Promise((resolve, reject) => {
        const checkInterval = setInterval(() => {
          if (this._initialized) {
            clearInterval(checkInterval);
            resolve(this);
          } else if (!this._initialization.inProgress) {
            clearInterval(checkInterval);
            reject(new Error('Ініціалізація перервана або завершилася з помилкою'));
          }
        }, 500);
      });
    }

    // Встановлюємо прапорець ініціалізації
    this._initialization.inProgress = true;
    this._initialization.attempts++;

    // Встановлюємо таймаут для ініціалізації
    this._initialization.timer = setTimeout(() => {
      if (this._initialization.inProgress) {
        WinixRaffles.logger.error('Таймаут ініціалізації перевищено');
        this._initialization.inProgress = false;

        // Повторна спроба
        if (this._initialization.attempts < this._initialization.maxAttempts) {
          WinixRaffles.logger.log(`Повторна спроба ініціалізації (${this._initialization.attempts}/${this._initialization.maxAttempts})...`);
          setTimeout(() => this.init(true), CONFIG.TIMEOUTS.RETRY_DELAY);
        }
      }
    }, CONFIG.TIMEOUTS.INITIALIZATION);

    try {
      WinixRaffles.logger.log('Ініціалізація основного модуля розіграшів');

      // Встановлюємо обробники подій
      this._setupInitialEventListeners();

      // Перевіряємо критичні залежності
      const dependenciesOK = await checkDependencies();
      if (!dependenciesOK) {
        throw new Error('Критичні залежності недоступні');
      }

      // Реєструємо основні модулі, якщо ще не зареєстровані
      registerSystemModules();

      // Ініціалізуємо систему WinixRaffles
      WinixRaffles.init({
        debug: CONFIG.DEBUG,
        apiBaseUrl: CONFIG.API.BASE_URL
      });

      // Ініціалізуємо API сервіс
      await WinixRaffles.initModule('api');

      // Ініціалізуємо UI компоненти
      await WinixRaffles.initModule('uiComponents');

      // Оновлюємо дані користувача при ініціалізації
      const apiService = WinixRaffles.getModule('api');
      if (apiService) {
        try {
          WinixRaffles.logger.log('Оновлюємо дані користувача');
          await apiService.getUserData(true);
          WinixRaffles.logger.log('Дані користувача оновлено');
        } catch (userError) {
          WinixRaffles.logger.warn('Помилка оновлення даних користувача:', userError);
        }
      }

      // Додаємо обробники подій для перемикання вкладок
      this._initTabSwitching();

      // Перевіряємо наявність адміністраторських прав
      this._checkAdminAccess();

      // Експортуємо глобальні функції для зворотної сумісності
      this.exportGlobalFunctions();

      // Активуємо поточну вкладку
      this.switchTab(this._tabs.current || 'active');

      // Встановлюємо прапорець ініціалізації
      this._initialized = true;
      this._initialization.inProgress = false;

      // Очищаємо таймаут ініціалізації
      if (this._initialization.timer) {
        clearTimeout(this._initialization.timer);
        this._initialization.timer = null;
      }

      WinixRaffles.logger.log('Ініціалізацію модуля розіграшів завершено');

      return this;
    } catch (error) {
      this._initialization.inProgress = false;

      // Очищаємо таймаут ініціалізації
      if (this._initialization.timer) {
        clearTimeout(this._initialization.timer);
        this._initialization.timer = null;
      }

      WinixRaffles.logger.error('Критична помилка при ініціалізації модуля розіграшів:', error);

      // Якщо кількість спроб менша за максимальну, повторюємо ініціалізацію
      if (this._initialization.attempts < this._initialization.maxAttempts) {
        WinixRaffles.logger.log(`Повторна спроба ініціалізації (${this._initialization.attempts}/${this._initialization.maxAttempts})...`);

        // Очищаємо попередні стани
        this.resetAllStates();

        // Затримка перед повторною спробою
        setTimeout(() => this.init(true), CONFIG.TIMEOUTS.RETRY_DELAY);
      } else {
        WinixRaffles.logger.error('Досягнуто максимальної кількості спроб ініціалізації');

        // Показуємо повідомлення про помилку
        const uiComponents = WinixRaffles.getModule('uiComponents');
        if (uiComponents && uiComponents.showToast) {
          uiComponents.showToast('Не вдалося ініціалізувати модуль розіграшів', 'error');
        }

        // Скидаємо лічильник спроб
        this._initialization.attempts = 0;
      }

      throw error;
    }
  }

  /**
   * Переключення між вкладками розіграшів
   * @param {string} tabName - Назва вкладки для активації
   */
  switchTab(tabName) {
    if (!tabName) {
      WinixRaffles.logger.error('Назва вкладки не вказана');
      return;
    }

    WinixRaffles.logger.log(`Переключення на вкладку ${tabName}`);

    try {
      // Оновлюємо активну вкладку
      const tabButtons = document.querySelectorAll('.tab-button');
      const tabSections = document.querySelectorAll('.tab-content');

      // Знімаємо активний стан з усіх вкладок і секцій
      tabButtons.forEach(btn => btn.classList.remove('active'));
      tabSections.forEach(section => section.classList.remove('active'));

      // Додаємо активний стан до вибраної вкладки і секції
      const activeTabButton = document.querySelector(`.tab-button[data-tab="${tabName}"]`);
      const activeTabSection = document.getElementById(`${tabName}-raffles`);

      if (activeTabButton) activeTabButton.classList.add('active');
      if (activeTabSection) activeTabSection.classList.add('active');

      // Зберігаємо поточну вкладку
      this._tabs.current = tabName;

      // Емітуємо подію про зміну вкладки
      WinixRaffles.events.emit('tab-switched', { tab: tabName });

      // Перевіряємо необхідні модулі
      const networkService = WinixRaffles.network;
      const uiComponents = WinixRaffles.getModule('uiComponents');
      const api = WinixRaffles.getModule('api');

      if (!networkService || !uiComponents) {
        throw new Error('Необхідні модулі не знайдено');
      }

      // Викликаємо відповідні функції залежно від вкладки
      switch (tabName) {
        case 'past':
        case 'history':
          // Перевіряємо, чи пристрій онлайн
          if (!networkService.isOnline()) {
            uiComponents.showToast('Історія недоступна без підключення до Інтернету', 'warning');
            // Показуємо заглушку
            uiComponents.showPlaceholder(
              'history-container',
              'empty',
              'Історія недоступна',
              'Для перегляду історії розіграшів необхідне підключення до Інтернету.'
            );
          } else {
            // Відображаємо історію, якщо вона не завантажена або примусове оновлення
            if (!this._tabs.history.loaded || tabName === 'past') {
              if (api) {
                uiComponents.showPlaceholder('history-container', 'loading', 'Завантаження історії...', 'Зачекайте, будь ласка');

                api.getRafflesHistory(this._tabs.history.page, 10)
                  .then(history => {
                    this._tabs.history.loaded = true;
                    this._renderRafflesHistory(history);
                  })
                  .catch(error => {
                    WinixRaffles.logger.error('Помилка завантаження історії:', error);
                    uiComponents.showPlaceholder(
                      'history-container',
                      'error',
                      'Не вдалося завантажити історію',
                      'Перевірте підключення до Інтернету або спробуйте пізніше.'
                    );
                  });
              } else {
                // Показуємо помилку, якщо API не доступне
                uiComponents.showPlaceholder(
                  'history-container',
                  'error',
                  'Помилка завантаження',
                  'API сервіс недоступний. Спробуйте оновити сторінку.'
                );
              }
            }
          }
          break;

        case 'active':
          // Відображаємо активні розіграші
          if (api) {
            uiComponents.showPlaceholder('active-raffles', 'loading', 'Завантаження розіграшів...', 'Зачекайте, будь ласка');

            api.getActiveRaffles()
              .then(raffles => {
                this._renderActiveRaffles(raffles);
              })
              .catch(error => {
                WinixRaffles.logger.error('Помилка завантаження активних розіграшів:', error);
                uiComponents.showPlaceholder(
                  'active-raffles',
                  'error',
                  'Не вдалося завантажити розіграші',
                  'Перевірте підключення до Інтернету або спробуйте пізніше.'
                );
              });
          } else {
            // Показуємо помилку, якщо API не доступне
            uiComponents.showPlaceholder(
              'active-raffles',
              'error',
              'Помилка завантаження',
              'API сервіс недоступний. Спробуйте оновити сторінку.'
            );
          }
          break;

        case 'stats':
          // Перевіряємо, чи пристрій онлайн
          if (!networkService.isOnline()) {
            uiComponents.showToast('Статистика недоступна без підключення до Інтернету', 'warning');
            this._showEmptyStatsMessage('Статистика недоступна', 'Для перегляду статистики необхідне підключення до Інтернету.');
          } else {
            // Завантажуємо статистику, якщо вона не завантажена
            if (!this._tabs.stats.loaded) {
              if (api) {
                this._showEmptyStatsMessage('Завантаження статистики...', 'Зачекайте, будь ласка');

                api.getUserStats()
                  .then(stats => {
                    this._tabs.stats.loaded = true;
                    this._renderUserStats(stats);
                  })
                  .catch(error => {
                    WinixRaffles.logger.error('Помилка завантаження статистики:', error);
                    this._showEmptyStatsMessage(
                      'Не вдалося завантажити статистику',
                      'Перевірте підключення до Інтернету або спробуйте пізніше.'
                    );
                  });
              } else {
                this._showEmptyStatsMessage(
                  'Помилка завантаження',
                  'API сервіс недоступний. Спробуйте оновити сторінку.'
                );
              }
            }
          }
          break;

        case 'admin':
          // Перевіряємо, чи пристрій онлайн і чи є права адміна
          if (!networkService.isOnline()) {
            uiComponents.showToast('Адмін-панель недоступна без підключення до Інтернету', 'warning');
          } else if (this._isAdmin) {
            const adminModule = WinixRaffles.getModule('admin');
            if (adminModule && typeof adminModule.displayRafflesList === 'function') {
              adminModule.displayRafflesList();
            } else {
              WinixRaffles.logger.error('Модуль адміністрування не знайдено або не має методу displayRafflesList');
            }
          } else {
            uiComponents.showToast('У вас немає прав доступу до адмін-панелі', 'error');
            // Повертаємося на вкладку активних розіграшів
            setTimeout(() => this.switchTab('active'), 500);
          }
          break;

        default:
          WinixRaffles.logger.warn(`Невідома вкладка: ${tabName}`);
      }
    } catch (error) {
      WinixRaffles.logger.error('Помилка при переключенні вкладок:', error);

      const uiComponents = WinixRaffles.getModule('uiComponents');
      if (uiComponents && uiComponents.showToast) {
        uiComponents.showToast('Помилка при зміні вкладки', 'error');
      }
    }
  }

  /**
   * Відображення історії розіграшів
   * @param {Object} history - Об'єкт з історією розіграшів
   * @private
   */
  _renderRafflesHistory(history) {
    // Тут код для відображення історії розіграшів
    // Повинен бути реалізований в окремому модулі для історії розіграшів
    const historyModule = WinixRaffles.getModule('history');
    if (historyModule && typeof historyModule.displayHistory === 'function') {
      historyModule.displayHistory(history);
    } else {
      WinixRaffles.logger.warn('Модуль історії не знайдено або не має методу displayHistory');

      // Запасний варіант: базове відображення
      const container = document.getElementById('history-container');
      if (!container) return;

      if (!history || !history.items || history.items.length === 0) {
        const uiComponents = WinixRaffles.getModule('uiComponents');
        if (uiComponents) {
          uiComponents.showPlaceholder(
            'history-container',
            'empty',
            'Історія порожня',
            'Ви ще не брали участі в розіграшах.'
          );
        }
        return;
      }

      // Базове відображення історії
      let html = '<div class="raffles-history">';
      html += '<h2 class="history-title">Історія розіграшів</h2>';

      history.items.forEach(item => {
        html += `
          <div class="history-card" data-raffle-id="${item.id}">
            <div class="history-date">${Utils.formatDate(item.endDate)}</div>
            <div class="history-prize">${item.prize}</div>
            <div class="history-winners">Переможців: ${item.winnersCount}</div>
            <div class="history-status ${item.userStatus}">${this._getUserStatusText(item.userStatus)}</div>
            <div class="view-details-hint">Натисніть для деталей</div>
          </div>
        `;
      });

      html += '</div>';
      container.innerHTML = html;

      // Додаємо обробники подій для карток історії
      const historyCards = container.querySelectorAll('.history-card');
      historyCards.forEach(card => {
        card.addEventListener('click', () => {
          const raffleId = card.getAttribute('data-raffle-id');
          if (raffleId) {
            WinixRaffles.events.emit('show-history-details', { raffleId });
          }
        });
      });
    }
  }

  /**
   * Отримання тексту статусу користувача для історії розіграшів
   * @param {string} status - Код статусу
   * @returns {string} Текст статусу
   * @private
   */
  _getUserStatusText(status) {
    switch (status) {
      case 'won':
        return 'Виграш';
      case 'participated':
        return 'Участь';
      case 'not_participated':
        return 'Не брав участі';
      default:
        return 'Невідомо';
    }
  }

  /**
   * Відображення статистики користувача
   * @param {Object} stats - Об'єкт зі статистикою
   * @private
   */
  _renderUserStats(stats) {
    // Оновлюємо елементи статистики
    const totalParticipated = document.getElementById('total-participated');
    const totalWins = document.getElementById('total-wins');
    const totalWinixWon = document.getElementById('total-winix-won');
    const totalTokensSpent = document.getElementById('total-tokens-spent');

    if (totalParticipated) {
      totalParticipated.textContent = stats?.participated || 0;
    }

    if (totalWins) {
      totalWins.textContent = stats?.wins || 0;
    }

    if (totalWinixWon) {
      totalWinixWon.textContent = stats?.winixWon ? stats.winixWon.toLocaleString() : 0;
    }

    if (totalTokensSpent) {
      totalTokensSpent.textContent = stats?.tokensSpent || 0;
    }
  }

  /**
   * Показати повідомлення про відсутність статистики
   * @param {string} title - Заголовок повідомлення
   * @param {string} message - Текст повідомлення
   * @private
   */
  _showEmptyStatsMessage(title = 'Статистика тимчасово недоступна', message = 'Спробуйте оновити сторінку або повторіть спробу пізніше.') {
    // Оновлюємо елементи статистики порожніми значеннями
    const totalParticipated = document.getElementById('total-participated');
    const totalWins = document.getElementById('total-wins');
    const totalWinixWon = document.getElementById('total-winix-won');
    const totalTokensSpent = document.getElementById('total-tokens-spent');

    if (totalParticipated) totalParticipated.textContent = '-';
    if (totalWins) totalWins.textContent = '-';
    if (totalWinixWon) totalWinixWon.textContent = '-';
    if (totalTokensSpent) totalTokensSpent.textContent = '-';

    // Якщо є додатковий контейнер для статистики, показуємо повідомлення
    const container = document.getElementById('user-stats-container');
    if (container) {
      container.innerHTML = `
        <div class="empty-stats">
          <div class="empty-stats-icon">📊</div>
          <h3>${title}</h3>
          <p>${message}</p>
        </div>
      `;
    }
  }

  /**
   * Перевірка наявності адміністраторських прав
   * @private
   */
  async _checkAdminAccess() {
    try {
      // Спочатку перевіряємо дані з localStorage
      const isAdminFromStorage = Utils.getFromStorage('user_is_admin', false);
      if (isAdminFromStorage) {
        this._isAdmin = true;
        WinixRaffles.logger.log('Адміністраторські права виявлено в localStorage');
        return;
      }

      // Перевіряємо наявність модуля AdminAPI
      if (window.AdminAPI && typeof window.AdminAPI.getAdminId === 'function') {
        try {
          const adminId = await window.AdminAPI.getAdminId();
          if (adminId) {
            this._isAdmin = true;
            Utils.saveToStorage('user_is_admin', true);
            WinixRaffles.logger.log('Адміністраторські права підтверджено через AdminAPI');
          }
        } catch (error) {
          WinixRaffles.logger.warn('Помилка при перевірці через AdminAPI:', error);
        }
      }

      // Перевіряємо через API
      const api = WinixRaffles.getModule('api');
      if (api && !this._isAdmin) {
        try {
          const userData = await api.getUserData(false, { useCache: true });
          if (userData && userData.isAdmin) {
            this._isAdmin = true;
            Utils.saveToStorage('user_is_admin', true);
            WinixRaffles.logger.log('Адміністраторські права підтверджено через API');
          }
        } catch (error) {
          WinixRaffles.logger.warn('Помилка при перевірці через API:', error);
        }
      }

      // Ініціалізуємо адміністративний модуль, якщо є права
      if (this._isAdmin && document.getElementById('admin-raffles-container')) {
        const adminModule = WinixRaffles.getModule('admin');
        if (adminModule) {
          adminModule.init().catch(error => {
            WinixRaffles.logger.error('Помилка ініціалізації адмін модуля:', error);
          });
        }
      }
    } catch (error) {
      WinixRaffles.logger.error('Помилка перевірки адміністративного доступу:', error);
      this._isAdmin = false;
    }
  }

  /**
   * Експорт всіх необхідних функцій для використання в інших модулях
   */
  exportGlobalFunctions() {
    // Зберігаємо посилання на модуль у глобальному об'єкті для зворотної сумісності
    window.rafflesModule = this;

    // Додаємо функції для глобального використання
    window.openRaffleDetails = (raffleId, raffleType) => {
      // Перевіряємо, чи пристрій онлайн
      if (!WinixRaffles.network.isOnline()) {
        const uiComponents = WinixRaffles.getModule('uiComponents');
        if (uiComponents && uiComponents.showToast) {
          uiComponents.showToast('Деталі розіграшу недоступні без підключення до Інтернету', 'warning');
        }
        return;
      }

      WinixRaffles.events.emit('open-raffle-details', { raffleId, raffleType });
    };

    window.showRaffleHistoryDetails = (raffleData) => {
      WinixRaffles.events.emit('show-history-details', { raffleData });
    };

    // Функція перемикання вкладок
    window.switchRaffleTab = this.switchTab.bind(this);

    // Створюємо об'єкт rafflesFunctions для зворотної сумісності зі старим кодом
    window.rafflesFunctions = {
      switchTab: this.switchTab.bind(this),
      loadRaffleHistory: () => {
        this._tabs.history.loaded = false;
        this.switchTab('past');
      },
      resetAllStates: this.resetAllStates.bind(this),
      isOnline: WinixRaffles.network.isOnline.bind(WinixRaffles.network),
      showToast: (message, type) => {
        const uiComponents = WinixRaffles.getModule('uiComponents');
        if (uiComponents && uiComponents.showToast) {
          uiComponents.showToast(message, type);
        }
      },
      showConfirm: (message, onConfirm, onCancel) => {
        const uiComponents = WinixRaffles.getModule('uiComponents');
        if (uiComponents && uiComponents.showConfirm) {
          uiComponents.showConfirm(message, onConfirm, onCancel);
        }
      }
    };

    return this;
  }

  /**
   * Скидання всіх станів
   */
  resetAllStates() {
    // Скидання станів у всіх модулях
    for (const moduleName of ['active', 'history', 'stats', 'modals', 'uiComponents']) {
      try {
        const module = WinixRaffles.getModule(moduleName);
        if (module && typeof module.resetState === 'function') {
          module.resetState();
        }
      } catch (e) {
        WinixRaffles.logger.error(`Помилка скидання стану модуля ${moduleName}:`, e);
      }
    }

    // Скидання станів вкладок
    this._tabs.history.loaded = false;
    this._tabs.stats.loaded = false;

    // Очищаємо всі таймери
    for (const [timerId, id] of this._timers.entries()) {
      clearTimeout(id);
      clearInterval(id);
    }
    this._timers.clear();

    // Приховування лоадерів
    WinixRaffles.loader.hideAll();

    return this;
  }

  /**
   * Знищення модуля і звільнення ресурсів
   */
  destroy() {
    if (!this._initialized) {
      return this;
    }

    WinixRaffles.logger.log('Знищення модулів розіграшів');

    // Скидаємо всі стани
    this.resetAllStates();

    // Очищаємо таймаути
    if (this._initialization.timer) {
      clearTimeout(this._initialization.timer);
      this._initialization.timer = null;
    }

    // Скидаємо прапорець ініціалізації
    this._initialized = false;
    this._initialization.attempts = 0;
    this._initialization.inProgress = false;

    // Викликаємо знищення всієї системи
    WinixRaffles.destroy();

    WinixRaffles.logger.log('Модулі успішно знищено');

    return this;
  }
}

// Створюємо екземпляр модуля
const rafflesModule = new RafflesModule();

// Експортуємо модуль
export default rafflesModule;