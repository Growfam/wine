/**
 * Головний модуль API завдань
 *
 * Інтегрує всі компоненти API для роботи з завданнями:
 * - Сервіси для отримання даних та виконання дій
 * - Базові компоненти для запитів і кешування
 * - Моделі даних
 *
 * @version 3.1.0
 */

// Прямий імпорт базових компонентів без циклічних залежностей
import requestService from './core/request.js';
import cacheService from './core/cache.js';
import { CONFIG, API_VERSION, API_ERROR_CODES } from './core/config.js';

// Об'єкт для зберігання лінивих завантажень модулів
const lazyModules = {
  taskService: null,
  actionService: null,
  progressService: null,
  taskTypesModel: null,
  dailyBonusModels: null
};

// Функції для ленивого завантаження модулів через динамічні імпорти
const getTaskService = async () => {
  if (!lazyModules.taskService) {
    const module = await import('./services/task-service.js');
    lazyModules.taskService = module.default;
  }
  return lazyModules.taskService;
};

const getActionService = async () => {
  if (!lazyModules.actionService) {
    const module = await import('./services/action-service.js');
    lazyModules.actionService = module.default;
  }
  return lazyModules.actionService;
};

const getProgressService = async () => {
  if (!lazyModules.progressService) {
    const module = await import('./services/progress-service.js');
    lazyModules.progressService = module.default;
  }
  return lazyModules.progressService;
};

const getTaskTypesModel = async () => {
  if (!lazyModules.taskTypesModel) {
    const module = await import('./models/task-types.js');
    lazyModules.taskTypesModel = module.default;
  }
  return lazyModules.taskTypesModel;
};

// Функції щоденного бонусу з проміжним інтерфейсом
// Використовуємо функціональний підхід для уникнення циклічних залежностей
export const getDailyBonusStatus = async (userId) => {
  if (!lazyModules.dailyBonusModels) {
    lazyModules.dailyBonusModels = await import('./models/daily-bonus.js');
  }
  return lazyModules.dailyBonusModels.getDailyBonusStatus(userId);
};

export const claimDailyBonus = async (userId) => {
  if (!lazyModules.dailyBonusModels) {
    lazyModules.dailyBonusModels = await import('./models/daily-bonus.js');
  }
  return lazyModules.dailyBonusModels.claimDailyBonus(userId);
};

export const getDailyBonusHistory = async (userId, options) => {
  if (!lazyModules.dailyBonusModels) {
    lazyModules.dailyBonusModels = await import('./models/daily-bonus.js');
  }
  return lazyModules.dailyBonusModels.getDailyBonusHistory(userId, options);
};

/**
 * Головний клас API завдань
 */
class TaskAPI {
  constructor() {
    // Версія API
    this.version = API_VERSION;

    // Базові компоненти
    this.request = requestService;
    this.cache = cacheService;

    // Конфігурація
    this.config = CONFIG;
    this.baseUrl = requestService.baseUrl;

    // Прапорець ініціалізації
    this._initialized = false;

    // Зберігаємо кешовані сервіси
    this._cachedServices = {
      tasks: null,
      actions: null,
      progress: null,
      types: null
    };
  }

  /**
   * Ледаче отримання сервісів (для уникнення циклічних залежностей)
   */
  async getTasks() {
    if (!this._cachedServices.tasks) {
      this._cachedServices.tasks = await getTaskService();
    }
    return this._cachedServices.tasks;
  }

  async getActions() {
    if (!this._cachedServices.actions) {
      this._cachedServices.actions = await getActionService();
    }
    return this._cachedServices.actions;
  }

  async getProgress() {
    if (!this._cachedServices.progress) {
      this._cachedServices.progress = await getProgressService();
    }
    return this._cachedServices.progress;
  }

  async getTypes() {
    if (!this._cachedServices.types) {
      this._cachedServices.types = await getTaskTypesModel();
    }
    return this._cachedServices.types;
  }

