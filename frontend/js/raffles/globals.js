/**
 * globals.js - Центральний модуль глобальних об'єктів для системи розіграшів
 * Реалізує патерн Модуль з подієвою архітектурою для зменшення зв'язності
 */

// Ізольований простір імен для WINIX з публічним API
const WinixRaffles = (function() {
  // Приватні змінні
  const _version = '1.0.1';
  const _config = {
    apiBaseUrl: '/api',
    defaultTTL: 300000, // 5 хвилин за замовчуванням
    debug: false,
    offlineMode: false
  };

  // Контейнер для зареєстрованих модулів
  const _modules = new Map();

  // Центр подій (шина подій)
  const _eventBus = {
    listeners: {},

    // Реєстрація обробника події
    on: function(eventName, callback) {
      if (!this.listeners[eventName]) {
        this.listeners[eventName] = [];
      }

      this.listeners[eventName].push(callback);

      // Для зворотної сумісності також додаємо слухача до DOM
      document.addEventListener(`winix:${eventName}`, function(e) {
        callback(e.detail);
      });

      return () => this.off(eventName, callback); // Повертаємо функцію для відписки
    },

    // Видалення обробника події
    off: function(eventName, callback) {
      if (!this.listeners[eventName]) return;

      if (callback) {
        this.listeners[eventName] = this.listeners[eventName].filter(
          listener => listener !== callback
        );

        // Видаляємо слухача DOM для зворотної сумісності
        document.removeEventListener(`winix:${eventName}`, callback);
      } else {
        // Якщо callback не визначено, видаляємо всі обробники події
        delete this.listeners[eventName];
      }
    },

    // Генерація події
    emit: function(eventName, data) {
      if (this.listeners[eventName]) {
        this.listeners[eventName].forEach(callback => {
          try {
            callback(data);
          } catch (error) {
            console.error(`Помилка в обробнику події ${eventName}:`, error);
          }
        });
      }

      // Для зворотної сумісності також створюємо подію DOM
      const event = new CustomEvent(`winix:${eventName}`, {
        detail: data
      });
      document.dispatchEvent(event);
    }
  };

  // Система логування з різними рівнями
  const _logger = {
    _isDebugEnabled: false,

    // Ініціалізація логера
    init: function(config) {
      this._isDebugEnabled = config && config.debug === true;
      return this;
    },

    // Логування інформаційних повідомлень
    log: function(message, ...args) {
      console.log(`🎮 WINIX: ${message}`, ...args);
    },

    // Логування попереджень
    warn: function(message, ...args) {
      console.warn(`⚠️ WINIX: ${message}`, ...args);
    },

    // Логування помилок
    error: function(message, ...args) {
      console.error(`❌ WINIX: ${message}`, ...args);
    },

    // Логування відлагоджувальної інформації (тільки в режимі debug)
    debug: function(message, ...args) {
      if (this._isDebugEnabled) {
        console.debug(`🔍 WINIX [DEBUG]: ${message}`, ...args);
      }
    }
  };

  // Центральне управління станами завантаження
  const _loader = {
    _activeLoaders: 0,
    _pendingTimeouts: {},

    // Показ індикатора завантаження
    show: function(message = 'Завантаження...', id = null) {
      this._activeLoaders++;

      // Якщо є ID, зберігаємо його для можливості окремого приховування
      if (id) {
        this._pendingTimeouts[id] = setTimeout(() => {
          _logger.warn(`Loader ${id} не був прихований протягом 30 секунд, автоматичне приховування`);
          this.hide(id);
        }, 30000);
      }

      if (typeof window.showLoading === 'function') {
        window.showLoading(message);
      } else {
        const spinner = document.getElementById('loading-spinner');
        if (spinner) spinner.classList.add('show');

        const spinnerText = document.getElementById('loading-spinner-text');
        if (spinnerText) spinnerText.textContent = message;
      }

      _eventBus.emit('loader-shown', { message, id });
    },

    // Приховування індикатора завантаження
    hide: function(id = null) {
      if (id && this._pendingTimeouts[id]) {
        clearTimeout(this._pendingTimeouts[id]);
        delete this._pendingTimeouts[id];
      }

      this._activeLoaders = Math.max(0, this._activeLoaders - 1);

      // Приховуємо лоадер тільки якщо всі завантаження завершено
      if (this._activeLoaders === 0) {
        if (typeof window.hideLoading === 'function') {
          window.hideLoading();
        } else {
          const spinner = document.getElementById('loading-spinner');
          if (spinner) spinner.classList.remove('show');
        }

        _eventBus.emit('loader-hidden', { id });
      }
    },

    // Примусове приховування всіх індикаторів
    hideAll: function() {
      // Очищаємо всі таймаути
      Object.keys(this._pendingTimeouts).forEach(id => {
        clearTimeout(this._pendingTimeouts[id]);
      });

      this._pendingTimeouts = {};
      this._activeLoaders = 0;

      if (typeof window.hideLoading === 'function') {
        window.hideLoading();
      } else {
        const spinner = document.getElementById('loading-spinner');
        if (spinner) spinner.classList.remove('show');
      }

      _eventBus.emit('all-loaders-hidden', {});
    },

    // Перевірка, чи є активні завантаження
    isLoading: function() {
      return this._activeLoaders > 0;
    }
  };

  // Фабрика для створення нових модулів
  const _createModule = function(name, moduleDefinition) {
    if (_modules.has(name)) {
      _logger.warn(`Модуль з іменем "${name}" вже існує і буде перезаписано`);
    }

    // Базовий шаблон модуля з функціями життєвого циклу
    const baseModule = {
      name,
      initialized: false,

      // Стандартна функція ініціалізації
      init: async function() {
        if (this.initialized) {
          _logger.warn(`Модуль "${name}" вже ініціалізовано`);
          return this;
        }

        try {
          _logger.debug(`Ініціалізація модуля "${name}" розпочата`);
          await Promise.resolve(moduleDefinition.init?.call(this));
          this.initialized = true;
          _logger.debug(`Ініціалізація модуля "${name}" успішно завершена`);
          _eventBus.emit(`module-initialized`, { name });
        } catch (error) {
          _logger.error(`Помилка ініціалізації модуля "${name}":`, error);
          throw error;
        }

        return this;
      },

      // Функція очищення/знищення
      destroy: function() {
        if (!this.initialized) {
          return this;
        }

        try {
          _logger.debug(`Знищення модуля "${name}" розпочато`);
          moduleDefinition.destroy?.call(this);
          this.initialized = false;
          _logger.debug(`Знищення модуля "${name}" успішно завершено`);
          _eventBus.emit(`module-destroyed`, { name });
        } catch (error) {
          _logger.error(`Помилка знищення модуля "${name}":`, error);
        }

        return this;
      },

      // Отримання сервісу за ім'ям
      getService: function(serviceName) {
        if (!_modules.has(serviceName)) {
          _logger.error(`Сервіс "${serviceName}" не знайдено`);
          return null;
        }

        return _modules.get(serviceName);
      }
    };

    // Об'єднуємо базовий модуль з визначенням користувача
    const module = {
      ...baseModule,
      ...moduleDefinition
    };

    _modules.set(name, module);
    _logger.debug(`Модуль "${name}" зареєстровано`);

    return module;
  };

  // Сервіс для управління кешем
  const _cacheService = {
    _cache: new Map(),

    // Встановлення елемента в кеш
    set: function(key, value, ttl = _config.defaultTTL) {
      const expiresAt = ttl ? Date.now() + ttl : null;

      this._cache.set(key, {
        value,
        expiresAt
      });

      // Якщо є TTL, встановлюємо таймер для очищення
      if (expiresAt) {
        setTimeout(() => {
          this.remove(key);
        }, ttl);
      }

      return value;
    },

    // Отримання елемента з кешу
    get: function(key) {
      const entry = this._cache.get(key);

      if (!entry) {
        return null;
      }

      // Перевіряємо, чи не застарів кеш
      if (entry.expiresAt && entry.expiresAt < Date.now()) {
        this.remove(key);
        return null;
      }

      return entry.value;
    },

    // Видалення елемента з кешу
    remove: function(key) {
      return this._cache.delete(key);
    },

    // Очищення всього кешу
    clear: function() {
      this._cache.clear();
    },

    // Перевірка наявності елемента в кеші
    has: function(key) {
      const entry = this._cache.get(key);

      if (!entry) {
        return false;
      }

      // Перевіряємо, чи не застарів кеш
      if (entry.expiresAt && entry.expiresAt < Date.now()) {
        this.remove(key);
        return false;
      }

      return true;
    }
  };

  // Перевірка мережевого з'єднання
  const _networkService = {
    // Перевірка, чи пристрій онлайн
    isOnline: function() {
      if (_config.offlineMode) return false;
      return typeof navigator.onLine === 'undefined' || navigator.onLine;
    },

    // Примусовий режим офлайн
    setOfflineMode: function(offline) {
      const prevState = _config.offlineMode;
      _config.offlineMode = !!offline;

      if (prevState !== _config.offlineMode) {
        _eventBus.emit('network-status-changed', {
          online: !_config.offlineMode,
          forced: true
        });
      }
    }
  };

  // Ініціалізація основних функцій системи
  const init = function(userConfig = {}) {
    // Оновлюємо конфігурацію
    Object.assign(_config, userConfig);

    // Ініціалізуємо логер
    _logger.init(_config);

    // Реєструємо обробники подій онлайн/офлайн
    window.addEventListener('online', () => {
      _logger.log("З'єднання з мережею відновлено");
      _eventBus.emit('network-status-changed', { online: true, forced: false });
    });

    window.addEventListener('offline', () => {
      _logger.warn("З'єднання з мережею втрачено");
      _eventBus.emit('network-status-changed', { online: false, forced: false });
    });

    _logger.log(`Ініціалізація системи розіграшів (v${_version})`);

    // Створюємо подію для оповіщення про ініціалізацію
    _eventBus.emit('raffles-initialized', { version: _version });

    return publicAPI;
  };

  // Знищення всіх модулів та очищення ресурсів
  const destroy = function() {
    // Очищуємо всі лоадери
    _loader.hideAll();

    // Знищуємо всі зареєстровані модулі
    for (const [name, module] of _modules.entries()) {
      if (module.initialized && typeof module.destroy === 'function') {
        try {
          module.destroy();
        } catch (error) {
          _logger.error(`Помилка знищення модуля "${name}":`, error);
        }
      }
    }

    // Оповіщаємо про завершення роботи
    _eventBus.emit('raffles-destroyed', {});

    _logger.log(`Систему розіграшів закрито`);

    return publicAPI;
  };

  // Публічний API системи
  const publicAPI = {
    // Версія системи
    get version() {
      return _version;
    },

    // Конфігурація (тільки для читання)
    get config() {
      return { ..._config };
    },

    // Функції ініціалізації та знищення
    init,
    destroy,

    // Менеджер подій
    events: {
      on: _eventBus.on.bind(_eventBus),
      off: _eventBus.off.bind(_eventBus),
      emit: _eventBus.emit.bind(_eventBus)
    },

    // Система завантаження
    loader: {
      show: _loader.show.bind(_loader),
      hide: _loader.hide.bind(_loader),
      hideAll: _loader.hideAll.bind(_loader),
      isLoading: _loader.isLoading.bind(_loader)
    },

    // Логер
    logger: {
      log: _logger.log.bind(_logger),
      warn: _logger.warn.bind(_logger),
      error: _logger.error.bind(_logger),
      debug: _logger.debug.bind(_logger)
    },

    // Реєстрація нових модулів
    registerModule: function(name, moduleDefinition) {
      return _createModule(name, moduleDefinition);
    },

    // Отримання модуля за ім'ям
    getModule: function(name) {
      return _modules.get(name) || null;
    },

    // Ініціалізація конкретного модуля за ім'ям
    initModule: async function(name) {
      const module = _modules.get(name);

      if (!module) {
        _logger.error(`Модуль "${name}" не знайдено`);
        return null;
      }

      return module.init();
    },

    // Ініціалізація всіх модулів
    initAllModules: async function() {
      const results = [];

      for (const [name, module] of _modules.entries()) {
        try {
          await module.init();
          results.push({ name, success: true });
        } catch (error) {
          results.push({ name, success: false, error });
        }
      }

      return results;
    },

    // Сервіс кешування
    cache: _cacheService,

    // Мережевий сервіс
    network: _networkService,

    // Активні розіграші
    active: {},

    // Історія розіграшів
    history: {},

    // Статистика
    stats: {},

    // Модуль участі
    participation: {},

    // Компоненти інтерфейсу
    components: {},

    // Адмін модуль
    admin: {
      management: {}
    },

    // API сервіс, буде замінено на справжню реалізацію
    api: {}
  };

  // Повертаємо публічний API
  return publicAPI;
})();

// Експортуємо об'єкт як за замовчуванням
export default WinixRaffles;

// Для зворотної сумісності робимо об'єкт доступним глобально
// Це потрібно на час міграції, пізніше можна видалити
window.WinixRaffles = WinixRaffles;

console.log("🎮 WINIX Raffles: Ініціалізація глобальної структури об'єктів");