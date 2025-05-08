/**
 * Експорт UI компонентів та утиліт
 *
 * Цей модуль надає функції для управління інтерфейсом користувача
 * у контексті системи завдань.
 */

// Експорт функцій для роботи з індикаторами завантаження
export {
  showLoadingIndicator,
  hideLoadingIndicator,
  showVerificationMessage,
  updateProgressUI,
  showVerificationLoader,
  hideVerificationLoader
} from './loaders.js';

// Експорт за замовчуванням
export default {
  showLoadingIndicator,
  hideLoadingIndicator,
  showVerificationMessage,
  updateProgressUI,
  showVerificationLoader,
  hideVerificationLoader
};