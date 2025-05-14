/**
 * Менеджер прогресу завдань
 *
 * Відповідає за:
 * - Зберігання і управління прогресом виконання завдань
 * - Синхронізацію прогресу з сервером
 * - Обробку подій зміни прогресу
 */

import { saveToCache, loadFromCache } from './cache-handlers.js';
import { TASK_STATUS } from '../../config/status-types.js';

// Ключі для кешу
const CACHE_KEYS = {
  USER_PROGRESS: 'task_progress',
  TASK_PROGRESS_PREFIX: 'task_progress_',
  TASK_STATUS_PREFIX: 'task_status_'
};

/**
 * Клас для управління прогресом завдань
 */
export class ProgressManager {
  constructor() {
    // Поточний прогрес користувача
    this.userProgress = {};

    // Час життя кешу прогресу (24 години)
    this.CACHE_TTL = 86400000;

    // Масив слухачів змін прогресу
    this.listeners = [];
  }

  /**
   * Ініціалізація менеджера прогресу
   */
  initialize() {
    // Завантажуємо прогрес з кешу
    this.loadProgress();

    // Підписуємося на події прогресу
    this.setupEventListeners();
  }

  /**
   * Завантаження прогресу з кешу
   * @returns {Object} Прогрес користувача
   */
  loadProgress() {
    try {
      // Спробуємо знайти в кеші
      const cachedProgress = loadFromCache(CACHE_KEYS.USER_PROGRESS);
      if (cachedProgress && typeof cachedProgress === 'object') {
        this.userProgress = cachedProgress;
      }
      return this.userProgress;
    } catch (error) {
      console.warn('Помилка завантаження прогресу з кешу:', error);
      return {};
    }
  }

  /**
   * Налаштування слухачів подій
   * @private
   */
  setupEventListeners() {
    if (typeof document === 'undefined') return;

    // Підписуємося на подію оновлення прогресу
    document.addEventListener('task-progress-updated', (event) => {
      const { taskId, progressData } = event.detail;
      this.setTaskProgress(taskId, progressData);
    });

    // Підписуємося на подію завершення завдання
    document.addEventListener('task-completed', (event) => {
      const { taskId } = event.detail;
      // Отримуємо цільове значення
      const targetValue = this.getTaskTargetValue(taskId);

      this.setTaskProgress(taskId, {
        status: TASK_STATUS.COMPLETED,
        progress_value: targetValue,
        completion_date: new Date().toISOString()
      });
    });
  }

  /**
   * Отримання прогресу завдання
   * @param {string} taskId - ID завдання
   * @returns {Object|null} Прогрес завдання
   */
  getTaskProgress(taskId) {
    if (!taskId) return null;
    return this.userProgress[taskId] || null;
  }

  /**
   * Встановлення прогресу завдання
   * @param {string} taskId - ID завдання
   * @param {Object} progressData - Дані прогресу
   * @returns {Object} Встановлені дані прогресу
   */
  setTaskProgress(taskId, progressData) {
    if (!taskId || !progressData) {
      console.warn('Некоректні дані прогресу');
      return null;
    }

    // Зберігаємо прогрес
    this.userProgress[taskId] = progressData;

    // Зберігаємо в кеш
    this.saveProgressToCache();

    // Сповіщаємо слухачів
    this.notifyListeners({
      type: 'progress-updated',
      taskId,
      progressData
    });

    return progressData;
  }

  /**
   * Збереження прогресу в кеш
   * @private
   */
  saveProgressToCache() {
    saveToCache(CACHE_KEYS.USER_PROGRESS, this.userProgress, {
      ttl: this.CACHE_TTL,
      tags: ['progress', 'user'],
    });
  }

  /**
   * Отримання всього прогресу користувача
   * @returns {Object} Прогрес користувача
   */
  getAllProgress() {
    return { ...this.userProgress };
  }

  /**
   * Встановлення всього прогресу користувача
   * @param {Object} progress - Прогрес користувача
   */
  setAllProgress(progress) {
    if (!progress || typeof progress !== 'object') {
      console.warn('Некоректні дані прогресу');
      return;
    }

    // Зберігаємо прогрес
    this.userProgress = { ...progress };

    // Зберігаємо в кеш
    this.saveProgressToCache();

    // Сповіщаємо слухачів
    this.notifyListeners({
      type: 'all-progress-updated',
      progress: this.userProgress
    });
  }

