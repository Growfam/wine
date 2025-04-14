/**
 * index.js - Головний інтеграційний модуль для всіх функцій розіграшів
 * Використовує нову архітектуру з мінімальною зв'язністю між модулями
 */

import WinixRaffles from './globals.js';

// Імпортуємо основні модулі (в реальній імплементації тут будуть справжні імпорти)
// import activeRaffles from './modules/active.js';
// import history from './modules/history.js';
// import stats from './modules/stats.js';
// і так далі...

/**
 * Модуль сервісу API для роботи з бекендом
 */
const ApiService = {
  _baseUrl: '/api',
  _requestTimeout: 30000, // 30 секунд
  _lastRequestTime: 0,
  _minRequestInterval: 500, // мінімальний інтервал між запитами (мс)

  /**
   * Ініціалізація API сервісу
   */
  init: function() {
    this._baseUrl = WinixRaffles.config.apiBaseUrl || '/api';

    // Підписуємось на події зміни мережевого з'єднання
    WinixRaffles.events.on('network-status-changed', (data) => {
      if (data.online) {
        WinixRaffles.logger.log('API Service: З\'єднання відновлено, можна відправляти запити');
      } else {
        WinixRaffles.logger.warn('API Service: З\'єднання втрачено, запити будуть відхилені');
      }
    });

    return this;
  },

  /**
   * Базова функція для HTTP запитів
   * @param {string} endpoint - Кінцева точка API
   * @param {Object} options - Опції запиту
   * @param {string} loaderId - Ідентифікатор для лоадера
   * @returns {Promise<any>} Результат запиту
   */
  async request(endpoint, options = {}, loaderId = null) {
    // Перевіряємо наявність мережевого з'єднання
    if (!WinixRaffles.network.isOnline()) {
      WinixRaffles.logger.warn(`API Service: Неможливо виконати запит до ${endpoint} - немає з'єднання`);
      throw new Error('Немає з`єднання з мережею');
    }

    // Обмежуємо частоту запитів
    const now = Date.now();
    const timeSinceLastRequest = now - this._lastRequestTime;

    if (timeSinceLastRequest < this._minRequestInterval) {
      const waitTime = this._minRequestInterval - timeSinceLastRequest;
      WinixRaffles.logger.debug(`API Service: Затримка запиту на ${waitTime}мс`);
      await new Promise(resolve => setTimeout(resolve, waitTime));
    }

    this._lastRequestTime = Date.now();

    // Показуємо індикатор завантаження, якщо вказано loaderId
    if (loaderId) {
      WinixRaffles.loader.show('Завантаження даних...', loaderId);
    }

    // Встановлюємо таймаут для запиту
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), this._requestTimeout);

    try {
      const url = `${this._baseUrl}${endpoint.startsWith('/') ? endpoint : `/${endpoint}`}`;

      const defaultOptions = {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json',
          'Accept': 'application/json'
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

      const response = await fetch(url, requestOptions);

      // Очищаємо таймаут, оскільки запит завершено
      clearTimeout(timeoutId);

      // Перевіряємо статус відповіді
      if (!response.ok) {
        // Намагаємось отримати детальну інформацію про помилку
        let errorData;
        try {
          errorData = await response.json();
        } catch (e) {
          errorData = { message: response.statusText };
        }

        throw {
          status: response.status,
          message: errorData.message || response.statusText,
          data: errorData
        };
      }

      // Перевіряємо, чи є вміст у відповіді
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        return await response.json();
      }

      return await response.text();
    } catch (error) {
      // Перевіряємо, чи помилка пов'язана з таймаутом
      if (error.name === 'AbortError') {
        throw new Error('Запит перервано через таймаут');
      }

      // Логуємо помилку і перекидаємо далі
      WinixRaffles.logger.error(`API Service: Помилка запиту до ${endpoint}:`, error);
      throw error;
    } finally {
      // Завжди приховуємо індикатор завантаження
      if (loaderId) {
        WinixRaffles.loader.hide(loaderId);
      }

      // Очищаємо таймаут, якщо він ще активний
      clearTimeout(timeoutId);
    }
  },

  /**
   * Виконання GET запиту
   * @param {string} endpoint - Кінцева точка API
   * @param {Object} params - Параметри запиту
   * @param {string} loaderId - Ідентифікатор для лоадера
   * @returns {Promise<any>} Результат запиту
   */
  async get(endpoint, params = {}, loaderId = null) {
    // Додаємо параметри запиту до URL
    const url = new URL(endpoint, window.location.origin);

    Object.keys(params).forEach(key => {
      url.searchParams.append(key, params[key]);
    });

    return this.request(url.pathname + url.search, { method: 'GET' }, loaderId);
  },

  /**
   * Виконання POST запиту
   * @param {string} endpoint - Кінцева точка API
   * @param {Object} data - Дані для відправлення
   * @param {string} loaderId - Ідентифікатор для лоадера
   * @returns {Promise<any>} Результат запиту
   */
  async post(endpoint, data = {}, loaderId = null) {
    return this.request(endpoint, {
      method: 'POST',
      body: data
    }, loaderId);
  },

  /**
   * Виконання PUT запиту
   * @param {string} endpoint - Кінцева точка API
   * @param {Object} data - Дані для відправлення
   * @param {string} loaderId - Ідентифікатор для лоадера
   * @returns {Promise<any>} Результат запиту
   */
  async put(endpoint, data = {}, loaderId = null) {
    return this.request(endpoint, {
      method: 'PUT',
      body: data
    }, loaderId);
  },

  /**
   * Виконання DELETE запиту
   * @param {string} endpoint - Кінцева точка API
   * @param {string} loaderId - Ідентифікатор для лоадера
   * @returns {Promise<any>} Результат запиту
   */
  async delete(endpoint, loaderId = null) {
    return this.request(endpoint, {
      method: 'DELETE'
    }, loaderId);
  },

  /**
   * Отримання даних користувача
   * @param {boolean} force - Примусове оновлення даних
   * @returns {Promise<Object>} Дані користувача
   */
  async getUserData(force = false) {
    const cacheKey = 'user-data';

    // Перевіряємо кеш, якщо не потрібне примусове оновлення
    if (!force) {
      const cachedData = WinixRaffles.cache.get(cacheKey);
      if (cachedData) {
        return cachedData;
      }
    }

    try {
      const userData = await this.get('/user/profile', {}, 'get-user-data');

      // Зберігаємо дані в кеш на 5 хвилин
      WinixRaffles.cache.set(cacheKey, userData, 300000);

      // Повідомляємо про оновлення даних користувача
      WinixRaffles.events.emit('user-data-updated', userData);

      return userData;
    } catch (error) {
      WinixRaffles.logger.error('Помилка отримання даних користувача:', error);
      throw error;
    }
  },

  // Тут можуть бути інші методи API...
};

