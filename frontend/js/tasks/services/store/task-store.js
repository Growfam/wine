/**
 * Сховище стану завдань
 *
 * Відповідає за:
 * - Зберігання завдань
 * - Управління станом системи
 * - Координацію інших менеджерів
 */

import { TASK_TYPES } from '../../config/index.js';
import { createTaskModel } from '../../models/index.js';
import { dependencyContainer } from '../../utils/core/dependency.js';
import { saveToCache, loadFromCache } from './cache-handlers.js';

// Фабрика для отримання менеджерів (для уникнення циклічних залежностей)
const managers = {
  _balanceManager: null,
  _progressManager: null,
  _balanceManagerPromise: null,
  _progressManagerPromise: null,

  // Ледаче завантаження BalanceManager
  async getBalanceManager() {
    if (this._balanceManager) {
      return this._balanceManager;
    }

    // Спочатку спробуємо отримати через контейнер залежностей
    if (dependencyContainer && dependencyContainer.has('balanceManager')) {
      this._balanceManager = dependencyContainer.resolve('balanceManager');
      return this._balanceManager;
    }

    // Якщо не вдалося, динамічно імпортуємо
    if (!this._balanceManagerPromise) {
      this._balanceManagerPromise = import('./balance-manager.js')
        .then(module => {
          const BalanceManager = module.default || module.BalanceManager;
          this._balanceManager = new BalanceManager();
          return this._balanceManager;
        })
        .catch(error => {
          console.error('Помилка завантаження BalanceManager:', error);
          return null;
        });
    }

    return this._balanceManagerPromise;
  },

  // Ледаче завантаження ProgressManager
  async getProgressManager() {
    if (this._progressManager) {
      return this._progressManager;
    }

    // Спочатку спробуємо отримати через контейнер залежностей
    if (dependencyContainer && dependencyContainer.has('progressManager')) {
      this._progressManager = dependencyContainer.resolve('progressManager');
      return this._progressManager;
    }

    // Якщо не вдалося, динамічно імпортуємо
    if (!this._progressManagerPromise) {
      this._progressManagerPromise = import('./progress-manager.js')
        .then(module => {
          const ProgressManager = module.default || module.ProgressManager;
          this._progressManager = new ProgressManager();
          return this._progressManager;
        })
        .catch(error => {
          console.error('Помилка завантаження ProgressManager:', error);
          return null;
        });
    }

    return this._progressManagerPromise;
  }
};

class TaskStore {
  constructor() {
    // Колекції завдань за типами
    this.tasks = {
      [TASK_TYPES.SOCIAL]: [],
      [TASK_TYPES.LIMITED]: [],
      [TASK_TYPES.PARTNER]: [],
      [TASK_TYPES.REFERRAL]: [],
    };

    // Стан завантаження
    this.loading = {
      [TASK_TYPES.SOCIAL]: false,
      [TASK_TYPES.LIMITED]: false,
      [TASK_TYPES.PARTNER]: false,
      [TASK_TYPES.REFERRAL]: false,
      userProgress: false,
    };

    // Стан системи
    this.systemState = {
      initialized: false,
      activeTabType: TASK_TYPES.SOCIAL,
      tabSwitchInProgress: false,
    };

    // Список підписників на зміни
    this.subscribers = [];

    // Константи для кешу
    this.CACHE_KEYS = {
      ACTIVE_TAB: 'active_tasks_tab',
      DAILY_BONUS_INFO: 'daily_bonus_info',
      USER_PROGRESS: 'task_progress',
    };

    // Час життя кешу для різних типів даних
    this.CACHE_TTL = {
      TASKS: 600000, // 10 хвилин
      DAILY_BONUS: 43200000, // 12 годин
    };

    // Посилання на прогрес користувача
    this.userProgress = {};

    // Змінна для збереження балансу локально, якщо менеджери недоступні
    this._localBalance = {
      tokens: 0,
      coins: 0
    };
  }

  /**
   * Отримання менеджера балансу (ледаче завантаження)
   * @returns {Promise<Object>} Менеджер балансу
   */
  async getBalanceManager() {
    return managers.getBalanceManager();
  }

  /**
   * Отримання менеджера прогресу (ледаче завантаження)
   * @returns {Promise<Object>} Менеджер прогресу
   */
  async getProgressManager() {
    return managers.getProgressManager();
  }

