/**
 * Dialog - модуль для роботи з діалоговими вікнами
 * Відповідає за:
 * - Показ діалогових вікон підтвердження
 * - Обробку взаємодії з діалогами
 * - Адаптивне відображення на різних пристроях
 *
 * @version 3.0.0
 */

import { getLogger, LOG_CATEGORIES } from '../../utils/core/logger.js';
// Створюємо логер для модуля
const logger = getLogger('UI.Dialog');

// Імпортуємо спільні налаштування
import { CONFIG, injectStyles } from './common.js';

// Стан модуля
const state = {
  confirmDialogId: 'confirm-dialog', // ID діалогу підтвердження
};

/**
 * Ініціалізація модуля діалогових вікон
 */
export function init() {
  logger.info('Ініціалізація модуля діалогів', 'init', {
    category: LOG_CATEGORIES.INIT,
  });

  // Додаємо стилі тільки один раз
  injectStyles();

  // Додаємо обробник для клавіші Escape
  document.addEventListener('keydown', handleEscapeKey);
}

/**
 * Обробка натискання клавіші Escape
 * @param {KeyboardEvent} event - Подія клавіатури
 */
function handleEscapeKey(event) {
  if (event.key === 'Escape') {
    // Закриваємо активні діалоги
    const confirmDialog = document.getElementById(state.confirmDialogId);
    if (confirmDialog && confirmDialog.classList.contains('show')) {
      confirmDialog.classList.remove('show');
      event.preventDefault();

      logger.info('Закрито діалог підтвердження за допомогою Escape', 'handleEscapeKey', {
        category: LOG_CATEGORIES.UI,
      });
    }
  }
}

/**
 * Показ діалогового вікна з підтвердженням (оптимізовано)
 * @param {Object|string} options - Опції діалогу або повідомлення
 * @param {Function} confirmCallback - Функція при підтвердженні
 * @param {Function} cancelCallback - Функція при скасуванні
 * @returns {Promise<boolean>} Результат вибору користувача
 */
export function showConfirmDialog(options, confirmCallback, cancelCallback) {
  // Підтримка обох форматів виклику
  if (typeof options === 'string') {
    if (confirmCallback || cancelCallback) {
      // Старий формат з окремими callback'ами
      return new Promise((resolve) => {
        internalShowConfirmDialog(
          {
            message: options,
            title: 'Підтвердження',
            confirmText: 'Підтвердити',
            cancelText: 'Скасувати',
            type: 'default',
            iconType: 'warning',
          },
          (result) => {
            if (result && confirmCallback) confirmCallback();
            if (!result && cancelCallback) cancelCallback();
            resolve(result);
          }
        );
      });
    } else {
      // Простий виклик з повідомленням
      return internalShowConfirmDialog({
        message: options,
        title: 'Підтвердження',
        confirmText: 'Підтвердити',
        cancelText: 'Скасувати',
        type: 'default',
        iconType: 'warning',
      });
    }
  } else {
    // Повний формат з опціями
    return internalShowConfirmDialog(options);
  }
}

/**
 * Внутрішня реалізація діалогу підтвердження
 * @param {Object} options - Опції діалогу
 * @param {Function} callback - Функція зворотного виклику
 * @returns {Promise<boolean>} Результат вибору користувача
 */
function internalShowConfirmDialog(options, callback = null) {
  // Налаштування за замовчуванням
  const {
    message,
    title = 'Підтвердження',
    confirmText = 'Підтвердити',
    cancelText = 'Скасувати',
    type = 'default',
    iconType = 'warning',
  } = options;

  logger.info('Показ діалогу підтвердження', 'showConfirmDialog', {
    category: LOG_CATEGORIES.UI,
    details: { title, type, iconType },
  });

  return new Promise((resolve) => {
    try {
      // Приховуємо інші діалоги
      hideAllDialogs();

      // Створюємо діалог, якщо його немає
      let confirmOverlay = document.getElementById(state.confirmDialogId);

      if (!confirmOverlay) {
        confirmOverlay = document.createElement('div');
        confirmOverlay.id = state.confirmDialogId;
        confirmOverlay.className = 'confirm-overlay';

        const dialog = document.createElement('div');
        dialog.className = 'confirm-dialog';

        confirmOverlay.appendChild(dialog);
        document.body.appendChild(confirmOverlay);
      }

      // Отримуємо контейнер діалогу
      const dialog = confirmOverlay.querySelector('.confirm-dialog');

      // Оновлюємо вміст діалогу
      dialog.innerHTML = `
                <div class="confirm-title">${title}</div>
                <div class="confirm-message">${message}</div>
                <div class="confirm-buttons">
                    <button class="confirm-button confirm-button-cancel" id="confirm-cancel-button">${cancelText}</button>
                    <button class="confirm-button confirm-button-${type === 'danger' ? 'danger' : 'confirm'}" id="confirm-yes-button">${confirmText}</button>
                </div>
            `;

      // Додаємо обробники на кнопки
      const cancelBtn = dialog.querySelector('#confirm-cancel-button');
      const confirmBtn = dialog.querySelector('#confirm-yes-button');

      cancelBtn.onclick = function () {
        confirmOverlay.classList.remove('show');
        setTimeout(() => {
          const result = false;

          logger.info('Діалог скасовано користувачем', 'confirmDialog.cancel', {
            category: LOG_CATEGORIES.UI,
          });

          if (callback) callback(result);
          resolve(result);
        }, CONFIG.animationDuration);
      };

      confirmBtn.onclick = function () {
        confirmOverlay.classList.remove('show');
        setTimeout(() => {
          const result = true;

          logger.info('Діалог підтверджено користувачем', 'confirmDialog.confirm', {
            category: LOG_CATEGORIES.UI,
          });

          if (callback) callback(result);
          resolve(result);
        }, CONFIG.animationDuration);
      };

      // Показуємо діалог
      confirmOverlay.classList.add('show');
    } catch (e) {
      logger.error(e, 'Помилка показу діалогу підтвердження', {
        category: LOG_CATEGORIES.UI,
        details: { message },
      });

      // Використовуємо стандартний confirm як запасний варіант
      const result = confirm(message);
      if (callback) callback(result);
      resolve(result);
    }
  });
}

/**
 * Приховання всіх активних діалогів
 */
export function hideAllDialogs() {
  const existingDialogs = document.querySelectorAll('.confirm-overlay');
  existingDialogs.forEach((dialog) => {
    if (dialog.id !== state.confirmDialogId) {
      dialog.classList.remove('show');

      logger.debug('Приховано існуючий діалог', 'hideAllDialogs', {
        category: LOG_CATEGORIES.UI,
        details: { dialogId: dialog.id },
      });
    }
  });
}

/**
 * Очищення ресурсів модуля
 */
export function cleanup() {
  // Видаляємо обробник Escape
  document.removeEventListener('keydown', handleEscapeKey);

  // Приховуємо всі діалоги
  hideAllDialogs();

  logger.info('Ресурси модуля діалогів очищено', 'cleanup', {
    category: LOG_CATEGORIES.LOGIC,
  });
}

export default {
  init,
  showConfirmDialog,
  hideAllDialogs,
  cleanup,
};