/**
 * Реєстрація основних модулів системи
 */
function registerSystemModules() {
  // Реєструємо API сервіс
  WinixRaffles.registerModule('api', ApiService);

  // Реєструємо UI компоненти
  WinixRaffles.registerModule('uiComponents', {
    init: function() {
      WinixRaffles.logger.log('Ініціалізація UI компонентів');

      // Різні допоміжні функції для роботи з UI
      this.helpers = {
        /**
         * Показати повідомлення користувачу
         * @param {string} message - Текст повідомлення
         * @param {string} type - Тип повідомлення ('success', 'error', 'warning', 'info')
         */
        showToast: function(message, type = 'info') {
          if (typeof window.showToast === 'function') {
            window.showToast(message, type);
          } else {
            const toast = document.createElement('div');
            toast.className = `toast toast-${type}`;
            toast.textContent = message;

            document.body.appendChild(toast);

            // Показуємо елемент
            setTimeout(() => toast.classList.add('show'), 10);

            // Автоматично приховуємо через 5 секунд
            setTimeout(() => {
              toast.classList.remove('show');

              // Видаляємо елемент після анімації
              setTimeout(() => {
                document.body.removeChild(toast);
              }, 300);
            }, 5000);
          }
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
          } else {
            if (confirm(message)) {
              if (typeof onConfirm === 'function') onConfirm();
            } else {
              if (typeof onCancel === 'function') onCancel();
            }
          }
        }
      };

      // Реєструємо компоненти для зворотньої сумісності
      WinixRaffles.components.ui = this.helpers;

      return this;
    }
  });

  // Тут реєстрація інших модулів системи
  // ...
}

