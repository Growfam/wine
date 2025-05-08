/**
 * Підписники для сховища завдань
 *
 * Налаштовує обробники для різних подій сховища
 */

/**
 * Налаштування обробників подій для сховища
 * @param {Object} store - Екземпляр сховища
 */
export function setupSubscribers(store) {
  // Налаштовуємо глобальні обробники подій
  setupGlobalEventListeners(store);

  // Налаштовуємо обробники для оновлення UI
  setupUIUpdaters(store);
}

/**
 * Налаштування глобальних обробників подій
 * @param {Object} store - Екземпляр сховища
 */
function setupGlobalEventListeners(store) {
  // Слухаємо подію оновлення прогресу
  document.addEventListener('task-progress-updated', (event) => {
    const { taskId, progressData } = event.detail;
    store.setTaskProgress(taskId, progressData);
  });

  // Слухаємо подію завершення завдання
  document.addEventListener('task-completed', (event) => {
    const { taskId, reward } = event.detail;

    // Оновлюємо статус завдання
    store.updateTask(taskId, { status: 'completed' });

    // Оновлюємо баланс, якщо є винагорода
    if (reward) {
      store.updateBalance(reward.type, reward.amount, true);
    }
  });

  // Слухаємо подію перемикання вкладок
  document.addEventListener('tab-switched', (event) => {
    const { to } = event.detail;
    store.setActiveTab(to);
  });
}

/**
 * Налаштування обробників для оновлення UI
 * @param {Object} store - Екземпляр сховища
 */
function setupUIUpdaters(store) {
  // Підписуємося на зміни у сховищі
  store.subscribe((action, data) => {
    switch (action) {
      case 'tasks-updated':
        updateTasksUI(data.type, store.getTasks(data.type));
        break;

      case 'progress-updated':
        updateProgressUI(data.taskId, data.progressData);
        break;

      case 'tab-switched':
        updateTabsUI(data.to);
        break;

      case 'balance-updated':
        updateBalanceUI(data.type, data.newBalance, data.isIncrement);
        break;
    }
  });
}

/**
 * Оновлення UI завдань
 * @param {string} type - Тип завдань
 * @param {Array} tasks - Масив завдань
 */
function updateTasksUI(type, tasks) {
  // Знаходимо контейнер для завдань цього типу
  const container = document.getElementById(`${type}-tasks-container`);
  if (!container) return;

  // Перевіряємо, чи треба оновлювати (контейнер видимий)
  const isVisible = container.offsetParent !== null;
  if (!isVisible) return;

  // Тут можна реалізувати оновлення UI (в реальному проєкті це робиться в UI компонентах)
}

/**
 * Оновлення UI прогресу
 * @param {string} taskId - ID завдання
 * @param {Object} progressData - Дані прогресу
 */
function updateProgressUI(taskId, progressData) {
  // Знаходимо елемент завдання
  const taskElement = document.querySelector(`.task-item[data-task-id="${taskId}"]`);
  if (!taskElement) return;

  // Оновлюємо UI прогресу (в реальному проєкті це робиться в UI компонентах)
}

/**
 * Оновлення UI вкладок
 * @param {string} activeTab - Активна вкладка
 */
function updateTabsUI(activeTab) {
  // Знаходимо всі вкладки
  const tabElements = document.querySelectorAll('.task-tab');
  if (!tabElements.length) return;

  // Оновлюємо класи активності
  tabElements.forEach((tab) => {
    const tabType = tab.getAttribute('data-tab-type');
    if (tabType === activeTab) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });

  // Оновлюємо видимість контейнерів
  const containers = document.querySelectorAll('.tasks-container');
  containers.forEach((container) => {
    const containerType = container.getAttribute('data-container-type');
    if (containerType === activeTab) {
      container.style.display = 'block';
    } else {
      container.style.display = 'none';
    }
  });
}

/**
 * Оновлення UI балансу
 * @param {string} type - Тип балансу
 * @param {number} newBalance - Новий баланс
 * @param {boolean} isIncrement - Чи було це збільшенням
 */
function updateBalanceUI(type, newBalance, isIncrement) {
  // Знаходимо відповідний елемент
  const element = document.getElementById(`user-${type}`);
  if (!element) return;

  // Оновлюємо значення
  if (type === 'tokens') {
    element.textContent = newBalance.toFixed(2);
  } else {
    element.textContent = newBalance.toString();
  }

  // Додаємо клас анімації
  element.classList.add(isIncrement ? 'increasing' : 'updated');

  // Видаляємо клас анімації через певний час
  setTimeout(() => {
    element.classList.remove(isIncrement ? 'increasing' : 'updated');
  }, 1500);
}
