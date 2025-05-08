/**
 * Сервіс дій завдань - модуль для виконання операцій із завданнями
 *
 * Відповідає за:
 * - Початок виконання завдань
 * - Перевірку завдань
 * - Скасування завдань
 * - Отримання нагород
 *
 * @version 3.1.0
 */

import requestService from '../core/request.js';
import cacheService from '../core/cache.js';
import { CONFIG } from '../core/config.js';

/**
 * Сервіс для виконання дій з завданнями
 */
class ActionService {
  constructor() {
    // Префікси для кешу
    this.progressCachePrefix = 'task_progress_';
    this.statusCachePrefix = 'task_status_';
    this.taskCachePrefix = 'task_data_';
  }

  /**
   * Початок виконання завдання
   * @param {string} taskId - ID завдання
   * @param {Object} options - Додаткові опції
   * @returns {Promise<Object>} Результат операції
   */
  async startTask(taskId, options = {}) {
    try {
      if (!taskId) {
        throw new Error('Не вказано ID завдання');
      }

      const userId = requestService.getUserId();
      if (!userId) {
        return {
          status: 'error',
          message: 'ID користувача відсутній',
        };
      }

      // Формуємо URL для запиту
      const endpoint = CONFIG.API_PATHS.TASKS.START(taskId);

      // Підготовка даних для запиту
      const data = {
        user_id: userId,
        task_id: taskId,
        timestamp: Date.now(),
        ...options.additionalData,
      };

      // Виконуємо запит
      const response = await requestService.post(endpoint, data);

      // Очищаємо кеш прогресу для цього завдання
      this._clearTaskRelatedCache(taskId);

      // Генеруємо подію для відстеження
      this._triggerTaskEvent('task-started', {
        taskId,
        userId,
        timestamp: Date.now(),
        response,
      });

      return response;
    } catch (error) {
      console.error(`Помилка запуску завдання ${taskId}:`, error);

      return {
        status: 'error',
        message: 'Не вдалося запустити завдання',
        error: error.message,
      };
    }
  }

  /**
   * Верифікація виконання завдання
   * @param {string} taskId - ID завдання
   * @param {Object} verificationData - Дані для верифікації
   * @param {Object} options - Додаткові опції
   * @returns {Promise<Object>} Результат верифікації
   */
  async verifyTask(taskId, verificationData = {}, options = {}) {
    try {
      if (!taskId) {
        throw new Error('Не вказано ID завдання');
      }

      const userId = requestService.getUserId();
      if (!userId) {
        return {
          status: 'error',
          message: 'ID користувача відсутній',
        };
      }

      // Додаємо службові дані
      const fullVerificationData = {
        user_id: userId,
        task_id: taskId,
        timestamp: Date.now(),
        ...verificationData,
      };

      // Формуємо URL для запиту
      const endpoint = CONFIG.API_PATHS.TASKS.VERIFICATION(taskId);

      // Виконуємо запит
      const response = await requestService.post(endpoint, fullVerificationData, options);

      // Очищаємо кеш для цього завдання
      this._clearTaskRelatedCache(taskId);
      cacheService.clearCache('all_tasks_data');

      // Генеруємо подію для відстеження
      this._triggerTaskEvent('task-verified', {
        taskId,
        userId,
        timestamp: Date.now(),
        response,
        success: response.status === 'success',
      });

      return response;
    } catch (error) {
      console.error(`Помилка верифікації завдання ${taskId}:`, error);

      return {
        status: 'error',
        message: 'Не вдалося верифікувати завдання',
        error: error.message,
      };
    }
  }

  /**
   * Оновлення прогресу завдання
   * @param {string} taskId - ID завдання
   * @param {Object} progressData - Дані прогресу
   * @param {Object} options - Додаткові опції
   * @returns {Promise<Object>} Результат оновлення
   */
  async updateTaskProgress(taskId, progressData = {}, options = {}) {
    try {
      if (!taskId) {
        throw new Error('Не вказано ID завдання');
      }

      const userId = requestService.getUserId();
      if (!userId) {
        return {
          status: 'error',
          message: 'ID користувача відсутній',
        };
      }

      // Додаємо службові дані
      const fullProgressData = {
        user_id: userId,
        task_id: taskId,
        timestamp: Date.now(),
        ...progressData,
      };

      // Формуємо URL для запиту
      const endpoint = CONFIG.API_PATHS.TASKS.PROGRESS(taskId);

      // Виконуємо запит
      const response = await requestService.post(endpoint, fullProgressData, options);

      // Очищаємо кеш для цього завдання
      cacheService.clearCache(`${this.progressCachePrefix}${taskId}`);

      // Генеруємо подію оновлення прогресу
      this._triggerTaskEvent('task-progress-updated', {
        taskId,
        userId,
        timestamp: Date.now(),
        progress: progressData,
        response,
      });

      return response;
    } catch (error) {
      console.error(`Помилка оновлення прогресу завдання ${taskId}:`, error);

      return {
        status: 'error',
        message: 'Не вдалося оновити прогрес завдання',
        error: error.message,
      };
    }
  }

