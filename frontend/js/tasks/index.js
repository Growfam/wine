/**
 * Точка входу системи завдань WINIX
 *
 * Ініціалізує всі модулі та експортує публічне API
 * @version 3.1.0
 */

// Імпорт фабрики сервісів для ініціалізації
import { serviceFactory } from './utils/index.js';
console.log('Фабрика сервісів ініціалізована:', !!serviceFactory);

// Імпорт конфігурації
import * as TaskTypes from './config/index.js';
import { CONFIG } from './config/settings.js';

// Імпорт контейнера залежностей
import dependencyContainer from './utils/core/dependency.js';
import { getLogger } from './utils/core/logger.js';

// Створюємо логер для основної системи
const logger = getLogger('TaskSystem');

// Імпорт API (без створення циркулярних залежностей)
import taskApiFactory from './api/index.js';

// Оголошення модулів, які будуть завантажені динамічно
let moduleCache = {
  models: null,
  api: null,
  services: null,
  ui: null,
};

/**
 * Клас для управління системою завдань
 */
class TaskSystem {
  constructor() {
    this.initialized = false;
    this.version = '3.1.0';

    // Зберігаємо посилання на всі модулі та сервіси
    this.api = null;
    this.store = null;
    this.verification = null;
    this.progress = null;
    this.dailyBonus = null;

    // Моделі завдань будуть завантажені при ініціалізації
    this.models = {};

    // Типи та константи
    this.types = TaskTypes;
    this.config = CONFIG;

    // Реєстрація в контейнері залежностей
    dependencyContainer.register('TaskSystem', this);

    // Логуємо створення системи
    logger.info('Створено екземпляр системи завдань', 'constructor');
  }

  /**
   * Асинхронне завантаження всіх необхідних модулів
   * @returns {Promise<boolean>}
   */
  async loadModules() {
    try {
      logger.info('Початок завантаження модулів', 'loadModules');

      // Якщо модулі вже в кеші, повертаємо їх
      if (moduleCache.models && moduleCache.services) {
        logger.info('Використання кешованих модулів', 'loadModules');
        return true;
      }

      // Завантажуємо всі необхідні модулі паралельно
      const [modelsModule, servicesModule, uiModule] = await Promise.all([
        import('./models'),
        import('./services'),
        import('./ui'),
      ]);

      // Зберігаємо модулі в кеш
      moduleCache.models = modelsModule;
      moduleCache.services = servicesModule;
      moduleCache.ui = uiModule;

      // Ініціалізуємо API (створюємо один раз)
      if (!moduleCache.api) {
        moduleCache.api = taskApiFactory;
        moduleCache.api.init();
      }

      // Сервіси завдань
      const { taskStore, taskVerification, taskProgress, dailyBonusService } = servicesModule;

      // Оновлюємо посилання на сервіси
      this.api = moduleCache.api;
      this.store = taskStore;
      this.verification = taskVerification;
      this.progress = taskProgress;
      this.dailyBonus = dailyBonusService;

      // Оновлюємо посилання на моделі
      this.models = modelsModule;

      logger.info('Всі модулі успішно завантажено', 'loadModules');
      return true;
    } catch (error) {
      logger.error('Помилка завантаження модулів', 'loadModules', { error });
      return false;
    }
  }

