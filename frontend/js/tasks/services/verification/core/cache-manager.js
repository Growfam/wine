/**
 * Менеджер кешування для верифікації
 *
 * Функції для роботи з кешем результатів верифікації
 */

// Ключі для кешу
const CACHE_KEYS = {
  VERIFICATION_PREFIX: 'verification_',
  VERIFICATION_RESULT: 'verification_result_',
  TASK_TYPE: 'task_type_',
};

// Теги для кешу
const CACHE_TAGS = {
  VERIFICATION: 'verification',
  TASK: 'task',
  RESULT: 'result',
  SOCIAL: 'social',
  LIMITED: 'limited',
  PARTNER: 'partner',
};

/**
 * Налаштування менеджера кешування для сервісу верифікації
 * @param {Object} verificationCore - Ядро сервісу верифікації
 */
export function setupCacheManager(verificationCore) {
  // Додаємо методи кешування до ядра сервісу
  verificationCore.cacheTaskType = cacheTaskType;
  verificationCore.getCachedTaskType = getCachedTaskType;
  verificationCore.cacheResult = cacheResult;
  verificationCore.getCachedResult = getCachedResult;
  verificationCore.clearCache = clearCache;
}

/**
 * Кешування типу завдання
 * @param {string} taskId - ID завдання
 * @param {string} type - Тип завдання
 */
export function cacheTaskType(taskId, type) {
  try {
    const cacheService = window.cacheService || { set: () => {} };
    cacheService.set(`${CACHE_KEYS.TASK_TYPE}${taskId}`, type, {
      tags: [CACHE_TAGS.TASK, 'type'],
    });
  } catch (error) {
    console.warn(`Помилка кешування типу завдання ${taskId}:`, error);
  }
}

/**
 * Отримання кешованого типу завдання
 * @param {string} taskId - ID завдання
 * @returns {string|null} Тип завдання
 */
export function getCachedTaskType(taskId) {
  try {
    const cacheService = window.cacheService || { get: () => null };
    return cacheService.get(`${CACHE_KEYS.TASK_TYPE}${taskId}`);
  } catch (error) {
    console.warn(`Помилка отримання кешованого типу завдання ${taskId}:`, error);
    return null;
  }
}

/**
 * Кешування результату верифікації
 * @param {string} taskId - ID завдання
 * @param {Object} result - Результат перевірки
 */
export function cacheResult(taskId, result) {
  try {
    const cacheService = window.cacheService || { set: () => {} };
    const cacheTTL = this.config ? this.config.cacheTTL : 60000;

    // Визначаємо теги для кешу
    const taskType = this.getTaskType ? this.getTaskType(taskId) : null;
    const tags = [CACHE_TAGS.VERIFICATION, CACHE_TAGS.RESULT];

    // Додаємо тег типу завдання
    if (taskType === 'social') {
      tags.push(CACHE_TAGS.SOCIAL);
    } else if (taskType === 'limited') {
      tags.push(CACHE_TAGS.LIMITED);
    } else if (taskType === 'partner') {
      tags.push(CACHE_TAGS.PARTNER);
    }

    // Визначаємо час життя кешу в залежності від статусу
    let ttl = cacheTTL; // За замовчуванням

    // Для успішних результатів - довший час життя
    if (result.success) {
      ttl = cacheTTL * 2; // Подвоюємо час
    } else if (result.status === 'failure') {
      ttl = Math.min(cacheTTL, 300000); // Максимум 5 хвилин для помилок
    }

    // Зберігаємо результат в кеш
    cacheService.set(`${CACHE_KEYS.VERIFICATION_RESULT}${taskId}`, result, {
      ttl: ttl,
      tags,
    });
  } catch (error) {
    console.warn(`Помилка кешування результату для завдання ${taskId}:`, error);
  }
}

/**
 * Отримання кешованого результату
 * @param {string} taskId - ID завдання
 * @returns {Object|null} Кешований результат
 */
export function getCachedResult(taskId) {
  try {
    const cacheService = window.cacheService || { get: () => null };
    return cacheService.get(`${CACHE_KEYS.VERIFICATION_RESULT}${taskId}`);
  } catch (error) {
    console.warn(`Помилка отримання кешу для завдання ${taskId}:`, error);
    return null;
  }
}

/**
 * Очищення кешу верифікації
 */
export function clearCache() {
  try {
    const cacheService = window.cacheService || { removeByTags: () => {} };

    // Видаляємо всі кешовані дані верифікації
    cacheService.removeByTags(CACHE_TAGS.VERIFICATION);
    console.info('Кеш верифікації очищено');
  } catch (error) {
    console.error('Помилка очищення кешу верифікації:', error);
  }
}
