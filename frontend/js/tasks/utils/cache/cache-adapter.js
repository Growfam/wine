/**
 * Адаптер кешування для системи завдань
 *
 * Надає уніфікований інтерфейс для роботи з кешем,
 * адаптуючи різні реалізації кешування до єдиного API
 */

import { getLogger } from '../../utils/core/index.js';
import cacheService from '../../api/core/cache.js';

// Отримуємо логер для модуля
const logger = getLogger('CacheAdapter');

// Константи для кешу
export const CACHE_KEYS = {
  // Загальні ключі
  TASK_PREFIX: 'task_',
  TASKS_BY_TYPE: 'tasks_',
  USER_PROGRESS: 'task_progress',
  ACTIVE_TAB: 'active_tasks_tab',
  BALANCES: 'user_balances',
  DAILY_BONUS_INFO: 'daily_bonus_info',

  // Верифікація
  VERIFICATION_PREFIX: 'verification_',
  VERIFICATION_RESULT: 'verification_result_',
  TASK_TYPE: 'task_type_',
};

// Теги для кешу
export const CACHE_TAGS = {
  // Загальні теги
  TASK: 'task',
  USER: 'user',
  PROGRESS: 'progress',
  BALANCES: 'balances',

  // Теги верифікації
  VERIFICATION: 'verification',
  RESULT: 'result',
  SOCIAL: 'social',
  LIMITED: 'limited',
  PARTNER: 'partner',
};

/**
 * Отримання даних з кешу
 * @param {string} key - Ключ кешу
 * @param {*} defaultValue - Значення за замовчуванням
 * @returns {*} Кешовані дані або значення за замовчуванням
 */
export function getFromCache(key, defaultValue = null) {
  try {
    // Використовуємо cacheService для отримання даних
    return cacheService.getCachedData(key) || defaultValue;
  } catch (error) {
    logger.error(error, `Помилка отримання даних з кешу для ключа [${key}]`, {
      category: 'storage',
      key
    });
    return defaultValue;
  }
}

/**
 * Збереження даних у кеш
 * @param {string} key - Ключ кешу
 * @param {*} value - Дані для збереження
 * @returns {boolean} Результат операції
 */
export function saveToCache(key, value) {
  try {
    // Використовуємо cacheService для збереження даних
    cacheService.cacheData(key, value);
    return true;
  } catch (error) {
    logger.error(error, `Помилка збереження даних у кеш для ключа [${key}]`, {
      category: 'storage',
      key
    });
    return false;
  }
}

/**
 * Видалення даних з кешу за ключем
 * @param {string} key - Ключ кешу
 * @returns {boolean} Результат операції
 */
export function removeFromCache(key) {
  try {
    // Використовуємо cacheService для видалення даних
    cacheService.clearCache(key);
    return true;
  } catch (error) {
    logger.error(error, `Помилка видалення даних з кешу для ключа [${key}]`, {
      category: 'storage',
      key
    });
    return false;
  }
}

/**
 * Очищення кешу за патерном ключа
 * @param {string} keyPattern - Патерн ключа кешу
 * @returns {boolean} Результат операції
 */
export function clearCacheByPattern(keyPattern) {
  try {
    if (!keyPattern) return false;

    // Використовуємо cacheService для очищення кешу за патерном
    cacheService.clearCache(keyPattern);
    logger.debug(`Очищено кеш за патерном [${keyPattern}]`, 'clearCacheByPattern');
    return true;
  } catch (error) {
    logger.error(error, `Помилка очищення кешу за патерном [${keyPattern}]`, {
      category: 'storage',
      keyPattern
    });
    return false;
  }
}

/**
 * Кешування типу завдання
 * @param {string} taskId - ID завдання
 * @param {string} type - Тип завдання
 * @returns {boolean} Результат операції
 */
export function cacheTaskType(taskId, type) {
  try {
    if (!taskId || !type) return false;

    // Формуємо ключ кешу
    const cacheKey = `${CACHE_KEYS.TASK_TYPE}${taskId}`;

    // Зберігаємо в кеш
    return saveToCache(cacheKey, type);
  } catch (error) {
    logger.error(error, `Помилка кешування типу завдання ${taskId}`, {
      category: 'storage',
      taskId,
      type
    });
    return false;
  }
}

