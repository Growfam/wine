/**
 * Контролер інтерфейсу для верифікації
 *
 * Відповідає за:
 * - Показ/приховування індикаторів завантаження
 * - Оновлення інтерфейсу при різних станах верифікації
 * - Показ повідомлень про результати верифікації
 */

import { getLogger } from '../../../utils/core/logger.js';

// Створюємо логер для модуля
const logger = getLogger('VerificationUI');

/**
 * Показати індикатор завантаження для елемента завдання
 * @param {string} taskId - ID завдання
 */
export function showVerificationLoader(taskId) {
  try {
    // Знаходимо елемент завдання
    const taskElement = document.querySelector(`.task-item[data-task-id="${taskId}"]`);
    if (!taskElement) return;

    // Знаходимо елемент дії
    const actionElement = taskElement.querySelector('.task-action');
    if (actionElement) {
      // Додаємо клас стану завантаження
      actionElement.classList.add('loading');

      // Зберігаємо оригінальний вміст
      const originalContent = actionElement.innerHTML;
      actionElement.setAttribute('data-original-content', originalContent);

      // Замінюємо на лоадер
      actionElement.innerHTML = `
        <div class="loading-indicator">
          <div class="spinner"></div>
          <span data-lang-key="earn.verifying">Перевірка...</span>
        </div>
      `;
    }

    logger.debug(`Показано індикатор завантаження для завдання ${taskId}`, 'showVerificationLoader');
  } catch (error) {
    logger.warn(`Помилка при показі індикатора завантаження для завдання ${taskId}:`, error);
  }
}

/**
 * Приховати індикатор завантаження для елемента завдання
 * @param {string} taskId - ID завдання
 */
export function hideVerificationLoader(taskId) {
  try {
    // Знаходимо елемент завдання
    const taskElement = document.querySelector(`.task-item[data-task-id="${taskId}"]`);
    if (!taskElement) return;

    // Знаходимо елемент дії
    const actionElement = taskElement.querySelector('.task-action');
    if (actionElement) {
      // Видаляємо клас стану завантаження
      actionElement.classList.remove('loading');

      // Відновлюємо оригінальний вміст
      const originalContent = actionElement.getAttribute('data-original-content');
      if (originalContent) {
        actionElement.innerHTML = originalContent;
        actionElement.removeAttribute('data-original-content');
      }
    }

    logger.debug(`Приховано індикатор завантаження для завдання ${taskId}`, 'hideVerificationLoader');
  } catch (error) {
    logger.warn(`Помилка при приховуванні індикатора завантаження для завдання ${taskId}:`, error);
  }
}

/**
 * Показати повідомлення про результат верифікації
 * @param {string} taskId - ID завдання
 * @param {Object} result - Результат верифікації
 * @param {boolean} [autoHide=true] - Чи автоматично приховувати повідомлення
 */
export function showVerificationMessage(taskId, result, autoHide = true) {
  try {
    const taskElement = document.querySelector(`.task-item[data-task-id="${taskId}"]`);
    if (!taskElement) return;

    // Знаходимо або створюємо елемент повідомлення
    let messageElement = taskElement.querySelector('.verification-message');
    if (!messageElement) {
      messageElement = document.createElement('div');
      messageElement.className = 'verification-message';
      taskElement.appendChild(messageElement);
    }

    // Встановлюємо клас відповідно до результату
    messageElement.className = 'verification-message';
    if (result.success) {
      messageElement.classList.add('success');
    } else {
      messageElement.classList.add('error');
    }

    // Встановлюємо текст повідомлення
    messageElement.textContent = result.message;

    // Показуємо повідомлення
    messageElement.style.display = 'block';

    // Автоматичне приховування повідомлення
    if (autoHide) {
      setTimeout(() => {
        if (messageElement && messageElement.parentNode) {
          messageElement.style.display = 'none';
        }
      }, 5000);
    }

    logger.debug(`Показано повідомлення верифікації для завдання ${taskId}`, 'showVerificationMessage');
  } catch (error) {
    logger.warn(`Помилка при показі повідомлення про верифікацію для завдання ${taskId}:`, error);
  }
}

/**
 * Оновлення інтерфейсу завдання за результатами верифікації
 * @param {string} taskId - ID завдання
 * @param {Object} result - Результат верифікації
 */
