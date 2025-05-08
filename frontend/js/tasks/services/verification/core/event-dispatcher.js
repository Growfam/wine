/**
 * Диспетчер подій верифікації
 *
 * Відповідає за генерацію подій про результати верифікації
 */

import { taskStore } from '../../index';

/**
 * Налаштування диспетчера подій для сервісу верифікації
 * @param {Object} verificationCore - Ядро сервісу верифікації
 */
export function setupEventDispatcher(verificationCore) {
  // Додаємо методи для роботи з подіями
  verificationCore.dispatchVerificationEvent = dispatchVerificationEvent.bind(verificationCore);

  // Встановлюємо обробники подій
  setupEventListeners();
}

/**
 * Встановлення обробників подій
 */
function setupEventListeners() {
  // Обробник події результату верифікації
  document.addEventListener('task-verification-result', (event) => {
    const { taskId, result } = event.detail;

    // Якщо верифікація успішна, оновлюємо статус завдання
    if (result.success) {
      const task = taskStore.findTaskById(taskId);
      if (task) {
        taskStore.updateTask(taskId, { status: 'completed' });
      }
    }
  });
}

/**
 * Відправлення події про результат верифікації
 * @param {string} taskId - ID завдання
 * @param {Object} result - Результат перевірки
 * @param {string} eventId - Унікальний ідентифікатор події
 */
export function dispatchVerificationEvent(taskId, result, eventId) {
  try {
    // Перевіряємо, чи не був цей eventId вже оброблений
    if (eventId && this.state.processedEvents[eventId]) {
      console.info(`Подія ${eventId} вже була оброблена`);
      return;
    }

    // Зберігаємо ідентифікатор події як оброблений
    if (eventId) {
      this.state.processedEvents[eventId] = Date.now();

      // Кешуємо оброблені події
      const cacheService = window.cacheService || { set: () => {} };
      cacheService.set(
        `processed_event_${eventId}`,
        {
          taskId,
          timestamp: Date.now(),
        },
        {
          ttl: 3600000, // 1 година
          tags: ['verification', 'events'],
        }
      );
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

    // Якщо верифікація була успішною
    if (result.success) {
      // Викликаємо обробку успішної верифікації
      this.handleSuccessfulVerification(taskId, result, eventId);
    }
  } catch (error) {
    console.error(`Помилка відправки події верифікації для завдання ${taskId}:`, error);
  }
}

/**
 * Обробка успішної верифікації
 * @param {string} taskId - ID завдання
 * @param {Object} result - Результат перевірки
 * @param {string} eventId - Унікальний ідентифікатор події
 */
export function handleSuccessfulVerification(taskId, result, eventId) {
  try {
    // Отримуємо цільове значення завдання
    const targetValue = this.getTaskTargetValue(taskId);

    // Оновлюємо прогрес у сховищі
    try {
      taskStore.setTaskProgress(taskId, {
        status: 'completed',
        progress_value: targetValue,
        completion_date: new Date().toISOString(),
      });
    } catch (storeError) {
      console.error(`Помилка оновлення прогресу для завдання ${taskId}:`, storeError);
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
      } catch (eventError) {
        console.error(`Помилка відправки події завершення завдання ${taskId}:`, eventError);
      }
    }, 50);
  } catch (error) {
    console.error(`Помилка обробки успішної верифікації для завдання ${taskId}:`, error);
  }
}
