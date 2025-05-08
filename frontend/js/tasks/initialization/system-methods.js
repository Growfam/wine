/**
 * Методи системи завдань
 *
 * Відповідає за:
 * - Основні методи взаємодії із завданнями
 * - Управління станом системи
 * - Інтерфейс для зовнішнього використання
 *
 * @version 3.1.0
 */

import { TASK_TYPES } from '../config/index.js';
import { getLogger } from '../utils/core/logger.js';

// Створюємо логер для методів системи
const logger = getLogger('SystemMethods');

/**
 * Отримання задач певного типу
 * @param {Object} taskStore - Сховище завдань
 * @param {string} type - Тип завдань
 * @returns {Array} Масив завдань
 */
export function getTasks(taskStore, type) {
  return taskStore?.getTasks(type) || [];
}

/**
 * Пошук завдання за ID
 * @param {Object} taskStore - Сховище завдань
 * @param {string} taskId - ID завдання
 * @returns {Object|null} Знайдене завдання
 */
export function findTaskById(taskStore, taskId) {
  return taskStore?.findTaskById(taskId) || null;
}

/**
 * Запуск завдання
 * @param {Object} api - API завдань
 * @param {Object} progress - Сервіс прогресу
 * @param {string} taskId - ID завдання
 * @returns {Promise<Object>} Результат операції
 */
export async function startTask(api, progress, taskStore, taskId) {
  try {
    if (!api) {
      throw new Error('API не ініціалізовано');
    }

    const response = await api.startTask(taskId);

    if (response.status === 'success' || response.success) {
      // Оновлюємо прогрес
      if (response.data && response.data.progress) {
        progress.updateTaskProgress(taskId, response.data.progress);
      } else {
        // Встановлюємо базовий прогрес, якщо він не повернувся з сервера
        progress.updateTaskProgress(taskId, {
          status: 'started',
          progress_value: 0,
          task_id: taskId,
        });
      }

      // Генеруємо подію про запуск завдання
      dispatchSystemEvent('task-started', {
        taskId,
        response,
      });

      // Отримуємо дані завдання
      const task = findTaskById(taskStore, taskId);

      // Повертаємо результат
      return {
        success: true,
        message: response.message || 'Завдання успішно активовано',
        task,
        action_url: task?.action_url || task?.channel_url,
      };
    } else {
      // Повертаємо помилку
      return {
        success: false,
        message: response.message || response.error || 'Помилка запуску завдання',
        error: response.error,
      };
    }
  } catch (error) {
    logger.error('Помилка запуску завдання', 'startTask', { taskId, error });

    return {
      success: false,
      message: 'Помилка запуску завдання',
      error: error.message,
    };
  }
}

/**
 * Верифікація завдання
 * @param {Object} verification - Сервіс верифікації
 * @param {string} taskId - ID завдання
 * @returns {Promise<Object>} Результат верифікації
 */
export async function verifyTask(verification, taskId) {
  if (!verification) {
    logger.error('Модуль верифікації не ініціалізовано', 'verifyTask', { taskId });
    return { success: false, message: 'Модуль верифікації не ініціалізовано' };
  }

  return await verification.verifyTask(taskId);
}

/**
 * Оновлення прогресу завдання
 * @param {Object} progress - Сервіс прогресу
 * @param {string} taskId - ID завдання
 * @param {Object} progressData - Дані прогресу
 * @returns {boolean} Результат операції
 */
export function updateTaskProgress(progress, taskId, progressData) {
  if (!progress) {
    logger.error('Модуль прогресу не ініціалізовано', 'updateTaskProgress', { taskId });
    return false;
  }

  return progress.updateTaskProgress(taskId, progressData);
}

/**
 * Отримання прогресу завдання
 * @param {Object} progress - Сервіс прогресу
 * @param {string} taskId - ID завдання
 * @returns {Object|null} Прогрес завдання
 */
export function getTaskProgress(progress, taskId) {
  if (!progress) {
    logger.error('Модуль прогресу не ініціалізовано', 'getTaskProgress', { taskId });
    return null;
  }

  return progress.getTaskProgress(taskId);
}

/**
 * Синхронізація прогресу з сервером
 * @param {Object} progress - Сервіс прогресу
 * @returns {Promise<Object>} Результат операції
 */
export async function syncProgress(progress) {
  if (!progress) {
    logger.error('Модуль прогресу не ініціалізовано', 'syncProgress');
    return { success: false, message: 'Модуль прогресу не ініціалізовано' };
  }

  return await progress.syncAllProgress();
}

