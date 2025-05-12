/**
 * Експорт утиліт для роботи з кешем
 *
 * Надає єдиний інтерфейс для роботи з кешем у системі завдань
 */

// Експорт функцій для роботи з кешем
export {
  CACHE_KEYS,
  CACHE_TAGS,
  getFromCache,
  saveToCache,
  removeFromCache,
  clearCacheByPattern,
  cacheTaskType,
  getCachedTaskType,
  cacheVerificationResult,
  getCachedVerificationResult,
  clearVerificationCache,
  loadProgressFromCache,
  clearCacheByTags
} from './cache-adapter.js';

// Створюємо об'єкт для експорту за замовчуванням
const cacheApi = {
  // Константи
  KEYS: CACHE_KEYS,
  TAGS: CACHE_TAGS,

  // Базові операції з кешем
  get: getFromCache,
  save: saveToCache,
  remove: removeFromCache,
  clearByPattern: clearCacheByPattern,
  clearByTags: clearCacheByTags,

  // Робота з типами завдань
  cacheTaskType,
  getCachedTaskType,

  // Робота з результатами верифікації
  cacheVerificationResult,
  getCachedVerificationResult,
  clearVerification: clearVerificationCache,

  // Робота з прогресом
  loadProgress: loadProgressFromCache
};

// Експорт за замовчуванням
export default cacheApi;