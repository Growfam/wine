/**
 * Диспетчер подій верифікації
 *
 * Відповідає за:
 * - Генерацію та відправку подій про результати верифікації
 * - Відстеження оброблених подій
 * - Обробку успішних результатів верифікації
 */

import { getLogger } from 'js/tasks/utils/core/logger.js';
import { cacheProcessedEvent, isEventProcessed } from 'js/tasks/services/verification/core/cache-manager.js';

// Створюємо логер для модуля
const logger = getLogger('VerificationEvents');

/**
 * Зберігання стану оброблених подій
 */
const eventState = {
  processedEvents: new Map(),
};

/**
 * Відправлення події про результат верифікації
 * @param {string} taskId - ID завдання
 * @param {Object} result - Результат перевірки
 * @param {string} eventId - Унікальний ідентифікатор події
 * @param {Object} taskStore - Сховище завдань
 */
export function dispatchVerificationEvent(taskId, result, eventId, taskStore) {
  try {
    // Перевіряємо, чи не був цей eventId вже оброблений
    if (eventId) {
      if (isEventProcessed(eventId) || eventState.processedEvents.has(eventId)) {
        logger.info(`Подія ${eventId} вже була оброблена`, 'dispatchVerificationEvent');
        return;
      }

      // Зберігаємо ідентифікатор події як оброблений
      eventState.processedEvents.set(eventId, Date.now());

      // Кешуємо оброблену подію
      cacheProcessedEvent(eventId, {
        taskId,
        timestamp: Date.now(),
      });
    }

    // Додаємо таймстамп до результату
    result.timestamp = Date.now();

    // Відправляємо подію про результат верифікації
    document.dispatchEvent(
      new CustomEvent('task-verification-result', {
        detail: {
          taskId,
          result,
          timestamp: Date.now(),
          eventId,
        },
      })
    );

    logger.debug(`Відправлено подію верифікації для завдання ${taskId}`, 'dispatchVerificationEvent');

    // Якщо верифікація була успішною
    if (result.success) {
      // Викликаємо обробку успішної верифікації
      handleSuccessfulVerification(taskId, result, eventId, taskStore);
    }
  } catch (error) {
    logger.error(`Помилка відправки події верифікації для завдання ${taskId}:`, error);
  }
}

/**
 * Обробка успішної верифікації
 * @param {string} taskId - ID завдання
 * @param {Object} result - Результат перевірки
 * @param {string} eventId - Унікальний ідентифікатор події
 * @param {Object} taskStore - Сховище завдань
 */
export function handleSuccessfulVerification(taskId, result, eventId, taskStore) {
  try {
    // Отримуємо цільове значення завдання
    const targetValue = getTaskTargetValue(taskId, taskStore);

    // Оновлюємо прогрес у сховищі
    try {
      if (taskStore && typeof taskStore.setTaskProgress === 'function') {
        taskStore.setTaskProgress(taskId, {
          status: 'completed',
          progress_value: targetValue,
          completion_date: new Date().toISOString(),
        });
      }
    } catch (storeError) {
      logger.error(`Помилка оновлення прогресу для завдання ${taskId}:`, storeError);
    }

    // Затримка перед відправкою події завершення завдання
    setTimeout(() => {
      try {
        // Відправляємо подію про завершення завдання
        document.dispatchEvent(
          new CustomEvent('task-completed', {
            detail: {
              taskId,
              reward: result.reward,
              timestamp: Date.now(),
              eventId,
            },
          })
        );

        logger.info(`Відправлено подію завершення для завдання ${taskId}`, 'handleSuccessfulVerification');
      } catch (eventError) {
        logger.error(`Помилка відправки події завершення завдання ${taskId}:`, eventError);
      }
    }, 50);
  } catch (error) {
    logger.error(`Помилка обробки успішної верифікації для завдання ${taskId}:`, error);
  }
}

/**
 * Отримання цільового значення завдання
 * @param {string} taskId - ID завдання
 * @param {Object} taskStore - Сховище завдань
 * @returns {number} Цільове значення
 */
