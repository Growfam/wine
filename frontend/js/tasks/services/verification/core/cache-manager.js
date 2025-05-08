/**
 * Менеджер кешування для верифікації
 *
 * Інтегрує спільний адаптер кешування для роботи з результатами верифікації
 */

import {
  cacheTaskType as cacheType,
  getCachedTaskType as getType,
  cacheVerificationResult as cacheResult,
  getCachedVerificationResult as getResult,
  clearVerificationCache as clearCache
} from '../../../utils/cache/index.js';

/**
 * Налаштування менеджера кешування для сервісу верифікації
 * @param {Object} verificationCore - Ядро сервісу верифікації
 */
export function setupCacheManager(verificationCore) {
  // Додаємо методи кешування до ядра сервісу
  verificationCore.cacheTaskType = cacheTaskType;
  verificationCore.getCachedTaskType = getCachedTaskType;
  verificationCore.cacheResult = cacheVerificationResult;
  verificationCore.getCachedResult = getCachedVerificationResult;
  verificationCore.clearCache = clearVerificationCache;
}

/**
 * Кешування типу завдання
 * @param {string} taskId - ID завдання
 * @param {string} type - Тип завдання
 */
export function cacheTaskType(taskId, type) {
  // Використовуємо спільну утиліту
  cacheType(taskId, type);
}

/**
 * Отримання кешованого типу завдання
 * @param {string} taskId - ID завдання
 * @returns {string|null} Тип завдання
 */
export function getCachedTaskType(taskId) {
  // Використовуємо спільну утиліту
  return getType(taskId);
}

/**
 * Кешування результату верифікації
 * @param {string} taskId - ID завдання
 * @param {Object} result - Результат перевірки
 */
export function cacheVerificationResult(taskId, result) {
  // Використовуємо спільну утиліту
  cacheResult(taskId, result);
}

/**
 * Отримання кешованого результату
 * @param {string} taskId - ID завдання
 * @returns {Object|null} Кешований результат
 */
export function getCachedVerificationResult(taskId) {
  // Використовуємо спільну утиліту
  return getResult(taskId);
}

/**
 * Очищення кешу верифікації
 */
export function clearVerificationCache() {
  // Використовуємо спільну утиліту
  clearCache();
}