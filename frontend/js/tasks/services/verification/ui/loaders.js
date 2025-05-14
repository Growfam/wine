/**
 * Управління індикаторами завантаження для верифікації
 *
 * Інтегрує спільні UI-компоненти для роботи з індикаторами завантаження
 */

import {
  showLoadingIndicator,
  hideLoadingIndicator,
  showVerificationMessage
} from '../../../utils/ui/';

/**
 * Налаштування UI обробників для сервісу верифікації
 * @param {Object} verificationCore - Ядро сервісу верифікації
 */
export function setupUIHandlers(verificationCore) {
  // Додаємо методи для роботи з UI
  verificationCore.showVerificationLoader = showVerificationLoader;
  verificationCore.hideVerificationLoader = hideVerificationLoader;
  verificationCore.showVerificationMessage = showVerificationStatusMessage;
}

/**
 * Показати індикатор завантаження верифікації
 * @param {string} taskId - ID завдання
 */
export function showVerificationLoader(taskId) {
  // Використовуємо спільну утиліту
  showLoadingIndicator(taskId);
}

/**
 * Приховати індикатор завантаження верифікації
 * @param {string} taskId - ID завдання
 */
export function hideVerificationLoader(taskId) {
  // Використовуємо спільну утиліту
  hideLoadingIndicator(taskId);
}

/**
 * Показати повідомлення про результат верифікації
 * @param {string} taskId - ID завдання
 * @param {Object} result - Результат верифікації
 * @param {boolean} [autoHide=true] - Чи автоматично приховувати повідомлення
 */
export function showVerificationStatusMessage(taskId, result, autoHide = true) {
  // Використовуємо спільну утиліту
  showVerificationMessage(taskId, result, autoHide);
}