/**
 * Клас для управління модулями розіграшів і забезпечення єдиної точки входу
 */
class RafflesModule {
  constructor() {
    // Прапорець ініціалізації
    this._initialized = false;

    // Таймаут для повторної спроби ініціалізації
    this._initializationTimeout = null;

    // Максимальна кількість спроб ініціалізації
    this._maxInitializationAttempts = 3;

    // Лічильник спроб ініціалізації
    this._initializationAttempts = 0;

    // Прапорець наявності адмін прав
    this._isAdmin = false;

    // Додаємо обробники подій для документа
    this._setupInitialEventListeners();
  }

  /**
   * Встановлення початкових обробників подій
   * @private
   */
  _setupInitialEventListeners() {
    // Обробник події завантаження DOM
    document.addEventListener('DOMContentLoaded', () => {
      // Додаємо затримку для гарантованого завантаження інших модулів
      setTimeout(() => {
        this.init().catch(e => {
          WinixRaffles.logger.error("Помилка ініціалізації модуля розіграшів:", e);
        });
      }, 500);
    });

    // Обробник події оновлення даних користувача для перевірки адмін прав
    WinixRaffles.events.on('user-data-updated', (userData) => {
      if (userData && userData.isAdmin) {
        this._isAdmin = true;
        WinixRaffles.logger.log("Виявлено адміністраторські права");

        // Ініціалізуємо адміністративний модуль
        if (document.getElementById('admin-raffles-container')) {
          const adminModule = WinixRaffles.getModule('admin');
          if (adminModule) {
            adminModule.init().catch(e => {
              WinixRaffles.logger.error("Помилка ініціалізації адмін модуля:", e);
            });
          }
        }
      }
    });
  }

