/**
 * Синхронізація прогресу з сервером
 *
 * Відповідає за синхронізацію локального прогресу з серверним
 */

import { CONFIG } from 'js/tasks/config/index.js';

/**
 * Налаштування синхронізації з сервером
 * @param {Object} progressService - Сервіс прогресу
 */
export function setupSyncService(progressService) {
  // Періодична синхронізація всього прогресу
  setInterval(() => {
    syncAllProgress(progressService);
  }, CONFIG.CACHE_TTL); // Синхронізуємо з тією ж частотою, що і час життя кешу

  // Синхронізація при ініціалізації
  document.addEventListener('task-progress-initialized', () => {
    // Затримка для завершення інших ініціалізацій
    setTimeout(() => {
      syncAllProgress(progressService);
    }, 1000);
  });

  // Синхронізація при завершенні завдання
  document.addEventListener('task-completed', (event) => {
    const { taskId } = event.detail;
    syncTaskProgress(progressService, taskId);
  });
}

/**
 * Синхронізація прогресу конкретного завдання
 * @param {Object} progressService - Сервіс прогресу
 * @param {string} taskId - ID завдання
 * @returns {Promise<Object>} Результат синхронізації
 */
export async function syncTaskProgress(progressService, taskId) {
  try {
    // Перевіряємо, чи підключено API
    const taskApi = window.taskApi || {
      getTaskProgress: () => Promise.resolve({ status: 'error' }),
    };

    // Отримуємо прогрес з сервера
    const response = await taskApi.getTaskProgress(taskId);

    if (response && response.status === 'success' && response.data) {
      // Оновлюємо локальний прогрес
      progressService.updateTaskProgress(taskId, response.data);

      return {
        success: true,
        message: 'Прогрес успішно синхронізовано',
        data: response.data,
      };
    }

    return {
      success: false,
      message: 'Не вдалося отримати прогрес з сервера',
      error: response?.error || response?.message || 'Невідома помилка',
    };
  } catch (error) {
    console.error('Помилка синхронізації прогресу:', error);

    return {
      success: false,
      message: 'Помилка синхронізації прогресу',
      error: error.message,
    };
  }
}

/**
 * Синхронізація всього прогресу з сервером
 * @param {Object} progressService - Сервіс прогресу
 * @returns {Promise<Object>} Результат синхронізації
 */
export async function syncAllProgress(progressService) {
  try {
    // Перевіряємо, чи підключено API
    const taskApi = window.taskApi || {
      fetchWithRetry: () => Promise.resolve({ status: 'error' }),
    };

    // Запитуємо весь прогрес з сервера
    const response = await taskApi.fetchWithRetry('quests/user-progress/all');

    if (response && response.status === 'success' && response.data) {
      // Оновлюємо всі дані прогресу у сховищі
      const taskStore = window.taskStore || { setUserProgress: () => {} };
      taskStore.setUserProgress(response.data);

      return {
        success: true,
        message: 'Всі дані прогресу успішно синхронізовано',
        data: response.data,
      };
    }

    return {
      success: false,
      message: 'Не вдалося отримати прогрес з сервера',
      error: response?.error || response?.message || 'Невідома помилка',
    };
  } catch (error) {
    console.error('Помилка синхронізації прогресу:', error);

    return {
      success: false,
      message: 'Помилка синхронізації прогресу',
      error: error.message,
    };
  }
}

/**
 * Спроба відправити прогрес на сервер з повторними спробами
 * @param {string} taskId - ID завдання
 * @param {Object} progressData - Дані прогресу
 * @param {number} [maxRetries=3] - Максимальна кількість спроб
 * @returns {Promise<Object>} Результат операції
 */
export async function sendProgressWithRetry(taskId, progressData, maxRetries = 3) {
  let lastError = null;

  // Перевіряємо, чи підключено API
  const taskApi = window.taskApi || {
    updateTaskProgress: () => Promise.resolve({ status: 'error' }),
  };

  // Спроби відправки
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      // Відправляємо на сервер
      const response = await taskApi.updateTaskProgress(taskId, progressData);

      if (response && response.status === 'success') {
        return {
          success: true,
          message: 'Прогрес успішно відправлено на сервер',
          data: response.data,
          attempts: attempt + 1,
        };
      }

      // Зберігаємо помилку
      lastError = {
        message: response?.message || response?.error || 'Невідома помилка',
        response,
      };

      // Затримка перед наступною спробою
      await new Promise((resolve) => setTimeout(resolve, CONFIG.RETRY_INTERVAL));
    } catch (error) {
      lastError = error;

      // Затримка перед наступною спробою
      await new Promise((resolve) => setTimeout(resolve, CONFIG.RETRY_INTERVAL));
    }
  }

  return {
    success: false,
    message: 'Не вдалося відправити прогрес на сервер після декількох спроб',
    error: lastError,
    attempts: maxRetries,
  };
}

// Експортуємо всі функції
export default {
  setupSyncService,
  syncTaskProgress,
  syncAllProgress,
  sendProgressWithRetry
};