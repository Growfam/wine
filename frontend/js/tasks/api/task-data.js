/**
 * Task Data API - модуль для отримання даних про завдання
 *
 * Відповідає за:
 * - Завантаження списку завдань
 * - Отримання даних конкретного завдання
 * - Отримання прогресу виконання завдань
 */

import { ApiCore, CONFIG } from './core.js';
import errorHandler, { ERROR_CATEGORIES } from '../utils/Logger.js';
import cacheService from '../utils/CacheService.js';

// Створюємо обробник помилок для модуля
const moduleErrors = errorHandler.createModuleHandler('TaskDataApi');

/**
 * API для роботи з даними завдань
 */
export class TaskDataApi extends ApiCore {
  constructor() {
    super();
    this.taskCachePrefix = 'task_data_';
    this.progressCachePrefix = 'task_progress_';
  }

  /**
   * Завантаження всіх завдань з сервера
   * @returns {Promise<Object>} Дані завдань
   */
  async loadAllTasks() {
    try {
      // Спробуємо знайти в кеші
      const cachedTasks = cacheService.get('all_tasks_data');
      if (cachedTasks) {
        return cachedTasks;
      }

      const userId = this.getUserId();
      if (!userId) {
        return {
          status: 'error',
          message: 'ID користувача відсутній'
        };
      }

      // Завантажуємо типи завдань паралельно
      const socialTasksPromise = this.fetchWithRetry(CONFIG.API_PATHS.TASKS.SOCIAL);
      const limitedTasksPromise = this.fetchWithRetry(CONFIG.API_PATHS.TASKS.LIMITED);
      const partnerTasksPromise = this.fetchWithRetry(CONFIG.API_PATHS.TASKS.PARTNER);
      const userProgressPromise = this.fetchWithRetry(CONFIG.API_PATHS.USER_PROGRESS.replace('{userId}', userId));

      // Чекаємо на виконання всіх запитів
      const [socialTasksResponse, limitedTasksResponse, partnerTasksResponse, userProgressResponse] =
        await Promise.all([socialTasksPromise, limitedTasksPromise, partnerTasksPromise, userProgressPromise]);

      // Формуємо загальний результат
      const result = {
        social: socialTasksResponse.data || [],
        limited: limitedTasksResponse.data || [],
        partner: partnerTasksResponse.data || [],
        userProgress: userProgressResponse.data || {}
      };

      // Кешуємо результат
      cacheService.set('all_tasks_data', result, {
        ttl: 60000, // 1 хвилина
        tags: ['tasks', 'api']
      });

      return result;
    } catch (error) {
      moduleErrors.error(error, 'Помилка завантаження завдань', {
        category: ERROR_CATEGORIES.API
      });

      return {
        status: 'error',
        message: 'Не вдалося завантажити завдання',
        error: error.message
      };
    }
  }

  /**
   * Отримання даних одного завдання
   * @param {string} taskId - ID завдання
   * @returns {Promise<Object>} Дані завдання
   */
  async getTaskData(taskId) {
    try {
      // Перевіряємо у кеші
      const cacheKey = `${this.taskCachePrefix}${taskId}`;
      const cachedTask = cacheService.get(cacheKey);
      if (cachedTask) {
        return cachedTask;
      }

      // Завантажуємо з сервера
      const response = await this.fetchWithRetry(`tasks/${taskId}`);

      if (response.status === 'success' && response.data) {
        // Кешуємо результат
        cacheService.set(cacheKey, response.data, {
          ttl: 120000, // 2 хвилини
          tags: ['tasks', `task_${taskId}`]
        });

        return response.data;
      }

      return null;
    } catch (error) {
      moduleErrors.error(error, `Помилка отримання даних завдання ${taskId}`, {
        category: ERROR_CATEGORIES.API,
        details: { taskId }
      });

      return null;
    }
  }

  /**
   * Отримання прогресу завдання
   * @param {string} taskId - ID завдання
   * @returns {Promise<Object>} Прогрес завдання
   */
  async getTaskProgress(taskId) {
    try {
      // Перевіряємо у кеші
      const cacheKey = `${this.progressCachePrefix}${taskId}`;
      const cachedProgress = cacheService.get(cacheKey);
      if (cachedProgress) {
        return cachedProgress;
      }

      const userId = this.getUserId();
      if (!userId) {
        return {
          status: 'error',
          message: 'ID користувача відсутній'
        };
      }

      // Завантажуємо з сервера
      const response = await this.fetchWithRetry(`quests/tasks/${taskId}/progress/${userId}`);

      if (response.status === 'success' && response.data) {
        // Кешуємо результат
        cacheService.set(cacheKey, response.data, {
          ttl: 30000, // 30 секунд
          tags: ['progress', `task_${taskId}`]
        });

        return response.data;
      }

      return null;
    } catch (error) {
      moduleErrors.error(error, `Помилка отримання прогресу завдання ${taskId}`, {
        category: ERROR_CATEGORIES.API,
        details: { taskId }
      });

      return null;
    }
  }
}

export default new TaskDataApi();