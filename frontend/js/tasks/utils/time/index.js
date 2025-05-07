/**
 * Точка входу для модуля роботи з часом
 *
 * Експортує основні функції для роботи з датами,
 * форматуванням часу та таймерами.
 *
 * @version 1.0.0
 */

// Імпорт компонентів
import dateUtils from './date.js';
import * as dateExports from './date.js';
import formatUtils from './format.js';
import * as formatExports from './format.js';
import timerUtils from './timer.js';
import * as timerExports from './timer.js';

// Експорт функцій модуля date.js
export const {
  parseDate,
  isValidDate,
  isLeapYear,
  formatDateForApi,
  parseApiDate,
  getDateDifference,
  addPeriod,
  subtractPeriod,
  getUserTimezone,
  isDateInRange,
  getMonthDay
} = dateUtils;

// Експорт функцій модуля format.js
export const {
  formatDate,
  getRelativeTimeString,
  pluralize,
  formatTimeLeft,
  formatDuration,
  parseIsoDuration,
  formatIsoDuration
} = formatUtils;

// Експорт функцій модуля timer.js
export const {
  init: initTimers,
  cleanup: cleanupTimers,
  createCountdown,
  stopCountdown,
  stopAllCountdowns,
  getTimeLeft,
  isExpired,
  calculateUpdateFrequency,
  createSimpleCountdown
} = timerUtils;

/**
 * Єдина функція ініціалізації для всього модуля часу
 * @param {Object} options - Опції ініціалізації
 */
export function init(options = {}) {
  const {
    timers = {},  // Опції для таймерів
    ...rest       // Загальні опції
  } = options;

  // Оновлюємо конфігурацію дат
  if (Object.keys(rest).length > 0) {
    dateUtils.updateConfig(rest);
  }

  // Ініціалізуємо таймери
  timerUtils.init({
    ...rest,
    ...timers
  });
}

/**
 * Отримання поточної дати та часу
 * @param {Object} options - Опції форматування
 * @returns {string} Відформатована поточна дата
 */
export function now(options = {}) {
  const {
    format = 'datetime',
    ...formatOptions
  } = options;

  return formatDate(new Date(), format, formatOptions);
}

/**
 * Очищення всіх ресурсів модуля
 */
export function cleanup() {
  timerUtils.cleanup();
}

// Експорт повних модулів
export const DateUtils = dateUtils;
export const FormatUtils = formatUtils;
export const TimerUtils = timerUtils;

// Експорт за замовчуванням
export default {
  // Загальні функції
  init,
  cleanup,
  now,

  // Інтерфейс dateUtils
  ...dateUtils,

  // Інтерфейс formatUtils
  ...formatUtils,

  // Інтерфейс timerUtils (перейменовані для уникнення конфліктів)
  timer: {
    ...timerUtils,
    init: timerUtils.init,
    cleanup: timerUtils.cleanup
  },

  // Повні модулі
  DateUtils,
  FormatUtils,
  TimerUtils
};