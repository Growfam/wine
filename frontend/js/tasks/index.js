/**
 * Точка входу системи завдань
 *
 * Ініціалізує всі модулі та експортує публічне API
 */

// Імпорт конфігурації
import * as TaskTypes from './config/task-types.js';

// Імпорт контейнера залежностей
import dependencyContainer from './utils';

// Оголошення прямих імпортів без створення циркулярних залежностей
// Типи моделей будуть завантажені динамічно, щоб уникнути циклів залежностей
let TaskModel, SocialTaskModel, LimitedTaskModel, PartnerTaskModel;
let taskApi, taskStore, taskVerification, taskProgress;

/**
 * Клас для управління системою завдань
 */
class TaskSystem {
  constructor() {
    this.initialized = false;
    this.version = '1.0.0';

    // Зберігаємо посилання на всі модулі та моделі
    this.api = null;
    this.store = null;
    this.verification = null;
    this.progress = null;

    // Моделі завдань будуть завантажені при ініціалізації
    this.models = {};

    // Типи та константи
    this.types = TaskTypes;

    // Реєстрація в контейнері залежностей
    dependencyContainer.register('TaskSystem', this);
  }

  /**
   * Асинхронне завантаження всіх необхідних модулів
   * @returns {Promise<void>}
   */
  async loadModules() {
    try {
      // Динамічне завантаження модулів для уникнення циркулярних залежностей
      const modelModule = await import('./models/task-model.js');
      const socialModelModule = await import('./models/social-task-model.js');
      const limitedModelModule = await import('./models/limited-task-model.js');
      const partnerModelModule = await import('./models/partner-task-model.js');

      // Зберігаємо посилання на моделі
      TaskModel = modelModule.default;
      SocialTaskModel = socialModelModule.default;
      LimitedTaskModel = limitedModelModule.default;
      PartnerTaskModel = partnerModelModule.default;

      // Завантажуємо сервіси
      const apiModule = await import('./services/task-api.js');
      const storeModule = await import('./services/task-store.js');
      const verificationModule = await import('./services/task-verification.js');
      const progressModule = await import('./services/task-progress.js');

      // Зберігаємо посилання на сервіси
      taskApi = apiModule.default;
      taskStore = storeModule.default;
      taskVerification = verificationModule.default;
      taskProgress = progressModule.default;

      // Оновлюємо посилання на моделі
      this.models = {
        TaskModel,
        SocialTaskModel,
        LimitedTaskModel,
        PartnerTaskModel
      };

      console.log('TaskSystem: Всі модулі успішно завантажено');
      return true;
    } catch (error) {
      console.error('TaskSystem: Помилка завантаження модулів:', error);
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
      console.log('TaskSystem: Система вже ініціалізована');
      return true;
    }

    console.log('TaskSystem: Початок ініціалізації');

    try {
      // Спочатку завантажуємо всі необхідні модулі
      const modulesLoaded = await this.loadModules();
      if (!modulesLoaded) {
        throw new Error('Не вдалося завантажити необхідні модулі');
      }

      // Реєстрація основних модулів у контейнері залежностей
      dependencyContainer
        .register('taskApi', taskApi)
        .register('taskStore', taskStore)
        .register('taskVerification', taskVerification)
        .register('taskProgress', taskProgress);

      // Встановлення посилань на модулі
      this.api = taskApi;
      this.store = taskStore;
      this.verification = taskVerification;
      this.progress = taskProgress;

      // Ініціалізуємо сховище
      if (typeof this.store.initialize === 'function') {
        this.store.initialize();
      }

      // Ініціалізуємо модуль прогресу
      if (typeof this.progress.initialize === 'function') {
        this.progress.initialize();
      }

      // Спробуємо завантажити завдання
      try {
        const tasksData = await this.api.loadAllTasks();

        // Зберігаємо завдання у сховище
        this.store.setTasks(TaskTypes.TASK_TYPES.SOCIAL, tasksData.social);
        this.store.setTasks(TaskTypes.TASK_TYPES.LIMITED, tasksData.limited);
        this.store.setTasks(TaskTypes.TASK_TYPES.PARTNER, tasksData.partner);

        // Розділяємо соціальні та реферальні завдання
        const referralTasks = tasksData.social.filter(task =>
          (task.tags && Array.isArray(task.tags) && task.tags.includes('referral')) ||
          task.type === 'referral' ||
          (task.title && (
            task.title.toLowerCase().includes('referral') ||
            task.title.toLowerCase().includes('запроси') ||
            task.title.toLowerCase().includes('запросити')
          ))
        );

        // Зберігаємо реферальні завдання
        if (referralTasks.length > 0) {
          this.store.setTasks(TaskTypes.TASK_TYPES.REFERRAL, referralTasks);
        }

        // Зберігаємо прогрес, якщо є
        if (tasksData.userProgress) {
          this.store.setUserProgress(tasksData.userProgress);
        }

        console.log('TaskSystem: Всі типи завдань успішно завантажено');
      } catch (loadError) {
        console.warn('TaskSystem: Помилка завантаження завдань, продовжуємо ініціалізацію:', loadError);
      }

      // Встановлюємо прапорець ініціалізації
      this.initialized = true;

      // Генеруємо подію ініціалізації
      this.dispatchSystemEvent('initialized', {
        version: this.version
      });

      // Ін'єктуємо посилання на TaskSystem в інші модулі
      this.injectSystemReference();

      console.log('TaskSystem: Ініціалізацію завершено успішно');
      return true;
    } catch (error) {
      console.error('TaskSystem: Критична помилка ініціалізації:', error);

      // Генеруємо подію помилки
      this.dispatchSystemEvent('initialization-error', {
        error: error.message
      });

      return false;
    }
  }

