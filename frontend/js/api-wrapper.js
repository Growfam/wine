/**
 * api-wrapper.js - Обгортка для надійної ініціалізації API модуля
 * Забезпечує надійну роботу з API навіть при проблемах ініціалізації
 * @version 1.0.0
 */

(function() {
  'use strict';

  // Приватні змінні
  let _isInitialized = false;
  let _isInitializing = false;
  let _apiInitPromise = null;
  let _initRetryCount = 0;
  let _maxRetryAttempts = 5;
  let _retryDelay = 1500;
  let _originalApi = null;
  let _offlineMode = false;
  let _fallbackData = {};

  /**
   * Логування з часовою міткою та форматуванням
   */
  function log(message, level = 'log') {
    const timestamp = new Date().toISOString().substring(11, 19);
    const prefix = `[${timestamp}] [APIWrapper]`;

    switch (level) {
      case 'error':
        console.error(`❌ ${prefix} ${message}`);
        break;
      case 'warn':
        console.warn(`⚠️ ${prefix} ${message}`);
        break;
      case 'success':
        console.log(`✅ ${prefix} ${message}`);
        break;
      default:
        console.log(`🔄 ${prefix} ${message}`);
    }
  }

  /**
   * Перевірка наявності API модуля
   */
  function checkApiModule() {
    return (window.WinixAPI !== undefined &&
      typeof window.WinixAPI.apiRequest === 'function' &&
      typeof window.WinixAPI.getUserId === 'function');
  }

  /**
   * Перевірка та збереження оригінального API
   */
  function saveOriginalApi() {
    if (checkApiModule() && !_originalApi) {
      _originalApi = {
        api: window.WinixAPI,
        apiRequest: window.apiRequest,
        getUserId: window.getUserId
      };
      return true;
    }
    return false;
  }

  /**
   * Створення безпечних версій API функцій
   * які працюватимуть навіть якщо API не ініціалізоване
   */
  function createSafeApiFunctions() {
    // Заміщення глобальних функцій безпечними версіями
    window.apiRequest = safeApiRequest;
    window.getUserId = safeGetUserId;

    // Створення безпечної обгортки для WinixAPI
    window.WinixAPI = createSafeApiWrapper();

    log("Створено безпечні версії API функцій");
  }

  /**
   * Безпечна версія apiRequest
   */
  async function safeApiRequest(endpoint, method = 'GET', data = null, options = {}) {
    if (_isInitialized && _originalApi && _originalApi.api) {
      try {
        return await _originalApi.api.apiRequest(endpoint, method, data, options);
      } catch (error) {
        log(`Помилка оригінального apiRequest: ${error.message}`, 'error');

        // Якщо помилка пов'язана з авторизацією, спробуємо переініціалізувати API
        if (error.message &&
            (error.message.includes('авториза') || error.message.includes('auth'))) {
          await initApi(true);

          // Повторна спроба після переініціалізації
          return _originalApi.api.apiRequest(endpoint, method, data, options);
        }

        throw error;
      }
    } else if (_offlineMode) {
      log(`API запит в офлайн режимі: ${endpoint}`, 'warn');

      // Повертаємо заглушку або кешовані дані
      return generateFallbackResponse(endpoint, method, data);
    } else {
      try {
        log(`API ще не ініціалізоване, спроба ініціалізації...`);

        // Спроба ініціалізації API
        await initApi();

        if (_isInitialized && _originalApi && _originalApi.api) {
          return await _originalApi.api.apiRequest(endpoint, method, data, options);
        } else {
          throw new Error("Не вдалося ініціалізувати API");
        }
      } catch (error) {
        log(`Помилка API запиту ${endpoint}: ${error.message}`, 'error');

        // Генеруємо відповідь-заглушку
        return generateFallbackResponse(endpoint, method, data);
      }
    }
  }

  /**
   * Безпечна версія getUserId
   */
  function safeGetUserId() {
    // Спочатку пробуємо отримати ID через AppInitializer
    if (window.AppInitializer && typeof window.AppInitializer.getUserId === 'function') {
      try {
        // getUserId в AppInitializer повертає проміс, але ми тут очікуємо синхронну функцію
        // тому повертатимемо результат синхронно, а проміс запустимо асинхронно
        window.AppInitializer.getUserId().then(userId => {
          if (userId) {
            try {
              localStorage.setItem('telegram_user_id', userId);
            } catch (e) {}
          }
        });
      } catch (e) {}
    }

    // Якщо API ініціалізоване, використовуємо оригінальну функцію
    if (_isInitialized && _originalApi && _originalApi.getUserId) {
      try {
        return _originalApi.getUserId();
      } catch (error) {
        log(`Помилка оригінального getUserId: ${error.message}`, 'error');
      }
    }

    // Якщо не вдалося отримати ID через API, використовуємо власну логіку
    try {
      // 1. Спробуємо отримати ID з Telegram WebApp
      if (window.Telegram && window.Telegram.WebApp &&
          window.Telegram.WebApp.initDataUnsafe &&
          window.Telegram.WebApp.initDataUnsafe.user &&
          window.Telegram.WebApp.initDataUnsafe.user.id) {

        const id = window.Telegram.WebApp.initDataUnsafe.user.id.toString();
        log(`Отримано ID користувача з Telegram WebApp: ${id}`, 'success');
        return id;
      }

      // 2. Спробуємо отримати ID з localStorage
      const storedId = localStorage.getItem('telegram_user_id') || localStorage.getItem('user_id');
      if (storedId && storedId !== 'undefined' && storedId !== 'null') {
        log(`Отримано ID користувача з localStorage: ${storedId}`, 'success');
        return storedId;
      }

      // 3. Спробуємо отримати ID з DOM
      const headerUserIdElement = document.getElementById('header-user-id');
      if (headerUserIdElement && headerUserIdElement.textContent) {
        const id = headerUserIdElement.textContent.trim();
        if (id && id !== 'undefined' && id !== 'null') {
          log(`Отримано ID користувача з DOM (header): ${id}`, 'success');
          return id;
        }
      }

      const userIdElement = document.getElementById('user-id');
      if (userIdElement && userIdElement.textContent) {
        const id = userIdElement.textContent.trim();
        if (id && id !== 'undefined' && id !== 'null') {
          log(`Отримано ID користувача з DOM (hidden): ${id}`, 'success');
          return id;
        }
      }

      // 4. Спробуємо отримати ID з URL
      const urlParams = new URLSearchParams(window.location.search);
      const urlId = urlParams.get('id') || urlParams.get('user_id') || urlParams.get('telegram_id');
      if (urlId && urlId !== 'undefined' && urlId !== 'null') {
        log(`Отримано ID користувача з URL: ${urlId}`, 'success');
        return urlId;
      }

      // 5. Якщо не знайдено і це сторінка налаштувань - використовуємо тестовий ID
      const isSettingsPage = window.location.pathname.includes('general.html');
      if (isSettingsPage) {
        const testId = "7066583465";
        log(`Використовуємо тестовий ID для сторінки налаштувань: ${testId}`, 'warn');
        return testId;
      }

      log("Не вдалося отримати ID користувача", 'error');
      return null;
    } catch (error) {
      log(`Критична помилка отримання ID користувача: ${error.message}`, 'error');
      return null;
    }
  }

  /**
   * Створює обгортку для WinixAPI, яка гарантує безпечну роботу
   */
  function createSafeApiWrapper() {
    const apiWrapper = {};

    // Базові шаблонні методи
    const defaultMethods = {
      // Методи користувача
      getUserData: async function(forceRefresh = false) {
        if (_isInitialized && _originalApi && _originalApi.api) {
          try {
            return await _originalApi.api.getUserData(forceRefresh);
          } catch (error) {
            log(`Помилка getUserData: ${error.message}`, 'error');
          }
        }

        // Повертаємо кешовані дані або заглушку
        return {
          status: 'success',
          data: getFallbackUserData(),
          source: 'fallback',
          fallback: true
        };
      },
      getBalance: async function() {
        if (_isInitialized && _originalApi && _originalApi.api) {
          try {
            return await _originalApi.api.getBalance();
          } catch (error) {
            log(`Помилка getBalance: ${error.message}`, 'error');
          }
        }

        // Повертаємо кешовані дані або заглушку
        return {
          status: 'success',
          data: {
            balance: parseFloat(localStorage.getItem('userTokens') || '0'),
            coins: parseInt(localStorage.getItem('userCoins') || '0')
          },
          source: 'fallback',
          fallback: true
        };
      },

      // Утиліти
      clearCache: function() {
        if (_isInitialized && _originalApi && _originalApi.api &&
            typeof _originalApi.api.clearCache === 'function') {
          return _originalApi.api.clearCache();
        }
        return false;
      },
      forceCleanupRequests: function() {
        if (_isInitialized && _originalApi && _originalApi.api &&
            typeof _originalApi.api.forceCleanupRequests === 'function') {
          return _originalApi.api.forceCleanupRequests();
        }
        return false;
      },
      reconnect: async function() {
        if (_isInitialized && _originalApi && _originalApi.api &&
            typeof _originalApi.api.reconnect === 'function') {
          return await _originalApi.api.reconnect();
        }

        // Спробуємо переініціалізувати API
        return await initApi(true);
      },

      // Інші методи
      paths: API_PATHS,
      config: {
        baseUrl: getBaseUrl(),
        version: '1.2.5-safe',
        environment: 'safe-mode'
      }
    };

    // Додаємо базові методи до обгортки
    for (const methodName in defaultMethods) {
      apiWrapper[methodName] = defaultMethods[methodName];
    }

    // Якщо оригінальний API існує, копіюємо всі методи
    if (_originalApi && _originalApi.api) {
      for (const methodName in _originalApi.api) {
        if (!apiWrapper[methodName]) {
          // Створюємо безпечну обгортку для методу
          apiWrapper[methodName] = async function(...args) {
            if (_isInitialized && _originalApi && _originalApi.api &&
                typeof _originalApi.api[methodName] === 'function') {
              try {
                return await _originalApi.api[methodName](...args);
              } catch (error) {
                log(`Помилка методу ${methodName}: ${error.message}`, 'error');

                // Якщо помилка пов'язана з авторизацією, спробуємо переініціалізувати API
                if (error.message &&
                    (error.message.includes('авториза') || error.message.includes('auth'))) {
                  await initApi(true);

                  // Повторна спроба після переініціалізації
                  if (_isInitialized && _originalApi && _originalApi.api &&
                      typeof _originalApi.api[methodName] === 'function') {
                    return await _originalApi.api[methodName](...args);
                  }
                }

                throw error;
              }
            } else {
              // Якщо метод не існує або API не ініціалізоване
              log(`Метод ${methodName} недоступний (API не ініціалізоване)`, 'warn');
              throw new Error(`API не ініціалізоване або метод ${methodName} недоступний`);
            }
          };
        }
      }
    }

    return apiWrapper;
  }

  /**
   * Константи API-шляхів (копія з оригінального API)
   */
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
    TRANSACTIONS: (userId) => `user/${userId}/transactions`
  };

  /**
   * Генерує базовий URL для API
   */
  function getBaseUrl() {
    const hostname = window.location.hostname;

    if (hostname === 'localhost' || hostname === '127.0.0.1') {
      return `http://${hostname}:8080`;
    } else if (hostname.includes('testenv') || hostname.includes('staging')) {
      return `https://${hostname}`;
    } else {
      return 'https://winixbot.com';
    }
  }

  /**
   * Генерує базові дані користувача
   */
  function getFallbackUserData() {
    // Спочатку зберігаємо дані з localStorage
    const storedData = {};

    try {
      const userDataJson = localStorage.getItem('userData');
      if (userDataJson) {
        const userData = JSON.parse(userDataJson);
        Object.assign(storedData, userData);
      }
    } catch (e) {}

    // Створюємо базові дані користувача
    const userId = safeGetUserId() || 'unknown';
    return {
      telegram_id: userId,
      username: storedData.username || localStorage.getItem('username') || 'User',
      balance: parseFloat(storedData.balance || localStorage.getItem('userTokens') || '0'),
      coins: parseInt(storedData.coins || localStorage.getItem('userCoins') || '0'),
      notifications_enabled: storedData.notifications_enabled !== undefined
        ? storedData.notifications_enabled
        : localStorage.getItem('notifications_enabled') === 'true',
      source: 'localStorage_fallback'
    };
  }

  /**
   * Генерує відповідь-заглушку для API запитів
   */
  function generateFallbackResponse(endpoint, method, data) {
    if (safeIncludes(endpoint, '/user/') &&
        (safeIncludes(endpoint, '/data') || endpoint.endsWith('/user'))) {
      return {
        status: 'success',
        data: getFallbackUserData(),
        source: 'fallback',
        fallback: true
      };
    }

    if (safeIncludes(endpoint, '/balance')) {
      return {
        status: 'success',
        data: {
          balance: parseFloat(localStorage.getItem('userTokens') || '0'),
          coins: parseInt(localStorage.getItem('userCoins') || '0')
        },
        source: 'fallback',
        fallback: true
      };
    }

    if (safeIncludes(endpoint, '/daily-bonus')) {
      return {
        status: 'success',
        data: {
          day: 1,
          canClaim: true,
          nextBonus: 25,
          streakDays: 1,
          lastClaimed: new Date().toISOString()
        },
        source: 'fallback',
        fallback: true
      };
    }

    if (safeIncludes(endpoint, '/tasks')) {
      return {
        status: 'success',
        data: [],
        source: 'fallback',
        fallback: true
      };
    }

    // Базова відповідь для інших запитів
    return {
      status: 'error',
      message: 'API недоступне. Спробуйте пізніше.',
      source: 'fallback',
      fallback: true,
      offline: true
    };
  }

  /**
   * Перевірка, чи містить рядок певний підрядок (безпечна)
   */
  function safeIncludes(str, substring) {
    if (!str || typeof str !== 'string') return false;
    return str.includes(substring);
  }

  /**
   * Ініціалізація API модуля
   * @param {boolean} forceRefresh - Примусова переініціалізація
   * @returns {Promise} Проміс, що вирішується після ініціалізації
   */
  async function initApi(forceRefresh = false) {
    // Якщо API вже ініціалізоване і не потрібна примусова переініціалізація
    if (_isInitialized && !forceRefresh) {
      return _apiInitPromise;
    }

    // Якщо API вже ініціалізується, повертаємо поточний проміс
    if (_isInitializing && _apiInitPromise) {
      return _apiInitPromise;
    }

    // Створюємо проміс для відстеження стану ініціалізації
    _isInitializing = true;
    _apiInitPromise = new Promise(async (resolve, reject) => {
      try {
        log(`Початок ініціалізації API модуля ${forceRefresh ? '(примусова)' : ''}`);

        // Спочатку зберігаємо оригінальний API, якщо він існує
        saveOriginalApi();

        // Перевіряємо наявність API модуля
        if (!checkApiModule()) {
          // Перевіряємо, чи завантажена сторінка і чи є скрипт API
          const apiScript = document.querySelector('script[src*="tasks-api.js"]');

          if (!apiScript) {
            log("Скрипт API не знайдено на сторінці. Спроба завантаження...", 'warn');

            // Створюємо та додаємо скрипт API
            const script = document.createElement('script');
            script.src = '/js/tasks-api.js';
            script.async = true;

            // Очікуємо завантаження скрипту
            const scriptLoadPromise = new Promise((resolveScript, rejectScript) => {
              script.onload = resolveScript;
              script.onerror = () => rejectScript(new Error("Не вдалося завантажити скрипт API"));
            });

            document.head.appendChild(script);

            try {
              await scriptLoadPromise;
              log("Скрипт API успішно завантажено", 'success');
            } catch (error) {
              log(`Помилка завантаження скрипту API: ${error.message}`, 'error');
              throw error;
            }
          }

          // Чекаємо 1 секунду, щоб скрипт встиг ініціалізуватися
          await new Promise(resolveTimeout => setTimeout(resolveTimeout, 1000));

          // Перевіряємо API після очікування
          if (!checkApiModule()) {
            log("API модуль не доступний навіть після очікування", 'error');

            // Спробуємо ще раз, якщо не вичерпано кількість спроб
            if (_initRetryCount < _maxRetryAttempts) {
              _initRetryCount++;
              log(`Повторна спроба ініціалізації API (${_initRetryCount}/${_maxRetryAttempts})...`, 'warn');

              // Повторна спроба з експоненційною затримкою
              const retryDelay = _retryDelay * Math.pow(1.5, _initRetryCount - 1);
              setTimeout(() => {
                _isInitializing = false;
                initApi(true).then(resolve).catch(reject);
              }, retryDelay);

              return;
            } else {
              // Вичерпано кількість спроб, переходимо в офлайн режим
              log("Вичерпано максимальну кількість спроб ініціалізації API", 'error');
              _offlineMode = true;
              createSafeApiFunctions();
              throw new Error("API модуль недоступний навіть після всіх спроб");
            }
          }

          // Зберігаємо посилання на API після успішного завантаження
          saveOriginalApi();
        }

        // Перевіряємо, чи справді працює API
        try {
          const userId = (_originalApi && _originalApi.getUserId) ?
                        _originalApi.getUserId() : safeGetUserId();

          if (!userId) {
            throw new Error("Не вдалося отримати ID користувача");
          }

          log(`ID користувача: ${userId}`, 'success');

          // Тестовий запит для перевірки працездатності API
          if (_originalApi && _originalApi.api && _originalApi.api.getUserData) {
            const userData = await _originalApi.api.getUserData(true);

            if (userData && (userData.status === 'success' || userData.source)) {
              log("Тестовий запит API успішний", 'success');
            } else {
              log("Тестовий запит API повернув некоректні дані", 'warn');
            }
          }

          // Успішна ініціалізація
          _isInitialized = true;
          _isInitializing = false;
          _initRetryCount = 0;
          _offlineMode = false;

          log("API модуль успішно ініціалізований", 'success');

          // Викликаємо подію успішної ініціалізації
          if (typeof document.dispatchEvent === 'function') {
            document.dispatchEvent(new CustomEvent('api-initialized', { detail: { success: true } }));
          }

          resolve(true);
        } catch (error) {
          log(`Помилка перевірки API: ${error.message}`, 'error');

          // Спробуємо ще раз, якщо не вичерпано кількість спроб
          if (_initRetryCount < _maxRetryAttempts) {
            _initRetryCount++;
            log(`Повторна спроба ініціалізації API (${_initRetryCount}/${_maxRetryAttempts})...`, 'warn');

            // Повторна спроба з експоненційною затримкою
            const retryDelay = _retryDelay * Math.pow(1.5, _initRetryCount - 1);
            setTimeout(() => {
              _isInitializing = false;
              initApi(true).then(resolve).catch(reject);
            }, retryDelay);

            return;
          } else {
            // Вичерпано кількість спроб, переходимо в офлайн режим
            log("Вичерпано максимальну кількість спроб ініціалізації API", 'error');
            _offlineMode = true;
            createSafeApiFunctions();
            throw new Error("Не вдалося ініціалізувати API модуль");
          }
        }
      } catch (error) {
        _isInitializing = false;
        _isInitialized = false;

        // Викликаємо подію помилки ініціалізації
        if (typeof document.dispatchEvent === 'function') {
          document.dispatchEvent(new CustomEvent('api-initialized', {
            detail: { success: false, error: error.message }
          }));
        }

        reject(error);
      }
    });

    return _apiInitPromise;
  }

  // Ініціалізація обгортки
  function init() {
    log("Ініціалізація API обгортки");

    // Створюємо безпечні версії API функцій
    createSafeApiFunctions();

    // Підписуємося на події AppInitializer, якщо він існує
    if (window.AppInitializer) {
      // Обробник події ініціалізації додатку
      window.AppInitializer.onEvent('app-init-success', () => {
        log("Подія app-init-success отримана, починаємо ініціалізацію API", 'success');
        initApi();
      });

      // Обробник події отримання ID користувача
      window.AppInitializer.onEvent('user-id-received', (data) => {
        if (data && data.userId) {
          log(`Отримано ID користувача: ${data.userId}`, 'success');

          // Зберігаємо ID в localStorage
          try {
            localStorage.setItem('telegram_user_id', data.userId);
          } catch (e) {}
        }
      });
    }

    // Спробуємо ініціалізувати API
    initApi().catch(error => {
      log(`Початкова ініціалізація API не вдалася: ${error.message}`, 'error');
    });

    // Реєструємо обробник завантаження сторінки
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', () => {
        log("DOM завантажено, перевіряємо API");
        initApi();
      });
    }

    // Додаємо до глобального об'єкту
    window.APIWrapper = {
      initApi,
      isInitialized: () => _isInitialized,
      isOfflineMode: () => _offlineMode,
      getStatus: () => ({
        isInitialized: _isInitialized,
        isInitializing: _isInitializing,
        retryCount: _initRetryCount,
        offlineMode: _offlineMode
      })
    };
  }

  // Запускаємо ініціалізацію
  init();
})();