/**
 * BaseRenderer - базовий клас для всіх рендерерів завдань
 *
 * Відповідає за:
 * - Стандартизацію інтерфейсу рендерерів
 * - Надання спільної логіки для всіх типів рендерерів
 * - Уніфікацію обробки подій та стану завдань
 *
 * @version 2.0.0
 */

import dependencyContainer from '../../utils/dependency-container.js';

// Статуси завдань
export const TASK_STATUS = {
  IDLE: 'idle', // Початковий стан
  LOADING: 'loading', // Завантаження/обробка
  COMPLETED: 'completed', // Завершено
  ERROR: 'error', // Помилка
  IN_PROGRESS: 'in-progress', // В процесі виконання
  READY_TO_VERIFY: 'ready-to-verify', // Готове до перевірки
  EXPIRED: 'expired', // Термін дії завдання минув
};

/**
 * Базовий клас рендерера
 */
export default class BaseRenderer {
  /**
   * Конструктор базового рендерера
   * @param {string} name - Назва рендерера для реєстрації в контейнері
   */
  constructor(name) {
    this.name = name || 'BaseRenderer';
    this.initialized = false;
    this.taskElements = new Map(); // Кеш елементів завдань

    // Сервіси, які будуть ініціалізовані пізніше
    this.taskSystem = null;
    this.taskCard = null;
    this.notifications = null;
    this.logger = null;

    // Автоматична ініціалізація при створенні
    setTimeout(() => this.initialize(), 0);
  }

  /**
   * Ініціалізація рендерера
   * Отримання залежностей з контейнера
   */
  initialize() {
    if (this.initialized) return;

    try {
      // Отримуємо TaskSystem з контейнера залежностей
      this.taskSystem =
        dependencyContainer.resolve('TaskSystem') || dependencyContainer.resolve('TaskManager');

      // Отримуємо TaskCard з контейнера залежностей
      this.taskCard = dependencyContainer.resolve('TaskCard');

      // Отримуємо сервіс сповіщень
      this.notifications = dependencyContainer.resolve('UI.Notifications');

      // Отримуємо логер, якщо доступний
      this.logger = dependencyContainer.resolve('Logger');

      // Реєструємо себе в контейнері залежностей
      dependencyContainer.register(this.name, this);

      // Підписуємося на події
      this.setupEventListeners();

      this.initialized = true;
      this.log('info', `Рендерер ${this.name} ініціалізовано успішно`);
    } catch (error) {
      console.error(`${this.name}: Помилка ініціалізації рендерера`, error);
    }
  }

  /**
   * Налаштування обробників подій
   */
  setupEventListeners() {
    if (typeof document === 'undefined') return;

    // Базові обробники подій, спільні для всіх рендерерів
    document.addEventListener('task-started', (event) => {
      if (event.detail && event.detail.taskId) {
        const taskElement = this.taskElements.get(event.detail.taskId);
        if (taskElement) {
          this.updateTaskStatus(taskElement, TASK_STATUS.READY_TO_VERIFY);
        }
      }
    });

    document.addEventListener('task-completed', (event) => {
      if (event.detail && event.detail.taskId) {
        const taskElement = this.taskElements.get(event.detail.taskId);
        if (taskElement) {
          this.updateTaskStatus(taskElement, TASK_STATUS.COMPLETED);
        }
      }
    });

    // Очищаємо ресурси при виході зі сторінки
    window.addEventListener('beforeunload', () => this.cleanup());
  }

  /**
   * Рендеринг елемента завдання
   * @param {Object} task - Модель завдання
   * @param {Object} progress - Прогрес виконання
   * @param {Object} options - Додаткові опції рендерингу
   * @returns {HTMLElement} DOM елемент завдання
   */
  render(task, progress, options = {}) {
    if (!this.initialized) {
      this.initialize();
    }

    // Перевіряємо валідність даних
    if (!task || !task.id) {
      this.log('error', 'Отримано некоректні дані завдання');
      return document.createElement('div');
    }

    // Базові опції для TaskCard
    const defaultOptions = this.getTaskCardOptions(task);
    const mergedOptions = { ...defaultOptions, ...options };

    // Створюємо базову картку через TaskCard
    let taskElement;

    if (this.taskCard && typeof this.taskCard.create === 'function') {
      taskElement = this.taskCard.create(task, progress, mergedOptions);

      // Додаємо додаткові атрибути
      this.addTaskAttributes(taskElement, task, mergedOptions);
    } else {
      // Запасний варіант, якщо TaskCard недоступний
      taskElement = this.createFallbackElement(task, progress, mergedOptions);
    }

    // Додаємо специфічні елементи для цього типу завдання
    this.enhanceTaskElement(taskElement, task, progress, mergedOptions);

    // Зберігаємо елемент у кеші
    this.taskElements.set(task.id, taskElement);

    return taskElement;
  }

