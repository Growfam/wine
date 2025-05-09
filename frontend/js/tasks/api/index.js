/**
 * Головний модуль API завдань
 *
 * Виправлена версія для вирішення проблем із циклічними залежностями
 * та ES6 модулями
 *
 * @version 3.2.0
 */

// Константи та конфігурація доступні напряму
const API_VERSION = '3.2.0';
const API_ERROR_CODES = {
  NETWORK_ERROR: 'network_error',
  TIMEOUT: 'timeout_error',
  SERVER_ERROR: 'server_error',
  AUTH_ERROR: 'authentication_error',
  VALIDATION_ERROR: 'validation_error',
  NOT_FOUND: 'not_found',
  RATE_LIMIT: 'rate_limit_error',
};

// Базова конфігурація для API запитів завдань
const CONFIG = {
  REQUEST_TIMEOUT: 15000, // 15 секунд
  MAX_VERIFICATION_ATTEMPTS: 2, // Кількість спроб
  RETRY_INTERVAL: 1000, // Інтервал між спробами
  REQUEST_CACHE_TTL: 60000, // Час життя кешу запитів (1 хвилина)
  API_PATHS: {
    // Завдання
    TASKS: {
      ALL: 'quests/tasks',
      BY_TYPE: function(type) { return 'quests/tasks/' + type; },
      SOCIAL: 'quests/tasks/social',
      LIMITED: 'quests/tasks/limited',
      PARTNER: 'quests/tasks/partner',
      REFERRAL: 'quests/tasks/referral',
      DETAILS: function(taskId) { return 'quests/tasks/' + taskId + '/details'; },
      START: function(taskId) { return 'quests/tasks/' + taskId + '/start'; },
      VERIFICATION: function(taskId) { return 'quests/tasks/' + taskId + '/verify'; },
      PROGRESS: function(taskId) { return 'quests/tasks/' + taskId + '/progress'; },
      CANCEL: function(taskId) { return 'quests/tasks/' + taskId + '/cancel'; },
      CLAIM_REWARD: function(taskId) { return 'quests/tasks/' + taskId + '/claim-reward'; },
      FEEDBACK: function(taskId) { return 'quests/tasks/' + taskId + '/feedback'; },
    },
    // Прогрес користувача
    USER_PROGRESS: function(userId) { return 'user/' + userId + '/progress'; },
    // Статус завдання користувача
    USER_TASK_STATUS: function(userId, taskId) { return 'user/' + userId + '/tasks/' + taskId + '/status'; },
  },
};

// Простий сервіс кешування для API запитів
class CacheService {
  constructor() {
    this.cache = new Map();
    this.cacheTimestamps = new Map();
  }

  getCachedData(key) {
    if (this.cache.has(key) && this.cacheTimestamps.has(key)) {
      const timestamp = this.cacheTimestamps.get(key);
      if (Date.now() - timestamp < CONFIG.REQUEST_CACHE_TTL) {
        return this.cache.get(key);
      }
    }
    return null;
  }

  cacheData(key, data) {
    this.cache.set(key, data);
    this.cacheTimestamps.set(key, Date.now());

    // Обмежуємо розмір кешу
    if (this.cache.size > 100) {
      let oldestKey = null;
      let oldestTime = Date.now();

      this.cacheTimestamps.forEach((time, k) => {
        if (time < oldestTime) {
          oldestTime = time;
          oldestKey = k;
        }
      });

      if (oldestKey) {
        this.cache.delete(oldestKey);
        this.cacheTimestamps.delete(oldestKey);
      }
    }
  }

  clearCache(keyPattern) {
    if (keyPattern) {
      // Очищуємо вибірково за патерном
      this.cache.forEach((value, key) => {
        if (key.includes(keyPattern)) {
          this.cache.delete(key);
          this.cacheTimestamps.delete(key);
        }
      });
    } else {
      // Очищуємо весь кеш
      this.cache.clear();
      this.cacheTimestamps.clear();
    }
  }

  generateCacheKey(method, url, data) {
    return method + '_' + url + '_' + JSON.stringify(data || {});
  }
}

// Базовий сервіс запитів
class RequestService {
  constructor() {
    this.baseUrl = this._detectBaseUrl();
    this.defaultRequestOptions = {
      timeout: CONFIG.REQUEST_TIMEOUT,
      maxRetries: CONFIG.MAX_VERIFICATION_ATTEMPTS,
      retryDelay: CONFIG.RETRY_INTERVAL
    };
  }

  init() {
    console.log(`API: Ініціалізація сервісу запитів v${API_VERSION}`);
    return this;
  }

