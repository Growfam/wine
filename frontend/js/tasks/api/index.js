/**
 * Головний модуль API завдань
 *
 * Виправлена версія для вирішення проблем із циклічними залежностями
 * та ES6 модулями
 *
 * @version 3.2.0
 */

// Створюємо єдину точку входу для API, яка не залежить від циклічних залежностей
(function(global) {
  'use strict';

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
  const cacheService = {
    cache: new Map(),
    cacheTimestamps: new Map(),

    getCachedData: function(key) {
      if (this.cache.has(key) && this.cacheTimestamps.has(key)) {
        const timestamp = this.cacheTimestamps.get(key);
        if (Date.now() - timestamp < CONFIG.REQUEST_CACHE_TTL) {
          return this.cache.get(key);
        }
      }
      return null;
    },

    cacheData: function(key, data) {
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
    },

    clearCache: function(keyPattern) {
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
    },

    generateCacheKey: function(method, url, data) {
      return method + '_' + url + '_' + JSON.stringify(data || {});
    }
  };

  // Базовий сервіс запитів
  const requestService = {
    baseUrl: null,
    defaultRequestOptions: {
      timeout: CONFIG.REQUEST_TIMEOUT,
      maxRetries: CONFIG.MAX_VERIFICATION_ATTEMPTS,
      retryDelay: CONFIG.RETRY_INTERVAL
    },

    // Ініціалізація з визначенням базового URL
    init: function() {
      this.baseUrl = this.detectBaseUrl();
      return this;
    },

    // Визначення базового URL API
    detectBaseUrl: function() {
      try {
        // Спочатку перевіряємо WinixAPI
        if (global.WinixAPI && global.WinixAPI.config && global.WinixAPI.config.baseUrl) {
          return global.WinixAPI.config.baseUrl.replace(/\/$/, '');
        }

        // Альтернативно визначаємо за поточним хостом
        const hostname = global.location.hostname;

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
    },

    // Отримання ID користувача
    getUserId: function() {
      try {
        // Спочатку перевіряємо глобальну функцію
        if (typeof global.getUserId === 'function') {
          const id = global.getUserId();
          if (this.isValidId(id)) return id;
        }

        // Перевіряємо WinixAPI
        if (global.WinixAPI && typeof global.WinixAPI.getUserId === 'function') {
          const id = global.WinixAPI.getUserId();
          if (this.isValidId(id)) return id;
        }

        // Перевіряємо localStorage
        if (global.localStorage) {
          const id = global.localStorage.getItem('telegram_user_id');
          if (this.isValidId(id)) return id;
        }

        // Перевіряємо URL параметри
        const urlParams = new URLSearchParams(global.location.search);
        const urlId = urlParams.get('id') || urlParams.get('user_id') || urlParams.get('telegram_id');
        if (this.isValidId(urlId)) return urlId;

        console.warn('ID користувача не знайдено');
        return null;
      } catch (error) {
        console.error('Помилка отримання ID користувача:', error);
        return null;
      }
    },

    // Перевірка валідності ID
    isValidId: function(id) {
      return (
        id &&
        id !== 'undefined' &&
        id !== 'null' &&
        id !== undefined &&
        id !== null &&
        typeof id !== 'function' &&
        id.toString().trim() !== ''
      );
    },

    // Виконання запиту з кешуванням та повторними спробами
    request: function(endpoint, options) {
      options = options || {};

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

      return new Promise((resolve, reject) => {
        let attempt = 0;
        let lastError = null;

        const doRequest = () => {
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

          // Виконуємо запит
          fetch(url, fetchOptions)
            .then(response => {
              clearTimeout(timeoutId);

              // Отримуємо JSON або порожній об'єкт при помилці
              return response.json()
                .then(data => {
                  return {
                    data,
                    status: response.status,
                    ok: response.ok
                  };
                })
                .catch(() => {
                  return {
                    data: {
                      status: response.ok ? 'success' : 'error',
                      message: response.statusText || 'Помилка парсингу відповіді'
                    },
                    status: response.status,
                    ok: response.ok
                  };
                });
            })
            .then(result => {
              const { data, status, ok } = result;

              // Додаємо HTTP статус
              data.httpStatus = status;

              if (ok) {
                // Кешуємо результат для GET запитів
                if (requestOptions.method === 'GET' && requestOptions.useCache !== false) {
                  cacheService.cacheData(cacheKey, data);
                }
                resolve(data);
              } else {
                // 4xx помилки (крім 429 - rate limit) не потребують повторних спроб
                if (status >= 400 && status < 500 && status !== 429) {
                  const error = new Error(data.message || 'Помилка запиту');
                  error.response = data;
                  reject(error);
                  return;
                }

                lastError = new Error(data.message || 'Помилка запиту');
                lastError.response = data;

                // Якщо спроби не вичерпано - повторюємо
                if (attempt < requestOptions.maxRetries) {
                  setTimeout(doRequest, requestOptions.retryDelay * Math.pow(1.5, attempt - 1));
                } else {
                  // Всі спроби вичерпано
                  reject(lastError);
                }
              }
            })
            .catch(error => {
              clearTimeout(timeoutId);

              // Якщо це помилка таймауту, логуємо та продовжуємо спроби
              if (error.name === 'AbortError') {
                console.warn(`Таймаут запиту до ${endpoint} (спроба ${attempt}/${requestOptions.maxRetries})`);
                lastError = error;

                // Якщо спроби не вичерпано - повторюємо
                if (attempt < requestOptions.maxRetries) {
                  setTimeout(doRequest, requestOptions.retryDelay * Math.pow(1.5, attempt - 1));
                } else {
                  // Всі спроби вичерпано
                  const timeoutError = {
                    status: 'error',
                    message: 'Таймаут запиту',
                    httpStatus: 0,
                    errorCode: API_ERROR_CODES.TIMEOUT
                  };
                  resolve(timeoutError);
                }
                return;
              }

              // Інші помилки fetch
              console.warn(`Помилка запиту до ${endpoint} (спроба ${attempt}/${requestOptions.maxRetries}):`, error.message);

              lastError = error;

              // Якщо спроби не вичерпано - повторюємо
              if (attempt < requestOptions.maxRetries) {
                setTimeout(doRequest, requestOptions.retryDelay * Math.pow(1.5, attempt - 1));
              } else {
                // Всі спроби вичерпано
                const networkError = {
                  status: 'error',
                  message: error.message || 'Мережева помилка',
                  httpStatus: 0,
                  errorCode: API_ERROR_CODES.NETWORK_ERROR
                };
                resolve(networkError);
              }
            });
        };

        // Запускаємо першу спробу
        doRequest();
      });
    },

    // Обгортка для HTTP GET запиту
    get: function(endpoint, options) {
      return this.request(endpoint, {
        ...options,
        method: 'GET',
      });
    },

    // Обгортка для HTTP POST запиту
    post: function(endpoint, data, options) {
      return this.request(endpoint, {
        ...options,
        method: 'POST',
        data,
      });
    },

    // Обгортка для HTTP PUT запиту
    put: function(endpoint, data, options) {
      return this.request(endpoint, {
        ...options,
        method: 'PUT',
        data,
      });
    },

    // Обгортка для HTTP DELETE запиту
    delete: function(endpoint, options) {
      return this.request(endpoint, {
        ...options,
        method: 'DELETE',
      });
    }
  };

  // Ініціалізуємо requestService
  requestService.init();

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

    // Завантаження завдань певного типу
    loadTasksByType: function(type, options) {
      options = options || {};

      const cacheKey = 'tasks_' + type;

      // Перевіряємо кеш, якщо не вимагається обійти його
      if (!options.forceRefresh) {
        const cachedTasks = cacheService.getCachedData(cacheKey);
        if (cachedTasks) {
          return Promise.resolve(cachedTasks);
        }
      }

      // Визначаємо ендпоінт на основі типу
      let endpoint;
      switch (type) {
        case 'social':
          endpoint = CONFIG.API_PATHS.TASKS.SOCIAL;
          break;
        case 'limited':
          endpoint = CONFIG.API_PATHS.TASKS.LIMITED;
          break;
        case 'partner':
          endpoint = CONFIG.API_PATHS.TASKS.PARTNER;
          break;
        case 'referral':
          endpoint = CONFIG.API_PATHS.TASKS.REFERRAL;
          break;
        default:
          endpoint = CONFIG.API_PATHS.TASKS.BY_TYPE(type);
      }

      return requestService.get(endpoint)
        .then(response => {
          // Кешуємо результат
          if (response.status === 'success') {
            cacheService.cacheData(cacheKey, response);
          }

          return response;
        })
        .catch(error => {
          console.error(`Помилка завантаження завдань типу ${type}:`, error);
          return {
            status: 'error',
            message: `Не вдалося завантажити завдання типу ${type}`,
            error: error.message
          };
        });
    },

    // Отримання даних одного завдання
    getTaskDetails: function(taskId, options) {
      options = options || {};

      if (!taskId) {
        return Promise.resolve({
          status: 'error',
          message: 'Не вказано ID завдання'
        });
      }

      // Перевіряємо у кеші
      const cacheKey = 'task_data_' + taskId;

      if (!options.forceRefresh) {
        const cachedTask = cacheService.getCachedData(cacheKey);
        if (cachedTask) {
          return Promise.resolve(cachedTask);
        }
      }

      // Завантажуємо з сервера
      return requestService.get(CONFIG.API_PATHS.TASKS.DETAILS(taskId))
        .then(response => {
          if (response.status === 'success' && response.data) {
            // Кешуємо результат
            cacheService.cacheData(cacheKey, response.data);
            return response.data;
          }

          return response;
        })
        .catch(error => {
          console.error(`Помилка отримання даних завдання ${taskId}:`, error);
          return {
            status: 'error',
            message: `Не вдалося отримати дані завдання ${taskId}`,
            error: error.message
          };
        });
    }
  };

  // ActionService - модуль для виконання операцій із завданнями
  const actionService = {
    // Початок виконання завдання
    startTask: function(taskId, options) {
      options = options || {};

      if (!taskId) {
        return Promise.resolve({
          status: 'error',
          message: 'Не вказано ID завдання'
        });
      }

      const userId = requestService.getUserId();
      if (!userId) {
        return Promise.resolve({
          status: 'error',
          message: 'ID користувача відсутній'
        });
      }

      // Формуємо URL для запиту
      const endpoint = CONFIG.API_PATHS.TASKS.START(taskId);

      // Підготовка даних для запиту
      const data = {
        user_id: userId,
        task_id: taskId,
        timestamp: Date.now(),
        ...options.additionalData
      };

      // Виконуємо запит
      return requestService.post(endpoint, data)
        .then(response => {
          // Очищуємо кеш для цього завдання
          clearTaskRelatedCache(taskId);

          // Генеруємо подію для відстеження
          triggerTaskEvent('task-started', {
            taskId,
            userId,
            timestamp: Date.now(),
            response
          });

          return response;
        })
        .catch(error => {
          console.error(`Помилка запуску завдання ${taskId}:`, error);
          return {
            status: 'error',
            message: 'Не вдалося запустити завдання',
            error: error.message
          };
        });
    },

    // Верифікація виконання завдання
    verifyTask: function(taskId, verificationData, options) {
      verificationData = verificationData || {};
      options = options || {};

      if (!taskId) {
        return Promise.resolve({
          status: 'error',
          message: 'Не вказано ID завдання'
        });
      }

      const userId = requestService.getUserId();
      if (!userId) {
        return Promise.resolve({
          status: 'error',
          message: 'ID користувача відсутній'
        });
      }

      // Додаємо службові дані
      const fullVerificationData = {
        user_id: userId,
        task_id: taskId,
        timestamp: Date.now(),
        ...verificationData
      };

      // Формуємо URL для запиту
      const endpoint = CONFIG.API_PATHS.TASKS.VERIFICATION(taskId);

      // Виконуємо запит
      return requestService.post(endpoint, fullVerificationData, options)
        .then(response => {
          // Очищуємо кеш для цього завдання
          clearTaskRelatedCache(taskId);
          cacheService.clearCache('all_tasks_data');

          // Генеруємо подію для відстеження
          triggerTaskEvent('task-verified', {
            taskId,
            userId,
            timestamp: Date.now(),
            response,
            success: response.status === 'success'
          });

          return response;
        })
        .catch(error => {
          console.error(`Помилка верифікації завдання ${taskId}:`, error);
          return {
            status: 'error',
            message: 'Не вдалося верифікувати завдання',
            error: error.message
          };
        });
    },

    // Оновлення прогресу завдання
    updateTaskProgress: function(taskId, progressData, options) {
      progressData = progressData || {};
      options = options || {};

      if (!taskId) {
        return Promise.resolve({
          status: 'error',
          message: 'Не вказано ID завдання'
        });
      }

      const userId = requestService.getUserId();
      if (!userId) {
        return Promise.resolve({
          status: 'error',
          message: 'ID користувача відсутній'
        });
      }

      // Додаємо службові дані
      const fullProgressData = {
        user_id: userId,
        task_id: taskId,
        timestamp: Date.now(),
        ...progressData
      };

      // Формуємо URL для запиту
      const endpoint = CONFIG.API_PATHS.TASKS.PROGRESS(taskId);

      // Виконуємо запит
      return requestService.post(endpoint, fullProgressData, options)
        .then(response => {
          // Очищуємо кеш для цього завдання
          cacheService.clearCache('task_progress_' + taskId);

          // Генеруємо подію оновлення прогресу
          triggerTaskEvent('task-progress-updated', {
            taskId,
            userId,
            timestamp: Date.now(),
            progress: progressData,
            response
          });

          return response;
        })
        .catch(error => {
          console.error(`Помилка оновлення прогресу завдання ${taskId}:`, error);
          return {
            status: 'error',
            message: 'Не вдалося оновити прогрес завдання',
            error: error.message
          };
        });
    }
  };

  // Допоміжні функції

  // Очищення кешу для завдання
  function clearTaskRelatedCache(taskId) {
    cacheService.clearCache('task_progress_' + taskId);
    cacheService.clearCache('task_status_' + taskId);
    cacheService.clearCache('task_data_' + taskId);
  }

  // Генерування подій для системи
  function triggerTaskEvent(eventName, eventData) {
    if (typeof document !== 'undefined') {
      document.dispatchEvent(
        new CustomEvent(eventName, {
          detail: eventData
        })
      );
    }
  }

  // Створюємо головний об'єкт API
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

    // API дій
    actions: actionService,

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

    // Отримання ID користувача
    getUserId: function() {
      return requestService.getUserId();
    },

    // Очищення всього кешу API
    clearCache: function() {
      cacheService.clearCache();
      console.log('✓ Task API: Кеш очищено');
    },

    // Зручні методи для роботи з завданнями
    getAllTasks: function(options) {
      return taskService.loadAllTasks(options);
    },

    getTasksByType: function(type, options) {
      return taskService.loadTasksByType(type, options);
    },

    getTaskDetails: function(taskId, options) {
      return taskService.getTaskDetails(taskId, options);
    },

    startTask: function(taskId, options) {
      return actionService.startTask(taskId, options);
    },

    verifyTask: function(taskId, verificationData, options) {
      return actionService.verifyTask(taskId, verificationData, options);
    },

    updateTaskProgress: function(taskId, progressData, options) {
      return actionService.updateTaskProgress(taskId, progressData, options);
    },

    // Методи щоденного бонусу
    getDailyBonusStatus: function(userId) {
      return dailyBonusApi.getDailyBonusStatus(userId);
    },

    claimDailyBonus: function(userId) {
      return dailyBonusApi.claimDailyBonus(userId);
    },

    getDailyBonusHistory: function(userId, options) {
      return dailyBonusApi.getDailyBonusHistory(userId, options);
    }
  };

  // Експортуємо в глобальний простір
  global.TaskAPI = taskApi;

  // Також робимо доступними окремі компоненти
  global.TaskAPI.requestService = requestService;
  global.TaskAPI.cacheService = cacheService;
  global.TaskAPI.dailyBonusApi = dailyBonusApi;

  // Автоматична ініціалізація при завантаженні сторінки
  if (typeof document !== 'undefined') {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => taskApi.init());
    } else {
      // DOM вже завантажено
      setTimeout(() => taskApi.init(), 0);
    }
  }

  // Сумісність зі старими викликами (для модуля завдань)
  global.taskApi = taskApi;

  // Реєструємо в системі модулів Winix, якщо вона є
  if (global.WinixModules && typeof global.WinixModules.register === 'function') {
    global.WinixModules.register('taskApi', taskApi);
  }

})(typeof window !== 'undefined' ? window : this);