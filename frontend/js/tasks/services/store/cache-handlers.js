/**
 * Обробники кешування для сховища
 *
 * Надає функції для завантаження та збереження даних у кеш
 */

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
    const cacheService = window.cacheService || { get: () => null };

    // Якщо передано екземпляр сховища
    if (typeof store === 'object' && store !== null) {
      // Завантажуємо прогрес
      const savedProgress = cacheService.get(store.CACHE_KEYS.USER_PROGRESS, {});
      if (savedProgress && typeof savedProgress === 'object') {
        store.userProgress = savedProgress;
      }

      // Завантажуємо активну вкладку
      const activeTab = cacheService.get(store.CACHE_KEYS.ACTIVE_TAB);
      if (activeTab && Object.values(store.TASK_TYPES || {}).includes(activeTab)) {
        store.systemState.activeTabType = activeTab;
      }

      return true;
    }
    // Якщо передано ключ кешу
    else if (typeof store === 'string') {
      return cacheService.get(store, defaultValue);
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
    const cacheService = window.cacheService || { set: () => false };
    return cacheService.set(key, value, options);
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
    const cacheService = window.cacheService || { remove: () => false };
    return cacheService.remove(key);
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
    const cacheService = window.cacheService || { removeByTags: () => false };
    return cacheService.removeByTags(tags);
  } catch (error) {
    console.warn('Помилка очищення кешу за тегами:', error);
    return false;
  }
}