/**
 * Отримання щоденного бонусу
 * @param {Object} dailyBonus - Сервіс щоденних бонусів
 * @returns {Promise<Object>} Результат операції
 */
export async function claimDailyBonus(dailyBonus, taskStore) {
  if (!dailyBonus) {
    logger.error('Модуль щоденних бонусів не ініціалізовано', 'claimDailyBonus');
    return { success: false, message: 'Модуль щоденних бонусів не ініціалізовано' };
  }

  try {
    const result = await dailyBonus.claimDailyBonus();

    // Оновлюємо баланс, якщо бонус отримано успішно
    if (result.success && result.data && result.data.amount) {
      updateBalance(taskStore, 'coins', result.data.amount, true);
    }

    return result;
  } catch (error) {
    logger.error('Помилка отримання щоденного бонусу', 'claimDailyBonus', { error });
    return {
      success: false,
      message: 'Помилка отримання щоденного бонусу',
      error: error.message,
    };
  }
}

/**
 * Зміна активної вкладки
 * @param {Object} taskStore - Сховище завдань
 * @param {string} tabType - Тип вкладки
 */
export function setActiveTab(taskStore, tabType) {
  if (!taskStore) {
    logger.error('Сховище не ініціалізовано', 'setActiveTab', { tabType });
    return;
  }

  taskStore.setActiveTab(tabType);
}

/**
 * Оновлення балансу
 * @param {Object} taskStore - Сховище завдань
 * @param {string} type - Тип балансу ('coins' або 'tokens')
 * @param {number} amount - Сума
 * @param {boolean} isIncrement - Чи є це збільшенням
 */
export function updateBalance(taskStore, type, amount, isIncrement = true) {
  if (!taskStore) {
    logger.error('Сховище не ініціалізовано', 'updateBalance', { type, amount, isIncrement });
    return;
  }

  taskStore.updateBalance(type, amount, isIncrement);
}

/**
 * Отримання стану системи
 * @param {Object} taskStore - Сховище завдань
 * @param {string} version - Версія системи
 * @param {boolean} initialized - Стан ініціалізації
 * @returns {Object} Стан системи
 */
export function getSystemState(taskStore, version, initialized) {
  if (!taskStore) return { initialized, version };

  return {
    initialized,
    version,
    activeTabType: taskStore.systemState?.activeTabType,
    tasksCount: {
      social: taskStore.tasks?.[TASK_TYPES.SOCIAL]?.length || 0,
      limited: taskStore.tasks?.[TASK_TYPES.LIMITED]?.length || 0,
      partner: taskStore.tasks?.[TASK_TYPES.PARTNER]?.length || 0,
      referral: taskStore.tasks?.[TASK_TYPES.REFERRAL]?.length || 0,
    },
  };
}

/**
 * Скидання стану системи
 * @param {Object} taskStore - Сховище завдань
 * @param {Object} progress - Сервіс прогресу
 * @param {Object} verification - Сервіс верифікації
 * @param {Object} dailyBonus - Сервіс щоденних бонусів
 * @param {Object} api - API завдань
 */
export function resetState(taskStore, progress, verification, dailyBonus, api) {
  // Скидаємо стан сховища
  if (taskStore) taskStore.resetState();

  // Скидаємо стан сервісів
  if (progress) progress.resetState();
  if (verification) verification.resetState();
  if (dailyBonus && dailyBonus.resetState) dailyBonus.resetState();

  // Очищаємо кеш API
  if (api && api.clearCache) {
    api.clearCache();
  }

  // Генеруємо подію скидання
  dispatchSystemEvent('reset');

  logger.info('Стан системи скинуто', 'reset');
}

/**
 * Генерація події системи
 * @param {string} eventName - Назва події
 * @param {Object} data - Дані події
 */
export function dispatchSystemEvent(eventName, data = {}) {
  if (typeof document === 'undefined') return;

  const event = new CustomEvent(`task-system-${eventName}`, {
    detail: {
      ...data,
      timestamp: Date.now(),
    },
  });

  document.dispatchEvent(event);
  logger.debug(`Згенеровано подію ${eventName}`, 'dispatchSystemEvent', { data });
}

export default {
  getTasks,
  findTaskById,
  startTask,
  verifyTask,
  updateTaskProgress,
  getTaskProgress,
  syncProgress,
  claimDailyBonus,
  setActiveTab,
  updateBalance,
  getSystemState,
  resetState,
  dispatchSystemEvent
};