  /**
   * Ініціалізація сховища
   * @param {Object} options - Опції ініціалізації
   */
  async initialize(options = {}) {
    if (this.systemState.initialized) return;

    try {
      // Ініціалізуємо менеджери
      const balanceManager = await this.getBalanceManager();
      if (balanceManager && typeof balanceManager.initialize === 'function') {
        balanceManager.initialize();
      }

      const progressManager = await this.getProgressManager();
      if (progressManager && typeof progressManager.initialize === 'function') {
        progressManager.initialize();
      }

      // Завантажуємо прогрес з кешу
      const progressManager2 = await this.getProgressManager();
      if (progressManager2) {
        this.userProgress = progressManager2.getAllProgress();
      }

      // Завантажуємо активну вкладку
      const activeTab = loadFromCache(this.CACHE_KEYS.ACTIVE_TAB);
      if (activeTab && Object.values(TASK_TYPES).includes(activeTab)) {
        this.systemState.activeTabType = activeTab;
      }

      // Встановлюємо стан ініціалізації
      this.systemState.initialized = true;

      // Сповіщаємо підписників про ініціалізацію
      this.notifySubscribers('initialize');
    } catch (error) {
      console.error('Помилка ініціалізації TaskStore:', error);
    }
  }

  /**
   * Підписка на зміни
   * @param {Function} callback - Функція, яка буде викликана при зміні стану
   * @returns {Function} Функція для відписки
   */
  subscribe(callback) {
    // Перевіряємо, чи не підписаний вже
    if (this.subscribers.includes(callback)) {
      return () => this.unsubscribe(callback);
    }

    // Додаємо до списку підписників
    this.subscribers.push(callback);

    // Повертаємо функцію для відписки
    return () => this.unsubscribe(callback);
  }

  /**
   * Відписка від змін
   * @param {Function} callback - Функція, яка була підписана
   */
  unsubscribe(callback) {
    // Видаляємо зі списку підписників
    this.subscribers = this.subscribers.filter((cb) => cb !== callback);
  }

  /**
   * Сповіщення всіх підписників про зміни
   * @param {string} action - Тип зміни
   * @param {*} data - Дані зміни
   */
  notifySubscribers(action, data = null) {
    // Викликаємо всі функції підписників
    this.subscribers.forEach((callback) => {
      try {
        callback(action, data);
      } catch (error) {
        console.error('Помилка виклику підписника:', error);
      }
    });

    // Генеруємо подію для глобальних обробників
    if (typeof document !== 'undefined') {
      document.dispatchEvent(
        new CustomEvent('task-store-update', {
          detail: { action, data },
        })
      );
    }
  }

  /**
   * Оновлення балансу
   * @param {string} type - Тип балансу ('coins' або 'tokens')
   * @param {number} amount - Сума
   * @param {boolean} isIncrement - Чи є це збільшенням
   */
  async updateBalance(type, amount, isIncrement = true) {
    try {
      const balanceManager = await this.getBalanceManager();

      if (balanceManager) {
        const result = balanceManager.updateBalance(type, amount, isIncrement);

        // Сповіщаємо підписників
        this.notifySubscribers('balance-updated', {
          type,
          amount,
          isIncrement,
          newBalance: result.newBalance,
        });

        return;
      }

      // Якщо balanceManager недоступний, оновлюємо локальний баланс
      const normalizedAmount = parseFloat(amount) || 0;
      const oldBalance = this._localBalance[type] || 0;

      if (isIncrement) {
        this._localBalance[type] = (this._localBalance[type] || 0) + normalizedAmount;
      } else {
        this._localBalance[type] = normalizedAmount;
      }

      const newBalance = this._localBalance[type];

      // Сповіщаємо підписників
      this.notifySubscribers('balance-updated', {
        type,
        amount,
        isIncrement,
        newBalance,
      });

      // Оновлюємо DOM самостійно
      this.updateBalanceUI(type, newBalance, isIncrement);
    } catch (error) {
      console.error('Помилка оновлення балансу:', error);
    }
  }

