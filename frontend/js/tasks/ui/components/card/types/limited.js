/**
 * LimitedTaskCard - компонент для відображення обмежених за часом завдань
 *
 * Відповідає за:
 * - Спеціалізовані картки для завдань з обмеженим терміном
 * - Відображення таймера зворотного відліку
 * - Додатковий UI для цього типу завдань
 */

import { create as createBaseCard } from '../base.js';
import { setupActionButtons } from '../actions.js';
import dependencyContainer from '../../../../utils/index.js';

/**
 * Створення картки обмеженого завдання
 * @param {Object} task - Дані завдання
 * @param {Object} progress - Прогрес виконання
 * @param {Object} options - Додаткові налаштування
 * @returns {HTMLElement} DOM елемент картки
 */
export function create(task, progress, options = {}) {
  // Створюємо базову картку
  const taskElement = createBaseCard(task, progress, {
    ...options,
    customClass: 'limited-task',
  });

  // Додаємо додаткові атрибути
  if (task.end_date) {
    taskElement.dataset.endDate = task.end_date;
  }

  // Перевіряємо, чи не закінчився термін
  let isExpired = false;
  let endDate;

  if (task.end_date) {
    // Парсимо дату
    try {
      endDate = new Date(task.end_date);
      // Перевіряємо, чи не закінчився термін
      isExpired = endDate <= new Date();
    } catch (e) {
      console.error('Помилка парсингу дати завдання:', e);
    }
  }

  // Додаємо статус та таймер
  if (isExpired) {
    taskElement.classList.add('expired');
    addExpirationNotice(taskElement);
  } else if (task.end_date) {
    addCountdownTimer(taskElement, task.end_date);
  }

  // Налаштовуємо кнопки дій
  setupActionButtons(taskElement, task, progress, {
    allowVerification: true,
    isExpired: isExpired,
  });

  return taskElement;
}

/**
 * Додавання повідомлення про закінчення терміну
 * @param {HTMLElement} taskElement - Елемент завдання
 */
function addExpirationNotice(taskElement) {
  // Знаходимо або створюємо контейнер для таймера
  let timerContainer = taskElement.querySelector('.timer-container');

  if (!timerContainer) {
    timerContainer = document.createElement('div');
    timerContainer.className = 'timer-container expired';

    // Додаємо контейнер після заголовка
    const headerElement = taskElement.querySelector('.task-header');
    if (headerElement) {
      headerElement.appendChild(timerContainer);
    }
  }

  timerContainer.innerHTML = `
        <span class="timer-icon"></span>
        <span data-lang-key="earn.expired">Закінчено</span>
    `;
}

/**
 * Додавання таймера зворотного відліку
 * @param {HTMLElement} taskElement - Елемент завдання
 * @param {string} endDateStr - Кінцева дата в рядковому форматі
 */
function addCountdownTimer(taskElement, endDateStr) {
  // Створюємо контейнер для таймера
  const timerContainer = document.createElement('div');
  timerContainer.className = 'timer-container';

  // Створюємо елемент відліку
  const timerElement = document.createElement('span');
  timerElement.className = 'timer-value';
  timerElement.dataset.endDate = endDateStr;
  timerElement.dataset.format = 'short';

  // Додаємо іконку
  const timerIcon = document.createElement('span');
  timerIcon.className = 'timer-icon';

  // Складаємо все разом
  timerContainer.appendChild(timerIcon);
  timerContainer.appendChild(timerElement);

  // Додаємо контейнер після заголовка
  const headerElement = taskElement.querySelector('.task-header');
  if (headerElement) {
    headerElement.appendChild(timerContainer);
  }

  // Ініціалізуємо таймер
  initializeTimer(timerElement, endDateStr);
}

/**
 * Ініціалізація таймера зворотного відліку
 * @param {HTMLElement} timerElement - Елемент таймера
 * @param {string} endDateStr - Кінцева дата
 */
function initializeTimer(timerElement, endDateStr) {
  // Перевіряємо, чи доступний модуль TimeUtils
  const timeUtils = dependencyContainer.resolve('TimeUtils');

  if (timeUtils && typeof timeUtils.createCountdown === 'function') {
    // Використовуємо TimeUtils для створення таймера
    timeUtils.createCountdown({
      element: timerElement,
      endDate: endDateStr,
      format: 'short',
      onComplete: () => {
        // Коли час закінчився, оновлюємо статус
        const taskElement = findParentTaskElement(timerElement);
        if (taskElement) {
          taskElement.classList.add('expired');
          // Оновлюємо вигляд таймера
          const timerContainer = timerElement.parentNode;
          if (timerContainer) {
            timerContainer.classList.add('expired');
            timerElement.textContent = 'Закінчено';
          }
        }
      },
    });
  } else {
    // Запасний варіант - простий таймер
    initializeSimpleTimer(timerElement, endDateStr);
  }
}

/**
 * Простий таймер зворотного відліку
 * @param {HTMLElement} timerElement - Елемент таймера
 * @param {string} endDateStr - Кінцева дата
 */
function initializeSimpleTimer(timerElement, endDateStr) {
  // Парсимо дату
  const endDate = new Date(endDateStr);
  if (isNaN(endDate.getTime())) return;

  // Функція для оновлення таймера
  const updateTimer = () => {
    const now = new Date();
    const timeLeft = endDate - now;

    if (timeLeft <= 0) {
      // Час вийшов
      timerElement.textContent = 'Закінчено';

      // Знаходимо елемент завдання і оновлюємо його статус
      const taskElement = findParentTaskElement(timerElement);
      if (taskElement) {
        taskElement.classList.add('expired');
        // Оновлюємо вигляд таймера
        const timerContainer = timerElement.parentNode;
        if (timerContainer) {
          timerContainer.classList.add('expired');
        }
      }

      clearInterval(timerId);
      return;
    }

    // Форматуємо час
    const days = Math.floor(timeLeft / (1000 * 60 * 60 * 24));
    const hours = Math.floor((timeLeft % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));
    const seconds = Math.floor((timeLeft % (1000 * 60)) / 1000);

    let formattedTime;
    if (days > 0) {
      formattedTime = `${days}д ${hours}г`;
    } else if (hours > 0) {
      formattedTime = `${hours}г ${minutes}хв`;
    } else {
      formattedTime = `${minutes}хв ${seconds}с`;
    }

    timerElement.textContent = formattedTime;
  };

  // Запускаємо таймер
  updateTimer();
  const timerId = setInterval(updateTimer, 1000);

  // Зберігаємо ID таймера для можливості очищення
  timerElement.dataset.timerId = timerId;
}

/**
 * Знаходження батьківського елемента завдання
 * @param {HTMLElement} element - Дочірній елемент
 * @returns {HTMLElement|null} Елемент завдання
 */
function findParentTaskElement(element) {
  let current = element;
  while (current && !current.classList.contains('task-item')) {
    current = current.parentElement;
  }
  return current;
}

// Експортуємо публічне API
export default { create };
