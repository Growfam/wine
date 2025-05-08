/**
 * Базовий клас для верифікаторів
 *
 * Надає спільну функціональність для всіх верифікаторів
 */

import { VERIFICATION_STATUS } from '../../../config';

export class BaseVerifier {
  /**
   * Базовий метод верифікації
   * @param {string} taskId - ID завдання
   * @param {Object} task - Дані завдання
   * @returns {Promise<Object>} Результат верифікації
   */
  async verify(taskId, task) {
    // Базова перевірка даних завдання
    if (!task) {
      console.warn(`Відсутні дані для завдання ${taskId}`);
      return this.createErrorResult(taskId, 'Не вдалося отримати дані завдання');
    }

    // Реальні верифікатори повинні перевизначити цей метод
    return this.createSuccessResult(taskId, 'Завдання успішно виконано!');
  }

  /**
   * Виконання API запиту для верифікації
   * @param {string} taskId - ID завдання
   * @param {Object} verificationData - Дані для верифікації
   * @returns {Promise<Object>} Результат верифікації
   */
  async performApiVerification(taskId, verificationData = {}) {
    try {
      // Перевіряємо наявність API клієнта
      const taskApi = window.taskApi || { verifyTask: () => Promise.resolve({ status: 'error', message: 'API не знайдено' }) };

      // Викликаємо API для верифікації
      const response = await taskApi.verifyTask(taskId, verificationData);

      // Обробляємо відповідь
      if (response.status === 'success') {
        console.info(`Завдання ${taskId} успішно виконано`);

        return this.createSuccessResult(
          taskId,
          response.message || 'Завдання успішно виконано!',
          response.data?.reward,
          response.data?.verification
        );
      } else {
        console.warn(`Верифікація завдання ${taskId} невдала:`, response);

        return this.createFailureResult(
          taskId,
          response.message || response.error || 'Не вдалося перевірити виконання завдання',
          response.error
        );
      }
    } catch (error) {
      console.error(`Помилка виконання API запиту для завдання ${taskId}:`, error);
      throw error;
    }
  }

  /**
   * Створення результату успішної верифікації
   * @param {string} taskId - ID завдання
   * @param {string} message - Повідомлення
   * @param {Object} reward - Винагорода
   * @param {Object} verificationDetails - Деталі верифікації
   * @returns {Object} Результат верифікації
   */
  createSuccessResult(taskId, message, reward = null, verificationDetails = {}) {
    return {
      success: true,
      status: VERIFICATION_STATUS.SUCCESS,
      message: message || 'Завдання успішно виконано!',
      reward: reward,
      verification_details: verificationDetails || {},
      taskId: taskId,
      timestamp: Date.now(),
      response_time_ms: 0
    };
  }

  /**
   * Створення результату невдалої верифікації
   * @param {string} taskId - ID завдання
   * @param {string} message - Повідомлення
   * @param {string} error - Помилка
   * @returns {Object} Результат верифікації
   */
  createFailureResult(taskId, message, error = null) {
    return {
      success: false,
      status: VERIFICATION_STATUS.FAILURE,
      message: message || 'Не вдалося перевірити виконання завдання',
      error: error,
      taskId: taskId,
      timestamp: Date.now()
    };
  }

  /**
   * Створення результату помилки верифікації
   * @param {string} taskId - ID завдання
   * @param {string} message - Повідомлення
   * @param {string} error - Помилка
   * @returns {Object} Результат верифікації
   */
  createErrorResult(taskId, message, error = null) {
    return {
      success: false,
      status: VERIFICATION_STATUS.ERROR,
      message: message || 'Сталася помилка під час перевірки завдання',
      error: error,
      taskId: taskId,
      timestamp: Date.now()
    };
  }
}