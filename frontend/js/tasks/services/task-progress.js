/**
 * Сервіс управління прогресом завдань
 *
 * Відповідає за:
 * - Відстеження прогресу виконання завдань
 * - Оновлення прогресу в реальному часі
 * - Синхронізацію прогресу з сервером
 */

import { TASK_STATUS, CONFIG } from '../config/task-types.js';
import taskStore from './task-store.js';
import taskApi from './task-api.js';

class TaskProgress {
  constructor() {
    // Інтервали оновлення
    this.intervals = {
      progressUpdate: null
    };

    // Стан відстеження
    this.tracking = {
      isActive: false,
      trackedTasks: new Set()
    };

    // Слухачі подій
    this.listeners = {
      onProgressUpdate: new Set(),
      onTaskCompleted: new Set()
    };

    // Кеш останніх оновлень для запобігання дублікатам
    this.lastUpdates = new Map();
  }

  /**
   * Ініціалізація модуля
   */
  initialize() {
    // Підписка на події
    this.setupEventListeners();

    // Запуск інтервалу відстеження прогресу
    this.startProgressTracking();
  }

  /**
   * Встановлення слухачів подій
   */
  setupEventListeners() {
    // Підписка на подію завершення завдання
    document.addEventListener('task-completed', this.handleTaskCompleted.bind(this));

    // Підписка на подію оновлення прогресу
    document.addEventListener('task-progress-updated', this.handleProgressUpdated.bind(this));

    // Підписка на подію зміни вкладки
    document.addEventListener('tab-switched', this.handleTabSwitch.bind(this));
  }

  /**
   * Запуск відстеження прогресу
   */
  startProgressTracking() {
    if (this.tracking.isActive) return;

    // Встановлюємо прапорець активності
    this.tracking.isActive = true;

    // Запускаємо інтервал оновлення прогресу
    this.intervals.progressUpdate = setInterval(() => {
      this.updateAllTasksProgress();
    }, CONFIG.PROGRESS_UPDATE_INTERVAL);
  }

  /**
   * Зупинка відстеження прогресу
   */
  stopProgressTracking() {
    if (!this.tracking.isActive) return;

    // Скидаємо прапорець активності
    this.tracking.isActive = false;

    // Очищаємо інтервал
    if (this.intervals.progressUpdate) {
      clearInterval(this.intervals.progressUpdate);
      this.intervals.progressUpdate = null;
    }
  }

  /**
   * Обробник події завершення завдання
   * @param {CustomEvent} event - Подія
   */
  handleTaskCompleted(event) {
    const { taskId, reward } = event.detail;

    // Отримуємо цільове значення
    const targetValue = this.getTaskTargetValue(taskId);

    // Оновлюємо прогрес
    this.updateTaskProgress(taskId, {
      status: TASK_STATUS.COMPLETED,
      progress_value: targetValue,
      completion_date: new Date().toISOString()
    });

    // Повідомляємо слухачів
    this.notifyListeners('onTaskCompleted', {
      taskId,
      reward,
      timestamp: Date.now()
    });

    // Припиняємо відстеження цього завдання
    this.tracking.trackedTasks.delete(taskId);
  }

  /**
   * Обробник події оновлення прогресу
   * @param {CustomEvent} event - Подія
   */
  handleProgressUpdated(event) {
    const { taskId, progressData } = event.detail;

    // Оновлюємо прогрес у сховищі
    taskStore.setTaskProgress(taskId, progressData);

    // Якщо завдання завершено, припиняємо відстеження
    if (progressData.status === TASK_STATUS.COMPLETED) {
      this.tracking.trackedTasks.delete(taskId);
    }

    // Повідомляємо слухачів
    this.notifyListeners('onProgressUpdate', {
      taskId,
      progressData,
      timestamp: Date.now()
    });
  }

  /**
   * Обробник події зміни вкладки
   * @param {CustomEvent} event - Подія
   */
  handleTabSwitch(event) {
    const { to } = event.detail;

    // Очищаємо список відстежуваних завдань
    this.tracking.trackedTasks.clear();

    // Після короткої затримки оновлюємо всі відображені завдання
    setTimeout(() => {
      this.updateVisibleTasksProgress();
    }, 300);
  }

  /**
   * Оновлення прогресу для всіх завдань
   */
  updateAllTasksProgress() {
    // Оновлюємо прогрес для всіх відстежуваних завдань
    this.tracking.trackedTasks.forEach(taskId => {
      this.checkTaskProgress(taskId);
    });
  }

