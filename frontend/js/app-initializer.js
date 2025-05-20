/**
 * app-initializer.js - Модуль централізованої ініціалізації WINIX
 * Забезпечує послідовне завантаження та ініціалізацію модулів додатку
 * @version 1.0.0
 */

(function() {
  'use strict';

  // Приватні змінні модуля
  const _state = {
    isInitializing: false,
    isInitialized: false,
    modules: {}, // інформація про статус модулів
    initQueue: [], // черга очікування на ініціалізацію
    maxRetryAttempts: 5,
    retryTimeouts: [1000, 2000, 3000, 5000, 8000], // затримки для повторних спроб (мс)
    currentRetry: 0
  };

  // Шина подій для комунікації між модулями
  const _eventBus = {
    events: {},
    subscribe: function(event, callback) {
      if (!this.events[event]) {
        this.events[event] = [];
      }
      this.events[event].push(callback);
      return this; // для ланцюжкових викликів
    },
    unsubscribe: function(event, callback) {
      if (this.events[event]) {
        this.events[event] = this.events[event].filter(cb => cb !== callback);
      }
      return this;
    },
    publish: function(event, data) {
      if (!this.events[event]) return;
      this.events[event].forEach(callback => {
        try {
          callback(data);
        } catch (e) {
          console.error(`Помилка події ${event}:`, e);
        }
      });
      return this;
    }
  };

  // Дані користувача
  let _userData = null;
  let _userId = null;

  // Стан завантаження компонентів
  const _moduleStatuses = {
    PENDING: 'pending', // в очікуванні
    INITIALIZING: 'initializing', // процес ініціалізації
    SUCCESS: 'success', // успішно ініціалізовано
    ERROR: 'error', // помилка ініціалізації
    RETRY: 'retry' // повторна спроба
  };

  // Схема залежностей між модулями
  // Кожен модуль може мати залежності від інших модулів
  const _moduleDependencies = {
    telegram: [], // Телеграм API не має залежностей
    core: ['telegram'], // Core залежить від ініціалізації Telegram
    api: ['core', 'telegram'], // API залежить від Core та Telegram
    referrals: ['api', 'core'] // Реферальна система залежить від API та Core
  };

  // Пріоритет завантаження модулів (менше значення = вищий пріоритет)
  const _modulePriorities = {
    telegram: 10,
    core: 20,
    api: 30,
    referrals: 40
  };

  /**
   * Логування з часовою міткою та форматуванням
   */
  function log(message, level = 'log') {
    const timestamp = new Date().toISOString().substring(11, 19);
    const prefix = `[${timestamp}] [AppInitializer]`;

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
   * Реєстрація модуля в системі ініціалізації
   * @param {string} moduleId - Ідентифікатор модуля
   * @param {function} initFunction - Функція ініціалізації модуля
   * @param {object} options - Додаткові параметри
   */
  function registerModule(moduleId, initFunction, options = {}) {
    if (!moduleId || typeof initFunction !== 'function') {
      log(`Неможливо зареєструвати модуль "${moduleId}": неправильні параметри`, 'error');
      return false;
    }

    if (_state.modules[moduleId]) {
      log(`Модуль "${moduleId}" вже зареєстрований`, 'warn');
      return false;
    }

    // Визначаємо залежності або використовуємо значення за замовчуванням
    const dependencies = options.dependencies || _moduleDependencies[moduleId] || [];
    const priority = options.priority || _modulePriorities[moduleId] || 100;

    // Реєструємо модуль
    _state.modules[moduleId] = {
      id: moduleId,
      status: _moduleStatuses.PENDING,
      initFunction: initFunction,
      dependencies: dependencies,
      priority: priority,
      retryCount: 0,
      lastError: null,
      initTime: null
    };

    log(`Модуль "${moduleId}" зареєстровано з пріоритетом ${priority}`);

    // Публікуємо подію реєстрації модуля
    _eventBus.publish('module-registered', { moduleId, dependencies, priority });

    return true;
  }

  /**
   * Перевірка, чи всі залежності модуля успішно ініціалізовано
   * @param {string} moduleId - ID модуля для перевірки
   * @returns {boolean} Результат перевірки
   */
  function areDependenciesMet(moduleId) {
    const module = _state.modules[moduleId];
    if (!module) return false;

    // Якщо немає залежностей, умова виконана
    if (!module.dependencies || module.dependencies.length === 0) {
      return true;
    }

    // Перевіряємо статус кожної залежності
    return module.dependencies.every(depId => {
      const dep = _state.modules[depId];
      return dep && dep.status === _moduleStatuses.SUCCESS;
    });
  }

  /**
   * Запускає ініціалізацію модуля
   * @param {string} moduleId - ID модуля
   * @returns {Promise} Проміс, що вирішується після ініціалізації
   */
  async function initializeModule(moduleId) {
    const module = _state.modules[moduleId];
    if (!module) {
      return Promise.reject(new Error(`Модуль "${moduleId}" не зареєстрований`));
    }

    // Якщо модуль вже ініціалізується або був ініціалізований
    if (module.status === _moduleStatuses.INITIALIZING) {
      log(`Модуль "${moduleId}" вже ініціалізується`, 'warn');
      return new Promise((resolve, reject) => {
        _state.initQueue.push({ moduleId, resolve, reject });
      });
    }

    if (module.status === _moduleStatuses.SUCCESS) {
      log(`Модуль "${moduleId}" вже ініціалізований`, 'warn');
      return Promise.resolve();
    }

    // Перевіряємо залежності
    if (!areDependenciesMet(moduleId)) {
      log(`Не всі залежності модуля "${moduleId}" задоволені`, 'warn');

      // Повертаємо проміс, який вирішиться, коли всі залежності будуть ініціалізовані
      return new Promise((resolve, reject) => {
        _state.initQueue.push({ moduleId, resolve, reject });

        // Спробуємо ініціалізувати залежності
        module.dependencies.forEach(depId => {
          if (_state.modules[depId] && _state.modules[depId].status === _moduleStatuses.PENDING) {
            scheduleModuleInitialization(depId);
          }
        });
      });
    }

    // Змінюємо статус модуля
    module.status = _moduleStatuses.INITIALIZING;
    module.initTime = Date.now();

    // Публікуємо подію початку ініціалізації
    _eventBus.publish('module-init-start', { moduleId });

    log(`Початок ініціалізації модуля "${moduleId}"...`);

    // Запускаємо функцію ініціалізації
    try {
      await module.initFunction();

      // Успішна ініціалізація
      module.status = _moduleStatuses.SUCCESS;
      module.retryCount = 0;

      log(`Модуль "${moduleId}" успішно ініціалізований`, 'success');

      // Публікуємо подію успішної ініціалізації
      _eventBus.publish('module-init-success', { moduleId });

      // Перевіряємо чергу очікування
      processInitQueue();

      return Promise.resolve();
    } catch (error) {
      // Помилка ініціалізації
      module.status = _moduleStatuses.ERROR;
      module.lastError = error;

      log(`Помилка ініціалізації модуля "${moduleId}": ${error.message}`, 'error');

      // Публікуємо подію помилки ініціалізації
      _eventBus.publish('module-init-error', { moduleId, error });

      // Спробуємо повторити ініціалізацію
      if (module.retryCount < _state.maxRetryAttempts) {
        module.retryCount++;
        module.status = _moduleStatuses.RETRY;

        const retryDelay = _state.retryTimeouts[Math.min(module.retryCount - 1, _state.retryTimeouts.length - 1)];

        log(`Повторна спроба ініціалізації модуля "${moduleId}" через ${retryDelay}ms (спроба ${module.retryCount}/${_state.maxRetryAttempts})`, 'warn');

        // Плануємо повторну спробу
        setTimeout(() => {
          scheduleModuleInitialization(moduleId);
        }, retryDelay);
      } else {
        log(`Вичерпано максимальну кількість спроб ініціалізації модуля "${moduleId}"`, 'error');

        // Публікуємо подію критичної помилки
        _eventBus.publish('module-init-critical-error', { moduleId, error });

        // Оновлюємо статуси залежних модулів
        updateDependentModules(moduleId);
      }

      return Promise.reject(error);
    }
  }

  /**
   * Оновлює статуси модулів, які залежать від неініціалізованого модуля
   * @param {string} failedModuleId - ID модуля, який не вдалося ініціалізувати
   */
  function updateDependentModules(failedModuleId) {
    // Знаходимо всі модулі, які залежать від неініціалізованого
    Object.keys(_state.modules).forEach(moduleId => {
      const module = _state.modules[moduleId];
      if (module.dependencies && module.dependencies.includes(failedModuleId)) {
        if (module.status !== _moduleStatuses.SUCCESS) {
          log(`Модуль "${moduleId}" залежить від "${failedModuleId}", який не вдалося ініціалізувати`, 'warn');
          module.status = _moduleStatuses.ERROR;
          module.lastError = new Error(`Критична залежність "${failedModuleId}" не ініціалізована`);

          // Обробляємо модулі, які залежать від цього модуля
          updateDependentModules(moduleId);
        }
      }
    });
  }

  /**
   * Обробляє чергу очікування ініціалізації
   */
  function processInitQueue() {
    // Копіюємо чергу, щоб уникнути проблем при її модифікації в циклі
    const queue = [..._state.initQueue];
    _state.initQueue = [];

    queue.forEach(item => {
      // Перевіряємо, чи всі залежності задоволені
      if (areDependenciesMet(item.moduleId)) {
        // Запускаємо ініціалізацію модуля
        initializeModule(item.moduleId)
          .then(() => item.resolve())
          .catch(error => item.reject(error));
      } else {
        // Повертаємо елемент у чергу очікування
        _state.initQueue.push(item);
      }
    });
  }

  /**
   * Планує ініціалізацію модуля з урахуванням пріоритету
   * @param {string} moduleId - ID модуля
   */
  function scheduleModuleInitialization(moduleId) {
    const module = _state.modules[moduleId];
    if (!module) return;

    // Змінюємо статус модуля на PENDING, якщо він не був SUCCESS
    if (module.status !== _moduleStatuses.SUCCESS) {
      module.status = _moduleStatuses.PENDING;
    }

    // Додаємо модуль до черги ініціалізації, якщо всі залежності задоволені
    if (areDependenciesMet(moduleId)) {
      initializeModule(moduleId).catch(error => {
        log(`Не вдалося ініціалізувати модуль "${moduleId}": ${error.message}`, 'error');
      });
    } else {
      // Додаємо модуль до черги очікування
      _state.initQueue.push({
        moduleId,
        resolve: () => {},
        reject: () => {}
      });

      // Спробуємо ініціалізувати залежності
      module.dependencies.forEach(depId => {
        if (_state.modules[depId] && _state.modules[depId].status === _moduleStatuses.PENDING) {
          scheduleModuleInitialization(depId);
        }
      });
    }
  }

  /**
   * Запускає процес ініціалізації всіх зареєстрованих модулів
   * @returns {Promise} Проміс, що вирішується після ініціалізації всіх модулів
   */
  async function initializeAllModules() {
    if (_state.isInitializing) {
      log("Ініціалізація вже запущена", 'warn');
      return;
    }

    if (_state.isInitialized) {
      log("Додаток вже ініціалізовано", 'warn');
      return;
    }

    log("Початок ініціалізації всіх модулів");
    _state.isInitializing = true;

    // Показуємо індикатор завантаження
    showLoadingIndicator("Ініціалізація додатку...");

    // Отримуємо всі модулі в порядку їх пріоритету
    const moduleIds = Object.keys(_state.modules)
      .sort((a, b) => _state.modules[a].priority - _state.modules[b].priority);

    let initPromises = [];

    // Ініціалізуємо модулі в порядку пріоритету
    for (const moduleId of moduleIds) {
      const module = _state.modules[moduleId];

      // Перевіряємо залежності
      if (areDependenciesMet(moduleId)) {
        initPromises.push(initializeModule(moduleId));
      } else {
        // Додаємо модуль до черги очікування
        _state.initQueue.push({
          moduleId,
          resolve: () => {},
          reject: () => {}
        });
      }
    }

    try {
      await Promise.all(initPromises);

      // Перевіряємо статус всіх модулів
      const allModulesInitialized = moduleIds.every(
        moduleId => _state.modules[moduleId].status === _moduleStatuses.SUCCESS
      );

      if (allModulesInitialized) {
        _state.isInitialized = true;
        _state.isInitializing = false;

        log("Всі модулі успішно ініціалізовані", 'success');

        // Приховуємо індикатор завантаження
        hideLoadingIndicator();

        // Публікуємо подію успішної ініціалізації
        _eventBus.publish('app-init-success', { modules: _state.modules });

        return Promise.resolve();
      } else {
        _state.isInitializing = false;

        const failedModules = moduleIds.filter(
          moduleId => _state.modules[moduleId].status !== _moduleStatuses.SUCCESS
        );

        log(`Не вдалося ініціалізувати всі модулі. Провалені: ${failedModules.join(", ")}`, 'error');

        // Приховуємо індикатор завантаження і показуємо повідомлення про помилку
        hideLoadingIndicator();
        showErrorMessage("Деякі компоненти додатку не вдалося завантажити. Спробуйте оновити сторінку.");

        // Публікуємо подію помилки ініціалізації
        _eventBus.publish('app-init-error', { modules: _state.modules, failedModules });

        return Promise.reject(new Error(`Ініціалізація не завершена. Провалені модулі: ${failedModules.join(", ")}`));
      }
    } catch (error) {
      _state.isInitializing = false;

      log(`Помилка ініціалізації додатку: ${error.message}`, 'error');

      // Приховуємо індикатор завантаження і показуємо повідомлення про помилку
      hideLoadingIndicator();
      showErrorMessage("Не вдалося завантажити додаток. Спробуйте оновити сторінку.");

      // Публікуємо подію помилки ініціалізації
      _eventBus.publish('app-init-critical-error', { error });

      return Promise.reject(error);
    }
  }

  /**
   * Уніфікована функція отримання ID користувача з різних джерел
   * @returns {Promise<string|null>} ID користувача або null
   */
  async function getUserId() {
    if (_userId) {
      return _userId;
    }

    log("Спроба отримання ID користувача з усіх доступних джерел");

    // Пріоритетні джерела ID користувача
    const sources = [
      // 1. Telegram WebApp
      async () => {
        try {
          if (window.Telegram && window.Telegram.WebApp &&
              window.Telegram.WebApp.initDataUnsafe &&
              window.Telegram.WebApp.initDataUnsafe.user &&
              window.Telegram.WebApp.initDataUnsafe.user.id) {

            const id = window.Telegram.WebApp.initDataUnsafe.user.id.toString();
            log(`Отримано ID користувача з Telegram WebApp: ${id}`, 'success');
            return id;
          }
        } catch (e) {
          log(`Помилка отримання ID з Telegram WebApp: ${e.message}`, 'warn');
        }
        return null;
      },

      // 2. WinixAPI
      async () => {
        try {
          if (window.WinixAPI && typeof window.WinixAPI.getUserId === 'function') {
            const id = window.WinixAPI.getUserId();
            if (id && id !== 'undefined' && id !== 'null') {
              log(`Отримано ID користувача з WinixAPI: ${id}`, 'success');
              return id;
            }
          }
        } catch (e) {
          log(`Помилка отримання ID з WinixAPI: ${e.message}`, 'warn');
        }
        return null;
      },

      // 3. localStorage
      async () => {
        try {
          const id = localStorage.getItem('telegram_user_id') || localStorage.getItem('user_id');
          if (id && id !== 'undefined' && id !== 'null') {
            log(`Отримано ID користувача з localStorage: ${id}`, 'success');
            return id;
          }
        } catch (e) {
          log(`Помилка отримання ID з localStorage: ${e.message}`, 'warn');
        }
        return null;
      },

      // 4. DOM елементи
      async () => {
        try {
          // Спочатку перевіряємо елемент в хедері
          const headerUserIdElement = document.getElementById('header-user-id');
          if (headerUserIdElement && headerUserIdElement.textContent) {
            const id = headerUserIdElement.textContent.trim();
            if (id && id !== 'undefined' && id !== 'null') {
              log(`Отримано ID користувача з DOM (header): ${id}`, 'success');
              return id;
            }
          }

          // Потім перевіряємо прихований елемент
          const userIdElement = document.getElementById('user-id');
          if (userIdElement && userIdElement.textContent) {
            const id = userIdElement.textContent.trim();
            if (id && id !== 'undefined' && id !== 'null') {
              log(`Отримано ID користувача з DOM (hidden): ${id}`, 'success');
              return id;
            }
          }
        } catch (e) {
          log(`Помилка отримання ID з DOM: ${e.message}`, 'warn');
        }
        return null;
      },

      // 5. URL параметри
      async () => {
        try {
          const urlParams = new URLSearchParams(window.location.search);
          const id = urlParams.get('id') || urlParams.get('user_id') || urlParams.get('telegram_id');
          if (id && id !== 'undefined' && id !== 'null') {
            log(`Отримано ID користувача з URL параметрів: ${id}`, 'success');
            return id;
          }
        } catch (e) {
          log(`Помилка отримання ID з URL: ${e.message}`, 'warn');
        }
        return null;
      }
    ];

    // Перебираємо всі джерела по черзі, поки не знайдемо ID
    for (const source of sources) {
      const id = await source();
      if (id) {
        _userId = id;

        // Зберігаємо ID в localStorage для використання в майбутньому
        try {
          localStorage.setItem('telegram_user_id', id);
        } catch (e) {
          log(`Не вдалося зберегти ID користувача в localStorage: ${e.message}`, 'warn');
        }

        // Публікуємо подію отримання ID користувача
        _eventBus.publish('user-id-received', { userId: id });

        return id;
      }
    }

    // Якщо не вдалося отримати ID з жодного джерела
    log("Не вдалося отримати ID користувача з жодного джерела", 'error');

    // Публікуємо подію помилки отримання ID користувача
    _eventBus.publish('user-id-error', { error: new Error("ID користувача не знайдено") });

    return null;
  }

  /**
   * Показує індикатор завантаження
   * @param {string} message - Повідомлення для відображення
   */
  function showLoadingIndicator(message = "Завантаження...") {
    if (typeof window.showLoading === 'function') {
      window.showLoading();
      return;
    }

    // Перевіряємо чи існує власний індикатор
    let loader = document.getElementById('app-loader');

    if (!loader) {
      // Створюємо індикатор завантаження
      loader = document.createElement('div');
      loader.id = 'app-loader';
      loader.innerHTML = `
        <div class="loader-overlay">
          <div class="loader-container">
            <div class="loader-spinner"></div>
            <div class="loader-message">${message}</div>
          </div>
        </div>
      `;

      // Додаємо стилі для індикатора
      const style = document.createElement('style');
      style.textContent = `
        .loader-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background-color: rgba(0, 0, 0, 0.5);
          z-index: 9999;
          display: flex;
          justify-content: center;
          align-items: center;
        }
        .loader-container {
          background-color: white;
          padding: 20px;
          border-radius: 10px;
          box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
          text-align: center;
        }
        .loader-spinner {
          border: 4px solid #f3f3f3;
          border-top: 4px solid #3498db;
          border-radius: 50%;
          width: 30px;
          height: 30px;
          animation: spin 1s linear infinite;
          margin: 0 auto 10px;
        }
        .loader-message {
          font-family: Arial, sans-serif;
          font-size: 14px;
          color: #333;
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `;

      document.head.appendChild(style);
      document.body.appendChild(loader);
    } else {
      // Оновлюємо повідомлення
      const messageElement = loader.querySelector('.loader-message');
      if (messageElement) {
        messageElement.textContent = message;
      }

      // Показуємо індикатор
      loader.style.display = 'block';
    }
  }

  /**
   * Приховує індикатор завантаження
   */
  function hideLoadingIndicator() {
    if (typeof window.hideLoading === 'function') {
      window.hideLoading();
      return;
    }

    // Приховуємо власний індикатор
    const loader = document.getElementById('app-loader');
    if (loader) {
      loader.style.display = 'none';
    }
  }

  /**
   * Показує повідомлення про помилку
   * @param {string} message - Текст повідомлення
   */
  function showErrorMessage(message) {
    if (typeof window.showToast === 'function') {
      window.showToast(message, 'error');
      return;
    }

    // Створюємо власне повідомлення про помилку
    const errorElement = document.createElement('div');
    errorElement.className = 'error-message';
    errorElement.innerHTML = `
      <div class="error-container">
        <div class="error-icon">⚠️</div>
        <div class="error-text">${message}</div>
        <div class="error-close">×</div>
      </div>
    `;

    // Додаємо стилі
    const style = document.createElement('style');
    style.textContent = `
      .error-message {
        position: fixed;
        top: 20px;
        left: 50%;
        transform: translateX(-50%);
        background-color: #f44336;
        color: white;
        padding: 10px 20px;
        border-radius: 5px;
        box-shadow: 0 4px 8px rgba(0, 0, 0, 0.2);
        z-index: 10000;
        max-width: 90%;
        animation: fadeIn 0.3s;
      }
      .error-container {
        display: flex;
        align-items: center;
      }
      .error-icon {
        margin-right: 10px;
        font-size: 20px;
      }
      .error-text {
        flex-grow: 1;
        font-family: Arial, sans-serif;
        font-size: 14px;
      }
      .error-close {
        cursor: pointer;
        font-size: 20px;
        margin-left: 10px;
      }
      @keyframes fadeIn {
        from { opacity: 0; transform: translate(-50%, -20px); }
        to { opacity: 1; transform: translate(-50%, 0); }
      }
    `;

    document.head.appendChild(style);
    document.body.appendChild(errorElement);

    // Додаємо обробник кліку для закриття
    const closeButton = errorElement.querySelector('.error-close');
    if (closeButton) {
      closeButton.addEventListener('click', function() {
        document.body.removeChild(errorElement);
      });
    }

    // Автоматично закриваємо повідомлення через 5 секунд
    setTimeout(() => {
      if (document.body.contains(errorElement)) {
        document.body.removeChild(errorElement);
      }
    }, 5000);
  }

  /**
   * Реєструє стандартні модулі застосунку
   */
  function registerStandardModules() {
    // Реєстрація модуля Telegram WebApp
    registerModule('telegram', async function() {
      if (!window.Telegram || !window.Telegram.WebApp) {
        throw new Error("Telegram WebApp не знайдено");
      }

      log("Ініціалізація Telegram WebApp");

      // Чекаємо на готовність Telegram WebApp
      return new Promise((resolve, reject) => {
        // Якщо WebApp вже готовий, просто повертаємо результат
        if (window.Telegram.WebApp.initDataUnsafe &&
            window.Telegram.WebApp.initDataUnsafe.user) {
          log("Telegram WebApp вже ініціалізований", 'success');
          resolve();
          return;
        }

        // Встановлюємо таймаут на випадок, якщо щось піде не так
        const timeout = setTimeout(() => {
          window.Telegram.WebApp.offEvent('viewportChanged', onViewportChanged);
          reject(new Error("Таймаут ініціалізації Telegram WebApp"));
        }, 5000);

        // Обробник події зміни вьюпорта (індикатор того, що WebApp ініціалізований)
        function onViewportChanged() {
          clearTimeout(timeout);
          window.Telegram.WebApp.offEvent('viewportChanged', onViewportChanged);
          log("Telegram WebApp ініціалізований (отримано viewportChanged)", 'success');
          resolve();
        }

        // Підписуємося на подію зміни вьюпорта
        window.Telegram.WebApp.onEvent('viewportChanged', onViewportChanged);

        // Повідомляємо Telegram WebApp про готовність
        window.Telegram.WebApp.ready();
        window.Telegram.WebApp.expand();
      });
    });

    // Реєстрація модуля Core
    registerModule('core', async function() {
      if (!window.WinixCore) {
        throw new Error("Модуль WinixCore не знайдено");
      }

      log("Ініціалізація WinixCore");

      // Перевіряємо, чи вже ініціалізований
      if (window.WinixCore.isInitialized && window.WinixCore.isInitialized()) {
        log("WinixCore вже ініціалізований", 'success');
        return;
      }

      // Ініціалізуємо Core з отриманим ID користувача
      const userId = await getUserId();
      if (!userId) {
        throw new Error("Не вдалося отримати ID користувача для ініціалізації Core");
      }

      return new Promise((resolve, reject) => {
        try {
          window.WinixCore.init({
            debug: true,
            userId: userId
          }).then(() => {
            log("WinixCore успішно ініціалізований", 'success');
            resolve();
          }).catch(error => {
            reject(new Error(`Помилка ініціалізації WinixCore: ${error.message}`));
          });
        } catch (error) {
          reject(new Error(`Критична помилка ініціалізації WinixCore: ${error.message}`));
        }
      });
    });

    // Реєстрація модуля API
    registerModule('api', async function() {
      if (!window.WinixAPI) {
        if (typeof window.apiRequest === 'function') {
          log("Знайдено функцію apiRequest, але не знайдено WinixAPI", 'warn');
        }

        throw new Error("Модуль WinixAPI не знайдено");
      }

      log("Ініціалізація WinixAPI");

      // Отримуємо ID користувача для API
      const userId = await getUserId();
      if (!userId) {
        throw new Error("Не вдалося отримати ID користувача для ініціалізації API");
      }

      // Перевіряємо базові функції API
      if (typeof window.WinixAPI.getUserData !== 'function') {
        throw new Error("WinixAPI не містить необхідних методів");
      }

      // Виконуємо тестовий запит для перевірки працездатності API
      return new Promise((resolve, reject) => {
        try {
          // Намагаємося отримати дані користувача
          window.WinixAPI.getUserData(true).then(function(response) {
            if (response && (response.status === 'success' || response.source)) {
              log("WinixAPI успішно ініціалізований", 'success');
              resolve();
            } else {
              log("WinixAPI повернув некоректні дані", 'warn');
              // Вважаємо, що API все одно ініціалізований
              resolve();
            }
          }).catch(function(error) {
            log(`Помилка тестового запиту WinixAPI: ${error.message}`, 'warn');
            // Вважаємо, що API все одно ініціалізований
            resolve();
          });
        } catch (error) {
          reject(new Error(`Критична помилка ініціалізації WinixAPI: ${error.message}`));
        }
      });
    });

    // Реєстрація модуля Referrals
    registerModule('referrals', async function() {
      // Перевіряємо, чи потрібен цей модуль на поточній сторінці
      const isReferralPage = window.location.pathname.includes('referral') ||
                            window.location.pathname.includes('invite');

      if (!isReferralPage) {
        log("Сторінка не потребує ініціалізації модуля Referrals, пропускаємо", 'success');
        return;
      }

      if (!window.ReferralIntegration || !window.initReferralSystem) {
        throw new Error("Модуль ReferralIntegration не знайдено");
      }

      log("Ініціалізація ReferralIntegration");

      return new Promise((resolve, reject) => {
        try {
          window.initReferralSystem().then(function() {
            log("ReferralIntegration успішно ініціалізований", 'success');
            resolve();
          }).catch(function(error) {
            reject(new Error(`Помилка ініціалізації ReferralIntegration: ${error.message}`));
          });
        } catch (error) {
          reject(new Error(`Критична помилка ініціалізації ReferralIntegration: ${error.message}`));
        }
      });
    });
  }

  /**
   * Ініціалізація додатку
   * @returns {Promise} Проміс, що вирішується після ініціалізації
   */
  async function init() {
    log("Початок ініціалізації додатку");

    // Реєструємо стандартні модулі
    registerStandardModules();

    // Запускаємо ініціалізацію
    return initializeAllModules()
      .then(() => {
        // Додаткові дії після успішної ініціалізації
        log("Додаток успішно ініціалізовано", 'success');

        // Публікуємо подію завершення ініціалізації
        _eventBus.publish('app-ready', {});

        // Видаляємо обробник beforeunload
        window.removeEventListener('beforeunload', handleBeforeUnload);

        return true;
      })
      .catch(error => {
        log(`Не вдалося ініціалізувати додаток: ${error.message}`, 'error');

        // Публікуємо подію помилки ініціалізації
        _eventBus.publish('app-init-failed', { error });

        return false;
      });
  }

  /**
   * Обробник події beforeunload
   * @param {Event} event - Подія beforeunload
   */
  function handleBeforeUnload(event) {
    if (_state.isInitializing) {
      // Якщо йде ініціалізація, просимо користувача підтвердити закриття сторінки
      event.preventDefault();
      event.returnValue = 'Додаток ще завантажується. Ви впевнені, що хочете залишити сторінку?';
    }
  }

  // Реєструємо обробник beforeunload
  window.addEventListener('beforeunload', handleBeforeUnload);

  // Реєструємо обробник DOMContentLoaded
  document.addEventListener('DOMContentLoaded', function() {
    log("DOM завантажено, починаємо ініціалізацію");
    init();
  });

  // Запускаємо ініціалізацію, якщо DOM вже завантажено
  if (document.readyState === 'complete' || document.readyState === 'interactive') {
    log("DOM вже завантажено, починаємо ініціалізацію");
    init();
  }

  // Експортуємо публічне API
  window.AppInitializer = {
    // Основні методи
    init,
    registerModule,
    getUserId,

    // Методи для роботи з подіями
    onEvent: function(event, callback) {
      _eventBus.subscribe(event, callback);
    },
    offEvent: function(event, callback) {
      _eventBus.unsubscribe(event, callback);
    },

    // Методи для роботи з UI
    showLoadingIndicator,
    hideLoadingIndicator,
    showErrorMessage,

    // Метод для отримання статусу ініціалізації
    getStatus: function() {
      return {
        isInitialized: _state.isInitialized,
        isInitializing: _state.isInitializing,
        modules: Object.keys(_state.modules).map(moduleId => {
          const module = _state.modules[moduleId];
          return {
            id: module.id,
            status: module.status,
            dependencies: module.dependencies,
            priority: module.priority,
            retryCount: module.retryCount,
            initTime: module.initTime
          };
        })
      };
    }
  };
})();