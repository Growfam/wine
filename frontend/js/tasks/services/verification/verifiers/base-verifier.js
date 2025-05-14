/**
 * Базовий клас для верифікаторів
 *
 * Надає спільну функціональність для всіх верифікаторів
 */

import { VERIFICATION_STATUS } from '../../../config/verification-status.js';

export class BaseVerifier {
  constructor() {
    // Конфігурація верифікатора
    this.config = {
      // Чи виконувати попередню перевірку завдання
      enablePreVerification: true,

      // Чи виконувати перевірку після верифікації
      enablePostVerification: true,

      // Таймаут для API запитів (мс)
      apiTimeout: 15000,

      // Максимальна кількість спроб
      maxRetries: 2,

      // Час затримки між спробами (мс)
      retryDelay: 1000,
    };
  }

  /**
   * Базовий метод верифікації
   * @param {string} taskId - ID завдання
   * @param {Object} task - Дані завдання
   * @returns {Promise<Object>} Результат верифікації
   */
  async verify(taskId, task) {
    try {
      // Засікаємо час початку
      const startTime = Date.now();

      // Перевіряємо вхідні параметри
      if (!taskId) {
        return this.createErrorResult(taskId, 'Не вказано ID завдання');
      }

      // Валідація даних завдання
      if (!this.validateTask(task)) {
        return this.createErrorResult(taskId, 'Невалідні дані завдання або завдання не знайдено');
      }

      // Попередня підготовка до верифікації
      if (this.config.enablePreVerification) {
        const preVerificationResult = await this.preVerify(taskId, task);
        if (preVerificationResult && !preVerificationResult.success) {
          return preVerificationResult;
        }
      }

      // Підготовка даних для верифікації
      const verificationData = this.prepareVerificationData(taskId, task);

      // Виконання API запиту для верифікації
      const result = await this.performApiVerification(taskId, verificationData);

      // Додаємо час відгуку
      result.response_time_ms = Date.now() - startTime;

      // Дії після верифікації
      if (this.config.enablePostVerification) {
        await this.postVerify(taskId, result);
      }

      return result;
    } catch (error) {
      console.error(`Помилка верифікації для завдання ${taskId}:`, error);
      return this.createErrorResult(
        taskId,
        'Сталася помилка під час верифікації завдання',
        error.message
      );
    }
  }

  /**
   * Валідація завдання перед верифікацією
   * @param {Object} task - Дані завдання
   * @returns {boolean} Результат валідації
   */
  validateTask(task) {
    // Базова перевірка даних завдання
    if (!task) {
      return false;
    }

    // Перевірка необхідних полів
    if (!task.id || !task.type) {
      return false;
    }

    return true;
  }

  /**
   * Попередня підготовка до верифікації
   * @param {string} taskId - ID завдання
   * @param {Object} task - Дані завдання
   * @returns {Promise<Object|null>} Результат попередньої перевірки або null, якщо все в порядку
   */
  async preVerify(taskId, task) {
    // Базова реалізація не виконує специфічних перевірок
    // Дочірні класи можуть перевизначити цей метод для додаткових перевірок
    return null;
  }

  /**
   * Дії після верифікації
   * @param {string} taskId - ID завдання
   * @param {Object} result - Результат верифікації
   * @returns {Promise<void>}
   */
  async postVerify(taskId, result) {
    // Базова реалізація не виконує специфічних дій
    // Дочірні класи можуть перевизначити цей метод для додаткової обробки результату
    return;
  }