  /**
   * Оновлення прогресу для видимих завдань
   */
  updateVisibleTasksProgress() {
    // Знаходимо всі видимі завдання
    document.querySelectorAll('.task-item:not(.completed)').forEach(taskElement => {
      const taskId = taskElement.getAttribute('data-task-id');
      if (taskId) {
        // Додаємо до списку відстежуваних
        this.tracking.trackedTasks.add(taskId);

        // Оновлюємо прогрес
        this.checkTaskProgress(taskId);
      }
    });
  }

  /**
   * Перевірка прогресу завдання
   * @param {string} taskId - ID завдання
   */
  checkTaskProgress(taskId) {
    // Отримуємо поточний прогрес
    const progress = taskStore.getTaskProgress(taskId);

    // Отримуємо дані завдання
    const task = taskStore.findTaskById(taskId);
    if (!task) return;

    // Отримуємо цільове значення
    const targetValue = task.target_value;

    // Якщо прогрес завершено, не оновлюємо
    if (progress && progress.status === TASK_STATUS.COMPLETED) {
      return;
    }

    // Знаходимо елемент завдання
    const taskElement = document.querySelector(`.task-item[data-task-id="${taskId}"]`);
    if (!taskElement) return;

    // Оновлюємо відображення прогресу
    this.updateProgressUI(taskElement, progress, targetValue);
  }

  /**
   * Оновлення інтерфейсу прогресу
   * @param {HTMLElement} taskElement - Елемент завдання
   * @param {Object} progress - Дані прогресу
   * @param {number} targetValue - Цільове значення
   */
  updateProgressUI(taskElement, progress, targetValue) {
    // Перевіряємо наявність прогресу
    if (!progress) return;

    // Отримуємо прогрес-бар
    const progressFill = taskElement.querySelector('.progress-fill');
    if (!progressFill) return;

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
    const progressText = taskElement.querySelector('.progress-text');
    if (progressText) {
      const progressTextSpans = progressText.querySelectorAll('span');
      if (progressTextSpans.length >= 2) {
        // Визначаємо, що показувати як текст прогресу
        const progressLabel = taskElement.getAttribute('data-progress-label') || '';
        progressTextSpans[0].textContent = `${progressValue}/${targetValue} ${progressLabel}`;
        progressTextSpans[1].textContent = `${progressPercent}%`;
      }
    }
  }

  /**
   * Оновлення прогресу завдання
   * @param {string} taskId - ID завдання
   * @param {Object} progressData - Дані прогресу
   * @returns {boolean} Результат оновлення
   */
  updateTaskProgress(taskId, progressData) {
    // Перевіряємо валідність даних
    if (!taskId || !progressData) {
      console.warn('TaskProgress: Некоректні дані прогресу');
      return false;
    }

    // Перевіряємо, чи не дублікат оновлення
    const lastUpdate = this.lastUpdates.get(taskId);
    if (lastUpdate) {
      const { timestamp, data } = lastUpdate;

      // Якщо однакові дані і минуло менше 500мс, ігноруємо
      if (JSON.stringify(data) === JSON.stringify(progressData) &&
          Date.now() - timestamp < 500) {
        return false;
      }
    }

    // Запам'ятовуємо це оновлення
    this.lastUpdates.set(taskId, {
      timestamp: Date.now(),
      data: progressData
    });

    // Оновлюємо прогрес у сховищі
    taskStore.setTaskProgress(taskId, progressData);

    // Генеруємо подію про оновлення прогресу
    document.dispatchEvent(new CustomEvent('task-progress-updated', {
      detail: {
        taskId,
        progressData,
        timestamp: Date.now()
      }
    }));

    // Перевіряємо, чи потрібно генерувати подію про виконання завдання
    if (progressData.status === TASK_STATUS.COMPLETED) {
      // Додаємо затримку для уникнення гонки подій
      setTimeout(() => {
        // Отримуємо дані завдання для пошуку винагороди
        const task = taskStore.findTaskById(taskId);

        // Генеруємо подію про виконання завдання
        document.dispatchEvent(new CustomEvent('task-completed', {
          detail: {
            taskId,
            reward: task ? {
              type: task.reward_type,
              amount: task.reward_amount
            } : null,
            timestamp: Date.now()
          }
        }));
      }, 50);
    }

    return true;
  }

  /**
   * Отримання прогресу завдання
   * @param {string} taskId - ID завдання
   * @returns {Object|null} Прогрес завдання
   */
  getTaskProgress(taskId) {
    return taskStore.getTaskProgress(taskId);
  }