  // Визначення базового URL API
  _detectBaseUrl() {
    try {
      // Спочатку перевіряємо WinixAPI
      if (window.WinixAPI && window.WinixAPI.config && window.WinixAPI.config.baseUrl) {
        return window.WinixAPI.config.baseUrl.replace(/\/$/, '');
      }

      // Альтернативно визначаємо за поточним хостом
      const hostname = window.location.hostname;

      if (hostname === 'localhost' || hostname === '127.0.0.1') {
        return 'http://' + hostname + ':8080';
      } else if (hostname.includes('testenv') || hostname.includes('staging')) {
        return 'https://' + hostname;
      } else {
        return 'https://winixbot.com';
      }
    } catch (error) {
      console.error('Помилка визначення базового URL:', error);
      return '';
    }
  }

  // Отримання ID користувача
  getUserId() {
    try {
      // Спочатку перевіряємо глобальну функцію
      if (typeof window.getUserId === 'function') {
        const id = window.getUserId();
        if (this._isValidId(id)) return id;
      }

      // Перевіряємо WinixAPI
      if (window.WinixAPI && typeof window.WinixAPI.getUserId === 'function') {
        const id = window.WinixAPI.getUserId();
        if (this._isValidId(id)) return id;
      }

      // Перевіряємо localStorage
      if (window.localStorage) {
        const id = window.localStorage.getItem('telegram_user_id');
        if (this._isValidId(id)) return id;
      }

      // Перевіряємо URL параметри
      const urlParams = new URLSearchParams(window.location.search);
      const urlId = urlParams.get('id') || urlParams.get('user_id') || urlParams.get('telegram_id');
      if (this._isValidId(urlId)) return urlId;

      console.warn('ID користувача не знайдено');
      return null;
    } catch (error) {
      console.error('Помилка отримання ID користувача:', error);
      return null;
    }
  }

  // Перевірка валідності ID
  _isValidId(id) {
    return (
      id &&
      id !== 'undefined' &&
      id !== 'null' &&
      id !== undefined &&
      id !== null &&
      typeof id !== 'function' &&
      id.toString().trim() !== ''
    );
  }

  // Виконання запиту з кешуванням та повторними спробами
  async request(endpoint, options = {}) {
    const requestOptions = {
      ...this.defaultRequestOptions,
      ...options,
      method: options.method || 'GET',
    };

    // Повний URL для запиту
    const url = endpoint.startsWith('http')
      ? endpoint
      : this.baseUrl + '/' + endpoint.replace(/^\//, '');

    // Унікальний ключ запиту для кешування
    const cacheKey = cacheService.generateCacheKey(requestOptions.method, url, options.data || {});

    // Перевіряємо кеш для GET запитів
    if (requestOptions.method === 'GET' && requestOptions.useCache !== false) {
      const cachedData = cacheService.getCachedData(cacheKey);
      if (cachedData) return Promise.resolve(cachedData);
    }

    try {
      let attempt = 0;
      let lastError = null;

      while (attempt <= requestOptions.maxRetries) {
        attempt++;

        // Підготовка параметрів запиту
        const fetchOptions = {
          method: requestOptions.method,
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json',
            ...requestOptions.headers,
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

        // Створюємо AbortController для таймауту
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), requestOptions.timeout);
        fetchOptions.signal = controller.signal;

        try {
          // Виконуємо запит
          const response = await fetch(url, fetchOptions);
          clearTimeout(timeoutId);

          // Отримуємо JSON або порожній об'єкт при помилці
          let data;
          try {
            data = await response.json();
          } catch (e) {
            data = {
              status: response.ok ? 'success' : 'error',
              message: response.statusText || 'Помилка парсингу відповіді'
            };
          }

          // Додаємо HTTP статус
          data.httpStatus = response.status;

          if (response.ok) {
            // Кешуємо результат для GET запитів
            if (requestOptions.method === 'GET' && requestOptions.useCache !== false) {
              cacheService.cacheData(cacheKey, data);
            }
            return data;
          }

          // 4xx помилки (крім 429 - rate limit) не потребують повторних спроб
          if (response.status >= 400 && response.status < 500 && response.status !== 429) {
            lastError = new Error(data.message || 'Помилка запиту');
            lastError.response = data;
            break;
          }

          lastError = new Error(data.message || 'Помилка запиту');
          lastError.response = data;
        } catch (error) {
          clearTimeout(timeoutId);

          // Якщо це помилка таймауту, логуємо та продовжуємо спроби
          if (error.name === 'AbortError') {
            console.warn(`Таймаут запиту до ${endpoint} (спроба ${attempt}/${requestOptions.maxRetries})`);
            lastError = error;
            continue;
          }

          // Інші помилки fetch
          console.warn(`Помилка запиту до ${endpoint} (спроба ${attempt}/${requestOptions.maxRetries}):`, error.message);
          lastError = error;
        }

        // Якщо спроби не вичерпано - повторюємо
        if (attempt <= requestOptions.maxRetries) {
          await new Promise(resolve => setTimeout(resolve, requestOptions.retryDelay * Math.pow(1.5, attempt - 1)));
        }
      }

      // Всі спроби вичерпано
      if (lastError && lastError.name === 'AbortError') {
        return {
          status: 'error',
          message: 'Таймаут запиту',
          httpStatus: 0,
          errorCode: API_ERROR_CODES.TIMEOUT
        };
      }

      return {
        status: 'error',
        message: lastError?.message || 'Мережева помилка',
        httpStatus: lastError?.response?.httpStatus || 0,
        errorCode: API_ERROR_CODES.NETWORK_ERROR
      };
    } catch (error) {
      console.error(`Помилка запиту ${endpoint}:`, error);
      return {
        status: 'error',
        message: error.message || 'Сталася помилка при виконанні запиту',
        httpStatus: 0,
        errorCode: API_ERROR_CODES.NETWORK_ERROR
      };
    }
  }