  /**
   * Ініціалізація всіх модулів розіграшів
   * @param {boolean} forceInit - Примусова ініціалізація, навіть якщо вже ініціалізовано
   * @returns {Promise<RafflesModule>} Екземпляр модуля
   */
  async init(forceInit = false) {
    // Якщо вже ініціалізовано і не потрібна примусова ініціалізація
    if (this._initialized && !forceInit) {
      WinixRaffles.logger.warn("Модуль розіграшів уже ініціалізовано");
      return this;
    }

    // Очищаємо таймаут, якщо він є
    if (this._initializationTimeout) {
      clearTimeout(this._initializationTimeout);
      this._initializationTimeout = null;
    }

    this._initializationAttempts++;

    try {
      WinixRaffles.logger.log("Ініціалізація основного модуля розіграшів");

      // Реєструємо основні модулі, якщо ще не зареєстровані
      registerSystemModules();

      // Ініціалізуємо систему WinixRaffles
      WinixRaffles.init();

      // Ініціалізуємо API сервіс
      await WinixRaffles.initModule('api');

      // Ініціалізуємо UI компоненти
      await WinixRaffles.initModule('uiComponents');

      // Оновлюємо дані користувача при ініціалізації
      const apiService = WinixRaffles.getModule('api');
      if (apiService) {
        try {
          WinixRaffles.logger.log("Оновлюємо дані користувача");
          await apiService.getUserData(true);
          WinixRaffles.logger.log("Дані користувача оновлено");
        } catch (userError) {
          WinixRaffles.logger.warn("Помилка оновлення даних користувача:", userError);
        }
      }

      // Ініціалізуємо інші модулі...

      // Додаємо обробники подій для перемикання вкладок
      this._initTabSwitching();

      // Перевіряємо наявність адміністраторських прав
      this._checkAdminAccess();

      // Експортуємо глобальні функції для зворотної сумісності
      this.exportGlobalFunctions();

      // Встановлюємо прапорець ініціалізації
      this._initialized = true;

      WinixRaffles.logger.log("Ініціалізацію модуля розіграшів завершено");

      return this;
    } catch (error) {
      WinixRaffles.logger.error("Критична помилка при ініціалізації модуля розіграшів:", error);

      // Якщо кількість спроб менша за максимальну, повторюємо ініціалізацію
      if (this._initializationAttempts < this._maxInitializationAttempts) {
        WinixRaffles.logger.log(`Повторна спроба ініціалізації (${this._initializationAttempts}/${this._maxInitializationAttempts})...`);

        // Очищаємо попередні стани
        this.resetAllStates();

        // Чекаємо 3 секунди перед повторною спробою
        this._initializationTimeout = setTimeout(() => {
          this.init(true);
        }, 3000);
      } else {
        WinixRaffles.logger.error("Досягнуто максимальної кількості спроб ініціалізації");

        // Показуємо повідомлення про помилку
        const uiComponents = WinixRaffles.getModule('uiComponents');
        if (uiComponents && uiComponents.helpers) {
          uiComponents.helpers.showToast("Не вдалося ініціалізувати модуль розіграшів", "error");
        }

        // Скидаємо лічильник спроб
        this._initializationAttempts = 0;
      }

      throw error;
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
   * Переключення між вкладками розіграшів
   * @param {string} tabName - Назва вкладки для активації
   */
  switchTab(tabName) {
    if (!tabName) {
      WinixRaffles.logger.error("Назва вкладки не вказана");
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

      // Емітуємо подію про зміну вкладки
      WinixRaffles.events.emit('tab-switched', { tab: tabName });

      // Отримуємо потрібні модулі для відображення контенту
      const networkService = WinixRaffles.network;
      const uiComponents = WinixRaffles.getModule('uiComponents');

      // Викликаємо відповідні функції в залежності від вкладки
      switch (tabName) {
        case 'past':
        case 'history':
          // Перевіряємо, чи пристрій онлайн
          if (!networkService.isOnline()) {
            uiComponents.helpers.showToast("Історія недоступна без підключення до Інтернету", "warning");
          } else {
            const historyModule = WinixRaffles.getModule('history');
            if (historyModule) {
              historyModule.displayHistory('history-container');
            }
          }
          break;

        case 'active':
          const activeModule = WinixRaffles.getModule('active');
          if (activeModule) {
            activeModule.displayRaffles();
          }
          break;

        case 'stats':
          // Перевіряємо, чи пристрій онлайн
          if (!networkService.isOnline()) {
            uiComponents.helpers.showToast("Статистика недоступна без підключення до Інтернету", "warning");
          } else {
            const statsModule = WinixRaffles.getModule('stats');
            if (statsModule) {
              statsModule.displayUserStats('user-stats-container');
            } else {
              WinixRaffles.logger.error("Модуль статистики не знайдено");
              this._showEmptyStatsMessage();
            }
          }
          break;

        case 'admin':
          // Перевіряємо, чи пристрій онлайн і чи є права адміна
          if (!networkService.isOnline()) {
            uiComponents.helpers.showToast("Адмін-панель недоступна без підключення до Інтернету", "warning");
          } else if (this._isAdmin) {
            const adminModule = WinixRaffles.getModule('admin');
            if (adminModule) {
              adminModule.displayRafflesList();
            }
          }
          break;

        default:
          WinixRaffles.logger.warn(`Невідома вкладка: ${tabName}`);
      }
    } catch (error) {
      WinixRaffles.logger.error("Помилка при переключенні вкладок:", error);

      const uiComponents = WinixRaffles.getModule('uiComponents');
      if (uiComponents && uiComponents.helpers) {
        uiComponents.helpers.showToast("Помилка при зміні вкладки", "error");
      }
    }
  }

  /**
   * Показати повідомлення про відсутність статистики
   * @private
   */
  _showEmptyStatsMessage() {
    const container = document.getElementById('user-stats-container');
    if (container) {
      container.innerHTML = `
        <div class="empty-stats">
          <div class="empty-stats-icon">📊</div>
          <h3>Статистика тимчасово недоступна</h3>
          <p>Спробуйте оновити сторінку або повторіть спробу пізніше.</p>
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
      // Перевіряємо наявність модуля AdminAPI
      if (window.AdminAPI && typeof window.AdminAPI.getAdminId === 'function') {
        const adminId = window.AdminAPI.getAdminId();
        if (adminId) {
          this._isAdmin = true;

          // Ініціалізуємо адміністративний модуль
          if (document.getElementById('admin-raffles-container')) {
            const adminModule = WinixRaffles.getModule('admin');
            if (adminModule) {
              adminModule.init();
            }
          }

          WinixRaffles.logger.log("Виявлено адміністраторські права");
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
        if (uiComponents && uiComponents.helpers) {
          uiComponents.helpers.showToast("Деталі розіграшу недоступні без підключення до Інтернету", "warning");
        }
        return;
      }

      WinixRaffles.events.emit('open-raffle-details', { raffleId, raffleType });
    };

    window.showRaffleHistoryDetails = (raffleData) => {
      WinixRaffles.events.emit('show-history-details', { raffleData });
    };

    // Створюємо об'єкт rafflesFunctions для зворотної сумісності зі старим кодом
    window.rafflesFunctions = {
      switchTab: this.switchTab.bind(this),
      loadRaffleHistory: () => {
        const historyModule = WinixRaffles.getModule('history');
        if (historyModule) {
          historyModule.displayHistory('history-container');
        }
      },
      resetAllStates: this.resetAllStates.bind(this),
      isOnline: WinixRaffles.network.isOnline.bind(WinixRaffles.network)
    };

    return this;
  }

  /**
   * Скидання всіх станів
   */
  resetAllStates() {
    // Скидання станів у всіх модулях
    for (const moduleName of ['active', 'history', 'stats', 'modals']) {
      try {
        const module = WinixRaffles.getModule(moduleName);
        if (module && typeof module.resetState === 'function') {
          module.resetState();
        }
      } catch (e) {
        WinixRaffles.logger.error(`Помилка скидання стану модуля ${moduleName}:`, e);
      }
    }

    // Закриття всіх модальних вікон
    try {
      const modalsModule = WinixRaffles.getModule('modals');
      if (modalsModule && typeof modalsModule.closeAllModals === 'function') {
        modalsModule.closeAllModals();
      }
    } catch (e) {
      WinixRaffles.logger.error("Помилка закриття модальних вікон:", e);
    }

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

    WinixRaffles.logger.log("Знищення модулів розіграшів");

    // Скидаємо всі стани
    this.resetAllStates();

    // Очищаємо таймаути
    if (this._initializationTimeout) {
      clearTimeout(this._initializationTimeout);
      this._initializationTimeout = null;
    }

    // Скидаємо прапорець ініціалізації
    this._initialized = false;
    this._initializationAttempts = 0;

    // Викликаємо знищення всієї системи
    WinixRaffles.destroy();

    WinixRaffles.logger.log("Модулі успішно знищено");

    return this;
  }
}

// Створюємо екземпляр модуля
const rafflesModule = new RafflesModule();

// Експортуємо модуль
export default rafflesModule;