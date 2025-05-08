/**
 * Оновлення UI для прогресу завдань
 *
 * Функції для оновлення інтерфейсу користувача при зміні прогресу
 */

/**
 * Налаштування оновлення UI для сервісу прогресу
 * @param {Object} progressService - Сервіс прогресу
 */
export function setupUIUpdater(progressService) {
  // Підписка на оновлення UI для видимих завдань
  progressService.addListener('onProgressUpdate', (data) => {
    updateProgressUI(data.taskId, data.progressData);
  });

  // Автоматична оновлення прогресу для видимих завдань
  document.addEventListener('DOMContentLoaded', () => {
    // Відстежуємо мутації DOM для нових елементів завдань
    setupDomObserver(progressService);

    // Початкове оновлення видимих завдань
    progressService.updateVisibleTasksProgress();
  });
}

/**
 * Налаштування спостерігача за DOM для відстеження нових елементів завдань
 * @param {Object} progressService - Сервіс прогресу
 */
function setupDomObserver(progressService) {
  // Перевіряємо підтримку MutationObserver
  if (!window.MutationObserver) return;

  // Створюємо спостерігача
  const observer = new MutationObserver((mutations) => {
    let needsUpdate = false;

    // Перевіряємо, чи з'явилися нові елементи завдань
    mutations.forEach((mutation) => {
      if (mutation.type === 'childList' && mutation.addedNodes.length) {
        mutation.addedNodes.forEach((node) => {
          if (node.nodeType === Node.ELEMENT_NODE) {
            // Перевіряємо, чи є додані елементи завданнями або вони містять завдання
            if (node.classList?.contains('task-item') || node.querySelector?.('.task-item')) {
              needsUpdate = true;
            }
          }
        });
      }
    });

    // Якщо додано нові завдання, оновлюємо прогрес
    if (needsUpdate) {
      progressService.updateVisibleTasksProgress();
    }
  });

  // Починаємо спостереження за всім документом
  observer.observe(document.body, {
    childList: true,
    subtree: true,
  });
}

/**
 * Оновлення інтерфейсу прогресу
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
    console.error('Помилка оновлення UI прогресу:', error);
  }
}

/**
 * Створення UI індикатора завантаження
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
    console.error('Помилка відображення індикатора завантаження:', error);
  }
}

/**
 * Приховування UI індикатора завантаження
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
    console.error('Помилка приховування індикатора завантаження:', error);
  }
}