function getTaskTargetValue(taskId, taskStore) {
  try {
    // Отримуємо дані завдання зі сховища, якщо воно доступне
    if (taskStore && typeof taskStore.findTaskById === 'function') {
      const task = taskStore.findTaskById(taskId);
      if (task && task.target_value) {
        return parseInt(task.target_value) || 1;
      }
    }

    // Перевіряємо прогрес
    if (taskStore && typeof taskStore.getTaskProgress === 'function') {
      const progress = taskStore.getTaskProgress(taskId);
      if (progress && progress.max_progress) {
        return parseInt(progress.max_progress) || 1;
      }
    }

    // Знаходимо елемент завдання
    const taskElement = document.querySelector(`.task-item[data-task-id="${taskId}"]`);
    if (taskElement) {
      // Пробуємо отримати цільове значення з атрибуту
      const targetAttr = taskElement.getAttribute('data-target-value');
      if (targetAttr) {
        return parseInt(targetAttr) || 1;
      }
    }

    return 1; // За замовчуванням
  } catch (error) {
    logger.error(`Помилка отримання цільового значення для завдання ${taskId}:`, error);
    return 1; // За замовчуванням у випадку помилки
  }
}

/**
 * Відправлення події про помилку верифікації
 * @param {string} taskId - ID завдання
 * @param {Object} error - Об'єкт помилки
 * @param {string} eventId - Унікальний ідентифікатор події
 */
export function dispatchVerificationErrorEvent(taskId, error, eventId) {
  try {
    // Створюємо подію з деталями помилки
    document.dispatchEvent(
      new CustomEvent('task-verification-error', {
        detail: {
          taskId,
          error,
          timestamp: Date.now(),
          eventId,
        },
      })
    );

    logger.warn(`Відправлено подію помилки верифікації для завдання ${taskId}`, 'dispatchVerificationErrorEvent');
  } catch (dispatchError) {
    logger.error(`Помилка відправки події помилки верифікації для завдання ${taskId}:`, dispatchError);
  }
}

/**
 * Очищення списку оброблених подій (видалення застарілих записів)
 * @returns {number} Кількість видалених записів
 */
export function clearExpiredProcessedEvents() {
  try {
    const now = Date.now();
    const oneHour = 60 * 60 * 1000;
    let clearedCount = 0;

    // Видаляємо записи, старші 1 години
    for (const [eventId, timestamp] of eventState.processedEvents.entries()) {
      if (now - timestamp > oneHour) {
        eventState.processedEvents.delete(eventId);
        clearedCount++;
      }
    }

    if (clearedCount > 0) {
      logger.debug(`Очищено ${clearedCount} застарілих оброблених подій`, 'clearExpiredProcessedEvents');
    }

    return clearedCount;
  } catch (error) {
    logger.error('Помилка очищення оброблених подій:', error);
    return 0;
  }
}

/**
 * Перевірка, чи подія була оброблена
 * @param {string} eventId - ID події
 * @returns {boolean} Чи подія була оброблена
 */
export function isProcessedEvent(eventId) {
  if (!eventId) return false;
  return eventState.processedEvents.has(eventId) || isEventProcessed(eventId);
}

/**
 * Реєстрація обробників подій верифікації
 */
export function setupVerificationEventHandlers() {
  try {
    // Обробник події результатів верифікації
    document.addEventListener('task-verification-result', (event) => {
      const { taskId, result } = event.detail;

      // Оновлюємо елементи UI відповідно до результату
      try {
        const taskElement = document.querySelector(`.task-item[data-task-id="${taskId}"]`);
        if (taskElement) {
          if (result.success) {
            // Для успішного результату
            taskElement.classList.add('completed');
            taskElement.classList.remove('failed');
          } else {
            // Для невдалого результату
            taskElement.classList.add('failed');
            taskElement.classList.remove('completed');
          }
        }
      } catch (uiError) {
        logger.warn(`Помилка оновлення UI для результату верифікації завдання ${taskId}:`, uiError);
      }
    });

    logger.info('Обробники подій верифікації зареєстровано', 'setupVerificationEventHandlers');
  } catch (error) {
    logger.error('Помилка реєстрації обробників подій верифікації:', error);
  }
}

/**
 * Функція для ініціалізації диспетчера подій
 * @param {Object} verificationCore - Основний модуль верифікації
 */
export function setupEventDispatcher(verificationCore) {
  // Реєстрація обробників подій
  setupVerificationEventHandlers();

  // Періодичне очищення застарілих подій
  const cleanupInterval = setInterval(() => {
    clearExpiredProcessedEvents();
  }, 1800000); // кожні 30 хвилин

  logger.info('Диспетчер подій верифікації ініціалізовано');

  return {
    clearInterval: () => clearInterval(cleanupInterval),
    dispatchEvent: dispatchVerificationEvent,
    dispatchErrorEvent: dispatchVerificationErrorEvent
  };
}

export default {
  dispatchVerificationEvent,
  handleSuccessfulVerification,
  dispatchVerificationErrorEvent,
  clearExpiredProcessedEvents,
  isProcessedEvent,
  setupVerificationEventHandlers,
  setupEventDispatcher
};