  // Обгортка для HTTP GET запиту
  get(endpoint, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'GET',
    });
  }

  // Обгортка для HTTP POST запиту
  post(endpoint, data, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'POST',
      data,
    });
  }

  // Обгортка для HTTP PUT запиту
  put(endpoint, data, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'PUT',
      data,
    });
  }

  // Обгортка для HTTP DELETE запиту
  delete(endpoint, options = {}) {
    return this.request(endpoint, {
      ...options,
      method: 'DELETE',
    });
  }
}

// Створення екземплярів сервісів
const cacheService = new CacheService();
const requestService = new RequestService();

// API для щоденних бонусів
const dailyBonusApi = {
  // Отримання статусу щоденного бонусу
  getDailyBonusStatus: function(userId) {
    // Якщо ID не передано, спробуємо отримати його автоматично
    userId = userId || requestService.getUserId();

    if (!userId) {
      return Promise.resolve({
        success: false,
        error: 'ID користувача відсутній'
      });
    }

    // Виконуємо запит до API
    return requestService.post('/api/daily-bonus/status', { user_id: userId })
      .then(response => {
        if (response.status === 'error' || !response.success) {
          return {
            success: false,
            error: response.message || response.error || 'Помилка отримання статусу бонусу'
          };
        }

        return {
          success: true,
          data: response.data || {}
        };
      })
      .catch(error => {
        console.error('Помилка отримання статусу щоденного бонусу:', error);
        return {
          success: false,
          error: error.message || 'Помилка отримання статусу щоденного бонусу'
        };
      });
  },

  // Запит на нарахування щоденного бонусу
  claimDailyBonus: function(userId) {
    // Якщо ID не передано, спробуємо отримати його автоматично
    userId = userId || requestService.getUserId();

    if (!userId) {
      return Promise.resolve({
        success: false,
        error: 'ID користувача відсутній'
      });
    }

    // Виконуємо запит до API
    return requestService.post('/api/daily-bonus/claim', { user_id: userId })
      .then(response => {
        if (response.status === 'error' || !response.success) {
          return {
            success: false,
            error: response.message || response.error || 'Помилка отримання бонусу'
          };
        }

        return {
          success: true,
          data: response.data || {},
          amount: response.data?.reward?.amount || response.data?.amount || 0
        };
      })
      .catch(error => {
        console.error('Помилка отримання щоденного бонусу:', error);
        return {
          success: false,
          error: error.message || 'Помилка отримання щоденного бонусу'
        };
      });
  },

  // Отримання історії щоденних бонусів
  getDailyBonusHistory: function(userId, options) {
    // Якщо ID не передано, спробуємо отримати його автоматично
    userId = userId || requestService.getUserId();
    options = options || {};

    if (!userId) {
      return Promise.resolve({
        success: false,
        error: 'ID користувача відсутній'
      });
    }

    // Підготовка даних для запиту
    const requestData = {
      user_id: userId,
      limit: options.limit || 30,
      offset: options.offset || 0
    };

    // Виконуємо запит до API
    return requestService.post('/api/daily-bonus/history', requestData)
      .then(response => {
        if (response.status === 'error' || !response.success) {
          return {
            success: false,
            error: response.message || response.error || 'Помилка отримання історії бонусів'
          };
        }

        return {
          success: true,
          data: response.data || {},
          history: response.data?.history || []
        };
      })
      .catch(error => {
        console.error('Помилка отримання історії щоденних бонусів:', error);
        return {
          success: false,
          error: error.message || 'Помилка отримання історії щоденних бонусів'
        };
      });
  }
};

