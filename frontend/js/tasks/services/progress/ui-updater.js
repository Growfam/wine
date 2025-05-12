/**
 * Оновлення UI для прогресу завдань
 *
 * Інтегрує спільні UI-компоненти для роботи з відображенням прогресу
 */

import {
  updateProgressUI,
  showLoadingIndicator,
  hideLoadingIndicator
} from '../../utils/ui/index.js';

/**
 * Налаштування оновлення UI для сервісу прогресу
 * @param {Object} progressService - Сервіс прогресу
 */
export function setupUIUpdater(progressService) {
  // Підписка на оновлення UI для видимих завдань
  progressService.addListener('onProgressUpdate', (data) => {
    // Використовуємо спільну утиліту
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