  /**
   * Ініціалізація всієї системи завдань
   * @param {Object} options - Опції ініціалізації
   * @returns {Promise<boolean>} Результат ініціалізації
   */
  async initialize(options = {}) {
    if (this.initialized) {
      logger.info('Система вже ініціалізована', 'initialize');
      return true;
    }

    logger.info('Початок ініціалізації', 'initialize', { options });

    try {
      // Спочатку завантажуємо всі необхідні модулі
      const modulesLoaded = await this.loadModules();
      if (!modulesLoaded) {
        throw new Error('Не вдалося завантажити необхідні модулі');
      }

      // Реєстрація основних модулів у контейнері залежностей
      dependencyContainer
        .register('taskApi', this.api)
        .register('taskStore', this.store)
        .register('taskVerification', this.verification)
        .register('taskProgress', this.progress)
        .register('dailyBonusService', this.dailyBonus);

      // Ініціалізуємо сховище
      if (typeof this.store.initialize === 'function') {
        this.store.initialize(options.store);
      }

      // Ініціалізуємо модуль прогресу
      if (typeof this.progress.initialize === 'function') {
        this.progress.initialize(options.progress);
      }

      // Ініціалізуємо щоденні бонуси
      if (typeof this.dailyBonus.initialize === 'function') {
        this.dailyBonus.initialize(options.dailyBonus);
      }

      // Спробуємо завантажити завдання
      try {
        const tasksData = await this.api.getAllTasks({
          forceRefresh: options.forceRefresh || false,
        });

        // Зберігаємо завдання у сховище
        this.store.setTasks(TaskTypes.TASK_TYPES.SOCIAL, tasksData.social || []);
        this.store.setTasks(TaskTypes.TASK_TYPES.LIMITED, tasksData.limited || []);
        this.store.setTasks(TaskTypes.TASK_TYPES.PARTNER, tasksData.partner || []);

        // Розділяємо соціальні та реферальні завдання
        const referralTasks = (tasksData.social || []).filter(
          (task) =>
            (task.tags && Array.isArray(task.tags) && task.tags.includes('referral')) ||
            task.type === 'referral' ||
            (task.title &&
              (task.title.toLowerCase().includes('referral') ||
                task.title.toLowerCase().includes('запроси') ||
                task.title.toLowerCase().includes('запросити')))
        );

        // Зберігаємо реферальні завдання
        if (referralTasks.length > 0) {
          this.store.setTasks(TaskTypes.TASK_TYPES.REFERRAL, referralTasks);
        }

        // Зберігаємо прогрес, якщо є
        if (tasksData.userProgress) {
          this.store.setUserProgress(tasksData.userProgress);
        }

        logger.info('Всі типи завдань успішно завантажено', 'initialize', {
          social: (tasksData.social || []).length,
          limited: (tasksData.limited || []).length,
          partner: (tasksData.partner || []).length,
          referral: referralTasks.length,
        });
      } catch (loadError) {
        logger.warn('Помилка завантаження завдань, продовжуємо ініціалізацію', 'initialize', {
          error: loadError,
        });
      }

      // Встановлюємо прапорець ініціалізації
      this.initialized = true;

      // Генеруємо подію ініціалізації
      this.dispatchSystemEvent('initialized', {
        version: this.version,
      });

      // Ін'єктуємо посилання на TaskSystem в інші модулі
      this.injectSystemReference();

      logger.info('Ініціалізацію завершено успішно', 'initialize');
      return true;
    } catch (error) {
      logger.error('Критична помилка ініціалізації', 'initialize', { error });

      // Генеруємо подію помилки
      this.dispatchSystemEvent('initialization-error', {
        error: error.message,
      });

      return false;
    }
  }

  /**
   * Ін'єктування посилання на TaskSystem в інші модулі
   */
  injectSystemReference() {
    const modules = [this.api, this.store, this.verification, this.progress, this.dailyBonus];

    modules.forEach((module) => {
      if (module && typeof module === 'object') {
        module.taskSystem = this;
      }
    });

    logger.debug("Посилання на TaskSystem ін'єктовано в модулі", 'injectSystemReference');
  }

  /**
   * Генерація події системи
   * @param {string} eventName - Назва події
   * @param {Object} data - Дані події
   */
  dispatchSystemEvent(eventName, data = {}) {
    if (typeof document === 'undefined') return;

    const event = new CustomEvent(`task-system-${eventName}`, {
      detail: {
        ...data,
        timestamp: Date.now(),
      },
    });

    document.dispatchEvent(event);
    logger.debug(`Згенеровано подію ${eventName}`, 'dispatchSystemEvent', { data });
  }

