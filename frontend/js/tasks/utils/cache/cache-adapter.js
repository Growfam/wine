/**
 * Адаптер кешування для системи завдань
 *
 * Надає уніфікований інтерфейс для роботи з кешем,
 * адаптуючи різні реалізації кешування до єдиного API
 */

import { getLogger } from '../core/logger.js';

// Отримуємо логер для модуля
const logger = getLogger('CacheAdapter');

// Глобальна змінна для зберігання посилання на кеш-сервіс
let cacheServiceInstance = null;

// ВИПРАВЛЕНО: безпечний імпорт cacheService з додаванням обробки помилок
const initCacheService = async () => {
  if (cacheServiceInstance) {
    return cacheServiceInstance;
  }

  try {
    // Динамічний імпорт з обробкою помилок
    const cacheModule = await import('../../api/core/cache.js');
    cacheServiceInstance = cacheModule.default;
    return cacheServiceInstance;
  } catch (error) {
    logger.error(error, 'Не вдалося завантажити модуль кешування, використовуючи резервний кеш', {
      category: 'storage'
    });
    // Створюємо простий резервний кеш-сервіс для запобігання помилкам
    return createFallbackCacheService();
  }
};

// Резервний кеш-сервіс, що використовує localStorage або об'єкт Map
const createFallbackCacheService = () => {
  const memoryCache = new Map();

  return {
    getCachedData: (key) => {
      try {
        if (typeof localStorage !== 'undefined') {
          const value = localStorage.getItem(`fallback_cache_${key}`);
          return value !== null ? JSON.parse(value) : null;
        }
        return memoryCache.get(key) || null;
      } catch (e) {
        return memoryCache.get(key) || null;
      }
    },

    cacheData: (key, value) => {
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.setItem(`fallback_cache_${key}`, JSON.stringify(value));
        }
        memoryCache.set(key, value);
        return true;
      } catch (e) {
        memoryCache.set(key, value);
        return true;
      }
    },

    clearCache: (key) => {
      try {
        if (typeof localStorage !== 'undefined') {
          localStorage.removeItem(`fallback_cache_${key}`);
        }
        memoryCache.delete(key);
        return true;
      } catch (e) {
        memoryCache.delete(key);
        return true;
      }
    }
  };
};

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

// Ініціалізуємо кеш-сервіс одразу для пришвидшення доступності
initCacheService();

/**
 * Отримання даних з кешу
 * @param {string} key - Ключ кешу
 * @param {*} defaultValue - Значення за замовчуванням
 * @returns {Promise<*>} Кешовані дані або значення за замовчуванням
 */
export async function getFromCache(key, defaultValue = null) {
  try {
    // Отримуємо екземпляр кеш-сервісу
    const cacheService = await initCacheService();

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
 * Синхронне отримання даних з кешу (з можливими затримками при першому виклику)
 * @param {string} key - Ключ кешу
 * @param {*} defaultValue - Значення за замовчуванням
 * @returns {*} Кешовані дані або значення за замовчуванням
 */
export function getFromCacheSync(key, defaultValue = null) {
  try {
    // Використовуємо вже ініціалізований екземпляр кеш-сервісу
    if (cacheServiceInstance) {
      return cacheServiceInstance.getCachedData(key) || defaultValue;
    }

    // Якщо кеш-сервіс ще не ініціалізований, використовуємо fallback
    logger.warn(`Кеш-сервіс ще не ініціалізований, використання резервного механізму для ключа [${key}]`, {
      category: 'storage',
      key
    });

    // Спробуємо використати localStorage напряму
    if (typeof localStorage !== 'undefined') {
      try {
        const storedValue = localStorage.getItem(`cache_${key}`);
        return storedValue !== null ? JSON.parse(storedValue) : defaultValue;
      } catch (e) {
        return defaultValue;
      }
    }

    return defaultValue;
  } catch (error) {
    logger.error(error, `Помилка синхронного отримання даних з кешу для ключа [${key}]`, {
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
 * @returns {Promise<boolean>} Результат операції
 */
export async function saveToCache(key, value) {
  try {
    // Отримуємо екземпляр кеш-сервісу
    const cacheService = await initCacheService();

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
 * @returns {Promise<boolean>} Результат операції
 */
export async function removeFromCache(key) {
  try {
    // Отримуємо екземпляр кеш-сервісу
    const cacheService = await initCacheService();

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
 * @returns {Promise<boolean>} Результат операції
 */
export async function clearCacheByPattern(keyPattern) {
  try {
    if (!keyPattern) return false;

    // Отримуємо екземпляр кеш-сервісу
    const cacheService = await initCacheService();

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
 * @returns {Promise<boolean>} Результат операції
 */
export async function cacheTaskType(taskId, type) {
  try {
    if (!taskId || !type) return false;

    // Формуємо ключ кешу
    const cacheKey = `${CACHE_KEYS.TASK_TYPE}${taskId}`;

    // Зберігаємо в кеш
    return await saveToCache(cacheKey, type);
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
 * @returns {Promise<string|null>} Тип завдання
 */
export async function getCachedTaskType(taskId) {
  try {
    if (!taskId) return null;

    // Формуємо ключ кешу
    const cacheKey = `${CACHE_KEYS.TASK_TYPE}${taskId}`;

    // Отримуємо з кешу
    return await getFromCache(cacheKey);
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
 * @returns {Promise<boolean>} Результат операції
 */
export async function cacheVerificationResult(taskId, result) {
  try {
    if (!taskId || !result) return false;

    // Формуємо ключ кешу
    const cacheKey = `${CACHE_KEYS.VERIFICATION_RESULT}${taskId}`;

    // Зберігаємо в кеш
    return await saveToCache(cacheKey, result);
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
 * @returns {Promise<Object|null>} Результат верифікації
 */
export async function getCachedVerificationResult(taskId) {
  try {
    if (!taskId) return null;

    // Формуємо ключ кешу
    const cacheKey = `${CACHE_KEYS.VERIFICATION_RESULT}${taskId}`;

    // Отримуємо з кешу
    return await getFromCache(cacheKey);
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
 * @returns {Promise<boolean>} Результат операції
 */
export async function clearVerificationCache() {
  try {
    // Очищаємо за префіксами
    await clearCacheByPattern(CACHE_KEYS.VERIFICATION_PREFIX);
    await clearCacheByPattern(CACHE_KEYS.VERIFICATION_RESULT);
    await clearCacheByPattern(CACHE_KEYS.TASK_TYPE);

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
 * @returns {Promise<boolean>} Результат операції
 */
export async function loadProgressFromCache(store) {
  try {
    if (!store) return false;

    // Завантажуємо прогрес
    const savedProgress = await getFromCache(CACHE_KEYS.USER_PROGRESS);
    if (savedProgress && typeof savedProgress === 'object') {
      store.userProgress = savedProgress;
    }

    // Завантажуємо активну вкладку
    const activeTab = await getFromCache(CACHE_KEYS.ACTIVE_TAB);
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
 * @returns {Promise<boolean>} Результат операції
 */
export async function clearCacheByTags(tags) {
  try {
    if (Array.isArray(tags)) {
      // Очищаємо кеш для кожного тегу
      for (const tag of tags) {
        await clearCacheByPattern(tag);
      }
    } else {
      await clearCacheByPattern(tags);
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