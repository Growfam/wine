/**
 * Сховище стану завдань
 *
 * Відповідає за:
 * - Зберігання завдань
 * - Зберігання прогресу
 * - Управління станом системи
 */

import { TASK_TYPES } from '../config/task-types.js';
import { TaskModel } from '../models/task-model.js';
import { SocialTaskModel } from '../models/social-task-model.js';
import { LimitedTaskModel } from '../models/limited-task-model.js';
import { PartnerTaskModel } from '../models/partner-task-model.js';

class TaskStore {
  constructor() {
    // Колекції завдань за типами
    this.tasks = {
      [TASK_TYPES.SOCIAL]: [],
      [TASK_TYPES.LIMITED]: [],
      [TASK_TYPES.PARTNER]: [],
      [TASK_TYPES.REFERRAL]: []
    };

    // Поточний прогрес користувача
    this.userProgress = {};

    // Балансы користувача
    this.userBalances = {
      tokens: null,
      coins: null
    };

    // Стан завантаження
    this.loading = {
      [TASK_TYPES.SOCIAL]: false,
      [TASK_TYPES.LIMITED]: false,
      [TASK_TYPES.PARTNER]: false,
      [TASK_TYPES.REFERRAL]: false,
      userProgress: false
    };

    // Стан системи
    this.systemState = {
      initialized: false,
      activeTabType: TASK_TYPES.SOCIAL,
      tabSwitchInProgress: false
    };

    // Список підписників на зміни
    this.subscribers = [];

    // Кеш для оптимізації
    this.cache = new Map();
  }

  /**
   * Ініціалізація сховища
   */
  initialize() {
    if (this.systemState.initialized) return;

    // Завантажуємо прогрес з localStorage
    this.loadFromLocalStorage();

    // Завантажуємо баланси
    this.loadBalances();

    // Встановлюємо стан ініціалізації
    this.systemState.initialized = true;

    // Сповіщаємо підписників про ініціалізацію
    this.notifySubscribers('initialize');
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
    this.subscribers = this.subscribers.filter(cb => cb !== callback);
  }

  /**
   * Сповіщення всіх підписників про зміни
   * @param {string} action - Тип зміни
   * @param {*} data - Дані зміни
   */
  notifySubscribers(action, data = null) {
    // Викликаємо всі функції підписників
    this.subscribers.forEach(callback => {
      try {
        callback(action, data);
      } catch (error) {
        console.error('Помилка виклику підписника:', error);
      }
    });

    // Генеруємо подію для глобальних обробників
    document.dispatchEvent(new CustomEvent('task-store-update', {
      detail: { action, data }
    }));
  }

  /**
   * Завантаження даних з localStorage
   */
  loadFromLocalStorage() {
    try {
      // Завантажуємо прогрес
      const savedProgress = localStorage.getItem('winix_task_progress');
      if (savedProgress) {
        this.userProgress = JSON.parse(savedProgress);
      }

      // Завантажуємо активну вкладку
      const activeTab = localStorage.getItem('active_tasks_tab');
      if (activeTab && Object.values(TASK_TYPES).includes(activeTab)) {
        this.systemState.activeTabType = activeTab;
      }
    } catch (error) {
      console.warn('Помилка завантаження даних з localStorage:', error);
    }
  }

  /**
   * Збереження даних в localStorage
   */
  saveToLocalStorage() {
    try {
      // Зберігаємо прогрес
      localStorage.setItem('winix_task_progress', JSON.stringify(this.userProgress));

      // Зберігаємо активну вкладку
      localStorage.setItem('active_tasks_tab', this.systemState.activeTabType);
    } catch (error) {
      console.warn('Помилка збереження даних в localStorage:', error);
    }
  }