  /**
   * Оновлення відображення балансу в UI
   * @param {string} type - Тип балансу ('tokens' або 'coins')
   * @param {number} newBalance - Нове значення балансу
   * @param {boolean} isIncrement - Чи є це збільшенням
   */
  updateBalanceUI(type, newBalance, isIncrement) {
    try {
      if (typeof document === 'undefined') return;

      // ID елементів в UI
      const elementIds = {
        coins: 'user-coins',
        tokens: 'user-tokens',
      };

      const elementId = elementIds[type];
      if (!elementId) return;

      // Отримуємо елемент
      const element = document.getElementById(elementId);
      if (!element) return;

      // Форматуємо значення
      let formattedValue;
      if (type === 'tokens') {
        formattedValue = newBalance.toFixed(2);
      } else {
        formattedValue = newBalance.toString();
      }

      // Оновлюємо відображення
      element.textContent = formattedValue;

      // Анімуємо зміну
      element.classList.add(isIncrement ? 'balance-increased' : 'balance-decreased');

      // Видаляємо клас анімації після завершення
      setTimeout(() => {
        element.classList.remove('balance-increased', 'balance-decreased');
      }, 1500);
    } catch (error) {
      console.warn(`Помилка оновлення UI балансу ${type}:`, error);
    }
  }

  /**
   * Оновлення активної вкладки
   * @param {string} tabType - Тип вкладки
   */
  setActiveTab(tabType) {
    // Перевіряємо, чи відбувається перемикання
    if (this.systemState.tabSwitchInProgress) {
      return;
    }

    // Перевіряємо, чи змінилася вкладка
    if (tabType === this.systemState.activeTabType) {
      return;
    }

    // Встановлюємо прапорець перемикання
    this.systemState.tabSwitchInProgress = true;

    // Змінюємо активну вкладку
    const prevTabType = this.systemState.activeTabType;
    this.systemState.activeTabType = tabType;

    // Зберігаємо в кеш
    saveToCache(this.CACHE_KEYS.ACTIVE_TAB, this.systemState.activeTabType);

    // Сповіщаємо підписників
    this.notifySubscribers('tab-switched', {
      from: prevTabType,
      to: tabType,
    });

    // Знімаємо прапорець перемикання через короткий час
    setTimeout(() => {
      this.systemState.tabSwitchInProgress = false;
    }, 300);
  }

  /**
   * Отримання завдань за типом
   * @param {string} type - Тип завдань
   * @returns {Array} Масив завдань
   */
  getTasks(type) {
    return this.tasks[type] || [];
  }

  /**
   * Пошук завдання за ID
   * @param {string} taskId - ID завдання
   * @returns {TaskModel|null} Знайдене завдання
   */
  findTaskById(taskId) {
    // Спочатку перевіряємо кеш
    const cachedTask = loadFromCache(`task_${taskId}`);
    if (cachedTask) {
      return cachedTask;
    }

    // Шукаємо серед усіх типів завдань
    for (const type in this.tasks) {
      const task = this.tasks[type].find((t) => t.id === taskId);
      if (task) {
        // Зберігаємо в кеш
        saveToCache(`task_${taskId}`, task, {
          ttl: this.CACHE_TTL.TASKS,
          tags: ['tasks', `type_${type}`],
        });
        return task;
      }
    }

    return null;
  }

  /**
   * Встановлення завдань певного типу
   * @param {string} type - Тип завдань
   * @param {Array} tasks - Масив даних завдань
   */
  setTasks(type, tasks) {
    // Перевіряємо валідність типу
    if (!this.tasks.hasOwnProperty(type)) {
      console.warn(`Невідомий тип завдань: ${type}`);
      return;
    }

    // Встановлюємо прапорець завантаження
    this.loading[type] = true;
    this.notifySubscribers('loading-started', { type });

    try {
      // Конвертуємо дані в моделі
      const taskModels = tasks.map((taskData) => createTaskModel(type, taskData));

      // Зберігаємо масив завдань
      this.tasks[type] = taskModels;

      // Оновлюємо кеш для кожного завдання
      taskModels.forEach((task) => {
        saveToCache(`task_${task.id}`, task, {
          ttl: this.CACHE_TTL.TASKS,
          tags: ['tasks', `type_${type}`],
        });
      });

      // Також кешуємо весь масив завдань даного типу
      saveToCache(`tasks_${type}`, taskModels, {
        ttl: this.CACHE_TTL.TASKS,
        tags: ['tasks', `type_${type}`, 'collections'],
      });

      // Сповіщаємо підписників
      this.notifySubscribers('tasks-updated', { type, count: taskModels.length });
    } catch (error) {
      console.error(`Помилка обробки завдань типу ${type}:`, error);
      this.notifySubscribers('tasks-error', { type, error });
    } finally {
      // Знімаємо прапорець завантаження
      this.loading[type] = false;
      this.notifySubscribers('loading-finished', { type });
    }
  }