  /**
   * Оновлення прогресу завдання
   * @param {string} taskId - ID завдання
   * @param {Object} progressData - Дані прогресу
   * @returns {Object} Оновлені дані прогресу
   */
  updateTaskProgress(taskId, progressData) {
    if (!taskId || !progressData) {
      console.warn('Некоректні дані прогресу');
      return null;
    }

    // Отримуємо поточні дані прогресу
    const currentProgress = this.getTaskProgress(taskId) || {};

    // Об'єднуємо поточні та нові дані
    const updatedProgress = {
      ...currentProgress,
      ...progressData,
      last_updated: new Date().toISOString()
    };

    // Зберігаємо оновлений прогрес
    return this.setTaskProgress(taskId, updatedProgress);
  }

  /**
   * Перевірка, чи завершено завдання
   * @param {string} taskId - ID завдання
   * @returns {boolean} Результат перевірки
   */
  isTaskCompleted(taskId) {
    const progress = this.getTaskProgress(taskId);
    return !!(progress && progress.status === TASK_STATUS.COMPLETED);
  }

  /**
   * Видалення прогресу завдання
   * @param {string} taskId - ID завдання
   * @returns {boolean} Результат видалення
   */
  removeTaskProgress(taskId) {
    if (!taskId || !this.userProgress[taskId]) return false;

    // Видаляємо прогрес
    delete this.userProgress[taskId];

    // Зберігаємо в кеш
    this.saveProgressToCache();

    // Сповіщаємо слухачів
    this.notifyListeners({
      type: 'progress-removed',
      taskId
    });

    return true;
  }

  /**
   * Синхронізація прогресу з сервером
   * @param {Object} api - API для роботи з сервером
   * @returns {Promise<Object>} Результат синхронізації
   */
  async syncProgressWithServer(api) {
    try {
      if (!api || typeof api.getUserProgress !== 'function') {
        return {
          success: false,
          message: 'API не ініціалізовано'
        };
      }

      // Отримуємо прогрес з сервера
      const response = await api.getUserProgress();

      if (response.success && response.data) {
        // Оновлюємо локальний прогрес
        this.setAllProgress(response.data);

        return {
          success: true,
          message: 'Прогрес успішно синхронізовано',
          data: response.data
        };
      }

      return {
        success: false,
        message: 'Не вдалося отримати прогрес з сервера',
        error: response.error
      };
    } catch (error) {
      console.error('Помилка синхронізації прогресу з сервером:', error);
      return {
        success: false,
        message: 'Помилка синхронізації прогресу',
        error: error.message
      };
    }
  }

  /**
   * Отримання цільового значення завдання
   * @param {string} taskId - ID завдання
   * @param {Object} taskStore - Сховище завдань
   * @returns {number} Цільове значення
   * @private
   */
  getTaskTargetValue(taskId, taskStore) {
    // Якщо є сховище завдань, спробуємо отримати з нього
    if (taskStore && typeof taskStore.findTaskById === 'function') {
      const task = taskStore.findTaskById(taskId);
      if (task && task.target_value) {
        return parseInt(task.target_value);
      }
    }

    // Перевіряємо прогрес
    const progress = this.getTaskProgress(taskId);
    if (progress && progress.max_progress) {
      return parseInt(progress.max_progress);
    }

    // Спробуємо знайти в DOM
    if (typeof document !== 'undefined') {
      const taskElement = document.querySelector(`.task-item[data-task-id="${taskId}"]`);
      if (taskElement) {
        const targetAttr = taskElement.getAttribute('data-target-value');
        if (targetAttr) {
          return parseInt(targetAttr);
        }
      }
    }

    // За замовчуванням
    return 1;
  }

  /**
   * Додавання слухача змін прогресу
   * @param {Function} listener - Функція-слухач
   * @returns {Function} Функція для відписки
   */
  addListener(listener) {
    if (typeof listener !== 'function') return () => {};

    this.listeners.push(listener);
    return () => this.removeListener(listener);
  }

  /**
   * Видалення слухача змін прогресу
   * @param {Function} listener - Функція-слухач
   */
  removeListener(listener) {
    this.listeners = this.listeners.filter(l => l !== listener);
  }

  /**
   * Сповіщення всіх слухачів про зміну прогресу
   * @param {Object} data - Дані про зміну
   * @private
   */
  notifyListeners(data) {
    this.listeners.forEach(listener => {
      try {
        listener(data);
      } catch (error) {
        console.error('Помилка виклику слухача прогресу:', error);
      }
    });
  }

  /**
   * Скидання стану менеджера
   */
  resetState() {
    this.userProgress = {};
    this.listeners = [];
    // Очищаємо кеш
    if (typeof window !== 'undefined' && window.cacheService) {
      window.cacheService.removeByTags(['progress']);
    }
  }
}

// Створюємо і експортуємо єдиний екземпляр
const progressManager = new ProgressManager();
export default progressManager;