                        /**
 * Адаптер для зворотної сумісності з task-storage.js
 *
 * Цей файл забезпечує сумісність з кодом, що використовує старий API task-storage.js.
 * Всі виклики перенаправляються до нового CacheService.js.
 *
 * @version 1.0.0
 */

import cacheService from './CacheService.js';

/**
 * Збереження даних у сховище
 * @param {string} key - Ключ
 * @param {any} value - Значення
 * @param {Object} options - Додаткові параметри
 * @returns {boolean} Успішність операції
 */
export function setItem(key, value, options = {}) {
  return cacheService.setItem(key, value, options);
}

/**
 * Отримання даних зі сховища
 * @param {string} key - Ключ
 * @param {any} defaultValue - Значення за замовчуванням
 * @param {Object} options - Додаткові параметри
 * @returns {any} Збережене значення або значення за замовчуванням
 */
export function getItem(key, defaultValue = null, options = {}) {
  return cacheService.getItem(key, defaultValue, options);
}

/**
 * Видалення даних зі сховища
 * @param {string} key - Ключ
 * @param {Object} options - Додаткові параметри
 * @returns {boolean} Успішність операції
 */
export function removeItem(key, options = {}) {
  return cacheService.removeItem(key, options);
}

/**
 * Очищення сховища
 * @param {Object} options - Опції очищення
 * @returns {boolean} Успішність операції
 */
export function clear(options = {}) {
  return cacheService.clear(options);
}

/**
 * Отримання всіх ключів
 * @param {Object} options - Опції
 * @returns {Array} Список ключів
 */
export function getKeys(options = {}) {
  return cacheService.getKeys(options);
}

/**
 * Оновлення конфігурації
 * @param {Object} newConfig - Нова конфігурація
 * @returns {Object} Поточна конфігурація
 */
export function updateConfig(newConfig) {
  return cacheService.updateConfig(newConfig);
}

/**
 * Отримання поточної конфігурації
 * @returns {Object} Поточна конфігурація
 */
export function getConfig() {
  return cacheService.getConfig();
}

// Експортуємо об'єкт за замовчуванням для зворотної сумісності
export default {
  setItem,
  getItem,
  removeItem,
  clear,
  getKeys,
  updateConfig,
  getConfig
};