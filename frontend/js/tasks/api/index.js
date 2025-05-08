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

// Імпорт базових компонентів - розв'язання циклічної залежності
import requestService from './core/request.js';
import cacheService from './core/cache.js';
import { CONFIG, API_VERSION, API_ERROR_CODES } from './core/config.js';

// Імпорт сервісів
import taskService from './services/task-service.js';
import actionService from './services/action-service.js';
import progressService from './services/progress-service.js';

// Імпорт моделей
import taskTypesModel from './models/task-types.js';

// Імпорт модуля щоденних бонусів (імпортуємо безпосередньо функції, а не по дефолту)
import {
  getDailyBonusStatus as modelGetDailyBonusStatus,
  claimDailyBonus as modelClaimDailyBonus,
  getDailyBonusHistory as modelGetDailyBonusHistory
} from './models/daily-bonus.js';

// Експорт функцій щоденного бонусу через проміжний інтерфейс
export const getDailyBonusStatus = (userId) => modelGetDailyBonusStatus(userId);
export const claimDailyBonus = (userId) => modelClaimDailyBonus(userId);
export const getDailyBonusHistory = (userId, options) => modelGetDailyBonusHistory(userId, options);

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

    // Сервіси
    this.tasks = taskService;
    this.actions = actionService;
    this.progress = progressService;

    // Моделі
    this.types = taskTypesModel;

    // Конфігурація
    this.config = CONFIG;
    this.baseUrl = requestService.baseUrl;
  }

  /**
   * Ініціалізація API завдань
   * @param {Object} options - Параметри ініціалізації
   */
  init(options = {}) {
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
  taskService,
  actionService,
  progressService,
  taskTypesModel,
  CONFIG,
  API_VERSION,
};