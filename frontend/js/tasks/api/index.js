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

// Імпорт базових компонентів з core
import coreModule from './core/index.js';

// Деструктуризація імпортів з базового модуля
const {
  request: requestService,
  cache: cacheService,
  config: { CONFIG, API_VERSION, API_ERROR_CODES }
} = coreModule;

// Об'єкт для зберігання лінивих завантажень модулів
const lazyModules = {
  taskService: null,
  actionService: null,
  progressService: null,
  taskTypesModel: null,
  dailyBonusModels: null
};

// Функції для ледачого завантаження модулів
const getTaskService = () => {
  if (!lazyModules.taskService) {
    lazyModules.taskService = require('./services/task-service.js').default;
  }
  return lazyModules.taskService;
};

const getActionService = () => {
  if (!lazyModules.actionService) {
    lazyModules.actionService = require('./services/action-service.js').default;
  }
  return lazyModules.actionService;
};

const getProgressService = () => {
  if (!lazyModules.progressService) {
    lazyModules.progressService = require('./services/progress-service.js').default;
  }
  return lazyModules.progressService;
};

const getTaskTypesModel = () => {
  if (!lazyModules.taskTypesModel) {
    lazyModules.taskTypesModel = require('./models/task-types.js').default;
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
  }

  /**
   * Ледаче отримання сервісів (для уникнення циклічних залежностей)
   */
  get tasks() {
    return getTaskService();
  }

  get actions() {
    return getActionService();
  }

  get progress() {
    return getProgressService();
  }

  get types() {
    return getTaskTypesModel();
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
    return this.tasks.loadAllTasks(options);
  }

  /**
   * Завантаження завдань певного типу
   * @param {string} type - Тип завдань
   * @param {Object} options - Параметри запиту
   * @returns {Promise<Object>} Дані завдань
   */
  async getTasksByType(type, options = {}) {
    return this.tasks.loadTasksByType(type, options);
  }

  /**
   * Отримання даних конкретного завдання
   * @param {string} taskId - ID завдання
   * @param {Object} options - Параметри запиту
   * @returns {Promise<Object>} Дані завдання
   */
  async getTaskDetails(taskId, options = {}) {
    return this.tasks.getTaskDetails(taskId, options);
  }

  /**
   * Отримання прогресу завдання
   * @param {string} taskId - ID завдання
   * @param {Object} options - Параметри запиту
   * @returns {Promise<Object>} Прогрес завдання
   */
  async getTaskProgress(taskId, options = {}) {
    return this.tasks.getTaskProgress(taskId, options);
  }

  /**
   * Отримання статусу завдання
   * @param {string} taskId - ID завдання
   * @param {Object} options - Параметри запиту
   * @returns {Promise<Object>} Статус завдання
   */
  async getTaskStatus(taskId, options = {}) {
    return this.tasks.getTaskStatus(taskId, options);
  }

  /**
   * Початок виконання завдання
   * @param {string} taskId - ID завдання
   * @param {Object} options - Параметри запиту
   * @returns {Promise<Object>} Результат операції
   */
  async startTask(taskId, options = {}) {
    return this.actions.startTask(taskId, options);
  }

  /**
   * Верифікація виконання завдання
   * @param {string} taskId - ID завдання
   * @param {Object} verificationData - Дані для верифікації
   * @param {Object} options - Параметри запиту
   * @returns {Promise<Object>} Результат верифікації
   */
  async verifyTask(taskId, verificationData = {}, options = {}) {
    return this.actions.verifyTask(taskId, verificationData, options);
  }

  /**
   * Оновлення прогресу завдання
   * @param {string} taskId - ID завдання
   * @param {Object} progressData - Дані прогресу
   * @param {Object} options - Параметри запиту
   * @returns {Promise<Object>} Результат оновлення
   */
  async updateTaskProgress(taskId, progressData = {}, options = {}) {
    return this.actions.updateTaskProgress(taskId, progressData, options);
  }

  /**
   * Скасування виконання завдання
   * @param {string} taskId - ID завдання
   * @param {Object} options - Параметри запиту
   * @returns {Promise<Object>} Результат скасування
   */
  async cancelTask(taskId, options = {}) {
    return this.actions.cancelTask(taskId, options);
  }

  /**
   * Отримання нагороди за завдання
   * @param {string} taskId - ID завдання
   * @param {Object} options - Параметри запиту
   * @returns {Promise<Object>} Результат отримання нагороди
   */
  async claimTaskReward(taskId, options = {}) {
    return this.actions.claimTaskReward(taskId, options);
  }

  /**
   * Запуск моніторингу прогресу завдання
   * @param {string} taskId - ID завдання
   * @param {number} interval - Інтервал оновлення (мс)
   * @param {Function} callback - Функція зворотного виклику
   * @returns {string} ID моніторингу
   */
  startProgressMonitoring(taskId, interval, callback) {
    return this.progress.startProgressMonitoring(taskId, interval, callback);
  }

  /**
   * Зупинка моніторингу прогресу
   * @param {string} monitoringId - ID моніторингу
   * @returns {boolean} Результат операції
   */
  stopProgressMonitoring(monitoringId) {
    return this.progress.stopProgressMonitoring(monitoringId);
  }

  /**
   * Аналіз стану завдання
   * @param {string} taskId - ID завдання
   * @param {Object} options - Параметри запиту
   * @returns {Promise<Object>} Результат аналізу
   */
  async analyzeTaskProgress(taskId, options = {}) {
    return this.progress.analyzeTaskProgress(taskId, options);
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