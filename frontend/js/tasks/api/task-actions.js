/**
 * Task Actions API - модуль для виконання дій із завданнями
 *
 * Відповідає за:
 * - Початок виконання завдання
 * - Верифікацію виконання завдання
 * - Обробку результатів верифікації
 */

import { ApiCore, CONFIG } from './core.js';
import errorHandler, { ERROR_CATEGORIES } from '../utils/Logger.js';
import cacheService from '../utils/CacheService.js';

// Створюємо обробник помилок для модуля
const moduleErrors = errorHandler.createModuleHandler('TaskActionApi');

/**
 * API для виконання дій з завданнями
 */
export class TaskActionApi extends ApiCore {
  constructor() {
    super();
  }

  /**
   * Початок виконання завдання
   * @param {string} taskId - ID завдання
   * @returns {Promise<Object>} Результат операції
   */
  async startTask(taskId) {
    try {
      const userId = this.getUserId();
      if (!userId) {
        return {
          status: 'error',
          message: 'ID користувача відсутній'
        };
      }

      // Формуємо URL для запиту
      const url = CONFIG.API_PATHS.START_TASK.replace('{taskId}', taskId);

      // Виконуємо запит
      const response = await this.fetchWithRetry(url, {
        method: 'POST',
        body: JSON.stringify({
          user_id: userId,
          task_id: taskId,
          timestamp: Date.now()
        })
      });

      // Очищаємо кеш прогресу для цього завдання
      cacheService.removeByTags([`task_${taskId}`]);

      return response;
    } catch (error) {
      moduleErrors.error(error, `Помилка запуску завдання ${taskId}`, {
        category: ERROR_CATEGORIES.API,
        details: { taskId }
      });

      return {
        status: 'error',
        message: 'Не вдалося запустити завдання',
        error: error.message
      };
    }
  }

  /**
   * Верифікація виконання завдання
   * @param {string} taskId - ID завдання
   * @param {Object} verificationData - Дані для верифікації
   * @returns {Promise<Object>} Результат верифікації
   */
  async verifyTask(taskId, verificationData = {}) {
    try {
      const userId = this.getUserId();
      if (!userId) {
        return {
          status: 'error',
          message: 'ID користувача відсутній'
        };
      }

      // Формуємо URL для запиту
      const url = CONFIG.API_PATHS.VERIFICATION.replace('{taskId}', taskId);

      // Виконуємо запит
      const response = await this.fetchWithRetry(url, {
        method: 'POST',
        body: JSON.stringify({
          user_id: userId,
          task_id: taskId,
          timestamp: Date.now(),
          ...verificationData
        })
      });

      // Очищаємо кеш завдань і прогресу
      cacheService.removeByTags([`task_${taskId}`]);

      return response;
    } catch (error) {
      moduleErrors.error(error, `Помилка верифікації завдання ${taskId}`, {
        category: ERROR_CATEGORIES.API,
        details: { taskId }
      });

      return {
        status: 'error',
        message: 'Не вдалося верифікувати завдання',
        error: error.message
      };
    }
  }
}

export default new TaskActionApi();