/**
 * Отримання кешованого типу завдання
 * @param {string} taskId - ID завдання
 * @returns {string|null} Тип завдання
 */
export function getCachedTaskType(taskId) {
  try {
    if (!taskId) return null;

    // Формуємо ключ кешу
    const cacheKey = `${CACHE_KEYS.TASK_TYPE}${taskId}`;

    // Отримуємо з кешу
    return getFromCache(cacheKey);
  } catch (error) {
    logger.error(error, `Помилка отримання кешованого типу завдання ${taskId}`, {
      category: 'storage',
      taskId
    });
    return null;
  }
}

/**
 * Кешування результату верифікації
 * @param {string} taskId - ID завдання
 * @param {Object} result - Результат верифікації
 * @returns {boolean} Результат операції
 */
export function cacheVerificationResult(taskId, result) {
  try {
    if (!taskId || !result) return false;

    // Формуємо ключ кешу
    const cacheKey = `${CACHE_KEYS.VERIFICATION_RESULT}${taskId}`;

    // Зберігаємо в кеш
    return saveToCache(cacheKey, result);
  } catch (error) {
    logger.error(error, `Помилка кешування результату верифікації для завдання ${taskId}`, {
      category: 'storage',
      taskId
    });
    return false;
  }
}

/**
 * Отримання кешованого результату верифікації
 * @param {string} taskId - ID завдання
 * @returns {Object|null} Результат верифікації
 */
export function getCachedVerificationResult(taskId) {
  try {
    if (!taskId) return null;

    // Формуємо ключ кешу
    const cacheKey = `${CACHE_KEYS.VERIFICATION_RESULT}${taskId}`;

    // Отримуємо з кешу
    return getFromCache(cacheKey);
  } catch (error) {
    logger.error(error, `Помилка отримання кешованого результату верифікації для завдання ${taskId}`, {
      category: 'storage',
      taskId
    });
    return null;
  }
}

/**
 * Очищення всього кешу верифікації
 * @returns {boolean} Результат операції
 */
export function clearVerificationCache() {
  try {
    // Очищаємо за префіксами
    clearCacheByPattern(CACHE_KEYS.VERIFICATION_PREFIX);
    clearCacheByPattern(CACHE_KEYS.VERIFICATION_RESULT);
    clearCacheByPattern(CACHE_KEYS.TASK_TYPE);

    logger.info('Очищено кеш верифікації', 'clearVerificationCache');
    return true;
  } catch (error) {
    logger.error(error, 'Помилка очищення кешу верифікації', {
      category: 'storage'
    });
    return false;
  }
}

/**
 * Завантаження прогресу з кешу
 * @param {Object} store - Екземпляр сховища
 * @returns {boolean} Результат операції
 */
export function loadProgressFromCache(store) {
  try {
    if (!store) return false;

    // Завантажуємо прогрес
    const savedProgress = getFromCache(CACHE_KEYS.USER_PROGRESS);
    if (savedProgress && typeof savedProgress === 'object') {
      store.userProgress = savedProgress;
    }

    // Завантажуємо активну вкладку
    const activeTab = getFromCache(CACHE_KEYS.ACTIVE_TAB);
    if (activeTab && Object.values(store.TASK_TYPES || {}).includes(activeTab)) {
      store.systemState.activeTabType = activeTab;
    }

    logger.debug('Завантажено прогрес з кешу', 'loadProgressFromCache');
    return true;
  } catch (error) {
    logger.error(error, 'Помилка завантаження даних з кешу', {
      category: 'storage'
    });
    return false;
  }
}

/**
 * Очищення кешу за тегами
 * @param {string|Array} tags - Теги для очищення
 * @returns {boolean} Результат операції
 */
export function clearCacheByTags(tags) {
  try {
    if (Array.isArray(tags)) {
      // Очищаємо кеш для кожного тегу
      tags.forEach(tag => clearCacheByPattern(tag));
    } else {
      clearCacheByPattern(tags);
    }
    logger.debug(`Очищено кеш за тегами`, 'clearCacheByTags', { tags });
    return true;
  } catch (error) {
    logger.error(error, 'Помилка очищення кешу за тегами', {
      category: 'storage',
      tags
    });
    return false;
  }
}