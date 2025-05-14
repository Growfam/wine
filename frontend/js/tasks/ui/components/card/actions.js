/**
 * TaskCard.actions - модуль для роботи з діями картки завдання
 *
 * Відповідає за:
 * - Налаштування кнопок дій
 * - Обробку взаємодії з елементами картки
 * - Оновлення статусу дій
 */

import dependencyContainer from '../../../utils/core/dependency.js';
import { TASK_STATUS } from '../../../config/types/status-types.js';

// Стан системи дій
const state = {
  initialized: false,
  taskManager: null,
  notifications: null,
};

/**
 * Ініціалізація модуля
 * @returns {Object} API модуля
 */
export function init() {
  if (state.initialized) return exports;

  // Отримуємо залежності з контейнера
  state.taskManager =
    dependencyContainer.resolve('TaskManager') || dependencyContainer.resolve('TaskSystem');

  state.notifications = dependencyContainer.resolve('UI.Notifications');
  state.initialized = true;

  return exports;
}

/**
 * Налаштування кнопок дій для завдання
 * @param {HTMLElement} taskElement - Елемент картки
 * @param {Object} task - Дані завдання
 * @param {Object} progress - Прогрес виконання
 * @param {Object} options - Додаткові опції
 */
export function setupActionButtons(taskElement, task, progress, options = {}) {
  const actionContainer = taskElement.querySelector('.task-action');
  if (!actionContainer) return;

  // Перевіряємо стан завдання
  const isCompleted = progress && progress.status === 'completed';
  const isExpired = task.end_date && new Date(task.end_date) <= new Date();

  // Для завершених завдань показуємо лише статус
  if (isCompleted) {
    actionContainer.innerHTML =
      '<div class="completed-label" data-lang-key="earn.completed">Виконано</div>';
    return;
  }

  // Для прострочених завдань показуємо відповідний статус
  if (isExpired) {
    actionContainer.innerHTML =
      '<div class="expired-label" data-lang-key="earn.expired">Закінчено</div>';
    return;
  }

  // Визначаємо, який статус у прогресу завдання
  const needsVerification =
    progress && (progress.status === 'started' || progress.status === 'ready_to_verify');

  // Додаємо відповідні кнопки
  if (needsVerification) {
    addVerifyButton(actionContainer, task.id);
  } else {
    addStartButton(actionContainer, task.id, task.action_label);

    // Якщо дозволено перевірку, додаємо і кнопку "Перевірити"
    if (options.allowVerification) {
      addVerifyButton(actionContainer, task.id);
    }
  }
}

/**
 * Додавання кнопки "Виконати"
 * @param {HTMLElement} container - Контейнер для кнопки
 * @param {string} taskId - ID завдання
 * @param {string} label - Текст кнопки
 */
function addStartButton(container, taskId, label = 'Виконати') {
  const button = createButton({
    className: 'action-button',
    action: 'start',
    taskId: taskId,
    text: label || 'Виконати',
    langKey: 'earn.start',
  });

  button.addEventListener('click', (event) => {
    event.preventDefault();
    handleStartTask(taskId);
  });

  container.appendChild(button);
}

/**
 * Додавання кнопки "Перевірити"
 * @param {HTMLElement} container - Контейнер для кнопки
 * @param {string} taskId - ID завдання
 */
function addVerifyButton(container, taskId) {
  const button = createButton({
    className: 'action-button verify-button',
    action: 'verify',
    taskId: taskId,
    text: 'Перевірити',
    langKey: 'earn.verify',
  });

  button.addEventListener('click', (event) => {
    event.preventDefault();
    handleVerifyTask(taskId);
  });

  container.appendChild(button);
}

/**
 * Створення кнопки
 * @param {Object} options - Параметри кнопки
 * @returns {HTMLElement} Елемент кнопки
 */
function createButton(options) {
  const button = document.createElement('button');
  button.className = options.className || 'action-button';
  button.dataset.action = options.action;
  button.dataset.taskId = options.taskId;

  if (options.langKey) {
    button.setAttribute('data-lang-key', options.langKey);
  }

  button.textContent = options.text || 'Дія';
  return button;
}

/**
 * Обробка початку виконання завдання
 * @param {string} taskId - ID завдання
 */
export function handleStartTask(taskId) {
  // Ініціалізуємо модуль при першому використанні
  if (!state.initialized) {
    init();
  }

  // Отримуємо елемент завдання
  const taskElement = document.querySelector(`.task-item[data-task-id="${taskId}"]`);
  if (!taskElement) return;

  // Оновлюємо відображення (показуємо індикатор завантаження)
  updateActionStatus(taskElement, TASK_STATUS.LOADING);

  // Викликаємо TaskManager для запуску завдання
  if (state.taskManager && typeof state.taskManager.startTask === 'function') {
    state.taskManager
      .startTask(taskId)
      .then((response) => {
        if (response.success) {
          showSuccessMessage(response.message || 'Завдання успішно активовано');

          // Якщо є URL дії, відкриваємо його у новому вікні
          if (response.action_url) {
            window.open(response.action_url, '_blank', 'noopener,noreferrer');
          }

          // Оновлюємо статус для перевірки
          updateActionStatus(taskElement, TASK_STATUS.READY_TO_VERIFY);
        } else {
          // Обробляємо помилку
          showErrorMessage(response.message || 'Помилка запуску завдання');
          updateActionStatus(taskElement, TASK_STATUS.ERROR);
        }
      })
      .catch((error) => {
        showErrorMessage('Помилка запуску завдання');
        updateActionStatus(taskElement, TASK_STATUS.ERROR);
        console.error('Помилка запуску завдання:', error);
      });
  } else {
    showErrorMessage('TaskManager недоступний');
    updateActionStatus(taskElement, TASK_STATUS.ERROR);
  }
}

