/**
 * Сервіс управління прогресом завдань
 *
 * Відповідає за:
 * - Відстеження прогресу виконання завдань
 * - Оновлення прогресу в реальному часі
 */

import { TASK_STATUS, CONFIG } from '../../config';
import { taskStore } from '../index';

class TaskProgress {
  constructor() {
    // Прапорець активності модуля
    this.isActive = false;

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

    // Прив'язуємо обробники подій для збереження контексту this
    this.handleTaskCompleted = this.handleTaskCompleted.bind(this);
    this.handleProgressUpdated = this.handleProgressUpdated.bind(this);
    this.handleTabSwitch = this.handleTabSwitch.bind(this);

    // Зберігаємо стан реєстрації обробників
    this.eventHandlersRegistered = false;
  }

  /**
   * Ініціалізація модуля
   */
  initialize() {
    // Запобігаємо повторній ініціалізації
    if (this.isActive) {
      console.warn('TaskProgress: Сервіс вже ініціалізовано');
      return;
    }

    // Встановлюємо прапорець активності
    this.isActive = true;
    console.log('TaskProgress: Ініціалізація сервісу управління прогресом');

    // Підписка на події
    this.setupEventListeners();

    // Запуск інтервалу відстеження прогресу
    this.startProgressTracking();

    // Генеруємо подію про ініціалізацію
    document.dispatchEvent(new CustomEvent('task-progress-initialized'));
  }

  /**
   * Встановлення слухачів подій
   */
  setupEventListeners() {
    // Запобігаємо повторній реєстрації обробників
    if (this.eventHandlersRegistered) {
      return;
    }

    // Підписка на подію завершення завдання
    document.addEventListener('task-completed', this.handleTaskCompleted);

    // Підписка на подію оновлення прогресу
    document.addEventListener('task-progress-updated', this.handleProgressUpdated);

    // Підписка на подію зміни вкладки
    document.addEventListener('tab-switched', this.handleTabSwitch);

    // Позначаємо, що обробники зареєстровані
    this.eventHandlersRegistered = true;

    console.log('TaskProgress: Обробники подій зареєстровано');
  }

  /**
   * Видалення слухачів подій
   */
  removeEventListeners() {
    if (!this.eventHandlersRegistered) {
      return;
    }

    // Видаляємо всі обробники подій
    document.removeEventListener('task-completed', this.handleTaskCompleted);
    document.removeEventListener('task-progress-updated', this.handleProgressUpdated);
    document.removeEventListener('tab-switched', this.handleTabSwitch);

    // Позначаємо, що обробники видалені
    this.eventHandlersRegistered = false;

    console.log('TaskProgress: Обробники подій видалено');
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
      if (this.isActive) {
        this.updateAllTasksProgress();
      }
    }, CONFIG.PROGRESS_UPDATE_INTERVAL);

    console.log(`TaskProgress: Запущено відстеження прогресу (інтервал: ${CONFIG.PROGRESS_UPDATE_INTERVAL}мс)`);
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

    console.log('TaskProgress: Зупинено відстеження прогресу');
  }

  /**
   * Обробник події завершення завдання
   * @param {CustomEvent} event - Подія
   */
  handleTaskCompleted(event) {
    // Перевіряємо активність модуля
    if (!this.isActive) return;

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
    // Перевіряємо активність модуля
    if (!this.isActive) return;

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
    // Перевіряємо активність модуля
    if (!this.isActive) return;

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
    // Перевіряємо активність модуля
    if (!this.isActive) return;

    // Оновлюємо прогрес для всіх відстежуваних завдань
    this.tracking.trackedTasks.forEach(taskId => {
      this.checkTaskProgress(taskId);
    });
  }

  /**
   * Оновлення прогресу для видимих завдань
   */
  updateVisibleTasksProgress() {
    // Перевіряємо активність модуля
    if (!this.isActive) return;

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
    // Перевіряємо активність модуля
    if (!this.isActive) return;

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
  }

  /**
   * Оновлення прогресу завдання
   * @param {string} taskId - ID завдання
   * @param {Object} progressData - Дані прогресу
   * @returns {boolean} Результат оновлення
   */
  updateTaskProgress(taskId, progressData) {
    // Перевіряємо активність модуля
    if (!this.isActive) {
      console.warn('TaskProgress: Сервіс не активний');
      return false;
    }

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
    // Перевіряємо активність модуля
    if (!this.isActive) {
      console.warn('TaskProgress: Сервіс не активний');
      return false;
    }

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
        return parseInt(targetAttr) || a;
      }
    }

    return 1; // За замовчуванням
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
    // Перевіряємо активність модуля
    if (!this.isActive) {
      console.warn('TaskProgress: Сервіс не активний');
      return;
    }

    // Зупиняємо відстеження
    this.stopProgressTracking();

    // Очищаємо список відстежуваних завдань
    this.tracking.trackedTasks.clear();

    // Очищаємо кеш останніх оновлень
    this.clearUpdateCache();

    // Запускаємо відстеження знову
    this.startProgressTracking();

    console.log('TaskProgress: Стан сервісу скинуто');
  }

  /**
   * Повне очищення ресурсів сервісу
   */
  destroy() {
    // Зупиняємо відстеження
    this.stopProgressTracking();

    // Видаляємо всі слухачі подій
    this.removeEventListeners();

    // Очищаємо всі колекції
    this.tracking.trackedTasks.clear();
    this.lastUpdates.clear();

    // Очищаємо всі слухачі внутрішніх подій
    this.listeners.onProgressUpdate.clear();
    this.listeners.onTaskCompleted.clear();

    // Встановлюємо прапорець деактивації
    this.isActive = false;

    // Генеруємо подію про деактивацію
    document.dispatchEvent(new CustomEvent('task-progress-destroyed'));

    console.log('TaskProgress: Ресурси сервісу повністю очищено');
  }

  /**
   * Призупинення роботи сервісу без повного видалення
   */
  pause() {
    // Перевіряємо активність модуля
    if (!this.isActive) {
      console.warn('TaskProgress: Сервіс не активний');
      return;
    }

    // Зупиняємо інтервали і відстеження
    this.stopProgressTracking();
    console.log('TaskProgress: Сервіс призупинено');
  }

  /**
   * Відновлення роботи сервісу
   */
  resume() {
    // Перевіряємо активність модуля
    if (!this.isActive) {
      this.initialize();
      return;
    }

    // Відновлюємо роботу інтервалів
    this.startProgressTracking();
    console.log('TaskProgress: Сервіс відновлено');
  }
}

export default TaskProgress;