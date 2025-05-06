/**
 * Верифікатор загальних завдань
 *
 * Відповідає за:
 * - Перевірку виконання завдань без специфічного типу
 * - Обробку нестандартних перевірок
 */

import { VERIFICATION_STATUS } from '../../config/task-types.js';
import errorHandler, { ERROR_CATEGORIES } from '../../utils/error-handler.js';
import taskApi from '../task-api.js';

// Створюємо обробник помилок для модуля
const moduleErrors = errorHandler.createModuleHandler('GenericVerification');

class GenericVerifier {
  /**
   * Верифікація загального завдання
   * @param {string} taskId - ID завдання
   * @param {Object} task - Дані завдання (опціонально)
   * @returns {Promise<Object>} Результат верифікації
   */
  async verify(taskId, task) {
    try {
      // Додаткові дані для перевірки
      const verificationData = {
        verification_type: 'generic',
        task_data: {
          action_type: task?.action_type || 'generic',
          timestamp: Date.now()
        }
      };

      // Запит до API для верифікації
      return await this.performApiVerification(taskId, verificationData);
    } catch (error) {
      moduleErrors.error(error, `Помилка при верифікації загального завдання ${taskId}`, {
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
const genericVerifier = new GenericVerifier();
export default genericVerifier;