  /**
   * Завантаження балансів користувача
   */
  loadBalances() {
    try {
      // Завантажуємо баланс токенів
      const tokensElement = document.getElementById('user-tokens');
      if (tokensElement) {
        this.userBalances.tokens = parseFloat(tokensElement.textContent) || 0;
      } else {
        // Спробуємо з localStorage
        const savedTokens = localStorage.getItem('winix_balance') || localStorage.getItem('userTokens');
        this.userBalances.tokens = savedTokens ? parseFloat(savedTokens) : null;
      }

      // Завантажуємо баланс жетонів
      const coinsElement = document.getElementById('user-coins');
      if (coinsElement) {
        this.userBalances.coins = parseInt(coinsElement.textContent) || 0;
      } else {
        // Спробуємо з localStorage
        const savedCoins = localStorage.getItem('winix_coins') || localStorage.getItem('userCoins');
        this.userBalances.coins = savedCoins ? parseInt(savedCoins) : null;
      }
    } catch (error) {
      console.warn('Помилка завантаження балансів:', error);
    }
  }

  /**
   * Оновлення балансів користувача
   * @param {string} type - Тип балансу
   * @param {number} amount - Сума
   * @param {boolean} isIncrement - Чи є це збільшенням
   */
  updateBalance(type, amount, isIncrement = true) {
    // Нормалізуємо суму
    const normalizedAmount = parseFloat(amount) || 0;

    // Оновлюємо відповідний баланс
    if (type === 'tokens') {
      if (isIncrement) {
        this.userBalances.tokens += normalizedAmount;
      } else {
        this.userBalances.tokens = normalizedAmount;
      }

      // Оновлюємо DOM
      const tokensElement = document.getElementById('user-tokens');
      if (tokensElement) {
        tokensElement.textContent = this.userBalances.tokens.toFixed(2);
        tokensElement.classList.add(isIncrement ? 'increasing' : 'updated');
        setTimeout(() => {
          tokensElement.classList.remove(isIncrement ? 'increasing' : 'updated');
        }, 1500);
      }

      // Зберігаємо в localStorage
      try {
        localStorage.setItem('userTokens', this.userBalances.tokens.toString());
        localStorage.setItem('winix_balance', this.userBalances.tokens.toString());
      } catch (e) {
        // Ігноруємо помилки localStorage
      }
    } else if (type === 'coins') {
      if (isIncrement) {
        this.userBalances.coins += normalizedAmount;
      } else {
        this.userBalances.coins = normalizedAmount;
      }

      // Оновлюємо DOM
      const coinsElement = document.getElementById('user-coins');
      if (coinsElement) {
        coinsElement.textContent = this.userBalances.coins.toString();
        coinsElement.classList.add(isIncrement ? 'increasing' : 'updated');
        setTimeout(() => {
          coinsElement.classList.remove(isIncrement ? 'increasing' : 'updated');
        }, 1500);
      }

      // Зберігаємо в localStorage
      try {
        localStorage.setItem('userCoins', this.userBalances.coins.toString());
        localStorage.setItem('winix_coins', this.userBalances.coins.toString());
      } catch (e) {
        // Ігноруємо помилки localStorage
      }
    }

    // Сповіщаємо підписників
    this.notifySubscribers('balance-updated', {
      type,
      amount: normalizedAmount,
      isIncrement,
      newBalance: type === 'tokens' ? this.userBalances.tokens : this.userBalances.coins
    });
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

    // Зберігаємо в localStorage
    this.saveToLocalStorage();

    // Сповіщаємо підписників
    this.notifySubscribers('tab-switched', {
      from: prevTabType,
      to: tabType
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
    if (this.cache.has(taskId)) {
      return this.cache.get(taskId);
    }

    // Шукаємо серед усіх типів завдань
    for (const type in this.tasks) {
      const task = this.tasks[type].find(t => t.id === taskId);
      if (task) {
        // Зберігаємо в кеш
        this.cache.set(taskId, task);
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
      const taskModels = tasks.map(taskData => {
        switch (type) {
          case TASK_TYPES.SOCIAL:
            return SocialTaskModel.fromApiData(taskData);
          case TASK_TYPES.LIMITED:
            return LimitedTaskModel.fromApiData(taskData);
          case TASK_TYPES.PARTNER:
            return PartnerTaskModel.fromApiData(taskData);
          case TASK_TYPES.REFERRAL:
            return SocialTaskModel.fromApiData(taskData);
          default:
            return TaskModel.fromApiData(taskData);
        }
      });

      // Зберігаємо масив завдань
      this.tasks[type] = taskModels;

      // Оновлюємо кеш
      taskModels.forEach(task => {
        this.cache.set(task.id, task);
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
    let task;
    switch (type) {
      case TASK_TYPES.SOCIAL:
        task = SocialTaskModel.fromApiData(taskData);
        break;
      case TASK_TYPES.LIMITED:
        task = LimitedTaskModel.fromApiData(taskData);
        break;
      case TASK_TYPES.PARTNER:
        task = PartnerTaskModel.fromApiData(taskData);
        break;
      case TASK_TYPES.REFERRAL:
        task = SocialTaskModel.fromApiData(taskData);
        break;
      default:
        task = TaskModel.fromApiData(taskData);
    }

    // Додаємо завдання до масиву
    this.tasks[type].push(task);

    // Оновлюємо кеш
    this.cache.set(task.id, task);

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
    this.cache.set(taskId, task);

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
    this.tasks[taskType] = this.tasks[taskType].filter(t => t.id !== taskId);

    // Видаляємо з кешу
    this.cache.delete(taskId);

    // Сповіщаємо підписників
    this.notifySubscribers('task-removed', { taskId, type: taskType });

    return true;
  }

  /**
   * Встановлення прогресу завдання
   * @param {string} taskId - ID завдання
   * @param {Object} progressData - Дані прогресу
   */
  setTaskProgress(taskId, progressData) {
    // Перевіряємо валідність даних
    if (!taskId || !progressData) {
      console.warn('Некоректні дані прогресу');
      return;
    }

    // Зберігаємо прогрес
    this.userProgress[taskId] = progressData;

    // Зберігаємо в localStorage
    this.saveToLocalStorage();

    // Оновлюємо статус завдання
    const task = this.findTaskById(taskId);
    if (task) {
      task.status = progressData.status || task.status;
    }

    // Сповіщаємо підписників
    this.notifySubscribers('progress-updated', { taskId, progressData });
  }

  /**
   * Отримання прогресу завдання
   * @param {string} taskId - ID завдання
   * @returns {Object|null} Дані прогресу
   */
  getTaskProgress(taskId) {
    return this.userProgress[taskId] || null;
  }

  /**
   * Отримання всього прогресу користувача
   * @returns {Object} Прогрес користувача
   */
  getUserProgress() {
    return { ...this.userProgress };
  }

  /**
   * Встановлення всього прогресу користувача
   * @param {Object} progress - Прогрес користувача
   */
  setUserProgress(progress) {
    // Перевіряємо валідність даних
    if (!progress || typeof progress !== 'object') {
      console.warn('Некоректні дані прогресу');
      return;
    }

    // Зберігаємо прогрес
    this.userProgress = { ...progress };

    // Зберігаємо в localStorage
    this.saveToLocalStorage();

    // Сповіщаємо підписників
    this.notifySubscribers('all-progress-updated', { progress: this.userProgress });
  }

  /**
   * Очищення кешу сховища
   */
  clearCache() {
    this.cache.clear();
  }

  /**
   * Скидання стану сховища
   */
  resetState() {
    // Очищаємо кеш
    this.clearCache();

    // Скидаємо колекції завдань
    for (const type in this.tasks) {
      this.tasks[type] = [];
    }

    // Сповіщаємо підписників
    this.notifySubscribers('state-reset');
  }
}

// Створюємо і експортуємо єдиний екземпляр сховища
const taskStore = new TaskStore();
export default taskStore;