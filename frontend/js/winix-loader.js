// Файл: frontend/js/winix-loader.js

/**
 * Головний завантажувач модулів WINIX
 *
 * Призначений для вирішення проблем із завантаженням модулів ES6,
 * помилками авторизації та обробки помилок в системі WINIX
 *
 * @version 1.0.0
 */

(function() {
  'use strict';

  console.log('🚀 WINIX-LOADER: Починаємо ініціалізацію системи...');

  // Флаги для відстеження стану завантаження
  const state = {
    initialized: false,
    authFixLoaded: false,
    moduleFixLoaded: false,
    telegramInitialized: false,
    errors: [],
    startTime: Date.now(),
    userId: null,
    debugInfo: {}
  };

  // Конфігурація
  const config = {
    debug: true,
    version: '1.0.0',
    paths: {
      authFix: '/js/auth-fix.js',
      moduleFix: '/js/fix-module-loader.js',
      apiJs: '/js/api.js',
      authJs: '/js/auth.js',
      criticalModules: [
        '/js/tasks/api/models/daily-bonus.js',
        '/js/tasks/config/index.js',
        '/js/tasks/utils/index.js'
      ]
    }
  };

  // Логування з префіксом
  function log(message, type = 'log', details = null) {
    const timestamp = new Date().toISOString().substring(11, 19);
    const prefix = `[${timestamp}] 🚀 WINIX-LOADER:`;

    if (details && config.debug) {
      console[type](`${prefix} ${message}`, details);
    } else {
      console[type](`${prefix} ${message}`);
    }

    // Зберігаємо логи для діагностики
    if (type === 'error') {
      state.errors.push({
        message,
        details,
        timestamp: Date.now(),
        timeSinceStart: Date.now() - state.startTime
      });
    }
  }

  // Функція для динамічного завантаження скриптів
  function loadScript(src, options = {}) {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = options.async !== false;
      script.defer = options.defer === true;
      script.type = options.type || 'text/javascript';
      script.dataset.loader = 'winix-loader';

      // Опційні додаткові атрибути
      if (options.id) script.id = options.id;
      if (options.className) script.className = options.className;

      // Обробники подій
      script.onload = () => {
        log(`✅ Скрипт завантажено: ${src}`);
        resolve(script);
      };

      script.onerror = (error) => {
        log(`❌ Помилка завантаження скрипта: ${src}`, 'error', error);
        reject(new Error(`Failed to load script: ${src}`));
      };

      // Додаємо до документа
      document.head.appendChild(script);
      log(`🔄 Почато завантаження скрипта: ${src}`);
    });
  }

  // Функція для патчу об'єкта глобального API
  function patchWinixAPI() {
    try {
      if (window.WinixAPI) {
        log('🔧 Патч існуючого WinixAPI...');
        return;
      }

      // Створюємо базову заглушку для WinixAPI, якщо він ще не існує
      window.WinixAPI = window.WinixAPI || {
        config: {
          baseUrl: window.location.origin,
          version: '3.0.0',
          environment: window.location.hostname.includes('localhost') ? 'development' : 'production',
        },
        getUserId: function() {
          return state.userId || null;
        },
        getAuthToken: function() {
          try {
            return localStorage.getItem('auth_token');
          } catch (e) {
            return null;
          }
        },
        apiRequest: async function(endpoint, method = 'GET', data = null, options = {}) {
          try {
            const userId = this.getUserId();

            // Простий варіант запиту з урахуванням методу
            if (!endpoint.startsWith('http')) {
              if (!endpoint.startsWith('/')) {
                endpoint = `/api/${endpoint}`;
              } else {
                endpoint = `/api${endpoint}`;
              }
            }

            const requestOptions = {
              method: method,
              headers: {
                'Content-Type': 'application/json',
                'Accept': 'application/json'
              }
            };

            // Додаємо ID користувача в заголовок, якщо він є
            if (userId) {
              requestOptions.headers['X-Telegram-User-Id'] = userId;
            }

            // Додаємо токен авторизації, якщо він є
            const token = this.getAuthToken();
            if (token) {
              requestOptions.headers['Authorization'] = token.startsWith('Bearer ') ? token : `Bearer ${token}`;
            }

            // Додаємо тіло запиту для POST/PUT/PATCH
            if (data && ['POST', 'PUT', 'PATCH'].includes(method.toUpperCase())) {
              requestOptions.body = JSON.stringify(data);
            }

            // Виконуємо запит
            const response = await fetch(endpoint, requestOptions);
            const responseData = await response.json();

            return responseData;
          } catch (error) {
            log(`❌ Помилка API запиту до ${endpoint}`, 'error', error);
            return {
              status: 'error',
              message: error.message || 'Помилка запиту',
              source: 'winix-loader.apiRequest'
            };
          }
        },
        refreshToken: async function() {
          try {
            const userId = this.getUserId();
            if (!userId) return null;

            return this.apiRequest('auth/refresh-token', 'POST', {
              telegram_id: userId,
              token: this.getAuthToken() || ''
            });
          } catch (error) {
            log('❌ Помилка оновлення токену', 'error', error);
            return null;
          }
        }
      };

      log('✅ Створено заглушку WinixAPI');
    } catch (error) {
      log('❌ Помилка при патчі WinixAPI', 'error', error);
    }
  }

  // Функція для ініціалізації Telegram API
  function initializeTelegram() {
    try {
      if (window.Telegram && window.Telegram.WebApp) {
        // Викликаємо ready() і expand()
        try {
          window.Telegram.WebApp.ready();
          window.Telegram.WebApp.expand();
          log('✅ Telegram WebApp ініціалізовано (вже існує)');
          state.telegramInitialized = true;

          // Відправляємо подію про готовність
          document.dispatchEvent(new CustomEvent('telegram-ready', {
            detail: { timestamp: Date.now() }
          }));

          return true;
        } catch (e) {
          log('⚠️ Помилка при виклику Telegram WebApp методів', 'warn', e);
        }
      }

      // Якщо Telegram не доступний, перевіряємо чи це локальне середовище
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        log('⚠️ Локальне середовище, створюємо стаб для Telegram WebApp', 'warn');

        window.Telegram = {
          WebApp: {
            ready: function() { log('📱 Mock Telegram.WebApp.ready() викликано'); },
            expand: function() { log('📱 Mock Telegram.WebApp.expand() викликано'); },
            initData: '',
            initDataUnsafe: {
              user: {
                id: '685982514', // Використовуємо тестовий ID з .env
                first_name: 'Test',
                last_name: 'User',
                username: 'testuser',
                language_code: 'uk'
              },
              start_param: ''
            }
          }
        };

        state.telegramInitialized = true;

        // Відправляємо подію про готовність
        document.dispatchEvent(new CustomEvent('telegram-ready', {
          detail: { timestamp: Date.now(), isMock: true }
        }));

        log('✅ Створено стаб Telegram WebApp для локальної розробки');
        return true;
      }

      return false;
    } catch (error) {
      log('❌ Критична помилка ініціалізації Telegram', 'error', error);
      return false;
    }
  }

  // Функція для отримання і збереження ID користувача
  function getUserId() {
    try {
      // Якщо ID вже збережено в стані
      if (state.userId) return state.userId;

      // Функція перевірки валідності ID
      function isValidId(id) {
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

      // 1. Перевіряємо Telegram WebApp
      if (window.Telegram && window.Telegram.WebApp) {
        try {
          if (
            window.Telegram.WebApp.initDataUnsafe &&
            window.Telegram.WebApp.initDataUnsafe.user &&
            window.Telegram.WebApp.initDataUnsafe.user.id
          ) {
            const tgUserId = window.Telegram.WebApp.initDataUnsafe.user.id.toString();

            if (isValidId(tgUserId)) {
              try {
                localStorage.setItem('telegram_user_id', tgUserId);
              } catch (e) {}

              state.userId = tgUserId;
              return tgUserId;
            }
          }
        } catch (e) {
          log('⚠️ Помилка отримання ID з Telegram WebApp', 'warn', e);
        }
      }

      // 2. Перевіряємо localStorage
      try {
        const localId = localStorage.getItem('telegram_user_id');
        if (isValidId(localId)) {
          state.userId = localId;
          return localId;
        }
      } catch (e) {
        log('⚠️ Помилка отримання ID з localStorage', 'warn', e);
      }

      // 3. Перевіряємо DOM елемент
      try {
        const userIdElement = document.getElementById('user-id');
        if (userIdElement && userIdElement.textContent) {
          const domId = userIdElement.textContent.trim();
          if (isValidId(domId)) {
            try {
              localStorage.setItem('telegram_user_id', domId);
            } catch (e) {}

            state.userId = domId;
            return domId;
          }
        }
      } catch (e) {
        log('⚠️ Помилка отримання ID з DOM', 'warn', e);
      }

      // 4. Перевіряємо URL параметри
      try {
        const urlParams = new URLSearchParams(window.location.search);
        const urlId = urlParams.get('id') || urlParams.get('user_id') || urlParams.get('telegram_id');
        if (isValidId(urlId)) {
          try {
            localStorage.setItem('telegram_user_id', urlId);
          } catch (e) {}

          state.userId = urlId;
          return urlId;
        }
      } catch (e) {
        log('⚠️ Помилка отримання ID з URL', 'warn', e);
      }

      // 5. Для локального середовища використовуємо тестовий ID
      if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
        const testId = '685982514';
        try {
          localStorage.setItem('telegram_user_id', testId);
        } catch (e) {}

        state.userId = testId;
        log('⚠️ Використовуємо тестовий ID для локального середовища', 'warn');
        return testId;
      }

      return null;
    } catch (error) {
      log('❌ Критична помилка отримання ID користувача', 'error', error);
      return null;
    }
  }

  // Встановлення ID користувача в DOM
  function setUserIdInDom() {
    try {
      const userId = getUserId();
      if (!userId) return;

      // Перевіряємо наявність елемента або створюємо новий
      let userIdElement = document.getElementById('user-id');

      if (!userIdElement) {
        userIdElement = document.createElement('div');
        userIdElement.id = 'user-id';
        userIdElement.style.display = 'none';
        document.body.appendChild(userIdElement);
      }

      userIdElement.textContent = userId;
      log(`✅ ID користувача (${userId}) встановлено в DOM`);
    } catch (error) {
      log('❌ Помилка встановлення ID в DOM', 'error', error);
    }
  }

  // Завантаження виправлень для системи
  async function loadFixes() {
    try {
      // Створюємо глобальний реєстр модулів, якщо він ще не існує
      window.ModuleRegistry = window.ModuleRegistry || {
        modules: {},
        register: function(name, module) {
          this.modules[name] = module;
          log(`📦 Зареєстровано модуль: ${name}`);
          return module;
        },
        get: function(name) {
          return this.modules[name];
        },
        list: function() {
          return Object.keys(this.modules);
        }
      };

      // Завантажуємо виправлення для модулів
      await loadScript(config.paths.moduleFix, { id: 'module-fix-script' });
      state.moduleFixLoaded = true;

      // Завантажуємо виправлення для авторизації
      await loadScript(config.paths.authFix, { id: 'auth-fix-script' });
      state.authFixLoaded = true;

      log('✅ Всі виправлення завантажено успішно');
      return true;
    } catch (error) {
      log('❌ Помилка при завантаженні виправлень', 'error', error);
      return false;
    }
  }

  // Виконання запиту для отримання файлу, щоб перевірити доступність
  async function checkFileAvailability(path) {
    try {
      const response = await fetch(path, { method: 'HEAD' });
      return {
        path,
        exists: response.ok,
        status: response.status
      };
    } catch (error) {
      return {
        path,
        exists: false,
        status: 0,
        error: error.message
      };
    }
  }

  // Перевірка наявності критичних файлів
  async function checkCriticalFiles() {
    try {
      const results = await Promise.all([
        ...config.paths.criticalModules.map(path => checkFileAvailability(path)),
        checkFileAvailability(config.paths.apiJs),
        checkFileAvailability(config.paths.authJs)
      ]);

      const allExist = results.every(result => result.exists);

      // Зберігаємо в стані для діагностики
      state.debugInfo.fileCheck = results;

      log('📋 Перевірка наявності критичних файлів:', allExist ? 'log' : 'warn', results);

      return allExist;
    } catch (error) {
      log('❌ Помилка перевірки наявності файлів', 'error', error);
      return false;
    }
  }

  // Відправка діагностичних даних на сервер
  async function sendDiagnostics() {
    try {
      // Збираємо діагностичні дані
      const diagnosticData = {
        state: { ...state },
        navigator: {
          userAgent: navigator.userAgent,
          language: navigator.language,
          onLine: navigator.onLine
        },
        localStorage: {
          available: (() => {
            try {
              const test = 'test';
              localStorage.setItem(test, test);
              localStorage.removeItem(test);
              return true;
            } catch (e) {
              return false;
            }
          })()
        },
        screen: {
          width: window.innerWidth,
          height: window.innerHeight,
          devicePixelRatio: window.devicePixelRatio
        },
        url: window.location.href,
        timestamp: Date.now()
      };

      // Відправляємо діагностичні дані на сервер
      const response = await fetch('/api/debug', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(diagnosticData)
      });

      if (!response.ok) {
        throw new Error(`Помилка відправки діагностики: ${response.status}`);
      }

      log('✅ Діагностичні дані відправлено на сервер');
      return true;
    } catch (error) {
      log('⚠️ Не вдалося відправити діагностичні дані', 'warn', error);
      return false;
    }
  }

  // Основна функція ініціалізації
  async function initialize() {
    if (state.initialized) return;

    try {
      log('🚀 Початок ініціалізації системи WINIX');

      // 1. Отримуємо ID користувача
      const userId = getUserId();
      log(`🔑 ID користувача: ${userId || 'не знайдено'}`);

      // 2. Ініціалізуємо Telegram API
      initializeTelegram();

      // 3. Створюємо базову заглушку для WinixAPI
      patchWinixAPI();

      // 4. Перевіряємо наявність критичних файлів
      await checkCriticalFiles();

      // 5. Завантажуємо виправлення
      await loadFixes();

      // 6. Встановлюємо ID користувача в DOM
      setUserIdInDom();

      // 7. Відправляємо діагностичні дані
      await sendDiagnostics();

      // 8. Відправляємо подію про ініціалізацію
      document.dispatchEvent(new CustomEvent('winix-loader-ready', {
        detail: {
          state,
          timestamp: Date.now(),
          userId,
          telegramAvailable: state.telegramInitialized
        }
      }));

      state.initialized = true;
      log(`✅ Ініціалізацію завершено за ${Date.now() - state.startTime}ms`);

      return true;
    } catch (error) {
      log('❌ Критична помилка ініціалізації', 'error', error);
      state.errors.push({
        message: 'Критична помилка ініціалізації',
        error,
        timestamp: Date.now(),
        timeSinceStart: Date.now() - state.startTime
      });

      return false;
    }
  }

  // Запускаємо ініціалізацію
  initialize().then((success) => {
    // Зберігаємо глобальний API для доступу
    window.WinixLoader = {
      state,
      config,
      initialize,
      getUserId,
      loadScript,
      checkCriticalFiles,
      sendDiagnostics,
      version: config.version
    };
  });

  // Додаємо обробник завантаження DOM
  document.addEventListener('DOMContentLoaded', function() {
    log('📄 DOMContentLoaded отримано');

    // Перевіряємо ще раз наявність ID користувача в DOM
    setUserIdInDom();

    // Якщо не ініціалізовано, робимо це зараз
    if (!state.initialized) {
      initialize();
    }
  });
})();