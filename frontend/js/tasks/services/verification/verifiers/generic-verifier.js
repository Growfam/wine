/**
 * Верифікатор загальних завдань
 *
 * Відповідає за:
 * - Перевірку виконання завдань без специфічного типу
 * - Обробку нестандартних перевірок
 */

import { BaseVerifier } from 'js/tasks/services/verification/verifiers/base-verifier.js';

export class GenericVerifier extends BaseVerifier {
  /**
   * Верифікація загального завдання
   * @param {string} taskId - ID завдання
   * @param {Object} task - Дані завдання
   * @returns {Promise<Object>} Результат верифікації
   */
  async verify(taskId, task) {
    try {
      // Додаткові дані для перевірки
      const verificationData = {
        verification_type: 'generic',
        task_data: {
          action_type: task?.action_type || 'generic',
          timestamp: Date.now(),
        },
      };

      // Запит до API для верифікації
      return await this.performApiVerification(taskId, verificationData);
    } catch (error) {
      console.error(`Помилка при верифікації загального завдання ${taskId}:`, error);
      return this.createErrorResult(
        taskId,
        'Сталася помилка під час перевірки завдання',
        error.message
      );
    }
  }
}

export default GenericVerifier;
