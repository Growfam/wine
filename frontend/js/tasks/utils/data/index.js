/**
 * Точка входу для модуля обробки даних
 *
 * Експортує основні функції для роботи з даними,
 * кешуванням та форматуванням.
 *
 * @version 2.0.0
 */

// Імпорт компонентів
import formatter from './formatter.js';
import * as formatterExports from './formatter.js';
import cache from './cache/index.js';
import * as cacheExports from './cache/index.js';

// Експорт форматтера
export const {
  formatNumber,
  formatCurrency,
  formatText,
  formatDateForApi,
  formatJson,
  formatFileSize,
  prepareDataForApi,
  processApiResponse,
  configureApiFormatter,
  detectFieldType,
  parseDate,
} = formatter;

// Експорт кешу
export const {
  set: cacheSet,
  get: cacheGet,
  remove: cacheRemove,
  has: cacheHas,
  clear: cacheClear,
  removeByTags: cacheRemoveByTags,
  getStats: cacheGetStats,
  cleanup: cacheCleanup,
  updateConfig: cacheUpdateConfig,
  CACHE_TAGS,
  STORAGE_TYPES,
} = cache;

// Експортуємо повні модулі
export const Cache = cache;
export const Formatter = formatter;

// Експорт за замовчуванням
export default {
  // Форматтер
  ...formatter,

  // Кеш з перейменованими функціями для уникнення конфліктів
  cache: {
    ...cache,
    // Перейменовані методи для зручності
    set: cache.set,
    get: cache.get,
    remove: cache.remove,
    has: cache.has,
    clear: cache.clear,
    removeByTags: cache.removeByTags,
    getStats: cache.getStats,
    cleanup: cache.cleanup,
    updateConfig: cache.updateConfig,
  },

  // Повні модулі
  Cache,
  Formatter,
};
