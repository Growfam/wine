/**
 * Спільні утиліти для управління UI елементами завантаження
 *
 * Відповідає за показ/приховування індикаторів завантаження та прогресу в UI
 */

import { getLogger } from 'js/tasks/utils/core/index.js';

// Створюємо логер для модуля
const logger = getLogger('UILoaders');

/**
 * Показати індикатор завантаження для елемента завдання
 * @param {string} taskId - ID завдання
 */
export function showLoadingIndicator(taskId) {
  try {
    const taskElement = document.querySelector(`.task-item[data-task-id="${taskId}"]`);
    if (!taskElement) return;

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
  } catch (error) {
    logger.error(error, 'Помилка відображення індикатора завантаження', {
      taskId,
      category: 'ui'
    });
  }
}

/**
 * Приховати індикатор завантаження для елемента завдання
 * @param {string} taskId - ID завдання
 */
export function hideLoadingIndicator(taskId) {
  try {
    const taskElement = document.querySelector(`.task-item[data-task-id="${taskId}"]`);
    if (!taskElement) return;

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
  } catch (error) {
    logger.error(error, 'Помилка приховування індикатора завантаження', {
      taskId,
      category: 'ui'
    });
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
  } catch (error) {
    logger.error(error, 'Помилка відображення повідомлення верифікації', {
      taskId,
      category: 'ui'
    });
  }
}

/**
 * Оновлення інтерфейсу прогресу завдання
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
    const targetValue = taskElement.getAttribute('data-target-value') || 1;

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
  } catch (error) {
    logger.error(error, 'Помилка оновлення UI прогресу', {
      taskId,
      category: 'ui'
    });
  }
}

/**
 * Показати індикатор верифікації для елемента завдання
 * (аліас для showLoadingIndicator для семантичної ясності)
 * @param {string} taskId - ID завдання
 */
export function showVerificationLoader(taskId) {
  showLoadingIndicator(taskId);
}

/**
 * Приховати індикатор верифікації для елемента завдання
 * (аліас для hideLoadingIndicator для семантичної ясності)
 * @param {string} taskId - ID завдання
 */
export function hideVerificationLoader(taskId) {
  hideLoadingIndicator(taskId);
}