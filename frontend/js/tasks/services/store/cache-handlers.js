/**
 * Обробники кешування для сховища
 *
 * Надає функції для завантаження та збереження даних у кеш
 */

// ВИПРАВЛЕНО: Імпортуємо CacheService з правильного місця
import cacheService from '../../api/core/cache.js';

/**
 * Налаштування обробників кешування для сховища
 * @param {Object} store - Екземпляр сховища
 */
export function setupCacheHandlers(store) {
  // Додаємо обробники для автоматичного збереження даних у кеш
  store.subscribe((action) => {
    if (action === 'all-progress-updated' || action === 'progress-updated') {
      saveToCache(store.CACHE_KEYS.USER_PROGRESS, store.userProgress);
    }

    if (action === 'tab-switched') {
      saveToCache(store.CACHE_KEYS.ACTIVE_TAB, store.systemState.activeTabType);
    }
  });
}

/**
 * Завантаження даних з кешу
 * @param {Object} store - Екземпляр сховища або ключ кешу
 * @param {string} [defaultValue={}] - Значення за замовчуванням
 * @returns {*} Дані з кешу або значення за замовчуванням
 */
export function loadFromCache(store, defaultValue = {}) {
  try {
    // ВИПРАВЛЕНО: Використовуємо імпортований сервіс кешування
    // Якщо передано екземпляр сховища
    if (typeof store === 'object' && store !== null) {
      // Завантажуємо прогрес
      const savedProgress = cacheService.getCachedData(store.CACHE_KEYS.USER_PROGRESS);
      if (savedProgress && typeof savedProgress === 'object') {
        store.userProgress = savedProgress;
      }

      // Завантажуємо активну вкладку
      const activeTab = cacheService.getCachedData(store.CACHE_KEYS.ACTIVE_TAB);
      if (activeTab && Object.values(store.TASK_TYPES || {}).includes(activeTab)) {
        store.systemState.activeTabType = activeTab;
      }

      return true;
    }
    // Якщо передано ключ кешу
    else if (typeof store === 'string') {
      return cacheService.getCachedData(store) || defaultValue;
    }

    return defaultValue;
  } catch (error) {
    console.warn('Помилка завантаження даних з кешу:', error);
    return defaultValue;
  }
}

/**
 * Збереження даних у кеш
 * @param {string} key - Ключ кешу
 * @param {*} value - Значення для збереження
 * @param {Object} [options={}] - Додаткові опції
 * @returns {boolean} Результат операції
 */
export function saveToCache(key, value, options = {}) {
  try {
    // ВИПРАВЛЕНО: Використовуємо правильний метод cacheData
    cacheService.cacheData(key, value);
    return true;
  } catch (error) {
    console.warn('Помилка збереження даних у кеш:', error);
    return false;
  }
}

/**
 * Видалення даних з кешу
 * @param {string} key - Ключ кешу
 * @returns {boolean} Результат операції
 */
export function removeFromCache(key) {
  try {
    // ВИПРАВЛЕНО: Використовуємо CacheService
    // Перевіряємо, чи є в CacheService метод для видалення
    if (typeof cacheService.clearCache === 'function') {
      cacheService.clearCache(key);
      return true;
    }
    return false;
  } catch (error) {
    console.warn('Помилка видалення даних з кешу:', error);
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
    // ВИПРАВЛЕНО: Використовуємо clearCache з тегами або патерном
    if (typeof cacheService.clearCache === 'function') {
      if (Array.isArray(tags)) {
        // Очищаємо кеш для кожного тегу окремо
        tags.forEach(tag => cacheService.clearCache(tag));
      } else {
        cacheService.clearCache(tags);
      }
      return true;
    }
    return false;
  } catch (error) {
    console.warn('Помилка очищення кешу за тегами:', error);
    return false;
  }
}