  /**
   * Отримання задач певного типу
   * @param {string} type - Тип завдань
   * @returns {Array} Масив завдань
   */
  getTasks(type) {
    return this.store?.getTasks(type) || [];
  }

  /**
   * Пошук завдання за ID
   * @param {string} taskId - ID завдання
   * @returns {Object|null} Знайдене завдання
   */
  findTaskById(taskId) {
    return this.store?.findTaskById(taskId) || null;
  }

  /**
   * Запуск завдання
   * @param {string} taskId - ID завдання
   * @returns {Promise<Object>} Результат операції
   */
  async startTask(taskId) {
    try {
      if (!this.api) {
        throw new Error('API не ініціалізовано');
      }

      const response = await this.api.startTask(taskId);

      if (response.status === 'success' || response.success) {
        // Оновлюємо прогрес
        if (response.data && response.data.progress) {
          this.progress.updateTaskProgress(taskId, response.data.progress);
        } else {
          // Встановлюємо базовий прогрес, якщо він не повернувся з сервера
          this.progress.updateTaskProgress(taskId, {
            status: 'started',
            progress_value: 0,
            task_id: taskId,
          });
        }

        // Генеруємо подію про запуск завдання
        this.dispatchSystemEvent('task-started', {
          taskId,
          response,
        });

        // Отримуємо дані завдання
        const task = this.findTaskById(taskId);

        // Повертаємо результат
        return {
          success: true,
          message: response.message || 'Завдання успішно активовано',
          task,
          action_url: task?.action_url || task?.channel_url,
        };
      } else {
        // Повертаємо помилку
        return {
          success: false,
          message: response.message || response.error || 'Помилка запуску завдання',
          error: response.error,
        };
      }
    } catch (error) {
      logger.error('Помилка запуску завдання', 'startTask', { taskId, error });

      return {
        success: false,
        message: 'Помилка запуску завдання',
        error: error.message,
      };
    }
  }

  /**
   * Верифікація завдання
   * @param {string} taskId - ID завдання
   * @returns {Promise<Object>} Результат верифікації
   */
  async verifyTask(taskId) {
    if (!this.verification) {
      logger.error('Модуль верифікації не ініціалізовано', 'verifyTask', { taskId });
      return { success: false, message: 'Модуль верифікації не ініціалізовано' };
    }

    return await this.verification.verifyTask(taskId);
  }

  /**
   * Оновлення прогресу завдання
   * @param {string} taskId - ID завдання
   * @param {Object} progressData - Дані прогресу
   * @returns {boolean} Результат операції
   */
  updateTaskProgress(taskId, progressData) {
    if (!this.progress) {
      logger.error('Модуль прогресу не ініціалізовано', 'updateTaskProgress', { taskId });
      return false;
    }

    return this.progress.updateTaskProgress(taskId, progressData);
  }

  /**
   * Отримання прогресу завдання
   * @param {string} taskId - ID завдання
   * @returns {Object|null} Прогрес завдання
   */
  getTaskProgress(taskId) {
    if (!this.progress) {
      logger.error('Модуль прогресу не ініціалізовано', 'getTaskProgress', { taskId });
      return null;
    }

    return this.progress.getTaskProgress(taskId);
  }

  /**
   * Синхронізація прогресу з сервером
   * @returns {Promise<Object>} Результат операції
   */
  async syncProgress() {
    if (!this.progress) {
      logger.error('Модуль прогресу не ініціалізовано', 'syncProgress');
      return { success: false, message: 'Модуль прогресу не ініціалізовано' };
    }

    return await this.progress.syncAllProgress();
  }

