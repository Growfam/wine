/**
 * Верифікатор партнерських завдань
 *
 * Відповідає за:
 * - Перевірку виконання партнерських завдань
 * - Відстеження конверсій
 */

import { BaseVerifier } from './base-verifier.js';

export class PartnerVerifier extends BaseVerifier {
  /**
   * Верифікація партнерського завдання
   * @param {string} taskId - ID завдання
   * @param {Object} task - Дані завдання
   * @returns {Promise<Object>} Результат верифікації
   */
  async verify(taskId, task) {
    try {
      if (!task) {
        return this.createErrorResult(taskId, 'Не вдалося отримати дані завдання');
      }

      // Додаткові дані для перевірки партнерського завдання
      const verificationData = {
        verification_type: 'partner',
        task_data: {
          partner_name: task.partner_name || '',
          action_type: task.action_type || 'visit',
          timestamp: Date.now(),
        },
      };

      // Додаємо трекінгові дані, якщо є
      if (task.external_tracking_id) {
        verificationData.task_data.external_tracking_id = task.external_tracking_id;
      }

      if (task.conversion_type) {
        verificationData.task_data.conversion_type = task.conversion_type;
      }

      // Додаємо партнерський ID, якщо є
      if (task.partner_id) {
        verificationData.task_data.partner_id = task.partner_id;
      }

      // Додаємо категорію, якщо є
      if (task.category) {
        verificationData.task_data.category = task.category;
      }

      // Запит до API для верифікації
      return await this.performApiVerification(taskId, verificationData);
    } catch (error) {
      console.error(`Помилка при верифікації партнерського завдання ${taskId}:`, error);

      return this.createErrorResult(
        taskId,
        'Сталася помилка під час перевірки завдання',
        error.message
      );
    }
  }

  /**
   * Підготовка трекінгових параметрів для партнерського завдання
   * @param {Object} task - Завдання
   * @param {string} userId - ID користувача
   * @returns {Object} Трекінгові параметри
   */
  prepareTrackingParams(task, userId) {
    const params = {
      utm_source: 'winix',
      utm_medium: 'quest',
      utm_campaign: task.id,
    };

    // Додаємо ID користувача, якщо є
    if (userId) {
      params.utm_term = userId;
    }

    // Додаємо партнерський ID, якщо є
    if (task.partner_id) {
      params.partner_id = task.partner_id;
    }

    // Додаємо зовнішній трекінг, якщо є
    if (task.external_tracking_id) {
      params.tracking_id = task.external_tracking_id;
    }

    return params;
  }
}

export default PartnerVerifier;
