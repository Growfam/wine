/**
 * Верифікатор партнерських завдань
 *
 * Відповідає за:
 * - Перевірку виконання партнерських завдань
 * - Відстеження конверсій
 */

import { VERIFICATION_STATUS } from '../../config/task-types.js';
import errorHandler, { ERROR_CATEGORIES } from '../../utils/error-handler.js';
import taskApi from '../task-api.js';

// Створюємо обробник помилок для модуля
const moduleErrors = errorHandler.createModuleHandler('PartnerVerification');

class PartnerVerifier {
  /**
   * Верифікація партнерського завдання
   * @param {string} taskId - ID завдання
   * @param {Object} task - Дані завдання
   * @returns {Promise<Object>} Результат верифікації
   */
  async verify(taskId, task) {
    try {
      if (!task) {
        const noDataError = new Error('Не вдалося отримати дані завдання');
        moduleErrors.error(noDataError, `Відсутні дані для партнерського завдання ${taskId}`, {
          category: ERROR_CATEGORIES.LOGIC,
          details: { taskId }
        });

        return {
          success: false,
          status: VERIFICATION_STATUS.ERROR,
          message: 'Не вдалося отримати дані завдання'
        };
      }

      // Додаткові дані для перевірки партнерського завдання
      const verificationData = {
        verification_type: 'partner',
        task_data: {
          partner_name: task.partner_name || '',
          action_type: task.action_type || 'visit',
          timestamp: Date.now()
        }
      };

      // Додаємо трекінгові дані, якщо є
      if (task.external_tracking_id) {
        verificationData.task_data.external_tracking_id = task.external_tracking_id;
      }

      if (task.conversion_type) {
        verificationData.task_data.conversion_type = task.conversion_type;
      }

      // Запит до API для верифікації
      return await this.performApiVerification(taskId, verificationData);
    } catch (error) {
      moduleErrors.error(error, `Помилка при верифікації партнерського завдання ${taskId}`, {
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
const partnerVerifier = new PartnerVerifier();
export default partnerVerifier;