  /**
   * Ініціалізація API завдань
   * @param {Object} options - Параметри ініціалізації
   */
  init(options = {}) {
    // Якщо вже ініціалізовано, просто повертаємо this
    if (this._initialized) return this;

    // Логуємо ініціалізацію
    console.log(`🔄 Task API: Ініціалізація модуля завдань v${this.version}`);

    // Можемо оновити конфігурацію, якщо потрібно
    if (options.apiPaths) {
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

    // Попередньо завантажуємо базові модулі
    Promise.all([
      this.getTasks(),
      this.getActions(),
      this.getProgress(),
      this.getTypes()
    ]).catch(error => {
      console.error('Помилка попереднього завантаження модулів:', error);
    });

    return this;
  }

  /**
   * Отримання ID користувача
   * @returns {string|null} ID користувача
   */
  getUserId() {
    return this.request.getUserId();
  }

  /**
   * Очищення всього кешу API
   */
  clearCache() {
    this.cache.clearCache();
    console.log('✓ Task API: Кеш очищено');
  }

  /**
   * Завантаження всіх завдань
   * @param {Object} options - Параметри запиту
   * @returns {Promise<Object>} Дані завдань
   */
  async getAllTasks(options = {}) {
    const tasks = await this.getTasks();
    return tasks.loadAllTasks(options);
  }

  /**
   * Завантаження завдань певного типу
   * @param {string} type - Тип завдань
   * @param {Object} options - Параметри запиту
   * @returns {Promise<Object>} Дані завдань
   */
  async getTasksByType(type, options = {}) {
    const tasks = await this.getTasks();
    return tasks.loadTasksByType(type, options);
  }

  /**
   * Отримання даних конкретного завдання
   * @param {string} taskId - ID завдання
   * @param {Object} options - Параметри запиту
   * @returns {Promise<Object>} Дані завдання
   */
  async getTaskDetails(taskId, options = {}) {
    const tasks = await this.getTasks();
    return tasks.getTaskDetails(taskId, options);
  }

  /**
   * Отримання прогресу завдання
   * @param {string} taskId - ID завдання
   * @param {Object} options - Параметри запиту
   * @returns {Promise<Object>} Прогрес завдання
   */
  async getTaskProgress(taskId, options = {}) {
    const tasks = await this.getTasks();
    return tasks.getTaskProgress(taskId, options);
  }

  /**
   * Отримання статусу завдання
   * @param {string} taskId - ID завдання
   * @param {Object} options - Параметри запиту
   * @returns {Promise<Object>} Статус завдання
   */
  async getTaskStatus(taskId, options = {}) {
    const tasks = await this.getTasks();
    return tasks.getTaskStatus(taskId, options);
  }

  /**
   * Початок виконання завдання
   * @param {string} taskId - ID завдання
   * @param {Object} options - Параметри запиту
   * @returns {Promise<Object>} Результат операції
   */
  async startTask(taskId, options = {}) {
    const actions = await this.getActions();
    return actions.startTask(taskId, options);
  }

  /**
   * Верифікація виконання завдання
   * @param {string} taskId - ID завдання
   * @param {Object} verificationData - Дані для верифікації
   * @param {Object} options - Параметри запиту
   * @returns {Promise<Object>} Результат верифікації
   */
  async verifyTask(taskId, verificationData = {}, options = {}) {
    const actions = await this.getActions();
    return actions.verifyTask(taskId, verificationData, options);
  }

  /**
   * Оновлення прогресу завдання
   * @param {string} taskId - ID завдання
   * @param {Object} progressData - Дані прогресу
   * @param {Object} options - Параметри запиту
   * @returns {Promise<Object>} Результат оновлення
   */
  async updateTaskProgress(taskId, progressData = {}, options = {}) {
    const actions = await this.getActions();
    return actions.updateTaskProgress(taskId, progressData, options);
  }

  /**
   * Скасування виконання завдання
   * @param {string} taskId - ID завдання
   * @param {Object} options - Параметри запиту
   * @returns {Promise<Object>} Результат скасування
   */
  async cancelTask(taskId, options = {}) {
    const actions = await this.getActions();
    return actions.cancelTask(taskId, options);
  }

  /**
   * Отримання нагороди за завдання
   * @param {string} taskId - ID завдання
   * @param {Object} options - Параметри запиту
   * @returns {Promise<Object>} Результат отримання нагороди
   */
  async claimTaskReward(taskId, options = {}) {
    const actions = await this.getActions();
    return actions.claimTaskReward(taskId, options);
  }

  /**
   * Запуск моніторингу прогресу завдання
   * @param {string} taskId - ID завдання
   * @param {number} interval - Інтервал оновлення (мс)
   * @param {Function} callback - Функція зворотного виклику
   * @returns {Promise<string>} ID моніторингу
   */
  async startProgressMonitoring(taskId, interval, callback) {
    const progress = await this.getProgress();
    return progress.startProgressMonitoring(taskId, interval, callback);
  }

  /**
   * Зупинка моніторингу прогресу
   * @param {string} monitoringId - ID моніторингу
   * @returns {Promise<boolean>} Результат операції
   */
  async stopProgressMonitoring(monitoringId) {
    const progress = await this.getProgress();
    return progress.stopProgressMonitoring(monitoringId);
  }

  /**
   * Аналіз стану завдання
   * @param {string} taskId - ID завдання
   * @param {Object} options - Параметри запиту
   * @returns {Promise<Object>} Результат аналізу
   */
  async analyzeTaskProgress(taskId, options = {}) {
    const progress = await this.getProgress();
    return progress.analyzeTaskProgress(taskId, options);
  }

  /**
   * Отримання щоденного бонусу
   * @param {string} userId - ID користувача
   * @returns {Promise<Object>} Результат операції
   */
  async getDailyBonusStatus(userId) {
    return getDailyBonusStatus(userId);
  }

  /**
   * Запит на нарахування щоденного бонусу
   * @param {string} userId - ID користувача
   * @returns {Promise<Object>} Результат операції
   */
  async claimDailyBonus(userId) {
    return claimDailyBonus(userId);
  }

  /**
   * Отримання історії щоденних бонусів
   * @param {string} userId - ID користувача
   * @param {Object} options - Додаткові опції
   * @returns {Promise<Object>} Результат операції
   */
  async getDailyBonusHistory(userId, options = {}) {
    return getDailyBonusHistory(userId, options);
  }
}

// Створюємо і експортуємо єдиний екземпляр API
const taskApi = new TaskAPI();

// Виконуємо автоматичну ініціалізацію
if (typeof window !== 'undefined') {
  // При завантаженні DOM
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => taskApi.init());
  } else {
    // DOM вже завантажено
    setTimeout(() => taskApi.init(), 0);
  }

  // Експортуємо в глобальний об'єкт для прямого доступу
  window.TaskAPI = taskApi;
}

// Експортуємо API для модульного використання
export default taskApi;

// Експортуємо окремі компоненти для розширеного використання
export {
  requestService,
  cacheService,
  CONFIG,
  API_VERSION,
  API_ERROR_CODES
};