  /**
   * Додавання одного завдання
   * @param {string} type - Тип завдання
   * @param {Object} taskData - Дані завдання
   * @returns {TaskModel} Додане завдання
   */
  addTask(type, taskData) {
    // Перевіряємо валідність типу
    if (!this.tasks.hasOwnProperty(type)) {
      console.warn(`Невідомий тип завдань: ${type}`);
      return null;
    }

    // Створюємо модель завдання
    const task = createTaskModel(type, taskData);

    // Додаємо завдання до масиву
    this.tasks[type].push(task);

    // Оновлюємо кеш
    saveToCache(`task_${task.id}`, task, {
      ttl: this.CACHE_TTL.TASKS,
      tags: ['tasks', `type_${type}`],
    });

    // Також оновлюємо колекцію завдань
    saveToCache(`tasks_${type}`, this.tasks[type], {
      ttl: this.CACHE_TTL.TASKS,
      tags: ['tasks', `type_${type}`, 'collections'],
    });

    // Сповіщаємо підписників
    this.notifySubscribers('task-added', { type, task });

    return task;
  }

  /**
   * Оновлення завдання
   * @param {string} taskId - ID завдання
   * @param {Object} updateData - Дані для оновлення
   * @returns {TaskModel|null} Оновлене завдання
   */
  updateTask(taskId, updateData) {
    // Шукаємо завдання
    const task = this.findTaskById(taskId);
    if (!task) {
      console.warn(`Завдання з ID ${taskId} не знайдено`);
      return null;
    }

    // Оновлюємо дані завдання
    task.update(updateData);

    // Оновлюємо кеш
    saveToCache(`task_${taskId}`, task, {
      ttl: this.CACHE_TTL.TASKS,
      tags: ['tasks', `type_${task.type}`],
    });

    // Також оновлюємо колекцію завдань
    saveToCache(`tasks_${task.type}`, this.tasks[task.type], {
      ttl: this.CACHE_TTL.TASKS,
      tags: ['tasks', `type_${task.type}`, 'collections'],
    });

    // Сповіщаємо підписників
    this.notifySubscribers('task-updated', { task });

    return task;
  }

  /**
   * Видалення завдання
   * @param {string} taskId - ID завдання
   * @returns {boolean} Результат видалення
   */
  removeTask(taskId) {
    // Шукаємо завдання
    const task = this.findTaskById(taskId);
    if (!task) {
      console.warn(`Завдання з ID ${taskId} не знайдено`);
      return false;
    }

    // Визначаємо тип завдання
    const taskType = task.type;

    // Видаляємо завдання з масиву
    this.tasks[taskType] = this.tasks[taskType].filter((t) => t.id !== taskId);

    // Видаляємо з кешу
    const cacheService = window.cacheService || { remove: () => {} };
    cacheService.remove(`task_${taskId}`);

    // Також оновлюємо колекцію завдань
    saveToCache(`tasks_${taskType}`, this.tasks[taskType], {
      ttl: this.CACHE_TTL.TASKS,
      tags: ['tasks', `type_${taskType}`, 'collections'],
    });

    // Сповіщаємо підписників
    this.notifySubscribers('task-removed', { taskId, type: taskType });

    return true;
  }

  /**
   * Встановлення прогресу завдання
   * @param {string} taskId - ID завдання
   * @param {Object} progressData - Дані прогресу
   */
  async setTaskProgress(taskId, progressData) {
    try {
      const progressManager = await this.getProgressManager();

      if (progressManager) {
        progressManager.setTaskProgress(taskId, progressData);
      }

      // Оновлюємо статус завдання
      const task = this.findTaskById(taskId);
      if (task) {
        task.status = progressData.status || task.status;

        // Оновлюємо кеш завдання
        saveToCache(`task_${taskId}`, task, {
          ttl: this.CACHE_TTL.TASKS,
          tags: ['tasks', `type_${task.type}`],
        });
      }

      // Сповіщаємо підписників
      this.notifySubscribers('progress-updated', { taskId, progressData });
    } catch (error) {
      console.error('Помилка встановлення прогресу завдання:', error);
    }
  }