  /**
   * Отримання опцій для TaskCard
   * @param {Object} task - Завдання
   * @returns {Object} Опції для TaskCard
   */
  getTaskCardOptions(task) {
    return {
      customClass: 'base-task',
      allowVerification: true,
    };
  }

  /**
   * Додавання атрибутів до елемента завдання
   * @param {HTMLElement} taskElement - Елемент завдання
   * @param {Object} task - Завдання
   * @param {Object} options - Опції рендерингу
   */
  addTaskAttributes(taskElement, task, options) {
    taskElement.dataset.taskId = task.id;
    taskElement.dataset.taskType = this.name.toLowerCase().replace('renderer', '');
  }

  /**
   * Створення запасного елемента, якщо TaskCard недоступний
   * @param {Object} task - Модель завдання
   * @param {Object} progress - Прогрес виконання
   * @param {Object} options - Опції рендерингу
   * @returns {HTMLElement} DOM елемент завдання
   */
  createFallbackElement(task, progress, options) {
    const isCompleted = progress && progress.status === 'completed';
    const taskElement = document.createElement('div');
    taskElement.className = 'task-item';
    taskElement.dataset.taskId = task.id;
    taskElement.dataset.taskType = this.name.toLowerCase().replace('renderer', '');

    // Безпечне отримання текстів
    const safeTitle = this.escapeHtml(task.title || '');
    const safeDescription = this.escapeHtml(task.description || '');
    const rewardType = task.reward_type === 'tokens' ? '$WINIX' : 'жетонів';

    // Базовий HTML шаблон для всіх типів завдань
    taskElement.innerHTML = `
            <div class="task-header">
                <div class="task-title">${safeTitle}</div>
                <div class="task-reward">${task.reward_amount} ${rewardType}</div>
            </div>
            <div class="task-description">${safeDescription}</div>
            <div class="task-progress-container"></div>
            <div class="task-action"></div>
        `;

    // Додаємо клас для завершеного завдання
    if (isCompleted) {
      taskElement.classList.add('completed');
    }

    return taskElement;
  }

  /**
   * Додавання специфічних елементів для типу завдання
   * @param {HTMLElement} taskElement - Елемент завдання
   * @param {Object} task - Завдання
   * @param {Object} progress - Прогрес
   * @param {Object} options - Опції рендерингу
   */
  enhanceTaskElement(taskElement, task, progress, options) {
    // Базова реалізація - встановлюємо початковий статус
    let initialStatus = TASK_STATUS.IDLE;

    if (progress) {
      switch (progress.status) {
        case 'completed':
          initialStatus = TASK_STATUS.COMPLETED;
          break;
        case 'started':
          initialStatus = TASK_STATUS.READY_TO_VERIFY;
          break;
        case 'expired':
          initialStatus = TASK_STATUS.EXPIRED;
          break;
        default:
          initialStatus = TASK_STATUS.IDLE;
      }
    }

    // Оновлюємо відображення статусу
    this.updateTaskStatus(taskElement, initialStatus);
  }

  /**
   * Оновлення статусу завдання в інтерфейсі
   * @param {HTMLElement} taskElement - Елемент завдання
   * @param {string} status - Новий статус
   */
  updateTaskStatus(taskElement, status) {
    if (!taskElement) return;

    // Оновлюємо класи елемента
    const statusClasses = Object.values(TASK_STATUS);

    // Видаляємо всі статусні класи
    statusClasses.forEach((cls) => taskElement.classList.remove(cls));

    // Додаємо відповідний клас
    if (status) {
      taskElement.classList.add(status);
    }

    // Оновлюємо кнопки дій залежно від статусу
    this.updateActionButtons(taskElement, status);
  }