  /**
   * Підготовка даних для верифікації
   * @param {string} taskId - ID завдання
   * @param {Object} task - Дані завдання
   * @returns {Object} Дані для верифікації
   */
  prepareVerificationData(taskId, task) {
    // Базова підготовка даних
    return {
      verification_type: task?.type || 'generic',
      task_data: {
        action_type: task?.action_type || 'generic',
        timestamp: Date.now(),
      },
    };
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
      const taskApi = window.taskApi || this.getApiClient();

      // Якщо API не доступний, створюємо помилку
      if (!taskApi || typeof taskApi.verifyTask !== 'function') {
        throw new Error('API клієнт не доступний');
      }

      // Додаємо таймаут для запиту
      let timeoutId;
      const timeoutPromise = new Promise((_, reject) => {
        timeoutId = setTimeout(() => {
          reject(new Error('Timeout exceeded'));
        }, this.config.apiTimeout);
      });

      // Виконуємо запит з таймаутом
      const result = await Promise.race([
        this.executeApiCall(taskApi, taskId, verificationData),
        timeoutPromise
      ]);

      // Очищаємо таймаут
      clearTimeout(timeoutId);

      return result;
    } catch (error) {
      console.error(`Помилка виконання API запиту для завдання ${taskId}:`, error);

      // Визначаємо тип помилки
      if (error.message === 'Timeout exceeded') {
        return this.createErrorResult(
          taskId,
          'Перевищено час очікування відповіді. Спробуйте пізніше.',
          'timeout'
        );
      }

      if (error.name === 'TypeError' && error.message.includes('fetch')) {
        return this.createErrorResult(
          taskId,
          "Проблема з мережевим з'єднанням. Перевірте підключення до Інтернету.",
          'network_error'
        );
      }

      return this.createErrorResult(
        taskId,
        'Помилка при виконанні запиту на сервер',
        error.message
      );
    }
  }

  /**
   * Отримання API клієнта
   * @returns {Object|null} API клієнт або null, якщо недоступний
   */
  getApiClient() {
    try {
      // Спроба знайти API клієнт у різних місцях
      if (window.taskApi) {
        return window.taskApi;
      }

      if (window.TaskAPI) {
        return window.TaskAPI;
      }

      if (window.WINIX && window.WINIX.api) {
        return window.WINIX.api;
      }

      // Спроба створити простий API клієнт для базової функціональності
      return {
        verifyTask: async (taskId, data) => {
          console.warn('Використовується заглушка API клієнта для верифікації');
          // Емулюємо затримку
          await new Promise(resolve => setTimeout(resolve, 500));

          return {
            status: 'success',
            message: 'Верифікація пройшла успішно (емуляція)',
            data: {
              verified: true,
              reward: {
                type: 'tokens',
                amount: 10
              }
            }
          };
        }
      };
    } catch (error) {
      console.error('Помилка при отриманні API клієнта:', error);
      return null;
    }
  }

  /**
   * Виконання API запиту з повторними спробами
   * @param {Object} api - API клієнт
   * @param {string} taskId - ID завдання
   * @param {Object} data - Дані для запиту
   * @returns {Promise<Object>} Результат запиту
   */
  async executeApiCall(api, taskId, data) {
    let lastError = null;

    // Повторюємо запит до maxRetries разів
    for (let attempt = 0; attempt < this.config.maxRetries; attempt++) {
      try {
        // Виконуємо запит
        const response = await api.verifyTask(taskId, data);

        // Обробляємо відповідь
        if (response.status === 'success' || response.success) {
          return this.createSuccessResult(
            taskId,
            response.message || 'Завдання успішно виконано!',
            response.data?.reward,
            response.data?.verification
          );
        } else {
          lastError = response;

          // Якщо це остання спроба, повертаємо помилку
          if (attempt === this.config.maxRetries - 1) {
            return this.createFailureResult(
              taskId,
              response.message || response.error || 'Не вдалося перевірити виконання завдання',
              response.error
            );
          }
        }
      } catch (error) {
        lastError = error;

        // Якщо це остання спроба, пробуємо знову
        if (attempt < this.config.maxRetries - 1) {
          // Очікуємо перед наступною спробою
          await new Promise(resolve => setTimeout(resolve, this.config.retryDelay));
        }
      }
    }

    // Якщо всі спроби невдалі, повертаємо помилку
    return this.createFailureResult(
      taskId,
      'Не вдалося перевірити виконання завдання після кількох спроб',
      lastError?.message || 'Невідома помилка'
    );
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
      reward: reward || { type: 'tokens', amount: 0 },
      verification_details: verificationDetails || {},
      taskId: taskId,
      timestamp: Date.now(),
      response_time_ms: 0, // Буде оновлено пізніше
      metrics: {
        verification_time: Date.now(),
      }
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
      timestamp: Date.now(),
      metrics: {
        verification_time: Date.now(),
      }
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
      timestamp: Date.now(),
      metrics: {
        verification_time: Date.now(),
      }
    };
  }

  /**
   * Перетворення завдання у формат для логування
   * @param {Object} task - Завдання
   * @returns {Object} Спрощена версія завдання для логування
   */
  taskToLogFormat(task) {
    if (!task) return null;

    return {
      id: task.id,
      type: task.type,
      action_type: task.action_type,
      title: task.title?.substring(0, 30) + (task.title?.length > 30 ? '...' : '')
    };
  }

  /**
   * Отримання контейнера залежностей, якщо він доступний
   * @returns {Object|null} Контейнер залежностей або null
   */
  getDependencyContainer() {
    try {
      // Спроба знайти контейнер залежностей
      if (window.dependencyContainer) {
        return window.dependencyContainer;
      }

      return null;
    } catch (error) {
      console.error('Помилка при отриманні контейнера залежностей:', error);
      return null;
    }
  }
}

export default BaseVerifier;