  /**
   * Скидання прогресу завдання
   * @param {string} taskId - ID завдання
   * @returns {boolean} Результат операції
   */
  resetTaskProgress(taskId) {
    // Скидаємо прогрес у сховищі
    taskStore.setTaskProgress(taskId, {
      status: TASK_STATUS.PENDING,
      progress_value: 0
    });

    // Видаляємо з відстежуваних
    this.tracking.trackedTasks.delete(taskId);

    // Генеруємо подію про скидання прогресу
    document.dispatchEvent(new CustomEvent('task-progress-reset', {
      detail: {
        taskId,
        timestamp: Date.now()
      }
    }));

    return true;
  }

  /**
   * Отримання цільового значення завдання
   * @param {string} taskId - ID завдання
   * @returns {number} Цільове значення
   */
  getTaskTargetValue(taskId) {
    // Отримуємо дані завдання зі сховища
    const task = taskStore.findTaskById(taskId);
    if (task) {
      return task.target_value;
    }

    // Перевіряємо прогрес
    const progress = taskStore.getTaskProgress(taskId);
    if (progress && progress.max_progress) {
      return parseInt(progress.max_progress) || 1;
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
  }

  /**
   * Синхронізація прогресу з сервером
   * @param {string} taskId - ID завдання
   * @returns {Promise<Object>} Результат операції
   */
  async syncTaskProgress(taskId) {
    try {
      // Отримуємо прогрес з сервера
      const response = await taskApi.getTaskProgress(taskId);

      if (response.status === 'success' && response.data) {
        // Оновлюємо прогрес у сховищі
        taskStore.setTaskProgress(taskId, response.data);

        return {
          success: true,
          message: 'Прогрес успішно синхронізовано',
          data: response.data
        };
      }

      return {
        success: false,
        message: 'Не вдалося отримати прогрес з сервера',
        error: response.error || response.message
      };
    } catch (error) {
      console.error('Помилка синхронізації прогресу:', error);

      return {
        success: false,
        message: 'Помилка синхронізації прогресу',
        error: error.message
      };
    }
  }

  /**
   * Синхронізація всього прогресу з сервером
   * @returns {Promise<Object>} Результат операції
   */
  async syncAllProgress() {
    try {
      // Запитуємо весь прогрес з сервера
      const response = await taskApi.fetchWithRetry('quests/user-progress/all');

      if (response.status === 'success' && response.data) {
        // Оновлюємо прогрес у сховищі
        taskStore.setUserProgress(response.data);

        return {
          success: true,
          message: 'Всі дані прогресу успішно синхронізовано',
          data: response.data
        };
      }

      return {
        success: false,
        message: 'Не вдалося отримати прогрес з сервера',
        error: response.error || response.message
      };
    } catch (error) {
      console.error('Помилка синхронізації прогресу:', error);

      return {
        success: false,
        message: 'Помилка синхронізації прогресу',
        error: error.message
      };
    }
  }

  /**
   * Додавання слухача подій
   * @param {string} eventType - Тип події
   * @param {Function} callback - Функція-обробник
   * @returns {Function} Функція для видалення слухача
   */
  addListener(eventType, callback) {
    if (!this.listeners[eventType]) {
      console.warn(`Невідомий тип події: ${eventType}`);
      return () => {};
    }

    this.listeners[eventType].add(callback);

    // Повертаємо функцію для видалення слухача
    return () => this.removeListener(eventType, callback);
  }

  /**
   * Видалення слухача подій
   * @param {string} eventType - Тип події
   * @param {Function} callback - Функція-обробник
   */
  removeListener(eventType, callback) {
    if (!this.listeners[eventType]) return;

    this.listeners[eventType].delete(callback);
  }

  /**
   * Повідомлення всіх слухачів про подію
   * @param {string} eventType - Тип події
   * @param {Object} data - Дані події
   */
  notifyListeners(eventType, data) {
    if (!this.listeners[eventType]) return;

    this.listeners[eventType].forEach(callback => {
      try {
        callback(data);
      } catch (error) {
        console.error(`Помилка у обробнику події ${eventType}:`, error);
      }
    });
  }

  /**
   * Очищення кешу останніх оновлень
   */
  clearUpdateCache() {
    this.lastUpdates.clear();
  }

  /**
   * Скидання стану модуля
   */
  resetState() {
    // Зупиняємо відстеження
    this.stopProgressTracking();

    // Очищаємо список відстежуваних завдань
    this.tracking.trackedTasks.clear();

    // Очищаємо кеш останніх оновлень
    this.clearUpdateCache();

    // Запускаємо відстеження знову
    this.startProgressTracking();
  }
}

// Створюємо і експортуємо єдиний екземпляр сервісу
const taskProgress = new TaskProgress();
export default taskProgress;