  /**
   * Ін'єктування посилання на TaskSystem в інші модулі
   */
  injectSystemReference() {
    const modules = [this.api, this.store, this.verification, this.progress];

    modules.forEach(module => {
      if (module && typeof module === 'object') {
        module.taskSystem = this;
      }
    });
  }

  /**
   * Генерація події системи
   * @param {string} eventName - Назва події
   * @param {Object} data - Дані події
   */
  dispatchSystemEvent(eventName, data = {}) {
    const event = new CustomEvent(`task-system-${eventName}`, {
      detail: {
        ...data,
        timestamp: Date.now()
      }
    });

    document.dispatchEvent(event);
  }

  /**
   * Отримання задач певного типу
   * @param {string} type - Тип завдань
   * @returns {Array} Масив завдань
   */
  getTasks(type) {
    return this.store.getTasks(type);
  }

  /**
   * Пошук завдання за ID
   * @param {string} taskId - ID завдання
   * @returns {Object|null} Знайдене завдання
   */
  findTaskById(taskId) {
    return this.store.findTaskById(taskId);
  }

  /**
   * Запуск завдання
   * @param {string} taskId - ID завдання
   * @returns {Promise<Object>} Результат операції
   */
  async startTask(taskId) {
    try {
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
            task_id: taskId
          });
        }

        // Генеруємо подію про запуск завдання
        this.dispatchSystemEvent('task-started', {
          taskId,
          response
        });

        // Отримуємо дані завдання
        const task = this.findTaskById(taskId);

        // Повертаємо результат
        return {
          success: true,
          message: response.message || 'Завдання успішно активовано',
          task,
          action_url: task?.action_url || task?.channel_url
        };
      } else {
        // Повертаємо помилку
        return {
          success: false,
          message: response.message || response.error || 'Помилка запуску завдання',
          error: response.error
        };
      }
    } catch (error) {
      console.error('TaskSystem: Помилка запуску завдання:', error);

      return {
        success: false,
        message: 'Помилка запуску завдання',
        error: error.message
      };
    }
  }

  /**
   * Верифікація завдання
   * @param {string} taskId - ID завдання
   * @returns {Promise<Object>} Результат верифікації
   */
  async verifyTask(taskId) {
    return await this.verification.verifyTask(taskId);
  }

  /**
   * Оновлення прогресу завдання
   * @param {string} taskId - ID завдання
   * @param {Object} progressData - Дані прогресу
   * @returns {boolean} Результат операції
   */
  updateTaskProgress(taskId, progressData) {
    return this.progress.updateTaskProgress(taskId, progressData);
  }

  /**
   * Отримання прогресу завдання
   * @param {string} taskId - ID завдання
   * @returns {Object|null} Прогрес завдання
   */
  getTaskProgress(taskId) {
    return this.progress.getTaskProgress(taskId);
  }

  /**
   * Синхронізація прогресу з сервером
   * @returns {Promise<Object>} Результат операції
   */
  async syncProgress() {
    return await this.progress.syncAllProgress();
  }

  /**
   * Зміна активної вкладки
   * @param {string} tabType - Тип вкладки
   */
  setActiveTab(tabType) {
    this.store.setActiveTab(tabType);
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
      activeTabType: this.store.systemState.activeTabType,
      tasksCount: {
        social: this.store.tasks[TaskTypes.TASK_TYPES.SOCIAL].length,
        limited: this.store.tasks[TaskTypes.TASK_TYPES.LIMITED].length,
        partner: this.store.tasks[TaskTypes.TASK_TYPES.PARTNER].length,
        referral: this.store.tasks[TaskTypes.TASK_TYPES.REFERRAL].length
      }
    };
  }

  /**
   * Оновлення балансу
   * @param {string} type - Тип балансу
   * @param {number} amount - Сума
   * @param {boolean} isIncrement - Чи є це збільшенням
   */
  updateBalance(type, amount, isIncrement = true) {
    this.store.updateBalance(type, amount, isIncrement);
  }

  /**
   * Діагностика системи
   * @returns {Object} Діагностична інформація
   */
  diagnostics() {
    if (!this.store) return {
      initialized: this.initialized,
      version: this.version,
      modulesLoaded: false
    };

    return {
      initialized: this.initialized,
      version: this.version,
      systemState: this.store.systemState,
      tasks: {
        social: this.store.tasks[TaskTypes.TASK_TYPES.SOCIAL].length,
        limited: this.store.tasks[TaskTypes.TASK_TYPES.LIMITED].length,
        partner: this.store.tasks[TaskTypes.TASK_TYPES.PARTNER].length,
        referral: this.store.tasks[TaskTypes.TASK_TYPES.REFERRAL].length
      },
      userProgress: Object.keys(this.store.userProgress).length,
      api: {
        baseUrl: this.api?.baseUrl
      },
      dependencies: {
        registered: dependencyContainer.getRegisteredModules()
      }
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

    // Встановлюємо прапорець ініціалізації
    this.initialized = false;

    // Генеруємо подію скидання
    this.dispatchSystemEvent('reset');

    console.log('TaskSystem: Стан системи скинуто');
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

  // Додаткові методи
  diagnoseSystemState: taskSystem.diagnostics.bind(taskSystem),
  refreshAllTasks: () => taskSystem.initialize(),
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
  get initialized() { return taskSystem.initialized; },
  REWARD_TYPES: TaskTypes.REWARD_TYPES
};

// Реєструємо TaskManager у контейнері залежностей
dependencyContainer.register('TaskManager', window.TaskManager);

export default taskSystem;