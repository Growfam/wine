/**
 * Верифікатор лімітованих завдань
 *
 * Відповідає за:
 * - Перевірку виконання лімітованих завдань
 * - Валідацію термінів
 */

import { BaseVerifier } from './base-verifier.js';
import { TASK_STATUS } from '../../../config';

export class LimitedVerifier extends BaseVerifier {
  /**
   * Верифікація лімітованого завдання
   * @param {string} taskId - ID завдання
   * @param {Object} task - Дані завдання
   * @returns {Promise<Object>} Результат верифікації
   */
  async verify(taskId, task) {
    try {
      if (!task) {
        return this.createErrorResult(taskId, 'Не вдалося отримати дані завдання');
      }

      // Перевіряємо термін дії завдання
      if (task.end_date) {
        const endDate = new Date(task.end_date);
        const now = new Date();

        if (endDate <= now) {
          console.info(`Термін виконання завдання ${taskId} закінчився`);

          return this.createFailureResult(taskId, 'Термін виконання цього завдання закінчився');
        }
      }

      // Перевіряємо ліміт виконань
      if (task.max_completions !== null && task.current_completions >= task.max_completions) {
        console.info(`Ліміт виконань завдання ${taskId} вичерпано`);

        return this.createFailureResult(taskId, 'Ліміт виконань цього завдання вичерпано');
      }

      // Додаткові дані для перевірки лімітованого завдання
      const verificationData = {
        verification_type: 'limited',
        task_data: {
          action_type: task.action_type || 'visit',
          timestamp: Date.now(),
        },
      };

      // Запит до API для верифікації
      return await this.performApiVerification(taskId, verificationData);
    } catch (error) {
      console.error(`Помилка при верифікації лімітованого завдання ${taskId}:`, error);

      return this.createErrorResult(
        taskId,
        'Сталася помилка під час перевірки завдання',
        error.message
      );
    }
  }

  /**
   * Перевірка, чи не закінчився термін виконання
   * @param {Object} task - Завдання
   * @returns {boolean} Результат перевірки
   */
  isWithinTimeFrame(task) {
    if (!task.end_date) return true;

    const endDate = new Date(task.end_date);
    const now = new Date();

    return endDate > now;
  }

  /**
   * Перевірка, чи не вичерпано ліміт виконань
   * @param {Object} task - Завдання
   * @returns {boolean} Результат перевірки
   */
  isWithinCompletionLimit(task) {
    if (task.max_completions === null) return true;

    return task.current_completions < task.max_completions;
  }
}

export default LimitedVerifier;
