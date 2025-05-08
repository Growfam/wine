/**
 * Сервіс прогресу завдань - модуль для моніторингу прогресу
 *
 * Відповідає за:
 * - Відстеження прогресу завдань
 * - Аналіз стану виконання
 * - Управління слухачами подій прогресу
 *
 * @version 3.1.0
 */

import requestService from '../core/request.js';
import cacheService from '../core/cache.js';
import { CONFIG } from '../core/config.js';

/**
 * Сервіс для моніторингу прогресу завдань
 */
class ProgressService {
  constructor() {
    // Карти для зберігання прослуховувачів та моніторингів
    this.progressListeners = new Map();
    this.monitoringIntervals = new Map();
  }

  /**
   * Отримання прогресу завдання
   * @param {string} taskId - ID завдання
   * @param {Object} options - Додаткові опції
   * @returns {Promise<Object>} Прогрес завдання
   */
  async getTaskProgress(taskId, options = {}) {
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
      const endpoint = CONFIG.API_PATHS.TASKS.PROGRESS(taskId);

      // Виконуємо запит
      const response = await requestService.get(endpoint, {
        ...options,
        useCache: options.forceRefresh ? false : true,
      });

      return response;
    } catch (error) {
      console.error(`Помилка отримання прогресу завдання ${taskId}:`, error);

      return {
        status: 'error',
        message: 'Не вдалося отримати прогрес завдання',
        error: error.message,
      };
    }
  }

  /**
   * Додавання обробника подій прогресу
   * @param {string} taskId - ID завдання для моніторингу
   * @param {Function} callback - Функція зворотного виклику
   * @returns {string} ID прослуховувача
   */
  addProgressListener(taskId, callback) {
    if (!taskId || typeof callback !== 'function') {
      console.error('Неправильні параметри для addProgressListener');
      return null;
    }

    // Генеруємо унікальний ID для прослуховувача
    const listenerId = `${taskId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Додаємо прослуховувач
    if (!this.progressListeners.has(taskId)) {
      this.progressListeners.set(taskId, new Map());
    }

    const taskListeners = this.progressListeners.get(taskId);
    taskListeners.set(listenerId, callback);

    return listenerId;
  }

  /**
   * Видалення обробника подій прогресу
   * @param {string} taskId - ID завдання
   * @param {string} listenerId - ID прослуховувача
   * @returns {boolean} Результат видалення
   */
  removeProgressListener(taskId, listenerId) {
    if (!taskId || !listenerId) {
      console.error('Неправильні параметри для removeProgressListener');
      return false;
    }

    // Перевіряємо, чи існує карта прослуховувачів для цього завдання
    if (!this.progressListeners.has(taskId)) {
      return false;
    }

    // Видаляємо прослуховувач
    const taskListeners = this.progressListeners.get(taskId);
    const result = taskListeners.delete(listenerId);

    // Якщо для завдання не залишилося прослуховувачів, видаляємо карту
    if (taskListeners.size === 0) {
      this.progressListeners.delete(taskId);
    }

    return result;
  }

  /**
   * Запуск моніторингу прогресу завдання
   * @param {string} taskId - ID завдання
   * @param {number} interval - Інтервал оновлення в мс
   * @param {Function} callback - Функція зворотного виклику
   * @returns {string} ID моніторингу
   */
  startProgressMonitoring(taskId, interval = 5000, callback) {
    if (!taskId) {
      console.error('Не вказано ID завдання для моніторингу');
      return null;
    }

    // Мінімальний інтервал - 1 секунда
    const safeInterval = Math.max(1000, interval);

    // Генеруємо унікальний ID для моніторингу
    const monitoringId = `${taskId}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Додаємо прослуховувач, якщо передано функцію зворотного виклику
    if (typeof callback === 'function') {
      this.addProgressListener(taskId, callback);
    }

    // Функція для періодичного оновлення прогресу
    const updateProgress = async () => {
      try {
        // Отримуємо прогрес
        const progress = await this.getTaskProgress(taskId, { forceRefresh: true });

        // Викликаємо всі прослуховувачі для цього завдання
        if (this.progressListeners.has(taskId)) {
          const taskListeners = this.progressListeners.get(taskId);
          taskListeners.forEach((listener) => {
            try {
              listener(progress);
            } catch (listenerError) {
              console.error('Помилка в обробнику прогресу:', listenerError);
            }
          });
        }

        // Перевіряємо, чи завдання завершено
        if (
          progress.status === 'success' &&
          progress.data &&
          (progress.data.completed || progress.data.status === 'completed')
        ) {
          // Зупиняємо моніторинг, якщо завдання завершено
          this.stopProgressMonitoring(monitoringId);

          // Генеруємо подію завершення завдання
          this._triggerTaskEvent('task-completed', {
            taskId,
            timestamp: Date.now(),
            progress: progress.data,
          });
        }
      } catch (error) {
        console.error(`Помилка оновлення прогресу для завдання ${taskId}:`, error);
      }
    };

    // Запускаємо інтервал
    const intervalId = setInterval(updateProgress, safeInterval);

    // Зберігаємо інформацію про моніторинг
    this.monitoringIntervals.set(monitoringId, {
      intervalId,
      taskId,
      interval: safeInterval,
    });

    // Запускаємо перше оновлення відразу
    updateProgress();

    return monitoringId;
  }

  /**
   * Зупинка моніторингу прогресу завдання
   * @param {string} monitoringId - ID моніторингу
   * @returns {boolean} Результат зупинки
   */
  stopProgressMonitoring(monitoringId) {
    if (!monitoringId || !this.monitoringIntervals.has(monitoringId)) {
      return false;
    }

    // Отримуємо інформацію про моніторинг
    const monitoringInfo = this.monitoringIntervals.get(monitoringId);

    // Зупиняємо інтервал
    clearInterval(monitoringInfo.intervalId);

    // Видаляємо з карти моніторингу
    this.monitoringIntervals.delete(monitoringId);

    return true;
  }

  /**
   * Зупинка всіх моніторингів для завдання
   * @param {string} taskId - ID завдання
   * @returns {number} Кількість зупинених моніторингів
   */
  stopAllMonitoringForTask(taskId) {
    if (!taskId) {
      return 0;
    }

    let stoppedCount = 0;

    // Перебираємо всі моніторинги та зупиняємо ті, що стосуються вказаного завдання
    for (const [monitoringId, monitoringInfo] of this.monitoringIntervals.entries()) {
      if (monitoringInfo.taskId === taskId) {
        clearInterval(monitoringInfo.intervalId);
        this.monitoringIntervals.delete(monitoringId);
        stoppedCount++;
      }
    }

    // Видаляємо всі прослуховувачі для цього завдання
    if (this.progressListeners.has(taskId)) {
      this.progressListeners.delete(taskId);
    }

    return stoppedCount;
  }

  /**
   * Зупинка всіх моніторингів
   * @returns {number} Кількість зупинених моніторингів
   */
  stopAllMonitoring() {
    let stoppedCount = 0;

    // Зупиняємо всі інтервали
    for (const [monitoringId, monitoringInfo] of this.monitoringIntervals.entries()) {
      clearInterval(monitoringInfo.intervalId);
      stoppedCount++;
    }

    // Очищаємо карти
    this.monitoringIntervals.clear();
    this.progressListeners.clear();

    return stoppedCount;
  }

  /**
   * Перевірка статусу завдання
   * @param {string} taskId - ID завдання
   * @param {Object} options - Додаткові опції
   * @returns {Promise<Object>} Статус завдання
   */
  async checkTaskStatus(taskId, options = {}) {
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
      const endpoint = CONFIG.API_PATHS.USER_TASK_STATUS(userId, taskId);

      // Виконуємо запит
      const response = await requestService.get(endpoint, {
        ...options,
        useCache: options.forceRefresh ? false : true,
      });

      return response;
    } catch (error) {
      console.error(`Помилка перевірки статусу завдання ${taskId}:`, error);

      return {
        status: 'error',
        message: 'Не вдалося перевірити статус завдання',
        error: error.message,
      };
    }
  }

  /**
   * Аналіз прогресу та статусу завдання
   * @param {string} taskId - ID завдання
   * @param {Object} options - Додаткові опції
   * @returns {Promise<Object>} Результат аналізу
   */
  async analyzeTaskProgress(taskId, options = {}) {
    try {
      if (!taskId) {
        throw new Error('Не вказано ID завдання');
      }

      // Отримуємо прогрес та статус завдання
      const [progressResponse, statusResponse] = await Promise.all([
        this.getTaskProgress(taskId, options),
        this.checkTaskStatus(taskId, options),
      ]);

      // Дані для аналізу
      const progress = progressResponse.data || {};
      const status = statusResponse.data || {};

      // Аналізуємо стан завдання
      const analysis = {
        taskId,
        isStarted:
          !!status.started_at || status.status === 'in_progress' || status.status === 'completed',
        isCompleted: !!status.completed_at || status.status === 'completed',
        percentComplete: progress.percent || 0,
        currentStep: progress.current_step || 0,
        totalSteps: progress.total_steps || 0,
        remainingSteps: (progress.total_steps || 0) - (progress.current_step || 0),
        estimatedCompletionTime: null,
      };

      // Оцінка часу до завершення (якщо є дані про швидкість)
      if (progress.avg_step_time && analysis.remainingSteps > 0) {
        analysis.estimatedCompletionTime = progress.avg_step_time * analysis.remainingSteps;
      }

      return {
        status: 'success',
        data: analysis,
        raw: {
          progress: progressResponse,
          status: statusResponse,
        },
      };
    } catch (error) {
      console.error(`Помилка аналізу прогресу завдання ${taskId}:`, error);

      return {
        status: 'error',
        message: 'Не вдалося аналізувати прогрес завдання',
        error: error.message,
      };
    }
  }

  /**
   * Генерує подію в системі
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
export default new ProgressService();