/**
 * Обробка перевірки виконання завдання
 * @param {string} taskId - ID завдання
 */
export function handleVerifyTask(taskId) {
  // Ініціалізуємо модуль при першому використанні
  if (!state.initialized) {
    init();
  }

  // Отримуємо елемент завдання
  const taskElement = document.querySelector(`.task-item[data-task-id="${taskId}"]`);
  if (!taskElement) return;

  // Оновлюємо відображення (показуємо індикатор завантаження)
  updateActionStatus(taskElement, TASK_STATUS.LOADING);

  // Викликаємо TaskManager для перевірки завдання
  if (state.taskManager && typeof state.taskManager.verifyTask === 'function') {
    state.taskManager
      .verifyTask(taskId)
      .then((response) => {
        if (response.success) {
          showSuccessMessage(response.message || 'Завдання успішно виконано');
          updateActionStatus(taskElement, TASK_STATUS.COMPLETED);

          // Якщо є винагорода, показуємо її
          if (response.reward && window.RewardBadge) {
            window.RewardBadge.showAnimation(response.reward);
          }
        } else {
          showErrorMessage(response.message || 'Помилка перевірки завдання');
          updateActionStatus(taskElement, TASK_STATUS.ERROR);
        }
      })
      .catch((error) => {
        showErrorMessage('Помилка перевірки завдання');
        updateActionStatus(taskElement, TASK_STATUS.ERROR);
        console.error('Помилка перевірки завдання:', error);
      });
  } else {
    // Якщо TaskManager недоступний, повертаємо звичайний стан
    showErrorMessage('TaskManager недоступний');
    updateActionStatus(taskElement, TASK_STATUS.READY_TO_VERIFY);
  }
}

/**
 * Оновлення елементу дій відповідно до статусу
 * @param {HTMLElement} taskElement - Елемент завдання
 * @param {string} status - Новий статус
 */
export function updateActionStatus(taskElement, status) {
  const actionContainer = taskElement.querySelector('.task-action');
  if (!actionContainer) return;

  const taskId = taskElement.dataset.taskId;

  // Оновлюємо класи елемента
  const statusList = ['loading', 'completed', 'error', 'in-progress', 'ready-to-verify', 'expired'];
  statusList.forEach((cls) => taskElement.classList.remove(cls));

  if (status) {
    taskElement.classList.add(status);
  }

  // Оновлюємо вміст елемента дій відповідно до статусу
  switch (status) {
    case TASK_STATUS.COMPLETED:
      actionContainer.innerHTML =
        '<div class="completed-label" data-lang-key="earn.completed">Виконано</div>';
      break;

    case TASK_STATUS.LOADING:
      actionContainer.innerHTML = `
                <div class="loading-indicator">
                    <div class="spinner"></div>
                    <span data-lang-key="earn.verifying">Перевірка...</span>
                </div>
            `;
      break;

    case TASK_STATUS.READY_TO_VERIFY:
      actionContainer.innerHTML = '';
      addVerifyButton(actionContainer, taskId);
      break;

    case TASK_STATUS.EXPIRED:
      actionContainer.innerHTML =
        '<div class="expired-label" data-lang-key="earn.expired">Закінчено</div>';
      break;

    case TASK_STATUS.ERROR:
      // Показуємо кнопку для повторної спроби
      actionContainer.innerHTML = '';
      const retryBtn = createButton({
        className: 'action-button',
        action: 'start',
        taskId: taskId,
        text: 'Спробувати знову',
        langKey: 'earn.retry',
      });

      retryBtn.addEventListener('click', (event) => {
        event.preventDefault();
        handleStartTask(taskId);
      });

      actionContainer.appendChild(retryBtn);
      break;

    default:
      // Базовий статус - кнопка "Виконати"
      actionContainer.innerHTML = '';
      addStartButton(actionContainer, taskId);
      break;
  }
}

/**
 * Показати повідомлення про успіх
 * @param {string} message - Повідомлення
 */
function showSuccessMessage(message) {
  if (!state.initialized) {
    init();
  }

  if (state.notifications && typeof state.notifications.showSuccess === 'function') {
    state.notifications.showSuccess(message);
  } else if (window.UI && window.UI.Notifications && window.UI.Notifications.showSuccess) {
    window.UI.Notifications.showSuccess(message);
  } else if (typeof window.showToast === 'function') {
    window.showToast(message, false);
  } else {
    console.log('Успіх:', message);
  }
}

/**
 * Показати повідомлення про помилку
 * @param {string} message - Повідомлення
 */
function showErrorMessage(message) {
  if (!state.initialized) {
    init();
  }

  if (state.notifications && typeof state.notifications.showError === 'function') {
    state.notifications.showError(message);
  } else if (window.UI && window.UI.Notifications && window.UI.Notifications.showError) {
    window.UI.Notifications.showError(message);
  } else if (typeof window.showToast === 'function') {
    window.showToast(message, true);
  } else {
    console.error('Помилка:', message);
  }
}

// Автоматична ініціалізація
setTimeout(init, 0);

// Експорт публічного API
const exports = {
  setupActionButtons,
  handleStartTask,
  handleVerifyTask,
  updateActionStatus,
  init,
};

export default exports;