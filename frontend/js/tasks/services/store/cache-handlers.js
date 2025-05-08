/**
 * Обробники кешування для сховища
 *
 * Інтегрує спільний адаптер кешування для роботи зі сховищем завдань
 */

import {
  saveToCache,
  getFromCache,
  removeFromCache,
  clearCacheByTags
} from '../../utils/cache/index.js';

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
    // Якщо передано екземпляр сховища
    if (typeof store === 'object' && store !== null) {
      // Завантажуємо прогрес
      const savedProgress = getFromCache(store.CACHE_KEYS.USER_PROGRESS);
      if (savedProgress && typeof savedProgress === 'object') {
        store.userProgress = savedProgress;
      }

      // Завантажуємо активну вкладку
      const activeTab = getFromCache(store.CACHE_KEYS.ACTIVE_TAB);
      if (activeTab && Object.values(store.TASK_TYPES || {}).includes(activeTab)) {
        store.systemState.activeTabType = activeTab;
      }

      return true;
    }
    // Якщо передано ключ кешу
    else if (typeof store === 'string') {
      return getFromCache(store) || defaultValue;
    }

    return defaultValue;
  } catch (error) {
    console.warn('Помилка завантаження даних з кешу:', error);
    return defaultValue;
  }
}

/**
 * Очищення кешу за тегами
 * @param {string|Array} tags - Теги для очищення
 * @returns {boolean} Результат операції
 */
export function clearCacheByTagsHandler(tags) {
  return clearCacheByTags(tags);
}