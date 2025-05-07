/**
 * Точка входу для модуля кешування
 *
 * Експортує основні функції та компоненти для роботи з кешем.
 *
 * @version 2.0.0
 */

import cacheCore, { CACHE_TAGS } from './core.js';
import { StorageAdapter, STORAGE_TYPES, storageCompat } from './storage.js';

// Експорт для зручного імпорту
export {
  CACHE_TAGS,
  StorageAdapter,
  STORAGE_TYPES,
  storageCompat
};

// Створюємо та експортуємо зручні методи для роботи з кешем
export const set = (key, value, options) => cacheCore.set(key, value, options);
export const get = (key, defaultValue, options) => cacheCore.get(key, defaultValue, options);
export const remove = (key) => cacheCore.remove(key);
export const has = (key, checkExpiry) => cacheCore.has(key, checkExpiry);
export const clear = (options) => cacheCore.clear(options);
export const removeByTags = (tags, matchAll) => cacheCore.removeByTags(tags, matchAll);
export const getStats = () => cacheCore.getStats();
export const cleanup = (force) => cacheCore.cleanup(force);
export const updateConfig = (newConfig) => cacheCore.updateConfig(newConfig);

// Експорт за замовчуванням
export default {
  // Основні методи
  set,
  get,
  remove,
  has,
  clear,
  removeByTags,
  getStats,
  cleanup,
  updateConfig,

  // Константи
  CACHE_TAGS,
  STORAGE_TYPES,

  // Компоненти
  core: cacheCore,
  StorageAdapter,
  storageCompat
};