  /**
   * Отримання щоденного бонусу
   * @returns {Promise<Object>} Результат операції
   */
  async claimDailyBonus() {
    if (!this.dailyBonus) {
      logger.error('Модуль щоденних бонусів не ініціалізовано', 'claimDailyBonus');
      return { success: false, message: 'Модуль щоденних бонусів не ініціалізовано' };
    }

    try {
      const result = await this.dailyBonus.claimDailyBonus();

      // Оновлюємо баланс, якщо бонус отримано успішно
      if (result.success && result.data && result.data.amount) {
        this.updateBalance('coins', result.data.amount, true);
      }

      return result;
    } catch (error) {
      logger.error('Помилка отримання щоденного бонусу', 'claimDailyBonus', { error });
      return {
        success: false,
        message: 'Помилка отримання щоденного бонусу',
        error: error.message,
      };
    }
  }

  /**
   * Зміна активної вкладки
   * @param {string} tabType - Тип вкладки
   */
  setActiveTab(tabType) {
    if (!this.store) {
      logger.error('Сховище не ініціалізовано', 'setActiveTab', { tabType });
      return;
    }

    this.store.setActiveTab(tabType);
  }

  /**
   * Оновлення балансу
   * @param {string} type - Тип балансу ('coins' або 'tokens')
   * @param {number} amount - Сума
   * @param {boolean} isIncrement - Чи є це збільшенням
   */
  updateBalance(type, amount, isIncrement = true) {
    if (!this.store) {
      logger.error('Сховище не ініціалізовано', 'updateBalance', { type, amount, isIncrement });
      return;
    }

    this.store.updateBalance(type, amount, isIncrement);

    // Оновлюємо відображення в інтерфейсі
    this.updateBalanceUI(type, amount, isIncrement);
  }

  /**
   * Оновлення відображення балансу в UI
   * @param {string} type - Тип балансу ('coins' або 'tokens')
   * @param {number} amount - Сума
   * @param {boolean} isIncrement - Чи є це збільшенням
   * @private
   */
  updateBalanceUI(type, amount, isIncrement) {
    if (typeof document === 'undefined') return;

    // ID елементів в UI
    const elementIds = {
      coins: 'user-coins',
      tokens: 'user-tokens',
    };

    const elementId = elementIds[type];
    if (!elementId) return;

    // Отримуємо елемент
    const element = document.getElementById(elementId);
    if (!element) return;

    // Отримуємо поточне значення
    let currentValue = parseInt(element.textContent.replace(/[^\d]/g, '')) || 0;

    // Оновлюємо значення
    let newValue = isIncrement ? currentValue + amount : Math.max(0, currentValue - amount);

    // Оновлюємо відображення
    element.textContent = newValue.toString();

    // Анімуємо зміну
    element.classList.add(isIncrement ? 'balance-increased' : 'balance-decreased');

    // Видаляємо клас анімації після завершення
    setTimeout(() => {
      element.classList.remove('balance-increased', 'balance-decreased');
    }, 1500);
  }

  /**
   * Отримання стану системи
   * @returns {Object} Стан системи
   */
  getSystemState() {
    if (!this.store) return { initialized: false, version: this.version };

    return {
      initialized: this.initialized,
      version: this.version,
      activeTabType: this.store.systemState?.activeTabType,
      tasksCount: {
        social: this.store.tasks?.[TaskTypes.TASK_TYPES.SOCIAL]?.length || 0,
        limited: this.store.tasks?.[TaskTypes.TASK_TYPES.LIMITED]?.length || 0,
        partner: this.store.tasks?.[TaskTypes.TASK_TYPES.PARTNER]?.length || 0,
        referral: this.store.tasks?.[TaskTypes.TASK_TYPES.REFERRAL]?.length || 0,
      },
    };
  }