  /**
   * Отримання прогресу завдання
   * @param {string} taskId - ID завдання
   * @returns {Object|null} Дані прогресу
   */
  async getTaskProgress(taskId) {
    try {
      const progressManager = await this.getProgressManager();
      if (progressManager) {
        return progressManager.getTaskProgress(taskId);
      }
      return null;
    } catch (error) {
      console.error('Помилка отримання прогресу завдання:', error);
      return null;
    }
  }

  /**
   * Отримання всього прогресу користувача
   * @returns {Object} Прогрес користувача
   */
  async getUserProgress() {
    try {
      const progressManager = await this.getProgressManager();
      if (progressManager) {
        return progressManager.getAllProgress();
      }
      return {};
    } catch (error) {
      console.error('Помилка отримання прогресу користувача:', error);
      return {};
    }
  }

  /**
   * Встановлення всього прогресу користувача
   * @param {Object} progress - Прогрес користувача
   */
  async setUserProgress(progress) {
    try {
      // Зберігаємо посилання на прогрес
      this.userProgress = progress;

      // Встановлюємо прогрес у менеджер
      const progressManager = await this.getProgressManager();
      if (progressManager) {
        progressManager.setAllProgress(progress);
      }

      // Зберігаємо в кеш
      saveToCache(this.CACHE_KEYS.USER_PROGRESS, progress);
    } catch (error) {
      console.error('Помилка встановлення прогресу користувача:', error);
    }
  }

  /**
   * Отримання інформації про щоденний бонус
   * @returns {Object|null} Інформація про щоденний бонус
   */
  getDailyBonusInfo() {
    try {
      // Спочатку перевіряємо кеш
      const cachedInfo = loadFromCache(this.CACHE_KEYS.DAILY_BONUS_INFO);

      if (cachedInfo) {
        return cachedInfo;
      }

      return null;
    } catch (error) {
      console.error('Помилка отримання інформації про щоденний бонус:', error);
      return null;
    }
  }

  /**
   * Оновлення інформації про щоденний бонус
   * @param {Object} data - Дані щоденного бонусу
   * @returns {boolean} Результат оновлення
   */
  updateDailyBonusInfo(data) {
    try {
      // Зберігаємо в кеш
      saveToCache(this.CACHE_KEYS.DAILY_BONUS_INFO, data, {
        ttl: this.CACHE_TTL.DAILY_BONUS,
        tags: ['daily_bonus', 'user'],
      });

      // Сповіщаємо підписників
      this.notifySubscribers('daily-bonus-updated', { data });

      return true;
    } catch (error) {
      console.error('Помилка оновлення інформації про щоденний бонус:', error);
      return false;
    }
  }

  /**
   * Очищення кешу сховища
   */
  clearCache() {
    // Видаляємо всі завдання з кешу
    const cacheService = window.cacheService || { removeByTags: () => {} };
    cacheService.removeByTags('tasks');
  }

  /**
   * Скидання стану сховища
   */
  async resetState() {
    try {
      // Очищаємо кеш
      this.clearCache();

      // Скидаємо колекції завдань
      for (const type in this.tasks) {
        this.tasks[type] = [];
      }

      // Скидаємо стан інших менеджерів
      const balanceManager = await this.getBalanceManager();
      if (balanceManager && typeof balanceManager.resetState === 'function') {
        balanceManager.resetState();
      }

      const progressManager = await this.getProgressManager();
      if (progressManager && typeof progressManager.resetState === 'function') {
        progressManager.resetState();
      }

      // Скидаємо прогрес користувача
      this.userProgress = {};

      // Сповіщаємо підписників
      this.notifySubscribers('state-reset');
    } catch (error) {
      console.error('Помилка скидання стану сховища:', error);
    }
  }
}

// Створюємо і експортуємо єдиний екземпляр сховища
const taskStore = new TaskStore();

// Ініціалізуємо сховище
if (typeof window !== 'undefined') {
  // Викликаємо асинхронну ініціалізацію
  setTimeout(() => {
    taskStore.initialize().catch(error => {
      console.error('Помилка ініціалізації TaskStore:', error);
    });
  }, 0);
}

export default taskStore;