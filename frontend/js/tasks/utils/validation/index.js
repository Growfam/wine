/**
 * Точка входу для модуля валідації
 *
 * Експортує основні функції для валідації даних та форм.
 *
 * @version 1.0.0
 */

// Імпорт компонентів
import coreValidation from './core.js';
import * as coreValidationExports from './core.js';
import rulesValidation from './rules.js';
import * as rulesValidationExports from './rules.js';
import formValidation from './form.js';
import * as formValidationExports from './form.js';

// Експорт функцій валідації даних з core
export const {
  validate,
  validateRequired,
  validatePattern,
  validateLength,
  validateEmail,
  validatePhone,
  validateUrl,
  validateNumber,
  validateInteger,
  validateMatch,
  validatePassword,
  validateCheckbox,
  validateDate,
  regexCache
} = coreValidation;

// Експорт спеціалізованих правил валідації з rules
export const {
  validateUsername,
  validatePersonName,
  validateEmailExtended,
  validateNistPassword,
  validateCreditCard,
  validateDateExtended,
  validateFile,
  validateAddress,
  validatePhoneExtended
} = rulesValidation;

// Експорт функцій валідації форм
export const {
  init: initFormValidation,
  cleanup: cleanupFormValidation,
  setupFormValidation,
  validateForm,
  validateField,
  updateConfig: updateFormConfig
} = formValidation;

/**
 * Єдина функція ініціалізації для всього модуля валідації
 * @param {Object} options - Опції ініціалізації
 */
export function init(options = {}) {
  // Налаштування для різних компонентів
  const {
    core = {},  // Налаштування для core
    form = {},  // Налаштування для form
    ...rest     // Загальні налаштування
  } = options;

  // Оновлюємо налаштування core
  coreValidation.updateConfig({
    ...rest,
    ...core
  });

  // Ініціалізуємо form
  formValidation.init({
    ...rest,
    ...form
  });
}

/**
 * Очищення всіх ресурсів модуля
 */
export function cleanup() {
  formValidation.cleanup();
}

// Експорт повних модулів
export const Core = coreValidation;
export const Rules = rulesValidation;
export const Form = formValidation;

// Експорт за замовчуванням
export default {
  // Загальні функції
  init,
  cleanup,

  // Функції Core
  ...coreValidation,

  // Функції Rules
  ...rulesValidation,

  // Функції Form з перейменуванням для уникнення конфліктів
  initFormValidation,
  cleanupFormValidation,
  setupFormValidation,
  validateForm,
  validateField,
  updateFormConfig,

  // Повні модулі
  Core,
  Rules,
  Form
};