  /**
   * Діагностика системи
   * @returns {Object} Діагностична інформація
   */
  diagnostics() {
    if (!this.store)
      return {
        initialized: this.initialized,
        version: this.version,
        modulesLoaded: false,
      };

    return {
      initialized: this.initialized,
      version: this.version,
      systemState: this.store.systemState,
      tasks: {
        social: this.store.tasks?.[TaskTypes.TASK_TYPES.SOCIAL]?.length || 0,
        limited: this.store.tasks?.[TaskTypes.TASK_TYPES.LIMITED]?.length || 0,
        partner: this.store.tasks?.[TaskTypes.TASK_TYPES.PARTNER]?.length || 0,
        referral: this.store.tasks?.[TaskTypes.TASK_TYPES.REFERRAL]?.length || 0,
      },
      userProgress: this.store.userProgress ? Object.keys(this.store.userProgress).length : 0,
      api: {
        baseUrl: this.api?.baseUrl || 'не налаштовано',
        version: this.api?.version || 'невідомо',
      },
      dailyBonus: {
        initialized: !!this.dailyBonus,
        claimed: this.dailyBonus?.isClaimedToday?.() || false,
      },
      dependencies: {
        registered: dependencyContainer.getRegisteredModules?.() || [],
      },
    };
  }

  /**
   * Скидання стану системи
   */
  reset() {
    // Скидаємо стан сховища
    if (this.store) this.store.resetState();

    // Скидаємо стан сервісів
    if (this.progress) this.progress.resetState();
    if (this.verification) this.verification.resetState();
    if (this.dailyBonus) this.dailyBonus.resetState?.();

    // Очищаємо кеш API
    if (this.api && this.api.clearCache) {
      this.api.clearCache();
    }

    // Встановлюємо прапорець ініціалізації
    this.initialized = false;

    // Генеруємо подію скидання
    this.dispatchSystemEvent('reset');

    logger.info('Стан системи скинуто', 'reset');
  }
}

// Створюємо і експортуємо єдиний екземпляр системи
const taskSystem = new TaskSystem();

// Для зворотної сумісності з глобальним namespace
window.TaskManager = {
  // Основні методи
  init: taskSystem.initialize.bind(taskSystem),
  loadTasks: () => taskSystem.initialize(),
  findTaskById: taskSystem.findTaskById.bind(taskSystem),
  startTask: taskSystem.startTask.bind(taskSystem),
  verifyTask: taskSystem.verifyTask.bind(taskSystem),
  updateTaskProgress: taskSystem.updateTaskProgress.bind(taskSystem),
  getTaskProgress: taskSystem.getTaskProgress.bind(taskSystem),
  claimDailyBonus: taskSystem.claimDailyBonus.bind(taskSystem),

  // Додаткові методи
  diagnoseSystemState: taskSystem.diagnostics.bind(taskSystem),
  refreshAllTasks: () => taskSystem.initialize({ forceRefresh: true }),
  showErrorMessage: (message) => {
    // Для сумісності з попередньою версією
    console.error(message);
    return false;
  },
  showSuccessMessage: (message) => {
    // Для сумісності з попередньою версією
    console.log(message);
    return true;
  },

  // Властивості
  get initialized() {
    return taskSystem.initialized;
  },
  get version() {
    return taskSystem.version;
  },
  REWARD_TYPES: TaskTypes.REWARD_TYPES,
};

// Реєструємо TaskManager у контейнері залежностей
dependencyContainer.register('TaskManager', window.TaskManager);

// Для використання в сучасному синтаксисі
window.WINIX = window.WINIX || {};
window.WINIX.tasks = taskSystem;

// Автоматична ініціалізація при завантаженні сторінки
if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      logger.debug('DOM завантажено, автоматична ініціалізація TaskSystem');
      setTimeout(() => taskSystem.initialize(), 100);
    });
  } else {
    // DOM вже завантажено
    logger.debug('DOM вже завантажено, автоматична ініціалізація TaskSystem');
    setTimeout(() => taskSystem.initialize(), 100);
  }
}

// Експортуємо для використання в модулях
export default taskSystem;


