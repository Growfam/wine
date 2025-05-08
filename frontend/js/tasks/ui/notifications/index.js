/**
 * Notifications - централізований модуль для управління та відображення сповіщень
 * Точка входу для всіх типів сповіщень
 *
 * @version 3.0.0
 */

import { getLogger, LOG_CATEGORIES } from '../../utils';

// Створюємо логер для модуля
const logger = getLogger('UI.Notifications');

// Імпортуємо підмодулі
import toasts from './toast.js';
import dialog from './dialog.js';
import loading from './loading.js';
import { CONFIG, updateConfig } from './common.js';

/**
 * Ініціалізація модуля сповіщень
 * @param {Object} options - Налаштування
 */
export function init(options = {}) {
  // Оновлюємо конфігурацію модуля
  if (options && typeof options === 'object') {
    updateConfig(options);
  }

  logger.info('Ініціалізація модуля сповіщень', 'init', {
    category: LOG_CATEGORIES.INIT,
  });

  // Ініціалізуємо підмодулі
  toasts.init(options);
  dialog.init();
  loading.init();

  // Перевизначаємо глобальні функції для сумісності
  defineGlobalFunctions();

  logger.info('Модуль сповіщень успішно ініціалізовано', 'init', {
    category: LOG_CATEGORIES.INIT,
    details: { position: CONFIG.position, maxNotifications: CONFIG.maxNotifications },
  });
}

/**
 * Перевизначення глобальних функцій для сумісності
 */
function defineGlobalFunctions() {
  // Toast-повідомлення
  window.showToast = function (message, isError) {
    return isError ? showError(message) : showSuccess(message);
  };

  // Звичайні сповіщення
  window.showNotification = showInfo;

  // Індикатори завантаження
  window.showLoading = showLoading;
  window.hideLoading = hideLoading;

  // Діалоги підтвердження
  window.showModernConfirm = showConfirmDialog;

  logger.debug('Визначено глобальні функції для сумісності', 'defineGlobalFunctions', {
    category: LOG_CATEGORIES.INIT,
  });
}

/**
 * Очищення ресурсів модуля
 */
export function cleanup() {
  // Очищаємо ресурси підмодулів
  toasts.cleanup();
  dialog.cleanup();
  loading.cleanup();

  logger.info('Ресурси модуля сповіщень очищено', 'cleanup', {
    category: LOG_CATEGORIES.LOGIC,
  });
}

// Експортуємо методи з підмодулів для зручності
export const { showInfo, showSuccess, showError, showWarning, showNotification, updateBalanceUI } =
  toasts;

export const { showConfirmDialog, hideAllDialogs } = dialog;

export const { showLoading, hideLoading } = loading;

// Створюємо об'єкт для експорту за замовчуванням
const Notifications = {
  init,
  // Методи toast-повідомлень
  showInfo,
  showSuccess,
  showError,
  showWarning,
  showNotification,
  // Методи діалогових вікон
  showConfirmDialog,
  hideAllDialogs,
  // Методи індикаторів завантаження
  showLoading,
  hideLoading,
  // Оновлення балансу
  updateBalanceUI,
  // Очищення ресурсів
  cleanup,
};

// Для зворотної сумісності зі старим кодом
window.UI = window.UI || {};
window.UI.Notifications = Notifications;

// Експортуємо за замовчуванням
export default Notifications;