  /**
   * Скасування виконання завдання
   * @param {string} taskId - ID завдання
   * @param {Object} options - Додаткові опції
   * @returns {Promise<Object>} Результат скасування
   */
  async cancelTask(taskId, options = {}) {
    try {
      if (!taskId) {
        throw new Error('Не вказано ID завдання');
      }

      const userId = requestService.getUserId();
      if (!userId) {
        return {
          status: 'error',
          message: 'ID користувача відсутній',
        };
      }

      // Формуємо URL для запиту
      const endpoint = CONFIG.API_PATHS.TASKS.CANCEL(taskId);

      // Підготовка даних для запиту
      const data = {
        user_id: userId,
        task_id: taskId,
        timestamp: Date.now(),
        reason: options.reason || 'user_cancelled',
        ...options.additionalData,
      };

      // Виконуємо запит
      const response = await requestService.post(endpoint, data, options);

      // Очищаємо кеш для цього завдання
      this._clearTaskRelatedCache(taskId);

      // Генеруємо подію скасування завдання
      this._triggerTaskEvent('task-cancelled', {
        taskId,
        userId,
        timestamp: Date.now(),
        reason: options.reason || 'user_cancelled',
        response,
      });

      return response;
    } catch (error) {
      console.error(`Помилка скасування завдання ${taskId}:`, error);

      return {
        status: 'error',
        message: 'Не вдалося скасувати завдання',
        error: error.message,
      };
    }
  }

  /**
   * Надсилання відгуку про завдання
   * @param {string} taskId - ID завдання
   * @param {Object} feedbackData - Дані відгуку
   * @param {Object} options - Додаткові опції
   * @returns {Promise<Object>} Результат надсилання
   */
  async sendTaskFeedback(taskId, feedbackData = {}, options = {}) {
    try {
      if (!taskId) {
        throw new Error('Не вказано ID завдання');
      }

      const userId = requestService.getUserId();
      if (!userId) {
        return {
          status: 'error',
          message: 'ID користувача відсутній',
        };
      }

      // Додаємо службові дані
      const fullFeedbackData = {
        user_id: userId,
        task_id: taskId,
        timestamp: Date.now(),
        ...feedbackData,
      };

      // Формуємо URL для запиту
      const endpoint = CONFIG.API_PATHS.TASKS.FEEDBACK(taskId);

      // Виконуємо запит
      const response = await requestService.post(endpoint, fullFeedbackData, options);

      // Генеруємо подію відгуку
      this._triggerTaskEvent('task-feedback-sent', {
        taskId,
        userId,
        timestamp: Date.now(),
        feedbackType: feedbackData.type || 'general',
        response,
      });

      return response;
    } catch (error) {
      console.error(`Помилка надсилання відгуку про завдання ${taskId}:`, error);

      return {
        status: 'error',
        message: 'Не вдалося надіслати відгук про завдання',
        error: error.message,
      };
    }
  }

  /**
   * Отримання нагороди за завдання
   * @param {string} taskId - ID завдання
   * @param {Object} options - Додаткові опції
   * @returns {Promise<Object>} Результат отримання нагороди
   */
  async claimTaskReward(taskId, options = {}) {
    try {
      if (!taskId) {
        throw new Error('Не вказано ID завдання');
      }

      const userId = requestService.getUserId();
      if (!userId) {
        return {
          status: 'error',
          message: 'ID користувача відсутній',
        };
      }

      // Формуємо URL для запиту
      const endpoint = CONFIG.API_PATHS.TASKS.CLAIM_REWARD(taskId);

      // Підготовка даних для запиту
      const data = {
        user_id: userId,
        task_id: taskId,
        timestamp: Date.now(),
        ...options.additionalData,
      };

      // Виконуємо запит
      const response = await requestService.post(endpoint, data, options);

      // Очищаємо кеш для цього завдання
      this._clearTaskRelatedCache(taskId);

      // Генеруємо події при успішному отриманні нагороди
      if (response.status === 'success') {
        // Подія отримання нагороди
        this._triggerTaskEvent('task-reward-claimed', {
          taskId,
          userId,
          timestamp: Date.now(),
          reward: response.data?.reward,
        });

        // Також генеруємо загальну подію оновлення балансу
        this._triggerTaskEvent('balance-updated', {
          source: 'task-reward',
          taskId,
          amount: response.data?.reward?.amount,
          timestamp: Date.now(),
        });
      }

      return response;
    } catch (error) {
      console.error(`Помилка отримання нагороди за завдання ${taskId}:`, error);

      return {
        status: 'error',
        message: 'Не вдалося отримати нагороду за завдання',
        error: error.message,
      };
    }
  }

  /**
   * Очищення кешу для завдання
   * @param {string} taskId - ID завдання
   * @private
   */
  _clearTaskRelatedCache(taskId) {
    cacheService.clearCache(`${this.progressCachePrefix}${taskId}`);
    cacheService.clearCache(`${this.statusCachePrefix}${taskId}`);
    cacheService.clearCache(`${this.taskCachePrefix}${taskId}`);
  }

  /**
   * Генерування подій для системи
   * @param {string} eventName - Назва події
   * @param {Object} eventData - Дані події
   * @private
   */
  _triggerTaskEvent(eventName, eventData) {
    if (typeof document !== 'undefined') {
      document.dispatchEvent(
        new CustomEvent(eventName, {
          detail: eventData,
        })
      );
    }
  }
}

// Експортуємо єдиний екземпляр сервісу
export default new ActionService();