// TaskService - основні операції з завданнями
const taskService = {
  // Завантаження всіх завдань з сервера
  loadAllTasks: function(options) {
    options = options || {};

    // Перевіряємо ID користувача
    const userId = requestService.getUserId();
    if (!userId) {
      return Promise.resolve({
        status: 'error',
        message: 'ID користувача відсутній'
      });
    }

    // Якщо задано параметр обходу кешу
    if (!options.forceRefresh) {
      // Спробуємо знайти в кеші
      const cachedTasks = cacheService.getCachedData('all_tasks_data');
      if (cachedTasks) {
        return Promise.resolve(cachedTasks);
      }
    }

    // Завантажуємо різні типи завдань паралельно
    const promises = [
      requestService.get(CONFIG.API_PATHS.TASKS.SOCIAL),
      requestService.get(CONFIG.API_PATHS.TASKS.LIMITED),
      requestService.get(CONFIG.API_PATHS.TASKS.PARTNER),
      requestService.get(CONFIG.API_PATHS.USER_PROGRESS(userId))
    ];

    return Promise.all(promises)
      .then(([socialTasksResponse, limitedTasksResponse, partnerTasksResponse, userProgressResponse]) => {
        // Формуємо загальний результат
        const result = {
          social: socialTasksResponse.data || [],
          limited: limitedTasksResponse.data || [],
          partner: partnerTasksResponse.data || [],
          userProgress: userProgressResponse.data || {}
        };

        // Кешуємо результат
        cacheService.cacheData('all_tasks_data', result);

        return result;
      })
      .catch(error => {
        console.error('Помилка завантаження завдань:', error);
        return {
          status: 'error',
          message: 'Не вдалося завантажити завдання',
          error: error.message
        };
      });
  },

  // Інші методи TaskService...
};

// Головний об'єкт API
const taskApi = {
  // Версія API
  version: API_VERSION,

  // Конфігурація
  config: CONFIG,

  // Базові сервіси
  request: requestService,
  cache: cacheService,

  // API щоденних бонусів
  dailyBonus: dailyBonusApi,

  // API завдань
  tasks: taskService,

  // Методи ініціалізації
  init: function(options) {
    // Якщо вже ініціалізовано, просто повертаємо this
    if (this._initialized) return this;

    // Логуємо ініціалізацію
    console.log(`🔄 Task API: Ініціалізація модуля завдань v${this.version}`);

    // Можемо оновити конфігурацію, якщо потрібно
    if (options && options.apiPaths) {
      Object.assign(CONFIG.API_PATHS, options.apiPaths);
    }

    // Генеруємо подію ініціалізації
    if (typeof document !== 'undefined') {
      document.dispatchEvent(
        new CustomEvent('task-api-initialized', {
          detail: {
            timestamp: Date.now(),
            version: this.version,
          },
        })
      );
    }

    // Позначаємо, що ініціалізовано
    this._initialized = true;

    return this;
  },

  // Методи зручного доступу
  getUserId: function() {
    return requestService.getUserId();
  },

  clearCache: function() {
    cacheService.clearCache();
    console.log('✓ Task API: Кеш очищено');
  },

  // Зручні методи для роботи з завданнями
  getAllTasks: function(options) {
    return taskService.loadAllTasks(options);
  },

  // Методи щоденного бонусу
  getDailyBonusStatus: function(userId) {
    return dailyBonusApi.getDailyBonusStatus(userId);
  },

  claimDailyBonus: function(userId) {
    return dailyBonusApi.claimDailyBonus(userId);
  }
};

// Експортуємо екземпляри сервісів
export {
  cacheService,
  requestService,
  CONFIG,
  API_VERSION,
  API_ERROR_CODES,
  dailyBonusApi
};

// Експорт за замовчуванням
export default taskApi;

// Для сумісності з глобальним простором
if (typeof window !== 'undefined') {
  window.TaskAPI = taskApi;

  // Також робимо доступними окремі компоненти
  window.TaskAPI.requestService = requestService;
  window.TaskAPI.cacheService = cacheService;
  window.TaskAPI.dailyBonusApi = dailyBonusApi;

  // Сумісність зі старими викликами
  window.taskApi = taskApi;
}