export function updateTaskUI(taskId, result) {
  try {
    const taskElement = document.querySelector(`.task-item[data-task-id="${taskId}"]`);
    if (!taskElement) return;

    // Видаляємо класи статусу
    taskElement.classList.remove('pending', 'completed', 'failed', 'in-progress');

    // Додаємо клас відповідно до результату
    if (result.success) {
      taskElement.classList.add('completed');

      // Оновлюємо кнопку дії
      const actionElement = taskElement.querySelector('.task-action');
      if (actionElement) {
        actionElement.innerHTML = '<div class="completed-label">Виконано</div>';
        actionElement.classList.add('completed');
      }

      // Оновлюємо прогрес-бар, якщо є
      const progressFill = taskElement.querySelector('.progress-fill');
      if (progressFill) {
        progressFill.style.width = '100%';
        progressFill.classList.add('completed');
      }
    } else {
      taskElement.classList.add('failed');

      // Оновлюємо кнопку дії
      const actionElement = taskElement.querySelector('.task-action');
      if (actionElement) {
        actionElement.innerHTML = '<div class="retry-button">Спробувати знову</div>';
        actionElement.classList.add('failed');
      }
    }

    logger.debug(`Оновлено інтерфейс завдання ${taskId} відповідно до результату верифікації`, 'updateTaskUI');
  } catch (error) {
    logger.warn(`Помилка оновлення інтерфейсу завдання ${taskId}:`, error);
  }
}

/**
 * Оновлення прогресу завдання
 * @param {string} taskId - ID завдання
 * @param {Object} progress - Дані прогресу
 */
export function updateProgressUI(taskId, progress) {
  try {
    // Знаходимо елемент завдання
    const taskElement = document.querySelector(`.task-item[data-task-id="${taskId}"]`);
    if (!taskElement) return;

    // Знаходимо елементи прогресу
    const progressFill = taskElement.querySelector('.progress-fill');
    const progressText = taskElement.querySelector('.progress-text');

    if (!progressFill) return;

    // Отримуємо цільове значення
    const targetValue = parseInt(taskElement.getAttribute('data-target-value') || '1');

    // Розраховуємо відсоток виконання
    const progressValue = progress.progress_value || 0;
    const progressPercent = Math.min(100, Math.round((progressValue / targetValue) * 100));

    // Оновлюємо ширину прогрес-бару
    progressFill.style.width = progressPercent + '%';

    // Якщо прогрес 100%, додаємо клас complete
    if (progressPercent >= 100) {
      progressFill.classList.add('complete');

      // Якщо завдання ще не позначене як виконане, відзначаємо його
      if (!taskElement.classList.contains('completed')) {
        taskElement.classList.add('completed');

        // Оновлюємо відображення кнопок дії
        const actionDiv = taskElement.querySelector('.task-action');
        if (actionDiv) {
          actionDiv.innerHTML = '<div class="completed-label">Виконано</div>';
        }
      }
    }

    // Оновлюємо текст прогресу
    if (progressText) {
      const progressTextSpans = progressText.querySelectorAll('span');
      if (progressTextSpans.length >= 2) {
        // Визначаємо, що показувати як текст прогресу
        const progressLabel = taskElement.getAttribute('data-progress-label') || '';
        progressTextSpans[0].textContent = `${progressValue}/${targetValue} ${progressLabel}`;
        progressTextSpans[1].textContent = `${progressPercent}%`;
      }
    }

    logger.debug(`Оновлено прогрес завдання ${taskId}`, 'updateProgressUI');
  } catch (error) {
    logger.warn(`Помилка оновлення прогресу завдання ${taskId}:`, error);
  }
}

/**
 * Зареєструвати обробники подій інтерфейсу
 */
export function setupUIEventHandlers() {
  try {
    // Обробник кліків на кнопках "Спробувати знову"
    document.addEventListener('click', (event) => {
      if (event.target.classList.contains('retry-button')) {
        // Знаходимо елемент завдання
        const taskElement = event.target.closest('.task-item');
        if (taskElement) {
          const taskId = taskElement.getAttribute('data-task-id');
          if (taskId) {
            // Відправляємо подію про повторну спробу верифікації
            document.dispatchEvent(
              new CustomEvent('task-verification-retry', {
                detail: {
                  taskId,
                  timestamp: Date.now(),
                },
              })
            );
          }
        }
      }
    });

    logger.info('Обробники подій інтерфейсу зареєстровано', 'setupUIEventHandlers');
  } catch (error) {
    logger.error('Помилка реєстрації обробників подій інтерфейсу:', error);
  }
}

/**
 * Функція для ініціалізації контролера інтерфейсу
 * @param {Object} verificationCore - Основний модуль верифікації
 */
export function setupUIController(verificationCore) {
  // Реєстрація обробників подій інтерфейсу
  setupUIEventHandlers();

  logger.info('Контролер інтерфейсу верифікації ініціалізовано');

  return {
    showLoader: showVerificationLoader,
    hideLoader: hideVerificationLoader,
    showMessage: showVerificationMessage,
    updateTaskUI: updateTaskUI,
    updateProgressUI: updateProgressUI
  };
}

export default {
  showVerificationLoader,
  hideVerificationLoader,
  showVerificationMessage,
  updateTaskUI,
  updateProgressUI,
  setupUIEventHandlers,
  setupUIController
};