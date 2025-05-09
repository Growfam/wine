/**
 * Експорт UI компонентів та утиліт
 *
 * Цей модуль надає функції для управління інтерфейсом користувача
 * у контексті системи завдань.
 */

// Імпорт функцій для роботи з індикаторами завантаження
import {
  showLoadingIndicator,
  hideLoadingIndicator,
  showVerificationMessage,
  updateProgressUI,
  showVerificationLoader,
  hideVerificationLoader
} from 'js/tasks/utils/ui/loaders.js';

// Явний експорт імпортованих функцій
export {
  showLoadingIndicator,
  hideLoadingIndicator,
  showVerificationMessage,
  updateProgressUI,
  showVerificationLoader,
  hideVerificationLoader
};

// Експорт за замовчуванням
export default {
  showLoadingIndicator,
  hideLoadingIndicator,
  showVerificationMessage,
  updateProgressUI,
  showVerificationLoader,
  hideVerificationLoader
};