/**
 * Верифікатор лімітованих завдань
 *
 * Відповідає за:
 * - Перевірку виконання лімітованих завдань
 * - Валідацію термінів
 */

import { VERIFICATION_STATUS, TASK_STATUS } from '../../config/task-types.js';
import errorHandler, { ERROR_CATEGORIES } from '../../utils/error-handler.js';
import taskApi from '../task-api.js';

// Створюємо обробник помилок для модуля
const moduleErrors = errorHandler.createModuleHandler('LimitedVerification');

class LimitedVerifier {
  /**
   * Верифікація лімітованого завдання
   * @param {string} taskId - ID завдання
   * @param {Object} task - Дані завдання
   * @returns {Promise<Object>} Результат верифікації
   */
  async verify(taskId, task) {
    try {
      if (!task) {
        const noDataError = new Error('Не вдалося отримати дані завдання');
        moduleErrors.error(noDataError, `Відсутні дані для лімітованого завдання ${taskId}`, {
          category: ERROR_CATEGORIES.LOGIC,
          details: { taskId }
        });

        return {
          success: false,
          status: VERIFICATION_STATUS.ERROR,
          message: 'Не вдалося отримати дані завдання'
        };
      }

      // Перевіряємо термін дії завдання
      if (task.end_date) {
        const endDate = new Date(task.end_date);
        const now = new Date();

        if (endDate <= now) {
          moduleErrors.info(`Термін виконання завдання ${taskId} закінчився`, 'verify', {
            category: ERROR_CATEGORIES.LOGIC,
            details: { taskId, endDate: endDate.toISOString(), now: now.toISOString() }
          });

          return {
            success: false,
            status: VERIFICATION_STATUS.FAILURE,
            message: 'Термін виконання цього завдання закінчився'
          };
        }
      }

      // Перевіряємо ліміт виконань
      if (task.max_completions !== null && task.current_completions >= task.max_completions) {
        moduleErrors.info(`Ліміт виконань завдання ${taskId} вичерпано`, 'verify', {
          category: ERROR_CATEGORIES.LOGIC,
          details: { taskId, max: task.max_completions, current: task.current_completions }
        });

        return {
          success: false,
          status: VERIFICATION_STATUS.FAILURE,
          message: 'Ліміт виконань цього завдання вичерпано'
        };
      }

      // Додаткові дані для перевірки лімітованого завдання
      const verificationData = {
        verification_type: 'limited',
        task_data: {
          action_type: task.action_type || 'visit',
          timestamp: Date.now()
        }
      };

      // Запит до API для верифікації
      return await this.performApiVerification(taskId, verificationData);
    } catch (error) {
      moduleErrors.error(error, `Помилка при верифікації лімітованого завдання ${taskId}`, {
        category: ERROR_CATEGORIES.LOGIC,
        details: { taskId }
      });

      throw error;
    }
  }

  /**
   * Виконання API запиту для верифікації
   * @param {string} taskId - ID завдання
   * @param {Object} verificationData - Дані для верифікації
   * @returns {Promise<Object>} Результат верифікації
   */
  async performApiVerification(taskId, verificationData = {}) {
    try {
      // Викликаємо API для верифікації
      const response = await taskApi.verifyTask(taskId, verificationData);

      // Обробляємо відповідь
      if (response.status === 'success') {
        moduleErrors.info(`Завдання ${taskId} успішно виконано`, 'performApiVerification', {
          category: ERROR_CATEGORIES.LOGIC,
          details: { taskId, verificationData }
        });

        return {
          success: true,
          status: VERIFICATION_STATUS.SUCCESS,
          message: response.message || 'Завдання успішно виконано!',
          reward: response.data?.reward || null,
          verification_details: response.data?.verification || {},
          response_time_ms: Date.now() - (response.requestTime || Date.now())
        };
      } else {
        moduleErrors.warning(`Верифікація завдання ${taskId} невдала`, 'performApiVerification', {
          category: ERROR_CATEGORIES.LOGIC,
          details: { taskId, response, verificationData }
        });

        return {
          success: false,
          status: VERIFICATION_STATUS.FAILURE,
          message: response.message || response.error || 'Не вдалося перевірити виконання завдання',
          error: response.error
        };
      }
    } catch (error) {
      throw error;
    }
  }
}

// Створюємо і експортуємо єдиний екземпляр
const limitedVerifier = new LimitedVerifier();
export default limitedVerifier;