  /**
   * Оновлення кнопок дій залежно від статусу
   * @param {HTMLElement} taskElement - Елемент завдання
   * @param {string} status - Статус завдання
   */
  updateActionButtons(taskElement, status) {
    const actionContainer = taskElement.querySelector('.task-action');
    if (!actionContainer) return;

    const taskId = taskElement.dataset.taskId;

    // Визначаємо, який вміст показувати залежно від статусу
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

      case TASK_STATUS.ERROR:
        actionContainer.innerHTML = `
                    <button class="action-button" data-action="start" data-task-id="${taskId}" data-lang-key="earn.retry">Спробувати знову</button>
                `;
        this.setupButtonHandlers(taskElement);
        break;

      case TASK_STATUS.READY_TO_VERIFY:
        actionContainer.innerHTML = `
                    <button class="action-button verify-button" data-action="verify" data-task-id="${taskId}" data-lang-key="earn.verify">Перевірити</button>
                `;
        this.setupButtonHandlers(taskElement);
        break;

      case TASK_STATUS.EXPIRED:
        actionContainer.innerHTML =
          '<div class="expired-label" data-lang-key="earn.expired">Закінчено</div>';
        break;

      default:
        actionContainer.innerHTML = `
                    <button class="action-button" data-action="start" data-task-id="${taskId}" data-lang-key="earn.start">Виконати</button>
                `;
        this.setupButtonHandlers(taskElement);
        break;
    }
  }

  /**
   * Налаштування обробників для кнопок
   * @param {HTMLElement} taskElement - Елемент завдання
   */
  setupButtonHandlers(taskElement) {
    if (!taskElement) return;

    const taskId = taskElement.dataset.taskId;
    const startButton = taskElement.querySelector('.action-button[data-action="start"]');
    const verifyButton = taskElement.querySelector('.action-button[data-action="verify"]');

    // Обробник для кнопки "Виконати"
    if (startButton) {
      startButton.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();

        // Змінюємо вигляд кнопки
        this.updateTaskStatus(taskElement, TASK_STATUS.LOADING);

        // Викликаємо метод запуску завдання
        this.handleStartTask(taskId, taskElement);
      });
    }

    // Обробник для кнопки "Перевірити"
    if (verifyButton) {
      verifyButton.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();

        // Змінюємо вигляд кнопки
        this.updateTaskStatus(taskElement, TASK_STATUS.LOADING);

        // Викликаємо метод перевірки завдання
        this.handleVerifyTask(taskId, taskElement);
      });
    }
  }

  /**
   * Обробник запуску завдання
   * @param {string} taskId - ID завдання
   * @param {HTMLElement} taskElement - Елемент завдання
   */
  handleStartTask(taskId, taskElement) {
    // Отримуємо TaskSystem з контейнера, якщо ще не отримано
    if (!this.taskSystem) {
      this.taskSystem =
        dependencyContainer.resolve('TaskSystem') || dependencyContainer.resolve('TaskManager');
    }

    // Викликаємо TaskSystem, якщо доступний
    if (this.taskSystem && typeof this.taskSystem.startTask === 'function') {
      this.taskSystem.startTask(taskId);
    } else if (window.TaskManager && window.TaskManager.startTask) {
      // Для зворотної сумісності
      window.TaskManager.startTask(taskId);
    } else {
      // Запасний варіант
      this.showErrorMessage('Неможливо запустити завдання: TaskSystem недоступний');

      // Відновлюємо стан кнопки
      setTimeout(() => {
        this.updateTaskStatus(taskElement, TASK_STATUS.IDLE);
      }, 1000);
    }
  }

  /**
   * Обробник перевірки завдання
   * @param {string} taskId - ID завдання
   * @param {HTMLElement} taskElement - Елемент завдання
   */
  handleVerifyTask(taskId, taskElement) {
    // Отримуємо TaskSystem з контейнера, якщо ще не отримано
    if (!this.taskSystem) {
      this.taskSystem =
        dependencyContainer.resolve('TaskSystem') || dependencyContainer.resolve('TaskManager');
    }

    // Викликаємо TaskSystem, якщо доступний
    if (this.taskSystem && typeof this.taskSystem.verifyTask === 'function') {
      this.taskSystem.verifyTask(taskId);
    } else if (window.TaskManager && window.TaskManager.verifyTask) {
      // Для зворотної сумісності
      window.TaskManager.verifyTask(taskId);
    } else {
      // Запасний варіант
      this.showErrorMessage('Неможливо перевірити завдання: TaskSystem недоступний');

      // Відновлюємо стан кнопки
      setTimeout(() => {
        this.updateTaskStatus(taskElement, TASK_STATUS.READY_TO_VERIFY);
      }, 1000);
    }
  }

  /**
   * Оновлення відображення конкретного завдання
   * @param {string} taskId - ID завдання
   */
  refreshTaskDisplay(taskId) {
    const taskElement = this.taskElements.get(taskId);
    if (!taskElement) return;

    try {
      // Отримуємо TaskSystem з контейнера, якщо ще не отримано
      if (!this.taskSystem) {
        this.taskSystem =
          dependencyContainer.resolve('TaskSystem') || dependencyContainer.resolve('TaskManager');
      }

      let progress = null;

      // Спроба отримати прогрес через TaskSystem
      if (this.taskSystem && typeof this.taskSystem.getTaskProgress === 'function') {
        progress = this.taskSystem.getTaskProgress(taskId);
      }

      // Визначаємо статус на основі наявних даних
      let status = TASK_STATUS.IDLE;

      if (progress) {
        switch (progress.status) {
          case 'completed':
            status = TASK_STATUS.COMPLETED;
            break;
          case 'started':
            status = TASK_STATUS.READY_TO_VERIFY;
            break;
          case 'error':
            status = TASK_STATUS.ERROR;
            break;
          case 'in_progress':
            status = TASK_STATUS.IN_PROGRESS;
            break;
          case 'expired':
            status = TASK_STATUS.EXPIRED;
            break;
        }
      }

      // Оновлюємо відображення статусу
      this.updateTaskStatus(taskElement, status);
    } catch (error) {
      this.log('error', `Помилка при оновленні завдання ${taskId}`, { error });
    }
  }

  /**
   * Оновлення всіх завдань
   */
  refreshAllTasks() {
    this.taskElements.forEach((_, taskId) => {
      this.refreshTaskDisplay(taskId);
    });
  }

  /**
   * Показати повідомлення про успіх
   * @param {string} message - Текст повідомлення
   */
  showSuccessMessage(message) {
    // Отримуємо сервіс сповіщень, якщо ще не отримано
    if (!this.notifications) {
      this.notifications = dependencyContainer.resolve('UI.Notifications');
    }

    if (this.notifications && typeof this.notifications.showSuccess === 'function') {
      this.notifications.showSuccess(message);
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
   * @param {string} message - Текст повідомлення
   */
  showErrorMessage(message) {
    // Отримуємо сервіс сповіщень, якщо ще не отримано
    if (!this.notifications) {
      this.notifications = dependencyContainer.resolve('UI.Notifications');
    }

    if (this.notifications && typeof this.notifications.showError === 'function') {
      this.notifications.showError(message);
    } else if (window.UI && window.UI.Notifications && window.UI.Notifications.showError) {
      window.UI.Notifications.showError(message);
    } else if (typeof window.showToast === 'function') {
      window.showToast(message, true);
    } else {
      console.error('Помилка:', message);
    }
  }

  /**
   * Функція для безпечного виведення HTML
   * @param {string} text - Текст для обробки
   * @returns {string} Безпечний HTML
   */
  escapeHtml(text) {
    if (!text) return '';

    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Логування повідомлень
   * @param {string} level - Рівень логування ('info', 'warn', 'error')
   * @param {string} message - Повідомлення
   * @param {Object} details - Додаткові дані
   */
  log(level, message, details = {}) {
    // Якщо є логер, використовуємо його
    if (this.logger && typeof this.logger[level] === 'function') {
      this.logger[level](message, this.name, details);
      return;
    }

    // Запасний варіант - консоль
    const logMethod = level === 'error' ? 'error' : level === 'warn' ? 'warn' : 'log';
    console[logMethod](`[${this.name}] ${message}`, details);
  }

  /**
   * Очищення ресурсів
   */
  cleanup() {
    this.taskElements.clear();

    this.log('info', 'Ресурси рендерера очищено');
  }
}
